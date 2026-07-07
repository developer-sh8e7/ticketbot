"""
On-screen captions — a normal, always-on-top window (Tkinter) positioned so its
native title bar/frame sits off-screen, leaving only the styled content box
visible. Why not a borderless (overrideredirect) window: confirmed by live
testing against OBS that overrideredirect windows are excluded from OBS's
Window Capture window list entirely, even with WS_CAPTION/WS_EX_APPWINDOW
re-applied by hand — some other internal Tk/DWM state still hides it. A plain,
undecorated-in-appearance-only window is captured by OBS exactly like any
other real application window (proven live: it shows up in the window list),
because it genuinely IS a normal window; we just push its frame above the
visible desktop so only the content is on screen.

Why an overlay at all (option A) instead of an OBS text source (option B): the
caption timing is driven locally, in-process, with zero websocket round-trips,
so it can never drift out of sync with the recording steps. Styling and
position are fully controlled here from config — the only OBS setup needed is
ONE Window Capture source pointing at this window (title = caption.window_title).

Tkinter must own the main thread, so the recording sequence runs in a worker
thread and pushes caption text here through a thread-safe queue.
"""
import ctypes
import queue
import tkinter as tk
from ctypes import wintypes

_user32 = ctypes.windll.user32


def _frame_offsets(hwnd):
    """(left, top) pixels the OS frame adds outside the client area, measured
    from the window's CURRENT on-screen state (must be shown/painted first)."""
    rect = wintypes.RECT()
    _user32.GetWindowRect(hwnd, ctypes.byref(rect))
    pt = wintypes.POINT(0, 0)
    _user32.ClientToScreen(hwnd, ctypes.byref(pt))
    return pt.x - rect.left, pt.y - rect.top


class CaptionOverlay:
    def __init__(self, cfg):
        self.cfg = cfg or {}
        self._q = queue.Queue()
        self._hidden = True
        self._frame_left = 0
        self._frame_top = 0
        self._measured = False
        self._render_calls = 0

        self.root = tk.Tk()
        self.root.withdraw()  # the hidden root; the visible caption is a Toplevel

        self.sw = self.root.winfo_screenwidth()
        self.sh = self.root.winfo_screenheight()

        box_color = self.cfg.get("box_color", "#111214")
        self.win = tk.Toplevel(self.root)
        self.win.title(self.cfg.get("window_title", "OpusCaption"))
        self.win.resizable(False, False)
        self.win.attributes("-topmost", True)     # always on top
        self.win.attributes("-alpha", float(self.cfg.get("box_alpha", 0.9)))
        self.win.configure(bg=box_color)

        self.label = tk.Label(
            self.win,
            text="",
            font=(self.cfg.get("font", "Segoe UI"), int(self.cfg.get("font_size", 30)), "bold"),
            fg=self.cfg.get("text_color", "#ffffff"),
            bg=box_color,
            justify="right" if self.cfg.get("rtl", False) else "left",
            wraplength=int(self.cfg.get("max_width", 640)),
            padx=int(self.cfg.get("pad_x", 26)),
            pady=int(self.cfg.get("pad_y", 16)),
            borderwidth=0,
            highlightthickness=1,
            highlightbackground=self.cfg.get("border_color", "#2b2d31"),
        )
        self.label.pack()

        # Place it fully off-screen (not withdrawn) so the OS actually paints a
        # real frame we can measure, without it being visible to the user yet.
        self.win.geometry(f"+{self.sw + 500}+{self.sh + 500}")
        self.win.update_idletasks()
        self.win.update()

        self._on_close = None
        self._poll()

    # -- public, thread-safe API (called from the worker thread) ----------
    def show(self, text):
        self._q.put(("text", text or ""))

    def clear(self):
        self._q.put(("text", ""))

    def close(self):
        """Ask the Tk main loop to quit (safe to call from any thread)."""
        self._q.put(("quit", None))

    def run(self, on_close=None):
        """Blocks on the Tk main loop — must be called from the main thread."""
        self._on_close = on_close
        self.root.mainloop()

    # -- internals ----------------------------------------------------------
    def _poll(self):
        try:
            while True:
                kind, payload = self._q.get_nowait()
                if kind == "quit":
                    self.root.quit()
                    return
                if kind == "text":
                    self._render(payload)
        except queue.Empty:
            pass
        self.root.after(40, self._poll)

    def _ensure_frame_offset(self):
        """Measure the title bar/border size once the window has really been
        painted at least once (frame metrics are OS/theme constants, independent
        of window content, so one measurement is reused for every reposition).
        Falls back to standard Windows metrics if live measurement ever reports
        zero (some DWM/theme combinations report the frame lazily)."""
        if self._measured:
            return
        hwnd = self.win.winfo_id()
        left, top = _frame_offsets(hwnd)
        if top > 0:  # a real measurement (0 means "not painted with a frame yet")
            self._frame_left, self._frame_top = left, top
            self._measured = True
        elif self._render_calls >= 2:
            # standard Windows 10/11 caption + sizing-frame + padded-border metrics
            SM_CYCAPTION, SM_CXFRAME, SM_CYFRAME, SM_CXPADDEDBORDER = 4, 32, 33, 92
            padded = _user32.GetSystemMetrics(SM_CXPADDEDBORDER)
            self._frame_left = _user32.GetSystemMetrics(SM_CXFRAME) + padded
            self._frame_top = _user32.GetSystemMetrics(SM_CYCAPTION) + _user32.GetSystemMetrics(SM_CYFRAME) + padded
            self._measured = True

    def _render(self, text):
        self._render_calls += 1
        if not text:
            self.win.geometry(f"+{self.sw + 500}+{self.sh + 500}")  # park off-screen
            self._hidden = True
            return

        self.label.config(text=text)
        self.win.update_idletasks()
        w = self.win.winfo_reqwidth()
        h = self.win.winfo_reqheight()
        margin = int(self.cfg.get("margin", 48))
        corner = str(self.cfg.get("corner", "bottom-right"))
        # target position for the CONTENT (client area), not the window frame
        x = self.sw - w - margin if "right" in corner else margin
        y = self.sh - h - margin if "bottom" in corner else margin

        self._ensure_frame_offset()
        self.win.geometry(f"+{max(0, x) - self._frame_left}+{max(0, y) - self._frame_top}")
        self.win.update_idletasks()
        self._ensure_frame_offset()  # first real paint may only settle now

        self._hidden = False
        self.win.lift()
        self.win.attributes("-topmost", True)

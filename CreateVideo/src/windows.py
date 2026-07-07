"""
Window helpers — find a top-level window by (partial, case-insensitive) title
and bring it to the foreground robustly.

Note: OBS Window Capture (Windows Graphics Capture) records a target window even
when it is in the background, so foregrounding is best-effort for on-screen
rendering — a failure to foreground does not break the capture.
"""
import ctypes

import win32con
import win32gui
import win32process


def find_window(title_contains):
    """Return (hwnd, title) of the first visible window whose title contains the
    given substring, or None."""
    needle = title_contains.lower()
    matches = []

    def _cb(hwnd, _):
        if win32gui.IsWindowVisible(hwnd):
            title = win32gui.GetWindowText(hwnd)
            if title and needle in title.lower():
                matches.append((hwnd, title))
        return True

    win32gui.EnumWindows(_cb, None)
    return matches[0] if matches else None


def _force_foreground(hwnd):
    """Best-effort SetForegroundWindow that works around the foreground lock."""
    cur = ctypes.windll.kernel32.GetCurrentThreadId()
    fg = win32gui.GetForegroundWindow()
    fg_thread = win32process.GetWindowThreadProcessId(fg)[0] if fg else 0
    tgt_thread = win32process.GetWindowThreadProcessId(hwnd)[0]

    for t in {fg_thread, tgt_thread}:
        if t and t != cur:
            ctypes.windll.user32.AttachThreadInput(cur, t, True)
    try:
        win32gui.ShowWindow(hwnd, win32con.SW_RESTORE)
        win32gui.BringWindowToTop(hwnd)
        try:
            win32gui.SetForegroundWindow(hwnd)
        except Exception:  # noqa: BLE001 — foreground lock can still reject; ignore
            pass
    finally:
        for t in {fg_thread, tgt_thread}:
            if t and t != cur:
                ctypes.windll.user32.AttachThreadInput(cur, t, False)


def focus_window(title_contains):
    """Find and foreground a window. Raises if no matching window exists."""
    found = find_window(title_contains)
    if not found:
        raise RuntimeError(f"No window found whose title contains: '{title_contains}'")
    hwnd, title = found
    _force_foreground(hwnd)
    return hwnd, title

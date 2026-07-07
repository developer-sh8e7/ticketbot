"""
Taskbar controller — hide/show the Windows taskbar safely via the Win32 API.

We deliberately do NOT touch explorer.exe. ShowWindow(Shell_TrayWnd, SW_HIDE)
hides the taskbar (primary + every secondary-monitor bar) instantly without
killing any process, and SW_SHOW brings it straight back. Fully reversible,
no shell restart, no registry writes.
"""
import ctypes
from ctypes import wintypes

_user32 = ctypes.windll.user32

SW_HIDE = 0
SW_SHOW = 5

_user32.FindWindowW.restype = wintypes.HWND
_user32.FindWindowW.argtypes = [wintypes.LPCWSTR, wintypes.LPCWSTR]
_user32.FindWindowExW.restype = wintypes.HWND
_user32.FindWindowExW.argtypes = [wintypes.HWND, wintypes.HWND, wintypes.LPCWSTR, wintypes.LPCWSTR]
_user32.ShowWindow.restype = wintypes.BOOL
_user32.ShowWindow.argtypes = [wintypes.HWND, ctypes.c_int]
_user32.IsWindowVisible.restype = wintypes.BOOL
_user32.IsWindowVisible.argtypes = [wintypes.HWND]


def _all_taskbars():
    """Every taskbar window: the primary Shell_TrayWnd + all Shell_SecondaryTrayWnd."""
    bars = []
    primary = _user32.FindWindowW("Shell_TrayWnd", None)
    if primary:
        bars.append(primary)
    hwnd = None
    while True:
        hwnd = _user32.FindWindowExW(None, hwnd, "Shell_SecondaryTrayWnd", None)
        if not hwnd:
            break
        bars.append(hwnd)
    return bars


def hide():
    """Hide every taskbar. Returns the count hidden."""
    bars = _all_taskbars()
    for h in bars:
        _user32.ShowWindow(h, SW_HIDE)
    return len(bars)


def show():
    """Show every taskbar again. Returns the count shown."""
    bars = _all_taskbars()
    for h in bars:
        _user32.ShowWindow(h, SW_SHOW)
    return len(bars)


def is_visible():
    """True only if the primary taskbar exists AND is currently visible."""
    primary = _user32.FindWindowW("Shell_TrayWnd", None)
    return bool(primary and _user32.IsWindowVisible(primary))


def restore_and_verify(attempts=5):
    """
    Force the taskbar back and confirm it is actually visible before returning.
    Retries a few times; raises RuntimeError if it can't be restored.
    """
    import time
    for _ in range(max(1, attempts)):
        show()
        if is_visible():
            return True
        time.sleep(0.25)
    raise RuntimeError("Could not restore the taskbar to its normal state — check manually.")

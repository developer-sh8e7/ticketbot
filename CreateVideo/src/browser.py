"""
Browser automation — thin Playwright (sync) wrapper for the website portion.

Created and used entirely inside the worker thread that runs the recording
sequence, which keeps Playwright's sync API on a single thread as it requires.
Launches a real, maximised Chrome window so OBS Window Capture can target it.
"""
from playwright.sync_api import sync_playwright


class Browser:
    def __init__(self, cfg):
        self.cfg = cfg or {}
        self._pw = None
        self.browser = None
        self.ctx = None
        self.page = None

    def start(self):
        self._pw = sync_playwright().start()
        launch_kwargs = {
            "headless": bool(self.cfg.get("headless", False)),
            "args": ["--start-maximized"],
        }
        channel = self.cfg.get("channel")  # e.g. "chrome" / "msedge"; omit for bundled Chromium
        if channel:
            launch_kwargs["channel"] = channel
        self.browser = self._pw.chromium.launch(**launch_kwargs)
        self.ctx = self.browser.new_context(no_viewport=True)
        self.page = self.ctx.new_page()
        return self

    def goto(self, url):
        timeout = int(self.cfg.get("nav_timeout_ms", 30000))
        self.page.goto(url, wait_until=self.cfg.get("wait_until", "load"), timeout=timeout)

    def click(self, selector):
        self.page.click(selector, timeout=int(self.cfg.get("action_timeout_ms", 15000)))

    def fill(self, selector, text):
        self.page.fill(selector, text, timeout=int(self.cfg.get("action_timeout_ms", 15000)))

    def scroll(self, pixels):
        self.page.mouse.wheel(0, int(pixels))

    def stop(self):
        try:
            if self.ctx:
                self.ctx.close()
        except Exception:  # noqa: BLE001
            pass
        try:
            if self.browser:
                self.browser.close()
        except Exception:  # noqa: BLE001
            pass
        try:
            if self._pw:
                self._pw.stop()
        except Exception:  # noqa: BLE001
            pass

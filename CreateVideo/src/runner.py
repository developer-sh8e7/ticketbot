"""
Runner — orchestrates one recording, in a worker thread.

Order of operations:
  connect OBS -> select scene -> start browser -> hide taskbar -> set initial
  source visibility -> START RECORDING -> run each config step (caption + action
  + wait) -> STOP RECORDING -> save file with a timestamped name.

Guarantees (via try/finally): the taskbar is ALWAYS restored and verified, the
browser is always closed, and OBS is always disconnected — even if a step
throws. On failure it stops recording immediately and reports the exact step
that failed.
"""
import os
import shutil
import time
from datetime import datetime

from .browser import Browser
from .obs_controller import ObsController, ObsError
from . import taskbar
from . import windows


class StepError(RuntimeError):
    def __init__(self, index, name, cause):
        self.index = index
        self.name = name
        self.cause = cause
        super().__init__(f"Failed at step #{index + 1} '{name}': {cause}")


class Runner:
    def __init__(self, cfg, output_dir):
        self.cfg = cfg
        self.output_dir = output_dir
        self.obs = None
        self.browser = None
        self._taskbar_hidden = False

    def run(self, overlay):
        """Returns dict: {ok, message, output_path}. Never raises."""
        result = {"ok": False, "message": "", "output_path": None}
        recording = False
        try:
            # connect OBS BEFORE hiding anything, so a bad connection is harmless
            obs_cfg = self.cfg.get("obs", {})
            self.obs = ObsController(
                host=obs_cfg.get("host", "localhost"),
                port=int(obs_cfg.get("port", 4455)),
                password=obs_cfg.get("password", ""),
                scene=obs_cfg.get("scene"),
            )
            self.obs.select_scene()

            # browser
            if self.cfg.get("browser", {}).get("enabled", True):
                self.browser = Browser(self.cfg["browser"]).start()

            # initial source visibility (show content, hide the other window)
            init = self.cfg.get("initial_sources")
            if init:
                self.obs.switch(show=init.get("show"), hide=init.get("hide"))

            # hide taskbar
            if self.cfg.get("hide_taskbar", True):
                taskbar.hide()
                self._taskbar_hidden = True

            time.sleep(float(self.cfg.get("pre_record_wait", 1.0)))

            # record
            self.obs.start_recording()
            recording = True

            for index, step in enumerate(self.cfg.get("steps", [])):
                self._run_step(index, step, overlay)

            overlay.clear()
            time.sleep(float(self.cfg.get("post_record_wait", 1.0)))

            path = self.obs.stop_recording()
            recording = False
            result["output_path"] = self._save_output(path)
            result["ok"] = True
            result["message"] = "Recording finished successfully."
        except StepError as exc:
            if recording and self.obs:
                self.obs.stop_recording()
                recording = False
            result["message"] = str(exc)
        except (ObsError, Exception) as exc:  # noqa: BLE001
            if recording and self.obs:
                try:
                    self.obs.stop_recording()
                except Exception:  # noqa: BLE001
                    pass
            result["message"] = f"Error: {exc}"
        finally:
            self._cleanup()
            overlay.close()
        return result

    # -- steps ------------------------------------------------------------
    def _run_step(self, index, step, overlay):
        name = step.get("name", f"step-{index + 1}")
        try:
            if "caption" in step:
                overlay.show(step.get("caption"))
            elif step.get("caption_clear"):
                overlay.clear()

            action = step.get("action")
            if action:
                self._do_action(action)

            wait = step.get("wait")
            if wait:
                time.sleep(float(wait))
        except Exception as exc:  # noqa: BLE001
            raise StepError(index, name, exc) from exc

    def _do_action(self, action):
        atype = action.get("type")
        if atype == "browser_goto":
            self._require_browser()
            self.browser.goto(action["url"])
        elif atype == "browser_click":
            self._require_browser()
            self.browser.click(action["selector"])
        elif atype == "browser_fill":
            self._require_browser()
            self.browser.fill(action["selector"], action.get("text", ""))
        elif atype == "browser_scroll":
            self._require_browser()
            self.browser.scroll(action.get("pixels", 600))
        elif atype == "focus_window":
            windows.focus_window(action["window_contains"])
        elif atype == "obs_switch":
            # synchronised handoff: foreground the target window (if given) then
            # flip OBS source visibility right after — adjacent, no timing gap.
            if action.get("focus_window_contains"):
                try:
                    windows.focus_window(action["focus_window_contains"])
                except Exception:  # noqa: BLE001 — capture still works on bg windows
                    pass
            self.obs.switch(show=action.get("show"), hide=action.get("hide"))
        elif atype == "obs_set_window":
            self.obs.set_window_input(action["source"], action["window"])
        elif atype == "sleep":
            time.sleep(float(action.get("seconds", 1)))
        else:
            raise ValueError(f"Unknown action type: {atype}")

    def _require_browser(self):
        if not self.browser:
            raise RuntimeError("This step needs the browser, but browser.enabled = false in config.")

    # -- output -----------------------------------------------------------
    def _save_output(self, obs_path):
        if not obs_path or not os.path.exists(obs_path):
            return obs_path  # OBS didn't report a path; leave as-is
        os.makedirs(self.output_dir, exist_ok=True)
        ext = os.path.splitext(obs_path)[1] or ".mkv"
        stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        base = self.cfg.get("output_basename", "opus_marketing")
        dest = os.path.join(self.output_dir, f"{base}_{stamp}{ext}")
        shutil.move(obs_path, dest)
        return dest

    # -- cleanup (always runs) --------------------------------------------
    def _cleanup(self):
        if self.browser:
            self.browser.stop()
        if self._taskbar_hidden:
            try:
                taskbar.restore_and_verify()
            except Exception as exc:  # noqa: BLE001
                print(f"[warning] {exc}")
        else:
            taskbar.show()  # harmless if already visible
        if self.obs:
            self.obs.disconnect()

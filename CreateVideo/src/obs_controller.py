"""
OBS controller — drive OBS Studio through obs-websocket v5 (obsws-python).

Recording runs against a single SCENE and never stops mid-run, so the output
is one continuous file. Switching between the browser window and the Discord
window is done by toggling the VISIBILITY of two pre-made Window Capture
sources in that scene (instant, no black frame, no re-hook) — far more reliable
than repointing one source at a new window. A set_window mode is also provided
for the alternative approach.
"""
import logging
import time

import obsws_python as obs

# obsws-python logs the full traceback via logger.exception() on a refused
# connection. With no handler, Python's last-resort handler dumps it to stderr.
# Attach a NullHandler and stop propagation so only our own clean ObsError shows.
_obsws_logger = logging.getLogger("obsws_python")
_obsws_logger.addHandler(logging.NullHandler())
_obsws_logger.propagate = False


class ObsError(RuntimeError):
    pass


class ObsController:
    def __init__(self, host="localhost", port=4455, password="", scene=None, timeout=5):
        self.scene = scene
        try:
            self.cl = obs.ReqClient(host=host, port=port, password=password, timeout=timeout)
            self.cl.get_version()  # fail fast if not really connected
        except Exception as exc:  # noqa: BLE001
            raise ObsError(
                "Could not connect to OBS. Make sure OBS is running, obs-websocket is "
                "enabled (Tools -> WebSocket Server Settings -> Enable), and the "
                f"host/port/password in the config are correct. Details: {exc}"
            ) from exc

    # -- scene / recording ------------------------------------------------
    def scene_names(self):
        try:
            return [s["sceneName"] for s in self.cl.get_scene_list().scenes]
        except Exception as exc:  # noqa: BLE001
            raise ObsError(f"Could not list OBS scenes: {exc}") from exc

    def scene_exists(self, scene=None):
        return (scene or self.scene) in self.scene_names()

    def ensure_scene(self, scene=None):
        """Create the scene if it doesn't exist yet. Returns True if newly created."""
        scene = scene or self.scene
        if self.scene_exists(scene):
            return False
        try:
            self.cl.create_scene(scene)
        except Exception as exc:  # noqa: BLE001
            raise ObsError(f"Could not create scene '{scene}': {exc}") from exc
        return True

    def select_scene(self):
        if not self.scene:
            return
        if not self.scene_exists():
            raise ObsError(
                f"Scene '{self.scene}' does not exist in OBS. Available scenes: "
                f"{self.scene_names()}. Run `python record.py --fix` to create it, "
                "or fix the 'scene' name in the config."
            )
        self.cl.set_current_program_scene(self.scene)

    def start_recording(self):
        if self.is_recording():
            raise ObsError("OBS is already recording — stop the current recording first.")
        self.cl.start_record()
        # wait until OBS reports the output is actually active
        for _ in range(20):
            if self.is_recording():
                return
            time.sleep(0.1)
        raise ObsError("Recording command sent but OBS never reported an active recording.")

    def stop_recording(self):
        """Stop and return the path OBS wrote, or None."""
        if not self.is_recording():
            return None
        resp = self.cl.stop_record()
        return getattr(resp, "output_path", None)

    def is_recording(self):
        try:
            return bool(self.cl.get_record_status().output_active)
        except Exception:  # noqa: BLE001
            return False

    # -- source switching -------------------------------------------------
    def _scene_item_id(self, source_name, scene=None):
        scene = scene or self.scene
        try:
            return self.cl.get_scene_item_id(scene, source_name).scene_item_id
        except Exception as exc:  # noqa: BLE001
            raise ObsError(
                f"Source '{source_name}' was not found in scene '{scene}'. "
                "Add it in OBS or fix the name in the config."
            ) from exc

    def set_source_visible(self, source_name, visible, scene=None):
        scene = scene or self.scene
        item_id = self._scene_item_id(source_name, scene)
        self.cl.set_scene_item_enabled(scene, item_id, bool(visible))

    def switch(self, show=None, hide=None, scene=None):
        """Show one source and hide another in the same instant (visibility toggle)."""
        # hide first, then show — avoids two sources overlapping for a frame
        if hide:
            for name in (hide if isinstance(hide, list) else [hide]):
                self.set_source_visible(name, False, scene)
        if show:
            for name in (show if isinstance(show, list) else [show]):
                self.set_source_visible(name, True, scene)

    def set_window_input(self, source_name, window_string):
        """Alternative: repoint a single Window Capture source at a new window string."""
        try:
            self.cl.set_input_settings(source_name, {"window": window_string}, True)
        except Exception as exc:  # noqa: BLE001
            raise ObsError(f"Could not update the window for source '{source_name}': {exc}") from exc

    # -- automated setup (used by `record.py --fix`) -----------------------
    def input_exists(self, source_name):
        try:
            names = {i["inputName"] for i in self.cl.get_input_list().inputs}
        except Exception as exc:  # noqa: BLE001
            raise ObsError(f"Could not list OBS inputs: {exc}") from exc
        return source_name in names

    def ensure_window_capture(self, source_name, scene=None):
        """Create a Window Capture source in the scene if it doesn't exist yet.
        Returns True if newly created, False if it already existed."""
        scene = scene or self.scene
        if self.input_exists(source_name):
            # exists as an input, but make sure it's a scene item in THIS scene too
            try:
                self._scene_item_id(source_name, scene)
            except ObsError:
                try:
                    self.cl.create_scene_item(scene, source_name, True)
                except Exception as exc:  # noqa: BLE001
                    raise ObsError(
                        f"Input '{source_name}' exists but could not be added to scene '{scene}': {exc}"
                    ) from exc
            return False
        try:
            # method=2 -> "Windows 10 (1903 and up)" capture, which keeps
            # capturing a window even while it's occluded/in the background.
            self.cl.create_input(scene, source_name, "window_capture", {"method": 2, "cursor": True}, True)
        except Exception as exc:  # noqa: BLE001
            raise ObsError(f"Could not create Window Capture source '{source_name}': {exc}") from exc
        return True

    def point_source_at_window(self, source_name, title_hint):
        """Auto-target a Window Capture source at the first currently open window
        whose title contains title_hint (case-insensitive). Returns True if a
        match was found and applied, False if no matching window is open right
        now (the source is created but left unset)."""
        try:
            items = self.cl.get_input_properties_list_property_items(source_name, "window").property_items
        except Exception as exc:  # noqa: BLE001
            raise ObsError(f"Could not read the window list for source '{source_name}': {exc}") from exc

        hint = title_hint.lower()
        match = next((it for it in items if hint in str(it.get("itemName", "")).lower()), None)
        if match is None:
            return False
        try:
            self.cl.set_input_settings(source_name, {"window": match["itemValue"], "method": 2}, True)
        except Exception as exc:  # noqa: BLE001
            raise ObsError(f"Could not set the window for source '{source_name}': {exc}") from exc
        return True

    def bring_to_top(self, source_name, scene=None):
        """Move a scene item to the top of the stack (rendered above everything else)."""
        scene = scene or self.scene
        item_id = self._scene_item_id(source_name, scene)
        try:
            count = len(self.cl.get_scene_item_list(scene).scene_items)
            self.cl.set_scene_item_index(scene, item_id, max(0, count - 1))
        except Exception as exc:  # noqa: BLE001
            raise ObsError(f"Could not reorder source '{source_name}' to the top: {exc}") from exc

    def disconnect(self):
        try:
            self.cl.disconnect()
        except Exception:  # noqa: BLE001
            pass

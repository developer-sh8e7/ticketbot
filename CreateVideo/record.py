"""
CreateVideo — fully automated marketing recorder (Windows).

    python record.py                      # uses config/video.json
    python record.py config/other.json    # a different sequence
    python record.py --check              # validate config + connections, no recording
    python record.py --fix                # auto-create/auto-target the OBS sources

The Tkinter caption overlay owns the main thread; the whole recording sequence
(OBS + browser + window focus + taskbar) runs in a worker thread and pushes
caption text back to the overlay. This keeps captions in sync with the steps and
never blocks the UI thread.
"""
import json
import os
import sys
import threading
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from src.captions import CaptionOverlay  # noqa: E402
from src.obs_controller import ObsError  # noqa: E402
from src.runner import Runner  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
DEFAULT_CONFIG = os.path.join(HERE, "config", "video.json")
OUTPUT_DIR = os.path.join(HERE, "output")


def load_config(path):
    if not os.path.exists(path):
        sys.exit(f"Config file not found: {path}")
    with open(path, "r", encoding="utf-8") as fh:
        return json.load(fh)


def check_only(cfg):
    """Validate config + OBS connectivity without hiding the taskbar or recording.
    Returns 0 on success, 1 on any problem (prints a clean one-line message)."""
    from src.obs_controller import ObsController

    print("- Checking config...")
    steps = cfg.get("steps", [])
    if not steps:
        print("  [warning] no steps defined in the config.")

    obs_cfg = cfg.get("obs", {})
    try:
        obs = ObsController(
            host=obs_cfg.get("host", "localhost"),
            port=int(obs_cfg.get("port", 4455)),
            password=obs_cfg.get("password", ""),
            scene=obs_cfg.get("scene"),
        )
    except ObsError as exc:
        print(f"\n[FAIL] {exc}")
        return 1

    try:
        obs.select_scene()  # actually verifies + switches to the configured scene
    except ObsError as exc:
        print(f"\n[FAIL] {exc}")
        obs.disconnect()
        return 1

    print(f"  ok  connected to OBS (scene: {obs_cfg.get('scene')}).")

    # verify every source named in switches actually exists
    names = set()
    if cfg.get("initial_sources"):
        for k in ("show", "hide"):
            v = cfg["initial_sources"].get(k)
            names.update(v if isinstance(v, list) else ([v] if v else []))
    for step in steps:
        act = step.get("action") or {}
        if act.get("type") == "obs_switch":
            for k in ("show", "hide"):
                v = act.get(k)
                names.update(v if isinstance(v, list) else ([v] if v else []))
    try:
        for n in sorted(names):
            obs._scene_item_id(n)  # raises ObsError with a clear message if missing
            print(f"  ok  source exists: {n}")
    except ObsError as exc:
        print(f"\n[FAIL] {exc}")
        obs.disconnect()
        return 1

    obs.disconnect()
    print("- All good. Run without --check to record.")
    return 0


def fix_only(cfg):
    """Auto-create any missing OBS Window Capture sources and auto-target each
    one at the matching open window (found via OBS's own window list, so the
    exact match string is always correct). Prints a clear status per source and
    what to do if a window can't be auto-targeted yet."""
    from src.obs_controller import ObsController

    print("- Auto-fixing OBS sources...")
    obs_cfg = cfg.get("obs", {})
    try:
        obs = ObsController(
            host=obs_cfg.get("host", "localhost"),
            port=int(obs_cfg.get("port", 4455)),
            password=obs_cfg.get("password", ""),
            scene=obs_cfg.get("scene"),
        )
    except ObsError as exc:
        print(f"\n[FAIL] {exc}")
        return 1
    print(f"  ok  connected to OBS (scene: {obs_cfg.get('scene')}).")

    ok = True
    try:
        created_scene = obs.ensure_scene()
        print(f"  {'created' if created_scene else 'exists '} scene: {obs_cfg.get('scene')}")
        obs.select_scene()
    except ObsError as exc:
        print(f"\n[FAIL] {exc}")
        obs.disconnect()
        return 1

    windows_cfg = cfg.get("windows", {})

    def fix_window_source(source_name, title_hint):
        nonlocal ok
        try:
            created = obs.ensure_window_capture(source_name)
            print(f"  {'created' if created else 'exists '} source: {source_name}")
            targeted = obs.point_source_at_window(source_name, title_hint)
            if targeted:
                print(f"  ok      targeted '{source_name}' at a window matching '{title_hint}'.")
            else:
                ok = False
                print(
                    f"  [!]     no open window matching '{title_hint}' found — open it, "
                    f"then run --fix again (or set the window manually in OBS for '{source_name}')."
                )
        except ObsError as exc:
            ok = False
            print(f"  [FAIL]  {exc}")

    if windows_cfg.get("browser_source_name"):
        fix_window_source(windows_cfg["browser_source_name"], windows_cfg.get("browser_title_hint", "Chrome"))
    if windows_cfg.get("discord_source_name"):
        fix_window_source(windows_cfg["discord_source_name"], windows_cfg.get("discord_title_hint", "Discord"))

    # The caption source targets our OWN window, which we create right here so
    # it definitely exists to be found and matched.
    caption_cfg = cfg.get("caption", {})
    caption_source = caption_cfg.get("window_title", "OpusCaption")
    try:
        created = obs.ensure_window_capture(caption_source)
        print(f"  {'created' if created else 'exists '} source: {caption_source}")
        overlay = CaptionOverlay(caption_cfg)
        overlay.show(" ")
        # give Tk real wall-clock time to drain its queue + map the window, and
        # Windows a moment to register the new HWND as enumerable — root.update()
        # alone does not sleep, so this needs an actual delay, not just a loop.
        deadline = time.time() + 2.0
        while time.time() < deadline:
            overlay.root.update()
            time.sleep(0.05)
        targeted = obs.point_source_at_window(caption_source, caption_source)
        overlay.root.destroy()
        if targeted:
            obs.bring_to_top(caption_source)
            print(f"  ok      targeted + raised '{caption_source}' to the top of the scene.")
        else:
            ok = False
            print(f"  [!]     could not find the caption window titled '{caption_source}' — try --fix again.")
    except ObsError as exc:
        ok = False
        print(f"  [FAIL]  {exc}")

    obs.disconnect()
    if ok:
        print("- All sources are created and targeted. Run: python record.py --check")
    else:
        print("- Some sources still need attention (see [!] above), then run --fix again.")
    return 0 if ok else 1


def main():
    args = [a for a in sys.argv[1:]]
    is_check = "--check" in args
    is_fix = "--fix" in args
    args = [a for a in args if a not in ("--check", "--fix")]
    config_path = args[0] if args else DEFAULT_CONFIG

    cfg = load_config(config_path)

    if is_fix:
        return fix_only(cfg)
    if is_check:
        return check_only(cfg)

    overlay = CaptionOverlay(cfg.get("caption", {}))
    runner = Runner(cfg, OUTPUT_DIR)
    holder = {}

    def worker():
        holder["result"] = runner.run(overlay)

    thread = threading.Thread(target=worker, name="recorder", daemon=True)
    thread.start()
    overlay.run()      # blocks until the worker calls overlay.close()
    thread.join(timeout=10)

    result = holder.get("result", {"ok": False, "message": "Run did not complete."})
    if result["ok"]:
        print(f"\n[OK] {result['message']}")
        if result.get("output_path"):
            print(f"File: {result['output_path']}")
        return 0
    print(f"\n[FAIL] {result['message']}")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())

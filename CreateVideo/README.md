# CreateVideo — fully automated marketing recorder (Windows)

Records a marketing video of the website + Discord server with **zero manual
input during recording**: it opens the site and navigates its pages, switches to
the Discord window, shows on-screen captions synced to each step, hides the
taskbar, and saves one continuous file with a timestamped name.

## Design decisions (why)

| Requirement | Choice | Why |
|-------------|--------|-----|
| Hide taskbar | `ShowWindow(Shell_TrayWnd, SW_HIDE)` via Win32 | Hides instantly without killing `explorer.exe`; restore is instant + verified. |
| Switch OBS source | Toggle **visibility** of two Window Capture sources in one scene | Instant, no black frame, no re-hook; recording keeps running = **one file**. |
| Captions | Own overlay window (Tkinter) | Timing is local — no websocket round-trip — so it can't drift; full styling control from config. |
| Language | Python | Combines Win32 API + OBS websocket + Playwright in one process. |

Architecture: the caption window owns the main thread (Tkinter requirement); the
whole recording sequence runs in a worker thread that pushes caption text through
a thread-safe queue.

## Install (once)

```bash
cd CreateVideo
pip install -r requirements.txt
python -m playwright install chromium   # only if you don't have Chrome, or remove "channel":"chrome" from config
```

## OBS setup (once — important)

1. Enable the websocket: **Tools -> WebSocket Server Settings -> Enable**; copy the Password and Port.
2. Create one Scene, e.g. `Marketing`.
3. Add three **Window Capture** sources (capture method: *Windows 10 (1903+)*):
   - `Browser Capture` -> the Chrome window (the website).
   - `Discord Capture` -> the Discord window.
   - `OpusCaption` -> the caption window (title `OpusCaption`). **Put it on top** so it stays above everything.
   > The caption window only exists while the tool runs. Run the tool once so its
   > window appears in OBS's list, then pick it for the `OpusCaption` source.
4. Set the recording folder and format under **Settings -> Output** (the tool auto-renames the finished file with a timestamp).
5. Put the Password, Port, and scene name in `config/video.json`.

## Usage

```bash
python record.py --check     # checks: OBS connection + every source named in config (no recording)
python record.py             # records using config/video.json
python record.py config/other.json   # a different sequence
```

Flow: connect to OBS -> open the browser -> hide the taskbar -> start recording ->
run the steps (caption + action + wait) -> stop recording -> save to
`output/opus_marketing_<timestamp>.mkv`. No matter what happens, **the taskbar is
restored and verified** and the browser is closed at the end.

## Config (`config/video.json`)

Copy `config/video.example.json` to `config/video.json` and edit it. Fields:

- `obs`: `host`, `port`, `password`, `scene`.
- `browser`: `enabled`, `channel` (`"chrome"`/`"msedge"`, or remove for bundled Chromium), `headless`.
- `hide_taskbar`, `pre_record_wait`, `post_record_wait`, `output_basename`.
- `initial_sources`: `{ "show": ..., "hide": ... }` source state before recording starts.
- `caption`: `corner` (`bottom-right`/`bottom-left`/...), `margin`, `font`, `font_size`,
  `text_color`, `box_color`, `box_alpha`, `max_width`, `rtl`.
- `steps[]`: an ordered list; each step:
  - `name` — shown in the error message if it fails.
  - `caption` — text to show (stays until a later step changes it) or `caption_clear: true`.
  - `action.type` — one of:
    | type | fields |
    |------|--------|
    | `browser_goto` | `url` |
    | `browser_click` | `selector` (Playwright selector) |
    | `browser_fill` | `selector`, `text` |
    | `browser_scroll` | `pixels` |
    | `focus_window` | `window_contains` |
    | `obs_switch` | `show`, `hide`, `focus_window_contains?` |
    | `obs_set_window` | `source`, `window` (alternative: repoint one source) |
    | `sleep` | `seconds` |
  - `wait` — seconds to wait after the action.

## Error handling

If any step fails (site didn't open, element didn't appear, OBS source missing...):
recording stops immediately, the taskbar is restored, and it prints **exactly which
step failed** and why, then exits with a non-zero code.

## Troubleshooting

- **"Could not connect to OBS"**: OBS isn't running, the websocket isn't enabled, or port/password is wrong.
- **"Source ... was not found in scene"**: fix the source name in config to match OBS exactly. Use `--check`.
- **Caption not in the video**: make sure the `OpusCaption` source exists in the scene and is on top.
- **Discord window not captured**: use capture method *Windows 10 (1903+)* (captures background windows).

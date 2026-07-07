#!/usr/bin/env python3
"""
terminal_creature_saga.py
==========================

An all-ASCII, terminal-rendered animation built from three linked scenes:

  1. A "boot sequence" that mathematically reconstructs the exact pixel
     creature from its source image (radial materialize, blinking, idle bob).
  2. An architect assembling a building, floor by floor.
  3. An aerial view of a procedurally generated city skyline, with the
     building you just watched get built standing out among the rest.

Design notes (why this is built the way it is)
------------------------------------------------
- The creature's shape is NOT hand-guessed. It was derived by sampling the
  actual source image: the image was cropped to its bounding box, split into
  a 42x14 cell grid, and each cell was classified against the image's three
  dominant colors (background / body / eye) using nearest-color Euclidean
  distance. Left/right symmetry was then enforced mathematically by
  averaging each cell with its mirrored counterpart before classifying,
  which removes sampling noise while the creature itself is symmetric.
  That exact result is embedded as CREATURE_ROWS below.

- If you want to regenerate the grid from a *different* image, pass
  --from-image path/to.png and the script will run that same pipeline live
  (requires Pillow: `pip install pillow`). No other part of the script
  depends on Pillow -- it is optional and only used for that one feature.

- The city skyline is not random noise -- it's a small 1D value-noise /
  fractal-noise stack (the same family of technique used to fake terrain
  and skylines in procedural graphics), built from a deterministic sine
  hash. Same seed -> same skyline, every time.

Run it:
    python3 terminal_creature_saga.py
    python3 terminal_creature_saga.py --speed 2         # play twice as fast
    python3 terminal_creature_saga.py --seed 42          # different city
    python3 terminal_creature_saga.py --from-image me.png
    python3 terminal_creature_saga.py --fast             # for quick testing, near-zero delays
"""

from __future__ import annotations

import argparse
import math
import os
import random
import sys
import time
from dataclasses import dataclass, field
from typing import List, Optional, Set, Tuple


# ======================================================================
#  Math utilities
# ======================================================================

def clamp(value: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, value))


def lerp(a: float, b: float, t: float) -> float:
    return a + (b - a) * t


def smoothstep(t: float) -> float:
    t = clamp(t, 0.0, 1.0)
    return t * t * (3.0 - 2.0 * t)


def ease_in_out_sine(t: float) -> float:
    return -(math.cos(math.pi * t) - 1.0) / 2.0


def hash1(x: float, seed: float = 0.0) -> float:
    """Deterministic pseudo-random value in [0, 1) from a real number.

    Classic sine-hash trick used in shader/procedural-generation code:
    a chaotic-looking but fully deterministic function of x.
    """
    n = math.sin(x * 127.1 + seed * 311.7) * 43758.5453123
    return n - math.floor(n)


def value_noise1d(x: float, seed: float = 0.0) -> float:
    """1D value noise: smoothly interpolate between hashed lattice points."""
    x0 = math.floor(x)
    x1 = x0 + 1
    t = smoothstep(x - x0)
    h0 = hash1(x0, seed)
    h1 = hash1(x1, seed)
    return lerp(h0, h1, t)


def fractal_noise1d(x: float, seed: float = 0.0, octaves: int = 4) -> float:
    """Sum several octaves of value noise for a more organic-looking curve.

    Returns a value normalized to [0, 1].
    """
    total = 0.0
    amplitude = 1.0
    frequency = 1.0
    max_amp = 0.0
    for i in range(octaves):
        total += value_noise1d(x * frequency, seed + i * 17.0) * amplitude
        max_amp += amplitude
        amplitude *= 0.5
        frequency *= 2.13
    return total / max_amp if max_amp else 0.0


def radial_distance(p: Tuple[float, float], q: Tuple[float, float]) -> float:
    return math.hypot(p[0] - q[0], p[1] - q[1])


# ======================================================================
#  Terminal rendering
# ======================================================================

class Terminal:
    """Thin wrapper around clearing/printing so scenes don't repeat it."""

    def __init__(self, speed: float = 1.0, use_clear: bool = True):
        self.speed = max(speed, 0.01)
        self.use_clear = use_clear

    def sleep(self, seconds: float) -> None:
        time.sleep(max(0.0, seconds) / self.speed)

    def clear(self) -> None:
        if not self.use_clear:
            print("\n" * 3)
            return
        os.system("cls" if os.name == "nt" else "clear")

    def render(self, lines: List[str], delay: float = 0.4) -> None:
        self.clear()
        sys.stdout.write("\n".join(lines) + "\n")
        sys.stdout.flush()
        self.sleep(delay)

    def typewriter(self, prefix: str, text: str, char_delay: float = 0.028) -> None:
        buf = prefix
        for ch in text:
            buf += ch
            sys.stdout.write("\r" + buf)
            sys.stdout.flush()
            self.sleep(char_delay)
        sys.stdout.write("\n")
        sys.stdout.flush()
        self.sleep(0.25)

    def print_line(self, text: str) -> None:
        print(text)
        self.sleep(0.3)


# ======================================================================
#  Creature: exact grid extracted from the source image
# ======================================================================
#
#   '.'  -> background (rendered as blank space)
#   '#'  -> body (terracotta block)
#   '@'  -> eye (black block)
#
# 42 columns x 14 rows, mathematically derived and mirror-symmetrized
# from the original PNG (see module docstring).

CREATURE_ROWS: List[str] = [
    ".......############################.......",
    ".......############################.......",
    ".......####@@@##############@@@####.......",
    ".########################################.",
    "##########################################",
    "##########################################",
    "##########################################",
    ".......############################.......",
    ".......############################.......",
    ".......############################.......",
    ".......####...####......####...####.......",
    ".......####...####......####...####.......",
    ".......####...####......####...####.......",
    ".......####...####......####...####.......",
]


@dataclass
class CreatureModel:
    rows: List[str]
    cells: List[Tuple[int, int, str]] = field(default_factory=list)  # (row, col, kind)
    centroid: Tuple[float, float] = (0.0, 0.0)
    reveal_order: List[Tuple[int, int, str]] = field(default_factory=list)

    @classmethod
    def from_rows(cls, rows: List[str]) -> "CreatureModel":
        model = cls(rows=rows)
        model._extract_cells()
        model._compute_centroid()
        model._compute_reveal_order()
        return model

    def _extract_cells(self) -> None:
        for r, row in enumerate(self.rows):
            for c, ch in enumerate(row):
                if ch != ".":
                    self.cells.append((r, c, ch))

    def _compute_centroid(self) -> None:
        if not self.cells:
            self.centroid = (0.0, 0.0)
            return
        avg_r = sum(r for r, _, _ in self.cells) / len(self.cells)
        avg_c = sum(c for _, c, _ in self.cells) / len(self.cells)
        self.centroid = (avg_r, avg_c)

    def _compute_reveal_order(self) -> None:
        # Materialize outward from the centroid: closest cells first.
        self.reveal_order = sorted(
            self.cells,
            key=lambda cell: radial_distance((cell[0], cell[1]), self.centroid),
        )

    @property
    def width(self) -> int:
        return len(self.rows[0]) if self.rows else 0

    @property
    def height(self) -> int:
        return len(self.rows)

    def render(
        self,
        revealed: Set[Tuple[int, int]],
        eyes_visible: bool = True,
        bob_offset: int = 0,
    ) -> List[str]:
        lines = []
        blank_row = " " * self.width
        if bob_offset > 0:
            lines.extend([blank_row] * bob_offset)

        for r, row in enumerate(self.rows):
            out = []
            for c, ch in enumerate(row):
                if ch == ".":
                    out.append(" ")
                    continue
                if (r, c) not in revealed:
                    out.append(" ")
                    continue
                if ch == "@":
                    out.append("@" if eyes_visible else "#")
                else:
                    out.append(ch)
            lines.append("".join(out))

        if bob_offset < 0:
            lines = lines[-bob_offset:]
        return lines


# ======================================================================
#  Optional: regenerate the grid from an arbitrary image (Pillow only)
# ======================================================================

def extract_creature_grid_from_image(path: str, cols: int = 42) -> Optional[List[str]]:
    """Reproduce CREATURE_ROWS for a *different* image, using the same
    bounding-box + mirrored-cell-classification approach used to build the
    embedded grid above. Returns None if Pillow isn't available.
    """
    try:
        from PIL import Image
    except ImportError:
        print("Pillow isn't installed, so --from-image can't run.")
        print("Install it with: pip install pillow")
        return None

    img = Image.open(path).convert("RGB")
    w, h = img.size
    px = img.load()

    def dist(c1: Tuple[int, int, int], c2: Tuple[int, int, int]) -> float:
        return math.sqrt(sum((a - b) ** 2 for a, b in zip(c1, c2)))

    bg = px[0, 0]

    # Bounding box of every pixel that isn't background.
    x0, x1, y0, y1 = w, 0, h, 0
    fg_pixels: List[Tuple[int, int, int]] = []
    for y in range(h):
        for x in range(w):
            c = px[x, y]
            if dist(c, bg) > 25:
                x0, x1 = min(x0, x), max(x1, x)
                y0, y1 = min(y0, y), max(y1, y)
                fg_pixels.append(c)

    if not fg_pixels:
        print("Couldn't find a foreground shape distinct from the background.")
        return None

    # Split foreground colors into "body" vs "eye" by brightness: the
    # darkest cluster becomes the eye color, the rest average into body.
    def brightness(c: Tuple[int, int, int]) -> float:
        return sum(c) / 3.0

    dark = [c for c in fg_pixels if brightness(c) < 100]
    light = [c for c in fg_pixels if brightness(c) >= 100]
    body = tuple(sum(ch) / len(light) for ch in zip(*light)) if light else (128, 128, 128)
    eye = tuple(sum(ch) / len(dark) for ch in zip(*dark)) if dark else None

    cw, ch_ = x1 - x0 + 1, y1 - y0 + 1
    rows = max(1, round(cols * (ch_ / cw) * 0.5))
    cell_w, cell_h = cw / cols, ch_ / rows

    def cell_mean(r: int, c: int) -> Tuple[float, float, float]:
        y_s, y_e = y0 + int(r * cell_h), y0 + int((r + 1) * cell_h)
        x_s, x_e = x0 + int(c * cell_w), x0 + int((c + 1) * cell_w)
        total = [0.0, 0.0, 0.0]
        count = 0
        for yy in range(y_s, max(y_s + 1, y_e)):
            for xx in range(x_s, max(x_s + 1, x_e)):
                px_c = px[xx, yy]
                total[0] += px_c[0]
                total[1] += px_c[1]
                total[2] += px_c[2]
                count += 1
        return tuple(t / count for t in total) if count else (0.0, 0.0, 0.0)

    grid_rows: List[str] = []
    for r in range(rows):
        row_chars = [""] * cols
        half = cols // 2 + cols % 2
        for c in range(half):
            mirror_c = cols - 1 - c
            mean_a = cell_mean(r, c)
            mean_b = cell_mean(r, mirror_c)
            combined = tuple((a + b) / 2 for a, b in zip(mean_a, mean_b))

            d_bg = dist(combined, bg)
            d_body = dist(combined, body)
            d_eye = dist(combined, eye) if eye else float("inf")

            best = min(("bg", d_bg), ("body", d_body), ("eye", d_eye), key=lambda p: p[1])[0]
            symbol = {"bg": ".", "body": "#", "eye": "@"}[best]
            row_chars[c] = symbol
            row_chars[mirror_c] = symbol
        grid_rows.append("".join(row_chars))

    return grid_rows


# ======================================================================
#  Scene 1: terminal boot + creature materializes
# ======================================================================

def scene_creature(term: Terminal, model: CreatureModel) -> None:
    term.clear()
    term.typewriter("guest@arch ~ % ", "./render_creature.py --exact")
    term.print_line("loading source pixels...")
    term.print_line(f"bounding grid: {model.width}x{model.height} cells")
    term.print_line("classifying cells (background / body / eye)...")
    term.print_line("enforcing left-right symmetry...")
    term.print_line(f"centroid at row {model.centroid[0]:.1f}, col {model.centroid[1]:.1f}")
    term.print_line("materializing outward from centroid...")
    term.sleep(0.3)

    revealed: Set[Tuple[int, int]] = set()
    total = len(model.reveal_order)
    step = max(1, total // 40)  # ~40 animation frames to fully reveal

    for i in range(0, total, step):
        for r, c, _ in model.reveal_order[i : i + step]:
            revealed.add((r, c))
        frame = model.render(revealed, eyes_visible=True)
        term.render(frame, delay=0.05)

    # make sure every cell is revealed for the final materialize frame
    revealed = {(r, c) for r, c, _ in model.cells}
    term.render(model.render(revealed), delay=0.6)

    # idle loop: gentle bob (sine) + occasional blink
    idle_frames = int(24 * term.speed)
    for f in range(idle_frames):
        t = f / 6.0
        bob = round(math.sin(t) * 1.4)
        blink = (f % 20) in (18, 19)  # blink briefly, periodically
        frame = model.render(revealed, eyes_visible=not blink, bob_offset=bob)
        term.render(frame, delay=0.08)


# ======================================================================
#  Scene 2: architect assembles a building
# ======================================================================

BUILDING_WIDTH = 12
FLOORS = 6
ARCHITECT_UP = ["o  /", "/|", "/ \\"]
ARCHITECT_DOWN = ["o |", "/|", "/ \\"]


def _building_frame(floors_built: int, hammer_up: bool) -> List[str]:
    lines: List[str] = []
    lines.append("assembling structure...")
    lines.append("")

    max_h = FLOORS
    for _ in range(max_h - floors_built):
        lines.append("")
    block_row = "[" + ("#" * (BUILDING_WIDTH - 2)) + "]"
    for _ in range(floors_built):
        lines.append("            " + block_row)

    architect = ARCHITECT_UP if hammer_up else ARCHITECT_DOWN
    for row in architect:
        lines.append("  " + row)

    lines.append("=" * 40)
    return lines


def scene_architect(term: Terminal) -> None:
    for floors in range(1, FLOORS + 1):
        for hammer_up in (True, False):
            term.render(_building_frame(floors, hammer_up), delay=0.18)
    term.render(_building_frame(FLOORS, True), delay=0.9)


# ======================================================================
#  Scene 3: aerial city, procedurally generated skyline
# ======================================================================

CITY_WIDTH = 60
CITY_HEIGHT = 14
HERO_COLUMN_RATIO = 0.42  # where the built building sits, left-of-center


def _skyline_heights(seed: float) -> List[int]:
    heights = []
    for x in range(CITY_WIDTH):
        n = fractal_noise1d(x * 0.18, seed=seed, octaves=4)
        h = round(lerp(2, CITY_HEIGHT - 2, n))
        heights.append(h)
    return heights


def _city_frame(heights: List[int], hero_col: int, reveal_cols: int) -> List[str]:
    grid = [[" " for _ in range(CITY_WIDTH)] for _ in range(CITY_HEIGHT)]

    for x in range(min(reveal_cols, CITY_WIDTH)):
        h = heights[x]
        is_hero = x == hero_col
        fill_char = "@" if is_hero else ("#" if h % 2 == 0 else "%")
        for y in range(CITY_HEIGHT - h, CITY_HEIGHT):
            grid[y][x] = fill_char

    lines = ["the city, from above"]
    lines.append("")
    for row in grid:
        lines.append("".join(row))
    lines.append("")
    lines.append("@ = the building you just watched get built")
    return lines


def scene_city(term: Terminal, seed: float) -> None:
    heights = _skyline_heights(seed)
    hero_col = int(CITY_WIDTH * HERO_COLUMN_RATIO)
    heights[hero_col] = CITY_HEIGHT - 2  # make sure it reads as a real tower

    # camera "zoom out": reveal columns left-to-right with easing so the
    # pan doesn't feel linear/robotic.
    frames = 30
    for f in range(frames + 1):
        t = ease_in_out_sine(f / frames)
        reveal_cols = round(lerp(0, CITY_WIDTH, t))
        term.render(_city_frame(heights, hero_col, reveal_cols), delay=0.05)

    term.render(_city_frame(heights, hero_col, CITY_WIDTH), delay=2.0)


# ======================================================================
#  Entry point
# ======================================================================

def parse_args(argv: Optional[List[str]] = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="ASCII creature + architect + city saga.")
    parser.add_argument("--speed", type=float, default=1.0, help="playback speed multiplier")
    parser.add_argument("--seed", type=float, default=7.0, help="city skyline seed")
    parser.add_argument("--from-image", type=str, default=None, help="regenerate the creature grid from this image (needs Pillow)")
    parser.add_argument("--no-clear", action="store_true", help="don't clear the terminal between frames (useful in some editors)")
    parser.add_argument("--fast", action="store_true", help="near-zero delays, for quickly testing the script runs cleanly")
    return parser.parse_args(argv)


def main(argv: Optional[List[str]] = None) -> None:
    args = parse_args(argv)
    speed = 1000.0 if args.fast else args.speed

    rows = CREATURE_ROWS
    if args.from_image:
        custom_rows = extract_creature_grid_from_image(args.from_image)
        if custom_rows:
            rows = custom_rows

    model = CreatureModel.from_rows(rows)
    term = Terminal(speed=speed, use_clear=not args.no_clear)

    try:
        scene_creature(term, model)
        term.sleep(0.6)
        scene_architect(term)
        term.sleep(0.4)
        scene_city(term, seed=args.seed)
    except KeyboardInterrupt:
        print("\nstopped.")


if __name__ == "__main__":
    main()
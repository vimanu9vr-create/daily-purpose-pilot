"""The reel engine. One implementation of daily/FORMAT.md, reused every day.

Each day's file supplies six beats of text and nothing else. Everything that
makes the format work — the timing floors, the dissolve length, the palette,
the light arc, the ruled lines, the asserts — lives here and is not re-typed,
because re-typing it is how it drifted twice in a week.

Usage:

    from reel import Beat, build, LORA, LORA_I, POP_L, INK, BURG

    BEATS = [Beat(3.2, "Manifesting\\ndoesn't work.", LORA, 96, INK), ...]
    build(BEATS, "ManifestAI_Day09_Reel.mp4")
"""

from __future__ import annotations

import math
import os
import shutil
import subprocess
from dataclasses import dataclass

import numpy as np
from PIL import Image, ImageDraw, ImageFont

W, H = 1080, 1920
LW, LH = 270, 480
FPS = 30

CREAM = (247, 233, 236)
ROSE = (214, 150, 164)
BURG = (92, 31, 46)
MUTE = (178, 146, 155)
BLUSH = (250, 240, 240)
INK = (58, 22, 32)

GF = "/usr/share/fonts/truetype/google-fonts/"
LORA = GF + "Lora-Variable.ttf"
LORA_I = GF + "Lora-Italic-Variable.ttf"
POP_L = GF + "Poppins-Light.ttf"
POP_M = GF + "Poppins-Medium.ttf"

FADE = 0.34          # a dissolve. 0.55 leaves a blank hole, 0.22 feels clipped.
MIN_BEAT = 2.2       # less than this is less than it takes to read
SAVED = 4            # index of the line people screenshot
TURN_BEAT = 3        # where the lamp comes up and the page appears
MAXW = W - 190

_fc: dict = {}


def font(path: str, size: int):
    if (path, size) not in _fc:
        _fc[(path, size)] = ImageFont.truetype(path, size)
    return _fc[(path, size)]


def ease(t: float) -> float:
    t = max(0.0, min(1.0, t))
    return t * t * (3 - 2 * t)


@dataclass
class Beat:
    seconds: float
    text: str
    path: str
    size: int
    colour: tuple
    cy: int = 1000
    gap: int = 100


def _spans(beats: list[Beat]):
    out, t = [], 0.0
    for b in beats:
        out.append((t, t + b.seconds))
        t += b.seconds
    return out, t


def _check(beats: list[Beat]):
    assert len(beats) == 6, "six beats — the shape is the format"
    for i, b in enumerate(beats):
        assert b.seconds >= MIN_BEAT, (
            f"beat {i} is {b.seconds}s. Under {MIN_BEAT}s nobody finishes "
            f"reading it, and a line nobody finishes means nothing."
        )
    longest = max(range(len(beats)), key=lambda i: beats[i].seconds)
    assert longest == SAVED, (
        f"beat {SAVED} is the line people screenshot and must hold longest; "
        f"beat {longest} currently does."
    )
    _, dur = _spans(beats)
    assert 17.0 <= dur <= 21.0, f"{dur}s — format is 18-20s"


def _background(t: float, turn: float) -> Image.Image:
    yy = np.linspace(0, 1, LH)[:, None]
    xx = np.linspace(0, 1, LW)[None, :]
    warm = ease((t - turn) / 3.4)
    cold = 1.0 - 0.72 * warm

    base = np.zeros((LH, LW, 3), np.float32)
    for i, c in enumerate(CREAM):
        base[..., i] = c

    wd = np.sqrt((xx - 0.20) ** 2 + (yy - 0.10) ** 2)
    win = np.clip(1 - wd / 0.88, 0, 1) ** 1.7 * (0.30 * cold)
    for i, c in enumerate((208, 216, 234)):
        base[..., i] = base[..., i] * (1 - win) + c * win

    ld = np.sqrt((xx - 0.78) ** 2 + (yy - 0.84) ** 2)
    lamp = np.clip(1 - ld / 1.04, 0, 1) ** 1.5 * (0.50 * warm)
    for i, c in enumerate((255, 226, 205)):
        base[..., i] = base[..., i] * (1 - lamp) + c * lamp

    base *= 1.0 + 0.010 * math.sin(t * 0.55)

    band = np.exp(-(((yy - 0.545) / 0.20) ** 2)) * 0.55
    for i, c in enumerate(BLUSH):
        base[..., i] = base[..., i] * (1 - band) + c * band

    vd = np.sqrt((xx - 0.5) ** 2 + (yy - 0.5) ** 2)
    base *= (1 - np.clip((vd - 0.40) / 0.62, 0, 1) ** 1.5 * 0.40)[..., None]

    img = Image.fromarray(np.clip(base, 0, 255).astype(np.uint8)).resize(
        (W, H), Image.LANCZOS
    )

    if t > turn:
        d = ImageDraw.Draw(img, "RGBA")
        for n, y in enumerate(range(1200, 1780, 96)):
            k = ease((t - turn - n * 0.34) / 1.1)
            if k <= 0.01:
                continue
            d.rounded_rectangle([168, y, 168 + (W - 336) * k, y + 3], radius=2,
                                fill=(184, 150, 160, int(78 * k)))
    return img


def _fit(d, text, path, size):
    while size > 46:
        f = font(path, size)
        if all(d.textlength(ln, font=f) <= MAXW for ln in text.split("\n")):
            return f, size
        size -= 2
    return font(path, 46), 46


def _draw(img, t, beats, spans, signoff_at):
    d = ImageDraw.Draw(img, "RGBA")
    for i, (t0, t1) in enumerate(spans):
        if t < t0 or t >= t1:
            continue
        b = beats[i]
        a = ease((t - t0) / FADE) * (1.0 - ease((t - (t1 - FADE)) / FADE))
        if i == 0:
            a = 1.0 - ease((t - (t1 - FADE)) / FADE)   # readable at frame 0
        if a <= 0.01:
            continue
        f, used = _fit(d, b.text, b.path, b.size)
        g = int(b.gap * used / b.size)
        lines = b.text.split("\n")
        rise = 0.0 if i == 0 else (1 - ease((t - t0) / 0.9)) * 12
        top = b.cy - (len(lines) - 1) * g / 2 + rise
        for j, ln in enumerate(lines):
            lw = d.textlength(ln, font=f)
            d.text(((W - lw) / 2, top + j * g), ln, font=f,
                   fill=b.colour + (int(255 * a),), anchor="lm")

        if i == SAVED:   # a quiet marker, so a screenshot reads as a thing
            k = ease((t - t0 - 0.5) / 0.9)
            if k > 0:
                y = top + (len(lines) - 1) * g + 74
                d.rounded_rectangle([W / 2 - 96 * k, y, W / 2 + 96 * k, y + 4],
                                    radius=2, fill=ROSE + (int(190 * a * k),))

    if t >= signoff_at:
        a = ease((t - signoff_at) / 0.7)
        f = font(POP_M, 50)
        s = "The Seven-Day Reset  ·  Link in bio"
        lw = d.textlength(s, font=f)
        d.text(((W - lw) / 2, 1250), s, font=f, fill=MUTE + (int(240 * a),),
               anchor="lm")


def build(beats: list[Beat], out: str, workdir: str = "fr") -> str:
    _check(beats)
    spans, dur = _spans(beats)
    turn = spans[TURN_BEAT][0]
    signoff_at = spans[-1][0] + 1.55
    n = int(dur * FPS)

    if os.path.isdir(workdir):
        shutil.rmtree(workdir, ignore_errors=True)
    os.makedirs(workdir, exist_ok=True)

    cache, ck = None, -1
    for i in range(n):
        t = i / FPS
        k = int(t * 10)
        if k != ck:
            cache, ck = _background(t, turn), k
        img = cache.copy()
        _draw(img, t, beats, spans, signoff_at)
        img.save(f"{workdir}/f{i:03d}.jpg", quality=94)

    # The contrast check. A dissolve that leaves both lines near zero shows up
    # here as a run of dark frames and nowhere else — it is invisible on a
    # contact sheet, which is how it shipped once.
    low = sum(
        1 for i in range(n)
        if np.ptp(np.asarray(Image.open(f"{workdir}/f{i:03d}.jpg").convert("L"),
                             dtype=float)[850:1450]) < 60
    )
    assert low <= 8, f"{low} frames below readable contrast — a fade has a hole"

    subprocess.run([
        "ffmpeg", "-y", "-loglevel", "error", "-framerate", "30",
        "-i", f"{workdir}/f%03d.jpg",
        "-f", "lavfi", "-i",
        "anoisesrc=color=brown:amplitude=0.002:sample_rate=44100",
        "-map", "0:v:0", "-map", "1:a:0", "-shortest",
        "-vf", "noise=alls=4:allf=t",
        "-c:v", "libx264", "-preset", "veryfast", "-profile:v", "main",
        "-level", "4.0", "-pix_fmt", "yuv420p", "-g", "60", "-crf", "20",
        "-c:a", "aac", "-b:a", "128k", "-ar", "44100", "-ac", "2",
        "-movflags", "+faststart", out,
    ], check=True)

    print(f"{out} · {dur:.1f}s · {n} frames · {low} low-contrast")
    return out

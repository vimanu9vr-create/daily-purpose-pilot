"""Day 08 — "Can you manifest millions?"

Viggnesh's format: question hook, personal answer, a line people save. That
shape is working in this niche and it's the right instinct.

What changed is the answer. The brief had him claim he manifested millions by
repeating "money comes to me abundantly and freely" — a fabricated earnings
testimonial, and one that contradicts page one of the thing it's selling. The
workbook's whole argument is that an affirmation your bank balance disproves
gets rejected by your own mind.

So the hook stays, the personal beat stays, the save-able line stays. It's
just a line that's true: "I have made money before. I can make it again."
That's Day 6 of the workbook — one line you can say to a mirror without
cringing, which is the constraint that makes affirmations work at all.

Same calm build as the Day 07 rebuild: nothing under 2.2s, dissolves not cuts,
the app's own palette, ruled lines arriving after the turn.
"""

import math
import os

import numpy as np
from PIL import Image, ImageDraw, ImageFont

W, H = 1080, 1920
LW, LH = 270, 480
FPS = 30
DUR = 20.0
N = int(DUR * FPS)

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

_fc = {}


def font(p, s):
    if (p, s) not in _fc:
        _fc[(p, s)] = ImageFont.truetype(p, s)
    return _fc[(p, s)]


def ease(t):
    t = max(0.0, min(1.0, t))
    return t * t * (3 - 2 * t)


BEATS = [
    (0.00, 3.20),
    (3.20, 6.40),
    (6.40, 9.40),
    (9.40, 12.40),   # the turn
    (12.40, 16.80),  # the line they save — held longest
    (16.80, 20.00),
]
TURN = BEATS[3][0]

TEXT = [
    ("Can you manifest\nmillions?", LORA, 92, INK, 1000, 124),
    ("Not by saying\n“money flows to me freely.”", POP_L, 64, INK, 1010, 96),
    ("You've said it.\nYour account disagreed.\nYou stopped by Thursday.",
     POP_L, 64, INK, 980, 96),
    ("An affirmation only works\nif you can't argue with it.", POP_L, 64, BURG,
     1010, 96),
    ("I have made money before.\nI can make it again.", LORA_I, 84, BURG, 1000, 116),
    ("Seven days of writing\nyours.", LORA, 74, BURG, 970, 102),
]

FADE = 0.34
MAXW = W - 190


def beat_at(t):
    if t < BEATS[0][1]:
        return 0, t
    for i, (a, b) in enumerate(BEATS):
        if a <= t < b:
            return i, t - a
    return len(BEATS) - 1, max(t - BEATS[-1][0], 0.0)


def assert_ok():
    for (a1, b1), (a2, _) in zip(BEATS, BEATS[1:]):
        assert abs(b1 - a2) < 1e-9, f"gap between {b1} and {a2}"
    assert BEATS[0][0] == 0.0
    assert abs(BEATS[-1][1] - DUR) < 1e-9
    for i, (a, b) in enumerate(BEATS):
        assert b - a >= 2.2, f"beat {i} is {b - a:.2f}s — too fast to read"
    assert len(TEXT) == len(BEATS)
    # The saved line must be the longest thing on screen. It's the only beat
    # anyone screenshots, and a screenshot needs time to become one.
    longest = max(range(len(BEATS)), key=lambda i: BEATS[i][1] - BEATS[i][0])
    assert longest == 4, "the save-able line must hold longest"


def background(t):
    yy = np.linspace(0, 1, LH)[:, None]
    xx = np.linspace(0, 1, LW)[None, :]
    warm = ease((t - TURN) / 3.4)
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

    if t > TURN:
        d = ImageDraw.Draw(img, "RGBA")
        for n, y in enumerate(range(1200, 1780, 96)):
            k = ease((t - TURN - n * 0.34) / 1.1)
            if k <= 0.01:
                continue
            d.rounded_rectangle([168, y, 168 + (W - 336) * k, y + 3], radius=2,
                                fill=(184, 150, 160, int(78 * k)))
    return img


def fit(d, text, path, size):
    while size > 40:
        f = font(path, size)
        if all(d.textlength(ln, font=f) <= MAXW for ln in text.split("\n")):
            return f, size
        size -= 2
    return font(path, 40), 40


def draw(img, t):
    d = ImageDraw.Draw(img, "RGBA")
    for i, (t0, t1) in enumerate(BEATS):
        if t < t0 or t >= t1:
            continue
        text, path, size, col, cy, gap = TEXT[i]
        a = ease((t - t0) / FADE) * (1.0 - ease((t - (t1 - FADE)) / FADE))
        if i == 0:
            a = 1.0 - ease((t - (t1 - FADE)) / FADE)
        if a <= 0.01:
            continue
        f, used = fit(d, text, path, size)
        g = int(gap * used / size)
        lines = text.split("\n")
        rise = 0.0 if i == 0 else (1 - ease((t - t0) / 0.9)) * 12
        top = cy - (len(lines) - 1) * g / 2 + rise
        for j, ln in enumerate(lines):
            lw = d.textlength(ln, font=f)
            d.text(((W - lw) / 2, top + j * g), ln, font=f,
                   fill=col + (int(255 * a),), anchor="lm")

        # A quiet marker under the saved line, so a screenshot of it reads as
        # a thing rather than a caption.
        if i == 4:
            k = ease((t - t0 - 0.5) / 0.9)
            if k > 0:
                y = top + (len(lines) - 1) * g + 74
                d.rounded_rectangle(
                    [W / 2 - 96 * k, y, W / 2 + 96 * k, y + 4], radius=2,
                    fill=ROSE + (int(190 * a * k),))

    if t >= 18.35:
        a = ease((t - 18.35) / 0.7)
        f = font(POP_M, 50)
        s = "The Seven-Day Reset  ·  Link in bio"
        lw = d.textlength(s, font=f)
        d.text(((W - lw) / 2, 1250), s, font=f,
               fill=MUTE + (int(240 * a),), anchor="lm")


def main():
    assert_ok()
    os.makedirs("fr", exist_ok=True)
    cache, ck = None, -1
    for i in range(N):
        t = i / FPS
        k = int(t * 10)
        if k != ck:
            cache, ck = background(t), k
        img = cache.copy()
        draw(img, t)
        img.save(f"fr/f{i:03d}.jpg", quality=94)
    print("frames", N, "duration", DUR)


if __name__ == "__main__":
    main()

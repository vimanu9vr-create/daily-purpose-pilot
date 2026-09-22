"""Day 07, rebuilt — calm, slow, and with something in it.

The first cut was 9 seconds across five beats: about 1.4s per line, which is
less than it takes to read two lines of bold type. Nobody finished a sentence
before the next replaced it, and a video you can't finish reading can't mean
anything. Speed was the reason it felt empty.

It was also the wrong register. The app is blush pink, serif and quiet. A
slamming oxblood book sells a different product than the one people land on.

So: 18.6s, six beats, nothing under 2.2s and the payoff line given a full four.
Cross-fades, no hard cuts, no shake, no snap. Warm palette, light that moves
from a cold morning window to a lamp. Lora for the lines that carry feeling,
Poppins Light for the plain ones.

And it now teaches one thing rather than asserting three: a vague want becomes
a small, dated, slightly embarrassing action. The viewer leaves holding a
method, not an accusation.
"""

import math
import os

import numpy as np
from PIL import Image, ImageDraw, ImageFont

W, H = 1080, 1920
LW, LH = 270, 480
FPS = 30
DUR = 18.6
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


# Contiguous, and nothing under 2.2s. The payoff gets four full seconds
# because it's the only line anyone needs to remember.
BEATS = [
    (0.00, 3.40),
    (3.40, 6.80),
    (6.80, 9.60),    # the turn — light begins to warm
    (9.60, 13.60),   # the payoff, held
    (13.60, 16.40),
    (16.40, 18.60),
]
TURN = BEATS[2][0]

TEXT = [
    ('"I want more money"\nis not a goal.', LORA, 86, INK, 1000, 116),
    ("It's a wish with nowhere\nto put itself.", POP_L, 68, INK, 1010, 98),
    ("Here's the same want,\nwith somewhere to go:", POP_L, 66, BURG, 1010, 96),
    ("Friday, six o'clock.\nI send the invoice I've been\nrewriting for a week.",
     LORA_I, 80, BURG, 960, 112),
    ("Small. Dated.\nEmbarrassing not to do.", POP_L, 66, INK, 1010, 96),
    ("Seven days of these.", LORA, 76, BURG, 980, 104),
]

# 0.34, not 0.55.
#
# Beats must not overlap or text lands on text, so a beat's fade-out ends
# exactly where the next one's fade-in begins — which means both sit near zero
# around every boundary. At 0.55 that left roughly a third of a second of
# near-invisible text between each line: a blank flicker six times over, found
# by measuring luminance range per frame rather than by watching.
#
# At 0.34 the dissolve still reads as gentle, the hole is short enough to be a
# breath instead of a gap, and every beat still holds solid for at least 1.5s.
FADE = 0.34
MAXW = W - 190


def beat_at(t):
    if t < BEATS[0][1]:
        return 0, t
    for i, (a, b) in enumerate(BEATS):
        if a <= t < b:
            return i, t - a
    return len(BEATS) - 1, max(t - BEATS[-1][0], 0.0)


def assert_contiguous():
    for (a1, b1), (a2, _) in zip(BEATS, BEATS[1:]):
        assert abs(b1 - a2) < 1e-9, f"gap between {b1} and {a2}"
    assert BEATS[0][0] == 0.0
    assert abs(BEATS[-1][1] - DUR) < 1e-9
    for i, (a, b) in enumerate(BEATS):
        assert b - a >= 2.2, f"beat {i} is {b - a:.2f}s — too fast to read"
    assert len(TEXT) == len(BEATS)


def background(t):
    """A room. Cold window early, lamp glow arriving with the turn."""
    yy = np.linspace(0, 1, LH)[:, None]
    xx = np.linspace(0, 1, LW)[None, :]
    warm = ease((t - TURN) / 3.2)
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

    base *= 1.0 + 0.010 * math.sin(t * 0.55)   # a slow breath

    band = np.exp(-(((yy - 0.545) / 0.20) ** 2)) * 0.55
    for i, c in enumerate(BLUSH):
        base[..., i] = base[..., i] * (1 - band) + c * band

    vd = np.sqrt((xx - 0.5) ** 2 + (yy - 0.5) ** 2)
    base *= (1 - np.clip((vd - 0.40) / 0.62, 0, 1) ** 1.5 * 0.40)[..., None]

    img = Image.fromarray(np.clip(base, 0, 255).astype(np.uint8)).resize(
        (W, H), Image.LANCZOS
    )

    # Ruled lines, arriving one at a time from the turn onward, very faint.
    #
    # Without them the frame is text floating in an empty wash — calm, but
    # empty, which is the other way to have no meaning. These say "this is a
    # page you write on" without a word, and they're the product. They draw in
    # slowly enough to stay peaceful: one every third of a second.
    if t > TURN:
        d = ImageDraw.Draw(img, "RGBA")
        for n, y in enumerate(range(1180, 1760, 96)):
            k = ease((t - TURN - n * 0.34) / 1.1)
            if k <= 0.01:
                continue
            x1 = 168 + (W - 336) * k
            d.rounded_rectangle([168, y, x1, y + 3], radius=2,
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
            a = 1.0 - ease((t - (t1 - FADE)) / FADE)   # readable at frame 0
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

    # The sign-off rides under the last beat only.
    if t >= 17.05:
        a = ease((t - 17.05) / 0.7)
        f = font(POP_M, 50)
        s = "The Seven-Day Reset  ·  Link in bio"
        lw = d.textlength(s, font=f)
        d.text(((W - lw) / 2, 1250), s, font=f,
               fill=MUTE + (int(240 * a),), anchor="lm")


def main():
    assert_contiguous()
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

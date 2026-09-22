"""Day 07 — "Visualizing money won't fix your bank account."

Same hardened architecture as Day 06: contiguous beats, a build-time assert
that fails on a gap or a wrong-ink beat, and fit() measuring every line against
the real font instead of trusting a size I picked by eye.

The brief asks for live action — a hand slamming a hardbound book onto a desk,
then a top-down of the workbook page. I can't film. What this does instead is
the same beat rendered: a heavy dark slab already falling at frame 0, a real
impact that shakes the whole frame and throws dust, and then the inversion to
cream turns the frame INTO the page, ruled lines and all. If Viggnesh shoots
the real thing, it drops straight over the first two seconds.
"""

import math
import os

import numpy as np
from PIL import Image, ImageDraw, ImageFont

W, H = 1080, 1920
LW, LH = 270, 480
FPS = 30
DUR = 9.0
N = int(DUR * FPS)

CREAM = (247, 233, 236)
ROSE = (214, 150, 164)
BURG = (92, 31, 46)
PLUM = (16, 8, 12)
MUTE = (178, 146, 155)

GF = "/usr/share/fonts/truetype/google-fonts/"
POP_B = GF + "Poppins-Bold.ttf"
POP_M = GF + "Poppins-Medium.ttf"
LORA_I = GF + "Lora-Italic-Variable.ttf"

_fc = {}


def font(p, s):
    if (p, s) not in _fc:
        _fc[(p, s)] = ImageFont.truetype(p, s)
    return _fc[(p, s)]


def ease(t):
    t = max(0.0, min(1.0, t))
    return t * t * (3 - 2 * t)


IMPACT = 0.30          # the book lands
BEATS = [
    (0.00, 2.00),      # slam + hook
    (2.00, 3.40),
    (3.40, 4.80),
    (4.80, 6.30),      # inversion — the frame becomes the page
    (6.30, 9.00),      # CTA
]
INVERT_BEAT = 3
TURN = BEATS[INVERT_BEAT][0]
INK_IS_DARK = [False, False, False, True, True]

LINES = {
    1: "Stop arguing with\nyour own skepticism.",
    2: "The universe isn't delivering\nbecause you wished.",
    3: "Daydreams into\ndaily constraints.",
}


def beat_at(t):
    if t < BEATS[0][1]:
        return 0, t / BEATS[0][1], t
    for i, (a, b) in enumerate(BEATS):
        if a <= t < b:
            return i, (t - a) / (b - a), t - a
    a, b = BEATS[-1]
    return len(BEATS) - 1, 1.0, max(t - a, 0.0)


def assert_contiguous():
    for (a1, b1), (a2, _) in zip(BEATS, BEATS[1:]):
        assert abs(b1 - a2) < 1e-9, f"gap between {b1} and {a2}"
    assert BEATS[0][0] == 0.0
    assert abs(BEATS[-1][1] - DUR) < 1e-9
    assert TURN == BEATS[INVERT_BEAT][0], "inversion must land on its own beat"
    for i, (a, _) in enumerate(BEATS):
        assert (a >= TURN) == INK_IS_DARK[i], f"beat {i} draws unreadable ink"


def shake(t):
    """Impact displacement. Damped, ~0.55s, strongest on the landing frame."""
    if t < IMPACT or t > IMPACT + 0.55:
        return 0.0, 0.0
    k = (t - IMPACT) / 0.55
    amp = 46 * math.exp(-6.5 * k)
    return amp * math.sin(k * 58), amp * 0.65 * math.cos(k * 71)


def background(t):
    inv = t >= TURN
    yy = np.linspace(0, 1, LH)[:, None]
    xx = np.linspace(0, 1, LW)[None, :]
    base = np.zeros((LH, LW, 3), np.float32)

    if inv:
        # The frame IS the workbook page now — cream, ruled, warm lamp.
        for i, c in enumerate(CREAM):
            base[..., i] = c
        d_ = np.sqrt((xx - 0.5) ** 2 + (yy - 0.66) ** 2)
        g = np.clip(1 - d_ / 0.98, 0, 1) ** 1.5 * 0.32
        for i, c in enumerate((255, 224, 206)):
            base[..., i] = base[..., i] * (1 - g) + c * g
    else:
        for i, c in enumerate(PLUM):
            base[..., i] = c
        d_ = np.sqrt((xx - 0.5) ** 2 + (yy - 0.42) ** 2)
        g = np.clip(1 - d_ / 0.88, 0, 1) ** 1.6 * 0.36
        for i, c in enumerate((104, 46, 62)):
            base[..., i] = base[..., i] * (1 - g) + c * g

    vd = np.sqrt((xx - 0.5) ** 2 + (yy - 0.5) ** 2)
    base *= (1 - np.clip((vd - 0.34) / 0.66, 0, 1) ** 1.4 * (0.28 if inv else 0.64))[
        ..., None
    ]

    img = Image.fromarray(np.clip(base, 0, 255).astype(np.uint8)).resize(
        (W, H), Image.LANCZOS
    )
    d = ImageDraw.Draw(img, "RGBA")

    if inv:
        # Ruled lines, faint — the minimalist workbook layout from the brief.
        for y in range(760, 1500, 92):
            d.rounded_rectangle([150, y, W - 150, y + 3], radius=2,
                                fill=(180, 146, 156, 60))
    return img


REST_Y = 600
START_Y = -250   # partly in frame at t=0 — see the note below


def slab(img, t):
    """The book: dark cover, cream page block, already falling at frame 0.

    START_Y was -560, which put the whole book above the frame at t=0 — so the
    first thing a scrolling stranger saw was text on black, and the slam the
    brief is built around didn't exist until frame 4. The first frame is the
    only one you're guaranteed, so the book has to already be in it.

    The cream page block is the other half: a dark slab on a dark ground was
    nearly invisible. Cream against near-black reads instantly as a book.
    """
    d = ImageDraw.Draw(img, "RGBA")
    if t < IMPACT:
        k = t / IMPACT
        y = START_Y + (REST_Y - START_Y) * (k * k)     # accelerating fall
        blur_h = 46 * (1 - k)
    else:
        y = REST_Y
        blur_h = 0

    if blur_h:  # motion smear trailing above it
        d.rounded_rectangle([120, y - blur_h, W - 120, y + 40], radius=12,
                            fill=(30, 16, 22, 120))

    # Oxblood, not near-black. At (26,14,19) against a (16,8,12) ground the
    # cover was invisible and the book read as a floating cream bar — only the
    # page block had any contrast. A hardback needs to be a lighter object
    # than the room it lands in.
    d.rounded_rectangle([120, y, W - 120, y + 470], radius=14,
                        fill=(82, 36, 48, 255))                 # cover
    d.rounded_rectangle([120, y, W - 120, y + 470], radius=14,
                        outline=(126, 62, 78, 255), width=3)    # lit edge
    d.rounded_rectangle([146, y + 372, W - 146, y + 452], radius=8,
                        fill=(238, 226, 214, 255))              # page block
    for i in range(1, 5):                                        # page edges
        yy_ = y + 372 + i * 16
        d.rounded_rectangle([146, yy_, W - 146, yy_ + 2], radius=1,
                            fill=(196, 178, 168, 255))
    d.rounded_rectangle([120, y, W - 120, y + 24], radius=10,
                        fill=(118, 56, 72, 255))                # spine light
    if IMPACT <= t < IMPACT + 0.6:   # dust
        k = (t - IMPACT) / 0.6
        rng = np.random.default_rng(7)
        for _ in range(26):
            ang = float(rng.uniform(0, math.pi))
            dist = float(rng.uniform(40, 340)) * ease(k)
            px = W / 2 + math.cos(ang) * dist * 1.9
            py = 1090 - math.sin(ang) * dist * 0.5
            r = float(rng.uniform(3, 9)) * (1 - k)
            d.ellipse([px - r, py - r, px + r, py + r],
                      fill=(176, 148, 156, int(150 * (1 - k))))


MAXW = W - 170


def fit(d, text, path, size):
    while size > 40:
        f = font(path, size)
        if all(d.textlength(ln, font=f) <= MAXW for ln in text.split("\n")):
            return f, size
        size -= 2
    return font(path, 40), 40


def centred(d, text, path, size, y, fill, gap):
    f, used = fit(d, text, path, size)
    gap = int(gap * used / size)
    for j, ln in enumerate(text.split("\n")):
        lw = d.textlength(ln, font=f)
        d.text(((W - lw) / 2, y + j * gap), ln, font=f, fill=fill, anchor="lm")


def draw(img, t):
    idx, _, since = beat_at(t)
    if idx == 0:
        slab(img, t)
    d = ImageDraw.Draw(img, "RGBA")

    if idx == 0:
        # Hook is on screen from frame 0 — a scrolling stranger judges the
        # first frame, and an empty one is a scroll.
        centred(d, "Visualizing money won't fix\nyour bank account.",
                POP_B, 82, 1300, CREAM + (255,), 108)
    elif idx in (1, 2):
        centred(d, LINES[idx], POP_B, 82, 1010, CREAM + (255,), 108)
    elif idx == 3:
        centred(d, LINES[3], POP_B, 88, 1000, BURG + (255,), 114)
        sub = "Specific. Dated. Small enough to do tonight."
        f = font(POP_M, 48)
        lw = d.textlength(sub, font=f)
        d.text(((W - lw) / 2, 1214), sub, font=f, fill=(122, 76, 90, 255), anchor="lm")
    else:
        centred(d, "GET OUT OF\nYOUR OWN HEAD.", POP_B, 108, 900, BURG + (255,), 126)
        if since > 0.40:
            a = int(255 * ease((since - 0.40) / 0.35))
            centred(d, "The Seven-Day Reset", LORA_I, 66, 1170,
                    (110, 66, 80, a), 84)
            f = font(POP_M, 46)
            s = "19 pages  ·  instant download"
            lw = d.textlength(s, font=f)
            d.text(((W - lw) / 2, 1246), s, font=f,
                   fill=(150, 116, 128, a), anchor="lm")
        if since > 1.00:
            a = ease((since - 1.00) / 0.35)
            f = font(POP_B, 62)
            s = "LINK IN BIO"
            lw = d.textlength(s, font=f)
            x0, y0 = (W - lw) / 2, 1400
            d.rounded_rectangle([x0 - 54, y0 - 50, x0 + lw + 54, y0 + 50],
                                radius=50, fill=BURG + (int(246 * a),))
            d.text((x0, y0), s, font=f, fill=CREAM + (int(255 * a),), anchor="lm")


def main():
    assert_contiguous()
    os.makedirs("fr", exist_ok=True)
    cache, ck = None, -1
    for i in range(N):
        t = i / FPS
        k = (int(t * 10), beat_at(t)[0])
        if k != ck:
            cache, ck = background(t), k
        img = cache.copy()
        draw(img, t)

        # Impact shake, then the per-beat scale snap.
        dx, dy = shake(t)
        _, _, since = beat_at(t)
        z = 1.0 + 0.045 * (1 - ease(since / 0.22))
        if abs(dx) > 0.5 or abs(dy) > 0.5 or z > 1.001:
            z = max(z, 1.06 if (dx or dy) else z)
            nw, nh = int(W * z), int(H * z)
            big = img.resize((nw, nh), Image.LANCZOS)
            cx = (nw - W) // 2 + int(dx)
            cy = (nh - H) // 2 + int(dy)
            cx = max(0, min(nw - W, cx))
            cy = max(0, min(nh - H, cy))
            img = big.crop((cx, cy, cx + W, cy + H))
        img.save(f"fr/f{i:03d}.jpg", quality=94)
    print("frames", N)


if __name__ == "__main__":
    main()

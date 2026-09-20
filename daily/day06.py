"""Day 06 — the anti-magic reality check.

Deliberately NOT the house style. Days 01-05 were soft serif fading up over a
pink gradient, which undercut every confrontational line they carried: the
words were a pattern interrupt and the delivery was a meditation app.

So: near-black ground, hard cuts with no fades, a scale snap on every beat, a
full colour inversion at the turn. Motion at frame 0 is the mirror shimmer.
"""

import math
import os

import numpy as np
from PIL import Image, ImageDraw, ImageFont

W, H = 1080, 1920
LW, LH = 270, 480
FPS = 30
DUR = 10.5
N = int(DUR * FPS)

CREAM = (247, 233, 236)
ROSE = (214, 150, 164)
BURG = (92, 31, 46)
PLUM = (18, 9, 13)
MUTE = (178, 146, 155)

GF = "/usr/share/fonts/truetype/google-fonts/"
LORA_I = GF + "Lora-Italic-Variable.ttf"
POP_B = GF + "Poppins-Bold.ttf"
POP_M = GF + "Poppins-Medium.ttf"

_fc = {}


def font(p, s):
    if (p, s) not in _fc:
        _fc[(p, s)] = ImageFont.truetype(p, s)
    return _fc[(p, s)]


def ease(t):
    t = max(0.0, min(1.0, t))
    return t * t * (3 - 2 * t)


# The inversion. Everything before 6.80 is dark; everything after is cream.
# A hard colour flip is the cheapest dopamine beat there is and it lands
# exactly where the script stops accusing and starts explaining.
TURN = 6.80

BEATS = [
    (0.00, 2.00),   # mirror hook
    (2.15, 3.55),
    (3.70, 5.10),
    (5.25, 6.65),
    (6.80, 8.10),   # inversion
    (8.25, 10.50),  # CTA
]

# Explicit breaks, because where a punchy line lands matters — but `fit()`
# still measures and shrinks, so a line can never run off the frame the way
# four of these five did on the first contact sheet.
LINES = {
    1: "Your brain\nisn't dumb.",
    2: "It knows your account\nsays otherwise.",
    3: "So you argue\nwith yourself.\nYou lose.",
    4: "Not magic.\nCognitive filtering.",
}


def beat_at(t):
    for i, (a, b) in enumerate(BEATS):
        if a <= t < b:
            return i, (t - a) / (b - a), t - a
    return len(BEATS) - 1, 1.0, t - BEATS[-1][0]


def background(t):
    inv = 1.0 if t >= TURN else 0.0
    ground = CREAM if inv else PLUM

    yy = np.linspace(0, 1, LH)[:, None]
    xx = np.linspace(0, 1, LW)[None, :]
    base = np.zeros((LH, LW, 3), np.float32)
    for i, c in enumerate(ground):
        base[..., i] = c

    if inv:
        d_ = np.sqrt((xx - 0.5) ** 2 + (yy - 0.62) ** 2)
        g = np.clip(1 - d_ / 0.95, 0, 1) ** 1.5 * 0.30
        for i, c in enumerate((255, 224, 206)):
            base[..., i] = base[..., i] * (1 - g) + c * g
    else:
        d_ = np.sqrt((xx - 0.5) ** 2 + (yy - 0.40) ** 2)
        g = np.clip(1 - d_ / 0.85, 0, 1) ** 1.6 * 0.34
        for i, c in enumerate((96, 44, 58)):
            base[..., i] = base[..., i] * (1 - g) + c * g

    vd = np.sqrt((xx - 0.5) ** 2 + (yy - 0.5) ** 2)
    vg = np.clip((vd - 0.34) / 0.66, 0, 1) ** 1.4 * (0.30 if inv else 0.62)
    base *= (1 - vg)[..., None]

    return Image.fromarray(np.clip(base, 0, 255).astype(np.uint8)).resize(
        (W, H), Image.LANCZOS
    )


MAXW = W - 180


def fit(d, text, path, size, maxw=MAXW):
    """Shrink until every line fits, measured against the real font.

    The first render of this video had four of five beats running off both
    edges of the frame because `centred` split on newlines and trusted the
    size I'd picked by eye. Never clamp a width and hope.
    """
    while size > 40:
        fnt = font(path, size)
        if all(d.textlength(ln, font=fnt) <= maxw for ln in text.split("\n")):
            return fnt, size
        size -= 2
    return font(path, 40), 40


def centred(d, text, path, size, y, fill, gap):
    fnt, used = fit(d, text, path, size)
    gap = int(gap * used / size) if size else gap
    for j, ln in enumerate(text.split("\n")):
        lw = d.textlength(ln, font=fnt)
        d.text(((W - lw) / 2, y + j * gap), ln, font=fnt, fill=fill, anchor="lm")
    return used


def draw(img, t):
    d = ImageDraw.Draw(img, "RGBA")
    idx, prog, since = beat_at(t)

    if idx == 0:
        # The mirror. The claim sits above the glass and its own reflection
        # sits under it, shimmering — so the frame is moving at frame 0 and
        # the hook is a picture, not a caption.
        fnt = font(LORA_I, 92)
        s = '"I am a millionaire"'
        lw = d.textlength(s, font=fnt)
        d.text(((W - lw) / 2, 690), s, font=fnt, fill=CREAM + (255,), anchor="lm")

        d.rounded_rectangle([200, 762, W - 200, 767], radius=3, fill=ROSE + (150,))

        refl = Image.new("RGBA", (W, 150), (0, 0, 0, 0))
        rd = ImageDraw.Draw(refl)
        rd.text(((W - lw) / 2, 60), s, font=fnt, fill=CREAM + (90,), anchor="lm")
        refl = refl.transpose(Image.FLIP_TOP_BOTTOM)
        shim = 4 * math.sin(t * 3.4)
        img.paste(refl, (int(shim), 790), refl)

        centred(d, "MAKES YOU\nLOOK STUPID.", POP_B, 96, 1108, ROSE + (255,), 122)

    elif idx in (1, 2, 3):
        y = 980 if idx == 3 else 1020
        centred(d, LINES[idx], POP_B, 88, y, CREAM + (255,), 116)

    elif idx == 4:
        centred(d, LINES[4], POP_B, 92, 1000, BURG + (255,), 120)
        sub = font(POP_M, 52)
        s = "What you notice. What you do next."
        lw = d.textlength(s, font=sub)
        d.text(((W - lw) / 2, 1268), s, font=sub, fill=(120, 74, 88, 255), anchor="lm")

    else:
        centred(d, "STOP\nPRETENDING.", POP_B, 118, 900, BURG + (255,), 132)

        if since > 0.45:
            a = int(255 * ease((since - 0.45) / 0.35))
            centred(d, "19 pages. Seven days.\nTen minutes each.", POP_M, 62,
                    1150, (110, 66, 80, a), 84)
        if since > 1.05:
            a = ease((since - 1.05) / 0.35)
            fnt2 = font(POP_B, 64)
            s2 = "LINK IN BIO"
            lw = d.textlength(s2, font=fnt2)
            x0, y0 = (W - lw) / 2, 1382
            d.rounded_rectangle([x0 - 56, y0 - 52, x0 + lw + 56, y0 + 52],
                                radius=52, fill=BURG + (int(245 * a),))
            d.text((x0, y0), s2, font=fnt2, fill=CREAM + (int(255 * a),), anchor="lm")


def main():
    os.makedirs("fr", exist_ok=True)
    cache, ck = None, -1
    for i in range(N):
        t = i / FPS
        # Cache on the beat index as well as the tenth-of-a-second, so the
        # inversion can't be smeared across the cut by a stale background.
        k = (int(t * 10), beat_at(t)[0])
        if k != ck:
            cache, ck = background(t), k
        img = cache.copy()
        draw(img, t)

        # Scale snap: every beat lands 4% large and settles in 0.22s. Hard
        # cuts with no fade — a fade is what made the first five videos feel
        # like a meditation app reading out an accusation.
        _, _, since = beat_at(t)
        k2 = 1.0 + 0.040 * (1 - ease(since / 0.22))
        if k2 > 1.001:
            nw, nh = int(W * k2), int(H * k2)
            img = img.resize((nw, nh), Image.LANCZOS).crop(
                ((nw - W) // 2, (nh - H) // 2, (nw - W) // 2 + W, (nh - H) // 2 + H)
            )
        img.save(f"fr/f{i:03d}.jpg", quality=94)
    print("frames", N)


if __name__ == "__main__":
    main()

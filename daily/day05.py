"""Day 05 — the two-minute version of a vision board.

Build method per the skill: backgrounds at 270x480 upscaled, ~10 updates/sec
cached, JPEG q94 frames, paste() not alpha_composite, grain added in ffmpeg.
"""

import math
import os

import numpy as np
from PIL import Image, ImageDraw, ImageFont

W, H = 1080, 1920
LW, LH = 270, 480
FPS = 30
DUR = 15.0
N = int(DUR * FPS)

CREAM = (247, 233, 236)
ROSE = (214, 150, 164)
BURG = (92, 31, 46)
PLUM = (24, 12, 17)
MUTE = (178, 146, 155)
BLUSH = (250, 240, 240)
INK = (58, 22, 32)

GF = "/usr/share/fonts/truetype/google-fonts/"
LORA = GF + "Lora-Variable.ttf"
LORA_I = GF + "Lora-Italic-Variable.ttf"
POP_L = GF + "Poppins-Light.ttf"
POP_M = GF + "Poppins-Medium.ttf"

_fc = {}


def font(path, size):
    k = (path, size)
    if k not in _fc:
        _fc[k] = ImageFont.truetype(path, size)
    return _fc[k]


# ---------------------------------------------------------------- the board
# Fifteen tiles in a loose grid: "someone else's life", pretty and cold. They
# are already drifting at frame 0 (no static opening card) and drain away one
# by one before the turn, so the frame empties in front of the viewer.
rng = np.random.default_rng(5)
TILES = []
cols, rows = 3, 5
for r in range(rows):
    for c in range(cols):
        x = 14 + c * 82 + float(rng.uniform(-4, 4))
        y = 22 + r * 90 + float(rng.uniform(-4, 4))
        TILES.append(
            {
                "x": x,
                "y": y,
                "w": 70 + float(rng.uniform(-5, 5)),
                "h": 74 + float(rng.uniform(-6, 6)),
                "tone": float(rng.uniform(0, 1)),
                "phase": float(rng.uniform(0, math.tau)),
                "speed": float(rng.uniform(0.35, 0.75)),
            }
        )
# Drain order: scattered, not row by row — it should feel like loss, not a wipe.
order = list(rng.permutation(len(TILES)))
for rank, idx in enumerate(order):
    TILES[idx]["go"] = 2.40 + rank * 0.245   # last tile leaves ~6.1s


def lerp(a, b, t):
    return a + (b - a) * t


def ease(t):
    t = max(0.0, min(1.0, t))
    return t * t * (3 - 2 * t)


def tone_colour(v, warm):
    """Dusty rose-to-mauve tiles; they cool further as the argument is stated."""
    base = (
        lerp(196, 168, v),
        lerp(152, 138, v),
        lerp(162, 158, v),
    )
    return tuple(int(lerp(b, lerp(b, 255, 0.10), warm)) for b in base)


def background(t):
    """A room, not a gradient: cold window wash high, warm lamp growing low."""
    yy = np.linspace(0, 1, LH)[:, None]
    xx = np.linspace(0, 1, LW)[None, :]

    warm = ease((t - 6.3) / 2.6)          # the turn, in light
    cold = 1.0 - 0.75 * warm

    base = np.zeros((LH, LW, 3), np.float32)
    for i, c in enumerate(CREAM):
        base[..., i] = c

    # cold window wash, upper left
    wd = np.sqrt((xx - 0.22) ** 2 + (yy - 0.10) ** 2)
    win = np.clip(1 - wd / 0.85, 0, 1) ** 1.7 * (0.30 * cold)
    for i, c in enumerate((206, 214, 232)):
        base[..., i] = base[..., i] * (1 - win) + c * win

    # warm lamp, lower right, grows across the video
    ld = np.sqrt((xx - 0.80) ** 2 + (yy - 0.86) ** 2)
    lamp = np.clip(1 - ld / 1.02, 0, 1) ** 1.5 * (0.46 * warm)
    for i, c in enumerate((255, 226, 206)):
        base[..., i] = base[..., i] * (1 - lamp) + c * lamp

    # a slow breathing lift so the frame is never still
    base *= 1.0 + 0.012 * math.sin(t * 0.9)

    img = Image.fromarray(np.clip(base, 0, 255).astype(np.uint8))
    d = ImageDraw.Draw(img, "RGBA")

    for tl in TILES:
        a = 1.0
        dy = 0.0
        if t > tl["go"]:
            k = ease((t - tl["go"]) / 0.55)
            a = 1.0 - k
            dy = -16.0 * k
        # The loop. The last frame has to hand back to the first or the cut is
        # a jump, and replays are counted in watch time — which is the signal
        # that matters most. The board re-forms under the closing line, so
        # frame 449 and frame 0 are nearly the same picture.
        back = ease((t - 13.30) / 1.55)
        if back > 0:
            a = max(a, back)
            dy = lerp(dy, 0.0, back)
        if a <= 0.01:
            continue
        drift = 2.4 * math.sin(t * tl["speed"] + tl["phase"])
        x0 = tl["x"]
        y0 = tl["y"] + drift + dy
        col = tone_colour(tl["tone"], warm)
        d.rounded_rectangle(
            [x0, y0, x0 + tl["w"], y0 + tl["h"]],
            radius=5,
            fill=col + (int(235 * a),),
        )

    # A veil across the text band. Without it the hook sits on top of the
    # tiles at almost no contrast — caught on the first contact sheet, where
    # "40 photos of someone else's life" was unreadable over a mauve square.
    arr = np.asarray(img).astype(np.float32)
    band = np.exp(-(((yy - 0.545) / 0.175) ** 2)) * 0.80
    for i, c in enumerate(BLUSH):
        arr[..., i] = arr[..., i] * (1 - band) + c * band
    img = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))

    # vignette
    vd = np.sqrt((xx - 0.5) ** 2 + (yy - 0.5) ** 2)
    vg = np.clip((vd - 0.40) / 0.62, 0, 1) ** 1.5 * 0.46
    arr = np.asarray(img).astype(np.float32) * (1 - vg[..., None])
    return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8)).resize(
        (W, H), Image.LANCZOS
    )


# ------------------------------------------------------------------ text
def wrap(draw, text, fnt, maxw):
    """Wrap against real font metrics, then pull a word down off an orphan."""
    words, lines, cur = text.split(), [], ""
    for w_ in words:
        trial = (cur + " " + w_).strip()
        if draw.textlength(trial, font=fnt) <= maxw or not cur:
            cur = trial
        else:
            lines.append(cur)
            cur = w_
    if cur:
        lines.append(cur)
    if len(lines) > 1 and len(lines[-1].split()) == 1:
        prev = lines[-2].split()
        if len(prev) > 1:
            lines[-2] = " ".join(prev[:-1])
            lines[-1] = prev[-1] + " " + lines[-1]
    return lines


BEATS = [
    # (in, out, text, font, size, colour, centre-y, line-gap)
    (0.00, 2.10, "Your vision board is 40 photos of someone else's life.",
     LORA, 92, INK, 1010, 116),
    (2.30, 4.05, "You never see the ordinary day.",
     POP_L, 70, INK, 1050, 96),
    (4.25, 6.15, "That's the part you were trying to reach.",
     POP_L, 70, INK, 1050, 96),
    # 70px, not 78: at 78 this wraps and strands "The" alone on line one.
    # Measured against the real font rather than guessed.
    (6.40, 7.70, "The two-minute version",
     POP_M, 70, BURG, 1055, 100),
    (7.95, 11.10, "A Tuesday. Coffee in the flat I signed for. The rent never crosses my mind.",
     LORA_I, 96, BURG, 1030, 122),
    (11.35, 12.75, "Describe the Tuesday. Not the highlight.",
     POP_L, 70, INK, 1050, 96),
    (12.95, 15.00, "Send this to whoever's board hasn't moved since January.",
     POP_L, 66, INK, 1000, 92),
]

FADE = 0.22
MARGIN = 108


def draw_beat(img, t):
    d = ImageDraw.Draw(img, "RGBA")
    for i, (t0, t1, text, fp, size, col, cy, gap) in enumerate(BEATS):
        if t < t0 - 0.01 or t > t1:
            continue
        # Beats never overlap: each fade-out completes inside its own window.
        # The hook is exempt from the fade-IN — frame 0 has to be readable
        # with the sound off, and a beat that starts at alpha 0 gives a
        # scrolling stranger an empty cream rectangle to judge.
        fade_in = 1.0 if i == 0 else ease((t - t0) / FADE)
        a = fade_in * (1.0 - ease((t - (t1 - FADE)) / FADE))
        if a <= 0.01:
            continue
        fnt = font(fp, size)
        lines = wrap(d, text, fnt, W - 2 * MARGIN)
        rise = 0.0 if i == 0 else (1 - ease((t - t0) / 0.42)) * 16
        top = cy - (len(lines) - 1) * gap / 2 + rise
        for j, ln in enumerate(lines):
            lw = d.textlength(ln, font=fnt)
            d.text(
                ((W - lw) / 2, top + j * gap),
                ln,
                font=fnt,
                fill=col + (int(255 * a),),
                anchor="lm",
            )

    # Brand line, only under the last beat. It sits below the veil band, and
    # by then the board has re-formed underneath it for the loop — grey text
    # on mauve tiles was unreadable on the contact sheet. Its own pill fixes
    # that without moving it into the sentence's space.
    if t >= 13.35:
        a = ease((t - 13.35) / 0.5)
        fnt = font(POP_L, 46)
        s = "ManifestAI  ·  Link in bio"
        lw = d.textlength(s, font=fnt)
        x0, y0 = (W - lw) / 2, 1392
        d.rounded_rectangle(
            [x0 - 46, y0 - 40, x0 + lw + 46, y0 + 40],
            radius=40,
            fill=BLUSH + (int(224 * a),),
        )
        d.text((x0, y0), s, font=fnt, fill=BURG + (int(238 * a),), anchor="lm")


def main():
    os.makedirs("fr", exist_ok=True)
    cache, ck = None, -1
    for i in range(N):
        t = i / FPS
        k = int(t * 10)
        if k != ck:
            cache, ck = background(t), k
        img = cache.copy()
        draw_beat(img, t)
        img.save(f"fr/f{i:03d}.jpg", quality=94)
    print("frames", N)


if __name__ == "__main__":
    main()

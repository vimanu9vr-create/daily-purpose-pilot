"""Day 05 cover — dark, alternating against Day 04's light one.

Everything that has to be readable sits between y=660 and y=1260, because the
profile grid crops to roughly the centre square and a cover whose line is cut
in half is a tile nobody taps.
"""

import numpy as np
from PIL import Image, ImageDraw, ImageFont

W, H = 1080, 1920
PLUM = (24, 12, 17)
ROSE = (214, 150, 164)
CREAM = (247, 233, 236)
MUTE = (178, 146, 155)

GF = "/usr/share/fonts/truetype/google-fonts/"
LORA = GF + "Lora-Variable.ttf"
POP_M = GF + "Poppins-Medium.ttf"

yy = np.linspace(0, 1, H)[:, None]
xx = np.linspace(0, 1, W)[None, :]

base = np.zeros((H, W, 3), np.float32)
for i, c in enumerate(PLUM):
    base[..., i] = c

# one warm lamp low right, so the dark tile isn't flat black
ld = np.sqrt((xx - 0.78) ** 2 + (yy - 0.88) ** 2)
lamp = np.clip(1 - ld / 0.95, 0, 1) ** 1.6 * 0.42
for i, c in enumerate((196, 122, 110)):
    base[..., i] = base[..., i] * (1 - lamp) + c * lamp

# cold wash top left
wd = np.sqrt((xx - 0.20) ** 2 + (yy - 0.08) ** 2)
win = np.clip(1 - wd / 0.80, 0, 1) ** 1.8 * 0.22
for i, c in enumerate((120, 132, 168)):
    base[..., i] = base[..., i] * (1 - win) + c * win

img = Image.fromarray(np.clip(base, 0, 255).astype(np.uint8))
d = ImageDraw.Draw(img, "RGBA")

# the board, dim — present but clearly not the subject
rng = np.random.default_rng(5)
for r in range(6):
    for c in range(3):
        x = 56 + c * 328 + float(rng.uniform(-14, 14))
        y = 96 + r * 300 + float(rng.uniform(-14, 14))
        w = 280 + float(rng.uniform(-18, 18))
        h = 250 + float(rng.uniform(-18, 18))
        tone = float(rng.uniform(0, 1))
        col = (int(112 + 46 * tone), int(72 + 28 * tone), int(84 + 26 * tone))
        d.rounded_rectangle([x, y, x + w, y + h], radius=22, fill=col + (150,))

# scrim across the middle so the line reads over any tile
arr = np.asarray(img).astype(np.float32)
band = np.exp(-(((yy - 0.50) / 0.165) ** 2)) * 0.86
for i, c in enumerate(PLUM):
    arr[..., i] = arr[..., i] * (1 - band) + c * band
vd = np.sqrt((xx - 0.5) ** 2 + (yy - 0.5) ** 2)
arr *= (1 - np.clip((vd - 0.36) / 0.66, 0, 1) ** 1.4 * 0.55)[..., None]
img = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))
d = ImageDraw.Draw(img, "RGBA")


def wrap(text, fnt, maxw):
    words, lines, cur = text.split(), [], ""
    for w_ in words:
        t = (cur + " " + w_).strip()
        if d.textlength(t, font=fnt) <= maxw or not cur:
            cur = t
        else:
            lines.append(cur)
            cur = w_
    if cur:
        lines.append(cur)
    return lines


eyebrow = ImageFont.truetype(POP_M, 44)
s = "Y O U R   V I S I O N   B O A R D   I S"
lw = d.textlength(s, font=eyebrow)
d.text(((W - lw) / 2, 742), s, font=eyebrow, fill=MUTE + (240,), anchor="lm")

# 100px, measured, not guessed: at 118 the line breaks three ways and leaves
# "life." stranded on its own — which is the word the whole cover turns on.
big = ImageFont.truetype(LORA, 100)
lines = wrap("40 photos of someone else's life.", big, W - 180)
top = 1000 - (len(lines) - 1) * 124 / 2
for j, ln in enumerate(lines):
    lw = d.textlength(ln, font=big)
    d.text(((W - lw) / 2, top + j * 124), ln, font=big, fill=CREAM + (255,), anchor="lm")

rule_y = int(top + (len(lines) - 1) * 124) + 108
d.rounded_rectangle([W / 2 - 74, rule_y, W / 2 + 74, rule_y + 5], radius=3,
                    fill=ROSE + (210,))

sub = ImageFont.truetype(POP_M, 50)
s2 = "The two-minute version"
lw = d.textlength(s2, font=sub)
d.text(((W - lw) / 2, rule_y + 86), s2, font=sub, fill=ROSE + (245,), anchor="lm")

# grain, gently
g = np.asarray(img).astype(np.float32)
g += np.random.default_rng(1).normal(0, 3.2, g.shape)
Image.fromarray(np.clip(g, 0, 255).astype(np.uint8)).save(
    "ManifestAI_Day05_Cover.jpg", quality=95
)
print("cover done, rule at", rule_y)

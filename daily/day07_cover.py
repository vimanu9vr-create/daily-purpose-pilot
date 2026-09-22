"""Day 07 cover — dark, alternating against Day 06's light one."""

import numpy as np
from PIL import Image, ImageDraw, ImageFont

W, H = 1080, 1920
CREAM = (247, 233, 236)
ROSE = (214, 150, 164)
PLUM = (16, 8, 12)

GF = "/usr/share/fonts/truetype/google-fonts/"
POP_B = GF + "Poppins-Bold.ttf"
POP_M = GF + "Poppins-Medium.ttf"

yy = np.linspace(0, 1, H)[:, None]
xx = np.linspace(0, 1, W)[None, :]
base = np.zeros((H, W, 3), np.float32)
for i, c in enumerate(PLUM):
    base[..., i] = c
d_ = np.sqrt((xx - 0.5) ** 2 + (yy - 0.40) ** 2)
g = np.clip(1 - d_ / 0.90, 0, 1) ** 1.6 * 0.40
for i, c in enumerate((116, 52, 68)):
    base[..., i] = base[..., i] * (1 - g) + c * g
vd = np.sqrt((xx - 0.5) ** 2 + (yy - 0.5) ** 2)
base *= (1 - np.clip((vd - 0.34) / 0.66, 0, 1) ** 1.4 * 0.60)[..., None]

img = Image.fromarray(np.clip(base, 0, 255).astype(np.uint8))
d = ImageDraw.Draw(img, "RGBA")

# the book, landed
y = 470
d.rounded_rectangle([140, y, W - 140, y + 430], radius=16, fill=(82, 36, 48, 255))
d.rounded_rectangle([140, y, W - 140, y + 430], radius=16,
                    outline=(126, 62, 78, 255), width=3)
d.rounded_rectangle([166, y + 338, W - 166, y + 412], radius=8,
                    fill=(238, 226, 214, 255))
for i in range(1, 5):
    yy_ = y + 338 + i * 15
    d.rounded_rectangle([166, yy_, W - 166, yy_ + 2], radius=1,
                        fill=(196, 178, 168, 255))
d.rounded_rectangle([140, y, W - 140, y + 22], radius=10, fill=(118, 56, 72, 255))


def wrap_fit(text, path, size, maxw):
    while size > 40:
        f = ImageFont.truetype(path, size)
        if all(d.textlength(ln, font=f) <= maxw for ln in text.split("\n")):
            return f, size
        size -= 2
    return ImageFont.truetype(path, 40), 40


# Line centres at 1000/1120/1240, rule at 1320, strapline at 1392.
# They were 1090/1210/1330 with the rule also at 1330 — so the divider drew
# straight through "bank account." Positions are derived from the block now
# rather than typed independently.
HEADLINE = "Visualizing money\nwon't fix your\nbank account."
TOP, GAP = 1000, 120
big, _ = wrap_fit(HEADLINE, POP_B, 96, W - 170)
for j, ln in enumerate(HEADLINE.split("\n")):
    lw = d.textlength(ln, font=big)
    d.text(((W - lw) / 2, TOP + j * GAP), ln, font=big, fill=CREAM + (255,),
           anchor="lm")

rule_y = TOP + (len(HEADLINE.split("\n")) - 1) * GAP + 80
d.rounded_rectangle([W / 2 - 74, rule_y, W / 2 + 74, rule_y + 5], radius=3,
                    fill=ROSE + (210,))

sub = ImageFont.truetype(POP_M, 50)
s = "The honest mechanism"
lw = d.textlength(s, font=sub)
d.text(((W - lw) / 2, rule_y + 72), s, font=sub, fill=ROSE + (245,), anchor="lm")
assert rule_y + 72 < 1500, "strapline must survive the square grid crop"

g2 = np.asarray(img).astype(np.float32)
g2 += np.random.default_rng(7).normal(0, 3.0, g2.shape)
Image.fromarray(np.clip(g2, 0, 255).astype(np.uint8)).save(
    "ManifestAI_Day07_Cover.jpg", quality=95
)
print("cover ok")

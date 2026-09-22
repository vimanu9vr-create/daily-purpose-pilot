"""Day 07 cover — dark, calm, alternating against Day 06's light one.

Dark for grid rhythm, but warm rather than hard: deep plum with lamp light,
cream serif, ruled lines. It has to look like the same product the video is
for, which the first version of this cover did not.
"""

import numpy as np
from PIL import Image, ImageDraw, ImageFont

W, H = 1080, 1920
CREAM = (247, 233, 236)
ROSE = (214, 150, 164)
PLUM = (26, 14, 20)

GF = "/usr/share/fonts/truetype/google-fonts/"
LORA = GF + "Lora-Variable.ttf"
POP_L = GF + "Poppins-Light.ttf"

yy = np.linspace(0, 1, H)[:, None]
xx = np.linspace(0, 1, W)[None, :]
base = np.zeros((H, W, 3), np.float32)
for i, c in enumerate(PLUM):
    base[..., i] = c

ld = np.sqrt((xx - 0.72) ** 2 + (yy - 0.80) ** 2)
lamp = np.clip(1 - ld / 1.00, 0, 1) ** 1.5 * 0.46
for i, c in enumerate((168, 96, 92)):
    base[..., i] = base[..., i] * (1 - lamp) + c * lamp

wd = np.sqrt((xx - 0.22) ** 2 + (yy - 0.12) ** 2)
win = np.clip(1 - wd / 0.82, 0, 1) ** 1.8 * 0.18
for i, c in enumerate((122, 132, 164)):
    base[..., i] = base[..., i] * (1 - win) + c * win

vd = np.sqrt((xx - 0.5) ** 2 + (yy - 0.5) ** 2)
base *= (1 - np.clip((vd - 0.36) / 0.64, 0, 1) ** 1.4 * 0.52)[..., None]

img = Image.fromarray(np.clip(base, 0, 255).astype(np.uint8))
d = ImageDraw.Draw(img, "RGBA")

HEAD = '"I want more money"\nis not a goal.'
TOP, GAP = 900, 128
f = ImageFont.truetype(LORA, 104)
while any(d.textlength(ln, font=f) > W - 170 for ln in HEAD.split("\n")):
    f = ImageFont.truetype(LORA, f.size - 2)
for j, ln in enumerate(HEAD.split("\n")):
    lw = d.textlength(ln, font=f)
    d.text(((W - lw) / 2, TOP + j * GAP), ln, font=f, fill=CREAM + (255,), anchor="lm")

rule_y = TOP + GAP + 96
d.rounded_rectangle([W / 2 - 74, rule_y, W / 2 + 74, rule_y + 5], radius=3,
                    fill=ROSE + (200,))

sub = ImageFont.truetype(POP_L, 52)
s = "Here's what it looks like once it is"
lw = d.textlength(s, font=sub)
d.text(((W - lw) / 2, rule_y + 78), s, font=sub, fill=ROSE + (232,), anchor="lm")
assert rule_y + 78 < 1500, "strapline must survive the square grid crop"

# ruled lines below, faint — the page
for y in range(rule_y + 158, 1780, 92):
    d.rounded_rectangle([190, y, W - 190, y + 3], radius=2, fill=(190, 150, 152, 46))

g = np.asarray(img).astype(np.float32)
g += np.random.default_rng(17).normal(0, 2.6, g.shape)
Image.fromarray(np.clip(g, 0, 255).astype(np.uint8)).save(
    "ManifestAI_Day07_Cover.jpg", quality=95
)
print("cover ok, rule at", rule_y)

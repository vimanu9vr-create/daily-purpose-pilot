"""Day 12 cover — light, alternating against Day 11's dark one.

The grid reads as a column of thumbnails before it reads as anything else, so
the covers alternate light and dark deliberately. Day 11 was plum; this one is
cream, and the next should be dark again.

The headline is the command rather than the explanation. A thumbnail gets
about as long as a hook does, and "Stop saying 'I am abundant.'" is the only
line in this video that works with no context at all — which is the test a
cover has to pass, because nobody arrives at a cover having seen the others.

The strapline carries the reason, where a thumbnail reader who got as far as
the second line will actually finish it.
"""
import numpy as np
from PIL import Image, ImageDraw, ImageFont

W, H = 1080, 1920
CREAM = (247, 233, 236); ROSE = (190, 120, 136); INK = (58, 22, 32)
GF = "/usr/share/fonts/truetype/google-fonts/"
LORA = GF + "Lora-Variable.ttf"; LORA_I = GF + "Lora-Italic-Variable.ttf"

yy = np.linspace(0, 1, H)[:, None]; xx = np.linspace(0, 1, W)[None, :]
base = np.zeros((H, W, 3), np.float32)
for i, c in enumerate(CREAM): base[..., i] = c

# Warm lamp low and right, as in the video's resolved half. On a light ground
# it has to be gentler than the dark covers or it reads as a stain.
ld = np.sqrt((xx - 0.72) ** 2 + (yy - 0.80) ** 2)
lamp = np.clip(1 - ld / 1.02, 0, 1) ** 1.5 * 0.40
for i, c in enumerate((252, 228, 212)): base[..., i] = base[..., i] * (1 - lamp) + c * lamp

# Cold window high and left. The tension between the two is the whole look.
wd = np.sqrt((xx - 0.22) ** 2 + (yy - 0.10) ** 2)
win = np.clip(1 - wd / 0.86, 0, 1) ** 1.8 * 0.20
for i, c in enumerate((214, 216, 232)): base[..., i] = base[..., i] * (1 - win) + c * win

vd = np.sqrt((xx - 0.5) ** 2 + (yy - 0.5) ** 2)
base *= (1 - np.clip((vd - 0.38) / 0.62, 0, 1) ** 1.4 * 0.20)[..., None]

img = Image.fromarray(np.clip(base, 0, 255).astype(np.uint8))
d = ImageDraw.Draw(img, "RGBA")

HEAD = "Stop saying\n“I am abundant.”"
TOP, GAP = 880, 142
f = ImageFont.truetype(LORA, 110)
while any(d.textlength(l, font=f) > W - 170 for l in HEAD.split("\n")):
    f = ImageFont.truetype(LORA, f.size - 2)
for j, l in enumerate(HEAD.split("\n")):
    lw = d.textlength(l, font=f)
    d.text(((W - lw) / 2, TOP + j * GAP), l, font=f, fill=INK + (255,), anchor="lm")

ry = TOP + GAP + 100
d.rounded_rectangle([W / 2 - 74, ry, W / 2 + 74, ry + 5], radius=3, fill=ROSE + (210,))

sub = ImageFont.truetype(LORA_I, 56)
s = "some part of you knows it isn't true yet"
f2 = sub
while d.textlength(s, font=f2) > W - 200:
    f2 = ImageFont.truetype(LORA_I, f2.size - 2)
lw = d.textlength(s, font=f2)
d.text(((W - lw) / 2, ry + 82), s, font=f2, fill=ROSE + (240,), anchor="lm")
assert ry + 82 < 1500, "strapline must survive the square crop"

for y in range(ry + 166, 1790, 94):
    d.rounded_rectangle([190, y, W - 190, y + 3], radius=2, fill=(196, 160, 166, 52))

g = np.asarray(img).astype(np.float32)
g += np.random.default_rng(12).normal(0, 2.6, g.shape)
Image.fromarray(np.clip(g, 0, 255).astype(np.uint8)).save(
    "ManifestAI_Day12_Cover.jpg", quality=95)
print("cover ok, rule at", ry, "head size", f.size)

"""Day 06 cover — light, alternating against Day 05's dark one.

The video itself opens dark, so the cover inverts it: same mirror image, cream
ground. That keeps the grid rhythm and still shows the hook, which is what
makes a tile worth tapping.
"""

import numpy as np
from PIL import Image, ImageDraw, ImageFont

W, H = 1080, 1920
CREAM = (247, 233, 236)
ROSE = (214, 150, 164)
BURG = (92, 31, 46)
PLUM = (24, 12, 17)

GF = "/usr/share/fonts/truetype/google-fonts/"
LORA_I = GF + "Lora-Italic-Variable.ttf"
POP_B = GF + "Poppins-Bold.ttf"

yy = np.linspace(0, 1, H)[:, None]
xx = np.linspace(0, 1, W)[None, :]
base = np.zeros((H, W, 3), np.float32)
for i, c in enumerate(CREAM):
    base[..., i] = c

d_ = np.sqrt((xx - 0.5) ** 2 + (yy - 0.66) ** 2)
g = np.clip(1 - d_ / 0.98, 0, 1) ** 1.5 * 0.34
for i, c in enumerate((255, 222, 204)):
    base[..., i] = base[..., i] * (1 - g) + c * g

vd = np.sqrt((xx - 0.5) ** 2 + (yy - 0.5) ** 2)
base *= (1 - np.clip((vd - 0.36) / 0.66, 0, 1) ** 1.4 * 0.30)[..., None]

img = Image.fromarray(np.clip(base, 0, 255).astype(np.uint8))
d = ImageDraw.Draw(img, "RGBA")

# the claim, and its reflection
fnt = ImageFont.truetype(LORA_I, 96)
s = '"I am a millionaire"'
lw = d.textlength(s, font=fnt)
d.text(((W - lw) / 2, 748), s, font=fnt, fill=PLUM + (255,), anchor="lm")
d.rounded_rectangle([210, 822, W - 210, 827], radius=3, fill=ROSE + (200,))

refl = Image.new("RGBA", (W, 160), (0, 0, 0, 0))
ImageDraw.Draw(refl).text(((W - lw) / 2, 64), s, font=fnt,
                          fill=PLUM + (74,), anchor="lm")
refl = refl.transpose(Image.FLIP_TOP_BOTTOM)
img.paste(refl, (0, 850), refl)
d = ImageDraw.Draw(img, "RGBA")

big = ImageFont.truetype(POP_B, 104)
for j, ln in enumerate(["MAKES YOU", "LOOK STUPID."]):
    lw = d.textlength(ln, font=big)
    assert lw <= W - 160, (ln, lw)
    d.text(((W - lw) / 2, 1120 + j * 128), ln, font=big, fill=BURG + (255,),
           anchor="lm")

g2 = np.asarray(img).astype(np.float32)
g2 += np.random.default_rng(6).normal(0, 3.0, g2.shape)
Image.fromarray(np.clip(g2, 0, 255).astype(np.uint8)).save(
    "ManifestAI_Day06_Cover.jpg", quality=95
)
print("cover ok")

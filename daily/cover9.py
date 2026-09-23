"""Day 09 cover — dark, alternating against Day 08's light one."""
import numpy as np
from PIL import Image, ImageDraw, ImageFont
W,H=1080,1920
CREAM=(247,233,236); ROSE=(214,150,164); PLUM=(26,14,20)
GF="/usr/share/fonts/truetype/google-fonts/"
LORA=GF+"Lora-Variable.ttf"; LORA_I=GF+"Lora-Italic-Variable.ttf"
yy=np.linspace(0,1,H)[:,None]; xx=np.linspace(0,1,W)[None,:]
base=np.zeros((H,W,3),np.float32)
for i,c in enumerate(PLUM): base[...,i]=c
ld=np.sqrt((xx-0.72)**2+(yy-0.80)**2); lamp=np.clip(1-ld/1.00,0,1)**1.5*0.46
for i,c in enumerate((170,98,94)): base[...,i]=base[...,i]*(1-lamp)+c*lamp
wd=np.sqrt((xx-0.22)**2+(yy-0.12)**2); win=np.clip(1-wd/0.82,0,1)**1.8*0.18
for i,c in enumerate((122,132,164)): base[...,i]=base[...,i]*(1-win)+c*win
vd=np.sqrt((xx-0.5)**2+(yy-0.5)**2)
base*=(1-np.clip((vd-0.36)/0.64,0,1)**1.4*0.52)[...,None]
img=Image.fromarray(np.clip(base,0,255).astype(np.uint8)); d=ImageDraw.Draw(img,"RGBA")
HEAD="Manifesting\ndoesn't work."; TOP,GAP=900,140
f=ImageFont.truetype(LORA,118)
while any(d.textlength(l,font=f)>W-170 for l in HEAD.split("\n")): f=ImageFont.truetype(LORA,f.size-2)
for j,l in enumerate(HEAD.split("\n")):
    lw=d.textlength(l,font=f); d.text(((W-lw)/2,TOP+j*GAP),l,font=f,fill=CREAM+(255,),anchor="lm")
ry=TOP+GAP+100
d.rounded_rectangle([W/2-74,ry,W/2+74,ry+5],radius=3,fill=ROSE+(200,))
sub=ImageFont.truetype(LORA_I,60); s="and it was never your fault"
lw=d.textlength(s,font=sub); d.text(((W-lw)/2,ry+82),s,font=sub,fill=ROSE+(238,),anchor="lm")
assert ry+82<1500, "strapline must survive the square crop"
for y in range(ry+166,1790,94):
    d.rounded_rectangle([190,y,W-190,y+3],radius=2,fill=(190,150,152,44))
g=np.asarray(img).astype(np.float32); g+=np.random.default_rng(9).normal(0,2.6,g.shape)
Image.fromarray(np.clip(g,0,255).astype(np.uint8)).save("ManifestAI_Day09_Cover.jpg",quality=95)
print("cover ok")

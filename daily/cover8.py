"""Day 08 cover — light, alternating against Day 07's dark one."""
import numpy as np
from PIL import Image, ImageDraw, ImageFont
W,H=1080,1920
CREAM=(247,233,236); ROSE=(214,150,164); BURG=(92,31,46); INK=(58,22,32); BLUSH=(250,240,240)
GF="/usr/share/fonts/truetype/google-fonts/"
LORA=GF+"Lora-Variable.ttf"; LORA_I=GF+"Lora-Italic-Variable.ttf"; POP_L=GF+"Poppins-Light.ttf"
yy=np.linspace(0,1,H)[:,None]; xx=np.linspace(0,1,W)[None,:]
base=np.zeros((H,W,3),np.float32)
for i,c in enumerate(CREAM): base[...,i]=c
ld=np.sqrt((xx-0.76)**2+(yy-0.82)**2); lamp=np.clip(1-ld/1.02,0,1)**1.5*0.44
for i,c in enumerate((255,224,203)): base[...,i]=base[...,i]*(1-lamp)+c*lamp
wd=np.sqrt((xx-0.20)**2+(yy-0.10)**2); win=np.clip(1-wd/0.86,0,1)**1.7*0.20
for i,c in enumerate((206,214,232)): base[...,i]=base[...,i]*(1-win)+c*win
band=np.exp(-(((yy-0.50)/0.20)**2))*0.50
for i,c in enumerate(BLUSH): base[...,i]=base[...,i]*(1-band)+c*band
vd=np.sqrt((xx-0.5)**2+(yy-0.5)**2)
base*=(1-np.clip((vd-0.38)/0.62,0,1)**1.5*0.34)[...,None]
img=Image.fromarray(np.clip(base,0,255).astype(np.uint8)); d=ImageDraw.Draw(img,"RGBA")
HEAD="Can you manifest\nmillions?"; TOP,GAP=880,132
f=ImageFont.truetype(LORA,112)
while any(d.textlength(l,font=f)>W-170 for l in HEAD.split("\n")): f=ImageFont.truetype(LORA,f.size-2)
for j,l in enumerate(HEAD.split("\n")):
    lw=d.textlength(l,font=f); d.text(((W-lw)/2,TOP+j*GAP),l,font=f,fill=INK+(255,),anchor="lm")
ry=TOP+GAP+92
d.rounded_rectangle([W/2-74,ry,W/2+74,ry+5],radius=3,fill=ROSE+(210,))
sub=ImageFont.truetype(LORA_I,62); s="Not the way you were told."
lw=d.textlength(s,font=sub); d.text(((W-lw)/2,ry+84),s,font=sub,fill=BURG+(242,),anchor="lm")
assert ry+84<1500
for y in range(ry+170,1790,94):
    d.rounded_rectangle([190,y,W-190,y+3],radius=2,fill=(184,150,160,56))
g=np.asarray(img).astype(np.float32); g+=np.random.default_rng(8).normal(0,2.6,g.shape)
Image.fromarray(np.clip(g,0,255).astype(np.uint8)).save("ManifestAI_Day08_Cover.jpg",quality=95)
print("cover ok")

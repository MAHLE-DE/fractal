"""Monta comparações a partir das capturas, sem modificar os originais."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
root=Path(__file__).resolve().parents[1]
media=root/'docs/media'; review=media/'review'
try: font=ImageFont.truetype('arial.ttf',24)
except OSError: font=ImageFont.load_default(size=24)
def compare(first,second,labels,target):
    out=Image.new('RGB',(3200,1048),'#0b1220'); draw=ImageDraw.Draw(out)
    for x,(image,label) in enumerate(zip((first,second),labels)):
        out.paste(Image.open(image).convert('RGB').resize((1600,1000)),(x*1600,48))
        draw.text((x*1600+30,12),label,font=font,fill='#d6e7ff')
    out.save(target)
compare(media/'ref-atlas-feixes.png',review/'01-overview.png',('Atlas — referência Feixes','Standards Cascade — 595 normas / 943 fibras'),review/'01-compare.png')
compare(review/'before.png',review/'01-overview.png',('T18 — Bézier única de grau 6, raiz forçada','T19 — spline cúbica, caminho pelo ancestral comum'),review/'13-cut-paths-before-after.png')

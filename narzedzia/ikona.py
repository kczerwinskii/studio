# Generuje ikona.ico: grafitowy kwadrat z mosiężnym obrysem i literą S w Poppins Bold.
from PIL import Image, ImageDraw, ImageFont
import os
KAT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONT = os.path.join(KAT, "app", "fonty", "Poppins-Bold.ttf")
def rysuj(n):
    s = 8
    im = Image.new("RGBA", (n*s, n*s), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    r = n*s//5
    d.rounded_rectangle([0, 0, n*s-1, n*s-1], radius=r, fill=(14, 14, 18, 255), outline=(201, 164, 85, 255), width=max(1, n*s//22))
    f = ImageFont.truetype(FONT, int(n*s*0.62))
    bbox = d.textbbox((0, 0), "S", font=f)
    w, h = bbox[2]-bbox[0], bbox[3]-bbox[1]
    d.text(((n*s-w)/2-bbox[0], (n*s-h)/2-bbox[1]), "S", font=f, fill=(239, 233, 218, 255))
    return im.resize((n, n), Image.LANCZOS)
rozmiary = [16, 24, 32, 48, 64, 128, 256]
obrazy = [rysuj(n) for n in rozmiary]
obrazy[-1].save(os.path.join(KAT, "ikona.ico"), format="ICO", sizes=[(n, n) for n in rozmiary], append_images=obrazy[:-1])
obrazy[-1].save(os.path.join(KAT, "app", "ikona.png"))
print("ikona.ico gotowa")

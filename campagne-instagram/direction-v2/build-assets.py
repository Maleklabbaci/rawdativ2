from pathlib import Path
from PIL import Image, ImageFilter

UP = Path('/tmp/arena-coding-uploads')
A = Path(__file__).parent / 'assets'
A.mkdir(exist_ok=True)

SRC = {
    'presences': '10 AM (4)', 'activites': '07 AM', 'enfants': '10 AM (3)',
    'factures': '10 AM (2)', 'equipe': '10 AM', 'achats': '10 AM (1)',
    'rapports': '09 AM (1)', 'communication': '09 AM', 'guide': '08 AM',
    'accueil': '11 AM (1)',
}
CRECHE = (300, 66, 440, 134)
ENFANT = (296, 470, 486, 562)
CROP_X = 24

# TALL 464x470 (ratio 0.987) ; WIDE 464x210 (ratio 2.21) — affichés sans déformation
TALL_H = 560
SQ = 456
PW, PH = 420, 560  # crop portrait : ratio du cadre C (0.75)
QW, QH = 374, 938  # crop écran : ratio du cadre C snap (0.3987)
WIDE_H = 213

TALLS = {
    't01': ('presences', 226), 't02': ('activites', 170), 't03': ('enfants', 196),
    't04': ('factures', 196), 't05': ('equipe', 150), 't06': ('achats', 250),
    't07': ('rapports', 300), 't08': ('communication', 250), 't09': ('guide', 280),
    't10': ('accueil', 340),
}
SQUARES = {
    's01': ('presences', 236), 's02': ('activites', 236), 's03': ('enfants', 250),
    's04': ('factures', 300), 's04b': ('factures', 250), 's05': ('equipe', 180), 's06': ('achats', 300), 's06b': ('achats', 250),
    's07': ('rapports', 360), 's08': ('communication', 300), 's08b': ('communication', 380), 's09': ('guide', 330),
    's10': ('accueil', 420), 's10b': ('accueil', 470),
}

PORTRAITS = {
    'v01': ('presences', 236), 'v02': ('activites', 200), 'v03': ('enfants', 250),
    'v04': ('factures', 300), 'v05': ('equipe', 180), 'v06': ('achats', 300),
    'v07': ('rapports', 340), 'v08': ('communication', 300), 'v09': ('guide', 320),
    'v10': ('accueil', 400),
}

WIDES = {
    'w01': ('presences', 470), 'w02': ('activites', 306), 'w03': ('enfants', 470),
    'w04': ('factures', 590), 'w05': ('equipe', 470), 'w06': ('achats', 480),
    'w07': ('rapports', 640), 'w08': ('communication', 420), 'w09': ('guide', 500),
    'w10': ('accueil', 700),
}


def raw(name):
    f = UP / ('WhatsApp Image 2026-11-15 at 5.01.%s.jpeg' % SRC[name])
    im = Image.open(f).convert('RGB').crop((0, 0, 498, 938))
    im.paste(im.crop(CRECHE).filter(ImageFilter.GaussianBlur(15)), CRECHE)
    if name == 'enfants':
        im.paste(im.crop(ENFANT).filter(ImageFilter.GaussianBlur(18)), ENFANT)
    return im


if __name__ == '__main__':
    for n in SRC:
        raw(n).crop((CROP_X, 0, CROP_X + 449, 938)).save(A / ('screen-%s.jpg' % n), quality=96)
    for slug, (src, y) in TALLS.items():
        raw(src).crop((17, y, 17 + 464, y + TALL_H)).save(A / (slug + '.jpg'), quality=96)
    for slug, (src, y) in WIDES.items():
        raw(src).crop((17, y, 17 + 464, y + WIDE_H)).save(A / (slug + '.jpg'), quality=96)
    for slug, src in SRC.items():
        raw(slug).crop((CROP_X + 37, 0, CROP_X + 37 + QW, QH)).save(A / ('q-%s.jpg' % slug), quality=96)
    for slug, (src, y) in PORTRAITS.items():
        raw(src).crop((24, y, 24 + PW, y + PH)).save(A / (slug + '.jpg'), quality=96)
    for slug, (src, y) in SQUARES.items():
        raw(src).crop((17, y, 17 + SQ, y + SQ)).save(A / (slug + '.jpg'), quality=96)
    print('ok', len(TALLS), len(WIDES), len(SQUARES))

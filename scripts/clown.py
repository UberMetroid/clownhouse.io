#!/usr/bin/env python3
"""clownhouse // pixel clown generator.

Draws the background clown face on a 46x64 grid and writes clown.png.
Palette is site-matched: violet hair, phosphor-tinged pale face, red
nose/mouth. Re-run to regenerate; the PNG is the committed artifact.
"""
from PIL import Image


PAL = {
    " ": None,                # transparent
    "h": (58, 16, 46),        # hair deep
    "H": (122, 26, 78),       # hair lit
    "f": (212, 200, 228),     # face lit
    "F": (150, 138, 178),     # face mid
    "s": (96, 84, 128),       # face shade
    "e": (14, 8, 24),         # eye socket
    "g": (255, 45, 85),       # eye glow (red)
    "G": (183, 140, 255),     # eye glow (violet)
    "n": (212, 38, 74),       # nose
    "m": (40, 8, 24),         # mouth dark
    "t": (240, 232, 248),     # teeth
    "r": (90, 58, 138),       # ruffle
    "R": (140, 96, 200),      # ruffle lit
    "d": (70, 14, 40),        # deep accent / smile line
}

GRID = [
    # yapf: disable
    "    hHh        hHH            HHh        hHh    ",
    "  hHH  Hh   hHH  hHHH    HHHh  HHh   hH  HHh  ",
    " hHh    hHHh        hHHHHh        hHHh    hHh ",
    "hHh   hHh              hh              hHh  hHh",
    "Hh    hH        ff            ff        Hh   hH",
    "Hh   hH      fffffFFF       fffffFFF      Hh  hH",
    "hH   h      fffffffffFF   fffffffffFF      h  Hh ",
    "hH  hH     ffffffffffffF fffffffffffff    Hh hH",
    "hH  h      fffffffffffffffffffffffffffF    h hH",
    " hH h      ffffffffffffffffffffffffffffF   hHh ",
    " hHh       fffffffffffffffffffffffffffff    hH  ",
    "  hH      ffffffffffffffffffffffffffffffF  hH   ",
    "  hH      fffff  ffff   fffffffff  ffff   hH    ",
    "   h      ffff  eeeeee   ffffff  eeeeee    h    ",
    "   hH    fff  eeeeeeee   fffff  eeeeeeee   hH   ",
    "    h    fff  eegeegee    ffff  eGegeeGe    h    ",
    "    h    fff  eeeeeeee    fff  eeeeeeee    h    ",
    "    h     ff   eeeeee     fff   eeeeee    hH    ",
    "   ffF             ff          fF            fffF  ",
    "   ffF            fff           ff           fffF  ",
    "    fF           ffff            ff          fF    ",
    "    fF          fffss             ff         fF    ",
    "    fF         fffsss             fff        fF    ",
    "     F        fffssss              fff      fF     ",
    "     F       fffsssss               fff    fF      ",
    "     F      fffssssss         nn     fff  fF       ",
    "     F     fffsssssss        nnnn     fff F        ",
    "      F   fffssssssss        nnnn       fF         ",
    "      F  fffsssssssss         nn         F         ",
    "      F fffssssssssss                    F         ",
    "       Fffsssssssssss                   fF         ",
    "       Ffssssssssssss  dd          dd   F          ",
    "       Fssssssssssss    dd        dd    F          ",
    "       ssssssssssss       dd    dd      s          ",
    "       sssssssssss   dd    dddddd    dd s          ",
    "       sssssssss   dd dddd      dddd dd s          ",
    "        ssssss   dd dmttttttttttttttmdd            ",
    "        sssss    d mmmmmmmmmmmmmmmmmmd             ",
    "        ssss   dd  mmmmttttttttttmmmm  dd          ",
    "        sss    d    mmmmmmmmmmmmmm      d          ",
    "         ss   d      mmmmmmmmmmmm        d         ",
    "         s   dd        mmmmmmmm          dd        ",
    "             d          mmmm              d        ",
    "            d                              d       ",
    "            dd                            d        ",
    "             d                          dd         ",
    "              ddd                    ddd           ",
    "                 dddd            dddd              ",
    "        rRr          dddddddddddd         rRr      ",
    "      rRrRrRr                          rRrRrRr     ",
    "    rRr  rRrRrRr                rrRrRr  rRr        ",
    "   Rr   rRr   rRrRr        rRrRr   rRr   rR        ",
    "  rRr  rR      rRrRrRrrrrRrRrRr      Rr  rRr       ",
    " rRr  rR         rRrRr  RrRr         Rr   rRr      ",
    "rRr  rR           rRr    Rr           Rr   rRr     ",
    "Rr  rR             r      r            Rr   rR     ",
    "   rR                                   Rr        ",
    "  rR                                     Rr       ",
    " rR                                       Rr      ",
    "                                              ",
    "                                              ",
    # yapf: enable
]

W = max(len(r) for r in GRID)
H = len(GRID)
img = Image.new("RGBA", (W, H))
px = img.load()
for y, row in enumerate(GRID):
    for x, ch in enumerate(row.ljust(W)):
        c = PAL[ch]
        if c:
            px[x, y] = (*c, 255)

img.save("clown.png")
print("wrote clown.png", img.size)
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
    "D": (44, 10, 30),        # dress deep
    "q": (96, 24, 58),        # dress lit edge
}

GRID = [
    # yapf: disable
    "    hHh        hHH            HHh        hHh    ",
    "  hHH  Hh   hHH  hHHH    HHHh  HHh   hH  HHh  ",
    " hHh    hHHh        hHHHHh        hHHh    hHh ",
    "hHh   hHh              hh              hHh  hHh",
    "Hh    hH                             Hh   hH",
    "Hh   hH      ffffff        ffffff       Hh  hH",
    "hH   h      fffffffFF    fffffffff       h  Hh ",
    "hH  hH     fffffffffffF fffffffffffF    Hh hH",
    "hH  h      ffffffffffffffffffffffffF     h hH",
    " hH h      fffffffffffffffffffffffffF    hHh ",
    " hHh       fffffffffffffffffffffffffff   hH   ",
    "  hH      fffffffffffffffffffffffffffF   hH   ",
    "  hH      ffffffffffffffffffffffffffffF  hH   ",
    "   h      fffffff  fff      fff  ffffff  h    ",
    "   h      ffffff          f      ffffff   h    ",
    "   hH     fffff                ffffff    hH   ",
    "    h     fffff                  fffff   h    ",
    "    h     fffff                  fffff   h    ",
    "    h    fff   eeeeee   ffff   eeeeee   fffh   ",
    "    h    ff   eeeeeeee   fff  eeeeeeee  ff h   ",
    "    h    ff   eeeeeeee   fff  eeeeeeee  ff h   ",
    "    h    ff   eeeeeeee   ff   eeeeeeee  ff h   ",
    "    h    fff   eeeeee    ff    eeeeee  fffhH   ",
    "    h    fff             fff           fffh    ",
    "    h    fff            fffff          fff     ",
    "     F   fff            fffff          fffF    ",
    "     F   fff           ffffss          fffF    ",
    "     F   fff           fffsss          fff F   ",
    "     F    ff          fffssss          ff  F   ",
    "     F    ff         fffsssss   nn    ff   F   ",
    "     F    fff        fffssssss nnnn   fff  F   ",
    "      F   fff        fssssssss nnnn   fff F    ",
    "      F   fff       fsssssssss  nn    ff F     ",
    "      F    ff      fssssssssss        fF       ",
    "      F    fff    fsssssssssss       fF        ",
    "       F   fff   fssssssssssss dd    dd F      ",
    "       F    ff  fssssssssss    dd    dd F      ",
    "        F   ff fsssssssss   dd   dd   dd F     ",
    "        F    ffssssssss  dd  dddddd  dd  F     ",
    "         F  fsssssss  dd ddd      ddd dd F     ",
    "         F  fssss   dd mtttttttttttttm dd F    ",
    "          F fss    d mmmmmmmmmmmmmmmmmd  F     ",
    "          F fs   dd  mmmttttttttttmmm   ddF    ",
    "           F s   d    mmmmmmmmmmmmmm    dF     ",
    "           F    d      mmmmmmmmmm      dF      ",
    "            F dd         mmmmmm       dd       ",
    "             d                        d        ",
    "             dd                      dd        ",
    "              d                     dd         ",
    "              ddd                 ddd          ",
    "                ddddd          ddddd           ",
    "        rRr         ddddddddddd         rRr    ",
    "      rRrRrRr                         rRrRrRr  ",
    "    rRr  rRrRrRr                rRrRr  rRr     ",
    "   Rr   rRr   rRrRr        rRrRr   rRr   rR    ",
    "  rRr  rR      rRrRrRrrrrRrRrRr      Rr  rRr   ",
    " rRr  rR         rRrRr  RrRr         Rr   rRr  ",
    "rRr  rR           rRr    Rr           Rr   rRr ",
    "Rr  rR             r      r            Rr   rR ",
    "   rR           ffs        sff          Rr     ",
    "  rR          fffsss      sssfff         Rr    ",
    "           fffffsss        sssfffff            ",
    "         fffffffsss         sssfffffff         ",
    "       fffffffffss           ssfffffffff       ",
    "      ffffffffffs              sffffffffff     ",
    "     ffffffffff                  ffffffffff    ",
    "    ffffffffff                    fffffffff    ",
    "   fffffffff                       fffffffff   ",
    "  qffffffff                         ffffffffq  ",
    " qqffffff   q                       q  fffffqq ",
    " qqffff   fqqf                     fqqf  fffqq ",
    "qqqff   ffqq ff                   ff qqff ffqqq",
    "qqq    ffq   fff                 fff   qff qqq ",
    "qq    ffq   fssff   d           ffssf   qff qq ",
    "qq   ffq   ffsssff  dd         ffsssff   qff qq",
    "q   ffq   ffsssssff ddd       ffsssssff   qff q",
    "q   fq   ffssssssff dd dd     ffssssssff   qf q",
    "qq  fq   ffssssssf ddd  ddd   fssssssff   qf qq",
    "qq qfq   fssssssf ddd    ddd   fssssssf   qfqqq",
    "qqqfq    fsssssf ddd      ddd   fsssssf    qfqq",
    "qqqq     fssssf ddd        ddd   fssssf    qqqq",
    "qqqq     fsssf ddd          ddd   fsssf    qqqq",
    "qqqqq    fsssf dd            dd   fsssf   qqqqq",
    "qqqqq    fsssf d              d   fsssf   qqqqq",
    "qqqqqq   fsssf d              d  fsssf   qqqqqq",
    "qqqqqq   fsssf dd            dd  fsssf   qqqqqq",
    "qqqqqq    fsssf ddd        ddd  fsssf   qqqqqq ",
    "qqqqqqq   fsssf  ddd      ddd  fsssf   qqqqqqq ",
    "qqqqqqq   fssssf  ddd    ddd  fssssf  qqqqqqq  ",
    "qqqqqqqq  fssssff  ddd  ddd  ffssssf qqqqqqqq  ",
    "qqqqqqqq   fssffff   dddd   ffffssf qqqqqqqq   ",
    "qqqqqqqqq  ffffffffffffffffffffff qqqqqqqqq    ",
    "qqqqqqqqq   ffffffffffffffffffff qqqqqqqqqq    ",
    "qqqqqqqqqq                      qqqqqqqqqq     ",
    "qqqqqqqqqq                      qqqqqqqqqq     ",
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
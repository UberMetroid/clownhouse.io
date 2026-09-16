#!/usr/bin/env python3
"""clownhouse // pixel house generator.

Draws the full-page background: a dark house silhouette -> house.png.
Re-run to regenerate; the PNG is the committed artifact.
"""
from PIL import Image

W, H = 96, 54   # 16:9 — stretched to fill the viewport

INK    = (16, 10, 28)    # house body
EDGE   = (36, 22, 56)    # lit wall edge
ROOF   = (10, 6, 18)
ROOF_E = (32, 18, 48)    # roof rim light
PANE   = (8, 5, 15)      # dark window glass
FRAME  = (48, 32, 70)    # window frame
DOOR   = (26, 9, 22)
GROUND = (12, 8, 22)

img = Image.new("RGBA", (W, H))
px = img.load()


def put(x, y, c):
    if 0 <= x < W and 0 <= y < H:
        px[x, y] = (*c, 255)


def rect(x0, y0, x1, y1, c):
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            put(x, y, c)


def peak(cx, ytop, ybase, half, c, edge=None):
    for y in range(ytop, ybase + 1):
        hw = round((y - ytop) * half / (ybase - ytop))
        for x in range(cx - hw, cx + hw + 1):
            put(x, y, c)
        if edge:
            put(cx - hw, y, edge)
            put(cx + hw, y, edge)


def window(cx, y0, y1, w=4):
    rect(cx - w // 2 - 1, y0 - 1, cx + w // 2 + 1, y1 + 1, FRAME)
    rect(cx - w // 2, y0, cx + w // 2, y1, PANE)


# --- house silhouette ---
rect(66, 12, 70, 24, INK)            # chimney
rect(65, 10, 71, 12, EDGE)
peak(49, 7, 25, 34, ROOF, ROOF_E)    # main gable roof
rect(22, 25, 78, 49, INK)            # main block
rect(22, 25, 22, 49, EDGE)
rect(78, 25, 78, 49, EDGE)
rect(80, 31, 89, 49, INK)            # right annex
peak(84, 27, 31, 7, ROOF, ROOF_E)
peak(14, 3, 15, 9, ROOF, ROOF_E)     # tower spire
rect(9, 15, 22, 49, INK)             # tower body
rect(9, 15, 9, 49, EDGE)
rect(22, 15, 22, 49, EDGE)

# dark windows
for cx in (32, 42, 58, 68):
    window(cx, 29, 35)
for cx in (32, 42, 60, 70):
    window(cx, 39, 46)
# door + steps
rect(46, 41, 52, 49, DOOR)
rect(45, 40, 53, 40, EDGE)
rect(44, 50, 54, 51, GROUND)

# ground
rect(0, 50, 95, 53, GROUND)

# tower + annex windows
window(16, 20, 30, 8)
window(84, 36, 43)

img.save("house.png")
print("wrote house.png", img.size)

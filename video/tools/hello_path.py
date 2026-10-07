"""Derive an ordered pen path along the centreline of the logo's handwritten "hello".

The path is used only as an animation guide: as a reveal mask for the write-on
(the logo pixels themselves are never redrawn) and as the route the orange
signal follows through the logo. Waypoints give the pen order; the exact route
between them is the skeleton of the real glyph strokes.
"""
import heapq
import json
import sys

import numpy as np
from PIL import Image
from scipy.ndimage import distance_transform_edt
from skimage.morphology import skeletonize

src, out = sys.argv[1], sys.argv[2]
im = Image.open(src)
W, H = 1600, round(im.height * 1600 / im.width)
mask = np.array(im.getchannel("A").resize((W, H), Image.BILINEAR)) > 127
sk = skeletonize(mask)
dt = distance_transform_edt(mask)

# Pen order, in 1600-wide skeleton coordinates.
WAYPOINTS = [
    (18, 233), (150, 206), (190, 170), (268, 22), (180, 100), (150, 205), (126, 306),  # lead-in, h loop, stem
    (150, 243), (232, 196), (242, 262), (285, 279),                                    # h hump, exit
    (292, 262), (342, 240), (372, 200), (350, 172), (311, 200), (293, 240),            # e: up-right, over, down
    (330, 299), (410, 262),                                                            # e exit
    (442, 220), (499, 140), (534, 60), (528, 22), (479, 60), (439, 140), (417, 220),  # first l loop
    (418, 262), (450, 295), (522, 258),
    (552, 220), (610, 140), (646, 60), (640, 22), (588, 60), (549, 140), (527, 220),  # second l loop
    (526, 258), (560, 296), (612, 268),
    (628, 208), (662, 192), (705, 232), (690, 292), (640, 300), (612, 262), (628, 208),  # o body
    (662, 192), (700, 178), (712, 232), (760, 250), (788, 228), (760, 216),            # o loop + tail curl
]

ys, xs = np.nonzero(sk)
pts = np.stack([xs, ys], 1)
idx = {(x, y): i for i, (x, y) in enumerate(pts)}
nbrs = [(-1, -1), (0, -1), (1, -1), (-1, 0), (1, 0), (-1, 1), (0, 1), (1, 1)]


def nearest(p):
    d = ((pts - np.array(p)) ** 2).sum(1)
    return tuple(pts[d.argmin()])


def shortest(a, b):
    dist = {a: 0.0}
    prev = {}
    pq = [(0.0, a)]
    while pq:
        d, u = heapq.heappop(pq)
        if u == b:
            break
        if d > dist[u]:
            continue
        for dx, dy in nbrs:
            v = (u[0] + dx, u[1] + dy)
            if v in idx:
                nd = d + (1.4142 if dx and dy else 1.0)
                if nd < dist.get(v, 1e18):
                    dist[v] = nd
                    prev[v] = u
                    heapq.heappush(pq, (nd, v))
    path = [b]
    while path[-1] != a:
        path.append(prev[path[-1]])
    return path[::-1]


route = []
for a, b in zip(WAYPOINTS, WAYPOINTS[1:]):
    seg = shortest(nearest(a), nearest(b))
    route.extend(seg if not route else seg[1:])
route = np.array(route, float)

# Light smoothing, then resample at uniform arc length.
k = 5
pad = np.pad(route, ((k, k), (0, 0)), mode="edge")
sm = np.stack([np.convolve(pad[:, i], np.ones(2 * k + 1) / (2 * k + 1), "valid") for i in range(2)], 1)
seg_len = np.hypot(*np.diff(sm, axis=0).T)
s = np.concatenate([[0], np.cumsum(seg_len)])
n = int(s[-1] / 4)
ss = np.linspace(0, s[-1], n)
rx = np.interp(ss, s, sm[:, 0])
ry = np.interp(ss, s, sm[:, 1])
rr = np.array([dt[min(H - 1, int(round(y))), min(W - 1, int(round(x)))] for x, y in zip(rx, ry)])
rr = np.maximum(rr, np.median(rr))

data = {
    "note": "Normalised to the cropped logo image (x/width, y/height). r = stroke half-width / width.",
    "points": [[round(x / W, 5), round(y / H, 5), round(r / W, 5)] for x, y, r in zip(rx, ry, rr)],
}
json.dump(data, open(out, "w"))
print("points", len(rx), "length px", round(s[-1]))

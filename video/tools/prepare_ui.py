"""Frame the supplied HelloMeta product screenshots as floating UI panels.

Nothing in the interface is redrawn or recoloured. Each panel is a crop of a
real screenshot at the exact bounds of one content card (which also keeps the
white-label header, footer and corner mascot out of frame). The only pixel
change is a soft blur over third-party prospect phone numbers, because the film
plays on a public exhibition screen; the business's own line and public
Google Places business listings are left as captured.

Usage: python prepare_ui.py <screenshot_dir> <out_dir>
"""
import json
import sys
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter

SRC = Path(sys.argv[1])
OUT = Path(sys.argv[2])
OUT.mkdir(parents=True, exist_ok=True)

P = "screencapture-app-hellometa-ai-mLLSv9tOZC-B0Z1lyDzDl3HiMztzby-4A-"
CARD_X = (260, 1820)  # every main content card spans this x range at 1920px
RADIUS = 28


def rows(top, height, count):
    return [[top + i * height, top + (i + 1) * height] for i in range(count)]


PANELS = {
    "calllogs": {
        "src": P + "call-logs-2026-10-06-07_35_30.png",
        "box": (CARD_X[0], 584, CARD_X[1], 2300),
        # Dialed numbers are prospects' numbers: keep the "+614" prefix legible, blur the rest.
        "redact": [(868, r[0] + 40, 968, r[1] - 40) for r in rows(892, 131, 10)],
        "rows": rows(892, 131, 10),
        "header": [802, 892],
    },
    "calllogs_filters": {
        "src": P + "call-logs-2026-10-06-07_35_30.png",
        "box": (CARD_X[0], 183, CARD_X[1], 564),
    },
    "calldetails": {
        "src": "Screenshot 2026-10-06 073706.png",
        "box": (1275, 0, 1917, 800),
        "regions": {
            "waveformCard": [1305, 186, 1880, 430],
            "waveform": [1335, 212, 1849, 294],
            "transcriptBox": [1305, 542, 1880, 800],
        },
        "lines": [[563, 589], [595, 621], [638, 664], [669, 695], [713, 739], [747, 773], [773, 799]],
    },
    "callqueues": {
        "src": P + "call-queues-2026-10-06-07_35_10.png",
        "box": (CARD_X[0], 607, CARD_X[1], 1966),
        "redact": [(1283, r[0] + 26, 1366, r[1] - 26) for r in rows(1063, 81, 10)],
        "rows": rows(1063, 81, 10),
        "header": [990, 1063],
    },
    "dashboard": {
        "src": P + "dashboard-2026-10-06-07_29_52.png",
        "box": (CARD_X[0], 183, CARD_X[1], 1238),
        "regions": {
            "overview": [260, 183, 722, 780],
            "charts": [742, 183, 1820, 1238],
            "chartMinutes": [800, 340, 1745, 650],
            "chartCalls": [800, 846, 1745, 1160],
            "statPhone": [290, 268, 690, 415],
            "statCalls": [290, 436, 690, 583],
            "statQueues": [290, 604, 690, 750],
            "valueMinutes": [800, 280, 960, 330],
            "valueCalls": [800, 788, 960, 838],
        },
    },
    "metrics": {
        "src": P + "metrics-2026-10-06-07_39_16.png",
        "box": (CARD_X[0], 183, CARD_X[1], 2174),
        "redact": [(1268, y - 13, 1344, y + 13) for y in (1715, 1790, 1865, 1940, 2014)],
        "regions": {"topCharts": [289, 446, 1790, 933], "analytics": [289, 1049, 1790, 2142]},
    },
    "finder": {
        "src": P + "google-map-calling-2026-10-06-07_43_15.png",
        "box": (CARD_X[0], 183, CARD_X[1], 1336),
        "rows": rows(682, 56, 10),
        "header": [624, 682],
    },
    "outbound": {
        "src": P + "outbound-2026-10-06-07_34_36.png",
        "box": (CARD_X[0], 183, CARD_X[1], 1929),
        "redact": [(624, y - 15, 726, y + 15) for y in (1282, 1360, 1437, 1515, 1593)],
        "rows": [[y - 39, y + 39] for y in (1282, 1360, 1437, 1515, 1593)],
        "regions": {"table": [289, 1180, 1790, 1635], "addToQueue": [1580, 1828, 1792, 1880]},
    },
    "outbound_single": {
        "src": P + "outbound-2026-10-06-07_33_20.png",
        "box": (CARD_X[0], 183, CARD_X[1], 706),
    },
    "accounting": {
        "src": P + "accounting-software-2026-10-06-07_50_08.png",
        "box": (CARD_X[0], 183, CARD_X[1], 676),
    },
    # Profile > Assistants tab, framed below the account holder's name and email.
    "assistants": {
        "src": P + "profile-2026-10-06-07_52_00.png",
        "box": (CARD_X[0], 318, CARD_X[1], 766),
    },
}


def rounded_mask(size, radius):
    w, h = size
    scale = 4
    m = Image.new("L", (w * scale, h * scale), 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, w * scale - 1, h * scale - 1), radius * scale, fill=255)
    return m.resize((w, h), Image.LANCZOS)


def redact(im, rects):
    blurred = im.filter(ImageFilter.GaussianBlur(7))
    mask = Image.new("L", im.size, 0)
    d = ImageDraw.Draw(mask)
    for r in rects:
        d.rounded_rectangle(r, 6, fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(3))
    return Image.composite(blurred, im, mask)


def local(box, rect):
    return [rect[0] - box[0], rect[1] - box[1], rect[2] - box[0], rect[3] - box[1]]


meta = {}
for name, spec in PANELS.items():
    im = Image.open(SRC / spec["src"]).convert("RGBA")
    if spec.get("redact"):
        im = redact(im, spec["redact"])
    box = spec["box"]
    crop = im.crop(box)
    alpha = ImageChops.multiply(crop.getchannel("A"), rounded_mask(crop.size, RADIUS))
    crop.putalpha(alpha)
    crop.save(OUT / f"{name}.png", optimize=True)
    half = crop.resize((crop.width // 2, crop.height // 2), Image.LANCZOS)
    half.save(OUT / f"{name}@half.png", optimize=True)
    m = {"w": crop.width, "h": crop.height}
    y0 = box[1]
    if "rows" in spec:
        m["rows"] = [[a - y0, b - y0] for a, b in spec["rows"]]
    if "header" in spec:
        m["header"] = [spec["header"][0] - y0, spec["header"][1] - y0]
    if "lines" in spec:
        m["lines"] = [[a - y0, b - y0] for a, b in spec["lines"]]
    if "regions" in spec:
        m["regions"] = {k: local(box, v) for k, v in spec["regions"].items()}
    meta[name] = m
    print(f"{name:18s} {crop.size}")

(OUT / "panels.json").write_text(json.dumps(meta, indent=1))

# Trace the real chart lines on the dashboard so the orange signal can ride them.
import numpy as np  # noqa: E402

dash = np.array(Image.open(OUT / "dashboard.png").convert("RGB")).astype(int)
charts = {}
for key, (x0, x1, y0, y1) in {"minutes": (600, 1490, 170, 380), "calls": (612, 1490, 680, 890)}.items():
    pts = []
    for x in range(x0, x1, 3):
        col = dash[y0:y1, x]
        hit = np.nonzero((col[:, 2] > 200) & (col[:, 0] > 80) & (col[:, 0] < 200))[0]
        if len(hit):
            pts.append([x, int(y0 + hit[0])])
    charts[key] = pts
(OUT / "charts.json").write_text(json.dumps(charts))
print("chart lines", {k: len(v) for k, v in charts.items()})

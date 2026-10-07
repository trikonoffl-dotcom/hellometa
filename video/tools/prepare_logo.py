"""Split the supplied HelloMeta logo into layers WITHOUT altering any pixel.

The orange handwritten "hello" and the "Meta.ai" wordmark sit either side of a
clean vertical gap, so the logo is split at that column. Each output layer
contains the original RGBA pixels from the supplied PNG and the two layers
recombine to exactly the original image.
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

src_dir = Path(sys.argv[1])
out_dir = Path(sys.argv[2])
out_dir.mkdir(parents=True, exist_ok=True)

TARGET_W = 3200  # working resolution of the cropped logo

for variant in ("hellometa-logo-white.png", "hellometa-logo.png"):
    im = Image.open(src_dir / variant).convert("RGBA")
    a = np.array(im)
    x0, y0, x1, y1 = Image.fromarray(a[..., 3]).getbbox()
    pad = 40
    crop = im.crop((x0 - pad, y0 - pad, x1 + pad, y1 + pad))
    scale = TARGET_W / crop.width
    crop = crop.resize((TARGET_W, round(crop.height * scale)), Image.LANCZOS)
    arr = np.array(crop).astype(np.int16)
    r, g, b, al = arr[..., 0], arr[..., 1], arr[..., 2], arr[..., 3]
    orange = ((r - b) > 90) & (al > 128)  # saturated orange vs neutral white/grey
    neutral = (~((r - b) > 90)) & (al > 128)
    hello_right = int(np.nonzero(orange.any(axis=0))[0].max())
    meta_left = int(np.nonzero(neutral.any(axis=0))[0].min())
    assert meta_left > hello_right, "hello and Meta.ai overlap; cannot split by column"
    split = (hello_right + meta_left + 1) // 2
    hello = np.array(crop).copy()
    meta = np.array(crop).copy()
    hello[:, split:, 3] = 0
    meta[:, :split, 3] = 0
    stem = variant.replace(".png", "")
    crop.save(out_dir / f"{stem}.png", optimize=True)
    Image.fromarray(hello).save(out_dir / f"{stem}-hello.png", optimize=True)
    Image.fromarray(meta).save(out_dir / f"{stem}-meta.png", optimize=True)
    solid = (al > 250)
    om = orange & solid
    nm = (~orange) & solid
    print(variant, "size", crop.size,
          "orange", "#%02X%02X%02X" % tuple(np.median(arr[om][:, :3], axis=0).astype(int)),
          "other", "#%02X%02X%02X" % tuple(np.median(arr[nm][:, :3], axis=0).astype(int)))
    info = {"width": crop.width, "height": crop.height, "split": split,
            "helloRight": hello_right, "metaLeft": meta_left}
    print(" ", json.dumps(info))
    (out_dir / f"{stem}.json").write_text(json.dumps(info))

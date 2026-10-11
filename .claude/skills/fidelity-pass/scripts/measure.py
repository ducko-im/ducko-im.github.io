"""Measures a state's web screenshot against its sRGB capture, both at 2x. All coordinates are in points.

Usage: python3 measure.py <work> <id> <appearance> <command> ...
  boxes x,y,w,h [merge]   bounding boxes of what differs from the region's dominant color, web then capture;
                          `merge` (points, default 1) joins nearby pixels, so 1-3 groups glyphs into words
  scan v|h <at> [from to] runs of color down column <at> (v) or along row <at> (h)
  color name:x,y,w,h ...  each region's background and its text or glyph color
  zoom x,y,w,h [factor]   writes <work>/zoom.png: the web crop over the capture crop, with 10 pt ticks

Reads <work>/web/<id>.<appearance>.png (shoot.sh) and <work>/srgb/<id>.<appearance>.png (srgb.swift). Needs Pillow, NumPy and SciPy.
Keep regions clear of the window's rounded corners: they are transparent in the capture and lab gray in the screenshot.
"""
import os
import sys

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

if len(sys.argv) < 5:
    sys.exit(__doc__)
work, state, appearance, command, *args = sys.argv[1:]
SOURCES = [("web", os.path.join(work, "web", f"{state}.{appearance}.png")), ("cap", os.path.join(work, "srgb", f"{state}.{appearance}.png"))]
missing = [path for _, path in SOURCES if not os.path.exists(path)]
if missing:
    sys.exit("missing " + ", ".join(missing) + ": run shoot.sh and srgb.swift first")
images = {name: np.asarray(Image.open(path).convert("RGBA")).astype(int) for name, path in SOURCES}


def region(image, spec):
    x, y, w, h = (round(float(v) * 2) for v in spec.split(","))
    return image[y:y + h, x:x + w], x / 2, y / 2


def rgb(pixel):
    return tuple(int(v) for v in pixel[:3])


def background(pixels):
    values, counts = np.unique(pixels.reshape(-1, pixels.shape[-1]), axis=0, return_counts=True)
    return values[counts.argmax()]


def boxes(spec, merge="1"):
    for name, image in images.items():
        pixels, x0, y0 = region(image, spec)
        bg = background(pixels)
        mask = np.abs(pixels - bg).max(axis=2) > 24
        grown = ndimage.binary_dilation(mask, iterations=max(1, round(float(merge) * 2))) if float(merge) > 0 else mask
        labels = ndimage.label(grown)[0]
        print(name, "background", rgb(bg))
        found = []
        for index, (rows, cols) in enumerate(ndimage.find_objects(labels), 1):
            ys, xs = np.nonzero((labels[rows, cols] == index) & mask[rows, cols])
            if len(ys):
                top, left = rows.start + ys.min(), cols.start + xs.min()
                bottom, right = rows.start + ys.max() + 1, cols.start + xs.max() + 1
                sample = rgb(pixels[rows.start + ys[len(ys) // 2], cols.start + xs[len(xs) // 2]])
                found.append((y0 + top / 2, x0 + left / 2, x0 + right / 2, y0 + bottom / 2, sample))
        for top, left, right, bottom, sample in sorted(found):
            print(f"  x {left:g}-{right:g} ({right - left:g})  y {top:g}-{bottom:g} ({bottom - top:g})  {sample}")


def scan(axis, at, start=None, end=None):
    for name, image in images.items():
        line = image[:, round(float(at) * 2)] if axis == "v" else image[round(float(at) * 2), :]
        lo = round(float(start) * 2) if start else 0
        hi = min(len(line), round(float(end) * 2)) if end else len(line)
        runs, begin = [], lo
        for i in range(lo + 1, hi + 1):
            if i == hi or np.abs(line[i] - line[begin]).max() > 6:
                runs.append(f"[{begin / 2:g}-{i / 2:g} {rgb(line[begin])}]")
                begin = i
        print(name, " ".join(runs))


def color(*specs):
    for spec in specs:
        label, rect = spec.split(":")
        out = []
        for name, image in images.items():
            pixels = region(image, rect)[0][..., :3].reshape(-1, 3)
            bg = background(pixels)
            far = pixels[np.argsort(np.abs(pixels - bg).sum(axis=1))[-max(1, len(pixels) // 200):]]
            out.append(f"{name} {rgb(np.median(far, axis=0))} on {rgb(bg)}")
        print(label, " | ".join(out))


def zoom(spec, factor="3"):
    scale = float(factor)
    crops = []
    for image in images.values():
        pixels = region(image, spec)[0]
        crop = Image.new("RGBA", (pixels.shape[1], pixels.shape[0]), (255, 0, 255, 255))
        crop.alpha_composite(Image.fromarray(pixels.astype("uint8"), "RGBA"))
        crops.append(crop.convert("RGB").resize((round(pixels.shape[1] * scale / 2), round(pixels.shape[0] * scale / 2)), Image.Resampling.NEAREST))
    x, y, w, h = (float(v) for v in spec.split(","))
    width, height = crops[0].size
    sheet = Image.new("RGB", (width + 40, height * len(crops) + 30), "white")
    draw = ImageDraw.Draw(sheet)
    for index, crop in enumerate(crops):
        sheet.paste(crop, (40, index * (height + 30)))
        for tick in range(0, int(h) + 1, 10):
            top = index * (height + 30) + tick * scale
            draw.line([(30, top), (38, top)], fill="red")
            draw.text((0, top - 5), str(int(y + tick)), fill="black")
    for tick in range(0, int(w) + 1, 10):
        draw.line([(40 + tick * scale, height + 2), (40 + tick * scale, height + 12)], fill="red")
        draw.text((41 + tick * scale, height + 14), str(int(x + tick)), fill="black")
    sheet.save(os.path.join(work, "zoom.png"))
    print(os.path.join(work, "zoom.png"))


COMMANDS = {"boxes": boxes, "scan": scan, "color": color, "zoom": zoom}
if command not in COMMANDS:
    sys.exit(__doc__)
COMMANDS[command](*args)

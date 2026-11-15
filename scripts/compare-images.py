#!/usr/bin/env python3
"""Compare two PNG screenshots and print tolerance-ready metrics as JSON.

Used by scripts/test-map-engines.mjs. Requires Pillow, already needed by the
photo pipeline. The metric intentionally ignores nothing: callers choose
per-scene thresholds for mean error and the share of strongly different pixels.
"""
import json
import sys
from typing import NoReturn

from PIL import Image, ImageChops, ImageStat


def fail(message: str) -> NoReturn:
    print(message, file=sys.stderr)
    raise SystemExit(2)


def main() -> None:
    if len(sys.argv) not in (3, 4):
        fail("usage: compare-images.py before.png after.png [diff.png]")
    left = Image.open(sys.argv[1]).convert("RGB")
    right = Image.open(sys.argv[2]).convert("RGB")
    if left.size != right.size:
        fail(f"image sizes differ: {left.size} != {right.size}")

    difference = ImageChops.difference(left, right)
    mean_abs = sum(ImageStat.Stat(difference).mean) / 3
    red, green, blue = difference.split()
    max_channel = ImageChops.lighter(ImageChops.lighter(red, green), blue)
    histogram = max_channel.histogram()
    total = left.width * left.height
    result = {
        "width": left.width,
        "height": left.height,
        "mean_abs": round(mean_abs, 4),
        "max_abs": max(max_channel.getextrema()),
        "pct_gt_10": round(sum(histogram[11:]) * 100 / total, 3),
        "pct_gt_40": round(sum(histogram[41:]) * 100 / total, 3),
        "changed_pct": round((total - histogram[0]) * 100 / total, 3),
    }
    if len(sys.argv) == 4:
        amplified = max_channel.point(lambda value: min(255, value * 4))
        amplified.save(sys.argv[3])
    print(json.dumps(result))


if __name__ == "__main__":
    main()

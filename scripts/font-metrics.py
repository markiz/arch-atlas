#!/usr/bin/env python3
"""Measure per-character advances for the bundled label font.

Reads JSON from stdin: {font, sizes, chars}. Writes {size: {char: advance}}.
Chrome rasterizes a small CSS font size at the nearest integer pixel and
returns integer per-glyph advances; the tile layout uses the same rounding so
the browser does not have to re-measure anything.
"""
from __future__ import annotations

import json
import math
import sys

from PIL import ImageFont


def main():
    request = json.load(sys.stdin)
    sizes = request['sizes']
    chars = request['chars']
    result = {}
    fonts = {}
    for size in sizes:
        pixel_size = max(1, math.floor(float(size) + 0.5))
        font = fonts.setdefault(
            pixel_size, ImageFont.truetype(request['font'], pixel_size)
        )
        result[str(size)] = {
            char: math.floor(font.getlength(char) + 0.5) for char in chars
        }
    json.dump(result, sys.stdout, ensure_ascii=False, separators=(',', ':'))


if __name__ == '__main__':
    main()

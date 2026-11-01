#!/usr/bin/env python3
"""Write the real pixel size of every stored photo into its metadata sidecar.

The sidecar describes the bytes in ``data/photos/<city>/<sha256>.webp``, so
``width`` and ``height`` are the dimensions of that stored WebP, not of the
upstream original. The script is idempotent: it only rewrites a sidecar when a
dimension is missing or differs from the image.

Usage:
  python3 scripts/sync-photo-dimensions.py
  python3 scripts/sync-photo-dimensions.py --dry-run
  python3 scripts/sync-photo-dimensions.py --check
"""
from __future__ import annotations

import argparse
import json
import sys
import time
import uuid
from pathlib import Path

from PIL import Image

from atlas_source import PHOTOS_DIR, ROOT, photo_metadata_path
from progress import Progress


def metadata_path(photo_id: str, city: str) -> Path:
    return photo_metadata_path(photo_id, city)


def read_metadata(path: Path) -> dict:
    value = json.loads(path.read_text(encoding='utf-8'))
    if not isinstance(value, dict):
        raise ValueError('metadata must be a JSON object')
    return value


def write_metadata(path: Path, metadata: dict) -> None:
    temporary = path.with_name(f'.{path.name}.{uuid.uuid4().hex}.tmp')
    temporary.write_text(
        json.dumps(metadata, ensure_ascii=False, indent=2) + '\n',
        encoding='utf-8',
    )
    temporary.replace(path)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--city', default='tbilisi')
    parser.add_argument('--dry-run', action='store_true', help='report changes without writing')
    parser.add_argument('--check', action='store_true', help='exit 1 if any sidecar is missing dimensions')
    args = parser.parse_args()

    directory = PHOTOS_DIR / args.city
    images = sorted(directory.glob('*.webp'))
    if not images:
        print(f'No images in {directory.relative_to(ROOT)}', file=sys.stderr)
        return 1

    progress = Progress(len(images), 'sync photo dimensions')
    progress.start(f'{len(images)} images in data/photos/{args.city}')
    started = time.monotonic()
    changed = unchanged = errors = missing = 0

    for path in images:
        photo_id = path.stem
        label = photo_id[:12]
        width = height = None
        try:
            with Image.open(path) as image:
                width, height = image.size
            sidecar = metadata_path(photo_id, args.city)
            if not sidecar.exists():
                missing += 1
                print(f'{label}: metadata sidecar is missing ({sidecar.relative_to(ROOT)})', file=sys.stderr)
            else:
                metadata = read_metadata(sidecar)
                if metadata.get('width') == width and metadata.get('height') == height:
                    unchanged += 1
                elif args.check:
                    changed += 1
                    print(f'{label}: sidecar has {metadata.get("width")}x{metadata.get("height")}, image is {width}x{height}', file=sys.stderr)
                else:
                    changed += 1
                    metadata['width'] = width
                    metadata['height'] = height
                    if not args.dry_run:
                        write_metadata(sidecar, metadata)
        except Exception as error:  # noqa: BLE001 - report the file and continue
            errors += 1
            print(f'{label}: {error}', file=sys.stderr)
        progress.advance(f'{label}: {width}x{height}' if width is not None else label)

    progress.finish()
    elapsed = time.monotonic() - started
    mode = 'checked' if args.check else 'dry-run' if args.dry_run else 'updated'
    print(
        f'Photo dimensions {mode}: {changed} changed, {unchanged} unchanged, '
        f'{missing} missing sidecar, {errors} errors in {elapsed:.1f}s.'
    )
    return 1 if errors or missing or (args.check and changed) else 0


if __name__ == '__main__':
    raise SystemExit(main())

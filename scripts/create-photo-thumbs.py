#!/usr/bin/env python3
"""Create the preview version of every atlas photo.

The full photograph remains the gallery image. The source card stores only the
ordered SHA-256 photo identifiers, and the caches are content-addressed:

  data/photos/<city>/<sha256>.webp -> data/thumbnails/<city>/<sha256>.webp
                                   -> data/cards/<city>/<sha256>.webp

The inspector preview is generated at a fixed height of 480 px, i.e. 2x the
240 px photo area in the card, so its physical height is always an integer
multiple of the rendered height. Catalog cards get a separate 360 px wide file
so the grid does not retain 480 px tall bitmaps for every card. Both preserve
the source aspect ratio; only the inspector preview may upscale a very small
original to reach 480 px. The bundle derives the paths as
thumbnails/<city>/<sha256>.webp and cards/<city>/<sha256>.webp.

Because the source name is already its content hash, a changed image gets a new
name automatically. Existing previews newer than their source are left
untouched, so repeated builds do not reconvert anything. Unreferenced previews
are pruned. Missing previews are encoded by a small thread pool: Pillow's WebP
encoder releases the GIL, and the worker count does not affect output bytes.
`npm run build`, `npm run check` and `npm run dev` run this script through
scripts/create-photo-thumbs.mjs.

Usage:
  python3 scripts/create-photo-thumbs.py --dry-run
  python3 scripts/create-photo-thumbs.py
  python3 scripts/create-photo-thumbs.py --force
"""
from __future__ import annotations

import argparse
import json
import os
import shutil
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

from PIL import Image

from atlas_source import (
    CARDS_DIR,
    CITY,
    PHOTO_ID_RE,
    THUMBNAILS_DIR,
    photo_card_path,
    photo_path,
    read_cards,
    thumb_path,
)
from progress import Progress

# The inspector preview is 2x its 240 px rendered height (480 / 240 = 2) on
# both desktop and mobile. Cards keep their own 360 px width and are rendered
# at 180 px (360 / 180 = 2) or 120 px (360 / 120 = 3) on mobile.
# Keep in sync with .photo-wrap and .card-image in src/style.css.
THUMB_HEIGHT = 480
CARD_WIDTH = 360
QUALITY = 75
# WebP preview encoding releases the GIL, so a small thread pool scales well on
# a cold cache: eight workers turn a ~100 s serial pass into ~20 s.
MAX_WORKERS = 8


def make_card_preview(source: Path, target: Path, width: int) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    with Image.open(source) as image:
        if image.width <= width:
            # Never upscale a small original just to match the nominal width.
            shutil.copyfile(source, target)
            return
        height = max(1, round(image.height * width / image.width))
        preview = image.convert('RGB').resize((width, height), Image.Resampling.LANCZOS)
        preview.save(target, 'WEBP', quality=QUALITY, method=6)


def make_inspector_preview(source: Path, target: Path, height: int) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    with Image.open(source) as image:
        width = max(1, round(image.width * height / image.height))
        preview = image.convert('RGB').resize((width, height), Image.Resampling.LANCZOS)
        preview.save(target, 'WEBP', quality=QUALITY, method=6)


def make_previews(source: Path, thumb_target: Path, card_target: Path) -> None:
    make_inspector_preview(source, thumb_target, THUMB_HEIGHT)
    make_card_preview(source, card_target, CARD_WIDTH)


def preview_size(path: Path) -> tuple[int, int] | None:
    try:
        with Image.open(path) as image:
            return image.size
    except Exception:
        return None


def prune_previews(directory: Path, expected: set[Path]) -> int:
    """Remove previews that no card references, then empty directories."""
    if not directory.exists():
        return 0
    removed = 0
    for path in sorted(directory.rglob('*')):
        if path.is_file() and path not in expected:
            path.unlink()
            removed += 1
    for child in sorted(
        (path for path in directory.rglob('*') if path.is_dir()),
        key=lambda path: len(path.parts),
        reverse=True,
    ):
        try:
            child.rmdir()
        except OSError:
            pass
    return removed


def process_city(city: str, args) -> int:
    cards = read_cards(city)
    jobs: dict[str, tuple[Path, Path, Path]] = {}
    expected_thumbs: set[Path] = set()
    expected_cards: set[Path] = set()
    errors = 0
    for card in cards.values():
        for photo_id in card.get('photos', []):
            if not isinstance(photo_id, str) or not PHOTO_ID_RE.fullmatch(photo_id):
                print(f'{card["id"]}: invalid photo id {photo_id!r}', file=sys.stderr)
                errors += 1
                continue
            if photo_id in jobs:
                continue
            source = photo_path(photo_id, city)
            thumb = thumb_path(photo_id, city)
            card_target = photo_card_path(photo_id, city)
            jobs[photo_id] = (source, thumb, card_target)
            expected_thumbs.add(thumb)
            expected_cards.add(card_target)

    progress = Progress(len(jobs), 'create photo previews')
    progress.start(
        f'{len(jobs)} unique photos, inspector previews {THUMB_HEIGHT}px high, '
        f'cards <= {CARD_WIDTH}px wide'
    )
    created = skipped = 0
    pending: list[tuple[str, Path, Path, Path]] = []
    for photo_id, (source, thumb, card_target) in jobs.items():
        label = photo_id[:12]
        if not source.exists():
            errors += 1
            print(f'{label}: missing source {source}', file=sys.stderr)
            progress.advance(f'{label}: error')
            continue
        thumb_size = preview_size(thumb) if thumb.exists() else None
        card_size = preview_size(card_target) if card_target.exists() else None
        thumb_fresh = (
            thumb_size is not None
            and thumb_size[1] == THUMB_HEIGHT
            and thumb.stat().st_mtime >= source.stat().st_mtime
            and thumb.stat().st_size > 32
        )
        card_fresh = (
            card_size is not None
            and card_size[0] <= CARD_WIDTH
            and card_target.stat().st_mtime >= source.stat().st_mtime
            and card_target.stat().st_size > 32
        )
        fresh = thumb_fresh and card_fresh
        if fresh and not args.force:
            skipped += 1
            progress.advance(f'{label}: exists')
            continue
        if args.dry_run:
            created += 1
            progress.advance(f'{label}: would create')
            continue
        pending.append((photo_id, source, thumb, card_target))

    if pending:
        workers = min(MAX_WORKERS, len(pending), os.cpu_count() or 1)
        failures: list[tuple[str, Exception]] = []
        with ThreadPoolExecutor(max_workers=workers) as pool:
            futures = {
                pool.submit(make_previews, source, thumb, card_target): photo_id[:12]
                for photo_id, source, thumb, card_target in pending
            }
            for future in as_completed(futures):
                label = futures[future]
                try:
                    future.result()
                    created += 1
                    progress.advance(f'{label}: created')
                except Exception as error:  # keep going; one broken photo must not hide the rest
                    failures.append((label, error))
                    progress.advance(f'{label}: error')
        for label, error in sorted(failures):
            errors += 1
            print(f'{label}: {error}', file=sys.stderr)
    progress.finish()

    removed = removed_cards = 0
    if not args.dry_run:
        removed = prune_previews(THUMBNAILS_DIR / city, expected_thumbs)
        removed_cards = prune_previews(CARDS_DIR / city, expected_cards)
    print(
        f'Photo previews {city}: {created} {"would be " if args.dry_run else ""}created, '
        f'{skipped} up to date, {removed} stale previews removed, '
        f'{removed_cards} stale cards removed, {errors} errors.'
    )
    return 1 if errors else 0


def city_ids(only: str | None) -> list[str]:
    root = Path(__file__).resolve().parent.parent
    index = json.loads((root / 'data/cities/index.json').read_text(encoding='utf-8'))
    cities = []
    for city in index.get('order', []):
        if only and city != only:
            continue
        config = json.loads((root / f'data/cities/{city}.json').read_text(encoding='utf-8'))
        if config.get('status') == 'ready':
            cities.append(city)
    return cities


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--dry-run', action='store_true')
    parser.add_argument('--force', action='store_true', help='regenerate existing previews too')
    parser.add_argument('--city')
    parser.add_argument('--all', action='store_true')
    args = parser.parse_args()
    if args.city and args.all:
        parser.error('--city and --all are mutually exclusive')
    cities = city_ids(args.city)
    if not cities:
        print(f'No ready cities for {args.city or "--all"}', file=sys.stderr)
        return 1
    status = 0
    for city in cities:
        status = max(status, process_city(city, args))
    return status


if __name__ == '__main__':
    raise SystemExit(main())

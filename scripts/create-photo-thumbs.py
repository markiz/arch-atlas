#!/usr/bin/env python3
"""Create the preview version of every atlas photo.

The full photograph remains the gallery image. The source card stores only the
ordered SHA-256 photo identifiers, and the cache is content-addressed:

  data/photos/<city>/<sha256>.webp -> data/thumbnails/<city>/<sha256>.webp

Previews are width-limited to 720 px, preserve the source aspect ratio, and are
never upscaled. The bundle derives the preview path as
thumbnails/<city>/<sha256>.webp. Browser cards and the inspector show this
preview, while the full gallery files load afterwards.

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
import os
import shutil
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

from PIL import Image

from atlas_source import CITY, PHOTO_ID_RE, THUMBNAILS_DIR, photo_path, read_cards, thumb_path
from progress import Progress

TARGET_WIDTH = 720
QUALITY = 75
# WebP preview encoding releases the GIL, so a small thread pool scales well on
# a cold cache: eight workers turn a ~100 s serial pass into ~20 s.
MAX_WORKERS = 8


def make_thumb(source: Path, target: Path) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    with Image.open(source) as image:
        if image.width <= TARGET_WIDTH:
            # Never upscale a small original just to match the nominal width.
            shutil.copyfile(source, target)
            return
        height = max(1, round(image.height * TARGET_WIDTH / image.width))
        preview = image.convert('RGB').resize((TARGET_WIDTH, height), Image.Resampling.LANCZOS)
        preview.save(target, 'WEBP', quality=QUALITY, method=6)


def prune_thumbnails(expected: set[Path]) -> int:
    """Remove previews that no card references, then empty directories."""
    directory = THUMBNAILS_DIR / CITY
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


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--dry-run', action='store_true')
    parser.add_argument('--force', action='store_true', help='regenerate existing previews too')
    args = parser.parse_args()

    cards = read_cards()
    jobs: dict[str, tuple[Path, Path]] = {}
    expected: set[Path] = set()
    errors = 0
    for card in cards.values():
        for photo_id in card.get('photos', []):
            if not isinstance(photo_id, str) or not PHOTO_ID_RE.fullmatch(photo_id):
                print(f'{card["id"]}: invalid photo id {photo_id!r}', file=sys.stderr)
                errors += 1
                continue
            if photo_id in jobs:
                continue
            source = photo_path(photo_id)
            target = thumb_path(photo_id)
            jobs[photo_id] = (source, target)
            expected.add(target)

    progress = Progress(len(jobs), 'create photo previews')
    progress.start(f'{len(jobs)} unique photos, width <= {TARGET_WIDTH}px')
    created = skipped = 0
    pending: list[tuple[str, Path, Path]] = []
    for photo_id, (source, target) in jobs.items():
        label = photo_id[:12]
        if not source.exists():
            errors += 1
            print(f'{label}: missing source {source}', file=sys.stderr)
            progress.advance(f'{label}: error')
            continue
        fresh = target.exists() and target.stat().st_mtime >= source.stat().st_mtime and target.stat().st_size > 32
        if fresh and not args.force:
            skipped += 1
            progress.advance(f'{label}: exists')
            continue
        if args.dry_run:
            created += 1
            progress.advance(f'{label}: would create')
            continue
        pending.append((photo_id, source, target))

    if pending:
        workers = min(MAX_WORKERS, len(pending), os.cpu_count() or 1)
        failures: list[tuple[str, Exception]] = []
        with ThreadPoolExecutor(max_workers=workers) as pool:
            futures = {
                pool.submit(make_thumb, source, target): photo_id[:12]
                for photo_id, source, target in pending
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

    removed = 0
    if not args.dry_run:
        removed = prune_thumbnails(expected)
    print(
        f'Preview photos: {created} {"would be " if args.dry_run else ""}created, '
        f'{skipped} up to date, {removed} stale removed, {errors} errors.'
    )
    return 1 if errors else 0


if __name__ == '__main__':
    raise SystemExit(main())

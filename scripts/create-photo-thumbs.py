#!/usr/bin/env python3
"""Create the small preview version of every atlas photo.

The full photograph remains the gallery image. The preview is width-limited to
480 px (never upscaled), saved next to the full file as <n>-thumb.webp, and
referenced from the card as photos/<city>/<object>/<n>-thumb.webp. Browser cards
show this preview first, while the full gallery files load afterwards.

Usage:
  python3 scripts/create-photo-thumbs.py --dry-run
  python3 scripts/create-photo-thumbs.py
  python3 scripts/create-photo-thumbs.py --force
"""
from __future__ import annotations

import argparse
import shutil
import sys
from pathlib import Path

from PIL import Image

from atlas_source import ROOT, read_cards, write_card
from progress import Progress

TARGET_WIDTH = 480
QUALITY = 75


def relative_thumb(file: str) -> str:
    path = Path(file)
    return (path.parent / f'{path.stem}-thumb.webp').as_posix()


def set_thumb(photo: dict, relative: str) -> bool:
    """Keep `thumb` next to `file` instead of appending it after all fields."""
    if photo.get('thumb') == relative:
        return False
    ordered: dict = {}
    for key, value in photo.items():
        if key == 'thumb':
            continue
        ordered[key] = value
        if key == 'file':
            ordered['thumb'] = relative
    if 'thumb' not in ordered:
        ordered['thumb'] = relative
    photo.clear()
    photo.update(ordered)
    return True


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


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--dry-run', action='store_true')
    parser.add_argument('--force', action='store_true', help='regenerate existing previews too')
    args = parser.parse_args()

    cards = read_cards()
    changed_cards: list[dict] = []
    jobs: list[tuple[dict, dict, Path, Path]] = []
    for card in cards.values():
        card_changed = False
        for photo in card.get('photos', []):
            full_relative = photo.get('file')
            if not full_relative:
                print(f'{card["id"]}: photo without file', file=sys.stderr)
                continue
            source = ROOT / 'data' / full_relative
            target_relative = relative_thumb(full_relative)
            if set_thumb(photo, target_relative):
                card_changed = True
            jobs.append((card, photo, source, ROOT / 'data' / target_relative))
        if card_changed:
            changed_cards.append(card)

    progress = Progress(len(jobs), 'create photo previews')
    progress.start(f'{len(jobs)} photos, width <= {TARGET_WIDTH}px')
    created = skipped = errors = 0
    for card, photo, source, target in jobs:
        label = f'{card["id"]}/{Path(photo["file"]).name}'
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
        try:
            make_thumb(source, target)
            created += 1
            progress.advance(f'{label}: created')
        except Exception as error:  # keep going; one broken photo must not hide the rest
            errors += 1
            print(f'{label}: {error}', file=sys.stderr)
            progress.advance(f'{label}: error')
    progress.finish()

    if not args.dry_run:
        for card in changed_cards:
            write_card(card)
    print(f'Preview photos: {created} {"would be " if args.dry_run else ""}created, {skipped} up to date, {errors} errors.')
    return 1 if errors else 0


if __name__ == '__main__':
    raise SystemExit(main())

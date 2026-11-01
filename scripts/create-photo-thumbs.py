#!/usr/bin/env python3
"""Create the preview version of every atlas photo.

The full photograph remains the gallery image. Previews live in a separate
generated tree and keep the original relative name:

  data/photos/<city>/<id>/<n>.webp -> data/thumbnails/<city>/<id>/<n>.webp

They are width-limited to 720 px, preserve the source aspect ratio, and are
never upscaled. The card references the preview as
thumbnails/<city>/<id>/<n>.webp. Browser cards and the inspector show this
preview, while the full gallery files load afterwards.

The `thumb` field in each card is kept in sync. Existing previews newer than
their source are left untouched, so repeated builds do not reconvert anything.
`npm run build`, `npm run check` and `npm run dev` run this script through
scripts/create-photo-thumbs.mjs.

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

from atlas_source import ROOT, THUMBNAILS_DIR, read_cards, thumb_relative, write_card
from progress import Progress

TARGET_WIDTH = 720
QUALITY = 75


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


def prune_thumbnails(expected: set[Path]) -> int:
    """Remove previews that no card references, then empty directories."""
    if not THUMBNAILS_DIR.exists():
        return 0
    removed = 0
    for path in sorted(THUMBNAILS_DIR.rglob('*')):
        if path.is_file() and path not in expected:
            path.unlink()
            removed += 1
    for directory in sorted(
        (path for path in THUMBNAILS_DIR.rglob('*') if path.is_dir()),
        key=lambda path: len(path.parts),
        reverse=True,
    ):
        try:
            directory.rmdir()
        except OSError:
            pass
    return removed


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--dry-run', action='store_true')
    parser.add_argument('--force', action='store_true', help='regenerate existing previews too')
    args = parser.parse_args()

    cards = read_cards()
    changed_cards: list[dict] = []
    jobs: list[tuple[dict, dict, Path, Path]] = []
    expected: set[Path] = set()
    for card in cards.values():
        card_changed = False
        for photo in card.get('photos', []):
            full_relative = photo.get('file')
            if not full_relative:
                print(f'{card["id"]}: photo without file', file=sys.stderr)
                continue
            source = ROOT / 'data' / full_relative
            target_relative = thumb_relative(full_relative)
            target = ROOT / 'data' / target_relative
            expected.add(target)
            if set_thumb(photo, target_relative):
                card_changed = True
            jobs.append((card, photo, source, target))
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

    removed = 0
    if not args.dry_run:
        for card in changed_cards:
            write_card(card)
        removed = prune_thumbnails(expected)
    print(
        f'Preview photos: {created} {"would be " if args.dry_run else ""}created, '
        f'{skipped} up to date, {removed} stale removed, {errors} errors.'
    )
    return 1 if errors else 0


if __name__ == '__main__':
    raise SystemExit(main())

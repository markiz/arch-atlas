#!/usr/bin/env python3
"""Migrate atlas photos to content-addressed ids and metadata sidecars.

Before:
  data/atlas/tbilisi/<object>.json -> photos: [{file, thumb, author, ...}]
  data/photos/tbilisi/<object>/<n>.webp

After:
  data/atlas/tbilisi/<object>.json -> photos: ["<sha256>", ...]
  data/photos/tbilisi/<sha256>.webp
  data/photos/tbilisi/<sha256>.metadata.json

The SHA-256 is computed from the exact full WebP bytes. Photo order inside each
card is preserved; equal images used by several objects share one id and one
sidecar. The script is idempotent and does not touch thumbnails, which are
regenerated from the new cache by scripts/create-photo-thumbs.py.

Usage:
  python3 scripts/migrate-photo-ids.py --dry-run
  python3 scripts/migrate-photo-ids.py
"""
from __future__ import annotations

import argparse
import hashlib
import shutil
from pathlib import Path

from atlas_source import (
    CITY,
    PHOTO_ID_RE,
    PHOTO_METADATA_FIELDS,
    PHOTO_OPTIONAL_FIELDS,
    ROOT,
    photo_path,
    read_cards,
    write_card,
    write_photo_metadata,
)
from progress import Progress


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open('rb') as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b''):
            digest.update(chunk)
    return digest.hexdigest()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--dry-run', action='store_true')
    args = parser.parse_args()

    cards = read_cards()
    records = [
        (card, index, record)
        for card in cards.values()
        for index, record in enumerate(card.get('photos', []))
    ]
    progress = Progress(len(records), 'migrate photos to sha256 ids')
    progress.start(f'{len(cards)} cards, {len(records)} photo records')
    moved = skipped = removed = 0
    changed_cards: set[str] = set()
    for card, index, record in records:
        if isinstance(record, str):
            if not PHOTO_ID_RE.fullmatch(record):
                raise SystemExit(f'{card["id"]}: invalid photo id {record!r}')
            skipped += 1
            progress.advance(f'{card["id"]}: already migrated')
            continue
        if not isinstance(record, dict):
            raise SystemExit(f'{card["id"]}: photo[{index}] must be a record or sha256 string')
        relative = record.get('file')
        if not isinstance(relative, str):
            raise SystemExit(f'{card["id"]}: photo[{index}] has no file')
        source = ROOT / 'data' / relative
        if not source.exists():
            raise SystemExit(f'{card["id"]}: missing source {source}')
        digest = sha256_file(source)
        target = photo_path(digest, CITY)
        if not args.dry_run:
            target.parent.mkdir(parents=True, exist_ok=True)
            if not target.exists():
                shutil.copy2(source, target)
            elif sha256_file(target) != digest:
                raise SystemExit(f'{target}: existing file does not match its name')
            metadata = {
                field: record.get(field)
                for field in PHOTO_METADATA_FIELDS + PHOTO_OPTIONAL_FIELDS
                if record.get(field) is not None
            }
            write_photo_metadata(digest, metadata, CITY)
        if not isinstance(card.get('photos'), list):
            raise SystemExit(f'{card["id"]}: photos must be a list')
        card['photos'][index] = digest
        changed_cards.add(card['id'])
        moved += 1
        progress.advance(f'{card["id"]}: {digest[:12]}')
    progress.finish()

    cards_changed = 0
    if not args.dry_run:
        for card in cards.values():
            if card['id'] not in changed_cards:
                continue
            write_card(card)
            cards_changed += 1
        for path in sorted(
            (path for path in (ROOT / 'data' / 'photos' / CITY).rglob('*')),
            key=lambda path: len(path.parts),
            reverse=True,
        ):
            if path.is_file():
                # New cache entries live directly in the city directory.
                if path.parent != ROOT / 'data' / 'photos' / CITY:
                    path.unlink()
                    removed += 1
            elif path.is_dir():
                try:
                    if not any(path.iterdir()):
                        path.rmdir()
                        removed += 1
                except OSError:
                    pass
    print(
        f'Photo ids migrated: {moved} moved, {skipped} already ids, '
        f'{cards_changed} cards written, {removed} stale files/directories removed'
        f'{" (dry run)" if args.dry_run else ""}.'
    )
    return 0


if __name__ == '__main__':
    raise SystemExit(main())

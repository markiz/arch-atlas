#!/usr/bin/env python3
"""Attach low-resolution registry photos when no free photo is available.

This is an explicit last-resort path. It does not claim a license: the card
stores author "Реестр памятников Грузии (автор не указан)", license
"Не установлена" and links to the registry record. Images are deliberately
reduced (max 700 px) and never upscaled.

Usage:
  python3 scripts/fetch-fallback-photos.py --dry-run
  python3 scripts/fetch-fallback-photos.py
  python3 scripts/fetch-fallback-photos.py --only osm-415940826
"""
from __future__ import annotations

import argparse
import io
import json
import urllib.request
from pathlib import Path

from PIL import Image
from atlas_source import UNKNOWN_PHOTO_WIDTH, fit_width, read_cards, read_photo_metadata, save_photo, write_card, write_photo_metadata
from progress import Progress

ROOT = Path(__file__).resolve().parent.parent
CANDIDATES = ROOT / 'data/photo-fallbacks.json'
USER_AGENT = 'TbilisiArchitectureAtlasPhotos/1.0 (editorial research)'


def read_json(path: Path):
    return json.loads(path.read_text(encoding='utf-8'))


def fetch(url: str) -> bytes:
    request = urllib.request.Request(url, headers={'User-Agent': USER_AGENT})
    with urllib.request.urlopen(request, timeout=60) as response:
        return response.read()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--only', help='card ids, comma separated')
    parser.add_argument('--dry-run', action='store_true')
    args = parser.parse_args()

    candidates = read_json(CANDIDATES)['items']
    by_id = read_cards()
    wanted = {value.strip() for value in args.only.split(',')} if args.only else set(candidates)
    added = 0
    skipped = 0
    modified: list[dict] = []
    items = sorted(wanted)
    progress = Progress(len(items), 'attach registry photos')
    progress.start(f'{len(items)} cards')

    for card_id in items:
        candidate = candidates.get(card_id)
        card = by_id.get(card_id)
        if not candidate or not card:
            print('missing candidate/card', card_id)
            skipped += 1
            progress.advance(f'{card_id}: missing')
            continue
        if any((read_photo_metadata(photo_id) or {}).get('source') == candidate['photo'] for photo_id in card.get('photos', [])):
            print('already attached', card_id)
            progress.advance(f'{card_id}: already attached')
            continue
        if args.dry_run:
            print('would add (unknown license, low-res)', card_id, candidate['photo'])
            progress.advance(f'{card_id}: would add')
            continue
        image = Image.open(io.BytesIO(fetch(candidate['photo'])))
        original_width = image.width
        image = fit_width(image, UNKNOWN_PHOTO_WIDTH)
        resized = image.width < original_width
        width = image.width
        photo_id = save_photo(image.convert('RGB'), quality=72)
        write_photo_metadata(photo_id, {
            'author': 'Реестр памятников Грузии (автор не указан)',
            'license': 'Не установлена',
            'licenseUrl': candidate['record'],
            'source': candidate['photo'],
            'modifications': (f'уменьшен размер до {width} px по ширине, преобразовано в WebP; полное качество не используется' if resized else 'преобразовано в WebP; полное качество не используется'),
            'description': candidate.get('note', ''),
        })
        card.setdefault('photos', []).append(photo_id)
        modified.append(card)
        added += 1
        print('added (unknown license, low-res)', card_id)
        progress.advance(f'{card_id}: added')

    progress.finish()
    if not args.dry_run:
        for card in modified:
            write_card(card)
    print(f'added: {added}; skipped: {skipped}; dry-run: {args.dry_run}')
    return 0 if added or args.dry_run else 1


if __name__ == '__main__':
    raise SystemExit(main())

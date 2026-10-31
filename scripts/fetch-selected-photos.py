#!/usr/bin/env python3
"""Fetch selected Commons photos and attach them to heritage-extra cards.

The candidate list lives in data/photo-candidates.json. Only files with a
clearly free license (CC0/PD/CC BY/CC BY-SA) are accepted here. Files with an
unknown license are intentionally not fetched by this script; they need a
separate editorial decision and a low-resolution fallback.

Usage:
  python3 scripts/fetch-selected-photos.py --dry-run
  python3 scripts/fetch-selected-photos.py
  python3 scripts/fetch-selected-photos.py --only osm-19630608
"""
from __future__ import annotations

import argparse
import html
import io
import json
import re
import urllib.parse
import urllib.request
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
CANDIDATES = ROOT / 'data/photo-candidates.json'
EXTRA = ROOT / 'data/heritage-extra.json'
PHOTOS = ROOT / 'public/atlas/photos'
API = 'https://commons.wikimedia.org/w/api.php'
USER_AGENT = 'TbilisiArchitectureAtlasPhotos/1.0 (editorial research)'


def clean(value: str | None) -> str:
    return re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', ' ', value or ''))).strip()


def read_json(path: Path):
    return json.loads(path.read_text(encoding='utf-8'))


def write_json(path: Path, value) -> None:
    tmp = path.with_suffix(path.suffix + '.tmp')
    tmp.write_text(json.dumps(value, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
    tmp.replace(path)


def fetch(url: str) -> bytes:
    request = urllib.request.Request(url, headers={'User-Agent': USER_AGENT})
    with urllib.request.urlopen(request, timeout=60) as response:
        return response.read()


def is_free(license_name: str) -> bool:
    normalized = license_name.lower()
    return any(token in normalized for token in ('cc0', 'public domain', 'pd-', 'cc by', 'cc-by'))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--only', help='card ids, comma separated')
    parser.add_argument('--dry-run', action='store_true')
    args = parser.parse_args()

    candidates = read_json(CANDIDATES)['items']
    extra = read_json(EXTRA)
    by_id = {card['id']: card for card in extra}
    wanted = {value.strip() for value in args.only.split(',')} if args.only else set(candidates)

    titles = '|'.join(candidates[card_id]['commons'] for card_id in wanted if card_id in candidates)
    params = urllib.parse.urlencode({
        'action': 'query', 'format': 'json', 'prop': 'imageinfo',
        'iiprop': 'url|extmetadata', 'iiurlwidth': '1200', 'titles': titles,
    })
    response = json.loads(fetch(API + '?' + params).decode('utf-8'))
    pages = {page['title']: page for page in response.get('query', {}).get('pages', {}).values()}

    added = 0
    skipped = 0
    for card_id in sorted(wanted):
        candidate = candidates.get(card_id)
        if not candidate:
            print('missing candidate', card_id)
            continue
        page = pages.get(candidate['commons'])
        if not page or 'imageinfo' not in page:
            print('missing Commons page', card_id, candidate['commons'])
            skipped += 1
            continue
        info = page['imageinfo'][0]
        meta = info.get('extmetadata', {})
        license_name = clean(meta.get('LicenseShortName', {}).get('value'))
        license_url = clean(meta.get('LicenseUrl', {}).get('value'))
        author = clean(meta.get('Artist', {}).get('value'))[:180]
        # Commons often leaves LicenseUrl empty for public-domain files released by
        # their uploader ("Own work" credit). Link the PD-self template the same way
        # the existing Public domain entries in data/heritage-extra.json do.
        credit = clean(meta.get('Credit', {}).get('value'))
        if not license_url and 'public domain' in license_name.lower() and 'own work' in credit.lower():
            license_url = 'https://commons.wikimedia.org/wiki/Template:PD-self'
        if not (license_name and license_url and author):
            print('missing attribution', card_id, license_name, license_url, author)
            skipped += 1
            continue
        if not is_free(license_name):
            print('not free, skipped', card_id, license_name)
            skipped += 1
            continue
        card = by_id.get(card_id)
        if not card:
            print('missing card', card_id)
            skipped += 1
            continue
        source = info.get('descriptionurl') or info.get('url')
        if any(photo.get('source') == source for photo in card.get('photos', [])):
            print('already attached', card_id)
            continue
        if args.dry_run:
            print('would add', card_id, license_name, author)
            continue
        image = Image.open(io.BytesIO(fetch(info.get('thumburl') or info['url'])))
        image.thumbnail((1000, 1000))
        PHOTOS.mkdir(parents=True, exist_ok=True)
        filename = f'{card_id}-1.webp'
        image.convert('RGB').save(PHOTOS / filename, 'WEBP', quality=80)
        card.setdefault('photos', []).append({
            'file': f'photos/{filename}',
            'author': author,
            'license': license_name,
            'licenseUrl': license_url,
            'source': source,
            'modifications': 'уменьшен размер, преобразовано в WebP',
            'description': candidate.get('note', ''),
        })
        added += 1
        print('added', card_id, license_name, author)

    if not args.dry_run and added:
        write_json(EXTRA, extra)
    print(f'added: {added}; skipped: {skipped}; dry-run: {args.dry_run}')
    return 0 if added or args.dry_run else 1


if __name__ == '__main__':
    raise SystemExit(main())

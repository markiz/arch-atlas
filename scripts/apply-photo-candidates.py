#!/usr/bin/env python3
"""Attach ranked Commons photo candidates to atlas cards.

Reads work/photo-research/candidates.json (produced by
scripts/collect-photo-candidates.py), re-fetches existing free photos at the
policy width, adds new photos until an object has at least three where reliable
candidates exist, drops near-duplicate shots, and writes the cards as pretty
JSON. Registry fallback photos stay if no free replacement exists.

Width policy:
  * free license (Commons: CC0/PD/CC BY/CC BY-SA) - up to 1920 px wide;
  * unknown or commercial source - up to 1200 px wide, never upscaled.

Usage:
  python3 scripts/apply-photo-candidates.py --dry-run
  python3 scripts/apply-photo-candidates.py
  python3 scripts/apply-photo-candidates.py --only osm-1234146272
"""
from __future__ import annotations

import argparse
import io
import json
import re
import sys
import time
import urllib.request
from pathlib import Path

from PIL import Image, ImageOps

from atlas_source import ROOT, photo_dir, read_cards, thumb_dir, write_card
from progress import Progress

CANDIDATES = ROOT / 'work' / 'photo-research' / 'candidates.json'
SELECTION = ROOT / 'data' / 'photo-gallery-selection.json'
REPORT = ROOT / 'work' / 'photo-research' / 'applied.json'
USER_AGENT = 'TbilisiArchitectureAtlasPhotos/1.1 (educational atlas research)'
FREE_WIDTH = 1920
UNKNOWN_WIDTH = 1200
TARGET = 3
MAX_PHOTOS = 4
QUALITY = 82
UNKNOWN_LICENSE = 'Не установлена'


def fetch(url: str) -> bytes:
    for attempt in range(4):
        try:
            request = urllib.request.Request(url, headers={'User-Agent': USER_AGENT})
            with urllib.request.urlopen(request, timeout=60) as response:
                return response.read()
        except Exception as error:
            if attempt == 3:
                raise
            time.sleep(2 * (attempt + 1))
    raise RuntimeError('unreachable')


def dhash(image: Image.Image) -> int:
    small = image.convert('L').resize((9, 8), Image.Resampling.LANCZOS)
    pixels = list(small.getdata())
    value = 0
    for row in range(8):
        for column in range(8):
            left = pixels[row * 9 + column]
            right = pixels[row * 9 + column + 1]
            value = (value << 1) | (1 if left > right else 0)
    return value


def distance(left: int, right: int) -> int:
    return (left ^ right).bit_count()


def load_hash(path: Path) -> int | None:
    try:
        with Image.open(path) as image:
            return dhash(image)
    except Exception:
        return None


def is_free(photo: dict) -> bool:
    return (photo.get('license') or UNKNOWN_LICENSE) != UNKNOWN_LICENSE


def same_object(left: dict, right: dict) -> bool:
    """Duplicate cards for one building may share a photo (e.g. 148 and 148b)."""
    def pairs(card: dict):
        result = set()
        for language in ('en', 'ka'):
            address = card.get('addresses', {}).get(language, '')
            for segment in re.split(r'\s+/\s+', address):
                segment = re.sub(r'\([^)]*\)', ' ', segment).strip(' ,')
                match = re.match(r'^(\d+[^\s]*?)\s+(.+)$', segment) or re.match(r'^(.+?)[,\s]+(\d+[^\s]*?)$', segment)
                if match:
                    street, number = (match.group(2), match.group(1)) if re.match(r'\d', segment) else (match.group(1), match.group(2))
                    street = re.sub(r'[^\w\u10d0-\u10ff ]', ' ', street.lower())
                    street = ' '.join(street.split())
                    result.add((street, tuple(re.findall(r'\d+', number))))
        return result
    left_pairs, right_pairs = pairs(left), pairs(right)
    if left_pairs & right_pairs:
        return True
    name_left = re.sub(r'[^\w ]', '', left.get('names', {}).get('en', '').lower()).strip()
    name_right = re.sub(r'[^\w ]', '', right.get('names', {}).get('en', '').lower()).strip()
    return bool(name_left and name_left == name_right and len(name_left) > 8)


def prepare_image(data: bytes, target_width: int) -> tuple[Image.Image, int]:
    image = Image.open(io.BytesIO(data))
    image = ImageOps.exif_transpose(image)
    if image.mode not in ('RGB', 'L'):
        image = image.convert('RGB')
    width = min(image.width, target_width)
    if width < image.width:
        height = max(1, round(image.height * width / image.width))
        image = image.resize((width, height), Image.Resampling.LANCZOS)
    return image, width


def modifications(width: int, original_width: int) -> str:
    if width < original_width:
        return f'уменьшен размер до {width} px по ширине, преобразовано в WebP'
    return 'преобразовано в WebP'


def renumber(card: dict) -> None:
    """Rename files so <n>.webp follows the new photos[] order."""
    city = 'tbilisi'
    directory = photo_dir(card['id'], city)
    previews = thumb_dir(card['id'], city)
    previews.mkdir(parents=True, exist_ok=True)
    photos = card.get('photos', [])
    if not photos:
        return
    pending = []
    for position, photo in enumerate(photos, start=1):
        old = ROOT / 'data' / photo['file']
        pending.append((position, photo, old, previews / old.name))
    # Move everything to temporary names first so old and new numbers cannot collide.
    for position, photo, old, old_thumb in pending:
        temp = directory / f'__tmp-{position}.webp'
        temp_thumb = previews / f'__tmp-{position}.webp'
        if old.exists():
            old.replace(temp)
        if old_thumb.exists():
            old_thumb.replace(temp_thumb)
    for position, photo, _, _ in pending:
        temp = directory / f'__tmp-{position}.webp'
        temp_thumb = previews / f'__tmp-{position}.webp'
        full = directory / f'{position}.webp'
        thumb = previews / f'{position}.webp'
        if temp.exists():
            temp.replace(full)
        if temp_thumb.exists():
            temp_thumb.replace(thumb)
        photo['file'] = f'photos/{city}/{card["id"]}/{position}.webp'
        photo['thumb'] = f'thumbnails/{city}/{card["id"]}/{position}.webp'
    # Remove stale numbered files beyond the new gallery length.
    keep = {f'{index}.webp' for index in range(1, len(photos) + 1)}
    for path in directory.glob('*.webp'):
        if path.name.startswith('__tmp-'):
            path.unlink(missing_ok=True)
        elif path.name not in keep:
            path.unlink(missing_ok=True)
    for path in previews.glob('*.webp'):
        if path.name.startswith('__tmp-'):
            path.unlink(missing_ok=True)
        elif path.name not in keep:
            path.unlink(missing_ok=True)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--dry-run', action='store_true')
    parser.add_argument('--only', help='card ids, comma separated')
    parser.add_argument('--no-upgrade', action='store_true', help='do not re-fetch existing free photos')
    args = parser.parse_args()

    payload = json.loads(CANDIDATES.read_text(encoding='utf-8'))
    candidate_cards: dict[str, list[dict]] = payload.get('cards', {})
    existing_meta: dict[str, dict] = payload.get('existing', {})
    selection = json.loads(SELECTION.read_text(encoding='utf-8'))['items'] if SELECTION.exists() else None
    cards = read_cards()
    wanted = {value.strip() for value in args.only.split(',')} if args.only else set(cards)

    # A Commons file should illustrate one atlas object; shared files are ambiguous.
    used_titles = {}
    for card in cards.values():
        for photo in card.get('photos', []):
            source = photo.get('source') or ''
            if '/wiki/File:' in source:
                used_titles[urllib.parse.unquote(source.split('/wiki/', 1)[1])] = card['id']

    touched, added_total, upgraded_total = [], 0, 0
    report = {'date': time.strftime('%Y-%m-%dT%H:%M:%S%z'), 'target': TARGET,
              'free_width': FREE_WIDTH, 'unknown_width': UNKNOWN_WIDTH,
              'cards': {}}

    progress = Progress(len(cards), 'attach gallery photos')
    progress.start(f'{len(cards)} cards, target {TARGET} photos')
    for card_id in sorted(cards):
        card = cards[card_id]
        if card_id not in wanted:
            progress.advance(f'{card_id}: skipped')
            continue
        before = len(card.get('photos', []))
        entry = {'before': before, 'added': [], 'upgraded': 0, 'skipped': []}

        # 1. Re-fetch existing free photos at up to 1920 px instead of the old 1000 px cap.
        if not args.no_upgrade:
            for photo in card.get('photos', []):
                source = photo.get('source') or ''
                title = urllib.parse.unquote(source.split('/wiki/', 1)[1]) if '/wiki/File:' in source else None
                meta = existing_meta.get(title) if title else None
                if not meta or not is_free(photo) or meta.get('width', 0) <= 1400:
                    continue
                current = ROOT / 'data' / photo['file']
                try:
                    with Image.open(current) as opened:
                        current_width = opened.width
                except Exception:
                    current_width = 0
                if current_width >= min(FREE_WIDTH, meta['width']):
                    continue
                if args.dry_run:
                    entry['upgraded'] += 1
                    upgraded_total += 1
                    continue
                try:
                    try:
                        raw = fetch(meta['thumbUrl'] or meta['url'])
                    except Exception:
                        # Commons rejects thumbnail widths outside its allowed list.
                        raw = fetch(meta['url'])
                    image, width = prepare_image(raw, FREE_WIDTH)
                    image.save(current, 'WEBP', quality=QUALITY, method=4)
                    photo['modifications'] = modifications(width, meta['width'])
                    entry['upgraded'] += 1
                    upgraded_total += 1
                except Exception as error:
                    entry['skipped'].append(f'upgrade {photo["file"]}: {error}')
                time.sleep(0.1)

        # 2. Add new photos until the gallery reaches TARGET.
        selected_sources = None
        if selection is not None:
            selected_sources = set(selection.get(card_id, []))
            if not selected_sources:
                progress.advance(f'{card_id}: no curated additions')
                entry['after'] = before
                report['cards'][card_id] = entry
                continue
        existing_hashes = []
        for photo in card.get('photos', []):
            value = load_hash(ROOT / 'data' / photo['file'])
            if value is not None:
                existing_hashes.append(value)
        new_photos = []
        for candidate in candidate_cards.get(card_id, []):
            if len(card.get('photos', [])) + len(new_photos) >= min(TARGET, MAX_PHOTOS):
                break
            title = candidate.get('title')
            if selected_sources is not None and candidate.get('source') not in selected_sources:
                continue
            if not title:
                continue
            if title in used_titles and used_titles[title] != card_id and not same_object(card, cards[used_titles[title]]):
                entry['skipped'].append(f'shared {title}')
                continue
            if any(photo.get('source') == candidate.get('source') for photo in card.get('photos', [])):
                continue
            url = candidate.get('thumbUrl') or candidate.get('url')
            if not url:
                continue
            try:
                raw = fetch(url)
                image, width = prepare_image(raw, FREE_WIDTH)
            except Exception as error:
                entry['skipped'].append(f'download {title}: {error}')
                continue
            value = dhash(image)
            if any(distance(value, known) <= 5 for known in existing_hashes):
                entry['skipped'].append(f'duplicate {title}')
                continue
            if args.dry_run:
                existing_hashes.append(value)
                new_photos.append({'title': title, 'width': width})
                continue
            directory = photo_dir(card_id)
            directory.mkdir(parents=True, exist_ok=True)
            index = 1
            while (directory / f'{index}.webp').exists():
                index += 1
            target = directory / f'{index}.webp'
            image.save(target, 'WEBP', quality=QUALITY, method=4)
            photo = {
                'file': f'photos/tbilisi/{card_id}/{index}.webp',
                'thumb': f'thumbnails/tbilisi/{card_id}/{index}.webp',
                'author': candidate['author'],
                'license': candidate['license'],
                'licenseUrl': candidate['licenseUrl'],
                'source': candidate['source'],
                'modifications': modifications(width, candidate['width']),
            }
            card.setdefault('photos', []).append(photo)
            existing_hashes.append(value)
            new_photos.append(photo)
            used_titles[title] = card_id
            entry['added'].append(title)
            added_total += 1
            time.sleep(0.1)

        if args.dry_run:
            if new_photos or entry['upgraded']:
                touched.append(card_id)
            if new_photos or entry['upgraded']:
                report['cards'][card_id] = entry
            progress.advance(f'{card_id}: +{len(new_photos)}')
            continue

        # 3. Put free photos before the registry fallback and keep numbering aligned.
        photos = card.get('photos', [])
        if photos and any(not is_free(photo) for photo in photos) and any(is_free(photo) for photo in photos):
            free = [photo for photo in photos if is_free(photo)]
            fallback = [photo for photo in photos if not is_free(photo)]
            ordered = free + fallback
            if ordered != photos:
                card['photos'] = ordered
                renumber(card)
        entry['after'] = len(card.get('photos', []))
        if entry['added'] or entry['upgraded'] or entry['after'] != before:
            write_card(card)
            touched.append(card_id)
            report['cards'][card_id] = entry
        progress.advance(f'{card_id}: {before}->{entry["after"]}')

    progress.finish()
    report['cards_touched'] = len(touched)
    report['added'] = added_total
    report['upgraded'] = upgraded_total
    report['dry_run'] = args.dry_run
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'Cards touched: {len(touched)}; new photos: {added_total}; upgraded: {upgraded_total}; '
          f'dry-run: {args.dry_run}; report: {REPORT.relative_to(ROOT)}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())

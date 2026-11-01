#!/usr/bin/env python3
"""Review and attach the full photo set of a Georgian registry record.

The registry's public object API exposes every file of a record in
``photoIds``. The old fallback path used only ``PhotoAddress``, which is
usually one small image; records often contain the same shot twice (a small
copy and a 640 px copy) and several different views. This script keeps the
review and the write step separate:

  # 1. Fetch every file, record dimensions/perceptual hashes and make contact
  #    sheets for a visual check. Nothing is written to the atlas cards.
  python3 scripts/fetch-registry-photos.py --review --only osm-1207173721

  # 2. After the visual check, put the chosen registry photo ids in
  #    data/registry-photo-selection.json and apply them.
  python3 scripts/fetch-registry-photos.py --apply --only osm-1207173721

Review artifacts live under work/registry-photos/<card-id>/: object.json,
originals/<registry-photo-id>.bin, index.json and review/sheet-*.jpg. The
apply step reuses that cache, so photos are downloaded once.

Rules enforced by the script:
  * selected registry photos are capped at 1200 px and never upscaled;
  * old photos of the same registry record are removed from the card, so a
    lower-resolution duplicate is replaced by the chosen higher-resolution
    copy;
  * up to four different views are allowed, three are the target;
  * fewer than three selected photos require --allow-fewer and are reported
    as an honest gap, not padded with another building;
  * visualTags from the reviewed selection are written with the sidecar.

Usage:
  python3 scripts/fetch-registry-photos.py --review --only osm-1207173721
  python3 scripts/fetch-registry-photos.py --apply --only osm-1207173721
  python3 scripts/fetch-registry-photos.py --apply --dry-run
"""
from __future__ import annotations

import argparse
import hashlib
import io
import json
import re
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

from PIL import Image, ImageDraw, ImageFont, ImageOps

from atlas_source import (
    PHOTO_QUALITY,
    ROOT,
    UNKNOWN_PHOTO_WIDTH,
    fit_width,
    photo_metadata_path,
    photo_path,
    read_cards,
    read_photo_metadata,
    save_photo,
    thumb_path,
    write_card,
    write_photo_metadata,
)
from progress import Progress

API = 'https://memkvidreoba.gov.ge/api/Immovable/GetImmovableObject?id={registry_id}'
FALLBACKS = ROOT / 'data' / 'photo-fallbacks.json'
SELECTION = ROOT / 'data' / 'registry-photo-selection.json'
TAXONOMY = ROOT / 'data' / 'photo-visual-tags.json'
WORK = ROOT / 'work' / 'registry-photos'
REPORT = WORK / 'applied.json'
USER_AGENT = 'TbilisiArchitectureAtlasPhotos/1.3 (educational atlas research)'
REGISTRY_AUTHOR = 'Реестр памятников Грузии (автор не указан)'
UNKNOWN_LICENSE = 'Не установлена'
TARGET = 3
MAX_PHOTOS = 4
SHEET_SIZE = 6
SHEET_COLUMNS = 3
CELL_W = 420
CELL_H = 330
LABEL_H = 28
NEAR_DUPLICATE_DISTANCE = 16
EXACT_DUPLICATE_DISTANCE = 5
REGISTRY_ID_RE = re.compile(r'immovableObject\?id=(\d+)')


def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding='utf-8'))


def write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def fetch(url: str, attempts: int = 4) -> bytes:
    for attempt in range(attempts):
        try:
            request = urllib.request.Request(url, headers={'User-Agent': USER_AGENT})
            with urllib.request.urlopen(request, timeout=90) as response:
                return response.read()
        except urllib.error.HTTPError as error:
            error.close()
            if attempt == attempts - 1:
                raise
            wait = 5 * (2 ** attempt) if error.code == 429 else 2 * (attempt + 1)
            try:
                wait = max(wait, int(error.headers.get('Retry-After', '0')))
            except (TypeError, ValueError):
                pass
            time.sleep(min(wait, 60))
        except Exception:
            if attempt == attempts - 1:
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


def distance(left: str, right: str) -> int:
    return (int(left, 16) ^ int(right, 16)).bit_count()


def registry_id_from_value(value: str | None) -> int | None:
    if not value:
        return None
    match = REGISTRY_ID_RE.search(value)
    return int(match.group(1)) if match else None


def fallback_items() -> dict[str, dict]:
    if not FALLBACKS.exists():
        return {}
    return read_json(FALLBACKS).get('items', {})


def registry_id_for(card: dict, fallbacks: dict[str, dict]) -> int | None:
    """Find the registry record through the card, fallback entry or sidecars."""
    for value in (card.get('source'), card.get('otherSource'), fallbacks.get(card['id'], {}).get('record')):
        found = registry_id_from_value(value)
        if found is not None:
            return found
    for photo_id in card.get('photos', []):
        metadata = read_photo_metadata(photo_id) or {}
        found = registry_id_from_value(metadata.get('licenseUrl'))
        if found is not None:
            return found
    return None


def card_dir(card_id: str) -> Path:
    return WORK / card_id


def object_path(card_id: str) -> Path:
    return card_dir(card_id) / 'object.json'


def original_path(card_id: str, registry_photo_id: int) -> Path:
    return card_dir(card_id) / 'originals' / f'{registry_photo_id}.bin'


def index_path(card_id: str) -> Path:
    return card_dir(card_id) / 'index.json'


def review_dir(card_id: str) -> Path:
    return card_dir(card_id) / 'review'


def load_object(card_id: str, registry_id: int, refresh: bool) -> dict:
    path = object_path(card_id)
    if path.exists() and not refresh:
        return read_json(path)
    payload = json.loads(fetch(API.format(registry_id=registry_id)))
    write_json(path, payload)
    return payload


def load_original(card_id: str, photo: dict, refresh: bool) -> bytes:
    path = original_path(card_id, int(photo['id']))
    if path.exists() and not refresh:
        return path.read_bytes()
    raw = fetch(photo['docFile'])
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(raw)
    return raw


def font() -> ImageFont.ImageFont:
    path = Path('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf')
    try:
        return ImageFont.truetype(str(path), 15)
    except Exception:
        return ImageFont.load_default()


def sheet_name(number: int) -> str:
    return f'sheet-{number:03d}.jpg'


def make_sheets(card_id: str, photos: list[dict]) -> list[str]:
    out_dir = review_dir(card_id)
    out_dir.mkdir(parents=True, exist_ok=True)
    for old in out_dir.glob('sheet-*.jpg'):
        old.unlink()
    label_font = font()
    sheets: list[str] = []
    for offset in range(0, len(photos), SHEET_SIZE):
        batch = photos[offset:offset + SHEET_SIZE]
        number = offset // SHEET_SIZE + 1
        rows = (len(batch) + SHEET_COLUMNS - 1) // SHEET_COLUMNS
        sheet = Image.new('RGB', (CELL_W * SHEET_COLUMNS, (CELL_H + LABEL_H) * rows), 'white')
        draw = ImageDraw.Draw(sheet)
        for index, photo in enumerate(batch):
            with Image.open(original_path(card_id, int(photo['id']))) as opened:
                image = ImageOps.exif_transpose(opened).convert('RGB')
                image.thumbnail((CELL_W - 10, CELL_H - 10), Image.Resampling.LANCZOS)
            column = index % SHEET_COLUMNS
            row = index // SHEET_COLUMNS
            x = column * CELL_W
            y = row * (CELL_H + LABEL_H)
            sheet.paste(image, (x + (CELL_W - image.width) // 2, y + (CELL_H - image.height) // 2))
            marker = ' DUP' if photo.get('exactDuplicateOf') else ''
            label = f'{offset + index + 1}. {photo["id"]} {photo["width"]}x{photo["height"]}{marker}'
            draw.text((x + 5, y + CELL_H + 4), label, fill='black', font=label_font)
        name = sheet_name(number)
        sheet.save(out_dir / name, 'JPEG', quality=88)
        sheets.append(name)
    return sheets


def review_card(card: dict, registry_id: int, refresh: bool, progress: Progress | None = None) -> dict:
    payload = load_object(card['id'], registry_id, refresh)
    photos: list[dict] = []
    errors: list[dict] = []
    entries = payload.get('photoIds') or []
    for entry in entries:
        photo_id = entry.get('id')
        url = entry.get('docFile')
        if photo_id is None or not url:
            errors.append({'photo': photo_id, 'error': 'missing id or file URL'})
            continue
        try:
            raw = load_original(card['id'], entry, refresh)
            image = Image.open(io.BytesIO(raw))
            image = ImageOps.exif_transpose(image)
            width, height = image.size
            digest = hashlib.sha256(raw).hexdigest()
            photos.append({
                'id': int(photo_id),
                'url': url,
                'objectName': entry.get('objectName'),
                'date': entry.get('date') or '',
                'author': entry.get('author') or '',
                'file': str(original_path(card['id'], int(photo_id)).relative_to(ROOT)),
                'sha256': digest,
                'width': width,
                'height': height,
                'dhash': f'{dhash(image):016x}',
            })
        except Exception as error:  # noqa: BLE001 - one bad file must not stop the record
            errors.append({'photo': photo_id, 'error': str(error)})

    by_digest: dict[str, list[dict]] = {}
    for photo in photos:
        by_digest.setdefault(photo['sha256'], []).append(photo)
    exact_groups = [group for group in by_digest.values() if len(group) > 1]
    for group in exact_groups:
        keep = max(group, key=lambda item: item['width'] * item['height'])
        for photo in group:
            if photo is not keep:
                photo['exactDuplicateOf'] = keep['id']

    near_pairs: list[dict] = []
    for left_index, left in enumerate(photos):
        for right in photos[left_index + 1:]:
            value = distance(left['dhash'], right['dhash'])
            if value <= NEAR_DUPLICATE_DISTANCE:
                near_pairs.append({
                    'a': left['id'],
                    'b': right['id'],
                    'distance': value,
                    'aSize': f'{left["width"]}x{left["height"]}',
                    'bSize': f'{right["width"]}x{right["height"]}',
                })
    near_pairs.sort(key=lambda item: item['distance'])

    index = {
        'schema': 1,
        'cardId': card['id'],
        'registryId': registry_id,
        'record': f'https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id={registry_id}',
        'objectName': payload.get('objectName'),
        'fetched': time.strftime('%Y-%m-%dT%H:%M:%S%z'),
        'photos': photos,
        'exactDuplicateGroups': [[photo['id'] for photo in group] for group in exact_groups],
        'nearDuplicatePairs': near_pairs,
        'errors': errors,
    }
    index['sheets'] = make_sheets(card['id'], photos)
    write_json(index_path(card['id']), index)
    if progress is not None:
        progress.advance(f'{card["id"]}: {len(photos)} photos')
    return index


def load_selection() -> dict[str, Any]:
    if not SELECTION.exists():
        raise SystemExit(f'{SELECTION.relative_to(ROOT)} does not exist; add a reviewed selection first')
    payload = read_json(SELECTION)
    items = payload.get('items')
    if not isinstance(items, dict):
        raise SystemExit(f'{SELECTION.relative_to(ROOT)}: items must be an object')
    return items


def selection_photos(entry: Any) -> tuple[list[dict], dict[str, list[str]]]:
    """Accept {photos:[{id, visualTags}]} and the compact [id, ...] form."""
    tags: dict[str, list[str]] = {}
    photos: list[dict] = []
    if isinstance(entry, list):
        values = entry
    elif isinstance(entry, dict):
        values = entry.get('photos') or []
    else:
        raise ValueError('selection entry must be an object or an array')
    for value in values:
        if isinstance(value, dict):
            photo_id = value.get('id')
            if value.get('visualTags') is not None:
                tags[str(photo_id)] = value['visualTags']
        else:
            photo_id = value
        if photo_id is None:
            raise ValueError('selected photo without id')
        photos.append({'id': int(photo_id)})
    return photos, tags


def validate_tags(photo_id: int, values: list[str], allowed: set[str]) -> list[str]:
    if not isinstance(values, list) or not values:
        raise ValueError(f'{photo_id}: visualTags must be a non-empty array')
    unknown = sorted({value for value in values if value not in allowed})
    if unknown:
        raise ValueError(f'{photo_id}: unknown visual tags: {", ".join(unknown)}')
    if len(set(values)) != len(values):
        raise ValueError(f'{photo_id}: duplicate visual tags')
    return values


def modifications(width: int, original_width: int) -> str:
    if width < original_width:
        return f'уменьшен размер до {width} px по ширине, преобразовано в WebP; полное качество не используется'
    return 'преобразовано в WebP; полное качество не используется'


def is_registry_photo(photo_id: str, record: str) -> bool:
    metadata = read_photo_metadata(photo_id) or {}
    if metadata.get('licenseUrl') == record:
        return True
    source = metadata.get('source') or ''
    return metadata.get('author') == REGISTRY_AUTHOR and 'memkvidreoba.gov.ge' in source


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument('--review', action='store_true', help='download and make contact sheets (default)')
    mode.add_argument('--apply', action='store_true', help='attach the reviewed selection')
    parser.add_argument('--only', help='card ids, comma separated')
    parser.add_argument('--refresh', action='store_true', help='ignore the work/registry-photos cache')
    parser.add_argument('--dry-run', action='store_true', help='validate --apply without writing cards or files')
    parser.add_argument('--allow-fewer', action='store_true', help='allow fewer than three photos')
    parser.add_argument('--limit', type=int, help='review at most this many cards')
    args = parser.parse_args()

    cards = read_cards()
    fallbacks = fallback_items()
    selected = {value.strip() for value in args.only.split(',')} if args.only else None

    if args.apply:
        return apply_selection(cards, fallbacks, selected, args)
    return review_all(cards, fallbacks, selected, args)


def review_all(cards: dict[str, dict], fallbacks: dict[str, dict], selected: set[str] | None, args: argparse.Namespace) -> int:
    if selected is not None:
        missing = sorted(selected - set(cards))
        if missing:
            raise SystemExit(f'unknown card ids: {", ".join(missing)}')
        card_ids = sorted(selected)
    else:
        card_ids = sorted(cards)
    if args.limit is not None:
        card_ids = card_ids[:args.limit]

    targets: list[tuple[dict, int]] = []
    skipped = 0
    for card_id in card_ids:
        card = cards[card_id]
        registry_id = registry_id_for(card, fallbacks)
        if registry_id is None:
            skipped += 1
            continue
        targets.append((card, registry_id))

    progress = Progress(len(targets), 'review registry photos')
    progress.start(f'{len(targets)} records, {skipped} cards without a registry id')
    errors = 0
    total_photos = 0
    for card, registry_id in targets:
        try:
            index = review_card(card, registry_id, args.refresh, progress)
            total_photos += len(index['photos'])
            if index['errors']:
                errors += len(index['errors'])
                for item in index['errors']:
                    print(f'ERROR {card["id"]} photo {item["photo"]}: {item["error"]}', file=sys.stderr)
        except Exception as error:  # noqa: BLE001 - continue with other records
            errors += 1
            print(f'ERROR {card["id"]}: {error}', file=sys.stderr)
            progress.advance(f'{card["id"]}: error')
    progress.finish()

    print(
        f'Review: {len(targets)} records, {total_photos} files, {skipped} skipped, {errors} errors; '
        f'artifacts in {WORK.relative_to(ROOT)}.'
    )
    for card, registry_id in targets:
        path = index_path(card['id'])
        if path.exists():
            index = read_json(path)
            sheets = ', '.join(index.get('sheets') or [])
            print(f'  {card["id"]} (record {registry_id}): {len(index["photos"])} photos; sheets: {sheets or "none"}')
    return 1 if errors else 0


def apply_selection(cards: dict[str, dict], fallbacks: dict[str, dict], selected: set[str] | None, args: argparse.Namespace) -> int:
    items = load_selection()
    if selected is None:
        selected = set(items)
    unknown = sorted(selected - set(cards))
    if unknown:
        raise SystemExit(f'unknown card ids: {", ".join(unknown)}')
    missing_selection = sorted(selected - set(items))
    if missing_selection:
        raise SystemExit(f'no reviewed selection for: {", ".join(missing_selection)}')

    taxonomy = read_json(TAXONOMY)
    allowed_tags = {item['id'] for item in taxonomy['tags']}
    progress = Progress(len(selected), 'attach registry photos')
    progress.start(f'{len(selected)} cards')
    touched: list[str] = []
    dropped_ids: set[str] = set()
    created_ids: set[str] = set()
    errors: list[str] = []
    added_total = 0
    report_cards: dict[str, dict] = {}

    for card_id in sorted(selected):
        card = cards[card_id]
        entry = items[card_id]
        try:
            photos, tags = selection_photos(entry)
        except ValueError as error:
            errors.append(f'{card_id}: {error}')
            progress.advance(f'{card_id}: invalid selection')
            continue
        if len(photos) > MAX_PHOTOS:
            errors.append(f'{card_id}: {len(photos)} selected, maximum is {MAX_PHOTOS}')
            progress.advance(f'{card_id}: too many')
            continue
        if len(photos) < TARGET and not args.allow_fewer:
            errors.append(f'{card_id}: {len(photos)} selected, need {TARGET}; use --allow-fewer for an honest gap')
            progress.advance(f'{card_id}: too few')
            continue

        registry_id = registry_id_for(card, fallbacks)
        if registry_id is None:
            errors.append(f'{card_id}: cannot resolve registry record')
            progress.advance(f'{card_id}: no record')
            continue
        if isinstance(entry, dict) and entry.get('registryId') is not None and int(entry['registryId']) != registry_id:
            errors.append(f'{card_id}: selection registryId {entry["registryId"]} does not match {registry_id}')
            progress.advance(f'{card_id}: registry mismatch')
            continue

        index = read_json(index_path(card_id)) if index_path(card_id).exists() else review_card(card, registry_id, args.refresh)
        by_id = {int(photo['id']): photo for photo in index['photos']}
        chosen: list[dict] = []
        chosen_tags: dict[int, list[str]] = {}
        for photo in photos:
            photo_id = photo['id']
            if photo_id not in by_id:
                errors.append(f'{card_id}: registry photo {photo_id} is not in record {registry_id}')
                break
            if str(photo_id) in tags:
                try:
                    chosen_tags[photo_id] = validate_tags(photo_id, tags[str(photo_id)], allowed_tags)
                except ValueError as error:
                    errors.append(f'{card_id}: {error}')
                    break
            chosen.append(by_id[photo_id])
        if len(chosen) != len(photos):
            progress.advance(f'{card_id}: invalid selection')
            continue

        record = index['record']
        new_ids: list[str] = []
        created_here: list[str] = []
        failed = False
        for photo in chosen:
            try:
                raw = load_original(card_id, photo, args.refresh)
                image = Image.open(io.BytesIO(raw))
                image = ImageOps.exif_transpose(image)
                if image.mode not in ('RGB', 'L'):
                    image = image.convert('RGB')
                original_width = image.width
                image = fit_width(image, UNKNOWN_PHOTO_WIDTH)
                width = image.width
                if args.dry_run:
                    print(f'would attach {card_id}: registry {photo["id"]} {original_width}px -> {width}px')
                    new_ids.append(f'dry-run-{photo["id"]}')
                    continue
                new_id = save_photo(image, quality=PHOTO_QUALITY, method=4)
                metadata = {
                    'author': REGISTRY_AUTHOR,
                    'license': UNKNOWN_LICENSE,
                    'licenseUrl': record,
                    'source': photo['url'],
                    'modifications': modifications(width, original_width),
                    'description': 'Фото реестра памятников; автор и лицензия не установлены',
                }
                if photo['id'] in chosen_tags:
                    metadata['visualTags'] = chosen_tags[photo['id']]
                try:
                    write_photo_metadata(new_id, metadata)
                except ValueError as error:
                    existing = read_photo_metadata(new_id) or {}
                    if existing.get('author') != REGISTRY_AUTHOR or 'memkvidreoba.gov.ge' not in (existing.get('source') or ''):
                        raise
                    if photo['id'] in chosen_tags:
                        existing['visualTags'] = chosen_tags[photo['id']]
                        write_photo_metadata(new_id, existing, replace_tags=('visualTags',))
                    print(f'kept existing sidecar for {new_id[:12]}: {error}', file=sys.stderr)
                new_ids.append(new_id)
                created_here.append(new_id)
            except Exception as error:  # noqa: BLE001 - one photo must not corrupt the card
                errors.append(f'{card_id}: registry photo {photo["id"]}: {error}')
                failed = True
                break
        if failed:
            if not args.dry_run:
                used = {value for item in cards.values() for value in item.get('photos', [])}
                for photo_id in created_here:
                    if photo_id not in used:
                        photo_path(photo_id).unlink(missing_ok=True)
                        photo_metadata_path(photo_id).unlink(missing_ok=True)
            progress.advance(f'{card_id}: failed')
            continue

        old_registry = [photo_id for photo_id in card.get('photos', []) if is_registry_photo(photo_id, record)]
        kept = [photo_id for photo_id in card.get('photos', []) if photo_id not in old_registry]
        ordered: list[str] = []
        for photo_id in kept + new_ids:
            if photo_id not in ordered:
                ordered.append(photo_id)
        before = len(card.get('photos', []))
        if args.dry_run:
            print(f'would set {card_id}: {before} -> {len(ordered)} photos (drop {len(old_registry)} old registry photos)')
            progress.advance(f'{card_id}: dry-run')
            continue
        card['photos'] = ordered
        write_card(card)
        touched.append(card_id)
        report_cards[card_id] = {
            'registryId': registry_id,
            'before': before,
            'after': len(ordered),
            'selected': [photo['id'] for photo in chosen],
            'dropped': old_registry,
            'attached': created_here,
            'widths': [
                {
                    'registryPhotoId': photo['id'],
                    'sourceWidth': photo['width'],
                    'sourceHeight': photo['height'],
                }
                for photo in chosen
            ],
        }
        dropped_ids.update(old_registry)
        created_ids.update(created_here)
        added_total += len(created_here)
        progress.advance(f'{card_id}: {before}->{len(ordered)}')
    progress.finish()

    removed = 0
    if not args.dry_run:
        used = {photo_id for card in cards.values() for photo_id in card.get('photos', [])}
        for photo_id in dropped_ids:
            if photo_id in used:
                continue
            for path in (photo_path(photo_id), photo_metadata_path(photo_id), thumb_path(photo_id)):
                if path.exists():
                    path.unlink()
                    removed += 1
        # A failed later card must not leave files that no card references.
        for photo_id in created_ids:
            if photo_id in used:
                continue
            for path in (photo_path(photo_id), photo_metadata_path(photo_id), thumb_path(photo_id)):
                if path.exists():
                    path.unlink()
                    removed += 1

    if not args.dry_run:
        write_json(REPORT, {
            'date': time.strftime('%Y-%m-%dT%H:%M:%S%z'),
            'cards': report_cards,
            'attached': added_total,
            'released': len(dropped_ids),
            'removedFiles': removed,
            'errors': errors,
        })
    for error in errors:
        print(f'ERROR {error}', file=sys.stderr)
    skipped = len(selected) - len(touched)
    print(
        f'Registry photos: {len(selected)} cards, {len(touched)} updated, {skipped} skipped, '
        f'{added_total} files attached, {len(dropped_ids)} old registry photos released, '
        f'{removed} files removed, {len(errors)} errors.'
    )
    return 1 if errors else 0


if __name__ == '__main__':
    raise SystemExit(main())

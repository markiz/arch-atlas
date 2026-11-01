#!/usr/bin/env python3
"""Build one review sheet per registry-backed card for a batch gallery pass.

This is the preparation step for updating every atlas card that currently
uses a registry photo. It:

* resolves each card's registry record and keeps cards that already have a
  registry photo (free-only cards are left alone);
* fetches the full record and all `photoIds` with a bounded thread pool;
* computes dimensions, perceptual hash, sky share and edge density;
* shortlists up to 12 candidates per card, always including the highest
  resolution duplicate of the current photo and the first distinct general
  views, then adds high-sky, high-edge and hash-diverse candidates;
* writes one contact sheet and one `index.json` per card under
  `work/registry-batch/<card-id>/`.

Nothing is written to the atlas cards. A reviewer reads the sheet and writes
`work/registry-batch/selections/<card-id>.json`; the apply step is
`scripts/fetch-registry-photos.py --apply --selection-dir ...`.

Usage:
  python3 scripts/batch-registry-review.py --dry-run
  python3 scripts/batch-registry-review.py --jobs 12
  python3 scripts/batch-registry-review.py --only osm-1207173721,osm-415940826
  python3 scripts/batch-registry-review.py --limit 10
"""
from __future__ import annotations

import argparse
import concurrent.futures
import importlib.util
import io
import json
import math
import sys
import time
from pathlib import Path
from typing import Any

from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageOps

from atlas_source import ROOT, read_cards, read_photo_metadata
from progress import Progress

SHORTLIST_SIZE = 12
SHEET_COLUMNS = 3
CELL_W = 420
CELL_H = 330
LABEL_H = 28
WORK = ROOT / 'work' / 'registry-batch'
SELECTION_DIR = WORK / 'selections'
INDEX = WORK / 'index.json'


def load_registry_module():
    path = ROOT / 'scripts' / 'fetch-registry-photos.py'
    spec = importlib.util.spec_from_file_location('registry_photos', path)
    if spec is None or spec.loader is None:
        raise SystemExit(f'cannot load {path}')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


REGISTRY = load_registry_module()


def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding='utf-8'))


def write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def registry_photo_ids(card: dict, record: str) -> list[str]:
    return [
        photo_id
        for photo_id in card.get('photos', [])
        if REGISTRY.is_registry_photo(photo_id, record)
    ]


def features(raw: bytes) -> dict:
    image = Image.open(io.BytesIO(raw))
    image = ImageOps.exif_transpose(image).convert('RGB')
    width, height = image.size
    top = image.crop((0, 0, width, max(1, height // 4))).resize((80, 80), Image.Resampling.BILINEAR)
    pixels = list(top.getdata())
    sky = sum(
        1
        for red, green, blue in pixels
        if (blue > 150 and blue > red + 10) or (red > 180 and green > 180 and blue > 180)
    ) / len(pixels)
    gray = ImageOps.grayscale(image).resize((160, 160), Image.Resampling.BILINEAR)
    edges = gray.filter(ImageFilter.FIND_EDGES)
    edge = sum(edges.getdata()) / (160 * 160)
    return {
        'width': width,
        'height': height,
        'sky': round(sky, 3),
        'edge': round(edge, 1),
        'aspect': round(width / height, 3),
    }


def shortlist(photos: list[dict], current_ids: set[int]) -> tuple[list[dict], dict]:
    """Return up to SHORTLIST_SIZE candidates and the selected duplicate."""
    if not photos:
        return [], {}
    ordered = list(photos)
    selected: list[dict] = []
    reasons: dict[int, str] = {}

    def add(photo: dict, reason: str) -> None:
        if photo['id'] in {item['id'] for item in selected}:
            return
        if len(selected) >= SHORTLIST_SIZE:
            return
        selected.append(photo)
        reasons[photo['id']] = reason

    duplicate = None
    current_photo = next((photo for photo in ordered if photo['id'] in current_ids), None)
    if current_photo is not None:
        candidates = [
            photo
            for photo in ordered
            if photo['id'] != current_photo['id']
            and photo['width'] * photo['height'] >= current_photo['width'] * current_photo['height']
        ]
        if candidates:
            candidate = min(
                candidates,
                key=lambda photo: (
                    REGISTRY.distance(photo['dhash'], current_photo['dhash']),
                    -photo['width'] * photo['height'],
                ),
            )
            if REGISTRY.distance(candidate['dhash'], current_photo['dhash']) <= 20:
                duplicate = candidate
    if duplicate is not None:
        add(duplicate, 'high-res duplicate of current')
    elif current_photo is not None:
        add(current_photo, 'current photo (no larger duplicate)')

    # Early survey views are often the overall shots; keep the first distinct
    # three so the reviewer is not left with details only.
    start = ordered.index(duplicate) + 1 if duplicate is not None else 0
    for photo in ordered[start:] + ordered[:start]:
        if len([item for item in selected if reasons.get(item['id']) == 'early view']) >= 3:
            break
        if photo['id'] in {item['id'] for item in selected}:
            continue
        add(photo, 'early view')

    for photo in sorted(ordered, key=lambda item: (-item['sky'], -item['width'] * item['height'])):
        add(photo, 'high sky share')
        if len(selected) >= 8:
            break

    for photo in sorted(ordered, key=lambda item: (-item['edge'], -item['width'] * item['height'])):
        add(photo, 'high edge density')
        if len(selected) >= 11:
            break

    while len(selected) < SHORTLIST_SIZE:
        remaining = [photo for photo in ordered if photo['id'] not in {item['id'] for item in selected}]
        if not remaining:
            break
        best = max(
            remaining,
            key=lambda photo: min(
                REGISTRY.distance(photo['dhash'], chosen['dhash']) for chosen in selected
            ),
        )
        add(best, 'hash-diverse fill')

    return selected, reasons


def label_font() -> ImageFont.ImageFont:
    try:
        return ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 14)
    except Exception:
        return ImageFont.load_default()


def make_sheet(card_id: str, photos: list[dict], reasons: dict[int, str], current_ids: set[int]) -> str:
    out_dir = WORK / card_id
    out_dir.mkdir(parents=True, exist_ok=True)
    rows = max(1, math.ceil(len(photos) / SHEET_COLUMNS))
    sheet = Image.new('RGB', (CELL_W * SHEET_COLUMNS, (CELL_H + LABEL_H) * rows), 'white')
    draw = ImageDraw.Draw(sheet)
    font = label_font()
    for index, photo in enumerate(photos):
        with Image.open(ROOT / photo['file']) as opened:
            image = ImageOps.exif_transpose(opened).convert('RGB')
            image.thumbnail((CELL_W - 10, CELL_H - 10), Image.Resampling.LANCZOS)
        column = index % SHEET_COLUMNS
        row = index // SHEET_COLUMNS
        x = column * CELL_W
        y = row * (CELL_H + LABEL_H)
        sheet.paste(image, (x + (CELL_W - image.width) // 2, y + (CELL_H - image.height) // 2))
        marker = ' CUR' if photo['id'] in current_ids else ''
        label = f'{index + 1}. {photo["id"]} {photo["width"]}x{photo["height"]}{marker}'
        draw.text((x + 5, y + CELL_H + 3), label, fill='black', font=font)
        reason = reasons.get(photo['id'], '')
        if reason:
            draw.text((x + 5, y + CELL_H + 15), reason[:48], fill='#555555', font=font)
    name = 'sheet.jpg'
    sheet.save(out_dir / name, 'JPEG', quality=88)
    return name


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--only', help='card ids, comma separated')
    parser.add_argument('--limit', type=int, help='stop after this many cards')
    parser.add_argument('--jobs', type=int, default=12, help='parallel downloads (default 12)')
    parser.add_argument('--refresh', action='store_true', help='ignore cached registry JSON and files')
    parser.add_argument('--dry-run', action='store_true', help='list cards without downloading')
    args = parser.parse_args()
    if args.jobs < 1:
        raise SystemExit('--jobs must be positive')

    cards = read_cards()
    fallbacks = REGISTRY.fallback_items()
    wanted = {value.strip() for value in args.only.split(',')} if args.only else None
    if wanted is not None:
        missing = sorted(wanted - set(cards))
        if missing:
            raise SystemExit(f'unknown card ids: {", ".join(missing)}')

    targets: list[tuple[dict, int, list[str]]] = []
    skipped = 0
    for card_id in sorted(cards):
        if wanted is not None and card_id not in wanted:
            continue
        card = cards[card_id]
        registry_id = REGISTRY.registry_id_for(card, fallbacks)
        if registry_id is None:
            skipped += 1
            continue
        record = f'https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id={registry_id}'
        current = registry_photo_ids(card, record)
        if not current:
            skipped += 1
            continue
        targets.append((card, registry_id, current))
    if args.limit is not None:
        targets = targets[:args.limit]

    if args.dry_run:
        for card, registry_id, current in targets:
            print(f'would review {card["id"]} (record {registry_id}, current {len(current)})')
        print(f'Dry run: {len(targets)} cards, {skipped} skipped.')
        return 0

    started = time.monotonic()
    objects: dict[str, dict] = {}
    entries: dict[str, list[dict]] = {}
    errors: list[dict] = []

    fetch_progress = Progress(len(targets), 'fetch registry objects')
    fetch_progress.start(f'{len(targets)} cards, {skipped} skipped')

    def fetch_one(item: tuple[dict, int, list[str]]) -> tuple[str, dict | None, list[dict], str | None]:
        card, registry_id, _current = item
        try:
            payload = REGISTRY.load_object(card['id'], registry_id, args.refresh)
            return card['id'], payload, payload.get('photoIds') or [], None
        except Exception as error:  # noqa: BLE001 - one record must not stop the batch
            return card['id'], None, [], str(error)

    with concurrent.futures.ThreadPoolExecutor(max_workers=min(8, args.jobs)) as pool:
        futures = [pool.submit(fetch_one, item) for item in targets]
        for future in concurrent.futures.as_completed(futures):
            card_id, payload, photos, error = future.result()
            if error:
                errors.append({'card': card_id, 'stage': 'object', 'error': error})
                fetch_progress.advance(f'{card_id}: error')
                continue
            objects[card_id] = payload or {}
            entries[card_id] = photos
            fetch_progress.advance(f'{card_id}: {len(photos)} photos')
    fetch_progress.finish()

    tasks: list[tuple[str, dict]] = []
    for card, _registry_id, _current in targets:
        if card['id'] not in objects:
            continue
        for entry in entries.get(card['id'], []):
            if entry.get('docFile') and entry.get('id') is not None:
                tasks.append((card['id'], entry))

    download_progress = Progress(len(tasks), 'download registry photos')
    download_progress.start(f'{len(tasks)} files across {len(objects)} cards')
    photos_by_card: dict[str, list[dict]] = {card_id: [] for card_id in objects}

    def download_one(task: tuple[str, dict]) -> tuple[str, dict | None, str | None]:
        card_id, entry = task
        try:
            raw = REGISTRY.load_original(card_id, entry, args.refresh)
            result = features(raw)
            result.update({
                'id': int(entry['id']),
                'url': entry['docFile'],
                'objectName': entry.get('objectName'),
                'date': entry.get('date') or '',
                'file': str(REGISTRY.original_path(card_id, int(entry['id'])).relative_to(ROOT)),
            })
            return card_id, result, None
        except Exception as error:  # noqa: BLE001 - one photo must not stop the batch
            return card_id, None, f'{entry.get("id")}: {error}'

    with concurrent.futures.ThreadPoolExecutor(max_workers=args.jobs) as pool:
        futures = [pool.submit(download_one, task) for task in tasks]
        for future in concurrent.futures.as_completed(futures):
            card_id, result, error = future.result()
            if error:
                errors.append({'card': card_id, 'stage': 'photo', 'error': error})
                download_progress.advance(f'{card_id}: error')
                continue
            if result is not None:
                with Image.open(ROOT / result['file']) as opened:
                    result['dhash'] = f'{REGISTRY.dhash(opened):016x}'
                photos_by_card.setdefault(card_id, []).append(result)
            download_progress.advance(f'{card_id}: {result["id"] if result else "?"}')
    download_progress.finish()

    sheet_progress = Progress(len(objects), 'make registry review sheets')
    sheet_progress.start(f'{len(objects)} cards')
    manifest: list[dict] = []
    target_map = {item['id']: registry_id for item, registry_id, _current in targets}
    for card in cards.values():
        card_id = card['id']
        if card_id not in objects:
            continue
        photos = sorted(photos_by_card.get(card_id, []), key=lambda item: item['id'])
        registry_id = target_map.get(card_id)
        if registry_id is None:
            sheet_progress.advance(f'{card_id}: no record')
            continue
        record = f'https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id={registry_id}'
        # Photo ids are sha256 strings, not registry ids; find the current
        # registry files through their sidecars below.
        current_photo_ids = registry_photo_ids(card, record)
        current_registry_ids = set()
        for photo_id in current_photo_ids:
            metadata = read_photo_metadata(photo_id) or {}
            source = metadata.get('source') or ''
            marker = 'Files?id='
            if marker in source:
                raw_id = source.split(marker, 1)[1].split('_', 1)[0]
                if raw_id.isdigit():
                    current_registry_ids.add(int(raw_id))
        chosen, reasons = shortlist(photos, current_registry_ids)
        if not chosen:
            sheet_progress.advance(f'{card_id}: no candidates')
            continue
        sheet = make_sheet(card_id, chosen, reasons, current_registry_ids)
        payload = {
            'schema': 1,
            'cardId': card_id,
            'registryId': registry_id,
            'record': record,
            'objectName': objects[card_id].get('objectName'),
            'currentRegistryPhotoIds': sorted(current_registry_ids),
            'allCount': len(entries.get(card_id, [])),
            'shortlist': [photo['id'] for photo in chosen],
            'photos': [
                {
                    'id': photo['id'],
                    'width': photo['width'],
                    'height': photo['height'],
                    'sky': photo['sky'],
                    'edge': photo['edge'],
                    'aspect': photo['aspect'],
                    'reason': reasons.get(photo['id'], ''),
                    'objectName': photo.get('objectName'),
                    'date': photo.get('date'),
                }
                for photo in chosen
            ],
            'sheet': sheet,
            'errors': [item for item in errors if item['card'] == card_id],
        }
        write_json(WORK / card_id / 'index.json', payload)
        manifest.append({
            'id': card_id,
            'registryId': registry_id,
            'current': sorted(current_registry_ids),
            'allCount': len(entries.get(card_id, [])),
            'shortlist': len(chosen),
            'sheet': f'{card_id}/{sheet}',
        })
        sheet_progress.advance(f'{card_id}: {len(chosen)} candidates')
    sheet_progress.finish()

    write_json(INDEX, {
        'date': time.strftime('%Y-%m-%dT%H:%M:%S%z'),
        'cards': manifest,
        'cards_total': len(manifest),
        'skipped': skipped,
        'errors': errors,
    })
    elapsed = time.monotonic() - started
    ok = len(manifest)
    print(
        f'Registry batch review: {ok} cards prepared, {skipped} skipped, {len(errors)} errors, '
        f'{len(tasks)} files in {elapsed:.1f}s; index {INDEX.relative_to(ROOT)}.'
    )
    return 1 if errors else 0


if __name__ == '__main__':
    raise SystemExit(main())

#!/usr/bin/env python3
"""Tools for model-reviewed visual tags; this script does not classify images.

The CLIP classifier was removed. Visual tags are assigned by a model/editor
reading contact sheets of six photos and then recorded with this utility:

  python3 scripts/photo-visual-review.py sheets --size 6
  python3 scripts/photo-visual-review.py apply --file work/photo-research/review/batch-001.json
  python3 scripts/photo-visual-review.py status
  python3 scripts/photo-visual-review.py clear

Only ``apply`` writes sidecars, and only tags already chosen by the reviewer.
The taxonomy is ``data/photo-visual-tags.json``; labels and prompts in it are
documentation, not a classifier invocation.
"""
from __future__ import annotations

import argparse
import json
import math
import sys
import time
from pathlib import Path

from PIL import Image, ImageDraw

from atlas_source import CITY, ROOT, read_cards, read_photo_metadata, write_photo_metadata
from progress import Progress

TAXONOMY = ROOT / 'data' / 'photo-visual-tags.json'
REVIEW_DIR = ROOT / 'work' / 'photo-research' / 'review'
INDEX = REVIEW_DIR / 'index.json'
CELL_W = 600
CELL_H = 450
LABEL_H = 26


def load_taxonomy() -> tuple[dict, list[str], dict[str, int]]:
    payload = json.loads(TAXONOMY.read_text(encoding='utf-8'))
    tags = payload.get('tags')
    if not isinstance(tags, list) or not tags:
        raise SystemExit(f'{TAXONOMY}: tags must be a non-empty array')
    if len(tags) >= 50:
        raise SystemExit(f'{TAXONOMY}: taxonomy must stay below 50 tags, found {len(tags)}')
    ids: list[str] = []
    order: dict[str, int] = {}
    for tag in tags:
        tag_id = tag.get('id')
        if not isinstance(tag_id, str) or not tag_id or tag_id in order:
            raise SystemExit(f'{TAXONOMY}: duplicate or empty tag id {tag_id!r}')
        order[tag_id] = len(ids)
        ids.append(tag_id)
    return payload, ids, order


def referenced_photos() -> list[str]:
    cards = read_cards()
    return sorted({photo_id for card in cards.values() for photo_id in card.get('photos', [])})


def sheet_name(number: int) -> str:
    return f'sheet-{number:03d}.jpg'


def cmd_sheets(args: argparse.Namespace) -> int:
    payload, tag_ids, _order = load_taxonomy()
    photos = referenced_photos()
    if args.only_missing:
        photos = [photo_id for photo_id in photos if not (read_photo_metadata(photo_id) or {}).get('visualTags')]
    if args.offset:
        photos = photos[args.offset:]
    if args.limit is not None:
        photos = photos[:args.limit]
    if args.size < 1 or args.size > 12:
        raise SystemExit('--size must be between 1 and 12')

    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)
    if args.force:
        for path in out_dir.glob('sheet-*.jpg'):
            path.unlink()
    elif any(out_dir.glob('sheet-*.jpg')):
        raise SystemExit(f'{out_dir}: sheets already exist; use --force to regenerate')

    total_sheets = math.ceil(len(photos) / args.size) if photos else 0
    progress = Progress(total_sheets, 'make review sheets')
    progress.start(f'{len(photos)} photos, {args.size} per sheet')
    sheets = []
    for offset in range(0, len(photos), args.size):
        batch = photos[offset:offset + args.size]
        number = offset // args.size + 1
        name = sheet_name(number)
        columns = 2
        rows = math.ceil(len(batch) / columns)
        sheet = Image.new('RGB', (CELL_W * columns, CELL_H * rows), 'white')
        draw = ImageDraw.Draw(sheet)
        entries = []
        for index, photo_id in enumerate(batch):
            source = ROOT / 'data' / 'photos' / CITY / f'{photo_id}.webp'
            with Image.open(source) as opened:
                image = opened.convert('RGB')
            image.thumbnail((CELL_W - 8, CELL_H - LABEL_H - 8), Image.Resampling.LANCZOS)
            column = index % columns
            row = index // columns
            x = column * CELL_W
            y = row * CELL_H
            sheet.paste(image, (x + (CELL_W - image.width) // 2, y + (CELL_H - LABEL_H - image.height) // 2))
            label = f'{number:03d}.{index + 1}  {photo_id[:8]}'
            draw.text((x + 5, y + CELL_H - LABEL_H + 5), label, fill='red')
            entries.append({'position': index + 1, 'id': photo_id, 'prefix': photo_id[:8]})
        target = out_dir / name
        sheet.save(target, 'JPEG', quality=88)
        sheets.append({'sheet': f'{number:03d}', 'file': name, 'photos': entries})
        progress.advance(f'{name}: {len(batch)} photos')
    progress.finish()

    index = {
        'generated': time.strftime('%Y-%m-%dT%H:%M:%S%z'),
        'taxonomyVersion': payload.get('version'),
        'taxonomyTags': tag_ids,
        'sheetSize': args.size,
        'sheets': sheets,
    }
    (out_dir / 'index.json').write_text(json.dumps(index, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'Review sheets: {len(sheets)} sheets, {len(photos)} photos, index {out_dir / "index.json"}.')
    return 0


def normalize_tags(value: object, order: dict[str, int]) -> list[str]:
    if not isinstance(value, list):
        raise ValueError('tags must be an array')
    tags: list[str] = []
    for item in value:
        if not isinstance(item, str) or not item.strip():
            raise ValueError('tags must contain non-empty strings')
        if item not in order:
            raise ValueError(f'unknown visual tag {item!r}')
        if item in tags:
            raise ValueError(f'duplicate visual tag {item!r}')
        tags.append(item)
    return sorted(tags, key=lambda item: order[item])


def cmd_apply(args: argparse.Namespace) -> int:
    _, _tag_ids, order = load_taxonomy()
    index_path = Path(args.index)
    if not index_path.exists():
        raise SystemExit(f'{index_path}: run the sheets command first')
    index = json.loads(index_path.read_text(encoding='utf-8'))
    by_sheet = {entry['sheet']: entry for entry in index['sheets']}
    payload = json.loads(Path(args.file).read_text(encoding='utf-8'))
    if not isinstance(payload, dict):
        raise SystemExit(f'{args.file}: expected an object keyed by sheet number')

    jobs: list[tuple[str, list[str]]] = []
    errors: list[str] = []
    for sheet_id, values in payload.items():
        entry = by_sheet.get(str(sheet_id).zfill(3))
        if not entry:
            errors.append(f'{sheet_id}: unknown sheet')
            continue
        if not isinstance(values, list) or len(values) != len(entry['photos']):
            errors.append(f'{sheet_id}: expected {len(entry["photos"])} tag arrays')
            continue
        for photo, tags in zip(entry['photos'], values):
            try:
                normalized = normalize_tags(tags, order)
            except ValueError as error:
                errors.append(f'{sheet_id}.{photo["position"]} {photo["prefix"]}: {error}')
                continue
            jobs.append((photo['id'], normalized))
    if errors:
        for error in errors:
            print(f'ERROR {error}', file=sys.stderr)
        return 1

    progress = Progress(len(jobs), 'apply reviewed visual tags')
    progress.start(f'{len(jobs)} photos')
    updated = empty = 0
    for photo_id, tags in jobs:
        metadata = read_photo_metadata(photo_id) or {}
        if tags:
            metadata['visualTags'] = tags
        else:
            metadata.pop('visualTags', None)
            empty += 1
        write_photo_metadata(photo_id, metadata, CITY, replace_tags=('visualTags',))
        updated += 1
        progress.advance(photo_id[:12] + (': ' + ','.join(tags) if tags else ': no tags'))
    progress.finish()
    print(f'Applied visual tags: {updated} photos, {empty} without tags.')
    return 0


def cmd_clear(args: argparse.Namespace) -> int:
    photos = referenced_photos()
    progress = Progress(len(photos), 'clear visual tags')
    progress.start(f'{len(photos)} photos')
    cleared = 0
    for photo_id in photos:
        metadata = read_photo_metadata(photo_id)
        if metadata is None or 'visualTags' not in metadata:
            progress.advance(photo_id[:12] + ': no tags')
            continue
        if not args.dry_run:
            metadata.pop('visualTags', None)
            write_photo_metadata(photo_id, metadata, CITY, replace_tags=('visualTags',))
        cleared += 1
        progress.advance(photo_id[:12] + ': cleared')
    progress.finish()
    print(f'Cleared visual tags: {cleared} photos' + (' (dry run).' if args.dry_run else '.'))
    return 0


def cmd_status(args: argparse.Namespace) -> int:
    photos = referenced_photos()
    tagged = [photo_id for photo_id in photos if (read_photo_metadata(photo_id) or {}).get('visualTags')]
    print(f'Visual review: {len(tagged)}/{len(photos)} photos tagged, {len(photos) - len(tagged)} remaining.')
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest='command', required=True)

    sheets = sub.add_parser('sheets', help='make 6-photo contact sheets for model review')
    sheets.add_argument('--size', type=int, default=6)
    sheets.add_argument('--offset', type=int, default=0)
    sheets.add_argument('--limit', type=int)
    sheets.add_argument('--out', default=str(REVIEW_DIR))
    sheets.add_argument('--only-missing', action='store_true')
    sheets.add_argument('--force', action='store_true')
    sheets.set_defaults(func=cmd_sheets)

    apply = sub.add_parser('apply', help='write already reviewed tags from a JSON batch')
    apply.add_argument('--file', required=True)
    apply.add_argument('--index', default=str(INDEX))
    apply.set_defaults(func=cmd_apply)

    clear = sub.add_parser('clear', help='remove visualTags from all referenced photos')
    clear.add_argument('--dry-run', action='store_true')
    clear.set_defaults(func=cmd_clear)

    status = sub.add_parser('status', help='show visual-tag coverage')
    status.set_defaults(func=cmd_status)

    args = parser.parse_args()
    return args.func(args)


if __name__ == '__main__':
    raise SystemExit(main())

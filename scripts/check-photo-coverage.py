#!/usr/bin/env python3
"""Check that every card in a batch has a recorded photo-search result.

Publication and batch closure are different events: a card may be published
without photos, but the batch is not closed until each card without photos has
a coverage entry saying what was searched and why nothing was imported.
"""
import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from progress import Progress

ROOT = Path(__file__).resolve().parent.parent
RESULTS = {'imported', 'none_free', 'needs_review', 'fallback'}


def load_ids(path):
    data = json.loads(Path(path).read_text())
    if isinstance(data, list):
        return {item if isinstance(item, str) else item.get('id') or item.get('cardId') for item in data}
    ids = data.get('ids') or data.get('cards') or []
    return {item if isinstance(item, str) else item.get('id') or item.get('cardId') for item in ids}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--coverage', type=Path, required=True)
    parser.add_argument('--city', help='defaults to the city in the coverage file')
    parser.add_argument('--ids', type=Path, help='JSON list of card ids that must be covered')
    args = parser.parse_args()

    coverage = json.loads(args.coverage.read_text())
    city = args.city or coverage.get('city')
    if not city:
        parser.error('city is missing in the coverage file; pass --city')
    cards = {p.stem: json.loads(p.read_text()) for p in (ROOT / 'data/atlas' / city).glob('*.json')}
    if args.ids:
        target = load_ids(args.ids)
        unknown = sorted(target - cards.keys())
        if unknown:
            print(f'unknown card ids: {", ".join(unknown[:10])}', file=sys.stderr)
            return 1
    else:
        target = {cid for cid, card in cards.items() if not card.get('photos')}

    entries = {}
    errors = []
    for item in coverage.get('cards', []):
        cid = item.get('cardId')
        if not cid:
            errors.append('entry without cardId')
            continue
        if cid in entries:
            errors.append(f'{cid}: duplicate coverage entry')
        entries[cid] = item
    prog = Progress(len(target), 'photo coverage')
    prog.start()
    for cid in sorted(target):
        item = entries.get(cid)
        if not item:
            errors.append(f'{cid}: no photo-search record')
        else:
            result = item.get('result')
            photos = item.get('photoIds') or []
            sources = item.get('sources') or []
            if result not in RESULTS:
                errors.append(f'{cid}: unknown result {result!r}')
            if not item.get('searchedAt'):
                errors.append(f'{cid}: searchedAt is empty')
            if result == 'imported':
                if not photos:
                    errors.append(f'{cid}: imported without photoIds')
                for pid in photos:
                    if not (ROOT / 'data/photos' / city / f'{pid}.webp').exists():
                        errors.append(f'{cid}: photo file {pid}.webp is missing')
                    if pid not in (cards[cid].get('photos') or []):
                        errors.append(f'{cid}: photo {pid} is not attached to the card')
            if result == 'none_free':
                if len(set(sources)) < 2:
                    errors.append(f'{cid}: none_free needs at least two checked sources')
                if not item.get('reason'):
                    errors.append(f'{cid}: none_free without a reason')
            if result in ('needs_review', 'fallback') and not item.get('reason'):
                errors.append(f'{cid}: {result} without a reason')
            if any(not isinstance(source, str) or not source.strip() for source in sources):
                errors.append(f'{cid}: sources must be non-empty strings')
        prog.advance(note=cid)
    prog.finish(note=f'{len(errors)} errors')
    if errors:
        for error in errors:
            print(error, file=sys.stderr)
        return 1
    print(f'{city}: {len(target)} cards without photos have photo-search records')
    return 0


if __name__ == '__main__':
    sys.exit(main())

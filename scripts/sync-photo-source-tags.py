#!/usr/bin/env python3
"""Copy the source's own tags into photo sidecars.

For Wikimedia Commons files the source-provided tags are the file categories,
for example ``Balconies in Tbilisi`` or ``Interiors of buildings in Tbilisi``.
They are stored verbatim in ``sourceTags`` (without the ``Category:`` prefix,
sorted and deduplicated). Registry photos have no such labels, so the field is
omitted.

The existing ``work/photo-research/candidates.json`` cache already contains
categories for almost every Commons file; only uncached titles are requested
from the Commons API. The result is also cached in
``work/photo-research/source-tags-cache.json``.

Usage:
  python3 scripts/sync-photo-source-tags.py --dry-run
  python3 scripts/sync-photo-source-tags.py
  python3 scripts/sync-photo-source-tags.py --only <sha256>,<sha256>
"""
from __future__ import annotations

import argparse
import json
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

from atlas_source import (
    CITY,
    ROOT,
    photo_metadata_path,
    read_cards,
    read_photo_metadata,
    write_photo_metadata,
)
from progress import Progress

CANDIDATES = ROOT / 'work' / 'photo-research' / 'candidates.json'
CACHE = ROOT / 'work' / 'photo-research' / 'source-tags-cache.json'
COMMONS_API = 'https://commons.wikimedia.org/w/api.php'
USER_AGENT = 'TbilisiArchitectureAtlasPhotos/1.2 (educational atlas research)'
BATCH = 40


def commons_title(source: str) -> str | None:
    marker = 'commons.wikimedia.org/wiki/'
    if marker not in source:
        return None
    title = urllib.parse.unquote(source.split(marker, 1)[1])
    return title if title.startswith('File:') else None


def title_key(title: str) -> str:
    return title.replace('_', ' ').strip()


def load_cached_categories() -> dict[str, str]:
    """Collect categories from the gallery candidate cache and API cache."""
    categories: dict[str, str] = {}
    if CANDIDATES.exists():
        try:
            payload = json.loads(CANDIDATES.read_text(encoding='utf-8'))
        except json.JSONDecodeError as error:
            print(f'warning: cannot read {CANDIDATES}: {error}', file=sys.stderr)
            payload = {}
        for record in payload.get('existing', {}).values():
            source = record.get('source')
            values = record.get('categories')
            if source and values:
                title = commons_title(source)
                if title:
                    categories[title_key(title)] = values
        for records in payload.get('cards', {}).values():
            for record in records:
                source = record.get('source')
                values = record.get('categories')
                if source and values:
                    title = commons_title(source)
                    if title:
                        categories.setdefault(title_key(title), values)
    if CACHE.exists():
        try:
            cached = json.loads(CACHE.read_text(encoding='utf-8'))
        except json.JSONDecodeError as error:
            print(f'warning: cannot read {CACHE}: {error}', file=sys.stderr)
            cached = {}
        for title, values in cached.get('categories', {}).items():
            if isinstance(values, list):
                categories[title_key(title)] = '|'.join(str(item) for item in values)
            elif isinstance(values, str):
                categories[title_key(title)] = values
    return categories


def fetch_missing(titles: list[str]) -> tuple[dict[str, list[str]], int]:
    found: dict[str, list[str]] = {}
    failures = 0
    batches = [titles[index:index + BATCH] for index in range(0, len(titles), BATCH)]
    progress = Progress(len(batches), 'fetch Commons categories')
    progress.start(f'{len(titles)} titles in {len(batches)} requests')
    for batch in batches:
        query = urllib.parse.urlencode({
            'action': 'query',
            'format': 'json',
            'formatversion': '2',
            'prop': 'categories',
            'cllimit': 'max',
            'titles': '|'.join(batch),
        })
        try:
            request = urllib.request.Request(f'{COMMONS_API}?{query}', headers={'User-Agent': USER_AGENT})
            with urllib.request.urlopen(request, timeout=60) as response:
                payload = json.loads(response.read())
        except Exception as error:  # noqa: BLE001 - keep other batches going
            failures += len(batch)
            print(f'Commons categories batch failed: {error}', file=sys.stderr)
            progress.advance('batch error')
            continue
        for page in payload.get('query', {}).get('pages', []):
            title = page.get('title')
            if not title or 'missing' in page:
                continue
            values = [
                item.get('title', '').removeprefix('Category:')
                for item in page.get('categories', [])
                if item.get('title')
            ]
            found[title_key(title)] = values
        progress.advance(batch[0][:40])
        time.sleep(0.5)
    progress.finish()
    return found, failures


def split_tags(value: str | None) -> list[str]:
    if not value:
        return []
    return sorted({item.strip() for item in value.split('|') if item.strip()})


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--dry-run', action='store_true')
    parser.add_argument('--check', action='store_true', help='exit 1 if a cached source tag is missing')
    parser.add_argument('--only', help='comma-separated photo ids')
    parser.add_argument('--limit', type=int)
    args = parser.parse_args()

    cards = read_cards()
    referenced = sorted({photo_id for card in cards.values() for photo_id in card.get('photos', [])})
    selected = {value.strip() for value in args.only.split(',')} if args.only else None
    if args.limit is not None:
        referenced = referenced[:args.limit]

    cached = load_cached_categories()
    missing_titles: set[str] = set()
    rows: list[dict] = []
    for photo_id in referenced:
        if selected is not None and photo_id not in selected:
            continue
        metadata = read_photo_metadata(photo_id)
        if not metadata:
            rows.append({'id': photo_id, 'error': 'metadata sidecar is missing'})
            continue
        title = commons_title(metadata.get('source', ''))
        if not title:
            rows.append({'id': photo_id, 'tags': [], 'kind': 'other'})
            continue
        key = title_key(title)
        if key not in cached:
            missing_titles.add(title)
        rows.append({'id': photo_id, 'title': title, 'key': key, 'kind': 'commons'})

    fetched: dict[str, list[str]] = {}
    failures = 0
    if missing_titles:
        print(f'Cache hit for {sum(1 for row in rows if row.get("kind") == "commons") - len(missing_titles)} Commons files; '
              f'querying {len(missing_titles)}.', file=sys.stderr)
        fetched, failures = fetch_missing(sorted(missing_titles))
        for title, values in fetched.items():
            cached[title] = '|'.join(values)

    progress = Progress(len(rows), 'write source tags')
    progress.start(f'{len(rows)} photos')
    updated = unchanged = without_tags = errors = 0
    for row in rows:
        photo_id = row['id']
        label = photo_id[:12]
        if row.get('error'):
            errors += 1
            print(f'{label}: {row["error"]}', file=sys.stderr)
            progress.advance(label + ': error')
            continue
        tags: list[str] = []
        if row.get('kind') == 'commons':
            tags = split_tags(cached.get(row['key']))
            if row['key'] in fetched:
                tags = split_tags('|'.join(fetched[row['key']]))
        metadata = read_photo_metadata(photo_id)
        if not metadata:
            errors += 1
            progress.advance(label + ': error')
            continue
        current = metadata.get('sourceTags')
        if current == tags or (not tags and not current):
            unchanged += 1
            if not tags:
                without_tags += 1
            progress.advance(label + ': unchanged')
            continue
        if args.check:
            errors += 1
            print(f'{label}: sidecar has {current!r}, source has {tags!r}', file=sys.stderr)
            progress.advance(label + ': mismatch')
            continue
        if tags:
            metadata['sourceTags'] = tags
        else:
            metadata.pop('sourceTags', None)
        if not args.dry_run:
            write_photo_metadata(photo_id, metadata, CITY, replace_tags=('sourceTags',))
        updated += 1
        if not tags:
            without_tags += 1
        progress.advance(label + f': {len(tags)} tags')
    progress.finish()

    if fetched and not args.dry_run:
        cache_payload = {
            'date': time.strftime('%Y-%m-%dT%H:%M:%S%z'),
            'categories': {title: split_tags(values) for title, values in sorted(cached.items())},
        }
        CACHE.parent.mkdir(parents=True, exist_ok=True)
        CACHE.write_text(json.dumps(cache_payload, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

    print(
        f'Source tags: {updated} updated, {unchanged} unchanged, {without_tags} without tags, '
        f'{errors} errors, {failures} failed API titles.'
    )
    return 1 if errors else 0


if __name__ == '__main__':
    raise SystemExit(main())

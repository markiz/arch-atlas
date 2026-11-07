#!/usr/bin/env python3
"""Try to restore small stored photos from their known upstream sources.

The stored WebP is the publication copy: free Commons files are capped at
1920 px, registry/unknown files at 1200 px, and a source smaller than the cap
is never upscaled. Old batches sometimes saved a Commons thumbnail at 600-1200
px even though the original is larger. This script finds every photo below its
policy cap, asks the recorded source for its real size, downloads a larger
version when one exists, and replaces the file, sidecar and card references.

Registry photos (memkvidreoba.gov.ge) are re-fetched too: their direct file is
usually the same small original, so they are reported as unchanged rather than
silently skipped.

Content addressing keeps this safe: a bigger image gets a new sha256 id, the
old file is removed only after every card has moved to the new id, and cards
that shared the old bytes are updated together.

Usage:
  python3 scripts/upgrade-photo-sources.py --dry-run
  python3 scripts/upgrade-photo-sources.py
  python3 scripts/upgrade-photo-sources.py --only <sha256>,<sha256>
"""
from __future__ import annotations

import argparse
import io
import json
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

from PIL import Image, ImageOps

from atlas_source import (
    CITY,
    FREE_PHOTO_WIDTH,
    PHOTO_QUALITY,
    ROOT,
    UNKNOWN_PHOTO_WIDTH,
    fit_width,
    photo_metadata_path,
    photo_path,
    photo_size,
    read_cards,
    read_photo_metadata,
    save_photo,
    thumb_path,
    write_card,
    write_photo_metadata,
)
from progress import Progress

COMMONS_API = 'https://commons.wikimedia.org/w/api.php'
UNKNOWN_LICENSE = ''
USER_AGENT = 'TbilisiArchitectureAtlasPhotos/1.2 (educational atlas research)'
REPORT = ROOT / 'work' / 'photo-research' / 'source-upgrades.json'
COMMONS_BATCH = 40
# Wikimedia rejects hotlinked original files and arbitrary thumbnail widths.
# These are the production thumbnail steps from mediawiki.org; the largest one
# not above the source width is the biggest non-upscaled copy we may fetch.
STANDARD_WIDTHS = (1920, 1280, 960, 500, 330, 250, 120, 60, 40, 20)


def fetch(url: str, attempts: int = 4) -> bytes:
    for attempt in range(attempts):
        try:
            request = urllib.request.Request(url, headers={'User-Agent': USER_AGENT})
            with urllib.request.urlopen(request, timeout=60) as response:
                return response.read()
        except urllib.error.HTTPError as error:
            error.close()
            if attempt == attempts - 1:
                raise
            if error.code == 429:
                wait = 5 * (2 ** attempt)
                try:
                    wait = max(wait, int(error.headers.get('Retry-After', '0')))
                except (TypeError, ValueError):
                    pass
                time.sleep(min(wait, 60))
            else:
                time.sleep(2 * (attempt + 1))
        except Exception:
            if attempt == attempts - 1:
                raise
            time.sleep(2 * (attempt + 1))
    raise RuntimeError('unreachable')


def fetch_commons(url: str) -> bytes:
    # Wikimedia asks clients to keep image downloads around one request per
    # second; bursts trigger HTTP 429 and the whole batch stalls.
    time.sleep(2.0)
    return fetch(url, attempts=4)


def is_free(metadata: dict) -> bool:
    return (metadata.get('license') or UNKNOWN_LICENSE) != UNKNOWN_LICENSE


def width_cap(metadata: dict) -> int:
    return FREE_PHOTO_WIDTH if is_free(metadata) else UNKNOWN_PHOTO_WIDTH


def commons_title(source: str) -> str | None:
    marker = 'commons.wikimedia.org/wiki/'
    if marker not in source:
        return None
    title = urllib.parse.unquote(source.split(marker, 1)[1])
    return title if title.startswith('File:') else None


def standard_target(original_width: int) -> int:
    """Largest allowed thumbnail width that does not exceed the source."""
    limit = min(FREE_PHOTO_WIDTH, original_width)
    for width in STANDARD_WIDTHS:
        if width <= limit:
            return width
    return 0


def commons_thumb_url(original_url: str, width: int) -> str | None:
    """Construct a standard thumbnail URL when the API omits a thumburl."""
    parsed = urllib.parse.urlsplit(original_url)
    marker = '/wikipedia/commons/'
    if marker not in parsed.path:
        return None
    head, tail = parsed.path.split(marker, 1)
    if tail.startswith('thumb/'):
        return original_url
    name = tail.rsplit('/', 1)[-1]
    path = f'{head}{marker}thumb/{tail}/{width}px-{name}'
    return urllib.parse.urlunsplit((parsed.scheme, parsed.netloc, path, '', ''))


def prepare_image(raw: bytes, target_width: int) -> tuple[Image.Image, int]:
    image = Image.open(io.BytesIO(raw))
    image = ImageOps.exif_transpose(image)
    if image.mode not in ('RGB', 'L'):
        image = image.convert('RGB')
    original_width = image.width
    return fit_width(image, target_width), original_width


def modifications(width: int, original_width: int, free: bool) -> str:
    resized = width < original_width
    if free:
        return f'уменьшен размер до {width} px по ширине, преобразовано в WebP' if resized else 'преобразовано в WebP'
    return (
        f'уменьшен размер до {width} px по ширине, преобразовано в WebP; полное качество не используется'
        if resized
        else 'преобразовано в WebP; полное качество не используется'
    )


def query_commons(titles: list[str], width: int = FREE_PHOTO_WIDTH, label: str = 'query Commons originals') -> tuple[dict[str, dict], dict[str, str]]:
    """Return imageinfo by normalized Commons title and a requested->normalized map."""
    info_by_title: dict[str, dict] = {}
    normalized: dict[str, str] = {}
    batches = [titles[index:index + COMMONS_BATCH] for index in range(0, len(titles), COMMONS_BATCH)]
    progress = Progress(len(batches), label)
    progress.start(f'{len(titles)} titles at {width}px in {len(batches)} requests')
    for batch in batches:
        query = urllib.parse.urlencode({
            'action': 'query',
            'format': 'json',
            'formatversion': '2',
            'prop': 'imageinfo',
            'iiprop': 'url|size',
            'iiurlwidth': str(width),
            'titles': '|'.join(batch),
        })
        try:
            payload = json.loads(fetch(f'{COMMONS_API}?{query}'))
        except Exception as error:  # noqa: BLE001 - keep going with the other batches
            print(f'Commons API batch failed: {error}', file=sys.stderr)
            progress.advance('batch error')
            continue
        page_data = payload.get('query', {})
        time.sleep(1.0)
        for page in page_data.get('pages', []):
            title = page.get('title')
            if not title:
                continue
            if page.get('imageinfo'):
                info_by_title[title] = page['imageinfo'][0]
                info_by_title[title.replace('_', ' ')] = page['imageinfo'][0]
        for item in page_data.get('normalized', []):
            source, target = item.get('from'), item.get('to')
            if source and target:
                normalized[source] = target
                normalized[source.replace('_', ' ')] = target.replace('_', ' ')
        progress.advance(batch[0][:40])
    progress.finish()
    return info_by_title, normalized


def lookup_commons(info_by_title: dict[str, dict], normalized: dict[str, str], title: str) -> dict | None:
    for candidate in (title, normalized.get(title), title.replace('_', ' ')):
        if candidate and candidate in info_by_title:
            return info_by_title[candidate]
    return None


def metadata_for(metadata: dict, original_width: int, width: int) -> dict:
    updated = {key: metadata[key] for key in ('author', 'license', 'licenseUrl', 'source')}
    if metadata.get('descriptions'):
        updated['descriptions'] = metadata['descriptions']
    updated['modifications'] = modifications(width, original_width, is_free(metadata))
    return updated


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--dry-run', action='store_true', help='report potential upgrades without writing')
    parser.add_argument('--only', help='comma-separated photo ids to inspect')
    parser.add_argument('--limit', type=int, help='stop after this many candidates')
    args = parser.parse_args()

    cards = read_cards()
    referenced: dict[str, set[str]] = {}
    for card in cards.values():
        for photo_id in card.get('photos', []):
            referenced.setdefault(photo_id, set()).add(card['id'])

    selected = {value.strip() for value in args.only.split(',')} if args.only else None
    candidates: list[dict] = []
    skipped: list[dict] = []
    errors: list[dict] = []

    inspect = Progress(len(referenced), 'inspect photo sources')
    inspect.start(f'{len(referenced)} unique photos')
    for photo_id in sorted(referenced):
        if selected is not None and photo_id not in selected:
            inspect.advance(photo_id[:12] + ': filtered')
            continue
        metadata = read_photo_metadata(photo_id)
        if not metadata:
            errors.append({'id': photo_id, 'error': 'metadata sidecar is missing'})
            inspect.advance(photo_id[:12] + ': no metadata')
            continue
        try:
            width, height = photo_size(photo_id)
        except Exception as error:  # noqa: BLE001 - report and continue
            errors.append({'id': photo_id, 'error': f'cannot read image: {error}'})
            inspect.advance(photo_id[:12] + ': unreadable')
            continue
        cap = width_cap(metadata)
        if width >= cap:
            skipped.append({'id': photo_id, 'width': width, 'reason': f'already at {cap}px cap'})
            inspect.advance(photo_id[:12] + ': at cap')
            continue
        source = metadata.get('source') or ''
        title = commons_title(source)
        candidates.append({
            'id': photo_id,
            'width': width,
            'height': height,
            'cap': cap,
            'free': is_free(metadata),
            'metadata': metadata,
            'source': source,
            'commons_title': title,
            'kind': 'commons' if title else 'direct',
            'cards': sorted(referenced[photo_id]),
        })
        inspect.advance(photo_id[:12] + f': {width}px')
    inspect.finish()

    if args.limit is not None:
        candidates = candidates[:args.limit]

    commons_candidates = [item for item in candidates if item['kind'] == 'commons']
    info_by_title: dict[str, dict] = {}
    normalized: dict[str, str] = {}
    thumb_data: dict[int, tuple[dict[str, dict], dict[str, str]]] = {}
    if commons_candidates:
        info_by_title, normalized = query_commons(sorted({item['commons_title'] for item in commons_candidates}))
        gains_by_target: dict[int, set[str]] = {}
        for item in commons_candidates:
            info = lookup_commons(info_by_title, normalized, item['commons_title'])
            if not info:
                continue
            item['commons_info'] = info
            item['original_width'] = int(info.get('width') or 0)
            item['target'] = standard_target(item['original_width'])
            if item['target'] > item['width']:
                gains_by_target.setdefault(item['target'], set()).add(item['commons_title'])
        for target in sorted(gains_by_target, reverse=True):
            thumb_data[target] = query_commons(
                sorted(gains_by_target[target]),
                target,
                f'query Commons {target}px thumbnails',
            )

    upgrade = Progress(len(candidates), 'restore larger sources')
    upgrade.start(f'{len(candidates)} candidates below cap')
    replacements: dict[str, str] = {}
    improved: list[dict] = []
    unchanged: list[dict] = list(skipped)
    started = time.monotonic()

    for item in candidates:
        photo_id = item['id']
        label = photo_id[:12]
        try:
            if item['kind'] == 'commons':
                info = item.get('commons_info')
                if not info:
                    unchanged.append({'id': photo_id, 'width': item['width'], 'reason': 'Commons metadata not found'})
                    upgrade.advance(label + ': no metadata')
                    continue
                original_width = item['original_width']
                target = item['target']
                if target <= item['width']:
                    unchanged.append({
                        'id': photo_id,
                        'width': item['width'],
                        'source_width': original_width,
                        'reason': f'no standard thumbnail larger than {item["width"]}px',
                    })
                    upgrade.advance(label + f': source {original_width}px')
                    continue
                thumb_info, thumb_normalized = thumb_data.get(target, ({}, {}))
                thumb = lookup_commons(thumb_info, thumb_normalized, item['commons_title'])
                url = thumb.get('thumburl') if thumb else None
                if not url:
                    url = commons_thumb_url(info.get('url') or '', target)
                if not url:
                    unchanged.append({'id': photo_id, 'width': item['width'], 'reason': 'no download URL'})
                    upgrade.advance(label + ': no URL')
                    continue
            else:
                url = item['source']
                if not url:
                    unchanged.append({'id': photo_id, 'width': item['width'], 'reason': 'source URL is missing'})
                    upgrade.advance(label + ': no source')
                    continue
                raw = fetch(url)
                image, original_width = prepare_image(raw, item['cap'])
                target = min(item['cap'], original_width)
                if target <= item['width']:
                    unchanged.append({
                        'id': photo_id,
                        'width': item['width'],
                        'source_width': original_width,
                        'reason': 'source is not larger',
                    })
                    upgrade.advance(label + f': source {original_width}px')
                    continue

            if item['kind'] == 'commons':
                raw = fetch_commons(url)
                image, _decoded_width = prepare_image(raw, target)
                if image.width > original_width:
                    image = fit_width(image, original_width)
            else:
                image = fit_width(image, target)

            new_width, new_height = image.size
            if new_width <= item['width']:
                unchanged.append({'id': photo_id, 'width': item['width'], 'reason': 'no width gain after decoding'})
                upgrade.advance(label + ': no gain')
                continue

            if args.dry_run:
                improved.append({
                    'id': photo_id,
                    'width': item['width'],
                    'height': item['height'],
                    'new_width': new_width,
                    'new_height': new_height,
                    'source_width': original_width,
                    'cards': item['cards'],
                })
                upgrade.advance(label + f': would grow to {new_width}px')
                continue

            new_id = save_photo(image, quality=PHOTO_QUALITY, method=4)
            if new_id == photo_id:
                unchanged.append({'id': photo_id, 'width': item['width'], 'reason': 'identical bytes'})
                upgrade.advance(label + ': identical')
                continue
            try:
                write_photo_metadata(new_id, metadata_for(item['metadata'], original_width, new_width))
            except ValueError as error:
                # A different attribution already owns these bytes; do not
                # overwrite the canonical sidecar or link an ambiguous card.
                if new_id != photo_id and not any(new_id in card.get('photos', []) for card in cards.values()):
                    photo_path(new_id).unlink(missing_ok=True)
                    photo_metadata_path(new_id).unlink(missing_ok=True)
                errors.append({'id': photo_id, 'error': f'conflicting metadata for new bytes: {error}'})
                upgrade.advance(label + ': conflict')
                continue
            replacements[photo_id] = new_id
            improved.append({
                'id': photo_id,
                'new_id': new_id,
                'width': item['width'],
                'height': item['height'],
                'new_width': new_width,
                'new_height': new_height,
                'source_width': original_width,
                'cards': item['cards'],
            })
            upgrade.advance(label + f': {item["width"]}->{new_width}px')
            time.sleep(0.1)
        except Exception as error:  # noqa: BLE001 - one bad source must not stop the batch
            errors.append({'id': photo_id, 'error': str(error)})
            upgrade.advance(label + ': error')
    upgrade.finish()

    touched: list[str] = []
    removed: list[str] = []
    if replacements and not args.dry_run:
        update = Progress(len(cards), 'update card photo ids')
        update.start(f'{len(replacements)} replacements across {len(cards)} cards')
        for card_id in sorted(cards):
            card = cards[card_id]
            before = list(card.get('photos', []))
            after: list[str] = []
            seen: set[str] = set()
            for photo_id in before:
                replacement = replacements.get(photo_id, photo_id)
                if replacement in seen:
                    continue
                seen.add(replacement)
                after.append(replacement)
            if after != before:
                card['photos'] = after
                write_card(card)
                touched.append(card_id)
            update.advance(card_id)
        update.finish()

        still_used = {photo_id for card in cards.values() for photo_id in card.get('photos', [])}
        for old_id in replacements:
            if old_id in still_used:
                continue
            for path in (photo_path(old_id), photo_metadata_path(old_id), thumb_path(old_id)):
                if path.exists():
                    path.unlink()
                    removed.append(str(path.relative_to(ROOT)))

    elapsed = time.monotonic() - started
    report = {
        'date': time.strftime('%Y-%m-%dT%H:%M:%S%z'),
        'free_width': FREE_PHOTO_WIDTH,
        'unknown_width': UNKNOWN_PHOTO_WIDTH,
        'candidates': len(candidates),
        'improved': improved,
        'unchanged': unchanged,
        'errors': errors,
        'replacements': len(replacements),
        'cards_touched': touched,
        'removed_files': removed,
        'dry_run': args.dry_run,
    }
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

    for item in errors:
        print(f'ERROR {item["id"][:12]}: {item["error"]}', file=sys.stderr)
    print(
        f'Photo sources: {len(candidates)} candidates, {len(improved)} improved, '
        f'{len(unchanged)} unchanged, {len(errors)} errors; {len(replacements)} files replaced, '
        f'{len(touched)} cards updated, {len(removed)} old files removed in {elapsed:.1f}s.'
    )
    print(f'Report: {REPORT.relative_to(ROOT)}')
    return 1 if errors else 0


if __name__ == '__main__':
    raise SystemExit(main())

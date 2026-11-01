"""Read and write the one-JSON-per-object atlas source and its photo cache.

The atlas source of truth is data/atlas/tbilisi/<id>.json. Photo metadata is
stored next to the full image in data/photos/<city>/<sha256>.metadata.json;
the source card keeps only the ordered list of SHA-256 photo identifiers. The
packed bundle in public/atlas/buildings.json is rebuilt by
scripts/assemble-atlas.mjs.
"""
from __future__ import annotations

import hashlib
import json
import re
import threading
import uuid
from pathlib import Path
from typing import Any, Iterable

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
CITY = 'tbilisi'
SOURCE_DIR = ROOT / 'data/atlas/tbilisi'
PHOTOS_DIR = ROOT / 'data/photos'
THUMBNAILS_DIR = ROOT / 'data/thumbnails'
PHOTO_ID_RE = re.compile(r'^[0-9a-f]{64}$')
PHOTO_METADATA_FIELDS = ('author', 'license', 'licenseUrl', 'source', 'modifications')
PHOTO_OPTIONAL_FIELDS = ('description',)
PHOTO_TAG_FIELDS = ('sourceTags', 'visualTags')
PHOTO_DIMENSION_FIELDS = ('width', 'height')
_PHOTO_LOCK = threading.Lock()

# Photo width policy: free Commons licenses are published at up to 1920 px;
# unknown/commercial sources stay at 1200 px and are never upscaled.
FREE_PHOTO_WIDTH = 1920
UNKNOWN_PHOTO_WIDTH = 1200
PHOTO_QUALITY = 82


def fit_width(image, width: int = FREE_PHOTO_WIDTH):
    """Downscale to the given width, preserving aspect and never upscaling."""
    if image.width <= width:
        return image
    height = max(1, round(image.height * width / image.width))
    return image.resize((width, height))


def read_cards() -> dict[str, dict[str, Any]]:
    cards: dict[str, dict[str, Any]] = {}
    for path in sorted(SOURCE_DIR.glob('*.json')):
        card = json.loads(path.read_text(encoding='utf-8'))
        cards[card['id']] = card
    return cards


def card_path(card_id: str) -> Path:
    return SOURCE_DIR / f'{card_id}.json'


def write_card(card: dict[str, Any]) -> None:
    path = card_path(card['id'])
    temporary = path.with_name(f'.{path.name}.{uuid.uuid4().hex}.tmp')
    temporary.write_text(
        json.dumps(card, ensure_ascii=False, indent=2) + '\n',
        encoding='utf-8',
    )
    temporary.replace(path)


def write_cards(cards: Iterable[dict[str, Any]]) -> None:
    for card in cards:
        write_card(card)


def photo_path(photo_id: str, city: str = CITY) -> Path:
    if not PHOTO_ID_RE.fullmatch(photo_id):
        raise ValueError(f'photo id must be a lowercase sha256: {photo_id}')
    return PHOTOS_DIR / city / f'{photo_id}.webp'


def photo_metadata_path(photo_id: str, city: str = CITY) -> Path:
    if not PHOTO_ID_RE.fullmatch(photo_id):
        raise ValueError(f'photo id must be a lowercase sha256: {photo_id}')
    return PHOTOS_DIR / city / f'{photo_id}.metadata.json'


def thumb_path(photo_id: str, city: str = CITY) -> Path:
    if not PHOTO_ID_RE.fullmatch(photo_id):
        raise ValueError(f'photo id must be a lowercase sha256: {photo_id}')
    return THUMBNAILS_DIR / city / f'{photo_id}.webp'


def photo_relative(photo_id: str, city: str = CITY) -> str:
    """Return the published-relative path of a full photo."""
    if not PHOTO_ID_RE.fullmatch(photo_id):
        raise ValueError(f'photo id must be a lowercase sha256: {photo_id}')
    return f'photos/{city}/{photo_id}.webp'


def thumb_relative(photo_id: str, city: str = CITY) -> str:
    """Return the published-relative path of a photo preview."""
    if not PHOTO_ID_RE.fullmatch(photo_id):
        raise ValueError(f'photo id must be a lowercase sha256: {photo_id}')
    return f'thumbnails/{city}/{photo_id}.webp'


def read_photo_metadata(photo_id: str, city: str = CITY) -> dict[str, Any] | None:
    path = photo_metadata_path(photo_id, city)
    if not path.exists():
        return None
    value = json.loads(path.read_text(encoding='utf-8'))
    if not isinstance(value, dict):
        raise ValueError(f'{path}: metadata must be an object')
    return value


def photo_size(photo_id: str, city: str = CITY) -> tuple[int, int]:
    """Return the pixel size of the stored WebP, not of the upstream original."""
    path = photo_path(photo_id, city)
    with Image.open(path) as image:
        return image.size


def _normalized_tags(value: Any, field: str) -> list[str]:
    if not isinstance(value, list):
        raise ValueError(f'photo metadata field {field} must be an array of strings')
    tags: list[str] = []
    for item in value:
        if not isinstance(item, str) or not item.strip():
            raise ValueError(f'photo metadata field {field} must contain non-empty strings')
        tag = item.strip()
        if tag not in tags:
            tags.append(tag)
    return tags


def _normalized_metadata(metadata: dict[str, Any]) -> dict[str, Any]:
    normalized: dict[str, Any] = {}
    for field in PHOTO_METADATA_FIELDS:
        value = metadata.get(field)
        if not isinstance(value, str) or not value.strip():
            raise ValueError(f'photo metadata field {field} must be a non-empty string')
        normalized[field] = value
    description = metadata.get('description')
    if description is not None:
        if not isinstance(description, str):
            raise ValueError('photo metadata field description must be a string')
        if description.strip():
            normalized['description'] = description
    for field in PHOTO_TAG_FIELDS:
        if metadata.get(field) is not None:
            tags = _normalized_tags(metadata[field], field)
            if tags:
                normalized[field] = tags
    return normalized


def write_photo_metadata(
    photo_id: str,
    metadata: dict[str, Any],
    city: str = CITY,
    *,
    replace_tags: Iterable[str] = (),
) -> bool:
    """Write <sha256>.metadata.json, merging a missing optional description.

    The image bytes are the identity of a photo, so two gallery entries that use
    the same file share one canonical sidecar. Conflicting attribution for the
    same bytes is an error, not a silent overwrite. Tag fields are preserved
    when the caller does not pass them; list a field in ``replace_tags`` to
    remove an old value.
    """
    replace_tag_set = set(replace_tags)
    if not replace_tag_set <= set(PHOTO_TAG_FIELDS):
        raise ValueError(f'unknown tag fields: {", ".join(sorted(replace_tag_set - set(PHOTO_TAG_FIELDS)))}')
    path = photo_metadata_path(photo_id, city)
    normalized = _normalized_metadata(metadata)
    normalized['width'], normalized['height'] = photo_size(photo_id, city)
    current = read_photo_metadata(photo_id, city)
    if current is not None:
        merged = dict(current)
        for field in PHOTO_METADATA_FIELDS:
            if merged.get(field) != normalized[field]:
                raise ValueError(f'{path}: conflicting {field} for the same photo bytes')
        old_description = merged.get('description')
        new_description = normalized.get('description')
        if new_description:
            if old_description and old_description != new_description:
                raise ValueError(f'{path}: conflicting description for the same photo bytes')
            merged['description'] = new_description
        for field in PHOTO_TAG_FIELDS:
            if field in normalized:
                merged[field] = normalized[field]
            elif field in replace_tag_set:
                merged.pop(field, None)
        merged['width'] = normalized['width']
        merged['height'] = normalized['height']
        if merged == current:
            return False
        normalized = merged
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(f'.{path.name}.{uuid.uuid4().hex}.tmp')
    temporary.write_text(json.dumps(normalized, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    temporary.replace(path)
    return True


def save_photo(image, card_id: str | None = None, city: str = CITY, **save_options) -> str:
    """Save a WebP under its SHA-256 and return the photo id.

    `card_id` is kept for compatibility with older research scripts and no
    longer affects the path: the cache is content-addressed by city.
    """
    directory = PHOTOS_DIR / city
    directory.mkdir(parents=True, exist_ok=True)
    with _PHOTO_LOCK:
        temporary = directory / f'.tmp-{uuid.uuid4().hex}.webp'
        try:
            image.save(temporary, 'WEBP', **save_options)
            digest = hashlib.sha256(temporary.read_bytes()).hexdigest()
            target = photo_path(digest, city)
            if target.exists():
                temporary.unlink()
            else:
                temporary.replace(target)
            return digest
        finally:
            temporary.unlink(missing_ok=True)


def save_photo_with_metadata(
    image,
    metadata: dict[str, Any],
    city: str = CITY,
    **save_options,
) -> str:
    photo_id = save_photo(image, city=city, **save_options)
    write_photo_metadata(photo_id, metadata, city)
    return photo_id


def _record_photo_id(record: dict[str, Any]) -> str:
    photo_id = record.get('id') or record.get('file')
    if not isinstance(photo_id, str) or not PHOTO_ID_RE.fullmatch(photo_id):
        raise ValueError('photo record must carry a sha256 photo id')
    return photo_id


def attach_photos(cards: dict[str, dict[str, Any]], photos: dict[str, dict[str, Any] | None]) -> int:
    """Attach downloaded photos to cards as ordered sha256 identifiers."""
    added = 0
    for card_id, record in photos.items():
        if not record:
            continue
        card = cards.get(card_id)
        if card is None:
            print('missing card', card_id)
            continue
        photo_id = _record_photo_id(record)
        metadata = {field: record.get(field) for field in PHOTO_METADATA_FIELDS + PHOTO_OPTIONAL_FIELDS}
        write_photo_metadata(photo_id, metadata)
        current = card.setdefault('photos', [])
        if photo_id in current:
            print('already attached', card_id)
            continue
        existing_sources = {
            (read_photo_metadata(item) or {}).get('source')
            for item in current
            if isinstance(item, str)
        }
        if metadata.get('source') in existing_sources:
            print('already attached', card_id)
            continue
        current.append(photo_id)
        write_card(card)
        added += 1
    return added

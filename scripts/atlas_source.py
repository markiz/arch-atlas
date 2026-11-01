"""Read and write the one-JSON-per-object atlas source.

The atlas source of truth is data/atlas/tbilisi/<id>.json. Research photo
scripts patch these files directly and write them back as pretty JSON; the packed
bundle in public/atlas/buildings.json is rebuilt by scripts/assemble-atlas.mjs.
"""
from __future__ import annotations

import json
import threading
from pathlib import Path
from typing import Any, Iterable

ROOT = Path(__file__).resolve().parent.parent
CITY = 'tbilisi'
SOURCE_DIR = ROOT / 'data/atlas/tbilisi'
PHOTOS_DIR = ROOT / 'data/photos'
_PHOTO_LOCK = threading.Lock()


def read_cards() -> dict[str, dict[str, Any]]:
    cards: dict[str, dict[str, Any]] = {}
    for path in sorted(SOURCE_DIR.glob('*.json')):
        card = json.loads(path.read_text(encoding='utf-8'))
        cards[card['id']] = card
    return cards


def card_path(card_id: str) -> Path:
    return SOURCE_DIR / f'{card_id}.json'


def write_card(card: dict[str, Any]) -> None:
    card_path(card['id']).write_text(
        json.dumps(card, ensure_ascii=False, indent=2) + '\n',
        encoding='utf-8',
    )


def write_cards(cards: Iterable[dict[str, Any]]) -> None:
    for card in cards:
        write_card(card)


def attach_photos(cards: dict[str, dict[str, Any]], photos: dict[str, dict[str, Any] | None]) -> int:
    """Append new photos to their cards, skipping an already attached source."""
    added = 0
    for card_id, photo in photos.items():
        if not photo:
            continue
        card = cards.get(card_id)
        if card is None:
            print('missing card', card_id)
            continue
        existing = {item.get('source') for item in card.get('photos', [])}
        if photo.get('source') in existing:
            print('already attached', card_id)
            continue
        card.setdefault('photos', []).append(photo)
        write_card(card)
        added += 1
    return added


def photo_dir(card_id: str, city: str = CITY) -> Path:
    return PHOTOS_DIR / city / card_id


def photo_target(card_id: str, index: int, city: str = CITY) -> tuple[Path, str]:
    """Return the absolute and published-relative path for one photo."""
    return (
        photo_dir(card_id, city) / f'{index}.webp',
        f'photos/{city}/{card_id}/{index}.webp',
    )


def next_photo_index(card_id: str, city: str = CITY) -> int:
    directory = photo_dir(card_id, city)
    index = 1
    while (directory / f'{index}.webp').exists() or (directory / f'{index}-thumb.webp').exists():
        index += 1
    return index


def save_photo(image, card_id: str, city: str = CITY, **save_options) -> str:
    """Save a new full-size photo under data/photos and return its card path."""
    with _PHOTO_LOCK:
        directory = photo_dir(card_id, city)
        index = next_photo_index(card_id, city)
        path, relative = photo_target(card_id, index, city)
        directory.mkdir(parents=True, exist_ok=True)
        image.save(path, 'WEBP', **save_options)
        return relative

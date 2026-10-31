#!/usr/bin/env python3
"""Validate editorial cards before they are merged into public atlas data.

Checks source files, not the built bundle:
  data/heritage-extra.json
  data/building-address-translations.json
  data/building-name-translations.json
  data/building-text-translations.json
  data/building-attribute-translations.json
  public/atlas/buildings.json (after build-data.py)

The script prints errors and warnings and exits non-zero on errors. Warnings can
be promoted with --strict. It never modifies files.
"""
from __future__ import annotations

import argparse
import json
import math
import re
import sys
from pathlib import Path
from typing import Any

try:
    from shapely.geometry import shape
    from shapely.validation import make_valid
except ImportError:
    sys.exit('This script requires shapely: python3 -m pip install shapely')

ROOT = Path(__file__).resolve().parent.parent
EXTRA = ROOT / 'data/heritage-extra.json'
ADDRESSES = ROOT / 'data/building-address-translations.json'
NAMES = ROOT / 'data/building-name-translations.json'
TEXTS = ROOT / 'data/building-text-translations.json'
ATTRIBUTES = ROOT / 'data/building-attribute-translations.json'
BUILDINGS = ROOT / 'public/atlas/buildings.json'
LANGS = ('ru', 'en', 'ka', 'uk')
TIFLIS_BBOX = (44.0, 41.3, 45.2, 42.0)


def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding='utf-8'))


def is_http(value: Any) -> bool:
    return isinstance(value, str) and value.startswith(('http://', 'https://'))


def geometry_ok(geometry: Any) -> tuple[Any | None, str | None]:
    if not isinstance(geometry, dict) or geometry.get('type') not in ('Polygon', 'MultiPolygon'):
        return None, 'geometry must be Polygon or MultiPolygon'
    try:
        geom = shape(geometry)
    except Exception as error:
        return None, f'geometry cannot be parsed: {error}'
    if geom.is_empty:
        return None, 'geometry is empty'
    if not geom.is_valid:
        geom = make_valid(geom)
    return geom, None


def webp_ok(path: Path) -> bool:
    if not path.exists() or not path.is_file():
        return False
    data = path.read_bytes()[:12]
    return len(data) >= 12 and data[:4] == b'RIFF' and data[8:12] == b'WEBP'


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--strict', action='store_true', help='treat warnings as errors')
    parser.add_argument('--skip-overlaps', action='store_true')
    args = parser.parse_args()

    errors: list[str] = []
    warnings: list[str] = []

    try:
        extra = read_json(EXTRA)
        addresses = read_json(ADDRESSES)
        names = read_json(NAMES)
        texts = read_json(TEXTS)
        attributes = read_json(ATTRIBUTES)
        buildings = read_json(BUILDINGS)
    except FileNotFoundError as error:
        print(f'ERROR: missing file: {error}', file=sys.stderr)
        return 1
    except json.JSONDecodeError as error:
        print(f'ERROR: invalid JSON: {error}', file=sys.stderr)
        return 1

    style_keys = attributes.get('styleIdBySource', {})
    year_keys = attributes.get('yearLabelIdBySource', {})
    district_keys = attributes.get('districtIdBySource', {})
    architect_keys = attributes.get('architectIdBySource', {})

    ids: set[str] = set()
    for card in extra:
        card_id = card.get('id')
        label = card_id or '<missing id>'
        if not isinstance(card_id, str) or not card_id.strip():
            errors.append(f'{label}: missing id')
            continue
        if card_id in ids:
            errors.append(f'{label}: duplicate id in heritage-extra')
        ids.add(card_id)

        for field in ('name', 'address', 'district', 'style', 'yearLabel', 'description', 'source'):
            value = card.get(field)
            if not isinstance(value, str) or not value.strip():
                errors.append(f'{label}: missing {field}')
        if not is_http(card.get('source')):
            errors.append(f'{label}: source must be http(s)')
        if card.get('otherSource') and not is_http(card.get('otherSource')):
            warnings.append(f'{label}: otherSource is not http(s)')

        for field, keys, kind in (
            ('style', style_keys, 'style'),
            ('yearLabel', year_keys, 'yearLabel'),
            ('district', district_keys, 'district'),
        ):
            value = card.get(field)
            if isinstance(value, str) and value and value not in keys:
                errors.append(f'{label}: unknown {kind} key {value!r}')
        for architect in card.get('architects') or []:
            if architect not in architect_keys:
                errors.append(f'{label}: unknown architect key {architect!r}')

        address = addresses.get(card_id)
        if not isinstance(address, dict) or set(address) != set(LANGS):
            errors.append(f'{label}: address translations must have ru/en/ka/uk')
        elif any(not isinstance(address[lang], str) or not address[lang].strip() for lang in LANGS):
            warnings.append(f'{label}: empty address translation (allowed for unknown address)')

        text = texts.get(card_id)
        if not isinstance(text, dict) or not isinstance(text.get('descriptions'), dict):
            errors.append(f'{label}: missing text translations')
        else:
            descriptions = text['descriptions']
            for lang in LANGS:
                if not isinstance(descriptions.get(lang), str) or not descriptions[lang].strip():
                    errors.append(f'{label}: empty description.{lang}')
            histories = text.get('histories')
            if histories is not None:
                for lang in LANGS:
                    if not isinstance(histories.get(lang), str) or not histories[lang].strip():
                        errors.append(f'{label}: empty history.{lang}')

        if card_id not in names:
            warnings.append(f'{label}: no name translation entry (fallback to name/nameKa/nameEn)')
        else:
            name_translations = names[card_id]
            for lang in LANGS:
                if not isinstance(name_translations.get(lang), str) or not name_translations[lang].strip():
                    warnings.append(f'{label}: empty name.{lang} (fallback used)')

        geom, geom_error = geometry_ok(card.get('geometry'))
        if geom_error:
            errors.append(f'{label}: {geom_error}')
        elif geom is not None:
            minx, miny, maxx, maxy = geom.bounds
            if not (TIFLIS_BBOX[0] <= minx <= TIFLIS_BBOX[2] and TIFLIS_BBOX[1] <= miny <= TIFLIS_BBOX[3]):
                errors.append(f'{label}: geometry outside Tbilisi bbox')
            if geom.area <= 0:
                errors.append(f'{label}: geometry has zero area')
            coordinates = card.get('coordinates')
            if not (isinstance(coordinates, list) and len(coordinates) == 2):
                errors.append(f'{label}: coordinates must be [lon, lat]')
            else:
                lon, lat = coordinates
                if not (44.6 < lon < 45.0 and 41.5 < lat < 41.9):
                    errors.append(f'{label}: coordinates outside Tbilisi')
                distance = math.hypot((geom.centroid.x - lon) * 85000, (geom.centroid.y - lat) * 111000)
                if distance > 100:
                    warnings.append(f'{label}: coordinates are ~{distance:.0f} m from geometry centroid')

        photos = card.get('photos')
        if not isinstance(photos, list):
            errors.append(f'{label}: photos must be a list')
        else:
            seen_files: set[str] = set()
            for index, photo in enumerate(photos):
                if not isinstance(photo, dict):
                    errors.append(f'{label}: photo[{index}] must be an object')
                    continue
                for key in ('file', 'author', 'license', 'licenseUrl', 'source', 'modifications'):
                    if not isinstance(photo.get(key), str) or not photo[key].strip():
                        errors.append(f'{label}: photo[{index}].{key} missing')
                file_name = photo.get('file')
                if isinstance(file_name, str):
                    if '..' in file_name or file_name.startswith('/'):
                        errors.append(f'{label}: photo[{index}] unsafe path')
                    if file_name in seen_files:
                        errors.append(f'{label}: duplicate photo file {file_name}')
                    seen_files.add(file_name)
                    if file_name and not webp_ok(ROOT / 'public/atlas' / file_name):
                        errors.append(f'{label}: photo[{index}] is not a WebP file')

    building_ids: set[str] = set()
    building_geometries: list[tuple[str, Any]] = []
    for item in buildings:
        item_id = item.get('id')
        if not isinstance(item_id, str) or not item_id:
            errors.append('buildings.json: item without id')
            continue
        if item_id in building_ids:
            errors.append(f'buildings.json: duplicate id {item_id}')
        building_ids.add(item_id)
        geom, geom_error = geometry_ok(item.get('geometry'))
        if geom_error:
            errors.append(f'buildings.json {item_id}: {geom_error}')
        elif geom is not None:
            building_geometries.append((item_id, geom))
            minx, miny, maxx, maxy = geom.bounds
            if not (TIFLIS_BBOX[0] <= minx <= TIFLIS_BBOX[2] and TIFLIS_BBOX[1] <= miny <= TIFLIS_BBOX[3]):
                errors.append(f'buildings.json {item_id}: geometry outside Tbilisi bbox')

    if not args.skip_overlaps:
        scale = 111320.0 * 111320.0 * math.cos(math.radians(41.7))
        overlaps: list[tuple[float, str, str]] = []
        for left_index, (left_id, left) in enumerate(building_geometries):
            for right_id, right in building_geometries[left_index + 1:]:
                bx = right.bounds
                if left.bounds[2] < bx[0] or bx[2] < left.bounds[0] or left.bounds[3] < bx[1] or bx[3] < left.bounds[1]:
                    continue
                try:
                    area = left.intersection(right).area * scale
                except Exception:
                    continue
                if area > 1.0:
                    overlaps.append((area, left_id, right_id))
        for area, left_id, right_id in sorted(overlaps, reverse=True)[:20]:
            message = f'buildings.json: {left_id} and {right_id} overlap by {area:.1f} m²'
            if area > 10:
                errors.append(message)
            else:
                warnings.append(message)

    for message in warnings:
        print('WARNING:', message)
    for message in errors:
        print('ERROR:', message)
    print(f'cards checked: {len(extra)}; atlas buildings: {len(buildings)}; errors: {len(errors)}; warnings: {len(warnings)}')
    if errors or (args.strict and warnings):
        return 1
    return 0


if __name__ == '__main__':
    raise SystemExit(main())

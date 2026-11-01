#!/usr/bin/env python3
"""Validate the per-object atlas source before it is packed.

Checks source files, not the built bundle:
  data/atlas/tbilisi/*.json
  data/building-attribute-translations.json
  public/atlas/buildings.json (after scripts/assemble-atlas.mjs)

The script prints errors and warnings and exits non-zero on errors. Warnings can
be promoted with --strict. It never modifies files.
"""
from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path
from typing import Any

from progress import Progress

try:
    from shapely.geometry import shape
    from shapely.validation import make_valid
except ImportError:
    sys.exit('This script requires shapely: python3 -m pip install shapely')

ROOT = Path(__file__).resolve().parent.parent
SOURCE_DIR = ROOT / 'data/atlas/tbilisi'
ATTRIBUTES = ROOT / 'data/building-attribute-translations.json'
BUILDINGS = ROOT / 'public/atlas/buildings.json'
LANGS = ('ru', 'en', 'ka', 'uk')
GEOMETRY_ROLES = (
    'above_ground', 'heritage_boundary', 'complex_underground',
    'neighbor_wrong_candidate', 'historic_plan', 'visible_domes', 'unknown',
)
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


def labels_ok(card: dict[str, Any], field: str, errors: list[str], label: str, *, allow_empty: bool = False) -> dict[str, str] | None:
    value = card.get(field)
    if not isinstance(value, dict) or set(value) != set(LANGS):
        errors.append(f'{label}: {field} must have ru/en/ka/uk')
        return None
    for lang in LANGS:
        if not isinstance(value[lang], str) or (not allow_empty and not value[lang].strip()):
            errors.append(f'{label}: {field}.{lang} is empty' if allow_empty else f'{label}: {field}.{lang} must be a non-empty string')
    return value


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--strict', action='store_true', help='treat warnings as errors')
    parser.add_argument('--skip-overlaps', action='store_true')
    args = parser.parse_args()

    errors: list[str] = []
    warnings: list[str] = []

    try:
        attributes = read_json(ATTRIBUTES)
        buildings = read_json(BUILDINGS)
    except FileNotFoundError as error:
        print(f'ERROR: missing file: {error}', file=sys.stderr)
        return 1
    except json.JSONDecodeError as error:
        print(f'ERROR: invalid JSON: {error}', file=sys.stderr)
        return 1

    tables = {
        'styleId': attributes.get('styles', {}),
        'yearLabelId': attributes.get('yearLabels', {}),
        'districtId': attributes.get('districts', {}),
    }
    architects = attributes.get('architects', {})
    paths = sorted(SOURCE_DIR.glob('*.json'))
    if not paths:
        print(f'ERROR: no source cards in {SOURCE_DIR.relative_to(ROOT)}', file=sys.stderr)
        return 1

    ids: set[str] = set()
    card_progress = Progress(len(paths), 'validate atlas source')
    card_progress.start()
    for path in paths:
        label = path.stem
        try:
            card = read_json(path)
        except json.JSONDecodeError as error:
            errors.append(f'{label}: invalid JSON: {error}')
            card_progress.advance(label)
            continue
        if not isinstance(card, dict):
            errors.append(f'{label}: record must be an object')
            card_progress.advance(label)
            continue

        card_id = card.get('id')
        if not isinstance(card_id, str) or not card_id.strip():
            errors.append(f'{label}: missing id')
            card_progress.advance(label)
            continue
        if card_id != label:
            errors.append(f'{label}: id {card_id!r} does not match filename')
        if card_id in ids:
            errors.append(f'{label}: duplicate id')
        ids.add(card_id)

        labels_ok(card, 'names', errors, label)
        address = labels_ok(card, 'addresses', errors, label, allow_empty=True)
        if address and any(not value.strip() for value in address.values()):
            warnings.append(f'{label}: empty address translation (allowed for unknown address)')
        labels_ok(card, 'descriptions', errors, label)
        if card.get('histories') is not None:
            labels_ok(card, 'histories', errors, label)

        for field, table in tables.items():
            value = card.get(field)
            if value not in table:
                errors.append(f'{label}: unknown {field} reference {value!r}')
        architect_ids = card.get('architectIds')
        if not isinstance(architect_ids, list):
            errors.append(f'{label}: architectIds must be a list')
        else:
            for architect_id in architect_ids:
                if architect_id not in architects:
                    errors.append(f'{label}: unknown architect reference {architect_id!r}')

        min_year, max_year = card.get('minYear'), card.get('maxYear')
        if not ((min_year is None and max_year is None) or (
            isinstance(min_year, int) and isinstance(max_year, int) and min_year <= max_year
        )):
            errors.append(f'{label}: minYear/maxYear must both be null or an ordered integer pair')

        if not is_http(card.get('source')):
            errors.append(f'{label}: source must be http(s)')
        if card.get('otherSource') and not is_http(card.get('otherSource')):
            warnings.append(f'{label}: otherSource is not http(s)')
        if card.get('googlePlaceId') is not None and not isinstance(card.get('googlePlaceId'), str):
            errors.append(f'{label}: googlePlaceId must be a string')
        if card.get('googlePlaceIdSource') and not is_http(card.get('googlePlaceIdSource')):
            warnings.append(f'{label}: googlePlaceIdSource is not http(s)')

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

        role = card.get('geometryRole')
        if role is not None:
            if role not in GEOMETRY_ROLES:
                errors.append(f'{label}: unknown geometryRole {role!r}')
            if role == 'heritage_boundary':
                variants = card.get('geometryVariants')
                if not isinstance(variants, list) or not variants:
                    errors.append(f'{label}: heritage_boundary requires geometryVariants')
        variants = card.get('geometryVariants')
        if variants is not None:
            if not isinstance(variants, list):
                errors.append(f'{label}: geometryVariants must be a list')
            else:
                for index, variant in enumerate(variants):
                    if not isinstance(variant, dict):
                        errors.append(f'{label}: geometryVariants[{index}] must be an object')
                        continue
                    if variant.get('role') not in GEOMETRY_ROLES:
                        errors.append(f'{label}: geometryVariants[{index}] has invalid role')
                    _, variant_error = geometry_ok(variant.get('geometry'))
                    if variant_error:
                        errors.append(f'{label}: geometryVariants[{index}]: {variant_error}')

        photos = card.get('photos')
        if not isinstance(photos, list):
            errors.append(f'{label}: photos must be a list')
        else:
            seen_files: set[str] = set()
            for index, photo in enumerate(photos):
                if not isinstance(photo, dict):
                    errors.append(f'{label}: photo[{index}] must be an object')
                    continue
                for key in ('file', 'thumb', 'author', 'license', 'licenseUrl', 'source', 'modifications'):
                    if not isinstance(photo.get(key), str) or not photo[key].strip():
                        errors.append(f'{label}: photo[{index}].{key} missing')
                card_id = str(card.get('id', ''))
                prefix = f'photos/tbilisi/{card_id}/'
                for field in ('file', 'thumb'):
                    file_name = photo.get(field)
                    if not isinstance(file_name, str):
                        continue
                    if '..' in file_name or file_name.startswith('/'):
                        errors.append(f'{label}: photo[{index}].{field} unsafe path')
                    if not file_name.startswith(prefix):
                        errors.append(f'{label}: photo[{index}].{field} must live under {prefix}')
                    if file_name in seen_files:
                        errors.append(f'{label}: duplicate photo path {file_name}')
                    seen_files.add(file_name)
                    if file_name and not webp_ok(ROOT / 'data' / file_name):
                        errors.append(f'{label}: photo[{index}].{field} is not a WebP file')
                file_name = photo.get('file')
                thumb_name = photo.get('thumb')
                if isinstance(file_name, str) and isinstance(thumb_name, str):
                    expected = f'{file_name[:-5]}-thumb.webp' if file_name.endswith('.webp') else ''
                    if thumb_name != expected:
                        errors.append(f'{label}: photo[{index}].thumb does not match file')
        card_progress.advance(label)
    card_progress.finish()

    building_ids: set[str] = set()
    building_geometries: list[tuple[str, Any]] = []
    building_progress = Progress(len(buildings), 'validate packed atlas')
    building_progress.start()
    for item in buildings:
        item_id = item.get('id')
        if not isinstance(item_id, str) or not item_id:
            errors.append('buildings.json: item without id')
            building_progress.advance('missing id')
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
        building_progress.advance(item_id)
    building_progress.finish()

    if ids != building_ids:
        missing = sorted(ids - building_ids)
        extra = sorted(building_ids - ids)
        if missing:
            errors.append(f'buildings.json is stale: missing {len(missing)} source ids, e.g. {", ".join(missing[:3])}')
        if extra:
            errors.append(f'buildings.json is stale: {len(extra)} ids without source, e.g. {", ".join(extra[:3])}')

    if not args.skip_overlaps:
        scale = 111320.0 * 111320.0 * math.cos(math.radians(41.7))
        overlaps: list[tuple[float, str, str]] = []
        overlap_progress = Progress(len(building_geometries), 'check outline overlaps')
        overlap_progress.start()
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
            overlap_progress.advance(left_id)
        overlap_progress.finish()
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
    print(f'source cards: {len(ids)}; atlas buildings: {len(buildings)}; errors: {len(errors)}; warnings: {len(warnings)}')
    if errors or (args.strict and warnings):
        return 1
    return 0


if __name__ == '__main__':
    raise SystemExit(main())

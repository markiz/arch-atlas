#!/usr/bin/env python3
"""Collect deterministic facts for the research queue (no editorial judgement).

For every candidate this script stores the registry record and polygon, the OSM
way or relation geometry and tags, geometry metrics and diagnostic flags, the
Google Place ID research status, Commons geosearch hits and overlaps with
already published atlas cards. Explicit relation/way corrections live in
data/osm-candidate-overrides.json (for example, bath No. 5 is a relation, not
the neighboring way from the queue).

Output is written under work/queue/ (ignored by git):
  work/queue/<n>/collect.json
  work/queue/index.jsonl
  work/queue/cache/<sha256>.json

The script does not edit data/, public/ or docs/. It is safe to rerun: HTTP
responses and per-candidate facts are cached unless --refresh is passed.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from progress import Progress

try:
    from shapely.geometry import LineString, Polygon, shape
    from shapely.ops import polygonize, unary_union
    from shapely.validation import make_valid
except ImportError:
    sys.exit('This script requires shapely: python3 -m pip install shapely')

ROOT = Path(__file__).resolve().parent.parent
QUEUE_PATH = ROOT / 'docs/research-next-200.md'
ATLAS_PATH = ROOT / 'public/atlas/buildings.json'
PLACE_IDS_PATH = ROOT / 'data/research-next-200-google-place-ids.json'
DEFAULT_OUT = ROOT / 'work/queue'

REGISTRY_ATTRS = (
    'https://memkvidreoba.gov.ge/arcgisch/rest/services/CultureWMS/'
    'PS_ImmovableMonumentObjectP/MapServer/1/query'
)
REGISTRY_GEOM = (
    'https://memkvidreoba.gov.ge/arcgisch/rest/services/Culture/'
    'CulturePortalService/MapServer/4/query'
)
OSM_OBJECT = 'https://api.openstreetmap.org/api/0.6/{type}/{id}/full.json'
OVERRIDES_PATH = ROOT / 'data/osm-candidate-overrides.json'
COMMONS_GEO = 'https://commons.wikimedia.org/w/api.php'

USER_AGENT = 'TbilisiArchitectureAtlasResearch/1.0 (queue collector)'


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec='seconds')


def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding='utf-8'))


def write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + '.tmp')
    tmp.write_text(json.dumps(value, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    tmp.replace(path)


def fetch_json(url: str, cache_dir: Path, refresh: bool = False, delay: float = 0.0) -> Any:
    key = hashlib.sha256(url.encode('utf-8')).hexdigest()[:24]
    cache_path = cache_dir / (key + '.json')
    if cache_path.exists() and not refresh:
        return read_json(cache_path)

    headers = {'User-Agent': USER_AGENT, 'Accept': 'application/json'}
    last_error: Exception | None = None
    for attempt in range(4):
        try:
            request = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(request, timeout=60) as response:
                data = json.loads(response.read().decode('utf-8'))
            cache_dir.mkdir(parents=True, exist_ok=True)
            cache_path.write_text(json.dumps(data, ensure_ascii=False) + '\n', encoding='utf-8')
            if delay:
                time.sleep(delay)
            return data
        except urllib.error.HTTPError as error:
            last_error = error
            if error.code in (429, 503, 502, 504):
                time.sleep((attempt + 1) * 2)
                continue
            raise
        except (urllib.error.URLError, TimeoutError) as error:
            last_error = error
            time.sleep((attempt + 1) * 2)
    raise RuntimeError(f'failed to fetch {url}: {last_error}')


def parse_queue(path: Path) -> list[dict[str, Any]]:
    text = path.read_text(encoding='utf-8')
    rows: list[dict[str, Any]] = []
    pattern = re.compile(
        r'^\|\s*(\d+)\s*\|\s*(\d+)\s*\|[^|]*\|\s*\[way/(\d+)\]',
        re.MULTILINE,
    )
    for match in pattern.finditer(text):
        rows.append({
            'n': int(match.group(1)),
            'registryId': int(match.group(2)),
            'osmWay': match.group(3),
            'osmType': 'way',
            'osmId': match.group(3),
        })
    if not rows:
        raise SystemExit(f'no queue rows parsed from {path}')
    return rows


def atlas_osm_ids(path: Path) -> set[str]:
    data = read_json(path)
    return {
        str(item.get('osmId', ''))
        for item in data
        if str(item.get('osmId', '')).startswith(('way/', 'relation/'))
    }


def load_overrides(path: Path) -> dict[str, dict[str, Any]]:
    if not path.exists():
        return {}
    return read_json(path)


def apply_overrides(rows: list[dict[str, Any]], overrides: dict[str, dict[str, Any]]) -> None:
    for row in rows:
        override = overrides.get(str(row['n']))
        if not override:
            continue
        osm_type = override.get('type')
        osm_id = override.get('id')
        if osm_type not in ('way', 'relation') or osm_id is None:
            raise SystemExit(f'invalid OSM override for candidate {row["n"]}: {override!r}')
        row['osmType'] = osm_type
        row['osmId'] = str(osm_id)
        row['osmOverride'] = override.get('reason', '')


def polygon_from_rings(rings: list[list[list[float]]]):
    if not rings:
        return None
    shell = Polygon(rings[0], rings[1:] if len(rings) > 1 else None)
    if not shell.is_valid:
        shell = make_valid(shell)
    return shell


def polygon_from_osm_way(elements: list[dict[str, Any]]):
    way = next((item for item in elements if item.get('type') == 'way'), None)
    if not way:
        return None, {}
    nodes = {str(item['id']): item for item in elements if item.get('type') == 'node'}
    coords = []
    for node_id in way.get('nodes', []):
        node = nodes.get(str(node_id))
        if node:
            coords.append([node['lon'], node['lat']])
    if len(coords) < 3:
        return None, way.get('tags', {})
    if coords[0] != coords[-1]:
        coords.append(coords[0])
    polygon = Polygon(coords)
    if not polygon.is_valid:
        polygon = make_valid(polygon)
    return polygon, way.get('tags', {})


def polygon_from_osm_relation(elements: list[dict[str, Any]]):
    relation = next((item for item in elements if item.get('type') == 'relation'), None)
    if not relation:
        return None, {}, []
    nodes = {str(item['id']): item for item in elements if item.get('type') == 'node'}
    ways = {str(item['id']): item for item in elements if item.get('type') == 'way'}
    outer_lines = []
    inner_lines = []
    for member in relation.get('members', []):
        way = ways.get(str(member.get('ref')))
        if not way:
            continue
        coords = []
        for node_id in way.get('nodes', []):
            node = nodes.get(str(node_id))
            if node:
                coords.append((node['lon'], node['lat']))
        if len(coords) < 2:
            continue
        line = LineString(coords)
        if member.get('role') == 'inner':
            inner_lines.append(line)
        else:
            outer_lines.append(line)
    outer_polygons = list(polygonize(outer_lines))
    if not outer_polygons:
        return None, relation.get('tags', {}), relation.get('members', [])
    polygon = unary_union(outer_polygons)
    if inner_lines:
        inner_polygons = list(polygonize(inner_lines))
        if inner_polygons:
            polygon = polygon.difference(unary_union(inner_polygons))
    polygon = make_valid(polygon)
    return polygon, relation.get('tags', {}), relation.get('members', [])


def geometry_flags(registry_polygon, osm_polygon, tags: dict[str, Any], osm_type: str, metrics: dict[str, Any]) -> list[str]:
    flags: list[str] = []
    if osm_type == 'relation':
        flags.append('osm_relation')
    if str(tags.get('layer')) == '-1' or tags.get('location') == 'underground':
        flags.append('underground')
    if tags.get('building') == 'ruins' or tags.get('historic') == 'ruins':
        flags.append('ruins')
    if osm_polygon is None or registry_polygon is None:
        return flags
    if osm_polygon.geom_type == 'MultiPolygon':
        flags.append('osm_multi_part')
    registry_area = metrics.get('registryAreaM2')
    osm_area = metrics.get('osmAreaM2')
    if registry_area and osm_area:
        ratio = osm_area / registry_area
        if ratio > 1.5:
            flags.append('osm_much_larger')
        elif ratio < 0.67:
            flags.append('osm_much_smaller')
    registry_covered = metrics.get('registryCoveredByOsmPct')
    osm_inside = metrics.get('osmInsideRegistryPct')
    if registry_covered is not None and osm_inside is not None:
        if registry_covered > 75 and osm_inside < 60:
            flags.append('osm_composite_or_plot')
        elif osm_inside > 90 and registry_covered < 60:
            flags.append('official_subset')
    if registry_polygon.geom_type == 'Polygon' and len(registry_polygon.exterior.coords) <= 10 and (registry_area or 0) < 100:
        flags.append('official_point_buffer')
    return flags


def project_polygon(polygon, lon0, lat0):
    kx = 111320.0 * math.cos(math.radians(lat0))
    ky = 110574.0

    def project(x, y, z=None):
        return ((x - lon0) * kx, (y - lat0) * ky)

    from shapely.ops import transform
    return transform(project, polygon)


def geometry_metrics(registry_polygon, osm_polygon) -> dict[str, Any]:
    if registry_polygon is None or osm_polygon is None:
        return {}
    minx, miny, maxx, maxy = registry_polygon.bounds
    lon0 = (minx + maxx) / 2
    lat0 = (miny + maxy) / 2
    registry_m = project_polygon(registry_polygon, lon0, lat0)
    osm_m = project_polygon(osm_polygon, lon0, lat0)
    intersection = registry_m.intersection(osm_m).area
    union = registry_m.union(osm_m).area
    return {
        'registryAreaM2': round(registry_m.area, 1),
        'osmAreaM2': round(osm_m.area, 1),
        'intersectionM2': round(intersection, 1),
        'iou': round(intersection / union, 3) if union else None,
        'osmInsideRegistryPct': round(intersection / osm_m.area * 100, 1) if osm_m.area else None,
        'registryCoveredByOsmPct': round(intersection / registry_m.area * 100, 1) if registry_m.area else None,
        'centroidDistanceM': round(registry_m.centroid.distance(osm_m.centroid), 1),
    }


def bbox_overlaps(polygon, atlas: list[dict[str, Any]], limit: int = 5) -> list[dict[str, Any]]:
    if polygon is None:
        return []
    minx, miny, maxx, maxy = polygon.bounds
    scale = 111320.0 * 111320.0 * math.cos(math.radians((miny + maxy) / 2))
    hits: list[dict[str, Any]] = []
    for item in atlas:
        geometry = item.get('geometry') or {}
        if geometry.get('type') not in ('Polygon', 'MultiPolygon'):
            continue
        try:
            other = shape(geometry)
        except Exception:
            continue
        if other.is_empty:
            continue
        bx = other.bounds
        if bx[2] < minx or bx[0] > maxx or bx[3] < miny or bx[1] > maxy:
            continue
        try:
            area = polygon.intersection(other).area * scale
        except Exception:
            continue
        if area > 1.0:
            hits.append({
                'id': item.get('id'),
                'name': item.get('name', ''),
                'areaM2': round(area, 1),
            })
    return sorted(hits, key=lambda hit: hit['areaM2'], reverse=True)[:limit]


def query_registry(registry_id: int) -> dict[str, Any]:
    attrs_url = REGISTRY_ATTRS + '?' + urllib.parse.urlencode({
        'where': f'ObjectID={registry_id}',
        'outFields': '*',
        'returnGeometry': 'false',
        'f': 'json',
    })
    geom_url = REGISTRY_GEOM + '?' + urllib.parse.urlencode({
        'where': f'ImmovableObjectID={registry_id}',
        'outFields': 'ObjectName,Address,ExactDate,InitialFunction,CurrentFunction,PhotoAddress,ImmovableObjectID',
        'returnGeometry': 'true',
        'outSR': '4326',
        'f': 'json',
    })
    return {'attrsUrl': attrs_url, 'geomUrl': geom_url}


def fetch_registry(registry_id: int, cache_dir: Path, refresh: bool, delay: float) -> tuple[dict, ...]:
    urls = query_registry(registry_id)
    attrs_response = fetch_json(urls['attrsUrl'], cache_dir, refresh, delay)
    attrs_features = attrs_response.get('features', [])
    attrs = attrs_features[0].get('attributes', {}) if attrs_features else {}

    geom_response = fetch_json(urls['geomUrl'], cache_dir, refresh, delay)
    geom_features = geom_response.get('features', [])
    geom_feature = geom_features[0] if geom_features else None
    rings = []
    geom_attrs = {}
    if geom_feature:
        geom_attrs = geom_feature.get('attributes', {})
        rings = (geom_feature.get('geometry') or {}).get('rings') or []
    return attrs, geom_attrs, rings, urls


def fetch_osm(osm_type: str, osm_id: str, cache_dir: Path, refresh: bool, delay: float) -> tuple[list[dict], str]:
    url = OSM_OBJECT.format(type=osm_type, id=osm_id)
    response = fetch_json(url, cache_dir, refresh, delay)
    return response.get('elements', []), url


def fetch_commons(lat: float, lon: float, cache_dir: Path, refresh: bool, delay: float) -> list[dict[str, Any]]:
    params = {
        'action': 'query',
        'list': 'geosearch',
        'gscoord': f'{lat}|{lon}',
        'gsradius': '100',
        'gslimit': '20',
        'format': 'json',
    }
    url = COMMONS_GEO + '?' + urllib.parse.urlencode(params)
    response = fetch_json(url, cache_dir, refresh, delay)
    return [
        {'title': item.get('title'), 'distanceM': round(item.get('dist', 0))}
        for item in (response.get('query') or {}).get('geosearch', [])
    ]


def load_place_ids(path: Path) -> dict[str, dict[str, Any]]:
    if not path.exists():
        return {}
    data = read_json(path)
    return {item['id']: item for item in data.get('results', []) if item.get('id')}


def collect_candidate(
    row: dict[str, Any],
    out_dir: Path,
    atlas: list[dict[str, Any]],
    place_ids: dict[str, dict[str, Any]],
    cache_dir: Path,
    refresh: bool,
    delay: float,
    commons: bool,
) -> dict[str, Any]:
    n = row['n']
    registry_id = row['registryId']
    osm_type = row.get('osmType', 'way')
    osm_id = str(row.get('osmId') or row['osmWay'])
    errors: list[str] = []
    warnings: list[str] = []

    attrs, geom_attrs, rings, urls = fetch_registry(registry_id, cache_dir, refresh, delay)
    if not attrs:
        errors.append('registry attributes missing')
    registry_polygon = polygon_from_rings(rings) if rings else None
    if registry_polygon is None:
        errors.append('registry polygon missing')

    osm_elements, osm_api_url = fetch_osm(osm_type, osm_id, cache_dir, refresh, delay)
    osm_url = f'https://www.openstreetmap.org/{osm_type}/{osm_id}'
    if osm_type == 'relation':
        osm_polygon, osm_tags, osm_members = polygon_from_osm_relation(osm_elements)
    else:
        osm_polygon, osm_tags = polygon_from_osm_way(osm_elements)
        osm_members = []
    if osm_polygon is None:
        errors.append(f'OSM {osm_type} geometry missing')

    try:
        metrics = geometry_metrics(registry_polygon, osm_polygon)
    except Exception as error:
        metrics = {}
        errors.append(f'geometry metrics: {error}')
    flags = geometry_flags(registry_polygon, osm_polygon, osm_tags, osm_type, metrics)
    overlaps = bbox_overlaps(registry_polygon or osm_polygon, atlas)

    lon = attrs.get('X')
    lat = attrs.get('Y')
    if lon is None or lat is None:
        if osm_polygon is not None:
            lon, lat = osm_polygon.centroid.x, osm_polygon.centroid.y
    commons_hits: list[dict[str, Any]] = []
    if commons and lon is not None and lat is not None:
        try:
            commons_hits = fetch_commons(float(lat), float(lon), cache_dir, refresh, delay)
        except Exception as error:  # Commons is an optional enrichment
            warnings.append(f'commons: {error}')

    place = place_ids.get(f'registry-{registry_id}')
    result = {
        'schema': 1,
        'candidate': {
            'n': n,
            'registryId': registry_id,
            'osmType': osm_type,
            'osmId': osm_id,
            'osmWay': row['osmWay'],
            'osmOverride': row.get('osmOverride', ''),
            'registryUrl': f'https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id={registry_id}',
            'osmUrl': osm_url,
        },
        'registry': {
            'attributes': attrs,
            'geometryAttributes': geom_attrs,
            'polygon': {'type': 'Polygon', 'coordinates': rings} if rings else None,
            'sourceUrls': urls,
        },
        'osm': {
            'id': f'{osm_type}/{osm_id}',
            'type': osm_type,
            'tags': osm_tags,
            'members': osm_members,
            'polygon': osm_polygon.__geo_interface__ if osm_polygon is not None else None,
            'sourceUrl': osm_url,
            'apiUrl': osm_api_url,
        },
        'metrics': metrics,
        'geometryFlags': flags,
        'placeId': place,
        'commons': commons_hits,
        'atlasOverlaps': overlaps,
        'fetchedAt': utc_now(),
        'errors': errors,
        'warnings': warnings,
    }

    way_dir = out_dir / f'{n:03d}'
    write_json(way_dir / 'collect.json', result)
    return {
        'n': n,
        'registryId': registry_id,
        'osmType': osm_type,
        'osmId': osm_id,
        'osmWay': row['osmWay'],
        'name': attrs.get('Name') or geom_attrs.get('ObjectName') or '',
        'address': attrs.get('Address') or geom_attrs.get('Address') or '',
        'status': 'ok' if not errors else ('partial' if metrics else 'error'),
        'iou': metrics.get('iou'),
        'registryAreaM2': metrics.get('registryAreaM2'),
        'osmAreaM2': metrics.get('osmAreaM2'),
        'placeStatus': place.get('status') if place else None,
        'commonsCount': len(commons_hits),
        'atlasOverlapCount': len(overlaps),
        'geometryFlags': flags,
        'errors': errors,
        'warnings': warnings,
        'collectedAt': result['fetchedAt'],
    }


def update_index(path: Path, rows: list[dict[str, Any]]) -> None:
    existing: dict[int, dict[str, Any]] = {}
    if path.exists():
        for line in path.read_text(encoding='utf-8').splitlines():
            if line.strip():
                item = json.loads(line)
                existing[int(item['n'])] = item
    for row in rows:
        existing[int(row['n'])] = row
    lines = [json.dumps(existing[key], ensure_ascii=False) for key in sorted(existing)]
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text('\n'.join(lines) + '\n', encoding='utf-8')


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--queue', type=Path, default=QUEUE_PATH)
    parser.add_argument('--atlas', type=Path, default=ATLAS_PATH)
    parser.add_argument('--out', type=Path, default=DEFAULT_OUT)
    parser.add_argument('--overrides', type=Path, default=OVERRIDES_PATH,
                        help='candidate-number -> OSM relation overrides; use an empty file for a different queue')
    parser.add_argument('--only', help='candidate numbers, comma separated')
    parser.add_argument('--limit', type=int, help='process at most N remaining candidates')
    parser.add_argument('--refresh', action='store_true', help='ignore cached HTTP responses and artifacts')
    parser.add_argument('--no-commons', action='store_true', help='skip optional Commons geosearch')
    parser.add_argument('--delay', type=float, default=0.2, help='pause between HTTP requests, seconds')
    args = parser.parse_args()

    queue = parse_queue(args.queue)
    apply_overrides(queue, load_overrides(args.overrides))
    atlas_ids = atlas_osm_ids(args.atlas)

    def osm_id(row: dict[str, Any]) -> str:
        return f"{row['osmType']}/{row['osmId']}"

    added = {row['n'] for row in queue if osm_id(row) in atlas_ids}
    remaining = [row for row in queue if row['n'] not in added]
    if args.only:
        wanted = {int(value) for value in args.only.split(',') if value.strip()}
        remaining = [row for row in remaining if row['n'] in wanted]
    if args.limit is not None:
        remaining = remaining[:args.limit]

    atlas = read_json(args.atlas)
    place_ids = load_place_ids(PLACE_IDS_PATH)
    cache_dir = args.out / 'cache'
    index_path = args.out / 'index.jsonl'
    print(f'queue: {len(queue)}; already in atlas: {len(added)}; to collect: {len(remaining)}')

    summaries = []
    progress = Progress(len(remaining), 'collect queue candidates')
    progress.start(f"{len(remaining)} to process; {len(added)} already in atlas")
    for row in remaining:
        progress.update(note=f"candidate {row['n']} / registry {row['registryId']} / {row['osmType']} {row['osmId']}")
        artifact = args.out / f"{row['n']:03d}" / 'collect.json'
        if artifact.exists() and not args.refresh:
            try:
                cached = read_json(artifact)
                candidate = cached.get('candidate', {})
                summary = {
                    'n': row['n'],
                    'registryId': row['registryId'],
                    'osmType': candidate.get('osmType', row['osmType']),
                    'osmId': candidate.get('osmId', row['osmId']),
                    'osmWay': row['osmWay'],
                    'name': (cached.get('registry', {}).get('attributes') or {}).get('Name', ''),
                    'address': (cached.get('registry', {}).get('attributes') or {}).get('Address', ''),
                    'status': 'ok' if not cached.get('errors') else 'partial',
                    'iou': (cached.get('metrics') or {}).get('iou'),
                    'registryAreaM2': (cached.get('metrics') or {}).get('registryAreaM2'),
                    'osmAreaM2': (cached.get('metrics') or {}).get('osmAreaM2'),
                    'placeStatus': (cached.get('placeId') or {}).get('status'),
                    'commonsCount': len(cached.get('commons') or []),
                    'atlasOverlapCount': len(cached.get('atlasOverlaps') or []),
                    'geometryFlags': cached.get('geometryFlags') or [],
                    'errors': cached.get('errors') or [],
                    'warnings': cached.get('warnings') or [],
                    'collectedAt': cached.get('fetchedAt'),
                }
                summaries.append(summary)
                update_index(index_path, summaries)
                progress.advance(f"{row['n']}: cached")
                continue
            except Exception:
                pass
        try:
            summary = collect_candidate(
                row, args.out, atlas, place_ids, cache_dir,
                args.refresh, args.delay, not args.no_commons,
            )
            summaries.append(summary)
            update_index(index_path, summaries)
            progress.advance(f"{row['n']}: {summary['status']} (IoU {summary.get('iou')})")
        except Exception as error:
            summary = {
                'n': row['n'], 'registryId': row['registryId'],
                'osmType': row['osmType'], 'osmId': row['osmId'], 'osmWay': row['osmWay'],
                'name': '', 'address': '', 'status': 'error',
                'errors': [str(error)], 'warnings': [], 'geometryFlags': [], 'collectedAt': utc_now(),
            }
            summaries.append(summary)
            update_index(index_path, summaries)
            progress.advance(f"{row['n']}: ERROR {error}")

    progress.finish()
    ok = sum(1 for item in summaries if item['status'] == 'ok')
    partial = sum(1 for item in summaries if item['status'] == 'partial')
    errors = sum(1 for item in summaries if item['status'] == 'error')
    print(f'done: ok {ok}, partial {partial}, error {errors}; index: {index_path}')
    return 0 if errors == 0 else 1


if __name__ == '__main__':
    raise SystemExit(main())

#!/usr/bin/env python3
"""Extract roads around atlas objects missing from the city-wide OSM extract.

`selected.json` follows an administrative settlement boundary, while cards and
landmarks can lie outside it. This tool measures the distance from every object
to the roads the basemap would draw, clusters the gaps and copies the local road
network around those clusters from a regional PBF into `coverage.json`.
"""
import argparse
import hashlib
import json
import math
import pathlib
import sys

import osmium
from shapely.geometry import LineString, Point
from shapely.ops import nearest_points
from shapely.strtree import STRtree

ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / 'scripts'))

from progress import Progress

ROAD_CLASSES = {
    'motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'residential',
    'unclassified', 'living_street', 'pedestrian', 'service', 'footway',
    'path', 'steps',
}
MINOR_CLASSES = ('service', 'footway', 'path', 'steps')


def road_class(tags):
    value = tags.get('highway')
    if value == 'construction':
        value = tags.get('construction')
        if isinstance(value, str) and value.endswith('_link'):
            value = value[:-5]
    return value if value in ROAD_CLASSES else None


def has_name(tags):
    return any(tags.get(key) for key in ('name', 'name:en', 'name:ru', 'name:sr'))


def local_meters(lat0):
    lat = 111132.954 - 559.822 * math.cos(2 * math.radians(lat0)) + 1.175 * math.cos(4 * math.radians(lat0))
    lon = 111412.84 * math.cos(math.radians(lat0)) - 93.5 * math.cos(3 * math.radians(lat0))
    return lat, lon


def distance_m(a, b, mlat, mlon):
    return math.hypot((a[0] - b[0]) * mlon, (a[1] - b[1]) * mlat)


def load_points(city):
    points = []
    for pattern, label in (
        (ROOT / 'data' / 'atlas' / city, 'card'),
        (ROOT / 'data' / 'landmarks' / city, 'landmark'),
    ):
        for path in sorted(pattern.glob('*.json')):
            card = json.loads(path.read_text())
            coord = card.get('coordinates')
            if coord:
                points.append((float(coord[0]), float(coord[1]), f'{label}:{card.get("id", path.stem)}'))
    unique = {}
    for lon, lat, label in points:
        unique.setdefault((round(lon, 7), round(lat, 7)), []).append(label)
    return [(lon, lat, labels) for (lon, lat), labels in unique.items()]


def load_selected_roads(city, skip_unnamed_minor):
    path = ROOT / 'raw' / 'osm' / city / 'selected.json'
    data = json.loads(path.read_text())
    all_ids = set()
    rendered = []
    for element in data.get('elements', []):
        if element.get('type') != 'way':
            continue
        tags = element.get('tags') or {}
        road_kind = road_class(tags)
        if not road_kind:
            continue
        all_ids.add(str(element['id']))
        if skip_unnamed_minor and road_kind in MINOR_CLASSES and not has_name(tags):
            continue
        coords = [(float(p['lon']), float(p['lat'])) for p in element.get('geometry') or []]
        if len(coords) >= 2:
            rendered.append((str(element['id']), coords))
    return all_ids, rendered


def cluster_gaps(gaps, mlat, mlon, link_m, margin_m, min_radius_m, max_radius_m):
    clusters = []
    for gap in gaps:
        best = None
        for cluster in clusters:
            center = cluster['center']
            if distance_m((gap['lon'], gap['lat']), center, mlat, mlon) <= link_m:
                best = cluster
                break
        if best is None:
            clusters.append({'center': (gap['lon'], gap['lat']), 'points': [gap]})
        else:
            best['points'].append(gap)
            count = len(best['points'])
            best['center'] = (
                sum(point['lon'] for point in best['points']) / count,
                sum(point['lat'] for point in best['points']) / count,
            )
    for cluster in clusters:
        radius = max(point['distance'] for point in cluster['points']) + margin_m
        cluster['radius'] = max(min_radius_m, min(max_radius_m, radius))
    return clusters


class RoadHandler(osmium.SimpleHandler):
    def __init__(self, existing_ids, clusters, skip_unnamed_minor, mlat, mlon, progress):
        super().__init__()
        self.existing_ids = existing_ids
        self.clusters = clusters
        self.skip_unnamed_minor = skip_unnamed_minor
        self.mlat = mlat
        self.mlon = mlon
        self.progress = progress
        self.ways = 0
        self.roads = []
        self.invalid = 0

    def way(self, way):
        self.ways += 1
        if self.progress and self.ways % 100000 == 0:
            self.progress.update(self.ways, f'{len(self.roads):,} new ways')
        if 'highway' not in way.tags or str(way.id) in self.existing_ids:
            return
        tags = dict(way.tags)
        road_kind = road_class(tags)
        if not road_kind:
            return
        if self.skip_unnamed_minor and road_kind in MINOR_CLASSES and not has_name(tags):
            return
        try:
            coords = [(node.lon, node.lat) for node in way.nodes]
        except Exception:
            self.invalid += 1
            return
        if len(coords) < 2:
            self.invalid += 1
            return
        keep = False
        for cluster in self.clusters:
            lon0, lat0 = cluster['center']
            radius = cluster['radius']
            for lon, lat in coords:
                if distance_m((lon, lat), (lon0, lat0), self.mlat, self.mlon) <= radius:
                    keep = True
                    break
            if keep:
                break
        if not keep:
            return
        self.roads.append({
            'type': 'way',
            'id': way.id,
            'tags': tags,
            'geometry': [{'lon': round(lon, 7), 'lat': round(lat, 7)} for lon, lat in coords],
        })


def sha256_file(path, progress):
    digest = hashlib.sha256()
    done = 0
    with path.open('rb') as handle:
        while chunk := handle.read(4 * 1024 * 1024):
            digest.update(chunk)
            done += len(chunk)
            progress.update(done)
    return digest.hexdigest()


def write_source(raw_dir, city, coverage):
    path = raw_dir / 'source.json'
    try:
        source = json.loads(path.read_text())
    except (FileNotFoundError, json.JSONDecodeError):
        source = {}
    source.setdefault('city', city)
    source.setdefault('provider', 'OpenStreetMap')
    source.setdefault('license', 'Open Database License (ODbL)')
    source.setdefault('url', 'https://www.openstreetmap.org/copyright')
    source['coverage'] = coverage

    payload = json.dumps(source, ensure_ascii=False, separators=(',', ':'))
    path.write_text(payload)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--pbf', type=pathlib.Path, required=True)
    parser.add_argument('--city', default='tbilisi')
    parser.add_argument('--output', type=pathlib.Path)
    parser.add_argument('--gap-threshold', type=float, default=350)
    parser.add_argument('--cluster-link', type=float, default=5000)
    parser.add_argument('--margin', type=float, default=2000)
    parser.add_argument('--min-radius', type=float, default=3000)
    parser.add_argument('--max-radius', type=float, default=8000)
    args = parser.parse_args()
    if not args.pbf.is_file():
        parser.error(f'PBF not found: {args.pbf}')

    config = json.loads((ROOT / 'data' / 'cities' / f'{args.city}.json').read_text())
    build = config.get('build') or {}
    if not build.get('coverage'):
        parser.error(f'{args.city}: build.coverage is not configured')
    raw_dir = ROOT / build.get('rawDir', f'raw/osm/{args.city}')
    selected_path = raw_dir / build['selected']
    if not selected_path.is_file():
        parser.error(f'{args.city}: selected extract not found at {selected_path}')
    output = args.output or raw_dir / build['coverage']
    skip_unnamed_minor = bool(build.get('skipUnnamedMinorRoads'))

    points = load_points(args.city)
    print(f'Objects: {len(points)}', file=sys.stderr, flush=True)
    selected_ids, selected = load_selected_roads(args.city, skip_unnamed_minor)
    print(f'Selected road ways: {len(selected_ids)} ({len(selected)} rendered)', file=sys.stderr, flush=True)
    if not selected:
        parser.error(f'{args.city}: selected extract has no rendered roads')
    tree = STRtree([LineString(coords) for _, coords in selected])
    mlat, mlon = local_meters(config['map']['center']['lat'])

    gap_progress = Progress(len(points), 'measure road coverage')
    gap_progress.start()
    gaps = []
    for lon, lat, labels in points:
        point = Point(lon, lat)
        nearest = nearest_points(point, tree.nearest(point))[1]
        distance = distance_m((lon, lat), (nearest.x, nearest.y), mlat, mlon)
        if distance > args.gap_threshold:
            gaps.append({'lon': lon, 'lat': lat, 'distance': distance, 'labels': labels})
        gap_progress.advance(f'{len(gaps)} gaps')
    gap_progress.finish()
    print(
        f'Points farther than {args.gap_threshold:.0f} m from the settlement extract: {len(gaps)}',
        file=sys.stderr, flush=True,
    )
    clusters = cluster_gaps(
        gaps, mlat, mlon, args.cluster_link, args.margin, args.min_radius, args.max_radius,
    )
    for index, cluster in enumerate(clusters, 1):
        lon, lat = cluster['center']
        print(
            f'  cluster {index}: {lat:.5f},{lon:.5f} radius {cluster["radius"]:.0f} m, '
            f'{len(cluster["points"])} points',
            file=sys.stderr, flush=True,
        )

    reader = osmium.io.Reader(str(args.pbf))
    header = reader.header()
    osm_timestamp = header.get('osmosis_replication_timestamp')
    reader.close()

    if clusters:
        print('Scanning PBF for roads around the gaps...', file=sys.stderr, flush=True)
        way_progress = Progress(None, 'scan PBF ways', min_interval=1.0)
        way_progress.start('way scan; total unknown')
        handler = RoadHandler(
            selected_ids, clusters, skip_unnamed_minor, mlat, mlon, way_progress,
        )
        handler.apply_file(str(args.pbf), locations=True, idx='flex_mem')
        way_progress.finish(f'{handler.ways:,} ways scanned')
        elements = handler.roads
        print(f'Coverage ways: {len(elements):,}; invalid: {handler.invalid:,}', file=sys.stderr, flush=True)
    else:
        elements = []

    hash_progress = Progress(args.pbf.stat().st_size, 'hash PBF', unit='bytes', min_interval=0.5)
    hash_progress.start()
    digest = sha256_file(args.pbf, hash_progress)
    hash_progress.finish()

    coverage_details = {
        'provider': 'Geofabrik',
        'url': config.get('osm', {}).get('pbfUrl'),
        'osmTimestamp': osm_timestamp,
        'gapThresholdM': round(args.gap_threshold),
        'clusters': [
            {
                'lat': round(cluster['center'][1], 7),
                'lon': round(cluster['center'][0], 7),
                'radiusM': round(cluster['radius']),
                'points': [
                    {
                        'lon': point['lon'],
                        'lat': point['lat'],
                        'distanceM': round(point['distance']),
                        'labels': point['labels'],
                    }
                    for point in cluster['points']
                ],
            }
            for cluster in clusters
        ],
        'license': 'Open Database License (ODbL)',
    }
    payload = {
        'version': 0.6,
        'generator': 'pyosmium coverage extract for ArchAtlas',
        'osm3s': {'timestamp_osm_base': osm_timestamp},
        'source': {
            **coverage_details,
            'file': args.pbf.name,
            'sha256': digest,
        },
        'elements': elements,
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(payload, ensure_ascii=False, separators=(',', ':')))
    coverage_digest = hashlib.sha256(output.read_bytes()).hexdigest()
    write_source(raw_dir, args.city, {
        **coverage_details,
        'file': output.name,
        'sha256': coverage_digest,
        'pbfFile': args.pbf.name,
        'pbfSha256': digest,
        'elements': len(elements),
    })
    print(f'Wrote {output} ({output.stat().st_size:,} bytes), PBF sha256 {digest}', file=sys.stderr, flush=True)
    print(f'Coverage ways: {len(elements)}')


if __name__ == '__main__':
    main()

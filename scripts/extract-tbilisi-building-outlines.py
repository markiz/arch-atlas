#!/usr/bin/env python3
"""Extract mapped building ways inside Tbilisi from a regional OSM PBF."""
import argparse
import hashlib
import json
import pathlib
import sys
import osmium
from shapely.geometry import LineString, Polygon, mapping
from shapely.ops import polygonize, transform, unary_union

from progress import Progress


RELATION_ID = 1996871  # Tbilisi administrative boundary, OSM relation/1996871
SOURCE_URL = 'https://download.geofabrik.de/europe/georgia-latest.osm.pbf'


def sha256_file(path: pathlib.Path, progress: Progress | None = None) -> str:
    """Hash the PBF in chunks so a long read still reports progress and ETA."""
    digest = hashlib.sha256()
    total = path.stat().st_size
    done = 0
    with path.open('rb') as handle:
        while chunk := handle.read(4 * 1024 * 1024):
            digest.update(chunk)
            done += len(chunk)
            if progress is not None:
                progress.update(done)
    return digest.hexdigest()


class RelationReader(osmium.SimpleHandler):
    def __init__(self, progress=None):
        super().__init__()
        self.outer_way_ids = set()
        self.tags = None
        self.processed_relations = 0
        self.progress = progress

    def relation(self, relation):
        self.processed_relations += 1
        if self.progress is not None and self.processed_relations % 50000 == 0:
            self.progress.update(self.processed_relations, f'{len(self.outer_way_ids)} outer ways')
        if relation.id != RELATION_ID:
            return
        self.tags = dict(relation.tags)
        self.outer_way_ids = {
            member.ref for member in relation.members
            if member.type == 'w' and member.role in ('', 'outer')
        }


class GeometryReader(osmium.SimpleHandler):
    def __init__(self, outer_way_ids, progress=None):
        super().__init__()
        self.outer_way_ids = outer_way_ids
        self.boundary_lines = []
        self.buildings = []
        self.invalid_buildings = 0
        self.processed_ways = 0
        self.progress = progress

    def way(self, way):
        self.processed_ways += 1
        if self.progress is not None and self.processed_ways % 50000 == 0:
            self.progress.update(self.processed_ways, f'{len(self.buildings):,} buildings')
        is_outer = way.id in self.outer_way_ids
        is_building = 'building' in way.tags
        if not is_outer and not is_building:
            return
        if len(way.nodes) < 2:
            if is_building:
                self.invalid_buildings += 1
            return
        try:
            coords = [(node.lon, node.lat) for node in way.nodes]
            if not all(-180 <= lon <= 180 and -90 <= lat <= 90 for lon, lat in coords):
                raise ValueError('invalid coordinate')
            if is_outer:
                self.boundary_lines.append(LineString(coords))
            if is_building:
                if not way.is_closed() or len(coords) < 4:
                    self.invalid_buildings += 1
                    return
                self.buildings.append((way.id, dict(way.tags), coords))
        except Exception:
            if is_building:
                self.invalid_buildings += 1


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('pbf', type=pathlib.Path)
    parser.add_argument('-o', '--output', type=pathlib.Path,
                        default=pathlib.Path('raw/osm-tbilisi-building-outlines.geojson'))
    args = parser.parse_args()
    if not args.pbf.is_file():
        parser.error(f'PBF not found: {args.pbf}')

    reader = osmium.io.Reader(str(args.pbf))
    pbf_header = reader.header()
    osm_timestamp = pbf_header.get('osmosis_replication_timestamp')
    reader.close()

    print('Pass 1/2: scanning OSM relations for the Tbilisi boundary...', file=sys.stderr, flush=True)
    relation_progress = Progress(None, 'scan PBF relations', min_interval=1.0)
    relation_progress.start('boundary scan; total unknown')
    relations = RelationReader(progress=relation_progress)
    relations.apply_file(str(args.pbf), locations=False)
    relation_progress.finish(f'{relations.processed_relations:,} relations scanned')
    if not relations.outer_way_ids:
        raise SystemExit(f'OSM relation/{RELATION_ID} was not found in the PBF')
    print(f'Boundary relation uses {len(relations.outer_way_ids):,} outer ways', file=sys.stderr, flush=True)

    print('Pass 2/2: scanning OSM ways for boundary lines and buildings...', file=sys.stderr, flush=True)
    way_progress = Progress(None, 'scan PBF ways', min_interval=1.0)
    way_progress.start('way scan; total unknown')
    geometries = GeometryReader(relations.outer_way_ids, progress=way_progress)
    geometries.apply_file(str(args.pbf), locations=True, idx='flex_mem')
    way_progress.finish(f'{geometries.processed_ways:,} ways scanned')
    if not geometries.boundary_lines:
        raise SystemExit('No outer boundary geometry was found')

    print('Assembling the administrative boundary...', file=sys.stderr, flush=True)
    boundary_parts = list(polygonize(unary_union(geometries.boundary_lines)))
    if not boundary_parts:
        raise SystemExit('Could not assemble the administrative boundary')
    boundary = unary_union(boundary_parts)
    if not boundary.is_valid:
        boundary = boundary.buffer(0)
    if boundary.is_empty:
        raise SystemExit('Administrative boundary is empty')

    features = []
    buildings = geometries.buildings
    feature_progress = Progress(len(buildings), 'clip building outlines')
    feature_progress.start()
    for index, (osm_id, tags, coords) in enumerate(buildings, 1):
        polygon = Polygon(coords)
        if not polygon.is_valid:
            polygon = polygon.buffer(0)
        if polygon.is_empty or not boundary.covers(polygon.representative_point()):
            if index % 1000 == 0:
                feature_progress.update(index, f'{len(features):,} features')
            continue
        polygon = transform(lambda x, y, z=None: (round(x, 6), round(y, 6)), polygon)
        geometry = mapping(polygon)
        features.append({
            'type': 'Feature',
            'properties': {**tags, 'kind': 'building', 'osmId': f'way/{osm_id}'},
            'geometry': geometry,
        })
        if index % 1000 == 0:
            feature_progress.update(index, f'{len(features):,} features')
    feature_progress.finish()

    hash_progress = Progress(args.pbf.stat().st_size, 'hash PBF', unit='bytes', min_interval=0.5)
    hash_progress.start()
    digest = sha256_file(args.pbf, hash_progress)
    hash_progress.finish()

    output = {
        'type': 'FeatureCollection',
        'source': {
            'provider': 'Geofabrik', 'url': SOURCE_URL,
            'file': args.pbf.name, 'sha256': digest,
            'osmTimestamp': osm_timestamp,
            'boundary': f'relation/{RELATION_ID}',
            'license': 'Open Database License (ODbL)',
        },
        'features': features,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    print(f'Writing {args.output}...', file=sys.stderr, flush=True)
    args.output.write_text(json.dumps(output, ensure_ascii=False, separators=(',', ':')))
    print(f'Boundary area: {boundary.area:.5f} square degrees')
    print(f'Building ways in boundary: {len(features)}')
    print(f'Open/invalid building ways skipped: {geometries.invalid_buildings}')
    print(f'Wrote {args.output} ({args.output.stat().st_size:,} bytes)')
    print(f'Source SHA-256: {digest}')


if __name__ == '__main__':
    main()

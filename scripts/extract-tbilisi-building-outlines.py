#!/usr/bin/env python3
"""Extract mapped building ways inside Tbilisi from a regional OSM PBF."""
import argparse
import hashlib
import json
import pathlib
import osmium
from shapely.geometry import LineString, Polygon, mapping
from shapely.ops import polygonize, transform, unary_union


RELATION_ID = 1996871  # Tbilisi administrative boundary, OSM relation/1996871
SOURCE_URL = 'https://download.geofabrik.de/europe/georgia-latest.osm.pbf'


class RelationReader(osmium.SimpleHandler):
    def __init__(self):
        super().__init__()
        self.outer_way_ids = set()
        self.tags = None

    def relation(self, relation):
        if relation.id != RELATION_ID:
            return
        self.tags = dict(relation.tags)
        self.outer_way_ids = {
            member.ref for member in relation.members
            if member.type == 'w' and member.role in ('', 'outer')
        }


class GeometryReader(osmium.SimpleHandler):
    def __init__(self, outer_way_ids):
        super().__init__()
        self.outer_way_ids = outer_way_ids
        self.boundary_lines = []
        self.buildings = []
        self.invalid_buildings = 0

    def way(self, way):
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

    relations = RelationReader()
    relations.apply_file(str(args.pbf), locations=False)
    if not relations.outer_way_ids:
        raise SystemExit(f'OSM relation/{RELATION_ID} was not found in the PBF')

    geometries = GeometryReader(relations.outer_way_ids)
    geometries.apply_file(str(args.pbf), locations=True, idx='flex_mem')
    if not geometries.boundary_lines:
        raise SystemExit('No outer boundary geometry was found')

    boundary_parts = list(polygonize(unary_union(geometries.boundary_lines)))
    if not boundary_parts:
        raise SystemExit('Could not assemble the administrative boundary')
    boundary = unary_union(boundary_parts)
    if not boundary.is_valid:
        boundary = boundary.buffer(0)
    if boundary.is_empty:
        raise SystemExit('Administrative boundary is empty')

    features = []
    for osm_id, tags, coords in geometries.buildings:
        polygon = Polygon(coords)
        if not polygon.is_valid:
            polygon = polygon.buffer(0)
        if polygon.is_empty or not boundary.covers(polygon.representative_point()):
            continue
        polygon = transform(lambda x, y, z=None: (round(x, 6), round(y, 6)), polygon)
        geometry = mapping(polygon)
        features.append({
            'type': 'Feature',
            'properties': {**tags, 'kind': 'building', 'osmId': f'way/{osm_id}'},
            'geometry': geometry,
        })

    digest = hashlib.sha256(args.pbf.read_bytes()).hexdigest()
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
    args.output.write_text(json.dumps(output, ensure_ascii=False, separators=(',', ':')))
    print(f'Boundary area: {boundary.area:.5f} square degrees')
    print(f'Building ways in boundary: {len(features)}')
    print(f'Open/invalid building ways skipped: {geometries.invalid_buildings}')
    print(f'Wrote {args.output} ({args.output.stat().st_size:,} bytes)')
    print(f'Source SHA-256: {digest}')


if __name__ == '__main__':
    main()

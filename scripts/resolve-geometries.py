import sys, json, glob, xml.etree.ElementTree as ET
from pathlib import Path
from progress import Progress
sys.path.insert(0, '.deps')
from shapely.geometry import LineString, mapping
from shapely.ops import polygonize, unary_union
nodes = {}; ways = {}; rels = {}
files = sorted(glob.glob('raw/osm-grid-*.xml'))
parse_progress = Progress(len(files), 'parse OSM grid')
parse_progress.start()
for file in files:
    try:
        root = ET.parse(file).getroot()
        for e in root.findall('node'):
            nodes[e.get('id')] = (float(e.get('lon')), float(e.get('lat')))
        for e in root.findall('way'):
            ways[e.get('id')] = [n.get('ref') for n in e.findall('nd')]
        for e in root.findall('relation'):
            rels[e.get('id')] = [(m.get('type'), m.get('ref'), m.get('role')) for m in e.findall('member')]
    finally:
        parse_progress.advance(file)
parse_progress.finish()
result = {}
jobs = [('imeli', '19590971'), ('conservatoire', '18222383'), ('rustaveli', '19640789')]
metekhi_path = Path('raw/metekhi-way.json')
resolve_progress = Progress(len(jobs) + int(metekhi_path.exists()), 'resolve geometry overrides')
resolve_progress.start()
for name, rid in jobs:
    members = rels[rid]; layers = {}
    for role in ('outer', 'inner'):
        lines = []
        for typ, ref, r in members:
            if typ != 'way' or r != role: continue
            refs = ways.get(ref, []); coords = [nodes[n] for n in refs if n in nodes]
            if len(refs) >= 2 and len(refs) == len(coords): lines.append(LineString(coords))
            else: print('MISSING', name, role, ref, len(coords), len(refs), flush=True)
        layers[role] = unary_union(list(polygonize(unary_union(lines)))) if lines else None
    g = layers['outer']
    if g and layers['inner']: g = g.difference(layers['inner'])
    if not g or g.is_empty or g.geom_type not in ('Polygon', 'MultiPolygon'): raise Exception(f'Invalid {name}: {g}')
    result[name] = {'geometry': mapping(g), 'osmId': f'relation/{rid}', 'geometryQuality': 'Контур OpenStreetMap по отношению здания; уточняется редактором'}
    print(name, g.geom_type, 'bounds', g.bounds, 'area', g.area, flush=True)
    resolve_progress.advance(name)
if metekhi_path.exists():
    d = json.loads(metekhi_path.read_text()); n = {str(x['id']): (x['lon'], x['lat']) for x in d['elements'] if x['type'] == 'node'}; w = next(x for x in d['elements'] if x['type'] == 'way'); c = [n[str(x)] for x in w['nodes']];
    if c[0] != c[-1]: raise Exception('Metekhi not a closed outline')
    result['metekhi'] = {'geometry': {'type': 'Polygon', 'coordinates': [c]}, 'osmId': 'way/1064270003', 'geometryQuality': 'Контур OpenStreetMap по идентификатору объекта; уточняется редактором'}
    print('metekhi', len(c), flush=True)
    resolve_progress.advance('metekhi')
resolve_progress.finish()
Path('data/geometry-overrides.json').write_text(json.dumps(result, ensure_ascii=False, separators=(',', ':')))

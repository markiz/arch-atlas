#!/usr/bin/env python3
"""Download the fixed 4x4 OSM grid used by the Tbilisi prototype."""
import concurrent.futures
import pathlib
import urllib.parse
import urllib.request

from progress import Progress

ROOT = pathlib.Path(__file__).resolve().parent.parent
JOBS = []
for i in range(4):
    for j in range(4):
        left = 44.783 + i * 0.007
        bottom = 41.687 + j * 0.006
        JOBS.append((f'grid-{i}-{j}', (left, bottom, left + 0.007, bottom + 0.006)))

progress = Progress(len(JOBS), 'fetch OSM grid')


def get(job):
    name, box = job
    path = ROOT / 'raw' / f'osm-{name}.xml'
    if path.exists() and path.stat().st_size > 1000:
        size = path.stat().st_size
        progress.advance(f'{name}: cached {size:,} B')
        return name, 'cached', size
    url = 'https://api.openstreetmap.org/api/0.6/map?' + urllib.parse.urlencode(
        {'bbox': ','.join(f'{x:.6f}' for x in box)}
    )
    try:
        request = urllib.request.Request(
            url, headers={'User-Agent': 'TbilisiArchitectureAtlas/0.1 (research prototype)'}
        )
        with urllib.request.urlopen(request, timeout=60) as response:
            data = response.read()
        path.write_bytes(data)
        progress.advance(f'{name}: downloaded {len(data):,} B')
        return name, 'ok', len(data)
    except Exception as error:
        progress.advance(f'{name}: error {type(error).__name__}')
        return name, str(error), 0


progress.start(f'{len(JOBS)} tiles')
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
    for value in pool.map(get, JOBS):
        print(*value, flush=True)
progress.finish()

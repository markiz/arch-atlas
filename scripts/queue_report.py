#!/usr/bin/env python3
"""Render a compact status report for the queue collector.

Reads work/queue/index.jsonl (or scans collect.json files), optionally merges
verdict.json files produced by the adjudication step, and prints Markdown.
Nothing is written unless --out is passed.

Examples:
  python3 scripts/queue_report.py
  python3 scripts/queue_report.py --out work/queue/report.md
  python3 scripts/queue_report.py --only 1,2,28
"""
from __future__ import annotations

import argparse
import json
from collections import Counter
from pathlib import Path
import re
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_QUEUE = ROOT / 'docs/research-next-200.md'
DEFAULT_WORK = ROOT / 'work/queue'
DEFAULT_ATLAS = ROOT / 'public/atlas/buildings.json'


def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding='utf-8'))


def parse_queue(path: Path) -> list[dict[str, Any]]:
    text = path.read_text(encoding='utf-8')
    pattern = re.compile(
        r'^\|\s*(\d+)\s*\|\s*(\d+)\s*\|[^|]*\|\s*\[way/(\d+)\]',
        re.MULTILINE,
    )
    return [
        {'n': int(match.group(1)), 'registryId': int(match.group(2)), 'osmWay': match.group(3)}
        for match in pattern.finditer(text)
    ]


def atlas_ways(path: Path) -> set[str]:
    data = read_json(path)
    return {
        str(item.get('osmId', '')).replace('way/', '')
        for item in data
        if str(item.get('osmId', '')).startswith('way/')
    }


def load_index(work: Path) -> dict[int, dict[str, Any]]:
    index_path = work / 'index.jsonl'
    items: dict[int, dict[str, Any]] = {}
    if index_path.exists():
        for line in index_path.read_text(encoding='utf-8').splitlines():
            if line.strip():
                item = json.loads(line)
                items[int(item['n'])] = item
    if not items and work.exists():
        for artifact in sorted(work.glob('*/collect.json')):
            data = read_json(artifact)
            candidate = data.get('candidate', {})
            metrics = data.get('metrics', {})
            items[int(candidate['n'])] = {
                'n': candidate['n'],
                'registryId': candidate.get('registryId'),
                'osmWay': candidate.get('osmWay'),
                'name': (data.get('registry', {}).get('attributes') or {}).get('Name', ''),
                'status': 'ok' if not data.get('errors') else 'partial',
                'iou': metrics.get('iou'),
                'placeStatus': (data.get('placeId') or {}).get('status'),
                'commonsCount': len(data.get('commons') or []),
                'atlasOverlapCount': len(data.get('atlasOverlaps') or []),
                'errors': data.get('errors') or [],
            }
    return items


def load_verdicts(work: Path) -> dict[int, dict[str, Any]]:
    verdicts: dict[int, dict[str, Any]] = {}
    for path in sorted(work.glob('*/verdict.json')):
        try:
            data = read_json(path)
            n = int(data.get('n') or data.get('candidate', {}).get('n'))
            verdicts[n] = data
        except Exception:
            continue
    return verdicts


def bucket(iou: float | None) -> str:
    if iou is None:
        return '—'
    if iou >= 0.70:
        return '≥0,70'
    if iou >= 0.25:
        return '0,25–0,70'
    return '<0,25'


def short(value: str, limit: int = 60) -> str:
    value = (value or '').replace('|', '/').strip()
    return value if len(value) <= limit else value[:limit - 1] + '…'


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--queue', type=Path, default=DEFAULT_QUEUE)
    parser.add_argument('--work', type=Path, default=DEFAULT_WORK)
    parser.add_argument('--atlas', type=Path, default=DEFAULT_ATLAS)
    parser.add_argument('--out', type=Path, help='write Markdown (default: stdout)')
    parser.add_argument('--only', help='candidate numbers, comma separated')
    args = parser.parse_args()

    queue = parse_queue(args.queue)
    queue_ways = {row['osmWay'] for row in queue}
    added = atlas_ways(args.atlas) & queue_ways
    remaining_all = [row for row in queue if row['osmWay'] not in added]
    remaining = remaining_all
    if args.only:
        wanted = {int(value) for value in args.only.split(',') if value.strip()}
        remaining = [row for row in remaining_all if row['n'] in wanted]

    index = load_index(args.work)
    verdicts = load_verdicts(args.work)
    collected = [index.get(row['n']) for row in remaining_all if index.get(row['n'])]
    statuses = Counter(item.get('status', 'unknown') for item in collected)
    verdict_counts = Counter(item.get('status', 'unknown') for item in verdicts.values())
    place_counts = Counter(item.get('placeStatus') or 'none' for item in collected if item)
    iou_counts = Counter(bucket(item.get('iou')) for item in collected)

    lines: list[str] = []
    lines.append('# Очередь 200: состояние сбора')
    lines.append('')
    lines.append('| Показатель | Значение |')
    lines.append('|---|---:|')
    lines.append(f'| Всего в очереди | {len(queue)} |')
    lines.append(f'| Уже в атласе | {len(added)} |')
    lines.append(f'| Осталось | {len(remaining_all)} |')
    lines.append(f'| Собрано фактических артефактов | {len(collected)} |')
    lines.append(f'| Сбор: ok / partial / error | {statuses.get("ok", 0)} / {statuses.get("partial", 0)} / {statuses.get("error", 0)} |')
    lines.append(f'| Вердикты: ready / hold / reject | {verdict_counts.get("ready", 0)} / {verdict_counts.get("hold", 0)} / {verdict_counts.get("reject", 0)} |')
    lines.append('')

    lines.append('## IoU и Place ID')
    lines.append('')
    lines.append('| Метрика | Значение |')
    lines.append('|---|---:|')
    for key in ('≥0,70', '0,25–0,70', '<0,25', '—'):
        lines.append(f'| IoU {key} | {iou_counts.get(key, 0)} |')
    for key in ('matched', 'unmatched', 'none'):
        lines.append(f'| Place ID {key} | {place_counts.get(key, 0)} |')
    lines.append('')

    lines.append('## Кандидаты')
    lines.append('')
    lines.append('| № | Реестр | Название | IoU | Сбор | Place ID | Commons | Пересечения | Вердикт |')
    lines.append('|---:|---:|---|---:|---|---|---:|---|---|')
    for row in remaining:
        item = index.get(row['n']) or {}
        verdict = verdicts.get(row['n']) or {}
        name = item.get('name') or verdict.get('name') or ''
        lines.append('| {} | {} | {} | {} | {} | {} | {} | {} | {} |'.format(
            row['n'], row['registryId'], short(name),
            bucket(item.get('iou')),
            item.get('status', '—'),
            item.get('placeStatus') or '—',
            item.get('commonsCount', '—'),
            item.get('atlasOverlapCount', '—'),
            verdict.get('status', '—'),
        ))
    lines.append('')

    errors = [
        (row['n'], item.get('errors') or [])
        for row in remaining
        for item in [index.get(row['n'])]
        if item and item.get('errors')
    ]
    if errors:
        lines.append('## Ошибки сбора')
        lines.append('')
        for n, messages in errors:
            lines.append(f'- №{n}: ' + '; '.join(str(message) for message in messages))
        lines.append('')

    text = '\n'.join(lines)
    if args.out:
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text(text + '\n', encoding='utf-8')
        print(f'written {args.out}')
    else:
        print(text)
    return 0


if __name__ == '__main__':
    raise SystemExit(main())

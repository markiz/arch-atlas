#!/usr/bin/env python3
"""Create a research shortlist of 200 Tbilisi heritage records for editorial review.

The official registry is queried live. The report stores only record identifiers,
source links and completeness flags, not the registry's descriptive text.
"""
import argparse
import json
import re
import sys
import urllib.parse
import urllib.request
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

from progress import Progress

try:
    from shapely.geometry import Point, shape
    from shapely.strtree import STRtree
except ImportError:
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent / '.deps'))
    from shapely.geometry import Point, shape
    from shapely.strtree import STRtree

ROOT = Path(__file__).resolve().parent.parent
REGISTRY = 'https://memkvidreoba.gov.ge/arcgisch/rest/services/CultureWMS/PS_ImmovableMonumentObjectP/MapServer/1'
DETAIL = 'https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id={}'
MAX_DISTANCE = 0.0002  # roughly 17 m at Tbilisi latitude
EXISTING_DISTANCE = 0.00015  # roughly 13 m; shortlist deduplication only


def request_json(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'TbilisiArchitectureAtlasResearch/1.0'})
    with urllib.request.urlopen(req, timeout=90) as response:
        return json.load(response)


def registry_count():
    """Ask ArcGIS for the number of matching records so progress can show an ETA."""
    params = {
        'where': "Region=N'თბილისი'",
        'returnCountOnly': 'true',
        'f': 'json',
    }
    try:
        page = request_json(REGISTRY + '/query?' + urllib.parse.urlencode(params))
        if 'count' in page:
            count = int(page['count'])
            return count if count > 0 else None
    except Exception as error:
        print(f'Registry count unavailable: {error}', file=sys.stderr, flush=True)
    return None


def registry_records():
    records = []
    offset = 0
    total = registry_count()
    progress = Progress(total, 'fetch heritage registry')
    progress.start(f"{total if total is not None else 'unknown'} records")
    try:
        while True:
            params = {
                'where': "Region=N'თბილისი'",
                'outFields': 'ObjectID,ID,RegistryN,Name,Description,Address,ExactDate,DateRangeFrom,DateRangeTo,Classification,Accuracy,X,Y',
                'returnGeometry': 'false',
                'f': 'json',
                'resultRecordCount': '2000',
                'resultOffset': str(offset),
                'orderByFields': 'ObjectID',
            }
            page = request_json(REGISTRY + '/query?' + urllib.parse.urlencode(params))
            if 'error' in page:
                raise RuntimeError('Heritage registry query failed: ' + str(page['error']))
            rows = page.get('features', [])
            records.extend(row['attributes'] for row in rows)
            offset += len(rows)
            progress.update(offset, f'page {offset // 2000}')
            if len(rows) < 2000:
                break
    finally:
        progress.finish()
    return records


def year_is_numeric(value):
    return bool(re.search(r'(?<!\d)(?:1[0-9]{3}|20[0-9]{2})(?!\d)', str(value or '')))


def build_report(force=False):
    report_path = ROOT / 'docs/research-next-200.md'
    if report_path.exists() and not force:
        raise SystemExit('Report exists; use --force only after preserving the current research snapshot')
    registry = registry_records()
    outline_file = ROOT / 'raw/osm-tbilisi-building-outlines.geojson'
    atlas_file = ROOT / 'public/atlas/buildings.json'
    outlines = json.loads(outline_file.read_text())['features']
    atlas = json.loads(atlas_file.read_text())

    geometries, properties = [], []
    outline_progress = Progress(len(outlines), 'index OSM outlines')
    outline_progress.start()
    for index, feature in enumerate(outlines, 1):
        try:
            geom = shape(feature['geometry'])
            if not geom.is_empty and geom.is_valid:
                geometries.append(geom)
                properties.append(feature.get('properties', {}))
        except (KeyError, TypeError, ValueError):
            pass
        if index % 1000 == 0:
            outline_progress.update(index)
    outline_progress.finish()
    tree = STRtree(geometries)
    geometry_indexes = {id(geom): index for index, geom in enumerate(geometries)}
    existing_points = [Point(*building['coordinates']) for building in atlas]
    existing_polygons = [shape(building['geometry']) for building in atlas]
    existing_tree = STRtree(existing_polygons)
    existing_ways = {building.get('osmId') for building in atlas}

    eligible, exclusions = [], Counter()
    used_ways = set()
    match_progress = Progress(len(registry), 'match registry to OSM')
    match_progress.start(f'{len(registry)} records, {len(geometries):,} valid outlines')
    for record in registry:
        record_id = record.get('ObjectID', '?')
        if 'არქიტექტურ' not in str(record.get('Classification') or '').lower():
            exclusions['classification_not_architecture'] += 1
            match_progress.advance(f'record {record_id}: not architecture')
            continue
        if not record.get('X') or not record.get('Y'):
            exclusions['missing_registry_coordinates'] += 1
            match_progress.advance(f'record {record_id}: no coordinates')
            continue
        point = Point(record['X'], record['Y'])
        if any(point.distance(existing) <= EXISTING_DISTANCE for existing in existing_points):
            exclusions['near_existing_atlas_card'] += 1
            match_progress.advance(f'record {record_id}: near existing card')
            continue
        nearby = [geom for geom in tree.query(point.buffer(MAX_DISTANCE)) if geom.distance(point) <= MAX_DISTANCE]
        if not nearby:
            exclusions['no_osm_outline_within_17m'] += 1
            match_progress.advance(f'record {record_id}: no outline within 17 m')
            continue
        geom = min(nearby, key=lambda candidate: candidate.distance(point))
        way = properties[geometry_indexes[id(geom)]].get('osmId')
        if way in existing_ways:
            exclusions['existing_atlas_osm_id'] += 1
            match_progress.advance(f'record {record_id}: existing OSM id')
            continue
        if any(geom.intersection(existing).area > 0.05 * min(geom.area, existing.area)
               for existing in existing_tree.query(geom)):
            exclusions['overlapping_existing_atlas_outline'] += 1
            match_progress.advance(f'record {record_id}: overlaps atlas outline')
            continue
        if not way or way in used_ways:
            exclusions['duplicate_or_missing_osm_outline'] += 1
            match_progress.advance(f'record {record_id}: duplicate outline')
            continue
        used_ways.add(way)
        tags = properties[geometry_indexes[id(geom)]]
        record = dict(record)
        record['_way'] = way
        record['_distance_m'] = geom.distance(point) * 85000
        record['_tags'] = tags
        eligible.append(record)
        match_progress.advance(f'record {record_id}: eligible')
    match_progress.finish()

    def is_generic_name(record):
        name = re.sub(r'[^\w]+', '', str(record.get('Name') or '').lower())
        return name in {'საცხოვრებელისახლი', 'სახლი', 'შენობა'}

    # Prefer source records with a specific name and useful editorial material,
    # while requiring a distinct OSM building outline for every selected record.
    eligible.sort(key=lambda row: (
        -int(not is_generic_name(row)),
        -int(bool(row.get('Address'))),
        -int(bool(row.get('ExactDate'))),
        -int(bool(row.get('Description'))),
        -int(row.get('Accuracy') == 'სწორია'),
        -min(len(row.get('Description') or ''), 1500),
        int(row['ObjectID']),
    ))
    selected = eligible[:200]
    if len(selected) != 200:
        raise RuntimeError(f'Only {len(selected)} eligible records found; expected 200')

    gaps = Counter()
    for row in selected:
        tags = row['_tags']
        gaps['registry_address_missing'] += not bool(row.get('Address'))
        gaps['registry_date_missing'] += not bool(row.get('ExactDate'))
        gaps['registry_date_without_numeric_year'] += not year_is_numeric(row.get('ExactDate'))
        gaps['registry_description_missing'] += not bool(row.get('Description'))
        gaps['registry_number_missing'] += not bool(row.get('RegistryN'))
        gaps['osm_architect_tag_missing'] += not bool(tags.get('architect') or tags.get('architect:wikidata'))
        gaps['osm_architecture_tag_missing'] += not bool(tags.get('building:architecture'))
        gaps['commons_reference_missing'] += not bool(tags.get('wikimedia_commons'))
        gaps['outline_match_over_5m'] += row['_distance_m'] > 5

    lines = [
        '# Исследовательская очередь: следующие 200 объектов Тбилиси',
        '',
        '**Статус:** очередь кандидатов для редакционной проверки; эти записи ещё не добавлены в каталог атласа.',
        '',
        'Первые результаты исследования и Google API: [отдельные заметки](research-next-200-findings.md).',
        '',
        f"**Снимок:** {datetime.now(timezone.utc).date().isoformat()} UTC. Контуры: © участники OpenStreetMap, [ODbL](https://www.openstreetmap.org/copyright).",
        '',
        '## Основание и метод',
        '',
        f'- В официальном реестре найдено записей по Тбилиси: **{len(registry)}**. Запрос: `Region=N\'თბილისი\'` к [слою недвижимых памятников](https://memkvidreoba.gov.ge/arcgisch/rest/services/CultureWMS/PS_ImmovableMonumentObjectP/MapServer/1).',
        f'- Сопоставление выполнено с {len(outlines):,} контурами из локальной OSM-выгрузки `raw/osm-tbilisi-building-outlines.geojson` и 100 текущими карточками.',
        '- Отобраны записи с классификацией архитектуры, отдельным контуром OSM в радиусе примерно 17 м, без близкого совпадения или значительного пересечения с текущей карточкой атласа. Сначала взяты записи с конкретным названием и содержательным описанием.',
        '- Сопоставление точки реестра с контуром автоматическое. Даже расстояние 0 м не подтверждает, что реестр и контур относятся к одному корпусу; каждую пару нужно проверить на карте и по адресу.',
        '- Официальные текстовые поля не перепечатываются в этом отчёте: условия повторного использования данных реестра не установлены. Идентификаторы нужны для открытия карточек источника.',
        '',
        '## Сводка пробелов для отобранных 200',
        '',
        '| Поле / проверка | Не хватает или нужно проверить | Что известно сейчас |',
        '|---|---:|---|',
        f"| Адрес в реестре | {gaps['registry_address_missing']}/200 без адреса | Наличие поля не заменяет проверку адреса и перевод на русский, английский и украинский |",
        f"| Датировка в реестре | {gaps['registry_date_missing']}/200 без `ExactDate`; {gaps['registry_date_without_numeric_year']}/200 без четырёхзначного года в строке | Год в строке также требует проверки: он может относиться к перестройке или диапазону |",
        f"| Описание в реестре | {gaps['registry_description_missing']}/200 без описания | Тексты источника на грузинском требуют редакционной выжимки и перевода |",
        f"| Номер реестра | {gaps['registry_number_missing']}/200 без `RegistryN` | `ObjectID` и ссылка на источник остаются доступны |",
        f"| Архитектор | {gaps['osm_architect_tag_missing']}/200 без тега архитектора в сопоставленном OSM-контуре | Отдельного поля архитектора в схеме реестра нет; нужна профильная проверка для всех 200 |",
        f"| Стиль | {gaps['osm_architecture_tag_missing']}/200 без `building:architecture` в OSM | У реестра нет отдельного поля стиля; классифицировать по источнику/фасаду для всех 200 |",
        f"| Фото | {gaps['commons_reference_missing']}/200 без тега `wikimedia_commons` у контура | Для всех 200 ещё нет проверенной локальной галереи с автором, лицензией, источником и правами на изображённую архитектуру |",
        f"| Геометрия | 0/200 без близкого контура OSM; {gaps['outline_match_over_5m']}/200 точек реестра дальше 5 м от сопоставленного контура | Все 200 пар требуют ручного подтверждения принадлежности корпуса и качества Polygon |",
        '| Переводы и карточка атласа | 200/200 | Нужны переводы имени, адреса и описания на ru/en/ka/uk, район, стиль/авторы с ID и редакционный текст |',
        '',
        '## Список для ручной проверки',
        '',
        'Таблица не содержит названий и адресов из реестра. Откройте карточку источника по ссылке; OSM way — только пространственный кандидат.',
        '',
        '| № | ID реестра | Реестр | OSM way-кандидат | Адрес в источнике | Дата в источнике | Архитектор в OSM | Стиль в OSM | Commons-ссылка | Смещение точки, м |',
        '|---:|---:|---|---|---|---|---|---|---|---:|',
    ]
    report_progress = Progress(len(selected), 'write report rows')
    report_progress.start()
    for number, row in enumerate(selected, 1):
        tags = row['_tags']
        lines.append(
            f"| {number} | {row['ObjectID']} | [карточка]({DETAIL.format(row['ObjectID'])}) | "
            f"[{row['_way']}](https://www.openstreetmap.org/{row['_way']}) | "
            f"{'есть' if row.get('Address') else 'нет'} | {'есть' if row.get('ExactDate') else 'нет'} | "
            f"{'есть' if tags.get('architect') or tags.get('architect:wikidata') else 'нет'} | "
            f"{'есть' if tags.get('building:architecture') else 'нет'} | "
            f"{'есть' if tags.get('wikimedia_commons') else 'нет'} | {row['_distance_m']:.1f} |"
        )
        report_progress.advance(f'row {number}')

    report_progress.finish()
    lines += [
        '',
        '## Ограничения перед добавлением в каталог',
        '',
        '- Это первичная очередь из реестра охраняемого наследия, а не редакционное решение о публикации. Отсеять не отдельные здания, дубли комплексов, разрушенные/перестроенные объекты и неуместные для атласа записи.',
        '- Найденные OSM-контуры локальны и имеют лицензию ODbL; перед включением подтвердить геометрию, закрытые кольца и соответствие конкретному корпусу. Не использовать точку реестра как геометрию.',
        '- Сначала проверить исторические факты по первичному источнику, отдельно отличая датировку существующего корпуса от периода участка/комплекса.',
        '- У каждого снимка проверить здание, ракурс, авторство, лицензию и отдельные права на архитектурное произведение.',
        '- Place ID необязателен для исторической карточки; Google API запускать только отдельным согласованным батчем с допуском 5 м.',
        '',
        'Генератор очереди: `python3 scripts/create-next-200-report.py`. Для перезаписи существующего отчёта нужен `--force`: новый отбор может не совпадать с сохранённым Google-отчётом и редакционными заметками. Данные реестра запрашиваются по HTTPS с проверкой сертификата; при ошибке скрипт останавливается.',
        '',
    ]
    report_path.write_text('\n'.join(lines), encoding='utf-8')
    print(f"Wrote docs/research-next-200.md: registry={len(registry)}, eligible={len(eligible)}, selected={len(selected)}")
    print('Exclusions:', dict(exclusions))
    print('Gaps:', dict(gaps))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--force', action='store_true', help='replace the existing research snapshot')
    build_report(force=parser.parse_args().force)

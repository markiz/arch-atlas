#!/usr/bin/env python3
"""Import the current basemap landmarks into one JSON file per object.

This is a bootstrap/import tool, not the everyday editor. It reads the OSM
extracts, the generated basemap and the existing atlas cards, and writes
data/landmarks/<city>/osm-<id>.json and never overwrites an existing card:
delete a card to re-import it. The assembled bundle is produced by
scripts/assemble-landmarks.mjs.
"""
import argparse
import json
import pathlib
import re
import sys
import xml.etree.ElementTree as ET
from datetime import date

from progress import Progress

ROOT = pathlib.Path(__file__).resolve().parent.parent
CITY = 'tbilisi'
LANGS = ('ru', 'en', 'ka', 'uk')
OSM_BASE = 'https://www.openstreetmap.org'
ALLOWED_CATEGORIES = {'museum', 'church', 'castle', 'theatre', 'monument'}


def load_atlas_cards():
    cards = {}
    for path in sorted((ROOT / 'data' / 'atlas' / CITY).glob('*.json')):
        try:
            card = json.loads(path.read_text())
        except Exception:
            continue
        osm_id = card.get('osmId')
        if osm_id and osm_id not in cards:
            cards[osm_id] = card
    return cards


def load_registry():
    ids = {}
    by_way = {}
    mapping_path = ROOT / 'work' / 'way-registry-map.json'
    if mapping_path.exists():
        try:
            raw = json.loads(mapping_path.read_text())
            for way_id, entries in raw.items():
                if entries:
                    by_way[str(way_id)] = int(entries[0][0])
        except Exception:
            by_way = {}
    registry_path = ROOT / 'work' / 'reg-tbilisi.geojson'
    if registry_path.exists():
        try:
            data = json.loads(registry_path.read_text())
            for feature in data.get('features', []):
                props = feature.get('properties') or {}
                rid = props.get('ImmovableObjectID')
                if rid is not None:
                    ids[int(rid)] = props
        except Exception:
            ids = {}
    return by_way, ids


def load_osm_tags():
    tags = {}
    for path in sorted((ROOT / 'raw').glob('osm-grid-*.xml')):
        try:
            doc = ET.parse(path).getroot()
        except Exception:
            continue
        for element in doc:
            if element.tag not in ('node', 'way', 'relation'):
                continue
            key = f'{element.tag}/{element.attrib.get("id")}'
            tags[key] = {t.attrib.get('k'): t.attrib.get('v') for t in element.findall('tag')}
    selected_path = ROOT / 'raw' / 'osm-tbilisi-selected.json'
    if selected_path.exists():
        try:
            data = json.loads(selected_path.read_text())
            for element in data.get('elements', []):
                key = f'{element.get("type")}/{element.get("id")}'
                tags.setdefault(key, element.get('tags') or {})
        except Exception:
            pass
    return tags


def point_from_geometry(geometry):
    if not geometry:
        return None
    if geometry.get('type') == 'Point':
        return geometry.get('coordinates')
    if geometry.get('type') == 'Polygon':
        ring = (geometry.get('coordinates') or [[]])[0]
        if not ring:
            return None
        # Shoelace centroid; fall back to the vertex average for degenerate rings.
        area = 0.0
        cx = 0.0
        cy = 0.0
        for (x1, y1), (x2, y2) in zip(ring, ring[1:] + ring[:1]):
            cross = x1 * y2 - x2 * y1
            area += cross
            cx += (x1 + x2) * cross
            cy += (y1 + y2) * cross
        if abs(area) > 1e-15:
            return [round(cx / (3 * area), 6), round(cy / (3 * area), 6)]
        return [round(sum(p[0] for p in ring) / len(ring), 6), round(sum(p[1] for p in ring) / len(ring), 6)]
    if geometry.get('type') == 'MultiPolygon':
        polygons = geometry.get('coordinates') or []
        points = [point_from_geometry({'type': 'Polygon', 'coordinates': p}) for p in polygons]
        points = [p for p in points if p]
        if not points:
            return None
        return [round(sum(p[0] for p in points) / len(points), 6), round(sum(p[1] for p in points) / len(points), 6)]
    return None


def subcategory(tags, name, category):
    building = tags.get('building', '')
    historic = tags.get('historic', '')
    religion = tags.get('religion', '')
    if category == 'church':
        if building == 'mosque' or religion == 'muslim':
            return 'mosque'
        if building == 'synagogue' or religion == 'jewish':
            return 'synagogue'
        if building == 'monastery' or historic == 'monastery' or 'монаст' in name.lower():
            return 'monastery'
        if building == 'cathedral' or 'собор' in name.lower():
            return 'cathedral'
        if building == 'chapel' or 'часовн' in name.lower():
            return 'chapel'
        return 'church'
    if category == 'museum':
        if tags.get('tourism') == 'gallery' or 'галере' in name.lower():
            return 'gallery'
        if 'дом-музей' in name.lower():
            return 'house_museum'
        if 'мемориальн' in name.lower():
            return 'memorial_museum'
        return 'museum'
    if category == 'castle':
        if tags.get('castle_type') == 'palace' or 'дворец' in name.lower():
            return 'palace'
        if tags.get('man_made') == 'tower' or 'башн' in name.lower():
            return 'tower'
        return 'fortress'
    if category == 'theatre':
        if 'опер' in name.lower():
            return 'opera'
        if 'концерт' in name.lower():
            return 'concert_hall'
        return 'theatre'
    if category == 'monument':
        if historic == 'archaeological_site':
            return 'archaeological_site'
        if historic == 'memorial' or 'мемориал' in name.lower():
            return 'memorial'
        return 'monument'
    return 'unknown'


def year_from_tags(tags):
    value = tags.get('start_date', '') or ''
    match = re.search(r'(1[0-9]{3}|20[0-9]{2})', value)
    return int(match.group(1)) if match else None


def heritage_data(tags, osm_id, by_way, registry, atlas_card=None):
    osm_value = tags.get('heritage')
    if osm_value not in ('1', '2', '3'):
        osm_value = None
    registry_id = None
    if osm_id.startswith('way/'):
        registry_id = by_way.get(osm_id.split('/', 1)[1])
    if registry_id is None and atlas_card:
        for url in (atlas_card.get('source'), atlas_card.get('otherSource')):
            if isinstance(url, str):
                match = re.search(r'[?&]id=([0-9]+)', url)
                if match:
                    registry_id = int(match.group(1))
                    break
    registry_props = registry.get(registry_id) if registry_id else None
    status = 'unknown'
    if registry_props:
        category = str(registry_props.get('CategoryName', ''))
        status = 'national' if ('National' in category or 'ეროვნ' in category) else 'listed'
    elif osm_value == '1':
        status = 'national'
    elif osm_value == '2':
        status = 'local'
    elif osm_value == '3':
        status = 'listed'
    elif tags.get('heritage') is not None:
        status = 'listed'
    url = tags.get('heritage:website')
    if not url and registry_id:
        url = f'https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id={registry_id}'
    return {
        'status': status,
        'registryId': registry_id,
        'osm': osm_value,
        'url': url,
    }


def wikipedia_urls(tags):
    result = {lang: '' for lang in LANGS}
    raw = tags.get('wikipedia')
    if raw and ':' in raw:
        lang, title = raw.split(':', 1)
        if lang in result:
            result[lang] = f'https://{lang}.wikipedia.org/wiki/{title.replace(" ", "_")}'
    for lang in LANGS:
        value = tags.get(f'wikipedia:{lang}')
        if value:
            result[lang] = f'https://{lang}.wikipedia.org/wiki/{value.replace(" ", "_")}'
    return result


def recognition_data(tags):
    wikidata = tags.get('wikidata')
    if not (wikidata and re.fullmatch(r'Q[0-9]+', wikidata)):
        wikidata = None
    wikipedia = wikipedia_urls(tags)
    language_count = sum(bool(value) for value in wikipedia.values())
    commons = tags.get('wikimedia_commons')
    if commons and not commons.startswith('Category:'):
        commons = None
    return {
        'wikidata': wikidata,
        'wikipedia': wikipedia,
        'commonsCategory': commons,
        'languageCount': language_count,
    }


def significance_data(category, subcategory_name, name, heritage, recognition, year, has_atlas):
    heritage_points = {'national': 30, 'local': 20, 'listed': 10, 'none': 0, 'unknown': 0}.get(heritage['status'], 0)
    if recognition['languageCount'] >= 3:
        recognition_points = 25
    elif recognition['languageCount'] == 2:
        recognition_points = 18
    elif recognition['languageCount'] == 1:
        recognition_points = 12
    elif recognition['wikidata']:
        recognition_points = 6
    else:
        recognition_points = 0
    lower = name.lower()
    if category == 'church':
        role = 20 if subcategory_name in ('cathedral', 'monastery') else 15 if subcategory_name in ('church', 'synagogue', 'mosque') else 10
    elif category == 'castle':
        role = 20 if subcategory_name == 'fortress' else 15
    elif category == 'museum':
        role = 15 if any(word in lower for word in ('национальн', 'государственн', 'национальная галерея')) else 10
    elif category == 'theatre':
        role = 20 if subcategory_name == 'opera' else 15
    elif category == 'monument':
        role = 10
    else:
        role = 5
    if year is None:
        age = 0
    elif year <= 1800:
        age = 10
    elif year <= 1899:
        age = 7
    elif year <= 1959:
        age = 4
    else:
        age = 2
    editorial = 15 if has_atlas else 0
    components = {
        'heritage': heritage_points,
        'recognition': recognition_points,
        'architecturalRole': role,
        'age': age,
        'editorial': editorial,
    }
    reasons = []
    if heritage_points:
        reasons.append(f'охранный статус: {heritage["status"]}')
    if recognition_points:
        if recognition['languageCount']:
            reasons.append(f'Wikipedia: {recognition["languageCount"]} яз.')
        else:
            reasons.append('есть Wikidata')
    if role >= 15:
        reasons.append('значимая архитектурно-городская роль')
    if age >= 7:
        reasons.append('историческая постройка')
    if has_atlas:
        reasons.append('есть проверенная карточка атласа')
    return {
        'score': sum(components.values()),
        'components': components,
        'reasons': reasons,
        'status': 'provisional',
    }


def draft_description(names, category, subcategory_name):
    nouns = {
        'museum': {'ru': 'Музей', 'en': 'Museum', 'ka': 'მუზეუმი', 'uk': 'Музей'},
        'gallery': {'ru': 'Галерея', 'en': 'Gallery', 'ka': 'გალერეა', 'uk': 'Галерея'},
        'house_museum': {'ru': 'Дом-музей', 'en': 'House Museum', 'ka': 'სახლ-მუზეუმი', 'uk': 'Будинок-музей'},
        'memorial_museum': {'ru': 'Мемориальный музей', 'en': 'Memorial Museum', 'ka': 'მემორიალური მუზეუმი', 'uk': 'Меморіальний музей'},
        'church': {'ru': 'Церковь', 'en': 'Church', 'ka': 'ეკლესია', 'uk': 'Церква'},
        'cathedral': {'ru': 'Собор', 'en': 'Cathedral', 'ka': 'ტაძარი', 'uk': 'Собор'},
        'monastery': {'ru': 'Монастырь', 'en': 'Monastery', 'ka': 'მონასტერი', 'uk': 'Монастир'},
        'chapel': {'ru': 'Часовня', 'en': 'Chapel', 'ka': 'სამლოცველო', 'uk': 'Каплиця'},
        'synagogue': {'ru': 'Синагога', 'en': 'Synagogue', 'ka': 'სინაგოგა', 'uk': 'Синагога'},
        'mosque': {'ru': 'Мечеть', 'en': 'Mosque', 'ka': 'მეჩეთი', 'uk': 'Мечеть'},
        'fortress': {'ru': 'Крепость', 'en': 'Fortress', 'ka': 'ციხესიმაგრე', 'uk': 'Фортеця'},
        'palace': {'ru': 'Дворец', 'en': 'Palace', 'ka': 'სასახლე', 'uk': 'Палац'},
        'tower': {'ru': 'Башня', 'en': 'Tower', 'ka': 'კოშკი', 'uk': 'Вежа'},
        'theatre': {'ru': 'Театр', 'en': 'Theatre', 'ka': 'თეატრი', 'uk': 'Театр'},
        'opera': {'ru': 'Оперный театр', 'en': 'Opera House', 'ka': 'ოპერის თეატრი', 'uk': 'Оперний театр'},
        'concert_hall': {'ru': 'Концертный зал', 'en': 'Concert Hall', 'ka': 'საკონცერტო დარბაზი', 'uk': 'Концертний зал'},
        'monument': {'ru': 'Памятник', 'en': 'Monument', 'ka': 'ძეგლი', 'uk': "Пам'ятник"},
        'memorial': {'ru': 'Мемориал', 'en': 'Memorial', 'ka': 'მემორიალი', 'uk': 'Меморіал'},
        'archaeological_site': {'ru': 'Археологический памятник', 'en': 'Archaeological site', 'ka': 'არქეოლოგიური ძეგლი', 'uk': "Археологічна пам'ятка"},
        'historic_building': {'ru': 'Историческое здание', 'en': 'Historic building', 'ka': 'ისტორიული შენობა', 'uk': 'Історична будівля'},
    }
    noun = nouns.get(subcategory_name) or nouns.get(category) or nouns['museum']
    markers = {
        'ru': ('музей', 'галере', 'церков', 'храм', 'собор', 'базилик', 'монаст', 'часовн', 'синагог', 'мечет', 'крепост', 'дворец', 'башн', 'театр', 'опер'),
        'en': ('museum', 'gallery', 'church', 'cathedral', 'basilica', 'monaster', 'chapel', 'synagog', 'mosque', 'fortress', 'palace', 'tower', 'theatre', 'opera'),
        'ka': ('მუზეუმ', 'გალერე', 'ეკლეს', 'ტაძარ', 'ბაზილიკ', 'მონასტ', 'სამლოცველ', 'სინაგოგ', 'მეჩეთ', 'ციხესიმაგრ', 'სასახლ', 'კოშკ', 'თეატრ', 'ოპერ'),
        'uk': ('музей', 'галере', 'церкв', 'храм', 'собор', 'базил', 'монаст', 'каплиц', 'синагог', 'мечет', 'фортец', 'палац', 'веж', 'театр', 'опер'),
    }
    locations = {'ru': 'в Тбилиси', 'en': 'in Tbilisi', 'ka': 'თბილისში', 'uk': 'у Тбілісі'}
    result = {}
    for lang in LANGS:
        name = (names.get(lang) or '').strip()
        if not name:
            result[lang] = ''
            continue
        lower = name.lower()
        if any(marker in lower for marker in markers[lang]):
            result[lang] = f'{name} {locations[lang]}.'
        else:
            result[lang] = f'{noun[lang]} {name} {locations[lang]}.'
    return result


def empty_labels():
    return {lang: '' for lang in LANGS}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.parse_args()

    basemap_path = ROOT / 'public' / 'atlas' / 'basemap.geojson'
    if not basemap_path.exists():
        print('Нет public/atlas/basemap.geojson; сначала запустите npm run layers:build.', file=sys.stderr)
        return 1
    basemap = json.loads(basemap_path.read_text())
    landmarks = [f for f in basemap.get('features', []) if (f.get('properties') or {}).get('kind') == 'landmark']
    atlas = load_atlas_cards()
    tags_by_id = load_osm_tags()
    by_way, registry = load_registry()
    out_dir = ROOT / 'data' / 'landmarks' / CITY
    out_dir.mkdir(parents=True, exist_ok=True)

    used_ids = set()
    created = skipped = unnamed = atlas_descriptions = draft_descriptions = 0
    progress = Progress(len(landmarks), 'import landmark cards')
    progress.start()
    for feature in landmarks:
        props = feature.get('properties') or {}
        osm_id = props.get('osmId') or ''
        names = props.get('names') or {}
        if not all((names.get(lang) or '').strip() for lang in LANGS):
            unnamed += 1
            progress.advance(f'{osm_id}: без полного имени')
            continue
        numeric = osm_id.split('/', 1)[1] if '/' in osm_id else re.sub(r'\D', '', osm_id)
        base_id = f'osm-{numeric}'
        card_id = base_id
        if card_id in used_ids:
            card_id = f'osm-{osm_id.split("/", 1)[0]}-{numeric}'
        if card_id in used_ids:
            skipped += 1
            progress.advance(f'{osm_id}: конфликт id')
            continue
        used_ids.add(card_id)
        path = out_dir / f'{card_id}.json'
        if path.exists():
            skipped += 1
            progress.advance(f'{card_id}: уже есть')
            continue

        tags = tags_by_id.get(osm_id, {})
        atlas_card = atlas.get(osm_id)
        category = props.get('category')
        if category not in ALLOWED_CATEGORIES:
            skipped += 1
            progress.advance(f'{osm_id}: неизвестная категория')
            continue
        name_ru = names.get('ru', '')
        subcat = subcategory(tags, name_ru, category)
        coordinates = None
        if atlas_card and atlas_card.get('coordinates'):
            coordinates = [round(float(atlas_card['coordinates'][0]), 6), round(float(atlas_card['coordinates'][1]), 6)]
        if not coordinates:
            coordinates = point_from_geometry(feature.get('geometry'))
        if not coordinates:
            skipped += 1
            progress.advance(f'{osm_id}: нет координаты')
            continue

        addresses = atlas_card.get('addresses') if atlas_card else empty_labels()
        if not addresses or not all(lang in addresses for lang in LANGS):
            addresses = empty_labels()
        descriptions = atlas_card.get('descriptions') if atlas_card else empty_labels()
        if descriptions and all((descriptions.get(lang) or '').strip() for lang in LANGS):
            if 'OpenStreetMap' in descriptions.get('ru', ''):
                description_status = 'draft'
                draft_descriptions += 1
            else:
                description_status = 'reviewed'
                atlas_descriptions += 1
        else:
            descriptions = draft_description(names, category, subcat)
            description_status = 'draft'
            draft_descriptions += 1
        year = None
        if atlas_card:
            year = atlas_card.get('minYear')
        if year is None:
            year = year_from_tags(tags)
        heritage = heritage_data(tags, osm_id, by_way, registry, atlas_card)
        recognition = recognition_data(tags)
        significance = significance_data(category, subcat, name_ru, heritage, recognition, year, bool(atlas_card))
        source = (atlas_card or {}).get('source') or f'{OSM_BASE}/{osm_id}'
        other_sources = [f'{OSM_BASE}/{osm_id}']
        if atlas_card and atlas_card.get('otherSource'):
            other_sources.append(atlas_card['otherSource'])
        other_sources = list(dict.fromkeys(url for url in other_sources if isinstance(url, str) and url.startswith('http')))
        if source in other_sources:
            other_sources.remove(source)
        status = 'active'
        if tags.get('historic') == 'ruins' or tags.get('ruins') == 'yes':
            status = 'ruined'
        elif any(key.startswith(('disused:', 'abandoned:')) for key in tags):
            status = 'closed'
        access = 'exterior' if status == 'ruined' else 'public' if category in ('museum', 'church', 'castle') else 'unknown'
        notes = 'Первичная миграция из слоя подложки; рейтинг значимости предварительный.'
        if description_status == 'draft':
            notes += ' Описание черновое: тип и название без проверенной исторической справки.'
        payload = {
            'id': card_id,
            'osmId': osm_id,
            'atlasId': atlas_card.get('id') if atlas_card else None,
            'category': category,
            'subcategory': subcat,
            'names': {lang: names[lang] for lang in LANGS},
            'originalLanguage': atlas_card.get('originalLanguage') if atlas_card else 'ka',
            'addresses': {lang: addresses.get(lang, '') for lang in LANGS},
            'descriptions': descriptions,
            'descriptionStatus': description_status,
            'coordinates': coordinates,
            'source': source,
            'otherSources': other_sources,
            'districtId': atlas_card.get('districtId') if atlas_card else None,
            'heritage': heritage,
            'recognition': recognition,
            'significance': significance,
            'status': status,
            'access': access,
            'reviewStatus': 'draft',
            'updatedAt': date.today().isoformat(),
            'notes': notes,
        }
        path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + '\n')
        created += 1
        progress.advance(f'{card_id}: создан')
    progress.finish()
    print(f'Создано: {created}; пропущено: {skipped}; без полного имени: {unnamed}; '
          f'описания из атласа: {atlas_descriptions}; черновые описания: {draft_descriptions}', flush=True)
    return 0


if __name__ == '__main__':
    raise SystemExit(main())

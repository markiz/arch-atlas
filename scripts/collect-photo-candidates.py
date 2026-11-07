#!/usr/bin/env python3
"""Collect free Wikimedia Commons photo candidates for atlas objects.

The collector never edits atlas cards. It builds a ranked candidate list in
work/photo-research/candidates.json (plus a report), which is then applied by
scripts/apply-photo-candidates.py.

Sources, in order of reliability:
  1. Wikidata P180 ("depicts") for the object's QID.
  2. Wikidata P18 and the OSM `wikimedia_commons` tag.
  3. Commons files found by the object's street and house number.
  4. Commons files found by the object's distinctive name.
  5. Commons geosearch around the outline (only with a title/category match).

Usage:
  python3 scripts/collect-photo-candidates.py
  python3 scripts/collect-photo-candidates.py --refresh
"""
from __future__ import annotations

import argparse
import hashlib
import html
import json
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

from atlas_source import read_photo_metadata
from progress import Progress

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / 'work' / 'photo-research' / 'cache'
OUT = ROOT / 'work' / 'photo-research' / 'candidates.json'
API = 'https://commons.wikimedia.org/w/api.php'
WIKIDATA = 'https://www.wikidata.org/w/api.php'
USER_AGENT = 'TbilisiArchitectureAtlasPhotos/1.1 (educational atlas research)'
FREE_TOKENS = ('cc0', 'public domain', 'pd-', 'cc by', 'cc-by', 'attribution')
BAD_TITLE = re.compile(
    r'(logo|coat of arms|map\b|plan\b|seal\b|portrait|icon\b|flag\b|stamp|'
    r'banknote|postcard|panorama|panoramic|street view|aerial|satellite|'
    r'plaque|memorial|inscription|graffiti|street art|interior|inside|'
    r'mural|fresco|painting|people|youth|city view|cityscape|urban photo|view of|views of|flags|buses|automobiles|traffic|'
    r'stairwell|staircase|stairway|backyard|courtyard|yard\b|'
    r'door\b|window|fragment|sign\b|monument to|bust\b|sculpture|wall\b|'
    r'passage|archway|roof\b|dome\b|facade detail)',
    re.I,
)
BAD_CATEGORY = re.compile(
    r'(interior|interiors|mural|fresco|icon|painting|plaque|detail|'
    r'people of tbilisi|urban photos|city views|cityscapes|panoramas|views of tbilisi|'
    r'people standing|women holding|automobiles|buses|vehicles|street scene|streets in tbilisi|'
    r'flags|traffic|protest|festival|sport)',
    re.I,
)
GENERIC_NAME = {
    'residential', 'building', 'house', 'church', 'former', 'tower', 'palace',
    'the', 'of', 'and', 'street', 'avenue', 'tbilisi', 'georgia', 'old',
    'new', 'complex', 'corner', 'block', 'school', 'lutheran', 'catholic',
}
STREET_STOP = {
    'street', 'avenue', 'st', 'ave', 'square', 'lane', 'road', 'ascent',
    'plateau', 'tbilisi', 'georgia', 'the', 'of', 'and', 'former', 'old',
    'dead', 'end', 'garden', 'park', 'quarter', 'district', 'cemetery',
}
KA_STREET_SUFFIX = ('ქუჩა', 'გამზირი', 'შესახვევი', 'მოედანი', 'აღმართი', 'ჩიხი', 'პლატო')


def clean(value: str | None) -> str:
    text = re.sub(r'<[^>]+>', ' ', value or '')
    text = html.unescape(text)
    return re.sub(r'\s+', ' ', text).strip()


def read_json(path: Path):
    return json.loads(path.read_text(encoding='utf-8'))


def api_call(params: dict, endpoint: str = API, refresh: bool = False) -> dict:
    """GET a MediaWiki API response, cached by endpoint and query."""
    query = {**params, 'format': 'json'}
    key = hashlib.sha1((endpoint + urllib.parse.urlencode(sorted(query.items()))).encode()).hexdigest()
    cached = CACHE / f'{key}.json'
    if cached.exists() and not refresh:
        return read_json(cached)
    encoded = urllib.parse.urlencode(query)
    url = endpoint + '?' + encoded
    for attempt in range(8):
        try:
            if len(url) < 2000:
                request = urllib.request.Request(url, headers={'User-Agent': USER_AGENT, 'Accept': 'application/json'})
            else:
                # Long Georgian file-title batches exceed the URL limit (HTTP 414).
                request = urllib.request.Request(endpoint, data=encoded.encode('utf-8'), headers={
                    'User-Agent': USER_AGENT, 'Accept': 'application/json',
                    'Content-Type': 'application/x-www-form-urlencoded',
                })
            with urllib.request.urlopen(request, timeout=45) as response:
                data = json.load(response)
            break
        except urllib.error.HTTPError as error:  # rate limit; retry soon, the limiter is bursty
            if attempt == 7:
                print(f'  api error: {error}', file=sys.stderr)
                return {}
            delay = 2 + attempt
            print(f'  api busy ({error.code}); retry in {delay}s', file=sys.stderr)
            time.sleep(delay)
        except Exception as error:  # transient network or maxlag
            if attempt == 7:
                print(f'  api error: {error}', file=sys.stderr)
                return {}
            time.sleep(2 * (attempt + 1))
    CACHE.mkdir(parents=True, exist_ok=True)
    cached.write_text(json.dumps(data, ensure_ascii=False), encoding='utf-8')
    time.sleep(0.8)
    return data


def norm_tokens(text: str) -> list[str]:
    lowered = text.lower().replace('–', '-').replace('—', '-')
    lowered = re.sub(r'[^\w\u10d0-\u10ff]+', ' ', lowered)
    return [token for token in lowered.split() if token]


def significant(tokens: list[str], stop: set[str]) -> list[str]:
    return [token for token in tokens if len(token) >= 3 and token not in stop and not token.isdigit()]


def fuzzy_equal(left: str, right: str) -> bool:
    if left == right:
        return True
    if len(left) < 5 or len(right) < 5:
        return False
    # Cheap edit-distance bound for transliteration variants (Aghmashenebeli / Agmashenebeli).
    from difflib import SequenceMatcher
    return SequenceMatcher(None, left, right).ratio() >= 0.86


def token_overlap(wanted: list[str], found: list[str], threshold: float = 0.75) -> int:
    if not wanted:
        return 0
    matched = sum(1 for token in wanted if any(fuzzy_equal(token, other) for other in found))
    if len(wanted) >= 2:
        required = max(2, int(len(wanted) * threshold + 0.999))
    else:
        required = 1
    return matched if matched >= required else 0


def split_address(text: str) -> list[dict]:
    """Return street/number pairs from one address string (covers corner houses)."""
    pairs = []
    for segment in re.split(r'\s+/\s+', text or ''):
        segment = re.sub(r'\([^)]*\)', ' ', segment)
        segment = re.sub(r'\s+', ' ', segment).strip(' ,')
        if not segment:
            continue
        match = re.match(r'^(?P<number>\d+[^\s]*?)\s+(?P<street>.+)$', segment)
        if not match:
            match = re.match(r'^(?P<street>.+?)[,\s]+(?P<number>\d+[^\s]*?)$', segment)
        if not match:
            continue
        street = match.group('street').strip(' ,')
        number = match.group('number').strip(' ,')
        number = re.sub(r'[^0-9a-zA-Zა-ჰ/–-]', '', number)
        if not street or not number or not re.search(r'\d', number):
            continue
        pairs.append({'street': street, 'number': number})
    return pairs


def number_base(value: str) -> list[str]:
    return re.findall(r'\d+', value)


def street_base_ka(street: str) -> str:
    words = street.split()
    while words and words[-1].strip('.,') in KA_STREET_SUFFIX:
        words.pop()
    return ' '.join(words).strip('.,')


def street_base_en(street: str) -> str:
    words = street.split()
    while words and words[-1].lower().strip('.') in {word.rstrip('.') for word in STREET_STOP}:
        words.pop()
    return ' '.join(words).strip('.,')


def file_title(source: str | None) -> str | None:
    if not source or '/wiki/' not in source:
        return None
    tail = urllib.parse.unquote(source.split('/wiki/', 1)[1])
    return tail if tail.startswith('File:') else None


def is_free(license_name: str, categories: str = '') -> bool:
    normalized = (license_name or '').lower()
    if any(bad in normalized for bad in ('non-free', 'fair use', 'copyright')):
        return False
    if not any(token in normalized for token in FREE_TOKENS):
        return False
    return 'copyright violation' not in categories.lower()


def imageinfo(page: dict) -> dict | None:
    """Turn one API page into a compact candidate record."""
    info = (page.get('imageinfo') or [None])[0]
    if not info:
        return None
    meta = info.get('extmetadata') or {}
    license_name = clean(meta.get('LicenseShortName', {}).get('value'))
    categories = clean(meta.get('Categories', {}).get('value'))
    license_url = clean(meta.get('LicenseUrl', {}).get('value'))
    author = clean(meta.get('Artist', {}).get('value'))
    credit = clean(meta.get('Credit', {}).get('value'))
    if not license_url and 'public domain' in license_name.lower() and 'own work' in credit.lower():
        license_url = 'https://commons.wikimedia.org/wiki/Template:PD-self'
    if not (license_name and license_url and author):
        return None
    if not is_free(license_name, categories):
        return None
    width = int(info.get('width') or 0)
    height = int(info.get('height') or 0)
    if width < 500 or height < 350:
        return None
    source_url = info.get('descriptionurl') or info.get('url')
    return {
        'title': page.get('title', ''),
        'source': source_url,
        'author': author[:180],
        'license': license_name,
        'licenseUrl': license_url,
        'width': width,
        'height': height,
        'sha1': info.get('sha1', ''),
        'url': info.get('url'),
        'thumbUrl': info.get('thumburl') or info.get('url'),
        'pageUrl': info.get('descriptionurl') or info.get('url'),
        'categories': categories[:400],
    }


HTML_CACHE = CACHE / 'html'


def html_get(url: str, refresh: bool = False) -> str:
    """Fetch a Commons HTML page with a disk cache; used when the API is rate-limited."""
    key = hashlib.sha1(url.encode()).hexdigest()
    cached = HTML_CACHE / f'{key}.html'
    if cached.exists() and not refresh:
        return cached.read_text(encoding='utf-8', errors='ignore')
    for attempt in range(5):
        try:
            request = urllib.request.Request(url, headers={
                'User-Agent': 'Mozilla/5.0 (compatible; TbilisiAtlasResearch/1.2; educational)',
                'Accept': 'text/html,application/xhtml+xml',
            })
            with urllib.request.urlopen(request, timeout=60) as response:
                text = response.read().decode('utf-8', 'ignore')
            HTML_CACHE.mkdir(parents=True, exist_ok=True)
            cached.write_text(text, encoding='utf-8')
            time.sleep(0.3)
            return text
        except Exception as error:
            if attempt == 4:
                print(f'  html error: {error}', file=sys.stderr)
                return ''
            time.sleep(2 + attempt)
    return ''


def search_titles(query: str, refresh: bool = False, limit: int = 100) -> list[str]:
    """Return file titles for a Commons search query via the regular search page.

    The JSON API is kept for metadata only: its search generator is expensive and
    triggers HTTP 429 during large batches. The HTML search page is stable and
    returns the same file titles.
    """
    titles: list[str] = []
    offset = 0
    while len(titles) < limit:
        url = 'https://commons.wikimedia.org/w/index.php?' + urllib.parse.urlencode({
            'search': query, 'title': 'Special:Search', 'fulltext': '1',
            'ns6': '1', 'limit': '50', 'offset': str(offset),
        })
        text = html_get(url, refresh=refresh)
        if not text:
            break
        found = []
        for match in re.finditer(r'href="/wiki/(File:[^"#?]+)"', text):
            title = urllib.parse.unquote(match.group(1)).replace('_', ' ')
            if title not in found:
                found.append(title)
        for title in found:
            if title not in titles:
                titles.append(title)
        if len(found) < 50:
            break
        offset += 50
    return titles[:limit]


def category_titles(category: str, refresh: bool = False, limit: int = 50) -> list[str]:
    """Return file titles listed on a Commons category page."""
    name = category.split(':', 1)[-1]
    url = 'https://commons.wikimedia.org/wiki/Category:' + urllib.parse.quote(name.replace(' ', '_'))
    text = html_get(url, refresh=refresh)
    titles = []
    for match in re.finditer(r'href="/wiki/(File:[^"#?]+)"', text):
        title = urllib.parse.unquote(match.group(1)).replace('_', ' ')
        if title not in titles:
            titles.append(title)
    return titles[:limit]


def wikidata_claims(qids: list[str], refresh: bool = False) -> dict[str, dict]:
    result = {}
    for start in range(0, len(qids), 45):
        batch = qids[start:start + 45]
        data = api_call({
            'action': 'wbgetentities', 'ids': '|'.join(batch), 'props': 'claims|labels',
            'languages': 'en|ka', 'format': 'json',
        }, endpoint=WIKIDATA, refresh=refresh)
        for qid, entity in data.get('entities', {}).items():
            if 'missing' in entity:
                continue
            claims = entity.get('claims', {})
            labels = entity.get('labels', {})
            values = []
            for prop in ('P18', 'P180'):
                for claim in claims.get(prop, []):
                    value = claim.get('mainsnak', {}).get('datavalue', {}).get('value')
                    if prop == 'P18' and isinstance(value, str):
                        values.append((prop, value))
                    elif prop == 'P180' and isinstance(value, dict) and value.get('id'):
                        values.append((prop, value['id']))
            result[qid] = {'values': values, 'label': (labels.get('en') or labels.get('ka') or {}).get('value', '')}
    return result


def fetch_titles(titles: list[str], refresh: bool = False) -> dict[str, dict]:
    found = {}
    for start in range(0, len(titles), 40):
        batch = titles[start:start + 40]
        data = api_call({
            'action': 'query', 'titles': '|'.join(batch), 'prop': 'imageinfo',
            'iiprop': 'url|size|extmetadata|sha1', 'iiurlwidth': '1920',
        }, refresh=refresh)
        for page in data.get('query', {}).get('pages', {}).values():
            candidate = imageinfo(page)
            if candidate:
                found[page['title']] = candidate
                # API normalizes underscores to spaces in titles; callers often use
                # the URL form with underscores.
                found[page['title'].replace(' ', '_')] = candidate
    return found


def geosearch(lon: float, lat: float, radius: int = 45, refresh: bool = False) -> list[str]:
    return search_titles(f'nearcoord:{lat},{lon},{radius}m', refresh=refresh, limit=50)


def title_numbers(title: str) -> set[str]:
    cleaned = re.sub(r'\b(?:19|20)\d{2}[-–]\d{1,2}[-–]\d{1,2}\b', ' ', title)
    cleaned = re.sub(r'\b\d{4}\b', ' ', cleaned)
    numbers = set()
    for match in re.finditer(r'(?<![\d-])(\d{1,3}[a-zA-Zა-ჰ]?)(?![\d-])', cleaned):
        numbers.update(number_base(match.group(1)))
    return numbers


def title_match(title: str, card: dict, pairs: list[dict]) -> dict | None:
    """Return match details when a file title names this object."""
    if BAD_TITLE.search(title):
        return None
    tokens = norm_tokens(title)
    found_numbers = title_numbers(title)
    best = None
    for pair in pairs:
        street_ka = street_base_ka(pair['street']) if re.search(r'[\u10d0-\u10ff]', pair['street']) else ''
        street_en = street_base_en(pair['street']) if not re.search(r'[\u10d0-\u10ff]', pair['street']) else ''
        wanted = significant(norm_tokens(street_ka or street_en), STREET_STOP)
        overlap = token_overlap(wanted, tokens)
        if not overlap:
            continue
        own_numbers = set(number_base(pair['number']))
        if not own_numbers or not (own_numbers & found_numbers):
            continue
        extra = found_numbers - own_numbers - {''}
        if extra:
            # A title naming another house on the same street is a different object.
            return None
        score = 40 + overlap * 10
        reason = f'адрес: {pair["street"]}, {pair["number"]}'
        if best is None or score > best['score']:
            best = {'score': score, 'reason': reason, 'numbers': sorted(own_numbers)}
    if best:
        return best
    # A title that names some house number must match one of the card's addresses;
    # otherwise the name fallback would attach a different house on the same street.
    own_numbers = {number for pair in pairs for number in number_base(pair['number'])}
    if pairs and found_numbers and not (found_numbers & own_numbers):
        return None
    # Fallback for distinctive object names, but only when the title also says Tbilisi.
    name_en = card['names'].get('en', '')
    name_tokens = significant(norm_tokens(name_en), GENERIC_NAME)
    street_sets = []
    for pair in pairs:
        street = street_base_ka(pair['street']) if re.search(r'[\u10d0-\u10ff]', pair['street']) else street_base_en(pair['street'])
        street_sets.append(set(significant(norm_tokens(street), STREET_STOP)))
    if name_tokens and any(set(name_tokens) <= street_set for street_set in street_sets):
        return None
    if len(name_tokens) >= 2 and 'tbilisi' in tokens:
        overlap = token_overlap(name_tokens, tokens, 0.8)
        if overlap:
            return {'score': 30 + overlap * 10, 'reason': 'название объекта', 'numbers': []}
    return None


def category_check(candidate: dict, card: dict, pairs: list[dict]) -> int:
    """Use file categories to confirm or reject an address-based match.

    Returns +1 when a category names this house, -1 when it names another house
    on the same street, and 0 when categories do not mention an address.
    """
    categories = candidate.get('categories') or ''
    if not categories:
        return 0
    card_numbers = {number for pair in pairs for number in number_base(pair['number'])}
    street_tokens = []
    for pair in pairs:
        street = street_base_ka(pair['street']) if re.search(r'[\u10d0-\u10ff]', pair['street']) else street_base_en(pair['street'])
        street_tokens.append(significant(norm_tokens(street), STREET_STOP))
    confirmed = conflicted = False
    for category in categories.split('|'):
        tokens = norm_tokens(category)
        if not any(token_overlap(wanted, tokens) for wanted in street_tokens):
            continue
        numbers = {value for value in re.findall(r'(?<!\d)(\d{1,3})(?!\d)', category)}
        if not numbers:
            continue
        if numbers & card_numbers:
            confirmed = True
        else:
            conflicted = True
    if confirmed:
        return 1
    return -1 if conflicted else 0


def category_name_check(candidate: dict, card: dict) -> int:
    """Return 1 when a file category contains the object's name as a phrase."""
    categories = candidate.get('categories') or ''
    name = ' '.join(norm_tokens(card['names'].get('en', '')))
    if not name:
        return 0
    name_tokens = significant(norm_tokens(card['names'].get('en', '')), GENERIC_NAME)
    if not name_tokens:
        return 0
    for category in categories.split('|'):
        normalized = ' '.join(norm_tokens(category))
        if name and name in normalized and len(name) >= 5:
            return 1
        if len(name_tokens) >= 2 and token_overlap(name_tokens, norm_tokens(category), 0.8) >= 2:
            return 1
    return 0


def collect() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--refresh', action='store_true', help='ignore the API response cache')
    args = parser.parse_args()

    cards = {}
    for path in sorted((ROOT / 'data' / 'atlas' / 'tbilisi').glob('*.json')):
        card = read_json(path)
        cards[card['id']] = card

    raw_candidates = ROOT / 'raw' / 'research' / 'research-candidates.json'
    osm_tags = {}
    if raw_candidates.exists():
        for row in read_json(raw_candidates):
            osm_tags[str(row.get('osmId'))] = row.get('tags', {})

    # Build street queries and per-card address pairs.
    context = {}
    queries: dict[str, set[str]] = {}
    for card_id, card in cards.items():
        pairs = []
        for language in ('ka', 'en'):
            pairs.extend(split_address(card['addresses'].get(language, '')))
        pairs = [pair for pair in pairs if pair['street']]
        sources = {(read_photo_metadata(photo_id) or {}).get('source') for photo_id in card.get('photos', [])}
        context[card_id] = {'pairs': pairs, 'existing': sources, 'existing_titles': {file_title(source) for source in sources} - {None}}
        for pair in pairs:
            if re.search(r'[\u10d0-\u10ff]', pair['street']):
                base = street_base_ka(pair['street'])
                if len(base) >= 4:
                    queries.setdefault('ka', set()).add(base)
            else:
                base = street_base_en(pair['street'])
                if len(base) >= 4:
                    queries.setdefault('en', set()).add(base + ' Tbilisi')

    query_jobs = [('ka', query) for query in sorted(queries.get('ka', ()))]
    query_jobs += [('en', query) for query in sorted(queries.get('en', ()))]
    pools: dict[str, dict] = {}
    progress = Progress(len(query_jobs), 'collect street photo pools')
    progress.start(f'{len(cards)} cards, {len(query_jobs)} street queries')
    with ThreadPoolExecutor(max_workers=3) as executor:
        futures = {executor.submit(search_titles, query, args.refresh, 250): (language, query)
                   for language, query in query_jobs}
        for future in as_completed(futures):
            language, query = futures[future]
            try:
                pools[query] = future.result()
            except Exception as error:
                print(f'  {query}: {error}', file=sys.stderr)
                pools[query] = {}
            progress.advance(f'{language}: {query} -> {len(pools[query])}')
    progress.finish()

    # Wikidata P18/P180 for cards that carry a QID.
    qids = []
    card_qid = {}
    for card_id, card in cards.items():
        match = re.search(r'wikidata\.org/wiki/(Q\d+)', card.get('otherSource', ''))
        if match:
            card_qid[card_id] = match.group(1)
            qids.append(match.group(1))
    qids = sorted(set(qids))
    claims = wikidata_claims(qids, refresh=args.refresh) if qids else {}
    # P180 is normally set on Commons files, not on the building item; search every QID.
    p180_jobs = qids
    p180_files: dict[str, set[str]] = {}
    progress = Progress(len(p180_jobs), 'collect Commons depicts (P180)')
    progress.start(f'{len(p180_jobs)} objects with depicts statements')
    for qid in p180_jobs:
        titles = search_titles(f'haswbstatement:P180={qid}', refresh=args.refresh, limit=50)
        p180_files[qid] = set(titles)
        progress.advance(f'{qid}: {len(titles)}')
    progress.finish()

    # OSM wikimedia_commons tags (File: and Category:).
    osm_files: dict[str, set[str]] = {}
    osm_categories: dict[str, list[str]] = {}
    for card_id, card in cards.items():
        tags = osm_tags.get(str(card.get('osmId', '')).split('/')[-1], {})
        value = tags.get('wikimedia_commons') or tags.get('image') or ''
        if value.startswith('File:'):
            osm_files.setdefault(card_id, set()).add(value)
        elif value.startswith('Category:'):
            osm_categories.setdefault(card_id, []).append(value)
    category_jobs = [(card_id, category) for card_id, values in osm_categories.items() for category in values]
    progress = Progress(len(category_jobs), 'collect OSM Commons categories')
    progress.start()
    for card_id, category in category_jobs:
        titles = category_titles(category, refresh=args.refresh)
        osm_files.setdefault(card_id, set()).update(titles)
        progress.advance(f'{card_id}: {len(titles)}')
    progress.finish()

    # Existing photo sources, needed to upgrade resolutions and avoid duplicates.
    existing_titles = {}
    for card_id, card in cards.items():
        for photo_id in card.get('photos', []):
            title = file_title((read_photo_metadata(photo_id) or {}).get('source'))
            if title:
                existing_titles.setdefault(title, []).append(card_id)

    # Fetch metadata for every title named by P180/P18/OSM and by existing photos.
    special_titles: set[str] = set(existing_titles)
    for titles in p180_files.values():
        special_titles.update(titles)
    for qid in qids:
        for prop, value in claims.get(qid, {}).get('values', []):
            if prop == 'P18':
                special_titles.add('File:' + value)
    for titles in osm_files.values():
        special_titles.update(titles)
    info: dict[str, dict] = {}
    ordered_titles = sorted(special_titles)
    progress = Progress((len(ordered_titles) + 39) // 40, 'fetch candidate metadata')
    progress.start(f'{len(ordered_titles)} files')
    for start in range(0, len(ordered_titles), 40):
        batch = ordered_titles[start:start + 40]
        info.update(fetch_titles(batch, refresh=args.refresh))
        progress.advance(f'{min(start + 40, len(ordered_titles))}/{len(ordered_titles)}')
    progress.finish()

    # Plan candidates per card first; metadata is fetched only for planned titles.
    plans: dict[str, dict[str, dict]] = {}
    report = {'cards': len(cards), 'with_candidates': 0, 'at_least_3': 0}

    def plan(card_id: str, title: str, score: int, reason: str) -> None:
        bucket = plans.setdefault(card_id, {})
        current = bucket.get(title)
        if current is None or score > current['score']:
            bucket[title] = {'score': score, 'reason': reason}

    progress = Progress(len(cards), 'match photo candidates')
    progress.start()
    for card_id, card in cards.items():
        existing = context[card_id]['existing_titles']

        # Exact depicts (highest confidence).
        qid = card_qid.get(card_id)
        if qid:
            for title in p180_files.get(qid, ()):
                if title not in existing:
                    plan(card_id, title, 100, 'Commons depicts (P180)')
            for prop, value in claims.get(qid, {}).get('values', []):
                if prop == 'P18':
                    title = 'File:' + value
                    if title not in existing:
                        plan(card_id, title, 95, 'изображение Wikidata (P18)')

        # OSM tags.
        for title in osm_files.get(card_id, ()):
            if title not in existing:
                plan(card_id, title, 90, 'тег wikimedia_commons в OSM')

        # Street pools (title-only until the candidate survives matching).
        for pair in context[card_id]['pairs']:
            if re.search(r'[\u10d0-\u10ff]', pair['street']):
                query = street_base_ka(pair['street'])
            else:
                query = street_base_en(pair['street']) + ' Tbilisi'
            for title in pools.get(query, ()):
                if title in existing:
                    continue
                match = title_match(title, card, [pair])
                if match:
                    plan(card_id, title, match['score'], match['reason'])

        # Distinctive name search (only for cards without an address match yet).
        if len(plans.get(card_id, {})) < 3:
            name_en = card['names'].get('en', '')
            name_tokens = significant(norm_tokens(name_en), GENERIC_NAME)
            if len(name_tokens) >= 2:
                for title in search_titles(f'{name_en} Tbilisi', refresh=args.refresh, limit=50):
                    if title in existing:
                        continue
                    if token_overlap(name_tokens, norm_tokens(title), 0.8) < 2:
                        continue
                    if context[card_id]['pairs']:
                        match = title_match(title, card, context[card_id]['pairs'])
                        if match:
                            plan(card_id, title, match['score'], match['reason'])
                        else:
                            # The file may name the building without repeating the
                            # street or "Tbilisi"; categories are checked in the
                            # final pass before it is accepted.
                            plan(card_id, title, 55, 'название объекта в Commons')
                    else:
                        plan(card_id, title, 55, 'название объекта в Commons')
        progress.advance(f'{card_id}: {len(plans.get(card_id, {}))}')
    progress.finish()

    # Geosearch is a last resort: collect titles, then confirm by title/address.
    geo_cards = [card_id for card_id in cards if len(plans.get(card_id, {})) < 3]
    geo_titles: dict[str, list[str]] = {}
    progress = Progress(len(geo_cards), 'geosearch photo candidates')
    progress.start(f'{len(geo_cards)} cards with fewer than 3 candidates')
    for card_id in geo_cards:
        lon, lat = cards[card_id]['coordinates']
        geo_titles[card_id] = geosearch(lon, lat, refresh=args.refresh)
        progress.advance(f'{card_id}: {len(geo_titles[card_id])}')
    progress.finish()
    for card_id in geo_cards:
        existing = context[card_id]['existing_titles']
        for title in geo_titles.get(card_id, ()):
            if title in existing:
                continue
            match = title_match(title, cards[card_id], context[card_id]['pairs'])
            if match:
                plan(card_id, title, match['score'] - 5, match['reason'] + ' (по координатам)')

    # Manual, visually checked picks from data/photo-gallery-selection.json always
    # enter the candidate list, even if the automatic filters were too strict.
    selection_path = ROOT / 'data' / 'photo-gallery-selection.json'
    if selection_path.exists():
        selection = read_json(selection_path).get('items', {})
        for card_id, sources in selection.items():
            if card_id not in cards:
                continue
            for source in sources:
                title = file_title(source)
                if title and title not in context[card_id]['existing_titles']:
                    plan(card_id, title, 80, 'ручной отбор')

    # Fetch metadata only for planned files that are not already described.
    planned_titles = sorted({title for bucket in plans.values() for title in bucket if title not in info})
    progress = Progress((len(planned_titles) + 39) // 40, 'fetch planned photo metadata')
    progress.start(f'{len(planned_titles)} files')
    for start in range(0, len(planned_titles), 40):
        batch = planned_titles[start:start + 40]
        info.update(fetch_titles(batch, refresh=args.refresh))
        progress.advance(f'{min(start + 40, len(planned_titles))}/{len(planned_titles)}')
    progress.finish()

    candidates: dict[str, list[dict]] = {}
    progress = Progress(len(plans), 'filter photo candidates')
    progress.start()
    for card_id, bucket in plans.items():
        card = cards[card_id]
        ranked = []
        for title, meta in bucket.items():
            candidate = info.get(title)
            if not candidate:
                continue
            if meta['reason'].startswith('название') and 'tbilisi' not in (title + ' ' + candidate.get('categories', '')).lower():
                continue
            if meta['reason'] == 'ручной отбор':
                ranked.append({**candidate, 'score': meta['score'], 'reason': meta['reason']})
                continue
            haystack = (title + ' ' + candidate.get('categories', '')).lower()
            if 'tbilisi' not in haystack:
                continue
            if BAD_CATEGORY.search(candidate.get('categories', '')):
                continue
            match = title_match(title, card, context[card_id]['pairs'])
            signal = category_check(candidate, card, context[card_id]['pairs'])
            name_signal = category_name_check(candidate, card)
            if signal < 0:
                continue
            # Every source, including P18/P180/OSM, must be confirmed by a title
            # match or by a category that names this address/building.
            if meta['reason'].startswith(('Commons depicts', 'изображение Wikidata')):
                if not match and signal <= 0 and name_signal <= 0:
                    continue
            elif not match and not (meta['reason'].startswith('название') and name_signal > 0):
                # Address/OSM/geosearch candidates must be confirmed by their file
                # title. A name-search hit may still pass when a category names the
                # building, even if the file title does not repeat "Tbilisi".
                continue
            score = meta['score']
            if match:
                score = max(score, match['score'])
            if signal > 0:
                score += 10
            if name_signal > 0:
                score += 5
            numbers = title_numbers(title)
            own = {number for pair in context[card_id]['pairs'] for number in number_base(pair['number'])}
            if numbers and own and not (numbers & own) and signal <= 0:
                continue
            if len(numbers) > 1 and not numbers <= own:
                # A frame with several house numbers is a multi-object shot; use it
                # only when nothing better exists, never as the hero.
                score -= 30
            ranked.append({**candidate, 'score': score, 'reason': meta['reason']})
        ranked.sort(key=lambda item: (-item['score'], -item['width']))
        # Prefer landscape photos, keep the best six for review.
        ranked = [item for item in ranked if item['width'] >= 700 and item['width'] >= item['height'] * 0.8][:6]
        if ranked:
            candidates[card_id] = ranked
            report['with_candidates'] += 1
            if len(ranked) >= 3:
                report['at_least_3'] += 1
        progress.advance(f'{card_id}: {len(ranked)}')
    progress.finish()
    # Coverage of existing free photos by source metadata (resolution upgrade).
    upgrades = 0
    for card in cards.values():
        for photo_id in card.get('photos', []):
            title = file_title((read_photo_metadata(photo_id) or {}).get('source'))
            metadata = info.get(title) if title else None
            if metadata and metadata['width'] > 1000 and metadata['license']:
                upgrades += 1
    report['existing_upgradable'] = upgrades
    report['existing_total'] = sum(len(card.get('photos', [])) for card in cards.values())

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({
        'schema': 1,
        'generated': time.strftime('%Y-%m-%dT%H:%M:%S%z'),
        'cards': candidates,
        'existing': {title: info[title] for title in existing_titles if title in info},
    }, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(report, ensure_ascii=False, indent=2), file=sys.stderr)
    print(f'Candidates for {len(candidates)} cards written to {OUT.relative_to(ROOT)}; '
          f'{report["at_least_3"]} cards have at least 3.', file=sys.stderr)


if __name__ == '__main__':
    collect()

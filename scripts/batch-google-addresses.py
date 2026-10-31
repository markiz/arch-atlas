#!/usr/bin/env python3
"""Resolve address -> optional landmark within five metres; never edits atlas data."""
import argparse
from datetime import datetime, timezone
import hashlib
import json
import math
import os
from pathlib import Path
import re
import sys
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request

try:
    from progress import Progress
except ImportError:  # tests load this file directly, outside the scripts directory
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    from progress import Progress

MAX_DISTANCE_M = 5.0
LANDMARK_TYPES = {
    'tourist_attraction', 'historical_landmark', 'historical_place',
    'cultural_landmark', 'monument', 'museum', 'art_gallery',
    'performing_arts_theater', 'opera_house', 'cultural_center',
    'church', 'synagogue', 'mosque', 'hindu_temple', 'place_of_worship',
}
GEOCODING_URL = 'https://maps.googleapis.com/maps/api/geocode/json'
PLACES_URL = 'https://places.googleapis.com/v1/places:searchNearby'
FIELD_MASK = ','.join('places.' + field for field in (
    'id', 'displayName', 'location', 'types', 'addressComponents',
    'formattedAddress', 'googleMapsUri', 'businessStatus',
))


def distance_m(a, b):
    """Haversine distance. Both arguments use GeoJSON [longitude, latitude]."""
    lon1, lat1, lon2, lat2 = map(math.radians, (*a, *b))
    value = math.sin((lat2-lat1)/2)**2 + math.cos(lat1)*math.cos(lat2)*math.sin((lon2-lon1)/2)**2
    return 6371008.8 * 2 * math.asin(math.sqrt(min(1, value)))


def normalize(value):
    return ' '.join(re.findall(r'\w+', unicodedata.normalize('NFC', value).casefold().replace('ё', 'е')))


def address_key(components, places=False):
    values = {}
    for component in components:
        for kind in component.get('types', []):
            values[kind] = normalize(component.get('longText' if places else 'long_name', ''))
    if not values.get('route') or not values.get('street_number'):
        return None
    return values['route'], values['street_number']


def coordinates(value):
    if (not isinstance(value, list) or len(value) != 2 or
            any(isinstance(x, bool) or not isinstance(x, (int, float)) or not math.isfinite(x) for x in value) or
            not -180 <= value[0] <= 180 or not -90 <= value[1] <= 90):
        raise ValueError('coordinates must be [longitude, latitude] in valid ranges')
    return value


def candidate(place_id, point, address, name='', types=None, source_url=None):
    return {
        'placeId': place_id, 'coordinates': point, 'address': address,
        'name': name, 'types': types or [],
        'sourceUrl': source_url or 'https://www.google.com/maps/search/?api=1&query=' +
        urllib.parse.quote(address or ','.join(map(str, reversed(point)))) +
        '&query_place_id=' + urllib.parse.quote(place_id),
    }


def choose_house(point, results):
    eligible = []
    for result in results:
        geometry = result.get('geometry', {})
        if geometry.get('location_type') != 'ROOFTOP':
            continue
        if not {'street_address', 'premise'} & set(result.get('types', [])):
            continue
        key = address_key(result.get('address_components', []))
        location = geometry.get('location', {})
        if not key or not result.get('place_id') or not {'lat', 'lng'} <= location.keys():
            continue
        location = coordinates([location['lng'], location['lat']])
        distance = distance_m(point, location)
        if distance <= MAX_DISTANCE_M:
            house = candidate(result['place_id'], location, result.get('formatted_address', ''), types=result.get('types'))
            house.update(distanceMeters=distance, addressKey=list(key))
            eligible.append(house)
    eligible.sort(key=lambda item: (item['distanceMeters'], item['placeId']))
    return eligible[0] if eligible else None


def choose_landmark(point, house, places, types, expected_name=''):
    eligible = {}
    for place in places:
        if place.get('businessStatus') in ('CLOSED_PERMANENTLY', 'CLOSED_TEMPORARILY'):
            continue
        if not set(place.get('types', [])) & types:
            continue
        if address_key(place.get('addressComponents', []), places=True) != tuple(house['addressKey']):
            continue
        name = place.get('displayName', {}).get('text', '')
        if expected_name and not set(normalize(expected_name).split()) <= set(normalize(name).split()):
            continue
        location = place.get('location', {})
        if not place.get('id') or not {'latitude', 'longitude'} <= location.keys():
            continue
        location = coordinates([location['longitude'], location['latitude']])
        distance = distance_m(point, location)
        if distance <= MAX_DISTANCE_M:
            item = candidate(place['id'], location, place.get('formattedAddress', ''), name,
                             place.get('types'), place.get('googleMapsUri'))
            item['distanceMeters'] = distance
            eligible[item['placeId']] = item
    ordered = sorted(eligible.values(), key=lambda item: (item['distanceMeters'], item['placeId']))
    if len(ordered) > 1 and ordered[1]['distanceMeters'] - ordered[0]['distanceMeters'] <= 0.5:
        return None, 'ambiguous_landmarks'
    return (ordered[0], 'landmark_found') if ordered else (None, 'no_matching_landmark')


class ApiError(Exception):
    pass


class GoogleClient:
    def __init__(self, key, language, interval, timeout):
        self.key, self.language, self.interval, self.timeout = key, language, interval, timeout
        self.last_request = 0.0

    def request(self, url, body=None, headers=None):
        for attempt in range(3):
            time.sleep(max(0, self.interval - (time.monotonic() - self.last_request)))
            self.last_request = time.monotonic()
            request = urllib.request.Request(url, data=json.dumps(body).encode() if body is not None else None,
                                             headers=headers or {})
            try:
                with urllib.request.urlopen(request, timeout=self.timeout) as response:
                    result = json.load(response)
                status = result.get('status', 'OK')
                if status in ('OK', 'ZERO_RESULTS'):
                    return result
                if status not in ('UNKNOWN_ERROR', 'OVER_QUERY_LIMIT') or attempt == 2:
                    raise ApiError('Google API status: ' + status)
            except urllib.error.HTTPError as error:
                # Never print HTTPError/URLError: their URL may contain the API key.
                if error.code not in (429, 500, 502, 503, 504) or attempt == 2:
                    raise ApiError('Google API HTTP status: ' + str(error.code)) from None
            except (urllib.error.URLError, TimeoutError):
                if attempt == 2:
                    raise ApiError('Google API network/timeout error') from None
            except (ValueError, UnicodeError):
                raise ApiError('Google API returned invalid JSON') from None
            time.sleep(2 ** attempt)
        raise ApiError('Google API retries exhausted')

    def houses(self, point):
        params = urllib.parse.urlencode({
            'latlng': f'{point[1]},{point[0]}', 'key': self.key,
            'language': self.language, 'result_type': 'street_address|premise', 'location_type': 'ROOFTOP',
        })
        return self.request(GEOCODING_URL + '?' + params).get('results', [])

    def landmarks(self, point):
        return self.request(PLACES_URL, {
            'languageCode': self.language, 'rankPreference': 'DISTANCE', 'maxResultCount': 20,
            'locationRestriction': {'circle': {
                'center': {'latitude': point[1], 'longitude': point[0]}, 'radius': MAX_DISTANCE_M,
            }},
        }, {'Content-Type': 'application/json', 'X-Goog-Api-Key': self.key,
            'X-Goog-FieldMask': FIELD_MASK}).get('places', [])


def resolve(row, client):
    point = row['coordinates']
    house = choose_house(point, client.houses(point))
    if house is None:
        return {'status': 'unmatched', 'reason': 'no_house_within_5m', 'house': None, 'selected': None}
    try:
        landmark, reason = choose_landmark(point, house, client.landmarks(point),
                                           set(row.get('landmarkTypes', LANDMARK_TYPES)), row.get('landmarkName', ''))
    except ApiError as error:
        # Preserve the house for inspection, but do not silently treat a failed search as no results.
        return {'status': 'error', 'reason': str(error), 'house': house, 'selected': None}
    return {'status': 'matched', 'reason': reason, 'house': house,
            'selected': {'kind': 'landmark' if landmark else 'house', **(landmark or house)}}


def write_report(path, report):
    temporary = path.with_name(path.name + '.tmp')
    temporary.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    temporary.replace(path)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('input', type=Path, help='JSON array: {id, coordinates: [lon, lat]}')
    parser.add_argument('--output', required=True, type=Path, help='Separate JSON research report')
    parser.add_argument('--language', default='ru')
    parser.add_argument('--interval', type=float, default=0.2, help='Minimum seconds between HTTP requests')
    parser.add_argument('--timeout', type=float, default=30)
    parser.add_argument('--resume', action='store_true', help='Skip completed rows in a matching report; retry errors')
    args = parser.parse_args()
    if args.interval < 0 or not math.isfinite(args.interval) or args.timeout <= 0 or not math.isfinite(args.timeout):
        parser.error('interval must be finite and >= 0; timeout must be finite and > 0')
    if args.input.resolve() == args.output.resolve():
        parser.error('input and output must differ')
    rows = json.loads(args.input.read_text())
    if not isinstance(rows, list) or not rows:
        parser.error('input must be a nonempty JSON array')
    ids = set()
    for row in rows:
        if not isinstance(row, dict) or not isinstance(row.get('id'), str) or not row['id'].strip() or row['id'] in ids:
            parser.error('each input row needs a unique nonempty string id')
        ids.add(row['id'])
        coordinates(row.get('coordinates'))
        if 'landmarkTypes' in row and (not isinstance(row['landmarkTypes'], list) or not row['landmarkTypes'] or
                                       any(kind not in LANDMARK_TYPES for kind in row['landmarkTypes'])):
            parser.error('landmarkTypes must be a nonempty subset of LANDMARK_TYPES')
        if not isinstance(row.get('landmarkName', ''), str):
            parser.error('landmarkName must be a string')
    signature = hashlib.sha256(json.dumps({'rows': rows, 'language': args.language,
        'distance': MAX_DISTANCE_M, 'algorithm': 1}, sort_keys=True).encode()).hexdigest()
    report = {'version': 1, 'signature': signature, 'language': args.language, 'maxDistanceMeters': MAX_DISTANCE_M, 'results': []}
    if args.output.exists():
        if not args.resume:
            parser.error('output already exists; use --resume or another path')
        report = json.loads(args.output.read_text())
        if report.get('signature') != signature:
            parser.error('resume report has different input/options; use another output path')
    key = os.environ.get('GOOGLE_MAPS_API_KEY')
    if not key:
        parser.error('set GOOGLE_MAPS_API_KEY in the environment')
    client = GoogleClient(key, args.language, args.interval, args.timeout)
    completed = {item['id']: item for item in report['results']}
    pending = [
        row for row in rows
        if completed.get(row['id'], {}).get('status') not in ('matched', 'unmatched')
    ]
    already_done = len(rows) - len(pending)
    if already_done:
        print(f'Resume: {already_done} of {len(rows)} rows already complete; '
              f'{len(pending)} to process', file=sys.stderr, flush=True)
    progress = Progress(len(pending), 'resolve addresses')
    progress.start(f"{len(pending)} rows, {args.interval}s between requests")
    for row in pending:
        try:
            result = resolve(row, client)
        except ApiError as error:
            result = {'status': 'error', 'reason': str(error), 'selected': None, 'house': None}
        completed[row['id']] = {**row, **result, 'checkedAt': datetime.now(timezone.utc).isoformat()}
        report['results'] = [completed[item['id']] for item in rows if item['id'] in completed]
        write_report(args.output, report)
        progress.advance(f"{row['id']}: {completed[row['id']]['status']}")
    progress.finish()
    return 1 if any(item['status'] == 'error' for item in report['results']) else 0


if __name__ == '__main__':
    try:
        sys.exit(main())
    except (OSError, ValueError, KeyError, TypeError):
        sys.exit('Invalid input/report or file I/O error; check JSON structure and paths.')

import importlib.util
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import urllib.error
import urllib.parse

spec = importlib.util.spec_from_file_location('google_addresses', Path(__file__).parents[1] / 'scripts/batch-google-addresses.py')
batch = importlib.util.module_from_spec(spec)
spec.loader.exec_module(batch)
POINT = [44.8, 41.7]


def offset(metres):
    import math
    return [POINT[0], POINT[1] + math.degrees(metres / 6371008.8)]


def house(metres=1, place_id='house', number='25', precision='ROOFTOP'):
    point = offset(metres)
    return {'place_id': place_id, 'types': ['street_address'], 'formatted_address': 'Rustaveli 25',
            'address_components': [{'types': ['route'], 'long_name': 'Rustaveli'},
                                   {'types': ['street_number'], 'long_name': number}],
            'geometry': {'location_type': precision, 'location': {'lng': point[0], 'lat': point[1]}}}


def landmark(metres=2, place_id='opera', number='25', kind='opera_house'):
    point = offset(metres)
    return {'id': place_id, 'types': [kind], 'formattedAddress': 'Rustaveli 25',
            'displayName': {'text': 'Театр оперы'},
            'location': {'longitude': point[0], 'latitude': point[1]},
            'addressComponents': [{'types': ['route'], 'longText': 'Rustaveli'},
                                  {'types': ['street_number'], 'longText': number}]}


class FakeClient:
    def __init__(self, houses, places):
        self.house_results, self.place_results, self.places_calls = houses, places, 0

    def houses(self, point):
        return self.house_results

    def landmarks(self, point):
        self.places_calls += 1
        if isinstance(self.place_results, Exception):
            raise self.place_results
        return self.place_results


class MatchingTests(unittest.TestCase):
    def resolve(self, houses=None, places=None, **extra):
        return batch.resolve({'id': 'test', 'coordinates': POINT, **extra},
                             FakeClient([house()] if houses is None else houses, places or []))

    def test_nearest_house_not_response_order(self):
        result = self.resolve(houses=[house(4, 'far'), house(1, 'near')])
        self.assertEqual(result['selected']['placeId'], 'near')
        self.assertEqual(result['selected']['kind'], 'house')

    def test_distance_boundary_without_rounding(self):
        self.assertIsNotNone(batch.choose_house(POINT, [house(4.99999)]))
        self.assertIsNone(batch.choose_house(POINT, [house(5.00001)]))

    def test_reject_approximate_and_missing_house_number(self):
        self.assertIsNone(batch.choose_house(POINT, [house(1, precision='RANGE_INTERPOLATED'), house(1, number='')]))

    def test_no_house_means_no_places_request(self):
        client = FakeClient([house(6)], [landmark(1)])
        result = batch.resolve({'coordinates': POINT}, client)
        self.assertEqual(result['status'], 'unmatched')
        self.assertEqual(client.places_calls, 0)

    def test_landmark_preferred_to_house(self):
        result = self.resolve(places=[landmark()])
        self.assertEqual(result['selected']['kind'], 'landmark')
        self.assertEqual(result['house']['placeId'], 'house')

    def test_landmark_must_share_house_address_and_distance(self):
        for place in [landmark(number='27'), landmark(5.00001), landmark(kind='restaurant')]:
            with self.subTest(place=place):
                self.assertEqual(self.resolve(places=[place])['selected']['kind'], 'house')

    def test_ambiguous_landmarks_fall_back_to_house(self):
        result = self.resolve(places=[landmark(2, 'a'), landmark(2.2, 'b')])
        self.assertEqual(result['selected']['kind'], 'house')
        self.assertEqual(result['reason'], 'ambiguous_landmarks')

    def test_explicit_landmark_name_and_type(self):
        self.assertEqual(self.resolve(places=[landmark()], landmarkName='Другой театр')['selected']['kind'], 'house')
        self.assertEqual(self.resolve(places=[landmark()], landmarkTypes=['museum'])['selected']['kind'], 'house')
        self.assertEqual(self.resolve(places=[landmark()], landmarkName='Оперы')['selected']['kind'], 'landmark')

    def test_closed_landmark_is_not_selected(self):
        place = landmark()
        place['businessStatus'] = 'CLOSED_PERMANENTLY'
        self.assertEqual(self.resolve(places=[place])['selected']['kind'], 'house')

    def test_api_failure_is_not_reported_as_house_fallback(self):
        result = self.resolve(places=batch.ApiError('Google API HTTP status: 403'))
        self.assertEqual(result['status'], 'error')
        self.assertIsNone(result['selected'])
        self.assertEqual(result['house']['placeId'], 'house')

    def test_invalid_coordinates(self):
        for value in [[True, 42], [0, float('nan')], [181, 42], [44, 91], [44], None]:
            with self.subTest(value=value), self.assertRaises(ValueError):
                batch.coordinates(value)

    def test_google_request_parameters(self):
        client = batch.GoogleClient('test-secret', 'ru', 0, 30)
        with patch.object(client, 'request', return_value={'results': []}) as request:
            client.houses(POINT)
            url = urllib.parse.urlparse(request.call_args.args[0])
            query = urllib.parse.parse_qs(url.query)
            self.assertEqual(query['latlng'], ['41.7,44.8'])
            self.assertEqual(query['location_type'], ['ROOFTOP'])
            self.assertEqual(query['result_type'], ['street_address|premise'])
        with patch.object(client, 'request', return_value={'places': []}) as request:
            client.landmarks(POINT)
            url, body, headers = request.call_args.args
            self.assertEqual(url, batch.PLACES_URL)
            self.assertEqual(body['locationRestriction']['circle']['radius'], 5)
            self.assertEqual(body['rankPreference'], 'DISTANCE')
            self.assertIn('places.addressComponents', headers['X-Goog-FieldMask'])

    def test_http_retries_and_redacted_error(self):
        client = batch.GoogleClient('test-secret', 'ru', 0, 30)
        error = urllib.error.HTTPError('https://example.test/?key=test-secret', 429, 'secret', {}, None)
        with patch.object(batch.urllib.request, 'urlopen', side_effect=error) as request, \
                patch.object(batch.time, 'sleep'), self.assertRaises(batch.ApiError) as raised:
            client.houses(POINT)
        self.assertEqual(request.call_count, 3)
        self.assertNotIn('test-secret', str(raised.exception))
        self.assertIn('429', str(raised.exception))

    def test_geocoding_denied_is_an_error(self):
        client = batch.GoogleClient('test-secret', 'ru', 0, 30)
        with patch.object(batch.urllib.request, 'urlopen', return_value=io.StringIO('{"status":"REQUEST_DENIED"}')), \
                patch.object(batch.time, 'sleep'), self.assertRaisesRegex(batch.ApiError, 'REQUEST_DENIED'):
            client.houses(POINT)

    def test_resume_skips_success_and_retries_error(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory)
            source, output = path / 'input.json', path / 'report.json'
            source.write_text(json.dumps([{'id': 'opera', 'coordinates': POINT}]))
            args = ['batch-google-addresses.py', str(source), '--output', str(output)]
            with patch.dict('os.environ', {'GOOGLE_MAPS_API_KEY': 'test-secret'}), patch('sys.argv', args), \
                    patch.object(batch.GoogleClient, 'houses', return_value=[house()]) as houses, \
                    patch.object(batch.GoogleClient, 'landmarks', side_effect=batch.ApiError('HTTP 429')):
                self.assertEqual(batch.main(), 1)
                self.assertEqual(houses.call_count, 1)
            with patch.dict('os.environ', {'GOOGLE_MAPS_API_KEY': 'test-secret'}), patch('sys.argv', args + ['--resume']), \
                    patch.object(batch.GoogleClient, 'houses', return_value=[house()]) as houses, \
                    patch.object(batch.GoogleClient, 'landmarks', return_value=[]):
                self.assertEqual(batch.main(), 0)
                self.assertEqual(houses.call_count, 1)
                self.assertEqual(batch.main(), 0)
                self.assertEqual(houses.call_count, 1)
            self.assertNotIn('test-secret', output.read_text())


if __name__ == '__main__':
    unittest.main()

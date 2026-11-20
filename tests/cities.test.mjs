import test from 'node:test';
import assert from 'node:assert/strict';
import { readCityConfigs, publicCity } from '../scripts/lib/cities.mjs';

test('city registry exposes Tbilisi and the empty Belgrade package', async () => {
  const { defaultCity, cities, byId } = await readCityConfigs();
  assert.equal(defaultCity.id, 'tbilisi');
  assert.deepEqual(
    cities.map((city) => city.id),
    ['tbilisi', 'belgrade'],
  );
  assert.equal(byId.get('tbilisi').status, 'ready');
  assert.equal(byId.get('tbilisi').allowEmpty, false);
  assert.equal(byId.get('belgrade').status, 'ready');
  assert.equal(byId.get('belgrade').allowEmpty, true);
  assert.deepEqual(byId.get('tbilisi').languages, ['ru', 'en', 'uk', 'ka']);
  assert.deepEqual(byId.get('belgrade').languages, ['ru', 'en', 'uk', 'sr']);
  for (const city of cities) {
    assert.deepEqual(Object.keys(city.labels).sort(), [...city.languages].sort());
    assert.deepEqual(Object.keys(city.country).sort(), [...city.languages].sort());
    for (const language of ['ru', 'en', 'uk']) assert.ok(city.languages.includes(language));
    assert.ok(city.periods.length >= 2);
    assert.equal(city.periods.at(-1).id, 'unknown');
    assert.ok(city.map.bounds.west < city.map.bounds.east);
    assert.ok(city.map.bounds.south < city.map.bounds.north);
    const publicValue = publicCity(city, { counts: { buildings: 0 } });
    assert.equal(publicValue.build, undefined);
    assert.equal(publicValue.osm, undefined);
    assert.equal(publicValue.labels.ru, city.labels.ru);
  }
});

test('period presets have stable ids and a final unknown bucket', async () => {
  const { cities } = await readCityConfigs();
  for (const city of cities) {
    const ids = city.periods.map((period) => period.id);
    assert.equal(new Set(ids).size, ids.length, `${city.id}: duplicate period id`);
    for (const period of city.periods)
      assert.ok(Number.isFinite(period.min) === Number.isFinite(period.max));
  }
});

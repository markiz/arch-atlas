import test from 'node:test';
import assert from 'node:assert/strict';
import { buildHash, isLanguage, parseHash } from '../src/routing.ts';

test('parses and builds the city route', () => {
  const route = parseHash('#city=belgrade&view=catalog&building=opera&lang=en');
  assert.deepEqual(route, {
    city: 'belgrade',
    view: 'catalog',
    building: 'opera',
    language: 'en',
  });
  assert.equal(buildHash(route), '#city=belgrade&view=catalog&building=opera&lang=en');
});

test('unknown city and language fall back safely', () => {
  const route = parseHash('#city=../etc&lang=de');
  assert.equal(route.city, null);
  assert.equal(route.view, 'map');
  assert.equal(route.language, null);
  assert.equal(buildHash(route), '#view=map');
});

test('default route is a plain map URL', () => {
  assert.deepEqual(parseHash(''), {
    city: null,
    view: 'map',
    building: null,
    language: null,
  });
  assert.equal(isLanguage('ka'), true);
  assert.equal(isLanguage('sr'), true);
  assert.equal(isLanguage('de'), false);
});

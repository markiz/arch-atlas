import test from 'node:test';
import assert from 'node:assert/strict';
import { rememberMapView, savedMapView } from '../src/map/view-memory.ts';

test('view memory starts empty', () => {
  assert.equal(savedMapView(), null);
});

test('view memory keeps an independent camera snapshot per city', () => {
  const center = { lat: 41.71, lng: 44.8 };
  rememberMapView('tbilisi', center, 14.5);
  center.lat = 0;
  const first = savedMapView('tbilisi');
  assert.deepEqual(first, { center: { lat: 41.71, lng: 44.8 }, zoom: 14.5 });
  first.center.lng = 0;
  assert.deepEqual(savedMapView('tbilisi'), { center: { lat: 41.71, lng: 44.8 }, zoom: 14.5 });
  rememberMapView('tbilisi', { lat: 41.72, lng: 44.79 }, 16);
  assert.deepEqual(savedMapView('tbilisi'), { center: { lat: 41.72, lng: 44.79 }, zoom: 16 });
  assert.equal(savedMapView('belgrade'), null);
  rememberMapView('belgrade', { lat: 44.82, lng: 20.45 }, 12);
  assert.deepEqual(savedMapView('belgrade'), { center: { lat: 44.82, lng: 20.45 }, zoom: 12 });
  assert.deepEqual(savedMapView('tbilisi'), { center: { lat: 41.72, lng: 44.79 }, zoom: 16 });
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { rememberMapView, savedMapView } from '../src/map/view-memory.ts';

test('view memory starts empty', () => {
  assert.equal(savedMapView(), null);
});

test('view memory keeps an independent camera snapshot', () => {
  const center = { lat: 41.71, lng: 44.8 };
  rememberMapView(center, 14.5);
  center.lat = 0;
  const first = savedMapView();
  assert.deepEqual(first, { center: { lat: 41.71, lng: 44.8 }, zoom: 14.5 });
  first.center.lng = 0;
  assert.deepEqual(savedMapView(), { center: { lat: 41.71, lng: 44.8 }, zoom: 14.5 });
  rememberMapView({ lat: 41.72, lng: 44.79 }, 16);
  assert.deepEqual(savedMapView(), { center: { lat: 41.72, lng: 44.79 }, zoom: 16 });
});

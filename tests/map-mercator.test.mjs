import test from 'node:test';
import assert from 'node:assert/strict';
import { MAX_LATITUDE } from '../src/map/geometry.ts';
import { mercatorBoxes, mercatorY, mercatorYFast, normalizedBounds } from '../src/map/mercator.ts';

const near = (actual, expected, tolerance, label = '') =>
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${label} ${actual} !~ ${expected} (допуск ${tolerance})`,
  );

test('fast mercator keeps the exact curve inside a device pixel at zoom 19', () => {
  // 1e-9 world units is 0.13 px at zoom 19; the table is built for less.
  for (let index = 0; index <= 4000; index++) {
    const lat = -MAX_LATITUDE + (index / 4000) * MAX_LATITUDE * 2;
    near(mercatorYFast(lat), mercatorY(lat), 1e-9, `lat ${lat.toFixed(6)}`);
  }
});

test('fast mercator clamps the poles and the antimeridian latitudes', () => {
  near(mercatorYFast(MAX_LATITUDE), 0, 1e-12, 'north edge');
  near(mercatorYFast(-MAX_LATITUDE), 1, 1e-12, 'south edge');
  assert.equal(mercatorYFast(90), mercatorYFast(MAX_LATITUDE));
  assert.equal(mercatorYFast(-90), mercatorYFast(-MAX_LATITUDE));
  assert.ok(Number.isNaN(mercatorYFast(Number.NaN)));
});

test('fast mercator is strictly monotonic from north to south', () => {
  let previous = mercatorYFast(MAX_LATITUDE);
  for (let lat = MAX_LATITUDE; lat >= -MAX_LATITUDE; lat -= 0.25) {
    const value = mercatorYFast(lat);
    assert.ok(value >= previous, `монотонность нарушена на ${lat}`);
    previous = value;
  }
});

test('fast mercator matches the projection used by the map at city latitudes', () => {
  const zoom = 17;
  const scale = 256 * 2 ** zoom;
  for (const lat of [41.69, 41.7, 41.715]) {
    const exact = mercatorY(lat) * scale;
    const fast = mercatorYFast(lat) * scale;
    near(fast, exact, 0.01, `px при lat ${lat}`);
  }
});

test('normalized boxes agree with the degree-space view test', () => {
  const boxes = new Float32Array([
    44.7,
    41.6,
    44.8,
    41.7, // внутри вида
    44.9,
    41.8,
    45.0,
    41.9, // восточнее и южнее
    41.6,
    41.6,
    41.7,
    41.7, // далеко на запад
    44.75,
    41.9,
    44.85,
    42.0, // севернее вида
  ]);
  const norm = mercatorBoxes(boxes, 4);
  const view = { west: 44.6, south: 41.55, east: 44.85, north: 41.75 };
  const normView = normalizedBounds(view);
  for (let index = 0; index < 4; index++) {
    const offset = index * 4;
    const degrees =
      boxes[offset] <= view.east &&
      boxes[offset + 2] >= view.west &&
      boxes[offset + 1] <= view.north &&
      boxes[offset + 3] >= view.south;
    const normalized =
      norm[offset] <= normView.east &&
      norm[offset + 2] >= normView.west &&
      norm[offset + 1] <= normView.south &&
      norm[offset + 3] >= normView.north;
    assert.equal(normalized, degrees, `объект ${index}`);
  }
  assert.equal(normView.north < normView.south, true, 'y растёт к югу');
});

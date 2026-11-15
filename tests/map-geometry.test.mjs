import test from 'node:test';
import assert from 'node:assert/strict';
import {
  bboxIntersects,
  boundsFromBBox,
  emptyBBox,
  extendBBox,
  geometryBounds,
  metersPerPixel,
  pointInGeometry,
  project,
  unproject,
} from '../src/map/geometry.ts';

const near = (actual, expected, tolerance = 1e-9) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} !~ ${expected}`);

test('web mercator projection round-trips and matches the 256px world size', () => {
  const point = project(41.715, 44.8, 13);
  const back = unproject(point.x, point.y, 13);
  near(back.lat, 41.715, 1e-10);
  near(back.lng, 44.8, 1e-10);
  near(project(0, 0, 0).x, 128);
  near(project(0, 0, 0).y, 128);
  near(project(85.0511287798, 0, 0).y, 0, 1e-7);
  near(project(-85.0511287798, 0, 0).y, 256, 1e-7);
});

test('bbox helpers union and test geometry bounds', () => {
  const first = { minX: 44.7, minY: 41.6, maxX: 44.8, maxY: 41.7 };
  const second = { minX: 44.6, minY: 41.7, maxX: 44.9, maxY: 41.8 };
  const union = extendBBox(first, second);
  assert.deepEqual(union, { minX: 44.6, minY: 41.6, maxX: 44.9, maxY: 41.8 });
  assert.equal(bboxIntersects(union, { minX: 44.9, minY: 41.8, maxX: 45, maxY: 41.9 }), true);
  assert.equal(bboxIntersects(union, { minX: 45, minY: 41.8, maxX: 45.1, maxY: 41.9 }), false);
  assert.deepEqual(boundsFromBBox(first), { west: 44.7, south: 41.6, east: 44.8, north: 41.7 });
});

test('geometry bounds cover polygons, collections and empty boxes', () => {
  const polygon = {
    type: 'Polygon',
    coordinates: [
      [
        [44.7, 41.6],
        [44.8, 41.6],
        [44.8, 41.7],
        [44.7, 41.6],
      ],
    ],
  };
  assert.deepEqual(geometryBounds(polygon), { minX: 44.7, minY: 41.6, maxX: 44.8, maxY: 41.7 });
  assert.deepEqual(geometryBounds({ type: 'GeometryCollection', geometries: [polygon] }), {
    minX: 44.7,
    minY: 41.6,
    maxX: 44.8,
    maxY: 41.7,
  });
  assert.deepEqual(geometryBounds(null), null);
  assert.deepEqual(emptyBBox(), {
    minX: Infinity,
    minY: Infinity,
    maxX: -Infinity,
    maxY: -Infinity,
  });
});

test('point hit testing respects outer rings and holes', () => {
  const polygon = {
    type: 'Polygon',
    coordinates: [
      [
        [0, 0],
        [10, 0],
        [10, 10],
        [0, 10],
        [0, 0],
      ],
      [
        [4, 4],
        [6, 4],
        [6, 6],
        [4, 6],
        [4, 4],
      ],
    ],
  };
  assert.equal(pointInGeometry(1, 1, polygon), true);
  assert.equal(pointInGeometry(5, 5, polygon), false);
  assert.equal(pointInGeometry(11, 1, polygon), false);
  assert.equal(
    pointInGeometry(5, 5, { type: 'MultiPolygon', coordinates: [[polygon.coordinates[0]]] }),
    true,
  );
  assert.equal(pointInGeometry(5, 5, null), false);
});

test('scale defaults to one world circumference across 256px tiles', () => {
  near(metersPerPixel(0, 0), (2 * Math.PI * 6378137) / 256, 1e-6);
  near(metersPerPixel(0, 1), (Math.PI * 6378137) / 256, 1e-6);
});

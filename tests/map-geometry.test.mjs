import test from 'node:test';
import assert from 'node:assert/strict';
import {
  bboxIntersects,
  boundsFromBBox,
  emptyBBox,
  extendBBox,
  geometryBounds,
  metersPerPixel,
  pickTapTarget,
  pointInGeometry,
  project,
  squaredDistanceToGeometry,
  tapRadiusDegrees,
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

const square = (minX, minY, maxX, maxY) => ({
  type: 'Polygon',
  coordinates: [
    [
      [minX, minY],
      [maxX, minY],
      [maxX, maxY],
      [minX, maxY],
      [minX, minY],
    ],
  ],
});
const target = (geometry) => ({
  geometry,
  bbox: {
    minX: Math.min(...geometry.coordinates[0].map((point) => point[0])),
    minY: Math.min(...geometry.coordinates[0].map((point) => point[1])),
    maxX: Math.max(...geometry.coordinates[0].map((point) => point[0])),
    maxY: Math.max(...geometry.coordinates[0].map((point) => point[1])),
  },
});

test('distance to an outline measures the nearest polygon edge', () => {
  near(squaredDistanceToGeometry(13, 5, square(0, 0, 10, 10)), 9, 1e-9);
  near(squaredDistanceToGeometry(5, 5, square(0, 0, 10, 10)), 25, 1e-9);
  near(squaredDistanceToGeometry(0, 0, square(0, 0, 10, 10)), 0, 1e-9);
  assert.equal(squaredDistanceToGeometry(5, 5, null), Infinity);
});

test('exact polygon beats a neighbour buffered tap zone', () => {
  const wide = target(square(0, 0, 15.6, 10));
  const near = target(square(15.6, 0, 18, 10));
  assert.equal(pickTapTarget(15.5, 5, [wide, near], 1), wide);
  assert.equal(pickTapTarget(16.5, 5, [wide, near], 1), near);
});

test('between two buffered zones the closest outline wins', () => {
  const left = target(square(0, 0, 10, 10));
  const right = target(square(11, 0, 21, 10));
  assert.equal(pickTapTarget(10.2, 5, [left, right], 0.9), left);
  assert.equal(pickTapTarget(10.2, 5, [right, left], 0.9), left);
  assert.equal(pickTapTarget(10.8, 5, [left, right], 0.9), right);
  assert.equal(pickTapTarget(10.8, 5, [right, left], 0.9), right);
  assert.equal(pickTapTarget(22, 5, [left, right], 0.9), null);
  assert.equal(pickTapTarget(10.5, 5, [left, right]), null);
});

test('tap buffer follows the outline instead of scaling holes and corners', () => {
  const courtyard = target({
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
  });
  // Inside the courtyard hole, half a degree from its wall: the buffer reaches
  // in, while a 20% scale of the outer polygon would have enlarged the hole.
  assert.equal(pickTapTarget(4.5, 5, [courtyard], 1), courtyard);
  assert.equal(pickTapTarget(4.5, 5, [courtyard], 0.4), null);
  // The solid part stays an exact hit.
  assert.equal(pickTapTarget(3.5, 5, [courtyard], 0), courtyard);
});

test('screen tap slop converts to degrees through the current zoom', () => {
  near(tapRadiusDegrees(1, 0, 0), 360 / 256, 1e-9);
  near(tapRadiusDegrees(1, 0, 1), 180 / 256, 1e-9);
});

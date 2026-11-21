import test from 'node:test';
import assert from 'node:assert/strict';
import { pointInGeometry } from '../src/map/geometry.ts';
import { districtLabel, fitCenterLabelSize, parseDistricts } from '../src/map/district-labels.ts';

const labels = (ru, en = ru, ka = ru, uk = ru) => ({ ru, en, ka, uk });

function feature(geometry, properties = {}) {
  return {
    type: 'Feature',
    properties: {
      kind: 'district',
      id: 'test',
      name: 'Тест',
      names: labels('Тест'),
      ...properties,
    },
    geometry,
  };
}

function square(minX, minY, maxX, maxY) {
  return [
    [minX, minY],
    [maxX, minY],
    [maxX, maxY],
    [minX, maxY],
    [minX, minY],
  ];
}

test('parses a district polygon and keeps its label point inside', () => {
  const geometry = {
    type: 'Polygon',
    coordinates: [square(44.8, 41.7, 44.81, 41.71), square(44.802, 41.702, 44.803, 41.703)],
  };
  const [shape] = parseDistricts([feature(geometry)]);
  assert.ok(shape);
  assert.equal(shape.id, 'test');
  assert.equal(pointInGeometry(shape.main.labelPoint[0], shape.main.labelPoint[1], geometry), true);
  assert.deepEqual(shape.main.bbox, { minX: 44.8, minY: 41.7, maxX: 44.81, maxY: 41.71 });
  assert.equal(districtLabel(shape, 'en'), 'Тест');
});

test('the largest multipolygon part carries the centre label', () => {
  const geometry = {
    type: 'MultiPolygon',
    coordinates: [[square(44.8, 41.7, 44.801, 41.701)], [square(44.81, 41.71, 44.83, 41.73)]],
  };
  const [shape] = parseDistricts([feature(geometry)]);
  assert.ok(shape.main.area > 0);
  assert.equal(shape.main.bbox.maxX, 44.83);
});

test('concave districts still get an interior centre point', () => {
  const geometry = {
    type: 'Polygon',
    coordinates: [
      [
        [44.8, 41.7],
        [44.83, 41.7],
        [44.83, 41.705],
        [44.805, 41.705],
        [44.805, 41.73],
        [44.8, 41.73],
        [44.8, 41.7],
      ],
    ],
  };
  const [shape] = parseDistricts([feature(geometry)]);
  assert.equal(pointInGeometry(shape.main.labelPoint[0], shape.main.labelPoint[1], geometry), true);
});

test('centre labels shrink with the district bbox and stop below the minimum', () => {
  assert.equal(fitCenterLabelSize(0.7, 500, 400), 56);
  const mid = fitCenterLabelSize(0.7, 120, 80);
  assert.ok(mid > 10 && mid < 56);
  assert.ok(Math.abs(mid - Math.min((120 * 0.74) / 0.7, 40)) < 1e-9);
  assert.equal(fitCenterLabelSize(2, 20, 16), 0);
  assert.equal(fitCenterLabelSize(0, 100, 100), 0);
});

test('district labels fall back to Russian and skip non-district features', () => {
  const geometry = { type: 'Polygon', coordinates: [square(44.8, 41.7, 44.81, 41.71)] };
  const [shape] = parseDistricts([feature(geometry, { names: { ru: 'Сололаки' }, name: '' })]);
  assert.equal(districtLabel(shape, 'en'), 'Сололаки');
  assert.deepEqual(
    parseDistricts([{ type: 'Feature', properties: { kind: 'road' }, geometry }]),
    [],
  );
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFeatureGrid, queryFeatureGrid } from '../src/map/spatial-index.ts';

function random(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

function makeBoxes(count, rand) {
  const boxes = new Float32Array(count * 4);
  for (let index = 0; index < count; index++) {
    const lng = 44.6 + rand() * 0.4;
    const lat = 41.6 + rand() * 0.2;
    const w = 0.0002 + rand() * 0.002;
    const h = 0.0001 + rand() * 0.001;
    boxes[index * 4] = lng;
    boxes[index * 4 + 1] = lat;
    boxes[index * 4 + 2] = lng + w;
    boxes[index * 4 + 3] = lat + h;
  }
  // A park-like feature covering almost the whole extent and a long avenue.
  boxes.set([44.6, 41.6, 45.0, 41.8], 0);
  boxes.set([44.6, 41.75, 45.0, 41.752], 4);
  return boxes;
}

function bruteForce(boxes, count, view) {
  const result = [];
  for (let position = 0; position < count; position++) {
    const offset = position * 4;
    if (
      boxes[offset] <= view.east &&
      boxes[offset + 2] >= view.west &&
      boxes[offset + 1] <= view.north &&
      boxes[offset + 3] >= view.south
    )
      result.push(position);
  }
  return result;
}

test('grid query returns exactly the visible features, without duplicates', () => {
  const rand = random(7);
  const count = 4000;
  const boxes = makeBoxes(count, rand);
  const grid = buildFeatureGrid(boxes, count);
  let checked = 0;
  for (let attempt = 0; attempt < 120; attempt++) {
    const west = 44.55 + rand() * 0.5;
    const south = 41.55 + rand() * 0.3;
    const view = {
      west,
      south,
      east: west + 0.002 + rand() * 0.2,
      north: south + 0.001 + rand() * 0.1,
    };
    const found = queryFeatureGrid(grid, view);
    const actual = grid.out.subarray(0, found);
    assert.equal(new Set(actual).size, found, 'дубликаты в выдаче');
    const expected = bruteForce(boxes, count, view);
    assert.deepEqual(
      [...actual].sort((a, b) => a - b),
      expected,
    );
    checked += found;
  }
  assert.ok(checked > 0, 'ни один запрос не нашёл объектов');
});

test('features spanning many cells are still found from any part of them', () => {
  const rand = random(3);
  const count = 3000;
  const boxes = makeBoxes(count, rand);
  // 8 and 9 are re-written as a city-wide polygon and a long avenue.
  boxes.set([44.6, 41.6, 45.0, 41.8], 8 * 4);
  boxes.set([44.6, 41.75, 45.0, 41.752], 9 * 4);
  const grid = buildFeatureGrid(boxes, count);
  assert.ok(grid.large.length >= 2, 'крупные объекты должны уйти в отдельный список');
  for (const view of [
    { west: 44.61, south: 41.61, east: 44.63, north: 41.62 },
    { west: 44.98, south: 41.79, east: 44.99, north: 41.8 },
    { west: 44.6, south: 41.75, east: 44.62, north: 41.76 },
  ]) {
    const found = queryFeatureGrid(grid, view);
    const actual = [...grid.out.subarray(0, found)].sort((a, b) => a - b);
    assert.deepEqual(actual, bruteForce(boxes, count, view));
    assert.ok(actual.includes(8), 'городской полигон не найден');
  }
});

test('a query outside the grid does not scan cells', () => {
  const boxes = new Float32Array([44.6, 41.6, 44.61, 41.61]);
  const grid = buildFeatureGrid(boxes, 1);
  const found = queryFeatureGrid(grid, { west: 0, south: 0, east: 1, north: 1 });
  assert.equal(found, 0);
  const again = queryFeatureGrid(grid, { west: 44.6, south: 41.6, east: 44.61, north: 41.61 });
  assert.equal(again, 1);
});

test('a view covering the whole layer returns every feature in order', () => {
  const rand = random(5);
  const count = 900;
  const boxes = makeBoxes(count, rand);
  const grid = buildFeatureGrid(boxes, count);
  const found = queryFeatureGrid(grid, { west: 40, south: 40, east: 46, north: 43 });
  assert.equal(found, count);
  assert.deepEqual(
    [...grid.out.subarray(0, found)],
    Array.from({ length: count }, (_, i) => i),
  );
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  bestTextWindow,
  buildStreetLines,
  layoutTextAlongPath,
  measureLabel,
  multiTextWindows,
  stableTextWindows,
  prepareScreenPath,
  straightTextLayout,
  straightTextLayoutAt,
  streetLabelFontSize,
  streetLabelHalo,
  streetMinZoom,
  streetPriority,
} from '../src/map/street-labels.ts';

const way = (name, coords, priority = 2) => ({
  name,
  names: { ru: name },
  fallback: name,
  coords,
  priority,
});

const metrics = (text, width = 8) => measureLabel(() => width, text);

test('merges ways with the same name that share an endpoint', () => {
  const lines = buildStreetLines([
    way('A', [
      [0, 0],
      [0.001, 0],
    ]),
    way(
      'A',
      [
        [0.001, 0],
        [0.002, 0],
        [0.002, 0.0005],
      ],
      5,
    ),
  ]);
  assert.equal(lines.length, 1);
  assert.equal(lines[0].coords.length, 4);
  assert.equal(lines[0].priority, 5);
  assert.equal(lines[0].minZoom, 11.5);
});

test('takes the straight continuation at a junction instead of the branch', () => {
  const lines = buildStreetLines([
    way('A', [
      [0, 0],
      [0.001, 0],
    ]),
    way('A', [
      [0.001, 0],
      [0.002, 0],
    ]),
    way('A', [
      [0.001, 0],
      [0.001, 0.001],
    ]),
  ]);
  assert.equal(lines.length, 2);
  const main = lines.find((line) => line.coords.length === 3);
  assert.ok(main);
  assert.deepEqual(main.coords[0], [0, 0]);
  assert.deepEqual(main.coords[2], [0.002, 0]);
  const branch = lines.find((line) => line.coords.length === 2);
  assert.ok(branch);
  const branchEnds = [branch.coords[0], branch.coords[1]].map((point) => point.join(','));
  assert.ok(branchEnds.includes('0.001,0'));
  assert.ok(branchEnds.includes('0.001,0.001'));
});

test('orders more important streets first', () => {
  const lines = buildStreetLines([
    way(
      'Minor',
      [
        [0, 0],
        [0.002, 0],
      ],
      2,
    ),
    way(
      'Avenue',
      [
        [0, 0.002],
        [0.001, 0.002],
      ],
      5,
    ),
  ]);
  assert.deepEqual(
    lines.map((line) => line.priority),
    [5, 2],
  );
});

test('font grows with zoom and is capped', () => {
  assert.equal(streetLabelFontSize(13), 8.5);
  assert.equal(streetLabelFontSize(14), 8.5);
  assert.equal(streetLabelFontSize(15.5), 9.5);
  assert.equal(streetLabelFontSize(16.5), 10.5);
  assert.equal(streetLabelFontSize(20), 12);
  assert.equal(streetLabelHalo(8.5), 3);
  assert.ok(streetLabelHalo(12) > 4);
});

test('smaller font produces a smaller collision box', () => {
  const path = prepareScreenPath([
    [0, 0],
    [400, 0],
  ]);
  assert.ok(path);
  const small = straightTextLayout(path, metrics('улица', 8));
  const large = straightTextLayout(
    path,
    measureLabel(() => 8, 'улица', 12),
  );
  assert.ok(large.box.maxY - large.box.minY > small.box.maxY - small.box.minY);
});

test('priority maps street classes and drives zoom thresholds', () => {
  assert.equal(streetPriority('primary'), 5);
  assert.equal(streetPriority('residential'), 2);
  assert.equal(streetPriority('service'), null);
  assert.equal(streetPriority(undefined), null);
  assert.equal(streetMinZoom(5), 11.5);
  assert.equal(streetMinZoom(3), 12.5);
  assert.equal(streetMinZoom(2), 14);
});

test('screen path keeps endpoints and has a monotonic cumulative length', () => {
  const path = prepareScreenPath([
    [0, 0],
    [100, 0],
    [100, 100],
  ]);
  assert.ok(path);
  assert.deepEqual(path.points[0], [0, 0]);
  assert.deepEqual(path.points[path.points.length - 1], [100, 100]);
  assert.ok(path.length > 100);
  for (let index = 1; index < path.cumulative.length; index++) {
    assert.ok(path.cumulative[index] >= path.cumulative[index - 1]);
  }
});

test('lays a name out along a curve and keeps neighbouring glyphs gentle', () => {
  const points = [];
  for (let step = 0; step <= 90; step += 5) {
    const angle = (step * Math.PI) / 180;
    points.push([100 + Math.cos(angle) * 200, 100 + Math.sin(angle) * 200]);
  }
  const path = prepareScreenPath(points);
  assert.ok(path);
  const text = metrics('улица Тестовая', 8);
  const layout = layoutTextAlongPath(path, 40, text);
  assert.ok(layout);
  assert.equal(layout.glyphs.length, text.chars.length);
  assert.ok(layout.maxStep <= 0.5);
  for (const glyph of layout.glyphs) {
    assert.ok(Number.isFinite(glyph.x) && Number.isFinite(glyph.y));
    assert.ok(Number.isFinite(glyph.angle));
    assert.ok(glyph.box.maxX >= glyph.box.minX);
    assert.ok(glyph.box.maxY >= glyph.box.minY);
  }
});

test('rejects a window that crosses a sharp corner', () => {
  const path = prepareScreenPath([
    [0, 0],
    [120, 0],
    [120, 120],
  ]);
  assert.ok(path);
  const text = metrics('улица Тестовая', 10);
  assert.equal(layoutTextAlongPath(path, 70, text), null);
});

test('best window stays inside its range', () => {
  const path = prepareScreenPath([
    [0, 0],
    [500, 0],
  ]);
  assert.ok(path);
  const text = metrics('улица Тестовая', 8);
  const layout = bestTextWindow(path, text, { from: 100, to: 250 });
  assert.ok(layout);
  assert.ok(layout.start >= 100);
  assert.ok(layout.start + text.total <= 250 + text.total);
});

test('multi-window repeats only on streets long enough for slots', () => {
  const long = prepareScreenPath([
    [0, 0],
    [1000, 0],
  ]);
  assert.ok(long);
  const text = metrics('улица Тестовая', 8);
  const repeats = multiTextWindows(long, text);
  assert.equal(repeats.length, 4);
  for (let index = 1; index < repeats.length; index++) {
    assert.ok(repeats[index].start > repeats[index - 1].start);
    assert.ok(repeats[index].start - repeats[index - 1].start >= text.total);
  }

  const short = prepareScreenPath([
    [0, 0],
    [150, 0],
  ]);
  assert.ok(short);
  assert.equal(multiTextWindows(short, text).length, 1);
});

test('direct straight layout matches the path midpoint layout', () => {
  const path = prepareScreenPath([
    [0, 0],
    [100, 0],
  ]);
  assert.ok(path);
  const text = metrics('улица', 8);
  const viaPath = straightTextLayout(path, text);
  const direct = straightTextLayoutAt([50, 0], [1, 0], text);
  assert.ok(Math.abs(viaPath.angle - direct.angle) < 1e-9);
  assert.deepEqual(direct.point, [50, 0]);
  assert.ok(Math.abs(viaPath.box.minX - direct.box.minX) < 1e-9);
});

test('straight fallback keeps text upright on vertical and horizontal lines', () => {
  const text = metrics('улица', 8);
  const horizontal = prepareScreenPath([
    [0, 0],
    [100, 0],
  ]);
  const vertical = prepareScreenPath([
    [0, 0],
    [0, -100],
  ]);
  assert.ok(horizontal && vertical);
  assert.ok(Math.abs(straightTextLayout(horizontal, text).angle) < 1e-6);
  assert.ok(Math.abs(Math.abs(straightTextLayout(vertical, text).angle) - Math.PI / 2) < 1e-6);
});

test('stable slots keep the same road fractions when the font changes', () => {
  const path = prepareScreenPath([
    [0, 0],
    [1000, 0],
  ]);
  assert.ok(path);
  const narrow = stableTextWindows(path, metrics('улица', 6), 3);
  const wide = stableTextWindows(path, metrics('улица', 9), 3);
  assert.equal(narrow.length, 3);
  assert.equal(wide.length, 3);
  for (let index = 0; index < 3; index++) {
    const target = ((index + 0.5) / 3) * path.length;
    const near = (narrow[index].box.minX + narrow[index].box.maxX) / 2;
    const far = (wide[index].box.minX + wide[index].box.maxX) / 2;
    assert.ok(Math.abs(near - target) < 80);
    assert.ok(Math.abs(far - target) < 80);
  }
});

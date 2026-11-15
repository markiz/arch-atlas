import assert from 'node:assert/strict';
import test from 'node:test';
import {
  LABEL_TILE_MAGIC,
  LABEL_TILE_VERSION,
  parseStreetLabelTiles,
} from '../src/map/street-label-tiles.ts';

function fixture() {
  const header = 12 + 6 + 12;
  const glyphs = 2 * 8;
  const buffer = new ArrayBuffer(header + glyphs);
  const view = new DataView(buffer);
  for (let index = 0; index < 8; index++) view.setUint8(index, LABEL_TILE_MAGIC.charCodeAt(index));
  view.setUint16(8, LABEL_TILE_VERSION, true);
  view.setUint16(10, 1, true);
  view.setUint16(12, 31, true);
  view.setUint32(14, 1, true);
  view.setInt32(18, 2, true);
  view.setInt32(22, 3, true);
  view.setUint32(26, 2, true);
  let offset = 30;
  for (const glyph of [
    { x: -4, y: 8, angle: 500, code: 'у'.codePointAt(0) },
    { x: 16, y: 12, angle: -250, code: 'A'.codePointAt(0) },
  ]) {
    view.setInt16(offset, glyph.x, true);
    view.setInt16(offset + 2, glyph.y, true);
    view.setInt16(offset + 4, glyph.angle, true);
    view.setUint16(offset + 6, glyph.code, true);
    offset += 8;
  }
  return buffer;
}

test('street label tiles parse glyphs into compact typed arrays', () => {
  const tiles = parseStreetLabelTiles(fixture());
  const tile = tiles.levels.get(31)?.get('2,3');
  assert.ok(tile);
  assert.equal(tile.count, 2);
  assert.deepEqual([...tile.x], [-4, 16]);
  assert.deepEqual([...tile.y], [8, 12]);
  assert.deepEqual([...tile.angle], [500, -250]);
  assert.deepEqual([...tile.code], ['у'.codePointAt(0), 'A'.codePointAt(0)]);
});

test('street label tiles reject a bad signature', () => {
  const buffer = fixture();
  new DataView(buffer).setUint8(0, 0);
  assert.throws(() => parseStreetLabelTiles(buffer), /сигнатура/);
});

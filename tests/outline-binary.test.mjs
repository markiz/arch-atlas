import test from 'node:test';
import assert from 'node:assert/strict';
import { parseOutlineBinary } from '../src/map/outline-binary.ts';

function fixture() {
  const points = new Float32Array([44.8, 41.71, 44.81, 41.71, 44.81, 41.72, 44.8, 41.72]);
  const ringStarts = new Uint32Array([0, 4]);
  const featureRings = new Uint32Array([0, 1]);
  const boxes = new Float32Array([44.8, 41.71, 44.81, 41.72]);
  const header = Buffer.alloc(32);
  header.write('ATLOUT01', 0, 'ascii');
  header.writeUInt32LE(1, 8);
  header.writeUInt32LE(1, 12);
  header.writeUInt32LE(1, 16);
  header.writeUInt32LE(4, 20);
  const parts = [
    header,
    Buffer.from(points.buffer, points.byteOffset, points.byteLength),
    Buffer.from(ringStarts.buffer, ringStarts.byteOffset, ringStarts.byteLength),
    Buffer.from(featureRings.buffer, featureRings.byteOffset, featureRings.byteLength),
    Buffer.from(boxes.buffer, boxes.byteOffset, boxes.byteLength),
  ];
  const bytes = Buffer.concat(parts);
  return {
    bytes,
    buffer: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  };
}

test('parses the compact outline file', () => {
  const { buffer } = fixture();
  const outline = parseOutlineBinary(buffer);
  assert.equal(outline.featureCount, 1);
  assert.equal(outline.points.length, 8);
  assert.deepEqual(
    [...outline.points.slice(0, 4)].map((value) => +value.toFixed(5)),
    [44.8, 41.71, 44.81, 41.71],
  );
  assert.deepEqual([...outline.ringStarts], [0, 4]);
  assert.deepEqual([...outline.featureRings], [0, 1]);
  assert.deepEqual(
    [...outline.boxes].map((value) => +value.toFixed(5)),
    [44.8, 41.71, 44.81, 41.72],
  );
});

test('rejects an unknown magic or a truncated file', () => {
  const { buffer } = fixture();
  const unknown = new Uint8Array(buffer.slice(0));
  unknown[0] = 0;
  assert.throws(() => parseOutlineBinary(unknown.buffer), /формат контуров/);
  assert.throws(() => parseOutlineBinary(buffer.slice(0, 40)), /Поврежденный файл контуров/);
});

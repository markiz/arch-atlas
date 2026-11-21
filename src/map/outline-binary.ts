import type { OutlineBinary } from './types';

const MAGIC_V1 = 'ATLOUT01';
const MAGIC_V2 = 'ATLOUT02';
const HEADER_BYTES = 32;

function readVarint(bytes: Uint8Array, state: { offset: number }) {
  let value = 0;
  let shift = 0;
  for (;;) {
    if (state.offset >= bytes.length) throw new Error('Поврежденный файл контуров');
    const byte = bytes[state.offset++];
    value += (byte & 0x7f) * 2 ** shift;
    if ((byte & 0x80) === 0) return value;
    shift += 7;
    if (shift > 35) throw new Error('Поврежденный файл контуров');
  }
}

function readZigzag(bytes: Uint8Array, state: { offset: number }) {
  const value = readVarint(bytes, state);
  return value % 2 === 0 ? value / 2 : -(value + 1) / 2;
}

function emptyOutline(): OutlineBinary {
  return {
    points: new Float32Array(),
    ringStarts: new Uint32Array([0]),
    featureRings: new Uint32Array([0]),
    boxes: new Float32Array(),
    featureCount: 0,
  };
}

function parseV1(buffer: ArrayBuffer, header: DataView): OutlineBinary {
  const version = header.getUint32(8, true);
  if (version !== 1) throw new Error(`Неподдерживаемая версия контуров: ${version}`);
  const featureCount = header.getUint32(12, true);
  const ringCount = header.getUint32(16, true);
  const pointCount = header.getUint32(20, true);
  if (!featureCount || !ringCount || !pointCount) {
    if (featureCount || ringCount || pointCount || buffer.byteLength !== HEADER_BYTES + 4 + 4)
      throw new Error('Пустой файл контуров');
    return emptyOutline();
  }
  const pointsBytes = pointCount * 2 * Float32Array.BYTES_PER_ELEMENT;
  const ringBytes = (ringCount + 1) * Uint32Array.BYTES_PER_ELEMENT;
  const featureBytes = (featureCount + 1) * Uint32Array.BYTES_PER_ELEMENT;
  const boxBytes = featureCount * 4 * Float32Array.BYTES_PER_ELEMENT;
  const expected = HEADER_BYTES + pointsBytes + ringBytes + featureBytes + boxBytes;
  if (buffer.byteLength !== expected) throw new Error('Поврежденный файл контуров');
  const pointsOffset = HEADER_BYTES;
  const ringOffset = pointsOffset + pointsBytes;
  const featureOffset = ringOffset + ringBytes;
  const boxOffset = featureOffset + featureBytes;
  return {
    points: new Float32Array(buffer, pointsOffset, pointCount * 2),
    ringStarts: new Uint32Array(buffer, ringOffset, ringCount + 1),
    featureRings: new Uint32Array(buffer, featureOffset, featureCount + 1),
    boxes: new Float32Array(buffer, boxOffset, featureCount * 4),
    featureCount,
  };
}

/**
 * Version 2: per-feature ring count, per-ring point count, then quantized
 * microdegree coordinates. The first point of a feature is absolute; the first
 * point of each following ring is relative to it, and all later points are
 * deltas from the previous point. Bboxes are rebuilt here because they cost
 * more to store than to compute once.
 */
function parseV2(buffer: ArrayBuffer, header: DataView): OutlineBinary {
  const version = header.getUint32(8, true);
  if (version !== 2) throw new Error(`Неподдерживаемая версия контуров: ${version}`);
  const featureCount = header.getUint32(12, true);
  const ringCount = header.getUint32(16, true);
  const pointCount = header.getUint32(20, true);
  const scale = header.getUint32(24, true);
  if (!featureCount || !ringCount || !pointCount) {
    if (featureCount || ringCount || pointCount || buffer.byteLength !== HEADER_BYTES)
      throw new Error('Пустой файл контуров');
    return emptyOutline();
  }
  if (!scale) throw new Error('Поврежденный файл контуров');
  const bytes = new Uint8Array(buffer);
  const state = { offset: HEADER_BYTES };
  const points = new Float32Array(pointCount * 2);
  const ringStarts = new Uint32Array(ringCount + 1);
  const featureRings = new Uint32Array(featureCount + 1);
  const boxes = new Float32Array(featureCount * 4);
  boxes.fill(Infinity);
  for (let index = 0; index < featureCount; index++) boxes[index * 4 + 2] = -Infinity;
  for (let index = 0; index < featureCount; index++) boxes[index * 4 + 3] = -Infinity;
  let ringCursor = 0;
  let pointCursor = 0;
  for (let feature = 0; feature < featureCount; feature++) {
    featureRings[feature] = ringCursor;
    const featureRingCount = readVarint(bytes, state);
    let featureX = 0;
    let featureY = 0;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (let ring = 0; ring < featureRingCount; ring++) {
      if (ringCursor >= ringCount) throw new Error('Поврежденный файл контуров');
      ringStarts[ringCursor++] = pointCursor;
      const count = readVarint(bytes, state);
      let previousX = 0;
      let previousY = 0;
      for (let index = 0; index < count; index++) {
        let x: number;
        let y: number;
        if (index === 0 && ring === 0) {
          x = readZigzag(bytes, state);
          y = readZigzag(bytes, state);
          featureX = x;
          featureY = y;
        } else if (index === 0) {
          x = featureX + readZigzag(bytes, state);
          y = featureY + readZigzag(bytes, state);
        } else {
          x = previousX + readZigzag(bytes, state);
          y = previousY + readZigzag(bytes, state);
        }
        previousX = x;
        previousY = y;
        if (pointCursor >= pointCount) throw new Error('Поврежденный файл контуров');
        const lng = x / scale;
        const lat = y / scale;
        points[pointCursor * 2] = lng;
        points[pointCursor * 2 + 1] = lat;
        pointCursor++;
        if (lng < minX) minX = lng;
        if (lng > maxX) maxX = lng;
        if (lat < minY) minY = lat;
        if (lat > maxY) maxY = lat;
      }
    }
    if (minX !== Infinity) {
      boxes[feature * 4] = minX;
      boxes[feature * 4 + 1] = minY;
      boxes[feature * 4 + 2] = maxX;
      boxes[feature * 4 + 3] = maxY;
    }
  }
  featureRings[featureCount] = ringCursor;
  ringStarts[ringCount] = pointCursor;
  if (ringCursor !== ringCount || pointCursor !== pointCount || state.offset !== bytes.length)
    throw new Error('Поврежденный файл контуров');
  return { points, ringStarts, featureRings, boxes, featureCount };
}

/**
 * Read the compact outline file produced by scripts/build-outlines-binary.mjs.
 * Version 2 is the current quantized format; version 1 stays readable for old
 * packages and cached bundles.
 */
export function parseOutlineBinary(buffer: ArrayBuffer): OutlineBinary {
  if (buffer.byteLength < HEADER_BYTES) throw new Error('Файл контуров слишком короткий');
  const header = new DataView(buffer);
  let magic = '';
  for (let index = 0; index < MAGIC_V1.length; index++)
    magic += String.fromCharCode(header.getUint8(index));
  if (magic === MAGIC_V1) return parseV1(buffer, header);
  if (magic === MAGIC_V2) return parseV2(buffer, header);
  throw new Error('Неизвестный формат контуров');
}

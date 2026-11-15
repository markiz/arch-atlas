import type { OutlineBinary } from './types';

const MAGIC = 'ATLOUT01';
const VERSION = 1;
const HEADER_BYTES = 32;

/**
 * Read the compact outline file produced by scripts/build-outlines-binary.mjs.
 * Layout (little-endian): 8-byte magic, version, counts, 32-byte header,
 * Float32 [lng,lat] points, Uint32 ring starts, Uint32 feature ring ranges,
 * Float32 bboxes.
 */
export function parseOutlineBinary(buffer: ArrayBuffer): OutlineBinary {
  if (buffer.byteLength < HEADER_BYTES) throw new Error('Файл контуров слишком короткий');
  const header = new DataView(buffer);
  let magic = '';
  for (let index = 0; index < MAGIC.length; index++)
    magic += String.fromCharCode(header.getUint8(index));
  if (magic !== MAGIC) throw new Error('Неизвестный формат контуров');
  const version = header.getUint32(8, true);
  if (version !== VERSION) throw new Error(`Неподдерживаемая версия контуров: ${version}`);
  const featureCount = header.getUint32(12, true);
  const ringCount = header.getUint32(16, true);
  const pointCount = header.getUint32(20, true);
  if (!featureCount || !ringCount || !pointCount) throw new Error('Пустой файл контуров');
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

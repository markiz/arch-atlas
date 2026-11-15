// Convert the generated building-outlines.geojson into a compact binary file:
// 32-byte header, Float32 [lng,lat] points, Uint32 ring starts, Uint32 feature
// ring ranges and Float32 bboxes. The browser reads this instead of parsing
// 39 MB of JSON, and keeps ~10 MB of typed arrays instead of ~79 MB of objects.
import { readFile, rename, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Progress } from './lib/progress.mjs';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = path.join(ROOT, 'public', 'atlas', 'building-outlines.geojson');
const TARGET = path.join(ROOT, 'public', 'atlas', 'building-outlines.bin');
const MAGIC = 'ATLOUT01';
const VERSION = 1;
const HEADER_BYTES = 32;
const silent = { write() {} };

function ringsOf(geometry) {
  if (!geometry) return [];
  if (geometry.type === 'Polygon') return geometry.coordinates;
  if (geometry.type === 'MultiPolygon') return geometry.coordinates.flat();
  return [];
}

async function fresh() {
  try {
    const [source, target, script] = await Promise.all([
      stat(SOURCE),
      stat(TARGET),
      stat(fileURLToPath(import.meta.url)),
    ]);
    return (
      target.size > HEADER_BYTES &&
      target.mtimeMs >= source.mtimeMs &&
      target.mtimeMs >= script.mtimeMs
    );
  } catch {
    return false;
  }
}

/** Build the compact outline file. Returns counts and the output path. */
export async function buildOutlinesBinary({ quiet = false, force = false } = {}) {
  if (!force && (await fresh())) {
    const info = await stat(TARGET);
    if (!quiet)
      console.log(`Контуры: ${TARGET} актуален (${(info.size / 1048576).toFixed(1)} МБ).`);
    return { path: TARGET, skipped: true, bytes: info.size };
  }
  const data = JSON.parse(await readFile(SOURCE, 'utf8'));
  const features = data?.features;
  if (!Array.isArray(features) || !features.length)
    throw new Error('building-outlines.geojson: нет features');
  let ringCount = 0;
  let pointCount = 0;
  for (const feature of features) {
    for (const ring of ringsOf(feature?.geometry)) {
      ringCount++;
      pointCount += ring.length;
    }
  }
  if (!ringCount || !pointCount) throw new Error('building-outlines.geojson: пустая геометрия');
  const points = new Float32Array(pointCount * 2);
  const ringStarts = new Uint32Array(ringCount + 1);
  const featureRings = new Uint32Array(features.length + 1);
  const boxes = new Float32Array(features.length * 4);
  boxes.fill(Infinity);
  for (let index = 0; index < features.length; index++) {
    boxes[index * 4 + 2] = -Infinity;
    boxes[index * 4 + 3] = -Infinity;
  }
  const progress = new Progress(features.length, {
    label: 'build outlines binary',
    stream: quiet ? silent : process.stderr,
  });
  progress.start(`${features.length} features, ${pointCount} points`);
  let ringCursor = 0;
  let pointCursor = 0;
  for (let index = 0; index < features.length; index++) {
    featureRings[index] = ringCursor;
    const rings = ringsOf(features[index]?.geometry);
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const ring of rings) {
      ringStarts[ringCursor++] = pointCursor;
      for (const point of ring) {
        const lng = point?.[0];
        const lat = point?.[1];
        if (!Number.isFinite(lng) || !Number.isFinite(lat))
          throw new Error(`building-outlines: некорректная точка в feature ${index}`);
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
      boxes[index * 4] = minX;
      boxes[index * 4 + 1] = minY;
      boxes[index * 4 + 2] = maxX;
      boxes[index * 4 + 3] = maxY;
    }
    progress.advance(`feature ${index + 1}/${features.length}`);
  }
  featureRings[features.length] = ringCursor;
  ringStarts[ringCount] = pointCursor;
  progress.finish();
  if (ringCursor !== ringCount || pointCursor !== pointCount)
    throw new Error('building-outlines: не совпали счетчики');
  const pointsBytes = points.byteLength;
  const ringBytes = ringStarts.byteLength;
  const featureBytes = featureRings.byteLength;
  const boxBytes = boxes.byteLength;
  const total = HEADER_BYTES + pointsBytes + ringBytes + featureBytes + boxBytes;
  const buffer = Buffer.allocUnsafe(total);
  buffer.write(MAGIC, 0, 'ascii');
  buffer.writeUInt32LE(VERSION, 8);
  buffer.writeUInt32LE(features.length, 12);
  buffer.writeUInt32LE(ringCount, 16);
  buffer.writeUInt32LE(pointCount, 20);
  buffer.writeUInt32LE(0, 24);
  buffer.writeUInt32LE(0, 28);
  Buffer.from(points.buffer, points.byteOffset, pointsBytes).copy(buffer, HEADER_BYTES);
  Buffer.from(ringStarts.buffer, ringStarts.byteOffset, ringBytes).copy(
    buffer,
    HEADER_BYTES + pointsBytes,
  );
  Buffer.from(featureRings.buffer, featureRings.byteOffset, featureBytes).copy(
    buffer,
    HEADER_BYTES + pointsBytes + ringBytes,
  );
  Buffer.from(boxes.buffer, boxes.byteOffset, boxBytes).copy(
    buffer,
    HEADER_BYTES + pointsBytes + ringBytes + featureBytes,
  );
  const temporary = `${TARGET}.${process.pid}.tmp`;
  await writeFile(temporary, buffer);
  await rename(temporary, TARGET);
  if (!quiet)
    console.log(
      `Контуры: ${features.length} фич, ${ringCount} колец, ${pointCount} точек, ` +
        `${(total / 1048576).toFixed(1)} МБ -> ${TARGET}`,
    );
  return { path: TARGET, skipped: false, bytes: total };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await buildOutlinesBinary({ force: process.argv.includes('--force') });
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

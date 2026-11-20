// Convert a city's generated building-outlines.geojson into a compact binary:
// 32-byte header, Float32 [lng,lat] points, Uint32 ring starts, Uint32 feature
// ring ranges and Float32 bboxes. Empty cities get a valid header-only file so
// every ready city has the same package shape.
import { readFile, rename, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { Progress } from './lib/progress.mjs';
import { ROOT, readCityConfig, readCityConfigs } from './lib/cities.mjs';

const MAGIC = 'ATLOUT01';
const VERSION = 1;
const HEADER_BYTES = 32;
const silent = { write() {} };

function sourcePath(city) {
  return path.join(ROOT, '.cache', 'atlas', city, 'building-outlines.geojson');
}

function targetPath(city) {
  return path.join(ROOT, 'public', 'atlas', 'cities', city, 'building-outlines.bin');
}

function ringsOf(geometry) {
  if (!geometry) return [];
  if (geometry.type === 'Polygon') return geometry.coordinates;
  if (geometry.type === 'MultiPolygon') return geometry.coordinates.flat();
  return [];
}

async function fresh(city) {
  try {
    const [source, target, script] = await Promise.all([
      stat(sourcePath(city)),
      stat(targetPath(city)),
      stat(new URL(import.meta.url)),
    ]);
    return (
      target.size >= HEADER_BYTES &&
      target.mtimeMs >= source.mtimeMs &&
      target.mtimeMs >= script.mtimeMs
    );
  } catch {
    return false;
  }
}

/** Build the compact outline file for one city. */
export async function buildOutlinesBinary({ city, quiet = false, force = false } = {}) {
  if (!city) throw new Error('buildOutlinesBinary requires a city');
  const config = await readCityConfig(city);
  if (config.status !== 'ready') return { path: null, skipped: true, bytes: 0 };
  const target = targetPath(city);
  if (!force && (await fresh(city))) {
    const info = await stat(target);
    if (!quiet)
      console.log(`Контуры ${city}: ${target} актуален (${(info.size / 1048576).toFixed(1)} МБ).`);
    return { path: target, skipped: true, bytes: info.size };
  }
  const data = JSON.parse(await readFile(sourcePath(city), 'utf8'));
  const features = Array.isArray(data?.features) ? data.features : [];
  let ringCount = 0;
  let pointCount = 0;
  for (const feature of features) {
    for (const ring of ringsOf(feature?.geometry)) {
      ringCount++;
      pointCount += ring.length;
    }
  }
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
    label: `build ${city} outlines binary`,
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
  const temporary = `${target}.${process.pid}.tmp`;
  await writeFile(temporary, buffer);
  await rename(temporary, target);
  if (!quiet)
    console.log(
      `Контуры ${city}: ${features.length} фич, ${ringCount} колец, ${pointCount} точек, ` +
        `${(total / 1048576).toFixed(1)} МБ -> ${target}`,
    );
  return { path: target, skipped: false, bytes: total };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const explicit = process.argv
      .find((value) => value.startsWith('--city='))
      ?.slice('--city='.length);
    const all = process.argv.includes('--all');
    const { cities } = await readCityConfigs();
    const selected = explicit
      ? cities.filter((city) => city.id === explicit)
      : all
        ? cities.filter((city) => city.status === 'ready')
        : [];
    if (!selected.length) {
      console.error('Укажите --city=<id> или --all.');
      process.exitCode = 1;
    } else {
      for (const city of selected)
        await buildOutlinesBinary({ city: city.id, force: process.argv.includes('--force') });
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

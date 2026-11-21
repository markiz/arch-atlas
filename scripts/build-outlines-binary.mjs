// Convert a city's generated building-outlines.geojson into a compact binary.
// Version 2 quantizes coordinates to microdegrees and delta-encodes them as
// varints: closing points and stored bboxes are dropped, bboxes are rebuilt
// while parsing. Coordinates decode back to Float32, which is already the
// precision the renderer used.
import { readFile, rename, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { Progress } from './lib/progress.mjs';
import { ROOT, readCityConfig, readCityConfigs } from './lib/cities.mjs';

const MAGIC = 'ATLOUT02';
const VERSION = 2;
const HEADER_BYTES = 32;
const SCALE = 1_000_000;
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

class Writer {
  constructor(size = 1 << 20) {
    this.buffer = Buffer.allocUnsafe(size);
    this.length = 0;
  }
  ensure(extra) {
    if (this.length + extra <= this.buffer.length) return;
    let size = this.buffer.length * 2;
    while (size < this.length + extra) size *= 2;
    const next = Buffer.allocUnsafe(size);
    this.buffer.copy(next, 0, 0, this.length);
    this.buffer = next;
  }
  varint(value) {
    if (!Number.isFinite(value) || value < 0) throw new Error(`bad varint ${value}`);
    value = Math.floor(value);
    this.ensure(10);
    while (value >= 0x80) {
      this.buffer[this.length++] = (value & 0x7f) | 0x80;
      value = Math.floor(value / 128);
    }
    this.buffer[this.length++] = value;
  }
  zigzag(value) {
    if (!Number.isFinite(value)) throw new Error(`bad zigzag ${value}`);
    value = Math.round(value);
    this.varint(value >= 0 ? value * 2 : -value * 2 - 1);
  }
  toBuffer() {
    return this.buffer.subarray(0, this.length);
  }
}

/** Drop the duplicated closing vertex and collapse points equal after rounding. */
function quantizeRing(ring) {
  let points = ring;
  if (points.length > 1) {
    const first = points[0];
    const last = points[points.length - 1];
    if (first?.[0] === last?.[0] && first?.[1] === last?.[1]) points = points.slice(0, -1);
  }
  const quantized = [];
  for (const point of points) {
    const lng = point?.[0];
    const lat = point?.[1];
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) throw new Error('некорректная точка');
    const x = Math.round(lng * SCALE);
    const y = Math.round(lat * SCALE);
    const previous = quantized[quantized.length - 1];
    if (!previous || previous[0] !== x || previous[1] !== y) quantized.push([x, y]);
  }
  if (quantized.length < 3)
    return points.map(([lng, lat]) => [Math.round(lng * SCALE), Math.round(lat * SCALE)]);
  return quantized;
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
  const body = new Writer(1 << 22);
  const progress = new Progress(features.length, {
    label: `build ${city} outlines binary`,
    stream: quiet ? silent : process.stderr,
  });
  progress.start(`${features.length} features`);
  let ringCount = 0;
  let pointCount = 0;
  for (const feature of features) {
    const rings = ringsOf(feature?.geometry)
      .map(quantizeRing)
      .filter((ring) => ring.length);
    body.varint(rings.length);
    let featureX = 0;
    let featureY = 0;
    rings.forEach((ring, ringIndex) => {
      ringCount++;
      pointCount += ring.length;
      body.varint(ring.length);
      let previousX = 0;
      let previousY = 0;
      for (let index = 0; index < ring.length; index++) {
        const [x, y] = ring[index];
        if (index === 0 && ringIndex === 0) {
          body.zigzag(x);
          body.zigzag(y);
          featureX = x;
          featureY = y;
        } else if (index === 0) {
          body.zigzag(x - featureX);
          body.zigzag(y - featureY);
        } else {
          body.zigzag(x - previousX);
          body.zigzag(y - previousY);
        }
        previousX = x;
        previousY = y;
      }
    });
    progress.advance(`feature ${progress.done + 1}/${features.length}`);
  }
  progress.finish();
  const payload = body.toBuffer();
  const buffer = Buffer.allocUnsafe(HEADER_BYTES + payload.length);
  buffer.write(MAGIC, 0, 'ascii');
  buffer.writeUInt32LE(VERSION, 8);
  buffer.writeUInt32LE(features.length, 12);
  buffer.writeUInt32LE(ringCount, 16);
  buffer.writeUInt32LE(pointCount, 20);
  buffer.writeUInt32LE(SCALE, 24);
  buffer.writeUInt32LE(0, 28);
  payload.copy(buffer, HEADER_BYTES);
  const temporary = `${target}.${process.pid}.tmp`;
  await writeFile(temporary, buffer);
  await rename(temporary, target);
  if (!quiet)
    console.log(
      `Контуры ${city}: ${features.length} фич, ${ringCount} колец, ${pointCount} точек, ` +
        `${(buffer.length / 1048576).toFixed(1)} МБ -> ${target}`,
    );
  return { path: target, skipped: false, bytes: buffer.length };
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

#!/usr/bin/env node
// Precompute street-label tiles, one gzip-compressed binary per language.
// The filename carries a content hash, so the files are immutable and can be
// loaded lazily when the user enables street names.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { Progress } from './lib/progress.mjs';
import {
  buildStreetLines,
  layoutTextAlongPath,
  measureLabel,
  multiTextWindows,
  prepareScreenPath,
  streetLabelFontSize,
  streetPriority,
} from '../src/map/street-labels.ts';
import {
  LABEL_TILE_MAGIC,
  LABEL_TILE_SIZE,
  LABEL_TILE_VERSION,
} from '../src/map/street-label-tiles.ts';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASEMAP = path.join(ROOT, 'public', 'atlas', 'basemap.geojson');
const FONT = path.join(ROOT, 'public', 'fonts', 'DejaVuSans.ttf');
const FONT_HELPER = path.join(ROOT, 'scripts', 'font-metrics.py');
const ATLAS = path.join(ROOT, 'public', 'atlas');
const STAMP = path.join(ROOT, '.cache', 'street-label-tiles.json');
const LANGUAGES = ['ru', 'en', 'ka', 'uk'];
const DEFAULT_ZOOMS = Array.from({ length: 16 }, (_, index) => 11.5 + index * 0.5);
const silent = { write() {} };

const argv = process.argv.slice(2);
const force = argv.includes('--force');
const zoomArg = argv.find((value) => value.startsWith('--zooms='));
const ZOOMS = zoomArg
  ? zoomArg
      .slice('--zooms='.length)
      .split(',')
      .map(Number)
      .filter((value) => Number.isFinite(value) && value > 0)
      .sort((a, b) => a - b)
  : DEFAULT_ZOOMS;
if (!ZOOMS.length) throw new Error('--zooms не содержит чисел');
if (new Set(ZOOMS).size !== ZOOMS.length) throw new Error('--zooms содержит повторы');

const WORLD = 256;
const projectX = (lng, zoom) => ((lng + 180) / 360) * WORLD * 2 ** zoom;
const projectY = (lat, zoom) => {
  const safe = Math.max(-85.0511287798, Math.min(85.0511287798, lat));
  const sin = Math.sin((safe * Math.PI) / 180);
  return (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * WORLD * 2 ** zoom;
};

function hashBytes(...values) {
  const digest = createHash('sha256');
  for (const value of values) digest.update(value);
  return digest;
}

function lineGlyphs(entry) {
  if (entry.kind === 'curved') {
    const layout = layoutTextAlongPath(entry.path, entry.start, entry.metrics);
    return layout ? layout.glyphs : [];
  }
  const glyphs = [];
  let cursor = -entry.metrics.total / 2;
  const cos = Math.cos(entry.angle);
  const sin = Math.sin(entry.angle);
  for (let index = 0; index < entry.metrics.chars.length; index++) {
    const advance = entry.metrics.advances[index];
    const distance = cursor + advance / 2;
    glyphs.push({
      ch: entry.metrics.chars[index],
      x: entry.point[0] + cos * distance,
      y: entry.point[1] + sin * distance,
      angle: entry.angle,
    });
    cursor += advance;
  }
  return glyphs;
}

function buildLabels(lines, view, zoom, metricsTable, language) {
  const bucket = Math.round(zoom * 2) / 2;
  const fontSize = streetLabelFontSize(bucket);
  const table = metricsTable[String(fontSize)] ?? {};
  const viewWorld = {
    minX: projectX(view.west, zoom),
    maxX: projectX(view.east, zoom),
    minY: projectY(view.north, zoom),
    maxY: projectY(view.south, zoom),
  };
  const visible = (box) =>
    box.maxX >= viewWorld.minX &&
    box.minX <= viewWorld.maxX &&
    box.maxY >= viewWorld.minY &&
    box.minY <= viewWorld.maxY;
  const occupancy = new Set();
  const placedCenters = new Map();
  const entries = [];
  const free = (boxes) => {
    for (const box of boxes) {
      for (let x = Math.floor(box.minX / 56); x <= Math.floor(box.maxX / 56); x++) {
        for (let y = Math.floor(box.minY / 16); y <= Math.floor(box.maxY / 16); y++) {
          if (occupancy.has(`${x}:${y}`)) return false;
        }
      }
    }
    return true;
  };
  const mark = (boxes) => {
    for (const box of boxes) {
      for (let x = Math.floor(box.minX / 56); x <= Math.floor(box.maxX / 56); x++) {
        for (let y = Math.floor(box.minY / 16); y <= Math.floor(box.maxY / 16); y++) {
          occupancy.add(`${x}:${y}`);
        }
      }
    }
  };
  for (const line of lines) {
    if (zoom < line.minZoom) continue;
    if (
      line.bbox.maxX < view.west ||
      line.bbox.minX > view.east ||
      line.bbox.maxY < view.south ||
      line.bbox.minY > view.north
    )
      continue;
    const text = line.names[language] || line.fallback;
    if (!text) continue;
    const metrics = measureLabel((char) => table[char] ?? table['?'] ?? 0, text, fontSize);
    const screen = line.coords.map(([lng, lat]) => [projectX(lng, zoom), projectY(lat, zoom)]);
    const path = prepareScreenPath(screen);
    // A label is only drawn when the whole string fits on the road geometry.
    // If it does not fit, or every window is rejected by curvature/collision,
    // leave this street unnamed instead of drawing a straight label over
    // neighbouring blocks.
    if (!path || path.length < metrics.total + 8) continue;
    const layouts = multiTextWindows(path, metrics, { isVisible: visible });
    for (const layout of layouts) {
      const boxes = layout.glyphs.map((glyph) => glyph.box);
      const center = {
        x: (layout.box.minX + layout.box.maxX) / 2,
        y: (layout.box.minY + layout.box.maxY) / 2,
      };
      const gap = Math.max(90, metrics.total * 1.25);
      if (
        (placedCenters.get(line.name) ?? []).some(
          (point) => Math.hypot(point.x - center.x, point.y - center.y) < gap,
        )
      )
        continue;
      if (!free(boxes)) continue;
      mark(boxes);
      const centers = placedCenters.get(line.name);
      if (centers) centers.push(center);
      else placedCenters.set(line.name, [center]);
      entries.push({ kind: 'curved', line, text, metrics, start: layout.start, path });
    }
  }
  return entries;
}

function encodeZoom(zoom, entries) {
  const tiles = new Map();
  let glyphCount = 0;
  for (const entry of entries) {
    const glyphs = lineGlyphs(entry);
    if (!glyphs.length) continue;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const glyph of glyphs) {
      minX = Math.min(minX, glyph.x);
      minY = Math.min(minY, glyph.y);
      maxX = Math.max(maxX, glyph.x);
      maxY = Math.max(maxY, glyph.y);
    }
    const tx = Math.floor((minX + maxX) / 2 / LABEL_TILE_SIZE);
    const ty = Math.floor((minY + maxY) / 2 / LABEL_TILE_SIZE);
    const key = `${tx},${ty}`;
    let tile = tiles.get(key);
    if (!tile) {
      tile = { tx, ty, glyphs: [] };
      tiles.set(key, tile);
    }
    for (const glyph of glyphs) {
      tile.glyphs.push({
        ch: glyph.ch,
        x: (glyph.x - tx * LABEL_TILE_SIZE) * 4,
        y: (glyph.y - ty * LABEL_TILE_SIZE) * 4,
        angle: glyph.angle * 1000,
        code: glyph.ch.codePointAt(0) ?? 63,
      });
      glyphCount++;
    }
  }
  const list = [...tiles.values()];
  let size = 6;
  for (const tile of list) size += 12 + tile.glyphs.length * 8;
  const buffer = Buffer.allocUnsafe(size);
  buffer.writeUInt16LE(Math.round(zoom * 2), 0);
  buffer.writeUInt32LE(list.length, 2);
  let offset = 6;
  for (const tile of list) {
    buffer.writeInt32LE(tile.tx, offset);
    buffer.writeInt32LE(tile.ty, offset + 4);
    buffer.writeUInt32LE(tile.glyphs.length, offset + 8);
    offset += 12;
    for (const glyph of tile.glyphs) {
      buffer.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(glyph.x))), offset);
      buffer.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(glyph.y))), offset + 2);
      buffer.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(glyph.angle))), offset + 4);
      buffer.writeUInt16LE(glyph.code, offset + 6);
      offset += 8;
    }
  }
  return { buffer, labels: entries.length, tiles: tiles.size, glyphs: glyphCount };
}

async function readStamp() {
  try {
    return JSON.parse(await readFile(STAMP, 'utf8'));
  } catch {
    return null;
  }
}

async function writeStamp(value) {
  await mkdir(path.dirname(STAMP), { recursive: true });
  const temporary = `${STAMP}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`);
  await rename(temporary, STAMP);
}

function fontMetrics(chars, sizes) {
  const output = execFileSync('python3', [FONT_HELPER], {
    cwd: ROOT,
    input: JSON.stringify({ font: FONT, sizes, chars }),
    maxBuffer: 16 * 1024 * 1024,
  });
  return JSON.parse(String(output));
}

export async function buildLabelTiles({ quiet = false, force: forceBuild = false } = {}) {
  const [basemapBytes, fontBytes, scriptBytes, helperBytes, labelsBytes, tilesBytes] =
    await Promise.all([
      readFile(BASEMAP),
      readFile(FONT),
      readFile(fileURLToPath(import.meta.url)),
      readFile(FONT_HELPER),
      readFile(path.join(ROOT, 'src', 'map', 'street-labels.ts')),
      readFile(path.join(ROOT, 'src', 'map', 'street-label-tiles.ts')),
    ]);
  const sourceDigest = hashBytes(
    basemapBytes,
    fontBytes,
    scriptBytes,
    helperBytes,
    labelsBytes,
    tilesBytes,
    ZOOMS.join(','),
  ).digest('hex');
  const names = LANGUAGES.map((language) => {
    const hash = hashBytes(sourceDigest, language).digest('hex').slice(0, 12);
    return { language, name: `street-labels-${language}-${hash}.bin` };
  });
  const targetPaths = names.map((item) => path.join(ATLAS, item.name));
  const expected = new Set(names.map((item) => item.name));
  try {
    for (const file of await readdir(ATLAS)) {
      if (/^street-labels-.*\.bin(\.gz)?$/.test(file) && !expected.has(file))
        await rm(path.join(ATLAS, file), { force: true });
    }
  } catch {}
  if (!forceBuild) {
    let current = true;
    try {
      for (const target of targetPaths) {
        const info = await stat(target);
        if (!info.isFile() || info.size < 32) current = false;
      }
      const stamp = await readStamp();
      if (stamp?.sourceDigest !== sourceDigest) current = false;
    } catch {
      current = false;
    }
    if (current) {
      if (!quiet) console.log(`Тайлы подписей актуальны: ${names.map((n) => n.name).join(', ')}`);
      return { skipped: true, files: targetPaths, sourceDigest };
    }
  }

  const data = JSON.parse(basemapBytes.toString('utf8'));
  const ways = [];
  for (const feature of data.features) {
    const props = feature.properties || {};
    if (props.kind !== 'road' || typeof props.name !== 'string' || !props.name.trim()) continue;
    const priority = streetPriority(props.class);
    if (priority === null) continue;
    const coords = feature.geometry?.coordinates;
    if (!Array.isArray(coords) || coords.length < 2) continue;
    ways.push({
      name: props.name.trim(),
      names: props.names || {},
      fallback: props.name.trim(),
      coords,
      priority,
    });
  }
  const byName = new Map();
  for (const line of buildStreetLines(ways)) {
    // Match PrepareStreetLabels: sub-30 m stubs are noise, and disconnected
    // pieces of one name are capped so a short stray segment does not get a
    // long label at an arbitrary angle.
    if (line.length < 0.0003) continue;
    const group = byName.get(line.name);
    if (group) group.push(line);
    else byName.set(line.name, [line]);
  }
  const lines = [];
  for (const group of byName.values()) {
    group.sort((a, b) => b.length - a.length);
    lines.push(...group.slice(0, 3));
  }
  lines.sort((a, b) => b.priority - a.priority || b.length - a.length);
  const cityBox = lines.reduce(
    (box, line) => ({
      west: Math.min(box.west, line.bbox.minX),
      south: Math.min(box.south, line.bbox.minY),
      east: Math.max(box.east, line.bbox.maxX),
      north: Math.max(box.north, line.bbox.maxY),
    }),
    { west: Infinity, south: Infinity, east: -Infinity, north: -Infinity },
  );
  const chars = new Set();
  for (const line of lines)
    for (const language of LANGUAGES) {
      const text = line.names[language] || line.fallback;
      for (const char of Array.from(text)) chars.add(char);
    }
  const sizes = [
    ...new Set(ZOOMS.map((zoom) => streetLabelFontSize(Math.round(zoom * 2) / 2))),
  ].sort((a, b) => a - b);
  const metrics = fontMetrics([...chars], sizes);

  if (!quiet)
    console.log(
      `Тайлы подписей: ${ways.length} way, ${lines.length} цепочек, ${ZOOMS.length} зумов, ${sizes.length} кеглей.`,
    );
  const progress = new Progress(LANGUAGES.length * ZOOMS.length, {
    label: 'build label tiles',
    stream: quiet ? silent : process.stderr,
  });
  progress.start();
  await mkdir(ATLAS, { recursive: true });
  let done = 0;
  for (let languageIndex = 0; languageIndex < LANGUAGES.length; languageIndex++) {
    const language = LANGUAGES[languageIndex];
    const sections = [];
    let labels = 0;
    let glyphs = 0;
    let tiles = 0;
    for (const zoom of ZOOMS) {
      const entries = buildLabels(lines, cityBox, zoom, metrics, language);
      const encoded = encodeZoom(zoom, entries);
      sections.push(encoded.buffer);
      labels += encoded.labels;
      glyphs += encoded.glyphs;
      tiles += encoded.tiles;
      done++;
      progress.update(done, `${language} z${zoom}`);
    }
    let headerSize = 12;
    for (const section of sections) headerSize += section.length;
    const whole = Buffer.allocUnsafe(headerSize);
    whole.write(LABEL_TILE_MAGIC, 0, 'ascii');
    whole.writeUInt16LE(LABEL_TILE_VERSION, 8);
    whole.writeUInt16LE(sections.length, 10);
    let offset = 12;
    for (const section of sections) {
      section.copy(whole, offset);
      offset += section.length;
    }
    const gzip = gzipSync(whole, { level: 9 });
    const target = targetPaths[languageIndex];
    const temporary = `${target}.${process.pid}.tmp`;
    await writeFile(temporary, gzip);
    await rename(temporary, target);
    if (!quiet)
      console.log(
        `${language}: ${labels} подписей, ${glyphs} глифов, ${tiles} тайлов, ${(gzip.length / 1048576).toFixed(2)} МБ gzip`,
      );
  }
  progress.finish();
  await writeStamp({
    sourceDigest,
    zooms: ZOOMS,
    files: names.map((item) => item.name),
  });
  return { skipped: false, files: targetPaths, sourceDigest };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await buildLabelTiles({ force });
  console.log(JSON.stringify({ skipped: result.skipped, files: result.files }));
}

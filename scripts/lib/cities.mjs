// City registry: the single source of truth for which cities exist, how they
// are presented and where their build inputs live. Build-only fields never
// reach the public catalog.
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolvePeriods } from '../../src/periods.js';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const CITIES_DIR = 'data/cities';
export const LANGS = ['ru', 'en', 'ka', 'uk'];
const ID_RE = /^[a-z0-9-]+$/;

function fail(file, message) {
  throw new Error(`${file}: ${message}`);
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function requireLabels(file, value, field) {
  if (!isPlainObject(value)) fail(file, `${field} must be an object with ru/en/ka/uk`);
  if (
    Object.keys(value).length !== LANGS.length ||
    !LANGS.every((lang) => Object.hasOwn(value, lang))
  )
    fail(file, `${field} must contain exactly ru/en/ka/uk`);
  for (const lang of LANGS)
    if (typeof value[lang] !== 'string' || !value[lang].trim())
      fail(file, `${field}.${lang} must be a non-empty string`);
  return { ru: value.ru, en: value.en, ka: value.ka, uk: value.uk };
}

function requireFinite(value, file, field) {
  if (typeof value !== 'number' || !Number.isFinite(value))
    fail(file, `${field} must be a finite number`);
  return value;
}

function requireRelative(value, file, field) {
  if (typeof value !== 'string' || !value.trim()) fail(file, `${field} must be a non-empty string`);
  if (path.isAbsolute(value) || value.split('/').includes('..'))
    fail(file, `${field} must stay inside the repository`);
  return value;
}

function validatePeriods(file, periods) {
  if (!Array.isArray(periods) || periods.length < 2) fail(file, 'periods must be an array');
  const ids = new Set();
  for (const [index, period] of periods.entries()) {
    if (!isPlainObject(period)) fail(file, `periods[${index}] must be an object`);
    if (typeof period.id !== 'string' || !ID_RE.test(period.id))
      fail(file, `periods[${index}].id is invalid`);
    if (ids.has(period.id)) fail(file, `duplicate period id "${period.id}"`);
    ids.add(period.id);
    if (typeof period.label !== 'string' || !period.label.trim())
      fail(file, `periods[${index}].label must be a non-empty string`);
    if (period.min !== null) requireFinite(period.min, file, `periods[${index}].min`);
    if (period.max !== null) requireFinite(period.max, file, `periods[${index}].max`);
    if (period.min !== null && period.max !== null && period.min > period.max)
      fail(file, `periods[${index}] has min > max`);
    if (typeof period.color !== 'string' || !/^#[0-9a-f]{6}$/i.test(period.color))
      fail(file, `periods[${index}].color must be a #rrggbb color`);
  }
  const unknown = periods.at(-1);
  if (unknown.id !== 'unknown' || unknown.min !== null || unknown.max !== null)
    fail(file, 'the last period must be "unknown" with null bounds');
  return periods;
}

function validateMap(file, map) {
  if (!isPlainObject(map)) fail(file, 'map must be an object');
  const bounds = map.bounds;
  if (!isPlainObject(bounds)) fail(file, 'map.bounds must be an object');
  const west = requireFinite(bounds.west, file, 'map.bounds.west');
  const south = requireFinite(bounds.south, file, 'map.bounds.south');
  const east = requireFinite(bounds.east, file, 'map.bounds.east');
  const north = requireFinite(bounds.north, file, 'map.bounds.north');
  if (!(west < east && south < north))
    fail(file, 'map.bounds must have west < east and south < north');
  const center = map.center;
  if (!isPlainObject(center)) fail(file, 'map.center must be an object');
  const lat = requireFinite(center.lat, file, 'map.center.lat');
  const lng = requireFinite(center.lng, file, 'map.center.lng');
  if (lat < south || lat > north || lng < west || lng > east)
    fail(file, 'map.center is outside map.bounds');
  for (const field of ['zoom', 'minZoom', 'maxZoom'])
    requireFinite(map[field], file, `map.${field}`);
  if (!(map.minZoom <= map.zoom && map.zoom <= map.maxZoom))
    fail(file, 'map zoom must be between minZoom and maxZoom');
  if (!isPlainObject(map.start)) fail(file, 'map.start must be an object');
  for (const mode of ['mobile', 'desktop']) {
    const start = map.start[mode];
    if (!isPlainObject(start) || !isPlainObject(start.center))
      fail(file, `map.start.${mode} must be an object with center and zoom`);
    const startLat = requireFinite(start.center.lat, file, `map.start.${mode}.center.lat`);
    const startLng = requireFinite(start.center.lng, file, `map.start.${mode}.center.lng`);
    const startZoom = requireFinite(start.zoom, file, `map.start.${mode}.zoom`);
    if (startLat < south || startLat > north || startLng < west || startLng > east)
      fail(file, `map.start.${mode} is outside map.bounds`);
    if (startZoom < map.minZoom || startZoom > map.maxZoom)
      fail(file, `map.start.${mode}.zoom is outside minZoom/maxZoom`);
  }
  return {
    bounds: { west, south, east, north },
    center: { lat, lng },
    zoom: map.zoom,
    minZoom: map.minZoom,
    maxZoom: map.maxZoom,
    start: {
      mobile: {
        center: { lat: map.start.mobile.center.lat, lng: map.start.mobile.center.lng },
        zoom: map.start.mobile.zoom,
      },
      desktop: {
        center: { lat: map.start.desktop.center.lat, lng: map.start.desktop.center.lng },
        zoom: map.start.desktop.zoom,
      },
    },
  };
}

export function validateCityConfig(config, id, file = `<${id}>`) {
  if (!isPlainObject(config)) fail(file, 'city config must be an object');
  if (config.id !== id) fail(file, `id "${config.id}" does not match filename "${id}.json"`);
  if (!ID_RE.test(id)) fail(file, `invalid city id "${id}"`);
  if (!['ready', 'coming-soon'].includes(config.status))
    fail(file, 'status must be "ready" or "coming-soon"');
  const labels = requireLabels(file, config.labels, 'labels');
  const country = requireLabels(file, config.country, 'country');
  const periods = validatePeriods(file, resolvePeriods(config.periods));
  if (config.allowEmpty !== undefined && typeof config.allowEmpty !== 'boolean')
    fail(file, 'allowEmpty must be a boolean');
  const map = validateMap(file, config.map);
  let build;
  if (config.status === 'ready') {
    if (!isPlainObject(config.build)) fail(file, 'ready city must have build paths');
    build = {
      rawDir: requireRelative(config.build.rawDir, file, 'build.rawDir'),
      selected: requireRelative(config.build.selected, file, 'build.selected'),
      translationsDir: requireRelative(config.build.translationsDir, file, 'build.translationsDir'),
      gridDir:
        config.build.gridDir === undefined
          ? null
          : requireRelative(config.build.gridDir, file, 'build.gridDir'),
      outlines:
        config.build.outlines === undefined || config.build.outlines === null
          ? null
          : requireRelative(config.build.outlines, file, 'build.outlines'),
    };
  } else if (config.build !== undefined) {
    build = config.build;
  }
  return {
    id,
    status: config.status,
    allowEmpty: config.allowEmpty === true,
    labels,
    country,
    periods,
    map,
    build,
    osm: isPlainObject(config.osm) ? config.osm : undefined,
    file,
  };
}

export async function readCityIndex({ root = ROOT } = {}) {
  const relative = path.join(CITIES_DIR, 'index.json');
  let value;
  try {
    value = JSON.parse(await readFile(path.join(root, relative), 'utf8'));
  } catch (error) {
    throw new Error(`${relative}: ${error.message}`, { cause: error });
  }
  if (!isPlainObject(value) || typeof value.default !== 'string')
    throw new Error(`${relative}: default city is required`);
  const order = Array.isArray(value.order) ? value.order : [];
  if (!order.length) throw new Error(`${relative}: order must not be empty`);
  if (new Set(order).size !== order.length) throw new Error(`${relative}: duplicate city ids`);
  if (!order.includes(value.default)) throw new Error(`${relative}: default city is not in order`);
  return { defaultCity: value.default, order };
}

export async function readCityConfigs({ root = ROOT } = {}) {
  const index = await readCityIndex({ root });
  const cities = [];
  for (const id of index.order) {
    const relative = path.join(CITIES_DIR, `${id}.json`);
    let config;
    try {
      config = JSON.parse(await readFile(path.join(root, relative), 'utf8'));
    } catch (error) {
      throw new Error(`${relative}: ${error.message}`, { cause: error });
    }
    cities.push(validateCityConfig(config, id, relative));
  }
  const byId = new Map(cities.map((city) => [city.id, city]));
  const defaultCity = byId.get(index.defaultCity);
  if (!defaultCity) throw new Error(`default city "${index.defaultCity}" is missing`);
  if (defaultCity.status !== 'ready') throw new Error('default city must be ready');
  return { defaultCity, cities, byId };
}

export async function readCityConfig(id, { root = ROOT } = {}) {
  if (!ID_RE.test(id)) throw new Error(`invalid city "${id}"`);
  const relative = path.join(CITIES_DIR, `${id}.json`);
  let config;
  try {
    config = JSON.parse(await readFile(path.join(root, relative), 'utf8'));
  } catch (error) {
    throw new Error(`${relative}: ${error.message}`, { cause: error });
  }
  return validateCityConfig(config, id, relative);
}

/** Fields the browser is allowed to see. */
export function publicCity(city, extra = {}) {
  return {
    id: city.id,
    status: city.status,
    labels: city.labels,
    country: city.country,
    periods: city.periods,
    map: city.map,
    ...(extra.counts ? { counts: extra.counts } : {}),
    ...(extra.manifestRevision ? { manifestRevision: extra.manifestRevision } : {}),
  };
}

async function atomicWrite(file, contents) {
  await mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.tmp`;
  await writeFile(temporary, contents);
  await rename(temporary, file);
}

/**
 * Write public/atlas/cities.json. `entries` is an array of { city, counts,
 * manifestRevision } in display order.
 */
export async function writeCitiesCatalog({
  entries,
  defaultCity,
  root = ROOT,
  outFile = path.join(root, 'public', 'atlas', 'cities.json'),
}) {
  const cities = entries.map(({ city, counts, manifestRevision }) =>
    publicCity(city, { counts, manifestRevision }),
  );
  const base = { version: 1, defaultCity, cities };
  const revision = createHash('sha256').update(JSON.stringify(base)).digest('hex').slice(0, 16);
  const payload = { ...base, revision };
  await atomicWrite(outFile, `${JSON.stringify(payload, null, 2)}\n`);
  return { ...payload, file: outFile };
}

// Ensure every file in the registry exists before a build starts.
export async function checkCityDirectories({ root = ROOT, city }) {
  const missing = [];
  for (const relative of [
    path.join('data', 'atlas', city.id),
    path.join('data', 'photos', city.id),
    path.join('data', 'aux', city.id),
  ]) {
    try {
      await readdir(path.join(root, relative));
    } catch {
      missing.push(relative);
    }
  }
  return missing;
}

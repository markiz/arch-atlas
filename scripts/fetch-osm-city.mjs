// Fetch the thematic OSM extract for one city. The build never goes online:
// this script only refreshes the tracked raw input on demand.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT, readCityConfig } from './lib/cities.mjs';

const UA = 'ArchAtlas/1.0';
// Public Overpass instances differ in load and availability. The first one that
// answers is recorded in source.json, so the provenance stays truthful.
const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];
const WATER_RELATIONS_FILE = 'water-relations.json';

function selectedQuery(relationId, layer) {
  const water = `  way(area.a)["waterway"~"river|stream|canal|drain"];
  way(area.a)["natural"="water"];
  way(area.a)["water"="river"];`;
  const city = `  way(area.a)["highway"];
  way(area.a)["leisure"~"park|garden"];
  way(area.a)["landuse"="recreation_ground"];`;
  return `[out:json][timeout:180];
rel(${relationId});map_to_area->.a;
(
${water}
${layer === 'water' ? '' : city}
);
out geom;`;
}

// Water bodies larger than a pond are multipolygons: `natural=water` sits on
// the relation and its member ways are untagged, so the way query never sees
// them. `out geom` returns the member geometry for the builder to stitch.
function waterRelationsQuery(relationId) {
  return `[out:json][timeout:120];
rel(${relationId});map_to_area->.a;
(
  rel(area.a)["natural"="water"];
  rel(area.a)["waterway"="riverbank"];
);
out geom;`;
}

// Grid-based cities can have a city-wide extract without water. This layer
// fills that gap without refetching streets.
function waterWaysQuery(relationId) {
  return `[out:json][timeout:180];
rel(${relationId});map_to_area->.a;
(
  way(area.a)["natural"="water"];
  way(area.a)["waterway"~"river|stream|canal|drain"];
);
out geom;`;
}

const EXTRA_LAYERS = {
  relations: {
    file: WATER_RELATIONS_FILE,
    key: 'waterRelations',
    query: waterRelationsQuery,
    timeoutMs: 180_000,
  },
  'water-ways': {
    file: 'water-ways.json',
    key: 'waterWays',
    query: waterWaysQuery,
    timeoutMs: 240_000,
  },
};

async function requestOverpass(query, endpoint, { label, timeoutMs, quiet }) {
  const started = Date.now();
  const heartbeat = quiet
    ? null
    : setInterval(() => {
        console.log(
          `  ${label}: жду ответ ${endpoint}, ${Math.round((Date.now() - started) / 1000)} с`,
        );
      }, 30_000);
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'User-Agent': UA,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ data: query }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) {
      const text = (await response.text()).slice(0, 300);
      const error = new Error(`Overpass HTTP ${response.status}: ${text}`);
      error.status = response.status;
      throw error;
    }
    return await response.json();
  } finally {
    if (heartbeat) clearInterval(heartbeat);
  }
}

/** Try each endpoint in turn; a 4xx other than 429 means the query is wrong. */
async function fetchOverpass(query, { label, endpoints, timeoutMs, quiet }) {
  let lastError;
  for (const endpoint of endpoints) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      if (!quiet)
        console.log(
          `Overpass: ${label} → ${endpoint}${attempt > 1 ? ` (попытка ${attempt})` : ''}`,
        );
      try {
        return {
          response: await requestOverpass(query, endpoint, { label, timeoutMs, quiet }),
          endpoint,
        };
      } catch (error) {
        lastError = error;
        const status = error.status;
        if (status && ![429, 502, 503, 504].includes(status)) throw error;
        if (!quiet)
          console.warn(`  ${label}: ${endpoint} недоступен (${error.message.split('\n')[0]})`);
        if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 15_000));
      }
    }
  }
  throw lastError;
}

async function readSource(file) {
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch {
    return {};
  }
}

function writeJson(file, value) {
  return writeFile(file, `${JSON.stringify(value)}\n`);
}

export async function fetchCityOsm({ city, layer = 'city', quiet = false, endpoint } = {}) {
  const config = await readCityConfig(city);
  if (config.status !== 'ready') throw new Error(`city ${city} is not ready`);
  if (!['city', 'water', ...Object.keys(EXTRA_LAYERS)].includes(layer))
    throw new Error(`unknown layer ${layer}`);
  const relationId = config.osm?.boundaryRelationId;
  if (!relationId) throw new Error(`city ${city} has no osm.boundaryRelationId`);
  const endpoints = endpoint ? [endpoint] : ENDPOINTS;
  const rawDir = path.join(ROOT, config.build.rawDir);
  const selectedFile = path.join(rawDir, config.build.selected);
  const relationsFile = path.join(rawDir, WATER_RELATIONS_FILE);
  const sourceFile = path.join(rawDir, 'source.json');
  await mkdir(rawDir, { recursive: true });

  const extra = EXTRA_LAYERS[layer];
  if (extra) {
    // Refresh only this water layer; the street extract stays as is.
    const query = extra.query(relationId);
    const { response, endpoint: used } = await fetchOverpass(query, {
      label: layer,
      endpoints,
      timeoutMs: extra.timeoutMs,
      quiet,
    });
    const elements = Array.isArray(response.elements) ? response.elements : [];
    const file = path.join(rawDir, extra.file);
    await writeJson(file, response);
    const source = await readSource(sourceFile);
    source.city ??= city;
    source.provider ??= 'OpenStreetMap Overpass API';
    source.boundary ??= `relation/${relationId}`;
    source.license ??= 'Open Database License (ODbL)';
    source.url ??= 'https://www.openstreetmap.org/copyright';
    source[extra.key] = {
      endpoint: used,
      query,
      downloadedAt: new Date().toISOString(),
      osmTimestamp: response.osm3s?.timestamp_osm_base ?? null,
      elements: elements.length,
      file: extra.file,
    };
    await writeJson(sourceFile, source);
    if (!quiet)
      console.log(`Wrote ${elements.length} ${layer} elements to ${path.relative(ROOT, file)}`);
    return { file, elements: elements.length, source };
  }

  const query = selectedQuery(relationId, layer);
  const { response: main, endpoint: mainEndpoint } = await fetchOverpass(query, {
    label: `layer ${layer}`,
    endpoints,
    timeoutMs: 240_000,
    quiet,
  });
  const relationsQuery = waterRelationsQuery(relationId);
  const { response: relations, endpoint: relationsEndpoint } = await fetchOverpass(relationsQuery, {
    label: 'water relations',
    endpoints,
    timeoutMs: 180_000,
    quiet,
  });
  const elements = Array.isArray(main.elements) ? main.elements : [];
  const relationElements = Array.isArray(relations.elements) ? relations.elements : [];
  await writeJson(selectedFile, main);
  await writeJson(relationsFile, relations);
  const source = {
    city,
    provider: 'OpenStreetMap Overpass API',
    endpoint: mainEndpoint,
    query,
    boundary: `relation/${relationId}`,
    downloadedAt: new Date().toISOString(),
    osmTimestamp: main.osm3s?.timestamp_osm_base ?? null,
    elements: elements.length,
    waterRelations: {
      endpoint: relationsEndpoint,
      query: relationsQuery,
      downloadedAt: new Date().toISOString(),
      osmTimestamp: relations.osm3s?.timestamp_osm_base ?? null,
      elements: relationElements.length,
      file: WATER_RELATIONS_FILE,
    },
    license: 'Open Database License (ODbL)',
    url: 'https://www.openstreetmap.org/copyright',
  };
  await writeJson(sourceFile, source);
  if (!quiet) {
    console.log(`Wrote ${elements.length} OSM elements to ${path.relative(ROOT, selectedFile)}`);
    console.log(
      `Wrote ${relationElements.length} water relations to ${path.relative(ROOT, relationsFile)}`,
    );
  }
  return { file: selectedFile, elements: elements.length, source };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const city = process.argv.find((value) => value.startsWith('--city='))?.slice('--city='.length);
    const layer =
      process.argv.find((value) => value.startsWith('--layer='))?.slice('--layer='.length) ??
      'city';
    const endpoint = process.argv
      .find((value) => value.startsWith('--endpoint='))
      ?.slice('--endpoint='.length);
    if (!city)
      throw new Error(
        'Usage: node scripts/fetch-osm-city.mjs --city=<id> [--layer=city|water|relations|water-ways] [--endpoint=<url>]',
      );
    await fetchCityOsm({ city, layer, endpoint });
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

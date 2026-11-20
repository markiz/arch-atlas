// Fetch the thematic OSM extract for one city. The build never goes online:
// this script only refreshes the tracked raw input on demand.
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT, readCityConfig } from './lib/cities.mjs';

const UA = 'ArchAtlas/1.0';
const ENDPOINT = 'https://overpass-api.de/api/interpreter';

function selectedQuery(relationId, layer) {
  const water = `  way(area.a)["waterway"~"river|stream|canal|drain"];
  way(area.a)["natural"="water"];
  way(area.a)["water"="river"];`;
  const city = `  way(area.a)["highway"];
  way(area.a)["leisure"~"park|garden"];
  way(area.a)["landuse"="recreation_ground"];
  way(area.a)["tourism"="museum"];
  way(area.a)["amenity"="museum"];`;
  return `[out:json][timeout:180];
rel(${relationId});map_to_area->.a;
(
${water}
${layer === 'water' ? '' : city}
);
out geom;`;
}

async function fetchOverpass(query) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'User-Agent': UA,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ data: query }),
        signal: AbortSignal.timeout(180_000),
      });
      if (response.ok) return await response.json();
      const text = (await response.text()).slice(0, 500);
      lastError = new Error(`Overpass HTTP ${response.status}: ${text}`);
      if (![429, 502, 503, 504].includes(response.status)) break;
    } catch (error) {
      lastError = error;
    }
    if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, 30_000));
  }
  throw lastError;
}

export async function fetchCityOsm({ city, layer = 'city', quiet = false } = {}) {
  const config = await readCityConfig(city);
  if (config.status !== 'ready') throw new Error(`city ${city} is not ready`);
  const relationId = config.osm?.boundaryRelationId;
  if (!relationId) throw new Error(`city ${city} has no osm.boundaryRelationId`);
  const query = selectedQuery(relationId, layer);
  if (!quiet) console.log(`Overpass: ${city}, relation/${relationId}`);
  const response = await fetchOverpass(query);
  const elements = Array.isArray(response.elements) ? response.elements : [];
  const rawDir = path.join(ROOT, config.build.rawDir);
  await mkdir(rawDir, { recursive: true });
  const selectedFile = path.join(rawDir, config.build.selected);
  await writeFile(selectedFile, `${JSON.stringify(response)}\n`);
  const source = {
    city,
    provider: 'OpenStreetMap Overpass API',
    endpoint: ENDPOINT,
    query,
    boundary: `relation/${relationId}`,
    downloadedAt: new Date().toISOString(),
    osmTimestamp: response.osm3s?.timestamp_osm_base ?? null,
    elements: elements.length,
    license: 'Open Database License (ODbL)',
    url: 'https://www.openstreetmap.org/copyright',
  };
  await writeFile(path.join(rawDir, 'source.json'), `${JSON.stringify(source, null, 2)}\n`);
  if (!quiet)
    console.log(`Wrote ${elements.length} OSM elements to ${path.relative(ROOT, selectedFile)}`);
  return { file: selectedFile, elements: elements.length, source };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const city = process.argv.find((value) => value.startsWith('--city='))?.slice('--city='.length);
    const layer =
      process.argv.find((value) => value.startsWith('--layer='))?.slice('--layer='.length) ??
      'city';
    if (!city)
      throw new Error('Usage: node scripts/fetch-osm-city.mjs --city=<id> [--layer=city|water]');
    await fetchCityOsm({ city, layer });
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

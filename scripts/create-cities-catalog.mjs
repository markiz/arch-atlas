// Build public/atlas/cities.json from the city registry and the generated city
// manifests. Safe to run on its own after the city packages were built.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT, readCityConfigs, writeCitiesCatalog } from './lib/cities.mjs';

export async function createCitiesCatalog({ root = ROOT } = {}) {
  const { defaultCity, cities } = await readCityConfigs({ root });
  const entries = [];
  for (const city of cities) {
    if (city.status !== 'ready') {
      entries.push({ city });
      continue;
    }
    const base = path.join(root, 'public', 'atlas', 'cities', city.id);
    let counts = { buildings: 0 };
    let manifestRevision;
    try {
      const bundle = JSON.parse(await readFile(path.join(base, 'buildings.core.json'), 'utf8'));
      counts = { buildings: Array.isArray(bundle?.buildings) ? bundle.buildings.length : 0 };
    } catch {
      try {
        const buildings = JSON.parse(await readFile(path.join(base, 'buildings.json'), 'utf8'));
        counts = { buildings: Array.isArray(buildings) ? buildings.length : 0 };
      } catch {}
    }
    for (const name of ['manifest.v3.json', 'manifest.json']) {
      try {
        manifestRevision = JSON.parse(await readFile(path.join(base, name), 'utf8')).revision;
        break;
      } catch {}
    }
    entries.push({ city, counts, manifestRevision });
  }
  return writeCitiesCatalog({
    entries,
    defaultCity: defaultCity.id,
    root,
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const catalog = await createCitiesCatalog();
  console.log(
    `Cities catalog: ${catalog.cities.length} cities, revision ${catalog.revision} -> ${path.relative(ROOT, catalog.file)}`,
  );
}

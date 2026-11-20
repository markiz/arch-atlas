// Hash one city's published package: the packed cards, basemap, compact
// outlines and every referenced photo. Paths are relative to public/atlas.
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { Progress } from './lib/progress.mjs';
import { ROOT, readCityConfig, readCityConfigs } from './lib/cities.mjs';

export const ATLAS_ROOT = path.join(ROOT, 'public', 'atlas');
const silent = { write() {} };

async function writeFileAtomic(file, contents) {
  const temporary = `${file}.${process.pid}.tmp`;
  await writeFile(temporary, contents);
  await rename(temporary, file);
}

/** Hash one city package and write public/atlas/cities/<city>/manifest.json. */
export async function createManifest({ city, quiet = false } = {}) {
  if (!city) throw new Error('createManifest requires a city');
  const config = await readCityConfig(city);
  if (config.status !== 'ready') return { files: [], revision: '', city };
  const entry = {
    buildings: `cities/${city}/buildings.json`,
    basemap: `cities/${city}/basemap.geojson`,
    outlines: `cities/${city}/building-outlines.bin`,
  };
  const buildings = JSON.parse(await readFile(path.join(ATLAS_ROOT, entry.buildings), 'utf8'));
  if (!Array.isArray(buildings)) throw new Error(`${entry.buildings}: expected an array`);
  const paths = [
    entry.buildings,
    entry.basemap,
    entry.outlines,
    ...new Set(
      buildings.flatMap((item) =>
        (item.photos ?? (item.photo ? [item.photo] : [])).flatMap((photo) =>
          [photo.file, photo.thumb, photo.card].filter(Boolean),
        ),
      ),
    ),
  ];
  const progress = new Progress(paths.length, {
    label: `hash ${city} files`,
    stream: quiet ? silent : process.stderr,
  });
  progress.start();
  const files = await Promise.all(
    paths.map(async (relative) => {
      const bytes = await readFile(path.join(ATLAS_ROOT, relative));
      const item = {
        path: relative,
        size: bytes.length,
        sha256: createHash('sha256').update(bytes).digest('hex'),
      };
      progress.advance(relative);
      return item;
    }),
  );
  progress.finish();
  const revision = createHash('sha256').update(JSON.stringify(files)).digest('hex').slice(0, 16);
  const outFile = path.join(ATLAS_ROOT, 'cities', city, 'manifest.json');
  await mkdir(path.dirname(outFile), { recursive: true });
  await writeFileAtomic(
    outFile,
    JSON.stringify({ version: 2, city, revision, entry, files }, null, 2) + '\n',
  );
  return { files, revision, city, entry, file: outFile };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
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
    for (const city of selected) {
      const result = await createManifest({ city: city.id });
      console.log(
        `Manifest ${city.id}: ${result.files.length} files, ${result.files.reduce((total, file) => total + file.size, 0)} bytes`,
      );
    }
  }
}

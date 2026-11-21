// Hash one city's published package: the split cards, basemap, compact
// outlines, photo credits and every referenced photo. Also writes the legacy
// v2 manifest/bundle for pages that were opened before the split deploy.
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { Progress } from './lib/progress.mjs';
import { ROOT, readCityConfig, readCityConfigs } from './lib/cities.mjs';

export const ATLAS_ROOT = path.join(ROOT, 'public', 'atlas');
const silent = { write() {} };
const LANGS = ['ru', 'en', 'uk', 'ka'];

async function writeFileAtomic(file, contents) {
  const temporary = `${file}.${process.pid}.tmp`;
  await writeFile(temporary, contents);
  await rename(temporary, file);
}

function revisionOf(files) {
  return createHash('sha256').update(JSON.stringify(files)).digest('hex').slice(0, 16);
}

/** Hash one city package and write manifest.json (v2) and manifest.v3.json. */
export async function createManifest({ city, quiet = false } = {}) {
  if (!city) throw new Error('createManifest requires a city');
  const config = await readCityConfig(city);
  if (config.status !== 'ready') return { files: [], revision: '', city };
  const languages = config.languages?.length ? config.languages : LANGS;
  const legacyEntry = {
    buildings: `cities/${city}/buildings.json`,
    basemap: `cities/${city}/basemap.geojson`,
    outlines: `cities/${city}/building-outlines.bin`,
  };
  const entry = {
    core: `cities/${city}/buildings.core.json`,
    details: Object.fromEntries(
      languages.map((language) => [language, `cities/${city}/buildings.details.${language}.json`]),
    ),
    basemap: legacyEntry.basemap,
    outlines: legacyEntry.outlines,
    credits: `cities/${city}/photo-credits.json`,
  };
  const buildings = JSON.parse(
    await readFile(path.join(ATLAS_ROOT, legacyEntry.buildings), 'utf8'),
  );
  if (!Array.isArray(buildings)) throw new Error(`${legacyEntry.buildings}: expected an array`);
  const photos = [
    ...new Set(
      buildings.flatMap((item) =>
        (item.photos ?? (item.photo ? [item.photo] : [])).flatMap((photo) =>
          [photo.file, photo.thumb, photo.card].filter(Boolean),
        ),
      ),
    ),
  ];
  const legacyPaths = [legacyEntry.buildings, legacyEntry.basemap, legacyEntry.outlines, ...photos];
  const splitPaths = [
    entry.core,
    ...languages.map((language) => entry.details[language]),
    entry.credits,
    entry.basemap,
    entry.outlines,
    ...photos,
  ];
  const allPaths = [...new Set([...legacyPaths, ...splitPaths])];
  const progress = new Progress(allPaths.length, {
    label: `hash ${city} files`,
    stream: quiet ? silent : process.stderr,
  });
  progress.start();
  const hashed = new Map();
  await Promise.all(
    allPaths.map(async (relative) => {
      const bytes = await readFile(path.join(ATLAS_ROOT, relative));
      hashed.set(relative, {
        path: relative,
        size: bytes.length,
        sha256: createHash('sha256').update(bytes).digest('hex'),
      });
      progress.advance(relative);
    }),
  );
  progress.finish();
  const filesFor = (paths) => paths.map((relative) => hashed.get(relative));
  const legacyFiles = filesFor(legacyPaths);
  const files = filesFor(splitPaths);

  const legacyRevision = revisionOf(legacyFiles);
  const revision = revisionOf(files);
  const directory = path.join(ATLAS_ROOT, 'cities', city);
  await mkdir(directory, { recursive: true });
  await writeFileAtomic(
    path.join(directory, 'manifest.json'),
    JSON.stringify(
      { version: 2, city, revision: legacyRevision, entry: legacyEntry, files: legacyFiles },
      null,
      2,
    ) + '\n',
  );
  await writeFileAtomic(
    path.join(directory, 'manifest.v3.json'),
    JSON.stringify({ version: 3, city, revision, entry, files }) + '\n',
  );
  return {
    files,
    revision,
    city,
    entry,
    file: path.join(directory, 'manifest.v3.json'),
    legacyFile: path.join(directory, 'manifest.json'),
    legacyRevision,
  };
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

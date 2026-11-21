import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { Progress } from './lib/progress.mjs';

const root = 'dist/atlas/';
const catalog = JSON.parse(await readFile(`${root}cities.json`, 'utf8'));
assert.equal(catalog.version, 1, 'catalog version');
assert(Array.isArray(catalog.cities) && catalog.cities.length > 0, 'catalog has no cities');
const defaultCity = catalog.cities.find((city) => city.id === catalog.defaultCity);
assert(defaultCity && defaultCity.status === 'ready', 'default city must be ready');

function entryPaths(entry) {
  const paths = [];
  for (const value of Object.values(entry ?? {})) {
    if (typeof value === 'string') paths.push(value);
    else if (value && typeof value === 'object')
      for (const nested of Object.values(value)) if (typeof nested === 'string') paths.push(nested);
  }
  return paths;
}

function assertEntryFiles(manifest, paths) {
  for (const entry of entryPaths(manifest.entry))
    assert(paths.has(entry), `${manifest.city}: entry ${entry} is not in the manifest`);
}

function assertPhotos(building, paths, credits) {
  for (const photo of building.photos ?? []) {
    assert(paths.has(photo.file), `${building.id}: photo not in manifest`);
    assert(photo.thumb && paths.has(photo.thumb), `${building.id}: photo preview not in manifest`);
    if (photo.card) assert(paths.has(photo.card), `${building.id}: card preview not in manifest`);
    if (credits) assert(credits.has(photo.id), `${building.id}: photo ${photo.id} has no credits`);
  }
}

function verifyBasemap(basemap, city) {
  assert.equal(basemap.type, 'FeatureCollection', `${city.id}: basemap type`);
  assert(
    basemap.features.every((feature) => feature.properties?.kind !== 'building'),
    `${city.id}: ordinary buildings leaked into basemap`,
  );
}

function verifyOutline(bytes, city) {
  assert(bytes.subarray(0, 8).toString() === 'ATLOUT01', `${city.id}: outline magic`);
  assert(bytes.byteLength >= 32, `${city.id}: outline header`);
}

async function verifySplit(city, manifest, paths, rootDir) {
  const entry = manifest.entry;
  assert(entry.core && entry.basemap && entry.outlines && entry.credits, `${city.id}: split entry`);
  assert(entry.details && Object.keys(entry.details).length, `${city.id}: details entry`);
  assert.deepEqual(
    Object.keys(entry.details).sort(),
    [...city.languages].sort(),
    `${city.id}: details languages`,
  );
  const core = JSON.parse(await readFile(`${rootDir}${entry.core}`, 'utf8'));
  assert.equal(core.version, 1, `${city.id}: core version`);
  assert(Array.isArray(core.buildings), `${city.id}: core buildings`);
  if (typeof city.counts?.buildings === 'number')
    assert.equal(core.buildings.length, city.counts.buildings, `${city.id}: core count`);
  const ids = new Set();
  for (const building of core.buildings) {
    assert(!ids.has(building.id), `${city.id}: duplicate core id ${building.id}`);
    ids.add(building.id);
    assert.equal(building.cityId, city.id, `${building.id}: cityId`);
    assert(building.geometry, `${building.id}: missing outline`);
    assert(typeof building.hasStory === 'boolean', `${building.id}: hasStory`);
    assert(!('description' in building), `${building.id}: description leaked into core`);
    assert(!('history' in building), `${building.id}: history leaked into core`);
    assert(!('geometryQuality' in building), `${building.id}: quality leaked into core`);
    assert(Array.isArray(building.architectIds), `${building.id}: architectIds`);
    assert(Array.isArray(building.styleIds), `${building.id}: styleIds`);
  }
  for (const [language, file] of Object.entries(entry.details)) {
    const bundle = JSON.parse(await readFile(`${rootDir}${file}`, 'utf8'));
    assert.equal(bundle.version, 1, `${city.id}/${language}: details version`);
    assert.equal(bundle.language, language, `${city.id}/${language}: details language`);
    assert.equal(bundle.city, city.id, `${city.id}/${language}: details city`);
    const detailIds = new Set();
    for (const item of bundle.buildings) {
      assert(ids.has(item.id), `${city.id}/${language}: unknown detail id ${item.id}`);
      assert(!detailIds.has(item.id), `${city.id}/${language}: duplicate detail id ${item.id}`);
      detailIds.add(item.id);
      assert.equal(typeof item.description, 'string', `${city.id}/${language}: description`);
      assert.equal(typeof item.history, 'string', `${city.id}/${language}: history`);
      assert.equal(typeof item.geometryQuality, 'string', `${city.id}/${language}: quality`);
    }
    assert.equal(detailIds.size, ids.size, `${city.id}/${language}: details do not cover the core`);
  }
  const creditsBundle = JSON.parse(await readFile(`${rootDir}${entry.credits}`, 'utf8'));
  assert.equal(creditsBundle.version, 1, `${city.id}: credits version`);
  assert(Array.isArray(creditsBundle.photos), `${city.id}: credits photos`);
  const credits = new Set();
  for (const credit of creditsBundle.photos) {
    assert(!credits.has(credit.id), `${city.id}: duplicate credit ${credit.id}`);
    credits.add(credit.id);
    for (const key of ['author', 'license', 'licenseUrl', 'source', 'modifications'])
      assert.equal(typeof credit[key], 'string', `${city.id}: credit ${credit.id} ${key}`);
    assert(Number.isInteger(credit.width) && credit.width > 0, `${city.id}: credit width`);
    assert(Number.isInteger(credit.height) && credit.height > 0, `${city.id}: credit height`);
  }
  for (const building of core.buildings) assertPhotos(building, paths, credits);
  const basemap = JSON.parse(await readFile(`${rootDir}${entry.basemap}`, 'utf8'));
  verifyBasemap(basemap, city);
  verifyOutline(await readFile(`${rootDir}${entry.outlines}`), city);
  return core.buildings.length;
}

async function verifyLegacy(city, manifest, paths, rootDir) {
  const buildings = JSON.parse(await readFile(`${rootDir}${manifest.entry.buildings}`, 'utf8'));
  assert(Array.isArray(buildings), `${city.id}: legacy buildings must be an array`);
  if (typeof city.counts?.buildings === 'number')
    assert.equal(buildings.length, city.counts.buildings, `${city.id}: legacy count`);
  for (const building of buildings) {
    assert.equal(building.cityId, city.id, `${building.id}: legacy cityId`);
    assert(building.geometry, `${building.id}: legacy missing outline`);
    assertPhotos(building, paths, null);
  }
  const basemap = JSON.parse(await readFile(`${rootDir}${manifest.entry.basemap}`, 'utf8'));
  verifyBasemap(basemap, city);
  verifyOutline(await readFile(`${rootDir}${manifest.entry.outlines}`), city);
  return buildings.length;
}

let totalFiles = 0;
let totalBuildings = 0;
for (const city of catalog.cities) {
  if (city.status !== 'ready') {
    assert(!city.manifestRevision, `${city.id}: coming-soon city must not have a package`);
    continue;
  }
  const base = `${root}cities/${city.id}/`;
  const manifests = [];
  for (const name of ['manifest.v3.json', 'manifest.json']) {
    try {
      manifests.push(JSON.parse(await readFile(`${base}${name}`, 'utf8')));
    } catch {}
  }
  assert(manifests.length > 0, `${city.id}: no manifest`);
  const primary = manifests.find((manifest) => manifest.version === 3) ?? manifests[0];
  assert.equal(primary.city, city.id, `${city.id}: manifest city`);
  if (primary.version === 3 && city.manifestRevision)
    assert.equal(primary.revision, city.manifestRevision, `${city.id}: catalog revision`);
  const allPaths = new Set(manifests.flatMap((manifest) => manifest.files.map((file) => file.path)));
  const progress = new Progress(allPaths.size, { label: `verify ${city.id} files` });
  progress.start();
  for (const path of allPaths) {
    assert(!path.includes('..') && !path.startsWith('/'), `${city.id}: unsafe path ${path}`);
    const bytes = await readFile(`${root}${path}`);
    const file = manifests
      .flatMap((manifest) => manifest.files)
      .find((candidate) => candidate.path === path);
    assert(file, `${city.id}: ${path} has no manifest entry`);
    assert.equal(bytes.length, file.size, `${path}: size`);
    assert.equal(
      createHash('sha256').update(bytes).digest('hex'),
      file.sha256,
      `${path}: hash`,
    );
    if (path.endsWith('.webp'))
      assert(
        bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP',
        `${path}: image format`,
      );
    progress.advance(path);
  }
  progress.finish();
  let counted = false;
  for (const manifest of manifests) {
    assert.equal(manifest.city, city.id, `${city.id}: manifest city`);
    assert(Array.isArray(manifest.files), `${city.id}: manifest files`);
    assertEntryFiles(manifest, new Set(manifest.files.map((file) => file.path)));
    if (manifest.version === 3) {
      totalBuildings += await verifySplit(city, manifest, new Set(allPaths), root);
      counted = true;
    } else if (manifest.version === 2) {
      await verifyLegacy(city, manifest, new Set(allPaths), root);
    } else {
      assert.fail(`${city.id}: unknown manifest version ${manifest.version}`);
    }
  }
  assert(counted, `${city.id}: manifest v3 is missing`);
  totalFiles += allPaths.size;
}
const html = await readFile('dist/index.html', 'utf8');
assert(!/\b(?:src|href)="https?:\/\//i.test(html), 'external asset in HTML');
console.log(
  `Verified dist: ${catalog.cities.length} cities, ${totalBuildings} buildings, ${totalFiles} local resources and their SHA-256 hashes.`,
);

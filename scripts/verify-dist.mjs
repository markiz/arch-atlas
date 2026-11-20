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

let totalFiles = 0;
let totalBuildings = 0;
for (const city of catalog.cities) {
  if (city.status !== 'ready') {
    assert(!city.manifestRevision, `${city.id}: coming-soon city must not have a package`);
    continue;
  }
  const base = `${root}cities/${city.id}/`;
  const manifest = JSON.parse(await readFile(`${base}manifest.json`, 'utf8'));
  assert.equal(manifest.version, 2, `${city.id}: manifest version`);
  assert.equal(manifest.city, city.id, `${city.id}: manifest city`);
  assert(
    manifest.entry && manifest.entry.buildings && manifest.entry.basemap && manifest.entry.outlines,
    `${city.id}: manifest entry`,
  );
  const paths = new Set();
  const progress = new Progress(manifest.files.length, { label: `verify ${city.id} files` });
  progress.start();
  for (const file of manifest.files) {
    assert(!paths.has(file.path), `${city.id}: duplicate manifest path ${file.path}`);
    assert(!file.path.includes('..') && !file.path.startsWith('/'), `${city.id}: unsafe path`);
    paths.add(file.path);
    const bytes = await readFile(`${root}${file.path}`);
    assert.equal(bytes.length, file.size, `${file.path}: size`);
    assert.equal(
      createHash('sha256').update(bytes).digest('hex'),
      file.sha256,
      `${file.path}: hash`,
    );
    if (file.path.endsWith('.webp'))
      assert(
        bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP',
        `${file.path}: image format`,
      );
    progress.advance(file.path);
  }
  progress.finish();
  for (const entry of Object.values(manifest.entry))
    assert(paths.has(entry), `${city.id}: entry ${entry} is not in the manifest`);
  const buildings = JSON.parse(await readFile(`${root}${manifest.entry.buildings}`, 'utf8'));
  assert(Array.isArray(buildings), `${city.id}: buildings must be an array`);
  if (!city.counts?.buildings)
    assert.equal(buildings.length, 0, `${city.id}: empty city has cards`);
  for (const building of buildings) {
    assert.equal(building.cityId, city.id, `${building.id}: cityId`);
    assert(building.geometry, `${building.id}: missing outline`);
    for (const photo of building.photos ?? []) {
      assert(paths.has(photo.file), `${building.id}: photo not in manifest`);
      assert(
        photo.thumb && paths.has(photo.thumb),
        `${building.id}: photo preview not in manifest`,
      );
    }
  }
  const basemap = JSON.parse(await readFile(`${root}${manifest.entry.basemap}`, 'utf8'));
  assert.equal(basemap.type, 'FeatureCollection', `${city.id}: basemap type`);
  assert(
    basemap.features.every((feature) => feature.properties?.kind !== 'building'),
    `${city.id}: ordinary buildings leaked into basemap`,
  );
  const outlineBytes = await readFile(`${root}${manifest.entry.outlines}`);
  assert(outlineBytes.subarray(0, 8).toString() === 'ATLOUT01', `${city.id}: outline magic`);
  assert(outlineBytes.byteLength >= 32, `${city.id}: outline header`);
  totalFiles += manifest.files.length;
  totalBuildings += buildings.length;
}
const html = await readFile('dist/index.html', 'utf8');
assert(!/\b(?:src|href)="https?:\/\//i.test(html), 'external asset in HTML');
console.log(
  `Verified dist: ${catalog.cities.length} cities, ${totalBuildings} buildings, ${totalFiles} local resources and their SHA-256 hashes.`,
);

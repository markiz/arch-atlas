// Build or check every ready city in the registry. One city owns one package;
// the public catalog is written only after all packages succeeded.
import { spawn } from 'node:child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT, readCityConfigs } from './lib/cities.mjs';
import { buildMapLayers } from './build-map-layers.mjs';
import { buildOutlinesBinary } from './build-outlines-binary.mjs';
import { mergeAux } from './merge-aux.mjs';
import { createPhotoThumbs } from './create-photo-thumbs.mjs';
import { syncPhotos } from './sync-photos.mjs';
import { assembleAtlas } from './assemble-atlas.mjs';
import { assembleLandmarks } from './assemble-landmarks.mjs';
import { createManifest } from './create-manifest.mjs';
import { createCitiesCatalog } from './create-cities-catalog.mjs';

function runRatePhotos({ city, check = false }) {
  return new Promise((resolve, reject) => {
    const args = ['scripts/rate-photos.py'];
    if (city) args.push(`--city=${city}`);
    else args.push('--all');
    if (check) args.push('--check');
    const child = spawn(process.env.PYTHON ?? 'python3', args, {
      cwd: ROOT,
      stdio: 'inherit',
    });
    child.on('error', (error) =>
      reject(new Error(`Не удалось запустить rate-photos.py: ${error.message}`)),
    );
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`rate-photos.py завершился с кодом ${code}`));
    });
  });
}

/**
 * Prepare global photo caches once, then build each city package.
 * @param {{mode?:'build'|'check', city?:string, quiet?:boolean}} options
 */
export async function buildAll({ mode = 'build', city: onlyCity, quiet = false } = {}) {
  const { cities } = await readCityConfigs();
  const ready = cities.filter((city) => city.status === 'ready');
  const selected = onlyCity ? ready.filter((city) => city.id === onlyCity) : ready;
  if (!selected.length) throw new Error(`Нет готового города "${onlyCity ?? ''}"`);
  const check = mode === 'check';

  console.log(
    `Города: ${selected.map((city) => city.id).join(', ')} (${check ? 'проверка' : 'сборка'}).`,
  );
  await createPhotoThumbs({
    quiet,
    args: onlyCity ? ['--city', onlyCity] : ['--all'],
  });
  await syncPhotos({ quiet });
  await runRatePhotos({ city: onlyCity, check });

  for (const city of cities) {
    if (city.status !== 'ready') continue;
    if (onlyCity && city.id !== onlyCity) continue;
    console.log(`\n[${city.id}] слои карты`);
    await buildMapLayers({ city: city.id, quiet });
    console.log(`[${city.id}] компактные контуры`);
    await buildOutlinesBinary({ city: city.id, quiet });
    console.log(`[${city.id}] справочники`);
    await mergeAux({ city: city.id, languages: city.languages });
    console.log(`[${city.id}] карточки`);
    await assembleAtlas({
      city: city.id,
      quiet,
      allowEmpty: city.allowEmpty,
      bounds: { ...city.map.bounds, city: city.id },
      languages: city.languages,
    });
    console.log(`[${city.id}] ориентиры`);
    await assembleLandmarks({
      city: city.id,
      quiet,
      allowEmpty: true,
      languages: city.languages,
      outFile: path.join(ROOT, '.cache', 'atlas', city.id, 'landmarks.json'),
    });
    console.log(`[${city.id}] манифест`);
    await createManifest({ city: city.id, quiet });
  }

  // A targeted build must not drop the other cities from the catalog.
  if (onlyCity) return createCitiesCatalog({ root: ROOT });

  const catalog = await createCitiesCatalog({ root: ROOT });
  console.log(
    `\nКаталог: ${catalog.cities.length} городов, по умолчанию ${catalog.defaultCity}, ревизия ${catalog.revision}.`,
  );
  return catalog;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const city = process.argv.find((value) => value.startsWith('--city='))?.slice('--city='.length);
    await buildAll({ mode: process.argv.includes('--check') ? 'check' : 'build', city });
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

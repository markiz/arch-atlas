// Merge the small per-city dictionaries from data/aux/<city>/ into the single
// build artifact data/aux/<city>.json consumed by assemble-atlas.mjs.
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ensureMergedAux, ROOT } from './lib/aux.mjs';

export async function mergeAux({ city = 'tbilisi', languages } = {}) {
  const result = await ensureMergedAux({ city, languages });
  return {
    city,
    file: result.file,
    written: result.written,
    counts: Object.fromEntries(
      Object.entries(result.aux)
        .filter(([, value]) => value && typeof value === 'object' && !Array.isArray(value))
        .map(([key, value]) => [key, Object.keys(value).length]),
    ),
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const city =
    process.argv.find((value) => value.startsWith('--city='))?.slice('--city='.length) ?? 'tbilisi';
  let languages;
  try {
    const { readCityConfig } = await import('./lib/cities.mjs');
    languages = (await readCityConfig(city)).languages;
  } catch {}
  const result = await mergeAux({ city, languages });
  const counts = result.counts;
  const summary = `${counts.styles ?? 0} styles, ${counts.architects ?? 0} architects, ${counts.districts ?? 0} districts, ${counts.yearLabels ?? 0} year labels, ${counts.types ?? 0} types`;
  console.log(
    `${result.written ? 'Merged' : 'Up to date'} ${city} aux: ${summary} -> ${path.relative(ROOT, result.file)}`,
  );
}

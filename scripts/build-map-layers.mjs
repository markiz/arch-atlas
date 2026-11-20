// Rebuild the published map layers for one city from its tracked raw extracts.
// The Python pass is deterministic, so a content hash of all inputs decides
// whether it has to run. Each city has its own stamp and output directory.
import { createHash } from 'node:crypto';
import { readFile, readdir, stat, writeFile, rename, mkdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { Progress } from './lib/progress.mjs';
import { ROOT as PROJECT_ROOT, readCityConfig, readCityConfigs } from './lib/cities.mjs';

export const ROOT = PROJECT_ROOT;
export const ATLAS = path.join(ROOT, 'public', 'atlas');
const SCRIPT = 'scripts/build-data.py';
const WATER_FILES = ['water-relations.json', 'water-ways.json'];
const silent = { write() {} };
const pythonUnavailable = new Set();

export function cityAtlasDir(city, root = ROOT) {
  return path.join(root, 'public', 'atlas', 'cities', city);
}

export function cityOutlineSource(city, root = ROOT) {
  return path.join(root, '.cache', 'atlas', city, 'building-outlines.geojson');
}

function stampFile(city, root = ROOT) {
  return path.join(root, '.cache', 'map-layers', `${city}.json`);
}

function outputs(city, root = ROOT) {
  return [path.join(cityAtlasDir(city, root), 'basemap.geojson'), cityOutlineSource(city, root)];
}

async function fileExists(file) {
  try {
    return (await stat(file)).isFile();
  } catch {
    return false;
  }
}

async function inputPaths(city, config) {
  const rawDir = path.join(ROOT, config.build.rawDir);
  const names = [];
  if (config.build.gridDir) {
    const gridDir = path.join(rawDir, config.build.gridDir);
    try {
      for (const name of await readdir(gridDir))
        if (name.endsWith('.xml')) names.push(path.relative(ROOT, path.join(gridDir, name)));
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
  }
  const addIfPresent = (relative) => names.push(path.relative(ROOT, path.join(rawDir, relative)));
  addIfPresent(config.build.selected);
  if (config.build.coverage) addIfPresent(config.build.coverage);
  for (const file of WATER_FILES) addIfPresent(file);
  if (config.build.outlines) addIfPresent(config.build.outlines);
  const translations = path.join(ROOT, config.build.translationsDir);
  for (const name of [
    'landmark-names.json',
    'basemap-names.json',
    'landmark-skip.json',
    'landmark-area-markers.json',
    'street-words.json',
  ])
    names.push(path.relative(ROOT, path.join(translations, name)));
  try {
    const landmarkDir = path.join(ROOT, 'data', 'landmarks', city);
    for (const name of await readdir(landmarkDir))
      if (name.endsWith('.json')) names.push(path.relative(ROOT, path.join(landmarkDir, name)));
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
  names.push(SCRIPT);
  names.push(path.relative(ROOT, path.join(ROOT, 'data', 'cities', `${city}.json`)));
  return [...new Set(names)].sort();
}

/** SHA-256 over every input path and its content; mtime alone is not trusted. */
async function inputDigest(city, config, stream) {
  const files = await inputPaths(city, config);
  const progress = new Progress(files.length, { label: `hash ${city} map inputs`, stream });
  progress.start(`${files.length} files`);
  const digest = createHash('sha256');
  for (const relative of files) {
    let content = null;
    try {
      content = await readFile(path.join(ROOT, relative));
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    const contentHash = content ? createHash('sha256').update(content).digest('hex') : 'missing';
    digest.update(`${relative}\0${contentHash}\n`);
    progress.advance(relative);
  }
  progress.finish();
  return digest.digest('hex');
}

async function readStamp(file) {
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch {
    return null;
  }
}

async function writeStamp(file, value) {
  await mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`);
  await rename(temporary, file);
}

async function runBuildData(city, quiet) {
  const executable = process.env.PYTHON || 'python3';
  let output = '';
  await new Promise((resolve, reject) => {
    const child = spawn(executable, [SCRIPT, `--city=${city}`], {
      cwd: ROOT,
      stdio: quiet ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    });
    if (quiet) {
      const collect = (chunk) => {
        output = `${output}${chunk}`.slice(-4000);
      };
      child.stdout?.on('data', collect);
      child.stderr?.on('data', collect);
    }
    child.on('error', (error) => {
      const failure =
        error.code === 'ENOENT'
          ? Object.assign(
              new Error(
                `Не найден ${executable}: для сборки слоёв карты нужен Python 3 (см. README). Путь можно задать через PYTHON=/путь/к/python3.`,
              ),
              { code: error.code },
            )
          : new Error(`${executable}: ${error.message}`);
      reject(failure);
    });
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      const tail = quiet && output.trim() ? `\n${output.trim()}` : '';
      reject(new Error(`${SCRIPT} завершился с кодом ${code}${tail}`));
    });
  });
}

/**
 * Ensure the city's map layers exist and match the current raw inputs.
 * @returns {{rebuilt:boolean,digest:string,reason?:string}}
 */
export async function buildMapLayers({ city, fresh = false, quiet = false } = {}) {
  if (!city) throw new Error('buildMapLayers requires a city');
  const config = await readCityConfig(city);
  if (config.status !== 'ready') return { rebuilt: false, digest: '', reason: 'not-ready' };
  const stream = quiet ? silent : process.stderr;
  const digest = await inputDigest(city, config, stream);
  const stampPath = stampFile(city);
  const expected = outputs(city);
  const [stamp, missing] = await Promise.all([
    readStamp(stampPath),
    Promise.all(expected.map(async (file) => ({ file, present: await fileExists(file) }))).then(
      (items) => items.filter((item) => !item.present).map((item) => item.file),
    ),
  ]);
  const upToDate =
    !fresh && missing.length === 0 && stamp?.version === 1 && stamp.digest === digest;
  if (upToDate) {
    if (!quiet) console.log(`Слои карты ${city} актуальны, build-data.py пропущен.`);
    return { rebuilt: false, digest };
  }
  if (pythonUnavailable.has(city) && missing.length === 0) {
    if (!quiet) console.warn(`[map-layers] Python 3 не найден, используются слои ${city}.`);
    return { rebuilt: false, digest, reason: 'no-python' };
  }
  if (!quiet) {
    const reason = fresh
      ? 'принудительно'
      : missing.length
        ? `нет ${missing.map((file) => path.relative(ROOT, file)).join(', ')}`
        : stamp
          ? 'исходники изменились'
          : 'нет отметки сборки';
    console.log(`Собираю слои карты ${city}: ${reason}.`);
  }
  try {
    await runBuildData(city, quiet);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    pythonUnavailable.add(city);
    if (missing.length) throw error;
    if (!quiet)
      console.warn(
        `[map-layers] ${error.message} Использую существующие слои ${city}; если raw/ менялся, пересобери слои вручную.`,
      );
    return { rebuilt: false, digest, reason: 'no-python' };
  }
  const sizes = {};
  for (const file of expected) sizes[path.relative(ROOT, file)] = (await stat(file)).size;
  await writeStamp(stampPath, {
    version: 1,
    city,
    digest,
    builtAt: new Date().toISOString(),
    outputs: sizes,
  });
  return { rebuilt: true, digest };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
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
      let rebuilt = 0;
      for (const city of selected) {
        const result = await buildMapLayers({
          city: city.id,
          fresh: process.argv.includes('--force'),
        });
        if (result.rebuilt) rebuilt++;
      }
      console.log(rebuilt ? 'Слои карты пересобраны.' : 'Слои карты пересобирать не нужно.');
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

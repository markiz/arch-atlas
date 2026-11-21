// Pack one source JSON per atlas object into the single city bundle consumed by
// the web app. Source files live in data/atlas/<city>/<id>.json and keep
// translations inline; style, architect, district and construction-label fields
// stay references into the city aux dictionary (data/aux/<city>/ merged to
// data/aux/<city>.json).
//
// The bundle is what the app loads (public/atlas/buildings.json for Tbilisi).
// It is generated, never edited by hand, and rebuilt by npm run build and by the
// Vite dev plugin before the page reloads.
import { readFile, readdir, writeFile, mkdir, rename } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Progress } from './lib/progress.mjs';
import { loadCityAux } from './lib/aux.mjs';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const DEFAULT_CITY = 'tbilisi';
export function cityBuildDir(root, city) {
  return path.join(root, 'public', 'atlas', 'cities', city);
}
export const DEFAULT_OUT = cityBuildDir(ROOT, DEFAULT_CITY) + '/buildings.json';
const LANGS = ['ru', 'en', 'ka', 'uk'];
const geometryLangs = (languages) => languages.filter((language) => language !== 'ru');
const GEOMETRY_ROLES = new Set([
  'above_ground',
  'heritage_boundary',
  'complex_underground',
  'neighbor_wrong_candidate',
  'historic_plan',
  'visible_domes',
  'unknown',
]);
const PHOTO_ID_RE = /^[a-f0-9]{64}$/;
const PHOTO_METADATA_FIELDS = ['author', 'license', 'licenseUrl', 'source', 'modifications'];
const PHOTO_OPTIONAL_FIELDS = ['descriptions', 'rating'];
const PHOTO_TAG_FIELDS = ['sourceTags', 'visualTags', 'tags'];
const PHOTO_DIMENSION_FIELDS = ['width', 'height'];

const silent = { write() {} };

async function writeFileAtomic(file, contents) {
  const temporary = `${file}.${process.pid}.tmp`;
  await writeFile(temporary, contents);
  await rename(temporary, file);
}

function fail(file, message) {
  throw new Error(`${file}: ${message}`);
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function requireString(file, value, field, { allowEmpty = false } = {}) {
  if (typeof value !== 'string' || (!allowEmpty && !value.trim()))
    fail(file, `${field} must be a ${allowEmpty ? '' : 'non-empty '}string`);
  return value;
}

function requireTags(file, value, field) {
  if (!Array.isArray(value)) fail(file, `${field} must be an array of strings`);
  if (new Set(value).size !== value.length) fail(file, `${field} must not contain duplicates`);
  for (const [index, item] of value.entries()) requireString(file, item, `${field}[${index}]`);
  return value;
}

function requireLabels(file, value, field, { allowEmpty = false, languages = LANGS } = {}) {
  if (!isPlainObject(value)) fail(file, `${field} must be an object with ${languages.join('/')}`);
  if (
    Object.keys(value).length !== languages.length ||
    !languages.every((lang) => Object.hasOwn(value, lang))
  )
    fail(file, `${field} must contain exactly ${languages.join('/')}`);
  for (const lang of languages)
    requireString(file, value[lang], `${field}.${lang}`, { allowEmpty });
  return Object.fromEntries(languages.map((lang) => [lang, value[lang]]));
}

function requireGeometryQualityTranslations(file, value, languages) {
  const expected = geometryLangs(languages);
  if (!isPlainObject(value))
    fail(file, `geometryQualityTranslations must be an object with ${expected.join('/')}`);
  if (
    Object.keys(value).length !== expected.length ||
    !expected.every((lang) => Object.hasOwn(value, lang))
  )
    fail(file, `geometryQualityTranslations must contain exactly ${expected.join('/')}`);
  for (const lang of expected)
    requireString(file, value[lang], `geometryQualityTranslations.${lang}`);
  return Object.fromEntries(expected.map((lang) => [lang, value[lang]]));
}

function requireReference(file, id, table, kind) {
  if (typeof id !== 'string' || !id.trim())
    fail(file, `${kind} reference must be a non-empty string`);
  if (!Object.hasOwn(table, id)) fail(file, `unknown ${kind} reference "${id}"`);
  return id;
}

function referenceLabels(file, table, id, kind, languages = LANGS) {
  const entry = table[id];
  if (!entry || !isPlainObject(entry.labels))
    fail(file, `${kind} "${id}" has no labels in the shared dictionary`);
  return requireLabels(file, entry.labels, `${kind} "${id}" labels`, { languages });
}

function styleLabels(file, table, values, languages = LANGS) {
  if (!Array.isArray(values) || !values.length) fail(file, 'styleIds must be a non-empty array');
  if (new Set(values).size !== values.length) fail(file, 'styleIds must not contain duplicates');
  const labels = Object.fromEntries(languages.map((lang) => [lang, []]));
  for (const part of values) {
    if (typeof part !== 'string' || !part.trim())
      fail(file, 'styleIds must contain non-empty strings');
    const entry = table[part];
    if (!entry) fail(file, `unknown style reference "${part}"`);
    if (!isPlainObject(entry.labels))
      fail(file, `style "${part}" has no labels in the shared dictionary`);
    const partLabels = requireLabels(file, entry.labels, `style "${part}" labels`, {
      languages,
    });
    for (const lang of languages) labels[lang].push(partLabels[lang]);
  }
  return Object.fromEntries(languages.map((lang) => [lang, labels[lang].join(', ')]));
}

function validateGeometry(file, geometry, field, bounds) {
  if (!isPlainObject(geometry) || !['Polygon', 'MultiPolygon'].includes(geometry.type))
    fail(file, `${field} must be a Polygon or MultiPolygon`);
  if (!Array.isArray(geometry.coordinates) || !geometry.coordinates.length)
    fail(file, `${field} has no coordinates`);
  if (bounds) {
    const rings = geometry.type === 'Polygon' ? geometry.coordinates : geometry.coordinates.flat();
    for (const ring of rings)
      for (const point of ring)
        if (
          !Array.isArray(point) ||
          !Number.isFinite(point[0]) ||
          !Number.isFinite(point[1]) ||
          point[0] < bounds.west ||
          point[0] > bounds.east ||
          point[1] < bounds.south ||
          point[1] > bounds.north
        )
          fail(file, `${field} is outside the ${bounds.city ?? 'city'} bounds`);
  }
  return geometry;
}

async function loadPhotoMetadata(root, city, languages = LANGS) {
  const directory = path.join(root, 'data', 'photos', city);
  let names;
  try {
    names = (await readdir(directory)).filter((name) => name.endsWith('.metadata.json')).sort();
  } catch (error) {
    if (error?.code === 'ENOENT') return new Map();
    throw new Error(`data/photos/${city}: ${error.message}`, { cause: error });
  }
  const photos = new Map();
  for (const name of names) {
    const id = name.slice(0, -'.metadata.json'.length);
    if (!PHOTO_ID_RE.test(id)) fail(name, 'photo metadata filename must be <sha256>.metadata.json');
    const file = path.join(directory, name);
    let metadata;
    try {
      metadata = JSON.parse(await readFile(file, 'utf8'));
    } catch (error) {
      fail(file, error.message);
    }
    if (!isPlainObject(metadata)) fail(file, 'photo metadata must be an object');
    for (const field of PHOTO_METADATA_FIELDS)
      requireString(file, metadata[field], field, {
        allowEmpty: field === 'author' || field === 'license',
      });
    for (const field of ['author', 'license'])
      if (
        metadata[field] &&
        /[^\p{Script=Latin}\p{Script=Common}\p{Script=Inherited}]/u.test(metadata[field])
      )
        fail(file, `${field} must be Latin script and English wording`);
    for (const field of PHOTO_DIMENSION_FIELDS)
      if (!Number.isInteger(metadata[field]) || metadata[field] <= 0)
        fail(file, `${field} must be a positive integer`);
    for (const field of PHOTO_TAG_FIELDS)
      if (metadata[field] !== undefined) requireTags(file, metadata[field], field);
    if (metadata.descriptions !== undefined)
      requireLabels(file, metadata.descriptions, 'descriptions', { languages });
    if (
      metadata.rating !== undefined &&
      (!Number.isInteger(metadata.rating) || metadata.rating < 0 || metadata.rating > 100)
    )
      fail(file, 'rating must be an integer from 0 to 100');
    const unknown = Object.keys(metadata).filter(
      (key) =>
        !PHOTO_METADATA_FIELDS.includes(key) &&
        !PHOTO_OPTIONAL_FIELDS.includes(key) &&
        !PHOTO_TAG_FIELDS.includes(key) &&
        !PHOTO_DIMENSION_FIELDS.includes(key),
    );
    if (unknown.length) fail(file, `unknown photo metadata fields: ${unknown.join(', ')}`);
    photos.set(id, metadata);
  }
  return photos;
}

function validatePhoto(file, photoId, index, seen, city, metadataById) {
  if (typeof photoId !== 'string' || !PHOTO_ID_RE.test(photoId))
    fail(file, `photos[${index}] must be a lowercase sha256 photo id`);
  if (seen.has(photoId)) fail(file, `duplicate photo ${photoId}`);
  seen.add(photoId);
  const metadata = metadataById.get(photoId);
  if (!metadata)
    fail(file, `photos[${index}] references missing data/photos/${city}/${photoId}.metadata.json`);
  const photo = {
    id: photoId,
    file: `photos/${city}/${photoId}.webp`,
    thumb: `thumbnails/${city}/${photoId}.webp`,
    card: `cards/${city}/${photoId}.webp`,
  };
  for (const key of PHOTO_METADATA_FIELDS) photo[key] = metadata[key];
  for (const key of PHOTO_DIMENSION_FIELDS) photo[key] = metadata[key];
  for (const key of PHOTO_TAG_FIELDS) if (metadata[key] !== undefined) photo[key] = metadata[key];
  if (metadata.descriptions !== undefined) photo.descriptions = metadata.descriptions;
  if (metadata.rating !== undefined) photo.rating = metadata.rating;
  return photo;
}

/**
 * Convert one source record into the shape the UI already consumes. Labels for
 * reference fields are resolved here so the browser does not need the shared
 * dictionary.
 */
export function hydrateCard(
  card,
  attributes,
  file = `<${card?.id ?? 'unknown'}>`,
  city,
  photoMetadata = new Map(),
  bounds,
  languages = LANGS,
) {
  if (!isPlainObject(card)) fail(file, 'record must be an object');
  const id = requireString(file, card.id, 'id');
  const names = requireLabels(file, card.names, 'names', { languages });
  const addresses = requireLabels(file, card.addresses, 'addresses', {
    allowEmpty: true,
    languages,
  });
  const descriptions =
    card.descriptions === undefined
      ? null
      : requireLabels(file, card.descriptions, 'descriptions', { languages });
  const histories =
    card.histories === undefined
      ? null
      : requireLabels(file, card.histories, 'histories', { languages });

  const yearLabelId = requireReference(
    file,
    card.yearLabelId,
    attributes.yearLabels,
    'construction label',
  );
  const districtId = requireReference(file, card.districtId, attributes.districts, 'district');
  const type = requireReference(file, card.type, attributes.types, 'type');
  if (!Array.isArray(card.architectIds)) fail(file, 'architectIds must be an array');
  const architectIds = card.architectIds.map((value, index) =>
    requireReference(file, value, attributes.architects, `architectIds[${index}]`),
  );
  if (new Set(architectIds).size !== architectIds.length)
    fail(file, 'architectIds must not contain duplicates');

  if (
    !(card.minYear === null && card.maxYear === null) &&
    !(
      Number.isInteger(card.minYear) &&
      Number.isInteger(card.maxYear) &&
      card.minYear <= card.maxYear
    )
  )
    fail(file, 'minYear/maxYear must both be null or an ordered integer pair');
  if (
    !Array.isArray(card.coordinates) ||
    card.coordinates.length !== 2 ||
    !card.coordinates.every((value) => Number.isFinite(value))
  )
    fail(file, 'coordinates must be [longitude, latitude]');
  const geometry = validateGeometry(file, card.geometry, 'geometry', bounds);
  requireString(file, card.geometryQuality, 'geometryQuality');
  const geometryQualityTranslations =
    card.geometryQualityTranslations === undefined
      ? null
      : requireGeometryQualityTranslations(file, card.geometryQualityTranslations, languages);
  requireString(file, card.source, 'source');
  if (!/^https?:\/\//.test(card.source)) fail(file, 'source must be an http(s) URL');
  if (
    card.otherSource !== undefined &&
    !/^https?:\/\//.test(requireString(file, card.otherSource, 'otherSource'))
  )
    fail(file, 'otherSource must be an http(s) URL');
  if (card.googlePlaceId !== undefined) requireString(file, card.googlePlaceId, 'googlePlaceId');
  if (
    card.googlePlaceIdSource !== undefined &&
    !/^https?:\/\//.test(requireString(file, card.googlePlaceIdSource, 'googlePlaceIdSource'))
  )
    fail(file, 'googlePlaceIdSource must be an http(s) URL');

  if (card.geometryRole !== undefined && !GEOMETRY_ROLES.has(card.geometryRole))
    fail(file, `unknown geometryRole "${card.geometryRole}"`);
  if (card.geometryVariants !== undefined) {
    if (!Array.isArray(card.geometryVariants)) fail(file, 'geometryVariants must be an array');
    for (const [index, variant] of card.geometryVariants.entries()) {
      if (!isPlainObject(variant)) fail(file, `geometryVariants[${index}] must be an object`);
      if (!GEOMETRY_ROLES.has(variant.role))
        fail(file, `geometryVariants[${index}].role is invalid`);
      validateGeometry(file, variant.geometry, `geometryVariants[${index}].geometry`, bounds);
    }
  }

  if (!Array.isArray(card.photos)) fail(file, 'photos must be an array');
  const seenPhotos = new Set();
  const photos = card.photos.map((photoId, index) =>
    validatePhoto(file, photoId, index, seenPhotos, city, photoMetadata),
  );

  const styleIds = card.styleIds;
  const styles = styleLabels(file, attributes.styles, styleIds, languages);
  const yearLabels = referenceLabels(
    file,
    attributes.yearLabels,
    yearLabelId,
    'construction label',
    languages,
  );
  const districts = referenceLabels(file, attributes.districts, districtId, 'district', languages);
  const typeLabels = referenceLabels(file, attributes.types, type, 'type', languages);
  const architectsByLanguage = Object.fromEntries(languages.map((lang) => [lang, []]));
  for (const architectId of architectIds) {
    const labels = referenceLabels(
      file,
      attributes.architects,
      architectId,
      'architect',
      languages,
    );
    for (const lang of languages) architectsByLanguage[lang].push(labels[lang]);
  }

  if (
    bounds &&
    (card.coordinates[0] < bounds.west ||
      card.coordinates[0] > bounds.east ||
      card.coordinates[1] < bounds.south ||
      card.coordinates[1] > bounds.north)
  )
    fail(file, 'coordinates are outside the city bounds');

  const out = {
    id,
    cityId: city,
    name: names.ru,
    nameKa: names.ka ?? '',
    nameEn: names.en ?? '',
    nameUk: names.uk ?? '',
    ...(names.sr !== undefined ? { nameSr: names.sr } : {}),
    names,
    address: addresses.ru,
    addresses,
    district: districts.ru,
    districts,
    districtId,
    type,
    typeLabels,
    minYear: card.minYear,
    maxYear: card.maxYear,
    yearLabel: yearLabels.ru,
    yearLabelId,
    yearLabels,
    architects: architectsByLanguage.ru,
    architectIds,
    architectsByLanguage,
    style: styles.ru,
    styleIds,
    styles,
    description: descriptions?.ru ?? '',
    history: histories?.ru ?? '',
    coordinates: card.coordinates,
    geometry,
    geometryQuality: card.geometryQuality,
    photos,
    source: card.source,
  };
  if (descriptions) out.descriptions = descriptions;
  if (histories) out.histories = histories;
  if (geometryQualityTranslations) out.geometryQualityTranslations = geometryQualityTranslations;
  if (card.osmId !== undefined) out.osmId = requireString(file, card.osmId, 'osmId');
  if (card.originalLanguage !== undefined)
    out.originalLanguage = requireString(file, card.originalLanguage, 'originalLanguage');
  if (card.otherSource !== undefined) out.otherSource = card.otherSource;
  if (card.googlePlaceId !== undefined) out.googlePlaceId = card.googlePlaceId;
  if (card.googlePlaceIdSource !== undefined) out.googlePlaceIdSource = card.googlePlaceIdSource;
  if (card.geometryRole !== undefined) out.geometryRole = card.geometryRole;
  if (card.geometryVariants !== undefined) out.geometryVariants = card.geometryVariants;
  return out;
}

/**
 * Split hydrated cards into the map/catalog core, per-language inspector text
 * and language-independent photo credits. `hasStory` must be computed from all
 * languages: the catalog filter runs before details are fetched.
 */
export function splitAtlas(cards, languages = LANGS) {
  const credits = new Map();
  const core = cards.map((card) => {
    const item = {
      id: card.id,
      cityId: card.cityId,
      names: card.names,
      addresses: card.addresses,
      districtId: card.districtId,
      districts: card.districts,
      type: card.type,
      typeLabels: card.typeLabels,
      minYear: card.minYear,
      maxYear: card.maxYear,
      yearLabelId: card.yearLabelId,
      yearLabels: card.yearLabels,
      architectIds: card.architectIds,
      architectsByLanguage: card.architectsByLanguage,
      styleIds: card.styleIds,
      styles: card.styles,
      coordinates: card.coordinates,
      photos: (card.photos ?? []).map((photo) => ({
        id: photo.id,
        file: photo.file,
        thumb: photo.thumb,
        ...(photo.card ? { card: photo.card } : {}),
        rating: photo.rating ?? 0,
        ...(photo.tags?.length ? { tags: photo.tags } : {}),
      })),
      hasStory: hasText(card.descriptions) || hasText(card.histories),
      source: card.source,
    };
    if (card.otherSource !== undefined) item.otherSource = card.otherSource;
    if (card.googlePlaceId !== undefined) item.googlePlaceId = card.googlePlaceId;
    if (card.googlePlaceIdSource !== undefined)
      item.googlePlaceIdSource = card.googlePlaceIdSource;
    if (card.geometry !== undefined) item.geometry = card.geometry;
    if (card.geometryRole !== undefined) item.geometryRole = card.geometryRole;
    if (card.geometryVariants !== undefined) item.geometryVariants = card.geometryVariants;
    if (card.osmId !== undefined) item.osmId = card.osmId;
    for (const photo of card.photos ?? []) {
      if (credits.has(photo.id)) continue;
      credits.set(photo.id, {
        id: photo.id,
        author: photo.author,
        license: photo.license,
        licenseUrl: photo.licenseUrl,
        source: photo.source,
        modifications: photo.modifications,
        width: photo.width,
        height: photo.height,
        ...(photo.descriptions ? { descriptions: photo.descriptions } : {}),
      });
    }
    return item;
  });
  const details = Object.fromEntries(
    languages.map((language) => [
      language,
      cards.map((card) => ({
        id: card.id,
        description: card.descriptions?.[language] || card.descriptions?.ru || '',
        history: card.histories?.[language] || '',
        geometryQuality:
          language === 'ru'
            ? card.geometryQuality
            : card.geometryQualityTranslations?.[language] || card.geometryQuality,
      })),
    ]),
  );
  return { core, details, credits: [...credits.values()] };
}

function hasText(labels) {
  return !!labels && Object.values(labels).some((value) => typeof value === 'string' && value.trim());
}

async function writeSplitFiles(destination, split, city, languages) {
  const directory = path.dirname(destination);
  const coreFile = path.join(directory, 'buildings.core.json');
  const creditFile = path.join(directory, 'photo-credits.json');
  const detailFiles = Object.fromEntries(
    languages.map((language) => [
      language,
      path.join(directory, `buildings.details.${language}.json`),
    ]),
  );
  await writeFileAtomic(
    coreFile,
    `${JSON.stringify({ version: 1, buildings: split.core })}\n`,
  );
  for (const language of languages)
    await writeFileAtomic(
      detailFiles[language],
      `${JSON.stringify({
        version: 1,
        city,
        language,
        buildings: split.details[language],
      })}\n`,
    );
  await writeFileAtomic(
    creditFile,
    `${JSON.stringify({ version: 1, city, photos: split.credits })}\n`,
  );
  return { core: coreFile, details: detailFiles, credits: creditFile };
}

/**
 * Read data/atlas/<city>/*.json and write the packed city bundle.
 * @param {{city?:string,root?:string,outFile?:string,quiet?:boolean,split?:boolean,legacy?:boolean}} options
 */
export async function assembleAtlas({
  city = DEFAULT_CITY,
  root = ROOT,
  outFile,
  quiet = false,
  allowEmpty = false,
  bounds = null,
  languages = LANGS,
  split = true,
  legacy = true,
} = {}) {
  if (!/^[a-z0-9-]+$/.test(city)) throw new Error(`invalid city "${city}"`);
  const destination = outFile ?? path.join(cityBuildDir(root, city), 'buildings.json');
  const sourceDir = path.join(root, 'data', 'atlas', city);
  const attributes = await loadCityAux({ root, city, languages });
  const photoMetadata = await loadPhotoMetadata(root, city, languages);

  let files;
  try {
    files = (await readdir(sourceDir)).filter((name) => name.endsWith('.json')).sort();
  } catch (error) {
    throw new Error(`${path.relative(root, sourceDir)}: ${error.message}`, { cause: error });
  }
  if (!files.length && !allowEmpty)
    throw new Error(`${path.relative(root, sourceDir)}: no atlas objects found`);

  const progress = new Progress(files.length, {
    label: `pack ${city} atlas`,
    stream: quiet ? silent : process.stderr,
  });
  progress.start();
  const cards = [];
  const ids = new Set();
  for (const file of files) {
    const relative = path.join('data', 'atlas', city, file);
    const id = path.basename(file, '.json');
    let card;
    try {
      card = JSON.parse(await readFile(path.join(sourceDir, file), 'utf8'));
    } catch (error) {
      throw new Error(`${relative}: ${error.message}`, { cause: error });
    }
    if (card.id !== id) fail(relative, `id "${card.id}" does not match filename "${id}.json"`);
    if (ids.has(id)) fail(relative, `duplicate id "${id}"`);
    ids.add(id);
    cards.push(hydrateCard(card, attributes, relative, city, photoMetadata, bounds, languages));
    progress.advance(file);
  }
  progress.finish();

  await mkdir(path.dirname(destination), { recursive: true });
  if (legacy) await writeFileAtomic(destination, `${JSON.stringify(cards)}\n`);
  const splitData = splitAtlas(cards, languages);
  const splitFiles = split ? await writeSplitFiles(destination, splitData, city, languages) : null;
  return {
    cards,
    core: splitData.core,
    details: splitData.details,
    credits: splitData.credits,
    city,
    outFile: destination,
    splitFiles,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const argument = (name) =>
    process.argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);
  const city = argument('city') ?? DEFAULT_CITY;
  const out = argument('out');
  let bounds = null;
  let allowEmpty = false;
  let languages = LANGS;
  try {
    const { readCityConfig } = await import('./lib/cities.mjs');
    const config = await readCityConfig(city);
    bounds = { ...config.map.bounds, city };
    allowEmpty = config.allowEmpty;
    languages = config.languages;
  } catch {}
  const result = await assembleAtlas({
    city,
    bounds,
    allowEmpty,
    languages,
    outFile: out ? path.resolve(ROOT, out) : undefined,
  });
  console.log(
    `Packed ${result.cards.length} objects from data/atlas/${result.city}/ into ${path.relative(ROOT, result.outFile)}`,
  );
}

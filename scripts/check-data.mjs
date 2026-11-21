import { readFile, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { Progress } from './lib/progress.mjs';
import { readCityConfig, readCityConfigs } from './lib/cities.mjs';

const taxonomy = JSON.parse(await readFile('data/photo-visual-tags.json', 'utf8'));
const visualTagIds = new Set(taxonomy.tags.map((tag) => tag.id));
assert(
  taxonomy.tags.length < 50,
  `visual tag taxonomy must stay below 50 tags, found ${taxonomy.tags.length}`,
);

/**
 * Every card and landmark must sit inside the road network, not next to a
 * blank basemap. The check uses a coarse segment grid: a point farther than
 * the threshold cannot hide in an unvisited cell.
 */
const ROAD_REACH_METERS = 300;
const COVERAGE_CELL_DEGREES = 0.005;

function pointToSegmentMeters(px, py, ax, ay, bx, by, lonScale, latScale) {
  const dx = bx - ax,
    dy = by - ay;
  const denominator = dx * dx + dy * dy;
  const t =
    denominator > 0 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / denominator)) : 0;
  const x = ax + t * dx,
    y = ay + t * dy;
  return Math.hypot((x - px) * lonScale, (y - py) * latScale);
}

function assertRoadCoverage(cityId, geo, data) {
  const roads = geo.features.filter((feature) => feature.properties?.kind === 'road');
  if (!roads.length) return null;
  const grid = new Map();
  for (const feature of roads) {
    if (feature.geometry?.type !== 'LineString') continue;
    const coords = feature.geometry.coordinates;
    for (let index = 1; index < coords.length; index++) {
      const [ax, ay] = coords[index - 1],
        [bx, by] = coords[index];
      const minX = Math.floor(Math.min(ax, bx) / COVERAGE_CELL_DEGREES),
        maxX = Math.floor(Math.max(ax, bx) / COVERAGE_CELL_DEGREES),
        minY = Math.floor(Math.min(ay, by) / COVERAGE_CELL_DEGREES),
        maxY = Math.floor(Math.max(ay, by) / COVERAGE_CELL_DEGREES);
      const segment = [ax, ay, bx, by];
      for (let x = minX; x <= maxX; x++)
        for (let y = minY; y <= maxY; y++) {
          const key = `${x},${y}`;
          const bucket = grid.get(key);
          if (bucket) bucket.push(segment);
          else grid.set(key, [segment]);
        }
    }
  }
  const points = data.map((building) => ({
    x: building.coordinates[0],
    y: building.coordinates[1],
    label: building.id,
  }));
  for (const feature of geo.features) {
    if (feature.properties?.kind !== 'landmark') continue;
    const geometry = feature.geometry;
    if (geometry?.type === 'Point') {
      points.push({
        x: geometry.coordinates[0],
        y: geometry.coordinates[1],
        label: feature.properties.osmId ?? 'landmark',
      });
    } else if (geometry?.type === 'Polygon' || geometry?.type === 'MultiPolygon') {
      const ring =
        geometry.type === 'Polygon' ? geometry.coordinates[0] : geometry.coordinates[0][0];
      if (!ring?.length) continue;
      points.push({
        x: ring.reduce((sum, point) => sum + point[0], 0) / ring.length,
        y: ring.reduce((sum, point) => sum + point[1], 0) / ring.length,
        label: feature.properties.osmId ?? 'landmark',
      });
    }
  }
  if (!points.length) return { count: 0, farthest: { distance: 0, label: '' } };
  const latitude = points.reduce((sum, point) => sum + point.y, 0) / points.length;
  const latScale =
    111132.954 -
    559.822 * Math.cos((2 * (latitude * Math.PI)) / 180) +
    1.175 * Math.cos((4 * (latitude * Math.PI)) / 180);
  const lonScale =
    111412.84 * Math.cos((latitude * Math.PI) / 180) -
    93.5 * Math.cos((3 * (latitude * Math.PI)) / 180);
  let farthest = { distance: 0, label: '' };
  for (const point of points) {
    const cellX = Math.floor(point.x / COVERAGE_CELL_DEGREES),
      cellY = Math.floor(point.y / COVERAGE_CELL_DEGREES);
    let best = Infinity;
    for (let x = cellX - 1; x <= cellX + 1; x++)
      for (let y = cellY - 1; y <= cellY + 1; y++) {
        for (const [ax, ay, bx, by] of grid.get(`${x},${y}`) ?? []) {
          const distance = pointToSegmentMeters(
            point.x,
            point.y,
            ax,
            ay,
            bx,
            by,
            lonScale,
            latScale,
          );
          if (distance < best) best = distance;
        }
      }
    if (best > farthest.distance) farthest = { distance: best, label: point.label };
    assert(
      best <= ROAD_REACH_METERS,
      `${cityId}: ${point.label} is ${Number.isFinite(best) ? `${Math.round(best)} m` : 'far'} from the nearest road`,
    );
  }
  return { count: points.length, farthest };
}

async function checkSplitCity(cityId, cards, languages) {
  const directory = `public/atlas/cities/${cityId}/`;
  const core = JSON.parse(await readFile(`${directory}buildings.core.json`, 'utf8'));
  assert.equal(core.version, 1, `${cityId}: core version`);
  assert(Array.isArray(core.buildings), `${cityId}: core buildings`);
  assert.equal(core.buildings.length, cards.length, `${cityId}: core count`);
  const coreIds = new Set(core.buildings.map((item) => item.id));
  assert.equal(coreIds.size, cards.length, `${cityId}: duplicate core ids`);
  const cardById = new Map(cards.map((item) => [item.id, item]));
  for (const item of core.buildings) {
    const card = cardById.get(item.id);
    assert(card, `${cityId}: unknown core id ${item.id}`);
    const story = [card.descriptions, card.histories].some(
      (value) =>
        value && Object.values(value).some((text) => typeof text === 'string' && text.trim()),
    );
    assert.equal(item.hasStory, story, `${item.id}: hasStory does not match the text`);
    for (const key of ['description', 'history', 'geometryQuality'])
      assert(!(key in item), `${item.id}: ${key} leaked into core`);
    for (const photo of item.photos ?? [])
      assert(!('author' in photo), `${item.id}: photo credit leaked into core`);
  }
  for (const language of languages) {
    const details = JSON.parse(
      await readFile(`${directory}buildings.details.${language}.json`, 'utf8'),
    );
    assert.equal(details.version, 1, `${cityId}/${language}: details version`);
    assert.equal(details.language, language, `${cityId}/${language}: details language`);
    assert.equal(details.buildings.length, cards.length, `${cityId}/${language}: details count`);
    const detailIds = new Set(details.buildings.map((item) => item.id));
    assert.equal(detailIds.size, cards.length, `${cityId}/${language}: duplicate details ids`);
    for (const id of coreIds) assert(detailIds.has(id), `${cityId}/${language}: missing ${id}`);
    for (const item of details.buildings)
      for (const key of ['description', 'history', 'geometryQuality'])
        assert.equal(typeof item[key], 'string', `${cityId}/${language}: ${item.id} ${key}`);
  }
  const credits = JSON.parse(await readFile(`${directory}photo-credits.json`, 'utf8'));
  assert.equal(credits.version, 1, `${cityId}: credits version`);
  const creditIds = new Set(credits.photos.map((item) => item.id));
  for (const card of cards)
    for (const photo of card.photos ?? [])
      assert(creditIds.has(photo.id), `${cityId}: photo ${photo.id} has no credits`);
}

async function checkCity(cityId) {
  const config = await readCityConfig(cityId);
  const langs = config.languages;
  const data = JSON.parse(await readFile(`public/atlas/cities/${cityId}/buildings.json`, 'utf8'));
  const geo = JSON.parse(await readFile(`public/atlas/cities/${cityId}/basemap.geojson`, 'utf8'));
  const buildingOutlines = JSON.parse(
    await readFile(`.cache/atlas/${cityId}/building-outlines.geojson`, 'utf8'),
  );
  const aux = JSON.parse(await readFile(`data/aux/${cityId}.json`, 'utf8'));
  let areaMarkerIds = [];
  try {
    areaMarkerIds =
      JSON.parse(await readFile(`data/translations/${cityId}/landmark-area-markers.json`, 'utf8'))
        .osmIds ?? [];
  } catch {}
  const ids = new Set();
  await checkSplitCity(cityId, data, langs);
  assert(data.length > 0 || config.allowEmpty, `${cityId}: empty collection`);
  assert.equal(geo.type, 'FeatureCollection', `${cityId}: basemap type`);
  assert(geo.features.length > 0, `${cityId}: empty basemap`);
  let photos = 0,
    previews = 0,
    withPhotos = 0,
    galleries = 0,
    withPlaceId = 0;
  assert.equal(buildingOutlines.type, 'FeatureCollection', `${cityId}: outlines type`);
  assert(
    geo.features.every((feature) => feature.properties?.kind !== 'building'),
    'Ordinary buildings must be separate from basemap',
  );
  assert(
    buildingOutlines.features.every((feature) => feature.properties?.kind === 'building'),
    'Building outlines file contains another feature kind',
  );
  for (const feature of geo.features.filter((feature) => feature.properties?.kind === 'landmark')) {
    const names = feature.properties?.names ?? {},
      filled = langs.filter((lang) => typeof names[lang] === 'string' && names[lang].trim());
    if (!filled.length) continue;
    assert.equal(
      filled.length,
      4,
      `${feature.properties?.osmId}: landmark names must contain ru, en, ka and uk`,
    );
    for (const lang of ['ru', 'uk'])
      assert(
        names[lang][0] === names[lang][0].toUpperCase(),
        `${feature.properties?.osmId}: ${lang} landmark name must start with a capital letter`,
      );
  }
  for (const osmId of areaMarkerIds)
    assert(
      geo.features.some(
        (feature) =>
          feature.properties?.kind === 'landmark' &&
          feature.properties?.osmId === osmId &&
          feature.geometry?.type === 'Point',
      ),
      `${osmId}: area landmark marker has no synthetic point in the basemap`,
    );
  // Road labels must not regress to the mechanical Georgian transliteration:
  // "…ис" plus a Roman numeral before the street type, or a bare "III тупик".
  const mechanicalRoadName =
    /[а-яё-]*ис\s+(?:I|II|III|IV|V)\s+(?:улица|переулок|тупик|проезд|проспект|площадь|мост|подъём|шоссе)\b/i;
  const romanRoadOrdinal = /\b(?:I|II|III|IV|V)\s+(?:улица|переулок|тупик|проезд)\b/;
  for (const feature of geo.features) {
    const props = feature.properties ?? {};
    if (props.kind !== 'road') continue;
    const name = typeof props.name === 'string' ? props.name : '';
    assert(
      !mechanicalRoadName.test(name),
      `${props.osmId}: mechanical transliteration in road name "${name}"`,
    );
    assert(
      !romanRoadOrdinal.test(name),
      `${props.osmId}: Roman numeral instead of an ordinal in "${name}"`,
    );
    if (props.nameSource === 'ka')
      assert(
        /[\u10a0-\u10ff]/.test(props.names?.ru ?? ''),
        `${props.osmId}: Georgian fallback must keep the Georgian name`,
      );
  }
  const coverage = assertRoadCoverage(cityId, geo, data);
  const progress = new Progress(data.length, { label: `check ${cityId} atlas cards` });
  const verifiedPhotos = new Set();
  function webpSize(bytes, label) {
    const chunk = bytes.subarray(12, 16).toString('ascii');
    if (chunk === 'VP8X')
      return { width: 1 + bytes.readUIntLE(24, 3), height: 1 + bytes.readUIntLE(27, 3) };
    if (chunk === 'VP8 ') {
      assert(
        bytes[23] === 0x9d && bytes[24] === 0x01 && bytes[25] === 0x2a,
        `${label}: invalid VP8 frame header`,
      );
      return { width: bytes.readUInt16LE(26) & 0x3fff, height: bytes.readUInt16LE(28) & 0x3fff };
    }
    if (chunk === 'VP8L') {
      assert(bytes[20] === 0x2f, `${label}: invalid VP8L header`);
      const bits = bytes.readUInt32LE(21);
      return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
    }
    throw new Error(`${label}: unknown WebP chunk ${chunk}`);
  }
  progress.start();
  for (const b of data) {
    assert(b.cityId === cityId, `${b.id}: cityId ${b.cityId} does not match ${cityId}`);
    assert(!ids.has(b.id), `duplicate id: ${b.id}`);
    ids.add(b.id);
    for (const k of ['name', 'district', 'yearLabel', 'style', 'source', 'geometryQuality'])
      assert(typeof b[k] === 'string' && b[k].trim(), `${b.id}: ${k}`);
    assert(typeof b.description === 'string', `${b.id}: description`);
    assert(
      typeof b.type === 'string' && Object.hasOwn(aux.types, b.type),
      `${b.id}: unknown building type`,
    );
    assert(
      b.typeLabels &&
        langs.every((lang) => typeof b.typeLabels[lang] === 'string' && b.typeLabels[lang].trim()),
      `${b.id}: translated building type`,
    );
    if (b.geometryQualityTranslations)
      assert(
        langs
          .filter((lang) => lang !== 'ru')
          .every(
            (lang) =>
              typeof b.geometryQualityTranslations[lang] === 'string' &&
              b.geometryQualityTranslations[lang].trim(),
          ),
        `${b.id}: translated geometry quality`,
      );
    assert(
      typeof b.address === 'string' &&
        b.address === b.addresses?.ru &&
        b.addresses &&
        langs.every((lang) => typeof b.addresses[lang] === 'string'),
      `${b.id}: translated addresses`,
    );
    assert(
      langs.every((lang) => b.addresses[lang] === '' || b.addresses[lang].trim()),
      `${b.id}: invalid empty address`,
    );
    if (b.googlePlaceId) {
      assert(
        typeof b.googlePlaceId === 'string' && /^[A-Za-z0-9_-]{10,}$/.test(b.googlePlaceId),
        `${b.id}: invalid googlePlaceId`,
      );
      withPlaceId++;
    } else {
      assert(
        typeof b.addresses?.en === 'string' && b.addresses.en.trim(),
        `${b.id}: needs googlePlaceId or a non-empty English address for the Google Maps link`,
      );
    }
    assert(typeof b.history === 'string', `${b.id}: history`);
    const editorialGarbage = [
      /архитектор[^.!?]{0,80}(?:не установлен|неизвестен)/i,
      /(?:автор|зодчий)[^.!?]{0,60}(?:не установлен|неизвестен)/i,
      /(?:architect|author|designer)[^.!?]{0,80}(?:not (?:been )?established|unknown)/i,
      /(?:არქიტექტორ|ავტორ)[^.!?]{0,80}(?:დადგენილი არ არის|არ არის დადგენილი|უცნობია)/,
      /(?:архітектор|автор)[^.!?]{0,80}(?:не встановлен|невідом)/i,
      /требу(?:ет|ют)\s+(?:проверк|сверк|уточнен|подтвержд|редактур|нейтральн)/i,
      /в\s+карточке\s+(?:принят|оставлен|взят|дан|ошибочна)/i,
      /расхождени[^.!?]{0,40}сохранены/i,
      /конфликт[^.!?]{0,40}не\s+разрешён/i,
      /до\s+уточнения\s+сохран/i,
    ];
    for (const field of ['descriptions', 'histories']) {
      for (const [lang, text] of Object.entries(b[field] ?? {})) {
        if (typeof text !== 'string') continue;
        for (const pattern of editorialGarbage)
          assert(
            !pattern.test(text),
            `${b.id}: ${field}.${lang} contains editorial garbage ${pattern}`,
          );
      }
    }
    assert(
      Array.isArray(b.styleIds) &&
        b.styleIds.length > 0 &&
        b.styleIds.every((id) => typeof id === 'string' && id.trim()) &&
        b.styles &&
        langs.every((lang) => typeof b.styles[lang] === 'string' && b.styles[lang].trim()),
      `${b.id}: translated style`,
    );
    assert(
      typeof b.districtId === 'string' &&
        b.districts &&
        langs.every((lang) => typeof b.districts[lang] === 'string' && b.districts[lang].trim()),
      `${b.id}: translated district`,
    );
    assert(
      Array.isArray(b.architectIds) &&
        b.architectIds.length === b.architects.length &&
        b.architectsByLanguage &&
        langs.every(
          (lang) =>
            Array.isArray(b.architectsByLanguage[lang]) &&
            b.architectsByLanguage[lang].length === b.architects.length &&
            b.architectsByLanguage[lang].every(Boolean),
        ),
      `${b.id}: translated architects`,
    );
    assert(
      typeof b.yearLabelId === 'string' &&
        b.yearLabels &&
        langs.every((lang) => typeof b.yearLabels[lang] === 'string' && b.yearLabels[lang].trim()),
      `${b.id}: translated construction label`,
    );
    if (b.descriptions)
      assert(
        langs.every(
          (lang) => typeof b.descriptions[lang] === 'string' && b.descriptions[lang].trim(),
        ),
        `${b.id}: translated descriptions`,
      );
    assert.equal(b.description, b.descriptions?.ru ?? '', `${b.id}: Russian description fallback`);
    if (b.histories) {
      assert(
        langs.every((lang) => typeof b.histories[lang] === 'string' && b.histories[lang].trim()),
        `${b.id}: translated history`,
      );
      assert.equal(b.history, b.histories.ru, `${b.id}: Russian history fallback`);
    } else
      assert.equal(b.history, '', `${b.id}: history should be empty when translations are absent`);
    assert(
      b.names && langs.every((lang) => typeof b.names[lang] === 'string' && b.names[lang].trim()),
      `${b.id}: localized names`,
    );
    assert(Array.isArray(b.architects), `${b.id}: architects`);
    assert(
      Array.isArray(b.coordinates) &&
        b.coordinates.length === 2 &&
        b.coordinates[0] >= config.map.bounds.west &&
        b.coordinates[0] <= config.map.bounds.east &&
        b.coordinates[1] >= config.map.bounds.south &&
        b.coordinates[1] <= config.map.bounds.north,
      `${b.id}: coordinates`,
    );
    assert(
      (b.minYear === null && b.maxYear === null) ||
        (Number.isInteger(b.minYear) && Number.isInteger(b.maxYear) && b.minYear <= b.maxYear),
      `${b.id}: years`,
    );
    assert(
      (b.yearLabelId === 'unknown') === (b.minYear === null),
      `${b.id}: construction label and numeric years disagree`,
    );
    assert(
      b.geometry && ['Polygon', 'MultiPolygon'].includes(b.geometry.type),
      `${b.id}: missing outline`,
    );
    if (b.geometryRole !== undefined) {
      assert(
        [
          'above_ground',
          'heritage_boundary',
          'complex_underground',
          'neighbor_wrong_candidate',
          'historic_plan',
          'visible_domes',
          'unknown',
        ].includes(b.geometryRole),
        `${b.id}: invalid geometryRole`,
      );
    }
    if (b.geometryRole === 'heritage_boundary')
      assert(
        Array.isArray(b.geometryVariants) && b.geometryVariants.length > 0,
        `${b.id}: heritage boundary requires geometryVariants`,
      );
    if (b.geometryVariants !== undefined) {
      assert(Array.isArray(b.geometryVariants), `${b.id}: geometryVariants must be an array`);
      for (const variant of b.geometryVariants) {
        assert(
          [
            'above_ground',
            'heritage_boundary',
            'complex_underground',
            'neighbor_wrong_candidate',
            'historic_plan',
            'visible_domes',
            'unknown',
          ].includes(variant.role),
          `${b.id}: invalid variant role`,
        );
        assert(
          variant.geometry && ['Polygon', 'MultiPolygon'].includes(variant.geometry.type),
          `${b.id}: variant missing outline`,
        );
      }
    }
    const images = b.photos ?? (b.photo ? [b.photo] : []);
    assert(Array.isArray(images), `${b.id}: photos`);
    if (images.length) withPhotos++;
    if (images.length > 1) galleries++;
    const paths = new Set();
    for (const p of images) {
      for (const k of ['id', 'file', 'thumb', 'card', 'licenseUrl', 'source', 'modifications'])
        assert(p[k], `${b.id}: photo.${k}`);
      for (const k of ['author', 'license'])
        assert(typeof p[k] === 'string', `${b.id}: photo.${k} must be a string`);
      for (const k of ['author', 'license'])
        assert(
          !p[k] || !/[^\p{Script=Latin}\p{Script=Common}\p{Script=Inherited}]/u.test(p[k]),
          `${b.id}: photo.${k} must be Latin script and English wording`,
        );
      for (const k of ['width', 'height'])
        assert(
          Number.isInteger(p[k]) && p[k] > 0,
          `${b.id}: photo.${k} must be a positive integer`,
        );
      assert(
        Number.isInteger(p.rating) && p.rating >= 0 && p.rating <= 100,
        `${b.id}: photo.rating must be an integer from 0 to 100`,
      );
      for (const k of ['sourceTags', 'visualTags', 'tags'])
        if (p[k] !== undefined)
          assert(
            Array.isArray(p[k]) &&
              p[k].length > 0 &&
              p[k].every((tag) => typeof tag === 'string' && tag.trim()) &&
              new Set(p[k]).size === p[k].length,
            `${b.id}: photo.${k} must be a non-empty array of unique strings`,
          );
      if (p.visualTags)
        for (const tag of p.visualTags)
          assert(visualTagIds.has(tag), `${b.id}: unknown visual tag ${tag}`);
      if (p.descriptions !== undefined)
        assert(
          Object.keys(p.descriptions).length === langs.length &&
            langs.every(
              (lang) => typeof p.descriptions[lang] === 'string' && p.descriptions[lang].trim(),
            ),
          `${b.id}: photo.descriptions must contain non-empty ${langs.join('/')}`,
        );
      assert(/^[a-f0-9]{64}$/.test(p.id), `${b.id}: photo id must be a lowercase sha256`);
      const expectedFile = `photos/${cityId}/${p.id}.webp`;
      const expectedThumb = `thumbnails/${cityId}/${p.id}.webp`;
      const expectedCard = `cards/${cityId}/${p.id}.webp`;
      assert(p.file === expectedFile, `${b.id}: photo file must match ${expectedFile}`);
      assert(p.thumb === expectedThumb, `${b.id}: photo preview must match ${expectedThumb}`);
      assert(p.card === expectedCard, `${b.id}: photo card must match ${expectedCard}`);
      for (const file of [p.file, p.thumb, p.card]) {
        assert(
          !file.includes('..') && !file.startsWith('/') && !paths.has(file),
          `${b.id}: invalid or duplicate photo path`,
        );
        paths.add(file);
      }
      if (!verifiedPhotos.has(p.id)) {
        const source = 'data/' + p.file,
          published = 'public/atlas/' + p.file;
        const sidecar = `data/photos/${cityId}/${p.id}.metadata.json`;
        await access(source);
        await access(published);
        await access(sidecar);
        const metadata = JSON.parse(await readFile(sidecar, 'utf8'));
        for (const k of ['author', 'license', 'licenseUrl', 'source', 'modifications'])
          assert(metadata[k] === p[k], `${b.id}: photo metadata ${k} differs from sidecar`);
        for (const k of ['width', 'height'])
          assert(metadata[k] === p[k], `${b.id}: photo metadata ${k} differs from sidecar`);
        assert(metadata.rating === p.rating, `${b.id}: photo metadata rating differs from sidecar`);
        for (const k of ['sourceTags', 'visualTags', 'tags'])
          assert(
            JSON.stringify(metadata[k]) === JSON.stringify(p[k]),
            `${b.id}: photo metadata ${k} differs from sidecar`,
          );
        assert(
          JSON.stringify(metadata.descriptions) === JSON.stringify(p.descriptions),
          `${b.id}: photo metadata descriptions differ from sidecar`,
        );
        for (const path of [source, published]) {
          const bytes = await readFile(path);
          assert(
            bytes.length > 32 &&
              bytes.subarray(0, 4).toString() === 'RIFF' &&
              bytes.subarray(8, 12).toString() === 'WEBP',
            `${b.id}: invalid photo file ${path}`,
          );
          assert(
            createHash('sha256').update(bytes).digest('hex') === p.id,
            `${b.id}: photo content does not match its sha256 name ${path}`,
          );
          const size = webpSize(bytes, path);
          assert(
            size.width === p.width && size.height === p.height,
            `${b.id}: photo ${path} is ${size.width}x${size.height}, metadata says ${p.width}x${p.height}`,
          );
        }
        for (const preview of [p.thumb, p.card]) {
          const source = 'data/' + preview,
            published = 'public/atlas/' + preview;
          await access(source);
          await access(published);
          for (const path of [source, published]) {
            const bytes = await readFile(path);
            assert(
              bytes.length > 32 &&
                bytes.subarray(0, 4).toString() === 'RIFF' &&
                bytes.subarray(8, 12).toString() === 'WEBP',
              `${b.id}: invalid photo preview ${path}`,
            );
          }
        }
        verifiedPhotos.add(p.id);
      }
      photos++;
      previews++;
    }
    progress.advance(b.id);
  }
  progress.finish();
  console.log(
    `[${cityId}] Validated ${ids.size} buildings with outlines; ${photos} photos (${previews} previews), ${withPhotos} buildings with photos, ${galleries} with multiple photos; Google Place ID: ${withPlaceId}/${ids.size}, ${ids.size - withPlaceId} by address search; ${geo.features.length} basemap features and ${buildingOutlines.features.length} optional building outlines; road coverage: ${coverage ? `${coverage.farthest.distance.toFixed(0)} m max of ${coverage.count} points` : 'no roads'}.`,
  );
}

const explicit = process.argv.find((value) => value.startsWith('--city='))?.slice('--city='.length);
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
  for (const city of selected) await checkCity(city.id);
}

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { assembleAtlas, hydrateCard, splitAtlas } from '../scripts/assemble-atlas.mjs';

const labels = (ru, en, ka, uk) => ({ ru, en, ka, uk });

function attributes() {
  return {
    styles: { 'art-nouveau': { labels: labels('Модерн', 'Art Nouveau', 'არტ ნუვო', 'Модерн') } },
    yearLabels: { 'year-1905': { labels: labels('1905 год', '1905', '1905', '1905') } },
    districts: { sololaki: { labels: labels('Сололаки', 'Sololaki', 'სოლოლაკი', 'Сололакі') } },
    architects: { saar: { labels: labels('Карл Заар', 'Karl Saar', 'კარლ ზაარი', 'Карл Заар') } },
    types: { residential: { labels: labels('Жилой', 'Residential', 'საცხოვრებელი', 'Житловий') } },
  };
}

function card(id, overrides = {}) {
  return {
    id,
    osmId: `way/${id.split('-').at(-1)}`,
    names: labels('Дом', 'House', 'სახლი', 'Будинок'),
    originalLanguage: 'ka',
    addresses: labels('улица 1', '1 Street', 'ქუჩა 1', 'вулиця 1'),
    descriptions: labels('Описание', 'Description', 'აღწერა', 'Опис'),
    histories: labels('История', 'History', 'ისტორია', 'Історія'),
    minYear: 1905,
    maxYear: 1905,
    yearLabelId: 'year-1905',
    styleIds: ['art-nouveau'],
    architectIds: ['saar'],
    districtId: 'sololaki',
    type: 'residential',
    coordinates: [44.8, 41.7],
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [44.8, 41.7],
          [44.81, 41.7],
          [44.81, 41.71],
          [44.8, 41.7],
        ],
      ],
    },
    geometryQuality: 'тестовый контур',
    photos: [],
    source: `https://example.com/${id}`,
    ...overrides,
  };
}

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'atlas-assemble-'));
  await mkdir(path.join(root, 'data', 'atlas', 'tbilisi'), { recursive: true });
  await mkdir(path.join(root, 'data', 'aux', 'tbilisi'), { recursive: true });
  const tables = attributes();
  for (const [file, table] of [
    ['styles.json', 'styles'],
    ['architects.json', 'architects'],
    ['districts.json', 'districts'],
    ['year-labels.json', 'yearLabels'],
    ['types.json', 'types'],
  ]) {
    await writeFile(path.join(root, 'data', 'aux', 'tbilisi', file), JSON.stringify(tables[table]));
  }
  return root;
}

async function writeCard(root, name, value) {
  await writeFile(path.join(root, 'data', 'atlas', 'tbilisi', name), JSON.stringify(value));
}

test('packs cards in filename order and resolves reference labels', async () => {
  const root = await fixture();
  try {
    await writeCard(
      root,
      'osm-2.json',
      card('osm-2', { histories: undefined, architectIds: [], minYear: null, maxYear: null }),
    );
    await writeCard(root, 'osm-1.json', card('osm-1'));
    const outFile = path.join(root, 'public', 'atlas', 'buildings.json');
    const { cards } = await assembleAtlas({ root, outFile, quiet: true });
    assert.deepEqual(
      cards.map((item) => item.id),
      ['osm-1', 'osm-2'],
    );

    const first = cards[0];
    assert.equal(first.name, 'Дом');
    assert.equal(first.nameKa, 'სახლი');
    assert.equal(first.address, 'улица 1');
    assert.equal(first.district, 'Сололаки');
    assert.equal(first.type, 'residential');
    assert.deepEqual(first.typeLabels, labels('Жилой', 'Residential', 'საცხოვრებელი', 'Житловий'));
    assert.equal(first.style, 'Модерн');
    assert.equal(first.yearLabel, '1905 год');
    assert.deepEqual(first.architects, ['Карл Заар']);
    assert.deepEqual(first.architectsByLanguage, {
      ru: ['Карл Заар'],
      en: ['Karl Saar'],
      ka: ['კარლ ზაარი'],
      uk: ['Карл Заар'],
    });
    assert.equal(first.history, 'История');
    assert.deepEqual(first.histories, labels('История', 'History', 'ისტორია', 'Історія'));
    assert.deepEqual(first.styles, labels('Модерн', 'Art Nouveau', 'არტ ნუვო', 'Модерн'));

    const second = cards[1];
    assert.equal(second.history, '');
    assert.equal('histories' in second, false);
    assert.deepEqual(second.architects, []);
    assert.equal(second.minYear, null);

    const written = JSON.parse(await readFile(outFile, 'utf8'));
    assert.equal(written.length, 2);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('rejects a filename that does not match the card id', async () => {
  const root = await fixture();
  try {
    await writeCard(root, 'osm-1.json', card('osm-2'));
    await assert.rejects(
      () => assembleAtlas({ root, outFile: path.join(root, 'out.json'), quiet: true }),
      /does not match filename/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('rejects an unknown building type reference', async () => {
  const root = await fixture();
  try {
    await writeCard(root, 'osm-1.json', card('osm-1', { type: 'missing-type' }));
    await assert.rejects(
      () => assembleAtlas({ root, outFile: path.join(root, 'out.json'), quiet: true }),
      /unknown type reference/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('rejects unknown style and architect references', async () => {
  const root = await fixture();
  try {
    await writeCard(root, 'osm-1.json', card('osm-1', { styleIds: ['missing-style'] }));
    await assert.rejects(
      () => assembleAtlas({ root, outFile: path.join(root, 'out.json'), quiet: true }),
      /unknown style reference/,
    );
    await writeCard(root, 'osm-1.json', card('osm-1', { architectIds: ['missing-architect'] }));
    await assert.rejects(
      () => assembleAtlas({ root, outFile: path.join(root, 'out.json'), quiet: true }),
      /unknown architectIds\[0\] reference/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('rejects missing translations and invalid geometry', async () => {
  const root = await fixture();
  try {
    await writeCard(root, 'osm-1.json', card('osm-1', { names: { ru: 'Дом' } }));
    await assert.rejects(
      () => assembleAtlas({ root, outFile: path.join(root, 'out.json'), quiet: true }),
      /names must contain exactly/,
    );
    await writeCard(
      root,
      'osm-1.json',
      card('osm-1', { geometry: { type: 'Point', coordinates: [44.8, 41.7] } }),
    );
    await assert.rejects(
      () => assembleAtlas({ root, outFile: path.join(root, 'out.json'), quiet: true }),
      /geometry must be a Polygon/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('hydrates translated geometry quality notes', () => {
  const translations = { en: 'Test outline', ka: 'სატესტო კონტური', uk: 'Тестовий контур' };
  const out = hydrateCard(
    card('osm-2', { geometryQualityTranslations: translations }),
    attributes(),
  );
  assert.deepEqual(out.geometryQualityTranslations, translations);
  assert.equal(out.geometryQuality, 'тестовый контур');
});

test('rejects incomplete geometry quality translations', () => {
  assert.throws(
    () =>
      hydrateCard(
        card('osm-2', { geometryQualityTranslations: { en: 'Test outline' } }),
        attributes(),
      ),
    /geometryQualityTranslations must contain exactly en\/ka\/uk/,
  );
});

test('hydrateCard keeps an empty history out of the bundle', () => {
  const out = hydrateCard(card('osm-3', { histories: undefined }), attributes());
  assert.equal(out.history, '');
  assert.equal('histories' in out, false);
});

test('hydrateCard keeps a missing description out of the bundle', () => {
  const out = hydrateCard(card('osm-4', { descriptions: undefined }), attributes());
  assert.equal(out.description, '');
  assert.equal('descriptions' in out, false);
});

test('rejects an empty description when descriptions are present', () => {
  assert.throws(
    () => hydrateCard(card('osm-5', { descriptions: labels('', '', '', '') }), attributes()),
    /descriptions\.ru/,
  );
});

async function writePhoto(root, id, metadata) {
  await mkdir(path.join(root, 'data', 'photos', 'tbilisi'), { recursive: true });
  await writeFile(
    path.join(root, 'data', 'photos', 'tbilisi', `${id}.metadata.json`),
    JSON.stringify(metadata),
  );
}

test('hydrates ordered sha256 photo ids from metadata sidecars', async () => {
  const root = await fixture();
  const first = 'a'.repeat(64),
    second = 'b'.repeat(64);
  const metadata = {
    author: 'A',
    license: 'CC BY 4.0',
    licenseUrl: 'https://example.com/license',
    source: 'https://example.com/photo',
    modifications: 'resized',
    width: 1600,
    height: 1200,
    rating: 87,
    sourceTags: ['Facades', 'Tbilisi'],
    visualTags: ['facade', 'balcony'],
  };
  try {
    await writePhoto(root, first, metadata);
    await writePhoto(root, second, {
      ...metadata,
      author: 'B',
      descriptions: labels('фасад', 'facade', 'ფასადი', 'фасад'),
    });
    await writeCard(root, 'osm-1.json', card('osm-1', { photos: [second, first] }));
    const { cards } = await assembleAtlas({
      root,
      outFile: path.join(root, 'out.json'),
      quiet: true,
    });
    assert.deepEqual(
      cards[0].photos.map((photo) => photo.id),
      [second, first],
    );
    assert.equal(cards[0].photos[0].file, `photos/tbilisi/${second}.webp`);
    assert.equal(cards[0].photos[0].thumb, `thumbnails/tbilisi/${second}.webp`);
    assert.equal(cards[0].photos[0].card, `cards/tbilisi/${second}.webp`);
    assert.equal(cards[0].photos[0].author, 'B');
    assert.deepEqual(cards[0].photos[0].descriptions, labels('фасад', 'facade', 'ფასადი', 'фасад'));
    assert.equal(cards[0].photos[0].width, 1600);
    assert.equal(cards[0].photos[0].height, 1200);
    assert.equal(cards[0].photos[0].rating, 87);
    assert.deepEqual(cards[0].photos[0].sourceTags, ['Facades', 'Tbilisi']);
    assert.deepEqual(cards[0].photos[0].visualTags, ['facade', 'balcony']);

    await writePhoto(root, first, { ...metadata, visualTags: ['facade', 'facade'] });
    await writeCard(root, 'osm-1.json', card('osm-1', { photos: [first] }));
    await assert.rejects(
      () => assembleAtlas({ root, outFile: path.join(root, 'out.json'), quiet: true }),
      /must not contain duplicates/,
    );

    await writePhoto(root, first, { ...metadata, width: 0 });
    await writeCard(root, 'osm-1.json', card('osm-1', { photos: [first] }));
    await assert.rejects(
      () => assembleAtlas({ root, outFile: path.join(root, 'out.json'), quiet: true }),
      /width must be a positive integer/,
    );

    await writePhoto(root, first, { ...metadata, rating: 101 });
    await writeCard(root, 'osm-1.json', card('osm-1', { photos: [first] }));
    await assert.rejects(
      () => assembleAtlas({ root, outFile: path.join(root, 'out.json'), quiet: true }),
      /rating must be an integer from 0 to 100/,
    );

    await writePhoto(root, first, metadata);
    await writeCard(root, 'osm-1.json', card('osm-1', { photos: ['1'] }));
    await assert.rejects(
      () => assembleAtlas({ root, outFile: path.join(root, 'out.json'), quiet: true }),
      /lowercase sha256 photo id/,
    );
    await writeCard(root, 'osm-1.json', card('osm-1', { photos: ['c'.repeat(64)] }));
    await assert.rejects(
      () => assembleAtlas({ root, outFile: path.join(root, 'out.json'), quiet: true }),
      /references missing/,
    );
    await writeCard(root, 'osm-1.json', card('osm-1', { photos: [first, first] }));
    await assert.rejects(
      () => assembleAtlas({ root, outFile: path.join(root, 'out.json'), quiet: true }),
      /duplicate photo/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('allows empty attribution and rejects non-Latin text', async () => {
  const root = await fixture();
  const id = 'e'.repeat(64);
  const metadata = {
    author: '',
    license: '',
    licenseUrl: 'https://example.com/license',
    source: 'https://example.com/photo',
    modifications: 'resized',
    width: 1600,
    height: 1200,
    rating: 87,
  };
  try {
    await writePhoto(root, id, metadata);
    await writeCard(root, 'osm-1.json', card('osm-1', { photos: [id] }));
    const { cards } = await assembleAtlas({
      root,
      outFile: path.join(root, 'out.json'),
      quiet: true,
    });
    assert.equal(cards[0].photos[0].author, '');
    assert.equal(cards[0].photos[0].license, '');
    await writePhoto(root, id, {
      ...metadata,
      author: 'Реестр памятников Грузии (автор не указан)',
    });
    await assert.rejects(
      () => assembleAtlas({ root, outFile: path.join(root, 'out.json'), quiet: true }),
      /author must be Latin script/,
    );
    await writePhoto(root, id, { ...metadata, license: 'Не установлена' });
    await assert.rejects(
      () => assembleAtlas({ root, outFile: path.join(root, 'out.json'), quiet: true }),
      /license must be Latin script/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('requires photo captions in all four languages and rejects the legacy field', async () => {
  const root = await fixture();
  const id = 'd'.repeat(64);
  const metadata = {
    author: 'A',
    license: 'CC BY 4.0',
    licenseUrl: 'https://example.com/license',
    source: 'https://example.com/photo',
    modifications: 'resized',
    width: 1600,
    height: 1200,
    rating: 87,
  };
  try {
    await writePhoto(root, id, {
      ...metadata,
      descriptions: { ru: 'фасад', en: 'facade', ka: 'ფასადი' },
    });
    await writeCard(root, 'osm-1.json', card('osm-1', { photos: [id] }));
    await assert.rejects(
      () => assembleAtlas({ root, outFile: path.join(root, 'out.json'), quiet: true }),
      /descriptions must contain exactly ru\/en\/ka\/uk/,
    );
    await writePhoto(root, id, {
      ...metadata,
      descriptions: { ru: 'фасад', en: '', ka: 'ფასადი', uk: 'фасад' },
    });
    await assert.rejects(
      () => assembleAtlas({ root, outFile: path.join(root, 'out.json'), quiet: true }),
      /descriptions\.en/,
    );
    await writePhoto(root, id, { ...metadata, description: 'фасад' });
    await assert.rejects(
      () => assembleAtlas({ root, outFile: path.join(root, 'out.json'), quiet: true }),
      /unknown photo metadata fields: description/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('packs an empty city only when the registry allows it', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'atlas-empty-'));
  try {
    const city = 'empty-city';
    await mkdir(path.join(root, 'data', 'atlas', city), { recursive: true });
    await mkdir(path.join(root, 'data', 'aux', city), { recursive: true });
    await mkdir(path.join(root, 'data', 'photos', city), { recursive: true });
    for (const name of ['styles', 'architects', 'districts', 'year-labels', 'types'])
      await writeFile(path.join(root, 'data', 'aux', city, `${name}.json`), '{}');
    const outFile = path.join(root, 'out.json');
    await assert.rejects(
      () => assembleAtlas({ root, city, outFile, quiet: true }),
      /no atlas objects found/,
    );
    const result = await assembleAtlas({ root, city, outFile, quiet: true, allowEmpty: true });
    assert.deepEqual(result.cards, []);
    assert.deepEqual(JSON.parse(await readFile(outFile, 'utf8')), []);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('hydrated cards carry the city id', async () => {
  const root = await fixture();
  try {
    await writeCard(root, 'osm-1.json', card('osm-1'));
    const { cards } = await assembleAtlas({
      root,
      outFile: path.join(root, 'out.json'),
      quiet: true,
    });
    assert.equal(cards[0].cityId, 'tbilisi');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('hydrates a Serbian city from its city language set', () => {
  const sr = (ru, en, uk, value) => ({ ru, en, uk, sr: value });
  const attributes = {
    styles: { modern: { labels: sr('Модерн', 'Modern', 'Модерн', 'Модерна') } },
    yearLabels: { 'year-2000': { labels: sr('2000', '2000', '2000', '2000') } },
    districts: { centre: { labels: sr('Центр', 'Centre', 'Центр', 'Центар') } },
    architects: { author: { labels: sr('Автор', 'Author', 'Автор', 'Аутор') } },
    types: { public: { labels: sr('Общественный', 'Public', 'Громадський', 'Јавни') } },
  };
  const out = hydrateCard(
    card('osm-sr', {
      names: sr('Дом', 'House', 'Будинок', 'Кућа'),
      addresses: sr('Улица 1', '1 Street', 'Вулиця 1', 'Улица 1'),
      descriptions: sr('Описание', 'Description', 'Опис', 'Опис'),
      histories: sr('История', 'History', 'Історія', 'Историја'),
      yearLabelId: 'year-2000',
      styleIds: ['modern'],
      architectIds: ['author'],
      districtId: 'centre',
      type: 'public',
      coordinates: [20.46, 44.81],
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [20.46, 44.81],
            [20.461, 44.81],
            [20.461, 44.811],
            [20.46, 44.81],
          ],
        ],
      },
    }),
    attributes,
    'serbian-card',
    'belgrade',
    new Map(),
    null,
    ['ru', 'en', 'uk', 'sr'],
  );
  assert.equal(out.name, 'Дом');
  assert.equal(out.nameSr, 'Кућа');
  assert.equal(out.nameKa, '');
  assert.deepEqual(Object.keys(out.names), ['ru', 'en', 'uk', 'sr']);
  assert.deepEqual(out.architectsByLanguage, {
    ru: ['Автор'],
    en: ['Author'],
    uk: ['Автор'],
    sr: ['Аутор'],
  });
  assert.equal(out.districts.sr, 'Центар');
  assert.equal(out.typeLabels.sr, 'Јавни');
});

test('splitAtlas keeps long text and photo credits out of the core', () => {
  const item = {
    id: 'split-1',
    cityId: 'tbilisi',
    names: labels('Дом', 'House', 'სახლი', 'Будинок'),
    addresses: labels('улица 1', '1 Street', 'ქუჩა 1', 'вулиця 1'),
    districtId: 'sololaki',
    districts: labels('Сололаки', 'Sololaki', 'სოლოლაკი', 'Сололакі'),
    type: 'residential',
    typeLabels: labels('Жилой', 'Residential', 'საცხოვრებელი', 'Житловий'),
    minYear: 1905,
    maxYear: 1905,
    yearLabelId: 'year-1905',
    yearLabels: labels('1905 год', '1905', '1905', '1905'),
    architectIds: [],
    architectsByLanguage: { ru: [], en: [], ka: [], uk: [] },
    styleIds: ['art-nouveau'],
    styles: labels('Модерн', 'Art Nouveau', 'არტ ნუვო', 'Модерн'),
    coordinates: [44.8, 41.7],
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [44.8, 41.7],
          [44.81, 41.7],
          [44.81, 41.71],
          [44.8, 41.7],
        ],
      ],
    },
    photos: [
      {
        id: 'photo-1',
        file: 'photos/tbilisi/photo-1.webp',
        thumb: 'thumbnails/tbilisi/photo-1.webp',
        card: 'cards/tbilisi/photo-1.webp',
        author: 'Author',
        license: 'CC0',
        licenseUrl: 'https://example.com/license',
        source: 'https://example.com/photo',
        modifications: 'resized',
        width: 1200,
        height: 800,
        rating: 70,
        tags: ['stamp'],
      },
    ],
    source: 'https://example.com/card',
    descriptions: labels('Описание', 'Description', 'აღწერა', 'Опис'),
    histories: labels('История', '', '', ''),
    geometryQuality: 'тестовый контур',
  };
  const split = splitAtlas([item], ['ru', 'en', 'uk', 'ka']);
  const core = split.core[0];
  assert.equal(core.hasStory, true);
  assert.equal('description' in core, false);
  assert.equal('history' in core, false);
  assert.equal('geometryQuality' in core, false);
  assert.equal('descriptions' in core, false);
  assert.deepEqual(core.photos, [
    {
      id: 'photo-1',
      file: 'photos/tbilisi/photo-1.webp',
      thumb: 'thumbnails/tbilisi/photo-1.webp',
      card: 'cards/tbilisi/photo-1.webp',
      rating: 70,
      tags: ['stamp'],
    },
  ]);
  assert.equal(split.details.ru[0].description, 'Описание');
  assert.equal(split.details.en[0].description, 'Description');
  assert.equal(split.details.en[0].history, '');
  assert.equal(split.details.ka[0].description, 'აღწერა');
  assert.equal(split.credits.length, 1);
  assert.equal(split.credits[0].author, 'Author');
  assert.equal('author' in core.photos[0], false);
});

test('assembleAtlas writes core, language details and credits next to the bundle', async () => {
  const root = await fixture();
  try {
    await writeCard(root, 'osm-1.json', card('osm-1'));
    const outFile = path.join(root, 'public', 'atlas', 'buildings.json');
    const output = await assembleAtlas({ root, outFile, quiet: true });
    assert.ok(output.splitFiles);
    for (const file of [
      output.splitFiles.core,
      output.splitFiles.credits,
      ...Object.values(output.splitFiles.details),
    ])
      assert.ok((await readFile(file, 'utf8')).length > 0);
    const core = JSON.parse(await readFile(output.splitFiles.core, 'utf8'));
    assert.equal(core.version, 1);
    assert.equal(core.buildings.length, 1);
    const details = JSON.parse(await readFile(output.splitFiles.details.ru, 'utf8'));
    assert.equal(details.language, 'ru');
    assert.equal(details.buildings[0].description, 'Описание');
    const credits = JSON.parse(await readFile(output.splitFiles.credits, 'utf8'));
    assert.deepEqual(credits.photos, []);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

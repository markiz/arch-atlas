import test from 'node:test';
import assert from 'node:assert/strict';
import { period, periodsFor, normalize, filterBuildings, styleEntries } from '../src/domain.js';
const empty = { query: '', from: '', to: '', architect: [], style: [] };
const data = [
  {
    id: 'old',
    name: 'Анчисхати',
    nameKa: 'ანჩისხატი',
    nameEn: 'Anchiskhati',
    address: 'Шавтели',
    district: 'Старый Тбилиси',
    style: 'Базилика',
    styleIds: ['basilica'],
    architects: [],
    architectIds: [],
    minYear: 501,
    maxYear: 600,
    osmId: 'way/78357093',
  },
  {
    id: 'uncertain',
    name: 'Дом Ёжика',
    nameKa: 'სახლი',
    nameEn: 'House',
    address: 'Тбилиси',
    addresses: { en: '13 Machabeli Street' },
    district: 'Центр',
    style: 'Модерн, Неоготика',
    styleIds: ['art-nouveau', 'neo-gothic'],
    styles: { en: 'Art Nouveau, Neo-Gothic' },
    architects: ['Заар', 'Озеров'],
    architectIds: ['saar', 'ozerov'],
    architectsByLanguage: { en: ['Karl Saar', 'Alexander Ozerov'] },
    minYear: 1895,
    maxYear: 1905,
  },
  {
    id: 'unknown',
    name: 'Дом без даты',
    nameKa: '',
    nameEn: '',
    address: '',
    district: '',
    style: 'Модерн',
    styleIds: ['art-nouveau'],
    architects: [],
    architectIds: [],
    minYear: null,
    maxYear: null,
  },
];
test('period boundaries and ranges', () => {
  assert.equal(period(1499, 1499).label, 'До 1500');
  assert.equal(period(1500, 1500).label, '1500–1800');
  assert.equal(period(1800, 1800).label, '1500–1800');
  assert.equal(period(1801, 1801).label, '1801–1860');
  assert.equal(period(1860, 1860).label, '1801–1860');
  assert.equal(period(1861, 1861).label, '1861–1899');
  assert.equal(period(1899, 1899).label, '1861–1899');
  assert.equal(period(1900, 1900).label, '1900–1920');
  assert.equal(period(1920, 1920).label, '1900–1920');
  assert.equal(period(1921, 1921).label, '1921–1932');
  assert.equal(period(1932, 1932).label, '1921–1932');
  assert.equal(period(1933, 1933).label, '1933–1954');
  assert.equal(period(1954, 1954).label, '1933–1954');
  assert.equal(period(1955, 1955).label, '1955–1990');
  assert.equal(period(1990, 1990).label, '1955–1990');
  assert.equal(period(1991, 1991).label, 'С 1991');
  assert.equal(period(null, null).label, 'Неизвестно');
});
test('primary period is taken from the middle of a broad date window', () => {
  assert.equal(period(1895, 1905).label, '1900–1920');
  assert.equal(period(1890, 1910).label, '1900–1920');
  assert.equal(period(1950, 1959).label, '1933–1954');
  assert.equal(period(1900, 1950).label, '1921–1932');
});
test('a building belongs to every period its date range overlaps', () => {
  assert.deepEqual(
    periodsFor(1895, 1905).map((p) => p.label),
    ['1861–1899', '1900–1920'],
  );
  assert.deepEqual(
    periodsFor(1850, 1991).map((p) => p.label),
    ['1801–1860', '1861–1899', '1900–1920', '1921–1932', '1933–1954', '1955–1990', 'С 1991'],
  );
  assert.deepEqual(
    periodsFor(1799, 1800).map((p) => p.label),
    ['1500–1800'],
  );
  assert.deepEqual(
    periodsFor(1800, 1801).map((p) => p.label),
    ['1500–1800', '1801–1860'],
  );
  assert.deepEqual(
    periodsFor(1900, 1900).map((p) => p.label),
    ['1900–1920'],
  );
  assert.deepEqual(
    periodsFor(1991, 2020).map((p) => p.label),
    ['С 1991'],
  );
  assert.deepEqual(
    periodsFor(null, null).map((p) => p.label),
    ['Неизвестно'],
  );
});
test('normalization and multilingual search', () => {
  assert.equal(normalize(' ЁЖИК—дом  '), 'ежик дом');
  for (const query of ['ежика заар', 'Saar Machabeli', 'Neo-Gothic House']) {
    assert.deepEqual(
      filterBuildings(data, { ...empty, query }).map((x) => x.id),
      ['uncertain'],
    );
  }
  assert.deepEqual(
    filterBuildings(data, { ...empty, query: 'ანჩისხატი' }).map((x) => x.id),
    ['old'],
  );
});
test('search by OSM identifier in common label and URL forms', () => {
  for (const query of [
    'OSM-78357093',
    'OSM 78357093',
    'OSM78357093',
    'way/78357093',
    'way 78357093',
    'way78357093',
    '78357093',
  ]) {
    assert.deepEqual(
      filterBuildings(data, { ...empty, query }).map((x) => x.id),
      ['old'],
      query,
    );
  }
  assert.deepEqual(filterBuildings(data, { ...empty, query: 'OSM-25699483' }), []);
  assert.deepEqual(
    filterBuildings(data, { ...empty, query: 'OSM-78357093 Анчисхати' }).map((x) => x.id),
    ['old'],
  );
});
test('date filter matches intersecting construction intervals including boundaries', () => {
  for (const [from, to] of [
    ['1900', '1920'],
    ['1905', '1905'],
    ['1895', '1895'],
  ]) {
    assert.deepEqual(
      filterBuildings(data, { ...empty, from, to }).map((x) => x.id),
      ['uncertain'],
    );
  }
  assert.deepEqual(filterBuildings(data, { ...empty, from: '1906' }), []);
  assert.deepEqual(
    filterBuildings(data, { ...empty, to: '600' }).map((x) => x.id),
    ['old'],
  );
});
test('unknown dates are visible without a date filter and excluded with either date bound', () => {
  assert.deepEqual(
    filterBuildings(data, empty).map((x) => x.id),
    ['old', 'uncertain', 'unknown'],
  );
  assert.deepEqual(
    filterBuildings(data, { ...empty, from: '1' }).map((x) => x.id),
    ['old', 'uncertain'],
  );
  assert.deepEqual(
    filterBuildings(data, { ...empty, to: '2100' }).map((x) => x.id),
    ['old', 'uncertain'],
  );
});
test('inverted and invalid date intervals return no buildings', () => {
  for (const range of [{ from: '600', to: '500' }, { from: 'invalid' }, { to: 'invalid' }]) {
    assert.deepEqual(filterBuildings(data, { ...empty, ...range }), []);
  }
});
test('architect IDs, style IDs and query combine across filters', () => {
  const filters = { ...empty, architect: ['saar'], style: ['art-nouveau'], query: 'дом' };
  assert.deepEqual(
    filterBuildings(data, filters).map((x) => x.id),
    ['uncertain'],
  );
  assert.deepEqual(filterBuildings(data, { ...filters, style: ['basilica'] }), []);
  assert.deepEqual(filterBuildings(data, { ...filters, query: 'Анчисхати' }), []);
});
test('architect selection matches any selected ID including unknown authors', () => {
  assert.deepEqual(
    filterBuildings(data, { ...empty, architect: ['missing', 'ozerov'] }).map((x) => x.id),
    ['uncertain'],
  );
  assert.deepEqual(
    filterBuildings(data, { ...empty, architect: ['unknown'] }).map((x) => x.id),
    ['old', 'unknown'],
  );
  assert.deepEqual(
    filterBuildings(data, { ...empty, architect: ['unknown', 'saar'] }).map((x) => x.id),
    ['old', 'uncertain', 'unknown'],
  );
  assert.deepEqual(filterBuildings(data, { ...empty, architect: ['missing'] }), []);
});
test('style selection matches individual components and any selected style ID', () => {
  assert.deepEqual(
    filterBuildings(data, { ...empty, style: ['art-nouveau'] }).map((x) => x.id),
    ['uncertain', 'unknown'],
  );
  assert.deepEqual(
    filterBuildings(data, { ...empty, style: ['neo-gothic'] }).map((x) => x.id),
    ['uncertain'],
  );
  assert.deepEqual(
    filterBuildings(data, { ...empty, style: ['basilica', 'neo-gothic'] }).map((x) => x.id),
    ['old', 'uncertain'],
  );
  assert.deepEqual(filterBuildings(data, { ...empty, style: ['missing'] }), []);
});
test('style links retain component IDs when translated labels change', () => {
  assert.deepEqual(styleEntries(data[1], 'en'), [
    { id: 'art-nouveau', label: 'Art Nouveau' },
    { id: 'neo-gothic', label: 'Neo-Gothic' },
  ]);
});

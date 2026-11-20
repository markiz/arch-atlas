/**
 * Historical period presets. IDs are stable and are what the UI stores and
 * compares; labels are only display strings. Bounds are finite sentinels so a
 * preset survives JSON serialization into the public city catalog.
 */
export const PERIOD_PRESETS = {
  georgia: [
    {
      id: 'medieval',
      label: 'До 1500',
      name: 'Средневековье',
      min: -100000,
      max: 1499,
      color: '#8f4432',
    },
    {
      id: 'persian',
      label: '1500–1800',
      name: 'Позднее средневековье и персидский город',
      min: 1500,
      max: 1800,
      color: '#a85c37',
    },
    {
      id: 'imperial-early',
      label: '1801–1860',
      name: 'Раннеимперский',
      min: 1801,
      max: 1860,
      color: '#bd783f',
    },
    {
      id: 'capitalist',
      label: '1861–1899',
      name: 'Капиталистический Тбилиси',
      min: 1861,
      max: 1899,
      color: '#c89a3e',
    },
    {
      id: 'imperial-late',
      label: '1900–1920',
      name: 'Позднеимперский и первая республика',
      min: 1900,
      max: 1920,
      color: '#a8a845',
    },
    {
      id: 'early-soviet',
      label: '1921–1932',
      name: 'Раннесоветский (авангард)',
      min: 1921,
      max: 1932,
      color: '#7c9b4c',
    },
    {
      id: 'stalinist',
      label: '1933–1954',
      name: 'Сталинский',
      min: 1933,
      max: 1954,
      color: '#4f8f72',
    },
    {
      id: 'post-stalin',
      label: '1955–1990',
      name: 'Постсталинское время',
      min: 1955,
      max: 1990,
      color: '#3f6f96',
    },
    {
      id: 'independence',
      label: 'С 1991',
      name: 'Независимая Грузия',
      min: 1991,
      max: 100000,
      color: '#2f4068',
    },
    { id: 'unknown', label: 'Неизвестно', name: null, min: null, max: null, color: '#999b91' },
  ],
  belgrade: [
    {
      id: 'medieval',
      label: 'До 1400',
      name: 'Средневековый Белград',
      min: -100000,
      max: 1399,
      color: '#8f4432',
    },
    {
      id: 'ottoman',
      label: '1400–1800',
      name: 'Османский Белград',
      min: 1400,
      max: 1800,
      color: '#a85c37',
    },
    {
      id: 'habsburg',
      label: '1801–1918',
      name: 'Габсбургский и сербский Белград',
      min: 1801,
      max: 1918,
      color: '#bd783f',
    },
    {
      id: 'interwar',
      label: '1919–1944',
      name: 'Межвоенный и военный',
      min: 1919,
      max: 1944,
      color: '#c89a3e',
    },
    {
      id: 'socialist',
      label: '1945–1990',
      name: 'Социалистический Белград',
      min: 1945,
      max: 1990,
      color: '#4f8f72',
    },
    {
      id: 'modern',
      label: 'С 1991',
      name: 'Современная Сербия',
      min: 1991,
      max: 100000,
      color: '#2f4068',
    },
    { id: 'unknown', label: 'Неизвестно', name: null, min: null, max: null, color: '#999b91' },
  ],
};

export const DEFAULT_PERIOD_PRESET = 'georgia';

export function resolvePeriods(value) {
  if (Array.isArray(value)) return value;
  const periods = PERIOD_PRESETS[value];
  if (!periods) throw new Error(`unknown period preset "${value}"`);
  return periods;
}

// Границы периодов — исторические вехи Тбилиси. Подпись в интерфейсе — только
// числовой интервал; name хранит человеческое название периода и не выводится.
export const periods = [
  {
    id: 'medieval',
    label: 'До 1500',
    name: 'Средневековье',
    min: -Infinity,
    max: 1499,
    color: '#8d765f',
  },
  {
    id: 'persian',
    label: '1500–1800',
    name: 'Позднее средневековье и персидский город',
    min: 1500,
    max: 1800,
    color: '#a58a6d',
  },
  {
    id: 'imperial-early',
    label: '1801–1860',
    name: 'Раннеимперский',
    min: 1801,
    max: 1860,
    color: '#bd8b6b',
  },
  {
    id: 'capitalist',
    label: '1861–1899',
    name: 'Капиталистический Тбилиси',
    min: 1861,
    max: 1899,
    color: '#c8a35e',
  },
  {
    id: 'imperial-late',
    label: '1900–1920',
    name: 'Позднеимперский и первая республика',
    min: 1900,
    max: 1920,
    color: '#a5a759',
  },
  {
    id: 'early-soviet',
    label: '1921–1932',
    name: 'Раннесоветский (авангард)',
    min: 1921,
    max: 1932,
    color: '#7f9a63',
  },
  {
    id: 'stalinist',
    label: '1933–1954',
    name: 'Сталинский',
    min: 1933,
    max: 1954,
    color: '#6b9a7d',
  },
  {
    id: 'post-stalin',
    label: '1955–1990',
    name: 'Постсталинское время',
    min: 1955,
    max: 1990,
    color: '#5b93a1',
  },
  {
    id: 'independence',
    label: 'С 1991',
    name: 'Независимая Грузия',
    min: 1991,
    max: Infinity,
    color: '#7184ad',
  },
  { id: 'unknown', label: 'Неизвестно', name: null, min: null, max: null, color: '#999b91' },
];
export function periodsFor(min, max) {
  const unknown = periods[periods.length - 1];
  if (min === null || max === null) return [unknown];
  const matched = periods.filter((x) => x.min !== null && min <= x.max && max >= x.min);
  return matched.length ? matched : [unknown];
}
/**
 * Основной период здания. Окно постройки часто широкое, поэтому берём его
 * середину: дом 1890–1910 попадает в 1900–1920, а не в 1861–1899.
 * Правые границы включительные, поэтому `max + 1` — это начало следующего года.
 */
export function period(min, max) {
  if (min === null || max === null) return periods[periods.length - 1];
  const middle = (min + max) / 2;
  return (
    periods.find((x) => x.min !== null && middle >= x.min && middle < x.max + 1) ||
    periods[periods.length - 1]
  );
}
export function normalize(s) {
  return (s || '')
    .normalize('NFC')
    .toLocaleLowerCase('ru')
    .replaceAll('ё', 'е')
    .replace(/[.,:;«»"'’()\-–—/]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
export function styleEntries(building, language = 'ru') {
  const ids =
    Array.isArray(building.styleIds) && building.styleIds.length
      ? building.styleIds
      : ['undetermined'];
  const labels = (building.styles?.[language] || building.style || ids.join(', ')).split(/,\s*/);
  return ids.map((id, index) => ({ id, label: labels[index] || id }));
}
export function searchableText(b) {
  const osmId = typeof b.osmId === 'string' ? b.osmId.trim() : '';
  const osmNumber = osmId.match(/(\d+)$/)?.[1];
  const osmType = osmId.split('/')[0];
  return [
    b.name,
    b.nameKa,
    b.nameEn,
    b.nameUk,
    ...Object.values(b.names || {}),
    b.address,
    ...Object.values(b.addresses || {}),
    b.district,
    ...Object.values(b.districts || {}),
    b.style,
    ...Object.values(b.styles || {}),
    ...b.architects,
    ...Object.values(b.architectsByLanguage || {}).flat(),
    b.id,
    osmId,
    osmNumber && `OSM-${osmNumber}`,
    osmNumber && `OSM${osmNumber}`,
    osmNumber && `${osmType}${osmNumber}`,
  ]
    .filter(Boolean)
    .join(' ');
}
const filled = (value) => typeof value === 'string' && value.trim() !== '';
const anyFilled = (value) =>
  !!value && typeof value === 'object' && Object.values(value).some(filled);
/**
 * "Interesting" means the card has something to read: a description or a history.
 * Dates and architects live in the card's fields and do not count on their own.
 */
export function isInteresting(building) {
  return (
    anyFilled(building.descriptions) ||
    filled(building.description) ||
    anyFilled(building.histories) ||
    filled(building.history)
  );
}
export function isResidential(building) {
  return building.type === 'residential';
}
export function filterBuildings(buildings, f) {
  const terms = normalize(f.query).split(' ').filter(Boolean);
  const from = f.from === '' ? -Infinity : Number(f.from),
    to = f.to === '' ? Infinity : Number(f.to);
  const dateActive = f.from !== '' || f.to !== '';
  if (Number.isNaN(from) || Number.isNaN(to) || from > to) return [];
  return buildings.filter((b) => {
    const hay = normalize(searchableText(b));
    const architects = Array.isArray(f.architect) ? f.architect : f.architect ? [f.architect] : [],
      styles = Array.isArray(f.style) ? f.style : f.style ? [f.style] : [],
      buildingStyles = Array.isArray(b.styleIds) ? b.styleIds : [];
    return (
      (!f.interestingOnly || !isResidential(b) || isInteresting(b)) &&
      terms.every((t) => hay.includes(t)) &&
      (!dateActive || (b.minYear !== null && b.minYear <= to && b.maxYear >= from)) &&
      (!architects.length ||
        architects.some((id) =>
          id === 'unknown' ? b.architects.length === 0 : b.architectIds.includes(id),
        )) &&
      (!styles.length || styles.some((id) => buildingStyles.includes(id)))
    );
  });
}

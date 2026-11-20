// Historical periods are city data: the UI stores stable ids, not labels.
import { PERIOD_PRESETS } from './periods.js';

/** @type {import('./types').CityPeriod[]} */
export const periods = PERIOD_PRESETS.georgia;

/**
 * @param {number | null} min
 * @param {number | null} max
 * @param {import('./types').CityPeriod[]} [table]
 */
export function periodsFor(min, max, table = periods) {
  const unknown = table.find((item) => item.id === 'unknown') ?? table[table.length - 1];
  if (min === null || max === null) return [unknown];
  const matched = table.filter(
    (item) => item.min !== null && item.max !== null && min <= item.max && max >= item.min,
  );
  return matched.length ? matched : [unknown];
}
/**
 * Основной период здания. Окно постройки часто широкое, поэтому берём его
 * середину: дом 1890–1910 попадает в 1900–1920, а не в 1861–1899.
 * Правые границы включительные, поэтому `max + 1` — это начало следующего года.
 */
/**
 * @param {number | null} min
 * @param {number | null} max
 * @param {import('./types').CityPeriod[]} [table]
 */
export function period(min, max, table = periods) {
  const unknown = table.find((item) => item.id === 'unknown') ?? table[table.length - 1];
  if (min === null || max === null) return unknown;
  const middle = (min + max) / 2;
  return (
    table.find(
      (item) =>
        item.min !== null && item.max !== null && middle >= item.min && middle < item.max + 1,
    ) || unknown
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

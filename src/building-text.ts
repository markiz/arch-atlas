import type { Building, BuildingDetails } from './types';
import type { Language } from './languages.ts';

/** Text helpers keep language fallbacks in one place instead of on every card. */
export function buildingName(building: Building, language: Language): string {
  return building.names[language] || building.names.ru || building.id;
}

export function buildingAddress(building: Building, language: Language): string {
  return building.addresses[language] ?? building.addresses.ru ?? '';
}

export function buildingDistrict(building: Building, language: Language): string {
  return building.districts[language] || building.districts.ru || '';
}

export function buildingYearLabel(building: Building, language: Language): string {
  return building.yearLabels[language] || building.yearLabels.ru || '';
}

export function buildingStyle(building: Building, language: Language): string {
  return building.styles[language] || building.styles.ru || '';
}

export function buildingArchitects(building: Building, language: Language): string[] {
  return building.architectsByLanguage[language] ?? building.architectsByLanguage.ru ?? [];
}

/**
 * Long inspector text. v3 keeps it in a language pack; v2 cards carried it
 * inline, so the legacy maps remain a fallback until old bundles are gone.
 */
export function buildingText(
  building: Building,
  details: BuildingDetails | undefined,
  language: Language,
): Pick<BuildingDetails, 'description' | 'history' | 'geometryQuality'> {
  const description =
    details?.description ?? building.descriptions?.[language] ?? building.descriptions?.ru ?? '';
  const history =
    details?.history ??
    building.histories?.[language] ??
    (language === 'ru' ? building.histories?.ru : undefined) ??
    '';
  const geometryQuality =
    details?.geometryQuality ??
    (language === 'ru'
      ? building.geometryQuality
      : building.geometryQualityTranslations?.[language] || building.geometryQuality) ??
    '';
  return { description, history, geometryQuality };
}

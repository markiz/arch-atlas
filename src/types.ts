import type { GeoJsonObject, Geometry } from 'geojson';
import type { Language } from './languages.ts';
export type GeometryRole =
  | 'above_ground'
  | 'heritage_boundary'
  | 'complex_underground'
  | 'neighbor_wrong_candidate'
  | 'historic_plan'
  | 'visible_domes'
  | 'unknown';
export interface GeometryVariant {
  role: GeometryRole;
  geometry: Geometry;
  source?: string;
  areaM2?: number;
  note?: string;
}
export type BuildingType =
  | 'residential'
  | 'commercial'
  | 'government'
  | 'educational'
  | 'cultural'
  | 'healthcare'
  | 'religious'
  | 'hospitality'
  | 'industrial'
  | 'military'
  | 'infrastructure'
  | 'public'
  | 'mixed'
  | 'unknown';
export interface Photo {
  id: string;
  file: string;
  thumb: string;
  /** Smaller catalog-only preview; falls back to `thumb` for old bundles. */
  card?: string;
  author: string;
  license: string;
  licenseUrl: string;
  source: string;
  modifications: string;
  width: number;
  height: number;
  rating: number;
  descriptions?: Partial<Record<Language, string>>;
  sourceTags?: string[];
  visualTags?: string[];
  /** Documentary tags; `stamp` marks postage-stamp scans. */
  tags?: string[];
}
export interface Building {
  id: string;
  cityId: string;
  name: string;
  nameKa?: string;
  nameEn?: string;
  nameUk?: string;
  nameSr?: string;
  names: Partial<Record<Language, string>>;
  originalLanguage: string;
  address: string;
  addresses: Partial<Record<Language, string>>;
  district: string;
  districtId: string;
  districts: Partial<Record<Language, string>>;
  type: BuildingType;
  typeLabels: Partial<Record<Language, string>>;
  minYear: number | null;
  maxYear: number | null;
  yearLabel: string;
  yearLabelId: string;
  yearLabels: Partial<Record<Language, string>>;
  architects: string[];
  architectIds: string[];
  architectsByLanguage: Partial<Record<Language, string[]>>;
  style: string;
  styleIds: string[];
  styles: Partial<Record<Language, string>>;
  description: string;
  descriptions?: Partial<Record<Language, string>>;
  history: string;
  histories?: Partial<Record<Language, string>>;
  coordinates: [number, number];
  photo?: Photo;
  photos?: Photo[];
  source: string;
  otherSource?: string;
  googlePlaceId?: string;
  googlePlaceIdSource?: string;
  geometry?: Geometry | null;
  geometryRole?: GeometryRole;
  geometryVariants?: GeometryVariant[];
  geometryQuality: string;
  geometryQualityTranslations?: Partial<Record<Exclude<Language, 'ru'>, string>>;
  osmId?: string;
}
/** Photo fields needed by cards and the gallery before credits are fetched. */
export interface PhotoRef {
  id: string;
  file: string;
  thumb: string;
  card?: string;
  rating: number;
  tags?: string[];
}

/** Language-independent photo attribution, fetched separately from the map. */
export interface PhotoCredit {
  id: string;
  author: string;
  license: string;
  licenseUrl: string;
  source: string;
  modifications: string;
  width: number;
  height: number;
  descriptions?: Partial<Record<Language, string>>;
}

/**
 * The map + catalog half of a card. Long text, technical notes and photo
 * credits live in separate language packs so they never block the first paint.
 */
export interface BuildingCore {
  id: string;
  cityId: string;
  names: Partial<Record<Language, string>>;
  addresses: Partial<Record<Language, string>>;
  districtId: string;
  districts: Partial<Record<Language, string>>;
  type: BuildingType;
  typeLabels: Partial<Record<Language, string>>;
  minYear: number | null;
  maxYear: number | null;
  yearLabelId: string;
  yearLabels: Partial<Record<Language, string>>;
  architectIds: string[];
  architectsByLanguage: Partial<Record<Language, string[]>>;
  styleIds: string[];
  styles: Partial<Record<Language, string>>;
  coordinates: [number, number];
  photos?: PhotoRef[];
  source: string;
  otherSource?: string;
  googlePlaceId?: string;
  googlePlaceIdSource?: string;
  geometry?: Geometry | null;
  geometryRole?: GeometryRole;
  geometryVariants?: GeometryVariant[];
  osmId?: string;
  /** True when at least one language has a description or a history. */
  hasStory: boolean;
}

/** Inspector text for one language. */
export interface BuildingDetails {
  id: string;
  description: string;
  history: string;
  geometryQuality: string;
}

export interface AtlasCoreBundle {
  version: 1;
  buildings: BuildingCore[];
}

export interface AtlasDetailsBundle {
  version: 1;
  city: string;
  language: Language;
  buildings: BuildingDetails[];
}

export interface AtlasCreditsBundle {
  version: 1;
  city: string;
  photos: PhotoCredit[];
}

export interface ManifestFile {
  path: string;
  size: number;
  sha256: string;
}
export interface CityPeriod {
  id: string;
  label: string;
  name: string | null;
  min: number | null;
  max: number | null;
  color: string;
}
export interface CityMap {
  bounds: { west: number; south: number; east: number; north: number };
  center: { lat: number; lng: number };
  zoom: number;
  minZoom: number;
  maxZoom: number;
  start: {
    mobile: { center: { lat: number; lng: number }; zoom: number };
    desktop: { center: { lat: number; lng: number }; zoom: number };
  };
}
export interface CityPublic {
  id: string;
  status: 'ready' | 'coming-soon';
  languages: Language[];
  labels: Partial<Record<Language, string>>;
  country: Partial<Record<Language, string>>;
  periods: CityPeriod[];
  map: CityMap;
  counts?: { buildings: number };
  manifestRevision?: string;
}
export interface CitiesCatalog {
  version: number;
  revision: string;
  defaultCity: string;
  cities: CityPublic[];
}
export interface ManifestEntry {
  buildings: string;
  basemap: string;
  outlines: string;
}
export interface CityManifest {
  version: number;
  city: string;
  revision: string;
  entry: ManifestEntry;
  files: ManifestFile[];
}
/** Split city package introduced in manifest version 3. */
export interface ManifestEntryV3 {
  core: string;
  details: Partial<Record<Language, string>>;
  basemap: string;
  outlines: string;
  credits: string;
}
export interface CityManifestV3 {
  version: 3;
  city: string;
  revision: string;
  entry: ManifestEntryV3;
  files: ManifestFile[];
}
export interface Data {
  city: CityPublic;
  buildings: Building[];
  basemap: GeoJsonObject;
  buildingOutlines: ManifestFile;
  photoFiles: Map<string, ManifestFile>;
  detailsFiles: Partial<Record<Language, ManifestFile>>;
  creditsFile?: ManifestFile;
}
export interface Filters {
  query: string;
  from: string;
  to: string;
  architect: string[];
  style: string[];
  /** Hide cards without description and history. On by default. */
  interestingOnly: boolean;
}

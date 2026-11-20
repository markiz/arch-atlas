import type { GeoJsonObject, Geometry } from 'geojson';
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
  descriptions?: Record<'ru' | 'en' | 'ka' | 'uk', string>;
  sourceTags?: string[];
  visualTags?: string[];
  /** Documentary tags; `stamp` marks postage-stamp scans. */
  tags?: string[];
}
export interface Building {
  id: string;
  cityId: string;
  name: string;
  nameKa: string;
  nameEn: string;
  nameUk: string;
  names: Record<'ru' | 'en' | 'ka' | 'uk', string>;
  originalLanguage: string;
  address: string;
  addresses: Record<'ru' | 'en' | 'ka' | 'uk', string>;
  district: string;
  districtId: string;
  districts: Record<'ru' | 'en' | 'ka' | 'uk', string>;
  type: BuildingType;
  typeLabels: Record<'ru' | 'en' | 'ka' | 'uk', string>;
  minYear: number | null;
  maxYear: number | null;
  yearLabel: string;
  yearLabelId: string;
  yearLabels: Record<'ru' | 'en' | 'ka' | 'uk', string>;
  architects: string[];
  architectIds: string[];
  architectsByLanguage: Record<'ru' | 'en' | 'ka' | 'uk', string[]>;
  style: string;
  styleIds: string[];
  styles: Record<'ru' | 'en' | 'ka' | 'uk', string>;
  description: string;
  descriptions?: Record<'ru' | 'en' | 'ka' | 'uk', string>;
  history: string;
  histories?: Partial<Record<'ru' | 'en' | 'ka' | 'uk', string>>;
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
  geometryQualityTranslations?: Partial<Record<'en' | 'ka' | 'uk', string>>;
  osmId?: string;
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
  labels: Record<'ru' | 'en' | 'ka' | 'uk', string>;
  country: Record<'ru' | 'en' | 'ka' | 'uk', string>;
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
export interface Data {
  city: CityPublic;
  buildings: Building[];
  basemap: GeoJsonObject;
  buildingOutlines: ManifestFile;
  photoFiles: Map<string, ManifestFile>;
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

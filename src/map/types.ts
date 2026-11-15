import type { Building, ManifestFile } from '../types';

export type LatLng = { lat: number; lng: number };
export type Point = { x: number; y: number };
/** Lon/lat bounding box. */
export type BBox = { minX: number; minY: number; maxX: number; maxY: number };
/** West/south/east/north bounds in degrees. */
export type Bounds = { west: number; south: number; east: number; north: number };

/** Compact building outlines: flat coordinates, ring/feature offsets and bboxes. */
export interface OutlineBinary {
  /** [lng, lat] pairs, two floats per point. */
  points: Float32Array;
  /** Point index where each ring starts; length ringCount + 1. */
  ringStarts: Uint32Array;
  /** Ring index where each feature starts; length featureCount + 1. */
  featureRings: Uint32Array;
  /** minLng, minLat, maxLng, maxLat per feature. */
  boxes: Float32Array;
  featureCount: number;
}

export interface MapViewProps {
  buildings: Building[];
  allBuildings: Building[];
  basemap: GeoJSON.FeatureCollection;
  buildingOutlines: ManifestFile;
  selected: string | null;
  onSelect: (id: string) => void;
  focus: { id: string; serial: number } | null;
  reset: number;
  fit: number;
  showFit: boolean;
  onFit: () => void;
  selectedPeriods: string[];
  hoveredPeriod: string | null;
  onFocusHandled: () => void;
}

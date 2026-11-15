import type { Geometry } from 'geojson';
import type { BBox, Bounds, LatLng, Point } from './types';

export const WORLD_SIZE = 256;
export const MAX_LATITUDE = 85.0511287798;
const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;

export function projectX(lng: number, zoom: number): number {
  return ((lng + 180) / 360) * WORLD_SIZE * 2 ** zoom;
}

export function projectY(lat: number, zoom: number): number {
  const safe = Math.max(-MAX_LATITUDE, Math.min(MAX_LATITUDE, lat));
  const sin = Math.sin(safe * DEG_TO_RAD);
  const n = Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI);
  return (0.5 - n) * WORLD_SIZE * 2 ** zoom;
}

export function project(lat: number, lng: number, zoom: number): Point {
  return { x: projectX(lng, zoom), y: projectY(lat, zoom) };
}

export function unprojectX(x: number, zoom: number): number {
  return (x / (WORLD_SIZE * 2 ** zoom)) * 360 - 180;
}

export function unprojectY(y: number, zoom: number): number {
  const world = WORLD_SIZE * 2 ** zoom;
  const n = Math.PI - (2 * Math.PI * y) / world;
  return Math.atan(0.5 * (Math.exp(n) - Math.exp(-n))) * RAD_TO_DEG;
}

export function unproject(x: number, y: number, zoom: number): LatLng {
  return { lat: unprojectY(y, zoom), lng: unprojectX(x, zoom) };
}

export function emptyBBox(): BBox {
  return { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
}

export function extendBBox(box: BBox, other: BBox): BBox {
  return {
    minX: Math.min(box.minX, other.minX),
    minY: Math.min(box.minY, other.minY),
    maxX: Math.max(box.maxX, other.maxX),
    maxY: Math.max(box.maxY, other.maxY),
  };
}

export function bboxIsValid(box: BBox): boolean {
  return box.minX <= box.maxX && box.minY <= box.maxY && Number.isFinite(box.minX);
}

export function bboxIntersects(a: BBox, b: BBox): boolean {
  return a.minX <= b.maxX && a.maxX >= b.minX && a.minY <= b.maxY && a.maxY >= b.minY;
}

export function bboxContains(box: BBox, x: number, y: number): boolean {
  return x >= box.minX && x <= box.maxX && y >= box.minY && y <= box.maxY;
}

export function boundsFromBBox(box: BBox): Bounds {
  return { west: box.minX, south: box.minY, east: box.maxX, north: box.maxY };
}

export function boundsIsValid(bounds: Bounds): boolean {
  return (
    Number.isFinite(bounds.west) &&
    Number.isFinite(bounds.south) &&
    Number.isFinite(bounds.east) &&
    Number.isFinite(bounds.north) &&
    bounds.west <= bounds.east &&
    bounds.south <= bounds.north
  );
}

/** Bounding box of any GeoJSON geometry, in longitude/latitude degrees. */
export function geometryBounds(geometry: Geometry | null | undefined): BBox | null {
  if (!geometry) return null;
  const box = emptyBBox();
  const visit = (value: unknown): void => {
    if (!Array.isArray(value)) return;
    if (typeof value[0] === 'number' && typeof value[1] === 'number') {
      const x = value[0],
        y = value[1];
      if (Number.isFinite(x) && Number.isFinite(y)) {
        if (x < box.minX) box.minX = x;
        if (x > box.maxX) box.maxX = x;
        if (y < box.minY) box.minY = y;
        if (y > box.maxY) box.maxY = y;
      }
      return;
    }
    for (const item of value) visit(item);
  };
  if (geometry.type === 'GeometryCollection')
    geometry.geometries.forEach((item) =>
      visit((item as Geometry & { coordinates?: unknown }).coordinates),
    );
  else visit((geometry as Geometry & { coordinates?: unknown }).coordinates);
  return bboxIsValid(box) ? box : null;
}

export function featureBounds(feature: GeoJSON.Feature): BBox | null {
  return geometryBounds(feature.geometry);
}

export function pointInRing(lng: number, lat: number, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i],
      b = ring[j];
    if (!a || !b) continue;
    const intersects =
      a[1] > lat !== b[1] > lat && lng < ((b[0] - a[0]) * (lat - a[1])) / (b[1] - a[1]) + a[0];
    if (intersects) inside = !inside;
  }
  return inside;
}

function pointInPolygon(lng: number, lat: number, rings: number[][][]): boolean {
  if (!rings.length || !pointInRing(lng, lat, rings[0])) return false;
  for (let i = 1; i < rings.length; i++) if (pointInRing(lng, lat, rings[i])) return false;
  return true;
}

/** Hit test for atlas outlines. Lines and points are not selectable on the map. */
export function pointInGeometry(
  lng: number,
  lat: number,
  geometry: Geometry | null | undefined,
): boolean {
  if (!geometry) return false;
  if (geometry.type === 'Polygon')
    return pointInPolygon(lng, lat, geometry.coordinates as number[][][]);
  if (geometry.type === 'MultiPolygon')
    return geometry.coordinates.some((polygon) =>
      pointInPolygon(lng, lat, polygon as number[][][]),
    );
  if (geometry.type === 'GeometryCollection')
    return geometry.geometries.some((item) => pointInGeometry(lng, lat, item));
  return false;
}

/** Iterate polygon rings of any geometry without allocating intermediate arrays. */
export function eachPolygonRing(
  geometry: Geometry | null | undefined,
  visit: (ring: number[][]) => void,
): void {
  if (!geometry) return;
  if (geometry.type === 'Polygon') {
    for (const ring of geometry.coordinates) visit(ring as number[][]);
    return;
  }
  if (geometry.type === 'MultiPolygon') {
    for (const polygon of geometry.coordinates)
      for (const ring of polygon) visit(ring as number[][]);
    return;
  }
  if (geometry.type === 'GeometryCollection') {
    for (const item of geometry.geometries) eachPolygonRing(item, visit);
  }
}

export function radians(degrees: number): number {
  return degrees * DEG_TO_RAD;
}

export function metersPerPixel(lat: number, zoom: number): number {
  return (Math.cos(lat * DEG_TO_RAD) * 2 * Math.PI * 6378137) / (WORLD_SIZE * 2 ** zoom);
}

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

const METERS_PER_DEGREE = (2 * Math.PI * 6378137) / 360;

/**
 * Convert a screen-space tap slop into a latitude-degree radius at the current
 * zoom. Longitude is handled separately with the local cos(latitude) factor.
 */
export function tapRadiusDegrees(pixels: number, lat: number, zoom: number): number {
  return (pixels * metersPerPixel(lat, zoom)) / METERS_PER_DEGREE;
}

/** Minimal shape of an atlas outline that can take part in tap resolution. */
export type TapTarget = {
  bbox: BBox;
  geometry: Geometry | null | undefined;
};

/**
 * Squared distance from a point to the nearest edge of a polygon. `xScale`
 * compresses longitude so both axes are measured in comparable units; pass
 * `cos(latitude)` when the coordinates are degrees.
 */
export function squaredDistanceToGeometry(
  x: number,
  y: number,
  geometry: Geometry | null | undefined,
  xScale = 1,
): number {
  let best = Infinity;
  eachPolygonRing(geometry, (ring) => {
    const count = ring.length;
    if (count === 1) {
      const only = ring[0];
      if (only) {
        const dx = (x - only[0]) * xScale,
          dy = y - only[1],
          distance = dx * dx + dy * dy;
        if (distance < best) best = distance;
      }
      return;
    }
    for (let index = 0; index < count; index += 1) {
      const a = ring[index],
        b = ring[(index + 1) % count];
      if (!a || !b) continue;
      const abx = (b[0] - a[0]) * xScale,
        aby = b[1] - a[1],
        apx = (x - a[0]) * xScale,
        apy = y - a[1],
        lengthSquared = abx * abx + aby * aby;
      const t = lengthSquared
        ? Math.max(0, Math.min(1, (apx * abx + apy * aby) / lengthSquared))
        : 0;
      const dx = apx - t * abx,
        dy = apy - t * aby,
        distance = dx * dx + dy * dy;
      if (distance < best) best = distance;
    }
  });
  return best;
}

/**
 * Resolve a tap against atlas outlines. An outline is eligible while the tap
 * is within `radiusDegrees` of its drawn polygon, which is a true distance
 * buffer: inner corners and courtyards do not grow with the zone. A tap inside
 * a drawn polygon always wins over a neighbour's buffer; between overlapping
 * buffers the outline with the closest edge wins.
 */
export function pickTapTarget<T extends TapTarget>(
  lng: number,
  lat: number,
  targets: readonly T[],
  radiusDegrees = 0,
): T | null {
  for (let index = targets.length - 1; index >= 0; index -= 1) {
    const target = targets[index];
    if (!target || !bboxContains(target.bbox, lng, lat)) continue;
    if (pointInGeometry(lng, lat, target.geometry)) return target;
  }
  if (!(radiusDegrees > 0)) return null;
  const xScale = Math.max(1e-6, Math.cos(radians(lat)));
  const lngRadius = radiusDegrees / xScale;
  const radiusSquared = radiusDegrees * radiusDegrees;
  let best: T | null = null,
    bestDistance = Infinity;
  for (let index = targets.length - 1; index >= 0; index -= 1) {
    const target = targets[index];
    if (!target) continue;
    const box = target.bbox;
    if (
      lng < box.minX - lngRadius ||
      lng > box.maxX + lngRadius ||
      lat < box.minY - radiusDegrees ||
      lat > box.maxY + radiusDegrees
    )
      continue;
    const distance = squaredDistanceToGeometry(lng, lat, target.geometry, xScale);
    if (distance > radiusSquared) continue;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = target;
    }
  }
  return best;
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

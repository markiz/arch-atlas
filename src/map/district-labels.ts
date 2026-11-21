import type { Geometry } from 'geojson';
import type { Language } from '../i18n';
import { pointInRing } from './geometry.ts';
import { mercatorY } from './mercator.ts';
import type { BBox } from './types';

/**
 * District polygons are static, so parsing prepares only what the centre label
 * needs: a point guaranteed to be inside, a degree-space bbox for sizing the
 * text and a normalized area for ranking multipolygon parts.
 */

export type DistrictPart = {
  /** Longitude/latitude of a point guaranteed to be inside the part. */
  labelPoint: [number, number];
  bbox: BBox;
  /** Normalized-world area, used only to rank parts. */
  area: number;
};

export type DistrictShape = {
  id: string;
  names: Partial<Record<Language, string>>;
  /** Fallback name from the feature, normally the Russian label. */
  name: string;
  /** Largest part: the one that carries the centre label. */
  main: DistrictPart;
};

type Ring = [number, number][];

function ringArea(ring: Ring): number {
  let sum = 0;
  for (let index = 0; index < ring.length; index++) {
    const a = ring[index],
      b = ring[(index + 1) % ring.length];
    sum += a[0] * b[1] - b[0] * a[1];
  }
  return Math.abs(sum) / 2;
}

function ringCentroid(ring: Ring): [number, number] {
  let area = 0,
    x = 0,
    y = 0;
  for (let index = 0; index < ring.length; index++) {
    const a = ring[index],
      b = ring[(index + 1) % ring.length];
    const cross = a[0] * b[1] - b[0] * a[1];
    area += cross;
    x += (a[0] + b[0]) * cross;
    y += (a[1] + b[1]) * cross;
  }
  if (Math.abs(area) < 1e-15) {
    const count = Math.max(1, ring.length);
    return [
      ring.reduce((sum, point) => sum + point[0], 0) / count,
      ring.reduce((sum, point) => sum + point[1], 0) / count,
    ];
  }
  return [x / (3 * area), y / (3 * area)];
}

function ringBounds(ring: Ring): BBox {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const [x, y] of ring) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return { minX, minY, maxX, maxY };
}

function inside(ring: Ring, holes: Ring[], x: number, y: number): boolean {
  if (!pointInRing(x, y, ring)) return false;
  for (const hole of holes) if (pointInRing(x, y, hole)) return false;
  return true;
}

/**
 * Area centroids of irregular districts can fall into a courtyard or outside
 * the polygon. The scanline fallback finds the interior point closest to the
 * centroid without pulling in a triangulation dependency.
 */
function interiorPoint(outer: Ring, holes: Ring[]): [number, number] {
  const centroid = ringCentroid(outer);
  if (inside(outer, holes, centroid[0], centroid[1])) return centroid;
  const box = ringBounds(outer);
  let best = centroid,
    bestDistance = Infinity;
  const rows = 32;
  for (let row = 0; row <= rows; row++) {
    const y = box.minY + ((box.maxY - box.minY) * row) / rows;
    const crossings: number[] = [];
    for (let index = 0; index < outer.length; index++) {
      const a = outer[index],
        b = outer[(index + 1) % outer.length];
      if (a[1] > y !== b[1] > y)
        crossings.push(a[0] + ((y - a[1]) * (b[0] - a[0])) / (b[1] - a[1]));
    }
    crossings.sort((a, b) => a - b);
    for (let index = 0; index + 1 < crossings.length; index += 2) {
      const x = (crossings[index] + crossings[index + 1]) / 2;
      if (!inside(outer, holes, x, y)) continue;
      const distance = (x - centroid[0]) ** 2 + (y - centroid[1]) ** 2;
      if (distance < bestDistance) {
        bestDistance = distance;
        best = [x, y];
      }
    }
  }
  return best;
}

function closed(ring: number[][]): Ring {
  const points: Ring = [];
  for (const point of ring) {
    if (!point || point.length < 2) continue;
    const x = Number(point[0]),
      y = Number(point[1]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    points.push([x, y]);
  }
  if (points.length > 1) {
    const first = points[0],
      last = points[points.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) points.push([first[0], first[1]]);
  }
  return points;
}

function normalize([lng, lat]: [number, number]): [number, number] {
  return [(lng + 180) / 360, mercatorY(lat)];
}

function partOf(polygon: number[][][]): DistrictPart | null {
  const outer = closed(polygon[0] ?? []);
  if (outer.length < 4) return null;
  const holes = polygon
    .slice(1)
    .map(closed)
    .filter((ring) => ring.length >= 4);
  return {
    labelPoint: interiorPoint(outer, holes),
    bbox: ringBounds(outer),
    area: ringArea(outer.map(normalize)),
  };
}

function polygonsOf(geometry: Geometry): number[][][][] {
  if (geometry.type === 'Polygon') return [geometry.coordinates as number[][][]];
  if (geometry.type === 'MultiPolygon') return geometry.coordinates as number[][][][];
  return [];
}

export function parseDistricts(features: GeoJSON.Feature[]): DistrictShape[] {
  const shapes: DistrictShape[] = [];
  for (const feature of features) {
    if (feature.properties?.kind !== 'district') continue;
    const geometry = feature.geometry;
    if (!geometry) continue;
    const parts: DistrictPart[] = [];
    for (const polygon of polygonsOf(geometry)) {
      const part = partOf(polygon);
      if (part) parts.push(part);
    }
    if (!parts.length) continue;
    parts.sort((a, b) => b.area - a.area);
    const names = (feature.properties?.names ?? {}) as Partial<Record<Language, string>>;
    const fallback = String(feature.properties?.name || names.ru || '').trim();
    if (!fallback && !names.en) continue;
    shapes.push({
      id: String(feature.properties?.id ?? feature.properties?.osmId ?? shapes.length),
      names,
      name: fallback,
      main: parts[0],
    });
  }
  return shapes;
}

export function districtLabel(shape: DistrictShape, language: Language): string {
  return (shape.names[language] || shape.names.ru || shape.name).trim();
}

/**
 * Fit one line of text inside a district's screen bbox. `unitWidth` is the
 * measured width at font size 1, so the result scales text with the physical
 * size of the district instead of using a fixed size per name.
 */
export function fitCenterLabelSize(
  unitWidth: number,
  boxWidth: number,
  boxHeight: number,
  min = 10,
  max = 56,
): number {
  if (!(unitWidth > 0) || !(boxWidth > 0) || !(boxHeight > 0)) return 0;
  const size = Math.min(max, (boxWidth * 0.74) / unitWidth, boxHeight * 0.5);
  return size >= min ? size : 0;
}

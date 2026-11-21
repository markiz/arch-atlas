import { MAX_LATITUDE, WORLD_SIZE, projectX } from './geometry.ts';
import type { Bounds, Point } from './types';

/**
 * Fast Web-Mercator y for the renderer. The exact formula stays in
 * `project`/`unproject`: tests and tile math rely on its 1e-10 round-trip.
 * Repaints read a precomputed table instead, where the interpolation error is
 * far below a device pixel, and culling compares normalized bbox values
 * without projecting anything at all.
 */

/** Knots of the latitude table; the error stays far below a device pixel. */
const LUT_SIZE = 1 << 18;
const MIN_LAT = -MAX_LATITUDE;
const LAT_SPAN = MAX_LATITUDE - MIN_LAT;
const KNOTS_PER_DEGREE = LUT_SIZE / LAT_SPAN;

let lut: Float64Array | null = null;

/** Mercator y in world units (0 at the north edge, 1 at the south edge). */
export function mercatorY(lat: number): number {
  const safe = Math.max(-MAX_LATITUDE, Math.min(MAX_LATITUDE, lat));
  const sin = Math.sin((safe * Math.PI) / 180);
  return 0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI);
}

function table(): Float64Array {
  if (lut) return lut;
  const values = new Float64Array(LUT_SIZE + 1);
  for (let index = 0; index <= LUT_SIZE; index++)
    values[index] = mercatorY(MIN_LAT + (index / LUT_SIZE) * LAT_SPAN);
  lut = values;
  return values;
}

/**
 * Same curve as {@link mercatorY}, interpolated between table knots. The
 * second derivative is largest near the poles; even there the interpolation
 * error stays around 3e-10 world units, which is 0.04 px at zoom 19.
 */
export function mercatorYFast(lat: number): number {
  // Position is clamped with plain comparisons and truncated with `| 0`:
  // Math.floor/Math.min here cost more than the sin/log they replace.
  const values = lut || table();
  const position = (lat - MIN_LAT) * KNOTS_PER_DEGREE;
  if (!(position > 0)) {
    if (lat !== lat) return NaN;
    return values[0];
  }
  if (position >= LUT_SIZE) return values[LUT_SIZE];
  const index = position | 0;
  const fraction = position - index;
  const low = values[index];
  return low + (values[index + 1] - low) * fraction;
}

/** Pre-build the table so the first repaint does not pay for it. */
export function warmMercatorTable(): void {
  table();
}

/** World pixel of a point at `zoom`, with the table instead of trig. */
export function projectFast(lat: number, lng: number, zoom: number): Point {
  return { x: projectX(lng, zoom), y: mercatorYFast(lat) * WORLD_SIZE * 2 ** zoom };
}

/**
 * Bbox array in the same normalized world units as the table. The renderer
 * compares these with the viewport directly, so culling a feature costs four
 * comparisons instead of four projections.
 */
export function mercatorBoxes(boxes: Float32Array, count: number): Float64Array {
  const out = new Float64Array(count * 4);
  for (let index = 0; index < count; index++) {
    const offset = index * 4;
    out[offset] = (boxes[offset] + 180) / 360;
    out[offset + 1] = mercatorYFast(boxes[offset + 1]);
    out[offset + 2] = (boxes[offset + 2] + 180) / 360;
    out[offset + 3] = mercatorYFast(boxes[offset + 3]);
  }
  return out;
}

/** Same viewport in normalized world units, north first as a smaller y. */
export function normalizedBounds(bounds: Bounds) {
  return {
    west: (bounds.west + 180) / 360,
    east: (bounds.east + 180) / 360,
    north: mercatorYFast(bounds.north),
    south: mercatorYFast(bounds.south),
  };
}

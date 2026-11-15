import type { BBox } from './types';

/**
 * Street labels that follow the OSM line instead of a chord.
 *
 * OSM splits a street into many ways; the first half of this module merges
 * ways that share endpoints into one chain, the second half lays a name along
 * that chain one glyph at a time. Everything here is pure geometry: the map
 * engine projects coordinates, measures text and draws the glyphs.
 */

export type StreetWay = {
  name: string;
  names: Record<string, string>;
  fallback: string;
  /** [longitude, latitude], in travel order. */
  coords: [number, number][];
  /** Class rank from {@link streetPriority}; larger is more important. */
  priority: number;
};

export type StreetLine = {
  name: string;
  names: Record<string, string>;
  fallback: string;
  coords: [number, number][];
  priority: number;
  minZoom: number;
  bbox: BBox;
  /** Sum of segment lengths in degrees; only used to rank chains. */
  length: number;
  /** Midpoint and local direction in degrees, for the cheap preview pass. */
  midpoint: [number, number];
  direction: [number, number];
};

export const STREET_PRIORITY: Record<string, number> = {
  motorway: 7,
  trunk: 6,
  primary: 5,
  secondary: 4,
  tertiary: 3,
  residential: 2,
  unclassified: 1,
  living_street: 1,
  pedestrian: 1,
};

export function streetPriority(highwayClass: unknown): number | null {
  if (typeof highwayClass !== 'string') return null;
  return STREET_PRIORITY[highwayClass] ?? null;
}

export function streetMinZoom(priority: number): number {
  return priority >= 5 ? 11.5 : priority >= 3 ? 12.5 : 14;
}

/* ---------- merging OSM ways into one street line ---------- */

type ChainEntry = {
  coords: [number, number][];
  firstKey: string;
  lastKey: string;
  used: boolean;
};

function endpointKey(point: [number, number]): string {
  // The basemap stores six decimal places, so 1e-6 is the real node identity.
  return `${point[0].toFixed(6)},${point[1].toFixed(6)}`;
}

function chainLength(coords: [number, number][]): number {
  let total = 0;
  for (let index = 1; index < coords.length; index++) {
    total += Math.hypot(
      coords[index][0] - coords[index - 1][0],
      coords[index][1] - coords[index - 1][1],
    );
  }
  return total;
}

function streetMidpoint(coords: [number, number][]): {
  point: [number, number];
  direction: [number, number];
} {
  let total = 0;
  for (let index = 1; index < coords.length; index++) {
    total += Math.hypot(
      coords[index][0] - coords[index - 1][0],
      coords[index][1] - coords[index - 1][1],
    );
  }
  if (!(total > 0)) return { point: coords[0], direction: [0, 0] };
  let passed = 0;
  for (let index = 1; index < coords.length; index++) {
    const from = coords[index - 1],
      to = coords[index],
      length = Math.hypot(to[0] - from[0], to[1] - from[1]);
    if (passed + length >= total / 2) {
      const t = (total / 2 - passed) / (length || 1);
      return {
        point: [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t],
        direction: [to[0] - from[0], to[1] - from[1]],
      };
    }
    passed += length;
  }
  return { point: coords[coords.length - 1], direction: [0, 0] };
}

function chainBounds(coords: [number, number][]): BBox {
  const box: BBox = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  for (const point of coords) {
    box.minX = Math.min(box.minX, point[0]);
    box.minY = Math.min(box.minY, point[1]);
    box.maxX = Math.max(box.maxX, point[0]);
    box.maxY = Math.max(box.maxY, point[1]);
  }
  return box;
}

/**
 * Merge ways with the same name into continuous chains. At an intersection the
 * straightest continuation wins; a sharp turn starts a separate chain, which
 * keeps a T-junction with a reused name from becoming a zigzag.
 */
export function buildStreetLines(ways: StreetWay[]): StreetLine[] {
  const groups = new Map<string, StreetWay[]>();
  for (const way of ways) {
    if (!way.coords || way.coords.length < 2) continue;
    const group = groups.get(way.name);
    if (group) group.push(way);
    else groups.set(way.name, [way]);
  }

  const lines: StreetLine[] = [];
  for (const [name, group] of groups) {
    const priority = Math.max(...group.map((way) => way.priority));
    const entries: ChainEntry[] = group.map((way) => ({
      coords: way.coords,
      firstKey: endpointKey(way.coords[0]),
      lastKey: endpointKey(way.coords[way.coords.length - 1]),
      used: false,
    }));
    const incident = new Map<string, { entry: ChainEntry; end: 0 | 1 }[]>();
    for (const entry of entries) {
      const first = incident.get(entry.firstKey);
      if (first) first.push({ entry, end: 0 });
      else incident.set(entry.firstKey, [{ entry, end: 0 }]);
      const last = incident.get(entry.lastKey);
      if (last) last.push({ entry, end: 1 });
      else incident.set(entry.lastKey, [{ entry, end: 1 }]);
    }
    const degree = (key: string) => incident.get(key)?.length ?? 0;

    const extend = (startPoints: [number, number][], startKey: string) => {
      const points = startPoints.slice();
      let currentKey = startKey;
      for (;;) {
        const candidates = (incident.get(currentKey) ?? []).filter(({ entry }) => !entry.used);
        if (!candidates.length) break;
        const last = points[points.length - 1];
        const previous = points[points.length - 2] ?? last;
        const incoming: [number, number] = [last[0] - previous[0], last[1] - previous[1]];
        let best: ChainEntry | null = null;
        let bestPoints: [number, number][] | null = null;
        let bestKey = '';
        let bestDot = -Infinity;
        for (const candidate of candidates) {
          const forward = candidate.end === 0;
          const oriented = forward
            ? candidate.entry.coords
            : candidate.entry.coords.slice().reverse();
          const outgoing: [number, number] = [
            oriented[1][0] - oriented[0][0],
            oriented[1][1] - oriented[0][1],
          ];
          const denominator =
            Math.hypot(incoming[0], incoming[1]) * Math.hypot(outgoing[0], outgoing[1]) || 1;
          const dot = (incoming[0] * outgoing[0] + incoming[1] * outgoing[1]) / denominator;
          if (dot > bestDot) {
            bestDot = dot;
            best = candidate.entry;
            bestPoints = oriented;
            bestKey = forward ? candidate.entry.lastKey : candidate.entry.firstKey;
          }
        }
        if (!best || !bestPoints || bestDot < -0.35) break;
        best.used = true;
        points.push(...bestPoints.slice(1));
        currentKey = bestKey;
      }
      return points;
    };

    // True chain ends go first; they produce the longest unambiguous line.
    const starts: ChainEntry[] = [];
    const seen = new Set<ChainEntry>();
    for (const entry of entries) {
      if (degree(entry.firstKey) === 1 || degree(entry.lastKey) === 1) {
        starts.push(entry);
        seen.add(entry);
      }
    }
    for (const entry of entries) {
      if (!seen.has(entry)) {
        starts.push(entry);
        seen.add(entry);
      }
    }

    const chains: [number, number][][] = [];
    for (const start of starts) {
      if (start.used) continue;
      start.used = true;
      const firstDegree = degree(start.firstKey);
      const lastDegree = degree(start.lastKey);
      const startAtFirst = !(lastDegree === 1 && firstDegree !== 1);
      const oriented = startAtFirst ? start.coords : start.coords.slice().reverse();
      const startKey = startAtFirst ? start.firstKey : start.lastKey;
      const farKey = startAtFirst ? start.lastKey : start.firstKey;
      const forward = extend(oriented, farKey);
      // Grow backwards as well: reverse, extend, reverse back.
      const backward = extend(forward.slice().reverse(), startKey);
      const coords = backward.slice().reverse();
      if (coords.length >= 2) chains.push(coords);
    }
    // A loop with no endpoint of degree one is rare, but it still needs a home.
    for (const entry of entries) {
      if (entry.used) continue;
      entry.used = true;
      if (entry.coords.length >= 2) chains.push(entry.coords);
    }

    for (const coords of chains) {
      const length = chainLength(coords);
      if (length < 0.00001) continue;
      const midpoint = streetMidpoint(coords);
      lines.push({
        name,
        names: group[0].names,
        fallback: group[0].fallback,
        coords,
        priority,
        minZoom: streetMinZoom(priority),
        bbox: chainBounds(coords),
        length,
        midpoint: midpoint.point,
        direction: midpoint.direction,
      });
    }
  }
  lines.sort((a, b) => b.priority - a.priority || b.length - a.length);
  return lines;
}

/* ---------- text along a screen path ---------- */

export type PathPoint = [number, number];
export type TextBox = { minX: number; minY: number; maxX: number; maxY: number };
export type ScreenPath = {
  points: PathPoint[];
  cumulative: number[];
  length: number;
};
export type TextMetrics = {
  chars: string[];
  advances: number[];
  total: number;
  fontSize: number;
};
export type Glyph = {
  ch: string;
  x: number;
  y: number;
  angle: number;
  advance: number;
  box: TextBox;
};
export type TextLayout = {
  start: number;
  glyphs: Glyph[];
  box: TextBox;
  maxStep: number;
  avgStep: number;
};

const MAX_ANGLE = 1.72; // ~98 degrees; keep labels upright
const MAX_STEP = 0.5; // radians between neighbouring glyphs
const PATH_STEP = 4;

export function measureLabel(
  measure: (text: string) => number,
  text: string,
  fontSize = 8.5,
): TextMetrics {
  const chars = Array.from(text);
  const advances = chars.map((char) => measure(char));
  return {
    chars,
    advances,
    total: advances.reduce((sum, value) => sum + value, 0),
    fontSize,
  };
}

/**
 * Labels keep the same screen size at a given zoom, but grow as the map is
 * zoomed in: 8.5 px at the city overview, up to 12 px on a close street view.
 */
export function streetLabelFontSize(zoom: number): number {
  const size = Math.min(12, 8.5 + Math.max(0, zoom - 14) * 0.7);
  return Math.round(size * 2) / 2;
}

export function streetLabelHalo(fontSize: number): number {
  return Math.max(3, fontSize * 0.34);
}

/**
 * The path is resampled at nearly uniform arc length, so the proportional
 * index is within a couple of points of the answer. Walking from there is
 * much cheaper than a binary search on every glyph of every candidate
 * window; the cache build was dominated by this lookup.
 */
function segmentIndexAt(path: ScreenPath, distance: number): { index: number; t: number } {
  const target = Math.max(0, Math.min(path.length, distance));
  const { cumulative, points } = path;
  const last = points.length - 1;
  let index = Math.max(0, Math.min(last - 1, Math.round((target / path.length) * last)));
  while (index > 0 && cumulative[index] > target) index--;
  while (index < last - 1 && cumulative[index + 1] < target) index++;
  const span = cumulative[index + 1] - cumulative[index] || 1;
  return { index, t: (target - cumulative[index]) / span };
}

function pointAt(path: ScreenPath, distance: number): PathPoint {
  const { index, t } = segmentIndexAt(path, distance);
  const from = path.points[index],
    to = path.points[index + 1];
  return [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t];
}

function tangentAt(path: ScreenPath, distance: number): number {
  const { index } = segmentIndexAt(path, distance);
  const from = path.points[index],
    to = path.points[index + 1];
  return Math.atan2(to[1] - from[1], to[0] - from[0]);
}

function normalizeAngle(angle: number): number {
  let value = angle;
  while (value > Math.PI) value -= Math.PI * 2;
  while (value < -Math.PI) value += Math.PI * 2;
  return value;
}

function glyphBox(x: number, y: number, angle: number, advance: number, fontSize: number): TextBox {
  const halfWidth = advance / 2 + fontSize * 0.19;
  const halfHeight = fontSize * 0.66;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [dx, dy] of [
    [-halfWidth, -halfHeight],
    [halfWidth, -halfHeight],
    [halfWidth, halfHeight],
    [-halfWidth, halfHeight],
  ]) {
    const x2 = x + dx * cos - dy * sin;
    const y2 = y + dx * sin + dy * cos;
    minX = Math.min(minX, x2);
    minY = Math.min(minY, y2);
    maxX = Math.max(maxX, x2);
    maxY = Math.max(maxY, y2);
  }
  return { minX, minY, maxX, maxY };
}

function unionBox(boxes: TextBox[]): TextBox {
  const box = { ...boxes[0] };
  for (const item of boxes) {
    box.minX = Math.min(box.minX, item.minX);
    box.minY = Math.min(box.minY, item.minY);
    box.maxX = Math.max(box.maxX, item.maxX);
    box.maxY = Math.max(box.maxY, item.maxY);
  }
  return box;
}

function resample(points: PathPoint[], step = PATH_STEP): PathPoint[] {
  const length = points
    .slice(1)
    .reduce(
      (sum, point, index) =>
        sum + Math.hypot(point[0] - points[index][0], point[1] - points[index][1]),
      0,
    );
  if (length < 0.5) return points.slice();
  const count = Math.max(1, Math.round(length / step));
  const result: PathPoint[] = [];
  let segment = 1;
  let segmentStart = 0;
  let segmentLength = Math.hypot(points[1][0] - points[0][0], points[1][1] - points[0][1]) || 1;
  for (let index = 0; index <= count; index++) {
    const target = (length * index) / count;
    while (segment < points.length - 1 && segmentStart + segmentLength < target) {
      segmentStart += segmentLength;
      segment++;
      segmentLength =
        Math.hypot(
          points[segment][0] - points[segment - 1][0],
          points[segment][1] - points[segment - 1][1],
        ) || 1;
    }
    const t = Math.max(0, Math.min(1, (target - segmentStart) / segmentLength));
    const from = points[segment - 1];
    const to = points[segment];
    result.push([from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t]);
  }
  return result;
}

/** Resample by arc length and apply a mild 1-2-3-2-1 smoothing. */
export function prepareScreenPath(input: PathPoint[]): ScreenPath | null {
  const points: PathPoint[] = [];
  for (const point of input) {
    if (!Number.isFinite(point[0]) || !Number.isFinite(point[1])) continue;
    const previous = points[points.length - 1];
    if (!previous || Math.hypot(point[0] - previous[0], point[1] - previous[1]) > 0.2) {
      points.push([point[0], point[1]]);
    }
  }
  if (points.length < 2) return null;
  let prepared = resample(points);
  for (let pass = 0; pass < 2; pass++) {
    const next: PathPoint[] = [prepared[0]];
    for (let index = 1; index < prepared.length - 1; index++) {
      const before = prepared[index - 1];
      const current = prepared[index];
      const after = prepared[index + 1];
      next.push([
        (before[0] + 2 * current[0] + after[0]) / 4,
        (before[1] + 2 * current[1] + after[1]) / 4,
      ]);
    }
    next.push(prepared[prepared.length - 1]);
    prepared = next;
  }
  const cumulative = [0];
  for (let index = 1; index < prepared.length; index++) {
    cumulative.push(
      cumulative[index - 1] +
        Math.hypot(
          prepared[index][0] - prepared[index - 1][0],
          prepared[index][1] - prepared[index - 1][1],
        ),
    );
  }
  const length = cumulative[cumulative.length - 1];
  if (!(length > 0.5)) return null;
  return { points: prepared, cumulative, length };
}

/**
 * Lay a name over [start, start + metrics.total] of the path, one glyph per
 * character. Returns null when the bend is too sharp to read.
 */
export function layoutTextAlongPath(
  path: ScreenPath,
  start: number,
  metrics: TextMetrics,
  options: { maxStep?: number; maxAngle?: number } = {},
): TextLayout | null {
  const maxStep = options.maxStep ?? MAX_STEP;
  const maxAngle = options.maxAngle ?? MAX_ANGLE;
  const total = metrics.total;
  if (!(path.length > 0) || total <= 0) return null;
  const from = Math.max(0, Math.min(path.length - total, start));
  if (!(from + total <= path.length + 0.05)) return null;
  const first = pointAt(path, from + 0.5);
  const last = pointAt(path, from + total - 0.5);
  const chord = Math.atan2(last[1] - first[1], last[0] - first[0]);
  const reverse = chord > Math.PI / 2 || chord < -Math.PI / 2;

  const glyphs: Glyph[] = [];
  let cursor = 0;
  let previous: number | null = null;
  let maxSeen = 0;
  let sum = 0;
  let steps = 0;
  for (let index = 0; index < metrics.chars.length; index++) {
    const advance = metrics.advances[index];
    const center = reverse ? from + total - (cursor + advance / 2) : from + cursor + advance / 2;
    const point = pointAt(path, center);
    let angle = tangentAt(path, center);
    if (reverse) angle += Math.PI;
    angle = normalizeAngle(angle);
    if (Math.abs(angle) > maxAngle) return null;
    if (previous !== null) {
      const step = Math.abs(normalizeAngle(angle - previous));
      if (step > maxStep) return null;
      maxSeen = Math.max(maxSeen, step);
      sum += step;
      steps++;
    }
    glyphs.push({
      ch: metrics.chars[index],
      x: point[0],
      y: point[1],
      angle,
      advance,
      box: glyphBox(point[0], point[1], angle, advance, metrics.fontSize),
    });
    previous = angle;
    cursor += advance;
  }
  if (!glyphs.length) return null;
  return {
    start: from,
    glyphs,
    box: unionBox(glyphs.map((glyph) => glyph.box)),
    maxStep: maxSeen,
    avgStep: steps ? sum / steps : 0,
  };
}

export function straightTextLayoutAt(
  point: PathPoint,
  direction: PathPoint,
  metrics: TextMetrics,
): { point: PathPoint; angle: number; box: TextBox } {
  let angle = Math.atan2(direction[1], direction[0]);
  if (angle > Math.PI / 2 || angle < -Math.PI / 2) angle = normalizeAngle(angle + Math.PI);
  return {
    point,
    angle,
    box: glyphBox(point[0], point[1], angle, metrics.total, metrics.fontSize),
  };
}

export function straightTextLayout(
  path: ScreenPath,
  metrics: TextMetrics,
): { point: PathPoint; angle: number; box: TextBox } {
  const distance = path.length / 2;
  const point = pointAt(path, distance);
  let angle = tangentAt(path, distance);
  if (angle > Math.PI / 2 || angle < -Math.PI / 2) angle = normalizeAngle(angle + Math.PI);
  return {
    point,
    angle,
    box: glyphBox(point[0], point[1], angle, metrics.total, metrics.fontSize),
  };
}

export type WindowOptions = {
  from?: number;
  to?: number;
  target?: number;
  maxStep?: number;
  centerWeight?: number;
  stepWeight?: number;
  step?: number;
  isVisible?: (box: TextBox) => boolean;
};

/** Pick the best text window in a range of the path. */
export function bestTextWindow(
  path: ScreenPath,
  metrics: TextMetrics,
  options: WindowOptions = {},
): TextLayout | null {
  const total = metrics.total;
  if (path.length < total + 8) return null;
  const first = Math.max(0, options.from ?? 0);
  const last = Math.min(path.length - total, options.to ?? path.length - total);
  if (first > last) return null;
  const step = options.step ?? 5;
  const target = options.target ?? path.length / 2;
  const centerWeight = options.centerWeight ?? 100;
  const stepWeight = options.stepWeight ?? 25;
  let best: TextLayout | null = null;
  let bestScore = Infinity;
  for (let start = first; start <= last; start += step) {
    const layout = layoutTextAlongPath(path, start, metrics, { maxStep: options.maxStep });
    if (!layout) continue;
    if (options.isVisible && !options.isVisible(layout.box)) continue;
    const center = start + total / 2;
    const score =
      (Math.abs(center - target) / Math.max(1, path.length)) * centerWeight +
      layout.maxStep * stepWeight +
      layout.avgStep * 8;
    if (score < bestScore) {
      bestScore = score;
      best = layout;
    }
  }
  return best;
}

/**
 * Try a few starts around the slot centre before scanning the whole range.
 * Most labels fit near the middle; a full scan is only needed when a bend
 * rejects every nearby window. This keeps the cache build linear in the number
 * of streets instead of quadratic in their length.
 */
function nearTextWindow(
  path: ScreenPath,
  metrics: TextMetrics,
  target: number,
  from: number,
  to: number,
  options: WindowOptions,
): TextLayout | null {
  const total = metrics.total;
  const centerStart = Math.max(from, Math.min(to, target - total / 2));
  const maxStep = options.maxStep ?? 0.55;
  const centerWeight = options.centerWeight ?? 90;
  const stepWeight = options.stepWeight ?? 18;
  let best: TextLayout | null = null;
  let bestScore = Infinity;
  for (const offset of [0, 10, -10, 25, -25, 45, -45]) {
    const start = centerStart + offset;
    if (start < from || start > to) continue;
    const layout = layoutTextAlongPath(path, start, metrics, { maxStep });
    if (!layout) continue;
    if (options.isVisible && !options.isVisible(layout.box)) continue;
    const center = start + total / 2;
    const score =
      (Math.abs(center - target) / Math.max(1, path.length)) * centerWeight +
      layout.maxStep * stepWeight +
      layout.avgStep * 8;
    if (score < bestScore) {
      bestScore = score;
      best = layout;
    }
  }
  if (best) return best;
  return bestTextWindow(path, metrics, {
    ...options,
    target,
    from,
    to,
    maxStep,
    centerWeight,
    stepWeight,
    step: options.step ?? 12,
  });
}

/**
 * Variant C: split a long street into up to four slots and place one label in
 * each. This gives repeated names on avenues and embankments without stacking
 * two labels on a short lane.
 */
export function multiTextWindows(
  path: ScreenPath,
  metrics: TextMetrics,
  options: WindowOptions = {},
): TextLayout[] {
  const total = metrics.total;
  if (path.length < total + 8) return [];
  const slots = Math.max(1, Math.min(4, Math.floor(path.length / (total * 1.7))));
  const slotLength = path.length / slots;
  const layouts: TextLayout[] = [];
  for (let index = 0; index < slots; index++) {
    const target = (index + 0.5) * slotLength;
    const from = Math.max(0, index * slotLength - total / 2);
    const to = Math.min(path.length - total, (index + 1) * slotLength - total / 2);
    if (from > to) continue;
    const layout = nearTextWindow(path, metrics, target, from, to, options);
    if (layout) layouts.push(layout);
  }
  return layouts.sort((a, b) => a.start - b.start);
}

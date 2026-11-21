/**
 * Uniform grid over feature bboxes. Layers are static once loaded, so a flat
 * cell → feature array beats a tree: no allocations during a query, no parent
 * pointers, and the cell list is one contiguous read.
 *
 * Queries return feature indices, repeat every frame (a drag repaints strips, a
 * preview repaint hits the visible cells again) and never allocate: both the
 * output and the dedupe marks live in typed arrays owned by the grid.
 */
import type { Bounds } from './types';

export type FeatureGrid = {
  readonly boxes: Float32Array;
  readonly cols: number;
  readonly rows: number;
  readonly minX: number;
  readonly minY: number;
  readonly cellX: number;
  readonly cellY: number;
  /** Feature positions of each cell, filled cell by cell. */
  readonly starts: Uint32Array;
  readonly items: Uint32Array;
  /** Features too wide to sit in a few cells; tested on every query. */
  readonly large: Uint32Array;
  /** Dedupe marks, one per position. */
  readonly stamps: Uint32Array;
  /** Query output, one entry per position. */
  readonly out: Uint32Array;
  /** Number of indexed positions. */
  readonly total: number;
  stamp: number;
};

/** Aim for this many features per cell; smaller cells mean more empty ones. */
const TARGET_PER_CELL = 12;
/** A feature covering more cells than this goes to the linear `large` list. */
const LARGE_SPAN = 16;
const MAX_CELLS = 512;
/**
 * Above this share of the layer the grid loses to a plain sequential pass: the
 * cells still return most features, and reading them in cell order costs more
 * cache misses than the scan costs comparisons.
 */
const LINEAR_SHARE = 0.2;

function clamp(value: number, low: number, high: number) {
  return value < low ? low : value > high ? high : value;
}

/**
 * Build the grid over `count` feature bboxes. Coordinates are lon/lat degrees;
 * the cell size is picked so that cells stay roughly square in metres at the
 * layer's latitude.
 */
export function buildFeatureGrid(boxes: Float32Array, count: number): FeatureGrid {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let position = 0; position < count; position++) {
    const offset = position * 4;
    if (boxes[offset] < minX) minX = boxes[offset];
    if (boxes[offset + 2] > maxX) maxX = boxes[offset + 2];
    if (boxes[offset + 1] < minY) minY = boxes[offset + 1];
    if (boxes[offset + 3] > maxY) maxY = boxes[offset + 3];
  }
  if (!Number.isFinite(minX) || !Number.isFinite(minY)) {
    minX = 0;
    minY = 0;
    maxX = 0;
    maxY = 0;
  }
  const width = Math.max(maxX - minX, 1e-6);
  const height = Math.max(maxY - minY, 1e-6);
  const midLat = (((minY + maxY) / 2) * Math.PI) / 180;
  const aspect = (width * Math.cos(midLat)) / height;
  const target = Math.max(1, count / TARGET_PER_CELL);
  const cols = Math.max(1, Math.min(MAX_CELLS, Math.round(Math.sqrt(target * aspect))));
  const rows = Math.max(1, Math.min(MAX_CELLS, Math.ceil(target / cols)));
  const cellX = width / cols;
  const cellY = height / rows;
  const cells = cols * rows;
  const counts = new Uint32Array(cells);
  let largeCount = 0;

  const spanOf = (position: number) => {
    const offset = position * 4;
    const x0 = clamp(Math.floor((boxes[offset] - minX) / cellX), 0, cols - 1);
    const x1 = clamp(Math.floor((boxes[offset + 2] - minX) / cellX), 0, cols - 1);
    const y0 = clamp(Math.floor((boxes[offset + 1] - minY) / cellY), 0, rows - 1);
    const y1 = clamp(Math.floor((boxes[offset + 3] - minY) / cellY), 0, rows - 1);
    return { x0, x1, y0, y1 };
  };

  for (let position = 0; position < count; position++) {
    const { x0, x1, y0, y1 } = spanOf(position);
    if ((x1 - x0 + 1) * (y1 - y0 + 1) > LARGE_SPAN * LARGE_SPAN) {
      largeCount++;
      continue;
    }
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) counts[y * cols + x]++;
  }

  const starts = new Uint32Array(cells + 1);
  let total = 0;
  for (let cell = 0; cell < cells; cell++) {
    starts[cell] = total;
    total += counts[cell];
  }
  starts[cells] = total;
  const items = new Uint32Array(total);
  const large = new Uint32Array(largeCount);
  const cursor = starts.slice(0, cells);
  let largeCursor = 0;
  for (let position = 0; position < count; position++) {
    const { x0, x1, y0, y1 } = spanOf(position);
    if ((x1 - x0 + 1) * (y1 - y0 + 1) > LARGE_SPAN * LARGE_SPAN) {
      large[largeCursor++] = position;
      continue;
    }
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) items[cursor[y * cols + x]++] = position;
  }

  return {
    boxes,
    cols,
    rows,
    minX,
    minY,
    cellX,
    cellY,
    starts,
    items,
    large,
    stamps: new Uint32Array(count),
    out: new Uint32Array(count),
    total: count,
    stamp: 0,
  };
}

type CellRange = { x0: number; x1: number; y0: number; y1: number; inside: boolean };

function cellRange(grid: FeatureGrid, view: Bounds): CellRange {
  const { cols, rows, minX, minY, cellX, cellY } = grid;
  const rawX0 = Math.floor((view.west - minX) / cellX);
  const rawX1 = Math.floor((view.east - minX) / cellX);
  const rawY0 = Math.floor((view.south - minY) / cellY);
  const rawY1 = Math.floor((view.north - minY) / cellY);
  const inside = rawX1 >= 0 && rawY1 >= 0 && rawX0 <= cols - 1 && rawY0 <= rows - 1;
  return inside
    ? {
        x0: clamp(rawX0, 0, cols - 1),
        x1: clamp(rawX1, 0, cols - 1),
        y0: clamp(rawY0, 0, rows - 1),
        y1: clamp(rawY1, 0, rows - 1),
        inside,
      }
    : { x0: 0, x1: -1, y0: 0, y1: -1, inside };
}

function coveredCandidates(grid: FeatureGrid, range: CellRange, starts: Uint32Array): number {
  if (!range.inside) return grid.large.length;
  let candidates = grid.large.length;
  for (let y = range.y0; y <= range.y1; y++) {
    const row = y * grid.cols;
    for (let x = range.x0; x <= range.x1; x++) candidates += starts[row + x + 1] - starts[row + x];
  }
  return candidates;
}

/**
 * True when the view covers so much of the layer that the sequential pass is
 * cheaper than walking the cells: the grid would still return most features,
 * and in cell order they cost more cache misses than the scan costs branches.
 */
export function gridCoversMost(grid: FeatureGrid, view: Bounds): boolean {
  return coveredCandidates(grid, cellRange(grid, view), grid.starts) > grid.total * LINEAR_SHARE;
}

/**
 * Collect the feature indices whose bbox intersects `view` into `grid.out`.
 * The result stays valid until the next query on the same grid.
 */
export function queryFeatureGrid(grid: FeatureGrid, view: Bounds): number {
  const { boxes, cols, starts, items, stamps, out } = grid;
  const stamp = ++grid.stamp;
  let count = 0;
  const accept = (position: number) => {
    if (stamps[position] === stamp) return;
    stamps[position] = stamp;
    const offset = position * 4;
    if (
      boxes[offset] <= view.east &&
      boxes[offset + 2] >= view.west &&
      boxes[offset + 1] <= view.north &&
      boxes[offset + 3] >= view.south
    )
      out[count++] = position;
  };

  const range = cellRange(grid, view);
  const { x0, x1, y0, y1, inside } = range;
  if (coveredCandidates(grid, range, starts) > grid.total * LINEAR_SHARE) {
    for (let position = 0; position < grid.total; position++) {
      const offset = position * 4;
      if (
        boxes[offset] <= view.east &&
        boxes[offset + 2] >= view.west &&
        boxes[offset + 1] <= view.north &&
        boxes[offset + 3] >= view.south
      )
        out[count++] = position;
    }
    return count;
  }

  if (inside)
    for (let y = y0; y <= y1; y++) {
      const row = y * cols;
      for (let x = x0; x <= x1; x++) {
        const cell = row + x;
        const end = starts[cell + 1];
        for (let item = starts[cell]; item < end; item++) accept(items[item]);
      }
    }
  for (let index = 0; index < grid.large.length; index++) accept(grid.large[index]);
  return count;
}

import type { Language } from '../i18n';
import { buildStreetLines, streetMinZoom, streetPriority, type StreetWay } from './street-labels';

/**
 * Screen-space street names for the canvas engine.
 *
 * Labels are not a bitmap of a fixed zoom: every frame the name is laid out
 * again along its OSM chain at the live (fractional) zoom, from a stable anchor
 * on the road. Collision uses one oriented box per label (SAT) and keeps the
 * previous frame's labels first, so a name does not blink because a neighbour
 * appeared nearby. The layer is drawn in its own canvas above the map.
 */

type Point = { x: number; y: number };
type Box = { minX: number; minY: number; maxX: number; maxY: number };
type Obb = {
  x: number;
  y: number;
  halfLength: number;
  halfHeight: number;
  cos: number;
  sin: number;
};

export type LabelCamera = { zoom: number; origin: Point };

type GlyphOp = {
  ch: string;
  x: number;
  y: number;
  angle: number;
  advance: number;
  size: number;
};

type Candidate = {
  key: string;
  ops: GlyphOp[];
  obb: Obb;
  box: Box;
  priority: number;
  length: number;
};

type Chain = {
  key: string;
  names: Record<string, string>;
  fallback: string;
  priority: number;
  minZoom: number;
  xs: Float64Array;
  ys: Float64Array;
  step: number;
  length: number;
  anchors: number[];
  bbox: Box;
};

type GlyphEntry = {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  cx: number;
  cy: number;
};
type Atlas = { canvas: HTMLCanvasElement; size: number; glyphs: Map<string, GlyphEntry> };

const WORLD = 256;
/** Resample step at z17: finer than a pixel at any usable zoom. */
const STEP = 4 / 2 ** 17;
const OBB_CELL = 40;
/** Above ~4k text calls per frame Canvas2D gets noticeably slower. */
const GLYPH_BUDGET = 1700;
const FONT = '"Helvetica Neue", "Segoe UI", Roboto, Arial, sans-serif';
const FILL = 'rgba(58, 68, 62, 0.8)';
const HALO = 'rgba(255, 254, 248, 0.9)';
const MAX_ANCHORS = 3;
const ATLAS_SIZE = 512;
/** Glyphs are rasterized at twice the CSS size so rotation does not blur them. */
const ATLAS_SCALE = 2;

function projectX(lng: number): number {
  return ((lng + 180) / 360) * WORLD;
}

function projectY(lat: number): number {
  const safe = Math.max(-85.0511287798, Math.min(85.0511287798, lat));
  const sin = Math.sin((safe * Math.PI) / 180);
  return (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * WORLD;
}

function labelSize(zoom: number): number {
  return Math.max(8.5, Math.min(12, 8.5 + Math.max(0, zoom - 14) * 0.7));
}

function resample(coords: [number, number][]): {
  xs: Float64Array;
  ys: Float64Array;
  step: number;
  length: number;
} | null {
  if (coords.length < 2) return null;
  const px: number[] = [];
  const py: number[] = [];
  for (const [lng, lat] of coords) {
    px.push(projectX(lng));
    py.push(projectY(lat));
  }
  let total = 0;
  for (let index = 1; index < px.length; index++)
    total += Math.hypot(px[index] - px[index - 1], py[index] - py[index - 1]);
  if (total < STEP * 4) return null;
  const count = Math.max(2, Math.ceil(total / STEP));
  const step = total / count;
  const xs = new Float64Array(count + 1);
  const ys = new Float64Array(count + 1);
  let segment = 1;
  let segmentStart = 0;
  let segmentLength = Math.hypot(px[1] - px[0], py[1] - py[0]) || Number.EPSILON;
  for (let index = 0; index <= count; index++) {
    const target = Math.min(total, index * step);
    while (segment < px.length - 1 && segmentStart + segmentLength < target) {
      segmentStart += segmentLength;
      segment++;
      segmentLength =
        Math.hypot(px[segment] - px[segment - 1], py[segment] - py[segment - 1]) || Number.EPSILON;
    }
    const t = Math.max(0, Math.min(1, (target - segmentStart) / segmentLength));
    xs[index] = px[segment - 1] + (px[segment] - px[segment - 1]) * t;
    ys[index] = py[segment - 1] + (py[segment] - py[segment - 1]) * t;
  }
  return { xs, ys, step, length: total };
}

function chainPoint(chain: Chain, distance: number): Point {
  const d = Math.max(0, Math.min(chain.length, distance));
  const raw = Math.min(chain.xs.length - 1 - 1e-6, d / chain.step);
  const index = Math.floor(raw);
  const t = raw - index;
  return {
    x: chain.xs[index] + (chain.xs[index + 1] - chain.xs[index]) * t,
    y: chain.ys[index] + (chain.ys[index + 1] - chain.ys[index]) * t,
  };
}

function chainAngle(chain: Chain, distance: number): number {
  const d = Math.max(0, Math.min(chain.length, distance));
  const pad = Math.min(chain.length * 0.5, chain.step * 2);
  const before = chainPoint(chain, d - pad);
  const after = chainPoint(chain, d + pad);
  return Math.atan2(after.y - before.y, after.x - before.x);
}

function bboxOf(xs: Float64Array, ys: Float64Array): Box {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let index = 0; index < xs.length; index++) {
    if (xs[index] < minX) minX = xs[index];
    if (xs[index] > maxX) maxX = xs[index];
    if (ys[index] < minY) minY = ys[index];
    if (ys[index] > maxY) maxY = ys[index];
  }
  return { minX, minY, maxX, maxY };
}

function labelObb(ops: GlyphOp[], size: number): Obb {
  const first = ops[0];
  const last = ops[ops.length - 1];
  const angle = ops.length > 1 ? Math.atan2(last.y - first.y, last.x - first.x) : first.angle;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  let minU = Infinity;
  let maxU = -Infinity;
  let minV = Infinity;
  let maxV = -Infinity;
  for (const op of ops) {
    const dx = op.x - first.x;
    const dy = op.y - first.y;
    const u = dx * cos + dy * sin;
    const v = -dx * sin + dy * cos;
    const halfU = op.advance / 2 + 2;
    const halfV = size * 0.6 + 2;
    minU = Math.min(minU, u - halfU);
    maxU = Math.max(maxU, u + halfU);
    minV = Math.min(minV, v - halfV);
    maxV = Math.max(maxV, v + halfV);
  }
  const centerU = (minU + maxU) / 2;
  const centerV = (minV + maxV) / 2;
  return {
    x: first.x + centerU * cos - centerV * sin,
    y: first.y + centerU * sin + centerV * cos,
    halfLength: (maxU - minU) / 2,
    halfHeight: (maxV - minV) / 2,
    cos,
    sin,
  };
}

function obbBounds(obb: Obb): Box {
  const extentX = obb.halfLength * Math.abs(obb.cos) + obb.halfHeight * Math.abs(obb.sin);
  const extentY = obb.halfLength * Math.abs(obb.sin) + obb.halfHeight * Math.abs(obb.cos);
  return {
    minX: obb.x - extentX,
    maxX: obb.x + extentX,
    minY: obb.y - extentY,
    maxY: obb.y + extentY,
  };
}

function axisOverlap(a: Obb, b: Obb, dx: number, dy: number, ax: number, ay: number): boolean {
  const distance = Math.abs(dx * ax + dy * ay);
  const radiusA =
    a.halfLength * Math.abs(a.cos * ax + a.sin * ay) +
    a.halfHeight * Math.abs(-a.sin * ax + a.cos * ay);
  const radiusB =
    b.halfLength * Math.abs(b.cos * ax + b.sin * ay) +
    b.halfHeight * Math.abs(-b.sin * ax + b.cos * ay);
  return distance <= radiusA + radiusB;
}

function obbOverlaps(a: Obb, b: Obb): boolean {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return (
    axisOverlap(a, b, dx, dy, a.cos, a.sin) &&
    axisOverlap(a, b, dx, dy, -a.sin, a.cos) &&
    axisOverlap(a, b, dx, dy, b.cos, b.sin) &&
    axisOverlap(a, b, dx, dy, -b.sin, b.cos)
  );
}

function cellKey(x: number, y: number): number {
  return (x + 4096) * 8192 + (y + 4096);
}

export class LiveStreetLabels {
  private chains: Chain[] = [];
  private source: GeoJSON.Feature[] | null = null;
  private metrics: CanvasRenderingContext2D;
  private advances = new Map<string, number>();
  private atlases = new Map<string, Atlas>();
  private chars = '';
  private charsLanguage: Language | null = null;
  private warmed = false;
  private lastRank = new Map<string, number>();

  constructor() {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) throw new Error('canvas 2d недоступен');
    this.metrics = context;
  }

  /** Free the glyph atlases when the layer is turned off. */
  release() {
    this.atlases.clear();
    this.chars = '';
    this.charsLanguage = null;
    this.warmed = false;
    this.lastRank.clear();
  }

  setSource(features: GeoJSON.Feature[]) {
    this.source = features;
    this.chains = [];
    this.atlases.clear();
    this.chars = '';
    this.charsLanguage = null;
    this.warmed = false;
    this.lastRank.clear();
  }

  private ensureChains() {
    if (this.chains.length || !this.source) return;
    const ways: StreetWay[] = [];
    for (const feature of this.source) {
      if (feature.properties?.kind !== 'road') continue;
      if (feature.geometry?.type !== 'LineString') continue;
      const properties = feature.properties as {
        class?: string;
        name?: string;
        names?: Record<string, string>;
      };
      const priority = streetPriority(properties.class);
      const names = properties.names ?? {};
      const name = names.ru || properties.name || '';
      if (priority === null || !name) continue;
      ways.push({
        name,
        names,
        fallback: name,
        coords: feature.geometry.coordinates as [number, number][],
        priority,
      });
    }
    const byName = new Map<
      string,
      {
        coords: [number, number][];
        names: Record<string, string>;
        fallback: string;
        priority: number;
        length: number;
      }[]
    >();
    for (const line of buildStreetLines(ways)) {
      if (line.length < 0.0003) continue;
      const group = byName.get(line.name);
      const item = {
        coords: line.coords,
        names: line.names,
        fallback: line.fallback,
        priority: line.priority,
        length: line.length,
      };
      if (group) group.push(item);
      else byName.set(line.name, [item]);
    }
    const chains: Chain[] = [];
    let index = 0;
    for (const group of byName.values()) {
      group.sort((a, b) => b.length - a.length);
      for (const line of group.slice(0, 3)) {
        const sampled = resample(line.coords);
        if (!sampled) continue;
        const pixelsAt17 = sampled.length * 2 ** 17;
        const slots = Math.max(1, Math.min(MAX_ANCHORS, Math.floor(pixelsAt17 / 150)));
        chains.push({
          key: `c${index++}`,
          names: line.names,
          fallback: line.fallback,
          priority: line.priority,
          minZoom: streetMinZoom(line.priority),
          xs: sampled.xs,
          ys: sampled.ys,
          step: sampled.step,
          length: sampled.length,
          anchors: Array.from({ length: slots }, (_, slot) => (slot + 0.5) / slots),
          bbox: bboxOf(sampled.xs, sampled.ys),
        });
      }
    }
    chains.sort((a, b) => b.priority - a.priority || b.length - a.length);
    this.chains = chains;
  }

  private setLanguageChars(language: Language) {
    if (this.charsLanguage === language) return;
    this.charsLanguage = language;
    this.atlases.clear();
    this.warmed = false;
    const chars = new Set<string>(['?']);
    for (const chain of this.chains) {
      const text = chain.names[language] || chain.fallback;
      for (const char of text) chars.add(char);
      for (const char of chain.fallback) chars.add(char);
    }
    this.chars = [...chars].sort().join('');
  }

  private buildAtlas(size: number, layer: 'halo' | 'fill'): Atlas {
    const canvas = document.createElement('canvas');
    canvas.width = ATLAS_SIZE;
    canvas.height = ATLAS_SIZE;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('canvas 2d недоступен');
    context.font = `${size * ATLAS_SCALE}px ${FONT}`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.lineJoin = 'round';
    const haloPx = Math.max(2, size * 0.34) * ATLAS_SCALE;
    const pad = Math.ceil(haloPx / 2 + 2 * ATLAS_SCALE);
    const glyphs = new Map<string, GlyphEntry>();
    let x = 0;
    let y = 0;
    let rowHeight = 0;
    for (const char of this.chars) {
      const advance = context.measureText(char).width;
      const textHeight = size * 1.55 * ATLAS_SCALE;
      const sw = Math.ceil(advance) + pad * 2;
      const sh = Math.ceil(textHeight) + pad * 2;
      if (x + sw > ATLAS_SIZE) {
        x = 0;
        y += rowHeight;
        rowHeight = 0;
      }
      if (y + sh > ATLAS_SIZE) {
        console.warn(`атлас подписей ${size}px переполнен на «${char}»`);
        break;
      }
      const glyphX = x + pad + advance / 2;
      const glyphY = y + pad + textHeight / 2;
      if (layer === 'halo') {
        context.strokeStyle = HALO;
        context.lineWidth = haloPx;
        context.strokeText(char, glyphX, glyphY);
      } else {
        context.fillStyle = FILL;
        context.fillText(char, glyphX, glyphY);
      }
      glyphs.set(char, {
        sx: x,
        sy: y,
        sw,
        sh,
        cx: pad + advance / 2,
        cy: pad + textHeight / 2,
      });
      x += sw;
      rowHeight = Math.max(rowHeight, sh);
    }
    return { canvas, size, glyphs };
  }

  private atlasFor(size: number, layer: 'halo' | 'fill'): Atlas {
    const quantized = Math.round(Math.max(8, Math.min(12, size)) * 2) / 2;
    const key = `${quantized}:${layer}`;
    let atlas = this.atlases.get(key);
    if (!atlas) {
      atlas = this.buildAtlas(quantized, layer);
      this.atlases.set(key, atlas);
    }
    return atlas;
  }

  private warmup() {
    if (this.warmed) return;
    this.warmed = true;
    for (let size = 8.5; size <= 12; size += 0.5) {
      this.atlasFor(size, 'halo');
      this.atlasFor(size, 'fill');
    }
  }

  private advancesFor(text: string, size: number): number[] {
    const sizeKey = Math.round(size * 20);
    this.metrics.font = `${size}px ${FONT}`;
    const result: number[] = [];
    for (const char of text) {
      const key = `${sizeKey}:${char}`;
      let advance = this.advances.get(key);
      if (advance === undefined) {
        advance = this.metrics.measureText(char).width;
        this.advances.set(key, advance);
      }
      result.push(advance);
    }
    return result;
  }

  private layout(
    chain: Chain,
    text: string,
    anchor: number,
    advances: number[],
    size: number,
    zoom: number,
    origin: Point,
  ): { ops: GlyphOp[]; obb: Obb; box: Box } | null {
    const total = advances.reduce((sum, value) => sum + value, 0);
    const k = 2 ** zoom;
    const chainPixels = chain.length * k;
    if (total > chainPixels - 8) return null;
    const span = total / k;
    const start = Math.max(0, Math.min(chain.length - span, anchor * chain.length - span / 2));
    const middle = start + span / 2;
    const reversed = Math.cos(chainAngle(chain, middle)) < 0;
    const chars = [...text];
    const ops: GlyphOp[] = [];
    const box: Box = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
    let cursor = 0;
    for (let index = 0; index < advances.length; index++) {
      const advance = advances[index];
      const distance = reversed
        ? start + (total - cursor - advance / 2) / k
        : start + (cursor + advance / 2) / k;
      const point = chainPoint(chain, distance);
      let angle = chainAngle(chain, distance);
      if (reversed) angle += Math.PI;
      const x = point.x * k - origin.x;
      const y = point.y * k - origin.y;
      ops.push({ ch: chars[index] ?? '', x, y, angle, advance, size });
      cursor += advance;

      const halfWidth = advance / 2 + 1.5;
      const halfHeight = size * 0.6;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      for (const [dx, dy] of [
        [-halfWidth, -halfHeight],
        [halfWidth, -halfHeight],
        [halfWidth, halfHeight],
        [-halfWidth, halfHeight],
      ]) {
        const px = x + dx * cos - dy * sin;
        const py = y + dx * sin + dy * cos;
        box.minX = Math.min(box.minX, px);
        box.minY = Math.min(box.minY, py);
        box.maxX = Math.max(box.maxX, px);
        box.maxY = Math.max(box.maxY, py);
      }
    }
    return { ops, obb: labelObb(ops, size), box };
  }

  draw(
    context: CanvasRenderingContext2D,
    camera: LabelCamera,
    width: number,
    height: number,
    language: Language,
    dpr: number,
  ) {
    this.ensureChains();
    this.setLanguageChars(language);
    const size = labelSize(camera.zoom);
    const k = 2 ** camera.zoom;
    const candidates: Candidate[] = [];
    for (const chain of this.chains) {
      if (camera.zoom < chain.minZoom - 0.4) continue;
      const minX = chain.bbox.minX * k - camera.origin.x;
      const maxX = chain.bbox.maxX * k - camera.origin.x;
      const minY = chain.bbox.minY * k - camera.origin.y;
      const maxY = chain.bbox.maxY * k - camera.origin.y;
      if (maxX < -80 || minX > width + 80 || maxY < -60 || minY > height + 60) continue;
      const text = chain.names[language] || chain.fallback;
      if (!text) continue;
      const advances = this.advancesFor(text, size);
      for (let index = 0; index < chain.anchors.length; index++) {
        const layout = this.layout(
          chain,
          text,
          chain.anchors[index],
          advances,
          size,
          camera.zoom,
          camera.origin,
        );
        if (!layout) continue;
        if (
          layout.box.maxX < -20 ||
          layout.box.minX > width + 20 ||
          layout.box.maxY < -20 ||
          layout.box.minY > height + 20
        )
          continue;
        candidates.push({
          key: `${chain.key}:${index}`,
          ops: layout.ops,
          obb: layout.obb,
          box: layout.box,
          priority: chain.priority,
          length: chain.length,
        });
      }
    }
    candidates.sort((a, b) => {
      const rankA = this.lastRank.get(a.key);
      const rankB = this.lastRank.get(b.key);
      if (rankA !== undefined || rankB !== undefined) {
        if (rankA === undefined) return 1;
        if (rankB === undefined) return -1;
        if (rankA !== rankB) return rankA - rankB;
      }
      return b.priority - a.priority || b.length - a.length;
    });

    const grid = new Map<number, Obb[]>();
    const accepted: Candidate[] = [];
    let glyphs = 0;
    for (const candidate of candidates) {
      if (glyphs + candidate.ops.length > GLYPH_BUDGET) continue;
      const bounds = obbBounds(candidate.obb);
      const minX = Math.floor(bounds.minX / OBB_CELL);
      const maxX = Math.floor(bounds.maxX / OBB_CELL);
      const minY = Math.floor(bounds.minY / OBB_CELL);
      const maxY = Math.floor(bounds.maxY / OBB_CELL);
      let fits = true;
      for (let x = minX; x <= maxX && fits; x++) {
        for (let y = minY; y <= maxY && fits; y++) {
          const bucket = grid.get(cellKey(x, y));
          if (!bucket) continue;
          for (const other of bucket)
            if (obbOverlaps(candidate.obb, other)) {
              fits = false;
              break;
            }
        }
      }
      if (!fits) continue;
      for (let x = minX; x <= maxX; x++) {
        for (let y = minY; y <= maxY; y++) {
          const key = cellKey(x, y);
          const bucket = grid.get(key);
          if (bucket) bucket.push(candidate.obb);
          else grid.set(key, [candidate.obb]);
        }
      }
      accepted.push(candidate);
      glyphs += candidate.ops.length;
    }
    this.lastRank = new Map(accepted.map((label, index) => [label.key, index]));

    const visible: { candidate: Candidate; alpha: number }[] = accepted.map((candidate) => ({
      candidate,
      alpha: 1,
    }));

    this.warmup();
    context.save();
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    for (const layer of ['halo', 'fill'] as const) {
      for (const { candidate, alpha } of visible) {
        context.globalAlpha = alpha >= 0.999 ? 1 : alpha;
        for (const op of candidate.ops) {
          const atlas = this.atlasFor(op.size, layer);
          const glyph = atlas.glyphs.get(op.ch) ?? atlas.glyphs.get('?');
          if (!glyph) continue;
          const scale = op.size / atlas.size;
          const dx = (glyph.cx / ATLAS_SCALE) * scale;
          const dy = (glyph.cy / ATLAS_SCALE) * scale;
          const dw = (glyph.sw / ATLAS_SCALE) * scale;
          const dh = (glyph.sh / ATLAS_SCALE) * scale;
          context.translate(op.x, op.y);
          context.rotate(op.angle);
          context.drawImage(atlas.canvas, glyph.sx, glyph.sy, glyph.sw, glyph.sh, -dx, -dy, dw, dh);
          context.rotate(-op.angle);
          context.translate(-op.x, -op.y);
        }
      }
    }
    context.globalAlpha = 1;
    context.restore();
  }
}

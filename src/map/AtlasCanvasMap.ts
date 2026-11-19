import type { Geometry } from 'geojson';
import type { Building } from '../types';
import type { Language } from '../i18n';
import { period, periodsFor } from '../domain';
import { landmarkSvg } from './landmark';
import { LiveStreetLabels } from './live-street-labels';
import {
  WORLD_SIZE,
  bboxIntersects,
  eachPolygonRing,
  featureBounds,
  metersPerPixel,
  pickTapTarget,
  project,
  tapRadiusDegrees,
  unproject,
  unprojectX,
  unprojectY,
} from './geometry';
import type { BBox, Bounds, LatLng, OutlineBinary, Point } from './types';

export interface AtlasLayerVisibility {
  roads: boolean;
  water: boolean;
  green: boolean;
  landmarks: boolean;
  detailedStreets: boolean;
}

export interface AtlasCanvasOptions {
  center: LatLng;
  zoom: number;
  minZoom?: number;
  maxZoom?: number;
  zoomSnap?: number;
  onSelect: (id: string) => void;
  onViewChange?: (center: LatLng, zoom: number) => void;
}

type Camera = { center: LatLng; zoom: number };
type Rect = { x: number; y: number; w: number; h: number };
type RenderedCamera = Camera & { origin: Point };
type AtlasLook = {
  selected: boolean;
  boundary: boolean;
  highlighted: boolean;
  matched: boolean;
  hovered: boolean;
  fillColor: string;
};
type AtlasEntry = {
  building: Building;
  geometry: Geometry | null;
  bbox: BBox;
  /** Labels of every construction period the building overlaps. */
  periodLabels: string[];
  /** Colour of the earliest of those periods. */
  fillColor: string;
};
type MarkerEntry = { feature: GeoJSON.Feature; element: HTMLDivElement; lat: number; lng: number };
type PositionShape = { lat: number; lng: number; accuracy: number };
/**
 * Label collision uses finer cells than the old point-per-street grid: a
 * curved name covers several boxes, and the denser grid is what makes variant
 * C's repeated labels fit between neighbours.
 */
type DragSession = {
  startX: number;
  startY: number;
  startCenter: LatLng;
  zoom: number;
  moved: boolean;
  pointerId: number;
  onMarker: boolean;
};
type PinchSession = { startDistance: number; anchorWorld: Point; startZoom: number };
type BaseGroups = { green: number[]; water: number[]; roads: number[]; landmarks: number[] };
type RoadGroups = { major: number[]; secondary: number[]; minor: number[] };

const MAX_CANVAS_PIXELS = 11_000_000;
const CANVAS_PADDING = 0.15;
const DOT_THRESHOLD = 1.15;
const MIN_DRAG = 3;
/**
 * A finger lands within roughly 2.5-3 mm of the aim point; at typical phone CSS
 * density that is about 14 px. A mouse is far more precise, and the same halo
 * would make the map sticky, so it gets a much smaller one.
 */
const TAP_SLOP_TOUCH_PX = 14;
const TAP_SLOP_MOUSE_PX = 5;
/**
 * Zoom is continuous while the user is pinching or scrolling. The canvas is
 * only repainted from a coarser camera when it drifts far enough from the
 * bitmap on screen: inside these bounds the CSS transform still has enough
 * resolution for the motion to look continuous. Zooming out also has to keep
 * the padded canvas covering the viewport, hence the tighter bound.
 */
const PREVIEW_ZOOM_IN = 0.85;
const PREVIEW_ZOOM_OUT = 0.3;
/** Backing-store scale of a preview repaint; 1 is the full device ratio. */
const PREVIEW_DPR_SCALE = 0.6;
/** Preview canvases stay near this many pixels no matter how large the map is. */
const PREVIEW_PIXEL_BUDGET = 1_000_000;
/** Do not repaint previews more often than this while a gesture is running. */
const PREVIEW_MIN_INTERVAL_MS = 120;
/**
 * A preview that takes longer than this is not worth repeating on every level:
 * zooming in then keeps the scaled bitmap (a little softer) instead of dropping
 * frames, while the full pass after the gesture restores sharpness. Zooming out
 * still refreshes because otherwise the canvas stops covering the viewport.
 */
const PREVIEW_SLOW_MS = 24;
/** Wheel bursts start a new zoom baseline after this much silence. */
const WHEEL_BURST_GAP_MS = 160;
/** A wheel can cross several levels quickly; refresh before the bitmap is a blur. */
const WHEEL_PREVIEW_ZOOM = 1;
/** How long to wait for the compatibility click that follows a selecting tap. */
const TAP_CLICK_GUARD_MS = 200;
const DEFAULT_VISIBILITY: AtlasLayerVisibility = {
  roads: true,
  water: true,
  green: true,
  landmarks: false,
  detailedStreets: false,
};

function outlineScale(zoom: number) {
  return Math.max(0, Math.min(1, (zoom - 13.5) / 3.5));
}
function darken(hex: string, amount: number) {
  const value = parseInt(hex.slice(1), 16),
    mix = (channel: number) => Math.round(channel * (1 - amount));
  return `#${((mix((value >> 16) & 255) << 16) | (mix((value >> 8) & 255) << 8) | mix(value & 255)).toString(16).padStart(6, '0')}`;
}
function atlasStyle(look: AtlasLook, zoom: number) {
  const scale = outlineScale(zoom),
    dimmed = look.highlighted && !look.matched,
    preview = look.hovered && !look.selected && !look.boundary;
  const weight = look.selected
    ? 1 + 2 * scale
    : look.boundary
      ? Math.max(0.8, 2 * scale)
      : 1.2 * scale;
  return {
    color: look.selected ? '#244c3c' : look.boundary ? '#8a5a2b' : '#ffffff',
    weight,
    dash: look.boundary ? (scale < 0.5 ? [4, 3] : [6, 4]) : null,
    fillColor: preview ? darken(look.fillColor, 0.3) : look.fillColor,
    fillOpacity: dimmed ? 0.12 : look.boundary ? 0.28 : preview ? 1 : 0.92,
    opacity: dimmed ? 0.25 : 1,
  };
}
function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}
function wheelDelta(event: WheelEvent) {
  if (event.deltaY && event.deltaMode === 0) {
    const dpr = window.devicePixelRatio > 0 ? 2 * window.devicePixelRatio : 1;
    return -event.deltaY / dpr;
  }
  if (event.deltaY && event.deltaMode === 1) return -event.deltaY * 20;
  if (event.deltaY && event.deltaMode === 2) return -event.deltaY * 60;
  return 0;
}
/** Signed number of zoom levels for the raw wheel travel of one burst. */
function wheelZoomAmount(raw: number) {
  const amount = (4 * Math.log(2 / (1 + Math.exp(-Math.abs(raw) / 240)))) / Math.LN2;
  return amount * Math.sign(raw);
}
function makeCanvas(className: string) {
  const canvas = document.createElement('canvas');
  canvas.className = className;
  canvas.setAttribute('aria-hidden', 'true');
  return canvas;
}
function geometryIsArea(geometry: Geometry): boolean {
  return (
    geometry.type === 'Polygon' ||
    geometry.type === 'MultiPolygon' ||
    geometry.type === 'GeometryCollection'
  );
}
/**
 * Small Canvas 2D map used by the alternative atlas renderer. It implements
 * only the interaction set the atlas needs: one raster layer for the basemap
 * and building outlines, one for atlas shapes/labels, drag, wheel/pinch zoom,
 * hit testing and marker tooltips. It has no third-party map state.
 */
export class AtlasCanvasMap {
  private readonly container: HTMLElement;
  private readonly pan: HTMLDivElement;
  private readonly baseCanvas: HTMLCanvasElement;
  private readonly overlayCanvas: HTMLCanvasElement;
  private readonly previewCanvas: HTMLCanvasElement;
  private readonly markersLayer: HTMLDivElement;
  private readonly tooltip: HTMLDivElement;
  private readonly baseCtx: CanvasRenderingContext2D | null;
  private readonly overlayCtx: CanvasRenderingContext2D | null;
  private readonly previewCtx: CanvasRenderingContext2D | null;
  private labelCanvas: HTMLCanvasElement | null = null;
  private labelCtx: CanvasRenderingContext2D | null = null;
  private readonly liveLabels = new LiveStreetLabels();
  private readonly onSelect: (id: string) => void;
  private readonly onViewChange?: (center: LatLng, zoom: number) => void;
  private readonly minZoom: number;
  private readonly maxZoom: number;
  private readonly zoomSnap: number;
  private readonly resizeObserver: ResizeObserver;
  private size: Point = { x: 1, y: 1 };
  private padding: Point = { x: 0, y: 0 };
  private dpr = 1;
  /** Ratio used by the draw calls currently running (full or preview). */
  private pixelRatio = 1;
  private preview = false;
  private lastPreviewAt = 0;
  private previewCost = 0;
  private renderRaf: number | null = null;
  private renderTimer: number | null = null;
  private view: Camera;
  private rendered: RenderedCamera | null = null;
  private baseFeatures: GeoJSON.Feature[] = [];
  private baseBoxes: Float32Array | null = null;
  private baseGroups: BaseGroups = { green: [], water: [], roads: [], landmarks: [] };
  private roadGroups: RoadGroups = { major: [], secondary: [], minor: [] };
  private outlineFeatures: GeoJSON.Feature[] = [];
  private outlineBinary: OutlineBinary | null = null;
  private outlineBoxes: Float32Array | null = null;
  private atlasSource: Building[] | null = null;
  private atlasEntries: AtlasEntry[] = [];
  private selectedId: string | null = null;
  private selectedPeriods: string[] = [];
  private hoveredPeriod: string | null = null;
  private language: Language = 'ru';
  private visibility: AtlasLayerVisibility = { ...DEFAULT_VISIBILITY };
  private buildingsVisible = false;
  private position: PositionShape | null = null;
  private markers: MarkerEntry[] = [];
  private raf: number | null = null;
  private animating = false;
  private wheelRaf: number | null = null;
  private wheelTargetZoom: number | null = null;
  private wheelBurst = 0;
  private wheelBurstZoom = 0;
  private lastWheelAt = 0;
  private wheelPoint: Point = { x: 0, y: 0 };
  private pointers = new Map<number, Point>();
  private drag: DragSession | null = null;
  private pinch: PinchSession | null = null;
  private tooltipVisible = false;
  private destroyed = false;
  private suppressClick = false;
  private tapClickGuard: {
    onClick: (event: MouseEvent) => void;
    onPointerDown: () => void;
    timer: number;
  } | null = null;

  constructor(container: HTMLElement, options: AtlasCanvasOptions) {
    this.container = container;
    this.container.classList.add('atlas-map-host');
    this.minZoom = options.minZoom ?? 10;
    this.maxZoom = options.maxZoom ?? 19;
    this.zoomSnap = options.zoomSnap ?? 0.5;
    this.onSelect = options.onSelect;
    this.onViewChange = options.onViewChange;
    this.view = {
      center: { ...options.center },
      zoom: clamp(options.zoom, this.minZoom, this.maxZoom),
    };
    this.pan = document.createElement('div');
    this.pan.className = 'atlas-map-pan';
    this.baseCanvas = makeCanvas('atlas-map-base');
    this.overlayCanvas = makeCanvas('atlas-map-overlay');
    this.previewCanvas = makeCanvas('atlas-map-preview');
    this.previewCanvas.style.display = 'none';
    this.markersLayer = document.createElement('div');
    this.markersLayer.className = 'atlas-map-markers';
    this.markersLayer.style.display = 'none';
    this.baseCtx = this.baseCanvas.getContext('2d');
    this.overlayCtx = this.overlayCanvas.getContext('2d');
    this.previewCtx = this.previewCanvas.getContext('2d');
    this.tooltip = document.createElement('div');
    this.tooltip.className = 'atlas-map-tooltip';
    this.tooltip.setAttribute('role', 'tooltip');
    this.pan.append(this.baseCanvas, this.overlayCanvas, this.previewCanvas);
    // Markers are screen-space as well: keeping them outside the scaled pan
    // both keeps icons fixed-size and puts them above the street labels.
    this.container.append(this.pan, this.markersLayer, this.tooltip);
    this.container.tabIndex = this.container.tabIndex < 0 ? 0 : this.container.tabIndex;
    this.attachEvents();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.container);
    this.resize();
  }

  /** Replace all basemap vector features (roads, water, parks, landmarks). */
  setBasemap(collection: GeoJSON.FeatureCollection) {
    this.baseFeatures = collection.features;
    this.liveLabels.setSource(this.baseFeatures);
    this.baseBoxes = this.computeBoxes(this.baseFeatures);
    const groups: BaseGroups = { green: [], water: [], roads: [], landmarks: [] };
    for (let index = 0; index < this.baseFeatures.length; index++) {
      const kind = this.baseFeatures[index].properties?.kind;
      if (kind === 'green') groups.green.push(index);
      else if (kind === 'water') groups.water.push(index);
      else if (kind === 'road') groups.roads.push(index);
      else if (kind === 'landmark') groups.landmarks.push(index);
    }
    this.baseGroups = groups;
    this.roadGroups = { major: [], secondary: [], minor: [] };
    for (let index = 0; index < this.baseFeatures.length; index++) {
      if (this.baseFeatures[index].properties?.kind !== 'road') continue;
      const roadClass = String(this.baseFeatures[index].properties?.class ?? '');
      if (roadClass === 'motorway' || roadClass === 'trunk' || roadClass === 'primary')
        this.roadGroups.major.push(index);
      else if (roadClass === 'secondary') this.roadGroups.secondary.push(index);
      else this.roadGroups.minor.push(index);
    }
    this.markers = [];
    this.markersLayer.replaceChildren();
    for (const feature of this.baseFeatures) {
      if (feature.properties?.kind !== 'landmark' || feature.geometry?.type !== 'Point') continue;
      const [lng, lat] = feature.geometry.coordinates as [number, number];
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      const element = document.createElement('div');
      element.className = 'atlas-map-marker landmark-icon';
      element.append(landmarkSvg(String(feature.properties?.category ?? 'museum')));
      element.setAttribute('role', 'img');
      element.tabIndex = -1;
      // Hover is handled by the marker, but pointerdown/move must bubble to the
      // map so that a pinch can start with one finger on a landmark icon.
      element.addEventListener('pointerenter', (event) => {
        if (this.pointers.size) return;
        event.stopPropagation();
        this.showMarkerTooltip(feature);
      });
      element.addEventListener('pointermove', (event) => {
        if (this.pointers.size) return;
        event.stopPropagation();
        this.showMarkerTooltip(feature);
      });
      element.addEventListener('pointerleave', () => {
        if (!this.pointers.size) this.hideTooltip();
      });
      element.addEventListener('click', (event) => event.stopPropagation());
      this.markers.push({ feature, element, lat, lng });
      this.markersLayer.append(element);
    }
    this.markersLayer.style.display = this.visibility.landmarks ? '' : 'none';
    this.updateMarkerLabels();
    this.renderBase();
    this.repositionMarkers();
    this.renderOverlay();
    this.renderLabels();
  }

  /** Set the filtered atlas building shapes and the visual filter state. */
  setAtlas(
    buildings: Building[],
    selected: string | null,
    selectedPeriods: string[],
    hoveredPeriod: string | null,
  ) {
    if (this.atlasSource !== buildings) {
      this.atlasSource = buildings;
      this.atlasEntries = [];
      for (const building of buildings) {
        const bbox = building.geometry
          ? featureBounds({
              type: 'Feature',
              properties: {},
              geometry: building.geometry,
            } as GeoJSON.Feature)
          : null;
        if (bbox) {
          const buildingPeriods = periodsFor(building.minYear, building.maxYear);
          this.atlasEntries.push({
            building,
            geometry: building.geometry ?? null,
            bbox,
            periodLabels: buildingPeriods.map((p) => p.label),
            fillColor: period(building.minYear, building.maxYear).color,
          });
        }
      }
    }
    this.selectedId = selected;
    this.selectedPeriods = selectedPeriods;
    this.hoveredPeriod = hoveredPeriod;
    this.renderOverlay();
  }

  setLanguage(language: Language) {
    if (this.language === language) return;
    this.language = language;
    this.hideTooltip();
    this.updateMarkerLabels();
    this.renderOverlay();
    this.renderLabels();
  }

  setLayerVisibility(visibility: AtlasLayerVisibility) {
    const previous = this.visibility;
    this.visibility = { ...visibility };
    this.markersLayer.style.display = visibility.landmarks ? '' : 'none';
    if (
      previous.roads !== visibility.roads ||
      previous.water !== visibility.water ||
      previous.green !== visibility.green ||
      previous.landmarks !== visibility.landmarks
    )
      this.renderBase();
    if (previous.landmarks !== visibility.landmarks) this.repositionMarkers();
    if (previous.landmarks !== visibility.landmarks) this.renderOverlay();
    if (previous.detailedStreets !== visibility.detailedStreets) {
      if (visibility.detailedStreets) this.renderLabels();
      else this.releaseLabelCanvas();
    }
  }

  setBuildingsVisible(visible: boolean) {
    if (this.buildingsVisible === visible) return;
    this.buildingsVisible = visible;
    this.renderBase();
  }

  /** Building outlines are stored as feature objects + a packed bbox array. */
  setBuildingOutlines(features: GeoJSON.Feature[] | null) {
    this.outlineFeatures = features ?? [];
    this.outlineBinary = null;
    this.outlineBoxes = features ? this.computeBoxes(features) : null;
    if (this.buildingsVisible) this.renderBase();
  }

  /** Compact outlines from building-outlines.bin: typed arrays, no GeoJSON objects. */
  setBuildingOutlinesBinary(binary: OutlineBinary | null) {
    this.outlineFeatures = [];
    this.outlineBinary = binary;
    this.outlineBoxes = binary?.boxes ?? null;
    if (this.buildingsVisible) this.renderBase();
  }

  setPosition(position: PositionShape | null) {
    this.position = position;
    this.renderOverlay();
  }

  getZoom() {
    return this.view.zoom;
  }
  getCenter() {
    return { ...this.view.center };
  }

  zoomIn() {
    this.setView(this.view.center, this.clampZoom(this.view.zoom + 1), {
      animate: true,
      duration: 220,
    });
  }
  zoomOut() {
    this.setView(this.view.center, this.clampZoom(this.view.zoom - 1), {
      animate: true,
      duration: 220,
    });
  }

  setView(center: LatLng, zoom: number, options: { animate?: boolean; duration?: number } = {}) {
    this.stopWheel();
    const nextZoom = this.clampZoom(zoom);
    const next = { center: { lat: clamp(center.lat, -85, 85), lng: center.lng }, zoom: nextZoom };
    const distance =
      Math.abs(next.zoom - this.view.zoom) +
      Math.abs(next.center.lat - this.view.center.lat) * 1000 +
      Math.abs(next.center.lng - this.view.center.lng) * 1000;
    if (distance < 1e-9) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!options.animate || reduced || !this.rendered) {
      this.stopAnimation(false);
      this.view = next;
      this.renderAll();
      return;
    }
    this.animateTo(next, options.duration ?? 260);
  }

  flyTo(center: LatLng, zoom: number, duration = 450) {
    this.setView(center, zoom, { animate: true, duration });
  }

  fitBounds(
    bounds: Bounds,
    options: { maxZoom?: number; animate?: boolean; duration?: number } = {},
  ) {
    if (!this.size.x || !this.size.y || !boundsIsFinite(bounds)) return;
    const northWest = project(bounds.north, bounds.west, 0),
      southEast = project(bounds.south, bounds.east, 0);
    const width = Math.abs(southEast.x - northWest.x),
      height = Math.abs(southEast.y - northWest.y);
    if (!(width > 0) && !(height > 0)) {
      this.setView(
        { lat: (bounds.north + bounds.south) / 2, lng: (bounds.east + bounds.west) / 2 },
        Math.min(options.maxZoom ?? this.maxZoom, this.maxZoom),
        { animate: options.animate, duration: options.duration },
      );
      return;
    }
    const availableWidth = Math.max(1, this.size.x),
      availableHeight = Math.max(1, this.size.y);
    const scale = Math.min(
      availableWidth / Math.max(width, 1e-9),
      availableHeight / Math.max(height, 1e-9),
    );
    let zoom = Math.log2(Math.max(scale, 1e-9));
    if (this.zoomSnap > 0) zoom = Math.floor(zoom / this.zoomSnap) * this.zoomSnap;
    zoom = clamp(zoom, this.minZoom, options.maxZoom ?? this.maxZoom);
    const center = unproject((northWest.x + southEast.x) / 2, (northWest.y + southEast.y) / 2, 0);
    this.setView(center, zoom, { animate: options.animate, duration: options.duration });
  }

  reset(bounds: Bounds | null) {
    if (
      bounds &&
      Number.isFinite(bounds.west) &&
      Number.isFinite(bounds.south) &&
      bounds.west <= bounds.east &&
      bounds.south <= bounds.north
    ) {
      const padded = padBounds(bounds, 0.08);
      this.fitBounds(padded, { animate: true, duration: 450 });
    } else {
      this.setView({ lat: 41.715, lng: 44.8 }, 11.5, { animate: true, duration: 450 });
    }
  }

  destroy() {
    this.destroyed = true;
    this.stopAnimation(false);
    this.stopWheel();
    this.cancelScheduledRender();
    this.releaseTapClickGuard();
    this.resizeObserver.disconnect();
    this.detachEvents();
    this.container.replaceChildren();
  }

  private computeBoxes(features: GeoJSON.Feature[]): Float32Array {
    const boxes = new Float32Array(features.length * 4);
    for (let index = 0; index < features.length; index++) {
      const box = featureBounds(features[index]);
      if (!box) {
        boxes[index * 4] = Infinity;
        boxes[index * 4 + 1] = Infinity;
        boxes[index * 4 + 2] = -Infinity;
        boxes[index * 4 + 3] = -Infinity;
        continue;
      }
      boxes[index * 4] = box.minX;
      boxes[index * 4 + 1] = box.minY;
      boxes[index * 4 + 2] = box.maxX;
      boxes[index * 4 + 3] = box.maxY;
    }
    return boxes;
  }

  /** Gestures stay fractional while moving; the final crisp pass snaps. */
  private clampZoom(zoom: number) {
    return clamp(zoom, this.minZoom, this.maxZoom);
  }

  private originFor(camera: Camera): Point {
    const point = project(camera.center.lat, camera.center.lng, camera.zoom);
    return { x: point.x - this.size.x / 2, y: point.y - this.size.y / 2 };
  }

  private resize() {
    if (this.destroyed) return;
    const width = Math.max(1, this.container.clientWidth),
      height = Math.max(1, this.container.clientHeight);
    if (width === this.size.x && height === this.size.y && this.rendered) return;
    this.stopAnimation(false);
    this.stopWheel();
    this.size = { x: width, y: height };
    this.padding = {
      x: Math.round(width * CANVAS_PADDING),
      y: Math.round(height * CANVAS_PADDING),
    };
    const cssWidth = width + this.padding.x * 2,
      cssHeight = height + this.padding.y * 2;
    const area = Math.max(1, cssWidth * cssHeight);
    const device = window.devicePixelRatio > 0 ? window.devicePixelRatio : 1;
    this.dpr = Math.max(0.75, Math.min(device, 2, Math.sqrt(MAX_CANVAS_PIXELS / area)));
    this.pixelRatio = this.dpr;
    this.sizeCanvas(this.baseCanvas, cssWidth, cssHeight, this.dpr);
    this.sizeCanvas(this.overlayCanvas, cssWidth, cssHeight, this.dpr);
    this.sizeCanvas(this.previewCanvas, cssWidth, cssHeight, this.previewRatio());
    if (this.labelCanvas) {
      this.sizeCanvas(this.labelCanvas, this.size.x, this.size.y, this.dpr);
      this.labelCanvas.style.left = '0';
      this.labelCanvas.style.top = '0';
    }
    this.markersLayer.style.width = `${width}px`;
    this.markersLayer.style.height = `${height}px`;
    this.renderAll();
  }

  private sizeCanvas(
    canvas: HTMLCanvasElement,
    width: number,
    height: number,
    ratio = this.pixelRatio,
  ) {
    const pixelWidth = Math.max(1, Math.round(width * ratio)),
      pixelHeight = Math.max(1, Math.round(height * ratio));
    if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
    if (canvas.height !== pixelHeight) canvas.height = pixelHeight;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    canvas.style.left = `${-this.padding.x}px`;
    canvas.style.top = `${-this.padding.y}px`;
  }

  private viewBounds(camera: RenderedCamera): Bounds {
    const north = unprojectY(camera.origin.y - this.padding.y, camera.zoom);
    const south = unprojectY(camera.origin.y + this.size.y + this.padding.y, camera.zoom);
    const west = unprojectX(camera.origin.x - this.padding.x, camera.zoom);
    const east = unprojectX(camera.origin.x + this.size.x + this.padding.x, camera.zoom);
    return { west, south, east, north };
  }

  private boxVisible(boxes: Float32Array, index: number, view: Bounds) {
    const offset = index * 4;
    return (
      boxes[offset] <= view.east &&
      boxes[offset + 2] >= view.west &&
      boxes[offset + 1] <= view.north &&
      boxes[offset + 3] >= view.south
    );
  }

  private previewRatio() {
    // Keep a preview pass near this many backing-store pixels: on phones the
    // 0.6x device ratio is already well inside the budget, while a retina
    // tablet would otherwise pay for a multi-megapixel repaint on every level.
    const area = Math.max(
      1,
      (this.size.x + this.padding.x * 2) * (this.size.y + this.padding.y * 2),
    );
    return Math.max(
      0.35,
      Math.min(this.dpr * PREVIEW_DPR_SCALE, Math.sqrt(PREVIEW_PIXEL_BUDGET / area)),
    );
  }

  private renderAll() {
    if (this.destroyed || !this.size.x || !this.size.y) return;
    this.stopAnimation(false);
    this.cancelScheduledRender();
    this.preview = false;
    this.pixelRatio = this.dpr;
    this.previewCanvas.style.display = 'none';
    this.baseCanvas.style.visibility = '';
    this.overlayCanvas.style.visibility = '';
    this.rendered = {
      center: { ...this.view.center },
      zoom: this.view.zoom,
      origin: this.originFor(this.view),
    };
    this.pan.style.transform = '';
    this.renderBase();
    this.renderOverlay();
    this.renderLabels();
    this.repositionMarkers();
    this.reportView();
  }

  /**
   * Repaint at a coarser backing-store scale on a dedicated canvas. The main
   * canvases keep their allocation (resizing them costs a compositor hitch),
   * and the preview canvas is only shown once its content is ready, so the
   * visible bitmap never moves or blanks while it sharpens.
   */
  private renderPreviewAt(camera: Camera) {
    const context = this.previewCtx;
    if (!context || this.destroyed || !this.size.x || !this.size.y) return;
    const started = performance.now();
    this.preview = true;
    this.pixelRatio = this.previewRatio();
    this.rendered = {
      center: { ...camera.center },
      zoom: camera.zoom,
      origin: this.originFor(camera),
    };
    this.pan.style.transform = '';
    const cssWidth = this.size.x + this.padding.x * 2,
      cssHeight = this.size.y + this.padding.y * 2;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(
      0,
      0,
      Math.round(cssWidth * this.pixelRatio),
      Math.round(cssHeight * this.pixelRatio),
    );
    context.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);
    this.drawBase(context, this.rendered, this.viewBounds(this.rendered));
    this.drawOverlayContent(context, this.rendered);
    this.baseCanvas.style.visibility = 'hidden';
    this.overlayCanvas.style.visibility = 'hidden';
    this.previewCanvas.style.display = '';
    this.repositionMarkers();
    this.lastPreviewAt = performance.now();
    this.previewCost = this.lastPreviewAt - started;
  }

  /**
   * Full-quality rendering waits for one painted frame: finger-up (or the last
   * animation frame) reaches the screen with the scaled bitmap still in place,
   * then the crisp pass runs. A new gesture cancels the pending pass.
   */
  private scheduleFinalRender() {
    if (this.destroyed || this.renderRaf !== null || this.renderTimer !== null) return;
    this.renderRaf = requestAnimationFrame(() => {
      this.renderRaf = null;
      this.renderTimer = window.setTimeout(() => {
        this.renderTimer = null;
        if (this.destroyed || this.pointers.size || this.animating) return;
        this.renderAll();
      }, 0);
    });
  }

  private cancelScheduledRender() {
    if (this.renderRaf !== null) {
      cancelAnimationFrame(this.renderRaf);
      this.renderRaf = null;
    }
    if (this.renderTimer !== null) {
      window.clearTimeout(this.renderTimer);
      this.renderTimer = null;
    }
  }

  private renderBase() {
    if (this.preview) {
      // Redraw at the live camera: the CSS transform is about to be reset, so
      // using the older rendered camera would visibly jump.
      this.renderPreviewAt(this.view);
      return;
    }
    const context = this.baseCtx;
    if (!context) return;
    const cssWidth = this.size.x + this.padding.x * 2,
      cssHeight = this.size.y + this.padding.y * 2;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(
      0,
      0,
      Math.round(cssWidth * this.pixelRatio),
      Math.round(cssHeight * this.pixelRatio),
    );
    if (!this.rendered) return;
    context.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);
    this.drawBase(context, this.rendered, this.viewBounds(this.rendered));
  }

  /**
   * Draw the vector base into the current context clipped to `view`. The caller
   * owns clearing and clipping, which lets the drag path repaint only exposed
   * strips instead of the whole padded canvas.
   */
  private drawBase(context: CanvasRenderingContext2D, camera: RenderedCamera, view: Bounds) {
    const scale = WORLD_SIZE * 2 ** camera.zoom;
    const offsetX = this.padding.x - camera.origin.x,
      offsetY = this.padding.y - camera.origin.y;
    const projectCanvasX = (lng: number) => ((lng + 180) / 360) * scale + offsetX;
    const projectCanvasY = (lat: number) => {
      const safe = Math.max(-85.0511287798, Math.min(85.0511287798, lat));
      const sin = Math.sin((safe * Math.PI) / 180);
      return (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale + offsetY;
    };
    const addRing = (ring: number[][], close: boolean, path: Path2D | CanvasRenderingContext2D) => {
      let first = true;
      for (const point of ring) {
        const x = projectCanvasX(point[0]),
          y = projectCanvasY(point[1]);
        if (first) {
          path.moveTo(x, y);
          first = false;
        } else path.lineTo(x, y);
      }
      if (close && !first) path.closePath();
    };
    const addGeometry = (geometry: Geometry, context: CanvasRenderingContext2D) => {
      switch (geometry.type) {
        case 'Polygon':
          for (const ring of geometry.coordinates) addRing(ring as number[][], true, context);
          break;
        case 'MultiPolygon':
          for (const polygon of geometry.coordinates)
            for (const ring of polygon) addRing(ring as number[][], true, context);
          break;
        case 'LineString':
          addRing(geometry.coordinates as number[][], false, context);
          break;
        case 'MultiLineString':
          for (const line of geometry.coordinates) addRing(line as number[][], false, context);
          break;
        case 'GeometryCollection':
          for (const item of geometry.geometries) addGeometry(item, context);
          break;
        default:
          break;
      }
    };
    const boxes = this.baseBoxes;
    const drawGroup = (
      indices: number[],
      style: { fill?: string; stroke?: string; width?: number },
    ) => {
      if (!indices.length || !boxes) return;
      context.beginPath();
      let any = false;
      for (const index of indices) {
        if (!this.boxVisible(boxes, index, view)) continue;
        const geometry = this.baseFeatures[index].geometry;
        if (!geometry) continue;
        addGeometry(geometry, context);
        any = true;
      }
      if (!any) return;
      if (style.fill) {
        context.fillStyle = style.fill;
        context.fill('evenodd');
      }
      if (style.stroke && style.width !== 0) {
        context.strokeStyle = style.stroke;
        context.lineWidth = style.width ?? 1;
        context.stroke();
      }
    };
    if (this.visibility.green)
      drawGroup(this.baseGroups.green, {
        fill: 'rgba(213,223,210,.42)',
        stroke: '#d5dfd2',
        width: 0.8,
      });
    if (this.visibility.water && boxes) {
      // Water is a mix of polygons and river centerlines. LineStrings must be
      // stroked without filling: a grouped path would close each centerline back
      // to its first point and paint a phantom polygon. Draw water
      // feature-by-feature in source order with per-geometry fill semantics.
      for (const index of this.baseGroups.water) {
        if (!this.boxVisible(boxes, index, view)) continue;
        const geometry = this.baseFeatures[index].geometry;
        if (!geometry) continue;
        context.beginPath();
        addGeometry(geometry, context);
        if (geometry.type === 'Polygon' || geometry.type === 'MultiPolygon') {
          context.fillStyle = 'rgba(183,208,206,.8)';
          context.fill('evenodd');
        }
        context.strokeStyle = '#9cbab9';
        context.lineWidth = 3;
        context.stroke();
      }
    }
    if (this.visibility.roads && boxes) {
      const detailed = this.visibility.detailedStreets;
      const strokeRoads = (indices: number[], color: string, width: number) => {
        if (!indices.length) return;
        context.beginPath();
        let any = false;
        for (const index of indices) {
          if (!this.boxVisible(boxes, index, view)) continue;
          const geometry = this.baseFeatures[index].geometry;
          if (!geometry) continue;
          addGeometry(geometry, context);
          any = true;
        }
        if (!any) return;
        context.strokeStyle = color;
        context.lineWidth = width;
        context.stroke();
      };
      // Minor streets stay white; avenues and secondary roads get the warm
      // colours from the prototype, so the street hierarchy reads at a glance.
      strokeRoads(this.roadGroups.minor, '#fffefa', detailed ? 1.7 : 1.5);
      strokeRoads(this.roadGroups.secondary, '#ece3cf', detailed ? 2.6 : 2.2);
      strokeRoads(this.roadGroups.major, '#ece3cf', detailed ? 3.4 : 2.8);
    }
    if (this.visibility.landmarks) {
      const landmarks = this.baseGroups.landmarks.filter((index) => {
        const geometry = this.baseFeatures[index].geometry;
        return geometry && geometryIsArea(geometry);
      });
      drawGroup(landmarks, { fill: 'rgba(199,168,120,.34)', stroke: '#947652', width: 1.4 });
    }
    // Outlines are the most expensive layer and are barely legible at preview
    // resolution; skip them while a gesture is repainting coarsely.
    if (this.buildingsVisible && this.outlineBoxes && !this.preview) {
      if (this.outlineBinary)
        this.drawBuildingOutlinesBinary(context, view, scale, offsetX, offsetY);
      else if (this.outlineFeatures.length)
        this.drawBuildingOutlines(context, view, scale, offsetX, offsetY);
    }
  }

  /** Repaint one exposed strip of the base canvas at the current camera. */
  private renderBaseRegion(rect: Rect, camera: RenderedCamera) {
    const context = this.baseCtx;
    if (!context) return;
    const canvasWidth = this.size.x + this.padding.x * 2,
      canvasHeight = this.size.y + this.padding.y * 2;
    const x0 = Math.max(0, rect.x - 3),
      y0 = Math.max(0, rect.y - 3);
    const x1 = Math.min(canvasWidth, rect.x + rect.w + 3),
      y1 = Math.min(canvasHeight, rect.y + rect.h + 3);
    if (x1 <= x0 || y1 <= y0) return;
    context.save();
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(
      x0 * this.pixelRatio,
      y0 * this.pixelRatio,
      (x1 - x0) * this.pixelRatio,
      (y1 - y0) * this.pixelRatio,
    );
    context.restore();
    context.save();
    context.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);
    context.beginPath();
    context.rect(x0, y0, x1 - x0, y1 - y0);
    context.clip();
    this.drawBase(
      context,
      camera,
      this.rectBounds({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 }, camera),
    );
    context.restore();
  }

  private rectBounds(rect: Rect, camera: RenderedCamera): Bounds {
    const zoom = camera.zoom,
      pad = this.padding;
    return {
      west: unprojectX(camera.origin.x + rect.x - pad.x, zoom),
      east: unprojectX(camera.origin.x + rect.x + rect.w - pad.x, zoom),
      north: unprojectY(camera.origin.y + rect.y - pad.y, zoom),
      south: unprojectY(camera.origin.y + rect.y + rect.h - pad.y, zoom),
    };
  }

  /**
   * Bake the active CSS pan into the base bitmap, then repaint only the newly
   * exposed strips. This keeps the visible pixels continuous even when a drag
   * goes beyond the overscan and avoids a full-canvas hitch.
   */
  private recenterForDrag() {
    if (!this.rendered) return;
    if (this.preview) {
      this.renderPreviewAt(this.view);
      return;
    }
    if (Math.abs(this.view.zoom - this.rendered.zoom) > 1e-6) {
      // A preview repaint is cheap and lands exactly on the current camera, so
      // the drag can keep baking strips instead of blocking on a full repaint.
      this.renderPreviewAt(this.view);
      return;
    }
    const context = this.baseCtx;
    if (!context) return;
    const viewOrigin = this.originFor(this.view);
    const bakeX =
      Math.round((this.rendered.origin.x - viewOrigin.x) * this.pixelRatio) / this.pixelRatio;
    const bakeY =
      Math.round((this.rendered.origin.y - viewOrigin.y) * this.pixelRatio) / this.pixelRatio;
    const canvasWidth = this.size.x + this.padding.x * 2,
      canvasHeight = this.size.y + this.padding.y * 2;
    if (Math.abs(bakeX) >= canvasWidth || Math.abs(bakeY) >= canvasHeight) {
      this.renderPreviewAt(this.view);
      return;
    }
    if (bakeX === 0 && bakeY === 0) {
      this.applyPanTransform(this.rendered, this.view);
      return;
    }
    context.save();
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.globalCompositeOperation = 'copy';
    context.drawImage(
      this.baseCanvas,
      Math.round(bakeX * this.pixelRatio),
      Math.round(bakeY * this.pixelRatio),
    );
    context.globalCompositeOperation = 'source-over';
    context.restore();
    const origin = { x: this.rendered.origin.x - bakeX, y: this.rendered.origin.y - bakeY };
    const center = unproject(
      origin.x + this.size.x / 2,
      origin.y + this.size.y / 2,
      this.view.zoom,
    );
    this.rendered = { center, zoom: this.view.zoom, origin };
    if (bakeX !== 0) {
      const rect = {
        x: bakeX > 0 ? 0 : canvasWidth + bakeX,
        y: 0,
        w: Math.abs(bakeX),
        h: canvasHeight,
      };
      this.renderBaseRegion(rect, this.rendered);
    }
    if (bakeY !== 0) {
      const rect = {
        x: 0,
        y: bakeY > 0 ? 0 : canvasHeight + bakeY,
        w: canvasWidth,
        h: Math.abs(bakeY),
      };
      this.renderBaseRegion(rect, this.rendered);
    }
    this.renderOverlay();
    this.repositionMarkers();
    this.applyPanTransform(this.rendered, this.view);
  }

  private maybeRecenterDuringDrag() {
    if (!this.rendered || Math.abs(this.view.zoom - this.rendered.zoom) > 1e-6) return;
    const viewOrigin = this.originFor(this.view);
    const bakeX = this.rendered.origin.x - viewOrigin.x,
      bakeY = this.rendered.origin.y - viewOrigin.y;
    if (Math.abs(bakeX) > this.padding.x * 0.72 || Math.abs(bakeY) > this.padding.y * 0.72)
      this.recenterForDrag();
  }

  private settleDrag(_moved = false) {
    if (!this.rendered) return;
    if (Math.abs(this.view.zoom - this.rendered.zoom) > 1e-6 || this.preview) {
      // The scaled preview stays on screen while the crisp pass is painted in
      // the next task, so lifting a finger never freezes the gesture.
      this.scheduleFinalRender();
      this.reportView();
      return;
    }
    const viewOrigin = this.originFor(this.view);
    const bakeX = this.rendered.origin.x - viewOrigin.x,
      bakeY = this.rendered.origin.y - viewOrigin.y;
    if (Math.abs(bakeX) > 0.25 || Math.abs(bakeY) > 0.25) this.recenterForDrag();
    else this.applyPanTransform(this.rendered, this.view);
    this.reportView();
  }

  private drawBuildingOutlines(
    context: CanvasRenderingContext2D,
    view: Bounds,
    scale: number,
    offsetX: number,
    offsetY: number,
  ) {
    const boxes = this.outlineBoxes!;
    const features = this.outlineFeatures;
    const projectCanvasX = (lng: number) => ((lng + 180) / 360) * scale + offsetX;
    const projectCanvasY = (lat: number) => {
      const safe = Math.max(-85.0511287798, Math.min(85.0511287798, lat));
      const sin = Math.sin((safe * Math.PI) / 180);
      return (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale + offsetY;
    };
    const projectedBox = (index: number) => {
      const offset = index * 4;
      const x1 = projectCanvasX(boxes[offset]),
        x2 = projectCanvasX(boxes[offset + 2]);
      const y1 = projectCanvasY(boxes[offset + 1]),
        y2 = projectCanvasY(boxes[offset + 3]);
      return { x1, y1, x2, y2 };
    };
    // A single path containing tens of thousands of polygons makes Chrome's
    // Path2D tessellation superlinear. Batches keep the work linear and avoid a
    // multi-second freeze at middle zoom levels.
    const BATCH_SIZE = 100;
    let batch = 0;
    context.beginPath();
    for (let index = 0; index < features.length; index++) {
      if (!this.boxVisible(boxes, index, view)) continue;
      const box = projectedBox(index);
      if (Math.max(Math.abs(box.x2 - box.x1), Math.abs(box.y2 - box.y1)) < DOT_THRESHOLD) continue;
      const geometry = features[index].geometry;
      if (!geometry) continue;
      eachPolygonRing(geometry, (ring) => {
        let first = true;
        for (const point of ring) {
          const x = projectCanvasX(point[0]),
            y = projectCanvasY(point[1]);
          if (first) {
            context.moveTo(x, y);
            first = false;
          } else context.lineTo(x, y);
        }
        if (!first) context.closePath();
      });
      batch++;
      if (batch >= BATCH_SIZE) {
        context.fillStyle = 'rgba(214,216,207,.34)';
        context.fill('evenodd');
        context.strokeStyle = 'rgba(157,164,151,.7)';
        context.lineWidth = 0.7;
        context.stroke();
        context.beginPath();
        batch = 0;
      }
    }
    if (batch) {
      context.fillStyle = 'rgba(214,216,207,.34)';
      context.fill('evenodd');
      context.strokeStyle = 'rgba(157,164,151,.7)';
      context.lineWidth = 0.7;
      context.stroke();
    }
    // Buildings smaller than a pixel would disappear as polygons. Draw them as
    // a separate one-pixel fill path, which preserves the texture of the city
    // without paying for full outlines.
    context.beginPath();
    for (let index = 0; index < features.length; index++) {
      if (!this.boxVisible(boxes, index, view)) continue;
      const box = projectedBox(index);
      if (Math.max(Math.abs(box.x2 - box.x1), Math.abs(box.y2 - box.y1)) >= DOT_THRESHOLD) continue;
      const x = Math.round((box.x1 + box.x2) / 2),
        y = Math.round((box.y1 + box.y2) / 2);
      const size = 1 / this.pixelRatio;
      context.rect(x, y, size, size);
    }
    context.fillStyle = 'rgba(214,216,207,.34)';
    context.fill();
  }

  /**
   * Draw the compact outline file. Coordinates are flat floats and offsets are
   * typed arrays, so this loop avoids per-feature GeoJSON objects entirely.
   */
  private drawBuildingOutlinesBinary(
    context: CanvasRenderingContext2D,
    view: Bounds,
    scale: number,
    offsetX: number,
    offsetY: number,
  ) {
    const data = this.outlineBinary!;
    const { points, ringStarts, featureRings, boxes, featureCount } = data;
    const projectCanvasX = (lng: number) => ((lng + 180) / 360) * scale + offsetX;
    const projectCanvasY = (lat: number) => {
      const safe = Math.max(-85.0511287798, Math.min(85.0511287798, lat));
      const sin = Math.sin((safe * Math.PI) / 180);
      return (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale + offsetY;
    };
    const projectedBox = (index: number) => {
      const offset = index * 4;
      return {
        x1: projectCanvasX(boxes[offset]),
        y1: projectCanvasY(boxes[offset + 1]),
        x2: projectCanvasX(boxes[offset + 2]),
        y2: projectCanvasY(boxes[offset + 3]),
      };
    };
    const BATCH_SIZE = 100;
    let batch = 0;
    context.beginPath();
    for (let index = 0; index < featureCount; index++) {
      if (!this.boxVisible(boxes, index, view)) continue;
      const ringEnd = featureRings[index + 1];
      if (ringEnd === featureRings[index]) continue;
      const box = projectedBox(index);
      if (Math.max(Math.abs(box.x2 - box.x1), Math.abs(box.y2 - box.y1)) < DOT_THRESHOLD) continue;
      for (let ring = featureRings[index]; ring < ringEnd; ring++) {
        const start = ringStarts[ring];
        const end = ringStarts[ring + 1];
        for (let pointIndex = start; pointIndex < end; pointIndex++) {
          const x = projectCanvasX(points[pointIndex * 2]);
          const y = projectCanvasY(points[pointIndex * 2 + 1]);
          if (pointIndex === start) context.moveTo(x, y);
          else context.lineTo(x, y);
        }
        if (end > start) context.closePath();
      }
      batch++;
      if (batch >= BATCH_SIZE) {
        context.fillStyle = 'rgba(214,216,207,.34)';
        context.fill('evenodd');
        context.strokeStyle = 'rgba(157,164,151,.7)';
        context.lineWidth = 0.7;
        context.stroke();
        context.beginPath();
        batch = 0;
      }
    }
    if (batch) {
      context.fillStyle = 'rgba(214,216,207,.34)';
      context.fill('evenodd');
      context.strokeStyle = 'rgba(157,164,151,.7)';
      context.lineWidth = 0.7;
      context.stroke();
    }
    context.beginPath();
    for (let index = 0; index < featureCount; index++) {
      if (!this.boxVisible(boxes, index, view)) continue;
      const box = projectedBox(index);
      if (Math.max(Math.abs(box.x2 - box.x1), Math.abs(box.y2 - box.y1)) >= DOT_THRESHOLD) continue;
      const x = Math.round((box.x1 + box.x2) / 2);
      const y = Math.round((box.y1 + box.y2) / 2);
      const size = 1 / this.pixelRatio;
      context.rect(x, y, size, size);
    }
    context.fillStyle = 'rgba(214,216,207,.34)';
    context.fill();
  }

  private renderOverlay() {
    if (this.preview) {
      // The preview canvas carries both layers; a lone overlay repaint would
      // land on a hidden canvas.
      this.renderPreviewAt(this.view);
      return;
    }
    const context = this.overlayCtx;
    if (!context) return;
    const cssWidth = this.size.x + this.padding.x * 2,
      cssHeight = this.size.y + this.padding.y * 2;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(
      0,
      0,
      Math.round(cssWidth * this.pixelRatio),
      Math.round(cssHeight * this.pixelRatio),
    );
    if (!this.rendered) return;
    context.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);
    this.drawOverlayContent(context, this.rendered);
  }

  /**
   * Atlas shapes and the position dot. Street labels live on their own canvas:
   * hovering the period legend or selecting a building repaints this layer
   * without touching thousands of glyphs.
   */
  private drawOverlayContent(context: CanvasRenderingContext2D, camera: RenderedCamera) {
    this.drawAtlas(context, camera);
    this.drawPosition(context, camera);
  }

  private drawAtlas(context: CanvasRenderingContext2D, camera: RenderedCamera) {
    if (!this.atlasEntries.length) return;
    const offsetX = this.padding.x - camera.origin.x,
      offsetY = this.padding.y - camera.origin.y;
    const scale = WORLD_SIZE * 2 ** camera.zoom;
    const projectCanvasX = (lng: number) => ((lng + 180) / 360) * scale + offsetX;
    const projectCanvasY = (lat: number) => {
      const safe = Math.max(-85.0511287798, Math.min(85.0511287798, lat));
      const sin = Math.sin((safe * Math.PI) / 180);
      return (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale + offsetY;
    };
    const activePeriods =
      this.hoveredPeriod && !this.selectedPeriods.includes(this.hoveredPeriod)
        ? [...this.selectedPeriods, this.hoveredPeriod]
        : this.selectedPeriods;
    const view = this.viewBounds(camera);
    for (const entry of this.atlasEntries) {
      if (
        !bboxIntersects(entry.bbox, {
          minX: view.west,
          minY: view.south,
          maxX: view.east,
          maxY: view.north,
        })
      )
        continue;
      const building = entry.building;
      const geometry = building.geometry;
      if (!geometry) continue;
      const isSelected = building.id === this.selectedId;
      const matches =
        !activePeriods.length || entry.periodLabels.some((label) => activePeriods.includes(label));
      const isHovered =
        !!this.hoveredPeriod &&
        !this.selectedPeriods.includes(this.hoveredPeriod) &&
        entry.periodLabels.includes(this.hoveredPeriod);
      const look: AtlasLook = {
        selected: isSelected,
        boundary: building.geometryRole === 'heritage_boundary',
        highlighted: activePeriods.length > 0,
        matched: matches,
        hovered: isHovered,
        fillColor: entry.fillColor,
      };
      const style = atlasStyle(look, camera.zoom);
      context.beginPath();
      eachPolygonRing(geometry, (ring) => {
        let first = true;
        for (const point of ring) {
          const x = projectCanvasX(point[0]),
            y = projectCanvasY(point[1]);
          if (first) {
            context.moveTo(x, y);
            first = false;
          } else context.lineTo(x, y);
        }
        if (!first) context.closePath();
      });
      context.globalAlpha = style.fillOpacity;
      context.fillStyle = style.fillColor;
      context.fill('evenodd');
      if (style.weight > 0) {
        context.globalAlpha = style.opacity;
        context.strokeStyle = style.color;
        context.lineWidth = style.weight;
        context.setLineDash(style.dash ?? []);
        context.stroke();
        context.setLineDash([]);
      }
    }
    context.globalAlpha = 1;
  }

  private drawPosition(context: CanvasRenderingContext2D, camera: RenderedCamera) {
    if (!this.position) return;
    const point = project(this.position.lat, this.position.lng, camera.zoom);
    const x = point.x - camera.origin.x + this.padding.x,
      y = point.y - camera.origin.y + this.padding.y;
    const radius = this.position.accuracy / metersPerPixel(this.position.lat, camera.zoom);
    context.beginPath();
    context.arc(x, y, Math.max(1, radius), 0, Math.PI * 2);
    context.fillStyle = 'rgba(67,131,185,.1)';
    context.fill();
    context.strokeStyle = '#4383b9';
    context.lineWidth = 1;
    context.stroke();
    context.beginPath();
    context.arc(x, y, 8, 0, Math.PI * 2);
    context.fillStyle = '#287ac2';
    context.fill();
    context.strokeStyle = '#fff';
    context.lineWidth = 3;
    context.stroke();
    context.globalAlpha = 1;
  }

  private ensureLabelCanvas() {
    if (this.labelCanvas) return;
    const canvas = makeCanvas('atlas-map-labels');
    this.labelCanvas = canvas;
    this.labelCtx = canvas.getContext('2d');
    this.sizeCanvas(canvas, this.size.x, this.size.y, this.dpr);
    canvas.style.left = '0';
    canvas.style.top = '0';
    canvas.style.visibility = 'hidden';
    // The labels are screen-space: they live outside the CSS-scaled pan and are
    // re-laid out every frame at the live camera, like a vector layer.
    this.container.insertBefore(canvas, this.tooltip);
  }

  private releaseLabelCanvas() {
    this.liveLabels.release();
    if (!this.labelCanvas) return;
    this.labelCanvas.remove();
    this.labelCanvas.width = 1;
    this.labelCanvas.height = 1;
    this.labelCanvas = null;
    this.labelCtx = null;
  }

  /**
   * Street labels are a separate screen-space canvas: they are re-laid out at
   * the live (fractional) zoom on every frame, so the text stays sharp and the
   * motion stays continuous through gestures.
   */
  private renderLabels() {
    if (!this.visibility.detailedStreets || !this.rendered) {
      if (this.labelCanvas) this.labelCanvas.style.visibility = 'hidden';
      return;
    }
    this.ensureLabelCanvas();
    const canvas = this.labelCanvas,
      context = this.labelCtx;
    if (!canvas || !context) return;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.liveLabels.draw(
      context,
      { zoom: this.view.zoom, origin: this.originFor(this.view) },
      this.size.x,
      this.size.y,
      this.language,
      this.dpr,
    );
    canvas.style.visibility = '';
  }

  private repositionMarkers() {
    if (!this.rendered) return;
    const zoom = this.view.zoom;
    const origin = this.originFor(this.view);
    for (const marker of this.markers) {
      const point = project(marker.lat, marker.lng, zoom);
      marker.element.style.left = `${point.x - origin.x}px`;
      marker.element.style.top = `${point.y - origin.y}px`;
      marker.element.style.transform = '';
    }
  }

  private updateMarkerLabels() {
    for (const marker of this.markers) {
      const names = marker.feature.properties?.names as Record<string, string> | undefined;
      marker.element.setAttribute(
        'aria-label',
        String(names?.[this.language] || marker.feature.properties?.name || ''),
      );
    }
  }

  private animateTo(target: Camera, duration: number) {
    this.stopAnimation(false);
    this.stopWheel();
    this.cancelScheduledRender();
    this.hideTooltip();
    // Zooming out folds the target camera into the bitmap before the motion
    // starts: the preview pass is cheap, and the shrinking canvas then always
    // covers the viewport. Zooming in can simply scale the current level up.
    const preRender = this.rendered !== null && target.zoom < this.rendered.zoom - 0.75;
    if (!this.rendered) this.renderAll();
    else if (preRender) this.renderPreviewAt(target);
    const from = { center: { ...this.view.center }, zoom: this.view.zoom };
    if (preRender) this.applyPanTransform(this.rendered!, this.view);
    this.animating = true;
    // Zoom animations hide the label layer entirely: scaling an old bitmap
    // made names huge and blurry, redrawing them at every intermediate level
    // made them jump. They come back in one crisp pass when motion stops.
    const start = performance.now();
    const step = (now: number) => {
      this.raf = null;
      if (!this.animating || this.destroyed) return;
      const progress = Math.min(1, (now - start) / Math.max(1, duration)),
        eased = easeInOutCubic(progress);
      const zoom = from.zoom + (target.zoom - from.zoom) * eased;
      const center = {
        lat: from.center.lat + (target.center.lat - from.center.lat) * eased,
        lng: from.center.lng + (target.center.lng - from.center.lng) * eased,
      };
      this.view = { center, zoom };
      this.applyPanTransform(this.rendered!, this.view);
      this.reportView();
      if (progress < 1) this.raf = requestAnimationFrame(step);
      else {
        this.animating = false;
        this.view = { center: { ...target.center }, zoom: target.zoom };
        if (preRender) {
          this.rendered = {
            ...this.rendered!,
            center: { ...target.center },
            zoom: target.zoom,
            origin: this.originFor(target),
          };
          this.pan.style.transform = '';
          this.repositionMarkers();
          this.reportView();
        }
        // Let the last animated frame paint before the crisp pass, so the end
        // of an animation does not freeze the map for the render duration.
        this.scheduleFinalRender();
      }
    };
    this.raf = requestAnimationFrame(step);
  }

  /**
   * Repaint from a coarse camera when the scaled bitmap has drifted too far.
   * Pinch and wheel keep their transforms continuous between these passes.
   */
  private maybeRefreshPreview(limitIn = PREVIEW_ZOOM_IN, allowSlow = false) {
    if (!this.rendered || this.destroyed) return;
    const delta = this.view.zoom - this.rendered.zoom;
    const limit = delta < 0 ? PREVIEW_ZOOM_OUT : limitIn;
    if (Math.abs(delta) < limit) return;
    // Zooming out must refresh on time: waiting can expose the canvas edge.
    // Zooming in only loses sharpness, so it can wait for the interval.
    if (delta > 0 && performance.now() - this.lastPreviewAt < PREVIEW_MIN_INTERVAL_MS) return;
    if (delta > 0 && !allowSlow && this.previewCost > PREVIEW_SLOW_MS) return;
    this.renderPreviewAt(this.view);
  }

  private reportView() {
    this.onViewChange?.({ ...this.view.center }, this.view.zoom);
  }

  private applyPanTransform(rendered: RenderedCamera, view: Camera) {
    const scale = 2 ** (view.zoom - rendered.zoom);
    const viewOrigin = this.originFor(view);
    const translateX = scale * rendered.origin.x - viewOrigin.x;
    const translateY = scale * rendered.origin.y - viewOrigin.y;
    this.pan.style.transform = `translate3d(${translateX}px, ${translateY}px, 0) scale(${scale})`;
    // The label and marker layers are screen-space, so they follow the live
    // camera instead of inheriting the CSS scale of the pan.
    this.renderLabels();
    this.repositionMarkers();
  }

  private stopAnimation(render = true) {
    if (this.raf !== null) {
      cancelAnimationFrame(this.raf);
      this.raf = null;
    }
    if (!this.animating) return;
    this.animating = false;
    if (render && !this.destroyed) this.renderAll();
  }

  private stopWheel() {
    if (this.wheelRaf !== null) {
      cancelAnimationFrame(this.wheelRaf);
      this.wheelRaf = null;
    }
    this.wheelTargetZoom = null;
    // Any programmatic camera change ends the current burst; otherwise the next
    // wheel tick would reuse a baseline from before the animation.
    this.wheelBurst = 0;
    this.lastWheelAt = 0;
  }

  /** Zoom while keeping the world point under `point` pinned to the screen. */
  private zoomToPoint(zoom: number, point: Point) {
    const origin = this.originFor(this.view);
    const anchorWorld = { x: origin.x + point.x, y: origin.y + point.y };
    const scale = 2 ** (zoom - this.view.zoom);
    const newOrigin = {
      x: anchorWorld.x * scale - point.x,
      y: anchorWorld.y * scale - point.y,
    };
    const center = unproject(newOrigin.x + this.size.x / 2, newOrigin.y + this.size.y / 2, zoom);
    this.view = { center, zoom };
    if (this.rendered) this.applyPanTransform(this.rendered, this.view);
  }

  private updateViewFromDrag(session: DragSession, point: Point) {
    const zoom = session.zoom;
    const startWorld = project(session.startCenter.lat, session.startCenter.lng, zoom);
    const center = unproject(
      startWorld.x - (point.x - session.startX),
      startWorld.y - (point.y - session.startY),
      zoom,
    );
    this.view = { center, zoom };
    if (this.rendered) {
      this.applyPanTransform(this.rendered, this.view);
      this.maybeRecenterDuringDrag();
    }
    this.reportView();
  }

  private updatePinch() {
    const points = [...this.pointers.values()];
    if (points.length < 2 || !this.pinch) return;
    const [a, b] = points;
    const distance = Math.max(1, Math.hypot(b.x - a.x, b.y - a.y));
    const midpoint = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    // Continuous zoom: snapping to the level grid here turns one smooth pinch
    // into a series of visible 1.41x jumps.
    const zoom = this.clampZoom(
      this.pinch.startZoom + Math.log2(distance / this.pinch.startDistance),
    );
    const scale = 2 ** (zoom - this.pinch.startZoom);
    const anchor = { x: this.pinch.anchorWorld.x * scale, y: this.pinch.anchorWorld.y * scale };
    const origin = { x: anchor.x - midpoint.x, y: anchor.y - midpoint.y };
    const center = unproject(origin.x + this.size.x / 2, origin.y + this.size.y / 2, zoom);
    this.view = { center, zoom };
    this.suppressClick = true;
    if (this.rendered) {
      this.applyPanTransform(this.rendered, this.view);
      this.maybeRefreshPreview();
    }
    this.reportView();
  }

  private hitAt(point: Point, pointerType: string): Building | null {
    const origin = this.originFor(this.view);
    const lng = unprojectX(origin.x + point.x, this.view.zoom);
    const lat = unprojectY(origin.y + point.y, this.view.zoom);
    const slop =
      pointerType === 'touch' || pointerType === 'pen' ? TAP_SLOP_TOUCH_PX : TAP_SLOP_MOUSE_PX;
    const radius = tapRadiusDegrees(slop, lat, this.view.zoom);
    return pickTapTarget(lng, lat, this.atlasEntries, radius)?.building ?? null;
  }

  private pointerPoint(event: PointerEvent | WheelEvent): Point {
    const rect = this.container.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  private showMarkerTooltip(feature: GeoJSON.Feature) {
    const marker = this.markers.find((item) => item.feature === feature);
    if (!marker) return;
    const rect = marker.element.getBoundingClientRect(),
      hostRect = this.container.getBoundingClientRect();
    this.showTooltip(
      String(
        (feature.properties?.names as Record<string, string> | undefined)?.[this.language] ||
          feature.properties?.name ||
          '',
      ),
      rect.left - hostRect.left + rect.width / 2,
      rect.top - hostRect.top - 6,
    );
  }

  private showTooltip(text: string, x: number, y: number) {
    if (!text) return;
    this.tooltip.textContent = text;
    this.tooltip.style.left = `${clamp(x, 50, Math.max(50, this.size.x - 50))}px`;
    this.tooltip.style.top = `${Math.max(0, y)}px`;
    this.tooltip.style.display = 'block';
    this.tooltipVisible = true;
  }

  private hideTooltip() {
    if (!this.tooltipVisible) return;
    this.tooltip.style.display = 'none';
    this.tooltipVisible = false;
  }

  private hoverAt(point: Point, pointerType: string) {
    if (this.pointers.size) return;
    const building = this.hitAt(point, pointerType);
    if (building) {
      const name = building.names?.[this.language] || building.name;
      this.showTooltip(name, point.x, point.y - 14);
      this.container.style.cursor = 'pointer';
    } else {
      this.hideTooltip();
      this.container.style.cursor = 'grab';
    }
  }

  private handlePointerDown = (event: PointerEvent) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    this.stopAnimation(false);
    this.stopWheel();
    this.cancelScheduledRender();
    this.container.classList.remove('keyboard-focus');
    this.hideTooltip();
    if (!this.pointers.size) this.suppressClick = false;
    this.pointers.set(event.pointerId, this.pointerPoint(event));
    this.container.focus({ preventScroll: true });
    try {
      this.container.setPointerCapture(event.pointerId);
    } catch {}
    if (this.pointers.size === 1) {
      const point = this.pointerPoint(event);
      const path = event.composedPath?.() ?? [];
      const onMarker = path.some(
        (item) => item instanceof Element && item.classList.contains('atlas-map-marker'),
      );
      this.drag = {
        startX: point.x,
        startY: point.y,
        startCenter: { ...this.view.center },
        zoom: this.view.zoom,
        moved: false,
        pointerId: event.pointerId,
        onMarker,
      };
      this.pinch = null;
      this.container.style.cursor = 'grabbing';
    } else if (this.pointers.size === 2) {
      const points = [...this.pointers.values()];
      const distance = Math.max(
        1,
        Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y),
      );
      const midpoint = { x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 };
      const world = project(this.view.center.lat, this.view.center.lng, this.view.zoom);
      this.pinch = {
        startDistance: distance,
        anchorWorld: {
          x: world.x + midpoint.x - this.size.x / 2,
          y: world.y + midpoint.y - this.size.y / 2,
        },
        startZoom: this.view.zoom,
      };
      this.suppressClick = true;
      this.drag = null;
      this.container.style.cursor = 'grabbing';
    }
  };

  private handlePointerMove = (event: PointerEvent) => {
    const point = this.pointerPoint(event);
    if (this.pointers.has(event.pointerId)) this.pointers.set(event.pointerId, point);
    if (this.pointers.size >= 2 && this.pinch) {
      this.updatePinch();
      return;
    }
    if (this.drag && this.pointers.size === 1) {
      const session = this.drag;
      const distance = Math.hypot(point.x - session.startX, point.y - session.startY);
      if (!session.moved && distance >= MIN_DRAG) session.moved = true;
      if (session.moved) {
        this.updateViewFromDrag(session, point);
        return;
      }
      return;
    }
    this.hoverAt(point, event.pointerType);
  };

  private endPointer(event: PointerEvent, allowClick: boolean) {
    const point = this.pointerPoint(event);
    this.pointers.delete(event.pointerId);
    try {
      this.container.releasePointerCapture(event.pointerId);
    } catch {}
    if (this.pinch) {
      this.pinch = null;
      this.drag = null;
      if (this.pointers.size) this.handleRemainingPointer();
      else this.settleDrag(true);
      return;
    }
    const session = this.drag;
    if (session && session.pointerId === event.pointerId) {
      this.drag = null;
      if (!session.moved && !session.onMarker && !this.suppressClick && allowClick) {
        const building = this.hitAt(point, event.pointerType);
        if (building) {
          this.onSelect(building.id);
          this.suppressNextTapClick();
          this.suppressClick = false;
          return;
        }
      }
    }
    if (!this.pointers.size) {
      this.drag = null;
      this.pinch = null;
      this.container.style.cursor = 'grab';
      this.settleDrag(session?.moved ?? false);
      this.suppressClick = false;
    }
  }

  /**
   * A tap fires compatibility mouse events after pointerup. By then the card
   * opened by the tap already covers the map, so that synthesized click hits
   * the card control under the finger (the photo, for instance) instead of the
   * map. Swallow that one click; a click on the map itself is left alone.
   */
  private suppressNextTapClick() {
    this.releaseTapClickGuard();
    const onClick = (event: MouseEvent) => {
      this.releaseTapClickGuard();
      if (event.detail === 0) return;
      if (event.target instanceof Node && this.container.contains(event.target)) return;
      event.preventDefault();
      event.stopPropagation();
    };
    const onPointerDown = () => this.releaseTapClickGuard();
    const timer = window.setTimeout(() => this.releaseTapClickGuard(), TAP_CLICK_GUARD_MS);
    this.tapClickGuard = { onClick, onPointerDown, timer };
    document.addEventListener('click', onClick, true);
    document.addEventListener('pointerdown', onPointerDown, true);
  }

  private releaseTapClickGuard() {
    const guard = this.tapClickGuard;
    if (!guard) return;
    this.tapClickGuard = null;
    window.clearTimeout(guard.timer);
    document.removeEventListener('click', guard.onClick, true);
    document.removeEventListener('pointerdown', guard.onPointerDown, true);
  }

  private handleRemainingPointer() {
    const first = [...this.pointers.entries()][0];
    if (!first) return;
    const [pointerId, point] = first;
    this.drag = {
      startX: point.x,
      startY: point.y,
      startCenter: { ...this.view.center },
      zoom: this.view.zoom,
      moved: false,
      pointerId,
      onMarker: false,
    };
  }

  private handlePointerUp = (event: PointerEvent) => this.endPointer(event, true);
  private handlePointerCancel = (event: PointerEvent) => this.endPointer(event, false);
  private handlePointerLeave = () => {
    if (!this.pointers.size) this.hideTooltip();
  };
  private handleBlur = () => this.container.classList.remove('keyboard-focus');

  private handleWheel = (event: WheelEvent) => {
    event.preventDefault();
    this.container.classList.remove('keyboard-focus');
    event.stopPropagation();
    const delta = wheelDelta(event);
    if (!delta) return;
    const interrupted = this.animating;
    this.stopAnimation(false);
    if (interrupted) {
      this.wheelBurst = 0;
      this.lastWheelAt = 0;
    }
    this.cancelScheduledRender();
    const now = performance.now();
    // A new burst starts from the zoom where the previous one ended, so the
    // cumulative wheel travel never fights the camera. Reversing direction is
    // also a new burst: the saturating curve should not make the user unwind
    // scroll they made in the opposite direction.
    if (
      now - this.lastWheelAt > WHEEL_BURST_GAP_MS ||
      (this.wheelBurst !== 0 && Math.sign(delta) !== Math.sign(this.wheelBurst))
    ) {
      this.wheelBurst = 0;
      this.wheelBurstZoom = this.view.zoom;
    }
    this.lastWheelAt = now;
    this.wheelBurst += delta;
    this.wheelPoint = this.pointerPoint(event);
    this.wheelTargetZoom = this.clampZoom(this.wheelBurstZoom + wheelZoomAmount(this.wheelBurst));
    this.startWheelSmoothing();
  };

  /**
   * Ease the camera towards the wheel target every frame. The zoom value stays
   * continuous, so a mouse wheel or trackpad produces one smooth motion instead
   * of a sequence of half-level steps.
   */
  private startWheelSmoothing() {
    if (this.wheelRaf !== null || this.wheelTargetZoom === null) return;
    if (Math.abs(this.wheelTargetZoom - this.view.zoom) < 0.002 && !this.preview) {
      this.wheelTargetZoom = null;
      return;
    }
    const step = () => {
      this.wheelRaf = null;
      if (this.destroyed || this.wheelTargetZoom === null) return;
      const target = this.wheelTargetZoom;
      const remaining = target - this.view.zoom;
      if (Math.abs(remaining) < 0.002) {
        if (remaining !== 0) this.zoomToPoint(target, this.wheelPoint);
        this.view = { ...this.view, zoom: target };
        this.wheelTargetZoom = null;
        this.reportView();
        this.scheduleFinalRender();
        return;
      }
      this.zoomToPoint(this.view.zoom + remaining * 0.32, this.wheelPoint);
      this.reportView();
      this.maybeRefreshPreview(WHEEL_PREVIEW_ZOOM, true);
      this.wheelRaf = requestAnimationFrame(step);
    };
    this.wheelRaf = requestAnimationFrame(step);
  }

  private handleDoubleClick = (event: MouseEvent) => {
    event.preventDefault();
    const point = this.pointerPoint(event as PointerEvent);
    const origin = this.originFor(this.view);
    const anchorWorld = { x: origin.x + point.x, y: origin.y + point.y };
    const zoom = this.clampZoom(this.view.zoom + 1);
    const scale = 2 ** (zoom - this.view.zoom);
    const newOrigin = { x: anchorWorld.x * scale - point.x, y: anchorWorld.y * scale - point.y };
    const center = unproject(newOrigin.x + this.size.x / 2, newOrigin.y + this.size.y / 2, zoom);
    this.setView(center, zoom, { animate: true, duration: 220 });
  };

  private handleKeyDown = (event: KeyboardEvent) => {
    const step = 80;
    const handled = [
      'ArrowLeft',
      'ArrowRight',
      'ArrowUp',
      'ArrowDown',
      '+',
      '=',
      '-',
      '_',
    ].includes(event.key);
    if (handled) this.container.classList.add('keyboard-focus');
    if (
      event.key === 'ArrowLeft' ||
      event.key === 'ArrowRight' ||
      event.key === 'ArrowUp' ||
      event.key === 'ArrowDown'
    ) {
      event.preventDefault();
      const dx = event.key === 'ArrowLeft' ? step : event.key === 'ArrowRight' ? -step : 0;
      const dy = event.key === 'ArrowUp' ? step : event.key === 'ArrowDown' ? -step : 0;
      const origin = this.originFor(this.view);
      const center = unproject(
        origin.x + this.size.x / 2 - dx,
        origin.y + this.size.y / 2 - dy,
        this.view.zoom,
      );
      this.setView(center, this.view.zoom, { animate: false });
    } else if (event.key === '+' || event.key === '=') {
      event.preventDefault();
      this.zoomIn();
    } else if (event.key === '-' || event.key === '_') {
      event.preventDefault();
      this.zoomOut();
    }
  };

  private attachEvents() {
    this.container.addEventListener('pointerdown', this.handlePointerDown);
    this.container.addEventListener('pointermove', this.handlePointerMove);
    this.container.addEventListener('pointerup', this.handlePointerUp);
    this.container.addEventListener('pointercancel', this.handlePointerCancel);
    this.container.addEventListener('pointerleave', this.handlePointerLeave);
    this.container.addEventListener('blur', this.handleBlur);
    this.container.addEventListener('wheel', this.handleWheel, { passive: false });
    this.container.addEventListener('dblclick', this.handleDoubleClick);
    this.container.addEventListener('keydown', this.handleKeyDown);
  }

  private detachEvents() {
    this.container.removeEventListener('pointerdown', this.handlePointerDown);
    this.container.removeEventListener('pointermove', this.handlePointerMove);
    this.container.removeEventListener('pointerup', this.handlePointerUp);
    this.container.removeEventListener('pointercancel', this.handlePointerCancel);
    this.container.removeEventListener('pointerleave', this.handlePointerLeave);
    this.container.removeEventListener('blur', this.handleBlur);
    this.container.removeEventListener('wheel', this.handleWheel);
    this.container.removeEventListener('dblclick', this.handleDoubleClick);
    this.container.removeEventListener('keydown', this.handleKeyDown);
  }
}

function boundsIsFinite(bounds: Bounds) {
  return (
    Number.isFinite(bounds.west) &&
    Number.isFinite(bounds.south) &&
    Number.isFinite(bounds.east) &&
    Number.isFinite(bounds.north)
  );
}
function padBounds(bounds: Bounds, ratio: number): Bounds {
  const width = bounds.east - bounds.west,
    height = bounds.north - bounds.south;
  return {
    west: bounds.west - width * ratio,
    south: bounds.south - height * ratio,
    east: bounds.east + width * ratio,
    north: bounds.north + height * ratio,
  };
}

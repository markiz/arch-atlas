import type { Geometry } from 'geojson';
import type { Building } from '../types';
import type { Language } from '../i18n';
import { periodsFor } from '../domain';
import { landmarkSvg } from './landmark';
import {
  WORLD_SIZE,
  bboxIntersects,
  eachPolygonRing,
  featureBounds,
  metersPerPixel,
  pointInGeometry,
  project,
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
  bbox: BBox;
  /** Labels of every construction period the building overlaps. */
  periodLabels: string[];
  /** Colour of the earliest of those periods. */
  fillColor: string;
};
type MarkerEntry = { feature: GeoJSON.Feature; element: HTMLDivElement; lat: number; lng: number };
type PositionShape = { lat: number; lng: number; accuracy: number };
type StreetLabel = {
  latlng: LatLng;
  names: Record<string, string>;
  fallback: string;
  angle: number;
  priority: number;
  minZoom: number;
};
type LabelCache = {
  zoom: number;
  language: Language;
  entries: { entry: StreetLabel; name: string }[];
};
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

const MAX_CANVAS_PIXELS = 11_000_000;
const CANVAS_PADDING = 0.15;
const DOT_THRESHOLD = 1.15;
const MIN_DRAG = 3;
/** How long to wait for the compatibility click that follows a selecting tap. */
const TAP_CLICK_GUARD_MS = 400;
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
function lineCoordinates(feature: GeoJSON.Feature): number[][] {
  const geometry = feature.geometry;
  if (geometry?.type === 'LineString') return geometry.coordinates as number[][];
  if (geometry?.type === 'MultiLineString') return geometry.coordinates.flat() as number[][];
  return [];
}
function roadLength(feature: GeoJSON.Feature) {
  const line = lineCoordinates(feature);
  return line
    .slice(1)
    .reduce(
      (sum, point, index) => sum + Math.hypot(point[0] - line[index][0], point[1] - line[index][1]),
      0,
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
  private readonly markersLayer: HTMLDivElement;
  private readonly tooltip: HTMLDivElement;
  private readonly baseCtx: CanvasRenderingContext2D | null;
  private readonly overlayCtx: CanvasRenderingContext2D | null;
  private readonly onSelect: (id: string) => void;
  private readonly onViewChange?: (center: LatLng, zoom: number) => void;
  private readonly minZoom: number;
  private readonly maxZoom: number;
  private readonly zoomSnap: number;
  private readonly resizeObserver: ResizeObserver;
  private size: Point = { x: 1, y: 1 };
  private padding: Point = { x: 0, y: 0 };
  private dpr = 1;
  private view: Camera;
  private rendered: RenderedCamera | null = null;
  private baseFeatures: GeoJSON.Feature[] = [];
  private baseBoxes: Float32Array | null = null;
  private baseGroups: BaseGroups = { green: [], water: [], roads: [], landmarks: [] };
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
  private streetLabels: StreetLabel[] = [];
  private labelCache: LabelCache | null = null;
  private raf: number | null = null;
  private animating = false;
  private wheelTimer: number | null = null;
  private wheelDelta = 0;
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
    this.markersLayer = document.createElement('div');
    this.markersLayer.className = 'atlas-map-markers';
    this.markersLayer.style.display = 'none';
    this.baseCtx = this.baseCanvas.getContext('2d');
    this.overlayCtx = this.overlayCanvas.getContext('2d');
    this.tooltip = document.createElement('div');
    this.tooltip.className = 'atlas-map-tooltip';
    this.tooltip.setAttribute('role', 'tooltip');
    this.pan.append(this.baseCanvas, this.overlayCanvas, this.markersLayer);
    this.container.append(this.pan, this.tooltip);
    this.container.tabIndex = this.container.tabIndex < 0 ? 0 : this.container.tabIndex;
    this.attachEvents();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.container);
    this.resize();
  }

  /** Replace all basemap vector features (roads, water, parks, landmarks). */
  setBasemap(collection: GeoJSON.FeatureCollection) {
    this.baseFeatures = collection.features;
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
    this.streetLabels = this.prepareStreetLabels();
    this.labelCache = null;
    this.markersLayer.style.display = this.visibility.landmarks ? '' : 'none';
    this.updateMarkerLabels();
    this.renderBase();
    this.repositionMarkers();
    this.renderOverlay();
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
            bbox,
            periodLabels: buildingPeriods.map((p) => p.label),
            fillColor: buildingPeriods[0].color,
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
    this.labelCache = null;
    this.hideTooltip();
    this.updateMarkerLabels();
    this.renderOverlay();
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
    if (
      previous.detailedStreets !== visibility.detailedStreets ||
      previous.landmarks !== visibility.landmarks
    )
      this.renderOverlay();
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
    this.setView(this.view.center, this.limitZoom(this.view.zoom + 1), {
      animate: true,
      duration: 220,
    });
  }
  zoomOut() {
    this.setView(this.view.center, this.limitZoom(this.view.zoom - 1), {
      animate: true,
      duration: 220,
    });
  }

  setView(center: LatLng, zoom: number, options: { animate?: boolean; duration?: number } = {}) {
    const nextZoom = this.limitZoom(zoom);
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
    if (this.wheelTimer !== null) window.clearTimeout(this.wheelTimer);
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

  private limitZoom(zoom: number) {
    const snapped = this.zoomSnap > 0 ? Math.round(zoom / this.zoomSnap) * this.zoomSnap : zoom;
    return clamp(snapped, this.minZoom, this.maxZoom);
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
    this.sizeCanvas(this.baseCanvas, cssWidth, cssHeight);
    this.sizeCanvas(this.overlayCanvas, cssWidth, cssHeight);
    this.markersLayer.style.width = `${width}px`;
    this.markersLayer.style.height = `${height}px`;
    this.renderAll();
  }

  private sizeCanvas(canvas: HTMLCanvasElement, width: number, height: number) {
    const pixelWidth = Math.max(1, Math.round(width * this.dpr)),
      pixelHeight = Math.max(1, Math.round(height * this.dpr));
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

  private renderAll() {
    if (this.destroyed || !this.size.x || !this.size.y) return;
    this.stopAnimation(false);
    this.rendered = {
      center: { ...this.view.center },
      zoom: this.view.zoom,
      origin: this.originFor(this.view),
    };
    this.pan.style.transform = '';
    this.renderBase();
    this.renderOverlay();
    this.repositionMarkers();
    this.reportView();
  }

  private renderAt(camera: Camera) {
    this.rendered = {
      center: { ...camera.center },
      zoom: camera.zoom,
      origin: this.originFor(camera),
    };
    this.pan.style.transform = '';
    this.renderBase();
    this.renderOverlay();
    this.repositionMarkers();
  }

  private renderBase() {
    const context = this.baseCtx;
    if (!context) return;
    const cssWidth = this.size.x + this.padding.x * 2,
      cssHeight = this.size.y + this.padding.y * 2;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, Math.round(cssWidth * this.dpr), Math.round(cssHeight * this.dpr));
    if (!this.rendered) return;
    context.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
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
      if (this.visibility.detailedStreets) {
        const major = new Set(['primary', 'secondary', 'trunk']);
        let any = false;
        context.beginPath();
        for (const index of this.baseGroups.roads) {
          if (
            !this.boxVisible(boxes, index, view) ||
            major.has(String(this.baseFeatures[index].properties?.class))
          )
            continue;
          const geometry = this.baseFeatures[index].geometry;
          if (geometry) {
            addGeometry(geometry, context);
            any = true;
          }
        }
        if (any) {
          context.strokeStyle = '#fffefa';
          context.lineWidth = 1.7;
          context.stroke();
        }
        any = false;
        context.beginPath();
        for (const index of this.baseGroups.roads) {
          if (
            !this.boxVisible(boxes, index, view) ||
            !major.has(String(this.baseFeatures[index].properties?.class))
          )
            continue;
          const geometry = this.baseFeatures[index].geometry;
          if (geometry) {
            addGeometry(geometry, context);
            any = true;
          }
        }
        if (any) {
          context.strokeStyle = '#fffefa';
          context.lineWidth = 3.1;
          context.stroke();
        }
      } else {
        let any = false;
        context.beginPath();
        for (const index of this.baseGroups.roads) {
          if (!this.boxVisible(boxes, index, view)) continue;
          const geometry = this.baseFeatures[index].geometry;
          if (geometry) {
            addGeometry(geometry, context);
            any = true;
          }
        }
        if (any) {
          context.strokeStyle = '#fffefa';
          context.lineWidth = 1.5;
          context.stroke();
        }
      }
    }
    if (this.visibility.landmarks) {
      const landmarks = this.baseGroups.landmarks.filter((index) => {
        const geometry = this.baseFeatures[index].geometry;
        return geometry && geometryIsArea(geometry);
      });
      drawGroup(landmarks, { fill: 'rgba(199,168,120,.34)', stroke: '#947652', width: 1.4 });
    }
    if (this.buildingsVisible && this.outlineBoxes) {
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
    context.clearRect(x0 * this.dpr, y0 * this.dpr, (x1 - x0) * this.dpr, (y1 - y0) * this.dpr);
    context.restore();
    context.save();
    context.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
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
    if (Math.abs(this.view.zoom - this.rendered.zoom) > 1e-6) {
      this.renderAll();
      return;
    }
    const context = this.baseCtx;
    if (!context) return;
    const viewOrigin = this.originFor(this.view);
    const bakeX = Math.round((this.rendered.origin.x - viewOrigin.x) * this.dpr) / this.dpr;
    const bakeY = Math.round((this.rendered.origin.y - viewOrigin.y) * this.dpr) / this.dpr;
    const canvasWidth = this.size.x + this.padding.x * 2,
      canvasHeight = this.size.y + this.padding.y * 2;
    if (Math.abs(bakeX) >= canvasWidth || Math.abs(bakeY) >= canvasHeight) {
      this.renderAll();
      return;
    }
    if (bakeX === 0 && bakeY === 0) {
      this.applyPanTransform(this.rendered, this.view);
      return;
    }
    context.save();
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.globalCompositeOperation = 'copy';
    context.drawImage(this.baseCanvas, Math.round(bakeX * this.dpr), Math.round(bakeY * this.dpr));
    context.globalCompositeOperation = 'source-over';
    context.restore();
    const origin = { x: this.rendered.origin.x - bakeX, y: this.rendered.origin.y - bakeY };
    const center = unproject(
      origin.x + this.size.x / 2,
      origin.y + this.size.y / 2,
      this.view.zoom,
    );
    this.rendered = { center, zoom: this.view.zoom, origin };
    if (bakeX !== 0)
      this.renderBaseRegion(
        { x: bakeX > 0 ? 0 : canvasWidth + bakeX, y: 0, w: Math.abs(bakeX), h: canvasHeight },
        this.rendered,
      );
    if (bakeY !== 0)
      this.renderBaseRegion(
        { x: 0, y: bakeY > 0 ? 0 : canvasHeight + bakeY, w: canvasWidth, h: Math.abs(bakeY) },
        this.rendered,
      );
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

  private settleDrag() {
    if (!this.rendered) return;
    if (Math.abs(this.view.zoom - this.rendered.zoom) > 1e-6) {
      this.renderAll();
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
      const size = 1 / this.dpr;
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
      const size = 1 / this.dpr;
      context.rect(x, y, size, size);
    }
    context.fillStyle = 'rgba(214,216,207,.34)';
    context.fill();
  }

  private renderOverlay() {
    const context = this.overlayCtx;
    if (!context) return;
    const cssWidth = this.size.x + this.padding.x * 2,
      cssHeight = this.size.y + this.padding.y * 2;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, Math.round(cssWidth * this.dpr), Math.round(cssHeight * this.dpr));
    if (!this.rendered) return;
    context.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.drawAtlas(context, this.rendered);
    if (this.visibility.detailedStreets) this.drawLabels(context, this.rendered);
    this.drawPosition(context, this.rendered);
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

  private drawLabels(context: CanvasRenderingContext2D, camera: RenderedCamera) {
    if (!this.streetLabels.length) return;
    context.font = '500 8.5px sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillStyle = 'rgba(117,129,118,.75)';
    context.strokeStyle = 'rgba(255,254,248,.85)';
    context.lineWidth = 3;
    context.lineJoin = 'round';
    const zoom = camera.zoom;
    if (
      !this.labelCache ||
      this.labelCache.zoom !== zoom ||
      this.labelCache.language !== this.language
    ) {
      const occupied = new Set<string>(),
        entries: { entry: StreetLabel; name: string }[] = [];
      for (const entry of this.streetLabels) {
        if (zoom < entry.minZoom) continue;
        const worldPoint = project(entry.latlng.lat, entry.latlng.lng, zoom),
          name = entry.names[this.language] || entry.fallback;
        const radius = Math.max(context.measureText(name).width / 2, 10),
          cells: string[] = [];
        for (
          let x = Math.floor((worldPoint.x - radius) / 80);
          x <= Math.floor((worldPoint.x + radius) / 80);
          x++
        )
          for (
            let y = Math.floor((worldPoint.y - 10) / 24);
            y <= Math.floor((worldPoint.y + 10) / 24);
            y++
          )
            cells.push(`${x}:${y}`);
        if (cells.some((cell) => occupied.has(cell))) continue;
        cells.forEach((cell) => occupied.add(cell));
        entries.push({ entry, name });
      }
      this.labelCache = { zoom, language: this.language, entries };
    }
    const offsetX = this.padding.x - camera.origin.x,
      offsetY = this.padding.y - camera.origin.y;
    const cssWidth = this.size.x + this.padding.x * 2,
      cssHeight = this.size.y + this.padding.y * 2;
    for (const { entry, name } of this.labelCache.entries) {
      const point = project(entry.latlng.lat, entry.latlng.lng, zoom);
      const x = point.x + offsetX,
        y = point.y + offsetY;
      if (x < 0 || y < 0 || x > cssWidth || y > cssHeight) continue;
      context.save();
      context.translate(x, y);
      context.rotate((entry.angle * Math.PI) / 180);
      context.strokeText(name, 0, 0);
      context.fillText(name, 0, 0);
      context.restore();
    }
  }

  private repositionMarkers() {
    if (!this.rendered) return;
    const { origin, zoom } = this.rendered;
    for (const marker of this.markers) {
      const point = project(marker.lat, marker.lng, zoom);
      marker.element.style.left = `${point.x - origin.x}px`;
      marker.element.style.top = `${point.y - origin.y}px`;
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

  private prepareStreetLabels() {
    const roadFeatures = this.baseFeatures.filter(
      (feature) =>
        feature.properties?.kind === 'road' &&
        typeof feature.properties?.name === 'string' &&
        feature.properties.name.trim(),
    );
    const priority: Record<string, number> = {
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
    const longestRoads = new Map<string, GeoJSON.Feature>();
    for (const feature of roadFeatures) {
      const name = String(feature.properties?.name ?? '').trim(),
        current = longestRoads.get(name);
      if (!current || roadLength(feature) > roadLength(current)) longestRoads.set(name, feature);
    }
    const labels: StreetLabel[] = [];
    for (const feature of longestRoads.values()) {
      const coordinates = lineCoordinates(feature);
      if (coordinates.length < 2) continue;
      const total = roadLength(feature);
      if (total < 0.00035) continue;
      let passed = 0,
        midpoint = coordinates[Math.floor(coordinates.length / 2)],
        direction = [0, 0];
      for (let index = 1; index < coordinates.length; index++) {
        const a = coordinates[index - 1],
          b = coordinates[index],
          length = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (passed + length >= total / 2) {
          const t = (total / 2 - passed) / length;
          midpoint = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
          direction = [b[0] - a[0], b[1] - a[1]];
          break;
        }
        passed += length;
      }
      let angle = (Math.atan2(-direction[1], direction[0]) * 180) / Math.PI;
      if (angle > 90) angle -= 180;
      if (angle < -90) angle += 180;
      if (!direction[0] && !direction[1]) angle = 0;
      const priorityValue = priority[String(feature.properties?.class)];
      if (priorityValue === undefined) continue;
      labels.push({
        latlng: { lat: midpoint[1], lng: midpoint[0] },
        names: (feature.properties?.names ?? {}) as Record<string, string>,
        fallback: String(feature.properties?.name ?? ''),
        angle,
        priority: priorityValue,
        minZoom: priorityValue >= 5 ? 11.5 : priorityValue >= 3 ? 12.5 : 14,
      });
    }
    labels.sort((a, b) => b.priority - a.priority);
    return labels;
  }

  private animateTo(target: Camera, duration: number) {
    this.stopAnimation(false);
    this.hideTooltip();
    const preRender = this.rendered !== null && target.zoom < this.rendered.zoom - 0.75;
    if (preRender) this.renderAt(target);
    else if (!this.rendered) {
      this.renderAt(this.view);
    }
    const from = { center: { ...this.view.center }, zoom: this.view.zoom };
    if (preRender) this.applyPanTransform(this.rendered!, this.view);
    this.animating = true;
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
          this.renderOverlay();
          this.repositionMarkers();
          this.reportView();
        } else {
          this.renderAll();
        }
      }
    };
    this.raf = requestAnimationFrame(step);
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
    const zoom = this.limitZoom(
      this.pinch.startZoom + Math.log2(distance / this.pinch.startDistance),
    );
    const scale = 2 ** (zoom - this.pinch.startZoom);
    const anchor = { x: this.pinch.anchorWorld.x * scale, y: this.pinch.anchorWorld.y * scale };
    const origin = { x: anchor.x - midpoint.x, y: anchor.y - midpoint.y };
    const center = unproject(origin.x + this.size.x / 2, origin.y + this.size.y / 2, zoom);
    this.view = { center, zoom };
    this.suppressClick = true;
    if (this.rendered) this.applyPanTransform(this.rendered, this.view);
    this.reportView();
  }

  private hitAt(point: Point): Building | null {
    const origin = this.originFor(this.view);
    const lng = unprojectX(origin.x + point.x, this.view.zoom);
    const lat = unprojectY(origin.y + point.y, this.view.zoom);
    for (let index = this.atlasEntries.length - 1; index >= 0; index--) {
      const entry = this.atlasEntries[index];
      if (
        lng < entry.bbox.minX ||
        lng > entry.bbox.maxX ||
        lat < entry.bbox.minY ||
        lat > entry.bbox.maxY
      )
        continue;
      if (pointInGeometry(lng, lat, entry.building.geometry)) return entry.building;
    }
    return null;
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

  private hoverAt(point: Point) {
    if (this.pointers.size) return;
    const building = this.hitAt(point);
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
    this.container.classList.remove('keyboard-focus');
    if (this.rendered && Math.abs(this.rendered.zoom - this.view.zoom) > 1e-6) this.renderAll();
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
    this.hoverAt(point);
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
      else this.settleDrag();
      return;
    }
    const session = this.drag;
    if (session && session.pointerId === event.pointerId) {
      this.drag = null;
      if (!session.moved && !session.onMarker && !this.suppressClick && allowClick) {
        const building = this.hitAt(point);
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
      this.settleDrag();
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
    if (this.rendered && Math.abs(this.rendered.zoom - this.view.zoom) > 1e-6) this.renderAll();
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
    this.wheelDelta += delta;
    this.wheelPoint = this.pointerPoint(event);
    this.stopAnimation(false);
    if (this.wheelTimer !== null) window.clearTimeout(this.wheelTimer);
    this.wheelTimer = window.setTimeout(() => this.applyWheelZoom(), 40);
  };

  private applyWheelZoom() {
    this.wheelTimer = null;
    if (!this.wheelDelta) return;
    const amount = (4 * Math.log(2 / (1 + Math.exp(-Math.abs(this.wheelDelta) / 240)))) / Math.LN2;
    const delta = Math.ceil(amount / 0.5) * 0.5 * Math.sign(this.wheelDelta);
    this.wheelDelta = 0;
    const zoom = this.limitZoom(this.view.zoom + delta);
    if (zoom === this.view.zoom) return;
    const origin = this.originFor(this.view);
    const anchorWorld = { x: origin.x + this.wheelPoint.x, y: origin.y + this.wheelPoint.y };
    const scale = 2 ** (zoom - this.view.zoom);
    const newOrigin = {
      x: anchorWorld.x * scale - this.wheelPoint.x,
      y: anchorWorld.y * scale - this.wheelPoint.y,
    };
    const center = unproject(newOrigin.x + this.size.x / 2, newOrigin.y + this.size.y / 2, zoom);
    this.setView(center, zoom, { animate: true, duration: 220 });
  }

  private handleDoubleClick = (event: MouseEvent) => {
    event.preventDefault();
    const point = this.pointerPoint(event as PointerEvent);
    const origin = this.originFor(this.view);
    const anchorWorld = { x: origin.x + point.x, y: origin.y + point.y };
    const zoom = this.limitZoom(this.view.zoom + 1);
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

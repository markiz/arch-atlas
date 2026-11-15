import { useEffect, useMemo, useRef, useState } from 'react';
import type { Geometry } from 'geojson';
import type { Building } from './types';
import { useI18n } from './i18n';
import { AtlasCanvasMap } from './map/AtlasCanvasMap';
import { emptyBBox, boundsFromBBox, extendBBox, geometryBounds } from './map/geometry';
import type { BBox, Bounds, LatLng, MapViewProps, OutlineBinary } from './map/types';
import { parseOutlineBinary } from './map/outline-binary';
import { layerMemory } from './map/layer-state';
import { rememberMapView, savedMapView } from './map/view-memory';

type Props = MapViewProps;

/** Drop the 79 MB outline graph after the layer has been off for a while. */
const OUTLINE_RELEASE_MS = 20_000;

function padded(bounds: Bounds, ratio: number): Bounds {
  const width = bounds.east - bounds.west,
    height = bounds.north - bounds.south;
  return {
    west: bounds.west - width * ratio,
    south: bounds.south - height * ratio,
    east: bounds.east + width * ratio,
    north: bounds.north + height * ratio,
  };
}
function boundsOfBuildings(buildings: Building[]): Bounds | null {
  const box = emptyBBox();
  for (const building of buildings) {
    const lng = building.coordinates?.[0],
      lat = building.coordinates?.[1];
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;
    box.minX = Math.min(box.minX, lng);
    box.maxX = Math.max(box.maxX, lng);
    box.minY = Math.min(box.minY, lat);
    box.maxY = Math.max(box.maxY, lat);
  }
  return Number.isFinite(box.minX) ? boundsFromBBox(box) : null;
}

export default function MapView({
  buildings,
  allBuildings,
  basemap,
  buildingOutlines,
  selected,
  onSelect,
  focus,
  reset,
  fit,
  showFit,
  onFit,
  selectedPeriods,
  hoveredPeriod,
  onFocusHandled,
}: Props) {
  const { t, language } = useI18n();
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<AtlasCanvasMap | null>(null);
  const selectionRef = useRef(onSelect);
  const buildingData = useRef<Promise<GeoJSON.FeatureCollection | OutlineBinary> | null>(null);
  const outlineFeatures = useRef<GeoJSON.Feature[] | null>(null);
  const outlineBinary = useRef<OutlineBinary | null>(null);
  const outlineReleaseTimer = useRef<number | null>(null);
  const handledFit = useRef(fit),
    handledReset = useRef(reset),
    focusHandled = useRef(onFocusHandled);
  focusHandled.current = onFocusHandled;
  selectionRef.current = onSelect;
  const atlasBounds = useMemo<Bounds | null>(() => {
    let box: BBox | null = null;
    for (const building of allBuildings) {
      const next = geometryBounds(building.geometry as Geometry | null);
      if (!next) continue;
      box = box ? extendBBox(box, next) : next;
    }
    return box ? boundsFromBBox(box) : null;
  }, [allBuildings]);
  const [locationMessage, setLocationMessage] = useState(''),
    [locating, setLocating] = useState(false),
    [layersOpen, setLayersOpen] = useState(false),
    [buildingLayerLoading, setBuildingLayerLoading] = useState(false),
    [buildingLayerError, setBuildingLayerError] = useState(false);
  const [showRoads, setShowRoads] = useState(() => layerMemory.showRoads),
    [showBuildings, setShowBuildings] = useState(() => layerMemory.showBuildings),
    [showWater, setShowWater] = useState(() => layerMemory.showWater),
    [detailedStreets, setDetailedStreets] = useState(() => layerMemory.detailedStreets),
    [showLandmarks, setShowLandmarks] = useState(() => {
      try {
        return localStorage.getItem('atlas-layer-landmarks') === 'true';
      } catch {
        return false;
      }
    }),
    [showGreen, setShowGreen] = useState(() => layerMemory.showGreen);
  useEffect(() => {
    try {
      localStorage.setItem('atlas-layer-landmarks', String(showLandmarks));
    } catch {}
  }, [showLandmarks]);
  useEffect(() => {
    layerMemory.showRoads = showRoads;
    layerMemory.showBuildings = showBuildings;
    layerMemory.showWater = showWater;
    layerMemory.detailedStreets = detailedStreets;
    layerMemory.showGreen = showGreen;
  }, [showRoads, showBuildings, showWater, detailedStreets, showGreen]);
  useEffect(() => {
    if (!container.current) return;
    const saved = savedMapView();
    const map = new AtlasCanvasMap(container.current, {
      center: saved?.center ?? { lat: 41.715, lng: 44.8 },
      zoom: saved?.zoom ?? 11.5,
      minZoom: 10,
      maxZoom: 19,
      zoomSnap: 0.5,
      onSelect: (id) => selectionRef.current(id),
      onViewChange: (center, zoom) => rememberMapView(center, zoom),
    });
    mapRef.current = map;
    map.setBasemap(basemap);
    map.setLanguage(language);
    map.setLayerVisibility({
      roads: showRoads,
      water: showWater,
      green: showGreen,
      landmarks: showLandmarks,
      detailedStreets,
    });
    map.setAtlas(buildings, selected, selectedPeriods, hoveredPeriod);
    if (showBuildings && outlineBinary.current) {
      map.setBuildingOutlinesBinary(outlineBinary.current);
      map.setBuildingsVisible(true);
    } else if (outlineFeatures.current && showBuildings) {
      map.setBuildingOutlines(outlineFeatures.current);
      map.setBuildingsVisible(true);
    }
    if (!saved && atlasBounds) map.fitBounds(padded(atlasBounds, 0.08), { animate: false });
    return () => {
      mapRef.current = null;
      map.destroy();
    };
  }, [basemap, atlasBounds]);
  useEffect(() => {
    mapRef.current?.setLayerVisibility({
      roads: showRoads,
      water: showWater,
      green: showGreen,
      landmarks: showLandmarks,
      detailedStreets,
    });
  }, [showRoads, showWater, showGreen, showLandmarks, detailedStreets]);
  useEffect(() => {
    mapRef.current?.setAtlas(buildings, selected, selectedPeriods, hoveredPeriod);
  }, [buildings, selected, selectedPeriods, hoveredPeriod]);
  useEffect(() => {
    mapRef.current?.setLanguage(language);
  }, [language]);
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    let cancelled = false;
    if (!showBuildings) {
      setBuildingLayerLoading(false);
      setBuildingLayerError(false);
      map.setBuildingsVisible(false);
      return;
    }
    setBuildingLayerLoading(true);
    setBuildingLayerError(false);
    const load = async () => {
      if (!buildingData.current) {
        buildingData.current = (async () => {
          if (buildingOutlines.path.includes('..') || buildingOutlines.path.startsWith('/'))
            throw new Error('Некорректный путь в пакете');
          const url = `${import.meta.env.BASE_URL}atlas/${buildingOutlines.path}?v=${encodeURIComponent(buildingOutlines.sha256)}`;
          const response = await fetch(url);
          if (!response.ok) throw new Error(`Не удалось загрузить ${buildingOutlines.path}`);
          const bytes = await response.arrayBuffer();
          const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)))
            .map((value) => value.toString(16).padStart(2, '0'))
            .join('');
          if (bytes.byteLength !== buildingOutlines.size || hash !== buildingOutlines.sha256)
            throw new Error(`Поврежден файл ${buildingOutlines.path}`);
          if (buildingOutlines.path.endsWith('.bin')) return parseOutlineBinary(bytes);
          return JSON.parse(new TextDecoder().decode(bytes)) as GeoJSON.FeatureCollection;
        })();
      }
      try {
        const data = await buildingData.current;
        if (cancelled) return;
        if ('features' in data) {
          outlineFeatures.current = data.features;
          outlineBinary.current = null;
          map.setBuildingOutlines(data.features);
        } else {
          outlineFeatures.current = null;
          outlineBinary.current = data;
          map.setBuildingOutlinesBinary(data);
        }
        map.setBuildingsVisible(true);
        setBuildingLayerLoading(false);
      } catch {
        buildingData.current = null;
        outlineFeatures.current = null;
        outlineBinary.current = null;
        if (cancelled) return;
        map.setBuildingOutlines(null);
        map.setBuildingsVisible(false);
        setBuildingLayerLoading(false);
        setBuildingLayerError(true);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [showBuildings, buildingOutlines, basemap, atlasBounds]);
  useEffect(() => {
    if (outlineReleaseTimer.current !== null) {
      window.clearTimeout(outlineReleaseTimer.current);
      outlineReleaseTimer.current = null;
    }
    if (!showBuildings) {
      outlineReleaseTimer.current = window.setTimeout(() => {
        outlineReleaseTimer.current = null;
        mapRef.current?.setBuildingOutlines(null);
        outlineFeatures.current = null;
        outlineBinary.current = null;
        buildingData.current = null;
      }, OUTLINE_RELEASE_MS);
    }
    return () => {
      if (outlineReleaseTimer.current !== null) {
        window.clearTimeout(outlineReleaseTimer.current);
        outlineReleaseTimer.current = null;
      }
    };
  }, [showBuildings]);
  useEffect(() => {
    if (!focus) return;
    const building = buildings.find((item) => item.id === focus.id);
    if (building)
      mapRef.current?.flyTo(
        { lat: building.coordinates[1], lng: building.coordinates[0] },
        17,
        450,
      );
    focusHandled.current();
  }, [focus]);
  useEffect(() => {
    if (fit === handledFit.current) return;
    const map = mapRef.current;
    if (!map) return;
    handledFit.current = fit;
    if (!buildings.length) return;
    const bounds = boundsOfBuildings(buildings);
    if (bounds) map.fitBounds(padded(bounds, 0.12), { maxZoom: 16, animate: true, duration: 450 });
  }, [fit]);
  useEffect(() => {
    if (reset === handledReset.current) return;
    const map = mapRef.current;
    if (!map) return;
    handledReset.current = reset;
    map.reset(atlasBounds);
  }, [reset, atlasBounds]);
  function locate() {
    if (!navigator.geolocation) {
      setLocationMessage(t('Геолокация недоступна в этом браузере.'));
      return;
    }
    setLocating(true);
    setLocationMessage(t('Определяем местоположение…'));
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLocating(false);
        setLocationMessage('');
        const point: LatLng = { lat: coords.latitude, lng: coords.longitude };
        const map = mapRef.current;
        if (!map) return;
        map.setPosition({ ...point, accuracy: coords.accuracy });
        map.flyTo(point, 17, 450);
      },
      (error) => {
        setLocating(false);
        setLocationMessage(
          t(
            error.code === 1
              ? 'Доступ к местоположению запрещён.'
              : error.code === 3
                ? 'Не удалось определить местоположение вовремя.'
                : 'Не удалось определить местоположение.',
          ),
        );
      },
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 60000 },
    );
  }
  return (
    <>
      <div className="map-canvas atlas-map-canvas">
        <div
          ref={container}
          className="atlas-map-host"
          aria-label={t('Интерактивная карта архитектурного атласа')}
          tabIndex={0}
        />
        <div className="map-attribution">
          &copy;{' '}
          <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
            OpenStreetMap
          </a>{' '}
          contributors
        </div>
        <div className="map-zoom">
          <button
            type="button"
            aria-label={t('Приблизить')}
            onClick={() => mapRef.current?.zoomIn()}
          >
            +
          </button>
          <button
            type="button"
            aria-label={t('Отдалить')}
            onClick={() => mapRef.current?.zoomOut()}
          >
            −
          </button>
        </div>
      </div>
      <div className="map-actions">
        {showFit && (
          <button className="fit-results" disabled={!buildings.length} onClick={onFit}>
            {t('Показать найденные')}
          </button>
        )}
        <div className="map-layers">
          <button
            className="map-layers-toggle"
            aria-label={t('Слои')}
            onClick={() => setLayersOpen((value) => !value)}
            aria-expanded={layersOpen}
            aria-controls="map-layers-panel"
          >
            <svg
              viewBox="0 0 24 24"
              width="17"
              height="17"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
            >
              <path d="m12 3 9 5-9 5-9-5 9-5Z" />
              <path d="m3 12 9 5 9-5M3 16l9 5 9-5" />
            </svg>
            <span>{t('Слои')}</span>
          </button>
          {layersOpen && (
            <div id="map-layers-panel" className="map-layers-panel">
              <p>{t('ОСНОВНАЯ КАРТА')}</p>
              <label>
                <input
                  type="checkbox"
                  checked={showRoads}
                  onChange={(event) => setShowRoads(event.target.checked)}
                />{' '}
                {t('Улицы')}
              </label>
              <label aria-live="polite">
                <input
                  type="checkbox"
                  checked={showBuildings}
                  onChange={(event) => setShowBuildings(event.target.checked)}
                />{' '}
                {t('Силуэты зданий')}
                {buildingLayerLoading && ` (${t('Загружается…')})`}
              </label>
              {buildingLayerError && (
                <small className="layer-status" role="alert">
                  {t('Не удалось загрузить силуэты зданий.')}
                </small>
              )}
              <label>
                <input
                  type="checkbox"
                  checked={showWater}
                  onChange={(event) => setShowWater(event.target.checked)}
                />{' '}
                {t('Реки и водоёмы')}
              </label>
              <p>{t('ДОПОЛНИТЕЛЬНЫЕ СЛОИ')}</p>
              <label>
                <input
                  type="checkbox"
                  checked={detailedStreets}
                  onChange={(event) => setDetailedStreets(event.target.checked)}
                />{' '}
                {t('Подробности улиц и названия')}
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={showLandmarks}
                  onChange={(event) => setShowLandmarks(event.target.checked)}
                />{' '}
                {t('Достопримечательности')}
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={showGreen}
                  onChange={(event) => setShowGreen(event.target.checked)}
                />{' '}
                {t('Парки и природные зоны')}
              </label>
            </div>
          )}
        </div>
      </div>
      <button
        className="locate-button"
        onClick={locate}
        disabled={locating}
        title={t('Моё местоположение')}
        aria-label={t('Показать моё местоположение')}
      >
        <svg
          viewBox="0 0 24 24"
          width="18"
          height="18"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
        >
          <circle cx="12" cy="12" r="7" />
          <circle cx="12" cy="12" r="2" fill="currentColor" />
          <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
        </svg>
      </button>
      {locationMessage && (
        <div className="location-message" role="status">
          {locationMessage}
          <button onClick={() => setLocationMessage('')} aria-label={t('Закрыть сообщение')}>
            ×
          </button>
        </div>
      )}
    </>
  );
}

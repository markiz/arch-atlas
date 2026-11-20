import { useEffect, useRef, useState } from 'react';
import type { Building, ManifestFile, Photo } from './types';
import { rankPhotos } from './photo-ranking.js';

export { rankPhotos } from './photo-ranking.js';

const atlasBase = import.meta.env.BASE_URL + 'atlas/';

export interface PhotoAsset {
  photo: Photo;
  full?: string;
  thumb?: string;
}
export interface BuildingPhotos {
  status: 'loading' | 'ready' | 'error';
  phase: 'preview' | 'gallery' | null;
  assets: PhotoAsset[];
  total: number;
  loaded: number;
  error?: string;
}

interface PhotoRun {
  state: BuildingPhotos;
  promise: Promise<BuildingPhotos>;
  listeners: Set<(state: BuildingPhotos) => void>;
}

interface CacheEntry {
  url: string;
  bytes: number;
  touched: number;
  createdAt: number;
  pins: number;
}

/** Keep the compressed photo cache bounded. Decoded images are browser-side. */
const MAX_PHOTO_CACHE_BYTES = 32 * 1024 * 1024;
/** Do not evict images that may still be loading into a visible <img>. */
const MIN_CACHE_AGE_MS = 8000;

const fileRequests = new Map<string, Promise<string>>();
const resolvedFiles = new Map<string, CacheEntry>();
const runs = new Map<string, PhotoRun>();
let cacheBytes = 0;

function evictCache() {
  if (cacheBytes <= MAX_PHOTO_CACHE_BYTES) return;
  const now = performance.now();
  const candidates = [...resolvedFiles.entries()]
    .filter(([, entry]) => entry.pins === 0 && now - entry.createdAt >= MIN_CACHE_AGE_MS)
    .sort((a, b) => a[1].touched - b[1].touched);
  for (const [file, entry] of candidates) {
    if (cacheBytes <= MAX_PHOTO_CACHE_BYTES) break;
    URL.revokeObjectURL(entry.url);
    resolvedFiles.delete(file);
    cacheBytes -= entry.bytes;
  }
}

/** Pin a photo that is currently displayed; pinned URLs are never evicted. */
export function pinPhotoUrl(file: string | undefined) {
  const entry = file ? resolvedFiles.get(file) : undefined;
  if (!entry) return;
  entry.pins++;
  entry.touched = performance.now();
}

/** Release a pin and opportunistically trim the cache. */
export function unpinPhotoUrl(file: string | undefined) {
  const entry = file ? resolvedFiles.get(file) : undefined;
  if (!entry) return;
  entry.pins = Math.max(0, entry.pins - 1);
  entry.touched = performance.now();
  evictCache();
}

/** Cache counters for memory checks in the browser. */
export function photoCacheStats() {
  return {
    entries: resolvedFiles.size,
    bytes: cacheBytes,
    pinned: [...resolvedFiles.values()].filter((entry) => entry.pins > 0).length,
  };
}

function errorText(error: unknown) {
  return error instanceof Error ? error.message : 'Не удалось загрузить фотографию';
}

function isSafePath(file: string) {
  return !!file && !file.includes('..') && !file.startsWith('/');
}

function hashHex(bytes: ArrayBuffer) {
  return crypto.subtle.digest('SHA-256', bytes).then((digest) =>
    Array.from(new Uint8Array(digest))
      .map((value) => value.toString(16).padStart(2, '0'))
      .join(''),
  );
}

/** Download and verify one photo from the local atlas bundle. */
export function loadPhotoFile(
  file: string,
  files: ReadonlyMap<string, ManifestFile>,
): Promise<string> {
  const resolved = resolvedFiles.get(file);
  if (resolved) {
    resolved.touched = performance.now();
    return Promise.resolve(resolved.url);
  }
  const pending = fileRequests.get(file);
  if (pending) return pending;
  const manifest = files.get(file);
  if (!manifest) return Promise.reject(new Error(`В пакете нет фотографии ${file}`));
  if (!isSafePath(file) || manifest.path !== file)
    return Promise.reject(new Error(`Некорректный путь фотографии ${file}`));
  const request = (async () => {
    const response = await fetch(`${atlasBase}${file}?v=${encodeURIComponent(manifest.sha256)}`);
    if (!response.ok) throw new Error(`Не удалось загрузить фотографию ${file}`);
    const bytes = await response.arrayBuffer();
    if (bytes.byteLength !== manifest.size || (await hashHex(bytes)) !== manifest.sha256)
      throw new Error(`Повреждена фотография ${file}`);
    const url = URL.createObjectURL(new Blob([bytes], { type: 'image/webp' }));
    resolvedFiles.set(file, {
      url,
      bytes: bytes.byteLength,
      touched: performance.now(),
      createdAt: performance.now(),
      pins: 0,
    });
    cacheBytes += bytes.byteLength;
    evictCache();
    return url;
  })();
  const tracked = request.then(
    (url) => {
      fileRequests.delete(file);
      return url;
    },
    (error) => {
      fileRequests.delete(file);
      throw error;
    },
  );
  fileRequests.set(file, tracked);
  return tracked;
}

/** A photo already downloaded during this session, if any. */
export function cachedPhotoUrl(file: string | undefined) {
  const entry = file ? resolvedFiles.get(file) : undefined;
  if (!entry) return undefined;
  entry.touched = performance.now();
  return entry.url;
}

function publish(run: PhotoRun, state: BuildingPhotos) {
  run.state = state;
  for (const listener of run.listeners) listener(state);
}

function startBuildingRun(building: Building, files: ReadonlyMap<string, ManifestFile>): PhotoRun {
  const run: PhotoRun = {
    state: { status: 'loading', phase: null, assets: [], total: 0, loaded: 0 },
    promise: Promise.resolve({ status: 'loading', phase: null, assets: [], total: 0, loaded: 0 }),
    listeners: new Set(),
  };
  const runKey = `${building.cityId}:${building.id}`;
  runs.set(runKey, run);
  run.promise = (async () => {
    const photos = rankPhotos(
      building.photos ?? (building.photo ? [building.photo] : []),
    ) as Photo[];
    const total = photos.length;
    if (!total) {
      const empty: BuildingPhotos = {
        status: 'ready',
        phase: 'gallery',
        assets: [],
        total: 0,
        loaded: 0,
      };
      publish(run, empty);
      return empty;
    }
    const thumbResults = await Promise.allSettled(
      photos.map((photo) =>
        photo.thumb
          ? loadPhotoFile(photo.thumb, files)
          : Promise.reject(new Error('У фотографии нет уменьшенной версии')),
      ),
    );
    const previewAssets = photos.map((photo, index) => {
      const result = thumbResults[index];
      return { photo, thumb: result.status === 'fulfilled' ? result.value : undefined };
    });
    const failures = thumbResults.filter((result) => result.status === 'rejected').length;
    const noImages = previewAssets.every((asset) => !asset.thumb);
    // Full gallery files are loaded on demand by useFullPhoto: opening a card
    // used to download every photo of the object, even though one is shown.
    const ready: BuildingPhotos = {
      status: noImages ? 'error' : 'ready',
      phase: 'gallery',
      assets: previewAssets,
      total,
      loaded: total - failures,
      error: failures
        ? failures === total
          ? 'Превью не загрузились.'
          : 'Часть превью не загрузилась.'
        : undefined,
    };
    publish(run, ready);
    return ready;
  })().catch((error) => {
    const failed: BuildingPhotos = {
      status: 'error',
      phase: null,
      assets: [],
      total: 0,
      loaded: 0,
      error: errorText(error),
    };
    publish(run, failed);
    return failed;
  });
  return run;
}

/** Load all previews for an object first, then its full gallery files. */
export function useBuildingPhotos(
  building: Building | null,
  files: ReadonlyMap<string, ManifestFile>,
) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<BuildingPhotos>({
    status: 'loading',
    phase: null,
    assets: [],
    total: 0,
    loaded: 0,
  });
  const pinnedFiles = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!building) {
      setState({ status: 'ready', phase: 'gallery', assets: [], total: 0, loaded: 0 });
      return;
    }
    const run = startBuildingRun(building, files);
    setState(run.state);
    run.listeners.add(setState);
    return () => {
      run.listeners.delete(setState);
      if (!run.listeners.size) runs.delete(`${building.cityId}:${building.id}`);
    };
  }, [building?.id, building?.cityId, files, attempt]);
  // Keep every file of the open gallery in memory; navigation between its
  // photos must not hit an evicted URL.
  useEffect(() => {
    const next = new Set<string>();
    for (const asset of state.assets) {
      if (asset.photo?.thumb) next.add(asset.photo.thumb);
    }
    for (const file of next) if (!pinnedFiles.current.has(file)) pinPhotoUrl(file);
    for (const file of pinnedFiles.current) if (!next.has(file)) unpinPhotoUrl(file);
    pinnedFiles.current = next;
  }, [state.assets]);
  useEffect(
    () => () => {
      for (const file of pinnedFiles.current) unpinPhotoUrl(file);
      pinnedFiles.current.clear();
    },
    [],
  );
  const retry = () => {
    if (!building) return;
    runs.delete(`${building.cityId}:${building.id}`);
    setAttempt((value) => value + 1);
  };
  return { ...state, retry };
}

/** Request one preview file only after its card becomes visible. */
export function useLazyPhoto(
  file: string | undefined,
  files: ReadonlyMap<string, ManifestFile>,
  visible: boolean,
) {
  const [url, setUrl] = useState<string | undefined>(() => cachedPhotoUrl(file));
  const [error, setError] = useState('');
  useEffect(() => {
    if (!file || !visible || url) return;
    let active = true;
    loadPhotoFile(file, files)
      .then((value) => {
        if (active) setUrl(value);
      })
      .catch((value) => {
        if (active) setError(errorText(value));
      });
    return () => {
      active = false;
    };
  }, [file, files, visible, url]);
  return { url, error };
}

/** Load the full file for the photo currently displayed in the inspector. */
export function useFullPhoto(photo: Photo | undefined, files: ReadonlyMap<string, ManifestFile>) {
  const [state, setState] = useState<{
    file?: string;
    url?: string;
    error: string;
    loading: boolean;
  }>({ error: '', loading: false });
  const pinned = useRef<string | null>(null);
  useEffect(() => {
    let active = true;
    const file = photo?.file;
    setState({ file, error: '', loading: false });
    if (!file) return;
    setState({ file, error: '', loading: true });
    loadPhotoFile(file, files)
      .then((value) => {
        if (!active) return;
        pinPhotoUrl(file);
        pinned.current = file;
        setState({ file, url: value, error: '', loading: false });
      })
      .catch((value) => {
        if (!active) return;
        setState({ file, error: errorText(value), loading: false });
      });
    return () => {
      active = false;
      if (pinned.current) {
        unpinPhotoUrl(pinned.current);
        pinned.current = null;
      }
    };
  }, [photo?.file, files]);
  const current = state.file === photo?.file ? state : undefined;
  return {
    url: current?.url,
    error: current?.error || '',
    loading: current?.loading || false,
  };
}

export function useVisibility<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (visible || !ref.current) return;
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '240px' },
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [visible]);
  return { ref, visible };
}

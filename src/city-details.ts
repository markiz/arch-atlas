import { useEffect, useRef, useState } from 'preact/hooks';
import type {
  AtlasCreditsBundle,
  AtlasDetailsBundle,
  BuildingDetails,
  Data,
  ManifestFile,
  PhotoCredit,
} from './types';
import type { Language } from './languages.ts';
import { readResponseBytes } from './fetch-progress';
import { waitForServiceWorker } from './service-worker';

const atlasBase = import.meta.env.BASE_URL + 'atlas/';

type LoadState<T> = {
  status: 'idle' | 'loading' | 'ready' | 'error' | 'unavailable';
  value: T;
  error: string;
  language?: Language;
};

async function hashHex(bytes: ArrayBuffer) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)))
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
}

async function loadVerified(file: ManifestFile, signal: AbortSignal) {
  if (file.path.includes('..') || file.path.startsWith('/'))
    throw new Error('Некорректный путь в пакете');
  await waitForServiceWorker();
  const response = await fetch(`${atlasBase}${file.path}?v=${encodeURIComponent(file.sha256)}`, {
    signal,
  });
  if (!response.ok) throw new Error(`Не удалось загрузить ${file.path}`);
  const bytes = await readResponseBytes(response, file.size);
  if ((await hashHex(bytes)) !== file.sha256) throw new Error(`Поврежден файл ${file.path}`);
  return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
}

function parseDetails(bundle: unknown, language: Language): Map<string, BuildingDetails> {
  const value = bundle as AtlasDetailsBundle;
  if (
    !value ||
    value.version !== 1 ||
    value.language !== language ||
    !Array.isArray(value.buildings)
  )
    throw new Error('Неизвестный формат описаний');
  return new Map(
    value.buildings.map((item) => [
      item.id,
      {
        id: item.id,
        description: typeof item.description === 'string' ? item.description : '',
        history: typeof item.history === 'string' ? item.history : '',
        geometryQuality: typeof item.geometryQuality === 'string' ? item.geometryQuality : '',
      },
    ]),
  );
}

function parseCredits(bundle: unknown): Map<string, PhotoCredit> {
  const value = bundle as AtlasCreditsBundle;
  if (!value || value.version !== 1 || !Array.isArray(value.photos))
    throw new Error('Неизвестный формат атрибуции фото');
  return new Map(value.photos.map((item) => [item.id, item]));
}

/** Load one language's inspector text after the map/catalog are already visible. */
export function useCityDetails(data: Data, language: Language) {
  const file = data.detailsFiles?.[language];
  const cache = useRef(new Map<string, Map<string, BuildingDetails>>());
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<LoadState<Map<string, BuildingDetails>>>({
    status: 'idle',
    value: new Map(),
    error: '',
    language,
  });
  useEffect(() => {
    if (!file) {
      setState({ status: 'unavailable', value: new Map(), error: '', language });
      return;
    }
    const key = `${data.city.id}:${language}:${file.sha256}`;
    const cached = cache.current.get(key);
    if (cached) {
      setState({ status: 'ready', value: cached, error: '', language });
      return;
    }
    const controller = new AbortController();
    let active = true;
    setState({ status: 'loading', value: new Map(), error: '', language });
    loadVerified(file, controller.signal)
      .then((bundle) => parseDetails(bundle, language))
      .then((details) => {
        if (!active) return;
        cache.current.set(key, details);
        setState({ status: 'ready', value: details, error: '', language });
      })
      .catch((error) => {
        if (!active || controller.signal.aborted) return;
        setState({
          status: 'error',
          value: new Map(),
          error: error instanceof Error ? error.message : 'Ошибка загрузки описаний',
          language,
        });
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [data.city.id, file, language, attempt]);
  return {
    ...state,
    value: state.language === language ? state.value : new Map(),
    retry: () => {
      if (file) cache.current.delete(`${data.city.id}:${language}:${file.sha256}`);
      setAttempt((value) => value + 1);
    },
  };
}

/** Download a city-wide pack once the browser has spare time. */
function whenIdle(callback: () => void) {
  if (typeof window.requestIdleCallback === 'function') {
    const id = window.requestIdleCallback(callback, { timeout: 2000 });
    return () => window.cancelIdleCallback(id);
  }
  const id = window.setTimeout(callback, 1200);
  return () => window.clearTimeout(id);
}

/**
 * The photo credits pack is downloaded in the background after the city opens,
 * so the inspector rarely waits for it. `urgent` skips the idle delay when a
 * card is already open — from a deep link or an early click.
 */
export function usePhotoCredits(data: Data, urgent: boolean) {
  const file = data.creditsFile;
  const cache = useRef(new Map<string, Map<string, PhotoCredit>>());
  const [attempt, setAttempt] = useState(0);
  const [started, setStarted] = useState(false);
  const [state, setState] = useState<LoadState<Map<string, PhotoCredit>>>({
    status: 'idle',
    value: new Map(),
    error: '',
  });
  useEffect(() => {
    if (!file) {
      setState({ status: 'unavailable', value: new Map(), error: '' });
      return;
    }
    if (started) return;
    if (cache.current.has(`${data.city.id}:${file.sha256}`)) return;
    if (urgent) {
      setStarted(true);
      return;
    }
    return whenIdle(() => setStarted(true));
  }, [data.city.id, file, urgent, started]);
  useEffect(() => {
    if (!file || !started) return;
    const key = `${data.city.id}:${file.sha256}`;
    const cached = cache.current.get(key);
    if (cached) {
      setState({ status: 'ready', value: cached, error: '' });
      return;
    }
    const controller = new AbortController();
    let active = true;
    setState({ status: 'loading', value: new Map(), error: '' });
    loadVerified(file, controller.signal)
      .then(parseCredits)
      .then((credits) => {
        if (!active) return;
        cache.current.set(key, credits);
        setState({ status: 'ready', value: credits, error: '' });
      })
      .catch((error) => {
        if (!active || controller.signal.aborted) return;
        setState({
          status: 'error',
          value: new Map(),
          error: error instanceof Error ? error.message : 'Ошибка загрузки атрибуции',
        });
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [data.city.id, file, started, attempt]);
  const retried = useRef(false);
  useEffect(() => {
    if (!urgent) {
      retried.current = false;
      return;
    }
    // A failed background prefetch must not hide the credits for the whole
    // session; retry once when the reader opens a card.
    if (state.status === 'error' && !retried.current) {
      retried.current = true;
      setAttempt((value) => value + 1);
    }
  }, [urgent, state.status]);
  return {
    ...state,
    retry: () => {
      if (file) cache.current.delete(`${data.city.id}:${file.sha256}`);
      setStarted(true);
      setAttempt((value) => value + 1);
    },
  };
}

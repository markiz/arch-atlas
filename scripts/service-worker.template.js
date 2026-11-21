// Generated into dist/sw.js by vite.config.ts. Do not edit dist/sw.js.
const CACHE_VERSION = '__CACHE_VERSION__';
const CACHE_NAME = `atlas-${CACHE_VERSION}`;
const INDEX_URL = new URL('./index.html', self.location).href;
const PHOTO_PATTERN = /\/atlas\/(?:photos|thumbnails|cards)\//;
const IMAGE_PATTERN = /\.(?:webp|jpe?g|png|avif|gif)$/i;
const HASHED_ASSET_PATTERN = /-([a-z0-9_-]{8,})\.[a-z0-9]+$/i;

function isPhoto(url) {
  return PHOTO_PATTERN.test(url.pathname) || IMAGE_PATTERN.test(url.pathname);
}

function versionOf(url) {
  const version = url.searchParams.get('v');
  if (version) return version;
  if (url.pathname.includes('/assets/')) {
    const match = HASHED_ASSET_PATTERN.exec(url.pathname);
    return match ? match[1] : '';
  }
  return '';
}

/** One cache entry per logical URL; the version lives in the response URL. */
function cacheKey(url) {
  if (!url.searchParams.has('v')) return url.href;
  const canonical = new URL(url.href);
  canonical.searchParams.delete('v');
  return canonical.href;
}

async function put(cache, url, response) {
  await cache.put(cacheKey(url), response.clone());
}

/** Read a resource the page already fetched, without touching the network. */
async function fromHttpCache(url) {
  try {
    const response = await fetch(
      new Request(url, {
        cache: 'only-if-cached',
        mode: 'same-origin',
        credentials: 'same-origin',
      }),
    );
    return response.ok ? response : null;
  } catch {
    return null;
  }
}

async function cacheFirst(request) {
  const url = new URL(request.url);
  const key = cacheKey(url);
  const version = versionOf(url);
  const cache = await caches.open(CACHE_NAME);
  const hit = await cache.match(key);
  if (hit && versionOf(new URL(hit.url)) === version) return hit;
  let response;
  try {
    response = await fetch(request);
  } catch (error) {
    const cached = await fromHttpCache(url);
    if (!cached) throw error;
    try {
      await put(cache, url, cached);
    } catch (putError) {
      console.warn('[atlas] cache put failed', url.href, putError);
    }
    return cached;
  }
  if (response.ok) {
    try {
      await put(cache, url, response);
    } catch (error) {
      console.warn('[atlas] cache put failed', url.href, error);
    }
  }
  return response;
}

async function networkFirst(request) {
  const url = new URL(request.url);
  const key = cacheKey(url);
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    if (response.ok) {
      try {
        await put(cache, url, response);
      } catch (error) {
        console.warn('[atlas] cache put failed', url.href, error);
      }
    }
    return response;
  } catch (error) {
    const hit = await cache.match(key);
    if (hit) return hit;
    const cached = await fromHttpCache(url);
    if (!cached) throw error;
    try {
      await cache.put(key, cached.clone());
    } catch (putError) {
      console.warn('[atlas] cache put failed', url.href, putError);
    }
    return cached;
  }
}

async function adopt(urls) {
  const cache = await caches.open(CACHE_NAME);
  for (const value of urls) {
    let url;
    try {
      url = new URL(value, self.location);
    } catch {
      continue;
    }
    if (url.origin !== self.location.origin || isPhoto(url)) continue;
    if (url.pathname === new URL('./sw.js', self.location).pathname) continue;
    const key = cacheKey(url);
    if (await cache.match(key)) continue;
    const response = await fromHttpCache(url);
    if (!response) continue;
    try {
      if (response.headers.get('content-type')?.includes('text/html')) {
        await cache.put(INDEX_URL, response.clone());
      } else {
        await cache.put(key, response.clone());
      }
    } catch (error) {
      console.warn('[atlas] cache put failed', url.href, error);
    }
  }
}

async function navigationFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    if (response.ok) {
      try {
        await cache.put(INDEX_URL, response.clone());
      } catch (error) {
        console.warn('[atlas] cache put failed', INDEX_URL, error);
      }
    }
    return response;
  } catch (error) {
    const hit = await cache.match(INDEX_URL);
    if (hit) return hit;
    for (const url of [new URL(request.url), INDEX_URL]) {
      const cached = await fromHttpCache(url);
      if (!cached) continue;
      try {
        await cache.put(INDEX_URL, cached.clone());
      } catch (putError) {
        console.warn('[atlas] cache put failed', INDEX_URL, putError);
      }
      return cached;
    }
    throw error;
  }
}

self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data || data.type !== 'atlas-adopt' || !Array.isArray(data.urls)) return;
  event.waitUntil(adopt(data.urls));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith('atlas-') && key !== CACHE_NAME)
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname === new URL('./sw.js', self.location).pathname) return;
  if (isPhoto(url)) return;

  if (request.mode === 'navigate') {
    event.respondWith(navigationFirst(request));
    return;
  }
  event.respondWith(versionOf(url) ? cacheFirst(request) : networkFirst(request));
});

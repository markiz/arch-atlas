const PHOTO_PATTERN = /\/atlas\/(?:photos|thumbnails|cards)\//;
const IMAGE_PATTERN = /\.(?:webp|jpe?g|png|avif|gif)$/i;

let started: Promise<void> | null = null;

function isPhoto(url: URL) {
  return PHOTO_PATTERN.test(url.pathname) || IMAGE_PATTERN.test(url.pathname);
}

function waitForController(timeoutMs: number) {
  if (navigator.serviceWorker.controller) return Promise.resolve();
  return new Promise<void>((resolve) => {
    let timer = 0;
    const onChange = () => {
      window.clearTimeout(timer);
      resolve();
    };
    timer = window.setTimeout(() => {
      navigator.serviceWorker.removeEventListener('controllerchange', onChange);
      resolve();
    }, timeoutMs);
    navigator.serviceWorker.addEventListener('controllerchange', onChange, { once: true });
    if (navigator.serviceWorker.controller) onChange();
  });
}

/**
 * Hand the worker the files that were already downloaded before it took
 * control. The worker reads them from the browser's HTTP cache; this sends
 * URLs, not bodies, and never goes to the network. Requests made after the
 * worker is active are cached by its fetch handler instead.
 */
function adoptLoadedResources() {
  const controller = navigator.serviceWorker.controller;
  if (!controller) return;
  const urls = new Set<string>([location.href.split('#')[0]]);
  for (const entry of performance.getEntriesByType('resource')) {
    try {
      const url = new URL(entry.name);
      if (url.origin === location.origin && !isPhoto(url)) urls.add(url.href);
    } catch {}
  }
  if (urls.size) controller.postMessage({ type: 'atlas-adopt', urls: [...urls] });
}

export function startServiceWorker(): Promise<void> {
  if (started) return started;
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) {
    started = Promise.resolve();
    return started;
  }
  started = (async () => {
    try {
      await navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' });
      await Promise.race([
        navigator.serviceWorker.ready,
        new Promise((_, reject) =>
          window.setTimeout(() => reject(new Error('service worker ready timeout')), 3000),
        ),
      ]);
      await waitForController(3000);
      adoptLoadedResources();
      window.addEventListener('load', adoptLoadedResources, { once: true });
    } catch (error) {
      console.warn('[atlas] service worker registration failed', error);
    }
  })();
  return started;
}

/** Wait until the worker can see requests, but never block the app forever. */
export function waitForServiceWorker(): Promise<void> {
  return startServiceWorker();
}

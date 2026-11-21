import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { defineConfig, type Plugin, type ViteDevServer } from 'vite';
import { ROOT as PROJECT_ROOT } from './scripts/lib/cities.mjs';
import { buildAll } from './scripts/build-all.mjs';

let catalogRevision = 'dev';
try {
  catalogRevision =
    (JSON.parse(readFileSync('public/atlas/cities.json', 'utf8')) as { revision?: string })
      .revision ?? 'dev';
} catch {}

const CITY_SOURCES = [
  'data/atlas/',
  'data/landmarks/',
  'data/photos/',
  'data/aux/',
  'data/translations/',
  'raw/osm/',
];

function cityFromPath(relative: string): string | null {
  for (const prefix of CITY_SOURCES) {
    if (!relative.startsWith(prefix)) continue;
    const rest = relative.slice(prefix.length);
    const city = rest.split('/')[0];
    if (city && /^[a-z0-9-]+$/.test(city)) return city;
  }
  return null;
}

// The production host gzips GeoJSON/JSON, but Vite's dev and preview servers do
// not. Without this middleware the loader honestly reports the 11.8 MiB
// uncompressed package and local checks cannot reproduce production behaviour.
function atlasGzipMiddleware(
  root: string,
  cache: Map<string, { mtimeMs: number; body: Buffer; type: string }>,
) {
  return async (request: any, response: any, next: (error?: unknown) => void) => {
    try {
      if (request.method !== 'GET' && request.method !== 'HEAD') return next();
      if (!String(request.headers['accept-encoding'] ?? '').includes('gzip')) return next();
      const url = new URL(request.url ?? '/', 'http://localhost');
      const pathname = decodeURIComponent(url.pathname);
      if (!pathname.startsWith('/atlas/') || !/\.(?:json|geojson)$/.test(pathname)) return next();
      const file = path.resolve(root, `.${pathname}`);
      const atlasRoot = path.resolve(root, 'atlas');
      if (!file.startsWith(atlasRoot + path.sep)) return next();
      const info = await stat(file);
      if (!info.isFile()) return next();
      let entry = cache.get(file);
      if (!entry || entry.mtimeMs !== info.mtimeMs) {
        entry = {
          mtimeMs: info.mtimeMs,
          body: gzipSync(await readFile(file), { level: 9 }),
          type: pathname.endsWith('.geojson')
            ? 'application/geo+json; charset=utf-8'
            : 'application/json; charset=utf-8',
        };
        cache.set(file, entry);
      }
      response.statusCode = 200;
      response.setHeader('Content-Type', entry.type);
      response.setHeader('Content-Encoding', 'gzip');
      response.setHeader('Content-Length', String(entry.body.length));
      response.setHeader('Vary', 'Accept-Encoding');
      response.setHeader('Cache-Control', 'no-cache');
      if (request.method === 'HEAD') response.end();
      else response.end(entry.body);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return next();
      next(error);
    }
  };
}

function atlasGzip(): Plugin {
  const cache = new Map<string, { mtimeMs: number; body: Buffer; type: string }>();
  return {
    name: 'atlas-gzip',
    configureServer(server) {
      server.middlewares.use(atlasGzipMiddleware(path.resolve(PROJECT_ROOT, 'public'), cache));
    },
    configurePreviewServer(server) {
      server.middlewares.use(atlasGzipMiddleware(path.resolve(PROJECT_ROOT, 'dist'), cache));
    },
  };
}

// Repack the affected city and refresh its manifest and the catalog, then reload
// the page. A city config or period-preset change rebuilds every ready city.
function atlasHotReload(): Plugin {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let running = false;
  let pending: string | null | undefined;
  async function rebuild(server: ViteDevServer, reload: boolean, city: string | null = null) {
    if (running) {
      pending = city;
      return;
    }
    running = true;
    try {
      await buildAll({ mode: 'build', city: city ?? undefined, quiet: true });
      if (reload) server.ws.send({ type: 'full-reload' });
      server.config.logger.info(`[atlas] rebuilt ${city ?? 'all ready cities'}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      server.config.logger.error(`[atlas] ${message}`);
      if (reload)
        server.ws.send({
          type: 'error',
          err: { message, stack: error instanceof Error ? error.stack : undefined },
        });
    } finally {
      running = false;
      if (pending !== undefined) {
        const next = pending;
        pending = undefined;
        void rebuild(server, true, next);
      }
    }
  }
  return {
    name: 'atlas-hot-reload',
    apply: 'serve',
    async configureServer(server) {
      await rebuild(server, false);
      const roots = [
        path.join(PROJECT_ROOT, 'data', 'atlas'),
        path.join(PROJECT_ROOT, 'data', 'landmarks'),
        path.join(PROJECT_ROOT, 'data', 'aux'),
        path.join(PROJECT_ROOT, 'data', 'photos'),
        path.join(PROJECT_ROOT, 'data', 'translations'),
        path.join(PROJECT_ROOT, 'data', 'cities'),
        path.join(PROJECT_ROOT, 'raw'),
      ];
      server.watcher.add(roots);
      const schedule = (file: string) => {
        const relative = path.relative(PROJECT_ROOT, file).split(path.sep).join('/');
        const isConfig = relative.startsWith('data/cities/') || relative === 'src/periods.js';
        const city = cityFromPath(relative);
        const isSource =
          (relative.startsWith('data/atlas/') ||
            relative.startsWith('data/landmarks/') ||
            relative.startsWith('data/aux/') ||
            relative.startsWith('data/translations/') ||
            relative.startsWith('data/photos/') ||
            relative.startsWith('raw/')) &&
          /\.(?:json|xml|geojson|webp)$/.test(relative);
        if (!isConfig && !isSource) return;
        clearTimeout(timer);
        timer = setTimeout(() => void rebuild(server, true, isConfig ? null : city), 120);
      };
      server.watcher.on('add', schedule);
      server.watcher.on('change', schedule);
      server.watcher.on('unlink', schedule);
      server.httpServer?.once('close', () => clearTimeout(timer));
    },
  };
}

// A build-specific cache name retires the old runtime cache when the shell
// changes. Nothing is fetched here: the worker only caches requests that
// pages actually make.
function atlasServiceWorker(): Plugin {
  let outDir = 'dist';
  return {
    name: 'atlas-service-worker',
    apply: 'build',
    configResolved(config) {
      outDir = config.build.outDir;
    },
    async closeBundle() {
      const dist = path.resolve(PROJECT_ROOT, outDir);
      const template = await readFile(
        path.join(PROJECT_ROOT, 'scripts/service-worker.template.js'),
        'utf8',
      );
      const html = await readFile(path.join(dist, 'index.html'), 'utf8');
      const version = createHash('sha256').update(template).update(html).digest('hex').slice(0, 12);
      await writeFile(path.join(dist, 'sw.js'), template.replace('__CACHE_VERSION__', version));
      console.log(`[atlas] service worker: ${version}`);
    },
  };
}

export default defineConfig({
  base: './',
  define: { __ATLAS_REVISION__: JSON.stringify(catalogRevision) },
  plugins: [atlasGzip(), atlasHotReload(), atlasServiceWorker()],
  server: { watch: { usePolling: process.env.VITE_USE_POLLING === 'true' } },
  build: { target: 'es2022' },
});

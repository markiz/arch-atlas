import { readFileSync } from 'node:fs';
import path from 'node:path';
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

export default defineConfig({
  base: './',
  define: { __ATLAS_REVISION__: JSON.stringify(catalogRevision) },
  plugins: [atlasHotReload()],
  server: { watch: { usePolling: process.env.VITE_USE_POLLING === 'true' } },
  build: { target: 'es2022' },
});

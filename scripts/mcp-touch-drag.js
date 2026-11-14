// Touch drag driven through Playwright MCP, with no CLI dependency.
//
// 1. Set the gesture parameters in the page (they survive the reload because
//    they are stored in sessionStorage):
//
//    browser_evaluate:
//      () => {
//        const params = {x1: 700, y1: 520, x2: 700, y2: 300, steps: 12, delay: 16, wait: 1500};
//        sessionStorage.setItem('atlasTouchParams', JSON.stringify(params));
//        return params;
//      }
//
// 2. Run this file:
//
//    browser_run_code_unsafe: { filename: "scripts/mcp-touch-drag.js" }
//
// The script enables touch emulation, reloads the page so Leaflet initializes
// with touch support, records pointer/touch events, sends a real CDP drag and
// returns the map pane transform before/after plus the first 80 events.
async (page) => {
  const params = await page.evaluate(() => {
    const raw = sessionStorage.getItem('atlasTouchParams');
    return raw ? JSON.parse(raw) : null;
  });
  if (!params) {
    throw new Error('atlasTouchParams is missing; set it with browser_evaluate first');
  }

  const {x1, y1, x2, y2} = params;
  const steps = params.steps ?? 12;
  const delay = params.delay ?? 16;
  const wait = params.wait ?? 1500;
  for (const [name, value] of Object.entries({x1, y1, x2, y2, steps, delay, wait})) {
    if (!Number.isFinite(Number(value))) {
      throw new Error(`atlasTouchParams.${name} must be a number`);
    }
  }
  if (Number(steps) < 1) throw new Error('atlasTouchParams.steps must be at least 1');

  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setTouchEmulationEnabled', {enabled: true, maxTouchPoints: 5});
  await page.reload({waitUntil: 'load'});
  await page.waitForSelector('.leaflet-container');
  await page.waitForTimeout(wait);

  await page.evaluate(() => {
    window.__atlasTouchLog = [];
    if (window.__atlasTouchHandler) return;
    window.__atlasTouchHandler = (event) => {
      const point = event.touches?.[0] ?? event.changedTouches?.[0];
      window.__atlasTouchLog.push({
        type: event.type,
        x: point ? point.clientX : event.clientX,
        y: point ? point.clientY : event.clientY,
        pointerType: event.pointerType ?? null,
      });
    };
    const types = ['touchstart', 'touchmove', 'touchend', 'pointerdown', 'pointermove', 'pointerup'];
    for (const type of types) {
      document.addEventListener(type, window.__atlasTouchHandler, {capture: true, passive: true});
    }
  });

  const paneTransform = () => page.evaluate(
    () => document.querySelector('.leaflet-map-pane')?.style.transform ?? null,
  );
  const point = (x, y) => [{x, y, id: 1, radiusX: 2, radiusY: 2, force: 1}];
  const before = await paneTransform();

  await cdp.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: point(x1, y1)});
  for (let step = 1; step <= steps; step += 1) {
    const t = step / steps;
    const x = x1 + (x2 - x1) * t;
    const y = y1 + (y2 - y1) * t;
    await cdp.send('Input.dispatchTouchEvent', {type: 'touchMove', touchPoints: point(x, y)});
    await page.waitForTimeout(delay);
  }
  await cdp.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []});
  await page.waitForTimeout(500);

  const after = await paneTransform();
  const events = await page.evaluate(() => window.__atlasTouchLog.slice(0, 80));
  return {before, after, events, params: {x1, y1, x2, y2, steps, delay, wait}};
}

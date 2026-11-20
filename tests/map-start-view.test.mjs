import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { readCityConfigs } from '../scripts/lib/cities.mjs';
import { fileURLToPath } from 'node:url';
import {
  TBILISI_DESKTOP_START,
  TBILISI_MOBILE_START,
  desktopStartView,
  isMobileMapLayout,
  mobileStartView,
} from '../src/map/start-view.ts';

const atlasDir = fileURLToPath(new URL('../data/atlas/tbilisi/', import.meta.url));
const WORLD_SIZE = 256;
const DEG_TO_RAD = Math.PI / 180;
const EARTH_RADIUS = 6378137;
const METERS_PER_DEGREE = 111320;

/** Same Web Mercator scale as src/map/geometry.ts. */
function metersPerPixel(lat, zoom) {
  return (Math.cos(lat * DEG_TO_RAD) * 2 * Math.PI * EARTH_RADIUS) / (WORLD_SIZE * 2 ** zoom);
}

/** Share of atlas objects inside the viewport of a 1440×900 desktop window. */
function visibleShare({ center, zoom }, width = 1340, height = 710) {
  const meters = metersPerPixel(center.lat, zoom);
  const halfLat = (height * meters) / 2 / METERS_PER_DEGREE;
  const halfLng = (width * meters) / 2 / (METERS_PER_DEGREE * Math.cos(center.lat * DEG_TO_RAD));
  const coordinates = fs
    .readdirSync(atlasDir)
    .map((file) => JSON.parse(fs.readFileSync(atlasDir + file, 'utf8')).coordinates)
    .filter((point) => Array.isArray(point) && point.length === 2);
  const visible = coordinates.filter(
    ([lng, lat]) => Math.abs(lng - center.lng) <= halfLng && Math.abs(lat - center.lat) <= halfLat,
  );
  return visible.length / coordinates.length;
}

test('mobile start view points at central Rustaveli', () => {
  const { center, zoom } = mobileStartView();
  assert.ok(center.lat > 41.69 && center.lat < 41.71, 'latitude stays in the centre');
  assert.ok(center.lng > 44.79 && center.lng < 44.805, 'longitude stays on Rustaveli');
  assert.ok(zoom > 13 && zoom <= 15, 'launch zoom shows the avenue, not the whole city');
});

test('desktop start view keeps about half of the atlas on screen', () => {
  const share = visibleShare(desktopStartView());
  assert.ok(share >= 0.45 && share <= 0.55, `expected ~50% of objects, got ${share}`);
});

test('start views are fresh copies', () => {
  for (const [start, view, constant] of [
    [mobileStartView, mobileStartView(), TBILISI_MOBILE_START],
    [desktopStartView, desktopStartView(), TBILISI_DESKTOP_START],
  ]) {
    view.center.lat = 0;
    view.zoom = 0;
    const next = start();
    assert.deepEqual(next.center, constant.center);
    assert.equal(next.zoom, constant.zoom);
  }
});

test('city configs override the default Tbilisi launch cameras', async () => {
  const { byId } = await readCityConfigs();
  const belgrade = byId.get('belgrade');
  const view = mobileStartView(belgrade);
  assert.deepEqual(view.center, belgrade.map.start.mobile.center);
  assert.equal(view.zoom, belgrade.map.start.mobile.zoom);
  const desktop = desktopStartView(belgrade);
  assert.deepEqual(desktop.center, belgrade.map.start.desktop.center);
  assert.equal(desktop.zoom, belgrade.map.start.desktop.zoom);
});

test('mobile start view is off outside the browser', () => {
  assert.equal(isMobileMapLayout(), false);
});

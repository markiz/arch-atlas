import type { CityPublic } from '../types';
import type { LatLng } from './types';

/**
 * Opening cameras for the map. Fitting every atlas building into the viewport
 * leaves the city tiny: the markers become dots on a phone and the whole
 * atlas crowds into the middle of a wide desktop screen. Both launch screens
 * start on Rustaveli Avenue instead. The mobile breakpoint matches style.css.
 */
export const MOBILE_MAP_MEDIA = '(max-width: 650px)';

export const TBILISI_MOBILE_START: { center: LatLng; zoom: number } = {
  /** Between Rustaveli 17 and 19, by the Opera and the Parliament. */
  center: { lat: 41.6993, lng: 44.7975 },
  zoom: 14,
};

/**
 * Desktop launch camera: Rustaveli from No. 6 to the Opera, Freedom Square
 * below. On a 1440×900 window this leaves about half of the atlas on screen
 * (247 of 497 objects); the rest is one zoom-out or the overview button away.
 */
export const TBILISI_DESKTOP_START: { center: LatLng; zoom: number } = {
  center: { lat: 41.698, lng: 44.796 },
  zoom: 15.5,
};

/** True when the page is laid out as the phone version. */
export function isMobileMapLayout(): boolean {
  return typeof window !== 'undefined' && window.matchMedia(MOBILE_MAP_MEDIA).matches;
}

function copy(view: { center: LatLng; zoom: number }) {
  return { center: { ...view.center }, zoom: view.zoom };
}

/** Launch camera for a city; the old Tbilisi constants remain the default. */
export function mobileStartView(city?: CityPublic) {
  return copy(city?.map.start.mobile ?? TBILISI_MOBILE_START);
}

/** Fresh copy of the desktop launch camera. */
export function desktopStartView(city?: CityPublic) {
  return copy(city?.map.start.desktop ?? TBILISI_DESKTOP_START);
}

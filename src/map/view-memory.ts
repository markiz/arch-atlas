import type { LatLng } from './types';

export type SavedMapView = { center: LatLng; zoom: number };

const remembered = new Map<string, SavedMapView>();

/** Remember the current camera per city so switching cities cannot restore a foreign view. */
export function rememberMapView(city: string, center: LatLng, zoom: number): void {
  remembered.set(city, { center: { lat: center.lat, lng: center.lng }, zoom });
}

/** Last camera used for a city, or null before that city's map is shown. */
export function savedMapView(city = 'default'): SavedMapView | null {
  const view = remembered.get(city);
  return view ? { center: { ...view.center }, zoom: view.zoom } : null;
}

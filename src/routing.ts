import type { Language } from './i18n';

export type View = 'map' | 'catalog';

export interface AtlasRoute {
  city: string | null;
  view: View;
  building: string | null;
  language: Language | null;
}

export function isLanguage(value: string | null | undefined): value is Language {
  return value === 'ru' || value === 'en' || value === 'ka' || value === 'uk';
}

export function parseHash(hash: string = typeof location === 'undefined' ? '' : location.hash) {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const city = params.get('city');
  return {
    city: city && /^[a-z0-9-]+$/.test(city) ? city : null,
    view: params.get('view') === 'catalog' ? ('catalog' as View) : ('map' as View),
    building: params.get('building'),
    language: isLanguage(params.get('lang')) ? (params.get('lang') as Language) : null,
  } satisfies AtlasRoute;
}

export function buildHash(route: AtlasRoute): string {
  const params = new URLSearchParams();
  if (route.city) params.set('city', route.city);
  params.set('view', route.view);
  if (route.building) params.set('building', route.building);
  if (route.language) params.set('lang', route.language);
  return `#${params.toString()}`;
}

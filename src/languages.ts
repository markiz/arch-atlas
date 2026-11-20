export type Language = 'ru' | 'en' | 'uk' | 'ka' | 'sr';

/** Languages every city exposes. */
export const BASE_LANGUAGES = ['ru', 'en', 'uk'] as const;
export const ALL_LANGUAGES = ['ru', 'en', 'uk', 'ka', 'sr'] as const;

/** Endonyms shown in the language switcher, independent of the active UI language. */
export const LANGUAGE_NAMES: Record<Language, string> = {
  ru: 'Русский',
  en: 'English',
  uk: 'Українська',
  ka: 'ქართული',
  sr: 'Српски',
};

export function isLanguage(value: string | null | undefined): value is Language {
  return value === 'ru' || value === 'en' || value === 'uk' || value === 'ka' || value === 'sr';
}

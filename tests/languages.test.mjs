import test from 'node:test';
import assert from 'node:assert/strict';
import { preferredBrowserLanguage } from '../src/languages.ts';

test('picks the first supported language from the browser preference list', () => {
  assert.equal(preferredBrowserLanguage(['en-US', 'ru-RU']), 'en');
  assert.equal(preferredBrowserLanguage(['de-DE', 'uk-UA']), 'uk');
  assert.equal(preferredBrowserLanguage(['ka-GE']), 'ka');
  assert.equal(preferredBrowserLanguage(['de-DE', 'fr-FR']), null);
  assert.equal(preferredBrowserLanguage([]), null);
});

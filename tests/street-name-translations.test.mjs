import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const translations = JSON.parse(
  await readFile(new URL('../data/translations/tbilisi/basemap-names.json', import.meta.url), 'utf8'),
);
const entries = Object.entries(translations);

test('curated basemap names contain all four languages', () => {
  assert.ok(entries.length > 100, `expected the curated street names, got ${entries.length}`);
  for (const [key, entry] of entries) {
    for (const language of ['ru', 'en', 'ka', 'uk']) {
      assert.equal(typeof entry[language], 'string', `${key}: missing ${language}`);
      assert.ok(entry[language].trim(), `${key}: empty ${language}`);
    }
    if (/[\u10a0-\u10ff]/.test(key)) assert.equal(entry.ka, key, `${key}: ka key mismatch`);
  }
});

test('curated Russian names are not mechanical transliterations', () => {
  const artifact =
    /[а-яё-]*ис\s+(?:I|II|III|IV|V)\s+(?:улица|переулок|тупик|проезд|проспект|площадь|мост|подъём|шоссе)\b/i;
  const romanBeforeType = /\b(?:I|II|III|IV|V)\s+(?:улица|переулок|тупик|проезд)\b/;
  for (const [key, entry] of entries) {
    assert.ok(!artifact.test(entry.ru), `${key}: mechanical -ис: ${entry.ru}`);
    assert.ok(!romanBeforeType.test(entry.ru), `${key}: Roman ordinal: ${entry.ru}`);
  }
});

test('curated Ukrainian names keep Ukrainian orthography', () => {
  for (const [key, entry] of entries) {
    assert.ok(!/[ыэёъ]/i.test(entry.uk), `${key}: Russian letters in uk: ${entry.uk}`);
  }
});

test('curated English names have no broken Roman numerals', () => {
  for (const [key, entry] of entries) {
    assert.ok(!/\bIi\b/.test(entry.en), `${key}: Ii in en: ${entry.en}`);
  }
});

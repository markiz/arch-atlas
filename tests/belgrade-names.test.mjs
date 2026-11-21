import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const atlasDir = fileURLToPath(new URL('../data/atlas/belgrade/', import.meta.url));
// Serbian Cyrillic is not a Russian or Ukrainian localization. These markers
// catch mechanical fallback that copies Serbian morphology into ru/uk names.
const serbianMarkers = [
  'Зграда',
  'Кућа',
  'Црква',
  'Хотел',
  'Вила',
  'Београд',
  'Србије',
  'Светог',
  'Друштва',
  'Задужбине',
  'Техничког',
  'факултета',
  'општине',
  'саобраћаја',
  'финансија',
  'пољопривреде',
  'ваздухопловства',
  'Војногеографског',
  'Народне скупштине',
  'Републике Србије',
];
// "Светог" is a prefix of the legitimate Russian/Ukrainian street name
// "Светогорская"/"Светогорська"; only the standalone Serbian genitive counts.
const serbianMarkerPatterns = serbianMarkers.map((marker) =>
  marker === 'Светог' ? /(?<![\p{L}])Светог(?![\p{L}])/u : marker,
);

const files = (await readdir(atlasDir)).filter((name) => name.endsWith('.json'));

for (const file of files) {
  test(`${file}: ru and uk are real localizations`, async () => {
    const card = JSON.parse(await readFile(path.join(atlasDir, file), 'utf8'));
    for (const marker of ['Zgrada', 'Kuća', 'Crkva', 'Palata', 'Vila'])
      assert.ok(
        !card.names.en.includes(marker),
        `en name contains Serbian marker ${marker}: ${card.names.en}`,
      );
    for (const field of ['names', 'descriptions', 'histories']) {
      const values = card[field];
      if (!values) continue;
      for (const language of ['ru', 'uk']) {
        const text = values[language];
        assert.ok(text && text.trim(), `${field}.${language} is empty`);
        assert.ok(
          !/[A-Za-z]/.test(text.replace(/\b[IVXLCDM]+\b/g, '')),
          `${field}.${language} contains Latin text: ${text}`,
        );
        for (const marker of serbianMarkerPatterns) {
          const found = marker instanceof RegExp ? marker.test(text) : text.includes(marker);
          assert.ok(!found, `${field}.${language} contains Serbian marker ${marker}: ${text}`);
        }
      }
    }
  });
}

import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const atlasDir = fileURLToPath(new URL('../data/atlas/belgrade/', import.meta.url));
// Serbian Cyrillic is not a Russian or Ukrainian localization. These markers
// catch mechanical fallback that copies Serbian morphology into ru/uk names.
const serbianMarkers = [
  'Зграда', 'Кућа', 'Црква', 'Хотел', 'Вила', 'Београд', 'Србије', 'Светог',
  'Друштва', 'Задужбине', 'Техничког', 'факултета', 'општине', 'саобраћаја',
  'финансија', 'пољопривреде', 'ваздухопловства', 'Војногеографског',
  'Народне скупштине', 'Републике Србије',
];

const files = (await readdir(atlasDir)).filter((name) => name.endsWith('.json'));

for (const file of files) {
  test(`${file}: ru and uk are real localizations`, async () => {
    const card = JSON.parse(await readFile(path.join(atlasDir, file), 'utf8'));
    for (const marker of ['Zgrada', 'Kuća', 'Crkva', 'Palata', 'Vila'])
      assert.ok(!card.names.en.includes(marker), `en name contains Serbian marker ${marker}: ${card.names.en}`);
    for (const language of ['ru', 'uk']) {
      const name = card.names[language];
      assert.ok(name && name.trim(), `${language} name is empty`);
      assert.ok(!/[A-Za-z]/.test(name.replace(/\b[IVXLCDM]+\b/g, '')), `${language} name contains Latin text: ${name}`);
      for (const marker of serbianMarkers)
        assert.ok(!name.includes(marker), `${language} name contains Serbian marker ${marker}: ${name}`);
    }
  });
}

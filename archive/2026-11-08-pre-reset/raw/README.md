# raw/ — сохранённые ответы внешних источников

Здесь лежат только те данные, из которых собирается сайт, и промежуточные результаты исследования, на которые опираются скрипты. Одноразовые пробы, ручные выгрузки «на посмотреть» и тестовые ответы API сюда не складываются: если файл никто не читает и он не описывает происхождение данных, ему здесь не место.

Файлы лежат в Git намеренно: `npm run build` на чистом клоне должен собирать карту без сети. Поэтому большие выгрузки хранятся вместе с описанием источника ниже, а не перекачиваются при каждой сборке.

```
raw/
├── osm/
│   ├── grid/osm-grid-*.xml              16 тайлов OSM API, центр Тбилиси
│   ├── osm-tbilisi-selected.json        ответ Overpass: улицы, парки, музеи
│   ├── osm-tbilisi-building-outlines.geojson
│   │                                    контуры building=* по границе Тбилиси
│   └── metekhi-way.json                 геометрия Метехи из OSM API
└── research/
    ├── research-candidates.json         отбор OSM-кандидатов с Wikidata QID
    ├── wikidata-heritage.json           сохранённые сущности Wikidata
    └── gallery-research.json            результаты поиска фотографий
```

## Файлы

| Файл | Что это | Откуда | Как получить заново |
|---|---|---|---|
| `osm/grid/osm-grid-<i>-<j>.xml` (16 шт., ~38 МиБ) | Узлы, пути и отношения OSM для сетки 4×4: долгота 44.783–44.811, широта 41.687–41.711, шаг 0.007 и 0.006°. Центральная зона, из которой собирается подложка | `api.openstreetmap.org/api/0.6/map?bbox=…` | `python3 scripts/fetch-osm.py` — докачивает отсутствующие тайлы, существующие считает кэшем |
| `osm/osm-tbilisi-selected.json` (~15 МиБ) | Выбранные улицы, зелёные зоны и музеи для подложки | Overpass API 0.7.62.11, база OSM на 2026-10-31T11:43:51Z | **Не воспроизводится одной командой**: текст запроса и загрузчик не сохранены. Не удалять и не заменять «похожим» ответом без проверки покрытия |
| `osm/osm-tbilisi-building-outlines.geojson` (~40 МиБ) | 121 313 замкнутых контуров `building=*` внутри `relation/1996871` (административная граница Тбилиси) | Geofabrik `georgia-latest.osm.pbf`, SHA-256 PBF `972ca3c3…70f1`, timestamp OSM 2026-10-30T21:24:51Z — всё записано в поле `source` самого файла | Скачать PBF с Geofabrik (~98 МиБ, в репозитории не хранится) и выполнить `python3 scripts/extract-tbilisi-building-outlines.py georgia-latest.osm.pbf` |
| `osm/metekhi-way.json` (~5 КиБ) | Полная геометрия ОСМ-пути Метехи | `api.openstreetmap.org` (cgimap) | Повторить запрос к OSM API по way ID; нужен только `scripts/resolve-geometries.py` для проверки контура Метехи |
| `research/research-candidates.json` (~120 КиБ) | Кандидаты с историческими/охранными тегами: ID, теги, контур, Wikidata QID | Собирал удалённый `scripts/research-heritage.py` | Исторический снимок; заново не собирается, см. git history |
| `research/wikidata-heritage.json` (~1 МиБ) | Сохранённые сущности Wikidata по кандидатам | Собирал удалённый `scripts/research-heritage.py` | Исторический снимок; заново не собирается, см. git history |
| `research/gallery-research.json` (~150 КиБ) | Исторический снимок найденных файлов Commons по кандидатам: лицензии, авторы, ссылки | Собран удалённым разовым скриптом `fetch-galleries.py` | Заново не собирается; см. git history. Для новых задач разовые скрипты создаются в `work/` |

## Кто читает

- `scripts/build-data.py` — `osm/grid/*.xml`, `osm/osm-tbilisi-selected.json`, `osm/osm-tbilisi-building-outlines.geojson`; собирает `public/atlas/basemap.geojson` и `public/atlas/building-outlines.geojson`.
- `scripts/build-map-layers.mjs` — хеширует этот же набор и `data/`, чтобы не пересобирать слои без изменений.
- `scripts/import-landmarks.py`, `scripts/resolve-geometries.py` — сетка и `osm/metekhi-way.json`.
- `scripts/collect-photo-candidates.py` — `research/research-candidates.json` как необязательный источник тегов OSM; файл исторический и заново не собирается.
- `scripts/create-next-200-report.py`, `scripts/extract-tbilisi-building-outlines.py` — контуры зданий.

`research/gallery-research.json` — исторический снимок: текущие скрипты его не читают.

## Правила

1. Новый источник кладём в `raw/osm/` или `raw/research/` с загрузчиком: повторяемый — в `scripts/`, одноразовый — в `work/` (в Git не входит). В таблице выше фиксируем endpoint, параметры, время загрузки и время базы OSM.
2. Не редактируем эти файлы вручную: меняется только содержимое, полученное от источника, либо файл пересоздаётся скриптом.
3. Не храним здесь промежуточные ответы API по отдельным зданиям, тестовые запросы и картинки-кандидаты: для исследования используйте `work/` (в Git не входит), а в `raw/` оставляйте только то, что читает сборка.
4. Большие производные файлы (например, контуры зданий) допускаются, если без них чистая сборка перестаёт работать; в самом файле или рядом должно быть записано, из чего и как он получен.

## Лицензии

Данные OpenStreetMap — © участники OpenStreetMap, лицензия [ODbL](https://www.openstreetmap.org/copyright); атрибуция сохраняется в интерфейсе и в `source` файлов. Wikidata — CC0, файлы Commons сохраняют лицензию каждого снимка; она записана в `research/gallery-research.json` и в sidecar-файлах `data/photos/`.

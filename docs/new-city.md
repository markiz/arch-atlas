# Новый город

Город — это запись реестра, отдельный пакет артефактов и отдельный набор исходников. Тбилиси не является особенным случаем: он проходит тот же путь, что и любой другой город.

У каждого города свой набор языков интерфейса и данных: `ru`, `en`, `uk` обязательны для всех, локальный язык добавляется конфигом (`ka` для Грузии, `sr` для Сербии). Селектор языка показывает только языки текущего города; данные карточек, справочников и подписей должны содержать ровно этот набор.

## Реестр

- `data/cities/index.json` задаёт город по умолчанию и порядок переключателя.
- `data/cities/<city>.json` описывает подписи, страну, хронологию, камеры, границы и пути к исходникам.
- `public/atlas/cities.json` — генерируемый публичный каталог. Build-поля (`build`, `osm`) в него не попадают.
- `ready`-город обязан иметь пакет; `coming-soon` показывается в переключателе, но не загружает данные.
- `allowEmpty: true` разрешает `ready`-городу иметь ноль карточек. Такой город всё равно имеет подложку, пустой `buildings.json` и валидный пустой `building-outlines.bin`.

Периоды задаются пресетом из `src/periods.js` (`periods: "georgia"` или `"belgrade"`) либо массивом в конфиге. UI хранит `id` периода, а не его подпись; подпись можно менять без миграции состояния.

## Артефакты

```text
public/atlas/cities.json
public/atlas/cities/<city>/manifest.json
public/atlas/cities/<city>/buildings.json
public/atlas/cities/<city>/basemap.geojson
public/atlas/cities/<city>/building-outlines.bin
public/atlas/photos/<city>/<sha256>.webp
public/atlas/thumbnails/<city>/<sha256>.webp
public/atlas/cards/<city>/<sha256>.webp
```

Манифест версии 2 содержит `city`, `revision`, `entry` и список файлов. Пути в нём считаются от `public/atlas/`. Сборка города не трогает пакеты других городов.

## Сборка

```sh
npm run check                 # все ready-города
npm run build                 # все ready-города + tsc + vite
npm run verify                # проверка dist по каталогу и манифестам

node scripts/build-all.mjs --city=belgrade
node scripts/build-map-layers.mjs --city=belgrade
node scripts/build-data.py --city=belgrade
node scripts/create-manifest.mjs --city=belgrade
```

`check` и `build` проходят по реестру. `--city` собирает только один пакет, но обновляет каталог из уже существующих пакетов.

## Исходники

```text
data/atlas/<city>/<id>.json
data/landmarks/<city>/<id>.json
data/aux/<city>/{styles,architects,districts,year-labels,types}.json
data/translations/<city>/{landmark-names,basemap-names,landmark-skip,landmark-area-markers,street-words}.json
raw/osm/<city>/{grid/*.xml, selected.json, coverage.json, water-relations.json, water-ways.json, building-outlines.geojson, source.json}
data/photos/<city>/<sha256>.webp + <sha256>.metadata.json
```

`raw/osm/<city>/source.json` фиксирует endpoint, запросы, время загрузки, OSM timestamp, границу и лицензию. Сборка использует только сохранённые файлы и не ходит в сеть.

### OSM

```sh
node scripts/fetch-osm-city.mjs --city=<city>                    # улицы, вода, зелень и водные мультиполигоны
node scripts/fetch-osm-city.mjs --city=<city> --layer=water      # только водные объекты
node scripts/fetch-osm-city.mjs --city=<city> --layer=relations  # только водные мультиполигоны
node scripts/fetch-osm-city.mjs --city=<city> --layer=water-ways # только водные way
node scripts/fetch-osm-city.mjs --city=<city> --endpoint=<url>   # конкретный инстанс Overpass
python3 scripts/extract-building-outlines.py --city=<city> --pbf=<file.osm.pbf>
python3 scripts/extract-road-coverage.py --city=<city> --pbf=<file.osm.pbf>  # дороги вокруг объектов вне городской выборки
```

Загрузчик использует `User-Agent: ArchAtlas/1.0` и сохраняет provenance. Публичные инстансы Overpass периодически перегружены, поэтому запрос идёт по списку эндпоинтов, а в `source.json` попадает тот, который ответил; список можно сузить флагом `--endpoint`.

Вода в OSM бывает двух видов: замкнутый way с тегами `natural=water` и мультиполигон (`relation` с `natural=water` или `waterway=riverbank`), у которого теги стоят на отношении, а way-члены не размечены. Второй вид не попадает в выборку `way(...)`, поэтому загрузчик делает отдельный запрос и сохраняет ответ в `water-relations.json`; `--layer=relations` обновляет только его, не перекачивая улицы. `source.json` описывает оба запроса и их OSM timestamp.

Город, собранный из сетки `grid/`, может иметь городскую выборку без воды: сетка покрывает только центр, а `selected.json` бывает без водных way. Тогда `--layer=water-ways` сохраняет водные way города в `water-ways.json`; сборщик пропускает объекты, которые уже пришли из сетки или `selected.json`, поэтому дублей нет. Для городов с полной выборкой этот файл не нужен.

`selected.json` строится по границе городского населённого пункта, а карточки и ориентиры могут выходить за неё. Необязательный `coverage.json` добавляет дороги вокруг таких объектов из регионального PBF; `build.coverage` задаёт путь к файлу. Сборщик дедуплицирует дороги по `osmId`, поэтому пересечение с `selected.json` безопасно, а `source.json` хранит происхождение и список покрытых кластеров. `npm run check` проверяет, что каждая карточка и видимый маркер попадают в дорожную сеть; при провале обнови `coverage.json` этим же инструментом.

`build-data.py` сшивает членов отношения по ролям `outer`/`inner` в `Polygon`/`MultiPolygon`: незамкнутые цепочки отбрасываются, внутренние кольца становятся дырками (острова). Замкнутые water-way остаются отдельными полигонами, осевые `waterway=*` — линиями. Если геометрию собрать нельзя, объект не добавляется: выдуманных контуров нет.

Для контуров зданий нужны PyOsmium и Shapely; региональный PBF берётся с Geofabrik. Сетка `grid/` опциональна: она даёт дополнительную детализацию центра, но не обязательна для города.

## Порядок подключения

1. Определить границу OSM, bbox, стартовые камеры и хронологию.
2. Добавить `data/cities/<city>.json`, создать `data/atlas/<city>/`, `data/aux/<city>/`, `data/translations/<city>/`, `data/landmarks/<city>/`, `data/photos/<city>/`.
3. Получить OSM-выборку и provenance; при необходимости — контуры зданий.
4. Заполнить карточки, ориентиры и справочники; проверить все языки города и реальные `Polygon`/`MultiPolygon`.
5. Добавить фотографии по правилам [photo-refresh.md](photo-refresh.md); запустить `npm run photos:thumbs` и `npm run photos:rate`.
6. Перевести статус в `ready`, выполнить `npm run check`, `npm run build`, `npm run verify`.
7. Проверить в браузере: переключатель, deep link `#city=<city>`, reload, мобильное меню, отсутствие чужих запросов и камеры.

## Ограничения

- Языковой контракт города — `languages` из его конфига: `ru`, `en`, `uk` обязательны, локальный язык добавляется четвёртым. Карточки, sidecar-фото и справочники должны содержать ровно этот набор; «пустые» переводы вместо недостающего языка не допускаются.
- Hash-routing не даёт отдельной индексируемой страницы на город; title и description обновляются динамически.
- `public/atlas/landmarks.json` больше не публикуется: ориентиры для карты приходят из `basemap.geojson`, а карточки ориентиров проверяются отдельной сборкой.

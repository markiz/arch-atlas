# Схема карточки ориентира

Статус: схема первого прохода, 1 ноября 2026 года. Она описывает хранение ориентиров слоя подложки, а не карточек атласа.

## Зачем отдельная схема

Ориентир отвечает на вопрос «что это за заметное место на карте», а карточка атласа — «что это за здание, когда и кем построено». Поэтому ориентиру не нужны полигон, фотогалерея, история и архитектурные справочники. Но ему нужны стабильный ID, точка, четыре языка, короткое описание, источник и **разложенный по компонентам рейтинг значимости**.

Источник истины — один файл на объект:

```text
data/landmarks/tbilisi/osm-1064270003.json
```

Имя файла равно `id`. Для OSM-объектов используется `osm-<числовой id>`; если числовые id разных типов совпадают, допускается `osm-<node|way|relation>-<id>`. Собранный бандл — `public/atlas/landmarks.json`; он генерируется и в Git не хранится.

## Поля

| Поле | Обязательно | Тип | Смысл |
|---|---|---|---|
| `id` | да | string | Стабильный ID, совпадает с именем файла |
| `osmId` | нет | string | `node/123`, `way/123` или `relation/123`; `null`, если объект только из реестра/атласа |
| `atlasId` | нет | string | ID карточки атласа, если она есть |
| `category` | да | enum | `museum`, `church`, `castle`, `theatre`, `monument` |
| `subcategory` | да | enum | Подтип для отбора и иконки, см. ниже |
| `names` | да | labels | Название на `ru`/`en`/`ka`/`uk`; все четыре непустые |
| `originalLanguage` | нет | string | Язык исходного названия, обычно `ka` |
| `addresses` | да | labels | Адрес на четырёх языках; пустая строка допустима, если адрес не установлен |
| `descriptions` | да | labels | Короткое описание на четырёх языках, 1–2 предложения |
| `descriptionStatus` | да | enum | `reviewed`, `draft` или `missing` |
| `coordinates` | да | `[lon, lat]` | Точка входа/здания, 6 знаков после запятой |
| `source` | да | URL | Основной источник сведений |
| `otherSources` | нет | URL[] | Дополнительные источники |
| `districtId` | нет | string | Район из `aux/tbilisi/districts.json`, если известен |
| `heritage` | да | object | Охранный статус и ссылка на реестр |
| `recognition` | да | object | Wikidata, Wikipedia, Commons |
| `significance` | да | object | Балл, компоненты и причины |
| `status` | да | enum | `active`, `closed`, `ruined`, `demolished`, `unknown` |
| `access` | да | enum | `public`, `exterior`, `restricted`, `unknown` |
| `reviewStatus` | да | enum | `draft` или `reviewed` |
| `updatedAt` | да | date | Дата последней правки, `YYYY-MM-DD` |
| `notes` | нет | string | Редакционная пометка, а не описание |

### `category` и `subcategory`

- `museum`: `museum`, `gallery`, `house_museum`, `memorial_museum`;
- `church`: `church`, `cathedral`, `monastery`, `chapel`, `synagogue`, `mosque`;
- `castle`: `fortress`, `tower`, `palace`;
- `theatre`: `theatre`, `opera`, `concert_hall`;
- `monument`: `monument`, `memorial`, `archaeological_site`, `historic_building`.

`category` управляет иконкой и цветом на карте. `subcategory` хранится отдельно и не обязана иметь отдельную иконку.

### `heritage`

```json
{
  "status": "national",
  "registryId": 3616,
  "osm": "2",
  "url": "https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=3616"
}
```

Допустимые `status`: `national`, `local`, `listed`, `none`, `unknown`. `osm` — значение тега `heritage`, если он есть. `registryId` — номер объекта в реестре.

### `recognition`

```json
{
  "wikidata": "Q155453",
  "wikipedia": {
    "ru": "https://ru.wikipedia.org/wiki/...",
    "en": "https://en.wikipedia.org/wiki/...",
    "ka": "https://ka.wikipedia.org/wiki/...",
    "uk": ""
  },
  "commonsCategory": "Category:Narikala",
  "languageCount": 2
}
```

`languageCount` — число языков, на которых есть статья или подтверждённая подпись; используется в рейтинге, а не как отдельная истина.

### `significance`

Рейтинг 0–100 и его компоненты. Сумма компонентов обязана равняться `score`.

```json
{
  "score": 72,
  "components": {
    "heritage": 30,
    "recognition": 12,
    "architecturalRole": 15,
    "age": 10,
    "editorial": 15
  },
  "reasons": [
    "национальный охранный статус",
    "есть статья Wikipedia",
    "карточка атласа уже проверена"
  ],
  "status": "provisional"
}
```

Максимумы компонентов:

| Компонент | Максимум | Что учитывает |
|---|---:|---|
| `heritage` | 30 | национальный/местный статус, тег `heritage` |
| `recognition` | 25 | Wikipedia, Wikidata, число языков |
| `architecturalRole` | 20 | собор, крепость, опера, крупный музей, приходской храм |
| `age` | 10 | до 1800 / XIX век / 1900–1959 / 1960+ |
| `editorial` | 15 | карточка атласа, официальный статус музея/театра |

`significance.status` — `provisional` или `reviewed`. Пока рейтинг не проверен редактором, он не должен использоваться для окончательного топ-100.

## Пример файла

```json
{
  "id": "osm-65299828",
  "osmId": "way/65299828",
  "atlasId": "kashveti",
  "category": "church",
  "subcategory": "church",
  "names": {
    "ru": "Церковь Кашвети",
    "en": "Kashveti Church",
    "ka": "ქაშვეთის ეკლესია",
    "uk": "Церква Кашветі"
  },
  "originalLanguage": "ka",
  "addresses": {
    "ru": "проспект Шота Руставели",
    "en": "Shota Rustaveli Avenue",
    "ka": "შოთა რუსთაველის გამზირი",
    "uk": "проспект Шота Руставелі"
  },
  "descriptions": {
    "ru": "Храм на проспекте Руставели переосмысляет формы средневековой грузинской церковной архитектуры.",
    "en": "The church on Rustaveli Avenue reinterprets forms from medieval Georgian church architecture.",
    "ka": "რუსთაველის გამზირზე მდებარე ტაძარი შუა საუკუნეების ქართული საეკლესიო არქიტექტურის ფორმებს ახლებურად წარმოაჩენს.",
    "uk": "Храм на проспекті Руставелі переосмислює форми середньовічної грузинської церковної архітектури."
  },
  "descriptionStatus": "reviewed",
  "coordinates": [
    44.799324,
    41.697954
  ],
  "source": "https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4229",
  "otherSources": [
    "https://www.openstreetmap.org/way/65299828"
  ],
  "districtId": "mtatsminda",
  "heritage": {
    "status": "listed",
    "registryId": 4229,
    "osm": null,
    "url": "https://memkvidreoba.gov.ge/objects/immovable/immovableObject?id=4229"
  },
  "recognition": {
    "wikidata": "Q1734896",
    "wikipedia": {
      "ru": "",
      "en": "https://en.wikipedia.org/wiki/Kashveti_Church",
      "ka": "",
      "uk": ""
    },
    "commonsCategory": "Category:Kashueti Church",
    "languageCount": 1
  },
  "significance": {
    "score": 56,
    "components": {
      "heritage": 10,
      "recognition": 12,
      "architecturalRole": 15,
      "age": 4,
      "editorial": 15
    },
    "reasons": [
      "охранный статус: listed",
      "Wikipedia: 1 яз.",
      "значимая архитектурно-городская роль",
      "есть проверенная карточка атласа"
    ],
    "status": "provisional"
  },
  "status": "active",
  "access": "public",
  "reviewStatus": "draft",
  "updatedAt": "2026-11-01",
  "notes": "Первичная миграция из слоя подложки; рейтинг значимости предварительный."
}
```

## Правила валидации

Сборщик `scripts/assemble-landmarks.mjs` проверяет:

- `id` совпадает с именем файла и уникален;
- `category` и `subcategory` входят в разрешённые списки;
- `names` содержит ровно `ru`/`en`/`ka`/`uk` и все значения непустые;
- `addresses` содержит ровно четыре языка, пустые строки допустимы;
- `descriptions` содержит ровно четыре языка; если `descriptionStatus=reviewed`, все значения непустые;
- `coordinates` — конечные числа в порядке `[lon, lat]` и попадают в границы Тбилиси;
- `source` — `http(s)` URL;
- `significance.score` равно сумме компонентов, каждый компонент в пределах максимума;
- `status`, `access`, `reviewStatus`, `descriptionStatus` входят в enum;
- нет двух записей с одинаковым `osmId` или `coordinates` ближе 10 м без явного различия;
- `atlasId`, если указан, существует в `data/atlas/tbilisi/<atlasId>.json`.

## Сборка

```text
data/landmarks/tbilisi/*.json
        ↓  scripts/assemble-landmarks.mjs
public/atlas/landmarks.json
```

Бандл — массив карточек, отсортированный по `significance.score` убыванию, затем по `category` и `id`. В каждую карточку бандла добавляются плоские поля `name` и `description` (русские значения) и `rank`, чтобы интерфейсу не нужно было повторять логику.

Бандл генерируется, в Git не хранится и должен пересобираться в `npm run build`, `npm run check` и dev-сервере. Исходные файлы правятся только вручную.

## Статусы и миграция

- `reviewed` — имя, описание, источник и рейтинг проверены редактором.
- `draft` — структура заполнена, но описание или рейтинг предварительные.
- `missing` — описания нет; поле хранится пустым, объект не считается готовым к публикации в топ-100.

Первичная миграция текущего слоя создаёт `draft`-записи: имена и точки берутся из OSM, описания — из карточек атласа, если они есть; для остальных объектов допускается короткое черновое описание по типу и названию. Такие записи нельзя выдавать за проверенные.

## Связь с атласом

- Если у ориентира есть карточка атласа, `atlasId` обязателен, а имя, адрес и описание синхронизируются с ней.
- Если карточки нет, ориентир живёт самостоятельно; это не обещание создать карточку.
- Полигон, фотографии, история, архитектор и стиль в ориентир не переносятся: для этого есть атлас.

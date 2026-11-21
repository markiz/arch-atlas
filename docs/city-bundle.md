# Пакет города

Пакет города разделён на три части, чтобы карта и каталог не ждали длинные
тексты. Контракт задаёт `manifest.v3.json`; во время миграции рядом лежит
`manifest.json` версии 2 для вкладок, открытых до выкладки.

## Состав

```text
manifest.v3.json
buildings.core.json
buildings.details.<lang>.json
photo-credits.json
basemap.geojson
building-outlines.bin
```

`buildings.core.json` содержит всё, что нужно карте, каталогу, поиску,
сортировке и фильтрам: id, названия и адреса на всех языках города, район,
тип, годы, архитекторов, стили, координаты, геометрию, ссылки на фото и
`hasStory`. Полей `description`, `history`, `geometryQuality` и атрибуции фото
в core нет.

`buildings.details.<lang>.json` — текст для одного языка: `description`,
`history`, `geometryQuality`. Язык берётся из `city.languages`. Fallback
описания на русский разрешён; история на не-русском из русского не
подставляется.

`photo-credits.json` — языконезависимая атрибуция: `author`, `license`,
`licenseUrl`, `source`, `modifications`, `width`, `height` и, если есть,
`descriptions`.

## Загрузка

1. `cities.json` даёт город и `manifestRevision`.
2. Клиент пробует `manifest.v3.json`, иначе падает на `manifest.json` v2.
3. Скачиваются и проверяются только `core` и `basemap`; после этого
   вызывается `onReady`.
4. Details текущего языка и credits грузятся фоном. Инспектор показывает
   фото сразу, текст — после details, с состоянием загрузки и повтором.
5. Смена языка грузит details этого языка; названия и адреса уже есть в core.

## Инварианты

- `entry.details` содержит ровно языки города.
- Каждый id из core есть в details каждого языка; лишних id нет.
- Каждый id фото из core есть в credits.
- `hasStory` истинен, если хотя бы в одном языке есть непустые description
  или history.
- Размеры и SHA-256 всех файлов перечислены в `files`; клиент проверяет хеш
  перед использованием.
- `revision` зависит от core, details, credits, basemap, outlines и фото.

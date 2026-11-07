# Скрипты

Здесь лежат только повторяемые инструменты: то, что входит в сборку, проверку или регулярный конвейер. Одноразовые исследовательские скрипты — разовые загрузчики, ручные выборки, миграции под конкретную задачу — создаются в `work/` (каталог в `.gitignore`) и в Git не попадают.

Если разовый скрипт понадобился снова, переносите его в `scripts/`, добавляйте прогресс по [правилам длительных скриптов](../docs/long-running-scripts.md), документацию и тесты.

## Сборка и проверка

`build-map-layers.mjs`, `build-data.py`, `merge-aux.mjs`, `create-photo-thumbs.py`/`.mjs`, `sync-photos.mjs`, `rate-photos.py`, `assemble-atlas.mjs`, `assemble-landmarks.mjs`, `create-manifest.mjs`, `check-data.mjs`, `verify-dist.mjs`. Большинство из них вызываются через `npm run build`, `npm run check` или `npm run dev`.

## Данные и карта

- `extract-tbilisi-building-outlines.py` — извлекает городской слой зданий из PBF Geofabrik.
- `fetch-osm.py` — докачивает сетку OSM 4×4, существующие тайлы считает кэшем.
- `import-landmarks.py` — bootstrap-импорт ориентиров из OSM в `data/landmarks/<city>/`; существующие карточки не перезаписывает.
- `resolve-geometries.py` — собирает контуры relation/way и обновляет геометрию карточек.
- `research-heritage.py` — собирает исторические кандидаты и сущности Wikidata в `raw/research/`; вход для фото-конвейера и происхождение старых исследовательских файлов. Публичные и правительственные здания теперь не отбрасываются, но скрипт по-прежнему читает только центральную сетку `raw/osm/grid/`; полный городской пул строится из `raw/osm/osm-tbilisi-building-outlines.geojson`.
- `queue_collect.py`, `queue_report.py`, `create-next-200-report.py` — ручные инструменты исследования очередей; работают с Markdown-очередью и `work/queue/`. Закрытые очереди лежат в `docs/archive/research/`.

## Фотографии

- `collect-photo-candidates.py` и `apply-photo-candidates.py` — основной конвейер галерей.
- `fetch-registry-photos.py`, `batch-registry-review.py`, `plan-registry-review.mjs`, `merge-registry-selections.mjs` — работа с фото реестра памятников.
- `fetch-selected-photos.py`, `fetch-fallback-photos.py` — точечные загрузчики свободного фото и fallback реестра.
- `sync-photo-dimensions.py`, `sync-photo-source-tags.py`, `upgrade-photo-sources.py` — обслуживание sidecar и источников.
- `photo-visual-review.py` — контактные листы и запись готовых `visualTags`; сам не классифицирует.

## Библиотеки и обвязка

`atlas_source.py` — чтение/запись карточек и фото-кэша; `progress.py`, `lib/progress.mjs` — общий прогресс; `run-dev-server.sh` и `run-deepseek-web.sh` — запуск окружения; `test-deploy-pages.py` — проверка `deploy-pages.sh` на временном репозитории.

## Что удалено

Разовые проходы по Wikimedia/Commons (`fetch-more*.py`, `fetch-sources.py`, `fetch-curated-*.py`, `fetch-conservatory.py`, `fetch-specific-fixes.py`, `fetch-galleries.py`, `fetch-depicts.py`, `fetch-extra-categories.py`, `inspect-commons-categories.py`), одноразовые `enrich-basemap-*.mjs` и завершённая миграция `migrate-photo-ids.py` удалены. Их промежуточные данные и отчёты остаются в `data/`, `raw/research/` и `work/` как исторические артефакты; сборщик их не использует.

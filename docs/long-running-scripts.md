# Правила длительных рабочих скриптов

Статус: обязательные правила для новых и изменяемых скриптов в `scripts/`. Сверено с кодом 1 ноября 2026 года.

## 1. Когда правило обязательно

Прогресс обязателен, если скрипт хотя бы одно из перечисленного:

- делает HTTP-запросы к внешнему API, реестру, Commons, Wikidata или OSM;
- читает и разбирает большой локальный дамп (`*.pbf`, `osm-grid-*.xml`, GeoJSON на десятки тысяч объектов);
- перебирает больше примерно 100 объектов, файлов или фотографий;
- собирает, проверяет или пересобирает публикуемые данные;
- может работать дольше нескольких секунд на обычной машине или в Docker.

Правило не требует искусственной прогресс-строки для утилиты, которая заведомо выполняется доли секунды и не тянет данные (например, `scripts/queue_report.py` на локальном индексе). Если сомневаетесь — добавьте прогресс: лишняя строка в stderr дешевле, чем зависший на 200 запросах процесс без признаков жизни.

## 2. Что обязан показывать прогресс

1. **Старт.** До первого долгого запроса: что делаем и сколько всего известно.
2. **Ход.** Сколько выполнено из общего числа, процент, прошедшее время, оценку остатка и скорость. Для маленьких наборов — после каждого элемента; для больших — не реже примерно одного раза в 1–2 секунды.
3. **Текущий элемент.** Короткая метка: `candidate 61`, `osm-19630608`, `photos/…webp`, `page 2`. Не выводите в метку секреты, API-ключи, полные URL с ключом или огромные JSON.
4. **Финал.** Строка 100% (или итоговый счётчик при неизвестном общем числе) и сводка: сколько обработано, сколько пропущено, сколько ошибок.

Пример для известного общего числа:

```text
[  0/124   0%] | 00:00 elapsed | ETA — | collect queue candidates | 124 to process
[ 42/124  34%] | 00:18 elapsed | ~00:37 left | 2.3/s | collect queue candidates | candidate 61
[124/124 100%] | 01:02 elapsed | 2.0/s | done | collect queue candidates | candidate 200
```

Для неизвестного общего числа ETA не выдумывается:

```text
[0] | 00:01 elapsed | scan PBF ways | start; total unknown
[ 150000] | 00:41 elapsed | 3658/s | scan PBF ways | 3412 buildings
[ 312904] | 01:22 elapsed | 3815/s | scan PBF ways | 7820 buildings
```

## 3. Обязательные технические правила

- **Прогресс — в stderr, результат — в stdout.** Так `python3 scripts/queue_report.py > report.md` и машинно-читаемый вывод не засоряются. Ошибки и предупреждения тоже можно оставлять в stdout, если так было принято в скрипте, но прогресс — только stderr.
- **ETA только по измеренной скорости.** Нельзя писать «осталось 2 минуты», если это число не следует из фактического темпа. Оценка округляется и помечается `~`.
- **Известное общее число нужно получать, а не угадывать.** Подходят `len(items)`, список файлов, число страниц, `returnCountOnly` у ArcGIS, `Content-Length`. Если общее число получить нельзя (потоковый PBF), используйте `total=None` и показывайте счётчик, время и скорость без ETA.
- **Обновление после завершения элемента, а не после отправки.** В пулах потоков и асинхронном коде счётчик должен увеличиваться, когда задача действительно завершилась.
- **Потокобезопасность.** Общий счётчик из нескольких потоков обновляется через helper; самостоятельный `print` из воркеров без блокировки недопустим.
- **Не спамить.** Для 100 000 объектов нельзя печатать 100 000 строк. Обновляйте каждые N элементов (обычно 500–1000) или по времени, но финальную строку печатайте всегда.
- **Многофазные скрипты — отдельный прогресс на фазу.** Например: `parse OSM XML`, `index OSM outlines`, `match registry to OSM`, `write atlas files`. Не смешивайте счётчики разных фаз в одном числе.
- **Ошибки не скрываются.** Если часть элементов упала, прогресс должен дойти до конца, а финальная сводка — показать `ok / partial / error` или `added / skipped / failed`. Скрипт с `--resume` обязан отдельно сообщить, сколько уже готово и сколько осталось.
- **Никаких ANSI-танцев и `\r`-только строк.** Вывод должен читаться в CI, Docker-логах и перенаправленном файле. Одна строка на обновление, с `flush`.
- **Секреты не попадают в прогресс.** Не печатайте ключи, токены и URL, содержащие их.

## 4. Готовые helper'ы

### Python

`scripts/progress.py` — потокобезопасный класс `Progress`, который форматирует счётчик, процент, время, ETA и скорость. Импорт работает при обычном запуске `python3 scripts/<name>.py` из корня репозитория.

```python
from progress import Progress

items = load_items()
progress = Progress(len(items), 'fetch records')
progress.start()
for item in items:
    fetch(item)
    progress.advance(item['id'])
progress.finish()
```

Неизвестное общее число:

```python
progress = Progress(None, 'scan PBF ways', min_interval=1.0)
progress.start('way scan; total unknown')
for index, way in enumerate(ways, 1):
    process(way)
    if index % 50000 == 0:
        progress.update(index, f'{buildings} buildings')
progress.finish(f'{index:,} ways scanned')
```

Длинная фаза с редкими обновлениями:

```python
progress = Progress(len(features), 'clip building outlines')
progress.start()
for index, feature in enumerate(features, 1):
    process(feature)
    if index % 1000 == 0:
        progress.update(index, f'{len(kept):,} features')
progress.finish()
```

Для байтовых фаз (хэширование PBF, скачивание файла) есть `unit='bytes'`:

```python
progress = Progress(path.stat().st_size, 'hash PBF', unit='bytes')
progress.start()
digest = sha256_file(path, progress)
progress.finish()
```

### Node.js

`scripts/lib/progress.mjs` — тот же формат для `*.mjs`:

```js
import {Progress} from './lib/progress.mjs';

const progress = new Progress(items.length, {label: 'hash atlas files'});
progress.start();
for (const item of items) {
  await hash(item);
  progress.advance(item);
}
progress.finish();
```

Для параллельных промисов счётчик увеличивается внутри каждой завершившейся задачи:

```js
const files = await Promise.all(paths.map(async path => {
  const bytes = await readFile(path);
  const item = {path, size: bytes.length};
  progress.advance(path);
  return item;
}));
```

## 5. Чек-лист перед коммитом

- [ ] До первого запроса печатается стартовая строка с планом.
- [ ] Общее число известно или явно объяснено, почему нет.
- [ ] Есть ETA по фактической скорости; при неизвестном числе ETA отсутствует, а не выдумана.
- [ ] Для маленьких наборов прогресс виден по каждому элементу, для больших — не реже 1–2 секунд.
- [ ] Многофазный скрипт показывает отдельные фазы.
- [ ] Прогресс идёт в stderr, итоговые данные — в stdout.
- [ ] Финальная строка печатается даже при 0 элементов и при ошибке.
- [ ] В сводке есть `ok / skipped / error` или аналоги.
- [ ] Нет секретов, ключей и полных URL с ключом.
- [ ] Потоки/промисы не теряют и не удваивают счётчик.
- [ ] `python3 -m py_compile scripts/<name>.py` и/или `node --check scripts/<name>.mjs` проходят.
- [ ] Сделан короткий пробный запуск (или `--dry-run`), видно, что строки не спамят и не ломают перенаправление.

## 6. Текущее покрытие

Одноразовые исследовательские скрипты не коммитятся в `scripts/`: они живут в `work/` и не входят в этот список. Если разовый скрипт стал повторяемым инструментом, он переезжает в `scripts/`, получает прогресс, документацию и тесты.

Прогресс уже добавлен в:

- сетевые загрузчики: `fetch-osm.py`, `fetch-fallback-photos.py`, `fetch-registry-photos.py`, `batch-registry-review.py`, `fetch-selected-photos.py`, `batch-google-addresses.py`, `collect-photo-candidates.py`, `apply-photo-candidates.py`;
- сбор и очередь: `queue_collect.py`, `queue_report.py`, `create-next-200-report.py`, `research-heritage.py`, `resolve-geometries.py`, `extract-tbilisi-building-outlines.py`, `build-data.py`, `assemble-atlas.mjs`, `validate_cards.py`;
- сборка и проверка: `create-manifest.mjs`, `check-data.mjs`, `verify-dist.mjs`.

`queue_report.py` при чтении локального индекса обычно завершается быстрее секунды, но при сканировании `collect.json` и `verdict.json` показывает прогресс по файлам.

При добавлении нового скрипта или новой длительной фазы в существующий скрипт это правило действует без отдельного напоминания.

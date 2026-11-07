# Исследовательские документы в архиве

Это датированные рабочие журналы, а не текущее состояние проекта. Числа, статусы «добавлено/hold» и ссылки в них относятся к дате среза; задним числом они не переписываются.

Очереди 1–4 завершены и перенесены сюда. Пятая очередь ещё не полностью интегрирована, поэтому её документы остаются в корне `docs/`. Общая структура архива — в [../README.md](../README.md).

## Что сейчас актуально

- [status.md](../../status.md) — текущая сборка и ограничения.
- [research-pipeline.md](../../research-pipeline.md) — схема конвейера, скрипты и правила.
- [research-queue-progress.md](../../research-queue-progress.md) — регистр первой очереди: 95 добавлено, 105 hold/reject.
- [research-next-200-v5.md](../../research-next-200-v5.md) — пятая очередь, 200 кандидатов.
- [research-queue-v5-progress.md](../../research-queue-v5-progress.md) — разбор пятой очереди: 40 интегрировано, 60 READY ждут перевода.
- [research-hold-report.md](../../research-hold-report.md) — причины HOLD по первым трём очередям и план их преодоления.

## Очереди

| Папка | Материалы | Итог |
|---|---|---|
| [queue-1-heritage-200/](queue-1-heritage-200/) | [резюме кампании](queue-1-heritage-200/README.md): `screening/`, `verification/`, `waves/` | 95 добавлено, 105 hold/reject |
| [queue-2-heritage-200/](queue-2-heritage-200/) | [выборка](queue-2-heritage-200/research-next-200-v2.md), [разбор](queue-2-heritage-200/research-queue-v2.md) | 17 добавлено, 80 hold, 103 reject |
| [queue-3-heritage-200/](queue-3-heritage-200/) | [выборка](queue-3-heritage-200/research-next-200-v3.md), [разбор](queue-3-heritage-200/research-queue-v3.md) | 55 добавлено, 116 hold, 29 reject |
| [queue-4-unnamed-200/](queue-4-unnamed-200/) | [выборка](queue-4-unnamed-200/research-next-200-v4.md), [разбор](queue-4-unnamed-200/research-queue-v4-progress.md) | 96 READY, 97 HOLD, 7 REJECT; все 96 интегрированы |

### Первая очередь: стадии

- [screening/](queue-1-heritage-200/screening/) — исходная очередь 200, батчи A–F, предварительные выводы, проверка геометрии и пересечений с атласом.
- [verification/](queue-1-heritage-200/verification/) — готовые кандидаты, дополнительные проверки, приоритетные датировки, фото, разбор кандидата 1 и геометрии бани №5.
- [waves/](queue-1-heritage-200/waves/) — волны 1–4 и итоговые вердикты по оставшимся кандидатам.

## Правило обновления

- Исторический файл не переписывается под новые числа. Если вывод изменился, это фиксируется в регистре, новой волне или отдельной заметке.
- Актуальные счётчики берутся из `data/atlas/tbilisi/*.json`, собранного `public/atlas/buildings.json`, `public/atlas/manifest.json` и регистра очереди, а не из этих журналов.
- Описания пайплайна и путей к данным в датированных отчётах могут относиться к старой схеме. Актуальная схема — в [research-pipeline.md](../../research-pipeline.md), [location-data-collection.md](../../location-data-collection.md) и `data/atlas/`.
- Ссылки из актуальных документов на исторические материалы ведут в `docs/archive/`, а не на старые пути в корне `docs/`.

# Исследовательские документы

Это датированные рабочие журналы, а не текущее состояние проекта. Числа, статусы «добавлено/hold» и ссылки в них относятся к дате среза; задним числом они не переписываются.

Актуальное состояние:

- [status.md](status.md) — текущая сборка и ограничения;
- [research-queue-progress.md](research-queue-progress.md) — регистр оставшихся кандидатов;
- [research-queue-wave-4.md](research-queue-wave-4.md) — завершение очереди 200: 19 добавлено, 77 hold, 8 reject;
- [research-next-200-v2.md](research-next-200-v2.md) — очередь 200 кандидатов (отбор);
- [research-queue-v2.md](research-queue-v2.md) — разбор второй очереди: 17 добавлено, 80 hold, 103 reject;
- [research-queue-v3.md](research-queue-v3.md) — разбор третьей очереди: 55 добавлено, 116 hold, 29 reject;
- [research-hold-report.md](research-hold-report.md) — сводный разбор причин HOLD, примеры, диаграммы и план преодоления;
- [research-queue-v4-progress.md](research-queue-v4-progress.md) — четвёртая очередь: 96 READY, 97 HOLD, 7 REJECT; все 96 интегрированы;
- [research-queue-v5-progress.md](research-queue-v5-progress.md) — пятая очередь: 100 READY, 83 HOLD, 17 REJECT; 40 интегрировано, 60 ждут перевода;
- [research-pipeline.md](research-pipeline.md) — схема конвейера, скрипты и правила;
- [landmark-expansion.md](landmark-expansion.md) — процедура расширения слоя достопримечательностей и отбора топ-100;
- [landmark-schema.md](landmark-schema.md) — схема карточки ориентира `data/landmarks/tbilisi/*.json`;
- [long-running-scripts.md](long-running-scripts.md) — обязательный прогресс и helper'ы для длительных скриптов;
- [archive/README.md](archive/README.md) — исходный план и ранние снимки.

## Карта исследований

| Группа | Файлы | Что внутри |
|---|---|---|
| Очередь | [research-next-200.md](research-next-200.md), [batch A](research-next-200-batch-a.md) … [batch F](research-next-200-batch-f.md) | 200 записей реестра, OSM-кандидаты, адреса, даты, предварительные расхождения |
| Геометрия | [geometry-check.md](research-next-200-geometry-check.md), [overlaps.md](research-next-200-overlaps.md) | IoU с официальными границами и пересечения с карточками |
| Отбор | [ready-a](research-ready-a.md), [ready-b](research-ready-b.md), [ready-c](research-ready-c.md), [ready-d](research-ready-d.md) | Кандидаты с профильными источниками; большинство уже в атласе |
| Дополнительная проверка | [followup 1–60](research-followup-1-60.md), [61–130](research-followup-61-130.md), [131–200](research-followup-131-200.md) | Построчные решения, пробелы и hold |
| Сводки | [findings](research-next-200-findings.md), [priority-buildings](research-priority-buildings.md), [new-buildings-photos](research-new-buildings-photos.md) | Итоги первого прохода, спорные датировки, фото и права |
| Кампания 31.10–01.11 | [candidate-1](research-candidate-1-2676.md), [wave 1](research-queue-wave-1.md), [wave 2](research-queue-wave-2.md), [wave 3](research-queue-wave-3.md), [wave 4](research-queue-wave-4.md) | Разбор очереди 200: 95 добавлено, 105 hold/reject с причинами |
| Вторая очередь | [research-next-200-v2.md](research-next-200-v2.md), [разбор](research-queue-v2.md) | 200 новых кандидатов: 17 добавлено, 80 hold, 103 reject |
| Третья очередь | [research-next-200-v3.md](research-next-200-v3.md), [разбор](research-queue-v3.md) | 200 новых кандидатов: 55 добавлено, 116 hold, 29 reject |
| Сводный HOLD | [research-hold-report.md](research-hold-report.md) | 273 HOLD: причины, примеры, диаграммы, план преодоления |
| Четвёртая очередь | [research-next-200-v4.md](research-next-200-v4.md), [разбор](research-queue-v4-progress.md) | 200 из 200 разобрано: 96 READY, 97 HOLD, 7 REJECT; все 96 интегрированы |
| Пятая очередь | [research-next-200-v5.md](research-next-200-v5.md), [разбор](research-queue-v5-progress.md) | 200 из 200: 100 READY, 83 HOLD, 17 REJECT; 40 интегрировано |
| Разбор геометрии | [Баня №5, реестр 3756](research-bath-5-geometry.md) | Почему way из очереди — не баня, чем отличаются официальная граница, relation и подземный комплекс |

## Правило обновления

- Исторический файл не переписывается под новые числа. Если вывод изменился, это фиксируется в регистре, новой волне или отдельной заметке.
- Актуальные счётчики берутся из `data/atlas/tbilisi/*.json`, собранного `public/atlas/buildings.json`, `public/atlas/manifest.json` и регистра очереди, а не из README или старых research-файлов.
- Описания пайплайна и путей к данным в датированных отчётах могут относиться к старой схеме (`data/heritage-extra.json`, отдельные translation-файлы). Актуальная схема — в [research-pipeline.md](research-pipeline.md), [location-data-collection.md](location-data-collection.md) и `data/atlas/`.
- Ссылки на архивные документы ведут в `docs/archive/`; ссылки на исследовательские снимки остаются в `docs/`, потому что на них опирается очередь.

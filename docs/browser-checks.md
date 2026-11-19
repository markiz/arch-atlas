# Проверка в браузере

В образах `atlas-codex` и `atlas-deepseek` есть Playwright MCP (`@playwright/mcp`) с headless Chromium. Отдельного браузерного CLI нет: работают MCP-инструменты вида `mcp__playwright__browser_navigate`, `mcp__playwright__browser_take_screenshot`, `mcp__playwright__browser_run_code_unsafe` и т. д. Браузер запускается внутри контейнера и работает по HTTP.

В `atlas-codex` MCP подключён к самой сессии. В `atlas-deepseek` он принадлежит агентскому пресету `tester`: основная сессия этих инструментов не видит и делегирует проверку через `subagent(agent_preset="tester", prompt=...)`. У ребёнка read-only файловая система (`write`/`edit` выключены), он возвращает вердикт, доказательства и пути к скриншотам.

- Конфиг — [scripts/mcp.config.json](../scripts/mcp.config.json): `chromium`, headless, viewport `1440x900`, вывод в `work/playwright`; его читают оба образа.
- Codex — [scripts/run-codex.sh](../scripts/run-codex.sh) добавляет MCP через `-c mcp_servers.playwright...`, не меняя `$CODEX_HOME/config.toml`. Отключить: `ATLAS_DISABLE_MCP=1 make codex`.
- DSH — пресет `tester` объявлен в [scripts/dsh-agent-presets.patch.yml](../scripts/dsh-agent-presets.patch.yml). Образ кладёт файл в `/opt/atlas-browser/`, лаунчер подаёт его через `--patch`, поэтому пресет есть в любой свежей установке, а `$DSH_HOME` остаётся чистым.
- `preset-standard` в этом файле — дословная копия `presets/standard.patch.yml` из `@deepseek-ai/dsh-web-app` версии, закреплённой в `Dockerfile.deepseek` (`ARG DSH_VERSION`), плюс `allowedAgentPresets`. При смене версии DSH обновите этот блок. Оверлей применяется после профильного патча, поэтому правки `preset-standard` в `$DSH_HOME` он перекрывает: свои изменения вносите в этот файл.
- Глобальный оверлей [scripts/dsh-mcp.patch.yml](../scripts/dsh-mcp.patch.yml) по умолчанию не подключается. `ATLAS_DISABLE_MCP=0 make deepseek` возвращает MCP сразу всем сессиям, `ATLAS_DISABLE_MCP=1 make deepseek` выключает браузерные инструменты совсем.

## Быстрая проверка страницы

В `atlas-deepseek` вызов идёт из основной сессии, дальше всё делает ребёнок:

```text
subagent:
  agent_preset: "tester"
  description: "Проверка страницы"
  prompt: "http://127.0.0.1:5173/ — проверь, что карта и маркеры загрузились; собери console errors; скриншот в work/shot.png; верни вердикт, ошибки и путь"
```

Внутри ребёнка — те же вызовы, что и в `atlas-codex`:

```text
browser_navigate  { url: "http://127.0.0.1:5173/" }
browser_take_screenshot { filename: "work/shot.png", scale: "css" }
browser_console_messages { level: "error" }
```

Явные имена файлов считаются от корня workspace; `outputDir` используется только для автоматически названных файлов. Скриншоты и трассировки складывайте в `work/` — каталог в `.gitignore`.

Другие полезные инструменты:

```text
browser_snapshot          — accessibility-дерево с refs e1, e2, ...
browser_find              — найти текст/ref без полного snapshot
browser_click             — клик по ref или CSS-селектору
browser_type              — ввод текста
browser_evaluate          — JS в странице
browser_network_requests  — запросы страницы
browser_resize            — размер viewport
browser_run_code_unsafe   — произвольный Playwright-код с `page`
```

## Тач-драг

Встроенный `browser_drag` — это drag мышью между элементами. Для настоящего тача используется CDP через `browser_run_code_unsafe`; готовый сценарий лежит в [scripts/mcp-touch-drag.js](../scripts/mcp-touch-drag.js).

В `atlas-deepseek` оба шага выполняет ребёнок `tester`: в его prompt передайте координаты жеста и просьбу прогнать сценарий.

1. Задайте параметры жеста в странице. `sessionStorage` переживёт перезагрузку, которую сценарий делает для инициализации карты с тачем:

```text
browser_evaluate:
  () => {
    const params = {x1: 700, y1: 520, x2: 700, y2: 300, steps: 12, delay: 16, wait: 1500};
    sessionStorage.setItem('atlasTouchParams', JSON.stringify(params));
    return params;
  }
```

2. Запустите сценарий:

```text
browser_run_code_unsafe { filename: "scripts/mcp-touch-drag.js" }
```

Сценарий включает `Emulation.setTouchEmulationEnabled`, перезагружает страницу, ждёт `.atlas-map-host`, отправляет `touchStart → touchMove… → touchEnd` и возвращает:

- `before` / `during` / `after` — transform `.atlas-map-pan` (видно, сдвинулась ли карта; `after` может быть пустым после recenter);
- `events` — первые 80 событий `touch*`/`pointer*` с координатами и `pointerType`;
- `params` — фактически применённый жест.

Координаты — CSS-пиксели viewport. Для мобильной вёрстки уменьшите окно через `browser_resize` (например, `360×732`) и выбирайте точки по скриншоту; для десктопной оставляйте `1440×900`.

Пример результата:

```json
{
  "before": "translate3d(0px, 0px, 0px)",
  "during": "translate3d(0px, -220px, 0px)",
  "after": "",
  "events": [{"type": "pointerdown", "x": 700, "y": 520, "pointerType": "touch"}],
  "params": {"x1": 700, "y1": 520, "x2": 700, "y2": 300, "steps": 12, "delay": 16, "wait": 1500}
}
```

## Ограничения

- Установлен только headless shell; headed-режим не поддерживается. Для headed пересоберите образ с полным Chromium (`node .../playwright/cli.js install chromium --with-deps` без `--only-shell`).
- Профиль браузера и временные файлы MCP лежат в `$HOME` (DSH запускает сервер вне bash-sandbox, поэтому это работает); запись страницы идёт в `/workspace`.
- Контейнер read-only, кроме `/workspace`, `/tmp` и `/dsh`; браузер запускается с `--no-sandbox`, границей безопасности остаётся контейнер.
- MCP добавляет схемы инструментов в каждый запрос той сессии, где он смонтирован. В `atlas-deepseek` это только сессия `tester`; `ATLAS_DISABLE_MCP=0` возвращает схемы во все сессии.
- У пресета `tester` нет `agent-instructions`: правила репозитория и детали задачи (URL, что считать успехом, куда сохранить скриншоты) передаются в prompt, ребёнок не выводит их сам.

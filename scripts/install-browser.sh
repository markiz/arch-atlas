#!/usr/bin/env bash
# Install Playwright MCP and a version-matched headless Chromium into an agent
# image (atlas-codex / atlas-deepseek). atlas-deploy (the builder) does not call
# this script.
set -Eeuo pipefail

mcp_version="${PLAYWRIGHT_MCP_VERSION:-0.0.85}"
browsers_path="${PLAYWRIGHT_BROWSERS_PATH:-/opt/playwright-browsers}"

if [[ "$(id -u)" -ne 0 ]]; then
  printf 'Ошибка: установка браузера требует root (запускай скрипт при сборке образа).\n' >&2
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive
export PLAYWRIGHT_BROWSERS_PATH="$browsers_path"
export PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

apt-get update
apt-get install -y --no-install-recommends \
  ca-certificates \
  fonts-dejavu-core \
  fonts-liberation

# The MCP server brings its own copy of Playwright; the npm install must not
# download a browser yet, because the explicit install below pins the shell.
npm install --global "@playwright/mcp@${mcp_version}"
npm cache clean --force >/dev/null 2>&1 || true

# Install the headless Chromium revision expected by the MCP server's Playwright
# (revision 1254 / Chromium 158 for @playwright/mcp 0.0.85). --with-deps pulls
# the shared libraries Chromium needs on Debian slim.
unset PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD
global_root="$(npm root -g)"
playwright_cli="$global_root/@playwright/mcp/node_modules/playwright/cli.js"
if [[ ! -f "$playwright_cli" ]]; then
  playwright_cli="$global_root/playwright/cli.js"
fi
[[ -f "$playwright_cli" ]] || {
  printf 'Ошибка: не найден playwright/cli.js внутри @playwright/mcp.\n' >&2
  exit 1
}
node "$playwright_cli" install chromium --only-shell --with-deps
rm -rf /var/lib/apt/lists/*

if ! find "$PLAYWRIGHT_BROWSERS_PATH" -maxdepth 4 -type f -name 'chrome-headless-shell' -print -quit | grep -q .; then
  printf 'Ошибка: headless Chromium не найден в %s.\n' "$PLAYWRIGHT_BROWSERS_PATH" >&2
  exit 1
fi

playwright-mcp --version >/dev/null
printf 'Playwright MCP и headless Chromium установлены\n'

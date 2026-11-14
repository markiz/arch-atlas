#!/usr/bin/env bash
# Codex entrypoint with the Playwright MCP server enabled.
#
# The MCP configuration is passed as -c overrides, so the user's
# $CODEX_HOME/config.toml on the atlas-codex-home volume is not modified.
# Disable the server with ATLAS_DISABLE_MCP=1.
set -Eeuo pipefail

command -v codex >/dev/null 2>&1 || {
  printf 'Ошибка: codex не найден в PATH.\n' >&2
  exit 1
}

args=(codex)
if [[ "${ATLAS_DISABLE_MCP:-0}" != "1" ]]; then
  args+=(
    -c 'mcp_servers.playwright.command="playwright-mcp"'
    -c 'mcp_servers.playwright.args=["--headless","--config","/opt/atlas-browser/mcp.config.json"]'
    -c 'mcp_servers.playwright.env={PLAYWRIGHT_BROWSERS_PATH="/opt/playwright-browsers",PLAYWRIGHT_MCP_CONFIG="/opt/atlas-browser/mcp.config.json"}'
  )
fi

exec "${args[@]}" "$@"

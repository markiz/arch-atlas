#!/usr/bin/env bash
set -Eeuo pipefail

mkdir -p "${HOME:-/tmp}" 2>/dev/null || true
port="${DSH_WEB_PORT:-3080}"
container_ip="$(hostname -i | awk '{print $1}')"

if [[ -z "$container_ip" ]]; then
  printf 'Не удалось определить адрес контейнера для веб-сервера DeepSeek Harness.\n' >&2
  exit 1
fi

printf 'DeepSeek Harness будет доступен по адресу http://127.0.0.1:%s/\n' "$port"
printf 'Остановка сервера: Ctrl+C. Настройки сохраняются в Docker-томе /dsh.\n'

# Browser tools belong to the `tester` agent preset, declared by the overlay
# below, so every fresh $DSH_HOME gets them without a profile edit.
# ATLAS_DISABLE_MCP keeps its old meaning: 1 disables browser tooling entirely,
# 0 also loads the global MCP for every session (debugging that server).
preset_patch=/opt/atlas-browser/dsh-agent-presets.patch.yml
mcp_patch=/opt/atlas-browser/dsh-mcp.patch.yml
case "${ATLAS_DISABLE_MCP:-}" in
  1) patch_args=() ;;
  0) patch_args=(--patch "$preset_patch" --patch "$mcp_patch") ;;
  *) patch_args=(--patch "$preset_patch") ;;
esac

exec dsh web "${patch_args[@]}" \
  --host "$container_ip" \
  --port "$port" \
  --no-open \
  --public-url "http://127.0.0.1:${port}/" \
  --trusted-host 127.0.0.1 \
  --trusted-host localhost "$@"

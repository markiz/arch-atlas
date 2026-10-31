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
exec dsh web \
  --host "$container_ip" \
  --port "$port" \
  --no-open \
  --public-url "http://127.0.0.1:${port}/" \
  --trusted-host 127.0.0.1 \
  --trusted-host localhost "$@"

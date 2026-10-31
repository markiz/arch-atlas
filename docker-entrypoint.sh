#!/usr/bin/env bash
set -Eeuo pipefail

workspace="${ATLAS_WORKSPACE:-/workspace}"
deploy_script="${ATLAS_DEPLOY_SCRIPT:-/usr/local/bin/atlas-deploy}"

git -C "$workspace" rev-parse --show-toplevel >/dev/null 2>&1 || {
  printf 'Ошибка: подключи корень Git-репозитория в %s.\n' "$workspace" >&2
  exit 1
}

cd "$workspace"
export PAGES_PUSH=no
exec "$deploy_script"

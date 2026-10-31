#!/usr/bin/env bash
set -Eeuo pipefail

created_node_modules_link=false

# Зависимости образа лежат вне подключённого проекта. Vite ищет импорты
# приложения из /workspace, поэтому создаём временную ссылку, если её ещё нет.
if [[ ! -e node_modules && ! -L node_modules ]]; then
  ln -s "$ATLAS_NODE_MODULES" node_modules
  created_node_modules_link=true
fi

# Не оставляем ссылку node_modules в рабочем дереве после остановки сервера.
cleanup() {
  if [[ "$created_node_modules_link" == true ]]; then
    rm -f node_modules
  fi
}
trap cleanup EXIT

# Vite слушает интерфейсы контейнера. Makefile публикует порт
# только на loopback хоста.
npm run dev -- --host 0.0.0.0 --strictPort

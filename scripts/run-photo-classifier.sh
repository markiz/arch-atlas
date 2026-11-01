#!/usr/bin/env bash
# Prefer the local optional venv for CLIP dependencies; fall back to python3 so
# the script can print a precise missing-dependency message.
set -euo pipefail
cd "$(dirname "$0")/.."
if [ -x work/photo-classify-venv/bin/python ]; then
  exec work/photo-classify-venv/bin/python scripts/classify-photo-visuals.py "$@"
fi
exec python3 scripts/classify-photo-visuals.py "$@"

#!/bin/sh
set -eu
cd "$(dirname "$0")"
exec docker run --rm \
  --user "$(id -u):$(id -g)" \
  -e npm_config_cache=/tmp/npm-cache \
  -v "$PWD:/app" -w /app \
  node:24-alpine \
  sh -c 'npm ci && npm run build && node --test server/selfhost.test.js'

#!/bin/sh
set -eu
cd "$(dirname "$0")"
docker compose "$@" config --quiet
docker compose "$@" stop
if [ -d data ]; then
  mkdir -p "$HOME/lemmings-backups"
  snapshot="$HOME/lemmings-backups/before-features-$(date +%Y%m%d-%H%M%S)"
  cp -a data "$snapshot"
  printf 'Data-back-up vóór upgrade: %s\n' "$snapshot"
fi
for pattern in 'backups/' 'data-backup-*/'; do
  if ! grep -qxF "$pattern" .gitignore 2>/dev/null; then printf '\n%s\n' "$pattern" >> .gitignore; fi
done
for pattern in 'backups' 'data-backup-*'; do
  if ! grep -qxF "$pattern" .dockerignore 2>/dev/null; then printf '\n%s\n' "$pattern" >> .dockerignore; fi
done
docker compose "$@" up -d --build

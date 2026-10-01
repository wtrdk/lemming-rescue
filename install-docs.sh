#!/bin/sh
set -eu
cd "$(dirname "$0")"
for pattern in '.env' '.env.*' '!.env.example' 'data/' 'backups/' 'data-backup-*/' 'node_modules/' 'dist/'; do
  if ! grep -qxF "$pattern" .gitignore 2>/dev/null; then printf '\n%s\n' "$pattern" >> .gitignore; fi
done
for pattern in '.env' '.env.*' '!.env.example' 'data' 'backups' 'data-backup-*' 'node_modules' 'dist'; do
  if ! grep -qxF "$pattern" .dockerignore 2>/dev/null; then printf '\n%s\n' "$pattern" >> .dockerignore; fi
done
printf 'Git- en Docker-uitsluitingen aangevuld. Je bestaande .env en data zijn behouden.\n'

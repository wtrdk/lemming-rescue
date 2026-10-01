#!/bin/sh
set -eu
mkdir -p "$DATA_DIR" "${BACKUP_DIR:-/backups}"
chown -R node:node "$DATA_DIR" "${BACKUP_DIR:-/backups}"
exec su-exec node:node node server/selfhost.js

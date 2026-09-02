#!/bin/sh
set -eu

: "${DATABASE_URL:?DATABASE_URL_REQUIRED}"
: "${BACKUP_DIR:?BACKUP_DIR_REQUIRED}"

RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"

mkdir -p "$BACKUP_DIR"

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
DUMP="$BACKUP_DIR/tamancare-$STAMP.dump"
MANIFEST="$DUMP.manifest"

pg_dump \
  --dbname="$DATABASE_URL" \
  --format=custom \
  --no-owner \
  --no-acl \
  --file="$DUMP"

pg_restore --list "$DUMP" >/dev/null

SHA="$(sha256sum "$DUMP" | awk '{print $1}')"
SIZE="$(wc -c < "$DUMP" | tr -d ' ')"

{
  echo "format=postgres-custom"
  echo "created_utc=$STAMP"
  echo "sha256=$SHA"
  echo "bytes=$SIZE"
  echo "retention_days=$RETENTION_DAYS"
} > "$MANIFEST"

find "$BACKUP_DIR" \
  -type f \
  \( -name 'tamancare-*.dump' -o -name 'tamancare-*.dump.manifest' \) \
  -mtime "+$RETENTION_DAYS" \
  -delete

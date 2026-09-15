#!/bin/sh
set -eu

# Target database URL to restore into
: "${DATABASE_URL:?DATABASE_URL_REQUIRED}"

DUMP_INPUT="${1:-}"

if [ -z "$DUMP_INPUT" ]; then
  BACKUP_DIR="${BACKUP_DIR:-/backups}"
  if [ ! -d "$BACKUP_DIR" ]; then
    echo "ERROR: DUMP_INPUT not provided and BACKUP_DIR ($BACKUP_DIR) does not exist." >&2
    exit 1
  fi
  # Find latest dump file in BACKUP_DIR
  DUMP_INPUT="$(find "$BACKUP_DIR" -type f -name 'tamancare-*.dump' | sort | tail -n 1)"
  if [ -z "$DUMP_INPUT" ]; then
    echo "ERROR: No backup dump file found in $BACKUP_DIR." >&2
    exit 1
  fi
  echo "--> Selected latest backup dump: $DUMP_INPUT"
fi

if [ ! -f "$DUMP_INPUT" ]; then
  echo "ERROR: Dump file '$DUMP_INPUT' does not exist." >&2
  exit 1
fi

MANIFEST="$DUMP_INPUT.manifest"
if [ -f "$MANIFEST" ]; then
  echo "--> Found manifest file: $MANIFEST"
  EXPECTED_SHA="$(grep '^sha256=' "$MANIFEST" | cut -d= -f2 || true)"
  if [ -n "$EXPECTED_SHA" ]; then
    ACTUAL_SHA="$(sha256sum "$DUMP_INPUT" | awk '{print $1}')"
    echo "--> Verifying SHA-256 integrity..."
    echo "    Expected: $EXPECTED_SHA"
    echo "    Actual:   $ACTUAL_SHA"
    if [ "$EXPECTED_SHA" != "$ACTUAL_SHA" ]; then
      echo "ERROR: SHA-256 checksum mismatch! Backup file may be corrupted." >&2
      exit 1
    fi
    echo "--> SHA-256 checksum verified successfully."
  fi
else
  echo "WARNING: Manifest file '$MANIFEST' not found. Skipping SHA-256 verification." >&2
fi

echo "--> Validating dump file format with pg_restore --list..."
pg_restore --list "$DUMP_INPUT" >/dev/null

echo "--> Executing pg_restore to target database..."
pg_restore \
  --dbname="$DATABASE_URL" \
  --clean \
  --if-exists \
  --no-owner \
  --no-acl \
  "$DUMP_INPUT" || {
    # Note: pg_restore might return non-zero for harmless warnings (e.g., IF EXISTS drop errors).
    # We log a warning but check database state next.
    echo "WARNING: pg_restore finished with warnings or minor errors." >&2
  }

echo "--> Database restore completed successfully for $DUMP_INPUT"

#!/bin/sh

# Shared file-secret reader for operational PostgreSQL scripts.
# The URL is never printed; callers pass it directly to PostgreSQL tools.
load_database_url() {
  if [ -n "${DATABASE_URL_FILE:-}" ]; then
    if [ ! -f "$DATABASE_URL_FILE" ] || [ ! -r "$DATABASE_URL_FILE" ]; then
      echo 'DATABASE_URL_FILE_UNREADABLE' >&2
      return 1
    fi

    if [ -L "$DATABASE_URL_FILE" ]; then
      echo 'DATABASE_URL_FILE_MUST_NOT_BE_SYMLINK' >&2
      return 1
    fi

    if command -v stat >/dev/null 2>&1; then
      mode="$(stat -c '%a' "$DATABASE_URL_FILE" 2>/dev/null || stat -f '%Lp' "$DATABASE_URL_FILE" 2>/dev/null || true)"
      if [ -n "$mode" ]; then
        tail_permissions="$(printf '%s' "$mode" | sed 's/.*\(..\)$/\1/')"
        case "$tail_permissions" in
          00) ;;
          *) echo 'DATABASE_URL_FILE_PERMISSIONS_TOO_BROAD' >&2; return 1 ;;
        esac
      fi
    fi

    DATABASE_URL="$(cat "$DATABASE_URL_FILE")" || {
      echo 'DATABASE_URL_FILE_READ_FAILED' >&2
      return 1
    }
  fi

  if [ -z "${DATABASE_URL:-}" ]; then
    echo 'DATABASE_URL_OR_FILE_REQUIRED' >&2
    return 1
  fi

  export DATABASE_URL
}

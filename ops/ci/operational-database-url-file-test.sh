#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
helper="$repo_root/ops/x3-production/backup/lib/database-url.sh"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
umask 077

printf '%s' 'synthetic-only://ci_user:synthetic-password@127.0.0.1/ci_db' > "$tmp/url"
chmod 600 "$tmp/url"

if ! output="$(DATABASE_URL_FILE="$tmp/url" DATABASE_URL='' sh -c '. "$1"; load_database_url; test "$DATABASE_URL" = "$2"' sh "$helper" 'synthetic-only://ci_user:synthetic-password@127.0.0.1/ci_db' 2>&1)"; then
  echo 'FILE_SECRET_READ=FAIL'
  exit 1
fi
if [[ "$output" == *'synthetic-password'* ]]; then
  echo 'FILE_SECRET_OUTPUT_LEAK=FAIL'
  exit 1
fi
echo 'FILE_SECRET_READ=PASS'
echo 'FILE_SECRET_NO_OUTPUT_LEAK=PASS'

if output="$(DATABASE_URL_FILE="$tmp/missing" DATABASE_URL='' sh -c '. "$1"; load_database_url' sh "$helper" 2>&1)"; then
  echo 'MISSING_FILE_SECRET=FAIL'
  exit 1
fi
[[ "$output" == 'DATABASE_URL_FILE_UNREADABLE' ]]
echo 'MISSING_FILE_SECRET_FAIL_CLOSED=PASS'

: > "$tmp/empty"
chmod 600 "$tmp/empty"
if output="$(DATABASE_URL_FILE="$tmp/empty" DATABASE_URL='' sh -c '. "$1"; load_database_url' sh "$helper" 2>&1)"; then
  echo 'EMPTY_FILE_SECRET=FAIL'
  exit 1
fi
[[ "$output" == 'DATABASE_URL_OR_FILE_REQUIRED' ]]
echo 'EMPTY_FILE_SECRET_FAIL_CLOSED=PASS'

chmod 644 "$tmp/url"
if output="$(DATABASE_URL_FILE="$tmp/url" DATABASE_URL='' sh -c '. "$1"; load_database_url' sh "$helper" 2>&1)"; then
  echo 'BROAD_FILE_PERMISSIONS=FAIL'
  exit 1
fi
[[ "$output" == 'DATABASE_URL_FILE_PERMISSIONS_TOO_BROAD' ]]
echo 'BROAD_FILE_PERMISSIONS_REJECTED=PASS'

ln -s "$tmp/url" "$tmp/url-link"
chmod 600 "$tmp/url"
if output="$(DATABASE_URL_FILE="$tmp/url-link" DATABASE_URL='' sh -c '. "$1"; load_database_url' sh "$helper" 2>&1)"; then
  echo 'SYMLINK_FILE_SECRET=FAIL'
  exit 1
fi
[[ "$output" == 'DATABASE_URL_FILE_MUST_NOT_BE_SYMLINK' ]]
echo 'SYMLINK_FILE_SECRET_REJECTED=PASS'

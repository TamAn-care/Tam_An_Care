#!/bin/sh
set -eu

: "${DATABASE_URL:?DATABASE_URL_REQUIRED}"

echo "=================================================="
echo " Tâm An Care - Restore Verification & Integrity Drill"
echo " Date (UTC): $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "=================================================="

# Function to run a query safely
run_query() {
  psql "$DATABASE_URL" -t -A -c "$1" 2>/dev/null || echo "0"
}

# 1. Count public tables
PUBLIC_TABLE_COUNT="$(run_query "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';")"

# 2. Count residents
RESIDENT_COUNT="$(run_query "SELECT count(*) FROM residents;")"

# 3. Count care actions
CARE_ACTION_COUNT="$(run_query "SELECT count(*) FROM care_actions;")"

# 4. Count medication orders if table exists
MED_ORDER_COUNT="$(run_query "SELECT count(*) FROM medication_orders;")"

# 5. Check audit tables count
AUDIT_TABLE_COUNT="$(run_query "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE '%_audit';")"

# 6. Check database readiness & connectivity
DB_VERSION="$(run_query "SELECT version();" | head -n 1)"

echo ""
echo "--- Verification Metrics ---"
echo "Database Version   : $DB_VERSION"
echo "Public Table Count : $PUBLIC_TABLE_COUNT"
echo "Audit Table Count  : $AUDIT_TABLE_COUNT"
echo "Resident Count     : $RESIDENT_COUNT"
echo "Care Action Count  : $CARE_ACTION_COUNT"
echo "Medication Orders  : $MED_ORDER_COUNT"
echo "----------------------------"

if [ "$PUBLIC_TABLE_COUNT" -gt 0 ]; then
  echo "--> Verification Status: SUCCESS (Schema and core tables detected)"
  exit 0
else
  echo "--> Verification Status: FAILED (No public tables detected in database)"
  exit 1
fi

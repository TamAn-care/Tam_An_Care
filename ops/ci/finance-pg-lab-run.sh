#!/usr/bin/env bash
set -euo pipefail
export PGHOST=127.0.0.1 PGPORT=5432 PGUSER=finance_ci PGDATABASE=finance_ci
export PGPASSWORD=finance_ci_only
psql -X -v ON_ERROR_STOP=1 -f ops/ci/finance-pg-lab-schema.sql
psql -X -v ON_ERROR_STOP=1 -f ops/ci/finance-pg-lab-tests.sql
# Two independent sessions both attempt to allocate 40 to an invoice with
# a balance of 50; locking must allow exactly one to commit.
psql -X -v ON_ERROR_STOP=1 -c "INSERT INTO billing_receipts VALUES ('P5','R1','CONFIRMED',80)"
psql -X -v ON_ERROR_STOP=1 -c "SET lock_timeout='5s'; INSERT INTO billing_payment_allocations VALUES ('C1','P2','I2',40)" >/tmp/finance_ci_a.log 2>&1 &
p1=$!
psql -X -v ON_ERROR_STOP=1 -c "SET lock_timeout='5s'; INSERT INTO billing_payment_allocations VALUES ('C2','P5','I2',40)" >/tmp/finance_ci_b.log 2>&1 &
p2=$!
r1=0; wait "$p1" || r1=$?
r2=0; wait "$p2" || r2=$?
if [[ "$r1" -eq 0 && "$r2" -eq 0 ]]; then
  echo "FAIL: double allocation committed"; exit 1
fi
if [[ "$r1" -ne 0 && "$r2" -ne 0 ]]; then
  echo "FAIL: neither allocation committed"; exit 1
fi
count=$(psql -X -At -v ON_ERROR_STOP=1 -c "SELECT count(*) FROM billing_payment_allocations WHERE invoice_id='I2'")
balance=$(psql -X -At -v ON_ERROR_STOP=1 -c "SELECT coalesce(sum(amount_vnd),0)::bigint FROM billing_payment_allocations WHERE invoice_id='I2'")
if [[ "$count" != "1" || "$balance" != "40" ]]; then
 echo "FAIL: unexpected concurrent allocation result"; exit 1
fi
echo "FINANCE_PG_LAB_CONCURRENCY_PASS"
echo "FINANCE_PG_LAB_ALL_ISOLATED_GATES_PASS"

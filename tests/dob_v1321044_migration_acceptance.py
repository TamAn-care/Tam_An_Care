"""Synthetic-only audit migration acceptance. Does not access Production Test."""
import hashlib, os
from pathlib import Path
import psycopg

ROOT=Path(__file__).resolve().parents[1]
sql=(ROOT/"api/migrations/001_resident_demographic_audit.sql").read_bytes()
expected="42cdf18b1cb2730e170ec06127ba237cfb0666d5c07f30c97b3d1776fb4e60ee"
assert hashlib.sha256(sql).hexdigest()==expected, "Source migration digest mismatch"
assert os.getenv("GITHUB_ACTIONS")=="true"
assert os.getenv("PGHOST")=="127.0.0.1"
assert os.getenv("PGDATABASE")=="dob_ci_synthetic"
assert os.getenv("PGUSER")=="dob_ci"
with psycopg.connect(
    host="127.0.0.1",port=5432,dbname="dob_ci_synthetic",
    user="dob_ci",password="synthetic-ci-only-not-production",connect_timeout=5
) as conn:
    with conn.cursor() as cur:
        cur.execute(sql.decode())
        cur.execute(sql.decode())  # idempotency
        cur.execute("""INSERT INTO public.resident_demographic_audit
           (event_type,target_resident_id,performed_by,performed_by_role,reason,previous_value,new_value)
           VALUES ('RESIDENT_DEMOGRAPHICS_CORRECTED','synthetic-1','ci-operator',
           'SUPERVISOR','Synthetic correction test','{"dateOfBirth":"1954-01-01"}',
           '{"dateOfBirth":"1953-11-20"}')""")
        cur.execute("SELECT count(*) FROM public.resident_demographic_audit WHERE target_resident_id='synthetic-1'")
        assert cur.fetchone()[0] == 1
        cur.execute("SAVEPOINT bad_audit")
        try:
            cur.execute("""INSERT INTO public.resident_demographic_audit
            (event_type,target_resident_id,performed_by,performed_by_role,reason,previous_value,new_value)
            VALUES ('RESIDENT_DEMOGRAPHICS_CORRECTED','synthetic-2','ci-operator',
            'SUPERVISOR','bad','{}','{}')""")
            assert False,"reason constraint did not reject"
        except psycopg.errors.CheckViolation:
            cur.execute("ROLLBACK TO SAVEPOINT bad_audit")
        cur.execute("SELECT count(*) FROM public.resident_demographic_audit WHERE target_resident_id='synthetic-2'")
        assert cur.fetchone()[0] == 0
print("DOB_AUDIT_MIGRATION_SHA=PASS")
print("DOB_AUDIT_SCHEMA_IDEMPOTENCY=PASS")
print("DOB_AUDIT_WRITE_SYNTHETIC=PASS")
print("DOB_AUDIT_REASON_CHECK=PASS")
print("DOB_RC_E2E=NOT_EXECUTED")
print("OLD_API_NEW_SCHEMA=NOT_EXECUTED")
print("PRODUCTION_TEST=UNCHANGED")

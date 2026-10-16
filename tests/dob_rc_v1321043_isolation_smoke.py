"""V132.10.43 synthetic PostgreSQL isolation smoke; NOT DOB RC E2E."""
import os
import psycopg

assert os.environ.get("GITHUB_ACTIONS") == "true", "CI only"
host=os.environ.get("PGHOST")
name=os.environ.get("PGDATABASE")
assert host in ("127.0.0.1","localhost"), "Refuse remote database"
assert name == "dob_ci_synthetic", "Refuse non-fixture database"
assert os.environ.get("PGUSER") == "dob_ci"
assert os.environ.get("PGPASSWORD") == "synthetic-ci-only-not-production"
with psycopg.connect(host=host,port=5432,dbname=name,user="dob_ci",password="synthetic-ci-only-not-production",connect_timeout=5) as conn:
    with conn.cursor() as cur:
        cur.execute("CREATE TEMP TABLE synthetic_dob (resident_id int PRIMARY KEY, dob date NOT NULL)")
        cur.execute("INSERT INTO synthetic_dob VALUES (1, DATE '1953-11-20')")
        cur.execute("SAVEPOINT rollback_probe")
        cur.execute("UPDATE synthetic_dob SET dob=DATE '1954-11-20' WHERE resident_id=1")
        cur.execute("ROLLBACK TO SAVEPOINT rollback_probe")
        cur.execute("SELECT dob::text FROM synthetic_dob WHERE resident_id=1")
        assert cur.fetchone()[0] == "1953-11-20"
print("ISOLATED_POSTGRES_TRANSACTION_SMOKE=PASS")
print("RC_DOB_E2E=NOT_EXECUTED")
print("OLD_API_NEW_SCHEMA_ROLLBACK=NOT_EXECUTED")
print("PRODUCTION_ACCESS=NO")

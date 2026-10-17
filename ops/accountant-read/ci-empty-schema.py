#!/usr/bin/env python3
"""GitHub-hosted, zero-business-row schema validation. No SSH or Production access."""
import hashlib
import json
import os
import secrets
import subprocess
import time
from pathlib import Path

if os.environ.get('GITHUB_ACTIONS') != 'true' or os.environ.get('CI') != 'true':
    raise SystemExit('GITHUB_HOSTED_CI_ONLY')
ROOT = Path(__file__).resolve().parent
IMAGE = 'postgres@sha256:f1c3376c26f2609ab9f29f71f824103fe2fcd8ee0346485cb6122a4f93df6f94'
EXPECTED = {
    '001_finance_foundation.sql': '25c82188511752fea1d7659c4550d34e2ec30b593a4f36dfe74a561564955c61',
    '002_finance_transaction_safety.sql': 'b848f9440cccf5001741ec6f53d0da2dcc852a21fe53f446b3356ce9e7f8d8cf',
    '003_finance_allocation_invariants.sql': '80d1cea6b45e97446194e86f36bb69d8a4e0a0298c747dd17674dc7eb826e3b3',
    '004_finance_integrity_hardening.sql': '2c878dd909da82da56d27d5b83477d193152aaabdbfcb31b1ff35929e0209584',
}
for filename, expected in EXPECTED.items():
    if hashlib.sha256((ROOT / 'schema-reference' / filename).read_bytes()).hexdigest() != expected:
        raise SystemExit('SQL_HASH_MISMATCH: ' + filename)

def run(args, data=None, timeout=120):
    p = subprocess.run(args, input=data, capture_output=True, timeout=timeout)
    if p.returncode:
        raise RuntimeError('CI_LAB_COMMAND_FAILED: ' + args[0] + ' ' + args[1])
    return p.stdout.decode().strip()

name = 'accountant-empty-schema-' + secrets.token_hex(6)
created = False
results = {'commit': os.environ.get('GITHUB_SHA'), 'image': IMAGE,
           'scope': 'DDL and empty read syntax only; no business acceptance',
           'migrations': [], 'businessRowsCreated': 0, 'productionAccess': False}
try:
    run(['docker', 'pull', IMAGE])
    run(['docker', 'run', '-d', '--name', name, '--label', 'org.tamancare.purpose=ci-empty-schema',
         '--network', 'none', '--memory', '256m', '--memory-swap', '256m', '--pids-limit', '128',
         '--tmpfs', '/var/lib/postgresql/data:rw,size=134217728', '--env-file', '/dev/stdin',
         '-e', 'POSTGRES_DB=accountant_schema_lab', IMAGE,
         '-c', 'shared_buffers=16MB', '-c', 'max_connections=8'],
        ('POSTGRES_PASSWORD=' + secrets.token_urlsafe(32) + '\n').encode())
    created = True
    for attempt in range(40):
        try:
            run(['docker', 'exec', name, 'pg_isready', '-U', 'postgres', '-d', 'accountant_schema_lab'])
            break
        except RuntimeError:
            time.sleep(1)
    else:
        raise RuntimeError('POSTGRES_NOT_READY')
    psql = ['docker', 'exec', '-i', name, 'psql', '-X', '-v', 'ON_ERROR_STOP=1',
            '-U', 'postgres', '-d', 'accountant_schema_lab']
    for filename in EXPECTED:
        run(psql, (ROOT / 'schema-reference' / filename).read_bytes())
        results['migrations'].append({'file': filename, 'status': 'PASS'})
        print(filename + '=PASS', flush=True)
    run(psql, b'''BEGIN READ ONLY;
DO $$ BEGIN
IF EXISTS (SELECT 1 FROM billing_invoices) OR EXISTS (SELECT 1 FROM billing_receipts)
 OR EXISTS (SELECT 1 FROM billing_invoice_items) OR EXISTS (SELECT 1 FROM billing_payment_allocations)
 OR EXISTS (SELECT 1 FROM service_contract_records) OR EXISTS (SELECT 1 FROM finance_source_links)
 OR EXISTS (SELECT 1 FROM finance_operation_idempotency) OR EXISTS (SELECT 1 FROM finance_operation_audit)
 THEN RAISE EXCEPTION 'BUSINESS_TABLES_MUST_REMAIN_EMPTY'; END IF;
END $$;
SELECT i.invoice_id,i.invoice_code,i.resident_id,i.contract_id,i.billing_month,i.status,
 i.total_amount_vnd::text,COALESCE(SUM(a.amount_vnd),0)::text AS allocated_amount_vnd,
 (i.total_amount_vnd-COALESCE(SUM(a.amount_vnd),0))::text AS balance_vnd
 FROM billing_invoices i LEFT JOIN billing_payment_allocations a ON a.invoice_id=i.invoice_id
 WHERE i.billing_month=date_trunc('month',CURRENT_DATE)::date
 GROUP BY i.invoice_id,i.invoice_code,i.resident_id,i.contract_id,i.billing_month,i.status,i.total_amount_vnd
 ORDER BY i.invoice_code,i.invoice_id LIMIT 500;
SELECT receipt_id,receipt_code,resident_id,amount_vnd::text,received_date,status,external_reference,created_at
 FROM billing_receipts ORDER BY created_at DESC,receipt_id DESC LIMIT 100;
SELECT item_id,invoice_id,description,quantity::text,unit_price_vnd::text,line_total_vnd::text
 FROM billing_invoice_items ORDER BY item_id;
ROLLBACK;
''')
    results['emptyReadCompatibility'] = 'PASS'
    results['businessTablesRemainEmpty'] = 'PASS'
    print('EMPTY_SCHEMA_AND_ZERO_ROW_READS=PASS', flush=True)
finally:
    if created:
        run(['docker', 'rm', '-f', name])
        results['cleanup'] = 'PASS; disposable container removed; no named volumes'
    (ROOT / 'ci-empty-schema-result.json').write_text(json.dumps(results, indent=2) + '\n')

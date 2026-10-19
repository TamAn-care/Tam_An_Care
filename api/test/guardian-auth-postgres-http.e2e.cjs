'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { Pool } = require('pg');

const runId = String(process.env.GITHUB_RUN_ID || `local-${process.pid}`).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 50);
const ids = {
  guardian: `ci-guardian-${runId}`,
  login: `ci-guardian-${runId}@example.invalid`,
  resident: `ci-resident-${runId}`,
  otherResident: `ci-other-${runId}`,
  staff: `ci-staff-${runId}`,
  contract: `ci-contract-${runId}`,
  invoice: `ci-invoice-${runId}`,
  receipt: `ci-receipt-${runId}`,
};
const password = process.env.GUARDIAN_TEST_PASSWORD;
const apiBase = process.env.API_BASE_URL || 'http://127.0.0.1:3000';
if (!password || password.length < 16) throw new Error('SYNTHETIC_GUARDIAN_TEST_PASSWORD_REQUIRED');

function pool() {
  return new Pool({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    max: 2,
    connectionTimeoutMillis: 5000,
  });
}

function makeCredential(secret, saltBytes = 24) {
  const salt = crypto.randomBytes(saltBytes).toString('hex');
  const iterations = 210000;
  const hash = crypto.pbkdf2Sync(secret, salt, iterations, 32, 'sha256').toString('hex');
  return { salt, iterations, hash };
}

async function seed() {
  const db = pool();
  const client = await db.connect();
  const credential = makeCredential(password);
  const staffCredential = makeCredential(`${password}-staff`);
  const hash = 'a'.repeat(64);
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO residents(resident_id,resident_code,display_name,date_of_birth,gender,care_level,active_status)
       VALUES($1,$3,'Synthetic Guardian Resident',DATE '1940-01-01','UNSPECIFIED','ASSISTED',true),
             ($2,$4,'Synthetic Unlinked Resident',DATE '1941-01-01','UNSPECIFIED','ASSISTED',true)`,
      [ids.resident, ids.otherResident, `${ids.resident}-code`, `${ids.otherResident}-code`],
    );
    await client.query(
      `INSERT INTO guardian_identities(guardian_id,login_id,display_name,status)
       VALUES($1,$2,'Synthetic Guardian','ACTIVE')`, [ids.guardian,ids.login],
    );
    await client.query(
      `INSERT INTO guardian_credentials(guardian_id,password_hash,password_salt,password_iterations,password_digest)
       VALUES($1,$2,$3,$4,'sha256')`, [ids.guardian,credential.hash,credential.salt,credential.iterations],
    );
    await client.query(
      `INSERT INTO guardian_resident_links(guardian_resident_link_id,guardian_id,resident_id,status,effective_from,granted_by)
       VALUES($1,$2,$3,'ACTIVE',now()-interval '1 day','synthetic-supervisor')`,
      [`ci-link-${runId}`,ids.guardian,ids.resident],
    );
    await client.query(
      `INSERT INTO service_price_lists(price_list_id,code,name,created_by)
       VALUES($1,$2,'Synthetic family meal prices','synthetic-pricer')`,
      [`ci-price-list-${runId}`,`CI-FAMILY-MEAL-${runId}`],
    );
    await client.query(
      `INSERT INTO service_price_list_versions(price_list_id,version,status,effective_from,items,created_by,decided_by,decided_at,decision_reason)
       VALUES($1,1,'APPROVED',DATE '2026-10-01',
         '[{"serviceCode":"FAMILY_EXTRA_MEAL","name":"Synthetic family meal","scope":"MEAL","unit":"MEAL","amountVnd":"5000"}]'::jsonb,
         'synthetic-pricer','synthetic-approver',now(),'Synthetic isolated E2E rate')`,
      [`ci-price-list-${runId}`],
    );
    await client.query(
      `INSERT INTO staff_actors(actor_id,staff_code,display_name,primary_operational_role,status)
       VALUES($1,$1,'Synthetic Supervisor','SUPERVISOR','ACTIVE')`, [ids.staff],
    );
    await client.query(
      `INSERT INTO auth_credentials(actor_id,password_hash,password_salt,password_iterations,password_digest)
       VALUES($1,$2,$3,$4,'sha256')`, [ids.staff,staffCredential.hash,staffCredential.salt,staffCredential.iterations],
    );
    await client.query(
      `INSERT INTO service_contract_records(contract_id,contract_code,resident_id,status,effective_date,payload,version)
       VALUES($1,$1,$2,'ACTIVE',DATE '2026-10-01','{}'::jsonb,1)`, [ids.contract,ids.resident],
    );
    await client.query(
      `INSERT INTO service_contract_versions(contract_id,version,payload,status,effective_date,signed_at,approved_at,approved_by,change_reason)
       VALUES($1,1,'{}'::jsonb,'ACTIVE',DATE '2026-10-01',now()-interval '2 days',now()-interval '1 day','synthetic-approver','Synthetic approved package contract')`, [ids.contract],
    );
    await client.query(
      `INSERT INTO service_contract_signing_evidence(contract_id,version,document_sha256,document_reference,signing_method,verified_by,signed_at)
       VALUES($1,1,$2,'synthetic-contract-document','EXTERNAL_VERIFIED','synthetic-verifier',now()-interval '2 days')`, [ids.contract,hash],
    );
    await client.query(
      `INSERT INTO service_contract_approval_decisions(contract_id,version,approved_by,approval_reason,approved_sha256,admission_care_level,room_id,bed_id,monthly_fee_vnd)
       VALUES($1,1,'synthetic-approver','Approved synthetic package for isolated authentication and notice acceptance',$2,'ASSISTED','synthetic-room','synthetic-bed',10000)`, [ids.contract,hash],
    );
    await client.query(
      `INSERT INTO billing_invoices(invoice_id,invoice_code,resident_id,contract_id,billing_month,status,total_amount_vnd,contract_version)
       VALUES($1,$1,$2,$3,DATE '2026-10-01','DRAFT',10000,1)`, [ids.invoice,ids.resident,ids.contract],
    );
    await client.query(
      `INSERT INTO billing_invoice_items(item_id,invoice_id,description,quantity,unit_price_vnd,line_total_vnd,line_kind,service_period_start,service_period_end,financial_origin_key)
       VALUES($1,$2,'Synthetic contract package',1,10000,10000,'CONTRACT_FEE',DATE '2026-10-01',DATE '2026-11-01',$3)`,
      [`ci-item-${runId}`,ids.invoice,`ci:contract:fee:${runId}`],
    );
    await client.query(
      `UPDATE billing_invoices SET status='APPROVED',prepared_by='synthetic-maker',reviewed_by='synthetic-reviewer',
          approved_by='synthetic-approver',approved_at=now(),approval_evidence_sha256=$2 WHERE invoice_id=$1`, [ids.invoice,hash],
    );
    await client.query(`UPDATE billing_invoices SET status='ISSUED' WHERE invoice_id=$1`, [ids.invoice]);
    await client.query(
      `INSERT INTO billing_receipts(receipt_id,receipt_code,resident_id,amount_vnd,received_date,status)
       VALUES($1,$1,$2,2500,DATE '2026-10-10','CONFIRMED')`, [ids.receipt,ids.resident],
    );
    await client.query(
      `INSERT INTO billing_payment_allocations(allocation_id,receipt_id,invoice_id,amount_vnd)
       VALUES($1,$2,$3,2500)`, [`ci-allocation-${runId}`,ids.receipt,ids.invoice],
    );
    await client.query('COMMIT');
    process.stdout.write('GUARDIAN_SYNTHETIC_FIXTURES=READY\n');
  } catch (error) {
    await client.query('ROLLBACK');
    process.stderr.write(`GUARDIAN_FIXTURE_SETUP_FAILED=${error.code || error.name || 'Error'}\n`);
    throw error;
  } finally {
    client.release();
    await db.end();
  }
}

async function request(path, token, options = {}) {
  return fetch(`${apiBase}${path}`, {
    ...options,
    headers: {
      ...(options.headers || {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
  });
}

async function login(loginId, pass) {
  return request('/api/auth/guardian/login', null, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ loginId, password: pass }),
  });
}

async function supervisorLogin() {
  return request('/api/auth/login', null, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ actorId: ids.staff, password: `${password}-staff` }),
  });
}

async function verify() {
  const db = pool();
  try {
    const wrong = await login(ids.login,'wrong synthetic password');
    assert.equal(wrong.status,401,'invalid Guardian credentials must fail');
    const auth = await login(ids.login,password);
    assert.equal(auth.status,200,'Guardian login must authenticate via separate identity tables');
    const data = await auth.json();
    assert.equal(data.actor.actorRole,'GUARDIAN');
    assert.equal(data.actor.actorId,ids.guardian);
    const token = data.accessToken;

    const registeredMeal = await request('/api/nutrition/family-meals', token, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ residentId: ids.resident, serviceDate: '2026-11-02', mealType: 'LUNCH', quantity: 2, idempotencyKey: `ci-family-meal-${runId}-booking-key` }),
    });
    assert.equal(registeredMeal.status, 201, 'Guardian may register an extra family meal for a linked resident');
    const registeredMealBody = await registeredMeal.json();
    assert.equal(registeredMealBody.status, 'REGISTERED');
    assert.equal(registeredMealBody.confirmedQuantity, null);

    const staffAuth = await supervisorLogin();
    assert.equal(staffAuth.status, 200);
    const staffToken = (await staffAuth.json()).accessToken;
    const confirmation = await request(`/api/nutrition/family-meals/${registeredMealBody.orderId}/confirm`, staffToken, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ quantity: 2, reason: 'Synthetic verified service for isolated E2E' }),
    });
    assert.equal(confirmation.status, 201, 'active supervisor may confirm the registered service and approved rate');
    assert.equal((await confirmation.json()).amountVnd, '10000');
    const billingDraft = await request('/api/finance-write/invoices/drafts/family-meals', staffToken, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ residentId: ids.resident, billingMonth: '2026-11' }),
    });
    assert.equal(billingDraft.status, 201, 'Finance must create a database-backed monthly draft from the confirmed source');
    const draftBody = await billingDraft.json();
    assert.equal(draftBody.packageFeeVnd, '10000');
    assert.equal(draftBody.familyMealTotalVnd, '10000');
    assert.equal(draftBody.totalAmountVnd, '20000');
    assert.equal(draftBody.familyMeals.length, 1);
    assert.equal(draftBody.familyMeals[0].serviceCode, 'FAMILY_EXTRA_MEAL');
    assert.equal(draftBody.residentMealsIncludedInPackage, true);
    const draftLines = await db.query(
      `SELECT count(*) FILTER (WHERE source_entity_type='FAMILY_EXTRA_MEAL')::int AS family_lines,
              count(*) FILTER (WHERE line_kind='CONTRACT_FEE')::int AS package_lines,
              sum(line_total_vnd)::text AS total
         FROM billing_invoice_items WHERE invoice_id=$1`, [draftBody.invoiceId],
    );
    assert.deepEqual(draftLines.rows[0], { family_lines: 1, package_lines: 1, total: '20000' });

    const idsResponse = await request('/api/family-portal/residents/ids',token);
    assert.equal(idsResponse.status,200);
    assert.deepEqual((await idsResponse.json()).residentIds,[ids.resident]);
    const listResponse = await request('/api/family-portal/residents',token);
    assert.equal(listResponse.status,200);
    const residentList = await listResponse.json();
    assert.deepEqual(residentList.map(item => item.resident.residentId),[ids.resident]);
    assert.equal((await request(`/api/family-portal/residents/${ids.resident}`,token)).status,200);
    assert.equal((await request(`/api/family-portal/residents/${ids.otherResident}`,token,{headers:{'x-actor-id':ids.guardian,'x-actor-role':'SUPERVISOR'}})).status,403,
      'forged staff headers cannot widen Guardian resident scope');
    assert.equal((await request('/api/residents',token)).status,403,'Guardian cannot enter staff resident-list route');
    assert.equal((await request(`/api/finance-read/residents/${ids.otherResident}/payment-notices/2026-10`,token)).status,403);
    const noticeResponse = await request(`/api/finance-read/residents/${ids.resident}/payment-notices/2026-10`,token);
    assert.equal(noticeResponse.status,200);
    const noticeBody = await noticeResponse.json();
    assert.equal(noticeBody.notices.length,1);
    assert.equal(noticeBody.notices[0].total_amount_vnd,'10000');
    assert.equal(noticeBody.notices[0].allocated_amount_vnd,'2500');
    assert.equal(noticeBody.notices[0].balance_vnd,'7500');
    assert.equal(noticeBody.notices[0].source_snapshot.residentMealPolicy.separatelyBillable,false);
    assert.deepEqual(noticeBody.notices[0].source_snapshot.familyExtraMeals,[]);
    const draftNotice = await request(`/api/finance-read/residents/${ids.resident}/payment-notices/2026-11`,token);
    assert.equal(draftNotice.status,200);
    assert.deepEqual((await draftNotice.json()).notices,[], 'Guardian must not see a DRAFT invoice as a finalized payment notice');
    assert.equal((await request('/api/finance-write/invoices/issue',token,{method:'POST'})).status,403,
      'Guardian cannot mutate payment state');

    const snapshotMutation = await db.query(
      `UPDATE billing_invoices SET source_snapshot=source_snapshot || '{"tampered":true}'::jsonb WHERE invoice_id=$1`, [ids.invoice],
    ).then(() => false, () => true);
    assert.equal(snapshotMutation,true,'issued invoice snapshot must be immutable in PostgreSQL');
    assert.equal((await request('/api/family-portal/residents',staffToken)).status,403,
      'staff principal cannot use Guardian family route');
    const separate = await db.query(
      `SELECT (SELECT count(*) FROM staff_actors WHERE actor_id=$1)::int AS staff_count,
              (SELECT count(*) FROM auth_sessions WHERE actor_id=$1 AND actor_role='GUARDIAN')::int AS staff_guardian_sessions,
              (SELECT count(*) FROM guardian_sessions WHERE guardian_id=$1 AND revoked_at IS NULL)::int AS guardian_sessions`,
      [ids.guardian],
    );
    assert.deepEqual(separate.rows[0],{staff_count:0,staff_guardian_sessions:0,guardian_sessions:1});

    const logout = await request('/api/auth/logout',token,{method:'POST'});
    assert.equal(logout.status,204);
    assert.equal((await request('/api/family-portal/residents/ids',token)).status,401,
      'revoked Guardian session must be denied');
    const expiredLogin = await login(ids.login,password);
    assert.equal(expiredLogin.status,200);
    const expiredToken = (await expiredLogin.json()).accessToken;
    const claims = JSON.parse(Buffer.from(expiredToken.split('.')[1],'base64url').toString('utf8'));
    await db.query(`UPDATE guardian_sessions SET expires_at=now()-interval '1 minute' WHERE session_id=$1`,[claims.jti]);
    assert.equal((await request('/api/family-portal/residents/ids',expiredToken)).status,401,
      'expired Guardian session must be denied');
    await db.query(`UPDATE guardian_identities SET status='SUSPENDED' WHERE guardian_id=$1`,[ids.guardian]);
    assert.equal((await request('/api/family-portal/residents/ids',expiredToken)).status,401,
      'inactive Guardian principal must be denied');
    assert.equal((await login(ids.login,password)).status,401);
    await db.query(`UPDATE guardian_identities SET status='ACTIVE' WHERE guardian_id=$1`,[ids.guardian]);
    process.stdout.write('GUARDIAN_AUTH_POSTGRES_HTTP=PASS resident_scope=PASS notice_snapshot=PASS staff_separation=PASS revocation_expiry=PASS mutation_denial=PASS\n');
  } finally {
    await db.end();
  }
}

if (process.argv[2] === 'seed') seed().catch(() => { process.exitCode = 1; });
else if (process.argv[2] === 'verify') verify().catch(error => {
  process.stderr.write(`GUARDIAN_HTTP_E2E_FAILED=${error.code || error.name || 'AssertionError'}\n`);
  if (error.name === 'AssertionError') {
    const detail = {
      operator: typeof error.operator === 'string' ? error.operator : undefined,
      expected: error.expected,
      actual: error.actual,
      message: String(error.message || '').replace(/Bearer\s+\S+/gi, 'Bearer [REDACTED]')
        .replace(/(password|token|secret)[^\n]*/gi, '$1 [REDACTED]').slice(0, 1200),
      stack: String(error.stack || '').split('\n').slice(0, 5).join('\n'),
    };
    process.stderr.write(`GUARDIAN_HTTP_E2E_ASSERTION=${JSON.stringify(detail)}\n`);
  }
  process.exitCode = 1;
});
else throw new Error('Use seed or verify');

'use strict';
const assert = require('node:assert/strict');
const { Client } = require('pg');
const { ForbiddenException } = require('@nestjs/common');
const { ResidentDemographicAmendmentController } = require('../dist/residents/resident-demographic-amendment.controller');
const { DatabaseService } = require('../dist/database/database.service');

async function main() {
  assert.equal(process.env.GITHUB_ACTIONS, 'true');
  assert.equal(process.env.PGHOST, '127.0.0.1');
  assert.equal(process.env.PGDATABASE, 'dob_ci_synthetic');
  assert.equal(process.env.PGUSER, 'dob_ci');
  assert.equal(process.env.PGPASSWORD, 'synthetic-ci-only-not-production');
  const conn = new Client({
    host:'127.0.0.1', user:'dob_ci', database:'dob_ci_synthetic',
    password:'synthetic-ci-only-not-production', port:5432
  });
  await conn.connect();
  try {
    await conn.query(`CREATE TABLE residents (
      resident_id text PRIMARY KEY, date_of_birth date NOT NULL,
      birth_year integer NOT NULL, birth_date_precision text NOT NULL DEFAULT 'FULL',
      updated_at timestamptz NOT NULL DEFAULT NOW()
    )`);
    await conn.query(`CREATE TABLE admission_cases (
      admission_case_id text PRIMARY KEY, resident_id text UNIQUE,
      date_of_birth date NOT NULL, birth_year integer NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT NOW(),
      record_version integer NOT NULL DEFAULT 1
    )`);
    await conn.query(`CREATE TABLE admission_audit (
      id bigserial PRIMARY KEY, admission_case_id text NOT NULL,
      event_type text NOT NULL, actor_id text NOT NULL,
      actor_role text NOT NULL, entity_type text NOT NULL,
      entity_id text NOT NULL, reason text NOT NULL,
      previous_state jsonb NOT NULL, new_state jsonb NOT NULL
    )`);
    const fs = require('node:fs');
    const crypto = require('node:crypto');
    const raw=fs.readFileSync('migrations/001_resident_demographic_audit.sql');
    assert.equal(crypto.createHash('sha256').update(raw).digest('hex'),
      '42cdf18b1cb2730e170ec06127ba237cfb0666d5c07f30c97b3d1776fb4e60ee');
    await conn.query(raw.toString());
    await conn.query(`INSERT INTO residents
      (resident_id,date_of_birth,birth_year,updated_at)
      VALUES ('synthetic-resident',DATE '1954-11-20',1954,
        '2026-10-01T10:00:00Z')`);
    await conn.query(`INSERT INTO admission_cases
      (admission_case_id,resident_id,date_of_birth,birth_year)
      VALUES ('synthetic-case','synthetic-resident',DATE '1954-11-20',1954)`);
    const db = new DatabaseService();
    const auth = {
      async authorizeSupervisor(id, role) {
        if (id !== 'synthetic-supervisor' || role !== 'SUPERVISOR')
          throw new ForbiddenException('Not authorized');
      }
    };
    const controller = new ResidentDemographicAmendmentController(db,auth);
    try {
      const ctx = await controller.editContext(
        'synthetic-resident','synthetic-supervisor','SUPERVISOR');
      assert(ctx.revision);
      await assert.rejects(
        controller.amend('synthetic-resident','wrong-user','CAREGIVER',
          {expectedRevision:ctx.revision,dateOfBirth:'1953-11-20',reason:'Synthetic test correction'}),
        e=>e.status===403);
      console.log('E2E_403=PASS');
      for (const invalidDate of ['2035-01-01', '1953-02-30', 'wrong']) {
        await assert.rejects(controller.amend(
          'synthetic-resident', 'synthetic-supervisor', 'SUPERVISOR',
          { expectedRevision:ctx.revision, dateOfBirth:invalidDate,
            reason:'Synthetic invalid date rejection test' }),
          e=>e.status===400);
      }
      await assert.rejects(controller.amend(
        'synthetic-resident', 'synthetic-supervisor', 'SUPERVISOR',
        { expectedRevision:ctx.revision, dateOfBirth:'1953-11-20',
          reason:'short' }), e=>e.status===400);
      console.log('E2E_INVALID_FUTURE_DATE_AND_REASON=PASS');
      const ok = await controller.amend('synthetic-resident',
        'synthetic-supervisor','SUPERVISOR',
        {expectedRevision:ctx.revision,dateOfBirth:'1953-11-20',
         reason:'Synthetic DOB correction in isolated runner'});
      assert.equal(ok.changed,true);
      const q = await conn.query(`SELECT r.date_of_birth::text resident_dob,
       a.date_of_birth::text admission_dob
       FROM residents r JOIN admission_cases a USING(resident_id)
       WHERE r.resident_id='synthetic-resident'`);
      assert.equal(q.rows[0].resident_dob,'1953-11-20');
      assert.equal(q.rows[0].admission_dob,'1953-11-20');
      const audit=await conn.query(`SELECT
        (SELECT count(*) FROM resident_demographic_audit) resident_count,
        (SELECT count(*) FROM admission_audit) admission_count`);
      assert.equal(Number(audit.rows[0].resident_count),1);
      assert.equal(Number(audit.rows[0].admission_count),1);
      console.log('E2E_200_SYNC_DUAL_AUDIT=PASS');
      await assert.rejects(
        controller.amend('synthetic-resident','synthetic-supervisor','SUPERVISOR',
          {expectedRevision:ctx.revision,dateOfBirth:'1952-11-20',
           reason:'Synthetic stale version testing'}),
        e=>e.status===409);
      console.log('E2E_409=PASS');
      const latest=await controller.editContext(
        'synthetic-resident','synthetic-supervisor','SUPERVISOR');
      await conn.query(`CREATE FUNCTION ci_reject_admission_audit() RETURNS trigger
        LANGUAGE plpgsql AS $q$ BEGIN RAISE EXCEPTION 'synthetic audit failure'; END $q$`);
      await conn.query(`CREATE TRIGGER ci_block_insert BEFORE INSERT ON admission_audit
        FOR EACH ROW EXECUTE FUNCTION ci_reject_admission_audit()`);
      await assert.rejects(controller.amend(
        'synthetic-resident','synthetic-supervisor','SUPERVISOR',
        {expectedRevision:latest.revision,dateOfBirth:'1951-11-20',
         reason:'Synthetic forced audit failure'}));
      const after=await conn.query(`SELECT date_of_birth::text AS dob
          FROM residents WHERE resident_id='synthetic-resident'`);
      assert.equal(after.rows[0].dob,'1953-11-20');
      console.log('E2E_AUDIT_FAILURE_TRANSACTION_ROLLBACK=PASS');
    } finally { await db.onModuleDestroy(); }
  } finally { await conn.end(); }
  console.log('LIVE_PRODUCTION_ACCESS=NO');
}
main().catch(e=>{console.error('ISOLATED_E2E_FAILED',e.message);process.exitCode=1});

'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {Client}=require('../legacy/api/node_modules/pg');
const {DatabaseService}=require('../legacy/api/dist/database/database.service');
const {ResidentRepository}=require('../legacy/api/dist/residents/resident.repository');
(async()=>{
 assert.equal(process.env.GITHUB_ACTIONS,'true');
 assert.equal(process.env.DB_HOST,'127.0.0.1');
 assert.equal(process.env.DB_NAME,'dob_ci_synthetic');
 const db=new Client({host:'127.0.0.1',database:'dob_ci_synthetic',
   user:'dob_ci',password:'synthetic-ci-only-not-production'});
 await db.connect();
 try {
   await db.query(`CREATE TABLE residents (
       resident_id text PRIMARY KEY,
       resident_code text NOT NULL,
       display_name text NOT NULL,
       date_of_birth date NOT NULL,
       gender text NOT NULL,
       room text, bed text, care_level text NOT NULL,
       active_status boolean NOT NULL
   )`);
   await db.query(`INSERT INTO residents VALUES
    ('synthetic-id','CI001','Synthetic Resident','1953-11-20',
    'MALE',NULL,NULL,'STANDARD',true)`);
   const mig=fs.readFileSync('api/migrations/001_resident_demographic_audit.sql','utf8');
   await db.query(mig);
   const legacy=new DatabaseService();
   try {
     const repo=new ResidentRepository(legacy);
     const all=await repo.list();
     assert.equal(all.length,1);
     const page=await repo.listPage(10,0);
     assert.equal(page.total,1);
     assert.equal(page.items.length,1);
     const resident=await repo.findById('synthetic-id');
     assert(resident);
     console.log('OLD_API_REPOSITORY_LIST_AFTER_NEW_SCHEMA=PASS');
     console.log('OLD_API_REPOSITORY_PAGINATION_AFTER_NEW_SCHEMA=PASS');
     console.log('OLD_API_REPOSITORY_DETAIL_AFTER_NEW_SCHEMA=PASS');
   } finally {await legacy.onModuleDestroy();}
 } finally {await db.end();}
 console.log('OLD_API_FULL_HTTP_COMPATIBILITY=HOLD');
 console.log('OLD_API_NEW_SCHEMA_ROLLBACK_CERTIFIED=NO');
 console.log('PRODUCTION_DEPLOY=NO');
})().catch(e=>{console.error('LEGACY_COMPAT_TEST_FAILED',e.message);process.exitCode=1});

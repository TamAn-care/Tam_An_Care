'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const {Pool}=require('../../api/node_modules/pg');
function locate(folder,needle){for(const d of fs.readdirSync(folder,{withFileTypes:true})){const p=path.join(folder,d.name);if(d.isDirectory()){const r=locate(p,needle);if(r)return r;}else if(d.name===needle)return p;}}
const dist=path.join(__dirname,'../../api/dist');
const controllerFile=locate(dist,'contract-signoff.controller.js');
const identityFile=locate(dist,'verified-finance-identity.js');
const original=Module._load;
Module._load=function(q,parent,main){if(q==='../database/database.service'&&parent?.filename===controllerFile)return {DatabaseService:class{}};return original.apply(this,arguments);};
let Controller;try{Controller=require(controllerFile).ContractSignoffController;}finally{Module._load=original;}
const {publishVerifiedFinanceIdentity}=require(identityFile);
process.env.TAMANCARE_CONTRACT_SIGNOFF_ENABLED='true';
process.env.TAMANCARE_CONTRACT_SIGNATURE_VERIFY_ROLES='CARE_MANAGER';
process.env.TAMANCARE_CONTRACT_APPROVER_ROLES='SUPERVISOR';
const actor=(actorId,actorRole,sessionId)=>{
 const req={};publishVerifiedFinanceIdentity(req,{actorId,actorRole,sessionId});return req;
};
async function main(){
 const pool=new Pool();
 const db={
  query:(sql,args)=>pool.query(sql,args),
  withTransaction:async(fn)=>{
   const client=await pool.connect();
   try{
    await client.query('BEGIN');
    const result=await fn(client);
    await client.query('COMMIT');
    return result;
   }catch(e){await client.query('ROLLBACK');throw e;}
   finally{client.release();}
  },
 };
 const controller=new Controller(db);
 const verifier=actor('CI_VERIFY','CARE_MANAGER','CI_VERIFY_SESSION');
 const approver=actor('CI_APPROVE','SUPERVISOR','CI_APPROVE_SESSION');
 const signature={documentSha256:'a'.repeat(64),documentReference:'ci_store/contract_1',
 signingMethod:'SIGNED_PAPER_ARCHIVED',signedAt:'2026-10-01T09:00:00Z'};
 try{
  await assert.rejects(controller.approve(approver,'CI_SIGNOFF','1',{approvalReason:'CI authorized director approval'}));
  const noApproval=await pool.query("SELECT count(*)::int AS n FROM public.service_contract_approval_decisions WHERE contract_id='CI_SIGNOFF'");
  assert.equal(noApproval.rows[0].n,0);
  await controller.verifySignature(verifier,'CI_SIGNOFF','1',signature);
  const result=await controller.approve(approver,'CI_SIGNOFF','1',{approvalReason:'CI authorized director approval'});
  assert.equal(result.status,'ACTIVE');
  assert.equal(result.approvedMonthlyVnd,'120');
  const state=await pool.query(`SELECT v.status,v.approved_by,a.monthly_fee_vnd::text AS monthly
   FROM public.service_contract_versions v
   JOIN public.service_contract_approval_decisions a
    ON a.contract_id=v.contract_id AND a.version=v.version
   WHERE v.contract_id='CI_SIGNOFF'`);
  assert.equal(state.rows.length,1);
  assert.equal(state.rows[0].status,'ACTIVE');
  assert.equal(state.rows[0].approved_by,'CI_APPROVE');
  assert.equal(state.rows[0].monthly,'120.00');
  await assert.rejects(controller.approve(approver,'CI_SIGNOFF','1',{approvalReason:'CI duplicate approval attempt'}));
  const count=await pool.query("SELECT count(*)::int AS n FROM public.service_contract_approval_decisions WHERE contract_id='CI_SIGNOFF'");
  assert.equal(count.rows[0].n,1);
  console.log('CONTRACT_REAL_POSTGRES_SIGNOFF_ADMISSION_BED_APPROVAL_PASS');
 }finally{await pool.end();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});

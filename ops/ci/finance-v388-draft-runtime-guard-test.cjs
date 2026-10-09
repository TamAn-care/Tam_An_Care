'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const root=path.resolve(__dirname,'../../api/dist');
function locate(name){let a=[];const walk=d=>{for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory())walk(p);else if(e.name===name)a.push(p)}};walk(root);assert.equal(a.length,1);return a[0]}
const file=locate('finance-draft-persistence-lab.js'),old=Module._load;
Module._load=function(id,parent,main){if(parent?.filename===file&&id==='../database/database.service')return {DatabaseService:class{}};if(parent?.filename===file&&id==='./finance-document-authorization.service')return {FinanceDocumentAuthorizationService:class{}};return old.apply(this,arguments)};
let Lab;try{Lab=require(file).FinanceDraftPersistenceLab}finally{Module._load=old}
async function main(){
let writes=0;
const db={query:()=>{writes++;throw Error('UNEXPECTED_QUERY')},withTransaction:()=>{writes++;throw Error('UNEXPECTED_TRANSACTION')}};
const auth={authorize:async()=>({actorId:'MAKER',actorRole:'FINANCE_PREPARER',sessionId:'CI'})};
const lab=new Lab(db,auth);
const d={documentId:'D1',sourceDomain:'SERVICE',sourceEntityType:'INVOICE',sourceEntityId:'S1',entryType:'REVENUE',recognitionDate:'2026-09-15',amountVnd:'100',externalEvidenceDigest:'a'.repeat(64),referenceNumber:'R1'};
await assert.rejects(lab.createDraft({},d),/FINANCE_DOCUMENT_PERSISTENCE_NOT_AUTHORIZED/);
await assert.rejects(lab.createDraft({},{...d,actorRole:'ADMIN'}),/FINANCE_DOCUMENT_INPUT_INVALID/);
assert.equal(writes,0);
assert.match(Lab.ciInsertSql(),/RETURNING document_id,revision,state/);
assert.equal((Lab.ciInsertSql().match(/\$[0-9]+/g)||[]).length,10);
console.log('FINANCE_V388_DRAFT_RUNTIME_WRITE_DISABLED_PASS');
}
main().catch(e=>{console.error(e);process.exitCode=1});

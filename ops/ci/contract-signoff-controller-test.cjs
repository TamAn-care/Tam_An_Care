'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
function find(dir,name){for(const v of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,v.name);if(v.isDirectory()){const q=find(p,name);if(q)return q;}else if(v.name===name)return p;}}
const dist=path.join(__dirname,'../../api/dist');
const source=find(dist,'contract-signoff.controller.js'), identity=find(dist,'verified-finance-identity.js');
assert.ok(source&&identity);
const old=Module._load;Module._load=function(id,parent,isMain){if(id==='../database/database.service'&&parent?.filename===source)return {DatabaseService:class{}};return old.apply(this,arguments);};
let Controller;try{Controller=require(source).ContractSignoffController;}finally{Module._load=old;}
const {publishVerifiedFinanceIdentity}=require(identity);
const actor={actorId:'DIRECTOR',actorRole:'SUPERVISOR',sessionId:'SESSION'};
const makeReq=()=>{const req={};publishVerifiedFinanceIdentity(req,actor);return req;};
const inserts=[];
const contract={payload:{appendix:{baseMonthlyFee:100,additionalServices:[{name:'CI_SERVICE',fee:30,selected:true}],discount:10,totalMonthlyFee:120},
operationalRefs:{roomId:'CI_ROOM',bedId:'CI_BED',careLevel:'ASSISTED'}},effective_date:'2026-10-01'};
const client={query:async(sql,values)=>{inserts.push(sql);
 if(sql.includes('FROM public.service_contract_records'))return {rows:[{contract_id:'CI_C',resident_id:'CI_R'}]};
 if(sql.includes('FROM public.service_contract_versions'))return {rows:[{...contract,status:'DRAFT',version:1}]};
 if(sql.includes('FROM public.service_contract_signing_evidence'))return {rows:[{verified_by:'OTHER_STAFF',signed_at:'2026-10-08T12:00:00Z',document_sha256:'a'.repeat(64)}]};
 if(sql.includes('FROM public.residents r'))return {rows:[{care_level:'ASSISTED',approved_care_level:'ASSISTED',room_id:'CI_ROOM',bed_id:'CI_BED'}]};
 return {rows:[],rowCount:1};}};
const db={query:async()=>({rows:[{actor_id:'DIRECTOR'}]}),withTransaction:async(fn)=>fn(client)};
const ctl=new Controller(db);
(async()=>{
 delete process.env.TAMANCARE_CONTRACT_SIGNOFF_ENABLED;
 const os=require('node:os'),crypto=require('node:crypto');
const archive=fs.mkdtempSync(path.join(os.tmpdir(),'contract-ci-archive-'));
fs.mkdirSync(path.join(archive,'docs'));
const pdf=Buffer.from('%PDF-1.4\\n1 0 obj<<>>endobj\\n%%EOF\\n');
fs.writeFileSync(path.join(archive,'docs','ci-contract.pdf'),pdf);
process.env.TAMANCARE_CONTRACT_ARCHIVE_ROOT=archive;
const pdfHash=crypto.createHash('sha256').update(pdf).digest('hex');
const signature={documentSha256:pdfHash,documentReference:'docs/ci-contract.pdf',signingMethod:'SIGNED_PAPER_ARCHIVED',signedAt:'2026-10-08T12:00:00Z'};
 await assert.rejects(ctl.verifySignature(makeReq(),'CI_C','1',signature),e=>e.status===403);
 assert.equal(inserts.length,0);
 process.env.TAMANCARE_CONTRACT_SIGNOFF_ENABLED='true';
 process.env.TAMANCARE_CONTRACT_SIGNATURE_VERIFY_ROLES='SUPERVISOR';
 process.env.TAMANCARE_CONTRACT_APPROVER_ROLES='SUPERVISOR';
 await assert.rejects(ctl.verifySignature({},'CI_C','1',signature),e=>e.status===403);
 const signed=await ctl.verifySignature(makeReq(),'CI_C','1',signature);
 assert.equal(signed.signedContractActivated,false);
 const approved=await ctl.approve(makeReq(),'CI_C','1',{approvalReason:'CI director approval documentation'});
 assert.equal(approved.status,'ACTIVE');assert.equal(approved.approvedMonthlyVnd,'120');
 assert.ok(inserts.some(q=>q.includes('INSERT INTO public.service_contract_signing_evidence')));
 assert.ok(inserts.some(q=>q.includes('INSERT INTO public.service_contract_approval_decisions')));
 assert.ok(inserts.some(q=>q.includes("status='SUPERSEDED'")));
 console.log('CONTRACT_SIGNOFF_INDEPENDENT_APPROVAL_GUARD_PASS');
})().catch(e=>{console.error(e);process.exitCode=1});

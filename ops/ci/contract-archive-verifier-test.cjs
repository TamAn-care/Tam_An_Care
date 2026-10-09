'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'contracts-verifier-ci-'));
const inside=path.join(root,'archive');
fs.mkdirSync(inside);
const pdf=Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\n%%EOF\n');
fs.writeFileSync(path.join(inside,'signed.pdf'),pdf);
const hash=crypto.createHash('sha256').update(pdf).digest('hex');
const files=(dir,name)=>{for(const d of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,d.name);if(d.isDirectory()){const k=files(p,name);if(k)return k;}else if(d.name===name)return p;}};
const compiled=files(path.resolve(__dirname,'../../api/dist'),'contract-archive-verifier.js');
assert.ok(compiled,'Missing built contract archive verifier');
const {verifyArchivedContractPdf:verify}=require(compiled);
(async()=>{
 const old=process.env.TAMANCARE_CONTRACT_ARCHIVE_ROOT;
 try {
  delete process.env.TAMANCARE_CONTRACT_ARCHIVE_ROOT;
  await assert.rejects(verify('signed.pdf',hash),/CONTRACT_ARCHIVE_ROOT_UNCONFIGURED/);
  process.env.TAMANCARE_CONTRACT_ARCHIVE_ROOT=inside;
  assert.equal((await verify('signed.pdf',hash)).sha256,hash);
  await assert.rejects(verify('signed.pdf','0'.repeat(64)),/CONTRACT_ARCHIVE_HASH_MISMATCH/);
  await assert.rejects(verify('../signed.pdf',hash),/CONTRACT_ARCHIVE_REFERENCE_INVALID/);
  await assert.rejects(verify('/etc/passwd',hash),/CONTRACT_ARCHIVE_REFERENCE_INVALID/);
  const outside=path.join(root,'outside.pdf');fs.writeFileSync(outside,pdf);
  fs.symlinkSync(outside,path.join(inside,'link.pdf'));
  await assert.rejects(verify('link.pdf',hash),/CONTRACT_ARCHIVE_PATH_ESCAPE/);
  fs.writeFileSync(path.join(inside,'signed.pdf'),Buffer.from('%PDF-1.4\nALTERED DATA\n%%EOF\n'));
  await assert.rejects(verify('signed.pdf',hash),/CONTRACT_ARCHIVE_HASH_MISMATCH/);
  console.log('CONTRACT_ARCHIVE_SERVER_HASH_NEGATIVE_TESTS_PASS');
 }finally{
  if(old===undefined)delete process.env.TAMANCARE_CONTRACT_ARCHIVE_ROOT;
  else process.env.TAMANCARE_CONTRACT_ARCHIVE_ROOT=old;
  fs.rmSync(root,{recursive:true,force:true});
 }
})().catch(e=>{console.error(e);process.exitCode=1;});

'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const crypto=require('node:crypto');
const {FinanceAttachmentIsolatedStore}=require('../../api/dist/finance-billing/finance-attachment-isolated-store.js');
async function main(){
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'finance-ci-attachments-'));
 try{
   const store=new FinanceAttachmentIsolatedStore(root);
   const bytes=Buffer.from('%PDF-1.4\nCI ephemeral only\n');
   const descriptor={documentId:'CI_DOC',objectKey:'finance/documents/CI_DOC/PROOF.pdf',
    byteLength:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),
    contentType:'application/pdf'};
   const result=await store.persistVerified(descriptor,bytes);
   assert.equal(result.persistenceEnabled,false);
   assert.deepEqual(await store.readVerified(descriptor,'CI_DOC'),bytes);
   await assert.rejects(store.readVerified(descriptor,'OTHER'),/SCOPE_FORBIDDEN/);
   await assert.rejects(store.persistVerified(descriptor,bytes),/EEXIST/);
   const target=path.join(root,descriptor.objectKey);
   await fs.writeFile(target,Buffer.from('tampered'));
   await assert.rejects(store.readVerified(descriptor,'CI_DOC'),/CORRUPTED/);
   assert.throws(()=>new FinanceAttachmentIsolatedStore('/srv/production'),/CI_ROOT_REQUIRED/);
   console.log('FINANCE_V3811_EPHEMERAL_OBJECT_INTEGRITY_ACCESS_PASS');
 }finally{await fs.rm(root,{recursive:true,force:true})}
}
main().catch(e=>{console.error(e);process.exitCode=1});

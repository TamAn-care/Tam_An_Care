'use strict';
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {verifyFinanceEvidenceBytes:verify}=require('../../api/dist/finance-billing/finance-evidence-verifier.js');
const bytes=Buffer.from('CI isolated bytes only');
const doc='DOC_CI';
const good={documentId:doc,objectKey:'finance/documents/DOC_CI/FILE_1.pdf',byteLength:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),contentType:'application/pdf'};
let x=verify(good,bytes,doc);assert.equal(x.valid,true);assert.equal(x.persistenceEnabled,false);
for(const [data,payload,scope] of [
 [{...good,sha256:'a'.repeat(64)},bytes,doc],
 [{...good,byteLength:bytes.length+1},bytes,doc],
 [{...good,objectKey:'../secrets.pdf'},bytes,doc],
 [{...good,documentId:'OTHER'},bytes,doc],
 [good,bytes,'OTHER'],
 [{...good,contentType:'application/javascript'},bytes,doc],
 [good,Buffer.from('tampered'),doc]
]){
 x=verify(data,payload,scope);assert.equal(x.valid,false);
 assert.equal(x.persistenceEnabled,false);
}
console.log('FINANCE_V389_EVIDENCE_BYTES_SCOPE_DIGEST_CI_PASS');

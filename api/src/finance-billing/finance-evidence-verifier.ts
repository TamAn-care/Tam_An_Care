/**
 * V3.8.9 evidence verification contract, pure and deliberately unregistered.
 * Hash comparisons alone are NOT proof of an authenticated issuer or storage.
 */
import { createHash, timingSafeEqual } from 'node:crypto';
export type EvidenceDescriptor = {
  documentId: string;
  objectKey: string;
  byteLength: number;
  sha256: string;
  contentType: 'application/pdf'|'image/jpeg'|'image/png';
};
const DIGEST=/^[a-f0-9]{64}$/;
const KEY=/^finance\/documents\/[A-Za-z0-9_-]{1,160}\/[A-Za-z0-9_-]{1,160}\.(pdf|jpg|png)$/;
const ID=/^[A-Za-z0-9_-]{1,160}$/;
export function verifyFinanceEvidenceBytes(
  descriptor: EvidenceDescriptor,
  bytes: Buffer,
  authorizedDocumentId: string,
): {valid:boolean;reasons:string[];persistenceEnabled:false} {
 const reasons:string[]=[];
 if(!descriptor || !ID.test(authorizedDocumentId) ||
    descriptor.documentId!==authorizedDocumentId)
   reasons.push('DOCUMENT_SCOPE_MISMATCH');
 if(!descriptor || !KEY.test(descriptor.objectKey ?? '') ||
    !descriptor.objectKey.startsWith('finance/documents/'+authorizedDocumentId+'/'))
   reasons.push('STORAGE_KEY_INVALID');
 if(!descriptor || !Number.isSafeInteger(descriptor.byteLength) ||
    descriptor.byteLength<1 || descriptor.byteLength>10*1024*1024 ||
    !Buffer.isBuffer(bytes) || bytes.length!==descriptor.byteLength)
   reasons.push('EVIDENCE_SIZE_INVALID');
 if(!descriptor || !['application/pdf','image/jpeg','image/png'].includes(descriptor.contentType))
   reasons.push('EVIDENCE_TYPE_INVALID');
 if(!descriptor || !DIGEST.test(descriptor.sha256 ?? ''))
   reasons.push('EVIDENCE_DIGEST_INVALID');
 if(!reasons.length) {
   const actual=createHash('sha256').update(bytes).digest();
   const claimed=Buffer.from(descriptor.sha256,'hex');
   if(!timingSafeEqual(actual,claimed)) reasons.push('EVIDENCE_DIGEST_MISMATCH');
 }
 return {valid:reasons.length===0,reasons,persistenceEnabled:false};
}

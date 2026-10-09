/**
 * V3.8.11 — isolated attachment object store reference implementation.
 * Deliberately NOT registered as a Nest provider/controller.
 * Never use a production storage root before auth, backup and release gates.
 */
import { constants } from 'node:fs';
import { open, mkdir, readFile, lstat } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  verifyFinanceEvidenceBytes,
  type EvidenceDescriptor,
} from './finance-evidence-verifier';

export class FinanceAttachmentIsolatedStore {
  constructor(private readonly root: string) {
    if (!root || !resolve(root).includes('finance-ci-attachments-')) {
      throw new Error('FINANCE_OBJECT_STORE_CI_ROOT_REQUIRED');
    }
  }
  async persistVerified(descriptor: EvidenceDescriptor, bytes: Buffer): Promise<{
    objectKey: string; sha256: string; persistenceEnabled: false;
  }> {
    const evidence=verifyFinanceEvidenceBytes(descriptor,bytes,descriptor.documentId);
    if (!evidence.valid) throw new Error('FINANCE_EVIDENCE_INVALID');
    const base=resolve(this.root);
    const target=resolve(base,descriptor.objectKey);
    if(!target.startsWith(base+sep)) throw new Error('FINANCE_OBJECT_PATH_INVALID');
    const directory=resolve(target,'..');
    await mkdir(directory,{recursive:true,mode:0o700});
    const directoryStat=await lstat(directory);
    if(!directoryStat.isDirectory()||directoryStat.isSymbolicLink())
      throw new Error('FINANCE_OBJECT_DIR_INVALID');
    const temporary=join(directory,'.staged-'+randomUUID());
    const temp=await open(temporary,constants.O_CREAT|constants.O_EXCL|constants.O_WRONLY|constants.O_NOFOLLOW,0o600);
    try{await temp.writeFile(bytes);await temp.sync();}finally{await temp.close();}
    // No overwrite. This operation is an isolated design exercise, not an
    // atomic DB/object-store two-phase commit. Caller must handle failures.
    let destination;
    try{
      destination=await open(target,constants.O_CREAT|constants.O_EXCL|constants.O_WRONLY|constants.O_NOFOLLOW,0o600);
      await destination.writeFile(bytes);
      await destination.sync();
    } finally {
      if(destination) await destination.close();
      const {unlink}=await import('node:fs/promises');
      await unlink(temporary).catch(()=>undefined);
    }
    return {objectKey:descriptor.objectKey,sha256:descriptor.sha256,persistenceEnabled:false};
  }
  async readVerified(descriptor: EvidenceDescriptor, authorizedDocumentId: string): Promise<Buffer> {
    if(descriptor.documentId!==authorizedDocumentId)
      throw new Error('FINANCE_DOCUMENT_SCOPE_FORBIDDEN');
    const base=resolve(this.root);
    const target=resolve(base,descriptor.objectKey);
    if(!target.startsWith(base+sep)) throw new Error('FINANCE_OBJECT_PATH_INVALID');
    const handle=await open(target,constants.O_RDONLY|constants.O_NOFOLLOW);
    let bytes:Buffer;
    try{const stat=await handle.stat();if(!stat.isFile()||stat.size>10485760) throw new Error('FINANCE_OBJECT_INVALID');bytes=await handle.readFile();}finally{await handle.close();}
    if(!verifyFinanceEvidenceBytes(descriptor,bytes,authorizedDocumentId).valid)
      throw new Error('FINANCE_OBJECT_CORRUPTED');
    return bytes;
  }
}

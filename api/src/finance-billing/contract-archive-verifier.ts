import { createHash } from 'node:crypto';
import { open, realpath } from 'node:fs/promises';
import { resolve, relative, isAbsolute } from 'node:path';

/**
 * Server-side verification of an already archived PDF.
 * No user-supplied hash is accepted as proof without comparing real file bytes.
 * Storage root must be an explicitly configured, pre-existing server directory.
 */
export async function verifyArchivedContractPdf(
  documentReference:string,
  expectedSha256:string,
):Promise<{sha256:string;sizeBytes:number;reference:string}> {
  const root=process.env.TAMANCARE_CONTRACT_ARCHIVE_ROOT;
  if(!root||!isAbsolute(root))throw Error('CONTRACT_ARCHIVE_ROOT_UNCONFIGURED');
  if(typeof documentReference!=='string'||
     !/^[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_.-]+)*\.pdf$/.test(documentReference)||
     documentReference.split('/').some(x=>x==='..'||x==='.'))
    throw Error('CONTRACT_ARCHIVE_REFERENCE_INVALID');
  if(typeof expectedSha256!=='string'||!/^[a-f0-9]{64}$/.test(expectedSha256))
    throw Error('CONTRACT_ARCHIVE_HASH_INVALID');
  const realRoot=await realpath(root);
  const file=resolve(realRoot,documentReference);
  const handle=await open(file,'r');
  try{
    const stat=await handle.stat();
    if(!stat.isFile()||stat.size<16||stat.size>20*1024*1024)
      throw Error('CONTRACT_ARCHIVE_SIZE_INVALID');
    const actual=await realpath(file);
    const rel=relative(realRoot,actual);
    if(!rel||rel.startsWith('..')||isAbsolute(rel))
      throw Error('CONTRACT_ARCHIVE_PATH_ESCAPE');
    // Read through the opened handle to avoid opening a second path after validation.
    const hash=createHash('sha256');
    const head=Buffer.alloc(5);
    await handle.read(head,0,5,0);
    if(head.toString('ascii')!=='%PDF-')
      throw Error('CONTRACT_ARCHIVE_NOT_PDF');
    const buffer=Buffer.alloc(65536);
    for(let position=0;position<stat.size;){
      const {bytesRead}=await handle.read(buffer,0,Math.min(buffer.length,stat.size-position),position);
      if(bytesRead<=0)throw Error('CONTRACT_ARCHIVE_SHORT_READ');
      hash.update(buffer.subarray(0,bytesRead));
      position+=bytesRead;
    }
    const after=await handle.stat();
    if(after.size!==stat.size||after.mtimeMs!==stat.mtimeMs)
      throw Error('CONTRACT_ARCHIVE_CHANGED_DURING_VERIFY');
    const sha256=hash.digest('hex');
    if(sha256!==expectedSha256)throw Error('CONTRACT_ARCHIVE_HASH_MISMATCH');
    return {sha256,sizeBytes:stat.size,reference:documentReference};
  }finally{await handle.close();}
}

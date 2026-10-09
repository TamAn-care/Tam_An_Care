/**
 * V3.8.13 read-only finance attachment reconciliation.
 * Caller supplies a trusted, consistent PostgreSQL metadata snapshot.
 * No SQL, no mutation, no automatic deletion, no runtime registration.
 */
import {lstat,readFile,readdir} from 'node:fs/promises';
import {resolve,relative,sep,join} from 'node:path';
import {createHash} from 'node:crypto';

export type AttachmentSnapshot={documentId:string;objectKey:string;sha256:string;byteLength:number};
export type AttachmentIncident={code:'MISSING'|'CORRUPT'|'ORPHAN'|'UNSAFE_PATH'|'SCAN_ERROR'|'INVALID_SNAPSHOT';objectKey:string};
const KEY=/^finance\/documents\/[A-Za-z0-9_-]{1,160}\/[A-Za-z0-9_-]{1,160}\.(pdf|jpg|png)$/;
const SHA=/^[a-f0-9]{64}$/;
function contained(root:string,key:string):string|null{
 if(!KEY.test(key))return null;
 const path=resolve(root,key); const rel=relative(resolve(root),path);
 return rel&&!rel.startsWith('..'+sep)&&rel!=='..'&&!rel.startsWith(sep)?path:null;
}
export async function reconcileFinanceAttachmentsReadOnly(root:string,snapshot:readonly AttachmentSnapshot[]):Promise<{
 status:'CLEAN'|'INCIDENTS'|'INVALID';incidents:AttachmentIncident[];
 scanned:number;readOnly:true;
}>{
 const incidents:AttachmentIncident[]=[];const known=new Set<string>();
 if(!Array.isArray(snapshot)||!root||snapshot.length>100000){
  return {status:'INVALID',incidents:[{code:'INVALID_SNAPSHOT',objectKey:''}],scanned:0,readOnly:true};
 }
 for(const item of snapshot){
  const key=item?.objectKey??'';
  if(!item||!contained(root,key)||key.split('/')[2]!==item.documentId||
     !SHA.test(item.sha256)||!Number.isSafeInteger(item.byteLength)||
     item.byteLength<1||item.byteLength>10485760||known.has(key)){
    incidents.push({code:'INVALID_SNAPSHOT',objectKey:key});continue;
  }
  known.add(key);
  const path=contained(root,key)!;
  try{
   const stat=await lstat(path);
   if(!stat.isFile()||stat.isSymbolicLink()||stat.size!==item.byteLength){
    incidents.push({code:'CORRUPT',objectKey:key});continue;
   }
   const bytes=await readFile(path);
   if(createHash('sha256').update(bytes).digest('hex')!==item.sha256)
    incidents.push({code:'CORRUPT',objectKey:key});
  }catch(e){
   const code=(e as NodeJS.ErrnoException).code;
   incidents.push({code:code==='ENOENT'?'MISSING':'SCAN_ERROR',objectKey:key});
  }
 }
 const base=resolve(root,'finance','documents');
 async function walk(dir:string):Promise<void>{
  let entries;
  try{entries=await readdir(dir,{withFileTypes:true});}catch(e){
   if((e as NodeJS.ErrnoException).code!=='ENOENT')
    incidents.push({code:'SCAN_ERROR',objectKey:relative(resolve(root),dir)});
   return;
  }
  for(const entry of entries){
   const file=join(dir,entry.name);const key=relative(resolve(root),file).split(sep).join('/');
   if(entry.isSymbolicLink()){incidents.push({code:'UNSAFE_PATH',objectKey:key});continue;}
   if(entry.isDirectory())await walk(file);
   else if(entry.isFile()&&!known.has(key))incidents.push({code:'ORPHAN',objectKey:key});
   else if(!entry.isFile())incidents.push({code:'UNSAFE_PATH',objectKey:key});
  }
 }
 await walk(base);
 return {status:incidents.some(x=>x.code==='INVALID_SNAPSHOT')?'INVALID':incidents.length?'INCIDENTS':'CLEAN',incidents,scanned:known.size,readOnly:true};
}

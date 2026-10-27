/** V3.8.18.31 — not registered as HTTP provider or route.
 * Verifies real auth_sessions then checks isolated candidate SQL schema.
 * The live Production Test has no verified canonical manual document table:
 * missing table MUST return unavailable, never create/seed or fall back to ledger.
 */
import {ForbiddenException, Injectable, ServiceUnavailableException} from '@nestjs/common';
import type {DatabaseService} from '../database/database.service';
import {readVerifiedFinanceIdentity} from '../security/verified-finance-identity';
const ID=/^[A-Za-z0-9_-]{1,160}$/;
type FinanceDocumentView={documentId:string;kind:string;status:string;revision:number;amountVnd:string;recognitionDate:string};
@Injectable()
export class FinanceDocumentReadAdapterV381831 {
 constructor(private readonly db:DatabaseService){}
 async get(request:object,documentId:string):Promise<FinanceDocumentView>{
  if(typeof documentId!=='string'||!ID.test(documentId))throw new ForbiddenException('INVALID_DOCUMENT_ID');
  const id=readVerifiedFinanceIdentity(request);
  if(!id)throw new ForbiddenException('VERIFIED_SESSION_REQUIRED');
  const roles=(process.env.TAMANCARE_FINANCE_READ_ROLES||'').split(',').map(x=>x.trim()).filter(Boolean);
  const payrollRoles=(process.env.TAMANCARE_FINANCE_PAYROLL_READ_ROLES||'').split(',').map(x=>x.trim()).filter(Boolean);
  if(!roles.includes(id.actorRole))throw new ForbiddenException('FINANCE_READ_DENIED');
  const session=await this.db.query<{actor_id:string;actor_role:string}>(`SELECT actor_id,actor_role FROM public.auth_sessions WHERE session_id=$1 AND actor_id=$2 AND actor_role=$3 AND revoked_at IS NULL AND expires_at>now() LIMIT 1`,[id.sessionId,id.actorId,id.actorRole]);
  if(session.rows.length!==1||session.rows[0].actor_id!==id.actorId||session.rows[0].actor_role!==id.actorRole)throw new ForbiddenException('SESSION_INACTIVE');
  const source=await this.db.query<{exists:boolean}>(`
SELECT EXISTS(
 SELECT 1 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND c.relname='finance_manual_documents' AND c.relkind IN ('r','p')
) AS exists`);
  if(source.rows.length!==1||source.rows[0]?.exists!==true)
   throw new ServiceUnavailableException('CANONICAL_DOCUMENT_SOURCE_NOT_AVAILABLE');
  // Requires a separate reviewed, catalog-verified schema migration and least privilege grants.
  // No live select of unapproved table. This adapter intentionally cannot return a document.
  throw new ServiceUnavailableException('DOCUMENT_READ_ADAPTER_NOT_RELEASED');
 }
}

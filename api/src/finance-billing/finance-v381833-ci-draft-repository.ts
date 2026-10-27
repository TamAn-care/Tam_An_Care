/** V3.8.18.33 — CI-only transactional backend adapter.
 * NOT injectable, NOT registered with Nest, NO HTTP route.
 * Explicitly refuses production database and runtime.
 * SQL function V29 itself resolves actor from CI session; no actor/role passed from client.
 */
import type {DatabaseService} from '../database/database.service';
const TOKEN=/^[A-Za-z0-9_-]{1,160}$/;
export type DraftV33={
 documentId:string; originKey:string; kind:'PAYROLL'|'REVENUE'|'DIRECT_COST'|'OPERATING_EXPENSE';
 recognitionDate:string; amountVnd:string; category:string; description:string;
 counterpartyRef:string; payBasis:'AGREED_AMOUNT'|'APPROVED_TIMESHEET'|'MANUAL_OTHER'|'NOT_APPLICABLE';
 evidenceType:'SUPPLIER_INVOICE'|'INTERNAL_VOUCHER'|'SIGNED_AGREEMENT'|'RECEIPT_OTHER';
 evidenceDigest:string|null; reviewerId:string; approverId:string
};
export class FinanceCiDraftRepositoryV381833{
 constructor(private readonly db: Pick<DatabaseService,'withTransaction'>){}
 async create(input:DraftV33,verifiedSessionId:string):Promise<{documentId:string;persistedInCi:true;postedToLedger:false}>{
  if(process.env.NODE_ENV!=='test'||process.env.PGHOST!=='127.0.0.1'||
    process.env.PGDATABASE!=='finance_ci'||process.env.PGUSER!=='finance_ci')
   throw new Error('V33_CI_ONLY_DENIED');
  if(!input||typeof input!=='object'||!TOKEN.test(input.documentId)||
   !TOKEN.test(input.originKey)||!TOKEN.test(verifiedSessionId)||
   !TOKEN.test(input.reviewerId)||!TOKEN.test(input.approverId)||
   !/^\d{4}-\d{2}-\d{2}$/.test(input.recognitionDate)||
   !/^(0|[1-9]\d{0,15})$/.test(input.amountVnd))
   throw new Error('V33_INVALID_DRAFT');
  const args=[input.documentId,input.originKey,input.kind,input.recognitionDate,
   input.amountVnd,input.category,input.description,input.counterpartyRef,
   input.payBasis,input.evidenceType,input.evidenceDigest,
   input.reviewerId,input.approverId,verifiedSessionId];
  return this.db.withTransaction(async tx=>{
   const guard=await tx.query<{db:string;user_name:string}>(`SELECT current_database() AS db,current_user AS user_name`);
   if(guard.rows.length!==1||guard.rows[0].db!=='finance_ci'||guard.rows[0].user_name!=='finance_ci')
    throw new Error('V33_DATABASE_IDENTITY_DENIED');
   const result=await tx.query<{document_id:string}>(`
SELECT finance_manual_v26_ci.create_draft_v29(
 $1,$2,$3,$4::date,$5::numeric,$6,$7,$8,$9,$10,$11,$12,$13,$14
) AS document_id`,args);
   if(result.rows.length!==1||result.rows[0].document_id!==input.documentId)
    throw new Error('V33_DRAFT_PERSISTENCE_UNVERIFIED');
   return {documentId:input.documentId,persistedInCi:true as const,postedToLedger:false as const};
  });
 }
}

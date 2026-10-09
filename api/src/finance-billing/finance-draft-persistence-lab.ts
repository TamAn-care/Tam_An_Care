import { ForbiddenException, Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { FinanceDocumentAuthorizationService } from './finance-document-authorization.service';
import {
 validateFinanceDocumentDraft,
 type FinanceDocumentDraftInput,
} from './finance-document-draft-contract';

/** V3.8.8 unregistered CI-only draft transaction orchestration.
 * The lab method requires an injected query client; runtime cannot use it.
 * Source proof authenticity remains unverified: no production writes enabled.
 */
@Injectable()
export class FinanceDraftPersistenceLab {
 constructor(
  private readonly db: DatabaseService,
  private readonly authorization: FinanceDocumentAuthorizationService,
 ) {}

 async createDraft(request: object, draft: FinanceDocumentDraftInput): Promise<never> {
  await this.authorization.authorize(request,'SUBMIT');
  const result=validateFinanceDocumentDraft(draft);
  if(!result.accepted) throw new ForbiddenException('FINANCE_DOCUMENT_INPUT_INVALID');
  throw new ForbiddenException('FINANCE_DOCUMENT_PERSISTENCE_NOT_AUTHORIZED');
 }

 static ciInsertSql(): string {
  return `INSERT INTO finance_source_documents(
 document_id,source_domain,source_entity_type,source_entity_id,
 entry_type,recognition_date,amount_vnd,external_evidence_sha256,
 reference_number,prepared_by)
 VALUES($1,$2,$3,$4,$5,$6::date,$7::numeric,$8,$9,$10)
 RETURNING document_id,revision,state`;
 }
}

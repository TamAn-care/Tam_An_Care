import { ForbiddenException, Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { FinanceDocumentAuthorizationService } from './finance-document-authorization.service';
import type { DocumentAction } from './finance-document-workflow';

/**
 * V3.8.5 internal orchestration, deliberately NOT registered in Nest modules
 * and NOT exposed as an HTTP command.
 * SQL is parameterized; actor is server-session verified, never request body.
 * Production write remains disabled until DB least privilege, independent
 * evidence validation, migration/restore and operational rollout gates PASS.
 */
@Injectable()
export class FinanceDocumentTransactionService {
  constructor(
    private readonly db: DatabaseService,
    private readonly authorization: FinanceDocumentAuthorizationService,
  ) {}

  async transitionInIsolatedLab(
    request: object,
    input: {
      documentId: string;
      expectedRevision: number;
      action: DocumentAction;
      reason: string;
      approvalDigest?: string;
    },
  ): Promise<never> {
    // Fail closed in ALL runtime environments: no hidden flags / implicit enable.
    // The authorization gate can be tested without ever invoking a DB mutation.
    await this.authorization.authorize(request, input.action);
    throw new ForbiddenException('FINANCE_DOCUMENT_WRITE_NOT_AUTHORIZED');
  }

  /**
   * Prepared transaction contract for isolated SQL verification only.
   * Not called by runtime, not registered, no external input-driven execution.
   */
  static isolatedTransitionSql(): string {
    return `SELECT finance_v382_transition($1::text,$2::bigint,
      $3::text,$4::text,$5::text,$6::text) AS revision`;
  }
}

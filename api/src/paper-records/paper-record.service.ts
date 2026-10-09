import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';

import { DatabaseService } from '../database/database.service';
import { ResidentAccessScopeService } from '../resident-access-scope/resident-access-scope.service';

type ActorContext = {
  actorId?: string;
  actorRole?: string;
};

type PaperRecordStatus =
  | 'STORED'
  | 'BORROWED'
  | 'RETURNED_TO_FAMILY'
  | 'ARCHIVED';

type DocumentItem = {
  name: string;
  present: boolean;
  note?: string | null;
};

type UpsertInput = {
  recordCode?: string;
  cabinet?: string | null;
  drawer?: string | null;
  position?: string | null;
  status?: PaperRecordStatus;
  documentCatalog?: DocumentItem[];
  lastInventoryAt?: string | null;
};

type PaperRecordRow = {
  paper_record_id: string;
  resident_id: string;
  record_code: string;
  cabinet: string | null;
  drawer: string | null;
  position: string | null;
  status: PaperRecordStatus;
  current_borrower_actor_id: string | null;
  current_borrower_name: string | null;
  borrowed_at: string | Date | null;
  returned_at: string | Date | null;
  document_catalog: DocumentItem[];
  last_inventory_at: string | Date | null;
  qr_token: string;
  created_at: string | Date;
  updated_at: string | Date;
};

@Injectable()
export class PaperRecordService {
  constructor(
    private readonly db: DatabaseService,
    private readonly residentScope: ResidentAccessScopeService,
  ) {}

  private readonly readableRoles = new Set([
    'ADMIN',
    'SUPERVISOR',
    'CARE_MANAGER',
    'RECEPTIONIST',
    'DIRECTOR',
    'NURSE',
    'CAREGIVER',
    'GUARDIAN',
    'NUTRITIONIST',
    'PHYSICAL_THERAPIST',
  ]);

  private readonly managerRoles = new Set([
    'ADMIN',
    'SUPERVISOR',
    'CARE_MANAGER',
    'RECEPTIONIST',
    'DIRECTOR',
  ]);

  private readonly borrowRoles = new Set([
    'ADMIN',
    'SUPERVISOR',
    'CARE_MANAGER',
    'RECEPTIONIST',
    'DIRECTOR',
    'NURSE',
    'CAREGIVER',
    'NUTRITIONIST',
    'PHYSICAL_THERAPIST',
  ]);

  private async authorizeResident(
    residentIdInput: string,
    actor: ActorContext,
  ): Promise<{
    residentId: string;
    actorId: string;
    actorRole: string;
  }> {
    const residentId = String(residentIdInput ?? '').trim();
    const actorId = String(actor.actorId ?? '').trim();
    const actorRole = String(actor.actorRole ?? '').trim().toUpperCase();

    if (!residentId) {
      throw new BadRequestException('residentId is required');
    }

    if (!actorId || !actorRole) {
      throw new UnauthorizedException('Actor context is required');
    }

    if (!this.readableRoles.has(actorRole)) {
      throw new ForbiddenException('Actor is not authorized for paper records');
    }

    const allowed = await this.residentScope.canAccessResident(
      actorId,
      actorRole as any,
      residentId,
    );

    if (!allowed) {
      throw new NotFoundException('Resident not found');
    }

    return { residentId, actorId, actorRole };
  }

  private assertManager(role: string): void {
    if (!this.managerRoles.has(role)) {
      throw new ForbiddenException('Paper record administration authority is required');
    }
  }

  private assertBorrower(role: string): void {
    if (!this.borrowRoles.has(role)) {
      throw new ForbiddenException('This role cannot borrow or return a paper record');
    }
  }

  private map(row: PaperRecordRow | undefined) {
    if (!row) return null;

    return {
      paperRecordId: row.paper_record_id,
      residentId: row.resident_id,
      recordCode: row.record_code,
      cabinet: row.cabinet,
      drawer: row.drawer,
      position: row.position,
      status: row.status,
      currentBorrowerActorId: row.current_borrower_actor_id,
      currentBorrowerName: row.current_borrower_name,
      borrowedAt: row.borrowed_at,
      returnedAt: row.returned_at,
      documentCatalog: row.document_catalog ?? [],
      lastInventoryAt: row.last_inventory_at,
      qrToken: row.qr_token,
      qrPath: '/care-view/' + encodeURIComponent(row.resident_id) + '?section=paper-record',
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async get(residentId: string, actor: ActorContext) {
    const auth = await this.authorizeResident(residentId, actor);

    const result = await this.db.query<PaperRecordRow>(
      'SELECT * FROM paper_records WHERE resident_id = $1 LIMIT 1',
      [auth.residentId],
    );

    return this.map(result.rows[0]);
  }

  async history(residentId: string, actor: ActorContext) {
    const auth = await this.authorizeResident(residentId, actor);

    const result = await this.db.query(
      'SELECT paper_record_loan_id AS "paperRecordLoanId", resident_id AS "residentId", borrower_actor_id AS "borrowerActorId", borrower_name AS "borrowerName", borrowed_at AS "borrowedAt", returned_at AS "returnedAt", returned_by_actor_id AS "returnedByActorId", returned_by_name AS "returnedByName", note, created_at AS "createdAt" FROM paper_record_loan_history WHERE resident_id = $1 ORDER BY borrowed_at DESC, created_at DESC LIMIT 100',
      [auth.residentId],
    );

    return result.rows;
  }

  async upsert(
    residentId: string,
    actor: ActorContext,
    input: UpsertInput,
  ) {
    const auth = await this.authorizeResident(residentId, actor);
    this.assertManager(auth.actorRole);

    const recordCode = String(input.recordCode ?? '').trim();
    if (!recordCode) {
      throw new BadRequestException('Mã hồ sơ giấy không được để trống');
    }

    const requestedStatus = String(input.status ?? 'STORED').trim().toUpperCase();
    const editableStatuses = new Set([
      'STORED',
      'RETURNED_TO_FAMILY',
      'ARCHIVED',
    ]);

    if (!editableStatuses.has(requestedStatus)) {
      throw new BadRequestException('Trạng thái hồ sơ không hợp lệ');
    }

    const documentCatalog = Array.isArray(input.documentCatalog)
      ? input.documentCatalog
          .map((item) => ({
            name: String(item?.name ?? '').trim(),
            present: item?.present !== false,
            note: item?.note == null
              ? null
              : String(item.note).trim() || null,
          }))
          .filter((item) => item.name.length > 0)
      : [];

    const result = await this.db.query<PaperRecordRow>(
      'INSERT INTO paper_records (resident_id, record_code, cabinet, drawer, position, status, document_catalog, last_inventory_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,NOW()) ON CONFLICT (resident_id) DO UPDATE SET record_code = EXCLUDED.record_code, cabinet = EXCLUDED.cabinet, drawer = EXCLUDED.drawer, position = EXCLUDED.position, status = CASE WHEN paper_records.status = \'BORROWED\' THEN paper_records.status ELSE EXCLUDED.status END, document_catalog = EXCLUDED.document_catalog, last_inventory_at = EXCLUDED.last_inventory_at, updated_at = NOW() RETURNING *',
      [
        auth.residentId,
        recordCode,
        input.cabinet == null ? null : String(input.cabinet).trim() || null,
        input.drawer == null ? null : String(input.drawer).trim() || null,
        input.position == null ? null : String(input.position).trim() || null,
        requestedStatus,
        JSON.stringify(documentCatalog),
        input.lastInventoryAt || null,
      ],
    );

    return this.map(result.rows[0]);
  }

  async borrow(residentId: string, actor: ActorContext) {
    const auth = await this.authorizeResident(residentId, actor);
    this.assertBorrower(auth.actorRole);

    return this.db.withTransaction(async (client) => {
      const actorResult = await client.query<{
        actor_id: string;
        display_name: string;
      }>(
        'SELECT actor_id, display_name FROM staff_actors WHERE actor_id = $1 AND status = \'ACTIVE\' AND primary_operational_role = $2 LIMIT 1',
        [auth.actorId, auth.actorRole],
      );

      const borrower = actorResult.rows[0];
      if (!borrower) {
        throw new ForbiddenException('Canonical active staff actor is required');
      }

      const currentResult = await client.query<PaperRecordRow>(
        'SELECT * FROM paper_records WHERE resident_id = $1 FOR UPDATE',
        [auth.residentId],
      );

      const current = currentResult.rows[0];
      if (!current) {
        throw new BadRequestException('Hãy thiết lập hồ sơ giấy trước khi mượn');
      }

      if (current.status === 'BORROWED') {
        throw new BadRequestException('Hồ sơ hiện đang được mượn');
      }

      if (
        current.status === 'RETURNED_TO_FAMILY'
        || current.status === 'ARCHIVED'
      ) {
        throw new BadRequestException('Hồ sơ hiện không ở trạng thái có thể mượn');
      }

      await client.query(
        'INSERT INTO paper_record_loan_history (paper_record_id, resident_id, borrower_actor_id, borrower_name, borrowed_at) VALUES ($1,$2,$3,$4,NOW())',
        [
          current.paper_record_id,
          auth.residentId,
          borrower.actor_id,
          borrower.display_name,
        ],
      );

      const updated = await client.query<PaperRecordRow>(
        'UPDATE paper_records SET status = \'BORROWED\', current_borrower_actor_id = $2, current_borrower_name = $3, borrowed_at = NOW(), returned_at = NULL, updated_at = NOW() WHERE resident_id = $1 RETURNING *',
        [auth.residentId, borrower.actor_id, borrower.display_name],
      );

      return this.map(updated.rows[0]);
    });
  }

  async returnRecord(residentId: string, actor: ActorContext) {
    const auth = await this.authorizeResident(residentId, actor);
    this.assertBorrower(auth.actorRole);

    return this.db.withTransaction(async (client) => {
      const actorResult = await client.query<{
        actor_id: string;
        display_name: string;
      }>(
        'SELECT actor_id, display_name FROM staff_actors WHERE actor_id = $1 AND status = \'ACTIVE\' AND primary_operational_role = $2 LIMIT 1',
        [auth.actorId, auth.actorRole],
      );

      const returner = actorResult.rows[0];
      if (!returner) {
        throw new ForbiddenException('Canonical active staff actor is required');
      }

      const currentResult = await client.query<PaperRecordRow>(
        'SELECT * FROM paper_records WHERE resident_id = $1 FOR UPDATE',
        [auth.residentId],
      );

      const current = currentResult.rows[0];
      if (!current) {
        throw new NotFoundException('Paper record not found');
      }

      if (current.status !== 'BORROWED') {
        throw new BadRequestException('Hồ sơ hiện không ở trạng thái đang mượn');
      }

      const closed = await client.query(
        'UPDATE paper_record_loan_history SET returned_at = NOW(), returned_by_actor_id = $2, returned_by_name = $3 WHERE paper_record_loan_id = (SELECT paper_record_loan_id FROM paper_record_loan_history WHERE paper_record_id = $1 AND returned_at IS NULL ORDER BY borrowed_at DESC LIMIT 1) RETURNING paper_record_loan_id',
        [current.paper_record_id, returner.actor_id, returner.display_name],
      );

      if (closed.rowCount !== 1) {
        throw new Error('Open paper-record loan history is missing');
      }

      const updated = await client.query<PaperRecordRow>(
        'UPDATE paper_records SET status = \'STORED\', current_borrower_actor_id = NULL, current_borrower_name = NULL, returned_at = NOW(), updated_at = NOW() WHERE resident_id = $1 RETURNING *',
        [auth.residentId],
      );

      return this.map(updated.rows[0]);
    });
  }
}

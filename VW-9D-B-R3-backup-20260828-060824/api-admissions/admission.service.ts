import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';

import {
  DatabaseService,
} from '../database/database.service';

export type ActorRole =
  | 'CAREGIVER'
  | 'NURSE'
  | 'CARE_MANAGER'
  | 'SUPERVISOR';

export interface ActorContext {
  actorId: string;
  actorRole: ActorRole;
}

interface ActorRow {
  primary_operational_role: ActorRole;
  status: string;
}

interface AdmissionRow {
  admission_case_id: string;
  admission_code: string;
  resident_id: string | null;
  prospective_resident_name: string;
  date_of_birth: string | Date;
  gender: string;
  identity_number: string | null;
  requested_admission_date: string | Date | null;
  actual_admission_date: string | Date | null;
  admission_reason: string | null;
  care_expectations: string | null;
  referral_source: string | null;
  status: string;
  record_version: string | number;
  created_at: Date;
  updated_at: Date;
}

export interface CreateAdmissionInput {
  prospectiveResidentName?: unknown;
  dateOfBirth?: unknown;
  gender?: unknown;
  identityNumber?: unknown;
  requestedAdmissionDate?: unknown;
  admissionReason?: unknown;
  careExpectations?: unknown;
  referralSource?: unknown;
}

export interface CreateMeasurementInput {
  measurementType?: unknown;
  valueNumeric?: unknown;
  valueSecondary?: unknown;
  valueText?: unknown;
  unit?: unknown;
  measuredAt?: unknown;
  notes?: unknown;
}

export interface CreateContactInput {
  contactType?: unknown;
  fullName?: unknown;
  relationship?: unknown;
  phone?: unknown;
  email?: unknown;
  address?: unknown;
  isPrimary?: unknown;
  isEmergencyContact?: unknown;
  isLegalRepresentative?: unknown;
  authorizedForHealthReports?: unknown;
  notes?: unknown;
}

@Injectable()
export class AdmissionService {
  private readonly defaultLimit = 50;
  private readonly maxLimit = 100;

  constructor(
    private readonly database: DatabaseService,
  ) {}

  private requiredString(
    value: unknown,
    field: string,
  ): string {
    if (
      typeof value !== 'string' ||
      !value.trim()
    ) {
      throw new BadRequestException(
        `${field} là thông tin bắt buộc.`,
      );
    }

    return value.trim();
  }

  private optionalString(
    value: unknown,
  ): string | null {
    if (
      value === undefined ||
      value === null
    ) {
      return null;
    }

    if (typeof value !== 'string') {
      throw new BadRequestException(
        'Dữ liệu văn bản không hợp lệ.',
      );
    }

    const normalized = value.trim();

    return normalized || null;
  }

  private optionalNumber(
    value: unknown,
  ): number | null {
    if (
      value === undefined ||
      value === null ||
      value === ''
    ) {
      return null;
    }

    if (
      typeof value !== 'number' ||
      !Number.isFinite(value)
    ) {
      throw new BadRequestException(
        'Giá trị đo phải là số hợp lệ.',
      );
    }

    return value;
  }

  private optionalBoolean(
    value: unknown,
  ): boolean {
    return value === true;
  }

  private normalizeDate(
    value: unknown,
    field: string,
    required = false,
  ): string | null {
    if (
      value === undefined ||
      value === null ||
      value === ''
    ) {
      if (required) {
        throw new BadRequestException(
          `${field} là thông tin bắt buộc.`,
        );
      }

      return null;
    }

    if (
      typeof value !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}$/.test(value)
    ) {
      throw new BadRequestException(
        `${field} phải có định dạng YYYY-MM-DD.`,
      );
    }

    return value;
  }

  private normalizeTimestamp(
    value: unknown,
  ): string | null {
    if (
      value === undefined ||
      value === null ||
      value === ''
    ) {
      return null;
    }

    if (typeof value !== 'string') {
      throw new BadRequestException(
        'Thời điểm đo không hợp lệ.',
      );
    }

    const parsed = Date.parse(value);

    if (Number.isNaN(parsed)) {
      throw new BadRequestException(
        'Thời điểm đo không hợp lệ.',
      );
    }

    return new Date(parsed).toISOString();
  }

  private mapAdmission(
    row: AdmissionRow,
  ) {
    const toDate = (
      value: string | Date | null,
    ) => {
      if (!value) {
        return null;
      }

      if (value instanceof Date) {
        return value.toISOString().slice(0, 10);
      }

      return String(value).slice(0, 10);
    };

    return {
      admissionCaseId:
        row.admission_case_id,
      admissionCode:
        row.admission_code,
      residentId:
        row.resident_id,
      prospectiveResidentName:
        row.prospective_resident_name,
      dateOfBirth:
        toDate(row.date_of_birth),
      gender:
        row.gender,
      identityNumber:
        row.identity_number,
      requestedAdmissionDate:
        toDate(
          row.requested_admission_date,
        ),
      actualAdmissionDate:
        toDate(
          row.actual_admission_date,
        ),
      admissionReason:
        row.admission_reason,
      careExpectations:
        row.care_expectations,
      referralSource:
        row.referral_source,
      status:
        row.status,
      recordVersion:
        Number(row.record_version),
      createdAt:
        row.created_at,
      updatedAt:
        row.updated_at,
    };
  }

  private async assertActor(
    actor: ActorContext,
    allowedRoles: ActorRole[],
  ): Promise<void> {
    const result =
      await this.database.query<ActorRow>(
        `
        SELECT
          primary_operational_role,
          status
        FROM staff_actors
        WHERE actor_id = $1
        LIMIT 1
        `,
        [actor.actorId],
      );

    const canonical = result.rows[0];

    if (
      !canonical ||
      canonical.status !== 'ACTIVE'
    ) {
      throw new UnauthorizedException(
        'Phiên nhân sự không hợp lệ hoặc không còn hoạt động.',
      );
    }

    if (
      canonical.primary_operational_role !==
      actor.actorRole
    ) {
      throw new ForbiddenException(
        'Vai trò gửi lên không khớp với vai trò nhân sự trong hệ thống.',
      );
    }

    if (
      !allowedRoles.includes(
        canonical.primary_operational_role,
      )
    ) {
      throw new ForbiddenException(
        'Bạn không có quyền thực hiện thao tác này.',
      );
    }
  }

  async list(
    actor: ActorContext,
    options: {
      limit?: string;
      offset?: string;
      status?: string;
      q?: string;
    },
  ) {
    await this.assertActor(
      actor,
      [
        'CAREGIVER',
        'NURSE',
        'CARE_MANAGER',
        'SUPERVISOR',
      ],
    );

    const requestedLimit =
      Number(options.limit);

    const requestedOffset =
      Number(options.offset);

    const limit =
      Number.isFinite(requestedLimit) &&
      requestedLimit > 0
        ? Math.min(
            Math.floor(requestedLimit),
            this.maxLimit,
          )
        : this.defaultLimit;

    const offset =
      Number.isFinite(requestedOffset) &&
      requestedOffset >= 0
        ? Math.floor(requestedOffset)
        : 0;

    const status =
      options.status?.trim() || null;

    const query =
      options.q?.trim() || null;

    const countResult =
      await this.database.query<{
        count: string;
      }>(
        `
        SELECT count(*)::text AS count
        FROM admission_cases
        WHERE
          ($1::text IS NULL OR status = $1)
          AND (
            $2::text IS NULL
            OR admission_code ILIKE '%' || $2 || '%'
            OR prospective_resident_name
               ILIKE '%' || $2 || '%'
            OR COALESCE(identity_number, '')
               ILIKE '%' || $2 || '%'
          )
        `,
        [status, query],
      );

    const rows =
      await this.database.query<AdmissionRow>(
        `
        SELECT
          admission_case_id,
          admission_code,
          resident_id,
          prospective_resident_name,
          date_of_birth,
          gender,
          identity_number,
          requested_admission_date,
          actual_admission_date,
          admission_reason,
          care_expectations,
          referral_source,
          status,
          record_version,
          created_at,
          updated_at
        FROM admission_cases
        WHERE
          ($1::text IS NULL OR status = $1)
          AND (
            $2::text IS NULL
            OR admission_code ILIKE '%' || $2 || '%'
            OR prospective_resident_name
               ILIKE '%' || $2 || '%'
            OR COALESCE(identity_number, '')
               ILIKE '%' || $2 || '%'
          )
        ORDER BY
          created_at DESC,
          admission_case_id DESC
        LIMIT $3
        OFFSET $4
        `,
        [
          status,
          query,
          limit,
          offset,
        ],
      );

    return {
      items:
        rows.rows.map(
          (row) => this.mapAdmission(row),
        ),
      count:
        Number(
          countResult.rows[0]?.count || 0,
        ),
      limit,
      offset,
    };
  }

  async getById(
    actor: ActorContext,
    admissionCaseId: string,
  ) {
    await this.assertActor(
      actor,
      [
        'CAREGIVER',
        'NURSE',
        'CARE_MANAGER',
        'SUPERVISOR',
      ],
    );

    const result =
      await this.database.query<AdmissionRow>(
        `
        SELECT
          admission_case_id,
          admission_code,
          resident_id,
          prospective_resident_name,
          date_of_birth,
          gender,
          identity_number,
          requested_admission_date,
          actual_admission_date,
          admission_reason,
          care_expectations,
          referral_source,
          status,
          record_version,
          created_at,
          updated_at
        FROM admission_cases
        WHERE admission_case_id = $1
        LIMIT 1
        `,
        [admissionCaseId],
      );

    const row = result.rows[0];

    if (!row) {
      throw new NotFoundException(
        'Không tìm thấy hồ sơ tiếp nhận.',
      );
    }

    return this.mapAdmission(row);
  }

  async create(
    actor: ActorContext,
    input: CreateAdmissionInput,
  ) {
    await this.assertActor(
      actor,
      [
        'NURSE',
        'CARE_MANAGER',
        'SUPERVISOR',
      ],
    );

    const name =
      this.requiredString(
        input.prospectiveResidentName,
        'Họ và tên người cao tuổi',
      );

    const dateOfBirth =
      this.normalizeDate(
        input.dateOfBirth,
        'Ngày sinh',
        true,
      );

    const gender =
      this.requiredString(
        input.gender,
        'Giới tính',
      );

    if (
      ![
        'MALE',
        'FEMALE',
        'OTHER',
        'UNSPECIFIED',
      ].includes(gender)
    ) {
      throw new BadRequestException(
        'Giới tính không hợp lệ.',
      );
    }

    const requestedAdmissionDate =
      this.normalizeDate(
        input.requestedAdmissionDate,
        'Ngày dự kiến tiếp nhận',
      );

    return this.database.withTransaction(
      async (client) => {
        const created =
          await client.query<AdmissionRow>(
            `
            INSERT INTO admission_cases (
              admission_case_id,
              admission_code,
              resident_id,
              prospective_resident_name,
              date_of_birth,
              gender,
              identity_number,
              requested_admission_date,
              admission_reason,
              care_expectations,
              referral_source,
              status,
              created_by,
              created_by_role,
              updated_by,
              updated_by_role
            )
            VALUES (
              'admission-' ||
                gen_random_uuid()::text,
              'ADM-' ||
                upper(
                  substr(
                    replace(
                      gen_random_uuid()::text,
                      '-',
                      ''
                    ),
                    1,
                    12
                  )
                ),
              NULL,
              $1,
              $2,
              $3,
              $4,
              $5,
              $6,
              $7,
              $8,
              'DRAFT',
              $9,
              $10,
              $9,
              $10
            )
            RETURNING
              admission_case_id,
              admission_code,
              resident_id,
              prospective_resident_name,
              date_of_birth,
              gender,
              identity_number,
              requested_admission_date,
              actual_admission_date,
              admission_reason,
              care_expectations,
              referral_source,
              status,
              record_version,
              created_at,
              updated_at
            `,
            [
              name,
              dateOfBirth,
              gender,
              this.optionalString(
                input.identityNumber,
              ),
              requestedAdmissionDate,
              this.optionalString(
                input.admissionReason,
              ),
              this.optionalString(
                input.careExpectations,
              ),
              this.optionalString(
                input.referralSource,
              ),
              actor.actorId,
              actor.actorRole,
            ],
          );

        const row = created.rows[0];

        if (!row) {
          throw new Error(
            'Không tạo được hồ sơ tiếp nhận.',
          );
        }

        await client.query(
          `
          INSERT INTO admission_audit (
            admission_case_id,
            event_type,
            actor_id,
            actor_role,
            previous_status,
            new_status,
            entity_type,
            entity_id,
            new_state
          )
          VALUES (
            $1,
            'ADMISSION_CREATED',
            $2,
            $3,
            NULL,
            'DRAFT',
            'ADMISSION_CASE',
            $1,
            jsonb_build_object(
              'admissionCode',
              $4::text
            )
          )
          `,
          [
            row.admission_case_id,
            actor.actorId,
            actor.actorRole,
            row.admission_code,
          ],
        );

        return this.mapAdmission(row);
      },
    );
  }

  async createMeasurement(
    actor: ActorContext,
    admissionCaseId: string,
    input: CreateMeasurementInput,
  ) {
    await this.assertActor(
      actor,
      [
        'NURSE',
        'CARE_MANAGER',
        'SUPERVISOR',
      ],
    );

    await this.getById(
      actor,
      admissionCaseId,
    );

    const measurementType =
      this.requiredString(
        input.measurementType,
        'Loại chỉ số',
      );

    const valueNumeric =
      this.optionalNumber(
        input.valueNumeric,
      );

    const valueSecondary =
      this.optionalNumber(
        input.valueSecondary,
      );

    const valueText =
      this.optionalString(
        input.valueText,
      );

    if (
      valueNumeric === null &&
      valueSecondary === null &&
      valueText === null
    ) {
      throw new BadRequestException(
        'Cần nhập ít nhất một giá trị đo.',
      );
    }

    const measuredAt =
      this.normalizeTimestamp(
        input.measuredAt,
      ) || new Date().toISOString();

    return this.database.withTransaction(
      async (client) => {
        const created =
          await client.query(
            `
            INSERT INTO admission_measurements (
              admission_measurement_id,
              admission_case_id,
              measurement_type,
              value_numeric,
              value_secondary,
              value_text,
              unit,
              measured_at,
              notes,
              recorded_by,
              recorded_by_role
            )
            VALUES (
              'admission-measurement-' ||
                gen_random_uuid()::text,
              $1,
              $2,
              $3,
              $4,
              $5,
              $6,
              $7,
              $8,
              $9,
              $10
            )
            RETURNING
              admission_measurement_id,
              admission_case_id,
              measurement_type,
              value_numeric,
              value_secondary,
              value_text,
              unit,
              measured_at,
              verification_status,
              created_at
            `,
            [
              admissionCaseId,
              measurementType,
              valueNumeric,
              valueSecondary,
              valueText,
              this.optionalString(
                input.unit,
              ),
              measuredAt,
              this.optionalString(
                input.notes,
              ),
              actor.actorId,
              actor.actorRole,
            ],
          );

        const row = created.rows[0];

        await client.query(
          `
          INSERT INTO admission_audit (
            admission_case_id,
            event_type,
            actor_id,
            actor_role,
            entity_type,
            entity_id
          )
          VALUES (
            $1,
            'MEASUREMENT_RECORDED',
            $2,
            $3,
            'ADMISSION_MEASUREMENT',
            $4
          )
          `,
          [
            admissionCaseId,
            actor.actorId,
            actor.actorRole,
            row.admission_measurement_id,
          ],
        );

        return row;
      },
    );
  }

  async createContact(
    actor: ActorContext,
    admissionCaseId: string,
    input: CreateContactInput,
  ) {
    await this.assertActor(
      actor,
      [
        'CAREGIVER',
        'NURSE',
        'CARE_MANAGER',
        'SUPERVISOR',
      ],
    );

    await this.getById(
      actor,
      admissionCaseId,
    );

    const contactType =
      this.requiredString(
        input.contactType,
        'Loại người liên hệ',
      );

    const allowedContactTypes = [
      'GUARDIAN',
      'REPRESENTATIVE',
      'FAMILY',
      'EMERGENCY_CONTACT',
      'PRIMARY_CONTACT',
      'OTHER',
    ];

    if (
      !allowedContactTypes.includes(
        contactType,
      )
    ) {
      throw new BadRequestException(
        'Loại người liên hệ không hợp lệ.',
      );
    }

    const fullName =
      this.requiredString(
        input.fullName,
        'Họ tên người liên hệ',
      );

    return this.database.withTransaction(
      async (client) => {
        const created =
          await client.query(
            `
            INSERT INTO admission_contacts (
              admission_contact_id,
              admission_case_id,
              contact_type,
              full_name,
              relationship,
              phone,
              email,
              address,
              is_primary,
              is_emergency_contact,
              is_legal_representative,
              authorized_for_health_reports,
              notes,
              created_by,
              created_by_role
            )
            VALUES (
              'admission-contact-' ||
                gen_random_uuid()::text,
              $1,
              $2,
              $3,
              $4,
              $5,
              $6,
              $7,
              $8,
              $9,
              $10,
              $11,
              $12,
              $13,
              $14
            )
            RETURNING
              admission_contact_id,
              admission_case_id,
              contact_type,
              full_name,
              relationship,
              phone,
              email,
              address,
              is_primary,
              is_emergency_contact,
              is_legal_representative,
              authorized_for_health_reports,
              created_at
            `,
            [
              admissionCaseId,
              contactType,
              fullName,
              this.optionalString(
                input.relationship,
              ),
              this.optionalString(
                input.phone,
              ),
              this.optionalString(
                input.email,
              ),
              this.optionalString(
                input.address,
              ),
              this.optionalBoolean(
                input.isPrimary,
              ),
              this.optionalBoolean(
                input.isEmergencyContact,
              ),
              this.optionalBoolean(
                input.isLegalRepresentative,
              ),
              this.optionalBoolean(
                input.authorizedForHealthReports,
              ),
              this.optionalString(
                input.notes,
              ),
              actor.actorId,
              actor.actorRole,
            ],
          );

        const row = created.rows[0];

        await client.query(
          `
          INSERT INTO admission_audit (
            admission_case_id,
            event_type,
            actor_id,
            actor_role,
            entity_type,
            entity_id
          )
          VALUES (
            $1,
            'CONTACT_ADDED',
            $2,
            $3,
            'ADMISSION_CONTACT',
            $4
          )
          `,
          [
            admissionCaseId,
            actor.actorId,
            actor.actorRole,
            row.admission_contact_id,
          ],
        );

        return row;
      },
    );
  }
}

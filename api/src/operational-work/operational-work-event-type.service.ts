import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';

import { DatabaseService } from '../database/database.service';

type HumanRole =
  | 'CAREGIVER'
  | 'NURSE'
  | 'CARE_MANAGER'
  | 'SUPERVISOR';

interface ActorRow {
  primary_operational_role: HumanRole;
  status: string;
}

export interface WorkEventTypeRecord {
  work_event_type_id: string;
  code: string;
  display_name_vi: string;
  category: string;
  default_unit: string;
  default_work_weight: string | number;
  resident_related: boolean;
  inventory_link_allowed: boolean;
  active: boolean;
  created_at: Date;
  updated_at: Date;
}

@Injectable()
export class OperationalWorkEventTypeService implements OnModuleInit {
  private readonly defaultLimit = 50;
  private readonly maxLimit = 100;

  constructor(
    private readonly database: DatabaseService,
  ) {}

  async onModuleInit() {
    try {
      await this.database.query(`
        INSERT INTO operational_work_event_types (
          work_event_type_id, code, display_name_vi, category, default_unit, default_work_weight, resident_related, inventory_link_allowed, active
        )
        VALUES
        ('ops-wet-hygiene-bathing', 'HYGIENE_BATHING', 'Tắm rửa & Vệ sinh thân thể', 'PERSONAL_CARE', 'lần', 1, TRUE, TRUE, TRUE),
        ('ops-wet-meal-assistance', 'MEAL_ASSISTANCE', 'Hỗ trợ ăn uống & Bón cháo/cơm', 'NUTRITION', 'bữa', 1, TRUE, FALSE, TRUE),
        ('ops-wet-tube-feeding-assist', 'TUBE_FEEDING_ASSIST', 'Hỗ trợ ăn qua ống thông Sonde', 'NUTRITION', 'cữ', 1, TRUE, TRUE, TRUE),
        ('ops-wet-vital-signs-check', 'VITAL_SIGNS_CHECK', 'Đo dấu hiệu sinh tồn & Huyết áp', 'CLINICAL_CARE', 'lần', 1, TRUE, FALSE, TRUE),
        ('ops-wet-medication-admin', 'MEDICATION_ADMINISTRATION', 'Cấp phát & Cho uống thuốc theo y lệnh', 'CLINICAL_CARE', 'lần', 1, TRUE, FALSE, TRUE),
        ('ops-wet-wound-care', 'WOUND_CARE', 'Thay băng & Chăm sóc vết thương/loét', 'CLINICAL_CARE', 'lần', 1, TRUE, TRUE, TRUE),
        ('ops-wet-mobility-assistance', 'MOBILITY_ASSISTANCE', 'Hỗ trợ di chuyển & Đổi tư thế chống loét', 'MOBILITY', 'lần', 1, TRUE, FALSE, TRUE),
        ('ops-wet-rehab-exercise', 'REHAB_EXERCISE', 'Hướng dẫn tập VLTL & Phục hồi chức năng', 'MOBILITY', 'lần', 1, TRUE, FALSE, TRUE),
        ('ops-wet-psychological-support', 'PSYCHOLOGICAL_SUPPORT', 'Trò chuyện & Tham vấn tâm lý tinh thần', 'PSYCHOSOCIAL', 'lần', 1, TRUE, FALSE, TRUE),
        ('ops-wet-diaper-toileting', 'DIAPER_TOILETING', 'Thay tã bỉm & Vệ sinh bài tiết', 'PERSONAL_CARE', 'lần', 1, TRUE, TRUE, TRUE),
        ('ops-wet-room-cleaning', 'ROOM_CLEANING_INCIDENTAL', 'Dọn dẹp phòng & Thay drap giường đột xuất', 'HOUSEKEEPING', 'lần', 1, TRUE, FALSE, TRUE),
        ('ops-wet-emergency-care', 'EMERGENCY_INCIDENT_CARE', 'Xử lý sự cố / Sơ cứu khẩn cấp', 'EMERGENCY', 'lần', 1, TRUE, FALSE, TRUE),
        ('ops-wet-family-visit', 'FAMILY_VISIT_ASSIST', 'Đón tiếp thân nhân & Hỗ trợ thăm gặp', 'PSYCHOSOCIAL', 'lần', 1, TRUE, FALSE, TRUE),
        ('ops-wet-other-incidental', 'OTHER_INCIDENTAL', 'Khác (Diễn giải chi tiết tại phần Ghi chú)', 'OTHER', 'lần', 1, TRUE, FALSE, TRUE)
        ON CONFLICT (code) DO UPDATE SET
          display_name_vi = EXCLUDED.display_name_vi,
          category = EXCLUDED.category,
          active = TRUE;
      `);
    } catch (err) {
      // Ignored if DB table not yet created during earliest startup
    }
  }

  private async authorize(
    actorId: string | undefined,
    actorRole: string | undefined,
    allowed: HumanRole[],
  ): Promise<{
    actorId: string;
    actorRole: HumanRole;
  }> {
    const id = String(actorId || '').trim();
    const role =
      String(actorRole || '')
        .trim()
        .toUpperCase() as HumanRole;

    if (!id || !role) {
      throw new UnauthorizedException(
        'Actor context is required',
      );
    }

    const validRoles: HumanRole[] = [
      'CAREGIVER',
      'NURSE',
      'CARE_MANAGER',
      'SUPERVISOR',
    ];

    if (!validRoles.includes(role)) {
      throw new ForbiddenException(
        'Human operational role is required',
      );
    }

    const result =
      await this.database.query<ActorRow>(
        `
        SELECT
          primary_operational_role,
          status
        FROM staff_actors
        WHERE actor_id=$1
        LIMIT 1
        `,
        [id],
      );

    const actor = result.rows[0];

    if (!actor || actor.status !== 'ACTIVE') {
      throw new UnauthorizedException(
        'Canonical active human actor is required',
      );
    }

    if (
      actor.primary_operational_role !== role
    ) {
      throw new ForbiddenException(
        'Actor role does not match canonical role',
      );
    }

    if (!allowed.includes(role)) {
      throw new ForbiddenException(
        'Actor is not authorized for this operation',
      );
    }

    return {
      actorId: id,
      actorRole: role,
    };
  }

  private requiredString(
    value: unknown,
    field: string,
  ): string {
    if (
      typeof value !== 'string' ||
      !value.trim()
    ) {
      throw new BadRequestException(
        `${field} is required`,
      );
    }

    return value.trim();
  }

  private optionalBoolean(
    value: unknown,
    fallback: boolean,
    field: string,
  ): boolean {
    if (
      value === undefined ||
      value === null
    ) {
      return fallback;
    }

    if (typeof value !== 'boolean') {
      throw new BadRequestException(
        `${field} must be boolean`,
      );
    }

    return value;
  }

  private workWeight(
    value: unknown,
  ): number {
    if (
      value === undefined ||
      value === null ||
      value === ''
    ) {
      return 1;
    }

    if (
      typeof value !== 'number' ||
      !Number.isFinite(value) ||
      value <= 0
    ) {
      throw new BadRequestException(
        'defaultWorkWeight must be a positive number',
      );
    }

    return value;
  }

  boundLimit(
    raw?: string,
  ): number {
    if (
      raw === undefined ||
      raw.trim() === ''
    ) {
      return this.defaultLimit;
    }

    if (!/^\d+$/.test(raw)) {
      throw new BadRequestException(
        'limit must be an integer',
      );
    }

    const limit = Number(raw);

    if (
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > this.maxLimit
    ) {
      throw new BadRequestException(
        `limit must be between 1 and ${this.maxLimit}`,
      );
    }

    return limit;
  }

  async list(
    actorId: string | undefined,
    actorRole: string | undefined,
    rawLimit?: string,
    active?: string,
  ) {
    await this.authorize(
      actorId,
      actorRole,
      [
        'CAREGIVER',
        'NURSE',
        'CARE_MANAGER',
        'SUPERVISOR',
      ],
    );

    const limit = this.boundLimit(rawLimit);

    let activeFilter: boolean | null = null;

    if (
      active !== undefined &&
      active !== '' &&
      active.toLowerCase() !== 'all'
    ) {
      if (
        active.toLowerCase() !== 'true' &&
        active.toLowerCase() !== 'false'
      ) {
        throw new BadRequestException(
          'active must be true, false, or all',
        );
      }

      activeFilter =
        active.toLowerCase() === 'true';
    }

    const result =
      await this.database.query<WorkEventTypeRecord>(
        `
        SELECT
          work_event_type_id,
          code,
          display_name_vi,
          category,
          default_unit,
          default_work_weight,
          resident_related,
          inventory_link_allowed,
          active,
          created_at,
          updated_at
        FROM operational_work_event_types
        WHERE (
          $1::boolean IS NULL
          OR active=$1
        )
        ORDER BY
          category ASC,
          display_name_vi ASC,
          code ASC,
          work_event_type_id ASC
        LIMIT $2
        `,
        [
          activeFilter,
          limit,
        ],
      );

    return {
      items: result.rows,
      count: result.rows.length,
      limit,
    };
  }

  async detail(
    actorId: string | undefined,
    actorRole: string | undefined,
    id: string,
  ) {
    await this.authorize(
      actorId,
      actorRole,
      [
        'CAREGIVER',
        'NURSE',
        'CARE_MANAGER',
        'SUPERVISOR',
      ],
    );

    const result =
      await this.database.query<WorkEventTypeRecord>(
        `
        SELECT
          work_event_type_id,
          code,
          display_name_vi,
          category,
          default_unit,
          default_work_weight,
          resident_related,
          inventory_link_allowed,
          active,
          created_at,
          updated_at
        FROM operational_work_event_types
        WHERE work_event_type_id=$1
        LIMIT 1
        `,
        [id],
      );

    const row = result.rows[0];

    if (!row) {
      throw new NotFoundException(
        'Work event type not found',
      );
    }

    return row;
  }

  async create(
    actorId: string | undefined,
    actorRole: string | undefined,
    input: Record<string, unknown>,
  ) {
    const actor =
      await this.authorize(
        actorId,
        actorRole,
        [
          'CARE_MANAGER',
          'SUPERVISOR',
        ],
      );

    const code =
      this.requiredString(
        input.code,
        'code',
      ).toUpperCase();

    const displayNameVi =
      this.requiredString(
        input.displayNameVi,
        'displayNameVi',
      );

    const category =
      this.requiredString(
        input.category,
        'category',
      ).toUpperCase();

    const defaultUnit =
      this.requiredString(
        input.defaultUnit,
        'defaultUnit',
      );

    const defaultWorkWeight =
      this.workWeight(
        input.defaultWorkWeight,
      );

    const residentRelated =
      this.optionalBoolean(
        input.residentRelated,
        true,
        'residentRelated',
      );

    const inventoryLinkAllowed =
      this.optionalBoolean(
        input.inventoryLinkAllowed,
        false,
        'inventoryLinkAllowed',
      );

    const active =
      this.optionalBoolean(
        input.active,
        true,
        'active',
      );

    try {
      return await this.database.withTransaction(
        async (client) => {
          const created =
            await client.query<WorkEventTypeRecord>(
              `
              INSERT INTO operational_work_event_types (
                work_event_type_id,
                code,
                display_name_vi,
                category,
                default_unit,
                default_work_weight,
                resident_related,
                inventory_link_allowed,
                active
              )
              VALUES (
                'work-event-type-' ||
                  gen_random_uuid()::text,
                $1,$2,$3,$4,$5,$6,$7,$8
              )
              RETURNING *
              `,
              [
                code,
                displayNameVi,
                category,
                defaultUnit,
                defaultWorkWeight,
                residentRelated,
                inventoryLinkAllowed,
                active,
              ],
            );

          const row = created.rows[0];

          if (!row) {
            throw new Error(
              'Work event type creation returned no row',
            );
          }

          await client.query(
            `
            INSERT INTO operational_work_event_type_audit (
              event_type,
              target_work_event_type_id,
              performed_by,
              performed_by_role,
              previous_value,
              new_value
            )
            VALUES (
              'WORK_EVENT_TYPE_CREATED',
              $3,
              $1,
              $2,
              NULL,
              jsonb_build_object(
                'workEventTypeId', $3::text,
                'code', $4::text
              )
            )
            `,
            [
              actor.actorId,
              actor.actorRole,
              row.work_event_type_id,
              row.code,
            ],
          );

          return row;
        },
      );
    } catch (error: any) {
      if (
        String(error?.code || '') === '23505'
      ) {
        throw new ConflictException(
          'Work event type code already exists',
        );
      }

      throw error;
    }
  }

  async update(
    actorId: string | undefined,
    actorRole: string | undefined,
    id: string,
    input: Record<string, unknown>,
  ) {
    const actor =
      await this.authorize(
        actorId,
        actorRole,
        [
          'CARE_MANAGER',
          'SUPERVISOR',
        ],
      );

    if (
      Object.prototype.hasOwnProperty.call(
        input,
        'code',
      )
    ) {
      throw new BadRequestException(
        'code is immutable after creation',
      );
    }

    const allowed = new Set([
      'displayNameVi',
      'category',
      'defaultUnit',
      'defaultWorkWeight',
      'residentRelated',
      'inventoryLinkAllowed',
      'active',
    ]);

    for (const key of Object.keys(input)) {
      if (!allowed.has(key)) {
        throw new BadRequestException(
          `Unsupported update field: ${key}`,
        );
      }
    }

    if (Object.keys(input).length === 0) {
      throw new BadRequestException(
        'At least one update field is required',
      );
    }

    return this.database.withTransaction(
      async (client) => {
        const locked =
          await client.query<WorkEventTypeRecord>(
            `
            SELECT *
            FROM operational_work_event_types
            WHERE work_event_type_id=$1
            FOR UPDATE
            `,
            [id],
          );

        const previous = locked.rows[0];

        if (!previous) {
          throw new NotFoundException(
            'Work event type not found',
          );
        }

        const displayNameVi =
          Object.prototype.hasOwnProperty.call(
            input,
            'displayNameVi',
          )
            ? this.requiredString(
                input.displayNameVi,
                'displayNameVi',
              )
            : previous.display_name_vi;

        const category =
          Object.prototype.hasOwnProperty.call(
            input,
            'category',
          )
            ? this.requiredString(
                input.category,
                'category',
              ).toUpperCase()
            : previous.category;

        const defaultUnit =
          Object.prototype.hasOwnProperty.call(
            input,
            'defaultUnit',
          )
            ? this.requiredString(
                input.defaultUnit,
                'defaultUnit',
              )
            : previous.default_unit;

        const defaultWorkWeight =
          Object.prototype.hasOwnProperty.call(
            input,
            'defaultWorkWeight',
          )
            ? this.workWeight(
                input.defaultWorkWeight,
              )
            : Number(
                previous.default_work_weight,
              );

        const residentRelated =
          Object.prototype.hasOwnProperty.call(
            input,
            'residentRelated',
          )
            ? this.optionalBoolean(
                input.residentRelated,
                previous.resident_related,
                'residentRelated',
              )
            : previous.resident_related;

        const inventoryLinkAllowed =
          Object.prototype.hasOwnProperty.call(
            input,
            'inventoryLinkAllowed',
          )
            ? this.optionalBoolean(
                input.inventoryLinkAllowed,
                previous.inventory_link_allowed,
                'inventoryLinkAllowed',
              )
            : previous.inventory_link_allowed;

        const active =
          Object.prototype.hasOwnProperty.call(
            input,
            'active',
          )
            ? this.optionalBoolean(
                input.active,
                previous.active,
                'active',
              )
            : previous.active;

        const updated =
          await client.query<WorkEventTypeRecord>(
            `
            UPDATE operational_work_event_types
            SET
              display_name_vi=$2,
              category=$3,
              default_unit=$4,
              default_work_weight=$5,
              resident_related=$6,
              inventory_link_allowed=$7,
              active=$8,
              updated_at=now()
            WHERE work_event_type_id=$1
            RETURNING *
            `,
            [
              id,
              displayNameVi,
              category,
              defaultUnit,
              defaultWorkWeight,
              residentRelated,
              inventoryLinkAllowed,
              active,
            ],
          );

        const row = updated.rows[0];

        if (!row) {
          throw new NotFoundException(
            'Work event type not found',
          );
        }

        await client.query(
          `
          INSERT INTO operational_work_event_type_audit (
            event_type,
            target_work_event_type_id,
            performed_by,
            performed_by_role,
            previous_value,
            new_value
          )
          VALUES (
            'WORK_EVENT_TYPE_UPDATED',
            $3,
            $1,
            $2,
            jsonb_build_object(
              'workEventTypeId', $3::text,
              'code', $4::text,
              'displayNameVi', $5::text,
              'category', $6::text,
              'defaultUnit', $7::text,
              'defaultWorkWeight', $8::numeric,
              'residentRelated', $9::boolean,
              'inventoryLinkAllowed', $10::boolean,
              'active', $11::boolean
            ),
            jsonb_build_object(
              'workEventTypeId', $3::text,
              'code', $4::text,
              'displayNameVi', $12::text,
              'category', $13::text,
              'defaultUnit', $14::text,
              'defaultWorkWeight', $15::numeric,
              'residentRelated', $16::boolean,
              'inventoryLinkAllowed', $17::boolean,
              'active', $18::boolean
            )
          )
          `,
          [
            actor.actorId,
            actor.actorRole,
            row.work_event_type_id,
            row.code,

            previous.display_name_vi,
            previous.category,
            previous.default_unit,
            previous.default_work_weight,
            previous.resident_related,
            previous.inventory_link_allowed,
            previous.active,

            row.display_name_vi,
            row.category,
            row.default_unit,
            row.default_work_weight,
            row.resident_related,
            row.inventory_link_allowed,
            row.active,
          ],
        );

        return row;
      },
    );
  }
}

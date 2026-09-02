import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

import {
  DatabaseService,
} from '../database/database.service';

type HumanRole =
  | 'CAREGIVER'
  | 'NURSE'
  | 'SUPERVISOR';

type Actor = {
  actorId: string;
  actorRole: HumanRole;
};

type Availability =
  | 'AVAILABLE'
  | 'EMPTY'
  | 'UNAVAILABLE';

type SettledDomain = {
  rows: any[];
  availability: Availability;
  total: number;
};

@Injectable()
export class OperationalDashboardService {
  private readonly residentLimit = 50;
  private readonly workQueueLimit = 100;
  private readonly attentionLimit = 100;

  constructor(
    private readonly db: DatabaseService,
  ) {}

  private authorize(
    actorIdInput?: string,
    actorRoleInput?: string,
  ): Actor {
    const actorId =
      String(actorIdInput ?? '').trim();

    const normalizedRole =
      String(actorRoleInput ?? '')
        .trim()
        .toUpperCase();

    if (!actorId || !normalizedRole) {
      throw new UnauthorizedException(
        'Human actor identity and role are required.',
      );
    }

    if (
      normalizedRole === 'AI'
      || normalizedRole === 'SYSTEM'
    ) {
      throw new ForbiddenException(
        'AI / SYSTEM cannot obtain human operational authority.',
      );
    }

    if (
      normalizedRole !== 'CAREGIVER'
      && normalizedRole !== 'NURSE'
      && normalizedRole !== 'SUPERVISOR'
    ) {
      throw new ForbiddenException(
        'Actor is not authorized for operational dashboard.',
      );
    }

    return {
      actorId,
      actorRole:
        normalizedRole as HumanRole,
    };
  }

  private domain(
    result: PromiseSettledResult<any>,
  ): SettledDomain {
    if (result.status === 'rejected') {
      return {
        rows: [],
        availability: 'UNAVAILABLE',
        total: 0,
      };
    }

    const rows =
      Array.isArray(result.value?.rows)
        ? result.value.rows
        : [];

    const total =
      rows.length > 0
        ? Number(
            rows[0]?.total_count
            ?? rows.length,
          )
        : 0;

    return {
      rows,
      availability:
        rows.length > 0
          ? 'AVAILABLE'
          : 'EMPTY',
      total,
    };
  }

  private timestamp(
    value: unknown,
  ): string | null {
    if (!value) {
      return null;
    }

    const date =
      value instanceof Date
        ? value
        : new Date(String(value));

    if (
      Number.isNaN(
        date.getTime(),
      )
    ) {
      return null;
    }

    return date.toISOString();
  }

  private navigationHref(
    residentId: string,
  ): string {
    return (
      '/api/operations/residents/'
      + encodeURIComponent(residentId)
      + '/care-view'
    );
  }

  private taskOperationalState(
    row: any,
    generatedAt: Date,
  ): string {
    const status =
      String(
        row.status ?? '',
      ).toUpperCase();

    if (status === 'MISSED') {
      return 'MISSED';
    }

    const dueAt =
      row.due_at
        ? new Date(row.due_at)
        : null;

    if (
      dueAt
      && !Number.isNaN(dueAt.getTime())
      && dueAt.getTime()
        < generatedAt.getTime()
    ) {
      return 'OVERDUE';
    }

    if (
      dueAt
      && !Number.isNaN(dueAt.getTime())
      && dueAt.getTime()
        >= generatedAt.getTime()
      && dueAt.getTime()
        <= generatedAt.getTime()
          + 24 * 60 * 60 * 1000
    ) {
      return 'DUE';
    }

    if (status === 'IN_PROGRESS') {
      return 'IN_PROGRESS';
    }

    if (status === 'ASSIGNED') {
      return 'ASSIGNED';
    }

    if (row.scheduled_at) {
      return 'SCHEDULED';
    }

    return 'PLANNED';
  }

  private taskStateRank(
    state: string,
  ): number {
    const ranks: Record<string, number> = {
      MISSED: 1,
      OVERDUE: 2,
      DUE: 3,
      IN_PROGRESS: 4,
      ASSIGNED: 5,
      SCHEDULED: 6,
      PLANNED: 7,
    };

    return ranks[state] ?? 99;
  }

  private priorityRank(
    priorityInput: unknown,
  ): number {
    const priority =
      String(
        priorityInput ?? '',
      ).toUpperCase();

    const ranks: Record<string, number> = {
      HIGH: 1,
      MODERATE: 2,
      LOW: 3,
    };

    return ranks[priority] ?? 99;
  }

  private attentionRank(
    code: string,
  ): number {
    const ranks: Record<string, number> = {
      INCIDENT_CRITICAL: 1,
      INCIDENT_HIGH: 2,
      MEDICATION_ADMIN_MISSED: 3,
      TASK_MISSED: 4,
      TASK_OVERDUE: 5,
      CLINICAL_ABNORMAL_FLAG: 6,
      MEDICATION_ADMIN_REFUSED: 7,
      MEDICATION_ADMIN_HELD: 8,
      MEDICATION_HIGH_RISK: 9,
      MEDICATION_DOUBLE_CHECK_REQUIRED: 10,
      CLINICAL_REVIEW_PENDING: 11,
      INCIDENT_OPEN: 12,
    };

    return ranks[code] ?? 99;
  }

  async getDashboard(
    actorIdInput?: string,
    actorRoleInput?: string,
  ) {
    const actor =
      this.authorize(
        actorIdInput,
        actorRoleInput,
      );

    const generatedAt =
      new Date();

    const [
      residentResult,
      taskResult,
      clinicalResult,
      medicationOrderResult,
      medicationAdministrationResult,
      incidentResult,
    ] = await Promise.allSettled([
      this.db.query(
        `
          SELECT
            resident_id,
            resident_code,
            display_name,
            room,
            bed,
            care_level,
            active_status,
            updated_at,
            COUNT(*) OVER() AS total_count
          FROM residents
          WHERE active_status = true
          ORDER BY
            room ASC NULLS LAST,
            bed ASC NULLS LAST,
            display_name ASC,
            resident_id ASC
          LIMIT $1
        `,
        [
          this.residentLimit + 1,
        ],
      ),

      this.db.query(
        `
          SELECT
            ct.care_task_id,
            ct.resident_id,
            ct.task_code,
            ct.title,
            ct.task_category,
            ct.status,
            ct.priority,
            ct.scheduled_at,
            ct.due_at,
            ct.assigned_to,
            ct.assigned_role,
            ct.updated_at,
            r.display_name,
            COUNT(*) OVER() AS total_count
          FROM care_tasks ct
          JOIN residents r
            ON r.resident_id =
              ct.resident_id
          WHERE
            r.active_status = true
            AND ct.status NOT IN (
              'COMPLETED',
              'SKIPPED',
              'CANCELLED'
            )
          ORDER BY
            CASE
              WHEN ct.status = 'MISSED'
                THEN 1
              WHEN
                ct.due_at IS NOT NULL
                AND ct.due_at < $1
                THEN 2
              WHEN
                ct.due_at IS NOT NULL
                AND ct.due_at >= $1
                AND ct.due_at
                  <= $1
                    + INTERVAL '24 hours'
                THEN 3
              WHEN ct.status = 'IN_PROGRESS'
                THEN 4
              WHEN ct.status = 'ASSIGNED'
                THEN 5
              WHEN ct.scheduled_at IS NOT NULL
                THEN 6
              ELSE 7
            END ASC,
            CASE ct.priority
              WHEN 'HIGH' THEN 1
              WHEN 'MODERATE' THEN 2
              WHEN 'LOW' THEN 3
              ELSE 99
            END ASC,
            ct.due_at ASC NULLS LAST,
            ct.scheduled_at ASC NULLS LAST,
            ct.updated_at DESC,
            ct.care_task_id ASC
          LIMIT $2
        `,
        [
          generatedAt,
          this.workQueueLimit + 1,
        ],
      ),

      this.db.query(
        `
          SELECT
            co.clinical_observation_id,
            co.resident_id,
            co.status,
            co.abnormal_flag,
            co.verified_at,
            co.measured_at,
            co.updated_at,
            r.display_name,
            COUNT(*) OVER() AS total_count
          FROM clinical_observations co
          JOIN residents r
            ON r.resident_id =
              co.resident_id
          WHERE
            r.active_status = true
            AND (
              co.abnormal_flag = true
              OR (
                co.status = 'RECORDED'
                AND co.verified_at IS NULL
              )
            )
          ORDER BY
            co.measured_at ASC,
            co.clinical_observation_id ASC
          LIMIT $1
        `,
        [
          this.attentionLimit + 1,
        ],
      ),

      this.db.query(
        `
          SELECT
            mo.medication_order_id,
            mo.resident_id,
            mo.status,
            mo.high_risk,
            mo.double_check_required,
            mo.prescribed_at,
            mo.updated_at,
            r.display_name,
            COUNT(*) OVER() AS total_count
          FROM medication_orders mo
          JOIN residents r
            ON r.resident_id =
              mo.resident_id
          WHERE
            r.active_status = true
            AND (
              mo.high_risk = true
              OR mo.double_check_required = true
            )
          ORDER BY
            mo.prescribed_at ASC,
            mo.medication_order_id ASC
          LIMIT $1
        `,
        [
          this.attentionLimit + 1,
        ],
      ),

      this.db.query(
        `
          SELECT
            ma.medication_administration_id,
            ma.resident_id,
            ma.status,
            ma.scheduled_at,
            ma.updated_at,
            r.display_name,
            COUNT(*) OVER() AS total_count
          FROM medication_administrations ma
          JOIN residents r
            ON r.resident_id =
              ma.resident_id
          WHERE
            r.active_status = true
            AND ma.status IN (
              'MISSED',
              'REFUSED',
              'HELD'
            )
          ORDER BY
            ma.scheduled_at ASC,
            ma.medication_administration_id ASC
          LIMIT $1
        `,
        [
          this.attentionLimit + 1,
        ],
      ),

      this.db.query(
        `
          SELECT
            i.incident_id,
            i.resident_id,
            i.status,
            i.current_severity,
            i.discovered_at,
            i.updated_at,
            r.display_name,
            COUNT(*) OVER() AS total_count
          FROM incidents i
          JOIN residents r
            ON r.resident_id =
              i.resident_id
          WHERE
            r.active_status = true
            AND i.status NOT IN (
              'RESOLVED',
              'CLOSED',
              'VOIDED'
            )
          ORDER BY
            CASE i.current_severity
              WHEN 'CRITICAL' THEN 1
              WHEN 'HIGH' THEN 2
              ELSE 3
            END ASC,
            i.discovered_at ASC,
            i.incident_id ASC
          LIMIT $1
        `,
        [
          this.attentionLimit + 1,
        ],
      ),
    ]);

    const residentsDomain =
      this.domain(residentResult);

    const tasksDomain =
      this.domain(taskResult);

    const clinicalDomain =
      this.domain(clinicalResult);

    const medOrdersDomain =
      this.domain(
        medicationOrderResult,
      );

    const medAdminsDomain =
      this.domain(
        medicationAdministrationResult,
      );

    const incidentsDomain =
      this.domain(incidentResult);

    const residents =
      residentsDomain.rows
        .slice(
          0,
          this.residentLimit,
        )
        .map(
          (row: any) => ({
            residentId:
              row.resident_id,
            residentCode:
              row.resident_code,
            displayName:
              row.display_name,
            room:
              row.room ?? null,
            bed:
              row.bed ?? null,
            careLevel:
              row.care_level,
            activeStatus:
              row.active_status,
            navigationHref:
              this.navigationHref(
                row.resident_id,
              ),
          }),
        );

    const workQueue =
      tasksDomain.rows
        .slice(
          0,
          this.workQueueLimit,
        )
        .map(
          (row: any) => {
            const operationalState =
              this.taskOperationalState(
                row,
                generatedAt,
              );

            return {
              type: 'CARE_TASK',
              residentId:
                row.resident_id,
              sourceRecordId:
                row.care_task_id,
              taskCode:
                row.task_code,
              title:
                row.title,
              taskCategory:
                row.task_category,
              sourceStatus:
                row.status,
              sourcePriority:
                row.priority,
              scheduledAt:
                this.timestamp(
                  row.scheduled_at,
                ),
              dueAt:
                this.timestamp(
                  row.due_at,
                ),
              assignedTo:
                row.assigned_to
                  ?? null,
              assignedRole:
                row.assigned_role
                  ?? null,
              operationalState,
              sourceTimestamp:
                this.timestamp(
                  row.updated_at,
                ),
              navigationHref:
                this.navigationHref(
                  row.resident_id,
                ),
              provenance:
                'care_tasks',
            };
          },
        );

    workQueue.sort(
      (
        a: any,
        b: any,
      ) => {
        const state =
          this.taskStateRank(
            a.operationalState,
          )
          - this.taskStateRank(
            b.operationalState,
          );

        if (state !== 0) {
          return state;
        }

        const priority =
          this.priorityRank(
            a.sourcePriority,
          )
          - this.priorityRank(
            b.sourcePriority,
          );

        if (priority !== 0) {
          return priority;
        }

        const dueA =
          a.dueAt
            ? new Date(a.dueAt).getTime()
            : Number.MAX_SAFE_INTEGER;

        const dueB =
          b.dueAt
            ? new Date(b.dueAt).getTime()
            : Number.MAX_SAFE_INTEGER;

        if (dueA !== dueB) {
          return dueA - dueB;
        }

        const scheduleA =
          a.scheduledAt
            ? new Date(
                a.scheduledAt,
              ).getTime()
            : Number.MAX_SAFE_INTEGER;

        const scheduleB =
          b.scheduledAt
            ? new Date(
                b.scheduledAt,
              ).getTime()
            : Number.MAX_SAFE_INTEGER;

        if (
          scheduleA
          !== scheduleB
        ) {
          return (
            scheduleA
            - scheduleB
          );
        }

        return String(
          a.sourceRecordId,
        ).localeCompare(
          String(
            b.sourceRecordId,
          ),
        );
      },
    );

    const attention: any[] = [];

    for (
      const row
      of tasksDomain.rows
    ) {
      const operationalState =
        this.taskOperationalState(
          row,
          generatedAt,
        );

      let attentionCode:
        | string
        | null = null;

      if (
        operationalState
        === 'MISSED'
      ) {
        attentionCode =
          'TASK_MISSED';
      } else if (
        operationalState
        === 'OVERDUE'
      ) {
        attentionCode =
          'TASK_OVERDUE';
      }

      if (!attentionCode) {
        continue;
      }

      attention.push({
        type: 'TASK',
        residentId:
          row.resident_id,
        sourceRecordId:
          row.care_task_id,
        sourceStatus:
          row.status,
        sourceTimestamp:
          this.timestamp(
            row.updated_at,
          ),
        attentionCode,
        displayReason:
          attentionCode
            === 'TASK_MISSED'
            ? 'Care task is recorded as missed.'
            : 'Care task is past its recorded due time.',
        navigationHref:
          this.navigationHref(
            row.resident_id,
          ),
        provenance:
          'care_tasks',
      });
    }

    for (
      const row
      of clinicalDomain.rows
    ) {
      if (row.abnormal_flag === true) {
        attention.push({
          type: 'CLINICAL',
          residentId:
            row.resident_id,
          sourceRecordId:
            row.clinical_observation_id,
          sourceStatus:
            row.status,
          sourceTimestamp:
            this.timestamp(
              row.measured_at
              ?? row.updated_at,
            ),
          attentionCode:
            'CLINICAL_ABNORMAL_FLAG',
          displayReason:
            'Existing clinical observation has an abnormal source flag.',
          navigationHref:
            this.navigationHref(
              row.resident_id,
            ),
          provenance:
            'clinical_observations',
        });
      }

      if (
        row.status === 'RECORDED'
        && !row.verified_at
      ) {
        attention.push({
          type: 'CLINICAL',
          residentId:
            row.resident_id,
          sourceRecordId:
            row.clinical_observation_id,
          sourceStatus:
            row.status,
          sourceTimestamp:
            this.timestamp(
              row.measured_at
              ?? row.updated_at,
            ),
          attentionCode:
            'CLINICAL_REVIEW_PENDING',
          displayReason:
            'Recorded clinical observation is not yet verified.',
          navigationHref:
            this.navigationHref(
              row.resident_id,
            ),
          provenance:
            'clinical_observations',
        });
      }
    }

    for (
      const row
      of medOrdersDomain.rows
    ) {
      if (row.high_risk === true) {
        attention.push({
          type:
            'MEDICATION_ORDER',
          residentId:
            row.resident_id,
          sourceRecordId:
            row.medication_order_id,
          sourceStatus:
            row.status,
          sourceTimestamp:
            this.timestamp(
              row.prescribed_at
              ?? row.updated_at,
            ),
          attentionCode:
            'MEDICATION_HIGH_RISK',
          displayReason:
            'Medication order carries an existing high-risk flag.',
          navigationHref:
            this.navigationHref(
              row.resident_id,
            ),
          provenance:
            'medication_orders',
        });
      }

      if (
        row.double_check_required
        === true
      ) {
        attention.push({
          type:
            'MEDICATION_ORDER',
          residentId:
            row.resident_id,
          sourceRecordId:
            row.medication_order_id,
          sourceStatus:
            row.status,
          sourceTimestamp:
            this.timestamp(
              row.prescribed_at
              ?? row.updated_at,
            ),
          attentionCode:
            'MEDICATION_DOUBLE_CHECK_REQUIRED',
          displayReason:
            'Medication order has an existing double-check requirement.',
          navigationHref:
            this.navigationHref(
              row.resident_id,
            ),
          provenance:
            'medication_orders',
        });
      }
    }

    for (
      const row
      of medAdminsDomain.rows
    ) {
      const status =
        String(
          row.status ?? '',
        ).toUpperCase();

      const codeByStatus:
        Record<string, string> = {
          MISSED:
            'MEDICATION_ADMIN_MISSED',
          REFUSED:
            'MEDICATION_ADMIN_REFUSED',
          HELD:
            'MEDICATION_ADMIN_HELD',
        };

      const attentionCode =
        codeByStatus[status];

      if (!attentionCode) {
        continue;
      }

      attention.push({
        type:
          'MEDICATION_ADMINISTRATION',
        residentId:
          row.resident_id,
        sourceRecordId:
          row.medication_administration_id,
        sourceStatus:
          row.status,
        sourceTimestamp:
          this.timestamp(
            row.scheduled_at
            ?? row.updated_at,
          ),
        attentionCode,
        displayReason:
          status === 'MISSED'
            ? 'Medication administration is recorded as missed.'
            : status === 'REFUSED'
              ? 'Medication administration is recorded as refused.'
              : 'Medication administration is recorded as held.',
        navigationHref:
          this.navigationHref(
            row.resident_id,
          ),
        provenance:
          'medication_administrations',
      });
    }

    for (
      const row
      of incidentsDomain.rows
    ) {
      const severity =
        String(
          row.current_severity
          ?? '',
        ).toUpperCase();

      const attentionCode =
        severity === 'CRITICAL'
          ? 'INCIDENT_CRITICAL'
          : severity === 'HIGH'
            ? 'INCIDENT_HIGH'
            : 'INCIDENT_OPEN';

      attention.push({
        type: 'INCIDENT',
        residentId:
          row.resident_id,
        sourceRecordId:
          row.incident_id,
        sourceStatus:
          row.status,
        sourceTimestamp:
          this.timestamp(
            row.discovered_at
            ?? row.updated_at,
          ),
        attentionCode,
        displayReason:
          attentionCode
            === 'INCIDENT_CRITICAL'
            ? 'Open incident has existing CRITICAL severity.'
            : attentionCode
                === 'INCIDENT_HIGH'
              ? 'Open incident has existing HIGH severity.'
              : 'Incident remains operationally open.',
        navigationHref:
          this.navigationHref(
            row.resident_id,
          ),
        provenance:
          'incidents',
      });
    }

    attention.sort(
      (
        a: any,
        b: any,
      ) => {
        const rank =
          this.attentionRank(
            a.attentionCode,
          )
          - this.attentionRank(
            b.attentionCode,
          );

        if (rank !== 0) {
          return rank;
        }

        const timeA =
          a.sourceTimestamp
            ? new Date(
                a.sourceTimestamp,
              ).getTime()
            : Number.MAX_SAFE_INTEGER;

        const timeB =
          b.sourceTimestamp
            ? new Date(
                b.sourceTimestamp,
              ).getTime()
            : Number.MAX_SAFE_INTEGER;

        if (timeA !== timeB) {
          return timeA - timeB;
        }

        const residentOrder =
          String(
            a.residentId,
          ).localeCompare(
            String(
              b.residentId,
            ),
          );

        if (
          residentOrder
          !== 0
        ) {
          return residentOrder;
        }

        return String(
          a.sourceRecordId,
        ).localeCompare(
          String(
            b.sourceRecordId,
          ),
        );
      },
    );

    const trimmedAttention =
      attention.slice(
        0,
        this.attentionLimit,
      );

    const dueTasks =
      workQueue.filter(
        (item: any) =>
          item.operationalState
          === 'DUE',
      ).length;

    const overdueTasks =
      workQueue.filter(
        (item: any) =>
          item.operationalState
          === 'OVERDUE',
      ).length;

    const missedTasks =
      workQueue.filter(
        (item: any) =>
          item.operationalState
          === 'MISSED',
      ).length;

    const clinicalItemsForReview =
      trimmedAttention.filter(
        (item: any) =>
          item.type
          === 'CLINICAL',
      ).length;

    const medicationItemsForAwareness =
      trimmedAttention.filter(
        (item: any) =>
          item.type
            === 'MEDICATION_ORDER'
          || item.type
            === 'MEDICATION_ADMINISTRATION',
      ).length;

    const openIncidents =
      trimmedAttention.filter(
        (item: any) =>
          item.type
          === 'INCIDENT',
      ).length;

    const workQueueAvailable =
      tasksDomain.availability;

    const attentionAvailability:
      Availability =
        clinicalDomain.availability
          === 'UNAVAILABLE'
        || medOrdersDomain.availability
          === 'UNAVAILABLE'
        || medAdminsDomain.availability
          === 'UNAVAILABLE'
        || incidentsDomain.availability
          === 'UNAVAILABLE'
          ? 'UNAVAILABLE'
          : trimmedAttention.length > 0
            ? 'AVAILABLE'
            : 'EMPTY';

    return {
      status: 'OK',
      generatedAt:
        generatedAt.toISOString(),
      mode:
        'OPERATIONAL_READ_ONLY',

      summary: {
        visibleResidents:
          residentsDomain.total,
        openTasks:
          tasksDomain.total,
        dueTasks,
        overdueTasks,
        missedTasks,
        clinicalItemsForReview,
        medicationItemsForAwareness,
        openIncidents,
        attentionItems:
          trimmedAttention.length,
        scope:
          'BOUNDED_OPERATIONAL_OVERVIEW',
      },

      residents,
      workQueue,
      attention:
        trimmedAttention,

      availability: {
        residents:
          residentsDomain.availability,
        workQueue:
          workQueueAvailable,
        attention:
          attentionAvailability,
      },

      provenance: {
        residents:
          'residents',
        workQueue:
          'care_tasks',
        clinicalAttention:
          'clinical_observations',
        medicationOrderAttention:
          'medication_orders',
        medicationAdministrationAttention:
          'medication_administrations',
        incidentAttention:
          'incidents',
        summary:
          'computed',
        ordering:
          'computed',
      },

      authority: {
        readOnly: true,
        crossDomainMutation: false,
        autonomousClinicalAction:
          false,
        autonomousMedicationAction:
          false,
        autonomousIncidentAction:
          false,
        autonomousCareTaskAction:
          false,
        autonomousCarePlanAction:
          false,
      },

      access: {
        actorId:
          actor.actorId,
        actorRole:
          actor.actorRole,
        scope:
          actor.actorRole
            === 'SUPERVISOR'
            ? 'SUPERVISORY'
            : actor.actorRole
                === 'NURSE'
              ? 'CLINICAL_OPERATIONAL'
              : 'OPERATIONAL',
        serverAuthorized: true,
        redactionApplied:
          actor.actorRole
          === 'CAREGIVER',
        residentScopeEnforcement:
          'ROLE_GATE_ONLY',
      },

      limits: {
        residents:
          this.residentLimit,
        workQueue:
          this.workQueueLimit,
        attention:
          this.attentionLimit,
      },

      truncated: {
        residents:
          residentsDomain.total
          > this.residentLimit,
        workQueue:
          tasksDomain.total
          > this.workQueueLimit,
        attention:
          attention.length
          > this.attentionLimit
          || clinicalDomain.total
            > this.attentionLimit
          || medOrdersDomain.total
            > this.attentionLimit
          || medAdminsDomain.total
            > this.attentionLimit
          || incidentsDomain.total
            > this.attentionLimit,
      },
    };
  }
}

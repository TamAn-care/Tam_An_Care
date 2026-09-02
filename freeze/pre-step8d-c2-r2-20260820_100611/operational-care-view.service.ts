import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

import {
  CrossDomainIntegrationService,
} from '../cross-domain-integration/cross-domain-integration.service';

type ActorInput = {
  actorId?: string;
  actorRole?: string;
};

type HumanRole =
  | 'CAREGIVER'
  | 'NURSE'
  | 'SUPERVISOR';

type OperationalScope =
  | 'OPERATIONAL'
  | 'CLINICAL'
  | 'SUPERVISORY';

type Availability =
  | 'AVAILABLE'
  | 'EMPTY'
  | 'UNAVAILABLE';

@Injectable()
export class OperationalCareViewService {
  constructor(
    private readonly integration:
      CrossDomainIntegrationService,
  ) {}

  private authorize(
    actor: ActorInput,
  ): {
    actorId: string;
    actorRole: HumanRole;
    scope: OperationalScope;
  } {
    const actorId =
      String(actor.actorId ?? '').trim();

    const normalizedRole =
      String(actor.actorRole ?? '')
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
        'AI or SYSTEM cannot obtain human care-view authority.',
      );
    }

    if (
      normalizedRole !== 'CAREGIVER'
      && normalizedRole !== 'NURSE'
      && normalizedRole !== 'SUPERVISOR'
    ) {
      throw new ForbiddenException(
        'Actor is not authorized for resident care view.',
      );
    }

    const actorRole =
      normalizedRole as HumanRole;

    const scope: OperationalScope =
      actorRole === 'SUPERVISOR'
        ? 'SUPERVISORY'
        : actorRole === 'NURSE'
          ? 'CLINICAL'
          : 'OPERATIONAL';

    return {
      actorId,
      actorRole,
      scope,
    };
  }

  private availability(
    source: unknown,
  ): Availability {
    if (source === 'AVAILABLE') {
      return 'AVAILABLE';
    }

    if (source === 'EMPTY') {
      return 'EMPTY';
    }

    return 'UNAVAILABLE';
  }

  private latestTimestamp(
    values: unknown[],
  ): string | null {
    const timestamps =
      values
        .filter(
          value =>
            typeof value === 'string'
            && !Number.isNaN(
              Date.parse(value),
            ),
        )
        .map(value => String(value))
        .sort(
          (a, b) =>
            Date.parse(b)
            - Date.parse(a),
        );

    return timestamps[0] ?? null;
  }

  private collectionTimestamp(
    items: any[],
    fields: string[],
  ): string | null {
    const values: unknown[] = [];

    for (const item of items) {
      for (const field of fields) {
        if (
          item
          && item[field] !== null
          && item[field] !== undefined
        ) {
          values.push(item[field]);
        }
      }
    }

    return this.latestTimestamp(values);
  }

  private residentDto(
    row: any,
    role: HumanRole,
  ) {
    return {
      residentId:
        row.resident_id,
      residentCode:
        row.resident_code,
      displayName:
        row.display_name,

      dateOfBirth:
        role === 'CAREGIVER'
          ? undefined
          : row.date_of_birth,

      gender:
        row.gender,
      room:
        row.room,
      bed:
        row.bed,
      careLevel:
        row.care_level,
      activeStatus:
        row.active_status,
      updatedAt:
        row.updated_at,
    };
  }

  private carePlanDto(
    row: any,
  ) {
    return {
      carePlanId:
        row.care_plan_id,
      planCode:
        row.plan_code,
      title:
        row.title,
      status:
        row.status,
      effectiveFrom:
        row.effective_from,
      effectiveTo:
        row.effective_to,
      createdBy:
        row.created_by,
      createdByRole:
        row.created_by_role,
      approvedBy:
        row.approved_by,
      approvedByRole:
        row.approved_by_role,
      approvedAt:
        row.approved_at,
      updatedAt:
        row.updated_at,
    };
  }

  private careTaskDto(
    row: any,
  ) {
    return {
      careTaskId:
        row.care_task_id,
      carePlanId:
        row.care_plan_id,
      taskCode:
        row.task_code,
      title:
        row.title,
      taskCategory:
        row.task_category,
      status:
        row.status,
      priority:
        row.priority,
      scheduledAt:
        row.scheduled_at,
      dueAt:
        row.due_at,
      assignedTo:
        row.assigned_to,
      assignedRole:
        row.assigned_role,
      acceptedAt:
        row.accepted_at,
      startedAt:
        row.started_at,
      completedAt:
        row.completed_at,
      missedAt:
        row.missed_at,
      skippedAt:
        row.skipped_at,
      cancelledAt:
        row.cancelled_at,
      updatedAt:
        row.updated_at,
    };
  }

  private clinicalDto(
    row: any,
    role: HumanRole,
  ) {
    const base = {
      clinicalObservationId:
        row.clinical_observation_id,
      observationCode:
        row.observation_code,
      observationType:
        row.observation_type,
      unit:
        row.unit,
      measuredAt:
        row.measured_at,
      recordedAt:
        row.recorded_at,
      status:
        row.status,
      abnormalFlag:
        row.abnormal_flag,
      verifiedAt:
        row.verified_at,
    };

    if (role === 'CAREGIVER') {
      return base;
    }

    return {
      ...base,
      numericValue:
        row.numeric_value,
      textValue:
        row.text_value,
      recordedBy:
        row.recorded_by,
      recordedByRole:
        row.recorded_by_role,
      verifiedBy:
        row.verified_by,
      verifiedByRole:
        row.verified_by_role,
    };
  }

  private medicationOrderDto(
    row: any,
    role: HumanRole,
  ) {
    const common = {
      medicationOrderId:
        row.medication_order_id,
      orderCode:
        row.order_code,
      medicationName:
        row.medication_name,
      route:
        row.route,
      frequency:
        row.frequency,
      prescribedAt:
        row.prescribed_at,
      effectiveFrom:
        row.effective_from,
      effectiveTo:
        row.effective_to,
      highRisk:
        row.high_risk,
      doubleCheckRequired:
        row.double_check_required,
      status:
        row.status,
      verifiedAt:
        row.verified_at,
      updatedAt:
        row.updated_at,
    };

    if (role === 'CAREGIVER') {
      return common;
    }

    return {
      ...common,
      genericName:
        row.generic_name,
      strength:
        row.strength,
      dose:
        row.dose,
      doseUnit:
        row.dose_unit,
      instructions:
        row.instructions,
      indication:
        row.indication,
      prescriberName:
        row.prescriber_name,
      verifiedBy:
        row.verified_by,
      verifiedByRole:
        row.verified_by_role,
    };
  }

  private medicationAdministrationDto(
    row: any,
    role: HumanRole,
  ) {
    const common = {
      medicationAdministrationId:
        row.medication_administration_id,
      medicationScheduleId:
        row.medication_schedule_id,
      medicationOrderId:
        row.medication_order_id,
      administrationCode:
        row.administration_code,
      status:
        row.status,
      scheduledAt:
        row.scheduled_at,
      assignedTo:
        row.assigned_to,
      assignedRole:
        row.assigned_role,
      acceptedAt:
        row.accepted_at,
      readyAt:
        row.ready_at,
      administeredAt:
        row.administered_at,
      missedAt:
        row.missed_at,
      refusedAt:
        row.refused_at,
      heldAt:
        row.held_at,
      cancelledAt:
        row.cancelled_at,
      updatedAt:
        row.updated_at,
    };

    if (role === 'CAREGIVER') {
      return common;
    }

    return {
      ...common,
      administrationNote:
        row.administration_note,
      exceptionReason:
        row.exception_reason,
    };
  }

  private incidentDto(
    row: any,
    role: HumanRole,
  ) {
    const common = {
      incidentId:
        row.incident_id,
      incidentCode:
        row.incident_code,
      incidentType:
        row.incident_type,
      title:
        row.title,
      occurredAt:
        row.occurred_at,
      discoveredAt:
        row.discovered_at,
      location:
        row.location,
      status:
        row.status,
      currentSeverity:
        row.current_severity,
      assignedTo:
        row.assigned_to,
      assignedRole:
        row.assigned_role,
      assignedAt:
        row.assigned_at,
      acknowledgedAt:
        row.acknowledged_at,
      responseStartedAt:
        row.response_started_at,
      resolvedAt:
        row.resolved_at,
      closedAt:
        row.closed_at,
      updatedAt:
        row.updated_at,
    };

    if (role === 'CAREGIVER') {
      return common;
    }

    return {
      ...common,
      description:
        row.description,
      reportedBy:
        row.reported_by,
      reportedByRole:
        row.reported_by_role,
      reportedAt:
        row.reported_at,
      resolutionSummary:
        row.resolution_summary,
    };
  }

  async getResidentCareView(
    residentId: string,
    actorInput: ActorInput,
  ) {
    const actor =
      this.authorize(actorInput);

    const source: any =
      await this.integration
        .residentOverview(residentId);

    const generatedAt =
      new Date().toISOString();

    const resident =
      this.residentDto(
        source.data.resident,
        actor.actorRole,
      );

    const carePlans =
      Array.isArray(
        source.data.carePlans,
      )
        ? source.data.carePlans
        : [];

    const careTasks =
      Array.isArray(
        source.data.careTasks,
      )
        ? source.data.careTasks
        : [];

    const clinicalRows =
      Array.isArray(
        source.data.clinicalObservations,
      )
        ? source.data.clinicalObservations
        : [];

    const medicationRows =
      Array.isArray(
        source.data.medication,
      )
        ? source.data.medication
        : [];

    const incidentRows =
      Array.isArray(
        source.data.incidents,
      )
        ? source.data.incidents
        : [];

    const medicationOrders =
      medicationRows.filter(
        (item: any) =>
          item.recordType === 'ORDER',
      );

    const medicationAdministrations =
      medicationRows.filter(
        (item: any) =>
          item.recordType
          === 'ADMINISTRATION',
      );

    const carePlan =
      carePlans.length > 0
        ? this.carePlanDto(
            carePlans[0],
          )
        : null;

    const workQueue =
      careTasks.map(
        (row: any) =>
          this.careTaskDto(row),
      );

    const clinical =
      clinicalRows.map(
        (row: any) =>
          this.clinicalDto(
            row,
            actor.actorRole,
          ),
      );

    const medication = {
      orders:
        medicationOrders.map(
          (row: any) =>
            this.medicationOrderDto(
              row,
              actor.actorRole,
            ),
        ),

      administrations:
        medicationAdministrations.map(
          (row: any) =>
            this.medicationAdministrationDto(
              row,
              actor.actorRole,
            ),
        ),
    };

    const incidents =
      incidentRows.map(
        (row: any) =>
          this.incidentDto(
            row,
            actor.actorRole,
          ),
      );

    const medicationSourceAvailability =
      this.availability(
        source.availability.medication,
      );

    const medicationOrdersAvailability:
      Availability =
      medicationSourceAvailability
        === 'UNAVAILABLE'
        ? 'UNAVAILABLE'
        : medicationOrders.length > 0
          ? 'AVAILABLE'
          : 'EMPTY';

    const medicationAdministrationsAvailability:
      Availability =
      medicationSourceAvailability
        === 'UNAVAILABLE'
        ? 'UNAVAILABLE'
        : medicationAdministrations.length > 0
          ? 'AVAILABLE'
          : 'EMPTY';

    return {
      status: 'OK',
      generatedAt,
      viewMode:
        'OPERATIONAL_READ_ONLY',

      resident,
      carePlan,
      workQueue,
      clinical,
      medication,
      incidents,

      availability: {
        resident:
          'AVAILABLE' as const,

        carePlan:
          this.availability(
            source.availability.carePlans,
          ),

        workQueue:
          this.availability(
            source.availability.careTasks,
          ),

        clinical:
          this.availability(
            source.availability
              .clinicalObservations,
          ),

        medicationOrders:
          medicationOrdersAvailability,

        medicationAdministrations:
          medicationAdministrationsAvailability,

        incidents:
          this.availability(
            source.availability.incidents,
          ),
      },

      freshness: {
        resident: {
          sourceTimestamp:
            source.data.resident.updated_at
            ?? null,
          generatedAt,
        },

        carePlan: {
          sourceTimestamp:
            this.collectionTimestamp(
              carePlans,
              ['updated_at'],
            ),
          generatedAt,
        },

        workQueue: {
          sourceTimestamp:
            this.collectionTimestamp(
              careTasks,
              ['updated_at'],
            ),
          generatedAt,
        },

        clinical: {
          sourceTimestamp:
            this.collectionTimestamp(
              clinicalRows,
              [
                'measured_at',
                'recorded_at',
                'updated_at',
              ],
            ),
          generatedAt,
        },

        medicationOrders: {
          sourceTimestamp:
            this.collectionTimestamp(
              medicationOrders,
              ['updated_at'],
            ),
          generatedAt,
        },

        medicationAdministrations: {
          sourceTimestamp:
            this.collectionTimestamp(
              medicationAdministrations,
              [
                'administered_at',
                'updated_at',
              ],
            ),
          generatedAt,
        },

        incidents: {
          sourceTimestamp:
            this.collectionTimestamp(
              incidentRows,
              ['updated_at'],
            ),
          generatedAt,
        },
      },

      provenance: {
        resident:
          source.provenance.resident,
        carePlan:
          source.provenance.carePlans,
        workQueue:
          source.provenance.careTasks,
        clinical:
          source.provenance
            .clinicalObservations,
        medicationOrders:
          source.provenance
            .medicationOrders,
        medicationAdministrations:
          source.provenance
            .medicationAdministrations,
        incidents:
          source.provenance.incidents,
        operationalMetadata:
          'computed',
      },

      authority: {
        readOnly: true,
        crossDomainMutation: false,
        autonomousClinicalAction: false,
        autonomousMedicationAction: false,
        autonomousIncidentAction: false,
        autonomousCarePlanAction: false,
        autonomousCareTaskAction: false,
      },

      access: {
        actorRole:
          actor.actorRole,
        scope:
          actor.scope,
        serverAuthorized: true,

        residentScopeEnforcement:
          'ROLE_GATE_ONLY',

        redactionApplied:
          actor.actorRole
            === 'CAREGIVER',
      },

      limits: {
        perSourceDomain:
          source.limits.perDomain,
      },
    };
  }
}

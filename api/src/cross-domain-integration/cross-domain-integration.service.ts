import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  DatabaseService,
} from '../database/database.service';

type Availability =
  | 'AVAILABLE'
  | 'EMPTY'
  | 'ERROR';

type DomainRead<T = any> = {
  availability: Availability;
  items: T[];
  error?: 'READ_FAILED';
};

@Injectable()
export class CrossDomainIntegrationService {
  private readonly limit = 20;

  constructor(
    private readonly db: DatabaseService,
  ) {}

  private async read(
    sql: string,
    params: unknown[],
  ): Promise<any[]> {
    const result =
      await this.db.query(sql, params);

    return result.rows;
  }

  private normalize(
    result: PromiseSettledResult<any[]>,
  ): DomainRead {
    if (result.status === 'rejected') {
      return {
        availability: 'ERROR',
        items: [],
        error: 'READ_FAILED',
      };
    }

    return {
      availability:
        result.value.length > 0
          ? 'AVAILABLE'
          : 'EMPTY',
      items: result.value,
    };
  }

  async residentOverview(
    residentId: string,
  ) {
    const residentResult =
      await this.db.query(
        `
          SELECT
            resident_id,
            resident_code,
            display_name,
            date_of_birth,
            gender,
            room,
            bed,
            care_level,
            active_status,
            created_at,
            updated_at
          FROM residents
          WHERE resident_id = $1
          LIMIT 1
        `,
        [residentId],
      );

    if (residentResult.rows.length !== 1) {
      throw new NotFoundException(
        'Resident not found',
      );
    }

    const [
      carePlansResult,
      careTasksResult,
      clinicalResult,
      medicationOrdersResult,
      medicationAdministrationsResult,
      incidentsResult,
      assignedStaffResult,
    ] = await Promise.allSettled([
      this.read(
        `
          SELECT *
          FROM care_plans
          WHERE resident_id = $1
          ORDER BY updated_at DESC
          LIMIT $2
        `,
        [residentId, this.limit],
      ),

      this.read(
        `
          SELECT *
          FROM care_tasks
          WHERE resident_id = $1
          ORDER BY updated_at DESC
          LIMIT $2
        `,
        [residentId, this.limit],
      ),

      this.read(
        `
          SELECT *
          FROM clinical_observations
          WHERE resident_id = $1
          ORDER BY measured_at DESC
          LIMIT $2
        `,
        [residentId, this.limit],
      ),

      this.read(
        `
          SELECT *
          FROM medication_orders
          WHERE resident_id = $1
          ORDER BY prescribed_at DESC
          LIMIT $2
        `,
        [residentId, this.limit],
      ),

      this.read(
        `
          SELECT *
          FROM medication_administrations
          WHERE resident_id = $1
          ORDER BY scheduled_at DESC
          LIMIT $2
        `,
        [residentId, this.limit],
      ),

      this.read(
        `
          SELECT *
          FROM incidents
          WHERE resident_id = $1
          ORDER BY
            COALESCE(
              occurred_at,
              discovered_at,
              created_at
            ) DESC
          LIMIT $2
        `,
        [residentId, this.limit],
      ),

      this.read(
        `
          SELECT
            a.resident_access_assignment_id,
            a.actor_id,
            a.actor_role,
            a.status,
            a.created_at,
            s.display_name AS staff_name,
            s.staff_code,
            s.primary_operational_role
          FROM resident_access_assignments a
          LEFT JOIN staff_actors s ON a.actor_id = s.actor_id
          WHERE a.resident_id = $1 AND a.status = 'ACTIVE'
          ORDER BY a.created_at DESC
          LIMIT 5
        `,
        [residentId],
      ),
    ]);

    const carePlans =
      this.normalize(carePlansResult);

    const careTasks =
      this.normalize(careTasksResult);

    const clinicalObservations =
      this.normalize(clinicalResult);

    const medicationOrders =
      this.normalize(
        medicationOrdersResult,
      );

    const medicationAdministrations =
      this.normalize(
        medicationAdministrationsResult,
      );

    const incidents =
      this.normalize(incidentsResult);

    const assignedStaff =
      this.normalize(assignedStaffResult);

    const medicationItems = [
      ...medicationOrders.items.map(
        item => ({
          recordType: 'ORDER',
          ...item,
        }),
      ),
      ...medicationAdministrations.items.map(
        item => ({
          recordType: 'ADMINISTRATION',
          ...item,
        }),
      ),
    ];

    const medicationAvailability:
      Availability =
      medicationOrders.availability === 'ERROR'
      || medicationAdministrations.availability === 'ERROR'
        ? 'ERROR'
        : medicationItems.length > 0
          ? 'AVAILABLE'
          : 'EMPTY';

    return {
      status: 'OK',
      generatedAt:
        new Date().toISOString(),

      integrationMode: 'READ_ONLY',

      data: {
        resident:
          residentResult.rows[0],

        assignedStaff:
          assignedStaff.items[0] || null,

        assignedStaffList:
          assignedStaff.items,

        carePlans:
          carePlans.items,

        careTasks:
          careTasks.items,

        clinicalObservations:
          clinicalObservations.items,

        medication:
          medicationItems,

        incidents:
          incidents.items,
      },

      availability: {
        resident: 'AVAILABLE',
        carePlans:
          carePlans.availability,
        careTasks:
          careTasks.availability,
        clinicalObservations:
          clinicalObservations.availability,
        medication:
          medicationAvailability,
        incidents:
          incidents.availability,
      },

      provenance: {
        resident: 'residents',
        carePlans: 'care_plans',
        careTasks: 'care_tasks',
        clinicalObservations:
          'clinical_observations',
        medicationOrders:
          'medication_orders',
        medicationAdministrations:
          'medication_administrations',
        incidents: 'incidents',
      },

      authority: {
        readOnly: true,
        crossDomainMutation: false,
        autonomousClinicalAction: false,
        autonomousMedicationAction: false,
        autonomousIncidentAction: false,
      },

      limits: {
        perDomain: this.limit,
      },
    };
  }
}

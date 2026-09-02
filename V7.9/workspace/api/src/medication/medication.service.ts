import {
  Injectable,
} from '@nestjs/common';

import {
  randomUUID,
} from 'crypto';

import {
  DatabaseService,
} from '../database/database.service';

import {
  MedicationAuthorizationService,
} from './medication-authorization.service';

import {
  MedicationRepository,
} from './medication.repository';

import {
  MedicationAdministrationAction,
  MedicationAdministrationInput,
  MedicationAdministrationResult,
} from './medication.types';

@Injectable()
export class MedicationService {

  constructor(
    private readonly db:
      DatabaseService,

    private readonly repository:
      MedicationRepository,

    private readonly authorization:
      MedicationAuthorizationService,
  ) {}


  async mutateAdministration(
    administrationId: string,
    action:
      MedicationAdministrationAction,
    input:
      MedicationAdministrationInput,
  ): Promise<
    MedicationAdministrationResult
  > {

    const normalizedId =
      String(
        administrationId ?? '',
      ).trim();

    if (!normalizedId) {
      throw new Error(
        'medicationAdministrationId is required.',
      );
    }

    const actorId =
      String(
        input.actorId ?? '',
      ).trim();

    const actorRole =
      String(
        input.actorRole ?? '',
      )
        .trim()
        .toUpperCase();

    return this.db.withTransaction(
      async client => {

        const current =
          await this.repository
            .findAdministrationForUpdate(
              client,
              normalizedId,
            );

        if (!current) {
          throw new Error(
            'Medication Administration not found.',
          );
        }

        this.authorization.authorize(
          action,
          current,
          input,
        );

        const previousState = {
          status:
            current.status,

          assignedTo:
            current.assigned_to,

          assignedRole:
            current.assigned_role,

          assignedAt:
            current.assigned_at,

          acceptedAt:
            current.accepted_at,

          readyAt:
            current.ready_at,

          administeredAt:
            current.administered_at,

          missedAt:
            current.missed_at,

          refusedAt:
            current.refused_at,

          heldAt:
            current.held_at,

          cancelledAt:
            current.cancelled_at,
        };

        let eventType = '';
        let updated: any = current;

        if (action === 'ASSIGN') {

          const result =
            await client.query(
              `
              UPDATE medication_administrations
              SET
                status = 'ASSIGNED',
                assigned_to = $2,
                assigned_role = $3,
                assigned_at = now(),
                updated_at = now()
              WHERE medication_administration_id = $1
              RETURNING *
              `,
              [
                normalizedId,
                String(
                  input.assignedTo,
                ).trim(),
                String(
                  input.assignedRole,
                )
                  .trim()
                  .toUpperCase(),
              ],
            );

          updated = result.rows[0];
          eventType =
            'MED_ADMIN_ASSIGNED';
        }


        if (action === 'ACCEPT') {

          const result =
            await client.query(
              `
              UPDATE medication_administrations
              SET
                status = 'ACCEPTED',
                accepted_at = now(),
                updated_at = now()
              WHERE medication_administration_id = $1
              RETURNING *
              `,
              [normalizedId],
            );

          updated = result.rows[0];
          eventType =
            'MED_ADMIN_ACCEPTED';
        }


        if (action === 'READY') {

          const result =
            await client.query(
              `
              UPDATE medication_administrations
              SET
                status = 'READY',
                ready_at = now(),
                updated_at = now()
              WHERE medication_administration_id = $1
              RETURNING *
              `,
              [normalizedId],
            );

          updated = result.rows[0];
          eventType =
            'MED_ADMIN_READY';
        }


        if (
          action ===
          'DOUBLE_CHECK'
        ) {

          await client.query(
            `
            INSERT INTO medication_double_checks (
              double_check_id,
              medication_administration_id,
              medication_order_id,
              resident_id,
              checker_id,
              checker_role,
              checked_at,
              result,
              check_note
            )
            VALUES (
              $1,$2,$3,$4,$5,$6,
              now(),$7,$8
            )
            `,
            [
              randomUUID(),
              normalizedId,
              current.medication_order_id,
              current.resident_id,
              actorId,
              actorRole,
              input.checkResult,
              input.checkNote ?? null,
            ],
          );

          updated = current;
          eventType =
            'MED_ADMIN_DOUBLE_CHECKED';
        }


        if (
          action ===
          'ADMINISTER'
        ) {

          if (
            current.order_status !==
            'ACTIVE'
          ) {
            throw new Error(
              'Medication Order must be ACTIVE before administration.',
            );
          }

          if (
            current.high_risk ||
            current.double_check_required
          ) {

            const passed =
              await this.repository
                .countPassedDoubleChecks(
                  client,
                  normalizedId,
                );

            if (passed < 1) {
              throw new Error(
                'Required high-risk double-check has not PASSED.',
              );
            }
          }

          const result =
            await client.query(
              `
              UPDATE medication_administrations
              SET
                status = 'ADMINISTERED',
                administered_at = now(),
                administration_note = $2,
                updated_at = now()
              WHERE medication_administration_id = $1
              RETURNING *
              `,
              [
                normalizedId,
                String(
                  input.administrationNote,
                ).trim(),
              ],
            );

          updated = result.rows[0];
          eventType =
            'MED_ADMINISTERED';
        }


        if (action === 'MISSED') {

          const result =
            await client.query(
              `
              UPDATE medication_administrations
              SET
                status = 'MISSED',
                missed_at = now(),
                exception_reason = $2,
                updated_at = now()
              WHERE medication_administration_id = $1
              RETURNING *
              `,
              [
                normalizedId,
                String(
                  input.exceptionReason,
                ).trim(),
              ],
            );

          updated = result.rows[0];
          eventType =
            'MED_ADMIN_MISSED';
        }


        if (action === 'REFUSED') {

          const result =
            await client.query(
              `
              UPDATE medication_administrations
              SET
                status = 'REFUSED',
                refused_at = now(),
                exception_reason = $2,
                updated_at = now()
              WHERE medication_administration_id = $1
              RETURNING *
              `,
              [
                normalizedId,
                String(
                  input.exceptionReason,
                ).trim(),
              ],
            );

          updated = result.rows[0];
          eventType =
            'MED_ADMIN_REFUSED';
        }


        if (action === 'HELD') {

          const result =
            await client.query(
              `
              UPDATE medication_administrations
              SET
                status = 'HELD',
                held_at = now(),
                exception_reason = $2,
                updated_at = now()
              WHERE medication_administration_id = $1
              RETURNING *
              `,
              [
                normalizedId,
                String(
                  input.exceptionReason,
                ).trim(),
              ],
            );

          updated = result.rows[0];
          eventType =
            'MED_ADMIN_HELD';
        }


        if (action === 'CANCEL') {

          const result =
            await client.query(
              `
              UPDATE medication_administrations
              SET
                status = 'CANCELLED',
                cancelled_at = now(),
                exception_reason = $2,
                updated_at = now()
              WHERE medication_administration_id = $1
              RETURNING *
              `,
              [
                normalizedId,
                String(
                  input.exceptionReason,
                ).trim(),
              ],
            );

          updated = result.rows[0];
          eventType =
            'MED_ADMIN_CANCELLED';
        }


        const newState = {
          status:
            updated.status,

          assignedTo:
            updated.assigned_to,

          assignedRole:
            updated.assigned_role,

          assignedAt:
            updated.assigned_at,

          acceptedAt:
            updated.accepted_at,

          readyAt:
            updated.ready_at,

          administeredAt:
            updated.administered_at,

          missedAt:
            updated.missed_at,

          refusedAt:
            updated.refused_at,

          heldAt:
            updated.held_at,

          cancelledAt:
            updated.cancelled_at,
        };


        await this.repository
          .insertAudit(
            client,
            {
              residentId:
                current.resident_id,

              medicationOrderId:
                current.medication_order_id,

              medicationScheduleId:
                current.medication_schedule_id,

              medicationAdministrationId:
                normalizedId,

              eventType,

              actorId,
              actorRole,

              previousState,
              newState,
            },
          );


        return {
          medicationAdministrationId:
            normalizedId,

          status:
            updated.status,

          assignedTo:
            updated.assigned_to,

          assignedRole:
            updated.assigned_role,

          acceptedAt:
            updated.accepted_at,

          readyAt:
            updated.ready_at,

          administeredAt:
            updated.administered_at,

          missedAt:
            updated.missed_at,

          refusedAt:
            updated.refused_at,

          heldAt:
            updated.held_at,

          cancelledAt:
            updated.cancelled_at,

          action,
          auditEvent:
            eventType,

          actorId,
          actorRole,

          autonomousClinicalAction:
            false,
        };
      },
    );
  }
}

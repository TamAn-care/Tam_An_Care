import {
  Injectable,
} from '@nestjs/common';

import {
  MedicationAdministrationAction,
  MedicationAdministrationInput,
} from './medication.types';

@Injectable()
export class MedicationAuthorizationService {

  authorize(
    action: MedicationAdministrationAction,
    current: any,
    input: MedicationAdministrationInput,
  ): void {

    const actorId =
      String(input.actorId ?? '').trim();

    const actorRole =
      String(input.actorRole ?? '')
        .trim()
        .toUpperCase();

    if (!actorId) {
      throw new Error(
        'actorId is required.',
      );
    }

    if (!actorRole) {
      throw new Error(
        'actorRole is required.',
      );
    }

    if (
      actorRole === 'AI' ||
      actorRole === 'SYSTEM'
    ) {
      throw new Error(
        'AI or SYSTEM cannot mutate Medication Administration.',
      );
    }

    if (action === 'ASSIGN') {

      if (
        current.status !==
        'SCHEDULED'
      ) {
        throw new Error(
          'Only a SCHEDULED Medication Administration can be assigned.',
        );
      }

      if (
        actorRole !==
          'CARE_MANAGER' &&
        actorRole !==
          'SUPERVISOR'
      ) {
        throw new Error(
          'Actor is not authorized to assign Medication Administration.',
        );
      }

      const assignedTo =
        String(
          input.assignedTo ?? '',
        ).trim();

      const assignedRole =
        String(
          input.assignedRole ?? '',
        )
          .trim()
          .toUpperCase();

      if (!assignedTo) {
        throw new Error(
          'assignedTo is required.',
        );
      }

      if (!assignedRole) {
        throw new Error(
          'assignedRole is required.',
        );
      }

      if (
        assignedRole === 'AI' ||
        assignedRole === 'SYSTEM'
      ) {
        throw new Error(
          'Medication Administration requires a human assignee.',
        );
      }

      return;
    }

    if (action === 'ACCEPT') {

      if (
        current.status !==
        'ASSIGNED'
      ) {
        throw new Error(
          'Only an ASSIGNED Medication Administration can be accepted.',
        );
      }

      if (
        current.assigned_to !==
        actorId
      ) {
        throw new Error(
          'Only the assigned human owner can accept Medication Administration.',
        );
      }

      return;
    }

    if (action === 'READY') {

      if (
        current.status !==
        'ACCEPTED'
      ) {
        throw new Error(
          'Only an ACCEPTED Medication Administration can become READY.',
        );
      }

      if (
        current.assigned_to !==
        actorId
      ) {
        throw new Error(
          'Only the assigned human owner can make Medication Administration READY.',
        );
      }

      return;
    }

    if (action === 'DOUBLE_CHECK') {

      if (
        current.status !==
        'READY'
      ) {
        throw new Error(
          'Only a READY Medication Administration can be double-checked.',
        );
      }

      if (
        actorRole !==
          'CARE_MANAGER' &&
        actorRole !==
          'SUPERVISOR'
      ) {
        throw new Error(
          'Actor is not authorized to double-check Medication Administration.',
        );
      }

      if (
        current.assigned_to ===
        actorId
      ) {
        throw new Error(
          'Administrator and double-checker must be different humans.',
        );
      }

      if (
        input.checkResult !==
          'PASSED' &&
        input.checkResult !==
          'FAILED'
      ) {
        throw new Error(
          'checkResult is required.',
        );
      }

      return;
    }

    if (action === 'ADMINISTER') {

      if (
        current.status !==
        'READY'
      ) {
        throw new Error(
          'Only a READY Medication Administration can be administered.',
        );
      }

      if (
        current.assigned_to !==
        actorId
      ) {
        throw new Error(
          'Only the assigned human owner can administer medication.',
        );
      }

      if (
        !String(
          input.administrationNote ??
          '',
        ).trim()
      ) {
        throw new Error(
          'administrationNote is required.',
        );
      }

      return;
    }

    if (
      action === 'MISSED' ||
      action === 'REFUSED'
    ) {

      if (
        ![
          'ASSIGNED',
          'ACCEPTED',
          'READY',
        ].includes(current.status)
      ) {
        throw new Error(
          'Medication Administration state does not allow this outcome.',
        );
      }

      const owner =
        current.assigned_to ===
        actorId;

      const override =
        actorRole ===
          'CARE_MANAGER' ||
        actorRole ===
          'SUPERVISOR';

      if (!owner && !override) {
        throw new Error(
          'Actor is not authorized for this Medication Administration outcome.',
        );
      }

      if (
        !String(
          input.exceptionReason ??
          '',
        ).trim()
      ) {
        throw new Error(
          'exceptionReason is required.',
        );
      }

      return;
    }

    if (
      action === 'HELD' ||
      action === 'CANCEL'
    ) {

      if (
        actorRole !==
          'CARE_MANAGER' &&
        actorRole !==
          'SUPERVISOR'
      ) {
        throw new Error(
          'Actor is not authorized for this Medication Administration action.',
        );
      }

      if (
        !String(
          input.exceptionReason ??
          '',
        ).trim()
      ) {
        throw new Error(
          'exceptionReason is required.',
        );
      }

      return;
    }

    throw new Error(
      'Unsupported Medication Administration action.',
    );
  }
}

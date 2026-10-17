import {
  Injectable,
} from '@nestjs/common';

import {
  CareTaskAuthorizationDecision,
  CareTaskAuthorizationInput,
} from './care-task-authorization.types';


@Injectable()
export class CareTaskAuthorizationService {

  authorize(
    input:
      CareTaskAuthorizationInput,
  ):
    CareTaskAuthorizationDecision {

    const action =
      String(
        input.action ?? '',
      )
        .trim()
        .toUpperCase();

    const status =
      String(
        input.status ?? '',
      )
        .trim()
        .toUpperCase();

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

    const assignedTo =
      input.assignedTo
        ? String(
            input.assignedTo,
          ).trim()
        : null;

    const assigneeId =
      input.assigneeId
        ? String(
            input.assigneeId,
          ).trim()
        : null;

    const assigneeRole =
      input.assigneeRole
        ? String(
            input.assigneeRole,
          ).trim()
        : null;

    const completionNote =
      String(
        input.completionNote ?? '',
      ).trim();

    const exceptionReason =
      String(
        input.exceptionReason ?? '',
      ).trim();


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
        'AI or SYSTEM actor cannot mutate Care Task execution.',
      );
    }


    const manager =
      actorRole === 'SUPERVISOR' ||
      actorRole === 'CARE_MANAGER';

    const owner =
      !!assignedTo &&
      actorId === assignedTo;


    switch (action) {

      case 'ASSIGN':

        if (status !== 'PLANNED') {
          throw new Error(
            'Only a PLANNED Care Task can be assigned.',
          );
        }

        if (!manager) {
          throw new Error(
            'Actor is not authorized to assign this Care Task.',
          );
        }

        if (
          !assigneeId ||
          !assigneeRole
        ) {
          throw new Error(
            'assigneeId and assigneeRole are required.',
          );
        }

        return {
          authorized: true,
          action: 'ASSIGN',
          actorId,
          actorRole,
          targetStatus: 'ASSIGNED',
          auditEvent: 'TASK_ASSIGNED',
          autonomousClinicalAction: false,
        };


      case 'ACCEPT':

        if (status !== 'ASSIGNED') {
          throw new Error(
            'Only an ASSIGNED Care Task can be accepted.',
          );
        }

        if (!owner) {
          throw new Error(
            'Only the assigned human owner can accept this Care Task.',
          );
        }

        if (input.acceptedAt) {
          throw new Error(
            'Care Task has already been accepted.',
          );
        }

        return {
          authorized: true,
          action: 'ACCEPT',
          actorId,
          actorRole,
          targetStatus: 'ASSIGNED',
          auditEvent: 'TASK_ACCEPTED',
          autonomousClinicalAction: false,
        };


      case 'START':

        if (status !== 'ASSIGNED') {
          throw new Error(
            'Only an ASSIGNED Care Task can be started.',
          );
        }

        if (!owner) {
          throw new Error(
            'Only the assigned human owner can start this Care Task.',
          );
        }

        if (!input.acceptedAt) {
          throw new Error(
            'Care Task must be accepted before execution starts.',
          );
        }

        return {
          authorized: true,
          action: 'START',
          actorId,
          actorRole,
          targetStatus: 'IN_PROGRESS',
          auditEvent: 'TASK_STARTED',
          autonomousClinicalAction: false,
        };


      case 'COMPLETE':

        if (status !== 'IN_PROGRESS') {
          throw new Error(
            'Only an IN_PROGRESS Care Task can be completed.',
          );
        }

        if (!owner) {
          throw new Error(
            'Only the assigned human owner can complete this Care Task.',
          );
        }

        if (!completionNote) {
          throw new Error(
            'completionNote is required.',
          );
        }

        return {
          authorized: true,
          action: 'COMPLETE',
          actorId,
          actorRole,
          targetStatus: 'COMPLETED',
          auditEvent: 'TASK_COMPLETED',
          autonomousClinicalAction: false,
        };


      case 'MARK_MISSED':

        if (
          status !== 'ASSIGNED' &&
          status !== 'IN_PROGRESS'
        ) {
          throw new Error(
            'Only an ASSIGNED or IN_PROGRESS Care Task can be marked missed.',
          );
        }

        if (
          !owner &&
          !manager
        ) {
          throw new Error(
            'Actor is not authorized to mark this Care Task missed.',
          );
        }

        if (!exceptionReason) {
          throw new Error(
            'exceptionReason is required.',
          );
        }

        return {
          authorized: true,
          action: 'MARK_MISSED',
          actorId,
          actorRole,
          targetStatus: 'MISSED',
          auditEvent: 'TASK_MISSED',
          autonomousClinicalAction: false,
        };


      case 'SKIP':

        if (
          ![
            'PLANNED',
            'ASSIGNED',
            'IN_PROGRESS',
          ].includes(status)
        ) {
          throw new Error(
            'Only a non-terminal Care Task can be skipped.',
          );
        }

        if (!manager) {
          throw new Error(
            'Actor is not authorized to skip this Care Task.',
          );
        }

        if (!exceptionReason) {
          throw new Error(
            'exceptionReason is required.',
          );
        }

        return {
          authorized: true,
          action: 'SKIP',
          actorId,
          actorRole,
          targetStatus: 'SKIPPED',
          auditEvent: 'TASK_SKIPPED',
          autonomousClinicalAction: false,
        };


      case 'CANCEL':

        if (
          ![
            'PLANNED',
            'ASSIGNED',
            'IN_PROGRESS',
          ].includes(status)
        ) {
          throw new Error(
            'Only a non-terminal Care Task can be cancelled.',
          );
        }

        if (!manager) {
          throw new Error(
            'Actor is not authorized to cancel this Care Task.',
          );
        }

        if (!exceptionReason) {
          throw new Error(
            'exceptionReason is required.',
          );
        }

        return {
          authorized: true,
          action: 'CANCEL',
          actorId,
          actorRole,
          targetStatus: 'CANCELLED',
          auditEvent: 'TASK_CANCELLED',
          autonomousClinicalAction: false,
        };


      default:
        throw new Error(
          'Unsupported Care Task action.',
        );
    }
  }
}

import {
  Injectable,
} from '@nestjs/common';

import {
  IncidentAction,
} from './incident.types';

@Injectable()
export class IncidentAuthorizationService {

  private normalizeRole(
    role: string | null | undefined,
  ): string {

    return String(
      role ?? '',
    ).trim().toUpperCase();
  }


  requireHuman(
    actorId: string | null | undefined,
    actorRole: string | null | undefined,
  ): {
    actorId: string;
    actorRole: string;
  } {

    const id =
      String(
        actorId ?? '',
      ).trim();

    const role =
      this.normalizeRole(
        actorRole,
      );

    if (!id) {
      throw new Error(
        'actorId is required.',
      );
    }

    if (!role) {
      throw new Error(
        'actorRole is required.',
      );
    }

    if (
      role === 'AI' ||
      role === 'SYSTEM'
    ) {
      throw new Error(
        'AI or SYSTEM cannot mutate an official Incident record.',
      );
    }

    if (
      ![
        'CAREGIVER',
        'NURSE',
        'SUPERVISOR',
        'CARE_MANAGER',
      ].includes(role)
    ) {
      throw new Error(
        'Actor is not authorized for Incident mutation.',
      );
    }

    return {
      actorId: id,
      actorRole: role,
    };
  }


  authorize(
    action: IncidentAction,
    actorId: string | null | undefined,
    actorRole: string | null | undefined,
  ): {
    actorId: string;
    actorRole: string;
  } {

    const actor =
      this.requireHuman(
        actorId,
        actorRole,
      );

    const role =
      actor.actorRole;


    if (
      action === 'TRIAGE'
    ) {
      if (
        ![
          'NURSE',
          'SUPERVISOR',
          'CARE_MANAGER',
        ].includes(role)
      ) {
        throw new Error(
          'Actor is not authorized to triage this Incident.',
        );
      }
    }


    if (
      action === 'ASSIGN' ||
      action === 'ASSIGN_ESCALATION' ||
      action === 'CLOSE' ||
      action === 'LINK_CARE_ACTION' ||
      action === 'LINK_CARE_TASK'
    ) {
      if (
        ![
          'SUPERVISOR',
          'CARE_MANAGER',
        ].includes(role)
      ) {
        throw new Error(
          'Actor is not authorized for this Incident governance action.',
        );
      }
    }


    if (
      action === 'ACCEPT_ESCALATION' ||
      action === 'RESOLVE_ESCALATION' ||
      action === 'RESOLVE' ||
      action === 'POST_REVIEW'
    ) {
      if (
        ![
          'NURSE',
          'SUPERVISOR',
          'CARE_MANAGER',
        ].includes(role)
      ) {
        throw new Error(
          'Actor is not authorized for this Incident clinical governance action.',
        );
      }
    }


    if (
      action === 'LINK_CLINICAL_OBSERVATION' ||
      action === 'LINK_MEDICATION_RECORD'
    ) {
      if (
        ![
          'NURSE',
          'SUPERVISOR',
          'CARE_MANAGER',
        ].includes(role)
      ) {
        throw new Error(
          'Actor is not authorized for this Incident clinical linkage.',
        );
      }
    }

    return actor;
  }
}

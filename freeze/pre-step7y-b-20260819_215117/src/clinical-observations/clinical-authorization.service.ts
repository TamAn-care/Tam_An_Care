import {
  Injectable,
} from '@nestjs/common';

import {
  ClinicalAction,
  ClinicalMutationInput,
} from './clinical.types';

@Injectable()
export class ClinicalAuthorizationService {

  authorize(
    action: ClinicalAction,
    current: any,
    input: ClinicalMutationInput,
  ): void {

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
        'AI or SYSTEM cannot mutate the clinical record.',
      );
    }

    const manager =
      actorRole === 'CARE_MANAGER' ||
      actorRole === 'SUPERVISOR';

    if (
      action ===
      'VERIFY_OBSERVATION'
    ) {

      if (
        current.status !==
        'RECORDED'
      ) {
        throw new Error(
          'Only a RECORDED observation can be verified.',
        );
      }

      if (!manager) {
        throw new Error(
          'Actor is not authorized to verify an observation.',
        );
      }

      return;
    }


    if (
      action ===
      'AMEND_OBSERVATION'
    ) {

      if (
        current.status !==
        'VERIFIED' &&
        current.status !==
        'AMENDED'
      ) {
        throw new Error(
          'Only a VERIFIED or AMENDED observation can be amended.',
        );
      }

      if (!manager) {
        throw new Error(
          'Actor is not authorized to amend an observation.',
        );
      }

      if (
        !String(
          input.reason ?? '',
        ).trim()
      ) {
        throw new Error(
          'reason is required.',
        );
      }

      if (
        input.correctedValue ===
        undefined
      ) {
        throw new Error(
          'correctedValue is required.',
        );
      }

      return;
    }


    if (
      action ===
      'VOID_OBSERVATION'
    ) {

      if (
        current.status !==
          'RECORDED' &&
        current.status !==
          'VERIFIED'
      ) {
        throw new Error(
          'Only a RECORDED or VERIFIED observation can be voided.',
        );
      }

      if (!manager) {
        throw new Error(
          'Actor is not authorized to void an observation.',
        );
      }

      if (
        !String(
          input.reason ?? '',
        ).trim()
      ) {
        throw new Error(
          'reason is required.',
        );
      }

      return;
    }


    if (
      action ===
      'SIGN_NURSING_NOTE'
    ) {

      if (
        current.status !==
        'DRAFT'
      ) {
        throw new Error(
          'Only a DRAFT nursing note can be signed.',
        );
      }

      if (!manager) {
        throw new Error(
          'Actor is not authorized to sign a nursing note.',
        );
      }

      return;
    }


    if (
      action ===
      'ACKNOWLEDGE_FINDING'
    ) {

      if (
        current.status !==
        'OPEN'
      ) {
        throw new Error(
          'Only an OPEN abnormal finding can be acknowledged.',
        );
      }

      if (!manager) {
        throw new Error(
          'Actor is not authorized to acknowledge an abnormal finding.',
        );
      }

      return;
    }


    if (
      action ===
      'START_FINDING_REVIEW'
    ) {

      if (
        current.status !==
        'ACKNOWLEDGED'
      ) {
        throw new Error(
          'Only an ACKNOWLEDGED abnormal finding can enter review.',
        );
      }

      if (!manager) {
        throw new Error(
          'Actor is not authorized to review an abnormal finding.',
        );
      }

      return;
    }


    if (
      action ===
      'ESCALATE_FINDING'
    ) {

      if (
        current.status !==
        'UNDER_REVIEW'
      ) {
        throw new Error(
          'Only an UNDER_REVIEW abnormal finding can be escalated.',
        );
      }

      if (!manager) {
        throw new Error(
          'Actor is not authorized to escalate an abnormal finding.',
        );
      }

      if (
        !String(
          input.reason ?? '',
        ).trim()
      ) {
        throw new Error(
          'reason is required.',
        );
      }

      return;
    }


    if (
      action ===
      'CLOSE_FINDING'
    ) {

      if (
        current.status !==
          'UNDER_REVIEW' &&
        current.status !==
          'ESCALATED'
      ) {
        throw new Error(
          'Only a reviewed or escalated abnormal finding can be closed.',
        );
      }

      if (!manager) {
        throw new Error(
          'Actor is not authorized to close an abnormal finding.',
        );
      }

      if (
        !String(
          input.reviewOutcome ?? '',
        ).trim()
      ) {
        throw new Error(
          'reviewOutcome is required.',
        );
      }

      return;
    }


    if (
      action ===
      'ASSIGN_ESCALATION'
    ) {

      if (
        current.status !==
        'OPEN'
      ) {
        throw new Error(
          'Only an OPEN clinical escalation can be assigned.',
        );
      }

      if (!manager) {
        throw new Error(
          'Actor is not authorized to assign a clinical escalation.',
        );
      }

      if (
        !String(
          input.assignedReviewer ??
          '',
        ).trim()
      ) {
        throw new Error(
          'assignedReviewer is required.',
        );
      }

      if (
        !String(
          input.assignedReviewerRole ??
          '',
        ).trim()
      ) {
        throw new Error(
          'assignedReviewerRole is required.',
        );
      }

      return;
    }


    if (
      action ===
      'ACCEPT_ESCALATION'
    ) {

      if (
        current.status !==
        'ASSIGNED'
      ) {
        throw new Error(
          'Only an ASSIGNED clinical escalation can be accepted.',
        );
      }

      if (
        current.assigned_reviewer !==
        actorId
      ) {
        throw new Error(
          'Only the assigned human reviewer can accept the escalation.',
        );
      }

      return;
    }


    if (
      action ===
      'RESOLVE_ESCALATION'
    ) {

      if (
        current.status !==
        'ACCEPTED'
      ) {
        throw new Error(
          'Only an ACCEPTED clinical escalation can be resolved.',
        );
      }

      if (
        current.assigned_reviewer !==
        actorId
      ) {
        throw new Error(
          'Only the assigned human reviewer can resolve the escalation.',
        );
      }

      if (
        !String(
          input.resolutionSummary ??
          '',
        ).trim()
      ) {
        throw new Error(
          'resolutionSummary is required.',
        );
      }

      return;
    }


    if (
      action ===
      'CANCEL_ESCALATION'
    ) {

      if (
        current.status !==
          'OPEN' &&
        current.status !==
          'ASSIGNED'
      ) {
        throw new Error(
          'Only an OPEN or ASSIGNED escalation can be cancelled.',
        );
      }

      if (!manager) {
        throw new Error(
          'Actor is not authorized to cancel a clinical escalation.',
        );
      }

      if (
        !String(
          input.reason ?? '',
        ).trim()
      ) {
        throw new Error(
          'reason is required.',
        );
      }

      return;
    }


    if (
      action ===
      'LINK_CARE_ACTION'
    ) {

      if (
        current.status !==
        'ACCEPTED' &&
        current.status !==
        'RESOLVED'
      ) {
        throw new Error(
          'Care Action linkage requires an accepted or resolved clinical escalation.',
        );
      }

      if (!manager) {
        throw new Error(
          'Actor is not authorized to link a Care Action.',
        );
      }

      if (
        !String(
          input.linkedCareActionId ??
          '',
        ).trim()
      ) {
        throw new Error(
          'linkedCareActionId is required.',
        );
      }

      return;
    }


    throw new Error(
      'Unsupported clinical action.',
    );
  }
}

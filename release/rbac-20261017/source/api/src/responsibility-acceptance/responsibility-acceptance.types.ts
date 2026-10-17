import {
  CareActionPriority,
} from '../care-actions/care-action.types';

export interface AcceptResponsibilityInput {
  residentId: string;
  patternId: string;

  actorId: string;
  actorRole: string;

  priority: CareActionPriority;
  dueAt?: Date | string | null;
}

export interface ResponsibilityAcceptanceResult {
  careActionId: string;

  residentId: string;
  patternId: string;

  status: string;

  acceptedBy: string;
  acceptedRole: string;

  acceptedAt: Date | null;

  priority:
    CareActionPriority | null;

  dueAt: Date | null;

  responsibilityStatus:
    'ACCEPTED';

  autonomousClinicalAction:
    false;
}

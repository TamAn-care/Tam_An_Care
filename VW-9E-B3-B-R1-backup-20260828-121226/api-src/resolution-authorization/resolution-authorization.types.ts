export interface ResolutionAuthorizationInput {
  status: string;

  assignedTo: string | null;
  assignedRole: string | null;

  reviewStartedAt: Date | null;

  actorId: string;
  actorRole: string;

  careNote: string;
  resolutionReason: string;
}

export interface ResolutionAuthorizationDecision {
  authorized: true;

  actorId: string;
  actorRole: string;

  authorizationType:
    | 'OWNER'
    | 'SUPERVISOR_OVERRIDE'
    | 'CARE_MANAGER_OVERRIDE';

  autonomousClinicalAction: false;
}

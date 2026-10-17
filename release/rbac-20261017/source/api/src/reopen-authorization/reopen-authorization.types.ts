export interface ReopenAuthorizationInput {
  status: string;

  assignedTo: string | null;

  assignedRole: string | null;

  resolvedAt: Date | null;

  actorId: string;

  actorRole: string;

  reopenReason: string;
}

export interface ReopenAuthorizationDecision {
  authorized: true;

  actorId: string;

  actorRole: string;

  reason:
    | 'SUPERVISOR_REOPEN'
    | 'CARE_MANAGER_REOPEN';

  autonomousClinicalAction: false;
}

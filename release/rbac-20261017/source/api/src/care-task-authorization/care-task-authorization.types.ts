export type CareTaskAction =
  | 'ASSIGN'
  | 'ACCEPT'
  | 'START'
  | 'COMPLETE'
  | 'MARK_MISSED'
  | 'SKIP'
  | 'CANCEL';


export interface CareTaskAuthorizationInput {

  action:
    CareTaskAction;

  status:
    string;

  assignedTo:
    string | null;

  assignedRole:
    string | null;

  acceptedAt:
    Date | null;

  actorId:
    string;

  actorRole:
    string;

  assigneeId?:
    string | null;

  assigneeRole?:
    string | null;

  completionNote?:
    string | null;

  exceptionReason?:
    string | null;
}


export interface CareTaskAuthorizationDecision {

  authorized:
    true;

  action:
    CareTaskAction;

  actorId:
    string;

  actorRole:
    string;

  targetStatus:
    string;

  auditEvent:
    string;

  autonomousClinicalAction:
    false;
}

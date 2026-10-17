export interface CareTaskExecutionInput {

  actorId:
    string | null;

  actorRole:
    string | null;

  assigneeId?:
    string | null;

  assigneeRole?:
    string | null;

  completionNote?:
    string | null;

  exceptionReason?:
    string | null;
}

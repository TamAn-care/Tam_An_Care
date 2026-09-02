export type MedicationAdministrationAction =
  | 'ASSIGN'
  | 'ACCEPT'
  | 'READY'
  | 'DOUBLE_CHECK'
  | 'ADMINISTER'
  | 'MISSED'
  | 'REFUSED'
  | 'HELD'
  | 'CANCEL';

export interface MedicationAdministrationInput {
  actorId: string | null;
  actorRole: string | null;

  assignedTo?: string | null;
  assignedRole?: string | null;

  checkResult?: 'PASSED' | 'FAILED' | null;
  checkNote?: string | null;

  administrationNote?: string | null;
  exceptionReason?: string | null;
}

export interface MedicationAdministrationResult {
  medicationAdministrationId: string;
  status: string;

  assignedTo: string | null;
  assignedRole: string | null;

  acceptedAt: Date | null;
  readyAt: Date | null;
  administeredAt: Date | null;
  missedAt: Date | null;
  refusedAt: Date | null;
  heldAt: Date | null;
  cancelledAt: Date | null;

  action: MedicationAdministrationAction;
  auditEvent: string;

  actorId: string;
  actorRole: string;

  autonomousClinicalAction: false;
}

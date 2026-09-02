export type HumanActorRole =
  | 'CAREGIVER'
  | 'NURSE'
  | 'SUPERVISOR';

export interface HumanActorSession {
  actorId: string;
  actorRole: HumanActorRole;
  displayName?: string;
}

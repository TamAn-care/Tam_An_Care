export type HumanActorRole =
  | 'CAREGIVER'
  | 'NURSE'
  | 'SUPERVISOR'
  | 'CARE_MANAGER';

export interface HumanActorSession {
  actorId: string;
  actorRole: HumanActorRole;
  displayName?: string;
}

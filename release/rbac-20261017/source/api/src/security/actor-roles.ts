// Canonical vocabulary verified against Production Test schema on 2026-10-16.
export const CANONICAL_ACTOR_ROLES = [
  "ADMIN",
  "SUPERVISOR",
  "CARE_MANAGER",
  "MEDICAL_HEAD",
  "NURSE",
  "CAREGIVER",
  "NUTRITIONIST",
  "ACCOUNTANT",
  "RECEPTIONIST",
  "PSYCHOLOGIST",
  "SOCIAL_WORKER",
  "REHABILITATION_SPECIALIST",
  "COMMUNICATIONS",
  "HOUSEKEEPING",
  "SECURITY",
  "GUARDIAN"
] as const;
export type CanonicalActorRole = typeof CANONICAL_ACTOR_ROLES[number];

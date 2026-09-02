export type NutritionActorRole =
  | 'CAREGIVER'
  | 'NURSE'
  | 'SUPERVISOR'
  | 'CARE_MANAGER'
  | 'AI'
  | 'SYSTEM';

export type NutritionAction =
  | 'CREATE_PLAN'
  | 'ACTIVATE_PLAN'
  | 'CREATE_DIET_ORDER'
  | 'ACTIVATE_DIET_ORDER'
  | 'CREATE_MEAL'
  | 'ASSIGN_MEAL'
  | 'ACCEPT_MEAL'
  | 'READY_MEAL'
  | 'COMPLETE_MEAL'
  | 'MISS_MEAL'
  | 'REFUSE_MEAL'
  | 'HOLD_MEAL'
  | 'CREATE_ASSISTANCE'
  | 'ASSIGN_ASSISTANCE'
  | 'ACCEPT_ASSISTANCE'
  | 'START_ASSISTANCE'
  | 'COMPLETE_ASSISTANCE'
  | 'RECORD_INTAKE'
  | 'VERIFY_INTAKE'
  | 'AMEND_INTAKE'
  | 'CREATE_ALERT'
  | 'ACK_ALERT'
  | 'ESCALATE_ALERT'
  | 'ASSIGN_ESCALATION'
  | 'ACCEPT_ESCALATION'
  | 'RESOLVE_ESCALATION';

export interface NutritionCommand {
  action: NutritionAction;

  actorId: string;
  actorRole: NutritionActorRole;

  nutritionPlanId?: string;
  dietOrderId?: string;
  mealScheduleId?: string;
  feedingAssistanceId?: string;
  intakeRecordId?: string;
  nutritionAlertId?: string;
  nutritionEscalationId?: string;

  title?: string;
  description?: string;

  dietType?: string;
  textureRequirement?: string;
  fluidConsistency?: string;
  allergyInformation?: string;
  intoleranceInformation?: string;
  restrictionInformation?: string;
  fluidRestrictionActive?: boolean;
  fluidRestrictionDetails?: string;
  swallowingRestrictionPresent?: boolean;
  safetyConfirmed?: boolean;

  eventType?: string;
  scheduledAt?: string;
  assignedTo?: string;
  assignedRole?: string;
  exceptionReason?: string;

  assistanceLevel?: string;
  assistanceNote?: string;

  intakeType?: string;
  foodIntakePercent?: number;
  fluidAmountMl?: number;
  intakeNote?: string;
  amendmentReason?: string;

  alertType?: string;
  sourceType?: string;
  severity?: string;
  summary?: string;

  reason?: string;
  assignedReviewer?: string;
  assignedReviewerRole?: string;
  resolutionSummary?: string;
}

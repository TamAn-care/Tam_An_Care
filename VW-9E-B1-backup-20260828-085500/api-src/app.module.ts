import { Module } from '@nestjs/common';

import {
  ClinicalModule,
} from './clinical-observations/clinical.module';

import {
  MedicationModule,
} from './medication/medication.module';
import { DatabaseModule } from './database/database.module';
import { CareActionRepository } from './care-actions/care-action.repository';
import { CareActionService } from './care-actions/care-action.service';
import { CareActionController } from './care-actions/care-action.controller';
import { HealthController } from './health/health.controller';
import { AiEngineController } from './ai/ai-engine.controller';
import { AiEngineService } from './ai/ai-engine.service';
import { AiGatewayService } from './ai/ai-gateway.service';
import { AiGovernanceController } from './ai/ai-governance.controller';
import { EarlyWarningController } from './ai/early-warning.controller';
import { EarlyWarningService } from './ai/early-warning.service';
import { ResidentModule } from './residents/resident.module';
import { WarningReviewModule } from './warning-reviews/warning-review.module';
import { CareActionBridgeModule } from './care-action-bridge/care-action-bridge.module';
import { ResponsibilityAcceptanceModule } from './responsibility-acceptance/responsibility-acceptance.module';
import { StartReviewAuthorizationModule } from './start-review-authorization/start-review-authorization.module';


import {
  ResolutionAuthorizationModule,
} from './resolution-authorization/resolution-authorization.module';

import {
  ReopenAuthorizationModule,
} from './reopen-authorization/reopen-authorization.module';
import {
  CarePlanGovernanceModule,
} from './care-plan-governance/care-plan-governance.module';

import {
  CareTaskExecutionModule,
} from './care-task-execution/care-task-execution.module';

import { IncidentModule } from './incidents/incident.module';
import { NutritionHydrationModule } from './nutrition-hydration/nutrition-hydration.module';
import { ActivityRehabilitationModule } from './activity-rehabilitation/activity-rehabilitation.module';
import { SkinWoundModule } from './skin-wound/skin-wound.module';
import { PersonalCareModule } from './personal-care/personal-care.module';
import { BehavioralCognitiveModule } from './behavioral-cognitive/behavioral-cognitive.module';
import { SleepRestModule } from './sleep-rest/sleep-rest.module';
import { PainComfortModule } from './pain-comfort/pain-comfort.module';
import { InfectionControlModule } from './infection-control/infection-control.module';
import { MedicationSafetyModule } from './medication-safety/medication-safety.module';
import { SafeguardingModule } from './safeguarding/safeguarding.module';
import { FallMobilityModule } from './fall-mobility/fall-mobility.module';
import { CrossDomainIntegrationModule } from './cross-domain-integration/cross-domain-integration.module';
import { OperationalCareViewModule } from './operational-care-view/operational-care-view.module';
import { ResidentAccessAdministrationModule } from './resident-access-administration/resident-access-administration.module';
import { AdmissionModule } from './admissions/admission.module';
@Module({imports:[
    AdmissionModule,
    ResidentAccessAdministrationModule,
    OperationalCareViewModule,
    CrossDomainIntegrationModule,
    FallMobilityModule,
    SafeguardingModule,
    MedicationSafetyModule,
    InfectionControlModule,
    PainComfortModule,
    SleepRestModule,
    BehavioralCognitiveModule,
    PersonalCareModule,
    SkinWoundModule,
    IncidentModule,
    ClinicalModule,
    MedicationModule,
    CareTaskExecutionModule,
    CarePlanGovernanceModule,ResolutionAuthorizationModule,DatabaseModule,ResidentModule,WarningReviewModule,CareActionBridgeModule,ResponsibilityAcceptanceModule,StartReviewAuthorizationModule,
    ReopenAuthorizationModule,
  NutritionHydrationModule,
  ActivityRehabilitationModule,
],controllers:[HealthController,AiEngineController,AiGovernanceController,EarlyWarningController,CareActionController],providers:[AiEngineService,AiGatewayService,EarlyWarningService,CareActionRepository,CareActionService]})
export class AppModule {}

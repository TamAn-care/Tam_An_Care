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

@Module({imports:[
    ClinicalModule,
    MedicationModule,
    CareTaskExecutionModule,
    CarePlanGovernanceModule,ResolutionAuthorizationModule,DatabaseModule,ResidentModule,WarningReviewModule,CareActionBridgeModule,ResponsibilityAcceptanceModule,StartReviewAuthorizationModule,
    ReopenAuthorizationModule,],controllers:[HealthController,AiEngineController,AiGovernanceController,EarlyWarningController,CareActionController],providers:[AiEngineService,AiGatewayService,EarlyWarningService,CareActionRepository,CareActionService]})
export class AppModule {}

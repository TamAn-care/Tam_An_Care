import { Module } from '@nestjs/common';
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

@Module({imports:[DatabaseModule,ResidentModule],controllers:[HealthController,AiEngineController,AiGovernanceController,EarlyWarningController,CareActionController],providers:[AiEngineService,AiGatewayService,EarlyWarningService,CareActionRepository,CareActionService]})
export class AppModule {}

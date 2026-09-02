import { Module } from '@nestjs/common';
import { HealthController } from './health/health.controller';
import { AiEngineController } from './ai/ai-engine.controller';
import { AiEngineService } from './ai/ai-engine.service';
import { AiGatewayService } from './ai/ai-gateway.service';
import { AiGovernanceController } from './ai/ai-governance.controller';
import { EarlyWarningController } from './ai/early-warning.controller';
import { EarlyWarningService } from './ai/early-warning.service';

@Module({controllers:[HealthController,AiEngineController,AiGovernanceController,EarlyWarningController],providers:[AiEngineService,AiGatewayService,EarlyWarningService]})
export class AppModule {}

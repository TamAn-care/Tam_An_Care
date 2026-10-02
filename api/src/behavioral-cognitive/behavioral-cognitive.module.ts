import { Module } from '@nestjs/common';
import { BehavioralCognitiveController } from './behavioral-cognitive.controller';
import { BehavioralCognitiveService } from './behavioral-cognitive.service';
import { ResidentAccessScopeModule } from '../resident-access-scope/resident-access-scope.module';

@Module({
  imports: [ResidentAccessScopeModule],
  controllers: [BehavioralCognitiveController],
  providers: [BehavioralCognitiveService],
})
export class BehavioralCognitiveModule {}

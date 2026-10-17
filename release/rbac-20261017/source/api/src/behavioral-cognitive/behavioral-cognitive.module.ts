import { Module } from '@nestjs/common';
import { BehavioralCognitiveController } from './behavioral-cognitive.controller';
import { BehavioralCognitiveService } from './behavioral-cognitive.service';

@Module({
  controllers: [BehavioralCognitiveController],
  providers: [BehavioralCognitiveService],
})
export class BehavioralCognitiveModule {}

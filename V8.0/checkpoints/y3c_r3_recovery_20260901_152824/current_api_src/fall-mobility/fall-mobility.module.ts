import { Module } from '@nestjs/common';
import { FallMobilityController } from './fall-mobility.controller';
import { FallMobilityService } from './fall-mobility.service';

@Module({
  controllers: [FallMobilityController],
  providers: [FallMobilityService],
})
export class FallMobilityModule {}

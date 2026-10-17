import { Module } from '@nestjs/common';
import { MedicationSafetyController } from './medication-safety.controller';
import { MedicationSafetyService } from './medication-safety.service';

@Module({
  controllers: [MedicationSafetyController],
  providers: [MedicationSafetyService],
})
export class MedicationSafetyModule {}

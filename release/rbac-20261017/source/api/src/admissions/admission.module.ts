import { AdmissionClassificationService } from './admission-classification.service';
import { AdmissionClassificationController } from './admission-classification.controller';
import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { AdmissionController } from './admission.controller';
import { AdmissionService } from './admission.service';

@Module({
  imports: [DatabaseModule],
  controllers: [AdmissionController, AdmissionClassificationController],
  providers: [AdmissionService, AdmissionClassificationService],
  exports: [AdmissionService],
})
export class AdmissionModule {}

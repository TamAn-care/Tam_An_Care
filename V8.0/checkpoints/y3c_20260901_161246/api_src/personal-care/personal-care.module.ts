import { Module } from '@nestjs/common';
import { OperationalWorkModule } from '../operational-work/operational-work.module';
import { PersonalCareController } from './personal-care.controller';
import { PersonalCareService } from './personal-care.service';

@Module({
  imports: [OperationalWorkModule],
  controllers: [PersonalCareController],
  providers: [PersonalCareService],
})
export class PersonalCareModule {}

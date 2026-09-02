import { Module } from '@nestjs/common';
import { PersonalCareController } from './personal-care.controller';
import { PersonalCareService } from './personal-care.service';

@Module({
  controllers: [PersonalCareController],
  providers: [PersonalCareService],
})
export class PersonalCareModule {}

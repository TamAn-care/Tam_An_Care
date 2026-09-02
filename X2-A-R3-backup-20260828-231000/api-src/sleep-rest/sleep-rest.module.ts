import { Module } from '@nestjs/common';
import { SleepRestController } from './sleep-rest.controller';
import { SleepRestService } from './sleep-rest.service';

@Module({
  controllers: [SleepRestController],
  providers: [SleepRestService],
})
export class SleepRestModule {}

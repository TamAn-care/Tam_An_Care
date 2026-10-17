import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { ResidentLifecycleController } from './resident-lifecycle.controller';
import { ResidentLifecycleService } from './resident-lifecycle.service';

@Module({
  imports: [DatabaseModule],
  controllers: [ResidentLifecycleController],
  providers: [ResidentLifecycleService],
})
export class ResidentLifecycleModule {}

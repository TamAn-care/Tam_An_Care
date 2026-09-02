import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { ResidentLeaveController } from './resident-leave.controller';
import { ResidentLeaveService } from './resident-leave.service';

@Module({
  imports: [DatabaseModule],
  controllers: [ResidentLeaveController],
  providers: [ResidentLeaveService],
  exports: [ResidentLeaveService],
})
export class ResidentLeaveModule {}

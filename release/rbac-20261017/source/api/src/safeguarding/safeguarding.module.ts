import { Module } from '@nestjs/common';
import { SafeguardingController } from './safeguarding.controller';
import { SafeguardingService } from './safeguarding.service';

@Module({
  controllers: [SafeguardingController],
  providers: [SafeguardingService],
})
export class SafeguardingModule {}

import { Module } from '@nestjs/common';
import { SkinWoundController } from './skin-wound.controller';
import { SkinWoundService } from './skin-wound.service';

@Module({
  controllers: [SkinWoundController],
  providers: [SkinWoundService],
})
export class SkinWoundModule {}

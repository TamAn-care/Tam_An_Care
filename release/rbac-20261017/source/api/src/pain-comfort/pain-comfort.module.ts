import { Module } from '@nestjs/common';
import { PainComfortController } from './pain-comfort.controller';
import { PainComfortService } from './pain-comfort.service';

@Module({
  controllers: [PainComfortController],
  providers: [PainComfortService],
})
export class PainComfortModule {}

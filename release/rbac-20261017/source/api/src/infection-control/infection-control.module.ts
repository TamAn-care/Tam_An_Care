import { Module } from '@nestjs/common';
import { InfectionControlController } from './infection-control.controller';
import { InfectionControlService } from './infection-control.service';

@Module({
  controllers: [InfectionControlController],
  providers: [InfectionControlService],
})
export class InfectionControlModule {}

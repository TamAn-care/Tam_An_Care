import { Body, Controller, Headers, Param, Post } from '@nestjs/common';
import { VitalSignService } from './vital-sign.service';

@Controller('api/residents/:residentId/vital-signs')
export class VitalSignController {
  constructor(private readonly vitals: VitalSignService) {}

  @Post()
  record(@Param('residentId') residentId: string,
    @Headers('x-actor-id') actorId: string | undefined,
    @Headers('x-actor-role') role: string | undefined,
    @Body() input: { measuredAt?: string; measurements?: Record<string, unknown>; note?: string }) {
    return this.vitals.record(residentId, actorId, role, input);
  }
}

import { Controller, Get, Headers, Param } from '@nestjs/common';
import { GuardianResidentService } from './guardian-resident.service';

@Controller('api/family-portal/residents')
export class GuardianResidentController {
  constructor(private readonly residents: GuardianResidentService) {}

  @Get()
  list(@Headers('x-actor-id') actorId?: string, @Headers('x-actor-role') role?: string) {
    return this.residents.list(actorId, role);
  }

  @Get(':residentId')
  detail(@Param('residentId') residentId: string,
    @Headers('x-actor-id') actorId?: string, @Headers('x-actor-role') role?: string) {
    return this.residents.detail(actorId, role, residentId);
  }
}

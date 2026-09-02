import { Controller, Get, Param } from '@nestjs/common';
import { ResidentService } from './resident.service';

@Controller('api/residents')
export class ResidentController {
  constructor(
    private readonly residentService: ResidentService,
  ) {}

  @Get()
  listResidents() {
    return this.residentService.list();
  }

  @Get(':residentId')
  getResident(
    @Param('residentId') residentId: string,
  ) {
    return this.residentService.getById(residentId);
  }
}

import { Body, Controller, Get, Headers, Param, Post, Query } from '@nestjs/common';
import { NutritionOperationsService } from './nutrition-operations.service';

@Controller('api/nutrition-operations')
export class NutritionOperationsController {
  constructor(private readonly service: NutritionOperationsService) {}

  @Get('tray-dispatches')
  listDispatches(@Headers('x-actor-id') actorId: string, @Headers('x-actor-role') actorRole: string, @Query('date') date: string) {
    return this.service.listDispatches({ actorId, actorRole }, date);
  }

  @Post('tray-dispatches')
  dispatch(@Headers('x-actor-id') actorId: string, @Headers('x-actor-role') actorRole: string, @Body() body: any) {
    return this.service.dispatch({ actorId, actorRole }, body);
  }

  @Post('tray-dispatches/:id/acknowledge')
  acknowledge(@Headers('x-actor-id') actorId: string, @Headers('x-actor-role') actorRole: string, @Param('id') id: string, @Body() body: any) {
    return this.service.acknowledge({ actorId, actorRole }, id, body);
  }

  @Get('hygiene-records')
  listHygiene(@Headers('x-actor-id') actorId: string, @Headers('x-actor-role') actorRole: string, @Query('residentId') residentId?: string) {
    return this.service.listHygiene({ actorId, actorRole }, residentId);
  }

  @Post('hygiene-records')
  recordHygiene(@Headers('x-actor-id') actorId: string, @Headers('x-actor-role') actorRole: string, @Body() body: any) {
    return this.service.recordHygiene({ actorId, actorRole }, body);
  }

  @Post('hygiene-records/inspect')
  inspectHygiene(@Headers('x-actor-id') actorId: string, @Headers('x-actor-role') actorRole: string, @Body() body: any) {
    return this.service.inspectHygiene({ actorId, actorRole }, body);
  }

  @Get('food-samples')
  listSamples(@Headers('x-actor-id') actorId: string, @Headers('x-actor-role') actorRole: string, @Query('residentId') residentId?: string) {
    return this.service.listSamples({ actorId, actorRole }, residentId);
  }

  @Post('food-samples')
  collectSample(@Headers('x-actor-id') actorId: string, @Headers('x-actor-role') actorRole: string, @Body() body: any) {
    return this.service.collectSample({ actorId, actorRole }, body);
  }

  @Post('food-samples/:id/dispose')
  disposeSample(@Headers('x-actor-id') actorId: string, @Headers('x-actor-role') actorRole: string, @Param('id') id: string) {
    return this.service.disposeSample({ actorId, actorRole }, id);
  }

  @Post('food-samples/inspect')
  inspectSample(@Headers('x-actor-id') actorId: string, @Headers('x-actor-role') actorRole: string, @Body() body: any) {
    return this.service.inspectSample({ actorId, actorRole }, body);
  }
}

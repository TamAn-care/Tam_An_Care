import { Body, Controller, Get, Headers, Param, Patch, Post, Query } from '@nestjs/common';
import { ResidentMealRegistrationService } from './resident-meal-registration.service';

@Controller('api/resident-meal-registrations')
export class ResidentMealRegistrationController {
  constructor(private readonly meals: ResidentMealRegistrationService) {}
  // ProductionAuthMiddleware must overwrite X-Actor headers after JWT/session validation.
  private actor(id?: string, role?: string) { return {id,role}; }
  @Get()
  list(@Headers('x-actor-id') id: string,@Headers('x-actor-role') role: string,
       @Query('date') date: string,@Query('mealType') mealType?: string) {
    return this.meals.list(this.actor(id,role),date,mealType);
  }
  @Get('totals')
  totals(@Headers('x-actor-id') id: string,@Headers('x-actor-role') role: string,
       @Query('date') date: string) {
    return this.meals.totals(this.actor(id,role),date);
  }
  @Post()
  register(@Headers('x-actor-id') id: string,@Headers('x-actor-role') role: string,@Body() body: any) {
    return this.meals.register(this.actor(id,role),body);
  }
  @Patch(':id')
  update(@Headers('x-actor-id') actorId: string,@Headers('x-actor-role') role: string,
         @Param('id') id: string,@Body() body: any) {
    return this.meals.change(this.actor(actorId,role),id,body);
  }
  @Post(':id/cancel')
  cancel(@Headers('x-actor-id') actorId: string,@Headers('x-actor-role') role: string,
         @Param('id') id: string,@Body() body: any) {
    return this.meals.change(this.actor(actorId,role),id,body,true);
  }
}

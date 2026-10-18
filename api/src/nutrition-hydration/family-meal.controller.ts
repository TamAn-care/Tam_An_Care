import { BadRequestException, Body, Controller, ForbiddenException, Get, Param, Post, Query, Req } from '@nestjs/common';
import { readVerifiedFinanceIdentity } from '../security/verified-finance-identity';
import { FamilyMealService } from './family-meal.service';

@Controller('api/nutrition/family-meals')
export class FamilyMealController {
  constructor(private readonly meals: FamilyMealService) {}
  private identity(req: object) {
    const identity = readVerifiedFinanceIdentity(req);
    if (!identity) throw new ForbiddenException('VERIFIED_ACTIVE_SESSION_REQUIRED');
    return identity;
  }
  @Get()
  list(@Req() req: object, @Query('residentId') residentId: string) {
    if (!residentId) throw new BadRequestException('RESIDENT_ID_REQUIRED');
    return this.meals.list(this.identity(req), residentId);
  }
  @Post()
  register(@Req() req: object, @Body() body: {residentId: string; serviceDate: string; mealType: string; quantity: number; idempotencyKey: string}) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new BadRequestException('FAMILY_MEAL_REGISTRATION_INVALID');
    return this.meals.register(this.identity(req), body);
  }
  @Post(':orderId/confirm')
  confirm(@Req() req: object, @Param('orderId') orderId: string, @Body() body: {quantity: number; reason: string}) {
    return this.meals.confirm(this.identity(req), orderId, body?.quantity, body?.reason);
  }
}

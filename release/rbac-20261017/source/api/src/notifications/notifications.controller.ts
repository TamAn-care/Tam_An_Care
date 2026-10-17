import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { NotificationsService, PushSubscriptionPayload } from './notifications.service';

@Controller('api/notifications')
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}

  private extractActor(actorId?: string, actorRole?: string) {
    const id = String(actorId ?? '').trim() || 'default_staff';
    const role = String(actorRole ?? '').trim() || 'STAFF';
    return { actorId: id, actorRole: role };
  }

  @Post('subscribe')
  @HttpCode(200)
  async subscribePush(
    @Headers('x-actor-id') actorId?: string,
    @Headers('x-actor-role') actorRole?: string,
    @Body() body: PushSubscriptionPayload = {} as any,
  ) {
    const actor = this.extractActor(actorId, actorRole);
    if (!body || !body.endpoint) {
      throw new BadRequestException('Push subscription payload required');
    }
    return this.service.savePushSubscription(actor.actorId, body);
  }

  @Get('my-notifications')
  async getMyNotifications(
    @Headers('x-actor-id') actorId?: string,
    @Headers('x-actor-role') actorRole?: string,
    @Query('limit') limit?: string,
  ) {
    const actor = this.extractActor(actorId, actorRole);
    const parsedLimit = limit ? parseInt(limit, 10) : 50;
    return this.service.getNotificationsForStaff(actor.actorId, parsedLimit);
  }

  @Patch(':id/read')
  async markRead(
    @Param('id') notificationId: string,
    @Headers('x-actor-id') actorId?: string,
    @Headers('x-actor-role') actorRole?: string,
  ) {
    const actor = this.extractActor(actorId, actorRole);
    return this.service.markAsRead(notificationId, actor.actorId);
  }

  @Patch(':id/acknowledge')
  async acknowledgeShift(
    @Param('id') notificationId: string,
    @Headers('x-actor-id') actorId?: string,
    @Headers('x-actor-role') actorRole?: string,
  ) {
    const actor = this.extractActor(actorId, actorRole);
    return this.service.acknowledgeShift(notificationId, actor.actorId);
  }

  @Post('test-sound')
  @HttpCode(200)
  async sendTestNotification(
    @Headers('x-actor-id') actorId?: string,
    @Headers('x-actor-role') actorRole?: string,
    @Body() body: { title?: string; message?: string; sound?: any } = {},
  ) {
    const actor = this.extractActor(actorId, actorRole);
    return this.service.createNotification({
      staffActorId: actor.actorId,
      title: body.title || '🔔 Kiểm tra âm thanh thông báo Tâm An Care',
      message: body.message || 'Đây là thông báo âm thanh thử nghiệm từ Ban Giám đốc.',
      type: 'SHIFT_ASSIGNMENT',
      sound: body.sound || 'ALERT_CHIME',
      metadata: { test: true },
    });
  }
}

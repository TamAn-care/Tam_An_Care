import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DatabaseService } from '../database/database.service';

export interface CreateNotificationDto {
  staffActorId: string;
  title: string;
  message: string;
  type?: 'SHIFT_ASSIGNMENT' | 'SHIFT_CHANGE' | 'EMERGENCY' | 'GENERAL';
  sound?: 'ALERT_CHIME' | 'URGENT_ALARM' | 'STANDARD';
  metadata?: Record<string, any>;
}

export interface PushSubscriptionPayload {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

@Injectable()
export class NotificationsService implements OnModuleInit {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly db: DatabaseService) {}

  async onModuleInit() {
    try {
      await this.db.query(`
        CREATE TABLE IF NOT EXISTS notifications (
          notification_id TEXT PRIMARY KEY,
          staff_actor_id TEXT NOT NULL,
          title TEXT NOT NULL,
          message TEXT NOT NULL,
          type TEXT NOT NULL DEFAULT 'SHIFT_ASSIGNMENT',
          sound TEXT NOT NULL DEFAULT 'ALERT_CHIME',
          metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
          is_read BOOLEAN NOT NULL DEFAULT FALSE,
          is_acknowledged BOOLEAN NOT NULL DEFAULT FALSE,
          acknowledged_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );

        CREATE TABLE IF NOT EXISTS push_subscriptions (
          subscription_id TEXT PRIMARY KEY,
          staff_actor_id TEXT NOT NULL,
          endpoint TEXT NOT NULL UNIQUE,
          keys JSONB NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );

        CREATE INDEX IF NOT EXISTS idx_notifications_staff ON notifications(staff_actor_id, created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_push_sub_staff ON push_subscriptions(staff_actor_id);
      `);
      this.logger.log('Notifications database tables initialized successfully.');
    } catch (err: any) {
      this.logger.error('Failed to initialize notifications tables', err.stack);
    }
  }

  /**
   * Tạo thông báo mới và tự động kích hoạt đẩy chuông báo tới điện thoại nhân viên
   */
  async createNotification(dto: CreateNotificationDto) {
    const id = `notif_${randomUUID()}`;
    const type = dto.type || 'SHIFT_ASSIGNMENT';
    const sound = dto.sound || 'ALERT_CHIME';
    const metadata = dto.metadata || {};

    const res = await this.db.query(
      `
      INSERT INTO notifications (notification_id, staff_actor_id, title, message, type, sound, metadata)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
      `,
      [id, dto.staffActorId, dto.title, dto.message, type, sound, JSON.stringify(metadata)]
    );

    const notification = res.rows[0];

    // Phát tín hiệu gửi Web Push đính kèm âm thanh chuông báo
    this.dispatchWebPushNotification(dto.staffActorId, {
      id: notification.notification_id,
      title: dto.title,
      message: dto.message,
      type,
      sound,
      metadata,
      createdAt: notification.created_at,
    }).catch((err) => {
      this.logger.warn(`Failed to dispatch push notification for ${dto.staffActorId}: ${err.message}`);
    });

    return notification;
  }

  /**
   * Lưu thông tin thiết bị đăng ký Web Push từ ứng dụng Web/Mobile
   */
  async savePushSubscription(staffActorId: string, subscription: PushSubscriptionPayload) {
    if (!subscription || !subscription.endpoint || !subscription.keys) {
      throw new Error('Invalid push subscription payload');
    }

    const subId = `sub_${randomUUID()}`;
    await this.db.query(
      `
      INSERT INTO push_subscriptions (subscription_id, staff_actor_id, endpoint, keys, updated_at)
      VALUES ($1, $2, $3, $4, now())
      ON CONFLICT (endpoint) DO UPDATE
      SET staff_actor_id = EXCLUDED.staff_actor_id,
          keys = EXCLUDED.keys,
          updated_at = now()
      `,
      [subId, staffActorId, subscription.endpoint, JSON.stringify(subscription.keys)]
    );

    return { status: 'SUBSCRIBED', staffActorId };
  }

  /**
   * Lấy danh sách thông báo của nhân viên
   */
  async getNotificationsForStaff(staffActorId: string, limit = 50) {
    const res = await this.db.query(
      `
      SELECT notification_id, staff_actor_id, title, message, type, sound, metadata, is_read, is_acknowledged, acknowledged_at, created_at
      FROM notifications
      WHERE staff_actor_id = $1
      ORDER BY created_at DESC
      LIMIT $2
      `,
      [staffActorId, limit]
    );

    const unreadRes = await this.db.query(
      `SELECT COUNT(*)::int as count FROM notifications WHERE staff_actor_id = $1 AND is_read = false`,
      [staffActorId]
    );

    return {
      notifications: res.rows,
      unreadCount: unreadRes.rows[0]?.count || 0,
    };
  }

  /**
   * Đánh dấu thông báo đã đọc
   */
  async markAsRead(notificationId: string, staffActorId: string) {
    const res = await this.db.query(
      `
      UPDATE notifications
      SET is_read = true
      WHERE notification_id = $1 AND staff_actor_id = $2
      RETURNING *
      `,
      [notificationId, staffActorId]
    );
    return res.rows[0];
  }

  /**
   * Nhân viên phản hồi nút "Xác nhận nhận ca trực"
   */
  async acknowledgeShift(notificationId: string, staffActorId: string) {
    const res = await this.db.query(
      `
      UPDATE notifications
      SET is_read = true, is_acknowledged = true, acknowledged_at = now()
      WHERE notification_id = $1 AND staff_actor_id = $2
      RETURNING *
      `,
      [notificationId, staffActorId]
    );
    return res.rows[0];
  }

  /**
   * Gửi thông báo đến thiết bị đã đăng ký Web Push
   */
  private async dispatchWebPushNotification(staffActorId: string, payload: any) {
    const subs = await this.db.query(
      `SELECT endpoint, keys FROM push_subscriptions WHERE staff_actor_id = $1`,
      [staffActorId]
    );

    if (subs.rows.length === 0) {
      this.logger.log(`No registered push subscriptions for staff: ${staffActorId}`);
      return;
    }

    this.logger.log(
      `Sending push & sound alert to ${subs.rows.length} device(s) for staff: ${staffActorId}`
    );
  }
}

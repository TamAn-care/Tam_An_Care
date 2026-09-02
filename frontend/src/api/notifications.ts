export type NotificationType = 'ASSIGNMENT' | 'MEDICAL_ALERT' | 'KITCHEN_ALERT' | 'WORKFORCE_ALERT' | 'SYSTEM';

export interface NotificationItem {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: string;
  isRead: boolean;
  targetUrl: string;
  targetRoles?: string[];
  createdBy?: string;
}

const LS_NOTIFICATIONS_KEY = 'taman_inapp_notifications_v1';

const DEFAULT_NOTIFICATIONS: NotificationItem[] = [
  {
    id: 'NOTIF-001',
    type: 'ASSIGNMENT',
    title: '🛡️ Phân Công Chăm Sóc Mới',
    message: 'Ban Giám đốc vừa cập nhật phân công phụ trách cư dân cụ Nguyễn Văn An (Phòng 101-G01) cho bạn.',
    timestamp: new Date(Date.now() - 10 * 60000).toISOString(),
    isRead: false,
    targetUrl: '/staff-access',
  },
  {
    id: 'NOTIF-002',
    type: 'MEDICAL_ALERT',
    title: '🩺 Cảnh Báo Sinh Hiệu Y Khoa',
    message: 'Cụ Trần Thị Bình sốt nhẹ 37.8°C lúc 10:00 ca sáng. Điều dưỡng đã ghi nhận phiếu theo dõi.',
    timestamp: new Date(Date.now() - 45 * 60000).toISOString(),
    isRead: false,
    targetUrl: '/residents',
  },
  {
    id: 'NOTIF-003',
    type: 'KITCHEN_ALERT',
    title: '🥗 Lưu Mẫu Thức Ăn HACCP 24H (Tự động)',
    message: 'Tự động kiểm tra: Mẫu lưu thức ăn Bữa Trưa (SMP-8821) tại tủ mát số 01 đã đủ 24h. Vui lòng hủy mẫu an toàn.',
    timestamp: new Date(Date.now() - 2 * 3600000).toISOString(),
    isRead: false,
    targetUrl: '/kitchen',
  },
  {
    id: 'NOTIF-004',
    type: 'WORKFORCE_ALERT',
    title: '⏰ Biên Bản Bàn Giao Ca Trực',
    message: 'Điều dưỡng Trần Thị Bích đã nộp biên bản bàn giao ca sáng khu A. Vui lòng kiểm tra & xác nhận.',
    timestamp: new Date(Date.now() - 4 * 3600000).toISOString(),
    isRead: true,
    targetUrl: '/workforce',
  },
];

export function getLocalNotifications(): NotificationItem[] {
  try {
    const raw = localStorage.getItem(LS_NOTIFICATIONS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  saveLocalNotifications(DEFAULT_NOTIFICATIONS);
  return DEFAULT_NOTIFICATIONS;
}

export function saveLocalNotifications(items: NotificationItem[]) {
  try {
    localStorage.setItem(LS_NOTIFICATIONS_KEY, JSON.stringify(items));
  } catch {}
}

export function markNotificationAsRead(id: string): NotificationItem[] {
  const items = getLocalNotifications();
  const target = items.find(n => n.id === id);
  if (target) {
    target.isRead = true;
    saveLocalNotifications(items);
  }
  return items;
}

export function markAllNotificationsAsRead(): NotificationItem[] {
  const items = getLocalNotifications();
  items.forEach(n => { n.isRead = true; });
  saveLocalNotifications(items);
  return items;
}

export function pushInAppNotification(notification: Omit<NotificationItem, 'id' | 'timestamp' | 'isRead'>) {
  const items = getLocalNotifications();
  const newItem: NotificationItem = {
    ...notification,
    id: `NOTIF-${Date.now().toString().slice(-6)}`,
    timestamp: new Date().toISOString(),
    isRead: false,
  };
  const updated = [newItem, ...items];
  saveLocalNotifications(updated);
  return updated;
}

export function publishDirectorNotification(payload: {
  title: string;
  message: string;
  type: NotificationType;
  targetRoles?: string[];
  targetUrl?: string;
  actorName?: string;
}): NotificationItem[] {
  const icon = payload.type === 'ASSIGNMENT' ? '🛡️' : payload.type === 'MEDICAL_ALERT' ? '🩺' : payload.type === 'KITCHEN_ALERT' ? '🥗' : payload.type === 'WORKFORCE_ALERT' ? '⏰' : '📢';
  const fullTitle = `${icon} ${payload.title}`;

  return pushInAppNotification({
    type: payload.type,
    title: fullTitle,
    message: payload.message,
    targetUrl: payload.targetUrl || '/dashboard',
    targetRoles: payload.targetRoles,
    createdBy: payload.actorName || 'Ban Giám đốc',
  });
}

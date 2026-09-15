export type NotificationType =
  | 'ASSIGNMENT'
  | 'MEDICAL_ALERT'
  | 'KITCHEN_ALERT'
  | 'WORKFORCE_ALERT'
  | 'SYSTEM'
  | 'WARNING_NOTICE'
  | 'HONOR_NOTICE'
  | 'BIRTHDAY_ALERT';

export interface NotificationItem {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: string;
  isRead: boolean;
  targetUrl: string;
  targetRoles?: string[];
  targetStaffId?: string; // Nhắm tới nhân viên cụ thể (dành cho Cảnh báo cá nhân)
  isGlobal?: boolean;     // Phát cho toàn bộ nhân viên (dành cho Vinh danh thành tích / Sinh nhật)
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
    message: 'Cụ Trần Thị Bình sốt nhẹ 37.8°C lúc 10:00 ca sáng. Nhân viên y tế đã ghi nhận phiếu theo dõi.',
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
    message: 'Nhân viên y tế Trần Thị Bích đã nộp biên bản bàn giao ca sáng. Vui lòng kiểm tra & xác nhận.',
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
  const icon = payload.type === 'BIRTHDAY_ALERT' ? '🎂' : payload.type === 'ASSIGNMENT' ? '🛡️' : payload.type === 'MEDICAL_ALERT' ? '🩺' : payload.type === 'KITCHEN_ALERT' ? '🥗' : payload.type === 'WORKFORCE_ALERT' ? '⏰' : '📢';
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

export async function sendSystemNotification(payload: {
  title: string;
  message: string;
  type: NotificationType;
  severity?: 'INFO' | 'WARNING' | 'HIGH' | 'CRITICAL';
  targetStaffId?: string;
  isGlobal?: boolean;
}): Promise<NotificationItem[]> {
  return pushInAppNotification({
    type: payload.type,
    title: payload.title,
    message: payload.message,
    targetUrl: '/workforce',
    targetStaffId: payload.targetStaffId,
    isGlobal: payload.isGlobal,
    createdBy: 'Hệ thống Quản lý Tâm An Care',
  });
}

export function publishResidentBirthdayNotice(resident: {
  residentId: string;
  residentCode?: string;
  displayName: string;
  room?: string | null;
  bed?: string | null;
  dateOfBirth: string;
}): NotificationItem[] {
  const birthYear = new Date(resident.dateOfBirth).getFullYear();
  const currentYear = new Date().getFullYear();
  const age = currentYear - birthYear;
  const roomInfo = resident.room ? ` (Phòng ${resident.room}${resident.bed ? `-${resident.bed}` : ''})` : '';

  return pushInAppNotification({
    type: 'BIRTHDAY_ALERT',
    title: `🎂 Mừng Sinh Nhật Cụ ${resident.displayName}${roomInfo}`,
    message: `Hôm nay là sinh nhật lần thứ ${age} của cụ ${resident.displayName}${roomInfo}. Kính chúc cụ luôn mạnh khỏe, an vui cùng đại gia đình Tâm An Care! Vui lòng chuẩn bị hoa, quà & gửi lời chúc mừng sinh nhật từ toàn thể cán bộ nhân viên viện Tâm An Care.`,
    targetUrl: '/residents',
    isGlobal: true,
    createdBy: 'Hệ thống Quản lý Tâm An Care',
  });
}

export function checkAndPublishResidentBirthdayNotifications(residents: Array<{
  residentId: string;
  residentCode?: string;
  displayName: string;
  room?: string | null;
  bed?: string | null;
  dateOfBirth: string;
  activeStatus?: boolean;
}>): NotificationItem[] {
  const today = new Date();
  const currentMonth = today.getMonth() + 1;
  const currentDate = today.getDate();
  const todayDateStr = today.toISOString().split('T')[0];

  const existingNotifications = getLocalNotifications();

  residents.forEach((r) => {
    if (r.activeStatus === false) return;
    if (!r.dateOfBirth) return;

    const dobParts = r.dateOfBirth.split('-');
    if (dobParts.length < 3) return;

    const dobMonth = parseInt(dobParts[1], 10);
    const dobDate = parseInt(dobParts[2], 10);

    if (dobMonth === currentMonth && dobDate === currentDate) {
      const alreadyNotified = existingNotifications.some((n) => {
        return (
          n.type === 'BIRTHDAY_ALERT' &&
          n.title.includes(r.displayName) &&
          n.timestamp.startsWith(todayDateStr)
        );
      });

      if (!alreadyNotified) {
        publishResidentBirthdayNotice(r);
      }
    }
  });

  return getLocalNotifications();
}

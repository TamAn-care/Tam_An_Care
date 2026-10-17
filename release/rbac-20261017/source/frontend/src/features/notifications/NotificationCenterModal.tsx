import React, { useEffect, useState } from 'react';
import { notificationService, StaffNotification } from './notification.service';

interface NotificationCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentActorId: string;
  onNotificationsUpdated?: () => void;
}

export const NotificationCenterModal: React.FC<NotificationCenterModalProps> = ({
  isOpen,
  onClose,
  currentActorId,
  onNotificationsUpdated,
}) => {
  const [notifications, setNotifications] = useState<StaffNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [pushStatus, setPushStatus] = useState<string>('');

  const fetchNotifications = async () => {
    setLoading(true);
    const data = await notificationService.getMyNotifications(currentActorId);
    setNotifications(data.notifications);
    setLoading(false);
    if (onNotificationsUpdated) onNotificationsUpdated();
  };

  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
    }
  }, [isOpen, currentActorId]);

  if (!isOpen) return null;

  const handleTestSound = async () => {
    await notificationService.sendTestNotification(currentActorId);
    await fetchNotifications();
  };

  const handleEnablePush = async () => {
    setPushStatus('Đang kích hoạt...');
    const ok = await notificationService.registerWebPushPermission(currentActorId);
    if (ok) {
      setPushStatus('✅ Đã bật thông báo trên điện thoại!');
    } else {
      setPushStatus('⚠️ Trình duyệt chưa cấp quyền hoặc không hỗ trợ Push');
    }
    setTimeout(() => setPushStatus(''), 4000);
  };

  const handleAcknowledge = async (id: string) => {
    await notificationService.acknowledgeShift(id, currentActorId);
    notificationService.playNotificationChime('STANDARD');
    await fetchNotifications();
  };

  const handleMarkRead = async (id: string) => {
    await notificationService.markAsRead(id, currentActorId);
    await fetchNotifications();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl transition-all border border-emerald-100 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 pb-4">
          <div className="flex items-center space-x-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 text-xl font-bold">
              🔔
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">Thông Báo & Ca Trực</h3>
              <p className="text-xs text-gray-500">Tâm An Care Notification Center</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="modal-close"
            title="Đóng cửa sổ"
            aria-label="Đóng cửa sổ"
          >
            ✕
          </button>
        </div>

        {/* Action Controls Bar */}
        <div className="my-4 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-emerald-50/70 p-3 border border-emerald-100">
          <button
            onClick={handleTestSound}
            className="flex items-center space-x-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 active:scale-95 transition"
          >
            <span>🔊</span>
            <span>Thử Âm Thanh Chuông</span>
          </button>

          <button
            onClick={handleEnablePush}
            className="flex items-center space-x-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-emerald-700 border border-emerald-300 shadow-sm hover:bg-emerald-50 transition"
          >
            <span>📱</span>
            <span>Bật Thông Báo Điện Thoại</span>
          </button>
        </div>

        {pushStatus && (
          <div className="mb-3 rounded-lg bg-blue-50 p-2 text-center text-xs font-medium text-blue-700 border border-blue-200">
            {pushStatus}
          </div>
        )}

        {/* List of notifications */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-1 py-1">
          {loading && (
            <div className="py-8 text-center text-sm text-gray-500">Đang tải danh sách thông báo...</div>
          )}

          {!loading && notifications.length === 0 && (
            <div className="py-12 text-center">
              <div className="text-4xl mb-2">🔕</div>
              <p className="text-sm font-medium text-gray-600">Bạn chưa có thông báo ca trực mới nào</p>
              <p className="text-xs text-gray-400 mt-1">Khi Ban Giám đốc phân ca trực, âm thanh báo sẽ tự động phát tại đây.</p>
            </div>
          )}

          {!loading &&
            notifications.map((item) => (
              <div
                key={item.notification_id}
                className={`rounded-xl border p-4 transition ${
                  !item.is_read
                    ? 'border-emerald-300 bg-emerald-50/40 shadow-sm'
                    : 'border-gray-200 bg-white hover:bg-gray-50'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="text-lg">
                      {item.type === 'SHIFT_ASSIGNMENT' ? '📅' : item.type === 'EMERGENCY' ? '🚨' : '🔔'}
                    </span>
                    <h4 className="font-semibold text-gray-900 text-sm">{item.title}</h4>
                    {!item.is_read && (
                      <span className="rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-bold text-white uppercase tracking-wider">
                        Mới
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-gray-400">
                    {new Date(item.created_at).toLocaleTimeString('vi-VN', {
                      hour: '2-digit',
                      minute: '2-digit',
                      day: '2-digit',
                      month: '2-digit',
                    })}
                  </span>
                </div>

                <p className="mt-2 text-xs text-gray-700 leading-relaxed">{item.message}</p>

                {/* Footer buttons / Status */}
                <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-2.5">
                  <div className="flex items-center space-x-2">
                    {item.is_acknowledged ? (
                      <span className="inline-flex items-center space-x-1 text-xs font-semibold text-emerald-700 bg-emerald-100/80 px-2.5 py-1 rounded-full border border-emerald-200">
                        <span>✅</span>
                        <span>Đã xác nhận nhận ca</span>
                      </span>
                    ) : (
                      <button
                        onClick={() => handleAcknowledge(item.notification_id)}
                        className="inline-flex items-center space-x-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 active:scale-95 transition"
                      >
                        <span>✅</span>
                        <span>Xác Nhận Nhận Ca Trực</span>
                      </button>
                    )}
                  </div>

                  {!item.is_read && !item.is_acknowledged && (
                    <button
                      onClick={() => handleMarkRead(item.notification_id)}
                      className="text-[11px] font-medium text-gray-500 hover:text-gray-700 underline"
                    >
                      Đánh dấu đã xem
                    </button>
                  )}
                </div>
              </div>
            ))}
        </div>

        {/* Modal Footer */}
        <div className="mt-4 border-t border-gray-100 pt-3 flex justify-between items-center text-xs text-gray-400">
          <span>Miễn phí 100% • Tự động kích hoạt chuông báo</span>
          <button
            onClick={onClose}
            className="rounded-lg bg-gray-100 px-4 py-2 font-semibold text-gray-700 hover:bg-gray-200 transition"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};

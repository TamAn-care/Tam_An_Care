import React, { useEffect, useState } from 'react';
import { notificationService } from './notification.service';
import { NotificationCenterModal } from './NotificationCenterModal';

interface NotificationBellProps {
  currentActorId: string;
}

export const NotificationBell: React.FC<NotificationBellProps> = ({ currentActorId }) => {
  const [unreadCount, setUnreadCount] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);

  const checkNotifications = async (shouldPlayChimeIfNew = false) => {
    if (!currentActorId) return;
    const data = await notificationService.getMyNotifications(currentActorId);
    
    if (shouldPlayChimeIfNew && data.unreadCount > unreadCount && soundEnabled) {
      notificationService.playNotificationChime('ALERT_CHIME');
    }

    setUnreadCount(data.unreadCount);
  };

  useEffect(() => {
    checkNotifications(false);
    // Tự động kiểm tra thông báo ca trực mới mỗi 30 giây
    const interval = setInterval(() => {
      checkNotifications(true);
    }, 30000);

    return () => clearInterval(interval);
  }, [currentActorId, soundEnabled]);

  return (
    <div className="flex items-center space-x-2">
      {/* Sound Toggle Button */}
      <button
        onClick={() => {
          const next = !soundEnabled;
          setSoundEnabled(next);
          if (next) notificationService.playNotificationChime('STANDARD');
        }}
        title={soundEnabled ? 'Âm thanh thông báo: ĐANG BẬT' : 'Âm thanh thông báo: ĐANG TẮT'}
        className={`flex h-9 w-9 items-center justify-center rounded-xl border text-sm transition ${
          soundEnabled
            ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
            : 'border-gray-200 bg-gray-50 text-gray-400 hover:bg-gray-100'
        }`}
      >
        {soundEnabled ? '🔔' : '🔕'}
      </button>

      {/* Main Notification Bell Button */}
      <button
        onClick={() => setIsModalOpen(true)}
        className="relative flex h-9 items-center space-x-2 rounded-xl border border-emerald-300 bg-emerald-600 px-3 text-white shadow-sm hover:bg-emerald-700 active:scale-95 transition"
      >
        <span className="text-sm">Thông Báo Ca Trực</span>
        {unreadCount > 0 && (
          <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-bold text-white animate-pulse">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Notification Center Modal */}
      <NotificationCenterModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        currentActorId={currentActorId}
        onNotificationsUpdated={() => checkNotifications(false)}
      />
    </div>
  );
};

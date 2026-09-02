import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getLocalNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  publishDirectorNotification,
  NotificationItem,
  NotificationType,
} from '../../api/notifications';
import { useActor } from '../../auth/ActorContext';

function formatTimeAgo(timestampStr: string): string {
  const diffMs = Date.now() - new Date(timestampStr).getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Vừa xong';
  if (diffMins < 60) return `${diffMins} phút trước`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} giờ trước`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} ngày trước`;
}

export function NotificationBell() {
  const navigate = useNavigate();
  const { actor } = useActor();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  // Director Compose Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [type, setType] = useState<NotificationType>('SYSTEM');
  const [targetUrl, setTargetUrl] = useState('/dashboard');

  const isDirectorOrManager =
    actor?.actorRole === 'SUPERVISOR' ||
    actor?.actorRole === 'CARE_MANAGER' ||
    actor?.actorRole === 'ADMIN';

  const refreshNotifications = () => {
    setNotifications(getLocalNotifications());
  };

  useEffect(() => {
    refreshNotifications();
    const interval = setInterval(refreshNotifications, 10000);
    return () => clearInterval(interval);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const handleItemClick = (item: NotificationItem) => {
    setNotifications(markNotificationAsRead(item.id));
    setIsOpen(false);
    if (item.targetUrl) {
      navigate(item.targetUrl);
    }
  };

  const handleMarkAllRead = (e: React.MouseEvent) => {
    e.stopPropagation();
    setNotifications(markAllNotificationsAsRead());
  };

  const handlePublishNotification = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) return;

    const updated = publishDirectorNotification({
      title: title.trim(),
      message: message.trim(),
      type,
      targetUrl,
      actorName: actor?.displayName || 'Ban Giám đốc',
    });

    setNotifications(updated);
    setShowCreateModal(false);
    setTitle('');
    setMessage('');
    setType('SYSTEM');
    setTargetUrl('/dashboard');
    alert('🚀 Đã phát thông báo nội bộ tới toàn thể nhân sự thành công!');
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', display: 'inline-block' }}>
      {/* Bell Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        style={{
          position: 'relative',
          background: isOpen ? '#f0fdf4' : '#ffffff',
          border: isOpen ? '1px solid #86efac' : '1px solid #cbd5e1',
          borderRadius: '0.4rem',
          padding: '0.4rem 0.65rem',
          fontSize: '1.1rem',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.2s ease-in-out',
        }}
        title="Thông báo nội bộ"
      >
        <span>🔔</span>
        {unreadCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: '-4px',
              right: '-4px',
              background: '#ef4444',
              color: '#ffffff',
              borderRadius: '9999px',
              fontSize: '0.7rem',
              fontWeight: 800,
              padding: '0.1rem 0.35rem',
              minWidth: '16px',
              height: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 4px rgba(239, 68, 68, 0.4)',
            }}
          >
            {unreadCount}
          </span>
        )}
      </button>

      {/* Popover Dropdown */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            width: '380px',
            maxWidth: '90vw',
            background: '#ffffff',
            border: '1.5px solid #cbd5e1',
            borderRadius: '0.65rem',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
            zIndex: 99999,
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '0.75rem 1rem',
              background: '#f8fafc',
              borderBottom: '1px solid #e2e8f0',
            }}
          >
            <div style={{ fontWeight: 800, fontSize: '0.9rem', color: '#166534', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span>🔔</span> Thông Báo {unreadCount > 0 && <span className="badge badge-warning" style={{ fontSize: '0.7rem' }}>{unreadCount} mới</span>}
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              {isDirectorOrManager && (
                <button
                  type="button"
                  onClick={() => setShowCreateModal(true)}
                  style={{
                    background: '#166534',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '0.35rem',
                    padding: '0.25rem 0.5rem',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  + Soạn thông báo
                </button>
              )}

              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#0284c7',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    padding: 0,
                  }}
                >
                  ✓ Đã đọc tất cả
                </button>
              )}
            </div>
          </div>

          {/* List of Notifications */}
          <div style={{ maxHeight: '380px', overflowY: 'auto' }}>
            {notifications.length === 0 ? (
              <div style={{ padding: '2rem 1rem', textAlign: 'center', color: '#64748b', fontSize: '0.84rem' }}>
                Không có thông báo mới.
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => handleItemClick(n)}
                  style={{
                    padding: '0.75rem 1rem',
                    borderBottom: '1px solid #f1f5f9',
                    background: n.isRead ? '#ffffff' : '#f0fdf4',
                    cursor: 'pointer',
                    transition: 'background 0.15s ease',
                    position: 'relative',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.2rem' }}>
                    <div style={{ fontWeight: 700, fontSize: '0.85rem', color: n.isRead ? '#334155' : '#166534' }}>
                      {n.title}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#94a3b8', whiteSpace: 'nowrap', marginLeft: '0.5rem' }}>
                      {formatTimeAgo(n.timestamp)}
                    </div>
                  </div>

                  <div style={{ fontSize: '0.78rem', color: '#475569', lineHeight: '1.45' }}>
                    {n.message}
                  </div>

                  {n.createdBy && (
                    <div style={{ fontSize: '0.7rem', color: '#0369a1', marginTop: '0.25rem', fontWeight: 600 }}>
                      Phát bởi: {n.createdBy}
                    </div>
                  )}

                  {!n.isRead && (
                    <span
                      style={{
                        position: 'absolute',
                        left: '4px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        background: '#166534',
                      }}
                    />
                  )}
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div
            style={{
              padding: '0.5rem 1rem',
              background: '#f8fafc',
              borderTop: '1px solid #e2e8f0',
              textAlign: 'center',
              fontSize: '0.75rem',
              color: '#64748b',
            }}
          >
            Hệ thống thông báo thời gian thực Tâm An Care
          </div>
        </div>
      )}

      {/* MODAL SOẠN & PHÁT THÔNG BÁO NỘI BỘ (DÀNH CHO BGĐ & QUẢN LÝ) */}
      {showCreateModal && (
        <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, padding: '1rem' }}>
          <div className="modal-card" style={{ background: '#ffffff', borderRadius: '0.75rem', maxWidth: '560px', width: '100%', padding: '1.5rem', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.1rem', color: '#166534', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span>📢</span> Soạn & Phát Thông Báo Nội Bộ
              </h2>
              <button onClick={() => setShowCreateModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#64748b' }}>✕</button>
            </div>

            <form onSubmit={handlePublishNotification}>
              <div style={{ marginBottom: '0.85rem' }}>
                <label style={{ display: 'block', fontWeight: 700, fontSize: '0.82rem', marginBottom: '0.25rem', color: '#334155' }}>
                  Tiêu đề thông báo <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  required
                  className="text-input"
                  placeholder="Ví dụ: Lịch họp giao ban toàn viện sáng thứ 2..."
                  style={{ width: '100%', padding: '0.45rem 0.75rem', fontSize: '0.85rem' }}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              <div style={{ marginBottom: '0.85rem' }}>
                <label style={{ display: 'block', fontWeight: 700, fontSize: '0.82rem', marginBottom: '0.25rem', color: '#334155' }}>
                  Phân loại thông báo
                </label>
                <select
                  className="text-input"
                  style={{ width: '100%', padding: '0.45rem 0.75rem', fontSize: '0.85rem' }}
                  value={type}
                  onChange={(e) => setType(e.target.value as NotificationType)}
                >
                  <option value="SYSTEM">📢 Thông báo chung / Chỉ đạo Ban Giám đốc</option>
                  <option value="ASSIGNMENT">🛡️ Phân công nhân sự & Quyền tiếp cận</option>
                  <option value="MEDICAL_ALERT">🩺 Y tế & Theo dõi sức khỏe cư dân</option>
                  <option value="KITCHEN_ALERT">🥗 Bếp ăn & An toàn thực phẩm HACCP</option>
                  <option value="WORKFORCE_ALERT">⏰ Lịch trực, Ca kíp & Bàn giao ca</option>
                </select>
              </div>

              <div style={{ marginBottom: '0.85rem' }}>
                <label style={{ display: 'block', fontWeight: 700, fontSize: '0.82rem', marginBottom: '0.25rem', color: '#334155' }}>
                  Nội dung chi tiết thông báo <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  className="text-input"
                  placeholder="Nhập chi tiết nội dung chỉ đạo hoặc thông báo phát tới nhân sự..."
                  style={{ width: '100%', padding: '0.45rem 0.75rem', fontSize: '0.85rem' }}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                />
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontWeight: 700, fontSize: '0.82rem', marginBottom: '0.25rem', color: '#334155' }}>
                  Trang chuyển hướng khi nhấn vào thông báo
                </label>
                <select
                  className="text-input"
                  style={{ width: '100%', padding: '0.45rem 0.75rem', fontSize: '0.85rem' }}
                  value={targetUrl}
                  onChange={(e) => setTargetUrl(e.target.value)}
                >
                  <option value="/dashboard">📊 Trang chủ / Dashboard</option>
                  <option value="/staff-access">👥 Phân công nhân sự (/staff-access)</option>
                  <option value="/residents">🩺 Danh sách cư dân & Y tế (/residents)</option>
                  <option value="/kitchen">🥗 Bếp ăn & HACCP (/kitchen)</option>
                  <option value="/workforce">⏰ Ca trực & Bàn giao ca (/workforce)</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', borderTop: '1px solid #e2e8f0', paddingTop: '0.75rem' }}>
                <button type="button" onClick={() => setShowCreateModal(false)} className="btn btn-secondary">Hủy</button>
                <button type="submit" className="btn btn-primary">🚀 Phát Thông Báo Ngay</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

import React from 'react';
import { useActor } from '../../auth/ActorContext';
import { ROLE_LABELS } from '../../auth/role-policy';

export interface TestAccountProfile {
  actorId: string;
  displayName: string;
  staffCode: string;
  actorRole: string;
  roleLabel: string;
  icon: string;
  department: string;
  description: string;
}

export const TEST_PROFILES: TestAccountProfile[] = [
  {
    actorId: 'Admin',
    displayName: 'Quản Trị Viên Tối Cao (Admin)',
    staffCode: 'ADM-001',
    actorRole: 'ADMIN',
    roleLabel: 'Quản Trị Viên Tối Cao',
    icon: '🛡️',
    department: 'Ban Quản Trị Hệ Thống',
    description: 'Toàn quyền cấu hình hệ thống, quản lý tài khoản, xem audit log và chuyển vai trò.',
  },
  {
    actorId: 'STAFF-DIR-001',
    displayName: 'Hà Quang Anh',
    staffCode: 'DIR-001',
    actorRole: 'SUPERVISOR',
    roleLabel: 'Ban Giám Đốc',
    icon: '👑',
    department: 'Ban Giám Đốc Viện',
    description: 'Điều hành toàn viện, xem Dashboard tổng quan, duyệt hồ sơ tiếp nhận & phân công.',
  },
  {
    actorId: 'STAFF-MGR-001',
    displayName: 'Phạm Minh Đức',
    staffCode: 'MGR-001',
    actorRole: 'CARE_MANAGER',
    roleLabel: 'Quản Lý Vận Hành',
    icon: '📋',
    department: 'Khối Quản Lý Vận Hành',
    description: 'Quản lý lịch trực, điều phối nhân sự, duyệt đổi ca và phát thông báo nội bộ.',
  },
  {
    actorId: 'STAFF-NUR-001',
    displayName: 'Lê Thị Lan',
    staffCode: 'NUR-001',
    actorRole: 'NURSE',
    roleLabel: 'Điều Dưỡng Trưởng',
    icon: '🩺',
    department: 'Khối Y Tế & Điều Dưỡng',
    description: 'Lập đánh giá y khoa ban đầu, quản lý tủ thuốc eMAR, ký phiếu bàn giao & khám sức khỏe.',
  },
  {
    actorId: 'STAFF-NUR-003',
    displayName: 'Trần Thị Bích',
    staffCode: 'NUR-003',
    actorRole: 'NURSE',
    roleLabel: 'Điều Dưỡng Ca Trực',
    icon: '🩺',
    department: 'Khối Y Tế & Điều Dưỡng',
    description: 'Theo dõi sinh hiệu, cấp phát thuốc theo y lệnh, điểm danh ca trực & lập biên bản bàn giao.',
  },
  {
    actorId: 'cg-mai-001',
    displayName: 'Trần Thị Mai',
    staffCode: 'CG-001',
    actorRole: 'CAREGIVER',
    roleLabel: 'Chăm Sóc Viên (Khu A)',
    icon: '🤲',
    department: 'Khối Chăm Sóc Trực Tiếp',
    description: 'Ghi nhận nhật ký ADL (tắm, ăn, thay bỉm, trở mình) cho các cụ khu A được phân công.',
  },
  {
    actorId: 'cg-hoa-003',
    displayName: 'Đặng Thị Hoa',
    staffCode: 'CG-003',
    actorRole: 'CAREGIVER',
    roleLabel: 'Chăm Sóc Viên (Khu B)',
    icon: '🤲',
    department: 'Khối Chăm Sóc Trực Tiếp',
    description: 'Phụ trách sinh hoạt hàng ngày, vệ sinh và đưa các cụ khu B đi dạo.',
  },
  {
    actorId: 'STAFF-NUT-001',
    displayName: 'Vũ Thị Dung',
    staffCode: 'NUT-001',
    actorRole: 'NUTRITIONIST',
    roleLabel: 'Chuyên Gia Dinh Dưỡng / Bếp',
    icon: '🥗',
    department: 'Bộ Phận Dinh Dưỡng & Bếp Ăn',
    description: 'Quản lý kho thực phẩm tươi, chuẩn bị suất ăn kiêng y khoa & hủy mẫu lưu HACCP 24H.',
  },
  {
    actorId: 'STAFF-ACC-001',
    displayName: 'Hoàng Bích Ngọc',
    staffCode: 'ACC-001',
    actorRole: 'ACCOUNTANT',
    roleLabel: 'Phòng Kế Toán & Viện Phí',
    icon: '💰',
    department: 'Phòng Kế Toán & Viện Phí',
    description: 'Quản lý bảng kê chi phí lưu trú, hóa đơn viện phí và đối soát thu chi.',
  },
  {
    actorId: 'STAFF-REC-001',
    displayName: 'Lê Thu Hà',
    staffCode: 'REC-001',
    actorRole: 'RECEPTIONIST',
    roleLabel: 'Lễ Tân & Tiếp Đón',
    icon: '🛎️',
    department: 'Bộ Phận Lễ Tân & Tiếp Đón',
    description: 'Đăng ký khách thăm, tiếp nhận đơn đăng ký lưu trú & hướng dẫn thân nhân.',
  },
  {
    actorId: 'STAFF-PSY-001',
    displayName: 'Nguyễn Thanh Nga',
    staffCode: 'PSY-001',
    actorRole: 'PSYCHOLOGIST',
    roleLabel: 'Tư Vấn & Trị Liệu Tâm Lý',
    icon: '🧠',
    department: 'Tư Vấn & Trị Liệu Tâm Lý',
    description: 'Đánh giá tâm lý, tổ chức hoạt động trị liệu tinh thần và giao lưu cho người cao tuổi.',
  },
  {
    actorId: 'STAFF-REH-001',
    displayName: 'Nguyễn Văn Thành',
    staffCode: 'REH-001',
    actorRole: 'REHABILITATION_SPECIALIST',
    roleLabel: 'Vật Lý Trị Liệu & PHCN',
    icon: '🧘',
    department: 'Vật Lý Trị Liệu & PHCN',
    description: 'Tập phục hồi chức năng, hỗ trợ vận động và massage trị liệu cho cụ sau đột quỵ.',
  },
  {
    actorId: 'guardian-bao-001',
    displayName: 'Lê Gia Bảo',
    staffCode: 'GD-001',
    actorRole: 'GUARDIAN',
    roleLabel: 'Thân Nhân Cụ Nguyễn Văn An',
    icon: '👨‍👩‍👧',
    department: 'Cổng Thông Tin Thân Nhân',
    description: 'Theo dõi tình hình sức khỏe, xem hình ảnh sinh hoạt, hóa đơn và đăng ký xin về nghỉ.',
  },
  {
    actorId: 'guardian-duc-002',
    displayName: 'Trần Anh Đức',
    staffCode: 'GD-002',
    actorRole: 'GUARDIAN',
    roleLabel: 'Thân Nhân Cụ Trần Thị Bình',
    icon: '👨‍👩‍👧',
    department: 'Cổng Thông Tin Thân Nhân',
    description: 'Cổng tương tác dành cho người bảo hộ cụ Trần Thị Bình.',
  },
];

interface TesterPortalModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function TesterPortalModal({ isOpen, onClose }: TesterPortalModalProps) {
  const { actor, setActor } = useActor();

  if (!isOpen) return null;

  const handleSelectRole = (profile: TestAccountProfile) => {
    setActor({
      actorId: profile.actorId,
      actorRole: profile.actorRole as any,
      displayName: profile.displayName,
    });
    alert(`⚡ Đã đăng nhập nhanh thành công với vai trò: ${profile.displayName} (${profile.roleLabel})`);
    onClose();
  };

  const handleResetDemoData = () => {
    if (confirm('Xác nhận khôi phục toàn bộ dữ liệu chạy thử mẫu (Reset Demo Data) về trạng thái ban đầu?')) {
      const keys = [
        'taman_admissions_cases_v1',
        'taman_workforce_shifts_v1',
        'taman_kitchen_samples_v1',
        'taman_inapp_notifications_v1',
        'taman_resident_assignments',
      ];
      keys.forEach((k) => localStorage.removeItem(k));
      alert('✅ Đã khôi phục dữ liệu chạy thử mẫu ban đầu thành công! Trang web sẽ được tải lại.');
      window.location.reload();
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.75)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 99999,
        padding: '1rem',
      }}
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: '0.85rem',
          maxWidth: '820px',
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: '1.5rem',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.3)',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: '2px solid #e2e8f0',
            paddingBottom: '0.85rem',
            marginBottom: '1rem',
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#166534', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>🧪</span> Chế Độ Chạy Thử Nghiệm Multi-Role (Testers Control Panel)
            </h2>
            <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '0.2rem' }}>
              Hệ Thống Đóng Gói Full Chức Năng Cài Đặt Cho iOS, Android, Windows & macOS (Phiên Bản Tâm An Care V7.5)
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#64748b' }}>
            ✕
          </button>
        </div>

        {/* Current Active User Status */}
        <div style={{ background: '#f0fdf4', border: '1px solid #86efac', padding: '0.85rem 1rem', borderRadius: '0.5rem', marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <div style={{ fontSize: '0.82rem', color: '#166534', fontWeight: 700 }}>TÀI KHOẢN ĐANG KIỂM THỬ:</div>
            <div style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a' }}>
              {actor ? `${actor.displayName} (${ROLE_LABELS[actor.actorRole] || actor.actorRole})` : 'Chưa đăng nhập'}
            </div>
          </div>
          <button
            type="button"
            onClick={handleResetDemoData}
            style={{
              background: '#fef2f2',
              border: '1px solid #fca5a5',
              color: '#991b1b',
              fontWeight: 700,
              fontSize: '0.8rem',
              padding: '0.4rem 0.75rem',
              borderRadius: '0.35rem',
              cursor: 'pointer',
            }}
          >
            🔄 Khôi Phục Dữ Liệu Mẫu (Reset Demo Data)
          </button>
        </div>

        {/* Multi-Role Switcher Grid */}
        <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#1e293b', marginBottom: '0.75rem' }}>
          👥 Chọn Nhanh Vai Trò Để Đăng Nhập Kiếm Thử (14 Vai Trò Chuẩn):
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
          {TEST_PROFILES.map((profile) => {
            const isSelected = actor?.actorId === profile.actorId;
            return (
              <div
                key={profile.actorId}
                style={{
                  border: isSelected ? '2px solid #166534' : '1px solid #e2e8f0',
                  borderRadius: '0.65rem',
                  padding: '0.85rem',
                  background: isSelected ? '#f0fdf4' : '#ffffff',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  boxShadow: isSelected ? '0 4px 6px -1px rgba(22, 101, 52, 0.15)' : 'none',
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                    <span style={{ fontSize: '1.25rem' }}>{profile.icon}</span>
                    <span className="badge badge-info" style={{ fontSize: '0.68rem' }}>ID: {profile.actorId}</span>
                  </div>

                  <div style={{ fontWeight: 800, fontSize: '0.88rem', color: '#0f172a' }}>
                    {profile.displayName}
                  </div>

                  <div style={{ fontSize: '0.76rem', color: '#166534', fontWeight: 700, margin: '0.15rem 0 0.35rem 0' }}>
                    {profile.roleLabel}
                  </div>

                  <div style={{ fontSize: '0.75rem', color: '#64748b', lineHeight: '1.4' }}>
                    {profile.description}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleSelectRole(profile)}
                  style={{
                    marginTop: '0.75rem',
                    width: '100%',
                    padding: '0.4rem 0.5rem',
                    background: isSelected ? '#166534' : '#f1f5f9',
                    color: isSelected ? '#ffffff' : '#334155',
                    border: isSelected ? 'none' : '1px solid #cbd5e1',
                    borderRadius: '0.35rem',
                    fontWeight: 700,
                    fontSize: '0.78rem',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {isSelected ? '✓ Đang Kiểm Thử' : '⚡ Đăng Nhập Vai Trò Này'}
                </button>
              </div>
            );
          })}
        </div>

        {/* Installation Instructions Guide for Testers */}
        <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '0.65rem', padding: '1rem' }}>
          <div style={{ fontWeight: 800, fontSize: '0.9rem', color: '#0369a1', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span>📲</span> Hướng Dẫn Cài Đặt Bản Full Chức Năng Cho Testers:
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem', fontSize: '0.8rem', color: '#334155' }}>
            <div>
              <b style={{ color: '#166534' }}>🍏 iPhone / iPad (iOS):</b>
              <div style={{ marginTop: '0.2rem' }}>Mở Safari &rarr; Nhấn Chia Sẻ (Share ⎋) &rarr; "Thêm vào Màn hình chính" (Add to Home Screen ➕).</div>
            </div>

            <div>
              <b style={{ color: '#0284c7' }}>🤖 Android (Samsung, Oppo...):</b>
              <div style={{ marginTop: '0.2rem' }}>Mở Chrome &rarr; Bấm "Cài Đặt App" trên Topbar hoặc ⋮ &rarr; "Cài đặt ứng dụng Tâm An Care".</div>
            </div>

            <div>
              <b style={{ color: '#7e22ce' }}>💻 Windows PC & macOS:</b>
              <div style={{ marginTop: '0.2rem' }}>Nhấn nút "📱 Cài Đặt App" góc trên màn hình để tải App chạy độc lập ngoài Desktop.</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

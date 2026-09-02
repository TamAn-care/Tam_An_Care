import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useActor } from '../../auth/ActorContext';
import { hasCapability, ROLE_LABELS } from '../../auth/role-policy';
import { HumanActorRole } from '../../types/actor';
import {
  fetchAuditLogs,
  AuditLogEntry,
  AuditModuleKey,
  AuditActionType,
  AUDIT_MODULE_LABELS,
  AUDIT_ACTION_LABELS,
} from '../../api/audit-log';
import { LoadingState } from '../../components/feedback/FeedbackStates';

export default function AuditTrailPage() {
  const { actor } = useActor();

  // Filters state
  const [selectedModule, setSelectedModule] = useState<AuditModuleKey | 'ALL'>('ALL');
  const [selectedRole, setSelectedRole] = useState<HumanActorRole | 'ALL'>('ALL');
  const [selectedAction, setSelectedAction] = useState<AuditActionType | 'ALL'>('ALL');
  const [selectedSeverity, setSelectedSeverity] = useState<'ALL' | 'NORMAL' | 'IMPORTANT' | 'CRITICAL'>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Selected Log for detail modal
  const [detailLog, setDetailLog] = useState<AuditLogEntry | null>(null);

  // Check RBAC permission
  const canView = hasCapability(actor?.actorRole, 'canViewAuditLog');
  const isDirector = hasCapability(actor?.actorRole, 'canViewDirectorAuditLog');
  const isManager = actor?.actorRole === 'CARE_MANAGER';

  // Available roles for filter based on actor's clearance
  const availableRoles = useMemo(() => {
    return Object.entries(ROLE_LABELS).filter(([roleKey]) => {
      // Quản lý KHÔNG xem được vai trò Ban Giám đốc
      if (!isDirector && roleKey === 'SUPERVISOR') {
        return false;
      }
      return true;
    });
  }, [isDirector]);

  // Query
  const auditLogsQuery = useQuery({
    queryKey: ['audit-logs', selectedModule, selectedRole, selectedAction, selectedSeverity, searchTerm, actor?.actorRole],
    queryFn: () =>
      fetchAuditLogs({
        module: selectedModule,
        actorRole: selectedRole,
        actionType: selectedAction,
        severity: selectedSeverity,
        searchTerm,
        viewingActorRole: actor?.actorRole,
      }),
    enabled: canView,
  });

  const logs = auditLogsQuery.data || [];

  // Summary Metrics
  const stats = useMemo(() => {
    return {
      totalLogs: logs.length,
      importantLogs: logs.filter((l) => l.severity === 'IMPORTANT' || l.severity === 'CRITICAL').length,
      uniqueActors: new Set(logs.map((l) => l.actorId)).size,
      pricingChanges: logs.filter((l) => l.module === 'BILLING_PRICING').length,
    };
  }, [logs]);

  // Access Denied State if non-authorized role
  if (!canView) {
    return (
      <div className="page-container" style={{ padding: '2rem' }}>
        <div
          className="card"
          style={{
            textAlign: 'center',
            padding: '3rem 2rem',
            background: '#fff1f2',
            border: '1px solid #fecdd3',
            maxWidth: '600px',
            margin: '2rem auto',
            borderRadius: '0.75rem',
          }}
        >
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔒</div>
          <h2 style={{ color: '#9f1239', margin: '0 0 0.5rem 0', fontSize: '1.4rem' }}>
            Quyền Truy Cập Bị Giới Hạn
          </h2>
          <p style={{ color: '#881337', fontSize: '0.95rem', lineHeight: '1.6' }}>
            Nhật ký truy vết & lịch sử thay đổi toàn hệ thống là khu vực <b>kiểm toán bảo mật cấp cao</b>. Chỉ <b>Ban Giám đốc</b> và <b>Quản lý</b> mới có thẩm quyền truy cập nhằm phục vụ việc kiểm tra, giám sát và quy trách nhiệm.
          </p>
          <div style={{ marginTop: '1.25rem', fontSize: '0.85rem', color: '#9f1239' }}>
            Vai trò hiện tại của bạn: <b>{ROLE_LABELS[actor?.actorRole as HumanActorRole] || actor?.actorRole}</b>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      {/* Header */}
      <div
        className="page-header"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '1rem',
          marginBottom: '1rem',
        }}
      >
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', margin: 0, fontSize: '1.35rem' }}>
            <span>📜</span> Nhật Ký Truy Vết & Lịch Sử Thay Đổi Hệ Thống
          </h1>
          <p className="page-description" style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem' }}>
            Lưu vết tự động 100% mọi thao tác của tất cả các vai trò, gắn với mã định danh (ID), mốc thời gian chính xác và nội dung thay đổi phục vụ kiểm toán quy trách nhiệm.
          </p>
        </div>

        {/* Security badge with role-aware badge */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.5rem 0.95rem',
            borderRadius: '0.5rem',
            background: isDirector ? '#dcfce7' : '#eff6ff',
            border: `1px solid ${isDirector ? '#86efac' : '#bfdbfe'}`,
            fontSize: '0.82rem',
            fontWeight: 700,
            color: isDirector ? '#166534' : '#1e40af',
          }}
        >
          <span>{isDirector ? '👑' : '🔒'}</span>
          <span>
            {isDirector
              ? 'Quyền hạn: Ban Giám đốc (Toàn quyền xem BGĐ, Quản lý & Nhân viên)'
              : 'Quyền hạn: Quản lý (Truy vết Nhân viên & Quản lý — Bảo mật hoạt động BGĐ)'}
          </span>
        </div>
      </div>

      {/* RBAC Notice Banner */}
      <div
        style={{
          background: isDirector ? '#f0fdf4' : '#f8fafc',
          border: `1px solid ${isDirector ? '#bbf7d0' : '#e2e8f0'}`,
          borderRadius: '0.6rem',
          padding: '0.75rem 1rem',
          marginBottom: '1.25rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.6rem',
          fontSize: '0.84rem',
          color: isDirector ? '#166534' : '#334155',
        }}
      >
        <span style={{ fontSize: '1.15rem' }}>{isDirector ? '🛡️' : 'ℹ️'}</span>
        <div>
          {isDirector ? (
            <span>
              <b>Chế độ kiểm toán toàn diện Ban Giám đốc:</b> Bạn có thẩm quyền cao nhất, theo dõi được toàn bộ hoạt động của tất cả nhân sự các phòng ban, Quản lý và các thành viên Ban Giám đốc mà không bị giới hạn.
            </span>
          ) : (
            <span>
              <b>Chính sách phân quyền bảo mật cấp bậc:</b> Bạn có quyền kiểm toán và truy vết hoạt động của toàn thể nhân sự các phòng ban (Điều dưỡng, Nhân viên chăm sóc, Kế toán, Lễ tân,...) và Quản lý. Theo chính sách phân cấp, các hoạt động điều hành của Ban Giám đốc được ẩn bảo mật.
            </span>
          )}
        </div>
      </div>

      {/* KPI Overview Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.85rem', marginBottom: '1.25rem' }}>
        <div className="card" style={{ padding: '0.9rem 1rem', background: '#f8fafc', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '105px', border: '1px solid #e2e8f0', borderRadius: '0.65rem' }}>
          <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>TỔNG SỐ SỰ KIỆN GHI NHẬN</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', margin: '0.2rem 0' }}>{stats.totalLogs}</div>
          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Toàn bộ các phân hệ vận hành</div>
        </div>

        <div className="card" style={{ padding: '0.9rem 1rem', background: '#fffbeb', borderColor: '#fde68a', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '105px', borderRadius: '0.65rem' }}>
          <div style={{ fontSize: '0.72rem', color: '#92400e', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>SỰ KIỆN QUAN TRỌNG / DUYỆT</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#b45309', margin: '0.2rem 0' }}>{stats.importantLogs}</div>
          <div style={{ fontSize: '0.75rem', color: '#92400e' }}>Bảng giá, giảm giá, đổi ca, eMAR</div>
        </div>

        <div className="card" style={{ padding: '0.9rem 1rem', background: '#eff6ff', borderColor: '#bfdbfe', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '105px', borderRadius: '0.65rem' }}>
          <div style={{ fontSize: '0.72rem', color: '#1e40af', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>NHÂN SỰ THỰC HIỆN THAY ĐỔI</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#2563eb', margin: '0.2rem 0' }}>{stats.uniqueActors} người</div>
          <div style={{ fontSize: '0.75rem', color: '#1e40af' }}>Gắn mã định danh nhân viên (ID)</div>
        </div>

        <div className="card" style={{ padding: '0.9rem 1rem', background: '#f0fdf4', borderColor: '#bbf7d0', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '105px', borderRadius: '0.65rem' }}>
          <div style={{ fontSize: '0.72rem', color: '#166534', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>QUẢN LÝ PHÍ & GIẢM GIÁ</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#15803d', margin: '0.2rem 0' }}>{stats.pricingChanges} thao tác</div>
          <div style={{ fontSize: '0.75rem', color: '#166534' }}>Điều chỉnh giá & thu phí</div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="card" style={{ padding: '0.9rem 1.15rem', marginBottom: '1.25rem', background: '#ffffff', borderRadius: '0.65rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.85rem', alignItems: 'flex-end' }}>
          <div>
            <label className="field-label" style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '0.35rem', display: 'block' }}>Phân hệ chức năng:</label>
            <select
              className="text-input"
              style={{ height: '38px', padding: '0 0.65rem', width: '100%', boxSizing: 'border-box' }}
              value={selectedModule}
              onChange={(e) => setSelectedModule(e.target.value as any)}
            >
              <option value="ALL">-- Tất cả phân hệ --</option>
              {Object.entries(AUDIT_MODULE_LABELS).map(([key, item]) => (
                <option key={key} value={key}>
                  {item.icon} {item.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="field-label" style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '0.35rem', display: 'block' }}>Vai trò nhân sự:</label>
            <select
              className="text-input"
              style={{ height: '38px', padding: '0 0.65rem', width: '100%', boxSizing: 'border-box' }}
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value as any)}
            >
              <option value="ALL">-- Tất cả vai trò --</option>
              {availableRoles.map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="field-label" style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '0.35rem', display: 'block' }}>Mức độ quan trọng:</label>
            <select
              className="text-input"
              style={{ height: '38px', padding: '0 0.65rem', width: '100%', boxSizing: 'border-box' }}
              value={selectedSeverity}
              onChange={(e) => setSelectedSeverity(e.target.value as any)}
            >
              <option value="ALL">-- Tất cả mức độ --</option>
              <option value="NORMAL">Bình thường</option>
              <option value="IMPORTANT">⚠️ Quan trọng / Phê duyệt</option>
              <option value="CRITICAL">🚨 Khẩn cấp / Nghiêm trọng</option>
            </select>
          </div>

          <div>
            <label className="field-label" style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '0.35rem', display: 'block' }}>Tìm kiếm:</label>
            <input
              type="text"
              className="text-input"
              style={{ height: '38px', padding: '0 0.75rem', width: '100%', boxSizing: 'border-box' }}
              placeholder="Tên nhân sự, Mã ID, Tên cụ, nội dung..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Audit Log Table */}
      {auditLogsQuery.isLoading ? (
        <LoadingState title="Đang tải nhật ký truy vết hệ thống..." />
      ) : logs.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '2.5rem', color: '#64748b', borderRadius: '0.65rem' }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📜</div>
          <div>Không tìm thấy nhật ký truy vết nào phù hợp với bộ lọc.</div>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden', borderRadius: '0.65rem', border: '1px solid #e2e8f0' }}>
          <div className="table-responsive" style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #cbd5e1' }}>
                  <th style={{ padding: '0.75rem 0.65rem', textAlign: 'left', minWidth: '150px' }}>Thời Gian</th>
                  <th style={{ padding: '0.75rem 0.65rem', textAlign: 'left', minWidth: '190px' }}>Người Thực Hiện (ID)</th>
                  <th style={{ padding: '0.75rem 0.65rem', textAlign: 'left', minWidth: '170px' }}>Phân Hệ & Hành Động</th>
                  <th style={{ padding: '0.75rem 0.65rem', textAlign: 'left', minWidth: '220px' }}>Nội Dung & Tóm Tắt Thay Đổi</th>
                  <th style={{ padding: '0.75rem 0.65rem', textAlign: 'left', minWidth: '200px' }}>Đối Soát (Trước &rarr; Sau)</th>
                  <th style={{ padding: '0.75rem 0.65rem', textAlign: 'left', minWidth: '140px' }}>Thiết Bị / IP</th>
                  <th style={{ padding: '0.75rem 0.65rem', textAlign: 'center', width: '90px' }}>Thao Tác</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => {
                  const modInfo = AUDIT_MODULE_LABELS[log.module] || { label: log.module, icon: '📁' };
                  const actInfo = AUDIT_ACTION_LABELS[log.actionType] || { label: log.actionType, badgeClass: 'badge-neutral', icon: '⚡' };
                  return (
                    <tr key={log.id} style={{ borderBottom: '1px solid #f1f5f9', verticalAlign: 'middle' }}>
                      <td style={{ padding: '0.65rem' }}>
                        <div style={{ fontWeight: 700, color: '#0f172a' }}>
                          {new Date(log.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </div>
                        <div style={{ fontSize: '0.74rem', color: '#64748b' }}>
                          {new Date(log.timestamp).toLocaleDateString('vi-VN')}
                        </div>
                        <code style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{log.id}</code>
                      </td>

                      <td style={{ padding: '0.65rem' }}>
                        <div style={{ fontWeight: 700, color: '#1e293b' }}>{log.actorName}</div>
                        <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center', marginTop: '0.15rem' }}>
                          <code style={{ fontSize: '0.72rem', background: '#f1f5f9', padding: '0.1rem 0.3rem', borderRadius: '0.25rem' }}>
                            {log.actorId}
                          </code>
                          <span className="badge badge-neutral" style={{ fontSize: '0.7rem', padding: '0.1rem 0.35rem' }}>
                            {log.actorRoleLabel}
                          </span>
                        </div>
                      </td>

                      <td style={{ padding: '0.65rem' }}>
                        <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#334155', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <span>{modInfo.icon}</span>
                          <span>{modInfo.label}</span>
                        </div>
                        <div style={{ marginTop: '0.25rem' }}>
                          <span className={`badge ${actInfo.badgeClass}`} style={{ fontSize: '0.72rem', padding: '0.15rem 0.4rem', display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
                            <span>{actInfo.icon}</span>
                            <span>{actInfo.label}</span>
                          </span>
                        </div>
                      </td>

                      <td style={{ padding: '0.65rem' }}>
                        <div style={{ fontWeight: 600, color: '#0f172a', lineHeight: '1.35' }}>
                          {log.summary}
                        </div>
                        {log.residentName && (
                          <div style={{ fontSize: '0.75rem', color: '#15803d', marginTop: '0.2rem' }}>
                            👤 Người cao tuổi: <b>{log.residentName}</b> ({log.residentId})
                          </div>
                        )}
                      </td>

                      <td style={{ padding: '0.65rem', fontSize: '0.78rem' }}>
                        {log.previousValue && (
                          <div style={{ color: '#b91c1c', marginBottom: '0.15rem' }}>
                            <b>Cũ:</b> {log.previousValue}
                          </div>
                        )}
                        {log.newValue && (
                          <div style={{ color: '#15803d', fontWeight: 600 }}>
                            <b>Mới:</b> {log.newValue}
                          </div>
                        )}
                      </td>

                      <td style={{ padding: '0.65rem', fontSize: '0.75rem', color: '#64748b' }}>
                        <div><code>{log.ipAddress || '127.0.0.1'}</code></div>
                        <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '0.1rem' }}>{log.deviceInfo || 'Hệ thống'}</div>
                      </td>

                      <td style={{ padding: '0.65rem', textAlign: 'center' }}>
                        <button
                          type="button"
                          className="btn btn-neutral"
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                          onClick={() => setDetailLog(log)}
                        >
                          👁️ Chi tiết
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Detail */}
      {detailLog && (
        <div className="modal-overlay" onClick={() => setDetailLog(null)}>
          <div
            className="modal-card"
            style={{
              background: '#ffffff',
              borderRadius: '0.75rem',
              padding: '1.5rem',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
              border: '1px solid #e2e8f0',
              maxWidth: '600px',
              width: '100%',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.65rem' }}>
              <h3 style={{ margin: 0, color: '#1e293b', fontSize: '1.15rem', fontWeight: 800 }}>
                📜 Chi Tiết Bản Ghi Truy Vết — {detailLog.id}
              </h3>
              <button
                type="button"
                className="btn btn-neutral"
                onClick={() => setDetailLog(null)}
                style={{ padding: '0.2rem 0.6rem', fontSize: '1rem', lineHeight: 1 }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.88rem' }}>
              <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                  <span>Người thực hiện:</span>
                  <b>{detailLog.actorName} (Mã: {detailLog.actorId})</b>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                  <span>Vai trò:</span>
                  <b>{detailLog.actorRoleLabel} ({detailLog.actorRole})</b>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Thời gian ghi nhận:</span>
                  <b>{new Date(detailLog.timestamp).toLocaleString('vi-VN')}</b>
                </div>
              </div>

              <div>
                <span style={{ fontWeight: 600, color: '#475569' }}>Phân hệ & Hành động:</span>
                <div style={{ marginTop: '0.2rem', fontWeight: 700, color: '#0f172a' }}>
                  {AUDIT_MODULE_LABELS[detailLog.module]?.icon} {AUDIT_MODULE_LABELS[detailLog.module]?.label} &rarr; {detailLog.actionLabel}
                </div>
              </div>

              <div>
                <span style={{ fontWeight: 600, color: '#475569' }}>Đối tượng tác động:</span>
                <div style={{ marginTop: '0.2rem', color: '#0f172a' }}>
                  <code>{detailLog.targetEntityId}</code> — <b>{detailLog.targetEntityName}</b>
                </div>
              </div>

              <div>
                <span style={{ fontWeight: 600, color: '#475569' }}>Tóm tắt nội dung:</span>
                <div style={{ marginTop: '0.2rem', color: '#0f172a', fontWeight: 600 }}>
                  {detailLog.summary}
                </div>
              </div>

              {detailLog.details && (
                <div style={{ background: '#eff6ff', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #bfdbfe' }}>
                  <span style={{ fontWeight: 700, color: '#1e40af' }}>Chi tiết căn cứ & Ghi chú kiểm toán:</span>
                  <div style={{ marginTop: '0.25rem', color: '#1e3a8a', lineHeight: '1.45' }}>
                    {detailLog.details}
                  </div>
                </div>
              )}

              {(detailLog.previousValue || detailLog.newValue) && (
                <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0' }}>
                  <span style={{ fontWeight: 700, color: '#334155' }}>So sánh biến động dữ liệu (Diff):</span>
                  {detailLog.previousValue && (
                    <div style={{ color: '#b91c1c', marginTop: '0.3rem' }}>
                      <b>🔴 Trước thay đổi:</b> {detailLog.previousValue}
                    </div>
                  )}
                  {detailLog.newValue && (
                    <div style={{ color: '#15803d', marginTop: '0.3rem', fontWeight: 600 }}>
                      <b>🟢 Sau thay đổi:</b> {detailLog.newValue}
                    </div>
                  )}
                </div>
              )}

              <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '0.5rem', fontSize: '0.78rem', color: '#64748b' }}>
                <div>Địa chỉ IP: <code>{detailLog.ipAddress || '127.0.0.1'}</code></div>
                <div>Thiết bị / Vị trí trạm: {detailLog.deviceInfo || 'Hệ thống'}</div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
              <button
                type="button"
                className="btn btn-neutral"
                onClick={() => setDetailLog(null)}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

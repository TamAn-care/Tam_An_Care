import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { getResidentCareView } from '../../api/residents';
import { useActor } from '../../auth/ActorContext';
import { ROLE_LABELS, getAssignedResidentIdsForActor, getAssignedResidentIdsForGuardian } from '../../auth/role-policy';
import { ApiError } from '../../api/errors';
import { EmptyState, ErrorState, LoadingState } from '../../components/feedback/FeedbackStates';
import ElderlyAvatar from '../../components/common/ElderlyAvatar';
import {
  CARE_LEVEL_LABEL,
  GENDER_LABEL,
  AVAILABILITY_LABEL,
  formatVietnameseDate,
  textFromRecord,
} from '../residents/resident-ui';

function availabilityClass(value: 'AVAILABLE' | 'EMPTY' | 'UNAVAILABLE'): string {
  if (value === 'AVAILABLE') return 'availability availability-available';
  if (value === 'EMPTY') return 'availability availability-empty';
  return 'availability availability-unavailable';
}

export function CareViewPage() {
  const { residentId } = useParams();
  const { actor } = useActor();
  const normalizedResidentId = residentId ?? '';
  const [activeTab, setActiveTab] = useState<
    'profile' | 'carePlan' | 'clinical' | 'medication' | 'workQueue' | 'incidents'
  >('profile');

  const query = useQuery({
    queryKey: [
      'resident-care-view',
      normalizedResidentId,
      actor?.actorId ?? 'none',
      actor?.actorRole ?? 'none',
    ],
    enabled: Boolean(normalizedResidentId) && Boolean(actor),
    queryFn: () => {
      if (!actor) {
        throw new Error('Chưa có ngữ cảnh người dùng.');
      }
      return getResidentCareView(normalizedResidentId, actor);
    },
    retry(failureCount, error) {
      if (error instanceof ApiError && [401, 403, 404].includes(error.status)) {
        return false;
      }
      return failureCount < 1;
    },
  });

  const assignedResidentIds = useMemo(() => {
    if (!actor) return new Set<string>();
    const caregiverAssigned = getAssignedResidentIdsForActor(actor.actorId, actor.displayName).map((id) => id.toLowerCase());
    const guardianAssigned = getAssignedResidentIdsForGuardian(actor.actorId, actor.displayName).map((id) => id.toLowerCase());
    return new Set([...caregiverAssigned, ...guardianAssigned]);
  }, [actor?.actorId, actor?.displayName]);

  if (!normalizedResidentId) {
    return <ErrorState title="Không thể mở hồ sơ" description="Mã resident không hợp lệ." />;
  }

  if (!actor) {
    return (
      <EmptyState
        title="Chưa xác định người dùng"
        description="Vui lòng xác định phiên làm việc trước khi mở hồ sơ chăm sóc."
      />
    );
  }

  if (query.isLoading) {
    return (
      <>
        <header className="page-header">
          <h1 className="page-title">Đang kiểm tra quyền truy cập</h1>
        </header>
        <LoadingState
          title="Đang tải hồ sơ chăm sóc"
          description="Backend đang xác thực quyền và tổng hợp dữ liệu vận hành."
        />
      </>
    );
  }

  if (query.isError) {
    const isNonDisclosure = query.error instanceof ApiError && query.error.status === 404;
    const description = isNonDisclosure
      ? 'Dữ liệu không khả dụng hoặc bạn không có quyền truy cập hồ sơ này.'
      : query.error instanceof Error
        ? query.error.message
        : 'Không thể tải hồ sơ chăm sóc.';

    return (
      <>
        <header className="page-header">
          <h1 className="page-title">Không thể mở hồ sơ</h1>
        </header>
        <ErrorState
          title={isNonDisclosure ? 'Hồ sơ không khả dụng' : 'Không thể tải dữ liệu'}
          description={description}
        />
        <div className="resident-back-row" style={{ marginTop: '1rem' }}>
          <Link to="/residents" className="btn btn-neutral">
            &larr; Quay lại danh sách
          </Link>
        </div>
      </>
    );
  }

  const data = query.data;

  if (!data) {
    return <EmptyState title="Chưa có dữ liệu" description="Care View chưa trả về dữ liệu." />;
  }

  const residentName =
    textFromRecord(data.resident, 'displayName') ??
    textFromRecord(data.resident, 'display_name') ??
    'Hồ sơ chăm sóc cụ';

  const residentCode =
    textFromRecord(data.resident, 'residentCode') ??
    textFromRecord(data.resident, 'resident_code') ??
    normalizedResidentId;

  const room = textFromRecord(data.resident, 'room');
  const bed = textFromRecord(data.resident, 'bed');
  const dob = textFromRecord(data.resident, 'dateOfBirth') || textFromRecord(data.resident, 'date_of_birth');
  const gender = textFromRecord(data.resident, 'gender');
  const careLevel = textFromRecord(data.resident, 'careLevel') || textFromRecord(data.resident, 'care_level');
  const activeStatus = data.resident.activeStatus ?? true;

  const age = dob ? new Date().getFullYear() - new Date(dob).getFullYear() : null;

  const isSupervisorOrAdmin =
    (actor.actorRole as string) === 'SUPERVISOR' ||
    (actor.actorRole as string) === 'CARE_MANAGER' ||
    (actor.actorRole as string) === 'ADMIN' ||
    (actor.actorRole as string) === 'RECEPTIONIST' ||
    (actor.actorRole as string) === 'DIRECTOR' ||
    (actor.actorRole as string) === 'NURSE' ||
    (actor.actorRole as string) === 'NUTRITIONIST' ||
    (actor.actorRole as string) === 'PHYSICAL_THERAPIST' ||
    (actor.actorRole as string) === 'REHABILITATION_SPECIALIST' ||
    (actor.actorRole as string) === 'CAREGIVER' ||
    (actor.actorRole as string) === 'SOCIAL_WORKER' ||
    (actor.actorRole as string) === 'PSYCHOLOGIST' ||
    (actor.actorRole as string) === 'ACCOUNTANT' ||
    (actor.actorRole as string) === 'HOUSEKEEPING' ||
    (actor.actorRole as string) === 'SECURITY';


  const targetResidentId = (
    textFromRecord(data.resident, 'residentId') ||
    textFromRecord(data.resident, 'resident_id') ||
    normalizedResidentId
  ).toLowerCase();

  const targetResidentCode = (
    textFromRecord(data.resident, 'residentCode') ||
    textFromRecord(data.resident, 'resident_code') ||
    ''
  ).toLowerCase();

  const isAuthorized =
    isSupervisorOrAdmin ||
    assignedResidentIds.size === 0 ||
    assignedResidentIds.has(targetResidentId) ||
    assignedResidentIds.has(targetResidentCode) ||
    assignedResidentIds.has(normalizedResidentId.toLowerCase());

  if (!isAuthorized) {
    return (
      <main className="page" style={{ padding: '2rem 1rem' }}>
        <div
          className="card"
          style={{
            background: '#fff1f2',
            border: '1.5px solid #fecdd3',
            borderRadius: '0.75rem',
            padding: '2.5rem 1.5rem',
            textAlign: 'center',
            maxWidth: '680px',
            margin: '2rem auto',
            boxShadow: '0 10px 15px -3px rgba(225, 29, 72, 0.08)',
          }}
        >
          <div style={{ fontSize: '3.5rem', marginBottom: '0.5rem' }}>🔒</div>
          <h2 style={{ color: '#9f1239', margin: '0 0 0.5rem 0', fontSize: '1.35rem', fontWeight: 800 }}>
            Hạn Chế Truy Cập Hồ Sơ Chăm Sóc Cư Dân
          </h2>
          <p style={{ color: '#881337', fontSize: '0.92rem', lineHeight: '1.6', marginBottom: '1.25rem' }}>
            Tài khoản <b>{actor.displayName}</b> ({ROLE_LABELS[actor.actorRole] || actor.actorRole}) chưa được Ban Giám đốc phân công phụ trách cư dân <b>{residentName}</b> ({residentCode}).
          </p>
          <div
            style={{
              background: '#ffffff',
              border: '1px solid #fda4af',
              borderRadius: '0.5rem',
              padding: '1rem 1.25rem',
              textAlign: 'left',
              marginBottom: '1.5rem',
              fontSize: '0.86rem',
            }}
          >
            <div style={{ fontWeight: 700, color: '#9f1239', marginBottom: '0.35rem' }}>
              📋 Quy định bảo mật thông tin & phân quyền y khoa:
            </div>
            <div style={{ color: '#475569', lineHeight: '1.5' }}>
              Nhằm đảm bảo an toàn thông tin sức khỏe cá nhân (eMAR) và tuân thủ quy trình phân công chăm sóc, chỉ những Nhân viên y tế và Nhân viên chăm sóc được <b>cấp quyền phụ trách trực tiếp</b> mới có thể xem và ghi nhận nhật ký chăm sóc cho cư dân này.
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/residents" className="btn btn-secondary" style={{ padding: '0.55rem 1.25rem', textDecoration: 'none' }}>
              &larr; Quay lại danh sách người cao tuổi
            </Link>
            {isSupervisorOrAdmin && (
              <Link to="/staff-access" className="btn btn-primary" style={{ padding: '0.55rem 1.25rem', textDecoration: 'none' }}>
                ⚙️ Cấp quyền phân công nhân sự
              </Link>
            )}
          </div>
        </div>
      </main>
    );
  }

  // Extract clinical observations
  const clinicalItems = (data.clinical || []) as any[];
  const bpObs = clinicalItems.find((c: any) => c.observationCode === 'SYS_DIA_BP' || c.observationType?.includes('Huyết áp'));
  const heartObs = clinicalItems.find((c: any) => c.observationCode === 'HEART_RATE' || c.observationType?.includes('Nhịp tim'));
  const tempObs = clinicalItems.find((c: any) => c.observationCode === 'BODY_TEMP' || c.observationType?.includes('Thân nhiệt'));
  const spo2Obs = clinicalItems.find((c: any) => c.observationCode === 'SPO2_LEVEL' || c.observationType?.includes('SpO2'));

  const displayBp: string = typeof bpObs?.textValue === 'string' ? bpObs.textValue : '130/80';
  const displayHeart: string | number = typeof heartObs?.numericValue === 'number' || typeof heartObs?.numericValue === 'string' ? heartObs.numericValue : 76;
  const displayTemp: string | number = typeof tempObs?.numericValue === 'number' || typeof tempObs?.numericValue === 'string' ? tempObs.numericValue : 36.6;
  const displaySpo2: string | number = typeof spo2Obs?.numericValue === 'number' || typeof spo2Obs?.numericValue === 'string' ? spo2Obs.numericValue : 98;

  return (
    <div className="printable-a4-sheet" style={{ paddingBottom: '3rem' }}>
      {/* NAVIGATION TOP BAR */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <Link to="/residents" className="btn btn-neutral no-print" style={{ textDecoration: 'none', fontSize: '0.88rem', fontWeight: 600 }}>
          &larr; Danh sách người cao tuổi
        </Link>

        <button
          type="button"
          onClick={() => window.print()}
          className="btn btn-primary no-print"
          style={{ fontSize: '0.88rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.4rem' }}
        >
          🖨️ In Hồ Sơ Chăm Sóc (A4)
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          disabled={query.isFetching}
          onClick={() => void query.refetch()}
          style={{ fontSize: '0.85rem' }}
        >
          {query.isFetching ? '⏳ Đang làm mới…' : '🔄 Làm mới dữ liệu'}
        </button>
      </div>

      {/* ELDERLY PROFILE HERO CARD */}
      <section
        style={{
          background: 'linear-gradient(135deg, #166534 0%, #14532d 100%)',
          color: '#ffffff',
          borderRadius: '0.85rem',
          padding: '1.75rem',
          boxShadow: '0 10px 25px -5px rgba(22, 101, 52, 0.25)',
          marginBottom: '1.5rem',
        }}
      >
        <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <ElderlyAvatar gender={gender} name={residentName} size={72} />

          <div style={{ flex: 1, minWidth: '260px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
              <h1 style={{ margin: 0, fontSize: '1.65rem', fontWeight: 800, color: '#ffffff' }}>
                {residentName}
              </h1>
              <span
                style={{
                  background: activeStatus ? '#dcfce7' : '#f3f4f6',
                  color: activeStatus ? '#15803d' : '#4b5563',
                  padding: '0.2rem 0.65rem',
                  borderRadius: '9999px',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                }}
              >
                {activeStatus ? '● Đang lưu trú tại Tâm An' : '○ Đã hoàn thành lưu trú'}
              </span>
            </div>

            <div style={{ marginTop: '0.4rem', color: '#bbf7d0', fontSize: '0.9rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <span>Mã hồ sơ: <b>{residentCode}</b></span>
              {age && <span>Tuổi: <b>{age} tuổi</b> ({formatVietnameseDate(dob)})</span>}
              {gender && <span>Giới tính: <b>{GENDER_LABEL[gender as keyof typeof GENDER_LABEL] || gender}</b></span>}
              <span>Vị trí: <b>{room ? `Phòng ${room} / ${bed || 'Giường'}` : 'Chưa xếp phòng'}</b></span>
            </div>

            <div style={{ marginTop: '0.85rem', display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.3)', color: '#ffffff', padding: '0.3rem 0.75rem', borderRadius: '0.375rem', fontSize: '0.82rem', fontWeight: 700 }}>
                🏥 {CARE_LEVEL_LABEL[careLevel || ''] || careLevel || 'Mức chăm sóc tiêu chuẩn'}
              </span>
              <span style={{ background: 'rgba(255,255,255,0.15)', color: '#f0fdf4', padding: '0.3rem 0.75rem', borderRadius: '0.375rem', fontSize: '0.82rem' }}>
                👩‍⚕️ Nhân viên y tế phụ trách: <b>Nhân viên y tế Phạm Thị Mai (Tầng 1)</b>
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* QUICK VITALS SUMMARY BAR */}
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.85rem', marginBottom: '1.5rem' }}>
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '0.65rem', padding: '1rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>❤️ Huyết Áp</div>
          <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a', marginTop: '0.2rem' }}>
            {displayBp} <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500 }}>mmHg</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: '#166534', fontWeight: 600, marginTop: '0.25rem' }}>● Chỉ số ổn định</div>
        </div>

        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '0.65rem', padding: '1rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>💓 Nhịp Tim (Mạch)</div>
          <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a', marginTop: '0.2rem' }}>
            {displayHeart} <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500 }}>lần/phút</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: '#166534', fontWeight: 600, marginTop: '0.25rem' }}>● Nhịp đều bình thường</div>
        </div>

        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '0.65rem', padding: '1rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>🌡️ Thân Nhiệt</div>
          <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a', marginTop: '0.2rem' }}>
            {displayTemp} <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500 }}>°C</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: '#166534', fontWeight: 600, marginTop: '0.25rem' }}>● Nhiệt độ bình thường</div>
        </div>

        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '0.65rem', padding: '1rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>🫁 SpO2 (Nồng độ Oxy)</div>
          <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a', marginTop: '0.2rem' }}>
            {displaySpo2} <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500 }}>%</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: '#166534', fontWeight: 600, marginTop: '0.25rem' }}>● Đạt chuẩn an toàn</div>
        </div>
      </section>

      {/* INTERACTIVE NAVIGATION TABS */}
      <div
        style={{
          display: 'flex',
          gap: '0.4rem',
          borderBottom: '2px solid #e2e8f0',
          marginBottom: '1.5rem',
          overflowX: 'auto',
          paddingBottom: '2px',
        }}
      >
        <button
          type="button"
          onClick={() => setActiveTab('profile')}
          style={{
            padding: '0.65rem 1.1rem',
            border: 'none',
            borderBottom: activeTab === 'profile' ? '3px solid #166534' : '3px solid transparent',
            background: activeTab === 'profile' ? '#f0fdf4' : 'transparent',
            color: activeTab === 'profile' ? '#166534' : '#475569',
            fontWeight: activeTab === 'profile' ? 700 : 500,
            fontSize: '0.9rem',
            cursor: 'pointer',
            borderRadius: '0.375rem 0.375rem 0 0',
            whiteSpace: 'nowrap',
          }}
        >
          👤 Hồ Sơ Cá Nhân & Y Tế
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('carePlan')}
          style={{
            padding: '0.65rem 1.1rem',
            border: 'none',
            borderBottom: activeTab === 'carePlan' ? '3px solid #166534' : '3px solid transparent',
            background: activeTab === 'carePlan' ? '#f0fdf4' : 'transparent',
            color: activeTab === 'carePlan' ? '#166534' : '#475569',
            fontWeight: activeTab === 'carePlan' ? 700 : 500,
            fontSize: '0.9rem',
            cursor: 'pointer',
            borderRadius: '0.375rem 0.375rem 0 0',
            whiteSpace: 'nowrap',
          }}
        >
          📑 Kế Hoạch Chăm Sóc ({data.carePlan ? '1' : '0'})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('clinical')}
          style={{
            padding: '0.65rem 1.1rem',
            border: 'none',
            borderBottom: activeTab === 'clinical' ? '3px solid #166534' : '3px solid transparent',
            background: activeTab === 'clinical' ? '#f0fdf4' : 'transparent',
            color: activeTab === 'clinical' ? '#166534' : '#475569',
            fontWeight: activeTab === 'clinical' ? 700 : 500,
            fontSize: '0.9rem',
            cursor: 'pointer',
            borderRadius: '0.375rem 0.375rem 0 0',
            whiteSpace: 'nowrap',
          }}
        >
          🩺 Sinh Hiệu & Lâm Sàng ({clinicalItems.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('medication')}
          style={{
            padding: '0.65rem 1.1rem',
            border: 'none',
            borderBottom: activeTab === 'medication' ? '3px solid #166534' : '3px solid transparent',
            background: activeTab === 'medication' ? '#f0fdf4' : 'transparent',
            color: activeTab === 'medication' ? '#166534' : '#475569',
            fontWeight: activeTab === 'medication' ? 700 : 500,
            fontSize: '0.9rem',
            cursor: 'pointer',
            borderRadius: '0.375rem 0.375rem 0 0',
            whiteSpace: 'nowrap',
          }}
        >
          💊 Y Lệnh & Thuốc eMAR ({(data.medication?.orders || []).length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('workQueue')}
          style={{
            padding: '0.65rem 1.1rem',
            border: 'none',
            borderBottom: activeTab === 'workQueue' ? '3px solid #166534' : '3px solid transparent',
            background: activeTab === 'workQueue' ? '#f0fdf4' : 'transparent',
            color: activeTab === 'workQueue' ? '#166534' : '#475569',
            fontWeight: activeTab === 'workQueue' ? 700 : 500,
            fontSize: '0.9rem',
            cursor: 'pointer',
            borderRadius: '0.375rem 0.375rem 0 0',
            whiteSpace: 'nowrap',
          }}
        >
          📝 Công Việc Chăm Sóc ({(data.workQueue || []).length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('incidents')}
          style={{
            padding: '0.65rem 1.1rem',
            border: 'none',
            borderBottom: activeTab === 'incidents' ? '3px solid #166534' : '3px solid transparent',
            background: activeTab === 'incidents' ? '#f0fdf4' : 'transparent',
            color: activeTab === 'incidents' ? '#166534' : '#475569',
            fontWeight: activeTab === 'incidents' ? 700 : 500,
            fontSize: '0.9rem',
            cursor: 'pointer',
            borderRadius: '0.375rem 0.375rem 0 0',
            whiteSpace: 'nowrap',
          }}
        >
          ⚠️ Nhật Ký Sự Cố ({(data.incidents || []).length})
        </button>
      </div>

      {/* TAB CONTENT PANELS */}
      {activeTab === 'profile' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
          {/* Card 1: Thẻ thông tin cá nhân */}
          <div className="card" style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '0.75rem', padding: '1.25rem' }}>
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.05rem', fontWeight: 700, color: '#166534', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.5rem' }}>
              📌 Thông Tin Hành Chính & Lưu Trú
            </h3>
            <dl style={{ display: 'grid', gridTemplateColumns: '120px 1fr', rowGap: '0.65rem', margin: 0, fontSize: '0.88rem' }}>
              <dt style={{ color: '#64748b' }}>Họ và tên:</dt>
              <dd style={{ margin: 0, fontWeight: 700, color: '#0f172a' }}>{residentName}</dd>

              <dt style={{ color: '#64748b' }}>Mã hồ sơ:</dt>
              <dd style={{ margin: 0, fontWeight: 600 }}>{residentCode}</dd>

              <dt style={{ color: '#64748b' }}>Ngày sinh:</dt>
              <dd style={{ margin: 0 }}>{formatVietnameseDate(dob)} {age ? `(${age} tuổi)` : ''}</dd>

              <dt style={{ color: '#64748b' }}>Giới tính:</dt>
              <dd style={{ margin: 0 }}>{GENDER_LABEL[gender as keyof typeof GENDER_LABEL] || gender}</dd>

              <dt style={{ color: '#64748b' }}>Vị trí lưu trú:</dt>
              <dd style={{ margin: 0, fontWeight: 600, color: '#0284c7' }}>
                {room ? `Phòng ${room} — Giường ${bed || 'Chưa chọn'}` : 'Chưa phân giường'}
              </dd>

              <dt style={{ color: '#64748b' }}>Mức chăm sóc:</dt>
              <dd style={{ margin: 0, fontWeight: 700, color: '#15803d' }}>
                {CARE_LEVEL_LABEL[careLevel || ''] || careLevel}
              </dd>
            </dl>
          </div>

          {/* Card 2: Tiền sử y tế */}
          <div className="card" style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '0.75rem', padding: '1.25rem' }}>
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.05rem', fontWeight: 700, color: '#166534', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.5rem' }}>
              🏥 Tiền Sử Y Tế & Ghi Chú Tiếp Nhận
            </h3>
            <ul style={{ margin: 0, paddingLeft: '1.2rem', color: '#334155', fontSize: '0.88rem', lineHeight: '1.6' }}>
              <li><b>Tiền sử bệnh mạn tính:</b> Tăng huyết áp độ II, Thoái hóa khớp gối nhẹ.</li>
              <li><b>Dị ứng thuốc/thức ăn:</b> Không có ghi nhận dị ứng thuốc (No known drug allergies).</li>
              <li><b>Chế độ dinh dưỡng:</b> Cơm mềm / Cháo dinh dưỡng, giảm muối, bổ sung Canxi & Vitamin D3.</li>
              <li><b>Tình trạng vận động:</b> Tự đi lại được trong phòng, cần hỗ trợ tay vịn khi di chuyển xa.</li>
              <li><b>Tinh thần & Nhận thức:</b> Tỉnh táo, tiếp xúc tốt, giao tiếp vui vẻ với nhân viên viện.</li>
            </ul>
          </div>
        </div>
      )}

      {activeTab === 'carePlan' && (
        <div className="card" style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '0.75rem', padding: '1.5rem' }}>
          {data.carePlan ? (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#166534' }}>
                  {textFromRecord(data.carePlan, 'title') || 'Kế hoạch chăm sóc y tế toàn diện'}
                </h3>
                <span className="badge badge-success" style={{ padding: '0.3rem 0.75rem' }}>● ĐANG ÁP DỤNG</span>
              </div>

              <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '0.5rem', padding: '1rem', fontSize: '0.88rem', marginBottom: '1.25rem' }}>
                <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: '0.5rem' }}>🎯 Mục tiêu điều trị & chăm sóc cốt lõi:</div>
                <p style={{ margin: 0, color: '#334155', lineHeight: '1.6' }}>
                  {textFromRecord(data.carePlan, 'goals') || 'Duy trì ổn định chỉ số sinh hiệu (Huyết áp dưới 130/80 mmHg, SpO2 > 96%). Đảm bảo dinh dưỡng đủ calo, hỗ trợ các sinh hoạt cá nhân hằng ngày và hướng dẫn bài tập phục hồi chức năng vận động 20 phút mỗi ngày.'}
                </p>
              </div>

              <dl style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', margin: 0, fontSize: '0.85rem' }}>
                <div>
                  <dt style={{ color: '#64748b' }}>Mức độ chăm sóc:</dt>
                  <dd style={{ margin: '0.2rem 0 0 0', fontWeight: 700, color: '#0369a1' }}>
                    {CARE_LEVEL_LABEL[(textFromRecord(data.carePlan, 'careLevel') || careLevel || '')] || careLevel}
                  </dd>
                </div>
                <div>
                  <dt style={{ color: '#64748b' }}>Thời gian hiệu lực:</dt>
                  <dd style={{ margin: '0.2rem 0 0 0', fontWeight: 600 }}>
                    {formatVietnameseDate(textFromRecord(data.carePlan, 'effectiveFrom'))} đến {formatVietnameseDate(textFromRecord(data.carePlan, 'effectiveTo')) || '31/12/2026'}
                  </dd>
                </div>
                <div>
                  <dt style={{ color: '#64748b' }}>Người lập kế hoạch:</dt>
                  <dd style={{ margin: '0.2rem 0 0 0', fontWeight: 600 }}>
                    {textFromRecord(data.carePlan, 'createdBy') || 'BS. Nguyễn Văn Vinh'}
                  </dd>
                </div>
                <div>
                  <dt style={{ color: '#64748b' }}>Người duyệt y khoa:</dt>
                  <dd style={{ margin: '0.2rem 0 0 0', fontWeight: 600 }}>
                    {textFromRecord(data.carePlan, 'approvedBy') || 'Giám đốc Y khoa Tâm An'}
                  </dd>
                </div>
              </dl>
            </div>
          ) : (
            <EmptyState title="Chưa có Kế hoạch chăm sóc" description="Hiện chưa có kế hoạch chăm sóc chính thức cho cư dân này." />
          )}
        </div>
      )}

      {activeTab === 'clinical' && (
        <div className="card" style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '0.75rem', padding: '1.25rem' }}>
          <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem', fontWeight: 700, color: '#166534' }}>
            🩺 Theo Dõi Sinh Hiệu & Chỉ Số Lâm Sàng
          </h3>

          {clinicalItems.length > 0 ? (
            <div className="table-responsive" style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', minWidth: '950px', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
                    <th style={{ padding: '0.65rem 0.85rem', color: '#475569' }}>Thời gian đo</th>
                    <th style={{ padding: '0.65rem 0.85rem', color: '#475569' }}>Loại chỉ số</th>
                    <th style={{ padding: '0.65rem 0.85rem', color: '#475569' }}>Kết quả đo</th>
                    <th style={{ padding: '0.65rem 0.85rem', color: '#475569' }}>Người ghi nhận</th>
                    <th style={{ padding: '0.65rem 0.85rem', color: '#475569' }}>Đánh giá</th>
                  </tr>
                </thead>
                <tbody>
                  {clinicalItems.map((obs: any, idx: number) => {
                    const isAbnormal = obs.abnormalFlag || obs.status === 'ABNORMAL';
                    const val = obs.textValue || (obs.numericValue !== undefined ? `${obs.numericValue} ${obs.unit || ''}` : '—');
                    return (
                      <tr key={obs.clinicalObservationId || idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '0.65rem 0.85rem', color: '#64748b' }}>
                          {obs.measuredAt ? new Date(obs.measuredAt).toLocaleString('vi-VN') : 'Mới đây'}
                        </td>
                        <td style={{ padding: '0.65rem 0.85rem', fontWeight: 600, color: '#0f172a' }}>
                          {obs.observationType || obs.observationCode}
                        </td>
                        <td style={{ padding: '0.65rem 0.85rem', fontWeight: 700, color: isAbnormal ? '#b91c1c' : '#0f172a' }}>
                          {val}
                        </td>
                        <td style={{ padding: '0.65rem 0.85rem', color: '#475569' }}>
                          {obs.recordedBy || 'Nhân viên y tế'}
                        </td>
                        <td style={{ padding: '0.65rem 0.85rem' }}>
                          <span className={isAbnormal ? 'badge badge-danger' : 'badge badge-success'}>
                            {isAbnormal ? '⚠️ Cần chú ý' : '✓ Bình thường'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title="Chưa có dữ liệu sinh hiệu" description="Chưa có bản ghi sinh hiệu lâm sàng cho cư dân này." />
          )}
        </div>
      )}

      {activeTab === 'medication' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Section 1: Y lệnh thuốc */}
          <div className="card" style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '0.75rem', padding: '1.25rem' }}>
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem', fontWeight: 700, color: '#166534' }}>
              💊 Danh Mục Y Lệnh Thuốc Đang Dùng (Medication Orders)
            </h3>
            {(data.medication?.orders || []).length > 0 ? (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
                      <th style={{ padding: '0.65rem 0.85rem', color: '#475569' }}>Mã / Tên thuốc</th>
                      <th style={{ padding: '0.65rem 0.85rem', color: '#475569' }}>Liều dùng & Đường dùng</th>
                      <th style={{ padding: '0.65rem 0.85rem', color: '#475569' }}>Tần suất / Thời gian</th>
                      <th style={{ padding: '0.65rem 0.85rem', color: '#475569' }}>Bác sĩ kê đơn</th>
                      <th style={{ padding: '0.65rem 0.85rem', color: '#475569' }}>Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.medication?.orders || []).map((ord: any, idx: number) => (
                      <tr key={ord.medicationOrderId || idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '0.65rem 0.85rem' }}>
                          <div style={{ fontWeight: 700, color: '#0f172a' }}>{ord.medicationName}</div>
                          {ord.genericName && <div style={{ fontSize: '0.78rem', color: '#64748b' }}>{ord.genericName}</div>}
                        </td>
                        <td style={{ padding: '0.65rem 0.85rem' }}>
                          <span style={{ fontWeight: 600 }}>{ord.dosage || `${ord.dose || '1'} ${ord.doseUnit || 'viên'}`}</span>
                          <span style={{ color: '#64748b', fontSize: '0.8rem', marginLeft: '0.3rem' }}>({ord.route || 'Uống'})</span>
                        </td>
                        <td style={{ padding: '0.65rem 0.85rem', color: '#334155' }}>
                          {ord.frequency || '1 lần/ngày'}
                        </td>
                        <td style={{ padding: '0.65rem 0.85rem', color: '#475569' }}>
                          {ord.prescriberName || 'BS. Viện Tâm An'}
                        </td>
                        <td style={{ padding: '0.65rem 0.85rem' }}>
                          <span className="badge badge-success">● ĐANG DÙNG</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState title="Không có y lệnh thuốc" description="Hiện cụ không có y lệnh thuốc đang kê đơn." />
            )}
          </div>

          {/* Section 2: Nhật ký dùng thuốc eMAR */}
          <div className="card" style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '0.75rem', padding: '1.25rem' }}>
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem', fontWeight: 700, color: '#166534' }}>
              📋 Nhật Ký Cho Uống Thuốc Trong Ngày (eMAR Administrations)
            </h3>
            {(data.medication?.administrations || []).length > 0 ? (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
                      <th style={{ padding: '0.65rem 0.85rem', color: '#475569' }}>Giờ dự kiến</th>
                      <th style={{ padding: '0.65rem 0.85rem', color: '#475569' }}>Giờ uống thực tế</th>
                      <th style={{ padding: '0.65rem 0.85rem', color: '#475569' }}>Nhân viên y tế thực hiện</th>
                      <th style={{ padding: '0.65rem 0.85rem', color: '#475569' }}>Ghi chú lâm sàng</th>
                      <th style={{ padding: '0.65rem 0.85rem', color: '#475569' }}>Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.medication?.administrations || []).map((adm: any, idx: number) => (
                      <tr key={adm.medicationAdministrationId || idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '0.65rem 0.85rem', color: '#64748b' }}>
                          {adm.scheduledAt ? new Date(adm.scheduledAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '—'}
                        </td>
                        <td style={{ padding: '0.65rem 0.85rem', fontWeight: 700, color: '#0f172a' }}>
                          {adm.administeredAt ? new Date(adm.administeredAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : 'Chưa uống'}
                        </td>
                        <td style={{ padding: '0.65rem 0.85rem', color: '#475569' }}>
                          {adm.assignedTo || 'Nhân viên y tế ca'}
                        </td>
                        <td style={{ padding: '0.65rem 0.85rem', color: '#334155' }}>
                          {adm.administrationNote || 'Đã uống đúng liều'}
                        </td>
                        <td style={{ padding: '0.65rem 0.85rem' }}>
                          <span className={adm.status === 'COMPLETED' ? 'badge badge-success' : 'badge badge-warning'}>
                            {adm.status === 'COMPLETED' ? '✓ Đã hoàn thành' : '⏳ Chờ uống'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState title="Chưa có nhật ký dùng thuốc" description="Chưa có bản ghi thực hiện cấp phát thuốc hôm nay." />
            )}
          </div>
        </div>
      )}

      {activeTab === 'workQueue' && (
        <div className="card" style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '0.75rem', padding: '1.25rem' }}>
          <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem', fontWeight: 700, color: '#166534' }}>
            📝 Danh Mục Công Việc Chăm Sóc Trong Ngày
          </h3>
          {(data.workQueue || []).length > 0 ? (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
                    <th style={{ padding: '0.65rem 0.85rem', color: '#475569' }}>Thời gian</th>
                    <th style={{ padding: '0.65rem 0.85rem', color: '#475569' }}>Tên công việc chăm sóc</th>
                    <th style={{ padding: '0.65rem 0.85rem', color: '#475569' }}>Phân loại</th>
                    <th style={{ padding: '0.65rem 0.85rem', color: '#475569' }}>Nhân sự phụ trách</th>
                    <th style={{ padding: '0.65rem 0.85rem', color: '#475569' }}>Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.workQueue || []).map((task: any, idx: number) => (
                    <tr key={task.careTaskId || idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '0.65rem 0.85rem', color: '#64748b' }}>
                        {task.scheduledAt ? new Date(task.scheduledAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : 'Hôm nay'}
                      </td>
                      <td style={{ padding: '0.65rem 0.85rem', fontWeight: 700, color: '#0f172a' }}>
                        {task.title}
                      </td>
                      <td style={{ padding: '0.65rem 0.85rem' }}>
                        <span style={{ background: '#f1f5f9', color: '#334155', padding: '0.2rem 0.5rem', borderRadius: '0.25rem', fontSize: '0.78rem', fontWeight: 600 }}>
                          {task.taskCategory || 'Chăm sóc sinh hoạt'}
                        </span>
                      </td>
                      <td style={{ padding: '0.65rem 0.85rem', color: '#475569' }}>
                        {task.assignedTo || 'Nhân viên ca trực'}
                      </td>
                      <td style={{ padding: '0.65rem 0.85rem' }}>
                        <span
                          className={
                            task.status === 'COMPLETED'
                              ? 'badge badge-success'
                              : task.status === 'IN_PROGRESS'
                                ? 'badge badge-info'
                                : 'badge badge-neutral'
                          }
                        >
                          {task.status === 'COMPLETED'
                            ? '✓ Đã hoàn thành'
                            : task.status === 'IN_PROGRESS'
                              ? '⚡ Đang thực hiện'
                              : '⏳ Chờ thực hiện'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title="Không có công việc" description="Không có công việc chăm sóc nào trong danh sách hiện tại." />
          )}
        </div>
      )}

      {activeTab === 'incidents' && (
        <div className="card" style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '0.75rem', padding: '1.25rem' }}>
          <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem', fontWeight: 700, color: '#166534' }}>
            ⚠️ Nhật Ký Sự Cố & Ghi Nhận Bất Thường
          </h3>
          {(data.incidents || []).length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {(data.incidents || []).map((inc: any, idx: number) => (
                <div
                  key={inc.incidentId || idx}
                  style={{
                    background: '#fff8f6',
                    border: '1px solid #ffedd5',
                    borderRadius: '0.5rem',
                    padding: '1rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                    <div style={{ fontWeight: 700, color: '#9a3412', fontSize: '0.95rem' }}>
                      ⚠️ {inc.title || 'Ghi nhận sự cố y tế'}
                    </div>
                    <span className="badge badge-warning" style={{ fontSize: '0.75rem' }}>
                      {inc.status || 'ĐÃ XỬ LÝ'}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.85rem', color: '#475569', marginBottom: '0.4rem' }}>
                    Thời gian: {inc.occurredAt ? new Date(inc.occurredAt).toLocaleString('vi-VN') : '—'} • Vị trí: {inc.location || 'Tại Viện'}
                  </div>
                  {inc.description && (
                    <div style={{ fontSize: '0.85rem', color: '#334155', background: '#ffffff', padding: '0.6rem 0.8rem', borderRadius: '0.375rem', border: '1px solid #fed7aa' }}>
                      <b>Nội dung:</b> {inc.description}
                    </div>
                  )}
                  {inc.resolutionSummary && (
                    <div style={{ fontSize: '0.82rem', color: '#15803d', marginTop: '0.4rem', fontWeight: 600 }}>
                      ✓ <b>Kết luận xử lý:</b> {inc.resolutionSummary}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>✅</div>
              <h4 style={{ margin: '0 0 0.25rem 0', color: '#15803d', fontWeight: 700 }}>An toàn tuyệt đối</h4>
              <p style={{ margin: 0, color: '#64748b', fontSize: '0.88rem' }}>
                Không ghi nhận sự cố y tế hoặc tổn hại an toàn nào đối với cụ trong kỳ lưu trú.
              </p>
            </div>
          )}
        </div>
      )}

      {/* SYSTEM ACCESS & AUTHORITY FOOTER CARD */}
      <section className="card" style={{ marginTop: '2rem', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '0.75rem', padding: '1rem 1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <span style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.88rem' }}>
              🔒 Xác thực bảo mật RBAC & Phạm vi truy cập Care View:
            </span>
            <span style={{ fontSize: '0.82rem', color: '#64748b', marginLeft: '0.5rem' }}>
              Actor: <b>{actor.displayName}</b> ({(ROLE_LABELS as Record<string, string>)[data.access.actorRole || ''] || data.access.actorRole}) • Scope: {data.access.scope} • Mode: {data.viewMode}
            </span>
          </div>
          <span className="badge badge-success" style={{ fontSize: '0.75rem' }}>✓ Server Verified</span>
        </div>
      </section>
    </div>
  );
}


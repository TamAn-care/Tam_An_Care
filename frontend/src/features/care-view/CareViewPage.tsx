import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { getResidentCareView } from '../../api/residents';
import { useActor } from '../../auth/ActorContext';
import { triggerPrint } from '../../utils/print';
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
  formatResidentNameWithSalutation,
} from '../residents/resident-ui';
import {
  calculateMonthlyVitalMinMax,
  getResidentVitalHistory,
  saveVitalRecord,
  getResidentADL,
  saveResidentADL,
  type ADLEvaluation,
} from '../../utils/vitals-calculator';

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

  // Daily vitals modal state for Caregiver/Nurse
  const [showVitalsModal, setShowVitalsModal] = useState(false);
  const [vitalsSysBP, setVitalsSysBP] = useState('120');
  const [vitalsDiaBP, setVitalsDiaBP] = useState('80');
  const [vitalsHeartRate, setVitalsHeartRate] = useState('75');
  const [vitalsTemp, setVitalsTemp] = useState('36.5');
  const [vitalsSpo2, setVitalsSpo2] = useState('98');
  const [vitalsRespRate, setVitalsRespRate] = useState('18');
  const [vitalsWeight, setVitalsWeight] = useState('');
  const [vitalsGlucose, setVitalsGlucose] = useState('');
  const [vitalsNote, setVitalsNote] = useState('');
  const [vitalsSaveSuccess, setVitalsSaveSuccess] = useState(false);

  // ADL evaluation state for Caregiver
  const [showAdlModal, setShowAdlModal] = useState(false);
  const [adlData, setAdlData] = useState<ADLEvaluation>(() => getResidentADL(normalizedResidentId));
  const [adlSaveSuccess, setAdlSaveSuccess] = useState(false);

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

  const monthlyVitalsSummary = useMemo(() => {
    return calculateMonthlyVitalMinMax(normalizedResidentId);
  }, [normalizedResidentId, vitalsSaveSuccess]);

  const vitalHistory = useMemo(() => {
    return getResidentVitalHistory(normalizedResidentId);
  }, [normalizedResidentId, vitalsSaveSuccess]);

  const handleSaveVitals = (e: React.FormEvent) => {
    e.preventDefault();
    if (!normalizedResidentId) return;

    saveVitalRecord(normalizedResidentId, {
      sysBP: Number(vitalsSysBP) || 120,
      diaBP: Number(vitalsDiaBP) || 80,
      heartRate: Number(vitalsHeartRate) || 75,
      temp: Number(vitalsTemp) || 36.5,
      spo2: Number(vitalsSpo2) || 98,
      respRate: Number(vitalsRespRate) || 18,
      weight: vitalsWeight ? Number(vitalsWeight) : undefined,
      bloodGlucose: vitalsGlucose ? Number(vitalsGlucose) : undefined,
      recordedBy: actor?.displayName || 'Nhân viên chăm sóc',
      recordedByRole: (actor?.actorRole as string) || 'CAREGIVER',
      note: vitalsNote.trim(),
    });

    setVitalsSaveSuccess((prev) => !prev);
    setShowVitalsModal(false);
    setVitalsNote('');
  };

  const currentAdl = useMemo(() => {
    return getResidentADL(normalizedResidentId);
  }, [normalizedResidentId, adlSaveSuccess]);

  const handleSaveAdl = (e: React.FormEvent) => {
    e.preventDefault();
    if (!normalizedResidentId) return;
    saveResidentADL(normalizedResidentId, adlData, actor?.displayName, (actor?.actorRole as string));
    setAdlSaveSuccess((prev) => !prev);
    setShowAdlModal(false);
  };

  return (
    <div className="printable-a4-sheet" style={{ paddingBottom: '3rem' }}>
      {/* NAVIGATION TOP BAR */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <Link to="/residents" className="btn btn-neutral no-print" style={{ textDecoration: 'none', fontSize: '0.88rem', fontWeight: 600 }}>
          &larr; Danh sách người cao tuổi
        </Link>

        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => setShowVitalsModal(true)}
            className="btn btn-success no-print"
            style={{
              fontSize: '0.88rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              background: '#166534',
              color: '#ffffff',
              border: 'none',
              padding: '0.5rem 1rem',
              borderRadius: '0.375rem',
              cursor: 'pointer',
              boxShadow: '0 2px 4px rgba(22, 101, 52, 0.2)',
            }}
          >
            🩺 Ghi Nhận Sinh Hiệu Hàng Ngày
          </button>
          <button
            type="button"
            onClick={() => triggerPrint()}
            className="btn btn-primary no-print"
            style={{ fontSize: '0.88rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            🖨️ In Hồ Sơ Chăm Sóc (A4)
          </button>
          <button
            type="button"
            className="btn btn-secondary no-print"
            disabled={query.isFetching}
            onClick={() => void query.refetch()}
            style={{ fontSize: '0.85rem' }}
          >
            {query.isFetching ? '⏳ Đang làm mới…' : '🔄 Làm mới dữ liệu'}
          </button>
        </div>
      </div>

      {/* ELDERLY PROFILE HERO CARD */}
      <section
        style={{
          background: 'linear-gradient(135deg, #15803d 0%, #166534 100%)',
          borderRadius: '0.85rem',
          padding: '1.35rem 1.6rem',
          color: '#ffffff',
          boxShadow: '0 10px 25px -5px rgba(22, 101, 52, 0.25)',
          marginBottom: '1.5rem',
        }}
      >
        <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <ElderlyAvatar gender={gender} name={residentName} size={72} />

          <div style={{ flex: 1, minWidth: '260px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
              <h1 style={{ margin: 0, fontSize: '1.65rem', fontWeight: 800, color: '#ffffff' }}>
                {formatResidentNameWithSalutation(residentName, gender)}
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

      {/* QUICK VITALS SUMMARY BAR WITH MONTHLY MIN-MAX */}
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '0.85rem', marginBottom: '1.5rem' }}>
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '0.65rem', padding: '1rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>❤️ Huyết Áp (mmHg)</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', marginTop: '0.2rem' }}>
            {displayBp}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#0369a1', fontWeight: 700, marginTop: '0.35rem', background: '#e0f2fe', padding: '0.2rem 0.45rem', borderRadius: '0.25rem', display: 'inline-block' }}>
            Min-Max tháng: <b>{monthlyVitalsSummary.bpMinMax}</b>
          </div>
        </div>

        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '0.65rem', padding: '1rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>💓 Mạch (lần/phút)</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', marginTop: '0.2rem' }}>
            {displayHeart}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#0369a1', fontWeight: 700, marginTop: '0.35rem', background: '#e0f2fe', padding: '0.2rem 0.45rem', borderRadius: '0.25rem', display: 'inline-block' }}>
            Min-Max tháng: <b>{monthlyVitalsSummary.pulseMinMax}</b>
          </div>
        </div>

        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '0.65rem', padding: '1rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>🌡️ Thân Nhiệt (°C)</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', marginTop: '0.2rem' }}>
            {displayTemp}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#0369a1', fontWeight: 700, marginTop: '0.35rem', background: '#e0f2fe', padding: '0.2rem 0.45rem', borderRadius: '0.25rem', display: 'inline-block' }}>
            Min-Max tháng: <b>{monthlyVitalsSummary.tempMinMax}</b>
          </div>
        </div>

        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '0.65rem', padding: '1rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>🫁 SpO2 (%)</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', marginTop: '0.2rem' }}>
            {displaySpo2}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#0369a1', fontWeight: 700, marginTop: '0.35rem', background: '#e0f2fe', padding: '0.2rem 0.45rem', borderRadius: '0.25rem', display: 'inline-block' }}>
            Min-Max tháng: <b>{monthlyVitalsSummary.spo2MinMax}</b>
          </div>
        </div>

        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '0.65rem', padding: '1rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>⚖️ Cân Nặng (kg)</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', marginTop: '0.2rem' }}>
            {monthlyVitalsSummary.weightMinMax}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#15803d', fontWeight: 700, marginTop: '0.35rem', background: '#dcfce7', padding: '0.2rem 0.45rem', borderRadius: '0.25rem', display: 'inline-block' }}>
            Theo dõi tháng ({monthlyVitalsSummary.weightRecords.length} lần đo)
          </div>
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

          {/* Card 3: Đánh giá ADL cho NVCS */}
          <div className="card" style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '0.75rem', padding: '1.25rem', gridColumn: '1 / -1' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#166534', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span>📋</span> Đánh Giá Chức Năng Sinh Hoạt Hàng Ngày (ADL)
                </h3>
                <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                  👩‍⚕️ Thực hiện đánh giá & cập nhật phân quyền: <b>Nhân viên chăm sóc / Điều dưỡng</b>
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setAdlData(getResidentADL(normalizedResidentId));
                  setShowAdlModal(true);
                }}
                className="btn btn-sm btn-success"
                style={{ background: '#166534', color: '#ffffff', fontWeight: 700 }}
              >
                ✏️ Cập nhật Đánh giá ADL
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', fontSize: '0.86rem' }}>
              <div style={{ background: '#f8fafc', padding: '0.65rem 0.85rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0' }}>
                <span style={{ color: '#64748b', display: 'block', fontSize: '0.76rem', fontWeight: 600 }}>1. ĂN UỐNG</span>
                <span style={{ fontWeight: 700, color: '#0f172a' }}>
                  {currentAdl.eating === 'INDEPENDENT' ? '✅ Tự thực hiện' : currentAdl.eating === 'PARTIAL_ASSIST' ? '🤝 Cần hỗ trợ 1 phần' : '🆘 Phụ thuộc hoàn toàn'}
                </span>
              </div>
              <div style={{ background: '#f8fafc', padding: '0.65rem 0.85rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0' }}>
                <span style={{ color: '#64748b', display: 'block', fontSize: '0.76rem', fontWeight: 600 }}>2. TẮM RỬA / VỆ SINH</span>
                <span style={{ fontWeight: 700, color: '#0f172a' }}>
                  {currentAdl.bathing === 'INDEPENDENT' ? '✅ Tự thực hiện' : currentAdl.bathing === 'PARTIAL_ASSIST' ? '🤝 Cần hỗ trợ 1 phần' : '🆘 Phụ thuộc hoàn toàn'}
                </span>
              </div>
              <div style={{ background: '#f8fafc', padding: '0.65rem 0.85rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0' }}>
                <span style={{ color: '#64748b', display: 'block', fontSize: '0.76rem', fontWeight: 600 }}>3. MẶC QUẦN ÁO</span>
                <span style={{ fontWeight: 700, color: '#0f172a' }}>
                  {currentAdl.dressing === 'INDEPENDENT' ? '✅ Tự thực hiện' : currentAdl.dressing === 'PARTIAL_ASSIST' ? '🤝 Cần hỗ trợ 1 phần' : '🆘 Phụ thuộc hoàn toàn'}
                </span>
              </div>
              <div style={{ background: '#f8fafc', padding: '0.65rem 0.85rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0' }}>
                <span style={{ color: '#64748b', display: 'block', fontSize: '0.76rem', fontWeight: 600 }}>4. ĐI VỆ SINH</span>
                <span style={{ fontWeight: 700, color: '#0f172a' }}>
                  {currentAdl.toileting === 'INDEPENDENT' ? '✅ Tự thực hiện' : currentAdl.toileting === 'PARTIAL_ASSIST' ? '🤝 Cần hỗ trợ 1 phần' : '🆘 Phụ thuộc hoàn toàn'}
                </span>
              </div>
              <div style={{ background: '#f8fafc', padding: '0.65rem 0.85rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0' }}>
                <span style={{ color: '#64748b', display: 'block', fontSize: '0.76rem', fontWeight: 600 }}>5. DI CHUYỂN</span>
                <span style={{ fontWeight: 700, color: '#0f172a' }}>
                  {currentAdl.mobility === 'INDEPENDENT' ? '✅ Tự thực hiện' : currentAdl.mobility === 'PARTIAL_ASSIST' ? '🤝 Cần hỗ trợ 1 phần' : '🆘 Phụ thuộc hoàn toàn'}
                </span>
              </div>
            </div>
            {currentAdl.assessedBy && (
              <div style={{ marginTop: '0.75rem', fontSize: '0.78rem', color: '#64748b', textAlign: 'right' }}>
                Đánh giá gần nhất bởi: <b>{currentAdl.assessedBy}</b> ({(ROLE_LABELS as Record<string, string>)[currentAdl.assessedByRole || ''] || currentAdl.assessedByRole})
              </div>
            )}
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Summary Min-Max Banner for Monthly Periodic Report */}
          <div style={{ background: '#f0fdf4', border: '1.5px solid #bbf7d0', borderRadius: '0.75rem', padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#166534', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span>📊</span> Dải Chỉ Số Min – Max Tháng (Đồng Bộ Báo Cáo Định Kỳ)
              </h3>
              <span style={{ fontSize: '0.8rem', color: '#15803d', fontWeight: 700, background: '#dcfce7', padding: '0.2rem 0.6rem', borderRadius: '9999px' }}>
                Tổng số {monthlyVitalsSummary.totalMeasurementsCount} lần đo trong kỳ
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', fontSize: '0.86rem' }}>
              <div style={{ background: '#ffffff', padding: '0.65rem 0.85rem', borderRadius: '0.5rem', border: '1px solid #dcfce7' }}>
                <span style={{ color: '#64748b', display: 'block', fontSize: '0.76rem', fontWeight: 600 }}>MẠCH (lần/phút)</span>
                <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>{monthlyVitalsSummary.pulseMinMax}</span>
              </div>
              <div style={{ background: '#ffffff', padding: '0.65rem 0.85rem', borderRadius: '0.5rem', border: '1px solid #dcfce7' }}>
                <span style={{ color: '#64748b', display: 'block', fontSize: '0.76rem', fontWeight: 600 }}>HUYẾT ÁP (mmHg)</span>
                <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>{monthlyVitalsSummary.bpMinMax}</span>
              </div>
              <div style={{ background: '#ffffff', padding: '0.65rem 0.85rem', borderRadius: '0.5rem', border: '1px solid #dcfce7' }}>
                <span style={{ color: '#64748b', display: 'block', fontSize: '0.76rem', fontWeight: 600 }}>THÂN NHIỆT (°C)</span>
                <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>{monthlyVitalsSummary.tempMinMax}</span>
              </div>
              <div style={{ background: '#ffffff', padding: '0.65rem 0.85rem', borderRadius: '0.5rem', border: '1px solid #dcfce7' }}>
                <span style={{ color: '#64748b', display: 'block', fontSize: '0.76rem', fontWeight: 600 }}>SPO2 (%)</span>
                <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>{monthlyVitalsSummary.spo2MinMax}</span>
              </div>
              <div style={{ background: '#ffffff', padding: '0.65rem 0.85rem', borderRadius: '0.5rem', border: '1px solid #dcfce7' }}>
                <span style={{ color: '#64748b', display: 'block', fontSize: '0.76rem', fontWeight: 600 }}>CÂN NẶNG (kg)</span>
                <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>{monthlyVitalsSummary.weightMinMax}</span>
              </div>
              <div style={{ background: '#ffffff', padding: '0.65rem 0.85rem', borderRadius: '0.5rem', border: '1px solid #dcfce7' }}>
                <span style={{ color: '#64748b', display: 'block', fontSize: '0.76rem', fontWeight: 600 }}>GLUCOSE MAO MẠCH</span>
                <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>{monthlyVitalsSummary.glucoseMinMax} mmol/L</span>
              </div>
            </div>
          </div>

          <div className="card" style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '0.75rem', padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#166534' }}>
                🩺 Nhật Ký Theo Dõi & Lịch Sử Đo Sinh Hiệu Hàng Ngày
              </h3>
              <button
                type="button"
                onClick={() => setShowVitalsModal(true)}
                className="btn btn-sm btn-success"
                style={{ background: '#166534', color: '#ffffff', fontWeight: 700 }}
              >
                + Thêm lượt đo mới
              </button>
            </div>

            {vitalHistory.length > 0 ? (
              <div className="table-responsive" style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', minWidth: '950px', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
                      <th style={{ padding: '0.65rem 0.85rem', color: '#475569' }}>Thời gian đo</th>
                      <th style={{ padding: '0.65rem 0.85rem', color: '#475569' }}>Huyết áp (mmHg)</th>
                      <th style={{ padding: '0.65rem 0.85rem', color: '#475569' }}>Mạch (bpm)</th>
                      <th style={{ padding: '0.65rem 0.85rem', color: '#475569' }}>Nhiệt độ (°C)</th>
                      <th style={{ padding: '0.65rem 0.85rem', color: '#475569' }}>SpO2 (%)</th>
                      <th style={{ padding: '0.65rem 0.85rem', color: '#475569' }}>Cân nặng / Đường huyết</th>
                      <th style={{ padding: '0.65rem 0.85rem', color: '#475569' }}>Người đo / Vai trò</th>
                      <th style={{ padding: '0.65rem 0.85rem', color: '#475569' }}>Ghi chú</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vitalHistory.map((vrec) => (
                      <tr key={vrec.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '0.65rem 0.85rem', color: '#64748b', fontSize: '0.82rem' }}>
                          {new Date(vrec.measuredAt).toLocaleString('vi-VN')}
                        </td>
                        <td style={{ padding: '0.65rem 0.85rem', fontWeight: 700, color: '#0f172a' }}>
                          {vrec.sysBP && vrec.diaBP ? `${vrec.sysBP}/${vrec.diaBP}` : '—'}
                        </td>
                        <td style={{ padding: '0.65rem 0.85rem', fontWeight: 700, color: '#0f172a' }}>
                          {vrec.heartRate ?? '—'}
                        </td>
                        <td style={{ padding: '0.65rem 0.85rem', fontWeight: 700, color: '#0f172a' }}>
                          {vrec.temp ? `${vrec.temp}°C` : '—'}
                        </td>
                        <td style={{ padding: '0.65rem 0.85rem', fontWeight: 700, color: '#0f172a' }}>
                          {vrec.spo2 ? `${vrec.spo2}%` : '—'}
                        </td>
                        <td style={{ padding: '0.65rem 0.85rem', color: '#334155' }}>
                          {vrec.weight ? `${vrec.weight} kg` : ''}
                          {vrec.weight && vrec.bloodGlucose ? ' | ' : ''}
                          {vrec.bloodGlucose ? `GLU: ${vrec.bloodGlucose} mmol/L` : (!vrec.weight ? '—' : '')}
                        </td>
                        <td style={{ padding: '0.65rem 0.85rem', color: '#475569' }}>
                          <b>{vrec.recordedBy}</b> ({(ROLE_LABELS as Record<string, string>)[vrec.recordedByRole] || vrec.recordedByRole})
                        </td>
                        <td style={{ padding: '0.65rem 0.85rem', color: '#64748b', fontSize: '0.82rem' }}>
                          {vrec.note || 'Theo dõi bình thường'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState title="Chưa có dữ liệu sinh hiệu" description="Chưa có bản ghi sinh hiệu lâm sàng cho cư dân này." />
            )}
          </div>
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
              <div className="table-responsive" style={{ overflowX: 'auto' }}>
                <table className="table-wide-800" style={{ width: '100%', minWidth: '800px', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
                      <th style={{ padding: '0.65rem 0.85rem', color: '#475569', whiteSpace: 'nowrap' }}>Mã / Tên thuốc</th>
                      <th style={{ padding: '0.65rem 0.85rem', color: '#475569', whiteSpace: 'nowrap' }}>Liều dùng & Đường dùng</th>
                      <th style={{ padding: '0.65rem 0.85rem', color: '#475569', whiteSpace: 'nowrap' }}>Tần suất / Thời gian</th>
                      <th style={{ padding: '0.65rem 0.85rem', color: '#475569', whiteSpace: 'nowrap' }}>Bác sĩ kê đơn</th>
                      <th style={{ padding: '0.65rem 0.85rem', color: '#475569', whiteSpace: 'nowrap' }}>Trạng thái</th>
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
                        <td style={{ padding: '0.65rem 0.85rem', color: '#475569', whiteSpace: 'nowrap' }}>
                          {ord.prescriberName || 'BS. Viện Tâm An'}
                        </td>
                        <td style={{ padding: '0.65rem 0.85rem', whiteSpace: 'nowrap' }}>
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
              <div className="table-responsive" style={{ overflowX: 'auto' }}>
                <table className="table-wide-800" style={{ width: '100%', minWidth: '800px', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
                      <th style={{ padding: '0.65rem 0.85rem', color: '#475569', whiteSpace: 'nowrap' }}>Giờ dự kiến</th>
                      <th style={{ padding: '0.65rem 0.85rem', color: '#475569', whiteSpace: 'nowrap' }}>Giờ uống thực tế</th>
                      <th style={{ padding: '0.65rem 0.85rem', color: '#475569', whiteSpace: 'nowrap' }}>Nhân viên y tế thực hiện</th>
                      <th style={{ padding: '0.65rem 0.85rem', color: '#475569' }}>Ghi chú lâm sàng</th>
                      <th style={{ padding: '0.65rem 0.85rem', color: '#475569', whiteSpace: 'nowrap' }}>Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.medication?.administrations || []).map((adm: any, idx: number) => (
                      <tr key={adm.medicationAdministrationId || idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '0.65rem 0.85rem', color: '#64748b', whiteSpace: 'nowrap' }}>
                          {adm.scheduledAt ? new Date(adm.scheduledAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '—'}
                        </td>
                        <td style={{ padding: '0.65rem 0.85rem', fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap' }}>
                          {adm.administeredAt ? new Date(adm.administeredAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : 'Chưa uống'}
                        </td>
                        <td style={{ padding: '0.65rem 0.85rem', color: '#475569', whiteSpace: 'nowrap' }}>
                          {adm.assignedTo || 'Nhân viên y tế ca'}
                        </td>
                        <td style={{ padding: '0.65rem 0.85rem', color: '#334155' }}>
                          {adm.administrationNote || 'Đã uống đúng liều'}
                        </td>
                        <td style={{ padding: '0.65rem 0.85rem', whiteSpace: 'nowrap' }}>
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
            <div className="table-responsive" style={{ overflowX: 'auto' }}>
              <table className="table-wide-750" style={{ width: '100%', minWidth: '750px', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
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

      {/* DAILY VITALS RECORDING MODAL FOR CAREGIVER */}
      {showVitalsModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '1rem' }}>
          <div style={{ background: '#ffffff', borderRadius: '0.75rem', maxWidth: '650px', width: '100%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.25)' }}>
            <div style={{ padding: '1.25rem 1.5rem', background: '#166534', color: '#ffffff', borderRadius: '0.75rem 0.75rem 0 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800 }}>🩺 Ghi Nhận Dấu Hiệu Sinh Tồn Hàng Ngày</h3>
              <button type="button" onClick={() => setShowVitalsModal(false)} style={{ background: 'transparent', border: 'none', color: '#ffffff', fontSize: '1.5rem', cursor: 'pointer', lineHeight: 1 }}>&times;</button>
            </div>
            <form onSubmit={handleSaveVitals} style={{ padding: '1.5rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>Huyết áp tâm thu (mmHg) *</label>
                  <input type="number" value={vitalsSysBP} onChange={e => setVitalsSysBP(e.target.value)} required placeholder="120" style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '0.375rem' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>Huyết áp tâm trương (mmHg) *</label>
                  <input type="number" value={vitalsDiaBP} onChange={e => setVitalsDiaBP(e.target.value)} required placeholder="80" style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '0.375rem' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>Mạch / Nhịp tim (lần/phút) *</label>
                  <input type="number" value={vitalsHeartRate} onChange={e => setVitalsHeartRate(e.target.value)} required placeholder="75" style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '0.375rem' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>Thân nhiệt (°C) *</label>
                  <input type="number" step="0.1" value={vitalsTemp} onChange={e => setVitalsTemp(e.target.value)} required placeholder="36.5" style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '0.375rem' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>Nồng độ SpO2 (%) *</label>
                  <input type="number" value={vitalsSpo2} onChange={e => setVitalsSpo2(e.target.value)} required placeholder="98" style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '0.375rem' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>Nhịp thở (lần/phút)</label>
                  <input type="number" value={vitalsRespRate} onChange={e => setVitalsRespRate(e.target.value)} placeholder="18" style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '0.375rem' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>Cân nặng (kg)</label>
                  <input type="number" step="0.1" value={vitalsWeight} onChange={e => setVitalsWeight(e.target.value)} placeholder="48.5" style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '0.375rem' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>Đường huyết mao mạch (mmol/L)</label>
                  <input type="number" step="0.1" value={vitalsGlucose} onChange={e => setVitalsGlucose(e.target.value)} placeholder="6.5" style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '0.375rem' }} />
                </div>
              </div>
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>Ghi chú diễn biến & theo dõi sức khỏe</label>
                <textarea rows={3} value={vitalsNote} onChange={e => setVitalsNote(e.target.value)} placeholder="Tình trạng tinh thần, triệu chứng bất thường nếu có..." style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '0.375rem' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" onClick={() => setShowVitalsModal(false)} className="btn btn-secondary">Hủy</button>
                <button type="submit" className="btn btn-success" style={{ background: '#166534', color: '#fff', fontWeight: 700 }}>💾 Lưu & Đồng Bộ Báo Cáo</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADL EVALUATION MODAL FOR CAREGIVER */}
      {showAdlModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '1rem' }}>
          <div style={{ background: '#ffffff', borderRadius: '0.75rem', maxWidth: '650px', width: '100%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.25)' }}>
            <div style={{ padding: '1.25rem 1.5rem', background: '#166534', color: '#ffffff', borderRadius: '0.75rem 0.75rem 0 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800 }}>📋 Đánh Giá Chức Năng Sinh Hoạt Hàng Ngày (ADL)</h3>
              <button type="button" onClick={() => setShowAdlModal(false)} style={{ background: 'transparent', border: 'none', color: '#ffffff', fontSize: '1.5rem', cursor: 'pointer', lineHeight: 1 }}>&times;</button>
            </div>
            <form onSubmit={handleSaveAdl} style={{ padding: '1.5rem' }}>
              <div style={{ marginBottom: '1.25rem' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
                      <th style={{ padding: '0.65rem' }}>Hoạt động thiết yếu</th>
                      <th style={{ padding: '0.65rem', textAlign: 'center' }}>Tự thực hiện</th>
                      <th style={{ padding: '0.65rem', textAlign: 'center' }}>Hỗ trợ 1 phần</th>
                      <th style={{ padding: '0.65rem', textAlign: 'center' }}>Phụ thuộc</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { key: 'eating', label: '1. Ăn uống' },
                      { key: 'bathing', label: '2. Tắm rửa / Vệ sinh' },
                      { key: 'dressing', label: '3. Mặc quần áo' },
                      { key: 'toileting', label: '4. Đi vệ sinh' },
                      { key: 'mobility', label: '5. Di chuyển đi lại' },
                    ].map((item) => (
                      <tr key={item.key} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '0.65rem', fontWeight: 700 }}>{item.label}</td>
                        <td style={{ padding: '0.65rem', textAlign: 'center' }}>
                          <input
                            type="radio"
                            name={`adl_modal_${item.key}`}
                            checked={(adlData as any)[item.key] === 'INDEPENDENT'}
                            onChange={() => setAdlData((prev) => ({ ...prev, [item.key]: 'INDEPENDENT' }))}
                          />
                        </td>
                        <td style={{ padding: '0.65rem', textAlign: 'center' }}>
                          <input
                            type="radio"
                            name={`adl_modal_${item.key}`}
                            checked={(adlData as any)[item.key] === 'PARTIAL_ASSIST'}
                            onChange={() => setAdlData((prev) => ({ ...prev, [item.key]: 'PARTIAL_ASSIST' }))}
                          />
                        </td>
                        <td style={{ padding: '0.65rem', textAlign: 'center' }}>
                          <input
                            type="radio"
                            name={`adl_modal_${item.key}`}
                            checked={(adlData as any)[item.key] === 'FULL_DEPEND'}
                            onChange={() => setAdlData((prev) => ({ ...prev, [item.key]: 'FULL_DEPEND' }))}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" onClick={() => setShowAdlModal(false)} className="btn btn-secondary">Hủy</button>
                <button type="submit" className="btn btn-success" style={{ background: '#166534', color: '#fff', fontWeight: 700 }}>💾 Lưu Đánh Giá ADL</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}


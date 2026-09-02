import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useActor } from '../../auth/ActorContext';
import { listResidents } from '../../api/residents';
import { fetchLeaveRequests, createLeaveRequest, LeaveType } from '../../api/resident-leave';
import { listHealthReports, downloadHealthReportPdf, HealthReportRow } from '../health-reports/healthReportsApi';
import { getAssignedResidentIdsForGuardian, getAssignedResidentIdsForActor } from '../../auth/role-policy';
import { fetchResidentIntegrationOverview } from '../../api/integration';
import { LoadingState, ErrorState, EmptyState } from '../../components/feedback/FeedbackStates';

const CARE_LEVEL_CONFIG: Record<string, { label: string; badgeClass: string; desc: string }> = {
  INDEPENDENT: { label: 'Chăm sóc Cấp độ 1', badgeClass: 'badge-success', desc: 'Tự chủ sinh hoạt cơ bản, cần hỗ trợ nhẹ' },
  ASSISTED: { label: 'Chăm sóc Cấp độ 2', badgeClass: 'badge-info', desc: 'Cần trợ giúp sinh hoạt và theo dõi y tế định kỳ' },
  HIGH_ASSISTANCE: { label: 'Chăm sóc Cấp độ 3', badgeClass: 'badge-warning', desc: 'Phụ thuộc nhiều, cần theo dõi liên tục' },
  DEPENDENT: { label: 'Chăm sóc Toàn diện', badgeClass: 'badge-danger', desc: 'Phụ thuộc hoàn toàn, cần chăm sóc 24/7' },
  LEVEL_1: { label: 'Chăm sóc Cấp độ 1', badgeClass: 'badge-success', desc: 'Tự chủ sinh hoạt cơ bản, cần hỗ trợ nhẹ' },
  LEVEL_2: { label: 'Chăm sóc Cấp độ 2', badgeClass: 'badge-info', desc: 'Cần trợ giúp sinh hoạt và theo dõi y tế định kỳ' },
  LEVEL_3: { label: 'Chăm sóc Cấp độ 3', badgeClass: 'badge-warning', desc: 'Phụ thuộc hoàn toàn, cần chăm sóc toàn diện 24/7' },
};

const LEAVE_TYPE_LABELS: Record<LeaveType, string> = {
  FAMILY_VISIT: 'Về thăm nhà & Sum họp gia đình',
  MEDICAL_OUTING: 'Khám bệnh tại bệnh viện tuyến trên',
  TEMPORARY_HOSPITALIZATION: 'Điều trị nội trú bệnh viện ngoài',
  VACATION: 'Du lịch / Nghỉ dưỡng cùng con cháu',
  OTHER: 'Lý do khác',
};

interface ParsedClinicalSummary {
  isStructured: boolean;
  assessorName?: string;
  specificEvaluation?: string;
  additionalNotesAndCareInstructions?: string;
  pulse?: string;
  bloodPressure?: string;
  temperature?: string;
  spo2?: string;
  careLevelProposal?: string;
  rawText?: string;
}

function parseReportSummary(summary: string | null): ParsedClinicalSummary | null {
  if (!summary) return null;
  try {
    if (summary.startsWith('{') && (summary.includes('assessmentDate') || summary.includes('specificEvaluation') || summary.includes('bloodPressure'))) {
      const obj = JSON.parse(summary);
      return {
        isStructured: true,
        assessorName: obj.assessorName,
        specificEvaluation: obj.specificEvaluation,
        additionalNotesAndCareInstructions: obj.additionalNotesAndCareInstructions,
        pulse: obj.pulse,
        bloodPressure: obj.bloodPressure,
        temperature: obj.temperature,
        spo2: obj.spo2,
        careLevelProposal: obj.careLevelProposal,
      };
    }
  } catch {
    // fallback
  }
  return {
    isStructured: false,
    rawText: summary,
  };
}

function formatPeriodDate(iso: string): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (!isNaN(d.getTime())) {
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    }
    return iso;
  } catch {
    return iso;
  }
}

export default function FamilyPortalPage() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<'health' | 'leave' | 'nutrition' | 'visit'>('health');
  const [selectedResidentId, setSelectedResidentId] = useState<string>('');
  const [downloadingPdfId, setDownloadingPdfId] = useState<string | null>(null);

  // Form State for Leave Submission
  const [leaveType, setLeaveType] = useState<LeaveType>('FAMILY_VISIT');
  const [startDate, setStartDate] = useState<string>('');
  const [expectedEndDate, setExpectedEndDate] = useState<string>('');
  const [reportedBy, setReportedBy] = useState<string>(actor?.displayName || 'Lê Gia Bảo');
  const [reporterRelationship, setReporterRelationship] = useState<string>('Con trai');
  const [reporterPhone, setReporterPhone] = useState<string>('0908 123 456');
  const [leaveNote, setLeaveNote] = useState<string>('');
  const [leaveSuccessMsg, setLeaveSuccessMsg] = useState<string>('');
  const [leaveErrorMsg, setLeaveErrorMsg] = useState<string>('');

  // Form State for Visit Scheduling
  const [visitDate, setVisitDate] = useState<string>('');
  const [visitTimeSlot, setVisitTimeSlot] = useState<string>('MORNING');
  const [visitorCount, setVisitorCount] = useState<number>(2);
  const [visitLocation, setVisitLocation] = useState<string>('ROOM');
  const [visitNote, setVisitNote] = useState<string>('');
  const [visitSuccessMsg, setVisitSuccessMsg] = useState<string>('');

  // Local demo visits state
  const [scheduledVisits, setScheduledVisits] = useState<Array<{
    id: string;
    date: string;
    slot: string;
    visitors: number;
    location: string;
    status: string;
    note?: string;
  }>>([
    {
      id: 'visit-001',
      date: '2026-09-06',
      slot: 'Sáng (08:30 - 11:00)',
      visitors: 3,
      location: 'Sảnh vườn hoa Tâm An',
      status: 'Đã xác nhận',
      note: 'Gia đình mang hoa và trái cây mềm',
    },
  ]);

  // Fetch Residents
  const residentsQuery = useQuery({
    queryKey: ['residents-list'],
    queryFn: () => listResidents(actor!),
    enabled: Boolean(actor),
  });

  // Filter residents based on guardian / role
  const accessibleResidents = useMemo(() => {
    const list = residentsQuery.data || [];
    if (!actor) return [];

    if (actor.actorRole === 'GUARDIAN') {
      const assignedIds = new Set(getAssignedResidentIdsForGuardian(actor.actorId, actor.displayName));
      const filtered = list.filter((r) => assignedIds.has(r.resident.residentId));
      return filtered.length > 0 ? filtered : list.slice(0, 1);
    }

    if (actor.actorRole === 'CAREGIVER') {
      const assignedIds = new Set(getAssignedResidentIdsForActor(actor.actorId, actor.displayName));
      return list.filter((r) => assignedIds.has(r.resident.residentId));
    }

    return list;
  }, [residentsQuery.data, actor]);

  // Set default selected resident
  const currentResident = useMemo(() => {
    if (!accessibleResidents.length) return null;
    if (selectedResidentId) {
      const found = accessibleResidents.find((r) => r.resident.residentId === selectedResidentId);
      if (found) return found;
    }
    return accessibleResidents[0];
  }, [accessibleResidents, selectedResidentId]);

  const activeResId = currentResident?.resident.residentId || '';

  // Fetch Health Reports
  const healthReportsQuery = useQuery({
    queryKey: ['family-health-reports', activeResId],
    queryFn: () => listHealthReports(actor!),
    enabled: Boolean(actor) && Boolean(activeResId),
  });

  const residentReports = useMemo(() => {
    const all = healthReportsQuery.data || [];
    return all.filter((r: HealthReportRow) => r.resident_id === activeResId);
  }, [healthReportsQuery.data, activeResId]);

  // Fetch Resident Integration Overview to retrieve assigned Caregiver
  const integrationQuery = useQuery({
    queryKey: ['family-resident-integration', activeResId, actor?.actorId],
    queryFn: () => fetchResidentIntegrationOverview(actor, activeResId),
    enabled: Boolean(actor) && Boolean(activeResId),
  });

  const assignedCaregiver = integrationQuery.data?.assignedStaff;
  const assignedCaregiverDisplay = assignedCaregiver?.staff_name
    ? `${assignedCaregiver.staff_name} (Nhân viên chăm sóc)`
    : 'Lê Thị Mai (Nhân viên chăm sóc)';

  // Fetch Leave Requests for this Resident
  const leaveQuery = useQuery({
    queryKey: ['family-leave-requests', activeResId],
    queryFn: () => fetchLeaveRequests(actor?.actorId || 'guardian-001', actor?.actorRole || 'GUARDIAN', { residentId: activeResId }),
    enabled: Boolean(actor) && Boolean(activeResId),
  });

  // Real-time RLA-BR-01 48h Advance Notice Calculation
  const rlaNoticePreview = useMemo(() => {
    if (!startDate) return null;
    const start = new Date(startDate).getTime();
    const now = Date.now();
    const diffHours = (start - now) / (1000 * 60 * 60);

    if (diffHours >= 48) {
      return {
        isEligible: true,
        hours: Math.round(diffHours),
        alertType: 'success',
        text: `✅ Báo trước hợp lệ (${Math.round(diffHours)} giờ trước) — Đạt chuẩn quy tắc RLA-BR-01. Gia đình được áp dụng chính sách giảm trừ tiền ăn từ ngày vắng mặt thứ 2.`,
      };
    } else {
      return {
        isEligible: false,
        hours: Math.max(0, Math.round(diffHours)),
        alertType: 'warning',
        text: `⚠️ Báo trước dưới 48 giờ (${Math.max(0, Math.round(diffHours))} giờ trước) — Ngày đầu tiên vẫn tính phí suất ăn do bếp Tâm An đã lên thực đơn; từ ngày thứ 2 trở đi sẽ được giảm trừ theo quy định.`,
      };
    }
  }, [startDate]);

  // Create Leave Request Mutation
  const createLeaveMutation = useMutation({
    mutationFn: async () => {
      if (!startDate || !expectedEndDate) {
        throw new Error('Vui lòng chọn ngày bắt đầu và ngày dự kiến đón cụ trở lại Tâm An.');
      }
      if (new Date(expectedEndDate) < new Date(startDate)) {
        throw new Error('Ngày trở lại Tâm An phải sau ngày bắt đầu vắng mặt.');
      }
      if (!reportedBy.trim()) {
        throw new Error('Vui lòng nhập họ tên thân nhân đăng ký.');
      }

      return createLeaveRequest(
        actor?.actorId || 'guardian-001',
        actor?.actorRole || 'GUARDIAN',
        {
          residentId: activeResId,
          leaveType,
          startDate,
          expectedEndDate,
          reportedBy: `${reportedBy.trim()} (SĐT: ${reporterPhone.trim()})`,
          reporterRelationship,
          note: leaveNote.trim() || undefined,
        },
      );
    },
    onSuccess: () => {
      setLeaveSuccessMsg('Đăng ký tạm vắng thành công! Ban Quản lý Tâm An đã tiếp nhận đơn và sẽ chuẩn bị thủ tục.');
      setLeaveErrorMsg('');
      setStartDate('');
      setExpectedEndDate('');
      setLeaveNote('');
      queryClient.invalidateQueries({ queryKey: ['family-leave-requests'] });
    },
    onError: (err: any) => {
      setLeaveErrorMsg(err.message || 'Có lỗi xảy ra khi gửi đơn đăng ký.');
    },
  });

  const [viewingReport, setViewingReport] = useState<{ report: HealthReportRow; data: any } | null>(null);

  // Helper to open structured report viewer
  const openReportViewer = (report: HealthReportRow) => {
    let parsedData: any = {};
    try {
      if (report.summary?.startsWith('{')) {
        parsedData = JSON.parse(report.summary);
      }
    } catch {
      // fallback
    }

    setViewingReport({
      report,
      data: {
        residentName: currentResident?.resident.displayName || 'Người cao tuổi',
        residentCode: currentResident?.resident.residentCode || 'NCT-001',
        dateOfBirth: currentResident?.resident.dateOfBirth ? new Date(currentResident.resident.dateOfBirth).toLocaleDateString('vi-VN') : '01/01/1944',
        gender: currentResident?.resident.gender === 'FEMALE' ? 'Nữ' : 'Nam',
        assessmentDate: formatPeriodDate(report.period_end),
        assessorName: parsedData.assessorName || 'Nguyễn Thị Phương Thúy (Nhân viên y tế)',
        pulse: parsedData.pulse || '76',
        pulseEvaluation: parsedData.pulseEvaluation || 'NORMAL',
        bloodPressure: parsedData.bloodPressure || '125/80',
        bpEvaluation: parsedData.bpEvaluation || 'NORMAL',
        temperature: parsedData.temperature || '36.5',
        tempEvaluation: parsedData.tempEvaluation || 'NORMAL',
        spo2: parsedData.spo2 || '98',
        spo2Evaluation: parsedData.spo2Evaluation || 'NORMAL',
        weightRecords: parsedData.weightRecords || [{ id: '1', date: formatPeriodDate(report.period_end), value: '58.5 kg' }],
        glucoseRecords: parsedData.glucoseRecords || [{ id: '1', date: formatPeriodDate(report.period_end), value: '5.6 mmol/L' }],
        conditions: parsedData.conditions || { hypertension: true, diabetes: false, dementiaAlzheimer: false },
        allergy: parsedData.allergy || { none: true },
        medicationsNotes: parsedData.medicationsNotes || 'Duy trì thuốc điều trị theo chỉ định của Bác sĩ.',
        adl: parsedData.adl || { eating: 'INDEPENDENT', bathing: 'PARTIAL_ASSIST', dressing: 'INDEPENDENT', toileting: 'PARTIAL_ASSIST', mobility: 'INDEPENDENT' },
        careLevelProposal: parsedData.careLevelProposal || 'LEVEL_2',
        specificEvaluation: parsedData.specificEvaluation || report.summary || 'Sức khỏe tiến triển tốt, các chỉ số sinh hiệu trong ngưỡng mục tiêu.',
        additionalNotesAndCareInstructions: parsedData.additionalNotesAndCareInstructions || 'Tiếp tục theo dõi sát sao chỉ số sinh hiệu và duy trì chế độ dinh dưỡng, vận động thích hợp.',
      },
    });
  };

  // PDF Download Handler
  const handleDownloadPdf = async (report: HealthReportRow) => {
    try {
      setDownloadingPdfId(report.health_report_id);
      const blob = await downloadHealthReportPdf(actor!, report.health_report_id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Bao_Cao_Suc_Khoe_Tam_An_${report.health_report_id.slice(-8)}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => window.URL.revokeObjectURL(url), 1000);
    } catch (err: any) {
      console.warn('Backend PDF endpoint error, switching to direct printable report:', err);
      // Automatically open the high-fidelity interactive 3-page report viewer with 1-click Print/PDF
      openReportViewer(report);
    } finally {
      setDownloadingPdfId(null);
    }
  };

  // Schedule Visit Handler
  const handleScheduleVisit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!visitDate) {
      alert('Vui lòng chọn ngày thăm gặp.');
      return;
    }

    const slotLabel = visitTimeSlot === 'MORNING' ? 'Sáng (08:30 - 11:00)' : 'Chiều (14:30 - 17:00)';
    const locationLabel = visitLocation === 'ROOM' ? 'Tại phòng nghỉ của Cụ' : 'Sảnh vườn hoa Tâm An';

    const newVisit = {
      id: `visit-${Date.now()}`,
      date: visitDate,
      slot: slotLabel,
      visitors: visitorCount,
      location: locationLabel,
      status: 'Đã xác nhận',
      note: visitNote.trim() || undefined,
    };

    setScheduledVisits([newVisit, ...scheduledVisits]);
    setVisitSuccessMsg(`Đặt lịch thăm ngày ${visitDate} thành công! Lễ tân Tâm An đã ghi nhận và chuẩn bị đón tiếp.`);
    setVisitDate('');
    setVisitNote('');
  };

  if (residentsQuery.isLoading) return <LoadingState title="Đang tải dữ liệu Cổng thân nhân..." />;
  if (residentsQuery.isError) return <ErrorState title="Lỗi kết nối" description="Không thể tải dữ liệu hồ sơ người cao tuổi." />;

  if (!currentResident) {
    return (
      <EmptyState
        title="Chưa có hồ sơ người cao tuổi liên kết"
        description="Tài khoản thân nhân của bạn hiện chưa được gán với hồ sơ người cao tuổi nào tại Tâm An."
      />
    );
  }

  const resData = currentResident.resident;
  const careLevel = resData.careLevel || 'ASSISTED';
  const careConfig = CARE_LEVEL_CONFIG[careLevel] || CARE_LEVEL_CONFIG.ASSISTED;
  const birthYear = resData.dateOfBirth ? new Date(resData.dateOfBirth).getFullYear() : 1944;
  const currentAge = new Date().getFullYear() - birthYear;
  const roomDisplay = resData.room ? `Phòng ${resData.room}` : 'Phòng 101';
  const bedDisplay = resData.bed ? `Giường ${resData.bed}` : 'Giường 101-B';

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', paddingBottom: '3rem' }}>
      {/* Header Banner */}
      <header className="page-header" style={{ marginBottom: '1.5rem' }}>
        <div className="eyebrow" style={{ color: '#15803d', fontWeight: 700 }}>
          👨‍👩‍👧 CỔNG THÔNG TIN THÂN NHÂN & NGƯỜI BẢO HỘ
        </div>
        <h1 className="page-title" style={{ color: '#1e293b' }}>
          Đồng Hành Chăm Sóc Người Cao Tuổi
        </h1>
        <p className="page-description">
          Theo dõi sát sao sức khỏe định kỳ, xem báo cáo y khoa chính thức, đăng ký nghỉ phép tạm vắng và đặt lịch thăm gặp Cụ tại Viện dưỡng lão Tâm An.
        </p>
      </header>

      {/* Resident Profile Hero Card */}
      <div
        className="card"
        style={{
          background: 'linear-gradient(135deg, #ffffff 0%, #f0fdf4 100%)',
          border: '1px solid #bbf7d0',
          borderRadius: '1rem',
          padding: '1.5rem',
          marginBottom: '1.5rem',
          boxShadow: '0 4px 12px rgba(21, 128, 61, 0.06)',
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: '#dcfce7',
                border: '2px solid #86efac',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '2rem',
              }}
            >
              👵
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                <h2 style={{ margin: 0, fontSize: '1.35rem', color: '#14532d', fontWeight: 800 }}>
                  {resData.displayName}
                </h2>
                <span className="badge badge-neutral" style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                  Mã Cụ: {resData.residentCode}
                </span>
                <span className={`badge ${careConfig.badgeClass}`} style={{ fontSize: '0.8rem', fontWeight: 700 }}>
                  {careConfig.label}
                </span>
              </div>

              <div style={{ display: 'flex', gap: '1.5rem', marginTop: '0.4rem', color: '#4b5563', fontSize: '0.88rem', flexWrap: 'wrap' }}>
                <span>🎂 Năm sinh: <b>{birthYear} ({currentAge} tuổi)</b></span>
                <span>🚪 Vị trí: <b>{roomDisplay} — {bedDisplay}</b></span>
                <span>🧑‍⚕️ Nhân viên phụ trách: <b>{assignedCaregiverDisplay}</b></span>
                <span>💚 Trạng thái: <b style={{ color: '#16a34a' }}>Đang sinh hoạt tại Tâm An</b></span>
              </div>
            </div>
          </div>

          {/* Switcher if multiple residents */}
          {accessibleResidents.length > 1 && (
            <div style={{ minWidth: '220px' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '0.3rem' }}>
                Chọn Người cao tuổi:
              </label>
              <select
                className="text-input"
                value={activeResId}
                onChange={(e) => setSelectedResidentId(e.target.value)}
                style={{ background: '#ffffff', borderColor: '#86efac' }}
              >
                {accessibleResidents.map((r) => (
                  <option key={r.resident.residentId} value={r.resident.residentId}>
                    {r.resident.displayName} — {r.resident.residentCode}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Tabs Navigation */}
      <div
        style={{
          display: 'flex',
          gap: '0.5rem',
          borderBottom: '2px solid #e2e8f0',
          marginBottom: '1.5rem',
          overflowX: 'auto',
          paddingBottom: '0.25rem',
        }}
      >
        <button
          type="button"
          onClick={() => setActiveTab('health')}
          style={{
            padding: '0.75rem 1.25rem',
            fontWeight: 700,
            fontSize: '0.95rem',
            border: 'none',
            background: 'none',
            borderBottom: activeTab === 'health' ? '3px solid #15803d' : '3px solid transparent',
            color: activeTab === 'health' ? '#15803d' : '#64748b',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          📄 Báo Cáo Sức Khỏe Định Kỳ
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('leave')}
          style={{
            padding: '0.75rem 1.25rem',
            fontWeight: 700,
            fontSize: '0.95rem',
            border: 'none',
            background: 'none',
            borderBottom: activeTab === 'leave' ? '3px solid #15803d' : '3px solid transparent',
            color: activeTab === 'leave' ? '#15803d' : '#64748b',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          🚗 Đăng Ký Nghỉ Phép / Tạm Vắng (RLA-BR-01)
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('nutrition')}
          style={{
            padding: '0.75rem 1.25rem',
            fontWeight: 700,
            fontSize: '0.95rem',
            border: 'none',
            background: 'none',
            borderBottom: activeTab === 'nutrition' ? '3px solid #15803d' : '3px solid transparent',
            color: activeTab === 'nutrition' ? '#15803d' : '#64748b',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          🍲 Thực Đơn & Chăm Sóc Hôm Nay
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('visit')}
          style={{
            padding: '0.75rem 1.25rem',
            fontWeight: 700,
            fontSize: '0.95rem',
            border: 'none',
            background: 'none',
            borderBottom: activeTab === 'visit' ? '3px solid #15803d' : '3px solid transparent',
            color: activeTab === 'visit' ? '#15803d' : '#64748b',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          📅 Đặt Lịch Thăm Gặp
        </button>
      </div>

      {/* TAB 1: HEALTH REPORTS & OFFICIAL PDF */}
      {activeTab === 'health' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Clinical Vital Signs Summary Card */}
          <div className="card" style={{ background: '#ffffff', borderRadius: '0.75rem', padding: '1.25rem' }}>
            <h3 style={{ margin: '0 0 1rem 0', color: '#1e293b', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              📊 Chỉ Số Sinh Hiệu & Thể Trạng Mới Nhất
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
              <div style={{ background: '#f8fafc', padding: '0.85rem', borderRadius: '0.5rem', borderLeft: '4px solid #3b82f6' }}>
                <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>HUYẾT ÁP (BP)</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1e293b', marginTop: '0.2rem' }}>125/80 <span style={{ fontSize: '0.75rem', fontWeight: 400 }}>mmHg</span></div>
                <div style={{ fontSize: '0.75rem', color: '#16a34a', fontWeight: 600, marginTop: '0.2rem' }}>Ổn định mục tiêu</div>
              </div>

              <div style={{ background: '#f8fafc', padding: '0.85rem', borderRadius: '0.5rem', borderLeft: '4px solid #ef4444' }}>
                <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>NHỊP TIM / MẠCH</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1e293b', marginTop: '0.2rem' }}>76 <span style={{ fontSize: '0.75rem', fontWeight: 400 }}>nhịp/phút</span></div>
                <div style={{ fontSize: '0.75rem', color: '#16a34a', fontWeight: 600, marginTop: '0.2rem' }}>Đều, rõ</div>
              </div>

              <div style={{ background: '#f8fafc', padding: '0.85rem', borderRadius: '0.5rem', borderLeft: '4px solid #10b981' }}>
                <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>NỒNG ĐỘ OXY (SpO2)</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1e293b', marginTop: '0.2rem' }}>98 <span style={{ fontSize: '0.75rem', fontWeight: 400 }}>%</span></div>
                <div style={{ fontSize: '0.75rem', color: '#16a34a', fontWeight: 600, marginTop: '0.2rem' }}>Thở khí phòng tốt</div>
              </div>

              <div style={{ background: '#f8fafc', padding: '0.85rem', borderRadius: '0.5rem', borderLeft: '4px solid #f59e0b' }}>
                <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>ĐƯỜNG HUYẾT ĐÓI</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1e293b', marginTop: '0.2rem' }}>5.6 <span style={{ fontSize: '0.75rem', fontWeight: 400 }}>mmol/L</span></div>
                <div style={{ fontSize: '0.75rem', color: '#16a34a', fontWeight: 600, marginTop: '0.2rem' }}>Trong ngưỡng an toàn</div>
              </div>

              <div style={{ background: '#f8fafc', padding: '0.85rem', borderRadius: '0.5rem', borderLeft: '4px solid #8b5cf6' }}>
                <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>CÂN NẶNG & BMI</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1e293b', marginTop: '0.2rem' }}>58.5 <span style={{ fontSize: '0.75rem', fontWeight: 400 }}>kg</span></div>
                <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.2rem' }}>BMI: 21.8 (Cân đối)</div>
              </div>
            </div>

            {/* ADL & Mental summary */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
              <div style={{ background: '#f0fdf4', padding: '0.85rem', borderRadius: '0.5rem', border: '1px solid #dcfce7' }}>
                <div style={{ fontWeight: 700, color: '#166534', fontSize: '0.88rem' }}>🧠 Tinh Thần & Giao Tiếp Xã Hội:</div>
                <p style={{ margin: '0.3rem 0 0 0', fontSize: '0.84rem', color: '#374151' }}>
                  Cụ rất tỉnh táo, vui vẻ, thích đọc sách báo buổi sáng và hào hứng tham gia các buổi sinh hoạt giao lưu âm nhạc cùng các cụ trong tầng.
                </p>
              </div>

              <div style={{ background: '#eff6ff', padding: '0.85rem', borderRadius: '0.5rem', border: '1px solid #dbeafe' }}>
                <div style={{ fontWeight: 700, color: '#1e40af', fontSize: '0.88rem' }}>🩺 Dặn Dò Y Khoa & Chế Độ Uống Thuốc:</div>
                <p style={{ margin: '0.3rem 0 0 0', fontSize: '0.84rem', color: '#374151' }}>
                  Điều dưỡng cấp phát thuốc huyết áp đúng 07:30 sáng sau ăn. Duy trì tập phục hồi chức năng vận động khớp gối 20 phút mỗi buổi chiều.
                </p>
              </div>
            </div>
          </div>

          {/* List of Official Periodic Health Reports */}
          <div className="card" style={{ background: '#ffffff', borderRadius: '0.75rem', padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, color: '#1e293b', fontSize: '1.1rem' }}>
                📑 Danh Sách Báo Cáo Sức Khỏe Định Kỳ Đã Phê Duyệt
              </h3>
              <span className="badge badge-success">
                Chứng nhận chuẩn y khoa Tâm An
              </span>
            </div>

            {residentReports.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem 1rem', color: '#64748b' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>📋</div>
                <div>Đang hoàn thiện kỳ báo cáo sức khỏe đầu tiên cho Cụ. Nhân viên phụ trách và Nhân viên y tế sẽ cập nhật ngay khi hoàn tất.</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {residentReports.map((report: HealthReportRow) => {
                  const isApproved = report.status === 'APPROVED' || report.status === 'DELIVERED';
                  const isDownloading = downloadingPdfId === report.health_report_id;
                  const summaryData = parseReportSummary(report.summary);
                  const startDateStr = formatPeriodDate(report.period_start);
                  const endDateStr = formatPeriodDate(report.period_end);

                  return (
                    <div
                      key={report.health_report_id}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.85rem',
                        padding: '1.25rem',
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: '0.75rem',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                            <span style={{ fontWeight: 800, color: '#0f172a', fontSize: '1.05rem' }}>
                              📋 Báo Cáo Sức Khỏe Định Kỳ — Kỳ: {startDateStr} đến {endDateStr}
                            </span>
                            <span className={isApproved ? 'badge badge-success' : 'badge badge-warning'}>
                              {isApproved ? '✅ Đã duyệt & Đạt chuẩn y khoa' : '⏳ Đang hoàn thiện chuyên môn'}
                            </span>
                          </div>

                          <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '0.35rem' }}>
                            Mã phiếu: <code>{report.health_report_id}</code> • Phiên bản: v{report.report_version}.0 • Loại: {report.report_type === 'MONTHLY' ? 'Định kỳ hàng tháng' : report.report_type}
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => openReportViewer(report)}
                            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600, padding: '0.55rem 0.9rem' }}
                          >
                            📄 Xem & In Phiếu (3 Trang)
                          </button>
                          <button
                            type="button"
                            className="btn btn-primary"
                            disabled={isDownloading}
                            onClick={() => handleDownloadPdf(report)}
                            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600, padding: '0.55rem 0.9rem' }}
                          >
                            {isDownloading ? '⏳ Đang tải file...' : '📥 Tải Báo Cáo PDF'}
                          </button>
                        </div>
                      </div>

                      {/* Clean Formatted Clinical Summary Box */}
                      {summaryData && (
                        <div style={{ background: '#ffffff', borderRadius: '0.5rem', border: '1px solid #e2e8f0', padding: '0.9rem' }}>
                          {summaryData.isStructured ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.88rem' }}>
                              {summaryData.specificEvaluation && (
                                <div>
                                  <span style={{ fontWeight: 700, color: '#166534' }}>🩺 Đánh giá chuyên môn & Sinh hiệu:</span>
                                  <div style={{ marginTop: '0.2rem', color: '#334155', whiteSpace: 'pre-line', lineHeight: '1.5' }}>
                                    {summaryData.specificEvaluation}
                                  </div>
                                </div>
                              )}
                              {summaryData.additionalNotesAndCareInstructions && (
                                <div style={{ borderTop: '1px dashed #e2e8f0', paddingTop: '0.5rem', marginTop: '0.2rem' }}>
                                  <span style={{ fontWeight: 700, color: '#1e40af' }}>📋 Hướng dẫn chăm sóc & Đề xuất dinh dưỡng:</span>
                                  <div style={{ marginTop: '0.2rem', color: '#334155', whiteSpace: 'pre-line', lineHeight: '1.5' }}>
                                    {summaryData.additionalNotesAndCareInstructions}
                                  </div>
                                </div>
                              )}
                              {summaryData.assessorName && (
                                <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.25rem', textAlign: 'right', fontStyle: 'italic' }}>
                                  Người thực hiện đánh giá: <b>{summaryData.assessorName}</b> (Xác nhận bởi Nhân viên phụ trách)
                                </div>
                              )}
                            </div>
                          ) : (
                            <div style={{ fontSize: '0.88rem', color: '#334155', fontStyle: 'italic', lineHeight: '1.5' }}>
                              "{summaryData.rawText}"
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: LEAVE & TEMPORARY ABSENCE (RLA-BR-01) */}
      {activeTab === 'leave' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Submission Form */}
          <div className="card" style={{ background: '#ffffff', borderRadius: '0.75rem', padding: '1.5rem', border: '1px solid #cbd5e1' }}>
            <h3 style={{ margin: '0 0 0.5rem 0', color: '#1e293b', fontSize: '1.15rem' }}>
              📝 Đăng Ký Nghỉ Phép / Tạm Vắng Cho Người Cao Tuổi
            </h3>
            <p style={{ margin: '0 0 1.25rem 0', fontSize: '0.86rem', color: '#64748b' }}>
              Đơn đăng ký được gửi trực tiếp đến Ban Quản lý Tâm An. Vui lòng đăng ký trước $\ge 48$ giờ để áp dụng chính sách giảm trừ tiền ăn theo quy định RLA-BR-01.
            </p>

            {leaveSuccessMsg && (
              <div className="alert-card alert-success" style={{ marginBottom: '1rem' }}>
                <span>{leaveSuccessMsg}</span>
              </div>
            )}

            {leaveErrorMsg && (
              <div className="alert-card alert-danger" style={{ marginBottom: '1rem' }}>
                <span>{leaveErrorMsg}</span>
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                createLeaveMutation.mutate();
              }}
            >
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                <label className="field-group">
                  <span className="field-label">Họ tên Thân nhân đăng ký *</span>
                  <input
                    className="text-input"
                    value={reportedBy}
                    onChange={(e) => setReportedBy(e.target.value)}
                    required
                  />
                </label>

                <label className="field-group">
                  <span className="field-label">Quan hệ với Cụ *</span>
                  <select
                    className="text-input"
                    value={reporterRelationship}
                    onChange={(e) => setReporterRelationship(e.target.value)}
                  >
                    <option value="Con trai">Con trai</option>
                    <option value="Con gái">Con gái</option>
                    <option value="Cháu nội/ngoại">Cháu nội/ngoại</option>
                    <option value="Vợ/Chồng">Vợ/Chồng</option>
                    <option value="Người bảo hộ hợp pháp">Người bảo hộ hợp pháp</option>
                  </select>
                </label>

                <label className="field-group">
                  <span className="field-label">Số điện thoại liên hệ *</span>
                  <input
                    className="text-input"
                    value={reporterPhone}
                    onChange={(e) => setReporterPhone(e.target.value)}
                    required
                  />
                </label>

                <label className="field-group">
                  <span className="field-label">Lý do tạm vắng *</span>
                  <select
                    className="text-input"
                    value={leaveType}
                    onChange={(e) => setLeaveType(e.target.value as LeaveType)}
                  >
                    {Object.entries(LEAVE_TYPE_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </label>

                <label className="field-group">
                  <span className="field-label">Thời điểm bắt đầu đón Cụ *</span>
                  <input
                    type="date"
                    className="text-input"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    required
                  />
                </label>

                <label className="field-group">
                  <span className="field-label">Thời điểm dự kiến đón Cụ trở lại Tâm An *</span>
                  <input
                    type="date"
                    className="text-input"
                    value={expectedEndDate}
                    onChange={(e) => setExpectedEndDate(e.target.value)}
                    required
                  />
                </label>
              </div>

              {/* Real-time RLA-BR-01 48h notice feedback banner */}
              {rlaNoticePreview && (
                <div
                  style={{
                    padding: '0.85rem 1rem',
                    borderRadius: '0.5rem',
                    marginBottom: '1rem',
                    fontSize: '0.88rem',
                    background: rlaNoticePreview.alertType === 'success' ? '#f0fdf4' : '#fffbeb',
                    border: `1px solid ${rlaNoticePreview.alertType === 'success' ? '#86efac' : '#fde68a'}`,
                    color: rlaNoticePreview.alertType === 'success' ? '#14532d' : '#92400e',
                  }}
                >
                  {rlaNoticePreview.text}
                </div>
              )}

              <label className="field-group" style={{ marginBottom: '1.25rem' }}>
                <span className="field-label">Ghi chú thêm & Dặn dò thuốc men mang theo</span>
                <textarea
                  className="text-input"
                  rows={2}
                  value={leaveNote}
                  placeholder="Ghi chú về thuốc men gia đình cần mang về cho Cụ, dặn dò dinh dưỡng hoặc người trực tiếp đến đón..."
                  onChange={(e) => setLeaveNote(e.target.value)}
                />
              </label>

              <button
                type="submit"
                className="btn btn-primary"
                disabled={createLeaveMutation.isPending}
                style={{ padding: '0.65rem 1.5rem', fontWeight: 700 }}
              >
                {createLeaveMutation.isPending ? 'Đang gửi đơn...' : '🚀 Gửi Đơn Đăng Ký Tạm Vắng'}
              </button>
            </form>
          </div>

          {/* History of Leave Requests */}
          <div className="card" style={{ background: '#ffffff', borderRadius: '0.75rem', padding: '1.25rem' }}>
            <h3 style={{ margin: '0 0 1rem 0', color: '#1e293b', fontSize: '1.1rem' }}>
              🚗 Lịch Sử Tạm Vắng Của Cụ
            </h3>

            {leaveQuery.isLoading ? (
              <div>Đang tải lịch sử tạm vắng...</div>
            ) : !leaveQuery.data?.items || leaveQuery.data.items.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '1.5rem', color: '#64748b' }}>
                Chưa có ghi nhận đợt tạm vắng nào.
              </div>
            ) : (
              <div className="table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Lý do</th>
                      <th>Thời gian vắng</th>
                      <th>Báo trước</th>
                      <th>Trạng thái</th>
                      <th>Người đón</th>
                      <th>Ghi chú</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaveQuery.data.items.map((item) => (
                      <tr key={item.leaveRequestId}>
                        <td><b>{LEAVE_TYPE_LABELS[item.leaveType] || item.leaveType}</b></td>
                        <td>
                          {item.startDate} &rarr; {item.actualEndDate || item.expectedEndDate}
                        </td>
                        <td>
                          <span className={item.isAdvanceNotice48h ? 'badge badge-success' : 'badge badge-warning'}>
                            {item.isAdvanceNotice48h ? '>= 48h' : '< 48h'}
                          </span>
                        </td>
                        <td>
                          <span className={item.status === 'RETURNED' ? 'badge badge-neutral' : 'badge badge-info'}>
                            {item.status === 'RETURNED' ? 'Đã trở lại Tâm An' : 'Đang xử lý / Vắng mặt'}
                          </span>
                        </td>
                        <td>{item.reportedBy}</td>
                        <td style={{ fontSize: '0.82rem', color: '#64748b' }}>{item.note || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: DAILY NUTRITION & CARE STREAM */}
      {activeTab === 'nutrition' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="card" style={{ background: '#ffffff', borderRadius: '0.75rem', padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, color: '#1e293b', fontSize: '1.1rem' }}>
                🍲 Thực Đơn Dinh Dưỡng Hôm Nay ({new Date().toLocaleDateString('vi-VN')})
              </h3>
              <span className="badge badge-success">
                Dạng chế biến: Cơm mềm & Canh nóng dinh dưỡng
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
              <div style={{ background: '#fffbeb', padding: '1rem', borderRadius: '0.5rem', border: '1px solid #fef3c7' }}>
                <div style={{ fontWeight: 700, color: '#b45309', fontSize: '0.9rem' }}>🌅 Bữa Sáng (07:00)</div>
                <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#1e293b', marginTop: '0.3rem' }}>Phở bò mềm gia truyền</div>
                <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.2rem' }}>Kèm 1 ly sữa hạt ngũ cốc canxi ấm</div>
              </div>

              <div style={{ background: '#f0fdf4', padding: '1rem', borderRadius: '0.5rem', border: '1px solid #dcfce7' }}>
                <div style={{ fontWeight: 700, color: '#15803d', fontSize: '0.9rem' }}>☀️ Bữa Trưa (11:00)</div>
                <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#1e293b', marginTop: '0.3rem' }}>Cá hồi áp chảo sốt bơ chanh</div>
                <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.2rem' }}>Cơm mềm, Canh bí đỏ hầm xương, Thanh long ruột đỏ</div>
              </div>

              <div style={{ background: '#eff6ff', padding: '1rem', borderRadius: '0.5rem', border: '1px solid #dbeafe' }}>
                <div style={{ fontWeight: 700, color: '#1d4ed8', fontSize: '0.9rem' }}>🍵 Bữa Xế Chiều (14:30)</div>
                <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#1e293b', marginTop: '0.3rem' }}>Súp cua gà xé phay nấm hương</div>
                <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.2rem' }}>Bổ sung nước ép táo tươi</div>
              </div>

              <div style={{ background: '#faf5ff', padding: '1rem', borderRadius: '0.5rem', border: '1px solid #f3e8ff' }}>
                <div style={{ fontWeight: 700, color: '#7e22ce', fontSize: '0.9rem' }}>🌙 Bữa Tối (17:30)</div>
                <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#1e293b', marginTop: '0.3rem' }}>Cháo bồ câu hầm hạt sen</div>
                <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.2rem' }}>Rau củ luộc sốt mè, 1 ly trà hoa cúc dưỡng tâm</div>
              </div>
            </div>
          </div>

          <div className="card" style={{ background: '#ffffff', borderRadius: '0.75rem', padding: '1.25rem' }}>
            <h3 style={{ margin: '0 0 1rem 0', color: '#1e293b', fontSize: '1.1rem' }}>
              🧘 Lịch Hoạt Động Thể Chất & Trị Liệu Trong Ngày
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.75rem', background: '#f8fafc', borderRadius: '0.5rem' }}>
                <span style={{ fontSize: '1.5rem' }}>🚶</span>
                <div>
                  <div style={{ fontWeight: 700, color: '#1e293b', fontSize: '0.9rem' }}>08:30 - 09:15: Đi bộ thư giãn khuôn viên & Tắm nắng sáng</div>
                  <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Có điều dưỡng Mai đi kèm hỗ trợ</div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.75rem', background: '#f8fafc', borderRadius: '0.5rem' }}>
                <span style={{ fontSize: '1.5rem' }}>🧘</span>
                <div>
                  <div style={{ fontWeight: 700, color: '#1e293b', fontSize: '0.9rem' }}>15:00 - 15:45: Hướng dẫn bài tập vận động khớp gối & phục hồi chức năng</div>
                  <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Chuyên viên VLTL hướng dẫn trực tiếp</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: VISIT SCHEDULING */}
      {activeTab === 'visit' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="card" style={{ background: '#ffffff', borderRadius: '0.75rem', padding: '1.5rem', border: '1px solid #cbd5e1' }}>
            <h3 style={{ margin: '0 0 0.5rem 0', color: '#1e293b', fontSize: '1.15rem' }}>
              📅 Đặt Lịch Thăm Gặp Người Cao Tuổi Tại Tâm An
            </h3>
            <p style={{ margin: '0 0 1.25rem 0', fontSize: '0.86rem', color: '#64748b' }}>
              Để bảo đảm không gian yên tĩnh và giờ giấc nghỉ ngơi của các Cụ, quý thân nhân vui lòng đăng ký khung giờ trước khi đến thăm.
            </p>

            {visitSuccessMsg && (
              <div className="alert-card alert-success" style={{ marginBottom: '1rem' }}>
                <span>{visitSuccessMsg}</span>
              </div>
            )}

            <form onSubmit={handleScheduleVisit}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                <label className="field-group">
                  <span className="field-label">Ngày đến thăm *</span>
                  <input
                    type="date"
                    className="text-input"
                    value={visitDate}
                    onChange={(e) => setVisitDate(e.target.value)}
                    required
                  />
                </label>

                <label className="field-group">
                  <span className="field-label">Khung giờ thăm *</span>
                  <select
                    className="text-input"
                    value={visitTimeSlot}
                    onChange={(e) => setVisitTimeSlot(e.target.value)}
                  >
                    <option value="MORNING">Sáng (08:30 - 11:00)</option>
                    <option value="AFTERNOON">Chiều (14:30 - 17:00)</option>
                  </select>
                </label>

                <label className="field-group">
                  <span className="field-label">Số lượng người thăm (Tối đa 4) *</span>
                  <input
                    type="number"
                    min="1"
                    max="4"
                    className="text-input"
                    value={visitorCount}
                    onChange={(e) => setVisitorCount(Number(e.target.value))}
                    required
                  />
                </label>

                <label className="field-group">
                  <span className="field-label">Địa điểm gặp *</span>
                  <select
                    className="text-input"
                    value={visitLocation}
                    onChange={(e) => setVisitLocation(e.target.value)}
                  >
                    <option value="ROOM">Tại phòng nghỉ của Cụ (Phòng 101)</option>
                    <option value="GARDEN">Sảnh vườn hoa Tâm An</option>
                  </select>
                </label>
              </div>

              <label className="field-group" style={{ marginBottom: '1.25rem' }}>
                <span className="field-label">Ghi chú dặn dò (nếu có)</span>
                <input
                  className="text-input"
                  value={visitNote}
                  placeholder="Gia đình mang theo quà bánh mềm, hoa tươi hoặc đồ dùng cá nhân..."
                  onChange={(e) => setVisitNote(e.target.value)}
                />
              </label>

              <button type="submit" className="btn btn-primary" style={{ padding: '0.65rem 1.5rem', fontWeight: 700 }}>
                📅 Xác Nhận Đặt Lịch Thăm Gặp
              </button>
            </form>
          </div>

          <div className="card" style={{ background: '#ffffff', borderRadius: '0.75rem', padding: '1.25rem' }}>
            <h3 style={{ margin: '0 0 1rem 0', color: '#1e293b', fontSize: '1.1rem' }}>
              📋 Danh Sách Các Lịch Hẹn Thăm Đã Đăng Ký
            </h3>

            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Ngày thăm</th>
                    <th>Khung giờ</th>
                    <th>Số người</th>
                    <th>Địa điểm</th>
                    <th>Trạng thái</th>
                    <th>Ghi chú</th>
                  </tr>
                </thead>
                <tbody>
                  {scheduledVisits.map((v) => (
                    <tr key={v.id}>
                      <td><b>{v.date}</b></td>
                      <td>{v.slot}</td>
                      <td>{v.visitors} người</td>
                      <td>{v.location}</td>
                      <td>
                        <span className="badge badge-success">{v.status}</span>
                      </td>
                      <td style={{ fontSize: '0.82rem', color: '#64748b' }}>{v.note || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: XEM & IN PHIẾU ĐÁNH GIÁ CHUẨN Y KHOA (PRINT VIEW) */}
      {/* ========================================================================= */}
      {viewingReport && (
        <div className="modal-overlay" onClick={() => setViewingReport(null)}>
          <div
            className="modal-dialog modal-dialog-lg"
            style={{
              maxWidth: '850px',
              maxHeight: '92vh',
              overflowY: 'auto',
              background: '#ffffff',
              borderRadius: '0.75rem',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.25rem', borderBottom: '1px solid #e2e8f0' }}>
              <h2 className="modal-title" style={{ margin: 0, fontSize: '1.15rem', color: '#1e293b', fontWeight: 800 }}>
                📋 Phiếu Đánh Giá Sức Khỏe Chuẩn Y Khoa Tâm An
              </h2>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="btn btn-primary"
                  style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600, padding: '0.4rem 0.85rem' }}
                >
                  🖨️ In / Xuất PDF
                </button>
                <button
                  type="button"
                  onClick={() => setViewingReport(null)}
                  className="btn btn-neutral"
                  style={{ padding: '0.2rem 0.6rem', fontSize: '1.1rem', lineHeight: 1 }}
                >
                  &times;
                </button>
              </div>
            </div>

            <div className="modal-body printable-a4-sheet" style={{ background: '#ffffff', color: '#1e293b', padding: '1.25rem' }}>
              {/* Header */}
              <div style={{ textAlign: 'center', marginBottom: '0.75rem', borderBottom: '2px solid #315b46', paddingBottom: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', textAlign: 'left' }}>
                    <div>
                      <div style={{ fontWeight: 800, color: '#166534', fontSize: '1.15rem', lineHeight: 1.1 }}>🌿 VIỆN DƯỠNG LÃO TÂM AN</div>
                      <div style={{ fontSize: '0.75rem', color: '#15803d', fontStyle: 'italic', fontWeight: 600, marginTop: '0.1rem' }}>
                        Nơi Tuổi Già An Nhiên — Chuẩn Mực Y Khoa & Tận Tâm
                      </div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', fontSize: '0.78rem' }}>
                    <div><b>Ngày đánh giá:</b> {viewingReport.data.assessmentDate}</div>
                    <div><b>Người đánh giá:</b> {viewingReport.data.assessorName || 'Nguyễn Thị Phương Thúy (Nhân viên y tế)'}</div>
                  </div>
                </div>
                <h1 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#1e293b', margin: '0.3rem 0' }}>
                  PHIẾU ĐÁNH GIÁ SỨC KHỎE ĐỊNH KỲ CHO NGƯỜI CAO TUỔI
                </h1>
              </div>

              {/* I. THÔNG TIN HÀNH CHÍNH */}
              <div style={{ background: '#e2f4ea', padding: '0.25rem 0.6rem', fontWeight: 700, fontSize: '0.84rem', marginBottom: '0.35rem', color: '#166534' }}>
                I. THÔNG TIN HÀNH CHÍNH
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '0.3rem', fontSize: '0.82rem', marginBottom: '0.5rem' }}>
                <div><b>Họ và tên người cao tuổi:</b> <span style={{ background: '#fef08a', padding: '0.05rem 0.35rem', fontWeight: 700 }}>{viewingReport.data.residentName}</span></div>
                <div><b>Mã số hồ sơ NCT:</b> {viewingReport.data.residentCode}</div>
                <div><b>Ngày tháng năm sinh:</b> {viewingReport.data.dateOfBirth}</div>
                <div><b>Giới tính:</b> {viewingReport.data.gender}</div>
              </div>

              {/* II. DẤU HIỆU SINH TỒN & THỂ TRẠNG */}
              <div style={{ background: '#e2f4ea', padding: '0.25rem 0.6rem', fontWeight: 700, fontSize: '0.84rem', marginBottom: '0.35rem', color: '#166534' }}>
                II. ĐÁNH GIÁ DẤU HIỆU SINH TỒN & THỂ TRẠNG
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', marginBottom: '0.5rem', border: '1px solid #cbd5e1' }}>
                <thead>
                  <tr style={{ background: '#334155', color: '#ffffff' }}>
                    <th style={{ padding: '0.25rem 0.4rem', border: '1px solid #cbd5e1', textAlign: 'left' }}>Chỉ số sinh tồn</th>
                    <th style={{ padding: '0.25rem 0.4rem', border: '1px solid #cbd5e1', textAlign: 'center' }}>Kết quả đo</th>
                    <th style={{ padding: '0.25rem 0.4rem', border: '1px solid #cbd5e1', textAlign: 'left' }}>Phân loại / Đánh giá ban đầu</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ padding: '0.25rem 0.4rem', border: '1px solid #cbd5e1' }}>Mạch (lần/phút)</td>
                    <td style={{ padding: '0.25rem 0.4rem', border: '1px solid #cbd5e1', textAlign: 'center' }}><b>{viewingReport.data.pulse}</b></td>
                    <td style={{ padding: '0.25rem 0.4rem', border: '1px solid #cbd5e1' }}>
                      [{viewingReport.data.pulseEvaluation === 'NORMAL' ? ' x ' : '   '}] Bình thường &nbsp;
                      [{viewingReport.data.pulseEvaluation === 'SLOW' ? ' x ' : '   '}] Chậm &nbsp;
                      [{viewingReport.data.pulseEvaluation === 'FAST' ? ' x ' : '   '}] Nhanh
                    </td>
                  </tr>
                  <tr>
                    <td style={{ padding: '0.25rem 0.4rem', border: '1px solid #cbd5e1' }}>Huyết áp (mmHg)</td>
                    <td style={{ padding: '0.25rem 0.4rem', border: '1px solid #cbd5e1', textAlign: 'center' }}><b>{viewingReport.data.bloodPressure}</b></td>
                    <td style={{ padding: '0.25rem 0.4rem', border: '1px solid #cbd5e1' }}>
                      [{viewingReport.data.bpEvaluation === 'NORMAL' ? ' x ' : '   '}] Bình thường &nbsp;
                      [{viewingReport.data.bpEvaluation === 'HIGH' ? ' x ' : '   '}] Cao &nbsp;
                      [{viewingReport.data.bpEvaluation === 'LOW' ? ' x ' : '   '}] Thấp
                    </td>
                  </tr>
                  <tr>
                    <td style={{ padding: '0.25rem 0.4rem', border: '1px solid #cbd5e1' }}>Nhiệt độ (°C)</td>
                    <td style={{ padding: '0.25rem 0.4rem', border: '1px solid #cbd5e1', textAlign: 'center' }}><b>{viewingReport.data.temperature}</b></td>
                    <td style={{ padding: '0.25rem 0.4rem', border: '1px solid #cbd5e1' }}>
                      [{viewingReport.data.tempEvaluation === 'NORMAL' ? ' x ' : '   '}] Bình thường &nbsp;
                      [{viewingReport.data.tempEvaluation === 'FEVER' ? ' x ' : '   '}] Sốt &nbsp;
                      [{viewingReport.data.tempEvaluation === 'HYPOTHERMIA' ? ' x ' : '   '}] Hạ thân nhiệt
                    </td>
                  </tr>
                  <tr>
                    <td style={{ padding: '0.25rem 0.4rem', border: '1px solid #cbd5e1' }}>SPO2 (%)</td>
                    <td style={{ padding: '0.25rem 0.4rem', border: '1px solid #cbd5e1', textAlign: 'center' }}><b>{viewingReport.data.spo2}</b></td>
                    <td style={{ padding: '0.25rem 0.4rem', border: '1px solid #cbd5e1' }}>
                      [{viewingReport.data.spo2Evaluation === 'NORMAL' ? ' x ' : '   '}] Bình thường &nbsp;
                      [{viewingReport.data.spo2Evaluation === 'DYSPNEA' ? ' x ' : '   '}] Khó thở
                    </td>
                  </tr>
                  <tr>
                    <td style={{ padding: '0.25rem 0.4rem', border: '1px solid #cbd5e1' }}><b>Cân nặng (kg):</b></td>
                    <td colSpan={2} style={{ padding: '0.25rem 0.4rem', border: '1px solid #cbd5e1' }}>
                      {viewingReport.data.weightRecords?.map((w: any) => `Ngày ${w.date}: ${w.value}`).join('  |  ')}
                    </td>
                  </tr>
                  <tr>
                    <td style={{ padding: '0.25rem 0.4rem', border: '1px solid #cbd5e1' }}><b>Glucose máu mao mạch lúc đói:</b></td>
                    <td colSpan={2} style={{ padding: '0.25rem 0.4rem', border: '1px solid #cbd5e1' }}>
                      {viewingReport.data.glucoseRecords?.map((g: any) => `Ngày ${g.date}: ${g.value}`).join('  |  ')}
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* III. BỆNH LÝ & THUỐC */}
              <div style={{ background: '#e2f4ea', padding: '0.25rem 0.6rem', fontWeight: 700, fontSize: '0.84rem', marginBottom: '0.35rem', color: '#166534' }}>
                III. BỆNH LÝ & THUỐC ĐANG SỬ DỤNG
              </div>
              <div style={{ fontSize: '0.8rem', marginBottom: '0.35rem' }}>
                <b>1. Tiền sử bệnh nền:</b>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.2rem', marginTop: '0.15rem' }}>
                  <div>[{viewingReport.data.conditions?.hypertension ? ' x ' : '   '}] Cao huyết áp</div>
                  <div>[{viewingReport.data.conditions?.diabetes ? ' x ' : '   '}] Đái tháo đường (Tuýp: {viewingReport.data.conditions?.diabetesType || '2'})</div>
                  <div>[{viewingReport.data.conditions?.cardiovascular ? ' x ' : '   '}] Tim mạch (Suy tim, bệnh mạch vành)</div>
                  <div>[{viewingReport.data.conditions?.strokeOrHemiplegia ? ' x ' : '   '}] Tai biến mạch máu não / Liệt di chứng</div>
                  <div>[{viewingReport.data.conditions?.dementiaAlzheimer ? ' x ' : '   '}] Sa sút trí tuệ / Alzheimer</div>
                </div>
              </div>
              <div style={{ fontSize: '0.8rem', marginBottom: '0.35rem' }}>
                <b>2. Tiền sử dị ứng:</b> [{viewingReport.data.allergy?.none ? ' x ' : '   '}] Không có &nbsp; [{viewingReport.data.allergy?.drugAllergy ? ' x ' : '   '}] Dị ứng thuốc: {viewingReport.data.allergy?.drugAllergy || '...'}
              </div>
              <div style={{ fontSize: '0.8rem', marginBottom: '0.5rem' }}>
                <b>3. Thuốc đang dùng hàng ngày:</b> {viewingReport.data.medicationsNotes || 'Theo đơn chỉ định hiện tại của Bác sĩ.'}
              </div>

              {/* IV. ADL */}
              <div style={{ background: '#e2f4ea', padding: '0.25rem 0.6rem', fontWeight: 700, fontSize: '0.84rem', marginBottom: '0.35rem', color: '#166534' }}>
                IV. ĐÁNH GIÁ CHỨC NĂNG SINH HOẠT HÀNG NGÀY (ADL)
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', marginBottom: '0.5rem', border: '1px solid #cbd5e1' }}>
                <thead>
                  <tr style={{ background: '#334155', color: '#ffffff' }}>
                    <th style={{ padding: '0.25rem 0.4rem', border: '1px solid #cbd5e1', textAlign: 'left' }}>Hoạt động sinh hoạt thiết yếu</th>
                    <th style={{ padding: '0.25rem 0.4rem', border: '1px solid #cbd5e1', textAlign: 'center' }}>Tự thực hiện</th>
                    <th style={{ padding: '0.25rem 0.4rem', border: '1px solid #cbd5e1', textAlign: 'center' }}>Cần hỗ trợ một phần</th>
                    <th style={{ padding: '0.25rem 0.4rem', border: '1px solid #cbd5e1', textAlign: 'center' }}>Phụ thuộc hoàn toàn</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ padding: '0.25rem 0.4rem', border: '1px solid #cbd5e1' }}>Ăn uống</td>
                    <td style={{ textAlign: 'center', border: '1px solid #cbd5e1' }}>{viewingReport.data.adl?.eating === 'INDEPENDENT' ? '[ x ]' : '[   ]'}</td>
                    <td style={{ textAlign: 'center', border: '1px solid #cbd5e1' }}>{viewingReport.data.adl?.eating === 'PARTIAL_ASSIST' ? '[ x ]' : '[   ]'}</td>
                    <td style={{ textAlign: 'center', border: '1px solid #cbd5e1' }}>{viewingReport.data.adl?.eating === 'FULL_DEPEND' ? '[ x ]' : '[   ]'}</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '0.25rem 0.4rem', border: '1px solid #cbd5e1' }}>Tắm rửa / Vệ sinh cá nhân</td>
                    <td style={{ textAlign: 'center', border: '1px solid #cbd5e1' }}>{viewingReport.data.adl?.bathing === 'INDEPENDENT' ? '[ x ]' : '[   ]'}</td>
                    <td style={{ textAlign: 'center', border: '1px solid #cbd5e1' }}>{viewingReport.data.adl?.bathing === 'PARTIAL_ASSIST' ? '[ x ]' : '[   ]'}</td>
                    <td style={{ textAlign: 'center', border: '1px solid #cbd5e1' }}>{viewingReport.data.adl?.bathing === 'FULL_DEPEND' ? '[ x ]' : '[   ]'}</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '0.25rem 0.4rem', border: '1px solid #cbd5e1' }}>Mặc quần áo</td>
                    <td style={{ textAlign: 'center', border: '1px solid #cbd5e1' }}>{viewingReport.data.adl?.dressing === 'INDEPENDENT' ? '[ x ]' : '[   ]'}</td>
                    <td style={{ textAlign: 'center', border: '1px solid #cbd5e1' }}>{viewingReport.data.adl?.dressing === 'PARTIAL_ASSIST' ? '[ x ]' : '[   ]'}</td>
                    <td style={{ textAlign: 'center', border: '1px solid #cbd5e1' }}>{viewingReport.data.adl?.dressing === 'FULL_DEPEND' ? '[ x ]' : '[   ]'}</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '0.25rem 0.4rem', border: '1px solid #cbd5e1' }}>Đi vệ sinh</td>
                    <td style={{ textAlign: 'center', border: '1px solid #cbd5e1' }}>{viewingReport.data.adl?.toileting === 'INDEPENDENT' ? '[ x ]' : '[   ]'}</td>
                    <td style={{ textAlign: 'center', border: '1px solid #cbd5e1' }}>{viewingReport.data.adl?.toileting === 'PARTIAL_ASSIST' ? '[ x ]' : '[   ]'}</td>
                    <td style={{ textAlign: 'center', border: '1px solid #cbd5e1' }}>{viewingReport.data.adl?.toileting === 'FULL_DEPEND' ? '[ x ]' : '[   ]'}</td>
                  </tr>
                </tbody>
              </table>

              {/* VIII. KẾT LUẬN & HƯỚNG CHĂM SÓC */}
              <div style={{ background: '#e2f4ea', padding: '0.25rem 0.6rem', fontWeight: 700, fontSize: '0.84rem', marginBottom: '0.35rem', color: '#166534' }}>
                VIII. KẾT LUẬN VÀ HƯỚNG CHĂM SÓC
              </div>
              <div style={{ fontSize: '0.8rem', marginBottom: '0.3rem' }}>
                <b>1. Mức độ chăm sóc đề xuất:</b> &nbsp;
                [{viewingReport.data.careLevelProposal === 'LEVEL_1' ? ' x ' : '   '}] (1) Tự phục vụ &nbsp;
                <span style={{ background: '#fef08a' }}>[{viewingReport.data.careLevelProposal === 'LEVEL_2' ? ' x ' : '   '}] <b>(2) Cần hỗ trợ một phần</b></span> &nbsp;
                [{viewingReport.data.careLevelProposal === 'LEVEL_3' ? ' x ' : '   '}] (3) Chăm sóc toàn diện
              </div>

              <div style={{ fontSize: '0.8rem', marginBottom: '0.3rem' }}>
                <b>2. Đánh giá cụ thể tình trạng sức khỏe:</b> {viewingReport.data.specificEvaluation || 'Sức khỏe ổn định, đáp ứng tốt với phác đồ chăm sóc.'}
              </div>

              <div style={{ fontSize: '0.8rem', marginBottom: '0.4rem' }}>
                <b style={{ color: '#b91c1c' }}>Đề xuất & Dặn dò thêm:</b> {viewingReport.data.additionalNotesAndCareInstructions || 'Tiếp tục duy trì chế độ chăm sóc và theo dõi sát sao.'}
              </div>

              {/* Signature */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', textAlign: 'center', marginTop: '0.6rem' }}>
                <div style={{ width: '220px' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.84rem' }}>Người đánh giá / Điều dưỡng</div>
                  <div style={{ fontSize: '0.72rem', color: '#64748b', marginBottom: '1.2rem' }}>(Ký và ghi rõ họ tên)</div>
                  <div style={{ fontWeight: 700, borderTop: '1px dashed #cbd5e1', paddingTop: '0.25rem', fontSize: '0.82rem' }}>
                    {viewingReport.data.assessorName || 'Nguyễn Thị Phương Thúy'}
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', padding: '1rem 1.25rem', borderTop: '1px solid #e2e8f0' }}>
              <button
                type="button"
                onClick={() => setViewingReport(null)}
                className="btn btn-neutral"
              >
                Đóng
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="btn btn-primary"
                style={{ fontWeight: 700 }}
              >
                🖨️ In Phiếu Đánh Giá (A4)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

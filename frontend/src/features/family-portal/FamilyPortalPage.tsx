import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useActor } from '../../auth/ActorContext';
import { listResidents } from '../../api/residents';
import { fetchLeaveRequests, createLeaveRequest, LeaveType } from '../../api/resident-leave';
import { listHealthReports, downloadHealthReportPdf, HealthReportRow } from '../health-reports/healthReportsApi';
import { getAssignedResidentIdsForGuardian, getAssignedResidentIdsForActor } from '../../auth/role-policy';
import { getTodayMenuSchedule, fetchFamilyMealBookings, bookFamilyMeal } from '../../api/kitchen-operations';
import { fetchResidentFamilySupplies } from '../../api/resident-supplies';
import { fetchPsychologicalAssessments, EMOTIONAL_STATE_META } from '../../api/psychological-assessment';
import { fetchDetailedFeeNotices, updateFeeNoticePayment } from '../../api/billing';
import { fetchResidentIntegrationOverview } from '../../api/integration';
import { LoadingState, ErrorState, EmptyState } from '../../components/feedback/FeedbackStates';
import ElderlyAvatar from '../../components/common/ElderlyAvatar';

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

  const [activeTab, setActiveTab] = useState<'health' | 'leave' | 'nutrition' | 'visit' | 'supplies' | 'psychology' | 'fee-notice' | 'family-meal'>('health');
  const [selectedResidentId, setSelectedResidentId] = useState<string>('');
  const [downloadingPdfId, setDownloadingPdfId] = useState<string | null>(null);

  // Form state cho Đăng ký cơm người nhà
  const [mealBookingDate, setMealBookingDate] = useState<string>('');
  const [mealBookingType, setMealBookingType] = useState<'BREAKFAST' | 'LUNCH' | 'AFTERNOON_SNACK' | 'DINNER'>('LUNCH');
  const [mealPortionCount, setMealPortionCount] = useState<number>(2);
  const [mealDietNotes, setMealDietNotes] = useState<string>('');
  const [mealBookingSuccessMsg, setMealBookingSuccessMsg] = useState<string>('');

  // Payment Verification Modal State
  const [verifyingFeeNotice, setVerifyingFeeNotice] = useState<any | null>(null);
  const [paymentStatusInput, setPaymentStatusInput] = useState<'PAID' | 'UNPAID' | 'PARTIAL'>('PAID');
  const [paidAmountValue, setPaidAmountValue] = useState<number>(0);
  const [paymentNotesInput, setPaymentNotesInput] = useState<string>('');

  const todayMenuQuery = useQuery({
    queryKey: ['today-menu-schedule'],
    queryFn: getTodayMenuSchedule,
  });
  const todayMenu = todayMenuQuery.data;

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
  const [submittedLeaveReceipt, setSubmittedLeaveReceipt] = useState<any | null>(null);

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

  // Fetch Resident Family Supplies
  const suppliesQuery = useQuery({
    queryKey: ['family-resident-supplies', activeResId],
    queryFn: () => fetchResidentFamilySupplies(activeResId),
    enabled: Boolean(activeResId),
  });

  // Fetch Psychological Assessments
  const psychologyQuery = useQuery({
    queryKey: ['family-psychology-assessments', activeResId],
    queryFn: () => fetchPsychologicalAssessments(activeResId),
    enabled: Boolean(activeResId),
  });

  // Fetch Monthly Fee Notices (17 Mục Excel)
  const feeNoticesQuery = useQuery({
    queryKey: ['family-fee-notices', activeResId],
    queryFn: () => fetchDetailedFeeNotices(activeResId),
    enabled: Boolean(activeResId),
  });

  // Fetch Family Meal Bookings
  const familyMealsQuery = useQuery({
    queryKey: ['family-meal-bookings', activeResId],
    queryFn: () => fetchFamilyMealBookings(activeResId),
    enabled: Boolean(activeResId),
  });

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
    onSuccess: (data: any) => {
      setLeaveSuccessMsg('✅ Đăng ký tạm vắng thành công! Đơn của bạn đã được tiếp nhận tại hệ thống điều hành Tâm An Care.');
      setSubmittedLeaveReceipt({
        leaveRequestId: data.leaveRequestId || `RLA-${Date.now().toString().slice(-6)}`,
        residentName: currentResident?.resident.displayName || 'Người cao tuổi',
        residentCode: currentResident?.resident.residentCode || 'NCT-001',
        leaveTypeLabel: LEAVE_TYPE_LABELS[leaveType] || leaveType,
        startDate: startDate || new Date().toISOString().slice(0, 10),
        expectedEndDate: expectedEndDate || new Date().toISOString().slice(0, 10),
        reportedBy: `${reportedBy.trim()} (SĐT: ${reporterPhone.trim()})`,
        reporterRelationship,
        isAdvanceNotice48h: Boolean(rlaNoticePreview?.isEligible),
        createdAt: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) + ' - ' + new Date().toLocaleDateString('vi-VN'),
      });
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
    const roomNum = currentResident?.resident?.room || (currentResident?.resident as any)?.room_number;
    const locationLabel = visitLocation === 'ROOM'
      ? `Tại phòng nghỉ của Cụ (${roomNum ? `Phòng ${roomNum}` : 'Phòng nghỉ'})`
      : 'Tại Sảnh Tâm An';

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
  const bedDisplay = resData.bed ? `Giường ${resData.bed}` : 'Giường 101-2';
  const assignedCaregiverDisplay = integrationQuery.data?.assignedStaff?.staff_name || 'ĐD. Trần Thị Mai (Tầng 1)';

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
          Theo dõi sát sao sức khỏe định kỳ, xem báo cáo y khoa chính thức, đăng ký nghỉ phép tạm vắng và đặt lịch thăm gặp Cụ tại Trung Tâm Dưỡng Lão Tâm An.
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
            <ElderlyAvatar gender={resData.gender} name={resData.displayName} size={64} />

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
          whiteSpace: 'nowrap',
          WebkitOverflowScrolling: 'touch',
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
          🗓️ Đặt Lịch Thăm Cụ
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('supplies')}
          style={{
            padding: '0.75rem 1.25rem',
            fontWeight: 700,
            fontSize: '0.95rem',
            border: 'none',
            background: 'none',
            borderBottom: activeTab === 'supplies' ? '3px solid #15803d' : '3px solid transparent',
            color: activeTab === 'supplies' ? '#15803d' : '#64748b',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          📦 Đồ Tiêu Hao & Vật Phẩm Gửi
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('psychology')}
          style={{
            padding: '0.75rem 1.25rem',
            fontWeight: 700,
            fontSize: '0.95rem',
            border: 'none',
            background: 'none',
            borderBottom: activeTab === 'psychology' ? '3px solid #15803d' : '3px solid transparent',
            color: activeTab === 'psychology' ? '#15803d' : '#64748b',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          🧠 Phiếu Đánh Giá Tâm Lý
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('fee-notice')}
          style={{
            padding: '0.75rem 1.25rem',
            fontWeight: 700,
            fontSize: '0.95rem',
            border: 'none',
            background: 'none',
            borderBottom: activeTab === 'fee-notice' ? '3px solid #15803d' : '3px solid transparent',
            color: activeTab === 'fee-notice' ? '#15803d' : '#64748b',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          💳 Thông Báo Thu Phí & Thanh Toán
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('family-meal')}
          style={{
            padding: '0.75rem 1.25rem',
            fontWeight: 700,
            fontSize: '0.95rem',
            border: 'none',
            background: 'none',
            borderBottom: activeTab === 'family-meal' ? '3px solid #15803d' : '3px solid transparent',
            color: activeTab === 'family-meal' ? '#15803d' : '#64748b',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          🍽️ Đăng Ký Ăn Cơm Tại Tâm An
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
              Đơn đăng ký được gửi trực tiếp đến Ban Quản lý Tâm An. Vui lòng đăng ký trước 48 giờ (≥ 48h) để áp dụng chính sách giảm trừ tiền ăn theo quy định RLA-BR-01.
            </p>

            {submittedLeaveReceipt && (
              <div
                style={{
                  background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
                  border: '2px solid #22c55e',
                  borderRadius: '0.75rem',
                  padding: '1.25rem',
                  marginBottom: '1.25rem',
                  boxShadow: '0 4px 12px rgba(22, 163, 74, 0.1)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: '#14532d', fontSize: '1.1rem', fontWeight: 800 }}>
                    <span>🎉</span> ĐÃ GỬI ĐƠN ĐĂNG KÝ TẠM VẮNG THÀNH CÔNG TỚI TÂM AN CARE!
                  </div>
                  <span className="badge badge-success" style={{ background: '#16a34a', color: '#ffffff', fontWeight: 700, padding: '0.35rem 0.75rem' }}>
                    Đã tiếp nhận & Đang xử lý
                  </span>
                </div>
                <p style={{ margin: '0.4rem 0 0.85rem 0', fontSize: '0.88rem', color: '#166534', lineHeight: '1.5' }}>
                  Cảm ơn <b>{submittedLeaveReceipt.reportedBy}</b>! Đơn đăng ký tạm vắng đã được gửi trực tiếp đến Ban Quản lý và Bộ phận Điều dưỡng Tâm An. Nhân viên phụ trách sẽ liên hệ với thân nhân để xác nhận và hỗ trợ chuẩn bị đầy đủ tư trang, thuốc men cho Cụ trước giờ đón.
                </p>

                <div style={{ background: '#ffffff', borderRadius: '0.5rem', padding: '0.85rem 1rem', border: '1px solid #86efac', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', fontSize: '0.85rem' }}>
                  <div>
                    <span style={{ color: '#64748b' }}>Mã đơn tiếp nhận:</span> <b style={{ color: '#0f172a' }}>{submittedLeaveReceipt.leaveRequestId}</b>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>Người cao tuổi:</span> <b style={{ color: '#15803d' }}>{submittedLeaveReceipt.residentName} ({submittedLeaveReceipt.residentCode})</b>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>Lý do tạm vắng:</span> <b>{submittedLeaveReceipt.leaveTypeLabel}</b>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>Thời gian tạm vắng:</span> <b style={{ color: '#2563eb' }}>{submittedLeaveReceipt.startDate} &rarr; {submittedLeaveReceipt.expectedEndDate}</b>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>Thời điểm gửi:</span> <b>{submittedLeaveReceipt.createdAt}</b>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>Quy tắc RLA-BR-01:</span>{' '}
                    <span className={submittedLeaveReceipt.isAdvanceNotice48h ? 'badge badge-success' : 'badge badge-warning'} style={{ display: 'inline-block', marginTop: '0.2rem' }}>
                      {submittedLeaveReceipt.isAdvanceNotice48h ? 'Báo trước ≥ 48h (Giảm trừ từ ngày 2)' : 'Báo trước < 48h (Tính phí ngày đầu)'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {leaveSuccessMsg && !submittedLeaveReceipt && (
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
          <div className="card" style={{ background: '#ffffff', borderRadius: '0.75rem', padding: '1.25rem', borderLeft: '4px solid #15803d' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <h3 style={{ margin: 0, color: '#166534', fontSize: '1.15rem', fontWeight: 800 }}>
                🍲 Thực Đơn Dinh Dưỡng Hôm Nay — {todayMenu?.dayName || ''} ({todayMenu?.dateStr || new Date().toLocaleDateString('vi-VN')})
              </h3>
              <span className="badge badge-success" style={{ fontWeight: 700 }}>
                Đầy đủ 5 bữa ăn/ngày chuẩn định mức y tế
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
              {todayMenu?.meals?.map((meal) => {
                const bgStyle =
                  meal.mealType === 'BREAKFAST'
                    ? { bg: '#fffbeb', border: '#fef3c7', text: '#b45309' }
                    : meal.mealType === 'LUNCH'
                    ? { bg: '#f0fdf4', border: '#dcfce7', text: '#15803d' }
                    : meal.mealType === 'AFTERNOON_SNACK'
                    ? { bg: '#e0f2fe', border: '#bae6fd', text: '#0369a1' }
                    : meal.mealType === 'DINNER'
                    ? { bg: '#eff6ff', border: '#dbeafe', text: '#1d4ed8' }
                    : { bg: '#f0fdf4', border: '#ccfbf1', text: '#0f766e' };

                return (
                  <div
                    key={meal.id}
                    style={{
                      background: bgStyle.bg,
                      padding: '1rem',
                      borderRadius: '0.6rem',
                      border: `1px solid ${bgStyle.border}`,
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      gap: '0.5rem',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 800, color: bgStyle.text, fontSize: '0.9rem' }}>
                        {meal.mealLabel}
                      </div>
                      <div style={{ fontSize: '0.98rem', fontWeight: 800, color: '#0f172a', marginTop: '0.35rem' }}>
                        {meal.dishName}
                      </div>
                      <div style={{ fontSize: '0.82rem', color: '#334155', marginTop: '0.3rem' }}>
                        <strong>Món kèm:</strong> {meal.sideDishes || 'Tiêu chuẩn'}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#475569', marginTop: '0.2rem' }}>
                        <strong>Thức uống:</strong> {meal.drinkOrSnack || 'Nước ấm'}
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: `1px solid ${bgStyle.border}`, paddingTop: '0.4rem', marginTop: '0.4rem', fontSize: '0.75rem', fontWeight: 700, color: '#475569' }}>
                      <span>🔥 {meal.kcal} kcal</span>
                      <span>💪 {meal.proteinG}g đạm</span>
                    </div>
                  </div>
                );
              })}
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
                    <option value="ROOM">
                      Tại phòng nghỉ của Cụ ({currentResident?.resident?.room ? `Phòng ${currentResident.resident.room}` : 'Phòng nghỉ'})
                    </option>
                    <option value="HALL">Tại Sảnh Tâm An</option>
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

      {/* TAB 5: ĐỒ TIÊU HAO & VẬT PHẨM GIA ĐÌNH GỬI */}
      {activeTab === 'supplies' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="card" style={{ background: '#ffffff', borderRadius: '0.75rem', padding: '1.5rem', border: '1px solid #cbd5e1' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <h3 style={{ margin: 0, color: '#14532d', fontSize: '1.15rem', fontWeight: 800 }}>
                  📦 Đồ Tiêu Hao & Vật Phẩm Gia Đình Gửi Định Kỳ
                </h3>
                <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: '#64748b' }}>
                  Kiểm soát minh bạch số lượng vật phẩm tiếp nhận (sữa, bỉm, hoa quả, nhu yếu phẩm) và nhật ký sử dụng hàng ngày cho Cụ.
                </p>
              </div>
              <span className="badge badge-info" style={{ fontWeight: 700 }}>
                Tổng vật phẩm: {(suppliesQuery.data || []).length} mục
              </span>
            </div>

            {suppliesQuery.isLoading ? (
              <LoadingState title="Đang tải danh sách đồ tiêu hao..." />
            ) : (suppliesQuery.data || []).length === 0 ? (
              <EmptyState title="Chưa có thông tin đồ tiêu hao" description="Chưa có vật phẩm tiêu hao nào được tiếp nhận cho Cụ." />
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.25rem' }}>
                {(suppliesQuery.data || []).map((item) => (
                  <div
                    key={item.id}
                    style={{
                      border: '1px solid #e2e8f0',
                      borderRadius: '0.75rem',
                      padding: '1.25rem',
                      background: item.status === 'EXHAUSTED' ? '#f8fafc' : '#ffffff',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                      <h4 style={{ margin: 0, fontSize: '1rem', color: '#1e293b', fontWeight: 700 }}>
                        {item.itemName}
                      </h4>
                      <span className={`badge ${item.status === 'EXHAUSTED' ? 'badge-neutral' : 'badge-success'}`}>
                        {item.status === 'EXHAUSTED' ? 'Đã hết' : 'Đang sử dụng'}
                      </span>
                    </div>

                    <div style={{ fontSize: '0.85rem', color: '#4b5563', lineHeight: 1.6, marginBottom: '0.75rem' }}>
                      <div>🏷️ Phân loại: <b>{item.categoryLabel}</b></div>
                      <div>📦 Số lượng tiếp nhận: <b>{item.quantityReceived} {item.unit}</b> ({new Date(item.receivedAt).toLocaleDateString('vi-VN')})</div>
                      <div>📊 Tồn kho hiện tại: <b style={{ color: item.remainingQuantity < 5 ? '#dc2626' : '#16a34a', fontSize: '0.95rem' }}>{item.remainingQuantity} {item.unit}</b></div>
                      <div>📍 Bảo quản: <b>{item.storageLocation}</b></div>
                      <div>👤 Người giao: {item.deliveredBy} | NV tiếp nhận: {item.receivedByStaffName}</div>
                      {item.notes && <div style={{ color: '#0369a1', fontStyle: 'italic', marginTop: '0.2rem' }}>💡 Ghi chú: {item.notes}</div>}
                    </div>

                    {/* Usage History Log */}
                    <div style={{ borderTop: '1px dashed #e2e8f0', paddingTop: '0.5rem' }}>
                      <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '0.3rem' }}>
                        📋 Nhật ký xuất dùng gần đây:
                      </div>
                      {item.usageLogs.length === 0 ? (
                        <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>Chưa có lượt dùng</div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', maxHeight: '120px', overflowY: 'auto' }}>
                          {item.usageLogs.map((log) => (
                            <div key={log.logId} style={{ fontSize: '0.78rem', background: '#f1f5f9', padding: '0.3rem 0.5rem', borderRadius: '0.35rem' }}>
                              <span>🕒 {new Date(log.usedAt).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}</span> —
                              <b> Dùng {log.usedQuantity} {item.unit}</b> ({log.usedByStaffName})
                              {log.note && <span style={{ color: '#475569' }}> ({log.note})</span>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 6: PHIẾU ĐÁNH GIÁ TÂM LÝ */}
      {activeTab === 'psychology' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="card" style={{ background: '#ffffff', borderRadius: '0.75rem', padding: '1.5rem', border: '1px solid #cbd5e1' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <h3 style={{ margin: 0, color: '#1e1b4b', fontSize: '1.15rem', fontWeight: 800 }}>
                  🧠 Phiếu Đánh Giá Tâm Lý Định Kỳ Chuẩn Viện Tâm An
                </h3>
                <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: '#64748b' }}>
                  Đánh giá chuyên sâu bởi Nhân viên Tâm lý và Chuyên viên Công tác xã hội để theo dõi sức khỏe tinh thần của Cụ.
                </p>
              </div>
              <span className="badge badge-info" style={{ fontWeight: 700 }}>
                Định kỳ gửi gia đình
              </span>
            </div>

            {psychologyQuery.isLoading ? (
              <LoadingState title="Đang tải phiếu đánh giá tâm lý..." />
            ) : (psychologyQuery.data || []).length === 0 ? (
              <EmptyState title="Chưa có phiếu đánh giá tâm lý" description="Chưa có phiếu đánh giá tâm lý nào được cập nhật cho Cụ." />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {(psychologyQuery.data || []).map((psy) => {
                  const emoMeta = EMOTIONAL_STATE_META[psy.emotionalState] || { label: psy.emotionalState, badge: 'badge-neutral' };
                  return (
                    <div
                      key={psy.id}
                      style={{
                        border: '1px solid #c7d2fe',
                        borderRadius: '0.75rem',
                        padding: '1.5rem',
                        background: 'linear-gradient(135deg, #ffffff 0%, #f5f3ff 100%)',
                        boxShadow: '0 4px 12px rgba(99, 102, 241, 0.06)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap' }}>
                        <div>
                          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#4338ca', background: '#e0e7ff', padding: '0.2rem 0.6rem', borderRadius: '0.25rem' }}>
                            {psy.periodLabel}
                          </span>
                          <h4 style={{ margin: '0.4rem 0 0 0', fontSize: '1.1rem', color: '#1e1b4b', fontWeight: 800 }}>
                            Ngày đánh giá: {new Date(psy.assessmentDate).toLocaleDateString('vi-VN')}
                          </h4>
                        </div>
                        <div style={{ textAlign: 'right', fontSize: '0.85rem', color: '#475569' }}>
                          <b>Chuyên viên đánh giá:</b> {psy.evaluatorName} ({psy.evaluatorRoleLabel})
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
                        <div style={{ background: '#ffffff', padding: '0.85rem', borderRadius: '0.5rem', border: '1px solid #e0e7ff' }}>
                          <div style={{ fontSize: '0.8rem', color: '#6366f1', fontWeight: 700 }}>1. Trạng thái tinh thần & cảm xúc</div>
                          <div style={{ marginTop: '0.3rem' }}>
                            <span className={`badge ${emoMeta.badge}`} style={{ fontWeight: 700 }}>
                              {emoMeta.label}
                            </span>
                          </div>
                          {psy.emotionalNotes && <div style={{ fontSize: '0.8rem', color: '#475569', marginTop: '0.4rem' }}>{psy.emotionalNotes}</div>}
                        </div>

                        <div style={{ background: '#ffffff', padding: '0.85rem', borderRadius: '0.5rem', border: '1px solid #e0e7ff' }}>
                          <div style={{ fontSize: '0.8rem', color: '#6366f1', fontWeight: 700 }}>2. Giao tiếp & thích ứng xã hội</div>
                          <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#1e293b', marginTop: '0.3rem' }}>
                            {psy.socialCommunicationLabel}
                          </div>
                          {psy.socialNotes && <div style={{ fontSize: '0.8rem', color: '#475569', marginTop: '0.4rem' }}>{psy.socialNotes}</div>}
                        </div>

                        <div style={{ background: '#ffffff', padding: '0.85rem', borderRadius: '0.5rem', border: '1px solid #e0e7ff' }}>
                          <div style={{ fontSize: '0.8rem', color: '#6366f1', fontWeight: 700 }}>3. Nhận thức, trí nhớ & Giấc ngủ</div>
                          <div style={{ fontSize: '0.85rem', color: '#1e293b', marginTop: '0.3rem' }}>
                            <div>🧠 Nhận thức: <b>{psy.cognitiveMemoryLabel}</b></div>
                            <div>🌙 Giấc ngủ: <b>{psy.sleepQualityLabel}</b></div>
                          </div>
                        </div>
                      </div>

                      <div style={{ background: '#ffffff', padding: '1rem', borderRadius: '0.5rem', border: '1px solid #c7d2fe', marginBottom: '0.5rem' }}>
                        <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#3730a3', marginBottom: '0.3rem' }}>
                          📝 Kết luận tổng quát của Chuyên viên Tâm lý:
                        </div>
                        <div style={{ fontSize: '0.9rem', color: '#1e293b', lineHeight: 1.5 }}>
                          {psy.overallConclusion}
                        </div>
                        <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#991b1b', marginTop: '0.75rem', marginBottom: '0.2rem' }}>
                          💡 Khuyến nghị cho Gia đình & Người chăm sóc:
                        </div>
                        <div style={{ fontSize: '0.88rem', color: '#334155' }}>
                          {psy.careRecommendations}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 7: THÔNG BÁO THU PHÍ & THANH TOÁN (17 MỤC EXCEL) */}
      {activeTab === 'fee-notice' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="card" style={{ background: '#ffffff', borderRadius: '0.75rem', padding: '1.5rem', border: '1px solid #cbd5e1' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <h3 style={{ margin: 0, color: '#065f46', fontSize: '1.15rem', fontWeight: 800 }}>
                  💳 Thông Báo Thu Phí Tháng & Xác Thực Thanh Toán
                </h3>
                <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: '#64748b' }}>
                  Hiển thị bảng tổng hợp viện phí hàng tháng (chỉ liệt kê các mục có chi phí {`> 0`}) và tiến trình xác nhận đóng phí.
                </p>
              </div>
            </div>

            {feeNoticesQuery.isLoading ? (
              <LoadingState title="Đang tải thông báo thu phí..." />
            ) : (feeNoticesQuery.data || []).length === 0 ? (
              <EmptyState title="Chưa có thông báo thu phí" description="Chưa có bảng thông báo thu phí tháng nào được phát hành." />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {(feeNoticesQuery.data || []).map((notice) => {
                  // Chỉ hiển thị các mục có phí > 0 theo yêu cầu số 4
                  const feeItemsList = [
                    { name: '1. Phí chăm sóc cơ bản', amount: notice.basicFee },
                    { name: '2. Phí lưu trú phòng ở', amount: notice.accommodationFee },
                    { name: '3. Hỗ trợ tắm giặt', amount: notice.bathingLaundryFee },
                    { name: '4. Hỗ trợ xoay trở / di chuyển', amount: notice.mobilityFee },
                    { name: '5. Hỗ trợ vệ sinh', amount: notice.hygieneFee },
                    { name: '6. Hỗ trợ rửa ăn / ăn qua sonde', amount: notice.feedingSondeFee },
                    { name: '7. Chăm sóc NCT lú lẫn / tuổi già', amount: notice.dementiaCareFee },
                    { name: '8. Chăm sóc các lỗ loét', amount: notice.soreCareFee },
                    { name: '9. Chăm sóc sonde dạ dày / bàng quang', amount: notice.catheterCareFee },
                    { name: '10. Chăm sóc nội khí quản', amount: notice.tracheostomyCareFee },
                    { name: '11. Thay băng, rửa vết thương', amount: notice.woundDressingFee },
                    { name: '12. Vật lý trị liệu - PHCN', amount: notice.rehabFee },
                    { name: '13. Phát sinh', amount: notice.incurredFee, note: notice.incurredContent },
                    { name: '14. Tiền ăn cơm người nhà đăng ký tại Tâm An', amount: notice.familyMealsFee },
                    { name: '15. Nợ tháng trước', amount: notice.previousMonthDebt },
                  ].filter((item) => item.amount > 0);

                  const statusClass = notice.status === 'PAID' ? 'badge-success' : notice.status === 'PARTIAL' ? 'badge-warning' : 'badge-danger';

                  return (
                    <div
                      key={notice.id}
                      style={{
                        border: '2px solid #a7f3d0',
                        borderRadius: '0.75rem',
                        padding: '1.5rem',
                        background: '#ffffff',
                        boxShadow: '0 4px 12px rgba(16, 185, 129, 0.05)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem', borderBottom: '1px solid #ecfdf5', paddingBottom: '0.75rem' }}>
                        <div>
                          <div style={{ fontSize: '0.85rem', color: '#047857', fontWeight: 700 }}>THÔNG BÁO THU PHÍ THÁNG {notice.billingMonth}</div>
                          <h4 style={{ margin: '0.2rem 0 0 0', fontSize: '1.2rem', color: '#064e3b', fontWeight: 800 }}>
                            Cụ {notice.residentName} (Mã HĐ: {notice.residentCode})
                          </h4>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                          <span className={`badge ${statusClass}`} style={{ fontSize: '0.9rem', padding: '0.4rem 0.85rem', fontWeight: 800 }}>
                            {notice.statusLabel}
                          </span>

                          <button
                            type="button"
                            className="btn btn-primary"
                            style={{ fontWeight: 700, padding: '0.45rem 1rem' }}
                            onClick={() => {
                              setVerifyingFeeNotice(notice);
                              setPaymentStatusInput(notice.status);
                              setPaidAmountValue(notice.paidAmount);
                              setPaymentNotesInput(notice.notes || '');
                            }}
                          >
                            ✏️ Xác Thực Đóng Phí
                          </button>
                        </div>
                      </div>

                      {/* Chi tiết 17 mục có giá trị > 0 */}
                      <div style={{ marginBottom: '1.25rem' }}>
                        <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155', marginBottom: '0.5rem' }}>
                          📋 Bảng Chi Tiết Phí & Các Gói Dịch Vụ Phát Sinh (Chỉ hiển thị mục có phí):
                        </div>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
                          <thead>
                            <tr style={{ background: '#f0fdf4', color: '#166534', textAlign: 'left' }}>
                              <th style={{ padding: '0.5rem 0.75rem', border: '1px solid #d1fae5' }}>Nội dung chi phí</th>
                              <th style={{ padding: '0.5rem 0.75rem', border: '1px solid #d1fae5', textAlign: 'right' }}>Số tiền (VNĐ)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {feeItemsList.map((item, idx) => (
                              <tr key={idx} style={{ borderBottom: '1px solid #f0fdf4' }}>
                                <td style={{ padding: '0.45rem 0.75rem', border: '1px solid #e2e8f0' }}>
                                  {item.name} {item.note ? <span style={{ color: '#0284c7', fontStyle: 'italic' }}>({item.note})</span> : ''}
                                </td>
                                <td style={{ padding: '0.45rem 0.75rem', border: '1px solid #e2e8f0', textAlign: 'right', fontWeight: 600 }}>
                                  {item.amount.toLocaleString('vi-VN')} đ
                                </td>
                              </tr>
                            ))}

                            {/* Giảm trừ nếu có */}
                            {notice.deductionFee > 0 && (
                              <tr style={{ background: '#fff1f2', color: '#be123c' }}>
                                <td style={{ padding: '0.45rem 0.75rem', border: '1px solid #e2e8f0', fontWeight: 700 }}>
                                  16. Chi phí giảm trừ (Nghỉ phép/Ưu đãi)
                                </td>
                                <td style={{ padding: '0.45rem 0.75rem', border: '1px solid #e2e8f0', textAlign: 'right', fontWeight: 700 }}>
                                  - {notice.deductionFee.toLocaleString('vi-VN')} đ
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>

                      {/* Tổng Hợp Thu Phí */}
                      <div style={{ background: '#f0fdf4', padding: '1rem 1.25rem', borderRadius: '0.5rem', border: '1px solid #a7f3d0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                        <div>
                          <div>💵 Tổng tiền cần thu: <b style={{ fontSize: '1.1rem', color: '#166534' }}>{notice.totalDue.toLocaleString('vi-VN')} VNĐ</b></div>
                          <div style={{ fontSize: '0.85rem', color: '#4b5563', marginTop: '0.2rem' }}>
                            Đã thanh toán: <b style={{ color: '#15803d' }}>{notice.paidAmount.toLocaleString('vi-VN')} đ</b> | Số dư còn phải thu: <b style={{ color: '#dc2626' }}>{notice.remainingAmount.toLocaleString('vi-VN')} đ</b>
                          </div>
                        </div>

                        {notice.notes && (
                          <div style={{ fontSize: '0.82rem', color: '#475569', fontStyle: 'italic', maxWidth: '400px' }}>
                            💬 Ghi chú thu ngân: {notice.notes}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 8: ĐĂNG KÝ ĂN CƠM TẠI TÂM AN CHO NGƯỜI NHÀ */}
      {activeTab === 'family-meal' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="card" style={{ background: '#ffffff', borderRadius: '0.75rem', padding: '1.5rem', border: '1px solid #cbd5e1' }}>
            <h3 style={{ margin: '0 0 0.5rem 0', color: '#1e293b', fontSize: '1.15rem', fontWeight: 800 }}>
              🍽️ Đăng Ký Ăn Cơm Tại Tâm An Cho Thân Nhân
            </h3>
            <p style={{ margin: '0 0 1.25rem 0', fontSize: '0.86rem', color: '#64748b' }}>
              Quý người nhà có nhu cầu dùng cơm cùng Cụ tại Tâm An vui lòng đăng ký trước. Chi phí bữa ăn (50.000đ/suất) sẽ tự động tích hợp vào Thông báo thu phí hàng tháng.
            </p>

            {mealBookingSuccessMsg && (
              <div className="alert-card alert-success" style={{ marginBottom: '1rem' }}>
                <span>{mealBookingSuccessMsg}</span>
              </div>
            )}

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!mealBookingDate) {
                  alert('Vui lòng chọn ngày đăng ký ăn.');
                  return;
                }
                try {
                  const res = await bookFamilyMeal(actor!, {
                    residentId: activeResId,
                    residentName: currentResident?.resident.displayName || 'Người cao tuổi',
                    guardianName: actor?.displayName || 'Thân nhân',
                    bookingDate: mealBookingDate,
                    mealType: mealBookingType,
                    portionCount: mealPortionCount,
                    dietNotes: mealDietNotes,
                  });
                  setMealBookingSuccessMsg(`✅ Đăng ký thành công ${res.portionCount} suất cơm (${res.totalFee.toLocaleString('vi-VN')}đ) cho bữa ngày ${res.bookingDate}!`);
                  setMealBookingDate('');
                  setMealDietNotes('');
                  queryClient.invalidateQueries({ queryKey: ['family-meal-bookings'] });
                  queryClient.invalidateQueries({ queryKey: ['family-fee-notices'] });
                } catch (err: any) {
                  alert(err.message || 'Lỗi khi đăng ký suất ăn');
                }
              }}
            >
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                <label className="field-group">
                  <span className="field-label">Ngày đăng ký ăn *</span>
                  <input
                    type="date"
                    className="text-input"
                    value={mealBookingDate}
                    onChange={(e) => setMealBookingDate(e.target.value)}
                    required
                  />
                </label>

                <label className="field-group">
                  <span className="field-label">Bữa ăn *</span>
                  <select
                    className="text-input"
                    value={mealBookingType}
                    onChange={(e) => setMealBookingType(e.target.value as any)}
                  >
                    <option value="BREAKFAST">Bữa Sáng (07:00 - 08:00)</option>
                    <option value="LUNCH">Bữa Trưa (11:00 - 12:00)</option>
                    <option value="AFTERNOON_SNACK">Bữa Phụ (14:00)</option>
                    <option value="DINNER">Bữa Tối (17:00 - 18:00)</option>
                  </select>
                </label>

                <label className="field-group">
                  <span className="field-label">Số lượng suất ăn (50.000đ/suất) *</span>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    className="text-input"
                    value={mealPortionCount}
                    onChange={(e) => setMealPortionCount(Number(e.target.value))}
                    required
                  />
                </label>

                <div className="field-group">
                  <span className="field-label">Thành tiền tạm tính</span>
                  <div style={{ padding: '0.65rem', background: '#f0fdf4', borderRadius: '0.375rem', fontWeight: 800, color: '#166534', border: '1px solid #bbf7d0' }}>
                    {(mealPortionCount * 50000).toLocaleString('vi-VN')} VNĐ
                  </div>
                </div>
              </div>

              <label className="field-group" style={{ marginBottom: '1.25rem' }}>
                <span className="field-label">Yêu cầu khẩu vị / Chế độ ăn (nếu có)</span>
                <input
                  className="text-input"
                  value={mealDietNotes}
                  placeholder="Ví dụ: 1 suất ăn kiêng đường, ăn cùng Cụ tại sảnh tầng 1..."
                  onChange={(e) => setMealDietNotes(e.target.value)}
                />
              </label>

              <button type="submit" className="btn btn-primary" style={{ padding: '0.65rem 1.5rem', fontWeight: 700 }}>
                🍽️ Xác Nhận Đăng Ký Bữa Ăn
              </button>
            </form>
          </div>

          <div className="card" style={{ background: '#ffffff', borderRadius: '0.75rem', padding: '1.25rem' }}>
            <h3 style={{ margin: '0 0 1rem 0', color: '#1e293b', fontSize: '1.1rem', fontWeight: 700 }}>
              📋 Lịch Sử Đăng Ký Suất Ăn Thân Nhân
            </h3>

            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Ngày dùng bữa</th>
                    <th>Bữa ăn</th>
                    <th>Số suất</th>
                    <th>Thành tiền</th>
                    <th>Trạng thái</th>
                    <th>Yêu cầu khẩu vị</th>
                  </tr>
                </thead>
                <tbody>
                  {(familyMealsQuery.data || []).map((b) => (
                    <tr key={b.id}>
                      <td><b>{b.bookingDate}</b></td>
                      <td>{b.mealTypeLabel}</td>
                      <td>{b.portionCount} suất</td>
                      <td><b>{b.totalFee.toLocaleString('vi-VN')} đ</b></td>
                      <td><span className="badge badge-success">{b.status === 'SERVED' ? 'Đã phục vụ' : 'Đã xác nhận'}</span></td>
                      <td style={{ fontSize: '0.82rem', color: '#64748b' }}>{b.dietNotes || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL XÁC THỰC ĐÓNG PHÍ */}
      {verifyingFeeNotice && (
        <div className="modal-overlay" onClick={() => setVerifyingFeeNotice(null)}>
          <div
            className="modal-dialog"
            style={{ maxWidth: '520px', background: '#ffffff', borderRadius: '0.75rem', padding: '1.5rem' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 1rem 0', color: '#065f46', fontSize: '1.15rem', fontWeight: 800 }}>
              ✏️ Xác Thực Tiến Trình Đóng Phí
            </h3>
            <p style={{ fontSize: '0.88rem', color: '#475569', marginBottom: '1.25rem' }}>
              Cập nhật trạng thái thanh toán cho thông báo thu phí tháng <b>{verifyingFeeNotice.billingMonth}</b> (Cụ {verifyingFeeNotice.residentName}).
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
              <label className="field-group">
                <span className="field-label">Chọn Trạng Thái Thanh Toán *</span>
                <select
                  className="text-input"
                  value={paymentStatusInput}
                  onChange={(e) => {
                    const status = e.target.value as any;
                    setPaymentStatusInput(status);
                    if (status === 'PAID') setPaidAmountValue(verifyingFeeNotice.totalDue);
                    else if (status === 'UNPAID') setPaidAmountValue(0);
                  }}
                >
                  <option value="PAID">✅ Đã thu phí (Đã nhận đủ {verifyingFeeNotice.totalDue.toLocaleString('vi-VN')} đ)</option>
                  <option value="PARTIAL">⚠️ Thu một phần (Nhập số tiền đã nhận bên dưới)</option>
                  <option value="UNPAID">❌ Chưa thu phí (Nợ chưa thanh toán)</option>
                </select>
              </label>

              {paymentStatusInput === 'PARTIAL' && (
                <label className="field-group">
                  <span className="field-label">Số tiền thực tế đã thu (VNĐ) *</span>
                  <input
                    type="number"
                    className="text-input"
                    value={paidAmountValue}
                    onChange={(e) => setPaidAmountValue(Number(e.target.value))}
                    max={verifyingFeeNotice.totalDue}
                  />
                  <span style={{ fontSize: '0.8rem', color: '#dc2626', marginTop: '0.2rem' }}>
                    Còn nợ: {Math.max(0, verifyingFeeNotice.totalDue - paidAmountValue).toLocaleString('vi-VN')} VNĐ
                  </span>
                </label>
              )}

              <label className="field-group">
                <span className="field-label">Ghi chú xác thực / Giao dịch</span>
                <textarea
                  className="text-input"
                  rows={3}
                  value={paymentNotesInput}
                  placeholder="Ví dụ: Đã nhận chuyển khoản đợt 1 ngày 12/09..."
                  onChange={(e) => setPaymentNotesInput(e.target.value)}
                />
              </label>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button type="button" className="btn btn-neutral" onClick={() => setVerifyingFeeNotice(null)}>
                Hủy
              </button>
              <button
                type="button"
                className="btn btn-primary"
                style={{ fontWeight: 700 }}
                onClick={async () => {
                  try {
                    await updateFeeNoticePayment(actor!, verifyingFeeNotice.id, paymentStatusInput, paidAmountValue, paymentNotesInput);
                    setVerifyingFeeNotice(null);
                    queryClient.invalidateQueries({ queryKey: ['family-fee-notices'] });
                  } catch (err: any) {
                    alert(err.message || 'Lỗi khi cập nhật trạng thái');
                  }
                }}
              >
                💾 Lưu Trạng Thái Thanh Toán
              </button>
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

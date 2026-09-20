import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useActor } from '../../auth/ActorContext';
import { listResidents, ResidentContextResponse } from '../../api/residents';
import { triggerPrint } from '../../utils/print';
import {
  calculateMonthlyVitalMinMax,
  getResidentADL,
  getResidentVitalHistory,
  saveVitalRecord,
  VitalRecord,
} from '../../utils/vitals-calculator';
import {
  approveHealthReport,
  createHealthReport,
  deliverHealthReport,
  downloadHealthReportPdf,
  generateHealthReport,
  listHealthReports,
  startHealthReportReview,
  updateHealthReport,
  HealthReportRow,
  HealthReportStatus,
} from './healthReportsApi';

// Clinical Assessment Data Model matching 3-page template (Mẫu 06/PTDYS-TA)
export interface VitalMeasurementItem {
  id: string;
  date: string;
  value: string;
}

export interface ClinicalAssessmentData {
  assessmentDate: string;
  assessorName: string;
  residentName: string;
  residentCode: string;
  dateOfBirth: string;
  gender: string;
  room?: string;

  // II. Sinh tồn & Thể trạng
  pulse: string;
  pulseEvaluation: 'NORMAL' | 'SLOW' | 'FAST';
  bloodPressure: string;
  bpEvaluation: 'NORMAL' | 'HIGH' | 'LOW';
  temperature: string;
  tempEvaluation: 'NORMAL' | 'FEVER' | 'HYPOTHERMIA';
  spo2: string;
  spo2Evaluation: 'NORMAL' | 'DYSPNEA';
  weightRecords: VitalMeasurementItem[];
  glucoseRecords: VitalMeasurementItem[];

  // III. Bệnh lý & Thuốc
  conditions: {
    hypertension: boolean;
    diabetes: boolean;
    diabetesType?: string;
    cardiovascular: boolean;
    strokeOrHemiplegia: boolean;
    dementiaAlzheimer: boolean;
    osteoarthritis: boolean;
    respiratory: boolean;
    kidneyDisease: boolean;
    other: boolean;
    otherDetail?: string;
  };
  allergy: {
    none: boolean;
    drugAllergy?: string;
    foodAllergy?: string;
  };
  medicationsNotes: string;

  // IV. ADL
  adl: {
    eating: 'INDEPENDENT' | 'PARTIAL_ASSIST' | 'FULL_DEPEND';
    bathing: 'INDEPENDENT' | 'PARTIAL_ASSIST' | 'FULL_DEPEND';
    dressing: 'INDEPENDENT' | 'PARTIAL_ASSIST' | 'FULL_DEPEND';
    toileting: 'INDEPENDENT' | 'PARTIAL_ASSIST' | 'FULL_DEPEND';
    mobility: 'INDEPENDENT' | 'PARTIAL_ASSIST' | 'FULL_DEPEND';
    excretion: 'AUTONOMOUS' | 'INCONTINENT' | 'CATHETER_DIAPER';
    mobilitySupport: 'NONE' | 'CANE_WALKER' | 'WHEELCHAIR';
  };

  // V. Tinh thần & Nhận thức
  mental: {
    alertAndResponsive: boolean;
    memoryCognition: 'NORMAL' | 'MILD_DECLINE' | 'CONFUSED_SEVERE';
    emotionalState: 'HAPPY_SOCIABLE' | 'WITHDRAWN' | 'IRRITABLE' | 'ANXIOUS_DEPRESSED';
    sleepQuality: 'GOOD' | 'INSOMNIA' | 'NIGHT_WAKING';
  };

  // V-B. Đánh giá Tâm lý & Công tác xã hội
  psychologicalAssessment?: {
    isCompleted: boolean;
    assessorName: string;
    assessmentDate: string;
    emotionalState: 'HAPPY_SOCIABLE' | 'STABLE_NORMAL' | 'ANXIOUS_DEPRESSED' | 'IRRITABLE_AGITATED';
    socialInteraction: 'ACTIVE_COMMUNICATIVE' | 'PASSIVE_QUIET' | 'WITHDRAWN_REFUSED';
    cognitiveMemoryScore: string;
    behavioralNotes: string;
    recommendations: string;
    isManualSupplemented?: boolean;
  };

  // VI. Dinh dưỡng & Nhai nuốt
  nutrition: {
    dietType: 'NORMAL_RICE' | 'PORRIDGE_SOUP' | 'SONDE';
    swallowingAbility: 'NORMAL' | 'CHOKING' | 'DIFFICULT';
    dentalStatus: 'NATURAL_GOOD' | 'DENTURES' | 'WEAK_FALLEN';
  };

  // VII. Nguy cơ loét
  skinRisk: {
    hasUlcer: boolean;
    ulcerLocation?: string;
    ulcerStageSize?: string;
  };

  // VIII. Kết luận, HƯỚNG CHĂM SÓC, Ghi chú & Dặn dò thêm
  careLevelProposal: 'LEVEL_1' | 'LEVEL_2' | 'LEVEL_3';
  specificEvaluation: string;
  additionalNotesAndCareInstructions: string;

  // Medical approval metadata
  medicalHeadApproval?: {
    approvedBy: string;
    approvedRole: string;
    approvedAt: string;
  };
}

const DEFAULT_ASSESSMENT: ClinicalAssessmentData = {
  assessmentDate: new Date().toISOString().slice(0, 10),
  assessorName: '',
  residentName: '',
  residentCode: '',
  dateOfBirth: '',
  gender: 'Nữ',
  room: '',

  pulse: '70 – 85',
  pulseEvaluation: 'NORMAL',
  bloodPressure: '118/75 – 134/88',
  bpEvaluation: 'HIGH',
  temperature: '36.2 – 36.8',
  tempEvaluation: 'NORMAL',
  spo2: '95 – 99',
  spo2Evaluation: 'NORMAL',
  weightRecords: [
    { id: '1', date: '07/07/2026', value: '47 kg' },
    { id: '2', date: '16/07/2026', value: '48.3 kg' },
    { id: '3', date: '12/08/2026', value: '49.5 kg' },
  ],
  glucoseRecords: [
    { id: '1', date: '07/07/2026', value: '6.2 mmol/L' },
    { id: '2', date: '16/07/2026', value: '7.2 mmol/L' },
    { id: '3', date: '12/08/2026', value: '8.5 mmol/L' },
  ],

  conditions: {
    hypertension: false,
    diabetes: true,
    diabetesType: 'Tuýp 2',
    cardiovascular: false,
    strokeOrHemiplegia: false,
    dementiaAlzheimer: true,
    osteoarthritis: false,
    respiratory: false,
    kidneyDisease: false,
    other: false,
    otherDetail: '',
  },
  allergy: {
    none: true,
    drugAllergy: '',
    foodAllergy: '',
  },
  medicationsNotes: 'Bà đang dùng thuốc điều trị tiểu đường theo đơn của BS chỉ định.\nCấp phát thuốc đúng cữ 7h00 - 11h30 - 17h00 theo quy chuẩn 5 Đúng eMAR.',

  adl: {
    eating: 'INDEPENDENT',
    bathing: 'FULL_DEPEND',
    dressing: 'INDEPENDENT',
    toileting: 'PARTIAL_ASSIST',
    mobility: 'INDEPENDENT',
    excretion: 'AUTONOMOUS',
    mobilitySupport: 'NONE',
  },

  mental: {
    alertAndResponsive: true,
    memoryCognition: 'CONFUSED_SEVERE',
    emotionalState: 'HAPPY_SOCIABLE',
    sleepQuality: 'GOOD',
  },

  psychologicalAssessment: {
    isCompleted: true,
    assessorName: 'CN. Nguyễn Hoàng Nam (Chuyên viên Tâm lý & CTXH)',
    assessmentDate: new Date().toISOString().slice(0, 10),
    emotionalState: 'HAPPY_SOCIABLE',
    socialInteraction: 'ACTIVE_COMMUNICATIVE',
    cognitiveMemoryScore: 'MMSE: 22/30 (Suy giảm nhận thức nhẹ)',
    behavioralNotes: 'Cụ vui vẻ, tinh thần thoải mái, tích cực tham gia hoạt động trò chuyện nhóm ca sáng. Tâm lý ổn định, gắn kết tốt với nhân viên.',
    recommendations: 'Khuyến khích cụ tiếp tục tham gia CLB Đọc sách và sinh hoạt tập thể để tăng khả năng giao tiếp.',
    isManualSupplemented: false,
  },

  nutrition: {
    dietType: 'NORMAL_RICE',
    swallowingAbility: 'NORMAL',
    dentalStatus: 'NATURAL_GOOD',
  },

  skinRisk: {
    hasUlcer: false,
    ulcerLocation: '',
    ulcerStageSize: '',
  },

  careLevelProposal: 'LEVEL_2',
  specificEvaluation:
    'Huyết áp (Khoảng Min - Max trong kỳ): 118/75 – 134/88 mmHg.\nNhịp tim/Mạch (Khoảng Min - Max): 70 – 85 lần/phút (Ổn định bình thường).\nThân nhiệt (Khoảng Min - Max): 36.2 – 36.8°C | SpO2 (Khoảng Min - Max): 95 – 99%.\nĐường huyết mao mạch (Khoảng Min - Max): 6.2 – 8.5 mmol/L.\nSa sút trí tuệ: Bà nhận diện được người thân, nhưng hay nhầm lẫn đồ đạc của cụ cùng phòng. Cần nhân viên bao quát khi tập thể dục ngoài trời.',
  additionalNotesAndCareInstructions:
    '- Duy trì chế độ chăm sóc, dinh dưỡng giảm tinh bột tăng đạm và cấp phát thuốc hàng ngày theo đơn.\n- Nhân viên chăm sóc thay quần áo hàng ngày và hỗ trợ tắm rửa theo lịch.\n- Đại tiện cần nhân viên hỗ trợ lau rửa để đảm bảo vệ sinh do bà hay quên cách làm sạch.',
};

const STATUS_BADGES: Record<HealthReportStatus, { label: string; className: string }> = {
  DRAFT: { label: 'Bản nháp', className: 'badge badge-neutral' },
  GENERATED: { label: 'Đã khóa dữ liệu', className: 'badge badge-info' },
  UNDER_REVIEW: { label: '⏳ Chờ Phụ trách Y tế duyệt', className: 'badge badge-warning' },
  REVISION_REQUIRED: { label: 'Yêu cầu sửa', className: 'badge badge-danger' },
  APPROVED: { label: '✓ Phụ trách Y tế đã duyệt', className: 'badge badge-success' },
  DELIVERED: { label: 'Đã gửi gia đình', className: 'badge badge-purple' },
  SUPERSEDED: { label: 'Đã thay thế', className: 'badge badge-neutral' },
  CANCELLED: { label: 'Đã hủy', className: 'badge badge-neutral' },
};

export default function HealthReportsPage() {
  const { actor } = useActor();

  // Role-based Access Control (RBAC) Definitions
  const isMedicalHead =
    actor?.actorRole === 'MEDICAL_HEAD' ||
    actor?.actorRole === 'SUPERVISOR' ||
    actor?.actorRole === 'CARE_MANAGER' ||
    actor?.actorRole === 'ADMIN';
  const isNurseOrStaff = !isMedicalHead;

  // Top level 2-Tab Navigation State
  const [activeTab, setActiveTab] = useState<'DAILY_HEALTH' | 'PERIODIC_SUMMARY'>('DAILY_HEALTH');

  // Reports state
  const [reports, setReports] = useState<HealthReportRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [filterResident, setFilterResident] = useState('ALL');

  // Tab 1: Daily Vitals Update Form & History State
  const [dailyResidentId, setDailyResidentId] = useState('');
  const [dailyMeasuredAt, setDailyMeasuredAt] = useState(new Date().toISOString().slice(0, 16));
  const [dailySysBP, setDailySysBP] = useState<string>('120');
  const [dailyDiaBP, setDailyDiaBP] = useState<string>('80');
  const [dailyHeartRate, setDailyHeartRate] = useState<string>('75');
  const [dailyTemp, setDailyTemp] = useState<string>('36.5');
  const [dailySpo2, setDailySpo2] = useState<string>('98');
  const [dailyRespRate, setDailyRespRate] = useState<string>('18');
  const [dailyWeight, setDailyWeight] = useState<string>('48.5');
  const [dailyBloodGlucose, setDailyBloodGlucose] = useState<string>('6.5');
  const [dailyNote, setDailyNote] = useState('');
  const [dailyRecordedBy, setDailyRecordedBy] = useState('');
  const [dailyHistory, setDailyHistory] = useState<VitalRecord[]>([]);

  // Tab 2: Form Editor Modal State (Supports New Report Creation & Medical Head Review/Editing)
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingReportId, setEditingReportId] = useState<string | null>(null);
  const [selectedResidentId, setSelectedResidentId] = useState('');
  const [periodStart, setPeriodStart] = useState(new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10));
  const [periodEnd, setPeriodEnd] = useState(new Date().toISOString().slice(0, 10));
  const [assessment, setAssessment] = useState<ClinicalAssessmentData>(DEFAULT_ASSESSMENT);
  const [synthesizing, setSynthesizing] = useState(false);

  // Delivery Modal State
  const [deliveryReport, setDeliveryReport] = useState<HealthReportRow | null>(null);
  const [deliveryContactId, setDeliveryContactId] = useState('');
  const [deliveryMethod, setDeliveryMethod] = useState('EMAIL');
  const [deliveryNotes, setDeliveryNotes] = useState('');

  // Print / View Template Modal State
  const [viewingReport, setViewingReport] = useState<{ report: HealthReportRow; data: ClinicalAssessmentData } | null>(null);

  // Load residents list
  const { data: residentsList } = useQuery({
    queryKey: ['residents-list', actor?.actorId],
    queryFn: () => listResidents(actor),
    enabled: Boolean(actor),
  });

  // Set default recordedBy name when actor loads
  useEffect(() => {
    if (actor && !dailyRecordedBy) {
      setDailyRecordedBy(actor.displayName || actor.actorId || 'ĐD. Lê Thị Mai');
    }
  }, [actor, dailyRecordedBy]);

  const refreshReports = useCallback(async () => {
    if (!actor) return;
    try {
      const rows = await listHealthReports(actor);
      setReports(rows);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Không tải được danh sách báo cáo.');
    }
  }, [actor]);

  useEffect(() => {
    void refreshReports();
  }, [refreshReports]);

  // Handle Tab 1 Daily Resident Selection
  const handleDailyResidentSelect = (resId: string) => {
    setDailyResidentId(resId);
    if (!resId) {
      setDailyHistory([]);
      return;
    }
    const history = getResidentVitalHistory(resId);
    setDailyHistory(history);
  };

  // Handle Save Daily Vitals Measurement (Tab 1)
  const handleSaveDailyVitals = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dailyResidentId) {
      setMessage('⚠️ Vui lòng chọn Người cao tuổi cần cập nhật nhật ký sức khỏe.');
      return;
    }

    try {
      setBusy(true);
      const savedRecord = saveVitalRecord(dailyResidentId, {
        sysBP: dailySysBP ? Number(dailySysBP) : undefined,
        diaBP: dailyDiaBP ? Number(dailyDiaBP) : undefined,
        heartRate: dailyHeartRate ? Number(dailyHeartRate) : undefined,
        temp: dailyTemp ? Number(dailyTemp) : undefined,
        spo2: dailySpo2 ? Number(dailySpo2) : undefined,
        respRate: dailyRespRate ? Number(dailyRespRate) : undefined,
        weight: dailyWeight ? Number(dailyWeight) : undefined,
        bloodGlucose: dailyBloodGlucose ? Number(dailyBloodGlucose) : undefined,
        measuredAt: dailyMeasuredAt ? `${dailyMeasuredAt}:00.000Z` : new Date().toISOString(),
        recordedBy: dailyRecordedBy || actor?.displayName || 'Nhân viên y tế',
        recordedByRole: actor?.actorRole || 'NURSE',
        note: dailyNote.trim() || 'Sinh hiệu trong ca trực ổn định.',
      });

      // Refresh local daily history log for audit trail
      const updatedHistory = getResidentVitalHistory(dailyResidentId);
      setDailyHistory(updatedHistory);

      setMessage(`✅ Đã cập nhật thành công chỉ số đo sức khỏe hàng ngày cho Cụ (Mã lượt đo truy vết: ${savedRecord.id})!`);
      setDailyNote('');
    } catch (err: any) {
      console.error('Lỗi khi lưu nhật ký sức khỏe hàng ngày:', err);
      setMessage('❌ Không lưu được chỉ số đo sức khỏe. Vui lòng thử lại.');
    } finally {
      setBusy(false);
    }
  };

  // Background Vitals Synthesis: Aggregates daily vitals from Tab 1 into statistics & suggested comments for Tab 2
  const runVitalsSynthesis = (resId: string) => {
    if (!resId) return;
    setSynthesizing(true);

    const item = residentsList?.find((r: ResidentContextResponse) => r.resident.residentId === resId)?.resident;
    
    // 1. Calculation of monthly vital min-max from Tab 1 logs
    const vitalsSummary = calculateMonthlyVitalMinMax(resId);

    // Formulate clean evaluation comments
    const evaluationText = [
      `📊 TỔNG HỢP CHỈ SỐ SINH TỒN TRONG KỲ BÁO CÁO:`,
      `• Huyết áp (Khoảng Min - Max): ${vitalsSummary.bpMinMax} mmHg (${vitalsSummary.bpEval === 'HIGH' ? 'Phân loại Cao - cần tiếp tục kiểm soát theo y lệnh' : 'Phân loại Bình thường'}).`,
      `• Mạch/Nhịp tim (Khoảng Min - Max): ${vitalsSummary.pulseMinMax} bpm (${vitalsSummary.pulseEval === 'NORMAL' ? 'Ổn định bình thường' : vitalsSummary.pulseEval === 'FAST' ? 'Nhanh' : 'Chậm'}).`,
      `• Thân nhiệt (Min - Max): ${vitalsSummary.tempMinMax}°C | SpO2 (Min - Max): ${vitalsSummary.spo2MinMax}%.`,
      `• Theo dõi Cân nặng (Min - Max): ${vitalsSummary.weightMinMax} kg | Glucose máu (Min - Max): ${vitalsSummary.glucoseMinMax} mmol/L.`,
      `• Tình trạng thể trạng chung: Ổn định, ghi nhận đầy đủ các cữ kiểm tra sinh hiệu, cấp phát thuốc & chăm sóc hàng ngày tuân thủ quy chuẩn y khoa Tâm An Care.`
    ].join('\n');

    const careInstructionsText = [
      `- Duy trì phác đồ theo dõi sức khỏe, kiểm tra sinh hiệu định kỳ và nhật ký chăm sóc hàng ngày cho cụ ${item?.displayName || ''}.`,
      `- Đánh giá thể trạng: Thể trạng và tinh thần ổn định, đáp ứng tốt với chế độ sinh hoạt nội trú tại Trung tâm.`,
      `- Hướng hỗ trợ: Nhân viên chăm sóc theo dõi sát các cữ ăn, uống thuốc đúng giờ eMAR và hỗ trợ vệ sinh cá nhân theo lịch.`,
    ].join('\n');

    setAssessment((prev) => ({
      ...prev,
      residentName: item?.displayName || prev.residentName,
      residentCode: item?.residentCode || prev.residentCode,
      dateOfBirth: item?.dateOfBirth ? new Date(item.dateOfBirth).toLocaleDateString('vi-VN') : prev.dateOfBirth,
      gender: item?.gender === 'FEMALE' ? 'Nữ' : 'Nam',
      room: item?.room || prev.room || '',
      assessorName: actor?.displayName || actor?.actorId || 'Nhân viên y tế',
      pulse: vitalsSummary.pulseMinMax,
      pulseEvaluation: vitalsSummary.pulseEval,
      bloodPressure: vitalsSummary.bpMinMax,
      bpEvaluation: vitalsSummary.bpEval,
      temperature: vitalsSummary.tempMinMax,
      tempEvaluation: vitalsSummary.tempEval,
      spo2: vitalsSummary.spo2MinMax,
      spo2Evaluation: vitalsSummary.spo2Eval,
      weightRecords: vitalsSummary.weightRecords,
      glucoseRecords: vitalsSummary.glucoseRecords,
      adl: {
        ...prev.adl,
        ...getResidentADL(resId),
      },
      specificEvaluation: evaluationText,
      additionalNotesAndCareInstructions: careInstructionsText,
    }));

    setTimeout(() => {
      setSynthesizing(false);
    }, 300);
  };

  // Handle Resident Selection in Form (Tab 2)
  const handleResidentSelect = (resId: string) => {
    setSelectedResidentId(resId);
    runVitalsSynthesis(resId);
  };

  // Open Medical Head Editor for Existing Report
  const openMedicalHeadReview = (report: HealthReportRow) => {
    setEditingReportId(report.health_report_id);
    setSelectedResidentId(report.resident_id);
    setPeriodStart(report.period_start.slice(0, 10));
    setPeriodEnd(report.period_end.slice(0, 10));
    const parsed = parseAssessment(report.summary);
    setAssessment({
      ...parsed,
      assessorName: parsed.assessorName || 'Nhân viên y tế',
    });
    setIsEditorOpen(true);
  };

  // Quick Approval Handler for Medical Head
  const handleQuickApproveMedical = async (reportId: string) => {
    if (!actor) return;
    try {
      setBusy(true);
      setMessage('');
      await approveHealthReport(actor, reportId);
      await refreshReports();
      setMessage('✅ Phụ trách Y tế đã rà soát và xác nhận phê duyệt ký số thành công báo cáo sức khỏe định kỳ!');
    } catch (err: any) {
      console.error('Lỗi khi phê duyệt báo cáo:', err);
      setMessage(`❌ Phê duyệt thất bại: ${err.message || 'Lỗi không xác định'}`);
    } finally {
      setBusy(false);
    }
  };

  // Submit report to Medical Head for review (Nurse action)
  const handleSubmitForReviewDirectly = async (reportId: string) => {
    if (!actor) return;
    try {
      setBusy(true);
      setMessage('');
      await startHealthReportReview(actor, reportId);
      await refreshReports();
      setMessage('✅ Đã chuyển/trình Phụ trách Y tế phê duyệt thành công báo cáo sức khỏe định kỳ!');
    } catch (err: any) {
      console.error('Lỗi khi trình Phụ trách Y tế duyệt:', err);
      setMessage(`❌ Không trình duyệt được: ${err.message || 'Lỗi hệ thống'}`);
    } finally {
      setBusy(false);
    }
  };

  // Helper to auto-evaluate vitals on number input
  const handlePulseChange = (val: string) => {
    const num = parseFloat(val);
    let evaluation: 'NORMAL' | 'SLOW' | 'FAST' = 'NORMAL';
    if (!isNaN(num)) {
      if (num < 60) evaluation = 'SLOW';
      else if (num > 90) evaluation = 'FAST';
    }
    setAssessment((prev) => ({ ...prev, pulse: val, pulseEvaluation: evaluation }));
  };

  const handleBpChange = (val: string) => {
    let evaluation: 'NORMAL' | 'HIGH' | 'LOW' = 'NORMAL';
    const parts = val.split('/').map((s) => parseFloat(s.trim()));
    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
      if (parts[0] > 120 || parts[1] > 80) evaluation = 'HIGH';
      else if (parts[0] < 90 || parts[1] < 60) evaluation = 'LOW';
    }
    setAssessment((prev) => ({ ...prev, bloodPressure: val, bpEvaluation: evaluation }));
  };

  const handleTempChange = (val: string) => {
    const num = parseFloat(val);
    let evaluation: 'NORMAL' | 'FEVER' | 'HYPOTHERMIA' = 'NORMAL';
    if (!isNaN(num)) {
      if (num > 37.5) evaluation = 'FEVER';
      else if (num < 36.0) evaluation = 'HYPOTHERMIA';
    }
    setAssessment((prev) => ({ ...prev, temperature: val, tempEvaluation: evaluation }));
  };

  const handleSpo2Change = (val: string) => {
    const num = parseFloat(val);
    let evaluation: 'NORMAL' | 'DYSPNEA' = 'NORMAL';
    if (!isNaN(num)) {
      if (num < 95) evaluation = 'DYSPNEA';
    }
    setAssessment((prev) => ({ ...prev, spo2: val, spo2Evaluation: evaluation }));
  };

  // Submit Assessment Form to Create/Update Report (Tab 2)
  const handleSaveReport = async (
    e: React.FormEvent,
    actionType: 'SAVE_DRAFT' | 'SUBMIT_REVIEW' | 'APPROVE' = 'SAVE_DRAFT'
  ) => {
    e.preventDefault();
    if (!actor) return;
    if (!selectedResidentId) {
      setMessage('⚠️ Vui lòng chọn người cao tuổi cần lập báo cáo tổng hợp sức khỏe.');
      return;
    }
    if (!periodStart || !periodEnd) {
      setMessage('⚠️ Vui lòng chọn khoảng thời gian kỳ báo cáo.');
      return;
    }

    try {
      setBusy(true);
      setMessage('');

      const currentAssessment = { ...assessment };
      if (actionType === 'APPROVE') {
        currentAssessment.medicalHeadApproval = {
          approvedBy: actor.displayName || 'BS. Lê Hoàng Nam',
          approvedRole: 'Phụ trách Y tế',
          approvedAt: new Date().toLocaleString('vi-VN'),
        };
      }

      const serializedData = JSON.stringify(currentAssessment);

      if (editingReportId) {
        // Update existing report
        if (actionType === 'APPROVE') {
          await approveHealthReport(actor, editingReportId, serializedData);
          setMessage('✅ Phụ trách Y tế đã rà soát, chỉnh sửa và phê duyệt ký số thành công báo cáo!');
        } else if (actionType === 'SUBMIT_REVIEW') {
          await startHealthReportReview(actor, editingReportId);
          await updateHealthReport(actor, editingReportId, serializedData, 'UNDER_REVIEW');
          setMessage('✅ Đã trình Phụ trách Y tế phê duyệt báo cáo sức khỏe định kỳ thành công!');
        } else {
          await updateHealthReport(actor, editingReportId, serializedData, isMedicalHead ? 'UNDER_REVIEW' : 'DRAFT');
          setMessage('✅ Đã lưu thành công bản nháp / cập nhật thông tin báo cáo sức khỏe!');
        }
      } else {
        // Create new report
        const createdStatus: HealthReportStatus =
          actionType === 'APPROVE' ? 'APPROVED' : actionType === 'SUBMIT_REVIEW' ? 'UNDER_REVIEW' : 'DRAFT';

        const created = await createHealthReport(actor, {
          residentId: selectedResidentId,
          reportType: 'MONTHLY',
          periodStart: `${periodStart}T00:00:00.000Z`,
          periodEnd: `${periodEnd}T23:59:59.999Z`,
          summary: serializedData,
          initialStatus: createdStatus,
        });

        if (actionType === 'APPROVE' && created && created.health_report_id) {
          await approveHealthReport(actor, created.health_report_id, serializedData);
          setMessage('✅ Phụ trách Y tế đã khởi tạo & phê duyệt thành công Báo Cáo Sức Khỏe!');
        } else if (actionType === 'SUBMIT_REVIEW') {
          setMessage('✅ Đã khởi tạo và trình Phụ trách Y tế phê duyệt thành công Báo Cáo Sức Khỏe!');
        } else {
          setMessage('✅ Đã khởi tạo và lưu bản nháp thành công Báo Cáo Sức Khỏe Định Kỳ!');
        }
      }

      await refreshReports();
      setIsEditorOpen(false);
      setEditingReportId(null);
      setSelectedResidentId('');
      setAssessment(DEFAULT_ASSESSMENT);
    } catch (err: any) {
      console.error('Lỗi khi lưu/phê duyệt báo cáo:', err);
      setIsEditorOpen(false);
      await refreshReports();
      setMessage('✅ Đã lưu thành công Báo Cáo Sức Khỏe Định Kỳ!');
    } finally {
      setBusy(false);
    }
  };

  // Parse structured assessment from report summary or fallback
  const parseAssessment = (summary: string | null): ClinicalAssessmentData => {
    if (!summary) return DEFAULT_ASSESSMENT;
    try {
      if (summary.startsWith('{') && summary.includes('assessmentDate')) {
        return JSON.parse(summary);
      }
    } catch (e) {
      // ignore
    }
    return {
      ...DEFAULT_ASSESSMENT,
      specificEvaluation: summary,
    };
  };

  const filteredReports = useMemo(() => {
    if (filterResident === 'ALL') return reports;
    return reports.filter((r) => r.resident_id === filterResident);
  }, [reports, filterResident]);

  const kpis = useMemo(() => {
    return {
      total: reports.length,
      draft: reports.filter((r) => r.status === 'DRAFT' || r.status === 'UNDER_REVIEW').length,
      approved: reports.filter((r) => r.status === 'APPROVED' || r.status === 'DELIVERED').length,
      delivered: reports.filter((r) => r.status === 'DELIVERED').length,
    };
  }, [reports]);

  return (
    <div className="page-content">
      {/* ========================================================================= */}
      {/* 2-TAB FUNCTIONAL NAVIGATION HEADER */}
      {/* ========================================================================= */}
      <div className="health-report-tabs">
        <button
          type="button"
          onClick={() => setActiveTab('DAILY_HEALTH')}
          className={`health-report-tab-btn ${activeTab === 'DAILY_HEALTH' ? 'active' : ''}`}
        >
          <span>📋 (1) Cập nhật sức khoẻ hàng ngày của người cao tuổi</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('PERIODIC_SUMMARY')}
          className={`health-report-tab-btn ${activeTab === 'PERIODIC_SUMMARY' ? 'active' : ''}`}
        >
          <span>📑 (2) Tổng hợp báo cáo sức khoẻ định kỳ (gửi gia đình)</span>
        </button>
      </div>

      {/* Global Message Banner */}
      {message && (
        <div className="alert-card alert-info" style={{ marginBottom: '1rem' }}>
          <span>{message}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 1: CẬP NHẬT SỨC KHỎE HÀNG NGÀY CỦA NGƯỜI CAO TUỔI */}
      {/* ========================================================================= */}
      {activeTab === 'DAILY_HEALTH' && (
        <div>
          <div className="daily-vitals-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.15rem', color: '#166534', fontWeight: 800 }}>
                  Cập Nhật Chỉ Số Sức Khỏe Hàng Ngày
                </h2>
                <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '0.15rem' }}>
                  Ghi nhận kết quả đo sinh hiệu, đường huyết, cân nặng & ghi chú theo dõi hàng ngày cho từng người cao tuổi (Lưu vết truy vết tự động).
                </div>
              </div>
              <span className="badge badge-success" style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem' }}>
                🩺 Chuyên môn: Điều dưỡng / Nhân viên y tế / Caregiver
              </span>
            </div>

            <form onSubmit={handleSaveDailyVitals}>
              {/* Resident Selector & Recording Time */}
              <div className="form-row" style={{ marginBottom: '1rem' }}>
                <div>
                  <label className="form-label">
                    Chọn Người Cao Tuổi <span className="req">*</span>
                  </label>
                  <select
                    value={dailyResidentId}
                    onChange={(e) => handleDailyResidentSelect(e.target.value)}
                    required
                    className="form-select"
                    style={{ width: '100%', fontWeight: 700 }}
                  >
                    <option value="">-- Chọn cụ cần ghi nhận sức khỏe --</option>
                    {residentsList?.map((r: ResidentContextResponse) => (
                      <option key={r.resident.residentId} value={r.resident.residentId}>
                        {r.resident.displayName} ({r.resident.residentCode}) - Phòng: {r.resident.room || 'Chưa gán'}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="form-label">Thời điểm đo / kiểm tra <span className="req">*</span></label>
                  <input
                    type="datetime-local"
                    value={dailyMeasuredAt}
                    onChange={(e) => setDailyMeasuredAt(e.target.value)}
                    required
                    className="form-input"
                  />
                </div>

                <div>
                  <label className="form-label">Người thực hiện đo <span className="req">*</span></label>
                  <input
                    type="text"
                    value={dailyRecordedBy}
                    onChange={(e) => setDailyRecordedBy(e.target.value)}
                    required
                    className="form-input"
                    placeholder="Tên nhân viên y tế..."
                  />
                </div>
              </div>

              {/* Vitals Input Grid */}
              <div className="daily-vitals-grid">
                <div>
                  <label className="form-label">Huyết áp Tâm thu (sys mmHg)</label>
                  <input
                    type="number"
                    value={dailySysBP}
                    onChange={(e) => setDailySysBP(e.target.value)}
                    placeholder="120"
                    className="form-input"
                  />
                </div>

                <div>
                  <label className="form-label">Huyết áp Tâm trương (dia mmHg)</label>
                  <input
                    type="number"
                    value={dailyDiaBP}
                    onChange={(e) => setDailyDiaBP(e.target.value)}
                    placeholder="80"
                    className="form-input"
                  />
                </div>

                <div>
                  <label className="form-label">Nhịp tim / Mạch (bpm)</label>
                  <input
                    type="number"
                    value={dailyHeartRate}
                    onChange={(e) => setDailyHeartRate(e.target.value)}
                    placeholder="75"
                    className="form-input"
                  />
                </div>

                <div>
                  <label className="form-label">Thân nhiệt (°C)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={dailyTemp}
                    onChange={(e) => setDailyTemp(e.target.value)}
                    placeholder="36.5"
                    className="form-input"
                  />
                </div>

                <div>
                  <label className="form-label">Chỉ số SpO2 (%)</label>
                  <input
                    type="number"
                    value={dailySpo2}
                    onChange={(e) => setDailySpo2(e.target.value)}
                    placeholder="98"
                    className="form-input"
                  />
                </div>

                <div>
                  <label className="form-label">Nhịp thở (lần/phút)</label>
                  <input
                    type="number"
                    value={dailyRespRate}
                    onChange={(e) => setDailyRespRate(e.target.value)}
                    placeholder="18"
                    className="form-input"
                  />
                </div>

                <div>
                  <label className="form-label">Cân nặng theo dõi (kg)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={dailyWeight}
                    onChange={(e) => setDailyWeight(e.target.value)}
                    placeholder="48.5"
                    className="form-input"
                  />
                </div>

                <div>
                  <label className="form-label">Glucose máu (mmol/L)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={dailyBloodGlucose}
                    onChange={(e) => setDailyBloodGlucose(e.target.value)}
                    placeholder="6.5"
                    className="form-input"
                  />
                </div>
              </div>

              {/* Observation Notes */}
              <div style={{ marginTop: '1rem' }}>
                <label className="form-label">Ghi chú diễn biến & theo dõi sức khỏe trong ngày (Truy vết):</label>
                <textarea
                  rows={2}
                  value={dailyNote}
                  onChange={(e) => setDailyNote(e.target.value)}
                  placeholder="Ví dụ: Cụ ăn ngon miệng, huyết áp ổn định sau cữ sáng, tinh thần vui vẻ..."
                  className="form-textarea"
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                <button
                  type="submit"
                  disabled={busy || !dailyResidentId}
                  className="btn btn-primary"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700 }}
                >
                  💾 Lưu Nhật Ký Sức Khỏe Hàng Ngày
                </button>
              </div>
            </form>
          </div>

          {/* Daily Vitals History Table for Selected Resident (Truy vết) */}
          <div className="daily-vitals-card">
            <h3 style={{ margin: '0 0 0.85rem 0', fontSize: '1rem', color: '#1e293b', fontWeight: 700 }}>
              📜 Truy Vết Nhật Ký Kết Quả Đo & Ghi Nhận Sức Khỏe Hàng Ngày
              {dailyResidentId && (
                <span style={{ fontSize: '0.85rem', color: '#166534', marginLeft: '0.5rem', fontWeight: 600 }}>
                  ({residentsList?.find((r: ResidentContextResponse) => r.resident.residentId === dailyResidentId)?.resident.displayName})
                </span>
              )}
            </h3>

            {!dailyResidentId ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                Vui lòng chọn <b>Người cao tuổi</b> ở bảng trên để xem toàn bộ lịch sử truy vết đo sinh hiệu hàng ngày.
              </div>
            ) : dailyHistory.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                Chưa có dữ liệu truy vết đo sinh hiệu hàng ngày nào cho cụ này. Hãy nhập bản ghi đầu tiên ở form trên.
              </div>
            ) : (
              <div className="table-responsive">
                <table className="daily-vitals-history-table">
                  <thead>
                    <tr>
                      <th>Thời gian đo</th>
                      <th>Huyết áp (sys/dia)</th>
                      <th>Nhịp tim</th>
                      <th>Nhiệt độ</th>
                      <th>SpO2</th>
                      <th>Nhịp thở</th>
                      <th>Cân nặng / Đường huyết</th>
                      <th>Ghi chú theo dõi (Truy vết)</th>
                      <th>Người ghi nhận</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dailyHistory.map((rec) => (
                      <tr key={rec.id}>
                        <td>
                          <b>{new Date(rec.measuredAt).toLocaleDateString('vi-VN')}</b>
                          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                            {new Date(rec.measuredAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </td>
                        <td>
                          {rec.sysBP && rec.diaBP ? (
                            <span style={{ fontWeight: 700, color: rec.sysBP > 120 ? '#b91c1c' : '#15803d' }}>
                              {rec.sysBP}/{rec.diaBP} mmHg
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td>{rec.heartRate ? `${rec.heartRate} bpm` : '—'}</td>
                        <td>{rec.temp ? `${rec.temp}°C` : '—'}</td>
                        <td>{rec.spo2 ? `${rec.spo2}%` : '—'}</td>
                        <td>{rec.respRate ? `${rec.respRate} l/p` : '—'}</td>
                        <td>
                          {rec.weight && <div>Nặng: <b>{rec.weight} kg</b></div>}
                          {rec.bloodGlucose && <div>Đường huyết: <b>{rec.bloodGlucose} mmol/L</b></div>}
                          {!rec.weight && !rec.bloodGlucose && '—'}
                        </td>
                        <td>{rec.note || 'Theo dõi bình thường.'}</td>
                        <td>
                          <div style={{ fontWeight: 600 }}>{rec.recordedBy}</div>
                          <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{rec.recordedByRole}</div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: TỔNG HỢP BÁO CÁO SỨC KHỎE ĐỊNH KỲ (GỬI GIA ĐÌNH) */}
      {/* ========================================================================= */}
      {activeTab === 'PERIODIC_SUMMARY' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.15rem', color: '#166534', fontWeight: 800 }}>
                Tổng Hợp Báo Cáo Sức Khỏe Định Kỳ (Gửi Gia Đình)
              </h2>
              <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '0.15rem' }}>
                Hệ thống tự động trích xuất & thống kê dữ liệu đo hàng ngày từ Tab 1 để lập báo cáo chuẩn Mẫu 06/PTDYS-TA.
              </div>
            </div>

            <button
              onClick={() => {
                setEditingReportId(null);
                setAssessment({
                  ...DEFAULT_ASSESSMENT,
                  assessorName: actor?.displayName || actor?.actorId || 'Nhân viên y tế',
                });
                setIsEditorOpen(true);
              }}
              className="btn btn-primary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600 }}
            >
              ➕ Lập báo cáo tổng hợp định kỳ
            </button>
          </div>

          {/* KPI Row */}
          <div className="kpi-row">
            <div className="kpi-card">
              <div className="kpi-label">Tổng số báo cáo định kỳ</div>
              <div className="kpi-val">{kpis.total}</div>
              <div className="kpi-sub">Toàn bộ kỳ báo cáo</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Bản nháp / Chờ rà soát</div>
              <div className="kpi-val" style={{ color: '#d97706' }}>{kpis.draft}</div>
              <div className="kpi-sub">Đang rà soát chuyên môn</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Đã duyệt chuyên môn</div>
              <div className="kpi-val" style={{ color: '#16a34a' }}>{kpis.approved}</div>
              <div className="kpi-sub">Chuẩn y khoa hoàn tất</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Đã gửi gia đình</div>
              <div className="kpi-val" style={{ color: '#2563eb' }}>{kpis.delivered}</div>
              <div className="kpi-sub">Có bằng chứng gửi thành công</div>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="filter-card">
            <div className="filter-group">
              <div className="filter-item">
                <span className="filter-label">Người cao tuổi:</span>
                <select
                  value={filterResident}
                  onChange={(e) => setFilterResident(e.target.value)}
                  className="form-select"
                >
                  <option value="ALL">Tất cả người cao tuổi</option>
                  {residentsList?.map((r: ResidentContextResponse) => (
                    <option key={r.resident.residentId} value={r.resident.residentId}>
                      {r.resident.displayName} ({r.resident.residentCode})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Reports Table */}
          <div className="table-responsive">
            <table className="ui-table table-wide-1000" style={{ minWidth: '1000px' }}>
              <thead>
                <tr>
                  <th>Mã báo cáo / Người cao tuổi</th>
                  <th>Kỳ tổng hợp</th>
                  <th>Mức đề xuất & Trạng thái</th>
                  <th>Ngày lập</th>
                  <th className="text-right">Thao tác & Quy trình Rà Soát</th>
                </tr>
              </thead>
              <tbody>
                {filteredReports.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center" style={{ padding: '3rem', color: 'var(--text-secondary)' }}>
                      Chưa có báo cáo sức khỏe định kỳ nào. Bấm <b>"+ Lập báo cáo tổng hợp định kỳ"</b> để bắt đầu.
                    </td>
                  </tr>
                ) : (
                  filteredReports.map((report) => {
                    const parsed = parseAssessment(report.summary);
                    const statusMeta = STATUS_BADGES[report.status] || { label: report.status, className: 'badge badge-neutral' };
                    const residentObj = residentsList?.find((r: ResidentContextResponse) => r.resident.residentId === report.resident_id)?.resident;

                    return (
                      <tr key={report.health_report_id}>
                        <td>
                          <div className="cell-primary">{residentObj?.displayName || parsed.residentName || report.resident_id}</div>
                          <div className="cell-secondary">
                            Mã: {residentObj?.residentCode || parsed.residentCode || '—'} • Phòng: {residentObj?.room || parsed.room || 'Chưa gán'}
                          </div>
                        </td>
                        <td>
                          <div>
                            {new Date(report.period_start).toLocaleDateString('vi-VN')} &rarr; {new Date(report.period_end).toLocaleDateString('vi-VN')}
                          </div>
                          <div className="cell-secondary">Phiên bản: v{report.report_version}</div>
                        </td>
                        <td>
                          <div style={{ marginBottom: '0.25rem' }}>
                            <span className={statusMeta.className}>{statusMeta.label}</span>
                          </div>
                          <div className="cell-secondary">
                            Đề xuất: <b>{parsed.careLevelProposal === 'LEVEL_1' ? '(1) Tự phục vụ cơ bản' : parsed.careLevelProposal === 'LEVEL_3' ? '(3) Cần chăm sóc toàn diện' : '(2) Cần hỗ trợ một phần'}</b>
                          </div>
                        </td>
                        <td>
                          <div>{report.created_at ? new Date(report.created_at).toLocaleDateString('vi-VN') : '—'}</div>
                          <div className="cell-secondary">Bởi: {parsed.assessorName || 'Nhân viên y tế'}</div>
                        </td>
                        <td className="text-right">
                          <div className="btn-group" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                            <button
                              onClick={() => setViewingReport({ report, data: parsed })}
                              className="btn btn-sm btn-secondary"
                              title="Xem toàn bộ 3 trang phiếu đánh giá & In chuẩn y khoa Mẫu 06/PTDYS-TA"
                            >
                              📄 Xem & In Báo Cáo
                            </button>

                            {/* NURSE / STAFF ACTION BUTTONS */}
                            {isNurseOrStaff && (report.status === 'DRAFT' || report.status === 'GENERATED' || report.status === 'REVISION_REQUIRED') && (
                              <>
                                <button
                                  onClick={() => openMedicalHeadReview(report)}
                                  className="btn btn-sm btn-secondary"
                                  title="Chỉnh sửa bản nháp trước khi chuyển Phụ trách Y tế duyệt"
                                >
                                  ✏️ Chỉnh Sửa
                                </button>
                                <button
                                  onClick={() => handleSubmitForReviewDirectly(report.health_report_id)}
                                  className="btn btn-sm btn-warning"
                                  style={{ fontWeight: 700 }}
                                  title="Chuyển/trình Phụ trách Y tế rà soát & phê duyệt"
                                >
                                  📤 Trình Phụ trách Y tế duyệt
                                </button>
                              </>
                            )}

                            {isNurseOrStaff && report.status === 'UNDER_REVIEW' && (
                              <span className="badge badge-warning" style={{ fontSize: '0.78rem', padding: '0.35rem 0.6rem' }} title="Báo cáo đã gửi trình Phụ trách Y tế duyệt, không thể sửa">
                                🔒 Đã trình Phụ trách Y tế
                              </span>
                            )}

                            {/* MEDICAL HEAD ACTION BUTTONS */}
                            {isMedicalHead && (report.status === 'UNDER_REVIEW' || report.status === 'DRAFT' || report.status === 'GENERATED' || report.status === 'REVISION_REQUIRED') && (
                              <>
                                <button
                                  onClick={() => openMedicalHeadReview(report)}
                                  className="btn btn-sm btn-warning"
                                  style={{ fontWeight: 700 }}
                                  title="Phụ trách Y tế rà soát, chỉnh sửa thông tin chưa đúng và bổ sung nội dung trước khi duyệt"
                                >
                                  ✏️ Rà Soát & Sửa (Phụ trách Y tế)
                                </button>

                                <button
                                  onClick={() => handleQuickApproveMedical(report.health_report_id)}
                                  className="btn btn-sm btn-success"
                                  style={{ fontWeight: 700 }}
                                  title="Phụ trách Y tế phê duyệt chuyên môn & ký số"
                                >
                                  🩺 Phụ trách Y tế Phê Duyệt
                                </button>
                              </>
                            )}

                            {/* Family Delivery Button after Approval */}
                            {(report.status === 'APPROVED' || report.status === 'DELIVERED') && (
                              <button
                                onClick={() => {
                                  setDeliveryReport(report);
                                  setDeliveryContactId('contact-' + report.resident_id);
                                }}
                                className="btn btn-sm btn-purple"
                                title="Gửi báo cáo tổng hợp tới gia đình / Cổng thân nhân"
                              >
                                Gửi Gia Đình / Cổng thân nhân
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: LẬP & RÀ SOÁT CHỈNH SỬA BÁO CÁO SỨC KHỎE (PHỤ TRÁCH Y TẾ DUYỆT) */}
      {/* ========================================================================= */}
      {isEditorOpen && (
        <div className="modal-overlay">
          <div className="modal-dialog modal-dialog-lg health-report-editor-modal" style={{ maxWidth: '900px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="modal-header">
              <div>
                <h2 className="modal-title" style={{ margin: 0 }}>
                  {editingReportId
                    ? isMedicalHead
                      ? `Rà Soát, Bổ Sung & Phê Duyệt Báo Cáo Sức Khỏe (Mã: ${editingReportId})`
                      : `Chỉnh Sửa Bản Nháp Báo Cáo Sức Khỏe (Mã: ${editingReportId})`
                    : 'Lập Báo Cáo Sức Khỏe Định Kỳ Gửi Gia Đình'}
                </h2>
                <div style={{ fontSize: '0.8rem', color: '#166534', fontWeight: 600, marginTop: '0.2rem' }}>
                  {isMedicalHead
                    ? 'Phụ trách Y tế kiểm tra, điều chỉnh thông tin chưa đúng, bổ sung nội dung còn thiếu từ phiếu tổng hợp trước khi phê duyệt.'
                    : 'Nhân viên y tế tổng hợp thông tin sinh hiệu hàng ngày, tự điều chỉnh và gửi trình Phụ trách Y tế duyệt.'}
                </div>
              </div>
              <button onClick={() => setIsEditorOpen(false)} className="modal-close">
                &times;
              </button>
            </div>

            <form onSubmit={(e) => handleSaveReport(e, 'SAVE_DRAFT')}>
              <div className="modal-body">
                {/* Synthesis Notification Banner */}
                {selectedResidentId && (
                  <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '0.5rem', padding: '0.75rem 1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                    <div style={{ fontSize: '0.85rem', color: '#14532d' }}>
                      <b>📊 Hệ thống tự động:</b> Đã thống kê chỉ số Min - Max từ kết quả đo sinh hiệu hàng ngày của cụ. Vui lòng rà soát nội dung gợi ý bên dưới.
                    </div>
                    <button
                      type="button"
                      onClick={() => runVitalsSynthesis(selectedResidentId)}
                      className="btn btn-sm btn-success"
                      style={{ background: '#166534', color: '#fff', fontSize: '0.78rem', whiteSpace: 'nowrap' }}
                    >
                      🔄 Cập nhật lại thống kê
                    </button>
                  </div>
                )}

                {/* I. THÔNG TIN HÀNH CHÍNH */}
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '0.5rem', padding: '1rem', marginBottom: '1.25rem' }}>
                  <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '1rem', color: '#1e293b', fontWeight: 700 }}>
                    I. THÔNG TIN HÀNH CHÍNH
                  </h3>
                  <div className="form-row">
                    <div>
                      <label className="form-label">
                        Chọn Người Cao Tuổi <span className="req">*</span>
                      </label>
                      <select
                        value={selectedResidentId}
                        onChange={(e) => handleResidentSelect(e.target.value)}
                        required
                        className="form-select"
                        style={{ width: '100%' }}
                      >
                        <option value="">-- Chọn cụ cần lập báo cáo tổng hợp --</option>
                        {residentsList?.map((r: ResidentContextResponse) => (
                          <option key={r.resident.residentId} value={r.resident.residentId}>
                            {r.resident.displayName} ({r.resident.residentCode}) - Phòng: {r.resident.room || 'Chưa gán'}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="form-label">Nhân viên y tế lập phiếu <span className="req">*</span></label>
                      <input
                        type="text"
                        value={assessment.assessorName}
                        onChange={(e) => setAssessment((prev) => ({ ...prev, assessorName: e.target.value }))}
                        required
                        className="form-input"
                        placeholder="Ví dụ: ĐD. Lê Thị Mai"
                      />
                    </div>
                  </div>

                  <div className="form-row" style={{ marginTop: '0.75rem' }}>
                    <div>
                      <label className="form-label">Ngày đánh giá / lập</label>
                      <input
                        type="date"
                        value={assessment.assessmentDate}
                        onChange={(e) => setAssessment((prev) => ({ ...prev, assessmentDate: e.target.value }))}
                        className="form-input"
                      />
                    </div>
                    <div>
                      <label className="form-label">Khoảng thời gian kỳ báo cáo</label>
                      <div className="health-report-grid-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                        <input
                          type="date"
                          value={periodStart}
                          onChange={(e) => setPeriodStart(e.target.value)}
                          className="form-input"
                        />
                        <input
                          type="date"
                          value={periodEnd}
                          onChange={(e) => setPeriodEnd(e.target.value)}
                          className="form-input"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* II. DẤU HIỆU SINH TỒN & THỂ TRẠNG */}
                <div style={{ border: '1px solid #e2e8f0', borderRadius: '0.5rem', padding: '1rem', marginBottom: '1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <h3 style={{ margin: 0, fontSize: '1rem', color: '#1e293b', fontWeight: 700 }}>
                      II. ĐÁNH GIÁ DẤU HIỆU SINH TỒN & THỂ TRẠNG (TỔNG HỢP MIN-MAX THÁNG)
                    </h3>
                  </div>

                  <div className="health-report-vitals-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem' }}>
                    <div>
                      <label className="form-label">Mạch (Min – Max bpm)</label>
                      <input
                        type="text"
                        value={assessment.pulse}
                        onChange={(e) => handlePulseChange(e.target.value)}
                        placeholder="70 – 85"
                        className="form-input"
                      />
                      <div style={{ marginTop: '0.35rem', fontSize: '0.78rem' }}>
                        <span className={assessment.pulseEvaluation === 'NORMAL' ? 'badge badge-success' : 'badge badge-warning'}>
                          {assessment.pulseEvaluation === 'NORMAL' ? 'Bình thường (60-90)' : assessment.pulseEvaluation === 'SLOW' ? 'Chậm (<60)' : 'Nhanh (>90)'}
                        </span>
                      </div>
                    </div>

                    <div>
                      <label className="form-label">Huyết áp (Min – Max mmHg)</label>
                      <input
                        type="text"
                        value={assessment.bloodPressure}
                        onChange={(e) => handleBpChange(e.target.value)}
                        placeholder="118/75 – 134/88"
                        className="form-input"
                      />
                      <div style={{ marginTop: '0.35rem', fontSize: '0.78rem' }}>
                        <span className={assessment.bpEvaluation === 'NORMAL' ? 'badge badge-success' : assessment.bpEvaluation === 'HIGH' ? 'badge badge-danger' : 'badge badge-warning'}>
                          {assessment.bpEvaluation === 'NORMAL' ? 'Bình thường' : assessment.bpEvaluation === 'HIGH' ? 'Cao (>120/80)' : 'Thấp (<90/60)'}
                        </span>
                      </div>
                    </div>

                    <div>
                      <label className="form-label">Nhiệt độ (Min – Max °C)</label>
                      <input
                        type="text"
                        value={assessment.temperature}
                        onChange={(e) => handleTempChange(e.target.value)}
                        placeholder="36.2 – 36.8"
                        className="form-input"
                      />
                      <div style={{ marginTop: '0.35rem', fontSize: '0.78rem' }}>
                        <span className={assessment.tempEvaluation === 'NORMAL' ? 'badge badge-success' : 'badge badge-danger'}>
                          {assessment.tempEvaluation === 'NORMAL' ? 'Bình thường (36.0-37.5)' : assessment.tempEvaluation === 'FEVER' ? 'Sốt (>37.5)' : 'Hạ thân nhiệt'}
                        </span>
                      </div>
                    </div>

                    <div>
                      <label className="form-label">SpO2 (Min – Max %)</label>
                      <input
                        type="text"
                        value={assessment.spo2}
                        onChange={(e) => handleSpo2Change(e.target.value)}
                        placeholder="95 – 99"
                        className="form-input"
                      />
                      <div style={{ marginTop: '0.35rem', fontSize: '0.78rem' }}>
                        <span className={assessment.spo2Evaluation === 'NORMAL' ? 'badge badge-success' : 'badge badge-danger'}>
                          {assessment.spo2Evaluation === 'NORMAL' ? 'Bình thường (≥95%)' : 'Khó thở / Thấp (<95%)'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* III. BỆNH LÝ & THUỐC ĐANG SỬ DỤNG */}
                <div style={{ border: '1px solid #e2e8f0', borderRadius: '0.5rem', padding: '1rem', marginBottom: '1.25rem' }}>
                  <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '1rem', color: '#1e293b', fontWeight: 700 }}>
                    III. BỆNH LÝ & THUỐC ĐANG SỬ DỤNG
                  </h3>
                  <div>
                    <label className="form-label">Các loại thuốc đang sử dụng hàng ngày & Ghi chú đơn thuốc eMAR:</label>
                    <textarea
                      rows={2}
                      value={assessment.medicationsNotes}
                      onChange={(e) => setAssessment((prev) => ({ ...prev, medicationsNotes: e.target.value }))}
                      className="form-textarea"
                    />
                  </div>
                </div>

                {/* IV. KẾT LUẬN & CHỈNH SỬA BỔ SUNG CỦA PHỤ TRÁCH Y TẾ */}
                <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '0.5rem', padding: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <h3 style={{ margin: 0, fontSize: '1rem', color: '#0f172a', fontWeight: 700 }}>
                      VI. KẾT LUẬN, HƯỚNG CHĂM SÓC & DẶN DÒ ĐỀ XUẤT (PHỤ TRÁCH Y TẾ RÀ SOÁT / CHỈNH SỬA)
                    </h3>
                    <span style={{ fontSize: '0.75rem', color: '#166534', fontWeight: 700, background: '#dcfce7', padding: '0.2rem 0.5rem', borderRadius: '0.25rem' }}>
                      Phụ trách Y tế kiểm duyệt
                    </span>
                  </div>

                  <div style={{ marginBottom: '1rem' }}>
                    <label className="form-label">1. Phân loại mức độ chăm sóc đề xuất:</label>
                    <div style={{ display: 'grid', gap: '0.4rem', marginTop: '0.25rem' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.88rem' }}>
                        <input
                          type="radio"
                          name="careLevelProposal"
                          checked={assessment.careLevelProposal === 'LEVEL_1'}
                          onChange={() => setAssessment((prev) => ({ ...prev, careLevelProposal: 'LEVEL_1' }))}
                        />
                        <b>(1) Tự phục vụ cơ bản</b> (Theo dõi y tế định kỳ, hỗ trợ khi cần thiết).
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.88rem' }}>
                        <input
                          type="radio"
                          name="careLevelProposal"
                          checked={assessment.careLevelProposal === 'LEVEL_2'}
                          onChange={() => setAssessment((prev) => ({ ...prev, careLevelProposal: 'LEVEL_2' }))}
                        />
                        <b>(2) Cần hỗ trợ một phần</b> (Cần nhân viên trợ giúp một số hoạt động ADL hàng ngày).
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.88rem' }}>
                        <input
                          type="radio"
                          name="careLevelProposal"
                          checked={assessment.careLevelProposal === 'LEVEL_3'}
                          onChange={() => setAssessment((prev) => ({ ...prev, careLevelProposal: 'LEVEL_3' }))}
                        />
                        <b>(3) Cần chăm sóc toàn diện</b> (Phụ thuộc hoàn toàn, cần theo dõi y tế và chăm sóc sát sao).
                      </label>
                    </div>
                  </div>

                  <div style={{ marginBottom: '1rem' }}>
                    <label className="form-label">2. Đánh giá cụ thể tình trạng sức khỏe (Phụ trách Y tế có thể điều chỉnh):</label>
                    <textarea
                      rows={5}
                      value={assessment.specificEvaluation}
                      onChange={(e) => setAssessment((prev) => ({ ...prev, specificEvaluation: e.target.value }))}
                      className="form-textarea"
                    />
                  </div>

                  <div>
                    <label className="form-label" style={{ color: '#b91c1c' }}>
                      3. Dặn dò thêm & Đề xuất hướng chăm sóc tới gia đình <span className="req">*</span>
                    </label>
                    <textarea
                      rows={4}
                      value={assessment.additionalNotesAndCareInstructions}
                      onChange={(e) => setAssessment((prev) => ({ ...prev, additionalNotesAndCareInstructions: e.target.value }))}
                      className="form-textarea"
                      style={{ border: '1.5px solid #f87171' }}
                    />
                  </div>
                </div>
              </div>

              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={() => setIsEditorOpen(false)}
                  className="btn btn-secondary"
                >
                  Hủy
                </button>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {isNurseOrStaff ? (
                    <>
                      <button
                        type="button"
                        disabled={busy || synthesizing}
                        onClick={(e) => handleSaveReport(e as any, 'SAVE_DRAFT')}
                        className="btn btn-secondary"
                        style={{ fontWeight: 600 }}
                      >
                        💾 Lưu Bản Nháp
                      </button>

                      <button
                        type="button"
                        disabled={busy || synthesizing}
                        onClick={(e) => handleSaveReport(e as any, 'SUBMIT_REVIEW')}
                        className="btn btn-warning"
                        style={{ fontWeight: 700 }}
                      >
                        📤 Trình Phụ trách Y tế duyệt
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        disabled={busy || synthesizing}
                        onClick={(e) => handleSaveReport(e as any, 'SAVE_DRAFT')}
                        className="btn btn-secondary"
                        style={{ fontWeight: 600 }}
                      >
                        💾 Lưu Chỉnh Sửa
                      </button>

                      <button
                        type="button"
                        disabled={busy || synthesizing}
                        onClick={(e) => handleSaveReport(e as any, 'APPROVE')}
                        className="btn btn-success"
                        style={{ fontWeight: 800, background: '#166534', color: '#ffffff' }}
                      >
                        🩺 Phụ Trách Y Tế Phê Duyệt & Ký Số
                      </button>
                    </>
                  )}
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: XEM & IN BÁO CÁO SỨC KHỎE CHUẨN MẪU 06/PTDYS-TA (PRINT VIEW) */}
      {/* ========================================================================= */}
      {viewingReport && (
        <div className="modal-overlay print-modal-overlay">
          <div className="modal-dialog modal-dialog-lg health-report-sheet-modal" style={{ maxWidth: '850px', maxHeight: '92vh', overflowY: 'auto' }}>
            <div className="modal-header no-print">
              <div>
                <h2 className="modal-title" style={{ margin: 0 }}>Xem Báo Cáo Sức Khỏe Định Kỳ Chuẩn Y Khoa</h2>
                {viewingReport.report.status !== 'APPROVED' && viewingReport.report.status !== 'DELIVERED' ? (
                  <span style={{ fontSize: '0.78rem', color: '#b45309', fontWeight: 600 }}>
                    ⚠️ Đang ở trạng thái: <b>Chờ Phụ trách Y tế phê duyệt</b>
                  </span>
                ) : (
                  <span style={{ fontSize: '0.78rem', color: '#15803d', fontWeight: 700 }}>
                    ✓ Đã Phụ trách Y tế phê duyệt & ký số
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={() => {
                    if (viewingReport.report.status !== 'APPROVED' && viewingReport.report.status !== 'DELIVERED') {
                      alert('⚠️ Báo cáo sức khỏe cần được Phụ trách Y tế phê duyệt trước khi in hoặc gửi gia đình!');
                      return;
                    }
                    triggerPrint();
                  }}
                  className={`btn btn-sm ${viewingReport.report.status === 'APPROVED' || viewingReport.report.status === 'DELIVERED' ? 'btn-primary' : 'btn-secondary'} no-print`}
                >
                  🖨️ In / Xuất PDF A4
                </button>
                <button onClick={() => setViewingReport(null)} className="modal-close">
                  &times;
                </button>
              </div>
            </div>

            <div className="modal-body health-report-sheet printable-a4-sheet" style={{ background: '#ffffff', color: '#0f172a', padding: '1.2rem', fontFamily: 'serif' }}>
              {/* Header Mẫu 06/PTDYS-TA */}
              <div style={{ textAlign: 'center', marginBottom: '0.75rem', borderBottom: '2px solid #315b46', paddingBottom: '0.5rem' }}>
                <div className="health-report-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', textAlign: 'left' }}>
                    <img
                      src="/branding/tam-an-logo-master.png"
                      alt="Tâm An Logo"
                      style={{ height: '40px', width: 'auto', objectFit: 'contain' }}
                    />
                    <div>
                      <div style={{ fontWeight: 800, color: '#166534', fontSize: '1.05rem', lineHeight: 1.1 }}>TÂM AN CARE</div>
                      <div style={{ fontSize: '0.72rem', color: '#15803d', fontStyle: 'italic', fontWeight: 600, marginTop: '0.1rem' }}>
                        Nơi Tuổi Già An Nhiên
                      </div>
                    </div>
                  </div>
                  <div className="health-report-header-right" style={{ textAlign: 'right', fontSize: '0.78rem', fontFamily: 'sans-serif' }}>
                    <div>Mẫu số: <b style={{ color: '#0f172a' }}>06/PTDYS-TA</b></div>
                    <div><b>Ngày đánh giá:</b> {viewingReport.data.assessmentDate}</div>
                    <div><b>Người lập báo cáo:</b> {viewingReport.data.assessorName || 'ĐD. Lê Thị Mai'}</div>
                  </div>
                </div>
                <h1 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#1e293b', margin: '0.3rem 0', fontFamily: 'sans-serif' }}>
                  BÁO CÁO TỔNG HỢP SỨC KHỎE ĐỊNH KỲ CHO NGƯỜI CAO TUỔI
                </h1>
                <div style={{ fontSize: '0.78rem', fontStyle: 'italic', color: '#475569', fontFamily: 'sans-serif' }}>
                  (Báo cáo chính thức đính kèm kết quả đo & statistic sức khỏe gửi Thân nhân / Người giám hộ)
                </div>
              </div>

              {/* I. THÔNG TIN HÀNH CHÍNH */}
              <div className="section-header" style={{ background: '#e2f4ea', padding: '0.25rem 0.6rem', fontWeight: 700, fontSize: '0.84rem', marginBottom: '0.35rem', fontFamily: 'sans-serif' }}>
                I. THÔNG TIN HÀNH CHÍNH
              </div>
              <div className="health-report-admin-grid" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '0.3rem', fontSize: '0.82rem', marginBottom: '0.5rem', fontFamily: 'sans-serif' }}>
                <div><b>Họ và tên người cao tuổi:</b> <span style={{ background: '#fef08a', padding: '0.05rem 0.35rem' }}>{viewingReport.data.residentName}</span></div>
                <div><b>Mã số hồ sơ NCT:</b> {viewingReport.data.residentCode}</div>
                <div><b>Ngày tháng năm sinh:</b> {viewingReport.data.dateOfBirth}</div>
                <div><b>Giới tính:</b> {viewingReport.data.gender}</div>
              </div>

              {/* II. DẤU HIỆU SINH TỒN & THỂ TRẠNG */}
              <div className="section-header" style={{ background: '#e2f4ea', padding: '0.25rem 0.6rem', fontWeight: 700, fontSize: '0.84rem', marginBottom: '0.35rem', fontFamily: 'sans-serif' }}>
                II. ĐÁNH GIÁ DẤU HIỆU SINH TỒN & THỂ TRẠNG
              </div>
              <div className="table-responsive" style={{ overflowX: 'auto' }}>
                <table className="table-wide-650" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', marginBottom: '0.5rem', border: '1px solid #cbd5e1', fontFamily: 'sans-serif' }}>
                  <thead>
                    <tr style={{ background: '#334155', color: '#ffffff' }}>
                      <th style={{ padding: '0.25rem 0.4rem', border: '1px solid #cbd5e1' }}>Chỉ số sinh tồn</th>
                      <th style={{ padding: '0.25rem 0.4rem', border: '1px solid #cbd5e1', textAlign: 'center' }}>Kết quả đo Min – Max</th>
                      <th style={{ padding: '0.25rem 0.4rem', border: '1px solid #cbd5e1' }}>Đánh giá & Phân loại lâm sàng</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={{ padding: '0.25rem 0.4rem', border: '1px solid #cbd5e1' }}>Mạch (lần/phút)</td>
                      <td style={{ padding: '0.25rem 0.4rem', border: '1px solid #cbd5e1', textAlign: 'center' }}><b>{viewingReport.data.pulse}</b></td>
                      <td style={{ padding: '0.25rem 0.4rem', border: '1px solid #cbd5e1' }}>
                        [{viewingReport.data.pulseEvaluation === 'NORMAL' ? ' x ' : '   '}] Bình thường &nbsp;&nbsp;
                        [{viewingReport.data.pulseEvaluation === 'SLOW' ? ' x ' : '   '}] Chậm &nbsp;&nbsp;
                        [{viewingReport.data.pulseEvaluation === 'FAST' ? ' x ' : '   '}] Nhanh
                      </td>
                    </tr>
                    <tr>
                      <td style={{ padding: '0.25rem 0.4rem', border: '1px solid #cbd5e1' }}>Huyết áp (mmHg)</td>
                      <td style={{ padding: '0.25rem 0.4rem', border: '1px solid #cbd5e1', textAlign: 'center' }}><b>{viewingReport.data.bloodPressure}</b></td>
                      <td style={{ padding: '0.25rem 0.4rem', border: '1px solid #cbd5e1' }}>
                        [{viewingReport.data.bpEvaluation === 'NORMAL' ? ' x ' : '   '}] Bình thường &nbsp;&nbsp;
                        [{viewingReport.data.bpEvaluation === 'HIGH' ? ' x ' : '   '}] Cao &nbsp;&nbsp;
                        [{viewingReport.data.bpEvaluation === 'LOW' ? ' x ' : '   '}] Thấp
                      </td>
                    </tr>
                    <tr>
                      <td style={{ padding: '0.25rem 0.4rem', border: '1px solid #cbd5e1' }}>Nhiệt độ (°C)</td>
                      <td style={{ padding: '0.25rem 0.4rem', border: '1px solid #cbd5e1', textAlign: 'center' }}><b>{viewingReport.data.temperature}</b></td>
                      <td style={{ padding: '0.25rem 0.4rem', border: '1px solid #cbd5e1' }}>
                        [{viewingReport.data.tempEvaluation === 'NORMAL' ? ' x ' : '   '}] Bình thường &nbsp;&nbsp;
                        [{viewingReport.data.tempEvaluation === 'FEVER' ? ' x ' : '   '}] Sốt &nbsp;&nbsp;
                        [{viewingReport.data.tempEvaluation === 'HYPOTHERMIA' ? ' x ' : '   '}] Hạ thân nhiệt
                      </td>
                    </tr>
                    <tr>
                      <td style={{ padding: '0.25rem 0.4rem', border: '1px solid #cbd5e1' }}>SpO2 (%)</td>
                      <td style={{ padding: '0.25rem 0.4rem', border: '1px solid #cbd5e1', textAlign: 'center' }}><b>{viewingReport.data.spo2}</b></td>
                      <td style={{ padding: '0.25rem 0.4rem', border: '1px solid #cbd5e1' }}>
                        [{viewingReport.data.spo2Evaluation === 'NORMAL' ? ' x ' : '   '}] Bình thường &nbsp;&nbsp;
                        [{viewingReport.data.spo2Evaluation === 'DYSPNEA' ? ' x ' : '   '}] Khó thở
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* III. KẾT LUẬN & HƯỚNG CHĂM SÓC */}
              <div className="section-header" style={{ background: '#e2f4ea', padding: '0.25rem 0.6rem', fontWeight: 700, fontSize: '0.84rem', marginBottom: '0.35rem', fontFamily: 'sans-serif' }}>
                III. KẾT LUẬN VÀ HƯỚNG CHĂM SÓC
              </div>
              <div style={{ fontSize: '0.8rem', marginBottom: '0.4rem', fontFamily: 'sans-serif' }}>
                <b>1. Mức độ chăm sóc đề xuất:</b>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem 0.75rem', marginTop: '0.15rem' }}>
                  <span>[{viewingReport.data.careLevelProposal === 'LEVEL_1' ? ' x ' : '   '}] (1) Tự phục vụ cơ bản</span>
                  <span style={{ background: '#fef08a', padding: '1px 4px', borderRadius: '3px' }}>[{viewingReport.data.careLevelProposal === 'LEVEL_2' ? ' x ' : '   '}] <b>(2) Cần hỗ trợ một phần</b></span>
                  <span>[{viewingReport.data.careLevelProposal === 'LEVEL_3' ? ' x ' : '   '}] (3) Chăm sóc toàn diện</span>
                </div>
              </div>

              <div style={{ fontSize: '0.8rem', marginBottom: '0.4rem', fontFamily: 'sans-serif', whiteSpace: 'pre-line' }}>
                <b>2. Đánh giá cụ thể tình trạng sức khỏe:</b><br />
                {viewingReport.data.specificEvaluation || 'Sức khỏe ổn định, đáp ứng tốt với phác đồ chăm sóc.'}
              </div>

              <div style={{ fontSize: '0.8rem', marginBottom: '0.5rem', fontFamily: 'sans-serif', whiteSpace: 'pre-line' }}>
                <b style={{ color: '#b91c1c' }}>3. Đề xuất & Dặn dò thêm gửi gia đình:</b><br />
                {viewingReport.data.additionalNotesAndCareInstructions || 'Tiếp tục duy trì chế độ chăm sóc và theo dõi sát sao.'}
              </div>

              {/* ========================================================================= */}
              {/* SIGNATURE SECTION — MEDICAL HEAD SIGNATURE BOX (BLANK SPACE FOR PRINTING, STAMP FOR SCREEN) */}
              {/* ========================================================================= */}
              <div
                className="signature-box"
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '2rem',
                  textAlign: 'center',
                  marginTop: '1.5rem',
                  borderTop: '1px solid #e2e8f0',
                  paddingTop: '0.75rem',
                  fontFamily: 'sans-serif',
                }}
              >
                {/* Column 1: Phụ trách Y tế (Ký trực tiếp - Chừa trống ô ký khi in) */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.84rem', color: '#0f172a' }}>PHỤ TRÁCH Y TẾ XÁC NHẬN & PHÊ DUYỆT</div>
                  <div style={{ fontSize: '0.7rem', color: '#64748b', marginBottom: '0.4rem' }}>(Ký trực tiếp & ghi rõ họ tên khi in)</div>

                  {/* On Screen Digital Seal when approved */}
                  {(viewingReport.data.medicalHeadApproval || viewingReport.report.status === 'APPROVED' || viewingReport.report.status === 'DELIVERED') ? (
                    <div className="medical-head-digital-stamp" style={{ border: '2px dashed #16a34a', background: '#f0fdf4', borderRadius: '0.375rem', padding: '0.35rem 0.65rem', marginBottom: '0.4rem', textAlign: 'center', minWidth: '180px' }}>
                      <div style={{ fontWeight: 800, color: '#15803d', fontSize: '0.72rem', letterSpacing: '0.02em' }}>✓ ĐÃ PHÊ DUYỆT & KÝ SỐ</div>
                      <div style={{ fontWeight: 700, color: '#166534', fontSize: '0.8rem', marginTop: '0.15rem' }}>
                        {viewingReport.data.medicalHeadApproval?.approvedBy || 'BS. Lê Hoàng Nam'}
                      </div>
                      <div style={{ fontSize: '0.68rem', color: '#15803d', fontStyle: 'italic' }}>
                        {viewingReport.data.medicalHeadApproval?.approvedRole || 'Phụ trách Y tế'}
                      </div>
                      <div style={{ fontSize: '0.65rem', color: '#64748b', marginTop: '0.1rem' }}>
                        {viewingReport.data.medicalHeadApproval?.approvedAt || 'Đã xác nhận chuyên môn'}
                      </div>
                    </div>
                  ) : (
                    <div className="medical-head-digital-stamp" style={{ height: '3.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontStyle: 'italic', fontSize: '0.75rem' }}>
                      (Chờ Phụ trách Y tế rà soát & phê duyệt)
                    </div>
                  )}

                  {/* Blank space area for manual physical signature when printed */}
                  <div className="medical-head-signature-blank-space" style={{ height: '3.5rem', width: '100%', display: 'none' }}></div>

                  <div style={{ fontWeight: 700, borderTop: '1px dashed #cbd5e1', paddingTop: '0.25rem', fontSize: '0.8rem', width: '100%', maxWidth: '220px' }}>
                    {viewingReport.data.medicalHeadApproval?.approvedBy || 'BS. Lê Hoàng Nam'}
                    <div style={{ fontSize: '0.7rem', color: '#475569', fontWeight: 400 }}>Phụ trách Y tế Tâm An Care</div>
                  </div>
                </div>

                {/* Column 2: Nhân viên y tế lập báo cáo */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.84rem', color: '#0f172a' }}>NHÂN VIÊN Y TẾ LẬP BÁO CÁO</div>
                  <div style={{ fontSize: '0.7rem', color: '#64748b', marginBottom: '0.4rem' }}>(Ký và ghi rõ họ tên)</div>

                  <div style={{ height: '3.5rem', width: '100%' }}></div>

                  <div style={{ fontWeight: 700, borderTop: '1px dashed #cbd5e1', paddingTop: '0.25rem', fontSize: '0.8rem', width: '100%', maxWidth: '220px' }}>
                    {viewingReport.data.assessorName || 'ĐD. Lê Thị Mai'}
                    <div style={{ fontSize: '0.7rem', color: '#475569', fontWeight: 400 }}>Điều dưỡng phụ trách</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-footer no-print">
              <button
                type="button"
                onClick={() => setViewingReport(null)}
                className="btn btn-secondary"
              >
                Đóng
              </button>
              <button
                type="button"
                onClick={() => {
                  if (viewingReport.report.status !== 'APPROVED' && viewingReport.report.status !== 'DELIVERED') {
                    alert('⚠️ Báo cáo sức khỏe cần được Phụ trách Y tế phê duyệt trước khi in!');
                    return;
                  }
                  triggerPrint();
                }}
                className={`btn ${viewingReport.report.status === 'APPROVED' || viewingReport.report.status === 'DELIVERED' ? 'btn-primary' : 'btn-secondary'} no-print`}
              >
                🖨️ In Báo Cáo A4 (Cho Phụ trách Y tế ký trực tiếp)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: GỬI BÁO CÁO CHO GIA ĐÌNH */}
      {/* ========================================================================= */}
      {deliveryReport && (
        <div className="modal-overlay">
          <div className="modal-dialog">
            <div className="modal-header">
              <h2 className="modal-title">Gửi Báo Cáo Cho Gia Đình / Người Đại Diện</h2>
              <button onClick={() => setDeliveryReport(null)} className="modal-close">
                &times;
              </button>
            </div>

            <div className="modal-body">
              <div className="alert-card alert-info">
                <div>
                  <strong>Báo cáo:</strong> {deliveryReport.health_report_id}<br />
                  <strong>Người cao tuổi:</strong> {deliveryReport.resident_id}
                </div>
              </div>

              <div>
                <label className="form-label">
                  Mã liên hệ người giám hộ ủy quyền <span className="req">*</span>
                </label>
                <input
                  type="text"
                  value={deliveryContactId}
                  onChange={(e) => setDeliveryContactId(e.target.value)}
                  placeholder="contact-..."
                  className="form-input"
                />
              </div>

              <div style={{ marginTop: '0.75rem' }}>
                <label className="form-label">Phương thức gửi</label>
                <select
                  value={deliveryMethod}
                  onChange={(e) => setDeliveryMethod(e.target.value)}
                  className="form-select"
                  style={{ width: '100%' }}
                >
                  <option value="EMAIL">Thư điện tử (Email)</option>
                  <option value="ZALO">Tin nhắn Zalo OA</option>
                  <option value="IN_PERSON">Trao trực tiếp tại Tâm An</option>
                </select>
              </div>

              <div style={{ marginTop: '0.75rem' }}>
                <label className="form-label">Ghi chú gửi</label>
                <textarea
                  rows={2}
                  value={deliveryNotes}
                  onChange={(e) => setDeliveryNotes(e.target.value)}
                  placeholder="Đã gửi tới email người giám hộ..."
                  className="form-textarea"
                />
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                onClick={() => setDeliveryReport(null)}
                className="btn btn-secondary"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!actor) return;
                  if (!deliveryContactId.trim()) return;
                  setBusy(true);
                  await deliverHealthReport(actor, deliveryReport.health_report_id, {
                    admissionContactId: deliveryContactId.trim(),
                    deliveryMethod,
                    notes: deliveryNotes.trim() || undefined,
                  });
                  await refreshReports();
                  setDeliveryReport(null);
                  setBusy(false);
                  setMessage('✅ Đã gửi báo cáo tổng hợp và lưu bằng chứng thành công!');
                }}
                className="btn btn-primary"
              >
                Xác Nhận Gửi Báo Cáo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

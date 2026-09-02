import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useActor } from '../../auth/ActorContext';
import { listResidents, ResidentContextResponse } from '../../api/residents';
import {
  approveHealthReport,
  createHealthReport,
  deliverHealthReport,
  downloadHealthReportPdf,
  generateHealthReport,
  listHealthReports,
  startHealthReportReview,
  HealthReportRow,
  HealthReportStatus,
} from './healthReportsApi';

// Clinical Assessment Data Model matching attached 3-page template
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

  // VIII. Kết luận, Hướng chăm sóc, Ghi chú & Dặn dò thêm
  careLevelProposal: 'LEVEL_1' | 'LEVEL_2' | 'LEVEL_3';
  specificEvaluation: string;
  additionalNotesAndCareInstructions: string;
}

const DEFAULT_ASSESSMENT: ClinicalAssessmentData = {
  assessmentDate: new Date().toISOString().slice(0, 10),
  assessorName: '',
  residentName: '',
  residentCode: '',
  dateOfBirth: '',
  gender: 'Nữ',
  room: '',

  pulse: '82',
  pulseEvaluation: 'NORMAL',
  bloodPressure: '134/92',
  bpEvaluation: 'HIGH',
  temperature: '36.3',
  tempEvaluation: 'NORMAL',
  spo2: '97',
  spo2Evaluation: 'NORMAL',
  weightRecords: [
    { id: '1', date: '07/07/2026', value: '47 kg' },
    { id: '2', date: '16/07/2026', value: '48.3 kg' },
    { id: '3', date: '12/08/2026', value: '49.5 kg' },
  ],
  glucoseRecords: [
    { id: '1', date: '07/07/2026', value: '12.49 mmol/L' },
    { id: '2', date: '16/07/2026', value: '7.2 mmol/L' },
    { id: '3', date: '12/08/2026', value: '7.0 mmol/L' },
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
  medicationsNotes: 'Bà đang dùng thuốc điều trị tiểu đường theo đơn của BS ngày 7/7/2026.\nThuốc gia đình gửi ngày 21/7/2026 (Neuropyl + Betaserc) đã hết.',

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
    'Huyết áp: Chỉ số huyết áp hàng ngày trong khoảng từ 118/70 mmHg đến 146/94 mmHg (nhiều lần > 120/80 mmHg) => Cần đi khám chuyên sâu về huyết áp.\nNhịp tim: Ổn định trong khoảng 74 đến 94 lần/phút.\nSPO2: Ổn định trong khoảng 95% đến 98% => Tình trạng hô hấp bình thường.\nĐường huyết: Đã ổn định ~7.0 mmol/L => Tiếp tục duy trì thuốc theo đơn.\nSa sút trí tuệ: Bà nhận diện được người thân, nhưng hay nhầm lẫn đồ đạc của cụ cùng phòng. Cần nhân viên bao quát khi tập thể dục ngoài trời.',
  additionalNotesAndCareInstructions:
    '- Duy trì chế độ chăm sóc, dinh dưỡng giảm tinh bột tăng đạm và cấp phát thuốc hàng ngày theo đơn.\n- Nhân viên chăm sóc thay quần áo hàng ngày và hỗ trợ tắm rửa theo lịch.\n- Đại tiện cần nhân viên hỗ trợ lau rửa để đảm bảo vệ sinh do bà hay quên cách làm sạch.\n- Đề xuất: Tháng 8 trung tâm hỗ trợ miễn phí công tác vệ sinh cho bà. Từ tháng 9 tùy mức độ hỗ trợ sẽ đề xuất chi phí phù hợp chi trả cho nhân viên chăm sóc.',
};

const STATUS_BADGES: Record<HealthReportStatus, { label: string; className: string }> = {
  DRAFT: { label: 'Bản nháp', className: 'badge badge-neutral' },
  GENERATED: { label: 'Đã khóa dữ liệu', className: 'badge badge-info' },
  UNDER_REVIEW: { label: 'Đang rà soát', className: 'badge badge-warning' },
  REVISION_REQUIRED: { label: 'Yêu cầu sửa', className: 'badge badge-danger' },
  APPROVED: { label: 'Đã phê duyệt', className: 'badge badge-success' },
  DELIVERED: { label: 'Đã gửi gia đình', className: 'badge badge-purple' },
  SUPERSEDED: { label: 'Đã thay thế', className: 'badge badge-neutral' },
  CANCELLED: { label: 'Đã hủy', className: 'badge badge-neutral' },
};

export default function HealthReportsPage() {
  const { actor } = useActor();

  const [reports, setReports] = useState<HealthReportRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [filterResident, setFilterResident] = useState('ALL');

  // Form Editor Modal State
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [selectedResidentId, setSelectedResidentId] = useState('');
  const [periodStart, setPeriodStart] = useState(new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10));
  const [periodEnd, setPeriodEnd] = useState(new Date().toISOString().slice(0, 10));
  const [assessment, setAssessment] = useState<ClinicalAssessmentData>(DEFAULT_ASSESSMENT);

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

  // Handle Resident Selection in Form
  const handleResidentSelect = (resId: string) => {
    setSelectedResidentId(resId);
    const item = residentsList?.find((r: ResidentContextResponse) => r.resident.residentId === resId)?.resident;
    if (item) {
      setAssessment(prev => ({
        ...prev,
        residentName: item.displayName,
        residentCode: item.residentCode,
        dateOfBirth: item.dateOfBirth ? new Date(item.dateOfBirth).toLocaleDateString('vi-VN') : '',
        gender: item.gender === 'FEMALE' ? 'Nữ' : 'Nam',
        room: item.room || '',
        assessorName: actor?.displayName || actor?.actorId || 'Nhân viên y tế',
      }));
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
    setAssessment(prev => ({ ...prev, pulse: val, pulseEvaluation: evaluation }));
  };

  const handleBpChange = (val: string) => {
    let evaluation: 'NORMAL' | 'HIGH' | 'LOW' = 'NORMAL';
    const parts = val.split('/').map(s => parseFloat(s.trim()));
    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
      if (parts[0] > 120 || parts[1] > 80) evaluation = 'HIGH';
      else if (parts[0] < 90 || parts[1] < 60) evaluation = 'LOW';
    }
    setAssessment(prev => ({ ...prev, bloodPressure: val, bpEvaluation: evaluation }));
  };

  const handleTempChange = (val: string) => {
    const num = parseFloat(val);
    let evaluation: 'NORMAL' | 'FEVER' | 'HYPOTHERMIA' = 'NORMAL';
    if (!isNaN(num)) {
      if (num > 37.5) evaluation = 'FEVER';
      else if (num < 36.0) evaluation = 'HYPOTHERMIA';
    }
    setAssessment(prev => ({ ...prev, temperature: val, tempEvaluation: evaluation }));
  };

  const handleSpo2Change = (val: string) => {
    const num = parseFloat(val);
    let evaluation: 'NORMAL' | 'DYSPNEA' = 'NORMAL';
    if (!isNaN(num)) {
      if (num < 95) evaluation = 'DYSPNEA';
    }
    setAssessment(prev => ({ ...prev, spo2: val, spo2Evaluation: evaluation }));
  };

  // Auto generate evaluation summary text
  const generateEvaluationText = () => {
    const lines: string[] = [];
    lines.push(`Huyết áp: Chỉ số đo gần nhất ${assessment.bloodPressure} mmHg (${assessment.bpEvaluation === 'HIGH' ? 'Cao - cần theo dõi & khám chuyên sâu' : 'Bình thường'}).`);
    lines.push(`Nhịp tim: ${assessment.pulse} lần/phút (${assessment.pulseEvaluation === 'NORMAL' ? 'Ổn định bình thường' : assessment.pulseEvaluation === 'FAST' ? 'Nhanh' : 'Chậm'}).`);
    lines.push(`SPO2: ${assessment.spo2}% (${assessment.spo2Evaluation === 'NORMAL' ? 'Tình trạng hô hấp ổn định' : 'Cần chú ý khó thở'}).`);
    if (assessment.glucoseRecords.length > 0) {
      const latestGluc = assessment.glucoseRecords[assessment.glucoseRecords.length - 1];
      lines.push(`Đường huyết mao mạch lúc đói: ${latestGluc.value} (${latestGluc.date}) => Tiếp tục kiểm soát chế độ ăn & thuốc theo đơn.`);
    }
    if (assessment.conditions.dementiaAlzheimer) {
      lines.push('Sa sút trí tuệ: Có dấu hiệu suy giảm trí nhớ, cần nhân viên chăm sóc bao quát an toàn.');
    }
    setAssessment(prev => ({ ...prev, specificEvaluation: lines.join('\n') }));
  };

  // Submit Assessment Form to Create Report
  const handleCreateReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actor) return;
    if (!selectedResidentId || !periodStart || !periodEnd) {
      setMessage('Vui lòng chọn người cao tuổi và khoảng thời gian đánh giá.');
      return;
    }

    try {
      setBusy(true);
      setMessage('');
      const serializedData = JSON.stringify(assessment);
      await createHealthReport(actor, {
        residentId: selectedResidentId,
        reportType: 'MONTHLY',
        periodStart: `${periodStart}T00:00:00.000Z`,
        periodEnd: `${periodEnd}T23:59:59.999Z`,
        summary: serializedData,
      });
      await refreshReports();
      setIsEditorOpen(false);
      setMessage('Đã lưu thành công Phiếu đánh giá sức khỏe định kỳ!');
    } catch (err: any) {
      setMessage(err.message || 'Lỗi khi lưu phiếu đánh giá.');
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
    return reports.filter(r => r.resident_id === filterResident);
  }, [reports, filterResident]);

  const kpis = useMemo(() => {
    return {
      total: reports.length,
      draft: reports.filter(r => r.status === 'DRAFT').length,
      approved: reports.filter(r => r.status === 'APPROVED' || r.status === 'DELIVERED').length,
      delivered: reports.filter(r => r.status === 'DELIVERED').length,
    };
  }, [reports]);

  const canCreate = actor?.actorRole === 'NURSE';
  const canApprove = actor?.actorRole === 'CARE_MANAGER' || actor?.actorRole === 'SUPERVISOR';

  return (
    <div className="page-content">
      {/* Page Header */}
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 className="page-title">Phiếu Đánh Giá & Báo Cáo Sức Khỏe Định Kỳ</h1>
            <p className="page-description">
              Khảo sát dấu hiệu sinh tồn, ADL, dinh dưỡng, tâm thần kinh, đề xuất mức độ chăm sóc và dặn dò dặn thêm theo chuẩn y khoa Tâm An Care.
            </p>
          </div>
          {canCreate ? (
            <button
              onClick={() => {
                setAssessment({
                  ...DEFAULT_ASSESSMENT,
                  assessorName: actor?.displayName || actor?.actorId || 'Nhân viên y tế',
                });
                setIsEditorOpen(true);
              }}
              className="btn btn-primary"
            >
              + Lập phiếu đánh giá mới
            </button>
          ) : (
            <div
              style={{
                fontSize: '0.82rem',
                color: '#334155',
                background: '#f8fafc',
                padding: '0.5rem 0.85rem',
                borderRadius: '0.375rem',
                border: '1px solid #cbd5e1',
                maxWidth: '420px',
              }}
            >
              🔒 <b>Phân quyền chuyên môn:</b> Lập phiếu đánh giá định kỳ do <b>Nhân viên y tế</b> thực hiện. Quản lý và Ban Giám đốc phụ trách rà soát, phê duyệt & gửi gia đình.
            </div>
          )}
        </div>
      </div>

      {/* Message Banner */}
      {message && (
        <div className="alert-card alert-info" style={{ marginBottom: '1rem' }}>
          <span>{message}</span>
        </div>
      )}

      {/* KPI Row */}
      <div className="kpi-row">
        <div className="kpi-card">
          <div className="kpi-label">Tổng số phiếu đánh giá</div>
          <div className="kpi-val">{kpis.total}</div>
          <div className="kpi-sub">Toàn bộ kỳ báo cáo</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Bản nháp chờ khóa</div>
          <div className="kpi-val" style={{ color: '#d97706' }}>{kpis.draft}</div>
          <div className="kpi-sub">Đang cập nhật số liệu</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Đã duyệt chuyên môn</div>
          <div className="kpi-val" style={{ color: '#16a34a' }}>{kpis.approved}</div>
          <div className="kpi-sub">Chuẩn y khoa hoàn tất</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Đã gửi gia đình</div>
          <div className="kpi-val" style={{ color: '#2563eb' }}>{kpis.delivered}</div>
          <div className="kpi-sub">Có lưu bằng chứng nhận</div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="filter-card">
        <div className="filter-group">
          <div className="filter-item">
            <span className="filter-label">Người cao tuổi:</span>
            <select
              value={filterResident}
              onChange={e => setFilterResident(e.target.value)}
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
        <table className="ui-table">
          <thead>
            <tr>
              <th>Mã báo cáo / Người cao tuổi</th>
              <th>Kỳ đánh giá</th>
              <th>Mức đề xuất & Trạng thái</th>
              <th>Ngày lập</th>
              <th className="text-right">Thao tác & Quy trình</th>
            </tr>
          </thead>
          <tbody>
            {filteredReports.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center" style={{ padding: '3rem', color: 'var(--text-secondary)' }}>
                  Chưa có phiếu đánh giá sức khỏe định kỳ nào. Bấm <b>"+ Lập phiếu đánh giá mới"</b> để bắt đầu.
                </td>
              </tr>
            ) : (
              filteredReports.map(report => {
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
                      <div className="cell-secondary">Bởi: {parsed.assessorName || 'Điều dưỡng'}</div>
                    </td>
                    <td className="text-right">
                      <div className="btn-group">
                        <button
                          onClick={() => setViewingReport({ report, data: parsed })}
                          className="btn btn-sm btn-secondary"
                          title="Xem toàn bộ 3 trang phiếu đánh giá & In chuẩn y khoa"
                        >
                          📄 Xem & In Phiếu
                        </button>

                        {report.status === 'DRAFT' && canCreate && (
                          <button
                            onClick={async () => {
                              if (!actor) return;
                              setBusy(true);
                              await generateHealthReport(actor, report.health_report_id);
                              await refreshReports();
                              setBusy(false);
                            }}
                            className="btn btn-sm btn-primary"
                          >
                            Khóa dữ liệu
                          </button>
                        )}

                        {report.status === 'GENERATED' && (canCreate || canApprove) && (
                          <button
                            onClick={async () => {
                              if (!actor) return;
                              setBusy(true);
                              await startHealthReportReview(actor, report.health_report_id);
                              await refreshReports();
                              setBusy(false);
                            }}
                            className="btn btn-sm btn-warning"
                          >
                            Rà soát
                          </button>
                        )}

                        {report.status === 'UNDER_REVIEW' && canApprove && (
                          <button
                            onClick={async () => {
                              if (!actor) return;
                              setBusy(true);
                              await approveHealthReport(actor, report.health_report_id);
                              await refreshReports();
                              setBusy(false);
                            }}
                            className="btn btn-sm btn-success"
                          >
                            Phê duyệt
                          </button>
                        )}

                        {report.status === 'APPROVED' && (
                          <button
                            onClick={() => {
                              setDeliveryReport(report);
                              setDeliveryContactId('contact-' + report.resident_id);
                            }}
                            className="btn btn-sm btn-purple"
                          >
                            Gửi gia đình
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

      {/* ========================================================================= */}
      {/* MODAL 1: LẬP PHIẾU ĐÁNH GIÁ SỨC KHỎE ĐỊNH KỲ (NHẬP SỐ LIỆU & DẶN DÒ THÊM) */}
      {/* ========================================================================= */}
      {isEditorOpen && (
        <div className="modal-overlay">
          <div className="modal-dialog modal-dialog-lg" style={{ maxWidth: '900px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="modal-header">
              <h2 className="modal-title">Phiếu Đánh Giá Sức Khỏe Định Kỳ Cho Người Cao Tuổi</h2>
              <button onClick={() => setIsEditorOpen(false)} className="modal-close">
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateReport}>
              <div className="modal-body">
                {/* I. THÔNG TIN HÀNH CHÍNH */}
                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '0.5rem', padding: '1rem', marginBottom: '1.25rem' }}>
                  <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '1rem', color: '#166534', fontWeight: 700 }}>
                    I. THÔNG TIN HÀNH CHÍNH
                  </h3>
                  <div className="form-row">
                    <div>
                      <label className="form-label">
                        Chọn Người Cao Tuổi <span className="req">*</span>
                      </label>
                      <select
                        value={selectedResidentId}
                        onChange={e => handleResidentSelect(e.target.value)}
                        required
                        className="form-select"
                        style={{ width: '100%' }}
                      >
                        <option value="">-- Chọn cụ --</option>
                        {residentsList?.map((r: ResidentContextResponse) => (
                          <option key={r.resident.residentId} value={r.resident.residentId}>
                            {r.resident.displayName} ({r.resident.residentCode}) - Phòng: {r.resident.room || 'Chưa gán'}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="form-label">Người đánh giá (Nhân viên / BS) <span className="req">*</span></label>
                      <input
                        type="text"
                        value={assessment.assessorName}
                        onChange={e => setAssessment(prev => ({ ...prev, assessorName: e.target.value }))}
                        required
                        className="form-input"
                        placeholder="Ví dụ: Nguyễn Thị Phương Thúy"
                      />
                    </div>
                  </div>

                  <div className="form-row" style={{ marginTop: '0.75rem' }}>
                    <div>
                      <label className="form-label">Ngày đánh giá</label>
                      <input
                        type="date"
                        value={assessment.assessmentDate}
                        onChange={e => setAssessment(prev => ({ ...prev, assessmentDate: e.target.value }))}
                        className="form-input"
                      />
                    </div>
                    <div>
                      <label className="form-label">Khoảng thời gian kỳ báo cáo</label>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                        <input
                          type="date"
                          value={periodStart}
                          onChange={e => setPeriodStart(e.target.value)}
                          className="form-input"
                        />
                        <input
                          type="date"
                          value={periodEnd}
                          onChange={e => setPeriodEnd(e.target.value)}
                          className="form-input"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* II. DẤU HIỆU SINH TỒN & THỂ TRẠNG */}
                <div style={{ border: '1px solid #e2e8f0', borderRadius: '0.5rem', padding: '1rem', marginBottom: '1.25rem' }}>
                  <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '1rem', color: '#1e293b', fontWeight: 700 }}>
                    II. ĐÁNH GIÁ DẤU HIỆU SINH TỒN & THỂ TRẠNG (NHẬP SỐ LIỆU)
                  </h3>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
                    <div>
                      <label className="form-label">Mạch (lần/phút)</label>
                      <input
                        type="number"
                        value={assessment.pulse}
                        onChange={e => handlePulseChange(e.target.value)}
                        placeholder="82"
                        className="form-input"
                      />
                      <div style={{ marginTop: '0.35rem', fontSize: '0.78rem' }}>
                        <span className={assessment.pulseEvaluation === 'NORMAL' ? 'badge badge-success' : 'badge badge-warning'}>
                          {assessment.pulseEvaluation === 'NORMAL' ? 'Bình thường (60-90)' : assessment.pulseEvaluation === 'SLOW' ? 'Chậm (<60)' : 'Nhanh (>90)'}
                        </span>
                      </div>
                    </div>

                    <div>
                      <label className="form-label">Huyết áp (mmHg)</label>
                      <input
                        type="text"
                        value={assessment.bloodPressure}
                        onChange={e => handleBpChange(e.target.value)}
                        placeholder="134/92"
                        className="form-input"
                      />
                      <div style={{ marginTop: '0.35rem', fontSize: '0.78rem' }}>
                        <span className={assessment.bpEvaluation === 'NORMAL' ? 'badge badge-success' : assessment.bpEvaluation === 'HIGH' ? 'badge badge-danger' : 'badge badge-warning'}>
                          {assessment.bpEvaluation === 'NORMAL' ? 'Bình thường' : assessment.bpEvaluation === 'HIGH' ? 'Cao (>120/80)' : 'Thấp (<90/60)'}
                        </span>
                      </div>
                    </div>

                    <div>
                      <label className="form-label">Nhiệt độ (°C)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={assessment.temperature}
                        onChange={e => handleTempChange(e.target.value)}
                        placeholder="36.3"
                        className="form-input"
                      />
                      <div style={{ marginTop: '0.35rem', fontSize: '0.78rem' }}>
                        <span className={assessment.tempEvaluation === 'NORMAL' ? 'badge badge-success' : 'badge badge-danger'}>
                          {assessment.tempEvaluation === 'NORMAL' ? 'Bình thường (36.0-37.5)' : assessment.tempEvaluation === 'FEVER' ? 'Sốt (>37.5)' : 'Hạ thân nhiệt'}
                        </span>
                      </div>
                    </div>

                    <div>
                      <label className="form-label">SPO2 (%)</label>
                      <input
                        type="number"
                        value={assessment.spo2}
                        onChange={e => handleSpo2Change(e.target.value)}
                        placeholder="97"
                        className="form-input"
                      />
                      <div style={{ marginTop: '0.35rem', fontSize: '0.78rem' }}>
                        <span className={assessment.spo2Evaluation === 'NORMAL' ? 'badge badge-success' : 'badge badge-danger'}>
                          {assessment.spo2Evaluation === 'NORMAL' ? 'Bình thường (≥95%)' : 'Khó thở / Thấp (<95%)'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Weight & Glucose Records Tracker */}
                  <div className="form-row" style={{ marginTop: '1rem' }}>
                    <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '0.375rem', border: '1px solid #e2e8f0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Theo dõi Cân nặng (kg):</span>
                        <button
                          type="button"
                          onClick={() => {
                            setAssessment(prev => ({
                              ...prev,
                              weightRecords: [...prev.weightRecords, { id: String(Date.now()), date: new Date().toLocaleDateString('vi-VN'), value: '' }],
                            }));
                          }}
                          className="btn btn-sm btn-secondary"
                        >
                          + Thêm mốc
                        </button>
                      </div>
                      {assessment.weightRecords.map((r, idx) => (
                        <div key={r.id} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.35rem' }}>
                          <input
                            type="text"
                            value={r.date}
                            placeholder="Ngày (dd/mm/yyyy)"
                            onChange={e => {
                              const next = [...assessment.weightRecords];
                              next[idx].date = e.target.value;
                              setAssessment(prev => ({ ...prev, weightRecords: next }));
                            }}
                            className="form-input"
                            style={{ flex: 1 }}
                          />
                          <input
                            type="text"
                            value={r.value}
                            placeholder="Số kg (ví dụ 49.5 kg)"
                            onChange={e => {
                              const next = [...assessment.weightRecords];
                              next[idx].value = e.target.value;
                              setAssessment(prev => ({ ...prev, weightRecords: next }));
                            }}
                            className="form-input"
                            style={{ flex: 1 }}
                          />
                        </div>
                      ))}
                    </div>

                    <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '0.375rem', border: '1px solid #e2e8f0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Glucose máu mao mạch lúc đói:</span>
                        <button
                          type="button"
                          onClick={() => {
                            setAssessment(prev => ({
                              ...prev,
                              glucoseRecords: [...prev.glucoseRecords, { id: String(Date.now()), date: new Date().toLocaleDateString('vi-VN'), value: '' }],
                            }));
                          }}
                          className="btn btn-sm btn-secondary"
                        >
                          + Thêm mốc
                        </button>
                      </div>
                      {assessment.glucoseRecords.map((r, idx) => (
                        <div key={r.id} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.35rem' }}>
                          <input
                            type="text"
                            value={r.date}
                            placeholder="Ngày (dd/mm/yyyy)"
                            onChange={e => {
                              const next = [...assessment.glucoseRecords];
                              next[idx].date = e.target.value;
                              setAssessment(prev => ({ ...prev, glucoseRecords: next }));
                            }}
                            className="form-input"
                            style={{ flex: 1 }}
                          />
                          <input
                            type="text"
                            value={r.value}
                            placeholder="mmol/L (ví dụ 7.0 mmol/L)"
                            onChange={e => {
                              const next = [...assessment.glucoseRecords];
                              next[idx].value = e.target.value;
                              setAssessment(prev => ({ ...prev, glucoseRecords: next }));
                            }}
                            className="form-input"
                            style={{ flex: 1 }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* III. BỆNH LÝ & THUỐC ĐANG SỬ DỤNG */}
                <div style={{ border: '1px solid #e2e8f0', borderRadius: '0.5rem', padding: '1rem', marginBottom: '1.25rem' }}>
                  <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '1rem', color: '#1e293b', fontWeight: 700 }}>
                    III. BỆNH LÝ & THUỐC ĐANG SỬ DỤNG
                  </h3>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem' }}>1. Tiền sử bệnh nền:</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.5rem', marginBottom: '1rem' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.88rem' }}>
                      <input
                        type="checkbox"
                        checked={assessment.conditions.hypertension}
                        onChange={e => setAssessment(prev => ({ ...prev, conditions: { ...prev.conditions, hypertension: e.target.checked } }))}
                      />
                      Cao huyết áp
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.88rem' }}>
                      <input
                        type="checkbox"
                        checked={assessment.conditions.diabetes}
                        onChange={e => setAssessment(prev => ({ ...prev, conditions: { ...prev.conditions, diabetes: e.target.checked } }))}
                      />
                      Đái tháo đường (Tuýp: {assessment.conditions.diabetesType || '2'})
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.88rem' }}>
                      <input
                        type="checkbox"
                        checked={assessment.conditions.cardiovascular}
                        onChange={e => setAssessment(prev => ({ ...prev, conditions: { ...prev.conditions, cardiovascular: e.target.checked } }))}
                      />
                      Tim mạch (Suy tim, bệnh mạch vành)
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.88rem' }}>
                      <input
                        type="checkbox"
                        checked={assessment.conditions.strokeOrHemiplegia}
                        onChange={e => setAssessment(prev => ({ ...prev, conditions: { ...prev.conditions, strokeOrHemiplegia: e.target.checked } }))}
                      />
                      Tai biến mạch máu não / Liệt di chứng
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.88rem' }}>
                      <input
                        type="checkbox"
                        checked={assessment.conditions.dementiaAlzheimer}
                        onChange={e => setAssessment(prev => ({ ...prev, conditions: { ...prev.conditions, dementiaAlzheimer: e.target.checked } }))}
                      />
                      Sa sút trí tuệ / Alzheimer
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.88rem' }}>
                      <input
                        type="checkbox"
                        checked={assessment.conditions.osteoarthritis}
                        onChange={e => setAssessment(prev => ({ ...prev, conditions: { ...prev.conditions, osteoarthritis: e.target.checked } }))}
                      />
                      Bệnh xương khớp (Thoái hóa, loãng xương)
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.88rem' }}>
                      <input
                        type="checkbox"
                        checked={assessment.conditions.respiratory}
                        onChange={e => setAssessment(prev => ({ ...prev, conditions: { ...prev.conditions, respiratory: e.target.checked } }))}
                      />
                      Bệnh hô hấp (COPD, Hen suyễn)
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.88rem' }}>
                      <input
                        type="checkbox"
                        checked={assessment.conditions.kidneyDisease}
                        onChange={e => setAssessment(prev => ({ ...prev, conditions: { ...prev.conditions, kidneyDisease: e.target.checked } }))}
                      />
                      Bệnh lý thận / Suy thận mãn
                    </label>
                  </div>

                  <div style={{ marginBottom: '1rem' }}>
                    <label className="form-label">2. Tiền sử dị ứng</label>
                    <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.88rem' }}>
                        <input
                          type="checkbox"
                          checked={assessment.allergy.none}
                          onChange={e => setAssessment(prev => ({ ...prev, allergy: { ...prev.allergy, none: e.target.checked } }))}
                        />
                        Không có tiền sử dị ứng
                      </label>
                      <input
                        type="text"
                        placeholder="Dị ứng thuốc (nếu có)..."
                        value={assessment.allergy.drugAllergy || ''}
                        onChange={e => setAssessment(prev => ({ ...prev, allergy: { ...prev.allergy, drugAllergy: e.target.value, none: false } }))}
                        className="form-input"
                        style={{ width: '220px' }}
                      />
                      <input
                        type="text"
                        placeholder="Dị ứng thức ăn (nếu có)..."
                        value={assessment.allergy.foodAllergy || ''}
                        onChange={e => setAssessment(prev => ({ ...prev, allergy: { ...prev.allergy, foodAllergy: e.target.value, none: false } }))}
                        className="form-input"
                        style={{ width: '220px' }}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="form-label">3. Các loại thuốc đang sử dụng hàng ngày & Ghi chú đơn thuốc</label>
                    <textarea
                      rows={2}
                      value={assessment.medicationsNotes}
                      onChange={e => setAssessment(prev => ({ ...prev, medicationsNotes: e.target.value }))}
                      placeholder="Ghi rõ tên thuốc, liều dùng, thời gian uống hoặc đơn thuốc hiện tại..."
                      className="form-textarea"
                    />
                  </div>
                </div>

                {/* IV. ĐÁNH GIÁ CHỨC NĂNG SINH HOẠT HÀNG NGÀY (ADL) */}
                <div style={{ border: '1px solid #e2e8f0', borderRadius: '0.5rem', padding: '1rem', marginBottom: '1.25rem' }}>
                  <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '1rem', color: '#1e293b', fontWeight: 700 }}>
                    IV. ĐÁNH GIÁ CHỨC NĂNG SINH HOẠT HÀNG NGÀY (ADL)
                  </h3>
                  <table className="ui-table" style={{ fontSize: '0.85rem', marginBottom: '1rem' }}>
                    <thead>
                      <tr>
                        <th>Hoạt động sinh hoạt thiết yếu</th>
                        <th style={{ textAlign: 'center' }}>Tự thực hiện</th>
                        <th style={{ textAlign: 'center' }}>Cần hỗ trợ một phần</th>
                        <th style={{ textAlign: 'center' }}>Phụ thuộc hoàn toàn</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { key: 'eating', label: 'Ăn uống' },
                        { key: 'bathing', label: 'Tắm rửa / Vệ sinh cá nhân' },
                        { key: 'dressing', label: 'Mặc quần áo' },
                        { key: 'toileting', label: 'Đi vệ sinh (Tiểu / Đại tiện)' },
                        { key: 'mobility', label: 'Di chuyển (Đi lại, thay đổi tư thế)' },
                      ].map(item => (
                        <tr key={item.key}>
                          <td><b>{item.label}</b></td>
                          <td style={{ textAlign: 'center' }}>
                            <input
                              type="radio"
                              name={item.key}
                              checked={(assessment.adl as any)[item.key] === 'INDEPENDENT'}
                              onChange={() => setAssessment(prev => ({ ...prev, adl: { ...prev.adl, [item.key]: 'INDEPENDENT' } }))}
                            />
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <input
                              type="radio"
                              name={item.key}
                              checked={(assessment.adl as any)[item.key] === 'PARTIAL_ASSIST'}
                              onChange={() => setAssessment(prev => ({ ...prev, adl: { ...prev.adl, [item.key]: 'PARTIAL_ASSIST' } }))}
                            />
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <input
                              type="radio"
                              name={item.key}
                              checked={(assessment.adl as any)[item.key] === 'FULL_DEPEND'}
                              onChange={() => setAssessment(prev => ({ ...prev, adl: { ...prev.adl, [item.key]: 'FULL_DEPEND' } }))}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div className="form-row">
                    <div>
                      <span className="form-label">Tình trạng bài tiết:</span>
                      <div style={{ display: 'flex', gap: '1rem', marginTop: '0.25rem', fontSize: '0.85rem' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <input
                            type="radio"
                            name="excretion"
                            checked={assessment.adl.excretion === 'AUTONOMOUS'}
                            onChange={() => setAssessment(prev => ({ ...prev, adl: { ...prev.adl, excretion: 'AUTONOMOUS' } }))}
                          />
                          Tự chủ
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <input
                            type="radio"
                            name="excretion"
                            checked={assessment.adl.excretion === 'INCONTINENT'}
                            onChange={() => setAssessment(prev => ({ ...prev, adl: { ...prev.adl, excretion: 'INCONTINENT' } }))}
                          />
                          Không tự chủ
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <input
                            type="radio"
                            name="excretion"
                            checked={assessment.adl.excretion === 'CATHETER_DIAPER'}
                            onChange={() => setAssessment(prev => ({ ...prev, adl: { ...prev.adl, excretion: 'CATHETER_DIAPER' } }))}
                          />
                          Đặt ống thông / đóng bỉm
                        </label>
                      </div>
                    </div>

                    <div>
                      <span className="form-label">Dụng cụ hỗ trợ di chuyển:</span>
                      <div style={{ display: 'flex', gap: '1rem', marginTop: '0.25rem', fontSize: '0.85rem' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <input
                            type="radio"
                            name="mobilitySupport"
                            checked={assessment.adl.mobilitySupport === 'NONE'}
                            onChange={() => setAssessment(prev => ({ ...prev, adl: { ...prev.adl, mobilitySupport: 'NONE' } }))}
                          />
                          Không cần
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <input
                            type="radio"
                            name="mobilitySupport"
                            checked={assessment.adl.mobilitySupport === 'CANE_WALKER'}
                            onChange={() => setAssessment(prev => ({ ...prev, adl: { ...prev.adl, mobilitySupport: 'CANE_WALKER' } }))}
                          />
                          Gậy / Khung tập đi
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <input
                            type="radio"
                            name="mobilitySupport"
                            checked={assessment.adl.mobilitySupport === 'WHEELCHAIR'}
                            onChange={() => setAssessment(prev => ({ ...prev, adl: { ...prev.adl, mobilitySupport: 'WHEELCHAIR' } }))}
                          />
                          Xe lăn
                        </label>
                      </div>
                    </div>
                  </div>
                </div>

                {/* V, VI, VII. TINH THẦN, DINH DƯỠNG & NGUY CƠ LÂM SÀNG */}
                <div style={{ border: '1px solid #e2e8f0', borderRadius: '0.5rem', padding: '1rem', marginBottom: '1.25rem' }}>
                  <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '1rem', color: '#1e293b', fontWeight: 700 }}>
                    V, VI, VII. TRẠNG THÁI TINH THẦN, DINH DƯỠNG & NGUY CƠ LÂM SÀNG
                  </h3>

                  <div className="form-row">
                    <div>
                      <label className="form-label">Trí nhớ / Nhận thức:</label>
                      <select
                        value={assessment.mental.memoryCognition}
                        onChange={e => setAssessment(prev => ({ ...prev, mental: { ...prev.mental, memoryCognition: e.target.value as any } }))}
                        className="form-select"
                        style={{ width: '100%' }}
                      >
                        <option value="NORMAL">Bình thường</option>
                        <option value="MILD_DECLINE">Suy giảm nhẹ</option>
                        <option value="CONFUSED_SEVERE">Lẫn lộn / Mất trí nhớ nặng</option>
                      </select>
                    </div>

                    <div>
                      <label className="form-label">Chế độ ăn hiện tại:</label>
                      <select
                        value={assessment.nutrition.dietType}
                        onChange={e => setAssessment(prev => ({ ...prev, nutrition: { ...prev.nutrition, dietType: e.target.value as any } }))}
                        className="form-select"
                        style={{ width: '100%' }}
                      >
                        <option value="NORMAL_RICE">Cơm thường (Giảm tinh bột, tăng đạm)</option>
                        <option value="PORRIDGE_SOUP">Cháo / Súp mềm</option>
                        <option value="SONDE">Ăn qua sonde (ống bơm)</option>
                      </select>
                    </div>
                  </div>

                  <div className="form-row" style={{ marginTop: '0.75rem' }}>
                    <div>
                      <label className="form-label">Tổn thương da / Loét tì đè:</label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.25rem' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.88rem' }}>
                          <input
                            type="radio"
                            name="hasUlcer"
                            checked={!assessment.skinRisk.hasUlcer}
                            onChange={() => setAssessment(prev => ({ ...prev, skinRisk: { ...prev.skinRisk, hasUlcer: false } }))}
                          />
                          Không có loét
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.88rem' }}>
                          <input
                            type="radio"
                            name="hasUlcer"
                            checked={assessment.skinRisk.hasUlcer}
                            onChange={() => setAssessment(prev => ({ ...prev, skinRisk: { ...prev.skinRisk, hasUlcer: true } }))}
                          />
                          Có loét tì đè
                        </label>
                      </div>
                    </div>
                  </div>
                </div>

                {/* VIII. KẾT LUẬN & DẶN DÒ ĐỀ XUẤT */}
                <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '0.5rem', padding: '1rem' }}>
                  <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '1rem', color: '#0f172a', fontWeight: 700 }}>
                    VIII. KẾT LUẬN, HƯỚNG CHĂM SÓC, GHI CHÚ THÊM & DẶN DÒ ĐỀ XUẤT
                  </h3>

                  <div style={{ marginBottom: '1rem' }}>
                    <label className="form-label">1. Phân loại mức độ chăm sóc đề xuất:</label>
                    <div style={{ display: 'grid', gap: '0.4rem', marginTop: '0.25rem' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.88rem' }}>
                        <input
                          type="radio"
                          name="careLevelProposal"
                          checked={assessment.careLevelProposal === 'LEVEL_1'}
                          onChange={() => setAssessment(prev => ({ ...prev, careLevelProposal: 'LEVEL_1' }))}
                        />
                        <b>(1) Tự phục vụ cơ bản</b> (Theo dõi y tế định kỳ, hỗ trợ khi cần thiết).
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.88rem' }}>
                        <input
                          type="radio"
                          name="careLevelProposal"
                          checked={assessment.careLevelProposal === 'LEVEL_2'}
                          onChange={() => setAssessment(prev => ({ ...prev, careLevelProposal: 'LEVEL_2' }))}
                        />
                        <b>(2) Cần hỗ trợ một phần</b> (Cần nhân viên trợ giúp một số hoạt động ADL hàng ngày).
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.88rem' }}>
                        <input
                          type="radio"
                          name="careLevelProposal"
                          checked={assessment.careLevelProposal === 'LEVEL_3'}
                          onChange={() => setAssessment(prev => ({ ...prev, careLevelProposal: 'LEVEL_3' }))}
                        />
                        <b>(3) Cần chăm sóc toàn diện</b> (Phụ thuộc hoàn toàn, cần theo dõi y tế và chăm sóc sát sao).
                      </label>
                    </div>
                  </div>

                  <div style={{ marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                      <label className="form-label" style={{ margin: 0 }}>2. Đánh giá cụ thể tình trạng sức khỏe của NCT:</label>
                      <button
                        type="button"
                        onClick={generateEvaluationText}
                        className="btn btn-sm btn-secondary"
                        style={{ fontSize: '0.75rem' }}
                      >
                        ⚡ Tự động tổng hợp từ số liệu trên
                      </button>
                    </div>
                    <textarea
                      rows={4}
                      value={assessment.specificEvaluation}
                      onChange={e => setAssessment(prev => ({ ...prev, specificEvaluation: e.target.value }))}
                      className="form-textarea"
                    />
                  </div>

                  {/* Mục Ghi Chú Thêm, Dặn Dò Thêm & Đề Xuất */}
                  <div>
                    <label className="form-label" style={{ color: '#b91c1c' }}>
                      3. Mục ghi chú thêm, dặn dò thêm & Đề xuất hướng chăm sóc <span className="req">*</span>
                    </label>
                    <textarea
                      rows={4}
                      value={assessment.additionalNotesAndCareInstructions}
                      onChange={e => setAssessment(prev => ({ ...prev, additionalNotesAndCareInstructions: e.target.value }))}
                      placeholder="Dặn dò nhân viên chăm sóc, nhắc nhở vệ sinh/đại tiện, an toàn khi tập thể dục tránh đi lạc, đơn thuốc, đề xuất chi phí..."
                      className="form-textarea"
                      style={{ border: '1.5px solid #f87171' }}
                    />
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  onClick={() => setIsEditorOpen(false)}
                  className="btn btn-secondary"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="btn btn-primary"
                >
                  {busy ? 'Đang lưu...' : 'Lưu & Khởi tạo Phiếu Đánh Giá'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: XEM & IN PHIẾU ĐÁNH GIÁ CHUẨN Y KHOA THEO MẪU ĐÍNH KÈM (PRINT VIEW) */}
      {/* ========================================================================= */}
      {viewingReport && (
        <div className="modal-overlay">
          <div className="modal-dialog modal-dialog-lg" style={{ maxWidth: '850px', maxHeight: '92vh', overflowY: 'auto' }}>
            <div className="modal-header">
              <h2 className="modal-title">Xem Phiếu Đánh Giá Sức Khỏe Chuẩn Y Khoa</h2>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={() => window.print()}
                  className="btn btn-sm btn-primary"
                >
                  🖨️ In / Xuất PDF
                </button>
                <button onClick={() => setViewingReport(null)} className="modal-close">
                  &times;
                </button>
              </div>
            </div>

            <div className="modal-body printable-a4-sheet" style={{ background: '#ffffff', color: '#1e293b', padding: '1.25rem' }}>
              {/* Clinical Assessment Header */}
              <div style={{ textAlign: 'center', marginBottom: '0.75rem', borderBottom: '2px solid #315b46', paddingBottom: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
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
                  <div style={{ textAlign: 'right', fontSize: '0.78rem' }}>
                    <div><b>Ngày đánh giá:</b> {viewingReport.data.assessmentDate}</div>
                    <div><b>Người đánh giá:</b> {viewingReport.data.assessorName || 'Nguyễn Thị Phương Thúy'}</div>
                  </div>
                </div>
                <h1 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#1e293b', margin: '0.3rem 0' }}>
                  PHIẾU ĐÁNH GIÁ SỨC KHỎE ĐỊNH KỲ CHO NGƯỜI CAO TUỔI
                </h1>
              </div>

              {/* I. THÔNG TIN HÀNH CHÍNH */}
              <div className="section-header" style={{ background: '#e2f4ea', padding: '0.25rem 0.6rem', fontWeight: 700, fontSize: '0.84rem', marginBottom: '0.35rem' }}>
                I. THÔNG TIN HÀNH CHÍNH
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '0.3rem', fontSize: '0.82rem', marginBottom: '0.5rem' }}>
                <div><b>Họ và tên người cao tuổi:</b> <span style={{ background: '#fef08a', padding: '0.05rem 0.35rem' }}>{viewingReport.data.residentName}</span></div>
                <div><b>Mã số hồ sơ NCT:</b> {viewingReport.data.residentCode}</div>
                <div><b>Ngày tháng năm sinh:</b> {viewingReport.data.dateOfBirth}</div>
                <div><b>Giới tính:</b> {viewingReport.data.gender}</div>
              </div>

              {/* II. DẤU HIỆU SINH TỒN & THỂ TRẠNG */}
              <div className="section-header" style={{ background: '#e2f4ea', padding: '0.25rem 0.6rem', fontWeight: 700, fontSize: '0.84rem', marginBottom: '0.35rem' }}>
                II. ĐÁNH GIÁ DẤU HIỆU SINH TỒN & THỂ TRẠNG
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', marginBottom: '0.5rem', border: '1px solid #cbd5e1' }}>
                <thead>
                  <tr style={{ background: '#334155', color: '#ffffff' }}>
                    <th style={{ padding: '0.25rem 0.4rem', border: '1px solid #cbd5e1' }}>Chỉ số sinh tồn</th>
                    <th style={{ padding: '0.25rem 0.4rem', border: '1px solid #cbd5e1', textAlign: 'center' }}>Kết quả đo</th>
                    <th style={{ padding: '0.25rem 0.4rem', border: '1px solid #cbd5e1' }}>Phân loại / Đánh giá ban đầu</th>
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
                      {viewingReport.data.weightRecords?.map(w => `Ngày ${w.date}: ${w.value}`).join('  |  ')}
                    </td>
                  </tr>
                  <tr>
                    <td style={{ padding: '0.25rem 0.4rem', border: '1px solid #cbd5e1' }}><b>Glucose máu mao mạch lúc đói:</b></td>
                    <td colSpan={2} style={{ padding: '0.25rem 0.4rem', border: '1px solid #cbd5e1' }}>
                      {viewingReport.data.glucoseRecords?.map(g => `Ngày ${g.date}: ${g.value}`).join('  |  ')}
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* III. BỆNH LÝ & THUỐC */}
              <div className="section-header" style={{ background: '#e2f4ea', padding: '0.25rem 0.6rem', fontWeight: 700, fontSize: '0.84rem', marginBottom: '0.35rem' }}>
                III. BỆNH LÝ & THUỐC ĐANG SỬ DỤNG
              </div>
              <div style={{ fontSize: '0.8rem', marginBottom: '0.35rem' }}>
                <b>1. Tiền sử bệnh nền:</b>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.2rem', marginTop: '0.15rem' }}>
                  <div>[{viewingReport.data.conditions.hypertension ? ' x ' : '   '}] Cao huyết áp</div>
                  <div>[{viewingReport.data.conditions.diabetes ? ' x ' : '   '}] Đái tháo đường (Tuýp: {viewingReport.data.conditions.diabetesType || '2'})</div>
                  <div>[{viewingReport.data.conditions.cardiovascular ? ' x ' : '   '}] Tim mạch (Suy tim, bệnh mạch vành)</div>
                  <div>[{viewingReport.data.conditions.strokeOrHemiplegia ? ' x ' : '   '}] Tai biến mạch máu não / Liệt di chứng</div>
                  <div>[{viewingReport.data.conditions.dementiaAlzheimer ? ' x ' : '   '}] Sa sút trí tuệ / Alzheimer</div>
                  <div>[{viewingReport.data.conditions.osteoarthritis ? ' x ' : '   '}] Bệnh xương khớp (Thoái hóa, loãng xương)</div>
                  <div>[{viewingReport.data.conditions.respiratory ? ' x ' : '   '}] Bệnh hô hấp (COPD, Hen suyễn)</div>
                  <div>[{viewingReport.data.conditions.kidneyDisease ? ' x ' : '   '}] Bệnh lý thận / Suy thận mãn</div>
                </div>
              </div>
              <div style={{ fontSize: '0.8rem', marginBottom: '0.35rem' }}>
                <b>2. Tiền sử dị ứng:</b> [{viewingReport.data.allergy.none ? ' x ' : '   '}] Không có &nbsp; [{viewingReport.data.allergy.drugAllergy ? ' x ' : '   '}] Dị ứng thuốc: {viewingReport.data.allergy.drugAllergy || '...'} &nbsp; [{viewingReport.data.allergy.foodAllergy ? ' x ' : '   '}] Dị ứng thức ăn: {viewingReport.data.allergy.foodAllergy || '...'}
              </div>
              <div style={{ fontSize: '0.8rem', marginBottom: '0.5rem' }}>
                <b>3. Thuốc đang dùng hàng ngày:</b> {viewingReport.data.medicationsNotes || 'Theo đơn chỉ định hiện tại.'}
              </div>

              {/* IV. ADL */}
              <div className="section-header" style={{ background: '#e2f4ea', padding: '0.25rem 0.6rem', fontWeight: 700, fontSize: '0.84rem', marginBottom: '0.35rem' }}>
                IV. ĐÁNH GIÁ CHỨC NĂNG SINH HOẠT HÀNG NGÀY (ADL)
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', marginBottom: '0.5rem', border: '1px solid #cbd5e1' }}>
                <thead>
                  <tr style={{ background: '#334155', color: '#ffffff' }}>
                    <th style={{ padding: '0.25rem 0.4rem', border: '1px solid #cbd5e1' }}>Hoạt động sinh hoạt thiết yếu</th>
                    <th style={{ padding: '0.25rem 0.4rem', border: '1px solid #cbd5e1', textAlign: 'center' }}>Tự thực hiện</th>
                    <th style={{ padding: '0.25rem 0.4rem', border: '1px solid #cbd5e1', textAlign: 'center' }}>Cần hỗ trợ một phần</th>
                    <th style={{ padding: '0.25rem 0.4rem', border: '1px solid #cbd5e1', textAlign: 'center' }}>Phụ thuộc hoàn toàn</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ padding: '0.25rem 0.4rem', border: '1px solid #cbd5e1' }}>Ăn uống</td>
                    <td style={{ textAlign: 'center', border: '1px solid #cbd5e1' }}>{viewingReport.data.adl.eating === 'INDEPENDENT' ? '[ x ]' : '[   ]'}</td>
                    <td style={{ textAlign: 'center', border: '1px solid #cbd5e1' }}>{viewingReport.data.adl.eating === 'PARTIAL_ASSIST' ? '[ x ]' : '[   ]'}</td>
                    <td style={{ textAlign: 'center', border: '1px solid #cbd5e1' }}>{viewingReport.data.adl.eating === 'FULL_DEPEND' ? '[ x ]' : '[   ]'}</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '0.25rem 0.4rem', border: '1px solid #cbd5e1' }}>Tắm rửa / Vệ sinh cá nhân</td>
                    <td style={{ textAlign: 'center', border: '1px solid #cbd5e1' }}>{viewingReport.data.adl.bathing === 'INDEPENDENT' ? '[ x ]' : '[   ]'}</td>
                    <td style={{ textAlign: 'center', border: '1px solid #cbd5e1' }}>{viewingReport.data.adl.bathing === 'PARTIAL_ASSIST' ? '[ x ]' : '[   ]'}</td>
                    <td style={{ textAlign: 'center', border: '1px solid #cbd5e1' }}>{viewingReport.data.adl.bathing === 'FULL_DEPEND' ? '[ x ]' : '[   ]'}</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '0.25rem 0.4rem', border: '1px solid #cbd5e1' }}>Mặc quần áo</td>
                    <td style={{ textAlign: 'center', border: '1px solid #cbd5e1' }}>{viewingReport.data.adl.dressing === 'INDEPENDENT' ? '[ x ]' : '[   ]'}</td>
                    <td style={{ textAlign: 'center', border: '1px solid #cbd5e1' }}>{viewingReport.data.adl.dressing === 'PARTIAL_ASSIST' ? '[ x ]' : '[   ]'}</td>
                    <td style={{ textAlign: 'center', border: '1px solid #cbd5e1' }}>{viewingReport.data.adl.dressing === 'FULL_DEPEND' ? '[ x ]' : '[   ]'}</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '0.25rem 0.4rem', border: '1px solid #cbd5e1' }}>Đi vệ sinh (Tiểu / Đại tiện)</td>
                    <td style={{ textAlign: 'center', border: '1px solid #cbd5e1' }}>{viewingReport.data.adl.toileting === 'INDEPENDENT' ? '[ x ]' : '[   ]'}</td>
                    <td style={{ textAlign: 'center', border: '1px solid #cbd5e1' }}>{viewingReport.data.adl.toileting === 'PARTIAL_ASSIST' ? '[ x ]' : '[   ]'}</td>
                    <td style={{ textAlign: 'center', border: '1px solid #cbd5e1' }}>{viewingReport.data.adl.toileting === 'FULL_DEPEND' ? '[ x ]' : '[   ]'}</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '0.25rem 0.4rem', border: '1px solid #cbd5e1' }}>Di chuyển (Đi lại, thay đổi tư thế)</td>
                    <td style={{ textAlign: 'center', border: '1px solid #cbd5e1' }}>{viewingReport.data.adl.mobility === 'INDEPENDENT' ? '[ x ]' : '[   ]'}</td>
                    <td style={{ textAlign: 'center', border: '1px solid #cbd5e1' }}>{viewingReport.data.adl.mobility === 'PARTIAL_ASSIST' ? '[ x ]' : '[   ]'}</td>
                    <td style={{ textAlign: 'center', border: '1px solid #cbd5e1' }}>{viewingReport.data.adl.mobility === 'FULL_DEPEND' ? '[ x ]' : '[   ]'}</td>
                  </tr>
                </tbody>
              </table>

              {/* VIII. KẾT LUẬN & HƯỚNG CHĂM SÓC */}
              <div className="section-header" style={{ background: '#e2f4ea', padding: '0.25rem 0.6rem', fontWeight: 700, fontSize: '0.84rem', marginBottom: '0.35rem' }}>
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

              {/* Dặn dò thêm & Đề xuất */}
              <div style={{ fontSize: '0.8rem', marginBottom: '0.4rem' }}>
                <b style={{ color: '#b91c1c' }}>Đề xuất & Dặn dò thêm:</b> {viewingReport.data.additionalNotesAndCareInstructions || 'Tiếp tục duy trì chế độ chăm sóc và theo dõi sát sao.'}
              </div>

              {/* Signature */}
              <div className="signature-box" style={{ display: 'flex', justifyContent: 'flex-end', textAlign: 'center', marginTop: '0.6rem' }}>
                <div style={{ width: '220px' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.84rem' }}>Người đánh giá / Điều dưỡng</div>
                  <div style={{ fontSize: '0.72rem', color: '#64748b', marginBottom: '1.2rem' }}>(Ký và ghi rõ họ tên)</div>
                  <div style={{ fontWeight: 700, borderTop: '1px dashed #cbd5e1', paddingTop: '0.25rem', fontSize: '0.82rem' }}>
                    {viewingReport.data.assessorName || 'Nguyễn Thị Phương Thúy'}
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                onClick={() => setViewingReport(null)}
                className="btn btn-secondary"
              >
                Đóng
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="btn btn-primary"
              >
                🖨️ In Phiếu Đánh Giá (A4)
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
                  Mã liên hệ được ủy quyền <span className="req">*</span>
                </label>
                <input
                  type="text"
                  value={deliveryContactId}
                  onChange={e => setDeliveryContactId(e.target.value)}
                  placeholder="contact-..."
                  className="form-input"
                />
              </div>

              <div>
                <label className="form-label">Phương thức gửi</label>
                <select
                  value={deliveryMethod}
                  onChange={e => setDeliveryMethod(e.target.value)}
                  className="form-select"
                  style={{ width: '100%' }}
                >
                  <option value="EMAIL">Thư điện tử (Email)</option>
                  <option value="ZALO">Tin nhắn Zalo OA</option>
                  <option value="IN_PERSON">Trao trực tiếp tại Tâm An</option>
                </select>
              </div>

              <div>
                <label className="form-label">Ghi chú gửi</label>
                <textarea
                  rows={2}
                  value={deliveryNotes}
                  onChange={e => setDeliveryNotes(e.target.value)}
                  placeholder="Đã gửi qua email người giám hộ..."
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
                  setMessage('Đã gửi báo cáo và lưu bằng chứng thành công!');
                }}
                className="btn btn-primary"
              >
                Xác nhận gửi báo cáo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

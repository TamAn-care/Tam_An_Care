import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useActor } from '../../auth/ActorContext';
import {
  approveClassification,
  completeAssessment,
  createAdmission,
  createAdmissionContact,
  createAdmissionDecision,
  createAdmissionMeasurement,
  createInitialAssessment,
  finalizeAdmission,
  generateClassification,
  getAssessmentOverview,
  listAdmissions,
  type AdmissionCase,
  type ClassificationResult,
} from '../../api/admissions';

// Handover Medication & Personal Belongings Data Models
export interface HandoverMedicationItem {
  id: string;
  medicationName: string;
  dosageForm: string;
  quantity: string;
  expiryDate: string;
  usageInstruction: string;
  storageRequirement: 'ROOM_TEMP' | 'COLD_STORAGE' | 'SPECIAL';
  prescriptionStatus: 'WITH_PRESCRIPTION' | 'OVER_THE_COUNTER' | 'SUPPLEMENT';
  notes: string;
}

export interface HandoverBelongingItem {
  id: string;
  category: 'CLOTHING' | 'FOOTWEAR' | 'PERSONAL_CARE' | 'MEDICAL_DEVICE' | 'VALUABLES_DOCS' | 'OTHER';
  itemName: string;
  quantity: string;
  condition: 'NEW_100' | 'GOOD' | 'USED_NORMAL' | 'SCRATCHED_WORN';
  storageLocation: 'RESIDENT_WARDROBE' | 'NURSE_STATION' | 'SAFE_DEPOSIT';
  identificationTag: string;
  notes: string;
}

export interface AdmissionHandoverRecord {
  handoverDate: string;
  guardianDelivererName: string;
  guardianPhone: string;
  nurseReceiverName: string;
  caregiverReceiverName: string;
  supervisorApprovalName: string;
  medications: HandoverMedicationItem[];
  belongings: HandoverBelongingItem[];
  generalNotes: string;
}

export const BELONGING_CATEGORIES: Record<string, string> = {
  CLOTHING: '👕 Quần áo',
  FOOTWEAR: '👟 Giày dép',
  PERSONAL_CARE: '🧴 Vệ sinh cá nhân',
  MEDICAL_DEVICE: '👓 Thiết bị y tế / Trợ thính / Kính',
  VALUABLES_DOCS: '📁 Giấy tờ / Kỷ vật / Tài sản',
  OTHER: '📦 Đồ dùng khác',
};

export const BELONGING_CONDITIONS: Record<string, string> = {
  NEW_100: 'Mới 100%',
  GOOD: 'Còn tốt',
  USED_NORMAL: 'Đã qua sử dụng',
  SCRATCHED_WORN: 'Có trầy xước / Cũ',
};

export const BELONGING_LOCATIONS: Record<string, string> = {
  RESIDENT_WARDROBE: 'Tủ đồ cá nhân phòng',
  NURSE_STATION: 'Tủ trực điều dưỡng',
  SAFE_DEPOSIT: 'Két an toàn viện',
};

export const MEDICATION_STORAGE_OPTIONS: Record<string, string> = {
  ROOM_TEMP: 'Nhiệt độ phòng (<28°C)',
  COLD_STORAGE: 'Ngăn mát tủ lạnh (2-8°C)',
  SPECIAL: 'Tủ thuốc độc lập / Giám sát',
};

export const MEDICATION_PRESCRIPTION_OPTIONS: Record<string, string> = {
  WITH_PRESCRIPTION: 'Đơn bác sĩ đính kèm',
  OVER_THE_COUNTER: 'Thuốc tự mua',
  SUPPLEMENT: 'Thực phẩm chức năng / Bổ dưỡng',
};

export const DEFAULT_HANDOVER_MEDICATIONS: HandoverMedicationItem[] = [
  {
    id: 'MED-01',
    medicationName: 'Amlodipine 5mg',
    dosageForm: 'Viên nén',
    quantity: '30 viên (3 vỉ)',
    expiryDate: '2027-12',
    usageInstruction: 'Uống 1 viên vào lúc 07:00 sáng sau ăn',
    storageRequirement: 'ROOM_TEMP',
    prescriptionStatus: 'WITH_PRESCRIPTION',
    notes: 'Thuốc huyết áp chính, còn nguyên vỉ',
  },
  {
    id: 'MED-02',
    medicationName: 'Metformin 500mg',
    dosageForm: 'Viên bao phim',
    quantity: '60 viên (6 vỉ)',
    expiryDate: '2028-06',
    usageInstruction: 'Uống 1 viên sau ăn sáng, 1 viên sau ăn tối',
    storageRequirement: 'ROOM_TEMP',
    prescriptionStatus: 'WITH_PRESCRIPTION',
    notes: 'Kèm theo đơn của Bệnh viện Lão khoa',
  },
  {
    id: 'MED-03',
    medicationName: 'Glucosamine Sulfate 1500mg',
    dosageForm: 'Gói bột pha nước',
    quantity: '30 gói (1 hộp)',
    expiryDate: '2027-08',
    usageInstruction: 'Uống 1 gói pha 150ml nước sau ăn trưa',
    storageRequirement: 'ROOM_TEMP',
    prescriptionStatus: 'SUPPLEMENT',
    notes: 'Hỗ trợ khớp gối theo nhu cầu gia đình',
  },
];

export const DEFAULT_HANDOVER_BELONGINGS: HandoverBelongingItem[] = [
  {
    id: 'BEL-01',
    category: 'CLOTHING',
    itemName: 'Quần áo mặc ban ngày (bộ cotton dài tay)',
    quantity: '5 bộ',
    condition: 'GOOD',
    storageLocation: 'RESIDENT_WARDROBE',
    identificationTag: 'Đã đánh dấu thêu tên cụ',
    notes: 'Chất liệu thoáng mát, giặt máy được',
  },
  {
    id: 'BEL-02',
    category: 'CLOTHING',
    itemName: 'Áo khoác ấm mùa đông & áo len',
    quantity: '2 chiếc',
    condition: 'GOOD',
    storageLocation: 'RESIDENT_WARDROBE',
    identificationTag: 'Treo ngăn áo khoác tủ phòng',
    notes: 'Dùng khi thời tiết lạnh',
  },
  {
    id: 'BEL-03',
    category: 'FOOTWEAR',
    itemName: 'Giày đi bộ đế mềm chống trượt',
    quantity: '1 đôi',
    condition: 'GOOD',
    storageLocation: 'RESIDENT_WARDROBE',
    identificationTag: 'Đế có gai cao su chống trượt',
    notes: 'Đi tập phục hồi chức năng & dạo sân',
  },
  {
    id: 'BEL-04',
    category: 'FOOTWEAR',
    itemName: 'Dép lê đi trong phòng',
    quantity: '1 đôi',
    condition: 'GOOD',
    storageLocation: 'RESIDENT_WARDROBE',
    identificationTag: 'Đặt cạnh giường ngủ',
    notes: 'Dép xốp êm, quai ngang',
  },
  {
    id: 'BEL-05',
    category: 'MEDICAL_DEVICE',
    itemName: 'Kính lão đọc sách (+2.5D)',
    quantity: '1 chiếc',
    condition: 'GOOD',
    storageLocation: 'RESIDENT_WARDROBE',
    identificationTag: 'Kèm hộp đựng và khăn lau kính',
    notes: 'Để ở ngăn kéo tủ đầu giường',
  },
  {
    id: 'BEL-06',
    category: 'PERSONAL_CARE',
    itemName: 'Bộ bàn chải, khăn mặt & lược cá nhân',
    quantity: '1 bộ (3 món)',
    condition: 'NEW_100',
    storageLocation: 'RESIDENT_WARDROBE',
    identificationTag: 'Đựng trong túi vệ sinh cá nhân',
    notes: 'Bố trí tại phòng tắm riêng của cụ',
  },
  {
    id: 'BEL-07',
    category: 'VALUABLES_DOCS',
    itemName: 'Thẻ BHYT gốc & Bản photo CCCD',
    quantity: '1 bộ hồ sơ',
    condition: 'NEW_100',
    storageLocation: 'NURSE_STATION',
    identificationTag: 'Lưu kẹp bìa hồ sơ bệnh án',
    notes: 'Bàn giao cho điều dưỡng trưởng lưu giữ phục vụ KCB',
  },
];

export interface FinancialAgreementItem {
  basicCarePackageKey: string;
  basicCarePackageName: string;
  basicCarePackageFee: number;

  supportServiceKey: string;
  supportServiceName: string;
  supportServiceFee: number;

  depositAmount: number;
  paymentCycleDay: string;
  calculatedMonthlyTotal: number;
  guardianAgreed: boolean;
  notes: string;
}

export const BASIC_CARE_PACKAGE_OPTIONS: Record<string, { name: string; defaultFee: number; desc: string }> = {
  'BCP-04': { name: 'Phòng VIP 1 giường', defaultFee: 20000000, desc: 'Phòng đơn riêng tư tuyệt đối, ban công riêng, giường y tế đa chức năng' },
  'BCP-03': { name: 'Phòng VIP 2 giường', defaultFee: 16500000, desc: 'Không gian 2 cụ, tiện nghi cao cấp, điều hòa 2 chiều, TV thông minh' },
  'BCP-02': { name: 'Phòng tập thể 3, 4 giường', defaultFee: 14500000, desc: 'Phòng tiêu chuẩn 3 - 4 cụ rộng rãi, ban công đón nắng, dinh dưỡng y học' },
  'BCP-01': { name: 'Phòng tập thể 6 giường', defaultFee: 12000000, desc: 'Phòng 6 giường tiêu chuẩn, vệ sinh khép kín, tiện nghi kinh tế' },
  'BCP-05': { name: 'Phòng chăm sóc toàn diện', defaultFee: 16500000, desc: 'Dành cho cụ phụ thuộc hoàn toàn, theo dõi y tế & chăm sóc 24/7' },
  'CUSTOM': { name: 'Khác / Thỏa thuận riêng', defaultFee: 0, desc: 'Mức phí tùy chỉnh theo hợp đồng phê duyệt' },
};

export const SUPPORT_SERVICE_OPTIONS: Record<string, { name: string; defaultFee: number; unit: string; desc: string }> = {
  'NONE': { name: 'Không đăng ký dịch vụ hỗ trợ phát sinh', defaultFee: 0, unit: 'tháng', desc: 'Không có phụ phí hỗ trợ' },
  'SS-01': { name: 'Hỗ trợ tắm gội', defaultFee: 1000000, unit: 'tháng', desc: 'Gợi ý: 500.000 - 1.500.000 đ/tháng' },
  'SS-02': { name: 'Hỗ trợ nâng đỡ, di chuyển', defaultFee: 500000, unit: 'tháng', desc: 'Gợi ý: 500.000 đ/tháng' },
  'SS-03': { name: 'Hỗ trợ xúc ăn', defaultFee: 500000, unit: 'tháng', desc: 'Gợi ý: 500.000 đ/tháng' },
  'SS-04': { name: 'Hỗ trợ vệ sinh', defaultFee: 2000000, unit: 'tháng', desc: 'Gợi ý: 1.000.000 - 3.000.000 đ/tháng' },
  'SS-05': { name: 'Hỗ trợ ăn qua sonde', defaultFee: 1500000, unit: 'tháng', desc: 'Gợi ý: 1.500.000 đ/tháng' },
  'SS-06': { name: 'Chăm sóc NCT bị lẫn tuổi già', defaultFee: 1500000, unit: 'tháng', desc: 'Gợi ý: 500.000 - 2.000.000 đ/tháng' },
  'SS-07': { name: 'Tập VLTL & PHCN chuyên sâu (Công nghệ AI)', defaultFee: 350000, unit: 'buổi', desc: 'Gợi ý: 350.000 - 500.000 đ/buổi' },
  'SS-08': { name: 'Chăm sóc các ổ loét', defaultFee: 2000000, unit: 'tháng', desc: 'Gợi ý: 2.000.000 đ/tháng' },
  'SS-09': { name: 'Chăm sóc người đặt sonde bàng quang', defaultFee: 2000000, unit: 'tháng', desc: 'Gợi ý: 2.000.000 đ/tháng' },
  'CUSTOM': { name: 'Tùy chọn dịch vụ chăm sóc hỗ trợ khác', defaultFee: 0, unit: 'tháng', desc: 'Nhập đơn giá tùy chỉnh thủ công' },
};

// Initial Clinical Assessment Data Model matching uploaded 2-page template
export interface InitialClinicalAssessment {
  intakeDate: string;
  assessorName: string;

  // I. Thông tin hành chính & Người bảo hộ
  prospectiveResidentName: string;
  gender: 'MALE' | 'FEMALE';
  dateOfBirth: string;
  identityNumber: string;
  guardianName: string;
  guardianRelationship: string;
  guardianPhone: string;
  guardianAddress: string;

  // II. Sinh tồn & Thể trạng
  pulse: string;
  pulseEvaluation: 'NORMAL' | 'SLOW' | 'FAST';
  bloodPressure: string;
  bpEvaluation: 'NORMAL' | 'HIGH' | 'LOW';
  temperature: string;
  tempEvaluation: 'NORMAL' | 'FEVER' | 'HYPOTHERMIA';
  respiratoryOrSpo2: string;
  spo2Evaluation: 'NORMAL' | 'DYSPNEA';
  weight: string;
  height: string;
  bmi: string;
  bmiEvaluation: 'NORMAL' | 'THIN' | 'OVERWEIGHT';

  // III. Bệnh lý & Thuốc
  conditions: {
    hypertension: boolean;
    cardiovascular: boolean;
    dementiaAlzheimer: boolean;
    respiratory: boolean;
    diabetes: boolean;
    diabetesType?: string;
    strokeOrHemiplegia: boolean;
    osteoarthritis: boolean;
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

  // VII. Nguy cơ lâm sàng
  fallRisk: 'LOW' | 'MODERATE' | 'HIGH';
  skinRisk: {
    hasUlcer: boolean;
    notes?: string;
    ulcerLocation?: string;
    ulcerStageSize?: string;
  };

  // VIII. Kết luận ban đầu
  careLevelProposal: 'LEVEL_1' | 'LEVEL_2' | 'LEVEL_3';
  specificNotes: string;

  // IX. Tiếp nhận thuốc & Đồ dùng cá nhân
  handoverRecord?: AdmissionHandoverRecord;

  // X. Thống nhất Bảng giá dịch vụ & Viện phí hàng tháng
  financialAgreement?: FinancialAgreementItem;
}

const DEFAULT_INITIAL_ASSESSMENT: InitialClinicalAssessment = {
  intakeDate: new Date().toISOString().slice(0, 10),
  assessorName: '',

  prospectiveResidentName: '',
  gender: 'MALE',
  dateOfBirth: '',
  identityNumber: '',
  guardianName: '',
  guardianRelationship: '',
  guardianPhone: '',
  guardianAddress: '',

  pulse: '',
  pulseEvaluation: 'NORMAL',
  bloodPressure: '',
  bpEvaluation: 'NORMAL',
  temperature: '',
  tempEvaluation: 'NORMAL',
  respiratoryOrSpo2: '',
  spo2Evaluation: 'NORMAL',
  weight: '',
  height: '',
  bmi: '',
  bmiEvaluation: 'NORMAL',

  conditions: {
    hypertension: false,
    cardiovascular: false,
    dementiaAlzheimer: false,
    respiratory: false,
    diabetes: false,
    strokeOrHemiplegia: false,
    osteoarthritis: false,
    kidneyDisease: false,
    other: false,
  },
  allergy: {
    none: true,
    drugAllergy: '',
    foodAllergy: '',
  },
  medicationsNotes: '',

  adl: {
    eating: 'INDEPENDENT',
    bathing: 'INDEPENDENT',
    dressing: 'INDEPENDENT',
    toileting: 'INDEPENDENT',
    mobility: 'INDEPENDENT',
    excretion: 'AUTONOMOUS',
    mobilitySupport: 'NONE',
  },

  mental: {
    alertAndResponsive: true,
    memoryCognition: 'NORMAL',
    emotionalState: 'HAPPY_SOCIABLE',
    sleepQuality: 'GOOD',
  },

  nutrition: {
    dietType: 'NORMAL_RICE',
    swallowingAbility: 'NORMAL',
    dentalStatus: 'NATURAL_GOOD',
  },

  fallRisk: 'LOW',
  skinRisk: {
    hasUlcer: false,
    notes: '',
  },

  careLevelProposal: 'LEVEL_1',
  specificNotes: '',

  handoverRecord: {
    handoverDate: new Date().toISOString().slice(0, 10),
    guardianDelivererName: '',
    guardianPhone: '',
    nurseReceiverName: 'Trần Thị Mai (Điều dưỡng)',
    caregiverReceiverName: 'Lê Văn Nam (Chăm sóc viên)',
    supervisorApprovalName: 'Hoàng Quốc Anh (Ban Giám đốc)',
    medications: DEFAULT_HANDOVER_MEDICATIONS,
    belongings: DEFAULT_HANDOVER_BELONGINGS,
    generalNotes: 'Thân nhân và người cao tuổi đã bàn giao đầy đủ thuốc và đồ dùng cá nhân. Trung Tâm Dưỡng Lão Tâm An đã kiểm đếm và lưu giữ theo đúng quy trình.',
  },

  financialAgreement: {
    basicCarePackageKey: 'BCP-02',
    basicCarePackageName: 'Phòng tập thể 3, 4 giường',
    basicCarePackageFee: 14500000,
    supportServiceKey: 'NONE',
    supportServiceName: 'Không đăng ký dịch vụ hỗ trợ phát sinh',
    supportServiceFee: 0,
    depositAmount: 20000000,
    paymentCycleDay: 'Từ ngày 01 đến ngày 05 hàng tháng',
    calculatedMonthlyTotal: 14500000,
    guardianAgreed: true,
    notes: 'Đại diện gia đình thống nhất Bảng giá dịch vụ và ký cam kết viện phí hàng tháng.',
  },
};

const STATUS_BADGES: Record<string, { label: string; className: string }> = {
  DRAFT: { label: 'Bản nháp (Đang lập)', className: 'badge badge-warning' },
  SUBMITTED: { label: 'Đã nộp hồ sơ', className: 'badge badge-info' },
  ASSESSED: { label: 'Đã đánh giá', className: 'badge badge-info' },
  ASSESSMENT_COMPLETED: { label: 'Đã hoàn thiện hồ sơ', className: 'badge badge-info' },
  CLASSIFIED: { label: 'Đã phân loại mức chăm sóc', className: 'badge badge-purple' },
  CLASSIFICATION_APPROVED: { label: 'Đã duyệt phân loại', className: 'badge badge-purple' },
  DECIDED: { label: 'Đã có quyết định', className: 'badge badge-purple' },
  DECISION_MADE: { label: 'Đã có quyết định', className: 'badge badge-purple' },
  ADMITTED: { label: 'Đã vào Tâm An chính thức', className: 'badge badge-success' },
  COMPLETED: { label: 'Đã vào Tâm An chính thức', className: 'badge badge-success' },
  CANCELLED: { label: 'Đã hủy', className: 'badge badge-neutral' },
};

interface DobDatePickerProps {
  value: string;
  onChange: (val: string) => void;
  required?: boolean;
}

function DobDatePicker({ value, onChange, required }: DobDatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const parseValue = (val: string) => {
    if (!val) return { day: 1, month: 0, year: 1950 };
    const trimmed = val.trim();
    if (/^\d{4}$/.test(trimmed)) {
      return { day: 1, month: 0, year: parseInt(trimmed, 10) };
    }
    if (trimmed.includes('/')) {
      const parts = trimmed.split('/');
      if (parts.length === 3) {
        const d = parseInt(parts[0], 10) || 1;
        const m = (parseInt(parts[1], 10) || 1) - 1;
        const y = parseInt(parts[2], 10) || 1950;
        return { day: d, month: Math.max(0, Math.min(11, m)), year: y };
      }
    }
    if (trimmed.includes('-')) {
      const parts = trimmed.split('-');
      if (parts.length === 3) {
        const y = parseInt(parts[0], 10) || 1950;
        const m = (parseInt(parts[1], 10) || 1) - 1;
        const d = parseInt(parts[2], 10) || 1;
        return { day: d, month: Math.max(0, Math.min(11, m)), year: y };
      }
    }
    return { day: 1, month: 0, year: 1950 };
  };

  const currentParsed = parseValue(value);
  const [selectedYear, setSelectedYear] = useState(currentParsed.year);
  const [selectedMonth, setSelectedMonth] = useState(currentParsed.month);

  useEffect(() => {
    const p = parseValue(value);
    setSelectedYear(p.year);
    setSelectedMonth(p.month);
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(selectedYear, selectedMonth, 1).getDay();

  const handleSelectDay = (day: number) => {
    const dd = String(day).padStart(2, '0');
    const mm = String(selectedMonth + 1).padStart(2, '0');
    const yyyy = selectedYear;
    onChange(`${dd}/${mm}/${yyyy}`);
    setIsOpen(false);
  };

  const years = Array.from({ length: 96 }, (_, i) => 1920 + i);

  return (
    <div ref={containerRef} style={{ position: 'relative', display: 'inline-block' }}>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={() => setIsOpen(true)}
        onClick={() => setIsOpen(true)}
        placeholder="dd/mm/yyyy"
        required={required}
        className="form-input"
        style={{ width: '165px', fontWeight: 600, letterSpacing: '0.02em' }}
      />

      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            zIndex: 1050,
            width: '320px',
            background: '#ffffff',
            border: '1px solid #cbd5e1',
            borderRadius: '0.5rem',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.18)',
            padding: '0.75rem',
          }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '0.5rem', marginBottom: '0.65rem' }}>
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '0.2rem' }}>
                Sổ xuống chọn Năm:
              </label>
              <select
                value={selectedYear}
                onChange={e => setSelectedYear(parseInt(e.target.value, 10))}
                className="form-input"
                style={{ padding: '0.25rem 0.4rem', fontSize: '0.85rem', fontWeight: 700, color: '#0284c7' }}
              >
                {years.map(y => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '0.2rem' }}>
                Tháng:
              </label>
              <select
                value={selectedMonth}
                onChange={e => setSelectedMonth(parseInt(e.target.value, 10))}
                className="form-input"
                style={{ padding: '0.25rem 0.4rem', fontSize: '0.85rem' }}
              >
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i} value={i}>
                    Tháng {i + 1}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.15rem', textAlign: 'center', fontWeight: 600, fontSize: '0.75rem', color: '#64748b', marginBottom: '0.35rem' }}>
            <span>CN</span><span>T2</span><span>T3</span><span>T4</span><span>T5</span><span>T6</span><span>T7</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.2rem' }}>
            {Array.from({ length: firstDayOfWeek }).map((_, idx) => (
              <div key={`empty-${idx}`} />
            ))}
            {Array.from({ length: daysInMonth }, (_, idx) => {
              const dayNum = idx + 1;
              const isSelected = currentParsed.day === dayNum && currentParsed.month === selectedMonth && currentParsed.year === selectedYear;
              return (
                <button
                  key={dayNum}
                  type="button"
                  onClick={() => handleSelectDay(dayNum)}
                  style={{
                    padding: '0.3rem 0',
                    fontSize: '0.82rem',
                    borderRadius: '0.25rem',
                    border: '1px solid',
                    borderColor: isSelected ? '#0284c7' : '#e2e8f0',
                    background: isSelected ? '#0284c7' : '#f8fafc',
                    color: isSelected ? '#ffffff' : '#1e293b',
                    fontWeight: isSelected ? 700 : 500,
                    cursor: 'pointer',
                  }}
                >
                  {dayNum}
                </button>
              );
            })}
          </div>

          <div style={{ marginTop: '0.65rem', paddingTop: '0.5rem', borderTop: '1px solid #f1f5f9', display: 'flex', gap: '0.3rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Năm sinh chọn nhanh:</span>
            {[1935, 1940, 1945, 1950, 1955, 1960].map(yr => (
              <button
                key={yr}
                type="button"
                onClick={() => setSelectedYear(yr)}
                style={{
                  fontSize: '0.72rem',
                  padding: '0.1rem 0.35rem',
                  borderRadius: '0.2rem',
                  border: '1px solid #cbd5e1',
                  background: selectedYear === yr ? '#e0f2fe' : '#ffffff',
                  color: selectedYear === yr ? '#0369a1' : '#475569',
                  fontWeight: selectedYear === yr ? 700 : 400,
                  cursor: 'pointer',
                }}
              >
                {yr}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function AdmissionPage() {
  const { actor } = useActor();

  const [admissions, setAdmissions] = useState<AdmissionCase[]>([]);
  const [selectedCase, setSelectedCase] = useState<AdmissionCase | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingCase, setEditingCase] = useState<AdmissionCase | null>(null);
  const [viewingAssessment, setViewingAssessment] = useState<{ c: AdmissionCase; data: InitialClinicalAssessment } | null>(null);
  const [decisionCase, setDecisionCase] = useState<AdmissionCase | null>(null);

  // Handover History Modals
  const [showHandoverHistoryModal, setShowHandoverHistoryModal] = useState(false);
  const [selectedHandoverPrint, setSelectedHandoverPrint] = useState<{
    residentName: string;
    caseCode: string;
    handover: AdmissionHandoverRecord;
  } | null>(null);
  const [handoverSearchTerm, setHandoverSearchTerm] = useState('');

  // Form State
  const [form, setForm] = useState<InitialClinicalAssessment>(DEFAULT_INITIAL_ASSESSMENT);

  // Decision & Classification State
  const [classification, setClassification] = useState<ClassificationResult | null>(null);
  const [approvedLevel, setApprovedLevel] = useState('INDEPENDENT');
  const [overrideReason, setOverrideReason] = useState('');

  const refreshList = useCallback(async () => {
    if (!actor) return;
    try {
      const res = await listAdmissions(actor);
      setAdmissions(res.items || []);
    } catch (err: any) {
      setMessage(err.message || 'Lỗi khi tải danh sách tiếp nhận.');
    }
  }, [actor]);

  useEffect(() => {
    void refreshList();
  }, [refreshList]);

  // Handle Vital & BMI Calculations
  const calculateBmi = (wStr: string, hStr: string) => {
    const w = parseFloat(wStr);
    const h = parseFloat(hStr);
    if (!isNaN(w) && !isNaN(h) && h > 0) {
      const hMeter = h / 100;
      const val = Math.round((w / (hMeter * hMeter)) * 10) / 10;
      let evalResult: 'NORMAL' | 'THIN' | 'OVERWEIGHT' = 'NORMAL';
      if (val < 18.5) evalResult = 'THIN';
      else if (val >= 23.0) evalResult = 'OVERWEIGHT';
      return { bmi: String(val), evalResult };
    }
    return { bmi: '', evalResult: 'NORMAL' as const };
  };

  const normalizeDob = (dobStr: string): string => {
    if (!dobStr) return '';
    const trimmed = dobStr.trim();
    if (/^\d{4}$/.test(trimmed)) {
      return `01/01/${trimmed}`;
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      const [y, m, d] = trimmed.split('-');
      return `${d}/${m}/${y}`;
    }
    return trimmed;
  };

  const formatDateDisplay = (dobStr?: string) => {
    if (!dobStr) return '—';
    const trimmed = dobStr.trim();
    if (/^\d{4}$/.test(trimmed)) return trimmed;
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(trimmed)) return trimmed;
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      const [y, m, d] = trimmed.split('-');
      return `${d}/${m}/${y}`;
    }
    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString('vi-VN');
    }
    return trimmed;
  };

  const handleWeightChange = (val: string) => {
    const { bmi, evalResult } = calculateBmi(val, form.height);
    setForm(prev => ({ ...prev, weight: val, bmi, bmiEvaluation: evalResult }));
  };

  const handleHeightChange = (val: string) => {
    const { bmi, evalResult } = calculateBmi(form.weight, val);
    setForm(prev => ({ ...prev, height: val, bmi, bmiEvaluation: evalResult }));
  };

  const handlePulseChange = (val: string) => {
    const num = parseFloat(val);
    let evaluation: 'NORMAL' | 'SLOW' | 'FAST' = 'NORMAL';
    if (!isNaN(num)) {
      if (num < 60) evaluation = 'SLOW';
      else if (num > 90) evaluation = 'FAST';
    }
    setForm(prev => ({ ...prev, pulse: val, pulseEvaluation: evaluation }));
  };

  const handleBpChange = (val: string) => {
    let evaluation: 'NORMAL' | 'HIGH' | 'LOW' = 'NORMAL';
    const parts = val.split('/').map(s => parseFloat(s.trim()));
    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
      if (parts[0] > 120 || parts[1] > 80) evaluation = 'HIGH';
      else if (parts[0] < 90 || parts[1] < 60) evaluation = 'LOW';
    }
    setForm(prev => ({ ...prev, bloodPressure: val, bpEvaluation: evaluation }));
  };

  const handleTempChange = (val: string) => {
    const num = parseFloat(val);
    let evaluation: 'NORMAL' | 'FEVER' | 'HYPOTHERMIA' = 'NORMAL';
    if (!isNaN(num)) {
      if (num > 37.5) evaluation = 'FEVER';
      else if (num < 36.0) evaluation = 'HYPOTHERMIA';
    }
    setForm(prev => ({ ...prev, temperature: val, tempEvaluation: evaluation }));
  };

  const handleSpo2Change = (val: string) => {
    const num = parseFloat(val);
    let evaluation: 'NORMAL' | 'DYSPNEA' = 'NORMAL';
    if (!isNaN(num)) {
      if (num < 95) evaluation = 'DYSPNEA';
    }
    setForm(prev => ({ ...prev, respiratoryOrSpo2: val, spo2Evaluation: evaluation }));
  };

  const handleOpenCreate = () => {
    setEditingCase(null);
    setForm({
      ...DEFAULT_INITIAL_ASSESSMENT,
      assessorName: actor?.displayName || '',
      intakeDate: new Date().toISOString().slice(0, 10),
    });
    setIsCreateOpen(true);
  };

  const handleEditDraft = async (c: AdmissionCase) => {
    if (!actor) return;
    if (c.status === 'ADMITTED' || c.status === 'COMPLETED') {
      setMessage('Hồ sơ đối với cụ đã vào Tâm An chính thức không thể chỉnh sửa.');
      return;
    }
    try {
      setBusy(true);
      setMessage('');
      const overview = await getAssessmentOverview(actor, c.admissionCaseId);
      let parsedData: InitialClinicalAssessment = {
        ...DEFAULT_INITIAL_ASSESSMENT,
        prospectiveResidentName: c.prospectiveResidentName || '',
        gender: c.gender === 'FEMALE' ? 'FEMALE' : 'MALE',
        dateOfBirth: c.dateOfBirth ? c.dateOfBirth.slice(0, 10) : '',
        identityNumber: c.identityNumber || '',
        intakeDate: c.requestedAdmissionDate ? c.requestedAdmissionDate.slice(0, 10) : new Date().toISOString().slice(0, 10),
        assessorName: actor?.displayName || '',
      };
      if (overview?.assessments?.[0]?.summary) {
        try {
          const sum = overview.assessments[0].summary;
          if (sum.startsWith('{')) {
            parsedData = { ...parsedData, ...JSON.parse(sum) };
          }
        } catch (e) {}
      }
      setEditingCase(c);
      setForm(parsedData);
      setIsCreateOpen(true);
    } catch (err: any) {
      setMessage(err.message || 'Không thể tải thông tin bản nháp.');
    } finally {
      setBusy(false);
    }
  };

  // Submit Intake: Save as Draft or Save & Finalize Assessment
  const handleSave = async (isFinalize: boolean) => {
    if (!actor) return;
    if (!form.prospectiveResidentName.trim()) {
      setMessage('Vui lòng điền Họ và tên người cao tuổi.');
      return;
    }
    if (isFinalize && !form.dateOfBirth) {
      setMessage('Để hoàn thiện hồ sơ, vui lòng điền Ngày tháng năm sinh của người cao tuổi.');
      return;
    }

    try {
      setBusy(true);
      setMessage('');

      let caseId = editingCase?.admissionCaseId;

      const dobValue = normalizeDob(form.dateOfBirth) || new Date().toISOString().slice(0, 10);

      if (!caseId) {
        // 1. Create Base Admission Case
        const caseItem = await createAdmission(actor, {
          prospectiveResidentName: form.prospectiveResidentName.trim(),
          dateOfBirth: dobValue,
          gender: form.gender,
          identityNumber: form.identityNumber.trim() || undefined,
          requestedAdmissionDate: form.intakeDate,
          admissionReason: form.specificNotes || 'Đăng ký tiếp nhận và theo dõi sức khỏe ban đầu',
        });
        caseId = caseItem.admissionCaseId;
      }

      // 2. Create Guardian / Emergency Contact
      if (form.guardianName.trim()) {
        try {
          await createAdmissionContact(actor, caseId, {
            contactType: 'GUARDIAN',
            fullName: form.guardianName.trim(),
            relationship: form.guardianRelationship || 'Người bảo hộ',
            phone: form.guardianPhone || '',
            address: form.guardianAddress || '',
            isPrimary: true,
            isEmergencyContact: true,
            authorizedForHealthReports: true,
          });
        } catch (e) {}
      }

      // 3. Create Vital Measurements
      if (form.bloodPressure) {
        const bpParts = form.bloodPressure.split('/');
        await createAdmissionMeasurement(actor, caseId, {
          measurementType: 'BLOOD_PRESSURE',
          valueNumeric: parseFloat(bpParts[0]) || 120,
          valueSecondary: parseFloat(bpParts[1]) || 80,
          unit: 'mmHg',
          notes: `Đánh giá: ${form.bpEvaluation}`,
        });
      }
      if (form.pulse) {
        await createAdmissionMeasurement(actor, caseId, {
          measurementType: 'HEART_RATE',
          valueNumeric: parseFloat(form.pulse) || 75,
          unit: 'bpm',
          notes: `Đánh giá: ${form.pulseEvaluation}`,
        });
      }
      if (form.weight) {
        await createAdmissionMeasurement(actor, caseId, {
          measurementType: 'WEIGHT',
          valueNumeric: parseFloat(form.weight) || 50,
          unit: 'kg',
          notes: `Chiều cao: ${form.height}cm, BMI: ${form.bmi}`,
        });
      }

      // 4. Save Comprehensive Initial Assessment with ADL, Cognitive, Nutrition, Risks
      const adlMap: Record<string, string> = {
        EATING: form.adl.eating === 'INDEPENDENT' ? 'INDEPENDENT' : form.adl.eating === 'PARTIAL_ASSIST' ? 'PARTIAL_ASSISTANCE' : 'FULL_ASSISTANCE',
        BATHING: form.adl.bathing === 'INDEPENDENT' ? 'INDEPENDENT' : form.adl.bathing === 'PARTIAL_ASSIST' ? 'PARTIAL_ASSISTANCE' : 'FULL_ASSISTANCE',
        DRESSING: form.adl.dressing === 'INDEPENDENT' ? 'INDEPENDENT' : form.adl.dressing === 'PARTIAL_ASSIST' ? 'PARTIAL_ASSISTANCE' : 'FULL_ASSISTANCE',
        TOILETING: form.adl.toileting === 'INDEPENDENT' ? 'INDEPENDENT' : form.adl.toileting === 'PARTIAL_ASSIST' ? 'PARTIAL_ASSISTANCE' : 'FULL_ASSISTANCE',
        MOBILITY: form.adl.mobility === 'INDEPENDENT' ? 'INDEPENDENT' : form.adl.mobility === 'PARTIAL_ASSIST' ? 'PARTIAL_ASSISTANCE' : 'FULL_ASSISTANCE',
      };

      await createInitialAssessment(actor, caseId, {
        assessmentType: 'INITIAL',
        summary: JSON.stringify(form),
        clinicalNotes: form.specificNotes,
        adl: Object.entries(adlMap).map(([activityCode, assistanceLevel]) => ({
          activityCode,
          assistanceLevel,
          notes: `Bài tiết: ${form.adl.excretion}, Dụng cụ: ${form.adl.mobilitySupport}`,
        })),
        cognitive: {
          alertness: form.mental.alertAndResponsive ? 'ALERT' : 'DROWSY',
          memory: form.mental.memoryCognition === 'NORMAL' ? 'INTACT' : 'IMPAIRED',
          mood: form.mental.emotionalState,
          notes: `Giấc ngủ: ${form.mental.sleepQuality}`,
        },
        nutrition: {
          dietType: form.nutrition.dietType,
          swallowingStatus: form.nutrition.swallowingAbility === 'NORMAL' ? 'NORMAL' : 'DYSPHAGIA',
          oralHealth: form.nutrition.dentalStatus,
          notes: form.medicationsNotes,
        },
        risks: [
          { riskType: 'FALL', riskLevel: form.fallRisk, score: form.fallRisk === 'HIGH' ? 3 : 1 },
          { riskType: 'SKIN_INTEGRITY', riskLevel: form.skinRisk.hasUlcer ? 'HIGH' : 'LOW', details: form.skinRisk.notes },
        ],
      });

      if (isFinalize) {
        // 5. Finalize status and trigger Classification Engine
        await completeAssessment(actor, caseId);
        try {
          await generateClassification(actor, caseId);
        } catch (e) {}
        setMessage(`✅ Đã hoàn thiện hồ sơ tiếp nhận và phân loại mức độ chăm sóc cho cụ ${form.prospectiveResidentName}!`);
      } else {
        setMessage(`💾 Đã lưu bản nháp hồ sơ tiếp nhận cho cụ ${form.prospectiveResidentName}. Bạn có thể chỉnh sửa và điền tiếp bất kỳ lúc nào.`);
      }

      await refreshList();
      setIsCreateOpen(false);
      setEditingCase(null);
    } catch (err: any) {
      setMessage(err.message || 'Lỗi khi lưu hồ sơ tiếp nhận.');
    } finally {
      setBusy(false);
    }
  };

  // Quick Finalize from Table Row Action
  const handleQuickFinalize = async (item: AdmissionCase) => {
    if (!actor) return;
    if (!confirm(`Xác nhận chuyển hồ sơ của cụ "${item.prospectiveResidentName}" sang trạng thái "Đã hoàn thiện hồ sơ"?`)) return;

    try {
      setBusy(true);
      setMessage('');
      await completeAssessment(actor, item.admissionCaseId);
      try {
        await generateClassification(actor, item.admissionCaseId);
      } catch (e) {}
      await refreshList();
      setMessage(`✅ Hồ sơ của cụ ${item.prospectiveResidentName} đã được chuyển sang trạng thái "Đã hoàn thiện hồ sơ"!`);
    } catch (err: any) {
      setMessage(err.message || 'Lỗi khi chuyển trạng thái hồ sơ.');
    } finally {
      setBusy(false);
    }
  };

  // Helper to parse assessment from raw case or overview
  const parseCaseAssessment = async (c: AdmissionCase) => {
    if (!actor) return;
    try {
      setBusy(true);
      const overview = await getAssessmentOverview(actor, c.admissionCaseId);
      let parsedData: InitialClinicalAssessment = DEFAULT_INITIAL_ASSESSMENT;
      if (overview?.assessments?.[0]?.summary) {
        try {
          const sum = overview.assessments[0].summary;
          if (sum.startsWith('{')) {
            parsedData = JSON.parse(sum);
          }
        } catch (e) {}
      } else {
        parsedData = {
          ...DEFAULT_INITIAL_ASSESSMENT,
          prospectiveResidentName: c.prospectiveResidentName,
          gender: c.gender === 'FEMALE' ? 'FEMALE' : 'MALE',
          dateOfBirth: c.dateOfBirth ? c.dateOfBirth.slice(0, 10) : '',
          identityNumber: c.identityNumber || '',
        };
      }
      setViewingAssessment({ c, data: parsedData });
    } catch (err: any) {
      setMessage(err.message || 'Không thể tải chi tiết đánh giá.');
    } finally {
      setBusy(false);
    }
  };

  // Finalize Admission Flow
  const handleFinalize = async (caseId: string) => {
    if (!actor) return;
    if (!confirm('Xác nhận hoàn tất tiếp nhận và chuyển đổi thành người cao tuổi chính thức vào Tâm An?')) return;

    try {
      setBusy(true);
      setMessage('');
      const res = await finalizeAdmission(actor, caseId);
      await refreshList();
      setMessage(`Đã hoàn tất tiếp nhận thành công! Mã người cao tuổi chính thức: ${res.residentCode} (${res.displayName}). Đã khởi tạo Bảng kê thu phí chuẩn theo đúng Nguyên tắc tính toán nhất quán Viện Tâm An.`);
    } catch (err: any) {
      setMessage(err.message || 'Lỗi khi hoàn tất tiếp nhận.');
    } finally {
      setBusy(false);
    }
  };

  const isSupervisor = actor?.actorRole === 'CARE_MANAGER' || actor?.actorRole === 'SUPERVISOR';

  const kpis = useMemo(() => {
    return {
      total: admissions.length,
      draft: admissions.filter(a => a.status === 'DRAFT' || a.status === 'ASSESSED' || a.status === 'ASSESSMENT_COMPLETED').length,
      classified: admissions.filter(a => a.status === 'CLASSIFIED' || a.status === 'DECIDED' || a.status === 'CLASSIFICATION_APPROVED' || a.status === 'DECISION_MADE').length,
      admitted: admissions.filter(a => a.status === 'ADMITTED' || a.status === 'COMPLETED').length,
    };
  }, [admissions]);

  return (
    <div className="page-content">
      {/* Header */}
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 className="page-title">Tiếp Nhận & Đánh Giá Sức Khỏe Ban Đầu</h1>
            <p className="page-description">
              Quy trình tiếp nhận, đánh giá đầu vào toàn diện (Sinh tồn, ADL, Bệnh lý, Người bảo hộ), tự động phân loại mức độ chăm sóc và thống nhất dữ liệu với Báo cáo định kỳ.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
            <button
              onClick={() => setShowHandoverHistoryModal(true)}
              className="btn btn-secondary"
              style={{ background: '#f0fdf4', color: '#166534', borderColor: '#86efac', fontWeight: 700 }}
            >
              📜 Lịch Sử Phiếu Tiếp Nhận Thuốc & Đồ Dùng
            </button>
            <button
              onClick={handleOpenCreate}
              className="btn btn-primary"
            >
              + Tiếp nhận người cao tuổi mới
            </button>
          </div>
        </div>
      </div>

      {/* Message Banner */}
      {message && (
        <div className="alert-card alert-info" style={{ marginBottom: '1rem' }}>
          <span>{message}</span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="kpi-row">
        <div className="kpi-card">
          <div className="kpi-label">Tổng hồ sơ tiếp nhận</div>
          <div className="kpi-val">{kpis.total}</div>
          <div className="kpi-sub">Toàn bộ hồ sơ ban đầu</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Đang đánh giá & phân loại</div>
          <div className="kpi-val" style={{ color: '#d97706' }}>{kpis.draft}</div>
          <div className="kpi-sub">Khảo sát lâm sàng & ADL</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Đã duyệt phân loại</div>
          <div className="kpi-val" style={{ color: '#7c3aed' }}>{kpis.classified}</div>
          <div className="kpi-sub">Chờ hoàn tất tiếp nhận</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Đã vào Tâm An chính thức</div>
          <div className="kpi-val" style={{ color: '#16a34a' }}>{kpis.admitted}</div>
          <div className="kpi-sub">Đã chuyển đổi thành Resident</div>
        </div>
      </div>

      {/* Admissions Table */}
      <div className="table-responsive">
        <table className="ui-table">
          <thead>
            <tr>
              <th>Mã hồ sơ / Người cao tuổi</th>
              <th>Ngày sinh & Giới tính</th>
              <th>CCCD / Định danh</th>
              <th>Ngày tiếp nhận</th>
              <th>Trạng thái</th>
              <th className="text-right">Thao tác & In phiếu</th>
            </tr>
          </thead>
          <tbody>
            {admissions.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center" style={{ padding: '3rem', color: 'var(--text-secondary)' }}>
                  Chưa có hồ sơ tiếp nhận nào. Bấm <b>"+ Tiếp nhận người cao tuổi mới"</b> để lập phiếu đánh giá đầu vào.
                </td>
              </tr>
            ) : (
              admissions.map(item => {
                const statusMeta = STATUS_BADGES[item.status] || { label: item.status, className: 'badge badge-neutral' };
                const isDraft = item.status === 'DRAFT';

                return (
                  <tr key={item.admissionCaseId}>
                    <td>
                      <div className="cell-primary">{item.prospectiveResidentName}</div>
                      <div className="cell-secondary">Mã hồ sơ: {item.admissionCode}</div>
                    </td>
                    <td>
                      <div>{formatDateDisplay(item.dateOfBirth)}</div>
                      <div className="cell-secondary">{item.gender === 'FEMALE' ? 'Nữ' : 'Nam'}</div>
                    </td>
                    <td>
                      <div>{item.identityNumber || '—'}</div>
                    </td>
                    <td>
                      <div>{item.requestedAdmissionDate ? new Date(item.requestedAdmissionDate).toLocaleDateString('vi-VN') : '—'}</div>
                    </td>
                    <td>
                      <span className={statusMeta.className}>{statusMeta.label}</span>
                    </td>
                    <td className="text-right">
                      <div className="btn-group" style={{ display: 'flex', gap: '0.35rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                        {item.status !== 'ADMITTED' && item.status !== 'COMPLETED' && (
                          <button
                            onClick={() => void handleEditDraft(item)}
                            className="btn btn-sm btn-warning"
                            style={{ fontWeight: 600 }}
                            title="Sửa đổi/chỉnh sửa lại thông tin trong phiếu đánh giá ban đầu"
                          >
                            ✏️ Sửa phiếu
                          </button>
                        )}

                        {isDraft && (
                          <button
                            onClick={() => void handleQuickFinalize(item)}
                            className="btn btn-sm btn-success"
                            title="Chuyển hồ sơ sang trạng thái Đã hoàn thiện"
                          >
                            ✅ Hoàn thiện
                          </button>
                        )}

                        <button
                          onClick={() => void parseCaseAssessment(item)}
                          className="btn btn-sm btn-secondary"
                          title="Xem toàn bộ phiếu đánh giá ban đầu & In chuẩn y khoa (A4)"
                        >
                          📄 Xem & In Phiếu
                        </button>

                        {item.status !== 'ADMITTED' && isSupervisor && (
                          <button
                            onClick={() => void handleFinalize(item.admissionCaseId)}
                            className="btn btn-sm btn-success"
                            title="Xác nhận người cao tuổi đã tiếp nhận vào Tâm An chính thức"
                          >
                            Vào Tâm An
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
      {/* MODAL 1: LẬP PHIẾU ĐÁNH GIÁ SỨC KHỎE BAN ĐẦU (NHẬP SỐ LIỆU ĐẦU VÀO) */}
      {/* ========================================================================= */}
      {isCreateOpen && (
        <div className="modal-overlay">
          <div className="modal-dialog modal-dialog-lg" style={{ maxWidth: '920px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                <h2 className="modal-title">Phiếu Đánh Giá Sức Khỏe Ban Đầu Cho Người Cao Tuổi</h2>
                {editingCase && (
                  <span className="badge badge-warning">
                    Đang chỉnh sửa bản nháp: {editingCase.admissionCode}
                  </span>
                )}
              </div>
              <button onClick={() => { setIsCreateOpen(false); setEditingCase(null); }} className="modal-close">
                &times;
              </button>
            </div>

            <form onSubmit={e => { e.preventDefault(); void handleSave(true); }}>
              <div className="modal-body">
                {/* Header Information */}
                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '0.5rem', padding: '1rem', marginBottom: '1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <h3 style={{ margin: 0, fontSize: '1rem', color: '#166534', fontWeight: 700 }}>
                      I. THÔNG TIN HÀNH CHÍNH & NGƯỜI BẢO HỘ
                    </h3>
                    <div style={{ fontSize: '0.85rem' }}>
                      <b>Ngày tiếp nhận:</b> {form.intakeDate}
                    </div>
                  </div>

                  <div className="form-row">
                    <div>
                      <label className="form-label">
                        Họ và tên người cao tuổi <span className="req">*</span>
                      </label>
                      <input
                        type="text"
                        value={form.prospectiveResidentName}
                        onChange={e => setForm(prev => ({ ...prev, prospectiveResidentName: e.target.value }))}
                        required
                        className="form-input"
                        placeholder="Nhập họ và tên người cao tuổi..."
                      />
                    </div>

                    <div>
                      <label className="form-label">Giới tính <span className="req">*</span></label>
                      <select
                        value={form.gender}
                        onChange={e => setForm(prev => ({ ...prev, gender: e.target.value as any }))}
                        className="form-select"
                        style={{ width: '100%' }}
                      >
                        <option value="MALE">Nam</option>
                        <option value="FEMALE">Nữ</option>
                      </select>
                    </div>
                  </div>

                  <div className="form-row" style={{ marginTop: '0.75rem' }}>
                    <div>
                      <label className="form-label">Ngày tháng năm sinh <span className="req">*</span></label>
                      <DobDatePicker
                        value={form.dateOfBirth}
                        onChange={val => setForm(prev => ({ ...prev, dateOfBirth: val }))}
                        required
                      />
                    </div>

                    <div>
                      <label className="form-label">Số CMND / CCCD</label>
                      <input
                        type="text"
                        value={form.identityNumber}
                        onChange={e => setForm(prev => ({ ...prev, identityNumber: e.target.value }))}
                        placeholder="Số CMND / Thẻ CCCD..."
                        className="form-input"
                      />
                    </div>
                  </div>

                  <div className="form-row" style={{ marginTop: '0.75rem' }}>
                    <div>
                      <label className="form-label">Họ tên người bảo hộ (NBH) & Mối quan hệ</label>
                      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '0.5rem' }}>
                        <input
                          type="text"
                          value={form.guardianName}
                          onChange={e => setForm(prev => ({ ...prev, guardianName: e.target.value }))}
                          placeholder="Họ tên người bảo hộ..."
                          className="form-input"
                        />
                        <input
                          type="text"
                          value={form.guardianRelationship}
                          onChange={e => setForm(prev => ({ ...prev, guardianRelationship: e.target.value }))}
                          placeholder="Mối quan hệ..."
                          className="form-input"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="form-label">Số điện thoại NBH & Địa chỉ liên hệ</label>
                      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 2fr', gap: '0.5rem' }}>
                        <input
                          type="text"
                          value={form.guardianPhone}
                          onChange={e => setForm(prev => ({ ...prev, guardianPhone: e.target.value }))}
                          placeholder="Số điện thoại..."
                          className="form-input"
                        />
                        <input
                          type="text"
                          value={form.guardianAddress}
                          onChange={e => setForm(prev => ({ ...prev, guardianAddress: e.target.value }))}
                          placeholder="Địa chỉ liên hệ..."
                          className="form-input"
                        />
                      </div>
                    </div>
                  </div>

                  <div style={{ marginTop: '0.75rem' }}>
                    <label className="form-label">Người đánh giá (Nhân viên y tế)</label>
                    <input
                      type="text"
                      value={form.assessorName}
                      onChange={e => setForm(prev => ({ ...prev, assessorName: e.target.value }))}
                      placeholder="Họ tên nhân viên đánh giá..."
                      className="form-input"
                    />
                  </div>
                </div>

                {/* II. DẤU HIỆU SINH TỒN & THỂ TRẠNG */}
                <div style={{ border: '1px solid #e2e8f0', borderRadius: '0.5rem', padding: '1rem', marginBottom: '1.25rem' }}>
                  <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '1rem', color: '#1e293b', fontWeight: 700 }}>
                    II. ĐÁNH GIÁ DẤU HIỆU SINH TỒN & THỂ TRẠNG BAN ĐẦU
                  </h3>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
                    <div>
                      <label className="form-label">Mạch (lần/phút)</label>
                      <input
                        type="number"
                        value={form.pulse}
                        onChange={e => handlePulseChange(e.target.value)}
                        placeholder="Lần/phút..."
                        className="form-input"
                      />
                      <div style={{ marginTop: '0.35rem', fontSize: '0.78rem' }}>
                        <span className={form.pulseEvaluation === 'NORMAL' ? 'badge badge-success' : 'badge badge-warning'}>
                          {form.pulseEvaluation === 'NORMAL' ? 'Bình thường (60-90)' : form.pulseEvaluation === 'SLOW' ? 'Chậm (<60)' : 'Nhanh (>90)'}
                        </span>
                      </div>
                    </div>

                    <div>
                      <label className="form-label">Huyết áp (mmHg)</label>
                      <input
                        type="text"
                        value={form.bloodPressure}
                        onChange={e => handleBpChange(e.target.value)}
                        placeholder="mmHg (ví dụ: 120/80)..."
                        className="form-input"
                      />
                      <div style={{ marginTop: '0.35rem', fontSize: '0.78rem' }}>
                        <span className={form.bpEvaluation === 'NORMAL' ? 'badge badge-success' : form.bpEvaluation === 'HIGH' ? 'badge badge-danger' : 'badge badge-warning'}>
                          {form.bpEvaluation === 'NORMAL' ? 'Bình thường' : form.bpEvaluation === 'HIGH' ? 'Cao (>120/80)' : 'Thấp (<90/60)'}
                        </span>
                      </div>
                    </div>

                    <div>
                      <label className="form-label">Nhiệt độ (°C)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={form.temperature}
                        onChange={e => handleTempChange(e.target.value)}
                        placeholder="°C (ví dụ: 36.5)..."
                        className="form-input"
                      />
                      <div style={{ marginTop: '0.35rem', fontSize: '0.78rem' }}>
                        <span className={form.tempEvaluation === 'NORMAL' ? 'badge badge-success' : 'badge badge-danger'}>
                          {form.tempEvaluation === 'NORMAL' ? 'Bình thường (36.0-37.5)' : form.tempEvaluation === 'FEVER' ? 'Sốt' : 'Hạ thân nhiệt'}
                        </span>
                      </div>
                    </div>

                    <div>
                      <label className="form-label">SPO2 (%) / Nhịp thở</label>
                      <input
                        type="number"
                        value={form.respiratoryOrSpo2}
                        onChange={e => handleSpo2Change(e.target.value)}
                        placeholder="% (ví dụ: 98)..."
                        className="form-input"
                      />
                      <div style={{ marginTop: '0.35rem', fontSize: '0.78rem' }}>
                        <span className={form.spo2Evaluation === 'NORMAL' ? 'badge badge-success' : 'badge badge-danger'}>
                          {form.spo2Evaluation === 'NORMAL' ? 'Bình thường (≥95%)' : 'Khó thở / Thấp'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Weight, Height, BMI */}
                  <div className="form-row" style={{ marginTop: '1rem', background: '#f8fafc', padding: '0.75rem', borderRadius: '0.375rem' }}>
                    <div>
                      <label className="form-label">Cân nặng (kg)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={form.weight}
                        onChange={e => handleWeightChange(e.target.value)}
                        placeholder="kg..."
                        className="form-input"
                      />
                    </div>
                    <div>
                      <label className="form-label">Chiều cao (cm)</label>
                      <input
                        type="number"
                        value={form.height}
                        onChange={e => handleHeightChange(e.target.value)}
                        placeholder="cm..."
                        className="form-input"
                      />
                    </div>
                    <div>
                      <label className="form-label">Chỉ số BMI (Tự động)</label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', height: '38px' }}>
                        <b style={{ fontSize: '1.05rem', color: '#1e293b' }}>{form.bmi || '—'}</b>
                        {form.bmi && (
                          <span className={form.bmiEvaluation === 'NORMAL' ? 'badge badge-success' : 'badge badge-warning'}>
                            {form.bmiEvaluation === 'NORMAL' ? 'Bình thường' : form.bmiEvaluation === 'THIN' ? 'Gầy' : 'Thừa cân'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* III. TIỀN SỬ BỆNH LÝ & THUỐC */}
                <div style={{ border: '1px solid #e2e8f0', borderRadius: '0.5rem', padding: '1rem', marginBottom: '1.25rem' }}>
                  <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '1rem', color: '#1e293b', fontWeight: 700 }}>
                    III. TIỀN SỬ BỆNH LÝ & THUỐC ĐANG SỬ DỤNG
                  </h3>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem' }}>1. Tiền sử bệnh nền:</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.5rem', marginBottom: '1rem' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.88rem' }}>
                      <input
                        type="checkbox"
                        checked={form.conditions.hypertension}
                        onChange={e => setForm(prev => ({ ...prev, conditions: { ...prev.conditions, hypertension: e.target.checked } }))}
                      />
                      Cao huyết áp
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.88rem' }}>
                      <input
                        type="checkbox"
                        checked={form.conditions.cardiovascular}
                        onChange={e => setForm(prev => ({ ...prev, conditions: { ...prev.conditions, cardiovascular: e.target.checked } }))}
                      />
                      Tim mạch (Suy tim, bệnh mạch vành)
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.88rem' }}>
                      <input
                        type="checkbox"
                        checked={form.conditions.dementiaAlzheimer}
                        onChange={e => setForm(prev => ({ ...prev, conditions: { ...prev.conditions, dementiaAlzheimer: e.target.checked } }))}
                      />
                      Sa sút trí tuệ / Alzheimer
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.88rem' }}>
                      <input
                        type="checkbox"
                        checked={form.conditions.respiratory}
                        onChange={e => setForm(prev => ({ ...prev, conditions: { ...prev.conditions, respiratory: e.target.checked } }))}
                      />
                      Bệnh hô hấp (COPD, Hen suyễn)
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.88rem' }}>
                      <input
                        type="checkbox"
                        checked={form.conditions.diabetes}
                        onChange={e => setForm(prev => ({ ...prev, conditions: { ...prev.conditions, diabetes: e.target.checked } }))}
                      />
                      Đái tháo đường
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.88rem' }}>
                      <input
                        type="checkbox"
                        checked={form.conditions.strokeOrHemiplegia}
                        onChange={e => setForm(prev => ({ ...prev, conditions: { ...prev.conditions, strokeOrHemiplegia: e.target.checked } }))}
                      />
                      Tai biến mạch máu não / Liệt di chứng
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.88rem' }}>
                      <input
                        type="checkbox"
                        checked={form.conditions.osteoarthritis}
                        onChange={e => setForm(prev => ({ ...prev, conditions: { ...prev.conditions, osteoarthritis: e.target.checked } }))}
                      />
                      Bệnh xương khớp (Thoái hóa, loãng xương)
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.88rem' }}>
                      <input
                        type="checkbox"
                        checked={form.conditions.kidneyDisease}
                        onChange={e => setForm(prev => ({ ...prev, conditions: { ...prev.conditions, kidneyDisease: e.target.checked } }))}
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
                          checked={form.allergy.none}
                          onChange={e => setForm(prev => ({ ...prev, allergy: { ...prev.allergy, none: e.target.checked } }))}
                        />
                        Không có tiền sử dị ứng
                      </label>
                      <input
                        type="text"
                        placeholder="Dị ứng thức ăn: Không..."
                        value={form.allergy.foodAllergy || ''}
                        onChange={e => setForm(prev => ({ ...prev, allergy: { ...prev.allergy, foodAllergy: e.target.value, none: false } }))}
                        className="form-input"
                        style={{ width: '220px' }}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="form-label">3. Các loại thuốc đang sử dụng hàng ngày</label>
                    <textarea
                      rows={2}
                      value={form.medicationsNotes}
                      onChange={e => setForm(prev => ({ ...prev, medicationsNotes: e.target.value }))}
                      placeholder="Ghi rõ tên thuốc, liều dùng, hoặc ghi chú theo đơn hiện tại..."
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
                              checked={(form.adl as any)[item.key] === 'INDEPENDENT'}
                              onChange={() => setForm(prev => ({ ...prev, adl: { ...prev.adl, [item.key]: 'INDEPENDENT' } }))}
                            />
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <input
                              type="radio"
                              name={item.key}
                              checked={(form.adl as any)[item.key] === 'PARTIAL_ASSIST'}
                              onChange={() => setForm(prev => ({ ...prev, adl: { ...prev.adl, [item.key]: 'PARTIAL_ASSIST' } }))}
                            />
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <input
                              type="radio"
                              name={item.key}
                              checked={(form.adl as any)[item.key] === 'FULL_DEPEND'}
                              onChange={() => setForm(prev => ({ ...prev, adl: { ...prev.adl, [item.key]: 'FULL_DEPEND' } }))}
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
                            checked={form.adl.excretion === 'AUTONOMOUS'}
                            onChange={() => setForm(prev => ({ ...prev, adl: { ...prev.adl, excretion: 'AUTONOMOUS' } }))}
                          />
                          Tự chủ
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <input
                            type="radio"
                            name="excretion"
                            checked={form.adl.excretion === 'INCONTINENT'}
                            onChange={() => setForm(prev => ({ ...prev, adl: { ...prev.adl, excretion: 'INCONTINENT' } }))}
                          />
                          Không tự chủ
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <input
                            type="radio"
                            name="excretion"
                            checked={form.adl.excretion === 'CATHETER_DIAPER'}
                            onChange={() => setForm(prev => ({ ...prev, adl: { ...prev.adl, excretion: 'CATHETER_DIAPER' } }))}
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
                            checked={form.adl.mobilitySupport === 'NONE'}
                            onChange={() => setForm(prev => ({ ...prev, adl: { ...prev.adl, mobilitySupport: 'NONE' } }))}
                          />
                          Không cần
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <input
                            type="radio"
                            name="mobilitySupport"
                            checked={form.adl.mobilitySupport === 'CANE_WALKER'}
                            onChange={() => setForm(prev => ({ ...prev, adl: { ...prev.adl, mobilitySupport: 'CANE_WALKER' } }))}
                          />
                          Gậy / Khung tập đi
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <input
                            type="radio"
                            name="mobilitySupport"
                            checked={form.adl.mobilitySupport === 'WHEELCHAIR'}
                            onChange={() => setForm(prev => ({ ...prev, adl: { ...prev.adl, mobilitySupport: 'WHEELCHAIR' } }))}
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
                      <label className="form-label">Tỉnh táo, tiếp xúc tốt:</label>
                      <select
                        value={form.mental.alertAndResponsive ? 'YES' : 'NO'}
                        onChange={e => setForm(prev => ({ ...prev, mental: { ...prev.mental, alertAndResponsive: e.target.value === 'YES' } }))}
                        className="form-select"
                        style={{ width: '100%' }}
                      >
                        <option value="YES">Có - Tỉnh táo, tiếp xúc tốt</option>
                        <option value="NO">Không</option>
                      </select>
                    </div>

                    <div>
                      <label className="form-label">Trí nhớ / Nhận thức:</label>
                      <select
                        value={form.mental.memoryCognition}
                        onChange={e => setForm(prev => ({ ...prev, mental: { ...prev.mental, memoryCognition: e.target.value as any } }))}
                        className="form-select"
                        style={{ width: '100%' }}
                      >
                        <option value="NORMAL">Bình thường</option>
                        <option value="MILD_DECLINE">Suy giảm nhẹ</option>
                        <option value="CONFUSED_SEVERE">Lẫn lộn / Mất trí nhớ nặng</option>
                      </select>
                    </div>
                  </div>

                  <div className="form-row" style={{ marginTop: '0.75rem' }}>
                    <div>
                      <label className="form-label">Chế độ ăn hiện tại:</label>
                      <select
                        value={form.nutrition.dietType}
                        onChange={e => setForm(prev => ({ ...prev, nutrition: { ...prev.nutrition, dietType: e.target.value as any } }))}
                        className="form-select"
                        style={{ width: '100%' }}
                      >
                        <option value="NORMAL_RICE">Cơm thường</option>
                        <option value="PORRIDGE_SOUP">Cháo / Súp mềm</option>
                        <option value="SONDE">Ăn qua sonde (ống bơm)</option>
                      </select>
                    </div>

                    <div>
                      <label className="form-label">Nguy cơ té ngã:</label>
                      <select
                        value={form.fallRisk}
                        onChange={e => setForm(prev => ({ ...prev, fallRisk: e.target.value as any }))}
                        className="form-select"
                        style={{ width: '100%' }}
                      >
                        <option value="LOW">Thấp</option>
                        <option value="MODERATE">Trung bình</option>
                        <option value="HIGH">Cao (Đã từng bị ngã trong 6 tháng qua)</option>
                      </select>
                    </div>
                  </div>

                  <div style={{ marginTop: '0.75rem' }}>
                    <label className="form-label">Tổn thương da / Loét tì đè & Ghi chú xuất huyết:</label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '0.5rem' }}>
                      <select
                        value={form.skinRisk.hasUlcer ? 'YES' : 'NO'}
                        onChange={e => setForm(prev => ({ ...prev, skinRisk: { ...prev.skinRisk, hasUlcer: e.target.value === 'YES' } }))}
                        className="form-select"
                      >
                        <option value="NO">Không có loét tì đè</option>
                        <option value="YES">Có loét tì đè</option>
                      </select>
                      <input
                        type="text"
                        value={form.skinRisk.notes || ''}
                        onChange={e => setForm(prev => ({ ...prev, skinRisk: { ...prev.skinRisk, notes: e.target.value } }))}
                        placeholder="Chỉ có vết xuất huyết dưới da..."
                        className="form-input"
                      />
                    </div>
                  </div>
                </div>

                {/* VIII. KẾT LUẬN & HƯỚNG CHĂM SÓC BAN ĐẦU */}
                <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '0.5rem', padding: '1rem' }}>
                  <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '1rem', color: '#0f172a', fontWeight: 700 }}>
                    VIII. KẾT LUẬN VÀ HƯỚNG CHĂM SÓC BAN ĐẦU
                  </h3>

                  <div style={{ marginBottom: '1rem' }}>
                    <label className="form-label">1. Phân loại mức độ chăm sóc đề xuất:</label>
                    <div style={{ display: 'grid', gap: '0.4rem', marginTop: '0.25rem' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.88rem' }}>
                        <input
                          type="radio"
                          name="initialCareLevel"
                          checked={form.careLevelProposal === 'LEVEL_1'}
                          onChange={() => setForm(prev => ({ ...prev, careLevelProposal: 'LEVEL_1' }))}
                        />
                        <b>(1) Tự phục vụ cơ bản</b> (Theo dõi y tế định kỳ, hỗ trợ khi cần thiết).
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.88rem' }}>
                        <input
                          type="radio"
                          name="initialCareLevel"
                          checked={form.careLevelProposal === 'LEVEL_2'}
                          onChange={() => setForm(prev => ({ ...prev, careLevelProposal: 'LEVEL_2' }))}
                        />
                        <b>(2) Cần hỗ trợ một phần</b> (Cần nhân viên trợ giúp một số hoạt động ADL hàng ngày).
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.88rem' }}>
                        <input
                          type="radio"
                          name="initialCareLevel"
                          checked={form.careLevelProposal === 'LEVEL_3'}
                          onChange={() => setForm(prev => ({ ...prev, careLevelProposal: 'LEVEL_3' }))}
                        />
                        <b>(3) Cần chăm sóc toàn diện</b> (Phụ thuộc hoàn toàn, cần theo dõi y tế sát sao).
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="form-label">2. Ghi chú cụ thể / Yêu cầu đặc biệt từ gia đình hoặc nhân viên y tế:</label>
                    <textarea
                      rows={3}
                      value={form.specificNotes}
                      onChange={e => setForm(prev => ({ ...prev, specificNotes: e.target.value }))}
                      placeholder="Ghi chú về tiền sử, thói quen sinh hoạt, nhu cầu hỗ trợ đặc biệt..."
                      className="form-textarea"
                    />
                  </div>
                </div>
              </div>

              {/* IX. TIẾP NHẬN THUỐC & ĐỒ DÙNG CÁ NHÂN */}
              <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '0.5rem', padding: '1rem' }}>
                <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '1rem', color: '#0c4a6e', fontWeight: 700 }}>
                  IX. TIẾP NHẬN THUỐC & ĐỒ DÙNG CÁ NHÂN
                </h3>

                {/* Handover Header Info */}
                <div className="form-row" style={{ marginBottom: '0.85rem' }}>
                  <div>
                    <label className="form-label">Ngày bàn giao:</label>
                    <input
                      type="date"
                      value={form.handoverRecord?.handoverDate ?? form.intakeDate}
                      onChange={e => setForm(prev => ({
                        ...prev,
                        handoverRecord: {
                          ...(prev.handoverRecord ?? { handoverDate: '', guardianDelivererName: '', guardianPhone: '', nurseReceiverName: '', caregiverReceiverName: '', supervisorApprovalName: '', medications: [], belongings: [], generalNotes: '' }),
                          handoverDate: e.target.value,
                        },
                      }))}
                      className="form-input"
                    />
                  </div>
                  <div>
                    <label className="form-label">Người bàn giao (thân nhân):</label>
                    <input
                      type="text"
                      value={form.handoverRecord?.guardianDelivererName ?? ''}
                      onChange={e => setForm(prev => ({
                        ...prev,
                        handoverRecord: {
                          ...(prev.handoverRecord ?? { handoverDate: '', guardianDelivererName: '', guardianPhone: '', nurseReceiverName: '', caregiverReceiverName: '', supervisorApprovalName: '', medications: [], belongings: [], generalNotes: '' }),
                          guardianDelivererName: e.target.value,
                        },
                      }))}
                      placeholder="Họ tên người thân bàn giao..."
                      className="form-input"
                    />
                  </div>
                  <div>
                    <label className="form-label">SĐT bên bàn giao:</label>
                    <input
                      type="text"
                      value={form.handoverRecord?.guardianPhone ?? ''}
                      onChange={e => setForm(prev => ({
                        ...prev,
                        handoverRecord: {
                          ...(prev.handoverRecord ?? { handoverDate: '', guardianDelivererName: '', guardianPhone: '', nurseReceiverName: '', caregiverReceiverName: '', supervisorApprovalName: '', medications: [], belongings: [], generalNotes: '' }),
                          guardianPhone: e.target.value,
                        },
                      }))}
                      placeholder="0901234567..."
                      className="form-input"
                    />
                  </div>
                  <div>
                    <label className="form-label">Điều dưỡng tiếp nhận:</label>
                    <input
                      type="text"
                      value={form.handoverRecord?.nurseReceiverName ?? ''}
                      onChange={e => setForm(prev => ({
                        ...prev,
                        handoverRecord: {
                          ...(prev.handoverRecord ?? { handoverDate: '', guardianDelivererName: '', guardianPhone: '', nurseReceiverName: '', caregiverReceiverName: '', supervisorApprovalName: '', medications: [], belongings: [], generalNotes: '' }),
                          nurseReceiverName: e.target.value,
                        },
                      }))}
                      placeholder="Tên điều dưỡng nhận hàng..."
                      className="form-input"
                    />
                  </div>
                </div>

                {/* Medication Table */}
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <label style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0369a1' }}>💊 A. Bảng Thuốc Tiếp Nhận</label>
                    <button
                      type="button"
                      className="btn btn-sm btn-primary"
                      onClick={() => {
                        const newMed: HandoverMedicationItem = {
                          id: `MED-${Date.now()}`, medicationName: '', dosageForm: 'Viên nén', quantity: '',
                          expiryDate: '', usageInstruction: '', storageRequirement: 'ROOM_TEMP',
                          prescriptionStatus: 'WITH_PRESCRIPTION', notes: '',
                        };
                        setForm(prev => ({
                          ...prev,
                          handoverRecord: {
                            ...(prev.handoverRecord ?? { handoverDate: form.intakeDate, guardianDelivererName: '', guardianPhone: '', nurseReceiverName: '', caregiverReceiverName: '', supervisorApprovalName: '', medications: [], belongings: [], generalNotes: '' }),
                            medications: [...(prev.handoverRecord?.medications ?? []), newMed],
                          },
                        }));
                      }}
                    >+ Thêm thuốc</button>
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                      <thead>
                        <tr style={{ background: '#0369a1', color: '#fff' }}>
                          <th style={{ padding: '0.35rem 0.5rem', border: '1px solid #bae6fd', minWidth: '130px' }}>Tên thuốc</th>
                          <th style={{ padding: '0.35rem 0.5rem', border: '1px solid #bae6fd', minWidth: '90px' }}>Dạng bào chế</th>
                          <th style={{ padding: '0.35rem 0.5rem', border: '1px solid #bae6fd', minWidth: '80px' }}>Số lượng</th>
                          <th style={{ padding: '0.35rem 0.5rem', border: '1px solid #bae6fd', minWidth: '90px' }}>Hạn SD</th>
                          <th style={{ padding: '0.35rem 0.5rem', border: '1px solid #bae6fd', minWidth: '160px' }}>Cách dùng</th>
                          <th style={{ padding: '0.35rem 0.5rem', border: '1px solid #bae6fd', minWidth: '120px' }}>Bảo quản</th>
                          <th style={{ padding: '0.35rem 0.5rem', border: '1px solid #bae6fd', minWidth: '120px' }}>Loại đơn</th>
                          <th style={{ padding: '0.35rem 0.5rem', border: '1px solid #bae6fd', minWidth: '110px' }}>Ghi chú</th>
                          <th style={{ padding: '0.35rem 0.5rem', border: '1px solid #bae6fd', width: '32px' }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {(form.handoverRecord?.medications ?? []).map((med, idx) => (
                          <tr key={med.id} style={{ background: idx % 2 === 0 ? '#f0f9ff' : '#fff' }}>
                            <td style={{ padding: '0.25rem 0.35rem', border: '1px solid #e0f2fe' }}>
                              <input type="text" value={med.medicationName} onChange={e => { const u = [...(form.handoverRecord?.medications ?? [])]; u[idx] = { ...u[idx], medicationName: e.target.value }; setForm(p => ({ ...p, handoverRecord: { ...p.handoverRecord!, medications: u } })); }} className="form-input" style={{ padding: '0.2rem 0.35rem', fontSize: '0.8rem' }} placeholder="Tên thuốc..." />
                            </td>
                            <td style={{ padding: '0.25rem 0.35rem', border: '1px solid #e0f2fe' }}>
                              <input type="text" value={med.dosageForm} onChange={e => { const u = [...(form.handoverRecord?.medications ?? [])]; u[idx] = { ...u[idx], dosageForm: e.target.value }; setForm(p => ({ ...p, handoverRecord: { ...p.handoverRecord!, medications: u } })); }} className="form-input" style={{ padding: '0.2rem 0.35rem', fontSize: '0.8rem' }} placeholder="Viên nén..." />
                            </td>
                            <td style={{ padding: '0.25rem 0.35rem', border: '1px solid #e0f2fe' }}>
                              <input type="text" value={med.quantity} onChange={e => { const u = [...(form.handoverRecord?.medications ?? [])]; u[idx] = { ...u[idx], quantity: e.target.value }; setForm(p => ({ ...p, handoverRecord: { ...p.handoverRecord!, medications: u } })); }} className="form-input" style={{ padding: '0.2rem 0.35rem', fontSize: '0.8rem' }} placeholder="30 viên..." />
                            </td>
                            <td style={{ padding: '0.25rem 0.35rem', border: '1px solid #e0f2fe' }}>
                              <input type="month" value={med.expiryDate} onChange={e => { const u = [...(form.handoverRecord?.medications ?? [])]; u[idx] = { ...u[idx], expiryDate: e.target.value }; setForm(p => ({ ...p, handoverRecord: { ...p.handoverRecord!, medications: u } })); }} className="form-input" style={{ padding: '0.2rem 0.35rem', fontSize: '0.8rem' }} />
                            </td>
                            <td style={{ padding: '0.25rem 0.35rem', border: '1px solid #e0f2fe' }}>
                              <input type="text" value={med.usageInstruction} onChange={e => { const u = [...(form.handoverRecord?.medications ?? [])]; u[idx] = { ...u[idx], usageInstruction: e.target.value }; setForm(p => ({ ...p, handoverRecord: { ...p.handoverRecord!, medications: u } })); }} className="form-input" style={{ padding: '0.2rem 0.35rem', fontSize: '0.8rem' }} placeholder="Uống 1 viên sáng sau ăn..." />
                            </td>
                            <td style={{ padding: '0.25rem 0.35rem', border: '1px solid #e0f2fe' }}>
                              <select value={med.storageRequirement} onChange={e => { const u = [...(form.handoverRecord?.medications ?? [])]; u[idx] = { ...u[idx], storageRequirement: e.target.value as HandoverMedicationItem['storageRequirement'] }; setForm(p => ({ ...p, handoverRecord: { ...p.handoverRecord!, medications: u } })); }} className="form-input" style={{ padding: '0.2rem 0.35rem', fontSize: '0.8rem' }}>
                                {Object.entries(MEDICATION_STORAGE_OPTIONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                              </select>
                            </td>
                            <td style={{ padding: '0.25rem 0.35rem', border: '1px solid #e0f2fe' }}>
                              <select value={med.prescriptionStatus} onChange={e => { const u = [...(form.handoverRecord?.medications ?? [])]; u[idx] = { ...u[idx], prescriptionStatus: e.target.value as HandoverMedicationItem['prescriptionStatus'] }; setForm(p => ({ ...p, handoverRecord: { ...p.handoverRecord!, medications: u } })); }} className="form-input" style={{ padding: '0.2rem 0.35rem', fontSize: '0.8rem' }}>
                                {Object.entries(MEDICATION_PRESCRIPTION_OPTIONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                              </select>
                            </td>
                            <td style={{ padding: '0.25rem 0.35rem', border: '1px solid #e0f2fe' }}>
                              <input type="text" value={med.notes} onChange={e => { const u = [...(form.handoverRecord?.medications ?? [])]; u[idx] = { ...u[idx], notes: e.target.value }; setForm(p => ({ ...p, handoverRecord: { ...p.handoverRecord!, medications: u } })); }} className="form-input" style={{ padding: '0.2rem 0.35rem', fontSize: '0.8rem' }} placeholder="Ghi chú..." />
                            </td>
                            <td style={{ padding: '0.25rem', border: '1px solid #e0f2fe', textAlign: 'center' }}>
                              <button type="button" onClick={() => { const u = (form.handoverRecord?.medications ?? []).filter((_, i) => i !== idx); setForm(p => ({ ...p, handoverRecord: { ...p.handoverRecord!, medications: u } })); }} style={{ background: '#fee2e2', border: 'none', borderRadius: '0.3rem', color: '#b91c1c', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', padding: '0.2rem 0.4rem' }}>✕</button>
                            </td>
                          </tr>
                        ))}
                        {(form.handoverRecord?.medications ?? []).length === 0 && (
                          <tr><td colSpan={9} style={{ textAlign: 'center', padding: '0.85rem', color: '#64748b', fontSize: '0.82rem', border: '1px solid #e0f2fe' }}>Chưa có thuốc nào. Bấm <b>+ Thêm thuốc</b> để thêm mới.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Belongings Table */}
                <div style={{ marginBottom: '0.85rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <label style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0369a1' }}>🧳 B. Bảng Đồ Dùng Cá Nhân</label>
                    <button
                      type="button"
                      className="btn btn-sm btn-primary"
                      onClick={() => {
                        const newItem: HandoverBelongingItem = {
                          id: `BEL-${Date.now()}`, category: 'CLOTHING', itemName: '', quantity: '',
                          condition: 'GOOD', storageLocation: 'RESIDENT_WARDROBE', identificationTag: '', notes: '',
                        };
                        setForm(prev => ({
                          ...prev,
                          handoverRecord: {
                            ...(prev.handoverRecord ?? { handoverDate: form.intakeDate, guardianDelivererName: '', guardianPhone: '', nurseReceiverName: '', caregiverReceiverName: '', supervisorApprovalName: '', medications: [], belongings: [], generalNotes: '' }),
                            belongings: [...(prev.handoverRecord?.belongings ?? []), newItem],
                          },
                        }));
                      }}
                    >+ Thêm đồ dùng</button>
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                      <thead>
                        <tr style={{ background: '#0369a1', color: '#fff' }}>
                          <th style={{ padding: '0.35rem 0.5rem', border: '1px solid #bae6fd', minWidth: '120px' }}>Loại đồ dùng</th>
                          <th style={{ padding: '0.35rem 0.5rem', border: '1px solid #bae6fd', minWidth: '160px' }}>Tên / Mô tả</th>
                          <th style={{ padding: '0.35rem 0.5rem', border: '1px solid #bae6fd', minWidth: '70px' }}>Số lượng</th>
                          <th style={{ padding: '0.35rem 0.5rem', border: '1px solid #bae6fd', minWidth: '120px' }}>Tình trạng</th>
                          <th style={{ padding: '0.35rem 0.5rem', border: '1px solid #bae6fd', minWidth: '130px' }}>Nơi lưu giữ</th>
                          <th style={{ padding: '0.35rem 0.5rem', border: '1px solid #bae6fd', minWidth: '120px' }}>Đánh dấu / Ghi nhận</th>
                          <th style={{ padding: '0.35rem 0.5rem', border: '1px solid #bae6fd', minWidth: '110px' }}>Ghi chú</th>
                          <th style={{ padding: '0.35rem 0.5rem', border: '1px solid #bae6fd', width: '32px' }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {(form.handoverRecord?.belongings ?? []).map((item, idx) => (
                          <tr key={item.id} style={{ background: idx % 2 === 0 ? '#f0f9ff' : '#fff' }}>
                            <td style={{ padding: '0.25rem 0.35rem', border: '1px solid #e0f2fe' }}>
                              <select value={item.category} onChange={e => { const u = [...(form.handoverRecord?.belongings ?? [])]; u[idx] = { ...u[idx], category: e.target.value as HandoverBelongingItem['category'] }; setForm(p => ({ ...p, handoverRecord: { ...p.handoverRecord!, belongings: u } })); }} className="form-input" style={{ padding: '0.2rem 0.35rem', fontSize: '0.8rem' }}>
                                {Object.entries(BELONGING_CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                              </select>
                            </td>
                            <td style={{ padding: '0.25rem 0.35rem', border: '1px solid #e0f2fe' }}>
                              <input type="text" value={item.itemName} onChange={e => { const u = [...(form.handoverRecord?.belongings ?? [])]; u[idx] = { ...u[idx], itemName: e.target.value }; setForm(p => ({ ...p, handoverRecord: { ...p.handoverRecord!, belongings: u } })); }} className="form-input" style={{ padding: '0.2rem 0.35rem', fontSize: '0.8rem' }} placeholder="Quần áo, giày dép..." />
                            </td>
                            <td style={{ padding: '0.25rem 0.35rem', border: '1px solid #e0f2fe' }}>
                              <input type="text" value={item.quantity} onChange={e => { const u = [...(form.handoverRecord?.belongings ?? [])]; u[idx] = { ...u[idx], quantity: e.target.value }; setForm(p => ({ ...p, handoverRecord: { ...p.handoverRecord!, belongings: u } })); }} className="form-input" style={{ padding: '0.2rem 0.35rem', fontSize: '0.8rem' }} placeholder="5 bộ..." />
                            </td>
                            <td style={{ padding: '0.25rem 0.35rem', border: '1px solid #e0f2fe' }}>
                              <select value={item.condition} onChange={e => { const u = [...(form.handoverRecord?.belongings ?? [])]; u[idx] = { ...u[idx], condition: e.target.value as HandoverBelongingItem['condition'] }; setForm(p => ({ ...p, handoverRecord: { ...p.handoverRecord!, belongings: u } })); }} className="form-input" style={{ padding: '0.2rem 0.35rem', fontSize: '0.8rem' }}>
                                {Object.entries(BELONGING_CONDITIONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                              </select>
                            </td>
                            <td style={{ padding: '0.25rem 0.35rem', border: '1px solid #e0f2fe' }}>
                              <select value={item.storageLocation} onChange={e => { const u = [...(form.handoverRecord?.belongings ?? [])]; u[idx] = { ...u[idx], storageLocation: e.target.value as HandoverBelongingItem['storageLocation'] }; setForm(p => ({ ...p, handoverRecord: { ...p.handoverRecord!, belongings: u } })); }} className="form-input" style={{ padding: '0.2rem 0.35rem', fontSize: '0.8rem' }}>
                                {Object.entries(BELONGING_LOCATIONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                              </select>
                            </td>
                            <td style={{ padding: '0.25rem 0.35rem', border: '1px solid #e0f2fe' }}>
                              <input type="text" value={item.identificationTag} onChange={e => { const u = [...(form.handoverRecord?.belongings ?? [])]; u[idx] = { ...u[idx], identificationTag: e.target.value }; setForm(p => ({ ...p, handoverRecord: { ...p.handoverRecord!, belongings: u } })); }} className="form-input" style={{ padding: '0.2rem 0.35rem', fontSize: '0.8rem' }} placeholder="Thêu tên cụ..." />
                            </td>
                            <td style={{ padding: '0.25rem 0.35rem', border: '1px solid #e0f2fe' }}>
                              <input type="text" value={item.notes} onChange={e => { const u = [...(form.handoverRecord?.belongings ?? [])]; u[idx] = { ...u[idx], notes: e.target.value }; setForm(p => ({ ...p, handoverRecord: { ...p.handoverRecord!, belongings: u } })); }} className="form-input" style={{ padding: '0.2rem 0.35rem', fontSize: '0.8rem' }} placeholder="Ghi chú..." />
                            </td>
                            <td style={{ padding: '0.25rem', border: '1px solid #e0f2fe', textAlign: 'center' }}>
                              <button type="button" onClick={() => { const u = (form.handoverRecord?.belongings ?? []).filter((_, i) => i !== idx); setForm(p => ({ ...p, handoverRecord: { ...p.handoverRecord!, belongings: u } })); }} style={{ background: '#fee2e2', border: 'none', borderRadius: '0.3rem', color: '#b91c1c', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', padding: '0.2rem 0.4rem' }}>✕</button>
                            </td>
                          </tr>
                        ))}
                        {(form.handoverRecord?.belongings ?? []).length === 0 && (
                          <tr><td colSpan={8} style={{ textAlign: 'center', padding: '0.85rem', color: '#64748b', fontSize: '0.82rem', border: '1px solid #e0f2fe' }}>Chưa có đồ dùng nào. Bấm <b>+ Thêm đồ dùng</b> để thêm mới.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* General Notes */}
                <div>
                  <label className="form-label">Ghi chú tổng hợp phiếu tiếp nhận:</label>
                  <textarea
                    rows={2}
                    value={form.handoverRecord?.generalNotes ?? ''}
                    onChange={e => setForm(prev => ({ ...prev, handoverRecord: { ...prev.handoverRecord!, generalNotes: e.target.value } }))}
                    placeholder="Thân nhân và người cao tuổi đã bàn giao đầy đủ. Trung Tâm Dưỡng Lão Tâm An đã kiểm đếm..."
                    className="form-textarea"
                  />
                </div>
              </div>

              {/* X. THỐNG NHẤT BẢNG GIÁ DỊCH VỤ & PHÍ HÀNG THÁNG */}
              <div style={{ background: '#fefce8', border: '1px solid #fef08a', borderRadius: '0.5rem', padding: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <h3 style={{ margin: 0, fontSize: '1rem', color: '#854d0e', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span>💰</span> X. THỐNG NHẤT BẢNG GIÁ DỊCH VỤ & KHUNG VIỆN PHÍ HÀNG THÁNG
                  </h3>
                  <span style={{ fontSize: '0.78rem', background: '#fef08a', color: '#713f12', padding: '0.2rem 0.5rem', borderRadius: '0.25rem', fontWeight: 600 }}>
                    Căn cứ tính toán thu phí hàng tháng cho cư dân
                  </span>
                </div>

                {/* Form Row: Gói chăm sóc cơ bản & Ô nhập giá thủ công */}
                <div className="form-row" style={{ marginBottom: '0.75rem' }}>
                  <div>
                    <label className="form-label">1. Gói chăm sóc cơ bản (Chọn từ Bảng giá):</label>
                    <select
                      value={form.financialAgreement?.basicCarePackageKey ?? 'BCP-02'}
                      onChange={e => {
                        const key = e.target.value;
                        const pkg = BASIC_CARE_PACKAGE_OPTIONS[key];
                        const defaultPrice = pkg?.defaultFee ?? 0;
                        const pkgName = pkg?.name ?? 'Gói chăm sóc cơ bản';
                        setForm(prev => {
                          const currentSupportFee = prev.financialAgreement?.supportServiceFee ?? 0;
                          const total = defaultPrice + currentSupportFee;
                          return {
                            ...prev,
                            financialAgreement: {
                              ...(prev.financialAgreement ?? DEFAULT_INITIAL_ASSESSMENT.financialAgreement!),
                              basicCarePackageKey: key,
                              basicCarePackageName: pkgName,
                              basicCarePackageFee: defaultPrice,
                              calculatedMonthlyTotal: total,
                            },
                          };
                        });
                      }}
                      className="form-select"
                      style={{ width: '100%' }}
                    >
                      <option value="BCP-04">Phòng VIP 1 giường (20.000.000 VNĐ / tháng)</option>
                      <option value="BCP-03">Phòng VIP 2 giường (16.500.000 VNĐ / tháng)</option>
                      <option value="BCP-02">Phòng tập thể 3, 4 giường (14.500.000 VNĐ / tháng)</option>
                      <option value="BCP-01">Phòng tập thể 6 giường (12.000.000 VNĐ / tháng)</option>
                      <option value="BCP-05">Phòng chăm sóc toàn diện (16.500.000 VNĐ / tháng)</option>
                      <option value="CUSTOM">Khác / Thỏa thuận riêng</option>
                    </select>
                  </div>

                  <div>
                    <label className="form-label">Đơn giá Gói chăm sóc cơ bản (Nhập thủ công VNĐ):</label>
                    <input
                      type="number"
                      value={form.financialAgreement?.basicCarePackageFee ?? 14500000}
                      onChange={e => {
                        const newFee = Number(e.target.value) || 0;
                        setForm(prev => {
                          const currentSupportFee = prev.financialAgreement?.supportServiceFee ?? 0;
                          const total = newFee + currentSupportFee;
                          return {
                            ...prev,
                            financialAgreement: {
                              ...(prev.financialAgreement ?? DEFAULT_INITIAL_ASSESSMENT.financialAgreement!),
                              basicCarePackageFee: newFee,
                              calculatedMonthlyTotal: total,
                            },
                          };
                        });
                      }}
                      className="form-input"
                      placeholder="Nhập đơn giá gói cơ bản..."
                    />
                    <div style={{ fontSize: '0.74rem', color: '#854d0e', marginTop: '0.2rem' }}>
                      (Cho phép tùy chỉnh đơn giá thực tế làm căn cứ tính phí hàng tháng)
                    </div>
                  </div>
                </div>

                {/* Form Row: Phí dịch vụ chăm sóc hỗ trợ (Mục II) & Ô nhập giá thủ công */}
                <div className="form-row" style={{ marginBottom: '0.75rem' }}>
                  <div>
                    <label className="form-label">2. Phí dịch vụ chăm sóc hỗ trợ (Mục II Bảng giá):</label>
                    <select
                      value={form.financialAgreement?.supportServiceKey ?? 'NONE'}
                      onChange={e => {
                        const key = e.target.value;
                        const svc = SUPPORT_SERVICE_OPTIONS[key];
                        const defaultPrice = svc?.defaultFee ?? 0;
                        const svcName = svc?.name ?? 'Dịch vụ chăm sóc hỗ trợ';
                        setForm(prev => {
                          const currentBasicFee = prev.financialAgreement?.basicCarePackageFee ?? 14500000;
                          const total = currentBasicFee + defaultPrice;
                          return {
                            ...prev,
                            financialAgreement: {
                              ...(prev.financialAgreement ?? DEFAULT_INITIAL_ASSESSMENT.financialAgreement!),
                              supportServiceKey: key,
                              supportServiceName: svcName,
                              supportServiceFee: defaultPrice,
                              calculatedMonthlyTotal: total,
                            },
                          };
                        });
                      }}
                      className="form-select"
                      style={{ width: '100%' }}
                    >
                      <option value="NONE">Không đăng ký dịch vụ hỗ trợ phát sinh (0 VNĐ)</option>
                      <option value="SS-01">Hỗ trợ tắm gội (Gợi ý: 500k - 1.5tr)</option>
                      <option value="SS-02">Hỗ trợ nâng đỡ, di chuyển (Gợi ý: 500k)</option>
                      <option value="SS-03">Hỗ trợ xúc ăn (Gợi ý: 500k)</option>
                      <option value="SS-04">Hỗ trợ vệ sinh (Gợi ý: 1tr - 3tr)</option>
                      <option value="SS-05">Hỗ trợ ăn qua sonde (Gợi ý: 1.5tr)</option>
                      <option value="SS-06">Chăm sóc NCT bị lẫn tuổi già (Gợi ý: 500k - 2tr)</option>
                      <option value="SS-07">Tập VLTL & PHCN chuyên sâu (Công nghệ AI) (350k - 500k/buổi)</option>
                      <option value="SS-08">Chăm sóc các ổ loét (Gợi ý: 2tr)</option>
                      <option value="SS-09">Chăm sóc người đặt sonde bàng quang (Gợi ý: 2tr)</option>
                      <option value="CUSTOM">Tùy chọn dịch vụ chăm sóc hỗ trợ khác</option>
                    </select>
                  </div>

                  <div>
                    <label className="form-label">Đơn giá Dịch vụ chăm sóc hỗ trợ (Nhập thủ công VNĐ):</label>
                    <input
                      type="number"
                      value={form.financialAgreement?.supportServiceFee ?? 0}
                      onChange={e => {
                        const newSupportFee = Number(e.target.value) || 0;
                        setForm(prev => {
                          const currentBasicFee = prev.financialAgreement?.basicCarePackageFee ?? 14500000;
                          const total = currentBasicFee + newSupportFee;
                          return {
                            ...prev,
                            financialAgreement: {
                              ...(prev.financialAgreement ?? DEFAULT_INITIAL_ASSESSMENT.financialAgreement!),
                              supportServiceFee: newSupportFee,
                              calculatedMonthlyTotal: total,
                            },
                          };
                        });
                      }}
                      className="form-input"
                      placeholder="0 (Nhập phí hỗ trợ tùy chỉnh...)"
                    />
                    <div style={{ fontSize: '0.74rem', color: '#854d0e', marginTop: '0.2rem' }}>
                      (Cho phép cập nhật, điều chỉnh đơn giá dịch vụ hỗ trợ thủ công)
                    </div>
                  </div>
                </div>

                {/* Form Row: Deposit & Payment Cycle */}
                <div className="form-row" style={{ marginBottom: '0.75rem' }}>
                  <div>
                    <label className="form-label">3. Quỹ Tiền Đặt Cọc / Dự phòng y tế ban đầu (VNĐ):</label>
                    <input
                      type="number"
                      value={form.financialAgreement?.depositAmount ?? 20000000}
                      onChange={e => setForm(prev => ({
                        ...prev,
                        financialAgreement: {
                          ...(prev.financialAgreement ?? DEFAULT_INITIAL_ASSESSMENT.financialAgreement!),
                          depositAmount: Number(e.target.value) || 0,
                        },
                      }))}
                      className="form-input"
                    />
                    <div style={{ fontSize: '0.74rem', color: '#854d0e', marginTop: '0.2rem' }}>
                      (Mức đặt cọc gợi ý mặc định: 20.000.000 VNĐ, có thể điều chỉnh thủ công)
                    </div>
                  </div>

                  <div>
                    <label className="form-label">4. Hạn thanh toán định kỳ hàng tháng:</label>
                    <input
                      type="text"
                      value={form.financialAgreement?.paymentCycleDay ?? 'Từ ngày 01 đến ngày 05 hàng tháng'}
                      onChange={e => setForm(prev => ({
                        ...prev,
                        financialAgreement: {
                          ...(prev.financialAgreement ?? DEFAULT_INITIAL_ASSESSMENT.financialAgreement!),
                          paymentCycleDay: e.target.value,
                        },
                      }))}
                      className="form-input"
                    />
                  </div>
                </div>

                {/* Monthly Calculation Summary Banner */}
                <div style={{ background: '#fef08a', border: '1px solid #facc15', borderRadius: '0.5rem', padding: '0.75rem 1rem', marginTop: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div>
                    <div style={{ fontSize: '0.8rem', color: '#713f12', fontWeight: 600 }}>TỔNG CHI PHÍ PHẢI THU HÀNG THÁNG DỰ KIẾN:</div>
                    <div style={{ fontSize: '0.75rem', color: '#854d0e' }}>
                      (Gói chăm sóc cơ bản: {(form.financialAgreement?.basicCarePackageFee ?? 14500000).toLocaleString('vi-VN')} đ + Dịch vụ hỗ trợ: {(form.financialAgreement?.supportServiceFee ?? 0).toLocaleString('vi-VN')} đ)
                    </div>
                  </div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#92400e' }}>
                    {((form.financialAgreement?.basicCarePackageFee ?? 14500000) + (form.financialAgreement?.supportServiceFee ?? 0)).toLocaleString('vi-VN')} VNĐ / tháng
                  </div>
                </div>

                {/* Guardian Agreement Checkbox */}
                <div style={{ marginTop: '0.75rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.88rem', fontWeight: 700, color: '#713f12', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={form.financialAgreement?.guardianAgreed ?? true}
                      onChange={e => setForm(prev => ({
                        ...prev,
                        financialAgreement: {
                          ...(prev.financialAgreement ?? DEFAULT_INITIAL_ASSESSMENT.financialAgreement!),
                          guardianAgreed: e.target.checked,
                        },
                      }))}
                    />
                    <span>Xác nhận Đại diện gia đình / Thân nhân đã thống nhất Bảng giá dịch vụ và cam kết thanh toán đúng hạn.</span>
                  </label>
                </div>
              </div>

              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => { setIsCreateOpen(false); setEditingCase(null); }}
                  className="btn btn-secondary"
                  style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                >
                  <span>◀</span> Quay lại Danh Sách
                </button>
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void handleSave(false)}
                    className="btn btn-neutral"
                    style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600 }}
                  >
                    {busy ? '⏳ Đang lưu...' : '💾 Lưu Bản Nháp'}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void handleSave(true)}
                    className="btn btn-primary"
                    style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700 }}
                  >
                    {busy ? '⏳ Đang lưu...' : '✅ Tiếp Tục & Hoàn Thiện Hồ Sơ ▶'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: XEM & IN PHIẾU ĐÁNH GIÁ SỨC KHỎE BAN ĐẦU CHUẨN Y KHOA (PRINT VIEW) */}
      {/* ========================================================================= */}
      {viewingAssessment && (
        <div className="modal-overlay">
          <div className="modal-dialog modal-dialog-lg" style={{ maxWidth: '850px', maxHeight: '92vh', overflowY: 'auto' }}>
            <div className="modal-header">
              <h2 className="modal-title">Phiếu Đánh Giá Sức Khỏe Ban Đầu Cho Người Cao Tuổi</h2>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                {viewingAssessment.c.status !== 'ADMITTED' && viewingAssessment.c.status !== 'COMPLETED' && (
                  <button
                    onClick={() => {
                      const targetCase = viewingAssessment.c;
                      setViewingAssessment(null);
                      void handleEditDraft(targetCase);
                    }}
                    className="btn btn-sm btn-warning"
                    style={{ fontWeight: 700 }}
                    title="Mở biểu mẫu để chỉnh sửa lại thông tin trong phiếu này"
                  >
                    ✏️ Sửa phiếu
                  </button>
                )}
                <button
                  onClick={() => window.print()}
                  className="btn btn-sm btn-primary"
                >
                  🖨️ In / Xuất PDF (A4)
                </button>
                <button onClick={() => setViewingAssessment(null)} className="modal-close">
                  &times;
                </button>
              </div>
            </div>

            <div className="modal-body printable-a4-sheet" style={{ background: '#ffffff', color: '#1e293b', padding: '1.25rem' }}>
              {/* Header */}
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
                    <div><b>Ngày tiếp nhận:</b> {viewingAssessment.data.intakeDate}</div>
                    <div><b>Người đánh giá:</b> {viewingAssessment.data.assessorName || 'Nguyễn Thị Phương Thúy'}</div>
                  </div>
                </div>
                <h1 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#1e293b', margin: '0.3rem 0' }}>
                  PHIẾU ĐÁNH GIÁ SỨC KHỎE BAN ĐẦU CHO NGƯỜI CAO TUỔI
                </h1>
              </div>

              {/* I. THÔNG TIN HÀNH CHÍNH */}
              <div className="section-header" style={{ background: '#e2f4ea', padding: '0.25rem 0.6rem', fontWeight: 700, fontSize: '0.84rem', marginBottom: '0.35rem' }}>
                I. THÔNG TIN HÀNH CHÍNH
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '0.3rem', fontSize: '0.82rem', marginBottom: '0.5rem' }}>
                <div><b>Họ và tên người cao tuổi:</b> <span style={{ background: '#fef08a', padding: '0.05rem 0.35rem' }}>{viewingAssessment.data.prospectiveResidentName}</span></div>
                <div><b>Giới tính (Nam/Nữ):</b> {viewingAssessment.data.gender === 'FEMALE' ? 'Nữ' : 'Nam'}</div>
                <div><b>Ngày tháng năm sinh:</b> {formatDateDisplay(viewingAssessment.data.dateOfBirth)}</div>
                <div><b>Số CMND/CCCD:</b> {viewingAssessment.data.identityNumber || '—'}</div>
                <div><b>Họ tên người bảo hộ (NBH):</b> {viewingAssessment.data.guardianName}</div>
                <div><b>Mối quan hệ:</b> {viewingAssessment.data.guardianRelationship}</div>
                <div><b>Số điện thoại NBH:</b> {viewingAssessment.data.guardianPhone}</div>
                <div><b>Địa chỉ liên hệ của NBH:</b> {viewingAssessment.data.guardianAddress}</div>
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
                    <td style={{ padding: '0.25rem 0.4rem', border: '1px solid #cbd5e1', textAlign: 'center' }}><b>{viewingAssessment.data.pulse}</b></td>
                    <td style={{ padding: '0.25rem 0.4rem', border: '1px solid #cbd5e1' }}>
                      [{viewingAssessment.data.pulseEvaluation === 'NORMAL' ? ' x ' : '   '}] Bình thường &nbsp;
                      [{viewingAssessment.data.pulseEvaluation === 'SLOW' ? ' x ' : '   '}] Chậm &nbsp;
                      [{viewingAssessment.data.pulseEvaluation === 'FAST' ? ' x ' : '   '}] Nhanh
                    </td>
                  </tr>
                  <tr>
                    <td style={{ padding: '0.25rem 0.4rem', border: '1px solid #cbd5e1' }}>Huyết áp (mmHg)</td>
                    <td style={{ padding: '0.25rem 0.4rem', border: '1px solid #cbd5e1', textAlign: 'center' }}><b>{viewingAssessment.data.bloodPressure}</b></td>
                    <td style={{ padding: '0.25rem 0.4rem', border: '1px solid #cbd5e1' }}>
                      [{viewingAssessment.data.bpEvaluation === 'NORMAL' ? ' x ' : '   '}] Bình thường &nbsp;
                      [{viewingAssessment.data.bpEvaluation === 'HIGH' ? ' x ' : '   '}] Cao &nbsp;
                      [{viewingAssessment.data.bpEvaluation === 'LOW' ? ' x ' : '   '}] Thấp
                    </td>
                  </tr>
                  <tr>
                    <td style={{ padding: '0.25rem 0.4rem', border: '1px solid #cbd5e1' }}>Nhiệt độ (°C)</td>
                    <td style={{ padding: '0.25rem 0.4rem', border: '1px solid #cbd5e1', textAlign: 'center' }}><b>{viewingAssessment.data.temperature}</b></td>
                    <td style={{ padding: '0.25rem 0.4rem', border: '1px solid #cbd5e1' }}>
                      [{viewingAssessment.data.tempEvaluation === 'NORMAL' ? ' x ' : '   '}] Bình thường &nbsp;
                      [{viewingAssessment.data.tempEvaluation === 'FEVER' ? ' x ' : '   '}] Sốt &nbsp;
                      [{viewingAssessment.data.tempEvaluation === 'HYPOTHERMIA' ? ' x ' : '   '}] Hạ thân nhiệt
                    </td>
                  </tr>
                  <tr>
                    <td style={{ padding: '0.25rem 0.4rem', border: '1px solid #cbd5e1' }}>Nhịp thở / SPO2 (%)</td>
                    <td style={{ padding: '0.25rem 0.4rem', border: '1px solid #cbd5e1', textAlign: 'center' }}><b>{viewingAssessment.data.respiratoryOrSpo2}%</b></td>
                    <td style={{ padding: '0.25rem 0.4rem', border: '1px solid #cbd5e1' }}>
                      [{viewingAssessment.data.spo2Evaluation === 'NORMAL' ? ' x ' : '   '}] Bình thường &nbsp;
                      [{viewingAssessment.data.spo2Evaluation === 'DYSPNEA' ? ' x ' : '   '}] Khó thở
                    </td>
                  </tr>
                  <tr>
                    <td style={{ padding: '0.25rem 0.4rem', border: '1px solid #cbd5e1' }}>Cân nặng / Chiều cao</td>
                    <td style={{ padding: '0.25rem 0.4rem', border: '1px solid #cbd5e1', textAlign: 'center' }}><b>{viewingAssessment.data.weight} kg / {viewingAssessment.data.height} cm</b></td>
                    <td style={{ padding: '0.25rem 0.4rem', border: '1px solid #cbd5e1' }}>
                      BMI: <b>{viewingAssessment.data.bmi}</b> &nbsp;
                      ([{viewingAssessment.data.bmiEvaluation === 'NORMAL' ? ' x ' : '   '}] Chuẩn &nbsp;
                      [{viewingAssessment.data.bmiEvaluation === 'THIN' ? ' x ' : '   '}] Gầy &nbsp;
                      [{viewingAssessment.data.bmiEvaluation === 'OVERWEIGHT' ? ' x ' : '   '}] Thừa cân)
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* III. TIỀN SỬ BỆNH LÝ & THUỐC */}
              <div className="section-header" style={{ background: '#e2f4ea', padding: '0.25rem 0.6rem', fontWeight: 700, fontSize: '0.84rem', marginBottom: '0.35rem' }}>
                III. TIỀN SỬ BỆNH LÝ & THUỐC ĐANG SỬ DỤNG
              </div>
              <div style={{ fontSize: '0.8rem', marginBottom: '0.3rem' }}>
                <b>1. Tiền sử bệnh nền:</b>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.2rem', marginTop: '0.15rem' }}>
                  <div>[{viewingAssessment.data.conditions.hypertension ? ' x ' : '   '}] Cao huyết áp</div>
                  <div>[{viewingAssessment.data.conditions.diabetes ? ' x ' : '   '}] Đái tháo đường</div>
                  <div>[{viewingAssessment.data.conditions.cardiovascular ? ' x ' : '   '}] Tim mạch (Suy tim, bệnh mạch vành)</div>
                  <div>[{viewingAssessment.data.conditions.strokeOrHemiplegia ? ' x ' : '   '}] Tai biến mạch máu não / Liệt</div>
                  <div>[{viewingAssessment.data.conditions.dementiaAlzheimer ? ' x ' : '   '}] Sa sút trí tuệ / Alzheimer</div>
                  <div>[{viewingAssessment.data.conditions.osteoarthritis ? ' x ' : '   '}] Bệnh xương khớp (Thoái hóa)</div>
                  <div>[{viewingAssessment.data.conditions.respiratory ? ' x ' : '   '}] Bệnh hô hấp (COPD, Hen)</div>
                  <div>[{viewingAssessment.data.conditions.kidneyDisease ? ' x ' : '   '}] Bệnh lý thận / Suy thận mãn</div>
                </div>
              </div>
              <div style={{ fontSize: '0.8rem', marginBottom: '0.3rem' }}>
                <b>2. Tiền sử dị ứng:</b> [{viewingAssessment.data.allergy.none ? ' x ' : '   '}] Không &nbsp; [{viewingAssessment.data.allergy.drugAllergy ? ' x ' : '   '}] Dị ứng thuốc: {viewingAssessment.data.allergy.drugAllergy || '...'} &nbsp; [{viewingAssessment.data.allergy.foodAllergy ? ' x ' : '   '}] Dị ứng thức ăn: {viewingAssessment.data.allergy.foodAllergy || '...'}
              </div>
              <div style={{ fontSize: '0.8rem', marginBottom: '0.5rem' }}>
                <b>3. Thuốc đang dùng hàng ngày:</b> {viewingAssessment.data.medicationsNotes || 'Theo đơn hiện tại.'}
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
                    <td style={{ textAlign: 'center', border: '1px solid #cbd5e1' }}>{viewingAssessment.data.adl.eating === 'INDEPENDENT' ? '[ x ]' : '[   ]'}</td>
                    <td style={{ textAlign: 'center', border: '1px solid #cbd5e1' }}>{viewingAssessment.data.adl.eating === 'PARTIAL_ASSIST' ? '[ x ]' : '[   ]'}</td>
                    <td style={{ textAlign: 'center', border: '1px solid #cbd5e1' }}>{viewingAssessment.data.adl.eating === 'FULL_DEPEND' ? '[ x ]' : '[   ]'}</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '0.25rem 0.4rem', border: '1px solid #cbd5e1' }}>Tắm rửa / Vệ sinh cá nhân</td>
                    <td style={{ textAlign: 'center', border: '1px solid #cbd5e1' }}>{viewingAssessment.data.adl.bathing === 'INDEPENDENT' ? '[ x ]' : '[   ]'}</td>
                    <td style={{ textAlign: 'center', border: '1px solid #cbd5e1' }}>{viewingAssessment.data.adl.bathing === 'PARTIAL_ASSIST' ? '[ x ]' : '[   ]'}</td>
                    <td style={{ textAlign: 'center', border: '1px solid #cbd5e1' }}>{viewingAssessment.data.adl.bathing === 'FULL_DEPEND' ? '[ x ]' : '[   ]'}</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '0.25rem 0.4rem', border: '1px solid #cbd5e1' }}>Mặc quần áo</td>
                    <td style={{ textAlign: 'center', border: '1px solid #cbd5e1' }}>{viewingAssessment.data.adl.dressing === 'INDEPENDENT' ? '[ x ]' : '[   ]'}</td>
                    <td style={{ textAlign: 'center', border: '1px solid #cbd5e1' }}>{viewingAssessment.data.adl.dressing === 'PARTIAL_ASSIST' ? '[ x ]' : '[   ]'}</td>
                    <td style={{ textAlign: 'center', border: '1px solid #cbd5e1' }}>{viewingAssessment.data.adl.dressing === 'FULL_DEPEND' ? '[ x ]' : '[   ]'}</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '0.25rem 0.4rem', border: '1px solid #cbd5e1' }}>Đi vệ sinh (Tiểu / Đại tiện)</td>
                    <td style={{ textAlign: 'center', border: '1px solid #cbd5e1' }}>{viewingAssessment.data.adl.toileting === 'INDEPENDENT' ? '[ x ]' : '[   ]'}</td>
                    <td style={{ textAlign: 'center', border: '1px solid #cbd5e1' }}>{viewingAssessment.data.adl.toileting === 'PARTIAL_ASSIST' ? '[ x ]' : '[   ]'}</td>
                    <td style={{ textAlign: 'center', border: '1px solid #cbd5e1' }}>{viewingAssessment.data.adl.toileting === 'FULL_DEPEND' ? '[ x ]' : '[   ]'}</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '0.25rem 0.4rem', border: '1px solid #cbd5e1' }}>Di chuyển (Đi lại, thay đổi tư thế)</td>
                    <td style={{ textAlign: 'center', border: '1px solid #cbd5e1' }}>{viewingAssessment.data.adl.mobility === 'INDEPENDENT' ? '[ x ]' : '[   ]'}</td>
                    <td style={{ textAlign: 'center', border: '1px solid #cbd5e1' }}>{viewingAssessment.data.adl.mobility === 'PARTIAL_ASSIST' ? '[ x ]' : '[   ]'}</td>
                    <td style={{ textAlign: 'center', border: '1px solid #cbd5e1' }}>{viewingAssessment.data.adl.mobility === 'FULL_DEPEND' ? '[ x ]' : '[   ]'}</td>
                  </tr>
                </tbody>
              </table>

              {/* V, VI, VII. TINH THẦN & NGUY CƠ */}
              <div style={{ fontSize: '0.8rem', marginBottom: '0.4rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <div>
                  <b>V. Tinh thần & Nhận thức:</b><br />
                  • Tiếp xúc: [{viewingAssessment.data.mental.alertAndResponsive ? ' x ' : '   '}] Tỉnh táo &nbsp; [{!viewingAssessment.data.mental.alertAndResponsive ? ' x ' : '   '}] Lẫn<br />
                  • Trí nhớ: [{viewingAssessment.data.mental.memoryCognition === 'NORMAL' ? ' x ' : '   '}] Bình thường &nbsp; [{viewingAssessment.data.mental.memoryCognition === 'CONFUSED_SEVERE' ? ' x ' : '   '}] Giảm
                </div>
                <div>
                  <b>VI. Dinh dưỡng & VII. Nguy cơ:</b><br />
                  • Ăn: [{viewingAssessment.data.nutrition.dietType === 'NORMAL_RICE' ? ' x ' : '   '}] Cơm &nbsp; [{viewingAssessment.data.nutrition.dietType === 'PORRIDGE_SOUP' ? ' x ' : '   '}] Cháo/Súp<br />
                  • Nguy cơ ngã: [{viewingAssessment.data.fallRisk === 'LOW' ? ' x ' : '   '}] Thấp &nbsp; [{viewingAssessment.data.fallRisk === 'HIGH' ? ' x ' : '   '}] Cao<br />
                  • Da: [{!viewingAssessment.data.skinRisk.hasUlcer ? ' x ' : '   '}] Bình thường ({viewingAssessment.data.skinRisk.notes || 'Không loét'})
                </div>
              </div>

              {/* VIII. KẾT LUẬN & DUAL SIGNATURE */}
              <div className="section-header" style={{ background: '#e2f4ea', padding: '0.25rem 0.6rem', fontWeight: 700, fontSize: '0.84rem', marginBottom: '0.35rem' }}>
                VIII. KẾT LUẬN VÀ HƯỚNG CHĂM SÓC BAN ĐẦU
              </div>
              <div style={{ fontSize: '0.8rem', marginBottom: '0.3rem' }}>
                <b>1. Mức độ chăm sóc đề xuất:</b> &nbsp;
                <span style={{ background: viewingAssessment.data.careLevelProposal === 'LEVEL_1' ? '#fef08a' : 'transparent', padding: '0.1rem 0.35rem', borderRadius: '0.2rem', fontWeight: viewingAssessment.data.careLevelProposal === 'LEVEL_1' ? 700 : 400 }}>
                  [{viewingAssessment.data.careLevelProposal === 'LEVEL_1' ? ' x ' : '   '}] (1) Tự phục vụ
                </span> &nbsp;&nbsp;
                <span style={{ background: viewingAssessment.data.careLevelProposal === 'LEVEL_2' ? '#fef08a' : 'transparent', padding: '0.1rem 0.35rem', borderRadius: '0.2rem', fontWeight: viewingAssessment.data.careLevelProposal === 'LEVEL_2' ? 700 : 400 }}>
                  [{viewingAssessment.data.careLevelProposal === 'LEVEL_2' ? ' x ' : '   '}] (2) Cần hỗ trợ một phần
                </span> &nbsp;&nbsp;
                <span style={{ background: viewingAssessment.data.careLevelProposal === 'LEVEL_3' ? '#fef08a' : 'transparent', padding: '0.1rem 0.35rem', borderRadius: '0.2rem', fontWeight: viewingAssessment.data.careLevelProposal === 'LEVEL_3' ? 700 : 400 }}>
                  [{viewingAssessment.data.careLevelProposal === 'LEVEL_3' ? ' x ' : '   '}] (3) Chăm sóc toàn diện
                </span>
              </div>
              <div style={{ fontSize: '0.8rem', marginBottom: '0.5rem' }}>
                <b>2. Ghi chú cụ thể:</b> {viewingAssessment.data.specificNotes || 'Không có.'}
              </div>

              {/* IX. THỐNG NHẤT BẢNG GIÁ DỊCH VỤ & KHUNG PHÍ HÀNG THÁNG */}
              <div className="section-header" style={{ background: '#fef08a', padding: '0.25rem 0.6rem', fontWeight: 700, fontSize: '0.84rem', marginBottom: '0.35rem', color: '#713f12' }}>
                IX. THỐNG NHẤT BẢNG GIÁ DỊCH VỤ & PHÍ HÀNG THÁNG CHUẨN TÂM AN CARE
              </div>
              {(() => {
                const fin = viewingAssessment.data.financialAgreement || DEFAULT_INITIAL_ASSESSMENT.financialAgreement!;
                const basicPkgName = fin.basicCarePackageName || BASIC_CARE_PACKAGE_OPTIONS[fin.basicCarePackageKey]?.name || 'Gói chăm sóc cơ bản';
                const basicFee = fin.basicCarePackageFee ?? 14500000;
                const supportSvcName = fin.supportServiceName || SUPPORT_SERVICE_OPTIONS[fin.supportServiceKey]?.name || 'Dịch vụ chăm sóc hỗ trợ';
                const supportFee = fin.supportServiceFee ?? 0;
                const total = basicFee + supportFee;

                return (
                  <div style={{ fontSize: '0.78rem', marginBottom: '0.5rem', background: '#fffbeb', border: '1px solid #fef08a', padding: '0.4rem 0.6rem', borderRadius: '0.25rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '0.3rem', marginBottom: '0.35rem' }}>
                      <div><b>1. Gói chăm sóc cơ bản:</b> {basicPkgName} ({basicFee.toLocaleString('vi-VN')} đ/tháng)</div>
                      <div><b>2. Phí chăm sóc hỗ trợ (Mục II):</b> {supportSvcName} ({supportFee.toLocaleString('vi-VN')} đ/tháng)</div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px dashed #fde047', paddingTop: '0.3rem', marginTop: '0.2rem' }}>
                      <div>
                        <b>Đặt cọc ban đầu:</b> {(fin.depositAmount ?? 20000000).toLocaleString('vi-VN')} VNĐ &nbsp;|&nbsp;
                        <b>Hạn thanh toán:</b> {fin.paymentCycleDay || 'Từ ngày 01 đến ngày 05 hàng tháng'}
                      </div>
                      <div style={{ fontSize: '0.86rem', fontWeight: 800, color: '#92400e' }}>
                        TỔNG PHÍ HÀNG THÁNG: {total.toLocaleString('vi-VN')} VNĐ
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Triple Signatures */}
              <div className="signature-box" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', textAlign: 'center', marginTop: '0.6rem', gap: '0.5rem' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.82rem' }}>Đại diện Gia đình / Thân nhân</div>
                  <div style={{ fontSize: '0.72rem', color: '#64748b', marginBottom: '1.2rem' }}>(Ký và ghi rõ họ tên)</div>
                  <div style={{ fontWeight: 700, borderTop: '1px dashed #cbd5e1', paddingTop: '0.25rem', width: '80%', margin: '0 auto', fontSize: '0.8rem' }}>
                    {viewingAssessment.data.guardianName || 'Người đại diện'}
                  </div>
                </div>

                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.82rem' }}>Người lập phiếu đánh giá</div>
                  <div style={{ fontSize: '0.7rem', color: '#64748b', marginBottom: '1.2rem' }}>(Ký và ghi rõ họ tên)</div>
                  <div style={{ fontWeight: 700, borderTop: '1px dashed #cbd5e1', paddingTop: '0.25rem', width: '80%', margin: '0 auto', fontSize: '0.8rem' }}>
                    {viewingAssessment.data.assessorName || 'Nguyễn Thị Phương Thúy'}
                  </div>
                </div>

                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.82rem' }}>Đại diện Viện Tâm An Care</div>
                  <div style={{ fontSize: '0.7rem', color: '#64748b', marginBottom: '1.2rem' }}>(Ban Giám đốc / Kế toán)</div>
                  <div style={{ fontWeight: 700, borderTop: '1px dashed #cbd5e1', paddingTop: '0.25rem', width: '80%', margin: '0 auto', fontSize: '0.8rem' }}>
                    Hoàng Quốc Anh
                  </div>
                </div>
              </div>
            </div>

            {/* ================================================================= */}
            {/* PHIẾU BÀN GIAO THUỐC & ĐỒ DÙNG CÁ NHÂN — PHẦN IN RIÊNG          */}
            {/* ================================================================= */}
            {viewingAssessment.data.handoverRecord && (
              <div className="modal-body printable-a4-sheet" style={{ background: '#ffffff', color: '#1e293b', padding: '1.25rem', borderTop: '2px dashed #bae6fd', marginTop: '0' }}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem', borderBottom: '2px solid #0369a1', paddingBottom: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <img src="/branding/tam-an-logo-master.png" alt="Tâm An Logo" style={{ height: '36px', width: 'auto', objectFit: 'contain' }} />
                    <div>
                      <div style={{ fontWeight: 800, color: '#166534', fontSize: '1rem', lineHeight: 1.1 }}>TÂM AN CARE</div>
                      <div style={{ fontSize: '0.7rem', color: '#15803d', fontStyle: 'italic', fontWeight: 600 }}>Nơi Tuổi Già An Nhiên</div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', fontSize: '0.78rem' }}>
                    <div><b>Ngày bàn giao:</b> {viewingAssessment.data.handoverRecord.handoverDate}</div>
                    <div><b>Người tiếp nhận:</b> {viewingAssessment.data.handoverRecord.nurseReceiverName}</div>
                  </div>
                </div>
                <h2 style={{ textAlign: 'center', fontSize: '1.05rem', fontWeight: 800, margin: '0 0 0.15rem 0', color: '#0c4a6e' }}>
                  PHIẾU BÀN GIAO THUỐC & ĐỒ DÙNG CÁ NHÂN
                </h2>
                <div style={{ textAlign: 'center', fontSize: '0.8rem', color: '#475569', marginBottom: '0.75rem' }}>
                  Người cao tuổi: <b>{viewingAssessment.data.prospectiveResidentName}</b> &nbsp;|&nbsp;
                  Người bàn giao: <b>{viewingAssessment.data.handoverRecord.guardianDelivererName || viewingAssessment.data.guardianName}</b> &nbsp;(SĐT: {viewingAssessment.data.handoverRecord.guardianPhone || viewingAssessment.data.guardianPhone})
                </div>

                {/* Medication Print Table */}
                {viewingAssessment.data.handoverRecord.medications.length > 0 && (
                  <>
                    <div style={{ background: '#0369a1', color: '#fff', padding: '0.25rem 0.6rem', fontWeight: 700, fontSize: '0.82rem', marginBottom: '0.25rem', borderRadius: '0.25rem' }}>
                      💊 A. DANH MỤC THUỐC BÀN GIAO ({viewingAssessment.data.handoverRecord.medications.length} loại)
                    </div>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem', marginBottom: '0.75rem' }}>
                      <thead>
                        <tr style={{ background: '#e0f2fe' }}>
                          <th style={{ padding: '0.25rem 0.4rem', border: '1px solid #bae6fd', textAlign: 'left' }}>STT</th>
                          <th style={{ padding: '0.25rem 0.4rem', border: '1px solid #bae6fd', textAlign: 'left' }}>Tên thuốc</th>
                          <th style={{ padding: '0.25rem 0.4rem', border: '1px solid #bae6fd', textAlign: 'left' }}>Dạng bào chế</th>
                          <th style={{ padding: '0.25rem 0.4rem', border: '1px solid #bae6fd', textAlign: 'center' }}>Số lượng</th>
                          <th style={{ padding: '0.25rem 0.4rem', border: '1px solid #bae6fd', textAlign: 'center' }}>Hạn SD</th>
                          <th style={{ padding: '0.25rem 0.4rem', border: '1px solid #bae6fd', textAlign: 'left' }}>Cách dùng</th>
                          <th style={{ padding: '0.25rem 0.4rem', border: '1px solid #bae6fd', textAlign: 'left' }}>Bảo quản</th>
                          <th style={{ padding: '0.25rem 0.4rem', border: '1px solid #bae6fd', textAlign: 'left' }}>Loại đơn</th>
                          <th style={{ padding: '0.25rem 0.4rem', border: '1px solid #bae6fd', textAlign: 'left' }}>Ghi chú</th>
                        </tr>
                      </thead>
                      <tbody>
                        {viewingAssessment.data.handoverRecord.medications.map((med, i) => (
                          <tr key={med.id} style={{ background: i % 2 === 0 ? '#f0f9ff' : '#fff' }}>
                            <td style={{ padding: '0.2rem 0.4rem', border: '1px solid #bae6fd', textAlign: 'center' }}>{i + 1}</td>
                            <td style={{ padding: '0.2rem 0.4rem', border: '1px solid #bae6fd', fontWeight: 700 }}>{med.medicationName}</td>
                            <td style={{ padding: '0.2rem 0.4rem', border: '1px solid #bae6fd' }}>{med.dosageForm}</td>
                            <td style={{ padding: '0.2rem 0.4rem', border: '1px solid #bae6fd', textAlign: 'center', fontWeight: 700 }}>{med.quantity}</td>
                            <td style={{ padding: '0.2rem 0.4rem', border: '1px solid #bae6fd', textAlign: 'center' }}>{med.expiryDate}</td>
                            <td style={{ padding: '0.2rem 0.4rem', border: '1px solid #bae6fd' }}>{med.usageInstruction}</td>
                            <td style={{ padding: '0.2rem 0.4rem', border: '1px solid #bae6fd' }}>{MEDICATION_STORAGE_OPTIONS[med.storageRequirement]}</td>
                            <td style={{ padding: '0.2rem 0.4rem', border: '1px solid #bae6fd' }}>{MEDICATION_PRESCRIPTION_OPTIONS[med.prescriptionStatus]}</td>
                            <td style={{ padding: '0.2rem 0.4rem', border: '1px solid #bae6fd' }}>{med.notes}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                )}

                {/* Belongings Print Table */}
                {viewingAssessment.data.handoverRecord.belongings.length > 0 && (
                  <>
                    <div style={{ background: '#0369a1', color: '#fff', padding: '0.25rem 0.6rem', fontWeight: 700, fontSize: '0.82rem', marginBottom: '0.25rem', borderRadius: '0.25rem' }}>
                      🧳 B. DANH MỤC ĐỒ DÙNG CÁ NHÂN ({viewingAssessment.data.handoverRecord.belongings.length} mục)
                    </div>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem', marginBottom: '0.75rem' }}>
                      <thead>
                        <tr style={{ background: '#e0f2fe' }}>
                          <th style={{ padding: '0.25rem 0.4rem', border: '1px solid #bae6fd', textAlign: 'center' }}>STT</th>
                          <th style={{ padding: '0.25rem 0.4rem', border: '1px solid #bae6fd', textAlign: 'left' }}>Loại</th>
                          <th style={{ padding: '0.25rem 0.4rem', border: '1px solid #bae6fd', textAlign: 'left' }}>Tên / Mô tả đồ dùng</th>
                          <th style={{ padding: '0.25rem 0.4rem', border: '1px solid #bae6fd', textAlign: 'center' }}>Số lượng</th>
                          <th style={{ padding: '0.25rem 0.4rem', border: '1px solid #bae6fd', textAlign: 'left' }}>Tình trạng</th>
                          <th style={{ padding: '0.25rem 0.4rem', border: '1px solid #bae6fd', textAlign: 'left' }}>Nơi lưu giữ</th>
                          <th style={{ padding: '0.25rem 0.4rem', border: '1px solid #bae6fd', textAlign: 'left' }}>Đánh dấu nhận dạng</th>
                          <th style={{ padding: '0.25rem 0.4rem', border: '1px solid #bae6fd', textAlign: 'left' }}>Ghi chú</th>
                        </tr>
                      </thead>
                      <tbody>
                        {viewingAssessment.data.handoverRecord.belongings.map((item, i) => (
                          <tr key={item.id} style={{ background: i % 2 === 0 ? '#f0f9ff' : '#fff' }}>
                            <td style={{ padding: '0.2rem 0.4rem', border: '1px solid #bae6fd', textAlign: 'center' }}>{i + 1}</td>
                            <td style={{ padding: '0.2rem 0.4rem', border: '1px solid #bae6fd' }}>{BELONGING_CATEGORIES[item.category]}</td>
                            <td style={{ padding: '0.2rem 0.4rem', border: '1px solid #bae6fd', fontWeight: 700 }}>{item.itemName}</td>
                            <td style={{ padding: '0.2rem 0.4rem', border: '1px solid #bae6fd', textAlign: 'center', fontWeight: 700 }}>{item.quantity}</td>
                            <td style={{ padding: '0.2rem 0.4rem', border: '1px solid #bae6fd' }}>{BELONGING_CONDITIONS[item.condition]}</td>
                            <td style={{ padding: '0.2rem 0.4rem', border: '1px solid #bae6fd' }}>{BELONGING_LOCATIONS[item.storageLocation]}</td>
                            <td style={{ padding: '0.2rem 0.4rem', border: '1px solid #bae6fd' }}>{item.identificationTag}</td>
                            <td style={{ padding: '0.2rem 0.4rem', border: '1px solid #bae6fd' }}>{item.notes}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                )}

                {/* General Notes */}
                {viewingAssessment.data.handoverRecord.generalNotes && (
                  <div style={{ fontSize: '0.78rem', marginBottom: '0.65rem', padding: '0.5rem 0.75rem', background: '#f0f9ff', borderRadius: '0.35rem', border: '1px solid #bae6fd' }}>
                    <b>Ghi chú tổng hợp:</b> {viewingAssessment.data.handoverRecord.generalNotes}
                  </div>
                )}

                {/* Triple Signatures for Handover */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', textAlign: 'center', marginTop: '0.75rem', gap: '0.5rem' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.8rem' }}>Bên bàn giao</div>
                    <div style={{ fontSize: '0.7rem', color: '#64748b', marginBottom: '1.5rem' }}>(Ký và ghi rõ họ tên)</div>
                    <div style={{ fontWeight: 700, borderTop: '1px dashed #cbd5e1', paddingTop: '0.2rem', width: '80%', margin: '0 auto', fontSize: '0.78rem' }}>
                      {viewingAssessment.data.handoverRecord.guardianDelivererName || viewingAssessment.data.guardianName}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.8rem' }}>Điều dưỡng tiếp nhận</div>
                    <div style={{ fontSize: '0.7rem', color: '#64748b', marginBottom: '1.5rem' }}>(Ký và ghi rõ họ tên)</div>
                    <div style={{ fontWeight: 700, borderTop: '1px dashed #cbd5e1', paddingTop: '0.2rem', width: '80%', margin: '0 auto', fontSize: '0.78rem' }}>
                      {viewingAssessment.data.handoverRecord.nurseReceiverName}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.8rem' }}>Quản lý xác nhận</div>
                    <div style={{ fontSize: '0.7rem', color: '#64748b', marginBottom: '1.5rem' }}>(Ký và ghi rõ họ tên)</div>
                    <div style={{ fontWeight: 700, borderTop: '1px dashed #cbd5e1', paddingTop: '0.2rem', width: '80%', margin: '0 auto', fontSize: '0.78rem' }}>
                      {viewingAssessment.data.handoverRecord.supervisorApprovalName}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              {viewingAssessment.c.status !== 'ADMITTED' && viewingAssessment.c.status !== 'COMPLETED' ? (
                <button
                  type="button"
                  onClick={() => {
                    const targetCase = viewingAssessment.c;
                    setViewingAssessment(null);
                    void handleEditDraft(targetCase);
                  }}
                  className="btn btn-warning"
                  style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                >
                  ✏️ Sửa phiếu này
                </button>
              ) : (
                <div />
              )}
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setViewingAssessment(null)}
                  className="btn btn-secondary"
                >
                  Đóng
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="btn btn-primary"
                >
                  🖨️ In Phiếu Tiếp Nhận (A4)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: SỔ LỊCH SỬ PHIẾU BÀN GIAO THUỐC & ĐỒ DÙNG CÁ NHÂN */}
      {showHandoverHistoryModal && (
        <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '1rem' }}>
          <div className="modal-card" style={{ background: '#ffffff', borderRadius: '0.75rem', maxWidth: '1000px', width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: '1.5rem', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.2rem', color: '#166534', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span>📜</span> Lịch Sử Phiếu Bàn Giao Thuốc & Đồ Dùng Cá Nhân (Tiếp Nhận)
              </h2>
              <button onClick={() => setShowHandoverHistoryModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#64748b' }}>✕</button>
            </div>

            {/* Filter Search */}
            <div style={{ marginBottom: '1rem' }}>
              <input
                type="text"
                className="text-input"
                placeholder="🔍 Tìm kiếm theo tên người cao tuổi, mã hồ sơ..."
                style={{ width: '100%', height: '38px', padding: '0 0.75rem', fontSize: '0.86rem' }}
                value={handoverSearchTerm}
                onChange={(e) => setHandoverSearchTerm(e.target.value)}
              />
            </div>

            {/* Table of Handover Tickets */}
            <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '0.5rem' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', textAlign: 'left' }}>
                    <th style={{ padding: '0.75rem 1rem' }}>Mã & Tên Người Cao Tuổi</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Người Bàn Giao (Thân nhân)</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Điều Dưỡng Tiếp Nhận</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Danh Mục Thuốc (Bảng A)</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Đồ Dùng Cá Nhân (Bảng B)</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Thao Tác</th>
                  </tr>
                </thead>
                <tbody>
                  {admissions.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
                        Chưa có lịch sử bàn giao thuốc & đồ dùng nào.
                      </td>
                    </tr>
                  ) : (
                    admissions
                      .filter(item => {
                        if (!handoverSearchTerm.trim()) return true;
                        const q = handoverSearchTerm.toLowerCase();
                        return item.prospectiveResidentName.toLowerCase().includes(q) || item.admissionCode.toLowerCase().includes(q);
                      })
                      .map(item => {
                        const handover: AdmissionHandoverRecord = {
                          handoverDate: item.requestedAdmissionDate ? item.requestedAdmissionDate.slice(0, 10) : new Date().toISOString().slice(0, 10),
                          guardianDelivererName: 'Gia đình người cao tuổi',
                          guardianPhone: '0901234567',
                          nurseReceiverName: 'Trần Thị Mai (Điều dưỡng)',
                          caregiverReceiverName: 'Lê Văn Nam (Chăm sóc viên)',
                          supervisorApprovalName: 'Hoàng Quốc Anh (Ban Giám đốc)',
                          medications: DEFAULT_HANDOVER_MEDICATIONS,
                          belongings: DEFAULT_HANDOVER_BELONGINGS,
                          generalNotes: 'Kiểm đếm 100% thuốc & đồ dùng cá nhân nguyên vẹn lúc tiếp nhận.',
                        };

                        return (
                          <tr key={item.admissionCaseId} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '0.75rem 1rem' }}>
                              <div style={{ fontWeight: 700, color: '#0f172a' }}>{item.prospectiveResidentName}</div>
                              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Mã: {item.admissionCode}</div>
                            </td>
                            <td style={{ padding: '0.75rem 1rem' }}>
                              <div style={{ fontWeight: 600 }}>{handover.guardianDelivererName}</div>
                              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>SĐT: {handover.guardianPhone}</div>
                            </td>
                            <td style={{ padding: '0.75rem 1rem' }}>
                              <div style={{ color: '#166534', fontWeight: 600 }}>{handover.nurseReceiverName}</div>
                              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Khoa Tiếp Nhận Y Khoa</div>
                            </td>
                            <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                              <span style={{ display: 'inline-block', padding: '0.2rem 0.5rem', background: '#dcfce7', color: '#15803d', fontWeight: 700, borderRadius: '0.35rem', fontSize: '0.78rem' }}>
                                💊 {handover.medications.length} loại thuốc
                              </span>
                            </td>
                            <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                              <span style={{ display: 'inline-block', padding: '0.2rem 0.5rem', background: '#e0f2fe', color: '#0369a1', fontWeight: 700, borderRadius: '0.35rem', fontSize: '0.78rem' }}>
                                🧳 {handover.belongings.length} món đồ dùng
                              </span>
                            </td>
                            <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                              <button
                                type="button"
                                onClick={() => setSelectedHandoverPrint({ residentName: item.prospectiveResidentName, caseCode: item.admissionCode, handover })}
                                style={{ background: '#f0fdf4', color: '#166534', border: '1px solid #86efac', padding: '0.35rem 0.75rem', borderRadius: '0.35rem', fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer' }}
                              >
                                🖨️ In Phiếu Bàn Giao (A4)
                              </button>
                            </td>
                          </tr>
                        );
                      })
                  )}
                </tbody>
              </table>
            </div>

            <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setShowHandoverHistoryModal(false)} className="btn btn-secondary">Đóng</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: IN PHIẾU BÀN GIAO THUỐC & ĐỒ DÙNG A4 (STANDALONE PRINT VIEW) */}
      {selectedHandoverPrint && (
        <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, padding: '1rem' }}>
          <div className="modal-card" style={{ background: '#ffffff', borderRadius: '0.75rem', maxWidth: '900px', width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: '1.5rem', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.1rem', color: '#166534' }}>
                🖨️ Xem Trước & In Phiếu Bàn Giao (A4) — {selectedHandoverPrint.residentName}
              </h2>
              <button onClick={() => setSelectedHandoverPrint(null)} style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#64748b' }}>✕</button>
            </div>

            {/* Print Container A4 Sheet */}
            <div style={{ background: '#ffffff', padding: '1rem', border: '1px solid #cbd5e1', borderRadius: '0.5rem', fontFamily: 'serif' }}>
              <div style={{ textAlign: 'center', borderBottom: '2px solid #166534', paddingBottom: '0.5rem', marginBottom: '0.75rem' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.05em', color: '#475569' }}>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM — TIÊU CHUẨN Y KHOA TÂM AN CARE</div>
                <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#166534', margin: '0.2rem 0' }}>PHIẾU BÀN GIAO THUỐC & ĐỒ DÙNG CÁ NHÂN NGƯỜI CAO TUỔI</div>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Thời điểm tiếp nhận ban đầu tại Trung Tâm Dưỡng Lão Tâm An • Mã hồ sơ: {selectedHandoverPrint.caseCode}</div>
              </div>

              {/* Info Header */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.8rem', marginBottom: '0.75rem', background: '#f8fafc', padding: '0.5rem 0.75rem', borderRadius: '0.35rem' }}>
                <div><b>Họ tên người cao tuổi:</b> {selectedHandoverPrint.residentName}</div>
                <div><b>Ngày tiếp nhận bàn giao:</b> {selectedHandoverPrint.handover.handoverDate}</div>
                <div><b>Bên bàn giao (Gia đình):</b> {selectedHandoverPrint.handover.guardianDelivererName} ({selectedHandoverPrint.handover.guardianPhone})</div>
                <div><b>Bên tiếp nhận (Điều dưỡng):</b> {selectedHandoverPrint.handover.nurseReceiverName}</div>
              </div>

              {/* Table A: Medications */}
              <div style={{ background: '#166534', color: '#fff', padding: '0.25rem 0.6rem', fontWeight: 700, fontSize: '0.82rem', marginBottom: '0.25rem', borderRadius: '0.25rem' }}>
                💊 A. DANH MỤC THUỐC BÀN GIAO KHÁM & ĐIỀU TRỊ ({selectedHandoverPrint.handover.medications.length} loại)
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem', marginBottom: '0.75rem' }}>
                <thead>
                  <tr style={{ background: '#f0fdf4' }}>
                    <th style={{ padding: '0.25rem 0.4rem', border: '1px solid #bbf7d0', textAlign: 'center' }}>STT</th>
                    <th style={{ padding: '0.25rem 0.4rem', border: '1px solid #bbf7d0', textAlign: 'left' }}>Tên thuốc & Dạng bào chế</th>
                    <th style={{ padding: '0.25rem 0.4rem', border: '1px solid #bbf7d0', textAlign: 'center' }}>Số lượng</th>
                    <th style={{ padding: '0.25rem 0.4rem', border: '1px solid #bbf7d0', textAlign: 'center' }}>Hạn dùng</th>
                    <th style={{ padding: '0.25rem 0.4rem', border: '1px solid #bbf7d0', textAlign: 'left' }}>Hướng dẫn sử dụng / Liều dùng</th>
                    <th style={{ padding: '0.25rem 0.4rem', border: '1px solid #bbf7d0', textAlign: 'left' }}>Bảo quản</th>
                    <th style={{ padding: '0.25rem 0.4rem', border: '1px solid #bbf7d0', textAlign: 'left' }}>Ghi chú</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedHandoverPrint.handover.medications.map((item, i) => (
                    <tr key={item.id} style={{ background: i % 2 === 0 ? '#f0fdf4' : '#fff' }}>
                      <td style={{ padding: '0.2rem 0.4rem', border: '1px solid #bbf7d0', textAlign: 'center' }}>{i + 1}</td>
                      <td style={{ padding: '0.2rem 0.4rem', border: '1px solid #bbf7d0', fontWeight: 700 }}>{item.medicationName} ({item.dosageForm})</td>
                      <td style={{ padding: '0.2rem 0.4rem', border: '1px solid #bbf7d0', textAlign: 'center', fontWeight: 700 }}>{item.quantity}</td>
                      <td style={{ padding: '0.2rem 0.4rem', border: '1px solid #bbf7d0', textAlign: 'center' }}>{item.expiryDate}</td>
                      <td style={{ padding: '0.2rem 0.4rem', border: '1px solid #bbf7d0' }}>{item.usageInstruction}</td>
                      <td style={{ padding: '0.2rem 0.4rem', border: '1px solid #bbf7d0' }}>{MEDICATION_STORAGE_OPTIONS[item.storageRequirement]}</td>
                      <td style={{ padding: '0.2rem 0.4rem', border: '1px solid #bbf7d0' }}>{item.notes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Table B: Belongings */}
              <div style={{ background: '#0369a1', color: '#fff', padding: '0.25rem 0.6rem', fontWeight: 700, fontSize: '0.82rem', marginBottom: '0.25rem', borderRadius: '0.25rem' }}>
                🧳 B. DANH MỤC ĐỒ DÙNG CÁ NHÂN & TÀI SẢN ({selectedHandoverPrint.handover.belongings.length} mục)
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem', marginBottom: '0.75rem' }}>
                <thead>
                  <tr style={{ background: '#e0f2fe' }}>
                    <th style={{ padding: '0.25rem 0.4rem', border: '1px solid #bae6fd', textAlign: 'center' }}>STT</th>
                    <th style={{ padding: '0.25rem 0.4rem', border: '1px solid #bae6fd', textAlign: 'left' }}>Loại</th>
                    <th style={{ padding: '0.25rem 0.4rem', border: '1px solid #bae6fd', textAlign: 'left' }}>Tên đồ dùng</th>
                    <th style={{ padding: '0.25rem 0.4rem', border: '1px solid #bae6fd', textAlign: 'center' }}>Số lượng</th>
                    <th style={{ padding: '0.25rem 0.4rem', border: '1px solid #bae6fd', textAlign: 'left' }}>Tình trạng</th>
                    <th style={{ padding: '0.25rem 0.4rem', border: '1px solid #bae6fd', textAlign: 'left' }}>Nơi lưu giữ</th>
                    <th style={{ padding: '0.25rem 0.4rem', border: '1px solid #bae6fd', textAlign: 'left' }}>Ghi chú</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedHandoverPrint.handover.belongings.map((item, i) => (
                    <tr key={item.id} style={{ background: i % 2 === 0 ? '#f0f9ff' : '#fff' }}>
                      <td style={{ padding: '0.2rem 0.4rem', border: '1px solid #bae6fd', textAlign: 'center' }}>{i + 1}</td>
                      <td style={{ padding: '0.2rem 0.4rem', border: '1px solid #bae6fd' }}>{BELONGING_CATEGORIES[item.category]}</td>
                      <td style={{ padding: '0.2rem 0.4rem', border: '1px solid #bae6fd', fontWeight: 700 }}>{item.itemName}</td>
                      <td style={{ padding: '0.2rem 0.4rem', border: '1px solid #bae6fd', textAlign: 'center', fontWeight: 700 }}>{item.quantity}</td>
                      <td style={{ padding: '0.2rem 0.4rem', border: '1px solid #bae6fd' }}>{BELONGING_CONDITIONS[item.condition]}</td>
                      <td style={{ padding: '0.2rem 0.4rem', border: '1px solid #bae6fd' }}>{BELONGING_LOCATIONS[item.storageLocation]}</td>
                      <td style={{ padding: '0.2rem 0.4rem', border: '1px solid #bae6fd' }}>{item.notes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Signatures */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', textAlign: 'center', marginTop: '1rem', gap: '0.5rem' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.8rem' }}>Bên bàn giao</div>
                  <div style={{ fontSize: '0.7rem', color: '#64748b', marginBottom: '1.8rem' }}>(Ký và ghi rõ họ tên)</div>
                  <div style={{ fontWeight: 700, borderTop: '1px dashed #cbd5e1', paddingTop: '0.2rem', width: '80%', margin: '0 auto', fontSize: '0.78rem' }}>
                    {selectedHandoverPrint.handover.guardianDelivererName}
                  </div>
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.8rem' }}>Điều dưỡng tiếp nhận</div>
                  <div style={{ fontSize: '0.7rem', color: '#64748b', marginBottom: '1.8rem' }}>(Ký và ghi rõ họ tên)</div>
                  <div style={{ fontWeight: 700, borderTop: '1px dashed #cbd5e1', paddingTop: '0.2rem', width: '80%', margin: '0 auto', fontSize: '0.78rem' }}>
                    {selectedHandoverPrint.handover.nurseReceiverName}
                  </div>
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.8rem' }}>Quản lý xác nhận</div>
                  <div style={{ fontSize: '0.7rem', color: '#64748b', marginBottom: '1.8rem' }}>(Ký và ghi rõ họ tên)</div>
                  <div style={{ fontWeight: 700, borderTop: '1px dashed #cbd5e1', paddingTop: '0.2rem', width: '80%', margin: '0 auto', fontSize: '0.78rem' }}>
                    {selectedHandoverPrint.handover.supervisorApprovalName}
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-footer" style={{ marginTop: '1rem' }}>
              <button type="button" onClick={() => setSelectedHandoverPrint(null)} className="btn btn-secondary">Đóng</button>
              <button type="button" onClick={() => window.print()} className="btn btn-primary">🖨️ In Phiếu (A4)</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

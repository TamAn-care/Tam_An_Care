import {
  useMemo,
  useState,
} from 'react';
import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {
  listResidents,
} from '../../api/residents';
import {
  amendWorkEvent,
  createWorkEvent,
  getWorkEvent,
  listWorkEvents,
  listWorkEventTypes,
  verifyWorkEvent,
  voidWorkEvent,
  type PlannedClassification,
  type WorkEventStatus,
  type WorkEventType,
} from '../../api/operational-work';
import {
  fetchResidentIntegrationOverview,
  type ResidentIntegrationOverview,
} from '../../api/integration';
import {
  useActor,
} from '../../auth/ActorContext';
import {
  ApiError,
} from '../../api/errors';
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from '../../components/feedback/FeedbackStates';

const STATUS_LABEL: Record<string, string> = {
  RECORDED: 'Đã ghi nhận',
  VERIFIED: 'Đã xác minh',
  COMPLETED: 'Đã hoàn thành',
  AMENDED: 'Đã điều chỉnh',
  VOIDED: 'Đã vô hiệu',
};

const STATUS_BADGE_CLASS: Record<string, string> = {
  RECORDED: 'badge badge-warning',
  VERIFIED: 'badge badge-success',
  COMPLETED: 'badge badge-info',
  AMENDED: 'badge badge-purple',
  VOIDED: 'badge badge-danger',
};

const PLAN_LABEL: Record<string, string> = {
  PLANNED: 'Theo kế hoạch',
  ADDITIONAL: 'Bổ sung',
  UNPLANNED: 'Phát sinh',
};

const CATEGORY_LABELS: Record<string, string> = {
  PERSONAL_CARE: 'Chăm sóc cá nhân & Sinh hoạt',
  NUTRITION: 'Dinh dưỡng & Bữa ăn',
  CLINICAL_CARE: 'Y tế & Theo dõi sức khỏe',
  MOBILITY: 'Vận động & Phục hồi chức năng',
  PSYCHOSOCIAL: 'Tâm lý & Xã hội',
  HOUSEKEEPING: 'Vệ sinh & Buồng phòng',
  EMERGENCY: 'Sự cố & Khẩn cấp',
  OTHER: 'Khác & Nghiệp vụ chung',
};

export const POPULAR_WORK_EVENT_TYPES: WorkEventType[] = [
  {
    work_event_type_id: 'ops-wet-hygiene-bathing',
    code: 'HYGIENE_BATHING',
    display_name_vi: 'Tắm rửa & Vệ sinh thân thể',
    category: 'PERSONAL_CARE',
    default_unit: 'lần',
    default_work_weight: 1,
    resident_related: true,
    inventory_link_allowed: true,
    active: true,
    created_at: '',
    updated_at: '',
  },
  {
    work_event_type_id: 'ops-wet-meal-assistance',
    code: 'MEAL_ASSISTANCE',
    display_name_vi: 'Hỗ trợ ăn uống & Bón cháo/cơm',
    category: 'NUTRITION',
    default_unit: 'bữa',
    default_work_weight: 1,
    resident_related: true,
    inventory_link_allowed: false,
    active: true,
    created_at: '',
    updated_at: '',
  },
  {
    work_event_type_id: 'ops-wet-tube-feeding-assist',
    code: 'TUBE_FEEDING_ASSIST',
    display_name_vi: 'Hỗ trợ ăn qua ống thông Sonde',
    category: 'NUTRITION',
    default_unit: 'cữ',
    default_work_weight: 1,
    resident_related: true,
    inventory_link_allowed: true,
    active: true,
    created_at: '',
    updated_at: '',
  },
  {
    work_event_type_id: 'ops-wet-vital-signs-check',
    code: 'VITAL_SIGNS_CHECK',
    display_name_vi: 'Đo dấu hiệu sinh tồn & Huyết áp',
    category: 'CLINICAL_CARE',
    default_unit: 'lần',
    default_work_weight: 1,
    resident_related: true,
    inventory_link_allowed: false,
    active: true,
    created_at: '',
    updated_at: '',
  },
  {
    work_event_type_id: 'ops-wet-medication-admin',
    code: 'MEDICATION_ADMINISTRATION',
    display_name_vi: 'Cấp phát & Cho uống thuốc theo y lệnh',
    category: 'CLINICAL_CARE',
    default_unit: 'lần',
    default_work_weight: 1,
    resident_related: true,
    inventory_link_allowed: false,
    active: true,
    created_at: '',
    updated_at: '',
  },
  {
    work_event_type_id: 'ops-wet-wound-care',
    code: 'WOUND_CARE',
    display_name_vi: 'Thay băng & Chăm sóc vết thương/loét',
    category: 'CLINICAL_CARE',
    default_unit: 'lần',
    default_work_weight: 1,
    resident_related: true,
    inventory_link_allowed: true,
    active: true,
    created_at: '',
    updated_at: '',
  },
  {
    work_event_type_id: 'ops-wet-mobility-assistance',
    code: 'MOBILITY_ASSISTANCE',
    display_name_vi: 'Hỗ trợ di chuyển & Đổi tư thế chống loét',
    category: 'MOBILITY',
    default_unit: 'lần',
    default_work_weight: 1,
    resident_related: true,
    inventory_link_allowed: false,
    active: true,
    created_at: '',
    updated_at: '',
  },
  {
    work_event_type_id: 'ops-wet-rehab-exercise',
    code: 'REHAB_EXERCISE',
    display_name_vi: 'Hướng dẫn tập VLTL & Phục hồi chức năng',
    category: 'MOBILITY',
    default_unit: 'lần',
    default_work_weight: 1,
    resident_related: true,
    inventory_link_allowed: false,
    active: true,
    created_at: '',
    updated_at: '',
  },
  {
    work_event_type_id: 'ops-wet-psychological-support',
    code: 'PSYCHOLOGICAL_SUPPORT',
    display_name_vi: 'Trò chuyện & Tham vấn tâm lý tinh thần',
    category: 'PSYCHOSOCIAL',
    default_unit: 'lần',
    default_work_weight: 1,
    resident_related: true,
    inventory_link_allowed: false,
    active: true,
    created_at: '',
    updated_at: '',
  },
  {
    work_event_type_id: 'ops-wet-diaper-toileting',
    code: 'DIAPER_TOILETING',
    display_name_vi: 'Thay tã bỉm & Vệ sinh bài tiết',
    category: 'PERSONAL_CARE',
    default_unit: 'lần',
    default_work_weight: 1,
    resident_related: true,
    inventory_link_allowed: true,
    active: true,
    created_at: '',
    updated_at: '',
  },
  {
    work_event_type_id: 'ops-wet-room-cleaning',
    code: 'ROOM_CLEANING_INCIDENTAL',
    display_name_vi: 'Dọn dẹp phòng & Thay drap giường đột xuất',
    category: 'HOUSEKEEPING',
    default_unit: 'lần',
    default_work_weight: 1,
    resident_related: true,
    inventory_link_allowed: false,
    active: true,
    created_at: '',
    updated_at: '',
  },
  {
    work_event_type_id: 'ops-wet-emergency-care',
    code: 'EMERGENCY_INCIDENT_CARE',
    display_name_vi: 'Xử lý sự cố / Sơ cứu khẩn cấp',
    category: 'EMERGENCY',
    default_unit: 'lần',
    default_work_weight: 1,
    resident_related: true,
    inventory_link_allowed: false,
    active: true,
    created_at: '',
    updated_at: '',
  },
  {
    work_event_type_id: 'ops-wet-family-visit',
    code: 'FAMILY_VISIT_ASSIST',
    display_name_vi: 'Đón tiếp thân nhân & Hỗ trợ thăm gặp',
    category: 'PSYCHOSOCIAL',
    default_unit: 'lần',
    default_work_weight: 1,
    resident_related: true,
    inventory_link_allowed: false,
    active: true,
    created_at: '',
    updated_at: '',
  },
  {
    work_event_type_id: 'ops-wet-other-incidental',
    code: 'OTHER_INCIDENTAL',
    display_name_vi: 'Khác (Diễn giải chi tiết tại phần Ghi chú)',
    category: 'OTHER',
    default_unit: 'lần',
    default_work_weight: 1,
    resident_related: true,
    inventory_link_allowed: false,
    active: true,
    created_at: '',
    updated_at: '',
  },
];

const PROJECTION_TYPE_CODES = new Set([
  'CARE_TASK_COMPLETION',
  'PERSONAL_CARE_ASSISTANCE',
  'TOILETING_ASSISTANCE',
]);

function errorText(error: unknown) {
  if (
    error instanceof ApiError ||
    error instanceof Error
  ) {
    return error.message;
  }

  return 'Không thể hoàn tất thao tác.';
}

export function OperationsPage() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  // Search & Filter State
  const [residentId, setResidentId] = useState('');
  const [typeId, setTypeId] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [performedBy, setPerformedBy] = useState('');
  const [status, setStatus] = useState<WorkEventStatus | ''>('');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [sourceDomain, setSourceDomain] = useState('');
  const [limit, setLimit] = useState(100);

  // Selected Resident Comprehensive View Tab
  const [residentActiveTab, setResidentActiveTab] = useState<'VITALS' | 'MEDS' | 'TASKS' | 'EVENTS' | 'INCIDENTS'>('VITALS');

  // Modal / Detail state
  const [selectedEventId, setSelectedEventId] = useState('');
  const [showCreateSection, setShowCreateSection] = useState(false);

  // Create Work Event Form State
  const [createResidentId, setCreateResidentId] = useState('');
  const [createTypeId, setCreateTypeId] = useState('');
  const [classification, setClassification] = useState<PlannedClassification>('PLANNED');
  const [quantity, setQuantity] = useState('1');
  const [note, setNote] = useState('');

  // Dynamic Specific Clinical Parameters State
  const [sysBP, setSysBP] = useState('120');
  const [diaBP, setDiaBP] = useState('80');
  const [heartRate, setHeartRate] = useState('75');
  const [temp, setTemp] = useState('36.8');
  const [spo2, setSpo2] = useState('98');
  const [respRate, setRespRate] = useState('18');
  const [bloodGlucose, setBloodGlucose] = useState('');

  const [medName, setMedName] = useState('');
  const [medDose, setMedDose] = useState('');
  const [medStatus, setMedStatus] = useState('FULL');

  const [excretionType, setExcretionType] = useState('NORMAL');
  const [diaperCount, setDiaperCount] = useState('1');
  const [hygieneNote, setHygieneNote] = useState('');

  const [woundLocation, setWoundLocation] = useState('');
  const [woundCondition, setWoundCondition] = useState('HEALING');
  const [dressingUsed, setDressingUsed] = useState('');

  const [mealIntake, setMealIntake] = useState('100%');
  const [fluidIntake, setFluidIntake] = useState('');

  const [durationMin, setDurationMin] = useState('15');
  const [rehabResponse, setRehabResponse] = useState('EXCELLENT');

  // Amend & Void Form State
  const [amendQuantity, setAmendQuantity] = useState('');
  const [amendNote, setAmendNote] = useState('');
  const [voidReason, setVoidReason] = useState('');
  const [actionError, setActionError] = useState('');

  // 1. Fetch Events List
  const eventsQuery = useQuery({
    queryKey: [
      'operational-work-events',
      actor?.actorId ?? 'anonymous',
      actor?.actorRole ?? 'none',
      residentId,
      typeId,
      performedBy,
      status,
      sourceDomain,
      limit,
    ],
    queryFn: () =>
      listWorkEvents(actor!, {
        residentId: residentId || undefined,
        workEventTypeId: typeId || undefined,
        performedBy: performedBy.trim() || undefined,
        status,
        sourceDomain: sourceDomain.trim() || undefined,
        limit,
      }),
    enabled: Boolean(actor),
  });

  // 2. Fetch Event Types
  const typesQuery = useQuery({
    queryKey: [
      'operational-work-event-types',
      actor?.actorId ?? 'anonymous',
      actor?.actorRole ?? 'none',
    ],
    queryFn: () => listWorkEventTypes(actor!, 100),
    enabled: Boolean(actor),
  });

  // 3. Fetch Residents List
  const residentsQuery = useQuery({
    queryKey: [
      'operations-residents',
      actor?.actorId ?? 'anonymous',
      actor?.actorRole ?? 'none',
    ],
    queryFn: () => listResidents(actor),
    enabled: Boolean(actor),
  });

  // 4. Fetch 360° Comprehensive Care Overview when a Resident is Selected
  const residentOverviewQuery = useQuery<ResidentIntegrationOverview>({
    queryKey: ['resident-integration-overview', residentId, actor?.actorId],
    queryFn: () => fetchResidentIntegrationOverview(actor, residentId),
    enabled: Boolean(actor) && Boolean(residentId),
  });

  // 5. Fetch Event Detail
  const detailQuery = useQuery({
    queryKey: [
      'operational-work-event-detail',
      actor?.actorId ?? 'anonymous',
      actor?.actorRole ?? 'none',
      selectedEventId,
    ],
    queryFn: () => getWorkEvent(actor!, selectedEventId),
    enabled: Boolean(actor) && Boolean(selectedEventId),
  });

  const canGovern =
    actor?.actorRole === 'CARE_MANAGER' ||
    actor?.actorRole === 'SUPERVISOR';

  const allAvailableTypes = useMemo(() => {
    const fromApi = typesQuery.data?.items ?? [];
    const map = new Map<string, WorkEventType>();

    for (const item of POPULAR_WORK_EVENT_TYPES) {
      map.set(item.code, item);
      map.set(item.work_event_type_id, item);
    }

    for (const item of fromApi) {
      map.set(item.code, item);
      map.set(item.work_event_type_id, item);
    }

    const unique = new Map<string, WorkEventType>();
    for (const item of map.values()) {
      unique.set(item.code, item);
    }
    return Array.from(unique.values());
  }, [typesQuery.data]);

  const typeById = useMemo(() => {
    const map = new Map<string, WorkEventType>();
    for (const item of allAvailableTypes) {
      map.set(item.work_event_type_id, item);
      map.set(item.code, item);
    }
    return map;
  }, [allAvailableTypes]);

  const residentById = useMemo(() => {
    const map = new Map<string, any>();
    for (const item of (residentsQuery.data ?? [])) {
      const res = item.resident;
      if (res.residentId) {
        map.set(res.residentId, res);
        map.set(res.residentId.toLowerCase(), res);
      }
      if (res.residentCode) {
        map.set(res.residentCode, res);
        map.set(res.residentCode.toLowerCase(), res);
      }
    }
    return map;
  }, [residentsQuery.data]);

  const selectedResident = useMemo(() => {
    if (!residentId) return null;
    return residentById.get(residentId) || null;
  }, [residentId, residentById]);

  const manualTypes = useMemo(
    () =>
      allAvailableTypes.filter(
        (item) => !PROJECTION_TYPE_CODES.has(item.code),
      ),
    [allAvailableTypes],
  );

  const manualTypesByCategory = useMemo(() => {
    const groups: Record<string, WorkEventType[]> = {};
    for (const type of manualTypes) {
      const cat = type.category || 'OTHER';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(type);
    }
    return groups;
  }, [manualTypes]);

  const selectedCreateType = createTypeId ? typeById.get(createTypeId) : undefined;
  const isOtherType = selectedCreateType?.code === 'OTHER_INCIDENTAL';

  // Client-side Search & Category Filtering
  const filteredEvents = useMemo(() => {
    const items = eventsQuery.data?.items ?? [];
    return items.filter((item) => {
      // Category filter
      if (categoryFilter) {
        const type = typeById.get(item.work_event_type_id);
        if (type?.category !== categoryFilter) return false;
      }

      // Keyword search
      if (!searchKeyword.trim()) return true;
      const q = searchKeyword.toLowerCase().trim();
      const resident = item.resident_id ? residentById.get(item.resident_id) : undefined;
      const type = typeById.get(item.work_event_type_id);

      const residentName = resident?.displayName?.toLowerCase() || '';
      const residentCode = resident?.residentCode?.toLowerCase() || '';
      const typeName = type?.display_name_vi?.toLowerCase() || '';
      const typeCode = type?.code?.toLowerCase() || '';
      const note = item.note?.toLowerCase() || '';
      const performedBy = item.performed_by?.toLowerCase() || '';
      const role = item.performed_by_role?.toLowerCase() || '';
      const domain = item.source_domain?.toLowerCase() || '';

      return (
        residentName.includes(q) ||
        residentCode.includes(q) ||
        typeName.includes(q) ||
        typeCode.includes(q) ||
        note.includes(q) ||
        performedBy.includes(q) ||
        role.includes(q) ||
        domain.includes(q)
      );
    });
  }, [eventsQuery.data?.items, categoryFilter, searchKeyword, typeById, residentById]);

  const renderDynamicClinicalFields = (code: string) => {
    if (code === 'VITAL_SIGNS_CHECK') {
      return (
        <div style={{ gridColumn: '1 / -1', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '0.5rem', padding: '1rem', marginTop: '0.25rem', marginBottom: '0.5rem' }}>
          <div style={{ fontWeight: 700, color: '#166534', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span>🩺</span> Nhập Chỉ Số Dấu Hiệu Sinh Tồn & Huyết Áp Chi Tiết (Chuẩn Y Khoa)
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '0.2rem' }}>Huyết áp (mmHg) *</label>
              <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
                <input type="number" placeholder="Tâm thu (120)" className="text-input" value={sysBP} onChange={(e) => setSysBP(e.target.value)} style={{ width: '50%' }} />
                <span>/</span>
                <input type="number" placeholder="Tâm trương (80)" className="text-input" value={diaBP} onChange={(e) => setDiaBP(e.target.value)} style={{ width: '50%' }} />
              </div>
            </div>

            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '0.2rem' }}>Mạch / Nhịp tim (lần/phút) *</label>
              <input type="number" placeholder="75" className="text-input" value={heartRate} onChange={(e) => setHeartRate(e.target.value)} />
            </div>

            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '0.2rem' }}>Thân nhiệt (°C) *</label>
              <input type="number" step="0.1" placeholder="36.8" className="text-input" value={temp} onChange={(e) => setTemp(e.target.value)} />
            </div>

            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '0.2rem' }}>Nồng độ SpO2 (%) *</label>
              <input type="number" placeholder="98" className="text-input" value={spo2} onChange={(e) => setSpo2(e.target.value)} />
            </div>

            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '0.2rem' }}>Nhịp thở (lần/phút)</label>
              <input type="number" placeholder="18" className="text-input" value={respRate} onChange={(e) => setRespRate(e.target.value)} />
            </div>

            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '0.2rem' }}>Đường huyết (mmol/L - nếu có)</label>
              <input type="number" step="0.1" placeholder="5.6" className="text-input" value={bloodGlucose} onChange={(e) => setBloodGlucose(e.target.value)} />
            </div>
          </div>
        </div>
      );
    }

    if (code === 'MEDICATION_ADMINISTRATION') {
      return (
        <div style={{ gridColumn: '1 / -1', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '0.5rem', padding: '1rem', marginTop: '0.25rem', marginBottom: '0.5rem' }}>
          <div style={{ fontWeight: 700, color: '#1e40af', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span>💊</span> Chi Tiết Cấp Phát & Uống Thuốc eMAR
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '0.2rem' }}>Tên thuốc / Y lệnh *</label>
              <input type="text" placeholder="Ví dụ: Amlodipine 5mg" className="text-input" value={medName} onChange={(e) => setMedName(e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '0.2rem' }}>Liều lượng dùng *</label>
              <input type="text" placeholder="Ví dụ: 1 viên sau ăn sáng" className="text-input" value={medDose} onChange={(e) => setMedDose(e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '0.2rem' }}>Trạng thái cấp phát *</label>
              <select className="text-input" value={medStatus} onChange={(e) => setMedStatus(e.target.value)}>
                <option value="FULL">✅ Đã uống đủ (Quy tắc 5 Đúng)</option>
                <option value="PARTIAL">⚠️ Uống một phần</option>
                <option value="REFUSED">❌ Người cao tuổi từ chối uống</option>
                <option value="POSTPONED">⏸️ Tạm hoãn theo chỉ định y bác sĩ</option>
              </select>
            </div>
          </div>
        </div>
      );
    }

    if (code === 'DIAPER_TOILETING' || code === 'HYGIENE_BATHING') {
      return (
        <div style={{ gridColumn: '1 / -1', background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '0.5rem', padding: '1rem', marginTop: '0.25rem', marginBottom: '0.5rem' }}>
          <div style={{ fontWeight: 700, color: '#c2410c', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span>🧼</span> Ghi Nhận Chi Tiết Vệ Sinh Thân Thể & Bài Tiết
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '0.2rem' }}>Loại bài tiết</label>
              <select className="text-input" value={excretionType} onChange={(e) => setExcretionType(e.target.value)}>
                <option value="NORMAL">Bình thường / Tắm rửa sinh hoạt</option>
                <option value="URINE">Tiểu tiện</option>
                <option value="STOOL">Đại tiện</option>
                <option value="BOTH">Cả đại tiện & tiểu tiện</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '0.2rem' }}>Số lượng tã bỉm đã dùng (cái)</label>
              <input type="number" min="0" placeholder="1" className="text-input" value={diaperCount} onChange={(e) => setDiaperCount(e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '0.2rem' }}>Ghi nhận tính chất / da</label>
              <input type="text" placeholder="Phân mềm, vùng mông da khô thoáng không tấy..." className="text-input" value={hygieneNote} onChange={(e) => setHygieneNote(e.target.value)} />
            </div>
          </div>
        </div>
      );
    }

    if (code === 'WOUND_CARE') {
      return (
        <div style={{ gridColumn: '1 / -1', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '0.5rem', padding: '1rem', marginTop: '0.25rem', marginBottom: '0.5rem' }}>
          <div style={{ fontWeight: 700, color: '#b91c1c', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span>🩹</span> Thông Số Chăm Sóc Vết Thương & Vết Loét Tì Đè
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '0.2rem' }}>Vị trí vết thương *</label>
              <input type="text" placeholder="Ví dụ: Vùng xương cùng / Gót chân T" className="text-input" value={woundLocation} onChange={(e) => setWoundLocation(e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '0.2rem' }}>Mức độ / Tình trạng vết thương *</label>
              <select className="text-input" value={woundCondition} onChange={(e) => setWoundCondition(e.target.value)}>
                <option value="HEALING">🟢 Đang khô lành tốt (Không tiết dịch)</option>
                <option value="REDNESS">🟡 Đỏ sưng nhẹ xung quanh</option>
                <option value="EXUDATE">🟠 Có dịch tiết vừa</option>
                <option value="INFECTED">🔴 Mưng mủ / Dấu hiệu nhiễm trùng (Cần báo bác sĩ)</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '0.2rem' }}>Vật tư & Băng gạc sử dụng</label>
              <input type="text" placeholder="Ví dụ: Gạc tiệt trùng + Povidone 10%" className="text-input" value={dressingUsed} onChange={(e) => setDressingUsed(e.target.value)} />
            </div>
          </div>
        </div>
      );
    }

    if (code === 'MEAL_ASSISTANCE' || code === 'TUBE_FEEDING_ASSIST') {
      return (
        <div style={{ gridColumn: '1 / -1', background: '#fdf4ff', border: '1px solid #f5d0fe', borderRadius: '0.5rem', padding: '1rem', marginTop: '0.25rem', marginBottom: '0.5rem' }}>
          <div style={{ fontWeight: 700, color: '#86198f', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span>🥣</span> Thông Số Theo Dõi Khẩu Phần Bữa Ăn & Dịch Uống
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '0.2rem' }}>Mức độ ăn hết suất *</label>
              <select className="text-input" value={mealIntake} onChange={(e) => setMealIntake(e.target.value)}>
                <option value="100%">🟢 100% (Ăn hết suất)</option>
                <option value="75%">🔵 75% (Ăn hầu hết)</option>
                <option value="50%">🟡 50% (Ăn một nửa)</option>
                <option value="25%">🟠 25% (Ăn ít)</option>
                <option value="0% (Refused)">🔴 Bỏ bữa / Không ăn</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '0.2rem' }}>Lượng nước / Dịch súp uống thêm (ml)</label>
              <input type="number" placeholder="200" className="text-input" value={fluidIntake} onChange={(e) => setFluidIntake(e.target.value)} />
            </div>
          </div>
        </div>
      );
    }

    if (code === 'REHAB_EXERCISE' || code === 'MOBILITY_ASSISTANCE') {
      return (
        <div style={{ gridColumn: '1 / -1', background: '#faf5ff', border: '1px solid #e9d5ff', borderRadius: '0.5rem', padding: '1rem', marginTop: '0.25rem', marginBottom: '0.5rem' }}>
          <div style={{ fontWeight: 700, color: '#6b21a8', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span>🧘</span> Thông Số Tập VLTL & Phục Hồi Vận Động
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '0.2rem' }}>Thời lượng tập (phút) *</label>
              <input type="number" placeholder="15" className="text-input" value={durationMin} onChange={(e) => setDurationMin(e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '0.2rem' }}>Khả năng đáp ứng của cụ *</label>
              <select className="text-input" value={rehabResponse} onChange={(e) => setRehabResponse(e.target.value)}>
                <option value="EXCELLENT">🟢 Hợp tác tốt / Hoàn thành bài tập</option>
                <option value="TIRED">🟡 Mệt mỏi nhẹ / Cần nghỉ ngơi giữa chừng</option>
                <option value="PAIN">🔴 Kêu đau khớp / Dừng tập sớm</option>
              </select>
            </div>
          </div>
        </div>
      );
    }

    return null;
  };

  async function refreshEvents() {
    await queryClient.invalidateQueries({
      queryKey: ['operational-work-events'],
    });

    if (residentId) {
      await queryClient.invalidateQueries({
        queryKey: ['resident-integration-overview', residentId],
      });
    }

    if (selectedEventId) {
      await queryClient.invalidateQueries({
        queryKey: ['operational-work-event-detail'],
      });
    }
  }

  function clearFilters() {
    setResidentId('');
    setTypeId('');
    setCategoryFilter('');
    setPerformedBy('');
    setStatus('');
    setSearchKeyword('');
    setSourceDomain('');
    setLimit(100);
  }

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!actor) {
        throw new Error('Chưa xác định người thực hiện.');
      }

      if (!createTypeId) {
        throw new Error('Vui lòng chọn loại công việc.');
      }

      const selectedType = typeById.get(createTypeId);

      if (
        selectedType &&
        PROJECTION_TYPE_CODES.has(selectedType.code)
      ) {
        throw new Error(
          'Loại công việc này được hệ thống ghi nhận tự động từ nghiệp vụ nguồn.',
        );
      }

      if (!createResidentId) {
        throw new Error('Vui lòng chọn Người cao tuổi thực hiện chăm sóc.');
      }

      if (selectedType?.code === 'OTHER_INCIDENTAL' && !note.trim()) {
        throw new Error(
          'Vui lòng nhập diễn giải chi tiết cho loại công việc "Khác" vào ô Ghi chú bên dưới.',
        );
      }

      const numericQuantity = Number(quantity);

      if (!Number.isFinite(numericQuantity) || numericQuantity <= 0) {
        throw new Error('Số lượng phải lớn hơn 0.');
      }

      let formattedAutoNote = note.trim();
      let metricsPayload: Record<string, any> = {};

      const code = selectedType?.code;

      if (code === 'VITAL_SIGNS_CHECK') {
        const sys = Number(sysBP) || 120;
        const dia = Number(diaBP) || 80;
        const hr = Number(heartRate) || 75;
        const tp = Number(temp) || 36.8;
        const sp = Number(spo2) || 98;
        const resp = Number(respRate) || 18;
        const bg = bloodGlucose.trim() ? Number(bloodGlucose) : undefined;

        metricsPayload = { sysBP: sys, diaBP: dia, heartRate: hr, temp: tp, spo2: sp, respRate: resp, bloodGlucose: bg };
        const vitalsSummary = `📊 Sinh hiệu: HA ${sys}/${dia} mmHg | Mạch ${hr} bpm | Thân nhiệt ${tp}°C | SpO2 ${sp}% | Nhịp thở ${resp} bpm${bg ? ` | GLU ${bg} mmol/L` : ''}`;
        formattedAutoNote = formattedAutoNote ? `${vitalsSummary} — ${formattedAutoNote}` : vitalsSummary;
      } else if (code === 'MEDICATION_ADMINISTRATION') {
        metricsPayload = { medName: medName.trim() || 'Amlodipine 5mg', medDose: medDose.trim() || '1 viên', medStatus };
        const medSummary = `💊 Thuốc: ${metricsPayload.medName} (${metricsPayload.medDose}) | Trạng thái: ${medStatus === 'FULL' ? 'Đã uống đủ 5 Đúng' : medStatus === 'REFUSED' ? 'Từ chối uống' : 'Uống 1 phần'}`;
        formattedAutoNote = formattedAutoNote ? `${medSummary} — ${formattedAutoNote}` : medSummary;
      } else if (code === 'HYGIENE_BATHING' || code === 'DIAPER_TOILETING') {
        metricsPayload = { excretionType, diaperCount: Number(diaperCount) || 1, hygieneNote: hygieneNote.trim() };
        const hygieneSummary = `🧼 Vệ sinh / Bài tiết: ${excretionType === 'NORMAL' ? 'Bình thường' : excretionType === 'BOTH' ? 'Đại & Tiểu tiện' : excretionType} | Dùng ${diaperCount} tã bỉm${hygieneNote ? ` | Ghi nhận: ${hygieneNote}` : ''}`;
        formattedAutoNote = formattedAutoNote ? `${hygieneSummary} — ${formattedAutoNote}` : hygieneSummary;
      } else if (code === 'WOUND_CARE') {
        metricsPayload = { woundLocation: woundLocation.trim() || 'Vùng tì đè', woundCondition, dressingUsed: dressingUsed.trim() };
        const woundSummary = `🩹 Chăm sóc vết thương: ${metricsPayload.woundLocation} | Tình trạng: ${woundCondition === 'HEALING' ? 'Đang khô lành tốt' : woundCondition === 'REDNESS' ? 'Đỏ sưng nhẹ' : woundCondition}${dressingUsed ? ` | Băng gạc: ${dressingUsed}` : ''}`;
        formattedAutoNote = formattedAutoNote ? `${woundSummary} — ${formattedAutoNote}` : woundSummary;
      } else if (code === 'MEAL_ASSISTANCE' || code === 'TUBE_FEEDING_ASSIST') {
        metricsPayload = { mealIntake, fluidIntake: fluidIntake.trim() };
        const mealSummary = `🥣 Bữa ăn: ${mealIntake}${fluidIntake ? ` | Dịch uống: ${fluidIntake} ml` : ''}`;
        formattedAutoNote = formattedAutoNote ? `${mealSummary} — ${formattedAutoNote}` : mealSummary;
      } else if (code === 'REHAB_EXERCISE' || code === 'MOBILITY_ASSISTANCE') {
        metricsPayload = { durationMin: Number(durationMin) || 15, rehabResponse };
        const rehabSummary = `🧘 VLTL & Vận động: ${durationMin} phút | Khả năng đáp ứng: ${rehabResponse === 'EXCELLENT' ? 'Đáp ứng tốt' : rehabResponse === 'TIRED' ? 'Mệt mỏi nhẹ' : 'Kêu đau'}`;
        formattedAutoNote = formattedAutoNote ? `${rehabSummary} — ${formattedAutoNote}` : rehabSummary;
      }

      return createWorkEvent(actor, {
        residentId: createResidentId,
        workEventTypeId: createTypeId,
        sourceDomain: 'MANUAL_OPERATION',
        plannedClassification: classification,
        quantity: numericQuantity,
        note: formattedAutoNote,
        status: 'RECORDED',
        metrics: metricsPayload,
      });
    },
    onSuccess: async (event) => {
      setActionError('');
      setNote('');
      setSelectedEventId(event.work_event_id);
      setShowCreateSection(false);
      await refreshEvents();
      queryClient.invalidateQueries({ queryKey: ['resident-integration-overview'] });
      alert('Đã ghi nhận công việc vận hành chăm sóc và đồng bộ dữ liệu sức khỏe thành công!');
    },
    onError: (error) => setActionError(errorText(error)),
  });

  const lifecycleMutation = useMutation({
    mutationFn: async ({
      action,
      id,
    }: {
      action: 'VERIFY' | 'AMEND' | 'VOID';
      id: string;
    }) => {
      if (!actor) {
        throw new Error('Chưa xác định người thực hiện.');
      }

      if (action === 'VERIFY') {
        return verifyWorkEvent(actor, id);
      }

      if (action === 'AMEND') {
        const payload: { quantity?: number; note?: string } = {};

        if (amendQuantity.trim() !== '') {
          const nextQuantity = Number(amendQuantity);
          if (!Number.isFinite(nextQuantity) || nextQuantity <= 0) {
            throw new Error('Số lượng điều chỉnh phải lớn hơn 0.');
          }
          payload.quantity = nextQuantity;
        }

        if (amendNote.trim()) {
          payload.note = amendNote.trim();
        }

        if (payload.quantity === undefined && payload.note === undefined) {
          throw new Error('Nhập ít nhất số lượng hoặc ghi chú cần điều chỉnh.');
        }

        return amendWorkEvent(actor, id, payload);
      }

      if (!voidReason.trim()) {
        throw new Error('Cần nhập lý do vô hiệu.');
      }

      return voidWorkEvent(actor, id, voidReason.trim());
    },
    onSuccess: async () => {
      setActionError('');
      setAmendQuantity('');
      setAmendNote('');
      setVoidReason('');
      await refreshEvents();
      alert('Đã cập nhật trạng thái công việc thành công!');
    },
    onError: (error) => setActionError(errorText(error)),
  });

  if (!actor) {
    return (
      <ErrorState
        title="Chưa xác định người dùng"
        description="Cần có chủ thể con người hợp lệ để truy cập công việc vận hành."
      />
    );
  }

  const overviewData = residentOverviewQuery.data;

  return (
    <>
      <header className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div className="eyebrow">Vận hành chăm sóc & Giám sát điều hành</div>
            <h1 className="page-title">Nhật Ký & Bằng Chứng Vận Hành Chăm Sóc</h1>
            <p className="page-description">
              Theo dõi và rà soát toàn bộ các hoạt động chăm sóc, y tế, sinh hiệu, dùng thuốc eMAR và phục hồi chức năng của Người cao tuổi tại Tâm An.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                if (residentId) setCreateResidentId(residentId);
                setShowCreateSection(!showCreateSection);
              }}
            >
              {showCreateSection ? '✕ Đóng form ghi nhận' : '📝 + Ghi nhận công việc chăm sóc'}
            </button>
          </div>
        </div>
      </header>

      {/* Top KPI Summary */}
      <div className="kpi-grid">
        <div className="kpi-box">
          <div className="kpi-title">Công việc tìm thấy</div>
          <div className="kpi-number" style={{ color: '#2563eb' }}>{filteredEvents.length}</div>
          <div className="kpi-desc">
            {residentId ? `Dành riêng cho cụ đang chọn` : `Khớp theo bộ lọc hiện tại`}
          </div>
        </div>

        <div className="kpi-box">
          <div className="kpi-title">Đã xác minh kiểm toán</div>
          <div className="kpi-number" style={{ color: '#16a34a' }}>
            {filteredEvents.filter(e => e.status === 'VERIFIED' || e.status === 'COMPLETED').length}
          </div>
          <div className="kpi-desc">Bằng chứng y khoa hợp lệ</div>
        </div>

        <div className="kpi-box">
          <div className="kpi-title">Người cao tuổi đang chọn</div>
          <div className="kpi-number" style={{ color: selectedResident ? '#7c3aed' : '#64748b', fontSize: selectedResident ? '1.25rem' : '1.8rem' }}>
            {selectedResident ? selectedResident.displayName : 'Tất cả'}
          </div>
          <div className="kpi-desc">
            {selectedResident ? `Mã: ${selectedResident.residentCode} — ${selectedResident.room || 'Chưa xếp phòng'}` : 'Toàn bộ người cao tuổi'}
          </div>
        </div>

        <div className="kpi-box">
          <div className="kpi-title">Quy chuẩn công việc</div>
          <div className="kpi-number" style={{ color: '#0d9488' }}>{allAvailableTypes.length}</div>
          <div className="kpi-desc">Danh mục quy trình chuẩn</div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 🔍 BỘ LỌC VÀ TÌM KIẾM ĐA CHIỀU */}
      {/* ========================================================================= */}
      <section className="filter-toolbar" style={{ background: '#f8fafc', padding: '1.25rem', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.1rem', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span>🔍</span> <b>Bộ Lọc & Tìm Kiếm Công Việc Chăm Sóc</b>
          </h2>
          {residentId && (
            <span className="badge badge-success" style={{ fontSize: '0.85rem' }}>
              🎯 Đang theo dõi hồ sơ của: <b>{selectedResident?.displayName}</b>
            </span>
          )}
        </div>

        {/* Search Input Bar */}
        <div style={{ marginBottom: '1rem' }}>
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              className="text-input"
              style={{ width: '100%', paddingLeft: '2.5rem', fontSize: '1rem', height: '42px', borderRadius: '6px' }}
              placeholder="🔍 Tìm kiếm nhanh theo tên công việc, ghi chú, mã nhân viên, người thực hiện..."
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
            />
            <span style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}>
              🔍
            </span>
          </div>
        </div>

        {/* Filter Controls Grid */}
        <div className="operations-filter-grid">
          <label className="field-group">
            <span className="field-label" style={{ fontWeight: 600, color: '#1e293b' }}>
              👤 Người cao tuổi
            </span>
            <select
              className="text-input"
              value={residentId}
              onChange={(event) => {
                const val = event.target.value;
                setResidentId(val);
                if (val) setCreateResidentId(val);
              }}
              style={residentId ? { borderColor: '#2563eb', backgroundColor: '#eff6ff', fontWeight: 600 } : undefined}
            >
              <option value="">-- Tất cả Người cao tuổi ({residentsQuery.data?.length ?? 0}) --</option>
              {(residentsQuery.data ?? []).map(({ resident }) => (
                <option key={resident.residentId} value={resident.residentId}>
                  {resident.displayName} — {resident.residentCode} ({resident.room ? `Phòng ${resident.room}` : 'Chưa xếp phòng'})
                </option>
              ))}
            </select>
          </label>

          <label className="field-group">
            <span className="field-label">Khối chuyên mục</span>
            <select
              className="text-input"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="">Tất cả chuyên mục</option>
              {Object.entries(CATEGORY_LABELS).map(([catKey, catName]) => (
                <option key={catKey} value={catKey}>
                  {catName}
                </option>
              ))}
            </select>
          </label>

          <label className="field-group">
            <span className="field-label">Loại công việc cụ thể</span>
            <select
              className="text-input"
              value={typeId}
              onChange={(event) => setTypeId(event.target.value)}
            >
              <option value="">Tất cả loại công việc</option>
              {Object.entries(manualTypesByCategory).map(([catKey, typesInCat]) => (
                <optgroup key={catKey} label={CATEGORY_LABELS[catKey] || catKey}>
                  {typesInCat.map((type) => (
                    <option key={type.work_event_type_id} value={type.work_event_type_id}>
                      {type.display_name_vi}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>

          <label className="field-group">
            <span className="field-label">Trạng thái</span>
            <select
              className="text-input"
              value={status}
              onChange={(event) => setStatus(event.target.value as WorkEventStatus | '')}
            >
              <option value="">Tất cả trạng thái</option>
              {Object.entries(STATUS_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <label className="field-group">
            <span className="field-label">Người thực hiện</span>
            <input
              className="text-input"
              value={performedBy}
              placeholder="Tên / Mã nhân viên"
              onChange={(event) => setPerformedBy(event.target.value)}
            />
          </label>

          <label className="field-group">
            <span className="field-label">Số bản ghi tối đa</span>
            <select
              className="text-input"
              value={limit}
              onChange={(event) => setLimit(Number(event.target.value))}
            >
              <option value={25}>25 bản ghi</option>
              <option value={50}>50 bản ghi</option>
              <option value={100}>100 bản ghi</option>
              <option value={200}>200 bản ghi</option>
            </select>
          </label>
        </div>

        <div className="operations-actions" style={{ marginTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
            Tìm thấy <b>{filteredEvents.length}</b> hoạt động phù hợp
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              className="secondary-button"
              onClick={clearFilters}
            >
              ✕ Xóa bộ lọc
            </button>

            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                eventsQuery.refetch();
                if (residentId) residentOverviewQuery.refetch();
              }}
            >
              🔄 Làm mới dữ liệu
            </button>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 🌟 HỒ SƠ TOÀN DIỆN 360° KHI CHỌN MỘT NGƯỜI CAO TUỔI */}
      {/* ========================================================================= */}
      {selectedResident && (
        <section className="card" style={{ border: '2px solid #3b82f6', borderRadius: '10px', padding: '1.25rem', marginBottom: '1.75rem', background: '#ffffff', boxShadow: '0 4px 12px rgba(59, 130, 246, 0.08)' }}>
          {/* Header of Selected Resident */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '1rem', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '50%', backgroundColor: '#2563eb', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', fontWeight: 700 }}>
                {selectedResident.displayName.charAt(0)}
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <h2 style={{ margin: 0, fontSize: '1.35rem', color: '#1e293b' }}>
                    {selectedResident.displayName}
                  </h2>
                  <span className="badge badge-info" style={{ fontWeight: 600 }}>
                    Mã: {selectedResident.residentCode}
                  </span>
                  <span className="badge badge-success">
                    {selectedResident.careLevel || 'Chăm sóc Tiêu chuẩn'}
                  </span>
                </div>
                <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.25rem' }}>
                  📍 {selectedResident.room ? `Phòng ${selectedResident.room}` : 'Chưa xếp phòng'} {selectedResident.bed ? `— Giường ${selectedResident.bed}` : ''} |
                  🎂 Ngày sinh: {selectedResident.dateOfBirth ? new Date(selectedResident.dateOfBirth).toLocaleDateString('vi-VN') : '—'} |
                  ⚥ Giới tính: {selectedResident.gender === 'MALE' ? 'Nam' : selectedResident.gender === 'FEMALE' ? 'Nữ' : 'Khác'}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="button"
                className="btn btn-sm btn-primary"
                onClick={() => {
                  setCreateResidentId(selectedResident.residentId);
                  setShowCreateSection(true);
                }}
              >
                + Ghi nhận công việc cho cụ
              </button>
              <button
                type="button"
                className="btn btn-sm btn-secondary"
                onClick={() => setResidentId('')}
                title="Đóng chế độ theo dõi riêng của cụ này"
              >
                ✕ Xem tất cả
              </button>
            </div>
          </div>

          {/* Quick Care Metric Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
            <div style={{ background: '#eff6ff', padding: '0.75rem', borderRadius: '8px', border: '1px solid #bfdbfe' }}>
              <div style={{ fontSize: '0.8rem', color: '#1e40af', fontWeight: 600 }}>🩺 Sinh hiệu đo gần nhất</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1e3a8a', marginTop: '0.2rem' }}>
                {overviewData?.clinicalObservations?.items?.[0] ? `${overviewData.clinicalObservations.items[0].value_numeric || overviewData.clinicalObservations.items[0].value_text} ${overviewData.clinicalObservations.items[0].unit || ''}` : 'Chưa có'}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#3b82f6' }}>
                {overviewData?.clinicalObservations?.items?.length || 0} lần ghi nhận
              </div>
            </div>

            <div style={{ background: '#f0fdf4', padding: '0.75rem', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
              <div style={{ fontSize: '0.8rem', color: '#166534', fontWeight: 600 }}>💊 Đơn thuốc & eMAR</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#14532d', marginTop: '0.2rem' }}>
                {overviewData?.medicationOrders?.items?.length || 0} loại thuốc
              </div>
              <div style={{ fontSize: '0.75rem', color: '#16a34a' }}>
                {overviewData?.medicationAdministrations?.items?.length || 0} cữ uống đã lên lịch
              </div>
            </div>

            <div style={{ background: '#fefce8', padding: '0.75rem', borderRadius: '8px', border: '1px solid #fef08a' }}>
              <div style={{ fontSize: '0.8rem', color: '#854d0e', fontWeight: 600 }}>📋 Nhiệm vụ chăm sóc</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#713f12', marginTop: '0.2rem' }}>
                {overviewData?.careTasks?.items?.length || 0} nhiệm vụ
              </div>
              <div style={{ fontSize: '0.75rem', color: '#ca8a04' }}>
                Theo kế hoạch phân công
              </div>
            </div>

            <div style={{ background: '#faf5ff', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e9d5ff' }}>
              <div style={{ fontSize: '0.8rem', color: '#6b21a8', fontWeight: 600 }}>📝 Công việc đã hoàn tất</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#581c87', marginTop: '0.2rem' }}>
                {filteredEvents.length} lượt
              </div>
              <div style={{ fontSize: '0.75rem', color: '#9333ea' }}>
                Bằng chứng điều dưỡng ghi nhận
              </div>
            </div>
          </div>

          {/* Sub-Tabs for 360° Resident Care View */}
          <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '2px solid #e2e8f0', marginBottom: '1rem', overflowX: 'auto' }}>
            <button
              type="button"
              onClick={() => setResidentActiveTab('VITALS')}
              className={`btn btn-sm ${residentActiveTab === 'VITALS' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ borderRadius: '6px 6px 0 0', fontWeight: 600 }}
            >
              🩺 Sinh Hiệu & Lâm Sàng ({overviewData?.clinicalObservations?.items?.length || 0})
            </button>
            <button
              type="button"
              onClick={() => setResidentActiveTab('MEDS')}
              className={`btn btn-sm ${residentActiveTab === 'MEDS' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ borderRadius: '6px 6px 0 0', fontWeight: 600 }}
            >
              💊 Đơn Thuốc & eMAR ({overviewData?.medicationOrders?.items?.length || 0})
            </button>
            <button
              type="button"
              onClick={() => setResidentActiveTab('TASKS')}
              className={`btn btn-sm ${residentActiveTab === 'TASKS' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ borderRadius: '6px 6px 0 0', fontWeight: 600 }}
            >
              📋 Nhiệm Vụ Chăm Sóc ({overviewData?.careTasks?.items?.length || 0})
            </button>
            <button
              type="button"
              onClick={() => setResidentActiveTab('EVENTS')}
              className={`btn btn-sm ${residentActiveTab === 'EVENTS' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ borderRadius: '6px 6px 0 0', fontWeight: 600 }}
            >
              📝 Bằng Chứng Vận Hành ({filteredEvents.length})
            </button>
            <button
              type="button"
              onClick={() => setResidentActiveTab('INCIDENTS')}
              className={`btn btn-sm ${residentActiveTab === 'INCIDENTS' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ borderRadius: '6px 6px 0 0', fontWeight: 600 }}
            >
              ⚠️ Cảnh Báo & Sự Cố ({overviewData?.incidents?.items?.length || 0})
            </button>
          </div>

          {/* Sub-Tab 1: Sinh Hiệu */}
          {residentActiveTab === 'VITALS' && (
            <div>
              {(!overviewData?.clinicalObservations?.items || overviewData.clinicalObservations.items.length === 0) ? (
                <div style={{ padding: '1.5rem', textAlign: 'center', color: '#64748b', background: '#f8fafc', borderRadius: '6px' }}>
                  Chưa có dữ liệu sinh hiệu gần đây cho người cao tuổi này.
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.75rem' }}>
                  {overviewData.clinicalObservations.items.map((obs) => (
                    <div key={obs.observation_id} style={{ border: '1px solid #e2e8f0', padding: '0.75rem', borderRadius: '6px', background: '#ffffff' }}>
                      <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                        {obs.observation_type || obs.type || 'Chỉ số sinh tồn'}
                      </div>
                      <div style={{ fontSize: '1.35rem', fontWeight: 700, color: '#1e293b', margin: '0.2rem 0' }}>
                        {obs.value_numeric || obs.value_text} <span style={{ fontSize: '0.85rem', fontWeight: 500, color: '#64748b' }}>{obs.unit || ''}</span>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                        🕒 {obs.measured_at || obs.recorded_at ? new Date(obs.measured_at || obs.recorded_at!).toLocaleString('vi-VN') : '—'}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Sub-Tab 2: Đơn thuốc */}
          {residentActiveTab === 'MEDS' && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
                <div>
                  <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.95rem', color: '#1e293b' }}>💊 Đơn thuốc điều trị hiện tại</h4>
                  {(!overviewData?.medicationOrders?.items || overviewData.medicationOrders.items.length === 0) ? (
                    <div style={{ padding: '1rem', color: '#64748b', background: '#f8fafc', borderRadius: '6px' }}>
                      Không có đơn thuốc đang kê.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {overviewData.medicationOrders.items.map((order) => (
                        <div key={order.order_id} style={{ border: '1px solid #e2e8f0', padding: '0.75rem', borderRadius: '6px', background: '#ffffff' }}>
                          <div style={{ fontWeight: 700, color: '#1e293b' }}>{order.medication_name}</div>
                          <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '2px' }}>
                            Liều lượng: <b>{order.dosage || 'Theo chỉ định'}</b> | Đường dùng: {order.route || 'Uống'}
                          </div>
                          <div style={{ fontSize: '0.8rem', color: '#2563eb', marginTop: '2px' }}>
                            Tần suất: {order.frequency || 'Hàng ngày'}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.95rem', color: '#1e293b' }}>🕒 Lịch uống thuốc eMAR gần đây</h4>
                  {(!overviewData?.medicationAdministrations?.items || overviewData.medicationAdministrations.items.length === 0) ? (
                    <div style={{ padding: '1rem', color: '#64748b', background: '#f8fafc', borderRadius: '6px' }}>
                      Chưa có cữ thuốc nào trong ca trực.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {overviewData.medicationAdministrations.items.map((adm) => (
                        <div key={adm.administration_id} style={{ border: '1px solid #e2e8f0', padding: '0.75rem', borderRadius: '6px', background: '#ffffff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <div style={{ fontWeight: 600 }}>{adm.medication_name || 'Thuốc theo toa'}</div>
                            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                              Cữ: {adm.scheduled_at ? new Date(adm.scheduled_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : 'Trong ngày'}
                            </div>
                          </div>
                          <span className={`badge ${adm.status === 'COMPLETED' || adm.status === 'GIVEN' ? 'badge-success' : 'badge-warning'}`}>
                            {adm.status === 'COMPLETED' || adm.status === 'GIVEN' ? 'Đã uống' : 'Chờ uống'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Sub-Tab 3: Nhiệm Vụ Chăm Sóc */}
          {residentActiveTab === 'TASKS' && (
            <div>
              {(!overviewData?.careTasks?.items || overviewData.careTasks.items.length === 0) ? (
                <div style={{ padding: '1.5rem', textAlign: 'center', color: '#64748b', background: '#f8fafc', borderRadius: '6px' }}>
                  Chưa có nhiệm vụ chăm sóc phân công cụ thể.
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.75rem' }}>
                  {overviewData.careTasks.items.map((task) => (
                    <div key={task.care_task_id} style={{ border: '1px solid #e2e8f0', padding: '0.75rem', borderRadius: '6px', background: '#ffffff' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ fontWeight: 600, color: '#1e293b' }}>{task.title || task.task_name || 'Nhiệm vụ chăm sóc'}</div>
                        <span className={`badge ${task.status === 'COMPLETED' ? 'badge-success' : task.status === 'IN_PROGRESS' ? 'badge-warning' : 'badge-info'}`}>
                          {task.status === 'COMPLETED' ? 'Đã xong' : task.status === 'IN_PROGRESS' ? 'Đang làm' : 'Chờ làm'}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.25rem' }}>
                        Chuyên mục: {task.category || 'Chăm sóc sinh hoạt'}
                      </div>
                      {task.notes && (
                        <div style={{ fontSize: '0.75rem', color: '#475569', marginTop: '0.25rem', fontStyle: 'italic' }}>
                          {task.notes}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Sub-Tab 4: Bằng Chứng Vận Hành */}
          {residentActiveTab === 'EVENTS' && (
            <div>
              <div style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '0.5rem' }}>
                Hiển thị <b>{filteredEvents.length}</b> công việc điều dưỡng/chăm sóc viên đã thực hiện cho cụ <b>{selectedResident.displayName}</b>:
              </div>
              <div className="operations-table-wrap">
                <table className="operations-table">
                  <thead>
                    <tr>
                      <th>Thời điểm</th>
                      <th>Công việc thực hiện</th>
                      <th>Người làm & Vai trò</th>
                      <th>Khối lượng</th>
                      <th>Ghi chú</th>
                      <th>Trạng thái</th>
                      <th>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEvents.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ textAlign: 'center', padding: '1.5rem', color: '#64748b' }}>
                          Chưa có công việc nào được ghi nhận cho người cao tuổi này.
                        </td>
                      </tr>
                    ) : (
                      filteredEvents.map((item) => {
                        const type = typeById.get(item.work_event_type_id);
                        return (
                          <tr key={item.work_event_id}>
                            <td>{new Date(item.occurred_at).toLocaleString('vi-VN')}</td>
                            <td>
                              <b>{type?.display_name_vi || item.work_event_type_id}</b>
                              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{type?.category ? CATEGORY_LABELS[type.category] || type.category : ''}</div>
                            </td>
                            <td>
                              {item.performed_by}
                              <br />
                              <small style={{ color: '#64748b' }}>{item.performed_by_role}</small>
                            </td>
                            <td>{item.quantity} {item.unit}</td>
                            <td>{item.note || '—'}</td>
                            <td>
                              <span className={STATUS_BADGE_CLASS[item.status] || 'badge badge-neutral'}>
                                {STATUS_LABEL[item.status] || item.status}
                              </span>
                            </td>
                            <td>
                              <button
                                type="button"
                                className="btn btn-sm btn-secondary"
                                onClick={() => setSelectedEventId(item.work_event_id)}
                              >
                                Chi tiết
                              </button>
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

          {/* Sub-Tab 5: Cảnh Báo & Sự Cố */}
          {residentActiveTab === 'INCIDENTS' && (
            <div>
              {(!overviewData?.incidents?.items || overviewData.incidents.items.length === 0) ? (
                <div style={{ padding: '1.5rem', textAlign: 'center', color: '#16a34a', background: '#f0fdf4', borderRadius: '6px', fontWeight: 600 }}>
                  ✓ Không có sự cố hoặc cảnh báo nguy hiểm nào được ghi nhận cho người cao tuổi này.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {overviewData.incidents.items.map((inc) => (
                    <div key={inc.incident_id} style={{ border: '1px solid #fecaca', background: '#fff5f5', padding: '0.75rem', borderRadius: '6px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ fontWeight: 700, color: '#b91c1c' }}>⚠️ {inc.incident_type}</div>
                        <span className="badge badge-danger">{inc.severity || 'Cảnh báo'}</span>
                      </div>
                      <div style={{ fontSize: '0.85rem', color: '#450a0a', marginTop: '0.35rem' }}>
                        {inc.description}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#991b1b', marginTop: '0.35rem' }}>
                        Thời gian: {new Date(inc.occurred_at || inc.discovered_at || inc.created_at || '').toLocaleString('vi-VN')}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* ========================================================================= */}
      {/* FORM GHI NHẬN CÔNG VIỆC PHÁT SINH */}
      {/* ========================================================================= */}
      {showCreateSection && (
        <section className="card operations-panel" style={{ marginBottom: '1.5rem', border: '2px solid #2563eb' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 className="section-title" style={{ margin: 0 }}>
              📝 Ghi Nhận Công Việc Chăm Sóc Mới
            </h2>
            <button
              type="button"
              className="btn btn-sm btn-secondary"
              onClick={() => setShowCreateSection(false)}
            >
              ✕ Đóng
            </button>
          </div>

          <p className="page-description">
            Ghi nhận bằng chứng thực hiện công việc chăm sóc cho Người cao tuổi. Hệ thống kiểm soát người thực hiện, vai trò và trọng số công việc.
          </p>

          {actionError && (
            <div className="alert-card alert-danger" style={{ marginBottom: '1rem' }}>
              <span>{actionError}</span>
            </div>
          )}

          <div className="operations-form-grid">
            <label className="field-group">
              <span className="field-label">
                Người cao tuổi <span style={{ color: '#dc2626' }}>*</span>
              </span>
              <select
                className="text-input"
                value={createResidentId}
                onChange={(event) => setCreateResidentId(event.target.value)}
              >
                <option value="">-- Chọn Người cao tuổi --</option>
                {(residentsQuery.data ?? []).map(({ resident }) => (
                  <option key={resident.residentId} value={resident.residentId}>
                    {resident.displayName} — {resident.residentCode}
                  </option>
                ))}
              </select>
            </label>

            <label className="field-group">
              <span className="field-label">
                Loại hình công việc <span style={{ color: '#dc2626' }}>*</span>
              </span>
              <select
                className="text-input"
                value={createTypeId}
                onChange={(event) => setCreateTypeId(event.target.value)}
              >
                <option value="">-- Chọn loại hình công việc --</option>
                {Object.entries(manualTypesByCategory).map(([catKey, typesInCat]) => (
                  <optgroup key={catKey} label={CATEGORY_LABELS[catKey] || catKey}>
                    {typesInCat.map((type) => (
                      <option key={type.work_event_type_id} value={type.work_event_type_id}>
                        {type.display_name_vi}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              {isOtherType && (
                <div style={{ marginTop: '0.35rem', fontSize: '0.82rem', color: '#b45309', fontWeight: 500 }}>
                  ⚠️ Bạn đang chọn <b>"Khác"</b> — Vui lòng diễn giải chi tiết nội dung công việc vào ô <b>Ghi chú</b> bên dưới.
                </div>
              )}
            </label>

            {selectedCreateType && renderDynamicClinicalFields(selectedCreateType.code)}

            <label className="field-group">
              <span className="field-label">Phân loại</span>
              <select
                className="text-input"
                value={classification}
                onChange={(event) => setClassification(event.target.value as PlannedClassification)}
              >
                {Object.entries(PLAN_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <label className="field-group">
              <span className="field-label">Số lượng</span>
              <input
                className="text-input"
                type="number"
                min="0.01"
                step="0.01"
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
              />
            </label>

            <label className="field-group operations-wide-field">
              <span className="field-label">
                Ghi chú {isOtherType && <span style={{ color: '#dc2626', fontWeight: 600 }}>* (Bắt buộc diễn giải cho loại Khác)</span>}
              </span>
              <input
                className="text-input"
                value={note}
                placeholder={
                  isOtherType
                    ? 'Bắt buộc: Diễn giải chi tiết công việc cụ thể đã thực hiện...'
                    : 'Ghi chú thêm diễn giải chi tiết công việc...'
                }
                style={isOtherType ? { borderColor: '#f59e0b', background: '#fffbeb' } : undefined}
                onChange={(event) => setNote(event.target.value)}
              />
            </label>
          </div>

          <div className="operations-actions" style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button
              type="button"
              className="secondary-button"
              onClick={() => setShowCreateSection(false)}
            >
              Hủy
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={createMutation.isPending}
              onClick={() => createMutation.mutate()}
            >
              {createMutation.isPending ? 'Đang lưu...' : '💾 Lưu Ghi Nhận Công Việc'}
            </button>
          </div>
        </section>
      )}

      {/* ========================================================================= */}
      {/* CHI TIẾT BẢN GHI CÔNG VIỆC / MODAL CHI TIẾT & ĐIỀU CHỈNH */}
      {/* ========================================================================= */}
      {selectedEventId && (
        <section className="card operations-panel" style={{ marginBottom: '1.5rem', border: '2px solid #7c3aed' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 className="section-title" style={{ margin: 0, color: '#6d28d9' }}>
              👁️ Chi Tiết Bằng Chứng & Nhật Ký Kiểm Toán
            </h2>
            <button
              type="button"
              className="btn btn-sm btn-secondary"
              onClick={() => setSelectedEventId('')}
            >
              ✕ Đóng chi tiết
            </button>
          </div>

          {detailQuery.isLoading && <LoadingState title="Đang tải chi tiết công việc..." />}

          {detailQuery.isError && (
            <ErrorState
              title="Không thể tải chi tiết công việc"
              description={errorText(detailQuery.error)}
            />
          )}

          {detailQuery.data && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', background: '#f8fafc', padding: '1rem', borderRadius: '8px', marginBottom: '1rem' }}>
                <div>
                  <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Mã công việc</div>
                  <div style={{ fontWeight: 600 }}>{detailQuery.data.work_event_id}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Người cao tuổi</div>
                  <div style={{ fontWeight: 700, color: '#2563eb' }}>
                    {detailQuery.data.resident_id ? residentById.get(detailQuery.data.resident_id)?.displayName || detailQuery.data.resident_id : '—'}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Loại công việc</div>
                  <div style={{ fontWeight: 600 }}>
                    {typeById.get(detailQuery.data.work_event_type_id)?.display_name_vi || detailQuery.data.work_event_type_id}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Người thực hiện</div>
                  <div style={{ fontWeight: 600 }}>
                    {detailQuery.data.performed_by} ({detailQuery.data.performed_by_role})
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Thời gian thực hiện</div>
                  <div>{new Date(detailQuery.data.occurred_at).toLocaleString('vi-VN')}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Khối lượng</div>
                  <div style={{ fontWeight: 600 }}>
                    {detailQuery.data.quantity} {detailQuery.data.unit}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Trạng thái</div>
                  <span className={STATUS_BADGE_CLASS[detailQuery.data.status] || 'badge badge-neutral'}>
                    {STATUS_LABEL[detailQuery.data.status] || detailQuery.data.status}
                  </span>
                </div>
                <div>
                  <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Ghi chú</div>
                  <div>{detailQuery.data.note || '—'}</div>
                </div>
              </div>

              {canGovern && (
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', borderTop: '1px solid #e2e8f0', paddingTop: '1rem' }}>
                  {detailQuery.data.status === 'RECORDED' && (
                    <button
                      type="button"
                      className="btn btn-success"
                      disabled={lifecycleMutation.isPending}
                      onClick={() =>
                        lifecycleMutation.mutate({
                          action: 'VERIFY',
                          id: detailQuery.data!.work_event_id,
                        })
                      }
                    >
                      {lifecycleMutation.isPending ? 'Đang xử lý...' : '✅ Xác Minh Bằng Chứng (Verify)'}
                    </button>
                  )}

                  {detailQuery.data.status !== 'VOIDED' && (
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <input
                        type="text"
                        className="text-input"
                        placeholder="Lý do vô hiệu hóa..."
                        value={voidReason}
                        onChange={(e) => setVoidReason(e.target.value)}
                        style={{ width: '220px' }}
                      />
                      <button
                        type="button"
                        className="btn btn-danger"
                        disabled={!voidReason.trim() || lifecycleMutation.isPending}
                        onClick={() =>
                          lifecycleMutation.mutate({
                            action: 'VOID',
                            id: detailQuery.data!.work_event_id,
                          })
                        }
                      >
                        🚫 Vô Hiệu
                      </button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </section>
      )}

      {/* ========================================================================= */}
      {/* BẢNG NHẬT KÝ CÔNG VIỆC CHÍNH */}
      {/* ========================================================================= */}
      <section className="card operations-panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <h2 className="section-title" style={{ margin: 0 }}>
              📋 Bảng Tổng Hợp Hoạt Động Chăm Sóc
            </h2>
            <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>
              Danh sách các hoạt động thực hiện theo thời gian thực, có xác thực chủ thể và kiểm toán.
            </p>
          </div>

          <div style={{ fontSize: '0.9rem', color: '#475569' }}>
            Hiển thị <b>{filteredEvents.length}</b> kết quả
          </div>
        </div>

        {eventsQuery.isLoading && <LoadingState title="Đang tải danh sách hoạt động..." />}

        {eventsQuery.isError && (
          <ErrorState
            title="Không thể tải hoạt động"
            description={errorText(eventsQuery.error)}
          />
        )}

        {!eventsQuery.isLoading && !eventsQuery.isError && filteredEvents.length === 0 && (
          <EmptyState
            title="Không tìm thấy hoạt động nào phù hợp"
            description="Thử thay đổi từ khóa tìm kiếm, chọn người cao tuổi khác hoặc xóa bộ lọc."
          />
        )}

        {filteredEvents.length > 0 && (
          <div className="operations-table-wrap">
            <table className="operations-table">
              <thead>
                <tr>
                  <th>Thời điểm</th>
                  <th>Người cao tuổi</th>
                  <th>Công việc chăm sóc</th>
                  <th>Người thực hiện</th>
                  <th>Khối lượng</th>
                  <th>Nguồn nghiệp vụ</th>
                  <th>Trạng thái</th>
                  <th style={{ textAlign: 'right' }}>Thao tác</th>
                </tr>
              </thead>

              <tbody>
                {filteredEvents.map((item) => {
                  const type = typeById.get(item.work_event_type_id);
                  const resident = item.resident_id ? residentById.get(item.resident_id) : undefined;
                  const isVerified = item.status === 'VERIFIED' || item.status === 'COMPLETED';

                  return (
                    <tr key={item.work_event_id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>
                          {new Date(item.occurred_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                          {new Date(item.occurred_at).toLocaleDateString('vi-VN')}
                        </div>
                      </td>

                      <td>
                        {resident ? (
                          <div>
                            <div style={{ fontWeight: 700, color: '#1e293b' }}>{resident.displayName}</div>
                            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                              Mã: {resident.residentCode} {resident.room ? `(${resident.room})` : ''}
                            </div>
                          </div>
                        ) : (
                          <span style={{ color: '#94a3b8' }}>Chung / Không gán</span>
                        )}
                      </td>

                      <td>
                        <div style={{ fontWeight: 600 }}>{type?.display_name_vi || item.work_event_type_id}</div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                          {type?.category ? CATEGORY_LABELS[type.category] || type.category : ''}
                        </div>
                        {item.note && (
                          <div style={{ fontSize: '0.75rem', color: '#475569', fontStyle: 'italic', marginTop: '2px' }}>
                            "{item.note}"
                          </div>
                        )}
                      </td>

                      <td>
                        <div>{item.performed_by}</div>
                        <small style={{ color: '#64748b' }}>{item.performed_by_role}</small>
                      </td>

                      <td>
                        <b>{String(item.quantity)}</b> {item.unit}
                      </td>

                      <td>
                        <span className="badge badge-neutral" style={{ fontSize: '0.75rem' }}>
                          {item.source_domain}
                        </span>
                      </td>

                      <td>
                        <span className={STATUS_BADGE_CLASS[item.status] || 'badge badge-neutral'}>
                          {STATUS_LABEL[item.status] || item.status}
                        </span>
                      </td>

                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'flex-end' }}>
                          {canGovern && item.status === 'RECORDED' && (
                            <button
                              type="button"
                              className="btn btn-sm btn-success"
                              title="Xác minh bằng chứng công việc"
                              disabled={lifecycleMutation.isPending}
                              onClick={() =>
                                lifecycleMutation.mutate({
                                  action: 'VERIFY',
                                  id: item.work_event_id,
                                })
                              }
                            >
                              ✓ Duyệt
                            </button>
                          )}
                          <button
                            type="button"
                            className="btn btn-sm btn-secondary"
                            onClick={() => setSelectedEventId(item.work_event_id)}
                          >
                            👁️ Chi tiết
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

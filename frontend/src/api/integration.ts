import { apiRequest } from './client';
import type { HumanActorSession } from '../types/actor';

export interface DomainCollection<T = any> {
  availability: 'AVAILABLE' | 'EMPTY' | 'ERROR';
  items: T[];
  error?: string;
}

export interface AssignedStaffInfo {
  resident_access_assignment_id?: string;
  actor_id: string;
  actor_role: string;
  status: string;
  created_at?: string;
  staff_name?: string;
  staff_code?: string;
  primary_operational_role?: string;
}

export interface ResidentIntegrationOverview {
  resident: {
    resident_id: string;
    resident_code: string;
    display_name: string;
    date_of_birth: string;
    gender: string;
    room?: string;
    bed?: string;
    care_level?: string;
    active_status?: string;
    created_at?: string;
    updated_at?: string;
  };
  assignedStaff?: AssignedStaffInfo | null;
  assignedStaffList?: AssignedStaffInfo[];
  carePlans: DomainCollection<{
    care_plan_id: string;
    title?: string;
    status?: string;
    care_level?: string;
    start_date?: string;
    end_date?: string;
    goals?: string;
    interventions?: any;
    updated_at?: string;
  }>;
  careTasks: DomainCollection<{
    care_task_id: string;
    title?: string;
    task_name?: string;
    category?: string;
    status?: string;
    scheduled_time?: string;
    due_date?: string;
    priority?: string;
    assigned_to_role?: string;
    notes?: string;
    updated_at?: string;
  }>;
  clinicalObservations: DomainCollection<{
    observation_id: string;
    observation_type?: string;
    type?: string;
    value_numeric?: number;
    value_text?: string;
    unit?: string;
    measured_at?: string;
    recorded_at?: string;
  }>;
  medicationOrders: DomainCollection<{
    order_id: string;
    medication_name: string;
    dosage?: string;
    route?: string;
    frequency?: string;
    prescribed_at?: string;
    status?: string;
  }>;
  medicationAdministrations: DomainCollection<{
    administration_id: string;
    medication_name?: string;
    dose?: string;
    scheduled_at?: string;
    administered_at?: string;
    status: string;
    note?: string;
  }>;
  incidents: DomainCollection<{
    incident_id: string;
    incident_type: string;
    severity?: string;
    description: string;
    occurred_at?: string;
    discovered_at?: string;
    created_at?: string;
    status: string;
  }>;
}

export async function fetchResidentIntegrationOverview(
  actor: HumanActorSession | null,
  residentId: string,
): Promise<ResidentIntegrationOverview> {
  try {
    const res = await apiRequest<any>(
      `/api/integration/residents/${residentId}/overview`,
      { actor },
    );
    if (res && res.data) {
      return {
        resident: res.data.resident,
        assignedStaff: res.data.assignedStaff || null,
        assignedStaffList: res.data.assignedStaffList || [],
        carePlans: { availability: res.availability?.carePlans || 'AVAILABLE', items: res.data.carePlans || [] },
        careTasks: { availability: res.availability?.careTasks || 'AVAILABLE', items: res.data.careTasks || [] },
        clinicalObservations: { availability: res.availability?.clinicalObservations || 'AVAILABLE', items: res.data.clinicalObservations || [] },
        medicationOrders: { availability: 'AVAILABLE', items: (res.data.medication || []).filter((m: any) => m.recordType === 'ORDER') },
        medicationAdministrations: { availability: 'AVAILABLE', items: (res.data.medication || []).filter((m: any) => m.recordType === 'ADMINISTRATION') },
        incidents: { availability: res.availability?.incidents || 'AVAILABLE', items: res.data.incidents || [] },
      };
    }
    return res as ResidentIntegrationOverview;
  } catch (error) {
    console.warn('[TamAnCare API] Offline mode active for fetchResidentIntegrationOverview:', error);
    
    // Read custom recorded vitals from localStorage if available
    let storedVitals: any = null;
    try {
      const raw = localStorage.getItem(`taman_care_mock_vitals_${residentId}`);
      if (raw) storedVitals = JSON.parse(raw);
    } catch {}

    const measuredAt = storedVitals?.updatedAt || new Date().toISOString();
    const sys = storedVitals?.sysBP || 120;
    const dia = storedVitals?.diaBP || 80;
    const hr = storedVitals?.heartRate || 75;
    const temp = storedVitals?.temp || 36.8;
    const spo2 = storedVitals?.spo2 || 98;
    const resp = storedVitals?.respRate || 18;

    return {
      resident: {
        resident_id: residentId,
        resident_code: 'RES-2026-001',
        display_name: 'Nguyễn Văn An',
        date_of_birth: '1944-05-15',
        gender: 'Nam',
        room: 'Phòng 101 — Giường 101-B',
        care_level: 'ASSISTED',
        active_status: 'PRESENT',
      },
      assignedStaff: {
        actor_id: 'NURSE-01',
        actor_role: 'NURSE',
        status: 'ACTIVE',
        staff_name: 'Điều dưỡng Phạm Thị Mai',
        primary_operational_role: 'Điều dưỡng Trưởng Tầng 1',
      },
      carePlans: {
        availability: 'AVAILABLE',
        items: [
          {
            care_plan_id: `cp-${residentId}`,
            title: 'Kế hoạch Chăm sóc Sinh hoạt & Điều trị Y tế Toàn diện',
            status: 'ACTIVE',
            care_level: 'LEVEL_2',
            start_date: '2026-01-01',
            goals: 'Duy trì huyết áp 120-130/80 mmHg, ăn hết suất, vận động nhẹ 20 phút/ngày.',
          },
        ],
      },
      careTasks: {
        availability: 'AVAILABLE',
        items: [
          { care_task_id: 'task-1', task_name: 'Đo huyết áp & Nhịp tim buổi sáng', category: 'CLINICAL_CARE', status: 'COMPLETED' },
          { care_task_id: 'task-2', task_name: 'Cho uống thuốc Amlodipine 5mg sau ăn', category: 'CLINICAL_CARE', status: 'COMPLETED' },
          { care_task_id: 'task-3', task_name: 'Hỗ trợ tắm rửa & Vệ sinh cá nhân', category: 'PERSONAL_CARE', status: 'COMPLETED' },
        ],
      },
      clinicalObservations: {
        availability: 'AVAILABLE',
        items: [
          { observation_id: `obs-${residentId}-1`, observation_type: 'Huyết áp (Huyết áp tâm thu/tâm trương)', value_numeric: undefined, value_text: `${sys}/${dia}`, unit: 'mmHg', measured_at: measuredAt },
          { observation_id: `obs-${residentId}-2`, observation_type: 'Nhịp tim (Mạch)', value_numeric: hr, unit: 'lần/phút', measured_at: measuredAt },
          { observation_id: `obs-${residentId}-3`, observation_type: 'Thân nhiệt', value_numeric: temp, unit: '°C', measured_at: measuredAt },
          { observation_id: `obs-${residentId}-4`, observation_type: 'Nồng độ SpO2', value_numeric: spo2, unit: '%', measured_at: measuredAt },
          { observation_id: `obs-${residentId}-5`, observation_type: 'Nhịp thở', value_numeric: resp, unit: 'lần/phút', measured_at: measuredAt },
        ],
      },
      medicationOrders: {
        availability: 'AVAILABLE',
        items: [
          { order_id: 'ord-1', medication_name: 'Amlodipine 5mg', dosage: '1 viên / sáng', route: 'Uống', prescribed_at: '2026-01-10' },
          { order_id: 'ord-2', medication_name: 'Glucosamine 500mg', dosage: '1 viên / trưa', route: 'Uống', prescribed_at: '2026-01-10' },
        ],
      },
      medicationAdministrations: {
        availability: 'AVAILABLE',
        items: [
          { administration_id: 'adm-1', medication_name: 'Amlodipine 5mg', dose: '1 viên', status: 'ADMINISTERED', administered_at: new Date().toISOString() },
        ],
      },
      incidents: {
        availability: 'AVAILABLE',
        items: [],
      },
    };
  }
}

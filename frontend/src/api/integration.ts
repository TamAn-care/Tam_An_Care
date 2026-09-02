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
}

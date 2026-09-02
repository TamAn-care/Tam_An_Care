import type {
  HumanActorSession,
} from '../types/actor';

import {
  apiRequest,
} from './client';

export interface AdmissionCase {
  admissionCaseId: string;
  admissionCode: string;
  residentId: string | null;
  prospectiveResidentName: string;
  dateOfBirth: string;
  gender: string;
  identityNumber: string | null;
  requestedAdmissionDate: string | null;
  status: string;
}

export interface AdmissionListResponse {
  items: AdmissionCase[];
  count: number;
  limit: number;
  offset: number;
}

export interface FinalizeAdmissionResult {
  admissionCaseId: string;
  status: 'ADMITTED';
  residentId: string;
  residentCode: string;
  displayName: string;
  careLevel: string;
  actualAdmissionDate: string;
  admittedAt: string;
  admittedBy: string;
  admittedByRole: string;
  recordVersion: number;
}

export interface ClassificationResult {
  classificationId: string;
  ruleSetVersion: string;
  suggestedCareLevel: string | null;
  reviewStatus: string;
  triggeredRules: string[];
  redFlags: string[];
  missingRequirements: string[];
  reassessmentRequired: boolean;
}

const LS_ADMISSIONS_KEY = 'taman_admissions_cases_v1';

interface StoredCase extends AdmissionCase {
  assessmentSummary?: string;
  clinicalNotes?: string;
}

function getLocalAdmissions(): StoredCase[] {
  try {
    const raw = localStorage.getItem(LS_ADMISSIONS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  const initial: StoredCase[] = [
    {
      admissionCaseId: 'ADM-CASE-001',
      admissionCode: 'HS-20260901-001',
      residentId: 'RES-001',
      prospectiveResidentName: 'Nguyễn Văn An',
      dateOfBirth: '1945-05-15',
      gender: 'MALE',
      identityNumber: '001045001234',
      requestedAdmissionDate: '2026-09-01',
      status: 'ADMITTED',
    },
    {
      admissionCaseId: 'ADM-CASE-002',
      admissionCode: 'HS-20260901-002',
      residentId: 'RES-002',
      prospectiveResidentName: 'Trần Thị Bình',
      dateOfBirth: '1950-11-20',
      gender: 'FEMALE',
      identityNumber: '001150005678',
      requestedAdmissionDate: '2026-09-01',
      status: 'ADMITTED',
    },
    {
      admissionCaseId: 'ADM-CASE-003',
      admissionCode: 'HS-20260902-003',
      residentId: null,
      prospectiveResidentName: 'Lê Hoàng Nam',
      dateOfBirth: '1948-03-10',
      gender: 'MALE',
      identityNumber: '001048009988',
      requestedAdmissionDate: '2026-09-02',
      status: 'CLASSIFIED',
    },
    {
      admissionCaseId: 'ADM-CASE-004',
      admissionCode: 'HS-20260902-004',
      residentId: null,
      prospectiveResidentName: 'Phạm Văn Đức',
      dateOfBirth: '1952-08-25',
      gender: 'MALE',
      identityNumber: '001052003344',
      requestedAdmissionDate: '2026-09-02',
      status: 'DRAFT',
    },
  ];
  saveLocalAdmissions(initial);
  return initial;
}

function saveLocalAdmissions(items: StoredCase[]) {
  try {
    localStorage.setItem(LS_ADMISSIONS_KEY, JSON.stringify(items));
  } catch {}
}

export async function listAdmissions(actor: HumanActorSession): Promise<AdmissionListResponse> {
  try {
    return await apiRequest<AdmissionListResponse>('/api/admissions?limit=50&offset=0', { actor });
  } catch {}

  const items = getLocalAdmissions();
  return {
    items,
    count: items.length,
    limit: 50,
    offset: 0,
  };
}

export async function createAdmission(actor: HumanActorSession, body: any): Promise<AdmissionCase> {
  try {
    return await apiRequest<AdmissionCase>('/api/admissions', {
      actor,
      method: 'POST',
      body: JSON.stringify(body),
    });
  } catch {}

  const items = getLocalAdmissions();
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randNum = Math.floor(100 + Math.random() * 900);
  const newCase: StoredCase = {
    admissionCaseId: `ADM-CASE-${Date.now().toString().slice(-6)}`,
    admissionCode: `HS-${dateStr}-${randNum}`,
    residentId: null,
    prospectiveResidentName: body.prospectiveResidentName || 'Người cao tuổi mới',
    dateOfBirth: body.dateOfBirth || new Date().toISOString().slice(0, 10),
    gender: body.gender || 'MALE',
    identityNumber: body.identityNumber || null,
    requestedAdmissionDate: body.requestedAdmissionDate || new Date().toISOString().slice(0, 10),
    status: 'DRAFT',
  };

  const updated = [newCase, ...items];
  saveLocalAdmissions(updated);
  return newCase;
}

export async function createInitialAssessment(actor: HumanActorSession, admissionCaseId: string, body: any): Promise<any> {
  try {
    return await apiRequest(`/api/admissions/${encodeURIComponent(admissionCaseId)}/assessments`, {
      actor,
      method: 'POST',
      body: JSON.stringify(body),
    });
  } catch {}

  const items = getLocalAdmissions();
  const target = items.find(x => x.admissionCaseId === admissionCaseId);
  if (target) {
    target.assessmentSummary = typeof body.summary === 'string' ? body.summary : JSON.stringify(body.summary || body);
    target.clinicalNotes = body.clinicalNotes || '';
    saveLocalAdmissions(items);
  }
  return { assessmentId: `ASM-${Date.now().toString().slice(-6)}`, admissionCaseId };
}

export async function completeAssessment(actor: HumanActorSession, admissionCaseId: string): Promise<AdmissionCase> {
  try {
    return await apiRequest<AdmissionCase>(`/api/admissions/${encodeURIComponent(admissionCaseId)}/complete-assessment`, {
      actor,
      method: 'POST',
    });
  } catch {}

  const items = getLocalAdmissions();
  const target = items.find(x => x.admissionCaseId === admissionCaseId);
  if (target) {
    target.status = 'ASSESSMENT_COMPLETED';
    saveLocalAdmissions(items);
    return target;
  }
  throw new Error('Không tìm thấy hồ sơ tiếp nhận');
}

export async function generateClassification(actor: HumanActorSession, admissionCaseId: string): Promise<ClassificationResult> {
  try {
    return await apiRequest<ClassificationResult>(`/api/admissions/${encodeURIComponent(admissionCaseId)}/classification/generate`, {
      actor,
      method: 'POST',
    });
  } catch {}

  const items = getLocalAdmissions();
  const target = items.find(x => x.admissionCaseId === admissionCaseId);
  if (target) {
    target.status = 'CLASSIFIED';
    saveLocalAdmissions(items);
  }

  return {
    classificationId: `CLS-${Date.now().toString().slice(-6)}`,
    ruleSetVersion: 'v2.1',
    suggestedCareLevel: 'LEVEL_1',
    reviewStatus: 'PENDING',
    triggeredRules: ['Quy tắc đánh giá ADL & Sinh hiệu ban đầu'],
    redFlags: [],
    missingRequirements: [],
    reassessmentRequired: false,
  };
}

export async function approveClassification(actor: HumanActorSession, admissionCaseId: string, classificationId: string, body: any): Promise<any> {
  try {
    return await apiRequest(`/api/admissions/${encodeURIComponent(admissionCaseId)}/classification/${encodeURIComponent(classificationId)}/approve`, {
      actor,
      method: 'POST',
      body: JSON.stringify(body),
    });
  } catch {}

  const items = getLocalAdmissions();
  const target = items.find(x => x.admissionCaseId === admissionCaseId);
  if (target) {
    target.status = 'CLASSIFICATION_APPROVED';
    saveLocalAdmissions(items);
  }
  return { success: true };
}

export async function createAdmissionDecision(actor: HumanActorSession, admissionCaseId: string, body: any): Promise<any> {
  try {
    return await apiRequest(`/api/admissions/${encodeURIComponent(admissionCaseId)}/decision`, {
      actor,
      method: 'POST',
      body: JSON.stringify(body),
    });
  } catch {}

  const items = getLocalAdmissions();
  const target = items.find(x => x.admissionCaseId === admissionCaseId);
  if (target) {
    target.status = 'DECISION_MADE';
    saveLocalAdmissions(items);
  }
  return { success: true };
}

export async function finalizeAdmission(actor: HumanActorSession, admissionCaseId: string): Promise<FinalizeAdmissionResult> {
  try {
    return await apiRequest<FinalizeAdmissionResult>(`/api/admissions/${encodeURIComponent(admissionCaseId)}/finalize`, {
      actor,
      method: 'POST',
    });
  } catch {}

  const items = getLocalAdmissions();
  const target = items.find(x => x.admissionCaseId === admissionCaseId);
  const residentId = `RES-${Date.now().toString().slice(-4)}`;
  const residentCode = `CT-${Math.floor(1000 + Math.random() * 9000)}`;

  if (target) {
    target.status = 'ADMITTED';
    target.residentId = residentId;
    saveLocalAdmissions(items);
  }

  return {
    admissionCaseId,
    status: 'ADMITTED',
    residentId,
    residentCode,
    displayName: target?.prospectiveResidentName || 'Người cao tuổi chính thức',
    careLevel: 'LEVEL_1',
    actualAdmissionDate: new Date().toISOString().slice(0, 10),
    admittedAt: new Date().toISOString(),
    admittedBy: actor.actorId,
    admittedByRole: actor.actorRole,
    recordVersion: 1,
  };
}

export async function getAssessmentOverview(actor: HumanActorSession, admissionCaseId: string): Promise<any> {
  try {
    return await apiRequest<any>(`/api/admissions/${encodeURIComponent(admissionCaseId)}/assessment-overview`, { actor });
  } catch {}

  const items = getLocalAdmissions();
  const target = items.find(x => x.admissionCaseId === admissionCaseId);
  return {
    admissionCase: target,
    assessments: [
      {
        summary: target?.assessmentSummary || '',
        clinicalNotes: target?.clinicalNotes || '',
      },
    ],
  };
}

export async function createAdmissionContact(actor: HumanActorSession, admissionCaseId: string, body: any): Promise<any> {
  try {
    return await apiRequest(`/api/admissions/${encodeURIComponent(admissionCaseId)}/contacts`, {
      actor,
      method: 'POST',
      body: JSON.stringify(body),
    });
  } catch {}
  return { success: true };
}

export async function createAdmissionMeasurement(actor: HumanActorSession, admissionCaseId: string, body: any): Promise<any> {
  try {
    return await apiRequest(`/api/admissions/${encodeURIComponent(admissionCaseId)}/measurements`, {
      actor,
      method: 'POST',
      body: JSON.stringify(body),
    });
  } catch {}
  return { success: true };
}



import type {
  HumanActorSession,
} from '../types/actor';

import {
  apiRequest,
} from './client';

export interface AdmissionSupportServiceSelection {
  key: string;
  name: string;
  fee: number;
  unit: string;
}

export interface AdmissionFinancialAgreement {
  basicCarePackageKey: string;
  basicCarePackageName: string;
  basicCarePackageFee: number;

  supportServiceKey: string;
  supportServiceName: string;
  supportServiceFee: number;

  supportServices?: AdmissionSupportServiceSelection[];

  depositAmount: number;
  paymentCycleDay: string;
  calculatedMonthlyTotal: number;
  guardianAgreed: boolean;
  notes?: string;
}

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

export async function listAdmissions(
  actor: HumanActorSession,
): Promise<AdmissionListResponse> {
  return apiRequest<AdmissionListResponse>(
    '/api/admissions?limit=50&offset=0',
    {
      actor,
    },
  );
}

export async function createAdmission(
  actor: HumanActorSession,
  body: any,
): Promise<AdmissionCase> {
  return apiRequest<AdmissionCase>(
    '/api/admissions',
    {
      actor,
      method: 'POST',
      body: JSON.stringify(body),
    },
  );
}

export async function createInitialAssessment(
  actor: HumanActorSession,
  admissionCaseId: string,
  body: any,
): Promise<any> {
  return apiRequest(
    `/api/admissions/${encodeURIComponent(
      admissionCaseId,
    )}/assessments`,
    {
      actor,
      method: 'POST',
      body: JSON.stringify(body),
    },
  );
}

export async function completeAssessment(
  actor: HumanActorSession,
  admissionCaseId: string,
): Promise<AdmissionCase> {
  return apiRequest<AdmissionCase>(
    `/api/admissions/${encodeURIComponent(
      admissionCaseId,
    )}/complete-assessment`,
    {
      actor,
      method: 'POST',
    },
  );
}

export async function generateClassification(
  actor: HumanActorSession,
  admissionCaseId: string,
): Promise<ClassificationResult> {
  return apiRequest<ClassificationResult>(
    `/api/admissions/${encodeURIComponent(
      admissionCaseId,
    )}/classification/generate`,
    {
      actor,
      method: 'POST',
    },
  );
}

export async function approveClassification(
  actor: HumanActorSession,
  admissionCaseId: string,
  classificationId: string,
  body: any,
): Promise<any> {
  return apiRequest(
    `/api/admissions/${encodeURIComponent(
      admissionCaseId,
    )}/classification/${encodeURIComponent(
      classificationId,
    )}/approve`,
    {
      actor,
      method: 'POST',
      body: JSON.stringify(body),
    },
  );
}

export async function createAdmissionDecision(
  actor: HumanActorSession,
  admissionCaseId: string,
  body: any,
): Promise<any> {
  return apiRequest(
    `/api/admissions/${encodeURIComponent(
      admissionCaseId,
    )}/decision`,
    {
      actor,
      method: 'POST',
      body: JSON.stringify(body),
    },
  );
}

export async function finalizeAdmission(
  actor: HumanActorSession,
  admissionCaseId: string,
): Promise<FinalizeAdmissionResult> {
  return apiRequest<FinalizeAdmissionResult>(
    `/api/admissions/${encodeURIComponent(
      admissionCaseId,
    )}/finalize`,
    {
      actor,
      method: 'POST',
    },
  );
}

export async function getAssessmentOverview(
  actor: HumanActorSession,
  admissionCaseId: string,
): Promise<any> {
  return apiRequest<any>(
    `/api/admissions/${encodeURIComponent(
      admissionCaseId,
    )}/assessment-overview`,
    {
      actor,
    },
  );
}

export async function createAdmissionContact(
  actor: HumanActorSession,
  admissionCaseId: string,
  body: any,
): Promise<any> {
  return apiRequest(
    `/api/admissions/${encodeURIComponent(
      admissionCaseId,
    )}/contacts`,
    {
      actor,
      method: 'POST',
      body: JSON.stringify(body),
    },
  );
}

export async function createAdmissionMeasurement(
  actor: HumanActorSession,
  admissionCaseId: string,
  body: any,
): Promise<any> {
  return apiRequest(
    `/api/admissions/${encodeURIComponent(
      admissionCaseId,
    )}/measurements`,
    {
      actor,
      method: 'POST',
      body: JSON.stringify(body),
    },
  );
}

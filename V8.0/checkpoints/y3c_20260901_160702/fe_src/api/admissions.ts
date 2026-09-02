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

export function listAdmissions(
  actor: HumanActorSession,
) {
  return apiRequest<AdmissionListResponse>(
    '/api/admissions?limit=50&offset=0',
    {
      actor,
    },
  );
}

export function createAdmission(
  actor: HumanActorSession,
  body: unknown,
) {
  return apiRequest<AdmissionCase>(
    '/api/admissions',
    {
      actor,
      method: 'POST',
      body: JSON.stringify(body),
    },
  );
}

export function createInitialAssessment(
  actor: HumanActorSession,
  admissionCaseId: string,
  body: unknown,
) {
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

export function generateClassification(
  actor: HumanActorSession,
  admissionCaseId: string,
) {
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

export function approveClassification(
  actor: HumanActorSession,
  admissionCaseId: string,
  classificationId: string,
  body: unknown,
) {
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

export function createAdmissionDecision(
  actor: HumanActorSession,
  admissionCaseId: string,
  body: unknown,
) {
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

export function finalizeAdmission(
  actor: HumanActorSession,
  admissionCaseId: string,
) {
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

export function getAssessmentOverview(
  actor: HumanActorSession,
  admissionCaseId: string,
) {
  return apiRequest<any>(
    `/api/admissions/${encodeURIComponent(
      admissionCaseId,
    )}/assessment-overview`,
    {
      actor,
    },
  );
}

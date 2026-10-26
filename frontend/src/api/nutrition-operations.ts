import type { HumanActorSession } from '../types/actor';
import { apiRequest } from './client';

export type NutritionIdentity = HumanActorSession;

export function listTrayDispatches(actor: NutritionIdentity, date: string) {
  return apiRequest<{ items: any[] }>(`/api/nutrition-operations/tray-dispatches?date=${encodeURIComponent(date)}`, { actor });
}

export function dispatchTray(actor: NutritionIdentity, input: { registrationId: string; destinationFloor: string; portions: number }) {
  return apiRequest<any>('/api/nutrition-operations/tray-dispatches', { method: 'POST', actor, body: JSON.stringify(input) });
}

export function acknowledgeTray(actor: NutritionIdentity, dispatchId: string, input: { floor: string; receivedPortions: number; notes?: string }) {
  return apiRequest<any>(`/api/nutrition-operations/tray-dispatches/${encodeURIComponent(dispatchId)}/acknowledge`, { method: 'POST', actor, body: JSON.stringify(input) });
}

export function recordNutritionHygiene(actor: NutritionIdentity, input: { residentId: string; taskReference: string; status: 'RECORDED' | 'COMPLETED'; notes?: string }) {
  return apiRequest<any>('/api/nutrition-operations/hygiene-records', { method: 'POST', actor, body: JSON.stringify(input) });
}

export function inspectNutritionHygiene(actor: NutritionIdentity, input: { recordId: string; finding: string; decision: 'CONFIRMED' | 'NONCONFORMITY' }) {
  return apiRequest<any>('/api/nutrition-operations/hygiene-records/inspect', { method: 'POST', actor, body: JSON.stringify(input) });
}

export function collectNutritionSample(actor: NutritionIdentity, input: { residentId: string; registrationId?: string; mealDate: string; mealType: string; notes?: string }) {
  return apiRequest<any>('/api/nutrition-operations/food-samples', { method: 'POST', actor, body: JSON.stringify(input) });
}

export function disposeNutritionSample(actor: NutritionIdentity, sampleId: string) {
  return apiRequest<any>(`/api/nutrition-operations/food-samples/${encodeURIComponent(sampleId)}/dispose`, { method: 'POST', actor, body: '{}' });
}

export function inspectNutritionSample(actor: NutritionIdentity, input: { sampleId: string; finding: string }) {
  return apiRequest<any>('/api/nutrition-operations/food-samples/inspect', { method: 'POST', actor, body: JSON.stringify(input) });
}

import { apiRequest } from './client';
import type { HumanActorSession } from '../types/actor';

export interface GuardianResident {
  residentId: string;
  residentCode: string;
  displayName: string;
  room: string | null;
  careLevel: string;
}

export function listGuardianResidents(actor: HumanActorSession) {
  return apiRequest<GuardianResident[]>('/api/family-portal/residents', { actor });
}

export function getGuardianResident(actor: HumanActorSession, residentId: string) {
  return apiRequest<GuardianResident>(`/api/family-portal/residents/${encodeURIComponent(residentId)}`, { actor });
}

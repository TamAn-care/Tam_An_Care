import { apiRequest } from './client';
import type { HumanActorSession } from '../types/actor';

export interface AccommodationSummary {
  total: number;
  occupied: number;
  available: number;
  reserved: number;
  unavailable: number;
  occupancyPercentage: number;
}

export interface AccommodationItem {
  buildingId: string;
  buildingCode: string;
  buildingName: string;
  floorId: string;
  floorCode: string;
  floorName: string;
  floorNumber: number | null;
  roomId: string;
  roomCode: string;
  roomName: string;
  roomType: string | null;
  bedId: string;
  bedCode: string;
  bedName: string;
  bedStatus: string;
  assignmentId: string | null;
  residentId: string | null;
  residentName: string | null;
  careLevel: string | null;
  assignedAt: string | null;
}

export interface AccommodationOverview {
  summary: AccommodationSummary;
  items: AccommodationItem[];
  limit: number;
  offset: number;
  total: number;
}

export interface Building {
  buildingId: string;
  code: string;
  name: string;
  status: string;
}

export interface Floor {
  floorId: string;
  buildingId: string;
  code: string;
  name: string;
  floorNumber: number | null;
  status: string;
}

export interface Room {
  roomId: string;
  floorId: string;
  code: string;
  name: string;
  roomType: string | null;
  status: string;
}

function queryString(
  values: Record<string, string | number | undefined>,
) {
  const p = new URLSearchParams();

  Object.entries(values).forEach(([k,v]) => {
    if (
      v !== undefined &&
      v !== '' &&
      v !== 'ALL'
    ) {
      p.set(k,String(v));
    }
  });

  const q=p.toString();
  return q ? `?${q}` : '';
}

export function getAccommodationOverview(
  actor: HumanActorSession,
  filters: {
    buildingId?: string;
    floorId?: string;
    roomId?: string;
    status?: string;
    search?: string;
    limit?: number;
    offset?: number;
  },
) {
  return apiRequest<AccommodationOverview>(
    `/api/accommodation/overview${queryString(filters)}`,
    { actor },
  );
}

export function listBuildings(
  actor: HumanActorSession,
) {
  return apiRequest<Building[]>(
    '/api/accommodation/buildings',
    { actor },
  );
}

export function listFloors(
  actor: HumanActorSession,
  buildingId?: string,
) {
  return apiRequest<Floor[]>(
    `/api/accommodation/floors${queryString({buildingId})}`,
    { actor },
  );
}

export function listRooms(
  actor: HumanActorSession,
  floorId?: string,
) {
  return apiRequest<{
    items: Room[];
    limit: number;
    offset: number;
    total: number;
  }>(
    `/api/accommodation/rooms${queryString({
      floorId,
      limit: 100,
      offset: 0,
    })}`,
    { actor },
  );
}

export function createBuilding(
  actor: HumanActorSession,
  input: { code: string; name: string },
) {
  return apiRequest('/api/accommodation/buildings', {
    method: 'POST',
    actor,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export function createFloor(
  actor: HumanActorSession,
  input: {
    buildingId: string;
    code: string;
    name: string;
    floorNumber?: number | null;
  },
) {
  return apiRequest('/api/accommodation/floors', {
    method: 'POST',
    actor,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export function createRoom(
  actor: HumanActorSession,
  input: {
    floorId: string;
    code: string;
    name: string;
    roomType?: string;
  },
) {
  return apiRequest('/api/accommodation/rooms', {
    method: 'POST',
    actor,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export function createBed(
  actor: HumanActorSession,
  input: {
    roomId: string;
    code: string;
    name: string;
  },
) {
  return apiRequest('/api/accommodation/beds', {
    method: 'POST',
    actor,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export function assignBed(
  actor: HumanActorSession,
  bedId: string,
  residentId: string,
) {
  return apiRequest(
    `/api/accommodation/beds/${encodeURIComponent(bedId)}/assign`,
    {
      method: 'POST',
      actor,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ residentId }),
    },
  );
}

export function transferBed(
  actor: HumanActorSession,
  residentId: string,
  bedId: string,
) {
  return apiRequest(
    `/api/accommodation/residents/${encodeURIComponent(residentId)}/transfer`,
    {
      method: 'POST',
      actor,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ bedId }),
    },
  );
}

export function releaseBed(
  actor: HumanActorSession,
  residentId: string,
) {
  return apiRequest(
    `/api/accommodation/residents/${encodeURIComponent(residentId)}/release`,
    {
      method: 'POST',
      actor,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ reason: 'OPERATIONAL_RELEASE' }),
    },
  );
}

export function setBedStatus(
  actor: HumanActorSession,
  bedId: string,
  status:
    | 'AVAILABLE'
    | 'TEMPORARILY_UNAVAILABLE'
    | 'MAINTENANCE'
    | 'INACTIVE',
) {
  return apiRequest(
    `/api/accommodation/beds/${encodeURIComponent(bedId)}/status`,
    {
      method: 'POST',
      actor,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status }),
    },
  );
}

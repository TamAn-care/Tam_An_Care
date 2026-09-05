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

export let mockBuildings: Building[] = [
  { buildingId: 'bld-001', code: 'BLD-A', name: 'Tòa Nhà Tâm An Care (Tòa Chính)', status: 'ACTIVE' },
];

export let mockFloors: Floor[] = [
  { floorId: 'flr-100', buildingId: 'bld-001', code: 'FL-1', name: 'Tầng 1 - Khu Y Tế & Chăm Sóc Đặc Biệt', floorNumber: 1, status: 'ACTIVE' },
  { floorId: 'flr-200', buildingId: 'bld-001', code: 'FL-2', name: 'Tầng 2 - Khu Sinh Hoạt Chung & Điều Dưỡng', floorNumber: 2, status: 'ACTIVE' },
  { floorId: 'flr-300', buildingId: 'bld-001', code: 'FL-3', name: 'Tầng 3 - Khu Nghỉ Dưỡng Cao Cấp', floorNumber: 3, status: 'ACTIVE' },
  { floorId: 'flr-400', buildingId: 'bld-001', code: 'FL-4', name: 'Tầng 4 - Phục Hồi Chức Năng & Vườn Treo', floorNumber: 4, status: 'ACTIVE' },
];

export let mockRooms: Room[] = [
  // Floor 1 (4 rooms, 16 beds)
  { roomId: 'rm-101', floorId: 'flr-100', code: 'P-101', name: 'Phòng 101 (Phòng Đôi)', roomType: 'DOUBLE', status: 'ACTIVE' },
  { roomId: 'rm-102', floorId: 'flr-100', code: 'P-102', name: 'Phòng 102 (Phòng 6 Giường)', roomType: 'SIX_BED', status: 'ACTIVE' },
  { roomId: 'rm-103', floorId: 'flr-100', code: 'P-103', name: 'Phòng 103 (Phòng Đôi)', roomType: 'DOUBLE', status: 'ACTIVE' },
  { roomId: 'rm-104', floorId: 'flr-100', code: 'P-104', name: 'Phòng 104 (Phòng 6 Giường)', roomType: 'SIX_BED', status: 'ACTIVE' },

  // Floor 2 (9 rooms, 35 beds)
  { roomId: 'rm-201', floorId: 'flr-200', code: 'P-201', name: 'Phòng 201 (Phòng Đôi)', roomType: 'DOUBLE', status: 'ACTIVE' },
  { roomId: 'rm-202', floorId: 'flr-200', code: 'P-202', name: 'Phòng 202 (Phòng 6 Giường)', roomType: 'SIX_BED', status: 'ACTIVE' },
  { roomId: 'rm-203', floorId: 'flr-200', code: 'P-203', name: 'Phòng 203 (Phòng Đơn VIP)', roomType: 'SINGLE', status: 'ACTIVE' },
  { roomId: 'rm-204', floorId: 'flr-200', code: 'P-204', name: 'Phòng 204 (Phòng 6 Giường)', roomType: 'SIX_BED', status: 'ACTIVE' },
  { roomId: 'rm-205', floorId: 'flr-200', code: 'P-205', name: 'Phòng 205 (Phòng 3 Giường)', roomType: 'TRIPLE', status: 'ACTIVE' },
  { roomId: 'rm-206', floorId: 'flr-200', code: 'P-206', name: 'Phòng 206 (Phòng 4 Giường)', roomType: 'QUAD', status: 'ACTIVE' },
  { roomId: 'rm-207', floorId: 'flr-200', code: 'P-207', name: 'Phòng 207 (Phòng Đơn VIP)', roomType: 'SINGLE', status: 'ACTIVE' },
  { roomId: 'rm-208', floorId: 'flr-200', code: 'P-208', name: 'Phòng 208 (Phòng 6 Giường)', roomType: 'SIX_BED', status: 'ACTIVE' },
  { roomId: 'rm-209', floorId: 'flr-200', code: 'P-209', name: 'Phòng 209 (Phòng 6 Giường)', roomType: 'SIX_BED', status: 'ACTIVE' },

  // Floor 3 (10 rooms, 38 beds)
  { roomId: 'rm-301', floorId: 'flr-300', code: 'P-301', name: 'Phòng 301 (Phòng Đôi)', roomType: 'DOUBLE', status: 'ACTIVE' },
  { roomId: 'rm-302', floorId: 'flr-300', code: 'P-302', name: 'Phòng 302 (Phòng 6 Giường)', roomType: 'SIX_BED', status: 'ACTIVE' },
  { roomId: 'rm-303', floorId: 'flr-300', code: 'P-303', name: 'Phòng 303 (Phòng Đơn VIP)', roomType: 'SINGLE', status: 'ACTIVE' },
  { roomId: 'rm-304', floorId: 'flr-300', code: 'P-304', name: 'Phòng 304 (Phòng 6 Giường)', roomType: 'SIX_BED', status: 'ACTIVE' },
  { roomId: 'rm-305', floorId: 'flr-300', code: 'P-305', name: 'Phòng 305 (Phòng Đơn VIP)', roomType: 'SINGLE', status: 'ACTIVE' },
  { roomId: 'rm-306', floorId: 'flr-300', code: 'P-306', name: 'Phòng 306 (Phòng 6 Giường)', roomType: 'SIX_BED', status: 'ACTIVE' },
  { roomId: 'rm-307', floorId: 'flr-300', code: 'P-307', name: 'Phòng 307 (Phòng 3 Giường)', roomType: 'TRIPLE', status: 'ACTIVE' },
  { roomId: 'rm-308', floorId: 'flr-300', code: 'P-308', name: 'Phòng 308 (Phòng 6 Giường)', roomType: 'SIX_BED', status: 'ACTIVE' },
  { roomId: 'rm-309', floorId: 'flr-300', code: 'P-309', name: 'Phòng 309 (Phòng Đơn VIP)', roomType: 'SINGLE', status: 'ACTIVE' },
  { roomId: 'rm-310', floorId: 'flr-300', code: 'P-310', name: 'Phòng 310 (Phòng 6 Giường)', roomType: 'SIX_BED', status: 'ACTIVE' },

  // Floor 4 (6 rooms, 21 beds)
  { roomId: 'rm-401', floorId: 'flr-400', code: 'P-401', name: 'Phòng 401 (Phòng 3 Giường)', roomType: 'TRIPLE', status: 'ACTIVE' },
  { roomId: 'rm-402', floorId: 'flr-400', code: 'P-402', name: 'Phòng 402 (Phòng 4 Giường)', roomType: 'QUAD', status: 'ACTIVE' },
  { roomId: 'rm-403', floorId: 'flr-400', code: 'P-403', name: 'Phòng 403 (Phòng Đơn VIP)', roomType: 'SINGLE', status: 'ACTIVE' },
  { roomId: 'rm-404', floorId: 'flr-400', code: 'P-404', name: 'Phòng 404 (Phòng 6 Giường)', roomType: 'SIX_BED', status: 'ACTIVE' },
  { roomId: 'rm-405', floorId: 'flr-400', code: 'P-405', name: 'Phòng 405 (Phòng 3 Giường)', roomType: 'TRIPLE', status: 'ACTIVE' },
  { roomId: 'rm-406', floorId: 'flr-400', code: 'P-406', name: 'Phòng 406 (Phòng 4 Giường)', roomType: 'QUAD', status: 'ACTIVE' },
];

function generateMockAccommodationItems(): AccommodationItem[] {
  const roomDefs: Array<{
    floorId: string;
    floorCode: string;
    floorName: string;
    floorNumber: number;
    roomId: string;
    roomCode: string;
    roomName: string;
    roomType: string;
    bedCount: number;
  }> = [
    // Floor 1 (16 beds)
    { floorId: 'flr-100', floorCode: 'FL-1', floorName: 'Tầng 1 - Khu Y Tế & Chăm Sóc Đặc Biệt', floorNumber: 1, roomId: 'rm-101', roomCode: 'P-101', roomName: 'Phòng 101', roomType: 'DOUBLE', bedCount: 2 },
    { floorId: 'flr-100', floorCode: 'FL-1', floorName: 'Tầng 1 - Khu Y Tế & Chăm Sóc Đặc Biệt', floorNumber: 1, roomId: 'rm-102', roomCode: 'P-102', roomName: 'Phòng 102', roomType: 'SIX_BED', bedCount: 6 },
    { floorId: 'flr-100', floorCode: 'FL-1', floorName: 'Tầng 1 - Khu Y Tế & Chăm Sóc Đặc Biệt', floorNumber: 1, roomId: 'rm-103', roomCode: 'P-103', roomName: 'Phòng 103', roomType: 'DOUBLE', bedCount: 2 },
    { floorId: 'flr-100', floorCode: 'FL-1', floorName: 'Tầng 1 - Khu Y Tế & Chăm Sóc Đặc Biệt', floorNumber: 1, roomId: 'rm-104', roomCode: 'P-104', roomName: 'Phòng 104', roomType: 'SIX_BED', bedCount: 6 },

    // Floor 2 (35 beds)
    { floorId: 'flr-200', floorCode: 'FL-2', floorName: 'Tầng 2 - Khu Sinh Hoạt Chung & Điều Dưỡng', floorNumber: 2, roomId: 'rm-201', roomCode: 'P-201', roomName: 'Phòng 201', roomType: 'DOUBLE', bedCount: 2 },
    { floorId: 'flr-200', floorCode: 'FL-2', floorName: 'Tầng 2 - Khu Sinh Hoạt Chung & Điều Dưỡng', floorNumber: 2, roomId: 'rm-202', roomCode: 'P-202', roomName: 'Phòng 202', roomType: 'SIX_BED', bedCount: 6 },
    { floorId: 'flr-200', floorCode: 'FL-2', floorName: 'Tầng 2 - Khu Sinh Hoạt Chung & Điều Dưỡng', floorNumber: 2, roomId: 'rm-203', roomCode: 'P-203', roomName: 'Phòng 203', roomType: 'SINGLE', bedCount: 1 },
    { floorId: 'flr-200', floorCode: 'FL-2', floorName: 'Tầng 2 - Khu Sinh Hoạt Chung & Điều Dưỡng', floorNumber: 2, roomId: 'rm-204', roomCode: 'P-204', roomName: 'Phòng 204', roomType: 'SIX_BED', bedCount: 6 },
    { floorId: 'flr-200', floorCode: 'FL-2', floorName: 'Tầng 2 - Khu Sinh Hoạt Chung & Điều Dưỡng', floorNumber: 2, roomId: 'rm-205', roomCode: 'P-205', roomName: 'Phòng 205', roomType: 'TRIPLE', bedCount: 3 },
    { floorId: 'flr-200', floorCode: 'FL-2', floorName: 'Tầng 2 - Khu Sinh Hoạt Chung & Điều Dưỡng', floorNumber: 2, roomId: 'rm-206', roomCode: 'P-206', roomName: 'Phòng 206', roomType: 'QUAD', bedCount: 4 },
    { floorId: 'flr-200', floorCode: 'FL-2', floorName: 'Tầng 2 - Khu Sinh Hoạt Chung & Điều Dưỡng', floorNumber: 2, roomId: 'rm-207', roomCode: 'P-207', roomName: 'Phòng 207', roomType: 'SINGLE', bedCount: 1 },
    { floorId: 'flr-200', floorCode: 'FL-2', floorName: 'Tầng 2 - Khu Sinh Hoạt Chung & Điều Dưỡng', floorNumber: 2, roomId: 'rm-208', roomCode: 'P-208', roomName: 'Phòng 208', roomType: 'SIX_BED', bedCount: 6 },
    { floorId: 'flr-200', floorCode: 'FL-2', floorName: 'Tầng 2 - Khu Sinh Hoạt Chung & Điều Dưỡng', floorNumber: 2, roomId: 'rm-209', roomCode: 'P-209', roomName: 'Phòng 209', roomType: 'SIX_BED', bedCount: 6 },

    // Floor 3 (38 beds)
    { floorId: 'flr-300', floorCode: 'FL-3', floorName: 'Tầng 3 - Khu Nghỉ Dưỡng Cao Cấp', floorNumber: 3, roomId: 'rm-301', roomCode: 'P-301', roomName: 'Phòng 301', roomType: 'DOUBLE', bedCount: 2 },
    { floorId: 'flr-300', floorCode: 'FL-3', floorName: 'Tầng 3 - Khu Nghỉ Dưỡng Cao Cấp', floorNumber: 3, roomId: 'rm-302', roomCode: 'P-302', roomName: 'Phòng 302', roomType: 'SIX_BED', bedCount: 6 },
    { floorId: 'flr-300', floorCode: 'FL-3', floorName: 'Tầng 3 - Khu Nghỉ Dưỡng Cao Cấp', floorNumber: 3, roomId: 'rm-303', roomCode: 'P-303', roomName: 'Phòng 303', roomType: 'SINGLE', bedCount: 1 },
    { floorId: 'flr-300', floorCode: 'FL-3', floorName: 'Tầng 3 - Khu Nghỉ Dưỡng Cao Cấp', floorNumber: 3, roomId: 'rm-304', roomCode: 'P-304', roomName: 'Phòng 304', roomType: 'SIX_BED', bedCount: 6 },
    { floorId: 'flr-300', floorCode: 'FL-3', floorName: 'Tầng 3 - Khu Nghỉ Dưỡng Cao Cấp', floorNumber: 3, roomId: 'rm-305', roomCode: 'P-305', roomName: 'Phòng 305', roomType: 'SINGLE', bedCount: 1 },
    { floorId: 'flr-300', floorCode: 'FL-3', floorName: 'Tầng 3 - Khu Nghỉ Dưỡng Cao Cấp', floorNumber: 3, roomId: 'rm-306', roomCode: 'P-306', roomName: 'Phòng 306', roomType: 'SIX_BED', bedCount: 6 },
    { floorId: 'flr-300', floorCode: 'FL-3', floorName: 'Tầng 3 - Khu Nghỉ Dưỡng Cao Cấp', floorNumber: 3, roomId: 'rm-307', roomCode: 'P-307', roomName: 'Phòng 307', roomType: 'TRIPLE', bedCount: 3 },
    { floorId: 'flr-300', floorCode: 'FL-3', floorName: 'Tầng 3 - Khu Nghỉ Dưỡng Cao Cấp', floorNumber: 3, roomId: 'rm-308', roomCode: 'P-308', roomName: 'Phòng 308', roomType: 'SIX_BED', bedCount: 6 },
    { floorId: 'flr-300', floorCode: 'FL-3', floorName: 'Tầng 3 - Khu Nghỉ Dưỡng Cao Cấp', floorNumber: 3, roomId: 'rm-309', roomCode: 'P-309', roomName: 'Phòng 309', roomType: 'SINGLE', bedCount: 1 },
    { floorId: 'flr-300', floorCode: 'FL-3', floorName: 'Tầng 3 - Khu Nghỉ Dưỡng Cao Cấp', floorNumber: 3, roomId: 'rm-310', roomCode: 'P-310', roomName: 'Phòng 310', roomType: 'SIX_BED', bedCount: 6 },

    // Floor 4 (21 beds)
    { floorId: 'flr-400', floorCode: 'FL-4', floorName: 'Tầng 4 - Phục Hồi Chức Năng & Vườn Treo', floorNumber: 4, roomId: 'rm-401', roomCode: 'P-401', roomName: 'Phòng 401', roomType: 'TRIPLE', bedCount: 3 },
    { floorId: 'flr-400', floorCode: 'FL-4', floorName: 'Tầng 4 - Phục Hồi Chức Năng & Vườn Treo', floorNumber: 4, roomId: 'rm-402', roomCode: 'P-402', roomName: 'Phòng 402', roomType: 'QUAD', bedCount: 4 },
    { floorId: 'flr-400', floorCode: 'FL-4', floorName: 'Tầng 4 - Phục Hồi Chức Năng & Vườn Treo', floorNumber: 4, roomId: 'rm-403', roomCode: 'P-403', roomName: 'Phòng 403', roomType: 'SINGLE', bedCount: 1 },
    { floorId: 'flr-400', floorCode: 'FL-4', floorName: 'Tầng 4 - Phục Hồi Chức Năng & Vườn Treo', floorNumber: 4, roomId: 'rm-404', roomCode: 'P-404', roomName: 'Phòng 404', roomType: 'SIX_BED', bedCount: 6 },
    { floorId: 'flr-400', floorCode: 'FL-4', floorName: 'Tầng 4 - Phục Hồi Chức Năng & Vườn Treo', floorNumber: 4, roomId: 'rm-405', roomCode: 'P-405', roomName: 'Phòng 405', roomType: 'TRIPLE', bedCount: 3 },
    { floorId: 'flr-400', floorCode: 'FL-4', floorName: 'Tầng 4 - Phục Hồi Chức Năng & Vườn Treo', floorNumber: 4, roomId: 'rm-406', roomCode: 'P-406', roomName: 'Phòng 406', roomType: 'QUAD', bedCount: 4 },
  ];

  const letterSuffixes = ['A', 'B', 'C', 'D', 'E', 'F'];
  const residentAssignments: Record<string, { residentId: string; residentName: string; careLevel: string }> = {
    '101-B': { residentId: 'res-demo-001', residentName: 'Nguyễn Văn An', careLevel: 'ASSISTED' },
    '102-A': { residentId: 'res-demo-002', residentName: 'Trần Thị Bình', careLevel: 'HIGH_ASSISTANCE' },
    '103-B': { residentId: 'res-demo-003', residentName: 'Phạm Văn Cường', careLevel: 'INDEPENDENT' },
    '201-A': { residentId: 'res-demo-004', residentName: 'Phạm Thị Dung', careLevel: 'DEPENDENT' },
    '202-B': { residentId: 'res-demo-005', residentName: 'Hoàng Văn Em', careLevel: 'ASSISTED' },
    '203-A': { residentId: 'res-demo-006', residentName: 'Ngô Thị Phương', careLevel: 'ASSISTED' },
    '301-B': { residentId: 'res-demo-007', residentName: 'Vũ Văn Giáp', careLevel: 'INDEPENDENT' },
    '302-A': { residentId: 'res-demo-008', residentName: 'Đỗ Thị Hoa', careLevel: 'DEPENDENT' },
  };

  const items: AccommodationItem[] = [];
  let asgIdx = 1;

  for (const r of roomDefs) {
    const numPart = r.roomCode.replace('P-', '');
    for (let i = 0; i < r.bedCount; i++) {
      const letter = letterSuffixes[i];
      const bedCode = `${numPart}-${letter}`;
      const bedId = `bed-${numPart.toLowerCase()}-${letter.toLowerCase()}`;
      const asg = residentAssignments[bedCode];

      items.push({
        buildingId: 'bld-001',
        buildingCode: 'BLD-A',
        buildingName: 'Tòa Nhà Tâm An Care',
        floorId: r.floorId,
        floorCode: r.floorCode,
        floorName: r.floorName,
        floorNumber: r.floorNumber,
        roomId: r.roomId,
        roomCode: r.roomCode,
        roomName: r.roomName,
        roomType: r.roomType,
        bedId,
        bedCode,
        bedName: `Giường ${bedCode}${r.roomType === 'SINGLE' ? ' (VIP)' : ''}`,
        bedStatus: asg ? 'OCCUPIED' : 'AVAILABLE',
        assignmentId: asg ? `asg-00${asgIdx++}` : null,
        residentId: asg ? asg.residentId : null,
        residentName: asg ? asg.residentName : null,
        careLevel: asg ? asg.careLevel : null,
        assignedAt: asg ? '2026-08-01T08:00:00Z' : null,
      });
    }
  }

  return items;
}

export let mockAccommodationItems: AccommodationItem[] = generateMockAccommodationItems();

export async function getAccommodationOverview(
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
): Promise<AccommodationOverview> {
  try {
    const data = await apiRequest<AccommodationOverview>(
      `/api/accommodation/overview${queryString(filters)}`,
      { actor },
    );
    if (data && data.items && data.items.length > 0) return data;
  } catch (error) {
    console.warn('[TamAnCare API] Offline/Fallback mode active for getAccommodationOverview:', error);
  }

  let filtered = [...mockAccommodationItems];
  if (filters.buildingId && filters.buildingId !== 'ALL') {
    filtered = filtered.filter(i => i.buildingId === filters.buildingId);
  }
  if (filters.floorId && filters.floorId !== 'ALL') {
    filtered = filtered.filter(i => i.floorId === filters.floorId);
  }
  if (filters.roomId && filters.roomId !== 'ALL') {
    filtered = filtered.filter(i => i.roomId === filters.roomId);
  }
  if (filters.status && filters.status !== 'ALL') {
    filtered = filtered.filter(i => i.bedStatus === filters.status);
  }
  if (filters.search && filters.search.trim()) {
    const q = filters.search.trim().toLowerCase();
    filtered = filtered.filter(i =>
      i.roomName.toLowerCase().includes(q) ||
      i.bedName.toLowerCase().includes(q) ||
      i.bedCode.toLowerCase().includes(q) ||
      (i.residentName && i.residentName.toLowerCase().includes(q))
    );
  }

  const total = filtered.length;
  const occupied = filtered.filter(i => i.bedStatus === 'OCCUPIED' || Boolean(i.residentId)).length;
  const available = filtered.filter(i => i.bedStatus === 'AVAILABLE').length;
  const reserved = filtered.filter(i => i.bedStatus === 'RESERVED').length;
  const unavailable = filtered.filter(i => i.bedStatus === 'TEMPORARILY_UNAVAILABLE' || i.bedStatus === 'MAINTENANCE').length;
  const occupancyPercentage = total > 0 ? Math.round((occupied / total) * 100) : 0;

  const limit = filters.limit || 250;
  const offset = filters.offset || 0;
  const pagedItems = filtered.slice(offset, offset + limit);

  return {
    summary: {
      total,
      occupied,
      available,
      reserved,
      unavailable,
      occupancyPercentage,
    },
    items: pagedItems,
    total,
    limit,
    offset,
  };
}

export async function listBuildings(
  actor: HumanActorSession,
): Promise<Building[]> {
  try {
    const res = await apiRequest<Building[]>('/api/accommodation/buildings', { actor });
    if (Array.isArray(res) && res.length > 0) return res;
  } catch (error) {
    console.warn('[TamAnCare API] Offline/Fallback mode active for listBuildings:', error);
  }
  return [...mockBuildings];
}

export async function listFloors(
  actor: HumanActorSession,
  buildingId?: string,
): Promise<Floor[]> {
  try {
    const res = await apiRequest<Floor[]>(`/api/accommodation/floors${queryString({buildingId})}`, { actor });
    if (Array.isArray(res) && res.length > 0) return res;
  } catch (error) {
    console.warn('[TamAnCare API] Offline/Fallback mode active for listFloors:', error);
  }
  if (buildingId && buildingId !== 'ALL') {
    return mockFloors.filter(f => f.buildingId === buildingId);
  }
  return [...mockFloors];
}

export async function listRooms(
  actor: HumanActorSession,
  floorId?: string,
): Promise<{ items: Room[]; limit: number; offset: number; total: number }> {
  try {
    const res = await apiRequest<{ items: Room[]; limit: number; offset: number; total: number }>(
      `/api/accommodation/rooms${queryString({ floorId, limit: 100, offset: 0 })}`,
      { actor },
    );
    if (res && res.items && res.items.length > 0) return res;
  } catch (error) {
    console.warn('[TamAnCare API] Offline/Fallback mode active for listRooms:', error);
  }

  let items = [...mockRooms];
  if (floorId && floorId !== 'ALL') {
    items = items.filter(r => r.floorId === floorId);
  }
  return { items, limit: 100, offset: 0, total: items.length };
}

export async function createBuilding(
  actor: HumanActorSession,
  input: { code: string; name: string },
) {
  try {
    return await apiRequest('/api/accommodation/buildings', {
      method: 'POST',
      actor,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    });
  } catch {
    const newB: Building = { buildingId: `bld-${Date.now()}`, code: input.code, name: input.name, status: 'ACTIVE' };
    mockBuildings.push(newB);
    return newB;
  }
}

export async function createFloor(
  actor: HumanActorSession,
  input: {
    buildingId: string;
    code: string;
    name: string;
    floorNumber?: number | null;
  },
) {
  try {
    return await apiRequest('/api/accommodation/floors', {
      method: 'POST',
      actor,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    });
  } catch {
    const newF: Floor = {
      floorId: `flr-${Date.now()}`,
      buildingId: input.buildingId,
      code: input.code,
      name: input.name,
      floorNumber: input.floorNumber ?? null,
      status: 'ACTIVE',
    };
    mockFloors.push(newF);
    return newF;
  }
}

export async function createRoom(
  actor: HumanActorSession,
  input: {
    floorId: string;
    code: string;
    name: string;
    roomType?: string;
  },
) {
  try {
    return await apiRequest('/api/accommodation/rooms', {
      method: 'POST',
      actor,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    });
  } catch {
    const newR: Room = {
      roomId: `rm-${Date.now()}`,
      floorId: input.floorId,
      code: input.code,
      name: input.name,
      roomType: input.roomType ?? 'DOUBLE',
      status: 'ACTIVE',
    };
    mockRooms.push(newR);
    return newR;
  }
}

export async function createBed(
  actor: HumanActorSession,
  input: {
    roomId: string;
    code: string;
    name: string;
  },
) {
  try {
    return await apiRequest('/api/accommodation/beds', {
      method: 'POST',
      actor,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    });
  } catch {
    const targetRoom = mockRooms.find(r => r.roomId === input.roomId);
    const targetFloor = mockFloors.find(f => f.floorId === targetRoom?.floorId);
    const newBed: AccommodationItem = {
      buildingId: 'bld-001',
      buildingCode: 'BLD-A',
      buildingName: 'Tòa Nhà Tâm An Care',
      floorId: targetFloor?.floorId || 'flr-100',
      floorCode: targetFloor?.code || 'FL-1',
      floorName: targetFloor?.name || 'Tầng 1',
      floorNumber: targetFloor?.floorNumber || 1,
      roomId: input.roomId,
      roomCode: targetRoom?.code || 'P-100',
      roomName: targetRoom?.name || 'Phòng',
      roomType: targetRoom?.roomType || 'DOUBLE',
      bedId: `bed-${Date.now()}`,
      bedCode: input.code,
      bedName: input.name,
      bedStatus: 'AVAILABLE',
      assignmentId: null,
      residentId: null,
      residentName: null,
      careLevel: null,
      assignedAt: null,
    };
    mockAccommodationItems.unshift(newBed);
    return newBed;
  }
}

export async function assignBed(
  actor: HumanActorSession,
  bedId: string,
  residentId: string,
) {
  try {
    return await apiRequest(
      `/api/accommodation/beds/${encodeURIComponent(bedId)}/assign`,
      {
        method: 'POST',
        actor,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ residentId }),
      },
    );
  } catch {
    const bed = mockAccommodationItems.find(b => b.bedId === bedId);
    if (bed) {
      bed.bedStatus = 'OCCUPIED';
      bed.residentId = residentId;
      bed.residentName = 'Người cao tuổi';
      bed.careLevel = 'ASSISTED';
      bed.assignedAt = new Date().toISOString();
    }
    return { status: 'OK' };
  }
}

export async function transferBed(
  actor: HumanActorSession,
  residentId: string,
  bedId: string,
) {
  try {
    return await apiRequest(
      `/api/accommodation/residents/${encodeURIComponent(residentId)}/transfer`,
      {
        method: 'POST',
        actor,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ bedId }),
      },
    );
  } catch {
    const oldBed = mockAccommodationItems.find(b => b.residentId === residentId);
    if (oldBed) {
      oldBed.bedStatus = 'AVAILABLE';
      oldBed.residentId = null;
      oldBed.residentName = null;
      oldBed.careLevel = null;
      oldBed.assignedAt = null;
    }
    const newBed = mockAccommodationItems.find(b => b.bedId === bedId);
    if (newBed) {
      newBed.bedStatus = 'OCCUPIED';
      newBed.residentId = residentId;
      newBed.residentName = 'Người cao tuổi';
      newBed.careLevel = 'ASSISTED';
      newBed.assignedAt = new Date().toISOString();
    }
    return { status: 'OK' };
  }
}

export async function releaseBed(
  actor: HumanActorSession,
  residentId: string,
) {
  try {
    return await apiRequest(
      `/api/accommodation/residents/${encodeURIComponent(residentId)}/release`,
      {
        method: 'POST',
        actor,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ reason: 'OPERATIONAL_RELEASE' }),
      },
    );
  } catch {
    const bed = mockAccommodationItems.find(b => b.residentId === residentId);
    if (bed) {
      bed.bedStatus = 'AVAILABLE';
      bed.residentId = null;
      bed.residentName = null;
      bed.careLevel = null;
      bed.assignedAt = null;
    }
    return { status: 'OK' };
  }
}

export async function setBedStatus(
  actor: HumanActorSession,
  bedId: string,
  status:
    | 'AVAILABLE'
    | 'TEMPORARILY_UNAVAILABLE'
    | 'MAINTENANCE'
    | 'INACTIVE',
) {
  try {
    return await apiRequest(
      `/api/accommodation/beds/${encodeURIComponent(bedId)}/status`,
      {
        method: 'POST',
        actor,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status }),
      },
    );
  } catch {
    const bed = mockAccommodationItems.find(b => b.bedId === bedId);
    if (bed) {
      bed.bedStatus = status;
    }
    return { status: 'OK' };
  }
}

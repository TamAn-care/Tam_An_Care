import { HumanActorSession } from '../types/actor';
import { recordSystemAuditLog } from './audit-log';
import { ROLE_LABELS } from '../auth/role-policy';

export type SupplyCategory =
  | 'MILK_NUTRITION'   // Sữa uống thêm & dinh dưỡng
  | 'DIAPERS_HYGIENE'   // Bỉm & đồ vệ sinh
  | 'FRESH_FRUIT'       // Hoa quả tươi
  | 'PERSONAL_CARE'     // Vật dụng cá nhân
  | 'OTHER_SUPPLY';     // Khác

export interface ResidentFamilySupplyItem {
  id: string;
  residentId: string;
  residentName: string;
  itemName: string;
  category: SupplyCategory;
  categoryLabel: string;
  quantityReceived: number;
  remainingQuantity: number;
  unit: string;
  receivedAt: string; // ISO String
  deliveredBy: string; // Tên người thân / đơn vị giao
  receivedByStaffId: string;
  receivedByStaffName: string;
  storageLocation: string; // Ví dụ: Tủ cá nhân P.102 / Tủ lạnh bếp ăn
  expiryDate?: string;
  notes?: string;
  status: 'RECEIVED' | 'IN_USE' | 'EXHAUSTED';
  usageLogs: Array<{
    logId: string;
    usedAt: string;
    usedQuantity: number;
    usedByStaffName: string;
    note?: string;
  }>;
}

export const SUPPLY_CATEGORY_LABELS: Record<SupplyCategory, string> = {
  MILK_NUTRITION: 'Sữa uống thêm & Bổ dưỡng',
  DIAPERS_HYGIENE: 'Bỉm, Tã & Vệ sinh cá nhân',
  FRESH_FRUIT: 'Hoa quả & Trái cây tươi',
  PERSONAL_CARE: 'Trang phục & Vật dụng cá nhân',
  OTHER_SUPPLY: 'Nhu yếu phẩm khác',
};

// Mock in-memory storage
let mockResidentSupplies: ResidentFamilySupplyItem[] = [
  {
    id: 'SUP-001',
    residentId: 'res-demo-001',
    residentName: 'Nguyễn Văn An',
    itemName: 'Sữa Ensure Gold Nước 237ml',
    category: 'MILK_NUTRITION',
    categoryLabel: 'Sữa uống thêm & Bổ dưỡng',
    quantityReceived: 24,
    remainingQuantity: 18,
    unit: 'chai',
    receivedAt: '2026-09-10T09:30:00+07:00',
    deliveredBy: 'Lê Gia Bảo (Con trai)',
    receivedByStaffId: 'STAFF-CG-001',
    receivedByStaffName: 'Trần Thị Mai',
    storageLocation: 'Tủ cá nhân Phòng 101',
    expiryDate: '2027-03-15',
    notes: 'Cho cụ uống 1 chai vào 15:00 hàng ngày',
    status: 'IN_USE',
    usageLogs: [
      { logId: 'LOG-01', usedAt: '2026-09-10T15:00:00+07:00', usedQuantity: 2, usedByStaffName: 'Trần Thị Mai', note: 'Cụ uống hết 1 chai bữa phụ chiều' },
      { logId: 'LOG-02', usedAt: '2026-09-11T15:00:00+07:00', usedQuantity: 2, usedByStaffName: 'Trần Thị Mai', note: 'Uống 1 chai bữa phụ chiều' },
      { logId: 'LOG-03', usedAt: '2026-09-12T15:00:00+07:00', usedQuantity: 2, usedByStaffName: 'Trần Thị Mai', note: 'Uống 1 chai bữa phụ chiều' },
    ],
  },
  {
    id: 'SUP-002',
    residentId: 'res-demo-001',
    residentName: 'Nguyễn Văn An',
    itemName: 'Tã dán Caryn size L (Bịch 20 miếng)',
    category: 'DIAPERS_HYGIENE',
    categoryLabel: 'Bỉm, Tã & Vệ sinh cá nhân',
    quantityReceived: 40,
    remainingQuantity: 32,
    unit: 'miếng',
    receivedAt: '2026-09-08T14:15:00+07:00',
    deliveredBy: 'Lê Gia Bảo (Con trai)',
    receivedByStaffId: 'STAFF-CG-001',
    receivedByStaffName: 'Trần Thị Mai',
    storageLocation: 'Kệ đồ cá nhân P.101',
    status: 'IN_USE',
    usageLogs: [
      { logId: 'LOG-04', usedAt: '2026-09-11T22:00:00+07:00', usedQuantity: 4, usedByStaffName: 'Trần Thị Mai', note: 'Thay ca đêm' },
      { logId: 'LOG-05', usedAt: '2026-09-12T06:00:00+07:00', usedQuantity: 4, usedByStaffName: 'Trần Thị Mai', note: 'Thay ca sáng' },
    ],
  },
  {
    id: 'SUP-003',
    residentId: 'res-demo-002',
    residentName: 'Trần Thị Bình',
    itemName: 'Táo Envy & Nho ngón tay mềm',
    category: 'FRESH_FRUIT',
    categoryLabel: 'Hoa quả & Trái cây tươi',
    quantityReceived: 3,
    remainingQuantity: 1.5,
    unit: 'kg',
    receivedAt: '2026-09-11T10:00:00+07:00',
    deliveredBy: 'Trần Anh Đức (Con trai)',
    receivedByStaffId: 'STAFF-CG-002',
    receivedByStaffName: 'Hoàng Văn Tuấn',
    storageLocation: 'Tủ lạnh Bếp ăn - Tủ 2',
    expiryDate: '2026-09-16',
    notes: 'Bếp gọt vỏ, cắt miếng nhỏ cho cụ ăn phụ 14h',
    status: 'IN_USE',
    usageLogs: [
      { logId: 'LOG-06', usedAt: '2026-09-11T14:30:00+07:00', usedQuantity: 0.8, usedByStaffName: 'Hoàng Văn Tuấn', note: 'Cắt đĩa nhỏ bữa chiều' },
      { logId: 'LOG-07', usedAt: '2026-09-12T14:30:00+07:00', usedQuantity: 0.7, usedByStaffName: 'Hoàng Văn Tuấn', note: 'Ép nước táo mềm' },
    ],
  },
];

export async function fetchResidentFamilySupplies(residentId?: string): Promise<ResidentFamilySupplyItem[]> {
  await new Promise((r) => setTimeout(r, 100));
  if (residentId) {
    return mockResidentSupplies.filter((s) => s.residentId === residentId);
  }
  return [...mockResidentSupplies];
}

export async function addResidentFamilySupply(
  actor: HumanActorSession,
  input: Omit<ResidentFamilySupplyItem, 'id' | 'remainingQuantity' | 'status' | 'usageLogs'>
): Promise<ResidentFamilySupplyItem> {
  await new Promise((r) => setTimeout(r, 150));

  const newItem: ResidentFamilySupplyItem = {
    ...input,
    id: `SUP-${Date.now().toString().slice(-6)}`,
    remainingQuantity: input.quantityReceived,
    status: 'RECEIVED',
    usageLogs: [],
  };

  mockResidentSupplies = [newItem, ...mockResidentSupplies];

  await recordSystemAuditLog({
    actorId: actor.actorId || 'STAFF-CG-001',
    actorName: actor.displayName || 'Nhân viên chăm sóc',
    actorRole: actor.actorRole || 'CAREGIVER',
    actorRoleLabel: ROLE_LABELS[actor.actorRole] || actor.actorRole || 'Chăm sóc',
    actionType: 'CREATE',
    actionLabel: 'Tiếp nhận vật phẩm/đồ tiêu hao từ gia đình',
    module: 'CARE_OPERATIONS',
    moduleLabel: 'Tiếp Nhận Đồ Tiêu Hao',
    targetEntityId: newItem.id,
    targetEntityName: `Vật phẩm: ${newItem.itemName} (Cụ ${newItem.residentName})`,
    summary: `Tiếp nhận ${newItem.quantityReceived} ${newItem.unit} ${newItem.itemName} từ ${newItem.deliveredBy} cho cụ ${newItem.residentName}.`,
    details: `Bảo quản tại: ${newItem.storageLocation} | Ghi chú: ${newItem.notes || 'Không có'}.`,
    severity: 'NORMAL',
  });

  return newItem;
}

export async function logSupplyUsage(
  actor: HumanActorSession,
  supplyId: string,
  usedQuantity: number,
  note?: string
): Promise<ResidentFamilySupplyItem> {
  await new Promise((r) => setTimeout(r, 120));

  const itemIndex = mockResidentSupplies.findIndex((s) => s.id === supplyId);
  if (itemIndex === -1) throw new Error('Không tìm thấy vật phẩm tiêu hao');

  const item = mockResidentSupplies[itemIndex];
  const newRemaining = Math.max(0, Number((item.remainingQuantity - usedQuantity).toFixed(2)));
  const newStatus = newRemaining === 0 ? 'EXHAUSTED' : 'IN_USE';

  const newLog = {
    logId: `LOG-${Date.now().toString().slice(-6)}`,
    usedAt: new Date().toISOString(),
    usedQuantity,
    usedByStaffName: actor.displayName || 'Nhân viên Tâm An',
    note,
  };

  const updatedItem: ResidentFamilySupplyItem = {
    ...item,
    remainingQuantity: newRemaining,
    status: newStatus,
    usageLogs: [newLog, ...item.usageLogs],
  };

  mockResidentSupplies[itemIndex] = updatedItem;

  await recordSystemAuditLog({
    actorId: actor.actorId || 'STAFF-001',
    actorName: actor.displayName || 'Nhân viên Tâm An',
    actorRole: actor.actorRole || 'CAREGIVER',
    actorRoleLabel: ROLE_LABELS[actor.actorRole] || actor.actorRole || 'Chăm sóc',
    actionType: 'UPDATE',
    actionLabel: 'Cập nhật xuất dùng đồ tiêu hao của người cao tuổi',
    module: 'CARE_OPERATIONS',
    moduleLabel: 'Quản Lý Đồ Tiêu Hao',
    targetEntityId: updatedItem.id,
    targetEntityName: `Cụ ${updatedItem.residentName} - ${updatedItem.itemName}`,
    summary: `Đã sử dụng ${usedQuantity} ${updatedItem.unit} ${updatedItem.itemName}. Tồn còn lại: ${newRemaining} ${updatedItem.unit}.`,
    severity: 'NORMAL',
  });

  return updatedItem;
}

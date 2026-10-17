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
  minSafetyThreshold?: number; // Ngưỡng tối thiểu cảnh báo sắp hết (mặc định 5)
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
// NO SEED DATA — Production-ready empty state
let mockResidentSupplies: ResidentFamilySupplyItem[] = [];

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

export async function updateResidentSupplyThreshold(
  actor: HumanActorSession,
  supplyId: string,
  newMinThreshold: number,
  note?: string,
): Promise<ResidentFamilySupplyItem> {
  const itemIndex = mockResidentSupplies.findIndex((s) => s.id === supplyId);
  if (itemIndex === -1) throw new Error('Không tìm thấy vật phẩm tiêu hao');

  const item = mockResidentSupplies[itemIndex];
  const oldThreshold = item.minSafetyThreshold || 5;
  const sanitizedThreshold = Math.max(0, Math.round(newMinThreshold));

  const updatedItem: ResidentFamilySupplyItem = {
    ...item,
    minSafetyThreshold: sanitizedThreshold,
  };

  mockResidentSupplies[itemIndex] = updatedItem;

  await recordSystemAuditLog({
    actorId: actor.actorId || 'STAFF-001',
    actorName: actor.displayName || 'Nhân viên Tâm An',
    actorRole: actor.actorRole || 'CAREGIVER',
    actorRoleLabel: ROLE_LABELS[actor.actorRole] || actor.actorRole || 'Chăm sóc',
    actionType: 'UPDATE',
    actionLabel: 'Cập nhật ngưỡng an toàn vật tư cá nhân cụ gửi',
    module: 'CARE_OPERATIONS',
    moduleLabel: 'Quản Lý Đồ Tiêu Hao',
    targetEntityId: updatedItem.id,
    targetEntityName: `Cụ ${updatedItem.residentName} - ${updatedItem.itemName}`,
    summary: `Đã điều chỉnh ngưỡng tối thiểu của "${updatedItem.itemName}" từ ${oldThreshold} ${updatedItem.unit} sang ${sanitizedThreshold} ${updatedItem.unit}.`,
    details: `Tồn hiện tại: ${updatedItem.remainingQuantity} ${updatedItem.unit} | Ngưỡng cũ: ${oldThreshold} | Ngưỡng mới: ${sanitizedThreshold} | Ghi chú: ${note || 'Phù hợp nhu cầu thực tế của Cụ'}.`,
    previousValue: `${oldThreshold} ${updatedItem.unit}`,
    newValue: `${sanitizedThreshold} ${updatedItem.unit}`,
    severity: 'NORMAL',
  });

  return updatedItem;
}

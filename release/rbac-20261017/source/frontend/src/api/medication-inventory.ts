import type { HumanActorSession } from '../types/actor';
import { recordSystemAuditLog } from './audit-log';

export type MedicationRoute =
  | 'ORAL'
  | 'INJECTION'
  | 'TOPICAL'
  | 'OPHTHALMIC'
  | 'INHALATION';

export type TimingSlot = 'MORNING' | 'NOON' | 'AFTERNOON' | 'EVENING' | 'PRN';

export type MealInstruction =
  | 'BEFORE_MEAL'
  | 'AFTER_MEAL'
  | 'WITH_MEAL'
  | 'BEDTIME'
  | 'ANYTIME';

export type MedicationStatus = 'ACTIVE' | 'DISCONTINUED' | 'COMPLETED';

export type AdministrationStatus =
  | 'PENDING'
  | 'GIVEN'
  | 'REFUSED'
  | 'HELD'
  | 'MISSED';

export interface MedicationOrder {
  orderId: string;
  residentId: string;
  residentName: string;
  room: string;
  bed: string;
  drugName: string;
  brandName?: string;
  dosage: string;
  route: MedicationRoute;
  timingSlots: TimingSlot[];
  instruction: MealInstruction;
  prescribedBy: string;
  startDate: string;
  endDate?: string;
  status: MedicationStatus;
  orderDate?: string;
  isLocked?: boolean;
  copiedFromOrderId?: string;
  allergyWarning?: string;
  diagnosisNote?: string;
}

export interface MedicationAdministration {
  adminId: string;
  orderId: string;
  residentId: string;
  residentName: string;
  room: string;
  bed: string;
  drugName: string;
  brandName?: string;
  dosage: string;
  route: MedicationRoute;
  timingSlot: TimingSlot;
  scheduledDate: string;
  scheduledTime: string;
  instruction: MealInstruction;
  status: AdministrationStatus;
  administeredBy?: string;
  administeredAt?: string;
  notes?: string;
  allergyWarning?: string;
}

export type InventoryCategory =
  | 'DIAGNOSTIC'
  | 'HYGIENE'
  | 'WOUND_CARE'
  | 'CONSUMABLES'
  | 'MEDICINE_SUPPLY';

export interface MedicalInventoryItem {
  itemId: string;
  itemCode: string;
  name: string;
  category: InventoryCategory;
  itemGroup: 'PHARMACEUTICALS' | 'CARE_SUPPLIES'; // (1) Dược phẩm | (2) Vật tư chăm sóc NCT
  unit: string;
  currentStock: number;
  minStockThreshold: number;
  lotNumber: string;
  expiryDate: string;
  unitPrice: number;
  location: string;
}

export interface InventoryTransaction {
  transactionId: string;
  itemId: string;
  itemName: string;
  type: 'IMPORT' | 'EXPORT_RESIDENT' | 'EXPORT_DEPARTMENT' | 'AUDIT_ADJUSTMENT';
  quantity: number;
  unit: string;
  performedBy: string;
  timestamp: string;
  residentId?: string;
  residentName?: string;
  reason?: string;
}

// Initial Mock Orders
// NO SEED DATA — Production-ready empty state
const INITIAL_ORDERS: MedicationOrder[] = [];

// Initial Administrations for Today
const todayStr = new Date().toISOString().slice(0, 10);

// NO SEED DATA — Production-ready empty state
const INITIAL_ADMINS: MedicationAdministration[] = [];

// Initial Medical Consumables Inventory
// NO SEED DATA — Production-ready empty state
const INITIAL_INVENTORY: MedicalInventoryItem[] = [];

// In-Memory Storage
let medicationOrders: MedicationOrder[] = [...INITIAL_ORDERS];
let medicationAdmins: MedicationAdministration[] = [...INITIAL_ADMINS];
let inventoryItems: MedicalInventoryItem[] = [...INITIAL_INVENTORY];
// NO SEED DATA — Production-ready empty state
let inventoryTransactions: InventoryTransaction[] = [];

// API Functions
export async function fetchMedicationOrders(
  actor: HumanActorSession,
  filters?: { residentId?: string; status?: MedicationStatus },
): Promise<MedicationOrder[]> {
  let result = [...medicationOrders];
  if (filters?.residentId) {
    result = result.filter((o) => o.residentId === filters.residentId);
  }
  if (filters?.status) {
    result = result.filter((o) => o.status === filters.status);
  }
  return result;
}

export async function createMedicationOrder(
  actor: HumanActorSession,
  payload: Omit<MedicationOrder, 'orderId' | 'status'>,
): Promise<MedicationOrder> {
  const newOrder: MedicationOrder = {
    ...payload,
    orderId: `med-ord-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    status: 'ACTIVE',
    orderDate: payload.orderDate || payload.startDate || todayStr,
    isLocked: true, // Immutability: Once saved/approved, order is locked
  };
  medicationOrders = [newOrder, ...medicationOrders];

  // Auto-generate administration slots for today
  for (const slot of newOrder.timingSlots) {
    let time = '07:30';
    if (slot === 'NOON') time = '11:30';
    if (slot === 'AFTERNOON') time = '16:30';
    if (slot === 'EVENING') time = '20:00';
    if (slot === 'PRN') time = 'Khi cần';

    medicationAdmins.push({
      adminId: `adm-${Date.now()}-${slot}-${Math.floor(Math.random() * 1000)}`,
      orderId: newOrder.orderId,
      residentId: newOrder.residentId,
      residentName: newOrder.residentName,
      room: newOrder.room,
      bed: newOrder.bed,
      drugName: `${newOrder.drugName} (${newOrder.brandName || ''})`,
      dosage: newOrder.dosage,
      route: newOrder.route,
      timingSlot: slot,
      scheduledDate: newOrder.orderDate || todayStr,
      scheduledTime: time,
      instruction: newOrder.instruction,
      status: 'PENDING',
      allergyWarning: newOrder.allergyWarning,
    });
  }

  return newOrder;
}

export async function fetchPreviousDayOrders(
  actor: HumanActorSession,
  residentId?: string,
  targetDate?: string,
): Promise<MedicationOrder[]> {
  let orders = medicationOrders.filter((o) => o.status === 'ACTIVE');
  if (residentId) {
    orders = orders.filter((o) => o.residentId === residentId);
  }
  return orders;
}

export async function copyMedicationOrders(
  actor: HumanActorSession,
  payload: {
    residentId: string;
    sourceOrderIds: string[];
    targetDate?: string;
    customizations?: Record<string, Partial<MedicationOrder>>;
  },
): Promise<MedicationOrder[]> {
  const targetDateStr = payload.targetDate || todayStr;
  const createdOrders: MedicationOrder[] = [];

  for (const sourceId of payload.sourceOrderIds) {
    const source = medicationOrders.find((o) => o.orderId === sourceId);
    if (!source) continue;

    const custom = payload.customizations?.[sourceId] || {};
    const newOrderPayload: Omit<MedicationOrder, 'orderId' | 'status'> = {
      residentId: source.residentId,
      residentName: source.residentName,
      room: source.room,
      bed: source.bed,
      drugName: custom.drugName || source.drugName,
      brandName: custom.brandName !== undefined ? custom.brandName : source.brandName,
      dosage: custom.dosage || source.dosage,
      route: custom.route || source.route,
      timingSlots: custom.timingSlots || [...source.timingSlots],
      instruction: custom.instruction || source.instruction,
      prescribedBy: actor.displayName || source.prescribedBy || 'Bác sĩ điều trị',
      startDate: targetDateStr,
      orderDate: targetDateStr,
      isLocked: true,
      allergyWarning: source.allergyWarning,
      diagnosisNote: source.diagnosisNote,
      copiedFromOrderId: source.orderId,
    };

    const created = await createMedicationOrder(actor, newOrderPayload);
    createdOrders.push(created);
  }

  await recordSystemAuditLog({
    actorId: actor.actorId || 'STAFF-DOC-001',
    actorName: actor.displayName || 'Bác sĩ / Y tế',
    actorRole: actor.actorRole || 'NURSE',
    actorRoleLabel: actor.actorRole === 'NURSE' ? 'Nhân viên y tế' : 'Bác sĩ điều trị',
    actionType: 'PRESCRIPTION_ADDED',
    actionLabel: 'Sao chép Y Lệnh hôm trước',
    module: 'MEDICATION_EMAR',
    moduleLabel: 'Y Lệnh Thuốc & eMAR',
    targetEntityId: payload.residentId,
    targetEntityName: `Cụ ID: ${payload.residentId}`,
    residentId: payload.residentId,
    summary: `Sao chép ${createdOrders.length} y lệnh thuốc cho cụ ${payload.residentId} cho ngày ${targetDateStr}`,
    severity: 'NORMAL',
  });

  return createdOrders;
}

export async function discontinueMedicationOrder(
  actor: HumanActorSession,
  orderId: string,
  reason?: string,
): Promise<MedicationOrder> {
  const orderIndex = medicationOrders.findIndex((o) => o.orderId === orderId);
  if (orderIndex === -1) throw new Error('Không tìm thấy y lệnh thuốc');
  
  medicationOrders[orderIndex] = {
    ...medicationOrders[orderIndex],
    status: 'DISCONTINUED',
    isLocked: true,
  };

  await recordSystemAuditLog({
    actorId: actor.actorId || 'STAFF-DOC-001',
    actorName: actor.displayName || 'Bác sĩ / Y tế',
    actorRole: actor.actorRole || 'NURSE',
    actorRoleLabel: actor.actorRole === 'NURSE' ? 'Nhân viên y tế' : 'Bác sĩ điều trị',
    actionType: 'PRESCRIPTION_ADDED',
    actionLabel: 'Ngưng Y Lệnh Thuốc',
    module: 'MEDICATION_EMAR',
    moduleLabel: 'Y Lệnh Thuốc & eMAR',
    targetEntityId: orderId,
    targetEntityName: `Y lệnh: ${medicationOrders[orderIndex].drugName}`,
    summary: `Ngưng y lệnh ${medicationOrders[orderIndex].drugName} (${orderId}). Lý do: ${reason || 'Chỉ định bác sĩ'}`,
    severity: 'IMPORTANT',
  });

  return medicationOrders[orderIndex];
}

export async function fetchDailyAdministrations(
  actor: HumanActorSession,
  filters?: { date?: string; timingSlot?: TimingSlot; residentId?: string },
): Promise<MedicationAdministration[]> {
  let result = [...medicationAdmins];
  if (filters?.date) {
    result = result.filter((a) => a.scheduledDate === filters.date);
  }
  if (filters?.timingSlot) {
    result = result.filter((a) => a.timingSlot === filters.timingSlot);
  }
  if (filters?.residentId) {
    result = result.filter((a) => a.residentId === filters.residentId);
  }
  return result;
}

export async function updateAdministrationStatus(
  actor: HumanActorSession,
  adminId: string,
  status: AdministrationStatus,
  notes?: string,
): Promise<MedicationAdministration> {
  const index = medicationAdmins.findIndex((a) => a.adminId === adminId);
  if (index === -1) throw new Error('Không tìm thấy bản ghi cấp phát thuốc.');

  const updated: MedicationAdministration = {
    ...medicationAdmins[index],
    status,
    notes: notes ?? medicationAdmins[index].notes,
    administeredBy: status === 'GIVEN' ? (actor.displayName || actor.actorId) : medicationAdmins[index].administeredBy,
    administeredAt: status === 'GIVEN' ? new Date().toISOString() : undefined,
  };

  medicationAdmins[index] = updated;
  return updated;
}

export async function fetchInventoryItems(
  actor: HumanActorSession,
  filters?: { category?: InventoryCategory; lowStockOnly?: boolean },
): Promise<MedicalInventoryItem[]> {
  let result = [...inventoryItems];
  if (filters?.category) {
    result = result.filter((i) => i.category === filters.category);
  }
  if (filters?.lowStockOnly) {
    result = result.filter((i) => i.currentStock <= i.minStockThreshold);
  }
  return result;
}

export async function createInventoryItem(
  actor: HumanActorSession,
  payload: {
    name: string;
    category?: InventoryCategory;
    itemGroup?: 'PHARMACEUTICALS' | 'CARE_SUPPLIES';
    unit?: string;
    minStockThreshold?: number;
    lotNumber?: string;
    expiryDate?: string;
    unitPrice?: number;
    location?: string;
  },
): Promise<MedicalInventoryItem> {
  const cat = payload.category || 'CONSUMABLES';
  const group = payload.itemGroup || (cat === 'DIAGNOSTIC' || cat === 'MEDICINE_SUPPLY' ? 'PHARMACEUTICALS' : 'CARE_SUPPLIES');

  const newItem: MedicalInventoryItem = {
    itemId: `inv-${Date.now()}`,
    itemCode: `MED-CUS-${Math.floor(100 + Math.random() * 900)}`,
    name: payload.name,
    category: cat,
    itemGroup: group,
    unit: payload.unit || 'Cái',
    currentStock: 0,
    minStockThreshold: payload.minStockThreshold || 10,
    lotNumber: payload.lotNumber || `LOT-${new Date().getFullYear()}-NEW`,
    expiryDate: payload.expiryDate || new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString().slice(0, 10),
    unitPrice: payload.unitPrice || 0,
    location: payload.location || 'Kho y tế Tầng 1',
  };
  inventoryItems = [newItem, ...inventoryItems];
  return newItem;
}

export async function recordInventoryTransaction(
  actor: HumanActorSession,
  payload: {
    itemId: string;
    type: 'IMPORT' | 'EXPORT_RESIDENT' | 'EXPORT_DEPARTMENT' | 'AUDIT_ADJUSTMENT';
    quantity: number;
    residentId?: string;
    residentName?: string;
    reason?: string;
  },
): Promise<InventoryTransaction> {
  const item = inventoryItems.find((i) => i.itemId === payload.itemId);
  if (!item) throw new Error('Không tìm thấy vật tư y tế trong kho.');

  if (payload.type.startsWith('EXPORT') && item.currentStock < payload.quantity) {
    throw new Error(`Số lượng tồn kho không đủ để xuất (${item.currentStock} ${item.unit} khả dụng).`);
  }

  // Update stock
  if (payload.type === 'IMPORT') {
    item.currentStock += payload.quantity;
  } else if (payload.type.startsWith('EXPORT')) {
    item.currentStock -= payload.quantity;
  } else if (payload.type === 'AUDIT_ADJUSTMENT') {
    item.currentStock = payload.quantity;
  }

  const newTx: InventoryTransaction = {
    transactionId: `tx-${Date.now()}`,
    itemId: item.itemId,
    itemName: item.name,
    type: payload.type,
    quantity: payload.quantity,
    unit: item.unit,
    performedBy: actor.displayName || actor.actorId,
    timestamp: new Date().toISOString(),
    residentId: payload.residentId,
    residentName: payload.residentName,
    reason: payload.reason,
  };

  inventoryTransactions = [newTx, ...inventoryTransactions];
  return newTx;
}

export async function fetchInventoryTransactions(
  actor: HumanActorSession,
): Promise<InventoryTransaction[]> {
  return [...inventoryTransactions];
}

// ----------------------------------------------------------------------
// HẠNG MỤC 7: KHAI BÁO LẤY VẬT TƯ CHĂM SÓC QUA APP (DÀNH CHO TOÀN BỘ NHÂN VIÊN)
// ----------------------------------------------------------------------
export async function logCareSupplyWithdrawal(
  actor: HumanActorSession,
  input: {
    itemId: string;
    quantity: number;
    residentId?: string;
    residentName?: string;
    reason: string;
  }
): Promise<InventoryTransaction> {
  const item = inventoryItems.find((i) => i.itemId === input.itemId);
  if (!item) throw new Error('Không tìm thấy vật tư chăm sóc trong kho');

  if (item.currentStock < input.quantity) {
    throw new Error(`Số lượng kho không đủ (${item.currentStock} ${item.unit} khả dụng).`);
  }

  // Deduct stock
  item.currentStock -= input.quantity;

  const newTx: InventoryTransaction = {
    transactionId: `tx-care-${Date.now()}`,
    itemId: item.itemId,
    itemName: item.name,
    type: 'EXPORT_RESIDENT',
    quantity: input.quantity,
    unit: item.unit,
    performedBy: `${actor.displayName} (${actor.actorRole})`,
    timestamp: new Date().toISOString(),
    residentId: input.residentId,
    residentName: input.residentName,
    reason: `Khai báo qua App: ${input.reason}`,
  };

  inventoryTransactions = [newTx, ...inventoryTransactions];

  return newTx;
}

// ----------------------------------------------------------------------
// HẠNG MỤC 8: ĐIỀU CHỈNH NGƯỠNG TỐI THIỂU TỒN KHO Y TẾ
// ----------------------------------------------------------------------
export async function updateMedicationInventoryThreshold(
  actor: HumanActorSession,
  itemId: string,
  newMinThreshold: number,
  reasonNote?: string,
): Promise<MedicalInventoryItem> {
  const itemIndex = inventoryItems.findIndex((i) => i.itemId === itemId);
  if (itemIndex === -1) throw new Error('Không tìm thấy mặt hàng vật tư trong kho');

  const oldItem = inventoryItems[itemIndex];
  const oldThreshold = oldItem.minStockThreshold;
  const sanitizedThreshold = Math.max(0, Math.round(newMinThreshold));

  const updatedItem: MedicalInventoryItem = {
    ...oldItem,
    minStockThreshold: sanitizedThreshold,
  };

  inventoryItems[itemIndex] = updatedItem;

  const actorRoleLabel =
    actor.actorRole === 'NURSE'
      ? 'Nhân viên y tế'
      : actor.actorRole === 'CARE_MANAGER'
      ? 'Nhân viên quản lý'
      : actor.actorRole === 'SUPERVISOR'
      ? 'Ban Giám Đốc'
      : (actor.actorRole || 'Nhân viên');

  await recordSystemAuditLog({
    actorId: actor.actorId || 'STAFF-NUR-001',
    actorName: actor.displayName || 'Nhân viên y tế',
    actorRole: actor.actorRole || 'NURSE',
    actorRoleLabel,
    actionType: 'UPDATE',
    actionLabel: 'Cập nhật Ngưỡng tối thiểu vật tư y tế',
    module: 'CARE_OPERATIONS',
    moduleLabel: 'Kho Dược & Vật Tư Y Tế',
    targetEntityId: updatedItem.itemId,
    targetEntityName: `Vật tư: ${updatedItem.name}`,
    summary: `${actorRoleLabel} ${actor.displayName || ''} đã điều chỉnh Ngưỡng tối thiểu của "${updatedItem.name}" từ ${oldThreshold} ${updatedItem.unit} sang ${sanitizedThreshold} ${updatedItem.unit}.`,
    details: `Tồn hiện tại: ${updatedItem.currentStock} ${updatedItem.unit} | Ngưỡng cũ: ${oldThreshold} | Ngưỡng mới: ${sanitizedThreshold} | Lý do: ${reasonNote || 'Điều chỉnh phù hợp nhu cầu sử dụng thực tế Trung tâm'}.`,
    previousValue: `${oldThreshold} ${updatedItem.unit}`,
    newValue: `${sanitizedThreshold} ${updatedItem.unit}`,
    severity: 'IMPORTANT',
  });

  return updatedItem;
}

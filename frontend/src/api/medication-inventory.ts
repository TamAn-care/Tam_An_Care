import type { HumanActorSession } from '../types/actor';

export type MedicationRoute =
  | 'ORAL'
  | 'INJECTION'
  | 'TOPICAL'
  | 'OPHTHALMIC'
  | 'INHALATION';

export type TimingSlot = 'MORNING' | 'NOON' | 'AFTERNOON' | 'EVENING';

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
const INITIAL_ORDERS: MedicationOrder[] = [
  {
    orderId: 'med-ord-001',
    residentId: 'res-demo-001',
    residentName: 'Nguyễn Văn An',
    room: '101',
    bed: '101-B',
    drugName: 'Amlodipine Besylate',
    brandName: 'Amlor 5mg',
    dosage: '1 viên (5mg)',
    route: 'ORAL',
    timingSlots: ['MORNING'],
    instruction: 'AFTER_MEAL',
    prescribedBy: 'BS. Hoàng Quốc Anh',
    startDate: '2026-08-01',
    status: 'ACTIVE',
    diagnosisNote: 'Tăng huyết áp nguyên phát độ 2',
  },
  {
    orderId: 'med-ord-002',
    residentId: 'res-demo-001',
    residentName: 'Nguyễn Văn An',
    room: '101',
    bed: '101-B',
    drugName: 'Metformin HCl',
    brandName: 'Glucophage 500mg',
    dosage: '1 viên (500mg)',
    route: 'ORAL',
    timingSlots: ['MORNING', 'EVENING'],
    instruction: 'WITH_MEAL',
    prescribedBy: 'BS. Hoàng Quốc Anh',
    startDate: '2026-08-01',
    status: 'ACTIVE',
    diagnosisNote: 'Đái tháo đường type 2 ổn định',
  },
  {
    orderId: 'med-ord-003',
    residentId: 'res-demo-001',
    residentName: 'Nguyễn Văn An',
    room: '101',
    bed: '101-B',
    drugName: 'Ginkgo Biloba Extract',
    brandName: 'Tanakan 40mg',
    dosage: '1 viên (40mg)',
    route: 'ORAL',
    timingSlots: ['MORNING', 'NOON'],
    instruction: 'AFTER_MEAL',
    prescribedBy: 'BS. Hoàng Quốc Anh',
    startDate: '2026-08-01',
    status: 'ACTIVE',
    diagnosisNote: 'Cải thiện tuần hoàn não & trí nhớ',
  },
  {
    orderId: 'med-ord-004',
    residentId: 'res-demo-002',
    residentName: 'Trần Thị Bình',
    room: '102',
    bed: '102-A',
    drugName: 'Losartan Potassium',
    brandName: 'Cozaar 50mg',
    dosage: '1 viên (50mg)',
    route: 'ORAL',
    timingSlots: ['MORNING'],
    instruction: 'AFTER_MEAL',
    prescribedBy: 'BS. Hoàng Quốc Anh',
    startDate: '2026-08-10',
    status: 'ACTIVE',
    allergyWarning: '⚠️ Tiền sử dị ứng Aspirin & NSAIDs (gây nổi mề đay)',
    diagnosisNote: 'Tăng huyết áp kèm suy van tĩnh mạch chi dưới',
  },
  {
    orderId: 'med-ord-005',
    residentId: 'res-demo-002',
    residentName: 'Trần Thị Bình',
    room: '102',
    bed: '102-A',
    drugName: 'Calcium Carbonate + Vitamin D3',
    brandName: 'Calci-D 500mg',
    dosage: '1 viên',
    route: 'ORAL',
    timingSlots: ['MORNING'],
    instruction: 'AFTER_MEAL',
    prescribedBy: 'BS. Hoàng Quốc Anh',
    startDate: '2026-08-10',
    status: 'ACTIVE',
    diagnosisNote: 'Phòng ngừa loãng xương người cao tuổi',
  },
  {
    orderId: 'med-ord-006',
    residentId: 'res-demo-003',
    residentName: 'Lê Văn Cường',
    room: '103',
    bed: '103-B',
    drugName: 'Rosuvastatin',
    brandName: 'Crestor 10mg',
    dosage: '1 viên (10mg)',
    route: 'ORAL',
    timingSlots: ['EVENING'],
    instruction: 'BEDTIME',
    prescribedBy: 'BS. Hoàng Quốc Anh',
    startDate: '2026-08-15',
    status: 'ACTIVE',
    diagnosisNote: 'Rối loạn lipid máu hỗn hợp',
  },
  {
    orderId: 'med-ord-007',
    residentId: 'res-demo-004',
    residentName: 'Phạm Thị Dung',
    room: '201',
    bed: '201-A',
    drugName: 'Levothyroxine Sodium',
    brandName: 'Berlthyrox 50mcg',
    dosage: '1 viên (50mcg)',
    route: 'ORAL',
    timingSlots: ['MORNING'],
    instruction: 'BEFORE_MEAL',
    prescribedBy: 'BS. Hoàng Quốc Anh',
    startDate: '2026-08-12',
    status: 'ACTIVE',
    diagnosisNote: 'Suy giáp nguyên phát sau phẫu thuật',
  },
];

// Initial Administrations for Today
const todayStr = new Date().toISOString().slice(0, 10);

const INITIAL_ADMINS: MedicationAdministration[] = [
  {
    adminId: 'adm-001',
    orderId: 'med-ord-001',
    residentId: 'res-demo-001',
    residentName: 'Nguyễn Văn An',
    room: '101',
    bed: '101-B',
    drugName: 'Amlodipine Besylate (Amlor 5mg)',
    dosage: '1 viên (5mg)',
    route: 'ORAL',
    timingSlot: 'MORNING',
    scheduledDate: todayStr,
    scheduledTime: '07:30',
    instruction: 'AFTER_MEAL',
    status: 'GIVEN',
    administeredBy: 'ĐD. Nguyễn Thị Yến',
    administeredAt: `${todayStr}T07:35:00Z`,
    notes: 'Cụ uống thuốc tốt, huyết áp trước uống 128/82 mmHg.',
  },
  {
    adminId: 'adm-002',
    orderId: 'med-ord-002',
    residentId: 'res-demo-001',
    residentName: 'Nguyễn Văn An',
    room: '101',
    bed: '101-B',
    drugName: 'Metformin HCl (Glucophage 500mg)',
    dosage: '1 viên (500mg)',
    route: 'ORAL',
    timingSlot: 'MORNING',
    scheduledDate: todayStr,
    scheduledTime: '07:30',
    instruction: 'WITH_MEAL',
    status: 'GIVEN',
    administeredBy: 'ĐD. Nguyễn Thị Yến',
    administeredAt: `${todayStr}T07:35:00Z`,
    notes: 'Uống cùng bữa sáng.',
  },
  {
    adminId: 'adm-003',
    orderId: 'med-ord-003',
    residentId: 'res-demo-001',
    residentName: 'Nguyễn Văn An',
    room: '101',
    bed: '101-B',
    drugName: 'Ginkgo Biloba (Tanakan 40mg)',
    dosage: '1 viên (40mg)',
    route: 'ORAL',
    timingSlot: 'MORNING',
    scheduledDate: todayStr,
    scheduledTime: '07:30',
    instruction: 'AFTER_MEAL',
    status: 'GIVEN',
    administeredBy: 'ĐD. Nguyễn Thị Yến',
    administeredAt: `${todayStr}T07:35:00Z`,
  },
  {
    adminId: 'adm-004',
    orderId: 'med-ord-003',
    residentId: 'res-demo-001',
    residentName: 'Nguyễn Văn An',
    room: '101',
    bed: '101-B',
    drugName: 'Ginkgo Biloba (Tanakan 40mg)',
    dosage: '1 viên (40mg)',
    route: 'ORAL',
    timingSlot: 'NOON',
    scheduledDate: todayStr,
    scheduledTime: '11:30',
    instruction: 'AFTER_MEAL',
    status: 'PENDING',
  },
  {
    adminId: 'adm-005',
    orderId: 'med-ord-002',
    residentId: 'res-demo-001',
    residentName: 'Nguyễn Văn An',
    room: '101',
    bed: '101-B',
    drugName: 'Metformin HCl (Glucophage 500mg)',
    dosage: '1 viên (500mg)',
    route: 'ORAL',
    timingSlot: 'EVENING',
    scheduledDate: todayStr,
    scheduledTime: '17:30',
    instruction: 'WITH_MEAL',
    status: 'PENDING',
  },
  {
    adminId: 'adm-006',
    orderId: 'med-ord-004',
    residentId: 'res-demo-002',
    residentName: 'Trần Thị Bình',
    room: '102',
    bed: '102-A',
    drugName: 'Losartan Potassium (Cozaar 50mg)',
    dosage: '1 viên (50mg)',
    route: 'ORAL',
    timingSlot: 'MORNING',
    scheduledDate: todayStr,
    scheduledTime: '07:30',
    instruction: 'AFTER_MEAL',
    status: 'GIVEN',
    administeredBy: 'ĐD. Nguyễn Thị Yến',
    administeredAt: `${todayStr}T07:42:00Z`,
    allergyWarning: '⚠️ Tiền sử dị ứng Aspirin & NSAIDs (gây nổi mề đay)',
  },
  {
    adminId: 'adm-007',
    orderId: 'med-ord-005',
    residentId: 'res-demo-002',
    residentName: 'Trần Thị Bình',
    room: '102',
    bed: '102-A',
    drugName: 'Calcium + D3 (Calci-D 500mg)',
    dosage: '1 viên',
    route: 'ORAL',
    timingSlot: 'MORNING',
    scheduledDate: todayStr,
    scheduledTime: '07:30',
    instruction: 'AFTER_MEAL',
    status: 'GIVEN',
    administeredBy: 'ĐD. Nguyễn Thị Yến',
    administeredAt: `${todayStr}T07:42:00Z`,
  },
  {
    adminId: 'adm-008',
    orderId: 'med-ord-006',
    residentId: 'res-demo-003',
    residentName: 'Lê Văn Cường',
    room: '103',
    bed: '103-B',
    drugName: 'Rosuvastatin (Crestor 10mg)',
    dosage: '1 viên (10mg)',
    route: 'ORAL',
    timingSlot: 'EVENING',
    scheduledDate: todayStr,
    scheduledTime: '20:00',
    instruction: 'BEDTIME',
    status: 'PENDING',
  },
  {
    adminId: 'adm-009',
    orderId: 'med-ord-007',
    residentId: 'res-demo-004',
    residentName: 'Phạm Thị Dung',
    room: '201',
    bed: '201-A',
    drugName: 'Levothyroxine (Berlthyrox 50mcg)',
    dosage: '1 viên (50mcg)',
    route: 'ORAL',
    timingSlot: 'MORNING',
    scheduledDate: todayStr,
    scheduledTime: '06:30',
    instruction: 'BEFORE_MEAL',
    status: 'GIVEN',
    administeredBy: 'ĐD. Nguyễn Thị Yến',
    administeredAt: `${todayStr}T06:35:00Z`,
    notes: 'Uống trước ăn sáng 30 phút.',
  },
];

// Initial Medical Consumables Inventory
const INITIAL_INVENTORY: MedicalInventoryItem[] = [
  {
    itemId: 'inv-001',
    itemCode: 'MED-GLU-001',
    name: 'Que thử đường huyết Accu-Chek Instant',
    category: 'DIAGNOSTIC',
    unit: 'Hộp 50 que',
    currentStock: 18,
    minStockThreshold: 10,
    lotNumber: 'LOT-2026-AC48',
    expiryDate: '2027-05-30',
    unitPrice: 380000,
    location: 'Tủ trực y tế Tầng 1',
  },
  {
    itemId: 'inv-002',
    itemCode: 'MED-DIA-002',
    name: 'Tã bỉm dán người lớn Caryn size L',
    category: 'HYGIENE',
    unit: 'Bịch 10 miếng',
    currentStock: 4,
    minStockThreshold: 15,
    lotNumber: 'LOT-2026-CR12',
    expiryDate: '2028-02-15',
    unitPrice: 95000,
    location: 'Kho tổng vật tư Tầng 1',
  },
  {
    itemId: 'inv-003',
    itemCode: 'MED-WOU-003',
    name: 'Băng gạc vô trùng Urgo Sterile 10x10cm',
    category: 'WOUND_CARE',
    unit: 'Gói 10 miếng',
    currentStock: 35,
    minStockThreshold: 10,
    lotNumber: 'LOT-2025-UG90',
    expiryDate: '2026-09-25', // Cận hạn (< 30 ngày)
    unitPrice: 45000,
    location: 'Tủ cấp cứu Tầng 1',
  },
  {
    itemId: 'inv-004',
    itemCode: 'MED-GLO-004',
    name: 'Găng tay y tế Nitrile không bột Vglove size M',
    category: 'CONSUMABLES',
    unit: 'Hộp 100 chiếc',
    currentStock: 24,
    minStockThreshold: 8,
    lotNumber: 'LOT-2026-VG77',
    expiryDate: '2028-11-20',
    unitPrice: 72000,
    location: 'Kho y tế Tầng 2',
  },
  {
    itemId: 'inv-005',
    itemCode: 'MED-SAL-005',
    name: 'Nước muối sinh lý NaCl 0.9% 500ml',
    category: 'MEDICINE_SUPPLY',
    unit: 'Chai 500ml',
    currentStock: 48,
    minStockThreshold: 12,
    lotNumber: 'LOT-2026-NC33',
    expiryDate: '2027-08-10',
    unitPrice: 12000,
    location: 'Tủ thuốc trực ca Tầng 1 & 2',
  },
  {
    itemId: 'inv-006',
    itemCode: 'MED-SON-006',
    name: 'Ống Sonde nuôi ăn dạ dày Silicon Levin số 16',
    category: 'CONSUMABLES',
    unit: 'Sợi tiệt trùng',
    currentStock: 6,
    minStockThreshold: 8, // Low stock
    lotNumber: 'LOT-2026-LV16',
    expiryDate: '2029-01-01',
    unitPrice: 85000,
    location: 'Tủ vật tư chăm sóc đặc biệt',
  },
  {
    itemId: 'inv-007',
    itemCode: 'MED-ALC-007',
    name: 'Cồn y tế 70 độ sát khuẩn can 5L',
    category: 'CONSUMABLES',
    unit: 'Can 5 lít',
    currentStock: 5,
    minStockThreshold: 2,
    lotNumber: 'LOT-2026-AL70',
    expiryDate: '2028-06-30',
    unitPrice: 145000,
    location: 'Kho hóa chất kiểm soát',
  },
];

// In-Memory Storage
let medicationOrders: MedicationOrder[] = [...INITIAL_ORDERS];
let medicationAdmins: MedicationAdministration[] = [...INITIAL_ADMINS];
let inventoryItems: MedicalInventoryItem[] = [...INITIAL_INVENTORY];
let inventoryTransactions: InventoryTransaction[] = [
  {
    transactionId: 'tx-001',
    itemId: 'inv-001',
    itemName: 'Que thử đường huyết Accu-Chek Instant',
    type: 'IMPORT',
    quantity: 20,
    unit: 'Hộp 50 que',
    performedBy: 'ĐD. Nguyễn Thị Yến',
    timestamp: '2026-08-25T09:15:00Z',
    reason: 'Nhập kho định kỳ đầu tháng',
  },
  {
    transactionId: 'tx-002',
    itemId: 'inv-002',
    itemName: 'Tã bỉm dán người lớn Caryn size L',
    type: 'EXPORT_RESIDENT',
    quantity: 2,
    unit: 'Bịch 10 miếng',
    performedBy: 'ĐD. Nguyễn Thị Yến',
    timestamp: '2026-09-01T14:30:00Z',
    residentId: 'res-demo-001',
    residentName: 'Nguyễn Văn An',
    reason: 'Cấp phát sinh hoạt cho Cụ',
  },
];

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
    orderId: `med-ord-${Date.now()}`,
    status: 'ACTIVE',
  };
  medicationOrders = [newOrder, ...medicationOrders];

  // Auto-generate administration slots for today
  for (const slot of newOrder.timingSlots) {
    let time = '07:30';
    if (slot === 'NOON') time = '11:30';
    if (slot === 'AFTERNOON') time = '16:30';
    if (slot === 'EVENING') time = '20:00';

    medicationAdmins.push({
      adminId: `adm-${Date.now()}-${slot}`,
      orderId: newOrder.orderId,
      residentId: newOrder.residentId,
      residentName: newOrder.residentName,
      room: newOrder.room,
      bed: newOrder.bed,
      drugName: `${newOrder.drugName} (${newOrder.brandName || ''})`,
      dosage: newOrder.dosage,
      route: newOrder.route,
      timingSlot: slot,
      scheduledDate: todayStr,
      scheduledTime: time,
      instruction: newOrder.instruction,
      status: 'PENDING',
      allergyWarning: newOrder.allergyWarning,
    });
  }

  return newOrder;
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
    unit?: string;
    minStockThreshold?: number;
    lotNumber?: string;
    expiryDate?: string;
    unitPrice?: number;
    location?: string;
  },
): Promise<MedicalInventoryItem> {
  const newItem: MedicalInventoryItem = {
    itemId: `inv-${Date.now()}`,
    itemCode: `MED-CUS-${Math.floor(100 + Math.random() * 900)}`,
    name: payload.name,
    category: payload.category || 'CONSUMABLES',
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

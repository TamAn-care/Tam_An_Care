import { HumanActorSession } from '../types/actor';
import { recordSystemAuditLog } from './audit-log';
import { ROLE_LABELS } from '../auth/role-policy';

export type FoodCategory =
  | 'MEAT_SEAFOOD'
  | 'VEGETABLES_FRUITS'
  | 'EGG_DAIRY'
  | 'DRY_GOODS'
  | 'SPICES_CONDIMENTS';

export type StorageZone =
  | 'FREEZER' // -18°C
  | 'CHILLER' // 0°C to 4°C
  | 'DRY_ROOM'; // 22°C - 25°C

export type InspectionStatus =
  | 'ACCEPTED'
  | 'QUARANTINED'
  | 'REJECTED';

export interface VendorContract {
  id: string;
  vendorCode: string;
  vendorName: string;
  contractNumber: string;
  category: FoodCategory;
  categoryLabel: string;
  contactPerson: string;
  contactPhone: string;
  deliverySchedule: string;
  certification: string; // HACCP, VietGAP, Organic
  ratingScore: number; // 1 to 5 stars
  status: 'ACTIVE' | 'PENDING_RENEWAL';
}

export interface FoodReceivingItem {
  itemId: string;
  itemName: string;
  category: FoodCategory;
  orderedQuantity: number;
  actualQuantity: number;
  unit: string;
  variance: number; // actual - ordered
  variancePercent: number; // %
  unitPrice: number;
  totalPrice: number;
  deliveryTemp: number; // °C
  expiryDate: string;
  sensoryQuality: 'FRESH_PRISTINE' | 'GOOD' | 'SUBSTANDARD' | 'SPOILED';
  packagingCondition: 'INTACT_SEALED' | 'TORN_DAMAGED';
  status: InspectionStatus;
  storageZone: StorageZone;
  note?: string;
}

export interface FoodReceivingBatch {
  batchId: string;
  receivedAt: string; // ISO
  vendorId: string;
  vendorName: string;
  deliveryNoteNumber: string;
  vehiclePlate: string;
  delivererName: string;
  delivererPhone: string;
  receiverId: string;
  receiverName: string;
  totalItems: number;
  totalOrderedWeight: number; // kg
  totalActualWeight: number; // kg
  weightVariancePercent: number; // %
  totalValue: number; // VND
  overallStatus: InspectionStatus;
  items: FoodReceivingItem[];
  notes?: string;
  signatureConfirmed: boolean;
}

export interface FoodInventoryItem {
  id: string;
  itemName: string;
  category: FoodCategory;
  storageZone: StorageZone;
  currentStock: number;
  minSafetyStock: number;
  unit: string;
  batchId: string;
  vendorName: string;
  receivedDate: string;
  expiryDate: string;
  daysToExpiry: number;
  unitPrice: number;
  status: 'FRESH' | 'EXPIRING_SOON' | 'LOW_STOCK' | 'EXPIRED';
}

export interface DailyMealDispatch {
  id: string;
  dispatchDate: string;
  mealType: 'BREAKFAST' | 'LUNCH' | 'AFTERNOON_SNACK' | 'DINNER';
  mealTypeLabel: string;
  menuName: string;
  residentCount: number;
  dispatchedBy: string;
  items: Array<{
    itemId: string;
    itemName: string;
    quantity: number;
    unit: string;
  }>;
  status: 'DISPATCHED' | 'COOKED' | 'SERVED';
  notes?: string;
}

export interface FoodSampleArchive {
  id: string;
  sampleDate: string;
  mealType: 'BREAKFAST' | 'LUNCH' | 'AFTERNOON_SNACK' | 'DINNER';
  mealTypeLabel: string;
  dishName: string;
  sampleWeight: string;
  containerType: string;
  storageLocation: string;
  storageTemp: string;
  samplerId: string;
  samplerName: string;
  savedAt: string;
  retainUntil: string;
  destroyedAt?: string;
  status: 'ACTIVE_STORAGE' | 'SAFELY_DESTROYED' | 'INVESTIGATED';
  sensoryNote?: string;
}

export const FOOD_CATEGORY_META: Record<FoodCategory, { label: string; icon: string; defaultZone: StorageZone }> = {
  MEAT_SEAFOOD: { label: 'Thịt, Cá & Thủy Hải Sản', icon: '🥩', defaultZone: 'FREEZER' },
  VEGETABLES_FRUITS: { label: 'Rau, Củ & Trái Cây Tươi', icon: '🥦', defaultZone: 'CHILLER' },
  EGG_DAIRY: { label: 'Trứng, Sữa & Chế Phẩm', icon: '🥛', defaultZone: 'CHILLER' },
  DRY_GOODS: { label: 'Gạo, Ngũ Cốc & Thực Phẩm Khô', icon: '🌾', defaultZone: 'DRY_ROOM' },
  SPICES_CONDIMENTS: { label: 'Gia Vị Dưỡng Lão & Dầu Ăn', icon: '🧂', defaultZone: 'DRY_ROOM' },
};

export const STORAGE_ZONE_META: Record<StorageZone, { label: string; icon: string; tempRange: string; badgeClass: string }> = {
  FREEZER: { label: 'Kho Đông Sâu', icon: '🧊', tempRange: '-18°C đến -22°C', badgeClass: 'badge-info' },
  CHILLER: { label: 'Kho Mát Tươi Sống', icon: '🥬', tempRange: '0°C đến +4°C', badgeClass: 'badge-success' },
  DRY_ROOM: { label: 'Kho Khô & Thoáng Khí', icon: '📦', tempRange: '+22°C đến +25°C', badgeClass: 'badge-neutral' },
};

// Mock Vendors
// NO SEED DATA — vendor records must come from real Tâm An operations.
export const MOCK_VENDORS: VendorContract[] = [];

// Mock In-memory Storage
// NO SEED DATA — Production-ready empty state
let mockReceivingBatches: FoodReceivingBatch[] = [];

// NO SEED DATA — Production-ready empty state
let mockFoodInventory: FoodInventoryItem[] = [];

// NO SEED DATA — Production-ready empty state
let mockFoodSamples: FoodSampleArchive[] = [];

// NO SEED DATA — Production-ready empty state
let mockDispatches: DailyMealDispatch[] = [];

// Service functions
export async function fetchFoodReceivingBatches(): Promise<FoodReceivingBatch[]> {
  await new Promise((r) => setTimeout(r, 100));
  return [...mockReceivingBatches];
}

export async function createFoodReceivingBatch(
  actor: HumanActorSession,
  input: Omit<FoodReceivingBatch, 'batchId' | 'receivedAt' | 'totalOrderedWeight' | 'totalActualWeight' | 'weightVariancePercent' | 'totalValue'>
): Promise<FoodReceivingBatch> {
  await new Promise((r) => setTimeout(r, 150));

  const totalOrderedWeight = input.items.reduce((acc, item) => acc + item.orderedQuantity, 0);
  const totalActualWeight = input.items.reduce((acc, item) => acc + item.actualQuantity, 0);
  const totalValue = input.items.reduce((acc, item) => acc + item.totalPrice, 0);
  const weightVariancePercent = totalOrderedWeight > 0
    ? Number((((totalActualWeight - totalOrderedWeight) / totalOrderedWeight) * 100).toFixed(2))
    : 0;

  const newBatch: FoodReceivingBatch = {
    ...input,
    batchId: `RCV-${Date.now().toString().slice(-8)}`,
    receivedAt: new Date().toISOString(),
    totalOrderedWeight: Number(totalOrderedWeight.toFixed(2)),
    totalActualWeight: Number(totalActualWeight.toFixed(2)),
    weightVariancePercent,
    totalValue,
  };

  mockReceivingBatches = [newBatch, ...mockReceivingBatches];

  // Update Inventory automatically for ACCEPTED items
  input.items.forEach((item) => {
    if (item.status === 'ACCEPTED') {
      const existing = mockFoodInventory.find((i) => i.itemName.toLowerCase() === item.itemName.toLowerCase());
      if (existing) {
        existing.currentStock += item.actualQuantity;
        existing.receivedDate = new Date().toISOString().split('T')[0];
        existing.expiryDate = item.expiryDate;
      } else {
        mockFoodInventory.unshift({
          id: `INV-F${Date.now().toString().slice(-4)}`,
          itemName: item.itemName,
          category: item.category,
          storageZone: item.storageZone,
          currentStock: item.actualQuantity,
          minSafetyStock: Math.max(5, Math.round(item.actualQuantity * 0.3)),
          unit: item.unit,
          batchId: newBatch.batchId,
          vendorName: input.vendorName,
          receivedDate: new Date().toISOString().split('T')[0],
          expiryDate: item.expiryDate,
          daysToExpiry: 7,
          unitPrice: item.unitPrice,
          status: 'FRESH',
        });
      }
    }
  });

  // Ghi nhật ký kiểm toán quy trách nhiệm
  await recordSystemAuditLog({
    actorId: actor.actorId,
    actorName: actor.displayName || 'Nhân viên dinh dưỡng',
    actorRole: actor.actorRole || 'NUTRITIONIST',
    actorRoleLabel: actor.actorRole === 'NUTRITIONIST' ? 'Nhân viên dinh dưỡng' : (actor.actorRole || 'Nhân viên'),
    actionType: 'CREATE',
    actionLabel: 'Tiếp nhận & kiểm đếm lô thực phẩm mới',
    module: 'CARE_OPERATIONS',
    moduleLabel: 'Bếp Ăn & Dinh Dưỡng',
    targetEntityId: newBatch.batchId,
    targetEntityName: `Lô thực phẩm từ ${newBatch.vendorName} (${newBatch.totalActualWeight} kg)`,
    summary: `Tiếp nhận ${newBatch.totalItems} mặt hàng từ ${newBatch.vendorName}. Tổng khối lượng: ${newBatch.totalActualWeight}kg (Lệch ${newBatch.weightVariancePercent}% so với phiếu giao). Kết luận: ${newBatch.overallStatus}.`,
    details: `Số phiếu giao: ${newBatch.deliveryNoteNumber} | Biển số xe: ${newBatch.vehiclePlate} | Giá trị: ${newBatch.totalValue.toLocaleString('vi-VN')} đ | Người giao: ${newBatch.delivererName}.`,
    previousValue: 'Chờ giao hàng',
    newValue: `Đã nhập kho: ${newBatch.overallStatus} (${newBatch.totalActualWeight} kg)`,
    severity: newBatch.overallStatus === 'REJECTED' ? 'CRITICAL' : 'IMPORTANT',
  });

  return newBatch;
}

export async function fetchFoodInventory(): Promise<FoodInventoryItem[]> {
  await new Promise((r) => setTimeout(r, 100));
  return [...mockFoodInventory];
}

export async function updateFoodInventorySafetyStock(
  actor: HumanActorSession,
  itemId: string,
  newMinSafetyStock: number,
  reasonNote?: string
): Promise<FoodInventoryItem> {
  await new Promise((r) => setTimeout(r, 120));

  const itemIndex = mockFoodInventory.findIndex((i) => i.id === itemId);
  if (itemIndex === -1) throw new Error('Không tìm thấy mặt hàng thực phẩm trong kho');

  const oldItem = mockFoodInventory[itemIndex];
  const oldSafetyStock = oldItem.minSafetyStock;
  const sanitizedStock = Math.max(0, Number(newMinSafetyStock.toFixed(2)));

  const updatedItem: FoodInventoryItem = {
    ...oldItem,
    minSafetyStock: sanitizedStock,
    status: oldItem.currentStock <= sanitizedStock ? 'LOW_STOCK' : oldItem.status === 'LOW_STOCK' ? 'FRESH' : oldItem.status,
  };

  mockFoodInventory[itemIndex] = updatedItem;

  const actorRoleLabel = actor.actorRole === 'NUTRITIONIST'
    ? 'Nhân viên dinh dưỡng'
    : actor.actorRole === 'CARE_MANAGER'
    ? 'Nhân viên quản lý'
    : actor.actorRole === 'SUPERVISOR'
    ? 'Ban Giám Đốc'
    : (actor.actorRole || 'Nhân viên');

  await recordSystemAuditLog({
    actorId: actor.actorId,
    actorName: actor.displayName || 'Nhân viên dinh dưỡng',
    actorRole: actor.actorRole || 'NUTRITIONIST',
    actorRoleLabel,
    actionType: 'UPDATE',
    actionLabel: 'Cập nhật Ngưỡng an toàn thực phẩm tồn kho',
    module: 'CARE_OPERATIONS',
    moduleLabel: 'Bếp Ăn & Dinh Dưỡng',
    targetEntityId: updatedItem.id,
    targetEntityName: `Mặt hàng: ${updatedItem.itemName}`,
    summary: `${actorRoleLabel} ${actor.displayName || ''} đã điều chỉnh Ngưỡng an toàn của "${updatedItem.itemName}" từ ${oldSafetyStock} ${updatedItem.unit} sang ${sanitizedStock} ${updatedItem.unit}.`,
    details: `Tồn hiện tại: ${updatedItem.currentStock} ${updatedItem.unit} | Ngưỡng cũ: ${oldSafetyStock} | Ngưỡng mới: ${sanitizedStock} | Lý do điều chỉnh: ${reasonNote || 'Phù hợp với điều kiện vận hành thực tế của Trung tâm'}.`,
    previousValue: `${oldSafetyStock} ${updatedItem.unit}`,
    newValue: `${sanitizedStock} ${updatedItem.unit}`,
    severity: 'IMPORTANT',
  });

  return updatedItem;
}

export async function dispatchFoodForCooking(
  actor: HumanActorSession,
  input: Omit<DailyMealDispatch, 'id'>
): Promise<DailyMealDispatch> {
  await new Promise((r) => setTimeout(r, 120));

  const newDispatch: DailyMealDispatch = {
    ...input,
    id: `DSP-${Date.now().toString().slice(-8)}`,
  };

  mockDispatches = [newDispatch, ...mockDispatches];

  // Deduct inventory
  input.items.forEach((dispatchItem) => {
    const inv = mockFoodInventory.find((i) => i.id === dispatchItem.itemId || i.itemName.toLowerCase() === dispatchItem.itemName.toLowerCase());
    if (inv) {
      inv.currentStock = Math.max(0, Number((inv.currentStock - dispatchItem.quantity).toFixed(2)));
    }
  });

  // Ghi nhật ký kiểm toán
  await recordSystemAuditLog({
    actorId: actor.actorId,
    actorName: actor.displayName || 'Nhân viên dinh dưỡng',
    actorRole: actor.actorRole || 'NUTRITIONIST',
    actorRoleLabel: actor.actorRole === 'NUTRITIONIST' ? 'Nhân viên dinh dưỡng' : (actor.actorRole || 'Nhân viên'),
    actionType: 'UPDATE',
    actionLabel: 'Xuất kho thực phẩm chế biến bữa ăn',
    module: 'CARE_OPERATIONS',
    moduleLabel: 'Bếp Ăn & Dinh Dưỡng',
    targetEntityId: newDispatch.id,
    targetEntityName: `Xuất kho ${newDispatch.mealTypeLabel} (${newDispatch.residentCount} suất ăn)`,
    summary: `Xuất ${newDispatch.items.length} nguyên liệu nấu ${newDispatch.menuName} phục vụ ${newDispatch.residentCount} người cao tuổi.`,
    details: `Danh mục xuất: ${newDispatch.items.map((i) => `${i.itemName} (${i.quantity} ${i.unit})`).join(', ')}.`,
    severity: 'NORMAL',
  });

  return newDispatch;
}

export async function fetchFoodSamples(): Promise<FoodSampleArchive[]> {
  await new Promise((r) => setTimeout(r, 100));
  return [...mockFoodSamples];
}

export async function createFoodSampleRecord(
  actor: HumanActorSession,
  input: Omit<FoodSampleArchive, 'id' | 'savedAt' | 'retainUntil'>
): Promise<FoodSampleArchive> {
  await new Promise((r) => setTimeout(r, 120));

  const now = new Date();
  const retainUntil = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const newSample: FoodSampleArchive = {
    ...input,
    id: `SMP-${Date.now().toString().slice(-8)}`,
    savedAt: now.toISOString(),
    retainUntil: retainUntil.toISOString(),
  };

  mockFoodSamples = [newSample, ...mockFoodSamples];

  await recordSystemAuditLog({
    actorId: actor.actorId,
    actorName: actor.displayName || 'Nhân viên dinh dưỡng',
    actorRole: actor.actorRole || 'NUTRITIONIST',
    actorRoleLabel: actor.actorRole === 'NUTRITIONIST' ? 'Nhân viên dinh dưỡng' : (actor.actorRole || 'Nhân viên'),
    actionType: 'CREATE',
    actionLabel: 'Lưu mẫu thức ăn 24 giờ chuẩn Bộ Y Tế',
    module: 'CARE_OPERATIONS',
    moduleLabel: 'Bếp Ăn & Dinh Dưỡng',
    targetEntityId: newSample.id,
    targetEntityName: `Mẫu lưu: ${newSample.dishName} (${newSample.mealTypeLabel})`,
    summary: `Lưu mẫu ${newSample.dishName} (${newSample.sampleWeight}) tại ${newSample.storageLocation} (${newSample.storageTemp}) trong 24 giờ.`,
    details: `Người lấy mẫu: ${newSample.samplerName} | Loại dụng cụ: ${newSample.containerType} | Ghi chú cảm quan: ${newSample.sensoryNote || 'Bình thường'}.`,
    severity: 'NORMAL',
  });

  return newSample;
}

export async function destroyFoodSampleRecord(
  actor: HumanActorSession,
  sampleId: string
): Promise<FoodSampleArchive> {
  await new Promise((r) => setTimeout(r, 120));

  const sample = mockFoodSamples.find((s) => s.id === sampleId);
  if (!sample) throw new Error('Không tìm thấy mẫu lưu thức ăn');

  sample.status = 'SAFELY_DESTROYED';
  sample.destroyedAt = new Date().toISOString();

  await recordSystemAuditLog({
    actorId: actor.actorId,
    actorName: actor.displayName || 'Nhân viên dinh dưỡng',
    actorRole: actor.actorRole || 'NUTRITIONIST',
    actorRoleLabel: actor.actorRole === 'NUTRITIONIST' ? 'Nhân viên dinh dưỡng' : (actor.actorRole || 'Nhân viên'),
    actionType: 'UPDATE',
    actionLabel: 'Hủy mẫu lưu thức ăn sau 24 giờ an toàn',
    module: 'CARE_OPERATIONS',
    moduleLabel: 'Bếp Ăn & Dinh Dưỡng',
    targetEntityId: sample.id,
    targetEntityName: `Hủy mẫu lưu: ${sample.dishName}`,
    summary: `Tiến hành hủy mẫu ${sample.dishName} sau khi hết thời hạn 24 giờ lưu trữ an toàn.`,
    severity: 'NORMAL',
  });

  return sample;
}

export function downloadKitchenInventoryCSV(inventory: FoodInventoryItem[], canViewFinancials: boolean = true) {
  const headers = ['ID', 'Tên Mặt Hàng', 'Danh Mục', 'Kho Lưu', 'Tồn Hiện Tại', 'Đơn Vị', 'Mức An Toàn', 'Hạn Sử Dụng', 'Số Ngày Còn Lại', canViewFinancials ? 'Đơn Giá (VND)' : 'Đơn Giá (Bảo Mật BGĐ)', 'Trạng Thái'];
  const rows = inventory.map((i) => [
    i.id,
    `"${i.itemName.replace(/"/g, '""')}"`,
    FOOD_CATEGORY_META[i.category]?.label || i.category,
    STORAGE_ZONE_META[i.storageZone]?.label || i.storageZone,
    i.currentStock,
    i.unit,
    i.minSafetyStock,
    i.expiryDate,
    i.daysToExpiry,
    canViewFinancials ? i.unitPrice : '*** (Chỉ Ban Giám Đốc)',
    i.currentStock <= i.minSafetyStock ? 'Tồn Thấp' : i.daysToExpiry <= 3 ? 'Cận Date' : 'Tươi Ngon',
  ]);
  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `Bao_Cao_Ton_Kho_Thuc_Pham_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export async function fetchDailyDispatches(): Promise<DailyMealDispatch[]> {
  await new Promise((r) => setTimeout(r, 100));
  return [...mockDispatches];
}

export async function fetchVendors(): Promise<VendorContract[]> {
  await new Promise((r) => setTimeout(r, 100));
  return [...MOCK_VENDORS];
}

// ==========================================
// THỰC ĐƠN TUẦN & THỰC ĐƠN HÔM NAY (SERIES BẾP & DINH DƯỠNG)
// ==========================================

export type WeeklyMealType = 'BREAKFAST' | 'LUNCH' | 'AFTERNOON_SNACK' | 'DINNER';

export interface MealSlotDefinition {
  id: string;
  mealType: WeeklyMealType;
  mealLabel: string;
  dishName: string;
  sideDishes: string;
  drinkOrSnack: string;
  textureOptions: string[]; // ['Cơm mềm', 'Cháo', 'Xay nhuyễn', 'Ăn Sonde']
  dietNotes: string; // Chế độ bệnh lý: 'Ăn nhạt', 'Tiểu đường',...
  kcal: number;
  proteinG: number;
  updatedAt?: string;
  updatedBy?: string;
}

export interface DayMenuSchedule {
  dayId: 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN';
  dayName: string;
  meals: MealSlotDefinition[];
}

// NO SEED DATA — only structural day shells.
// Meal content must be entered by authorized Tâm An staff.
export const INITIAL_WEEKLY_SCHEDULE: DayMenuSchedule[] = [
  { dayId: 'MON', dayName: 'Thứ Hai', meals: [] },
  { dayId: 'TUE', dayName: 'Thứ Ba', meals: [] },
  { dayId: 'WED', dayName: 'Thứ Tư', meals: [] },
  { dayId: 'THU', dayName: 'Thứ Năm', meals: [] },
  { dayId: 'FRI', dayName: 'Thứ Sáu', meals: [] },
  { dayId: 'SAT', dayName: 'Thứ Bảy', meals: [] },
  { dayId: 'SUN', dayName: 'Chủ Nhật', meals: [] },
];

const STORAGE_KEY_WEEKLY_SCHEDULE = 'taman_weekly_menu_schedule_v2';

function loadWeeklyScheduleFromStorage(): DayMenuSchedule[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_WEEKLY_SCHEDULE);

    if (saved) {
      const parsed = JSON.parse(saved);

      if (Array.isArray(parsed) && parsed.length === 7) {
        return parsed;
      }
    }
  } catch (err) {
    console.error('Error loading weekly menu schedule:', err);
  }

  // No saved menu => structural empty week only.
  // Never auto-populate fabricated meal content.
  return INITIAL_WEEKLY_SCHEDULE.map((day) => ({
    ...day,
    meals: [],
  }));
}

function saveWeeklyScheduleToStorage(schedule: DayMenuSchedule[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_WEEKLY_SCHEDULE, JSON.stringify(schedule));
  } catch (err) {
    console.error('Error saving weekly menu schedule:', err);
  }
}

let currentWeeklySchedule = loadWeeklyScheduleFromStorage();

export async function fetchWeeklyMenuSchedule(): Promise<DayMenuSchedule[]> {
  await new Promise((r) => setTimeout(r, 100));
  return [...currentWeeklySchedule];
}

export async function updateWeeklyMenuDay(
  actor: HumanActorSession,
  dayId: 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN',
  updatedMeals: MealSlotDefinition[]
): Promise<DayMenuSchedule> {
  await new Promise((r) => setTimeout(r, 150));

  const dayIndex = currentWeeklySchedule.findIndex((d) => d.dayId === dayId);
  if (dayIndex === -1) throw new Error('Không tìm thấy ngày trong tuần');

  const nowStr = new Date().toLocaleString('vi-VN');
  const actorName = actor.displayName || 'Nhân viên dinh dưỡng';

  const stampedMeals = updatedMeals.map((m) => ({
    ...m,
    updatedAt: nowStr,
    updatedBy: actorName,
  }));

  currentWeeklySchedule[dayIndex] = {
    ...currentWeeklySchedule[dayIndex],
    meals: stampedMeals,
  };

  saveWeeklyScheduleToStorage(currentWeeklySchedule);

  // Ghi nhật ký kiểm toán hệ thống
  await recordSystemAuditLog({
    actorId: actor.actorId,
    actorName: actor.displayName || 'Nhân viên dinh dưỡng',
    actorRole: actor.actorRole || 'NUTRITIONIST',
    actorRoleLabel: actor.actorRole === 'NUTRITIONIST' ? 'Nhân viên dinh dưỡng' : (actor.actorRole || 'Nhân viên'),
    actionType: 'UPDATE',
    actionLabel: `Cập nhật thực đơn ${currentWeeklySchedule[dayIndex].dayName}`,
    module: 'CARE_OPERATIONS',
    moduleLabel: 'Bếp Ăn & Dinh Dưỡng',
    targetEntityId: `MENU-${dayId}`,
    targetEntityName: `Thực đơn ${currentWeeklySchedule[dayIndex].dayName}`,
    summary: `Cập nhật chi tiết 5 bữa ăn cho ${currentWeeklySchedule[dayIndex].dayName} bởi ${actorName}.`,
    details: `Món sáng: ${stampedMeals[0]?.dishName} | Trưa: ${stampedMeals[1]?.dishName} | Xế: ${stampedMeals[2]?.dishName} | Tối: ${stampedMeals[3]?.dishName} | Phụ tối: ${stampedMeals[4]?.dishName}`,
    severity: 'NORMAL',
  });

  return currentWeeklySchedule[dayIndex];
}

export function getCurrentDayId(): 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN' {
  const dayNum = new Date().getDay(); // 0 = Sun, 1 = Mon,...
  const map: Record<number, 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN'> = {
    0: 'SUN',
    1: 'MON',
    2: 'TUE',
    3: 'WED',
    4: 'THU',
    5: 'FRI',
    6: 'SAT',
  };
  return map[dayNum] || 'MON';
}

export async function getTodayMenuSchedule(): Promise<{
  dayId: string;
  dayName: string;
  dateStr: string;
  meals: MealSlotDefinition[];
}> {
  await new Promise((r) => setTimeout(r, 80));
  const currentDayId = getCurrentDayId();
  const schedule = loadWeeklyScheduleFromStorage();
  const daySchedule = schedule.find((d) => d.dayId === currentDayId) || schedule[0];
  const dateStr = new Date().toLocaleDateString('vi-VN');

  return {
    dayId: daySchedule.dayId,
    dayName: daySchedule.dayName,
    dateStr,
    meals: daySchedule.meals,
  };
}

export async function updateTodayMealSlot(
  actor: HumanActorSession,
  mealType: WeeklyMealType,
  updates: Partial<MealSlotDefinition>
): Promise<MealSlotDefinition> {
  await new Promise((r) => setTimeout(r, 120));

  const currentDayId = getCurrentDayId();
  const dayIndex = currentWeeklySchedule.findIndex((d) => d.dayId === currentDayId);
  if (dayIndex === -1) throw new Error('Không tìm thấy thực đơn hôm nay');

  const meals = [...currentWeeklySchedule[dayIndex].meals];
  const mealIndex = meals.findIndex((m) => m.mealType === mealType);
  if (mealIndex === -1) throw new Error('Không tìm thấy bữa ăn trong ngày');

  const nowStr = new Date().toLocaleString('vi-VN');
  const actorName = actor.displayName || 'Nhân viên dinh dưỡng';

  const updatedMeal: MealSlotDefinition = {
    ...meals[mealIndex],
    ...updates,
    updatedAt: nowStr,
    updatedBy: actorName,
  };

  meals[mealIndex] = updatedMeal;
  currentWeeklySchedule[dayIndex] = {
    ...currentWeeklySchedule[dayIndex],
    meals,
  };

  saveWeeklyScheduleToStorage(currentWeeklySchedule);

  await recordSystemAuditLog({
    actorId: actor.actorId,
    actorName: actor.displayName || 'Nhân viên dinh dưỡng',
    actorRole: actor.actorRole || 'NUTRITIONIST',
    actorRoleLabel: actor.actorRole === 'NUTRITIONIST' ? 'Nhân viên dinh dưỡng' : (actor.actorRole || 'Nhân viên'),
    actionType: 'UPDATE',
    actionLabel: `Cập nhật nhanh ${updatedMeal.mealLabel} Hôm Nay`,
    module: 'CARE_OPERATIONS',
    moduleLabel: 'Bếp Ăn & Dinh Dưỡng',
    targetEntityId: updatedMeal.id,
    targetEntityName: `Món ăn: ${updatedMeal.dishName}`,
    summary: `Cập nhật món ăn ${updatedMeal.dishName} cho ${updatedMeal.mealLabel}.`,
    details: `Món kèm: ${updatedMeal.sideDishes} | Đồ uống: ${updatedMeal.drinkOrSnack} | Calo: ${updatedMeal.kcal} kcal | Protein: ${updatedMeal.proteinG}g.`,
    severity: 'IMPORTANT',
  });

  return updatedMeal;
}

// ----------------------------------------------------------------------
// HẠNG MỤC 9: ĐĂNG KÝ ĂN CƠM TẠI TÂM AN CHO NGƯỜI NHÀ (CỔNG THÂN NHÂN)
// ----------------------------------------------------------------------
export interface FamilyMealBooking {
  id: string;
  residentId: string;
  residentName: string;
  guardianName: string;
  bookingDate: string; // YYYY-MM-DD
  mealType: 'BREAKFAST' | 'LUNCH' | 'AFTERNOON_SNACK' | 'DINNER';
  mealTypeLabel: string;
  portionCount: number;
  pricePerPortion: number; // 50.000đ/suất
  totalFee: number;
  dietNotes?: string;
  status: 'CONFIRMED' | 'SERVED' | 'CANCELLED';
  bookedAt: string;
}

// NO SEED DATA — Production-ready empty state
let mockFamilyMealBookings: FamilyMealBooking[] = [];

export async function fetchFamilyMealBookings(residentId?: string): Promise<FamilyMealBooking[]> {
  await new Promise((r) => setTimeout(r, 100));
  if (residentId) {
    return mockFamilyMealBookings.filter((b) => b.residentId === residentId);
  }
  return [...mockFamilyMealBookings];
}

export async function bookFamilyMeal(
  actor: HumanActorSession,
  input: {
    residentId: string;
    residentName: string;
    guardianName: string;
    bookingDate: string;
    mealType: 'BREAKFAST' | 'LUNCH' | 'AFTERNOON_SNACK' | 'DINNER';
    portionCount: number;
    dietNotes?: string;
  }
): Promise<FamilyMealBooking> {
  await new Promise((r) => setTimeout(r, 150));

  const mealLabels: Record<string, string> = {
    BREAKFAST: 'Bữa Sáng (07:00 - 08:00)',
    LUNCH: 'Bữa Trưa (11:00 - 12:00)',
    AFTERNOON_SNACK: 'Bữa Phụ (14:00)',
    DINNER: 'Bữa Tối (17:00 - 18:00)',
  };

  const pricePerPortion = 50000; // 50.000 VNĐ / suất
  const totalFee = input.portionCount * pricePerPortion;

  const newBooking: FamilyMealBooking = {
    ...input,
    id: `FMB-${Date.now().toString().slice(-8)}`,
    mealTypeLabel: mealLabels[input.mealType] || input.mealType,
    pricePerPortion,
    totalFee,
    status: 'CONFIRMED',
    bookedAt: new Date().toISOString(),
  };

  mockFamilyMealBookings = [newBooking, ...mockFamilyMealBookings];

  // Ghi nhật ký kiểm toán hệ thống
  await recordSystemAuditLog({
    actorId: actor.actorId,
    actorName: actor.displayName || input.guardianName,
    actorRole: actor.actorRole || 'GUARDIAN',
    actorRoleLabel: ROLE_LABELS[actor.actorRole] || actor.actorRole || 'Thân nhân',
    actionType: 'CREATE',
    actionLabel: 'Người nhà đăng ký ăn cơm tại Tâm An',
    module: 'CARE_OPERATIONS',
    moduleLabel: 'Cổng Thân Nhân - Đăng Ký Cơm',
    targetEntityId: newBooking.id,
    targetEntityName: `Đăng ký ${newBooking.portionCount} suất ${newBooking.mealTypeLabel} ngày ${newBooking.bookingDate}`,
    summary: `${input.guardianName} đã đăng ký ${newBooking.portionCount} suất cơm (${totalFee.toLocaleString('vi-VN')} đ) ăn cùng cụ ${newBooking.residentName}.`,
    details: `Tự động cộng dồn ${totalFee.toLocaleString('vi-VN')} đ vào Thông báo thu phí hàng tháng.`,
    severity: 'NORMAL',
  });

  return newBooking;
}

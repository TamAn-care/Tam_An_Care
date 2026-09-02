import { HumanActorSession } from '../types/actor';
import { recordSystemAuditLog } from './audit-log';

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
export const MOCK_VENDORS: VendorContract[] = [
  {
    id: 'VND-001',
    vendorCode: 'NCC-MEAT-01',
    vendorName: 'Công ty Thực Phẩm Sạch Vissan Care',
    contractNumber: 'HD-2026/TAMAN-TP01',
    category: 'MEAT_SEAFOOD',
    categoryLabel: 'Thịt tươi & Cá sạch VietGAP',
    contactPerson: 'Nguyễn Văn Hưng',
    contactPhone: '0912 345 678',
    deliverySchedule: '05:30 - 06:30 Hàng ngày',
    certification: 'VietGAP & ISO 22000',
    ratingScore: 4.9,
    status: 'ACTIVE',
  },
  {
    id: 'VND-002',
    vendorCode: 'NCC-VEG-02',
    vendorName: 'HTX Nông Nghiệp Hữu Cơ Đà Lạt Organic',
    contractNumber: 'HD-2026/TAMAN-RAU02',
    category: 'VEGETABLES_FRUITS',
    categoryLabel: 'Rau củ quả hữu cơ',
    contactPerson: 'Trần Thị Thúy',
    contactPhone: '0988 765 432',
    deliverySchedule: '06:00 - 07:00 Hàng ngày',
    certification: 'Organic USDA & VietGAP',
    ratingScore: 4.8,
    status: 'ACTIVE',
  },
  {
    id: 'VND-003',
    vendorCode: 'NCC-DAIRY-03',
    vendorName: 'Công ty Cổ phần Sữa TH True Food & Dinh Dưỡng',
    contractNumber: 'HD-2026/TAMAN-SUA03',
    category: 'EGG_DAIRY',
    categoryLabel: 'Trứng gà ta & Sữa tiệt trùng canxi',
    contactPerson: 'Lê Minh Tuấn',
    contactPhone: '0903 112 233',
    deliverySchedule: '07:00 Thứ 2, 4, 6',
    certification: 'HACCP & FSSC 22000',
    ratingScore: 5.0,
    status: 'ACTIVE',
  },
  {
    id: 'VND-004',
    vendorCode: 'NCC-DRY-04',
    vendorName: 'Tổng Kho Lương Thực & Hạt Dinh Dưỡng An Lạc',
    contractNumber: 'HD-2026/TAMAN-KHO04',
    category: 'DRY_GOODS',
    categoryLabel: 'Gạo ST25 & Yến mạch dinh dưỡng',
    contactPerson: 'Phạm Đức Long',
    contactPhone: '0934 556 677',
    deliverySchedule: '08:30 Ngày 01 & 15 Hàng tháng',
    certification: 'TCVN & ISO 9001',
    ratingScore: 4.7,
    status: 'ACTIVE',
  },
];

// Mock In-memory Storage
let mockReceivingBatches: FoodReceivingBatch[] = [
  {
    batchId: 'RCV-20260902-001',
    receivedAt: '2026-09-02T06:15:00+07:00',
    vendorId: 'VND-001',
    vendorName: 'Công ty Thực Phẩm Sạch Vissan Care',
    deliveryNoteNumber: 'PGH-VIS-260902-88',
    vehiclePlate: '29C-882.14 (Xe chuyên dụng lạnh)',
    delivererName: 'Đỗ Văn Thành',
    delivererPhone: '0977 123 456',
    receiverId: 'STAFF-NUT-007',
    receiverName: 'Hoàng Minh Châu (Nhân viên dinh dưỡng)',
    totalItems: 3,
    totalOrderedWeight: 45.0,
    totalActualWeight: 44.8,
    weightVariancePercent: -0.44,
    totalValue: 6420000,
    overallStatus: 'ACCEPTED',
    signatureConfirmed: true,
    notes: 'Thịt tươi hồng hào, nhiệt độ thùng lạnh đạt -19.5°C chuẩn đông sâu, niêm phong kẹp chì nguyên vẹn.',
    items: [
      {
        itemId: 'ITEM-001',
        itemName: 'Thịt thăn heo VietGAP (Thái lát mềm)',
        category: 'MEAT_SEAFOOD',
        orderedQuantity: 20.0,
        actualQuantity: 20.0,
        unit: 'kg',
        variance: 0.0,
        variancePercent: 0.0,
        unitPrice: 140000,
        totalPrice: 2800000,
        deliveryTemp: -19.2,
        expiryDate: '2026-09-10',
        sensoryQuality: 'FRESH_PRISTINE',
        packagingCondition: 'INTACT_SEALED',
        status: 'ACCEPTED',
        storageZone: 'FREEZER',
      },
      {
        itemId: 'ITEM-002',
        itemName: 'Thịt bò phi lê Úc (Hầm mềm dưỡng lão)',
        category: 'MEAT_SEAFOOD',
        orderedQuantity: 15.0,
        actualQuantity: 14.8,
        unit: 'kg',
        variance: -0.2,
        variancePercent: -1.33,
        unitPrice: 210000,
        totalPrice: 3108000,
        deliveryTemp: -20.0,
        expiryDate: '2026-09-12',
        sensoryQuality: 'FRESH_PRISTINE',
        packagingCondition: 'INTACT_SEALED',
        status: 'ACCEPTED',
        storageZone: 'FREEZER',
        note: 'Hụt 0.2kg do hao hụt rã đông đá bao bì, đã ghi nhận khấu trừ hóa đơn.',
      },
      {
        itemId: 'ITEM-003',
        itemName: 'Cá hồi Na Uy phi lê không xương',
        category: 'MEAT_SEAFOOD',
        orderedQuantity: 10.0,
        actualQuantity: 10.0,
        unit: 'kg',
        variance: 0.0,
        variancePercent: 0.0,
        unitPrice: 320000,
        totalPrice: 3200000,
        deliveryTemp: -18.8,
        expiryDate: '2026-09-08',
        sensoryQuality: 'FRESH_PRISTINE',
        packagingCondition: 'INTACT_SEALED',
        status: 'ACCEPTED',
        storageZone: 'FREEZER',
      },
    ],
  },
  {
    batchId: 'RCV-20260902-002',
    receivedAt: '2026-09-02T06:45:00+07:00',
    vendorId: 'VND-002',
    vendorName: 'HTX Nông Nghiệp Hữu Cơ Đà Lạt Organic',
    deliveryNoteNumber: 'PGH-DL-260902-12',
    vehiclePlate: '49A-345.67',
    delivererName: 'Trịnh Quốc Bình',
    delivererPhone: '0918 223 344',
    receiverId: 'STAFF-NUT-007',
    receiverName: 'Hoàng Minh Châu (Nhân viên dinh dưỡng)',
    totalItems: 4,
    totalOrderedWeight: 60.0,
    totalActualWeight: 60.5,
    weightVariancePercent: 0.83,
    totalValue: 2450000,
    overallStatus: 'ACCEPTED',
    signatureConfirmed: true,
    notes: 'Rau xanh tươi ngon, cuống lá khô ráo, đóng thùng xốp có đá gel giữ nhiệt 4°C.',
    items: [
      {
        itemId: 'ITEM-004',
        itemName: 'Rau cải bó xôi hữu cơ (Giàu sắt)',
        category: 'VEGETABLES_FRUITS',
        orderedQuantity: 15.0,
        actualQuantity: 15.2,
        unit: 'kg',
        variance: 0.2,
        variancePercent: 1.33,
        unitPrice: 45000,
        totalPrice: 684000,
        deliveryTemp: 3.5,
        expiryDate: '2026-09-05',
        sensoryQuality: 'FRESH_PRISTINE',
        packagingCondition: 'INTACT_SEALED',
        status: 'ACCEPTED',
        storageZone: 'CHILLER',
      },
      {
        itemId: 'ITEM-005',
        itemName: 'Bí đỏ hồ lô hạt sen (Nấu canh dưỡng sinh)',
        category: 'VEGETABLES_FRUITS',
        orderedQuantity: 20.0,
        actualQuantity: 20.0,
        unit: 'kg',
        variance: 0.0,
        variancePercent: 0.0,
        unitPrice: 30000,
        totalPrice: 600000,
        deliveryTemp: 5.0,
        expiryDate: '2026-09-15',
        sensoryQuality: 'FRESH_PRISTINE',
        packagingCondition: 'INTACT_SEALED',
        status: 'ACCEPTED',
        storageZone: 'CHILLER',
      },
      {
        itemId: 'ITEM-006',
        itemName: 'Cà rốt Đà Lạt hữu cơ',
        category: 'VEGETABLES_FRUITS',
        orderedQuantity: 15.0,
        actualQuantity: 15.3,
        unit: 'kg',
        variance: 0.3,
        variancePercent: 2.0,
        unitPrice: 35000,
        totalPrice: 535500,
        deliveryTemp: 4.2,
        expiryDate: '2026-09-12',
        sensoryQuality: 'FRESH_PRISTINE',
        packagingCondition: 'INTACT_SEALED',
        status: 'ACCEPTED',
        storageZone: 'CHILLER',
      },
      {
        itemId: 'ITEM-007',
        itemName: 'Đậu phụ non Nhật Bản (Protein thực vật)',
        category: 'VEGETABLES_FRUITS',
        orderedQuantity: 10.0,
        actualQuantity: 10.0,
        unit: 'kg',
        variance: 0.0,
        variancePercent: 0.0,
        unitPrice: 40000,
        totalPrice: 400000,
        deliveryTemp: 3.0,
        expiryDate: '2026-09-06',
        sensoryQuality: 'FRESH_PRISTINE',
        packagingCondition: 'INTACT_SEALED',
        status: 'ACCEPTED',
        storageZone: 'CHILLER',
      },
    ],
  },
];

let mockFoodInventory: FoodInventoryItem[] = [
  {
    id: 'INV-F01',
    itemName: 'Thịt thăn heo VietGAP (Thái lát mềm)',
    category: 'MEAT_SEAFOOD',
    storageZone: 'FREEZER',
    currentStock: 35.0,
    minSafetyStock: 15.0,
    unit: 'kg',
    batchId: 'RCV-20260902-001',
    vendorName: 'Công ty Thực Phẩm Sạch Vissan Care',
    receivedDate: '2026-09-02',
    expiryDate: '2026-09-10',
    daysToExpiry: 8,
    unitPrice: 140000,
    status: 'FRESH',
  },
  {
    id: 'INV-F02',
    itemName: 'Thịt bò phi lê Úc (Hầm mềm)',
    category: 'MEAT_SEAFOOD',
    storageZone: 'FREEZER',
    currentStock: 22.5,
    minSafetyStock: 10.0,
    unit: 'kg',
    batchId: 'RCV-20260902-001',
    vendorName: 'Công ty Thực Phẩm Sạch Vissan Care',
    receivedDate: '2026-09-02',
    expiryDate: '2026-09-12',
    daysToExpiry: 10,
    unitPrice: 210000,
    status: 'FRESH',
  },
  {
    id: 'INV-F03',
    itemName: 'Cá hồi Na Uy phi lê',
    category: 'MEAT_SEAFOOD',
    storageZone: 'FREEZER',
    currentStock: 16.0,
    minSafetyStock: 8.0,
    unit: 'kg',
    batchId: 'RCV-20260902-001',
    vendorName: 'Công ty Thực Phẩm Sạch Vissan Care',
    receivedDate: '2026-09-02',
    expiryDate: '2026-09-08',
    daysToExpiry: 6,
    unitPrice: 320000,
    status: 'FRESH',
  },
  {
    id: 'INV-F04',
    itemName: 'Rau cải bó xôi hữu cơ',
    category: 'VEGETABLES_FRUITS',
    storageZone: 'CHILLER',
    currentStock: 18.2,
    minSafetyStock: 10.0,
    unit: 'kg',
    batchId: 'RCV-20260902-002',
    vendorName: 'HTX Nông Nghiệp Hữu Cơ Đà Lạt Organic',
    receivedDate: '2026-09-02',
    expiryDate: '2026-09-05',
    daysToExpiry: 3,
    unitPrice: 45000,
    status: 'FRESH',
  },
  {
    id: 'INV-F05',
    itemName: 'Bí đỏ hồ lô hạt sen',
    category: 'VEGETABLES_FRUITS',
    storageZone: 'CHILLER',
    currentStock: 28.0,
    minSafetyStock: 15.0,
    unit: 'kg',
    batchId: 'RCV-20260902-002',
    vendorName: 'HTX Nông Nghiệp Hữu Cơ Đà Lạt Organic',
    receivedDate: '2026-09-02',
    expiryDate: '2026-09-15',
    daysToExpiry: 13,
    unitPrice: 30000,
    status: 'FRESH',
  },
  {
    id: 'INV-F06',
    itemName: 'Trứng gà ta thảo mộc (Vỉ 30 quả)',
    category: 'EGG_DAIRY',
    storageZone: 'CHILLER',
    currentStock: 180,
    minSafetyStock: 60,
    unit: 'quả',
    batchId: 'RCV-20260901-003',
    vendorName: 'Công ty Cổ phần Sữa TH True Food',
    receivedDate: '2026-09-01',
    expiryDate: '2026-09-20',
    daysToExpiry: 18,
    unitPrice: 4500,
    status: 'FRESH',
  },
  {
    id: 'INV-F07',
    itemName: 'Sữa tươi tiệt trùng bổ sung Canxi TH',
    category: 'EGG_DAIRY',
    storageZone: 'CHILLER',
    currentStock: 120,
    minSafetyStock: 50,
    unit: 'hộp 180ml',
    batchId: 'RCV-20260901-003',
    vendorName: 'Công ty Cổ phần Sữa TH True Food',
    receivedDate: '2026-09-01',
    expiryDate: '2026-12-01',
    daysToExpiry: 90,
    unitPrice: 10500,
    status: 'FRESH',
  },
  {
    id: 'INV-F08',
    itemName: 'Gạo ST25 Ông Cua (Gạo mềm thơm dưỡng lão)',
    category: 'DRY_GOODS',
    storageZone: 'DRY_ROOM',
    currentStock: 250,
    minSafetyStock: 100,
    unit: 'kg',
    batchId: 'RCV-20260825-001',
    vendorName: 'Tổng Kho Lương Thực An Lạc',
    receivedDate: '2026-08-25',
    expiryDate: '2027-02-25',
    daysToExpiry: 176,
    unitPrice: 38000,
    status: 'FRESH',
  },
  {
    id: 'INV-F09',
    itemName: 'Dầu ăn Oliu Extra Virgin (Tốt tim mạch)',
    category: 'SPICES_CONDIMENTS',
    storageZone: 'DRY_ROOM',
    currentStock: 24,
    minSafetyStock: 10,
    unit: 'chai 1L',
    batchId: 'RCV-20260825-002',
    vendorName: 'Tổng Kho Lương Thực An Lạc',
    receivedDate: '2026-08-25',
    expiryDate: '2027-08-25',
    daysToExpiry: 357,
    unitPrice: 185000,
    status: 'FRESH',
  },
];

let mockFoodSamples: FoodSampleArchive[] = [
  {
    id: 'SMP-20260902-SANG',
    sampleDate: '2026-09-02',
    mealType: 'BREAKFAST',
    mealTypeLabel: 'Bữa Sáng (06:45)',
    dishName: 'Cháo cá hồi Na Uy hạt sen & bí đỏ xay mịn',
    sampleWeight: '150g',
    containerType: 'Hộp thủy tinh Borosilicate niêm phong',
    storageLocation: 'Tủ lưu mẫu số 01 - Ngăn 1',
    storageTemp: '+3.8°C',
    samplerId: 'STAFF-NUT-007',
    samplerName: 'Hoàng Minh Châu (Nhân viên dinh dưỡng)',
    savedAt: '2026-09-02T06:45:00+07:00',
    retainUntil: '2026-09-03T06:45:00+07:00',
    status: 'ACTIVE_STORAGE',
    sensoryNote: 'Cháo sánh mịn, thơm mùi cá hồi và hạt sen, không có mùi lạ, nhiệt độ bảo quản đạt chuẩn.',
  },
  {
    id: 'SMP-20260902-TRUA',
    sampleDate: '2026-09-02',
    mealType: 'LUNCH',
    mealTypeLabel: 'Bữa Trưa (11:15)',
    dishName: 'Cơm mềm, Bò hầm củ quả, Canh bí đỏ thịt bằm, Đậu phụ non sốt cà',
    sampleWeight: '200g',
    containerType: 'Khay lưu mẫu 4 ngăn inox 304 có nắp khóa',
    storageLocation: 'Tủ lưu mẫu số 01 - Ngăn 2',
    storageTemp: '+3.5°C',
    samplerId: 'STAFF-NUT-007',
    samplerName: 'Hoàng Minh Châu (Nhân viên dinh dưỡng)',
    savedAt: '2026-09-02T11:15:00+07:00',
    retainUntil: '2026-09-03T11:15:00+07:00',
    status: 'ACTIVE_STORAGE',
    sensoryNote: 'Thịt bò chín mềm, màu sắc tươi tắn, độ mặn <0.6% chuẩn chế độ ăn giảm muối.',
  },
  {
    id: 'SMP-20260901-TOI',
    sampleDate: '2026-09-01',
    mealType: 'DINNER',
    mealTypeLabel: 'Bữa Tối (17:30)',
    dishName: 'Cháo thịt gà xé hạt sen & Súp rau củ bắp ngọt',
    sampleWeight: '150g',
    containerType: 'Hộp thủy tinh Borosilicate',
    storageLocation: 'Tủ lưu mẫu số 01 - Ngăn 4',
    storageTemp: '+3.6°C',
    samplerId: 'STAFF-NUT-007',
    samplerName: 'Hoàng Minh Châu (Nhân viên dinh dưỡng)',
    savedAt: '2026-09-01T17:30:00+07:00',
    retainUntil: '2026-09-02T17:30:00+07:00',
    destroyedAt: '2026-09-02T17:35:00+07:00',
    status: 'SAFELY_DESTROYED',
    sensoryNote: 'Đã lưu đủ 24 giờ, toàn viện 100% không có sự cố tiêu hóa, hủy mẫu an toàn theo quy định.',
  },
];

let mockDispatches: DailyMealDispatch[] = [
  {
    id: 'DSP-20260902-01',
    dispatchDate: '2026-09-02',
    mealType: 'BREAKFAST',
    mealTypeLabel: 'Bữa Sáng',
    menuName: 'Cháo cá hồi Na Uy hạt sen & Sữa tươi canxi',
    residentCount: 78,
    dispatchedBy: 'Hoàng Minh Châu (Dinh dưỡng)',
    items: [
      { itemId: 'INV-F03', itemName: 'Cá hồi Na Uy phi lê', quantity: 6.0, unit: 'kg' },
      { itemId: 'INV-F05', itemName: 'Bí đỏ hồ lô hạt sen', quantity: 8.0, unit: 'kg' },
      { itemId: 'INV-F08', itemName: 'Gạo ST25 Ông Cua', quantity: 12.0, unit: 'kg' },
      { itemId: 'INV-F07', itemName: 'Sữa tươi tiệt trùng TH', quantity: 78, unit: 'hộp 180ml' },
    ],
    status: 'SERVED',
  },
  {
    id: 'DSP-20260902-02',
    dispatchDate: '2026-09-02',
    mealType: 'LUNCH',
    mealTypeLabel: 'Bữa Trưa',
    menuName: 'Bò hầm củ quả, Đậu phụ non sốt cà & Canh cải bó xôi thịt bằm',
    residentCount: 78,
    dispatchedBy: 'Hoàng Minh Châu (Dinh dưỡng)',
    items: [
      { itemId: 'INV-F02', itemName: 'Thịt bò phi lê Úc', quantity: 10.0, unit: 'kg' },
      { itemId: 'INV-F01', itemName: 'Thịt thăn heo VietGAP', quantity: 8.0, unit: 'kg' },
      { itemId: 'INV-F04', itemName: 'Rau cải bó xôi hữu cơ', quantity: 12.0, unit: 'kg' },
      { itemId: 'INV-F08', itemName: 'Gạo ST25 Ông Cua', quantity: 18.0, unit: 'kg' },
    ],
    status: 'COOKED',
  },
];

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
    actorId: actor.actorId || 'STAFF-NUT-007',
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
    actorId: actor.actorId || 'STAFF-NUT-007',
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
    actorId: actor.actorId || 'STAFF-NUT-007',
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
    actorId: actor.actorId || 'STAFF-NUT-007',
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

export function downloadKitchenInventoryCSV(inventory: FoodInventoryItem[]) {
  const headers = ['ID', 'Tên Mặt Hàng', 'Danh Mục', 'Kho Lưu', 'Tồn Hiện Tại', 'Đơn Vị', 'Mức An Toàn', 'Hạn Sử Dụng', 'Số Ngày Còn Lại', 'Đơn Giá', 'Trạng Thái'];
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
    i.unitPrice,
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

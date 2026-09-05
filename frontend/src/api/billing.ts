import { HumanActorSession } from '../types/actor';
import { recordSystemAuditLog } from './audit-log';
import { ROLE_LABELS } from '../auth/role-policy';

export type InvoiceStatus = 'PENDING' | 'PARTIAL' | 'PAID' | 'SETTLED';
export type PaymentMethod = 'BANK_TRANSFER' | 'CASH' | 'DEPOSIT_DEDUCTION';

export interface ConsumableChargeItem {
  itemId: string;
  itemCode: string;
  name: string;
  unit: string;
  unitPrice: number;
  quantity: number;
  totalPrice: number;
  date: string;
  prescribedBy?: string;
}

export interface ExtraMealChargeItem {
  date: string;
  mealType: string;
  guestName: string;
  price: number;
  notes?: string;
}

export interface SupportServiceUsage {
  serviceId: string;
  serviceName: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalPrice: number;
  date?: string;
  notes?: string;
}

export interface AppliedDiscount {
  id: string;
  name: string;
  reasonCategory: 'PREPAY' | 'POLICY_BENEFICIARY' | 'STAFF_FAMILY' | 'DIRECTOR_APPROVAL' | 'EVENT_PROMO' | 'SPECIAL_HARDSHIP' | 'OTHER';
  discountType: 'PERCENT' | 'FIXED_AMOUNT';
  discountValue: number; // % hoặc VNĐ
  amountDeducted: number; // Số tiền VNĐ được giảm trừ thực tế
  reasonNotes: string;
  approvedBy: string;
  approvedRole: string;
  approvedAt: string;
}

export interface ResidentMonthlyInvoice {
  invoiceId: string;
  invoiceCode: string;
  residentId: string;
  residentName: string;
  room: string;
  bed: string;
  billingMonth: string; // YYYY-MM
  careLevel: 1 | 2 | 3;
  roomTier: string;
  
  // I. Phí Chăm Sóc Cơ Bản
  basicPackageId: string;
  basicPackageName: string;
  basicPackageFee: number;
  
  // II. Tiền Đặt Cọc Ký Quỹ
  depositFee: number; // Tiền đặt cọc (VD: 20.000.000đ)
  
  // III. Phí Chăm Sóc Hỗ Trợ
  supportServicesFee: number;
  supportServiceItems: SupportServiceUsage[];
  
  // IV. Phí Chăm Sóc Mở Rộng
  extendedCareFee: number;
  extendedCareDays?: number;
  extendedCareRate?: number;
  
  // V. Giảm Trừ Nghỉ Phép / Bất Khả Kháng
  leaveDays: number;
  forceMajeureLeaveDays: number; // Cấp cứu, bệnh viện, triệu tập pháp luật: 200.000đ/ngày
  regularLeaveDays: number; // Nghỉ phép thông thường / thăm nhà: 100.000đ/ngày
  leaveDeductionFee: number;
  
  // VI. Phụ Thu Ngày Lễ Tết
  holidayDays: number;
  holidaySurchargeFee: number;
  
  // VII. Chức Năng Giảm Giá & Ưu Đãi Đặc Biệt
  discountsApplied: AppliedDiscount[];
  totalDiscountAmount: number;
  
  // VIII. Chi Phí Suất Ăn Thân Nhân & Vật Tư Tiêu Hao
  extraMealsFee: number;
  extraMealItems: ExtraMealChargeItem[];
  consumablesFee: number;
  consumableItems: ConsumableChargeItem[];
  
  // Tổng Hợp Thu Phí
  subtotalAmount: number; // Tổng trước giảm giá
  totalAmount: number; // Tổng thực thu sau giảm giá & giảm trừ
  paidAmount: number;
  remainingAmount: number;
  depositBalance: number;
  status: InvoiceStatus;
  
  issuedDate: string;
  dueDate: string;
  settledAt?: string;
  settledBy?: string;
  notes?: string;
}

export interface PaymentReceipt {
  receiptId: string;
  receiptCode: string;
  invoiceId: string;
  invoiceCode: string;
  residentId: string;
  residentName: string;
  amount: number;
  paymentMethod: PaymentMethod;
  transactionReference: string;
  receivedBy: string;
  receivedByRole: string;
  paidAt: string;
  notes?: string;
}

export interface BasicCarePackage {
  id: string;
  stt: number;
  name: string;
  roomType: string;
  bedCount: string;
  monthlyFee: number;
  description: string;
  note?: string;
}

export interface SupportServiceRate {
  id: string;
  stt: number;
  name: string;
  unit: string;
  priceMin: number;
  priceMax?: number;
  priceDisplay: string;
  pricingDetail?: string;
  note?: string;
}

export interface ExtendedCareRate {
  id: string;
  stt: number;
  name: string;
  unit: string;
  priceMin: number;
  priceMax?: number;
  priceDisplay: string;
  note?: string;
}

export interface PolicyDiscountRule {
  id: string;
  name: string;
  type: 'PREPAY_12M' | 'PREPAY_6M' | 'FORCE_MAJEURE_LEAVE' | 'REGULAR_LEAVE' | 'HOLIDAY_SURCHARGE_LONG' | 'HOLIDAY_SURCHARGE_SHORT';
  value: number; // % hoặc số tiền / ngày
  valueType: 'PERCENT' | 'FIXED_DAILY';
  description: string;
  category: 'PREPAY_DISCOUNT' | 'LEAVE_DEDUCTION' | 'HOLIDAY_SURCHARGE';
}

export interface SpecialDiscountPolicy {
  id: string;
  code: string;
  name: string;
  reasonCategory: 'PREPAY' | 'POLICY_BENEFICIARY' | 'STAFF_FAMILY' | 'DIRECTOR_APPROVAL' | 'EVENT_PROMO' | 'SPECIAL_HARDSHIP' | 'OTHER';
  discountType: 'PERCENT' | 'FIXED_AMOUNT';
  discountValue: number; // % hoặc VNĐ
  description: string;
  approvedBy?: string;
  approvedRole?: string;
  isActive: boolean;
}

export interface PricingMatrix {
  effectiveDate: string;
  basicCarePackages: BasicCarePackage[];
  supportServices: SupportServiceRate[];
  extendedCare: ExtendedCareRate[];
  policyRules: PolicyDiscountRule[];
  specialDiscountPolicies: SpecialDiscountPolicy[];
}

export const DISCOUNT_CATEGORY_LABELS: Record<string, { label: string; icon: string }> = {
  PREPAY: { label: 'Ưu đãi thanh toán trước (6 - 12 tháng)', icon: '🌟' },
  POLICY_BENEFICIARY: { label: 'Gia đình chính sách / Người có công', icon: '🎖️' },
  STAFF_FAMILY: { label: 'Người thân cán bộ nhân viên Tâm An', icon: '🤝' },
  DIRECTOR_APPROVAL: { label: 'Phê duyệt đặc biệt của Ban Giám đốc', icon: '✍️' },
  EVENT_PROMO: { label: 'Khuyến mãi sự kiện / Ngày hội người cao tuổi', icon: '🎁' },
  SPECIAL_HARDSHIP: { label: 'Hoàn cảnh khó khăn cần hỗ trợ nhân đạo', icon: '❤️' },
  OTHER: { label: 'Lý do miễn giảm khác', icon: '🏷️' },
};

export const DEFAULT_PRICING_MATRIX: PricingMatrix = {
  effectiveDate: '01/07/2026',
  
  // I. PHÍ DỊCH VỤ CHĂM SÓC CƠ BẢN (đồng/người/tháng)
  basicCarePackages: [
    {
      id: 'BCP-01',
      stt: 1,
      name: 'Phòng tập thể 6 giường',
      roomType: 'Phòng tập thể',
      bedCount: '6 giường',
      monthlyFee: 12000000,
      description: 'Phòng ở đạt chuẩn; vệ sinh khép kín; tiện nghi điều hòa nóng lạnh; chuông báo y tế; tủ để đồ; giặt là; tiêu hao bàn chải/kem đánh răng; bữa ăn dinh dưỡng; sinh hoạt thể chất & tinh thần; NV trực 24/7.',
      note: 'Chuẩn tiện nghi kinh tế, ấm cúng',
    },
    {
      id: 'BCP-02',
      stt: 2,
      name: 'Phòng tập thể 3,4 giường',
      roomType: 'Phòng tập thể',
      bedCount: '3 - 4 giường',
      monthlyFee: 14500000,
      description: 'Phòng tiêu chuẩn 3 - 4 cụ rộng rãi, ban công đón nắng, đầy đủ tiện nghi sinh hoạt và dinh dưỡng y học chuyên sâu.',
      note: 'Phổ biến và tối ưu sinh hoạt',
    },
    {
      id: 'BCP-03',
      stt: 3,
      name: 'Phòng VIP 2 giường',
      roomType: 'Phòng VIP',
      bedCount: '2 giường',
      monthlyFee: 16500000,
      description: 'Không gian yên tĩnh 2 cụ, tiện nghi cao cấp, điều hòa 2 chiều, TV thông minh, thiết bị hỗ trợ vận động an toàn.',
      note: 'Tiêu chuẩn cao cấp, thân mật',
    },
    {
      id: 'BCP-04',
      stt: 4,
      name: 'Phòng VIP 1 giường',
      roomType: 'Phòng VIP',
      bedCount: '1 giường',
      monthlyFee: 20000000,
      description: 'Phòng đơn riêng tư tuyệt đối, ban công riêng, giường bệnh y tế đa chức năng, dịch vụ phục vụ tận phòng theo yêu cầu.',
      note: 'Riêng tư tuyệt đối & Đẳng cấp',
    },
    {
      id: 'BCP-05',
      stt: 5,
      name: 'Phòng chăm sóc toàn diện',
      roomType: 'Phòng Chăm Sóc Toàn Diện',
      bedCount: 'Đặc biệt',
      monthlyFee: 16500000,
      description: 'Dành cho các cụ phụ thuộc hoàn toàn, cần theo dõi y tế 24/7, phòng chống loét tì đè, tập phục hồi chức năng thụ động.',
      note: 'Theo dõi y tế & Chăm sóc 24/7',
    },
  ],

  // II. PHÍ DỊCH VỤ CHĂM SÓC HỖ TRỢ
  supportServices: [
    {
      id: 'SS-01',
      stt: 1,
      name: 'Hỗ trợ tắm gội',
      unit: 'tháng',
      priceMin: 500000,
      priceMax: 1500000,
      priceDisplay: '500.000 - 1.500.000',
      note: 'Tùy theo nhu cầu của NCT',
    },
    {
      id: 'SS-02',
      stt: 2,
      name: 'Hỗ trợ nâng đỡ, di chuyển',
      unit: 'tháng',
      priceMin: 500000,
      priceDisplay: '500.000',
      note: 'Hỗ trợ xe lăn, tập đi lại',
    },
    {
      id: 'SS-03',
      stt: 3,
      name: 'Hỗ trợ xúc ăn',
      unit: 'tháng',
      priceMin: 500000,
      priceDisplay: '500.000',
      note: 'Đảm bảo cữ ăn đủ dinh dưỡng',
    },
    {
      id: 'SS-04',
      stt: 4,
      name: 'Hỗ trợ vệ sinh',
      unit: 'tháng',
      priceMin: 1000000,
      priceMax: 3000000,
      priceDisplay: '1.000.000 - 3.000.000',
      note: 'Tùy theo tình trạng NCT',
    },
    {
      id: 'SS-05',
      stt: 5,
      name: 'Hỗ trợ ăn qua sonde',
      unit: 'tháng',
      priceMin: 1500000,
      priceDisplay: '1.500.000',
      note: 'Bơm thức ăn dinh dưỡng qua sonde',
    },
    {
      id: 'SS-06',
      stt: 6,
      name: 'Chăm sóc NCT bị lẫn tuổi già',
      unit: 'tháng',
      priceMin: 500000,
      priceMax: 2000000,
      priceDisplay: '500.000 - 2.000.000',
      note: 'Tùy theo tình trạng NCT',
    },
    {
      id: 'SS-07',
      stt: 7,
      name: 'Chăm sóc hỗ trợ tập luyện, xoa bóp, vật lý trị liệu, phục hồi chức năng chuyên sâu sử dụng công nghệ AI',
      unit: 'buổi',
      priceMin: 350000,
      priceMax: 500000,
      priceDisplay: '350.000 - 500.000',
      pricingDetail: '350.000 đ/buổi nếu đăng ký cả tháng và 500.000 đ/buổi nếu đăng ký buổi lẻ',
      note: 'Sử dụng AI & chuyên gia VLTL',
    },
    {
      id: 'SS-08',
      stt: 8,
      name: 'Chăm sóc các ổ loét',
      unit: 'tháng',
      priceMin: 2000000,
      priceDisplay: '2.000.000',
      note: 'Rửa ổ loét, đệm chống loét chuyên dụng',
    },
    {
      id: 'SS-09',
      stt: 9,
      name: 'Chăm sóc người đặt sonde bàng quang',
      unit: 'tháng',
      priceMin: 2000000,
      priceDisplay: '2.000.000',
      note: 'Thay túi nước tiểu, vệ sinh vô khuẩn',
    },
    {
      id: 'SS-10',
      stt: 10,
      name: 'Chăm sóc người đặt nội khí quản',
      unit: 'tháng',
      priceMin: 2000000,
      priceDisplay: '2.000.000',
      note: 'Hút đờm dãi, vệ sinh mở khí quản',
    },
    {
      id: 'SS-11',
      stt: 11,
      name: 'Thay băng, rửa vết thương',
      unit: 'lần',
      priceMin: 150000,
      priceDisplay: '150.000',
      note: 'Vô trùng chuẩn y tế',
    },
    {
      id: 'SS-12',
      stt: 12,
      name: 'Chi phí nhân viên đi cùng đưa đón đi Bệnh viện, hoặc đưa đón theo yêu cầu GĐ NCT',
      unit: 'lần',
      priceMin: 400000,
      priceDisplay: '400.000',
      note: 'Chi phí xe: theo nhà cung cấp (TT gọi hộ)',
    },
  ],

  // III. PHÍ DỊCH VỤ CHĂM SÓC MỞ RỘNG
  extendedCare: [
    {
      id: 'EC-01',
      stt: 1,
      name: 'Ở bán trú (7h - 17h)',
      unit: 'ngày',
      priceMin: 350000,
      priceDisplay: '350.000',
      note: 'Bao gồm ăn trưa, nghỉ trưa và sinh hoạt',
    },
    {
      id: 'EC-02',
      stt: 2,
      name: 'Ở nội trú dưới 10 ngày (Ngắn hạn)',
      unit: 'ngày',
      priceMin: 550000,
      priceMax: 700000,
      priceDisplay: '550.000 - 700.000',
      note: 'Tùy theo loại phòng và thể trạng',
    },
  ],

  // IV. QUY TẮC GIẢM TRỪ VẮNG MẶT & PHỤ THU
  policyRules: [
    {
      id: 'PR-01',
      name: 'Ưu đãi đóng trước 12 tháng',
      type: 'PREPAY_12M',
      value: 5,
      valueType: 'PERCENT',
      description: 'Giảm ngay 5% trên tổng phí chăm sóc cơ bản khi thanh toán trước 1 năm.',
      category: 'PREPAY_DISCOUNT',
    },
    {
      id: 'PR-02',
      name: 'Ưu đãi đóng trước 6 tháng',
      type: 'PREPAY_6M',
      value: 3,
      valueType: 'PERCENT',
      description: 'Giảm ngay 3% trên tổng phí chăm sóc cơ bản khi thanh toán trước 6 tháng.',
      category: 'PREPAY_DISCOUNT',
    },
    {
      id: 'PR-03',
      name: 'Giảm trừ vắng mặt bất khả kháng',
      type: 'FORCE_MAJEURE_LEAVE',
      value: 200000,
      valueType: 'FIXED_DAILY',
      description: 'Giảm 200.000đ/ngày trong trường hợp cấp cứu, đi bệnh viện, có mặt theo yêu cầu pháp luật.',
      category: 'LEAVE_DEDUCTION',
    },
    {
      id: 'PR-04',
      name: 'Giảm trừ vắng mặt thông thường',
      type: 'REGULAR_LEAVE',
      value: 100000,
      valueType: 'FIXED_DAILY',
      description: 'Giảm 100.000đ/ngày trong các trường hợp nghỉ phép, về thăm nhà đã báo trước theo quy tắc RLA.',
      category: 'LEAVE_DEDUCTION',
    },
    {
      id: 'PR-05',
      name: 'Phụ thu ngày Lễ, Tết (NCT lưu trú dài hạn)',
      type: 'HOLIDAY_SURCHARGE_LONG',
      value: 200000,
      valueType: 'FIXED_DAILY',
      description: 'Phụ thu 200.000đ/ngày vào các ngày nghỉ Tết, Lễ 30/4-1/5, Quốc Khánh theo quy định.',
      category: 'HOLIDAY_SURCHARGE',
    },
    {
      id: 'PR-06',
      name: 'Phụ thu ngày Lễ, Tết (NCT lưu trú ngắn hạn)',
      type: 'HOLIDAY_SURCHARGE_SHORT',
      value: 300000,
      valueType: 'FIXED_DAILY',
      description: 'Phụ thu 300.000đ/ngày đối với khách lưu trú ngắn hạn dưới 10 ngày trong dịp Lễ Tết.',
      category: 'HOLIDAY_SURCHARGE',
    },
  ],

  // V. CHÍNH SÁCH GIẢM GIÁ ĐẶC BIỆT (Special Discount Policies)
  specialDiscountPolicies: [
    {
      id: 'DISC-01',
      code: 'PREPAY-12M',
      name: 'Ưu đãi đóng trước 12 tháng',
      reasonCategory: 'PREPAY',
      discountType: 'PERCENT',
      discountValue: 5,
      description: 'Áp dụng cho gia đình nộp toàn bộ chi phí chăm sóc trọn gói 12 tháng.',
      approvedRole: 'SUPERVISOR',
      isActive: true,
    },
    {
      id: 'DISC-02',
      code: 'PREPAY-6M',
      name: 'Ưu đãi đóng trước 6 tháng',
      reasonCategory: 'PREPAY',
      discountType: 'PERCENT',
      discountValue: 3,
      description: 'Áp dụng cho gia đình nộp toàn bộ chi phí chăm sóc 6 tháng.',
      approvedRole: 'SUPERVISOR',
      isActive: true,
    },
    {
      id: 'DISC-03',
      code: 'CHINH-SACH-01',
      name: 'Gia đình chính sách / Người có công',
      reasonCategory: 'POLICY_BENEFICIARY',
      discountType: 'PERCENT',
      discountValue: 10,
      description: 'Mức tri ân giảm 10% phí dịch vụ chăm sóc cơ bản cho Người có công với cách mạng.',
      approvedRole: 'SUPERVISOR',
      isActive: true,
    },
    {
      id: 'DISC-04',
      code: 'THAN-NHAN-NV',
      name: 'Người thân cán bộ nhân viên Tâm An',
      reasonCategory: 'STAFF_FAMILY',
      discountType: 'PERCENT',
      discountValue: 15,
      description: 'Chính sách phúc lợi nội bộ dành cho tứ thân phụ mẫu của cán bộ công nhân viên.',
      approvedRole: 'SUPERVISOR',
      isActive: true,
    },
    {
      id: 'DISC-05',
      code: 'BGĐ-THOA-THUAN',
      name: 'Giảm giá theo thỏa thuận Ban Giám đốc',
      reasonCategory: 'DIRECTOR_APPROVAL',
      discountType: 'FIXED_AMOUNT',
      discountValue: 1000000,
      description: 'Mức giảm cố định trực tiếp vào viện phí hàng tháng theo phê duyệt của Ban Giám đốc.',
      approvedRole: 'SUPERVISOR',
      isActive: true,
    },
  ],
};

// In-memory persistent stores
let pricingMatrixState: PricingMatrix = JSON.parse(JSON.stringify(DEFAULT_PRICING_MATRIX));

/**
 * Công thức tính toán chuẩn hóa & nhất quán 100% cho mọi Bảng kê thu phí tại Viện Dưỡng Lão Tâm An
 */
export function calculateInvoiceTotals(
  inv: Partial<ResidentMonthlyInvoice>
): {
  supportServicesFee: number;
  leaveDeductionFee: number;
  totalDiscountAmount: number;
  extraMealsFee: number;
  consumablesFee: number;
  subtotalAmount: number;
  totalAmount: number;
  remainingAmount: number;
} {
  const basicFee = inv.basicPackageFee || 0;
  const depositFee = inv.depositFee || 0;
  
  // III. Phí dịch vụ hỗ trợ (tính từ danh mục dịch vụ thực tế hoặc giữ 0 nếu không có dịch vụ hỗ trợ)
  const supportServicesFee = (inv.supportServiceItems && inv.supportServiceItems.length > 0)
    ? inv.supportServiceItems.reduce((sum, item) => sum + (item.totalPrice || item.unitPrice * item.quantity), 0)
    : (inv.supportServicesFee || 0);

  const extendedFee = inv.extendedCareFee || 0;
  const holidayFee = inv.holidaySurchargeFee || 0;

  // V. Giảm trừ vắng mặt RLA-BR-01
  const forceMajeureDays = inv.forceMajeureLeaveDays || 0;
  const regularDays = inv.regularLeaveDays || 0;
  const leaveDeductionFee = (forceMajeureDays * 200000) + (regularDays * 100000);

  // VII. Ưu đãi / Giảm giá phê duyệt
  const totalDiscountAmount = (inv.discountsApplied || []).reduce(
    (sum, d) => sum + (d.amountDeducted || 0),
    0
  );

  // VIII. Suất ăn & Vật tư
  const extraMealsFee = (inv.extraMealItems && inv.extraMealItems.length > 0)
    ? inv.extraMealItems.reduce((sum, m) => sum + m.price, 0)
    : (inv.extraMealsFee || 0);

  const consumablesFee = (inv.consumableItems && inv.consumableItems.length > 0)
    ? inv.consumableItems.reduce((sum, c) => sum + (c.totalPrice || c.unitPrice * c.quantity), 0)
    : (inv.consumablesFee || 0);

  // Tổng phụ (Subtotal): Phí cơ bản + Đặt cọc + Phí hỗ trợ + Phí mở rộng + Phụ thu lễ
  const subtotalAmount = basicFee + depositFee + supportServicesFee + extendedFee + holidayFee;

  // Tổng thực thu (Total Amount): Subtotal - Giảm trừ vắng mặt - Giảm giá + Suất ăn + Vật tư
  const totalAmount = Math.max(
    0,
    subtotalAmount - leaveDeductionFee - totalDiscountAmount + extraMealsFee + consumablesFee
  );

  const paid = inv.paidAmount || 0;
  const remainingAmount = Math.max(0, totalAmount - paid);

  return {
    supportServicesFee,
    leaveDeductionFee,
    totalDiscountAmount,
    extraMealsFee,
    consumablesFee,
    subtotalAmount,
    totalAmount,
    remainingAmount,
  };
}

/**
 * Khởi tạo Bảng kê thu phí theo chuẩn hợp đồng đăng ký mới cho Người cao tuổi
 */
export function createMonthlyInvoiceForResident(params: {
  residentId: string;
  residentName: string;
  room: string;
  bed: string;
  billingMonth: string;
  careLevel: 1 | 2 | 3;
  packageId: string;
  isFirstMonthDeposit?: boolean;
  supportServiceItems?: SupportServiceUsage[];
  discountsApplied?: AppliedDiscount[];
}): ResidentMonthlyInvoice {
  const pkg = DEFAULT_PRICING_MATRIX.basicCarePackages.find((p) => p.id === params.packageId) ||
    DEFAULT_PRICING_MATRIX.basicCarePackages[0];

  const depositFee = params.isFirstMonthDeposit !== false ? 20000000 : 0;
  const supportItems = params.supportServiceItems || [];

  const draftInvoice: Partial<ResidentMonthlyInvoice> = {
    invoiceId: `INV-${params.billingMonth.replace('-', '')}-${Date.now().toString().slice(-3)}`,
    invoiceCode: `BKVP-${params.billingMonth}-${params.residentId.replace(/[^0-9]/g, '') || '009'}`,
    residentId: params.residentId,
    residentName: params.residentName,
    room: params.room,
    bed: params.bed,
    billingMonth: params.billingMonth,
    careLevel: params.careLevel,
    roomTier: pkg.name,
    basicPackageId: pkg.id,
    basicPackageName: pkg.name,
    basicPackageFee: pkg.monthlyFee,
    depositFee: depositFee,
    supportServiceItems: supportItems,
    extendedCareFee: 0,
    leaveDays: 0,
    forceMajeureLeaveDays: 0,
    regularLeaveDays: 0,
    holidayDays: 0,
    holidaySurchargeFee: 0,
    discountsApplied: params.discountsApplied || [],
    extraMealItems: [],
    consumableItems: [],
    paidAmount: 0,
    depositBalance: 20000000,
    status: 'PENDING',
    issuedDate: new Date().toISOString().slice(0, 10),
    dueDate: `${params.billingMonth}-10`,
  };

  const calculated = calculateInvoiceTotals(draftInvoice);

  return {
    ...draftInvoice,
    ...calculated,
  } as ResidentMonthlyInvoice;
}

let mockInvoices: ResidentMonthlyInvoice[] = [
  {
    invoiceId: 'INV-202609-001',
    invoiceCode: 'BKVP-2026-09-001',
    residentId: 'RES-001',
    residentName: 'Cụ Nguyễn Văn An',
    room: '101',
    bed: '101-A',
    billingMonth: '2026-09',
    careLevel: 2,
    roomTier: 'Phòng VIP 2 giường',
    
    // I. Phí Cơ Bản
    basicPackageId: 'BCP-03',
    basicPackageName: 'Phòng VIP 2 giường',
    basicPackageFee: 16500000,
    
    // II. Tiền Đặt Cọc
    depositFee: 20000000,
    
    // III. Phí Chăm Sóc Hỗ Trợ
    supportServicesFee: 0,
    supportServiceItems: [],
    
    // IV. Mở Rộng
    extendedCareFee: 0,
    
    // V. Giảm Trừ Vắng Mặt
    leaveDays: 3,
    forceMajeureLeaveDays: 1, // 1 ngày đi khám viện tuyến trên: 200.000đ
    regularLeaveDays: 2, // 2 ngày về thăm nhà: 2 * 100.000đ = 200.000đ
    leaveDeductionFee: 400000,
    
    // VI. Phụ Thu Lễ
    holidayDays: 1,
    holidaySurchargeFee: 200000, // Lễ 2/9 dài hạn: 200.000đ
    
    // VII. Giảm Giá Đặc Biệt
    discountsApplied: [
      {
        id: 'APP-DISC-01',
        name: 'Ưu đãi đóng trước 6 tháng',
        reasonCategory: 'PREPAY',
        discountType: 'PERCENT',
        discountValue: 3,
        amountDeducted: 495000, // 3% của 16.500.000đ
        reasonNotes: 'Gia đình đã đóng trước trọn gói 6 tháng viện phí.',
        approvedBy: 'Hoàng Quốc Anh',
        approvedRole: 'SUPERVISOR',
        approvedAt: '2026-09-01T08:00:00Z',
      },
    ],
    totalDiscountAmount: 495000,
    
    // VIII. Suất Ăn & Vật Tư
    extraMealsFee: 120000,
    extraMealItems: [
      { date: '2026-09-02', mealType: 'Bữa trưa thân nhân', guestName: 'Nguyễn Văn Minh (Con trai)', price: 60000, notes: 'Đăng ký ăn cùng cụ dịp lễ' },
      { date: '2026-09-03', mealType: 'Bữa trưa thân nhân', guestName: 'Nguyễn Thị Hoa (Con gái)', price: 60000, notes: 'Thăm cụ cuối tuần' },
    ],
    consumablesFee: 275000,
    consumableItems: [
      { itemId: 'INV-MED-001', itemCode: 'VT-001', name: 'Que thử đường huyết Accu-Chek Instant', unit: 'que', unitPrice: 12000, quantity: 10, totalPrice: 120000, date: '2026-09-01', prescribedBy: 'ĐD. Lê Thị Mai' },
      { itemId: 'INV-MED-002', itemCode: 'VT-002', name: 'Tã bỉm người lớn Caryn Siêu Thấm M/L', unit: 'miếng', unitPrice: 15000, quantity: 9, totalPrice: 135000, date: '2026-09-02', prescribedBy: 'ĐD. Lê Thị Mai' },
      { itemId: 'INV-MED-003', itemCode: 'VT-003', name: 'Băng gạc tiệt trùng Urgo Sterile 10x10', unit: 'miếng', unitPrice: 8000, quantity: 2, totalPrice: 20000, date: '2026-09-02', prescribedBy: 'ĐD. Lê Thị Mai' },
    ],
    
    // Tổng
    subtotalAmount: 36700000, // 16.5m (phí cơ bản) + 20m (tiền cọc) + 0m (hỗ trợ) + 0.2m (lễ)
    totalAmount: 36200000, // 36.7m - 0.4m (vắng mặt) - 0.495m (giảm giá) + 0.12m + 0.275m = 36.200.000đ
    paidAmount: 36200000,
    remainingAmount: 0,
    depositBalance: 20000000,
    status: 'PAID',
    issuedDate: '2026-09-01',
    dueDate: '2026-09-10',
    notes: 'Gia đình đã thanh toán toàn bộ qua chuyển khoản ngân hàng.',
  },
  {
    invoiceId: 'INV-202609-002',
    invoiceCode: 'BKVP-2026-09-002',
    residentId: 'RES-002',
    residentName: 'Cụ Trần Thị Bình',
    room: '102',
    bed: '102-A',
    billingMonth: '2026-09',
    careLevel: 3,
    roomTier: 'Phòng VIP 1 giường',
    
    basicPackageId: 'BCP-04',
    basicPackageName: 'Phòng VIP 1 giường',
    basicPackageFee: 20000000,
    
    depositFee: 20000000,
    
    supportServicesFee: 3500000,
    supportServiceItems: [
      { serviceId: 'SS-05', serviceName: 'Hỗ trợ ăn qua sonde dạ dày', quantity: 1, unit: 'tháng', unitPrice: 1500000, totalPrice: 1500000 },
      { serviceId: 'SS-08', serviceName: 'Chăm sóc ổ loét tì đè độ 2', quantity: 1, unit: 'tháng', unitPrice: 2000000, totalPrice: 2000000 },
    ],
    
    extendedCareFee: 0,
    leaveDays: 0,
    forceMajeureLeaveDays: 0,
    regularLeaveDays: 0,
    leaveDeductionFee: 0,
    holidayDays: 1,
    holidaySurchargeFee: 200000,
    
    discountsApplied: [
      {
        id: 'APP-DISC-02',
        name: 'Gia đình chính sách / Người có công',
        reasonCategory: 'POLICY_BENEFICIARY',
        discountType: 'PERCENT',
        discountValue: 10,
        amountDeducted: 2000000, // 10% của 20.000.000đ
        reasonNotes: 'Cụ là Thương binh 3/4, có Huân chương kháng chiến.',
        approvedBy: 'Hoàng Quốc Anh',
        approvedRole: 'SUPERVISOR',
        approvedAt: '2026-09-01T08:30:00Z',
      },
    ],
    totalDiscountAmount: 2000000,
    
    extraMealsFee: 0,
    extraMealItems: [],
    consumablesFee: 495000,
    consumableItems: [
      { itemId: 'INV-MED-002', itemCode: 'VT-002', name: 'Tã bỉm người lớn Caryn Siêu Thấm M/L', unit: 'miếng', unitPrice: 15000, quantity: 30, totalPrice: 450000, date: '2026-09-01', prescribedBy: 'ĐD. Lê Thị Mai' },
      { itemId: 'INV-MED-006', itemCode: 'VT-006', name: 'Ống Sonde ăn dạ dày Levin Silicone Fr16', unit: 'sợi', unitPrice: 45000, quantity: 1, totalPrice: 45000, date: '2026-09-01', prescribedBy: 'ĐD. Lê Thị Mai' },
    ],
    
    subtotalAmount: 43700000, // 20m + 20m + 3.5m + 0.2m
    totalAmount: 42195000, // 43.7m - 2m (giảm giá) + 0.495m
    paidAmount: 35000000,
    remainingAmount: 7195000,
    depositBalance: 20000000,
    status: 'PARTIAL',
    issuedDate: '2026-09-01',
    dueDate: '2026-09-10',
    notes: 'Đã thanh toán 35 triệu, phần còn lại thanh toán trước ngày 10/09.',
  },
  {
    invoiceId: 'INV-202609-003',
    invoiceCode: 'BKVP-2026-09-003',
    residentId: 'RES-003',
    residentName: 'Cụ Lê Thị Cúc',
    room: '103',
    bed: '103-B',
    billingMonth: '2026-09',
    careLevel: 1,
    roomTier: 'Phòng tập thể 6 giường',
    
    basicPackageId: 'BCP-01',
    basicPackageName: 'Phòng tập thể 6 giường',
    basicPackageFee: 12000000,
    
    depositFee: 20000000,
    
    supportServicesFee: 500000,
    supportServiceItems: [
      { serviceId: 'SS-02', serviceName: 'Hỗ trợ nâng đỡ, di chuyển', quantity: 1, unit: 'tháng', unitPrice: 500000, totalPrice: 500000 },
    ],
    
    extendedCareFee: 0,
    leaveDays: 4,
    forceMajeureLeaveDays: 0,
    regularLeaveDays: 4, // 4 ngày về thăm nhà: 4 * 100.000đ = 400.000đ
    leaveDeductionFee: 400000,
    holidayDays: 1,
    holidaySurchargeFee: 200000,
    
    discountsApplied: [],
    totalDiscountAmount: 0,
    
    extraMealsFee: 60000,
    extraMealItems: [
      { date: '2026-09-01', mealType: 'Bữa trưa thân nhân', guestName: 'Lê Thanh Hải (Cháu)', price: 60000, notes: 'Đăng ký ăn cơm trưa cùng bà' },
    ],
    consumablesFee: 36000,
    consumableItems: [
      { itemId: 'INV-MED-001', itemCode: 'VT-001', name: 'Que thử đường huyết Accu-Chek Instant', unit: 'que', unitPrice: 12000, quantity: 3, totalPrice: 36000, date: '2026-09-02', prescribedBy: 'ĐD. Lê Thị Mai' },
    ],
    
    subtotalAmount: 32700000, // 12m + 20m + 0.5m + 0.2m
    totalAmount: 32396000, // 32.7m - 0.4m + 0.06m + 0.036m
    paidAmount: 0,
    remainingAmount: 32396000,
    depositBalance: 20000000,
    status: 'PENDING',
    issuedDate: '2026-09-01',
    dueDate: '2026-09-10',
    notes: 'Đã gửi bảng kê chi tiết cho gia đình qua Zalo và SMS.',
  },
];

let mockReceipts: PaymentReceipt[] = [
  {
    receiptId: 'REC-202609-001',
    receiptCode: 'PT-202609-001',
    invoiceId: 'INV-202609-001',
    invoiceCode: 'BKVP-2026-09-001',
    residentId: 'RES-001',
    residentName: 'Cụ Nguyễn Văn An',
    amount: 36200000,
    paymentMethod: 'BANK_TRANSFER',
    transactionReference: 'MB-FT260901889922',
    receivedBy: 'Vũ Hoàng Nam',
    receivedByRole: 'ACCOUNTANT',
    paidAt: '2026-09-01T14:20:00Z',
    notes: 'Chuyển khoản Vietcombank - Người nộp: Nguyễn Văn Minh (Con trai)',
  },
  {
    receiptId: 'REC-202609-002',
    receiptCode: 'PT-202609-002',
    invoiceId: 'INV-202609-002',
    invoiceCode: 'BKVP-2026-09-002',
    residentId: 'RES-002',
    residentName: 'Cụ Trần Thị Bình',
    amount: 15000000,
    paymentMethod: 'BANK_TRANSFER',
    transactionReference: 'TCB-TX99381204',
    receivedBy: 'Vũ Hoàng Nam',
    receivedByRole: 'ACCOUNTANT',
    paidAt: '2026-09-02T09:15:00Z',
    notes: 'Tạm ứng đợt 1 viện phí tháng 09/2026',
  },
];

// Async API functions
export async function fetchMonthlyInvoices(month: string = '2026-09'): Promise<ResidentMonthlyInvoice[]> {
  await new Promise((r) => setTimeout(r, 120));
  return mockInvoices.filter((inv) => inv.billingMonth === month);
}

export async function fetchInvoiceDetails(invoiceId: string): Promise<ResidentMonthlyInvoice | null> {
  await new Promise((r) => setTimeout(r, 80));
  return mockInvoices.find((i) => i.invoiceId === invoiceId) || null;
}

export interface CreatePaymentInput {
  invoiceId: string;
  amount: number;
  paymentMethod: PaymentMethod;
  transactionReference: string;
  notes?: string;
}

export async function recordPayment(
  actor: HumanActorSession,
  input: CreatePaymentInput
): Promise<PaymentReceipt> {
  await new Promise((r) => setTimeout(r, 180));

  const inv = mockInvoices.find((i) => i.invoiceId === input.invoiceId);
  if (!inv) throw new Error('Không tìm thấy bảng kê thu phí tương ứng.');

  if (input.amount <= 0) throw new Error('Số tiền thanh toán phải lớn hơn 0.');

  const newPaidAmount = inv.paidAmount + input.amount;
  inv.paidAmount = newPaidAmount;
  inv.remainingAmount = Math.max(0, inv.totalAmount - newPaidAmount);

  if (inv.remainingAmount === 0) {
    inv.status = 'PAID';
  } else {
    inv.status = 'PARTIAL';
  }

  const receipt: PaymentReceipt = {
    receiptId: `REC-${Date.now()}`,
    receiptCode: `PT-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(mockReceipts.length + 1).padStart(3, '0')}`,
    invoiceId: inv.invoiceId,
    invoiceCode: inv.invoiceCode,
    residentId: inv.residentId,
    residentName: inv.residentName,
    amount: input.amount,
    paymentMethod: input.paymentMethod,
    transactionReference: input.transactionReference || 'TIEN-MAT-QUAY',
    receivedBy: actor.displayName || 'Kế toán viên',
    receivedByRole: actor.actorRole,
    paidAt: new Date().toISOString(),
    notes: input.notes,
  };

  mockReceipts = [receipt, ...mockReceipts];

  // Record audit log
  await recordSystemAuditLog({
    actorId: actor.actorId || 'STAFF-ACC-004',
    actorName: actor.displayName || 'Kế toán viên',
    actorRole: actor.actorRole,
    actorRoleLabel: ROLE_LABELS[actor.actorRole] || actor.actorRole,
    actionType: 'PAYMENT_RECORDED',
    actionLabel: 'Lập phiếu thu tiền viện phí',
    module: 'BILLING_PRICING',
    moduleLabel: 'Quản lý Phí & Bảng Giá',
    targetEntityId: receipt.receiptCode,
    targetEntityName: `Phiếu thu ${receipt.receiptCode} cho ${inv.residentName}`,
    residentId: inv.residentId,
    residentName: inv.residentName,
    summary: `Thu ${input.amount.toLocaleString('vi-VN')} đ của ${inv.residentName} (${inv.invoiceCode}).`,
    details: `Hình thức: ${input.paymentMethod}. Tham chiếu giao dịch: ${receipt.transactionReference}.`,
    previousValue: `Đã thu trước: ${(newPaidAmount - input.amount).toLocaleString('vi-VN')} đ`,
    newValue: `Đã thu mới: ${newPaidAmount.toLocaleString('vi-VN')} đ (Còn nợ: ${inv.remainingAmount.toLocaleString('vi-VN')} đ)`,
    severity: 'NORMAL',
  });

  return receipt;
}

export async function fetchPaymentReceipts(invoiceId?: string): Promise<PaymentReceipt[]> {
  await new Promise((r) => setTimeout(r, 100));
  if (invoiceId) {
    return mockReceipts.filter((r) => r.invoiceId === invoiceId);
  }
  return mockReceipts;
}

export async function fetchPricingMatrix(): Promise<PricingMatrix> {
  await new Promise((r) => setTimeout(r, 80));
  return JSON.parse(JSON.stringify(pricingMatrixState));
}

export async function updatePricingMatrix(
  actor: HumanActorSession,
  matrix: Partial<PricingMatrix>
): Promise<PricingMatrix> {
  await new Promise((r) => setTimeout(r, 150));
  
  if (actor.actorRole !== 'SUPERVISOR' && actor.actorRole !== 'CARE_MANAGER') {
    throw new Error('Chỉ Ban Giám đốc và Quản lý mới có quyền điều chỉnh đơn giá và gói dịch vụ.');
  }

  pricingMatrixState = {
    ...pricingMatrixState,
    ...matrix,
  };

  // Record audit log
  await recordSystemAuditLog({
    actorId: actor.actorId || 'STAFF-DIR-001',
    actorName: actor.displayName || 'Ban Giám đốc',
    actorRole: actor.actorRole,
    actorRoleLabel: ROLE_LABELS[actor.actorRole] || actor.actorRole,
    actionType: 'PRICING_CONFIG_EDIT',
    actionLabel: 'Cập nhật cấu hình Bảng giá dịch vụ',
    module: 'BILLING_PRICING',
    moduleLabel: 'Quản lý Phí & Bảng Giá',
    targetEntityId: 'PRICING-MATRIX-2026',
    targetEntityName: 'Biểu phí chuẩn Trung tâm Dưỡng lão Tâm An',
    summary: `Cập nhật cấu hình bảng giá và các gói dịch vụ chăm sóc bởi ${actor.displayName}.`,
    details: 'Thay đổi có hiệu lực ngay lập tức cho toàn bộ các kỳ thu phí tiếp theo.',
    severity: 'CRITICAL',
  });

  return JSON.parse(JSON.stringify(pricingMatrixState));
}

export interface ApplyDiscountInput {
  invoiceId: string;
  policyId?: string;
  name: string;
  reasonCategory: 'PREPAY' | 'POLICY_BENEFICIARY' | 'STAFF_FAMILY' | 'DIRECTOR_APPROVAL' | 'EVENT_PROMO' | 'SPECIAL_HARDSHIP' | 'OTHER';
  discountType: 'PERCENT' | 'FIXED_AMOUNT';
  discountValue: number;
  reasonNotes: string;
}

export async function applyDiscountToInvoice(
  actor: HumanActorSession,
  input: ApplyDiscountInput
): Promise<ResidentMonthlyInvoice> {
  await new Promise((r) => setTimeout(r, 150));

  if (actor.actorRole !== 'SUPERVISOR' && actor.actorRole !== 'CARE_MANAGER') {
    throw new Error('Chỉ Ban Giám đốc và Quản lý mới có thẩm quyền phê duyệt mức giảm giá.');
  }

  const inv = mockInvoices.find((i) => i.invoiceId === input.invoiceId);
  if (!inv) throw new Error('Không tìm thấy bảng kê thu phí.');

  let deduction = 0;
  if (input.discountType === 'PERCENT') {
    deduction = Math.round((inv.basicPackageFee * input.discountValue) / 100);
  } else {
    deduction = input.discountValue;
  }

  const newDiscount: AppliedDiscount = {
    id: `DISC-${Date.now()}`,
    name: input.name,
    reasonCategory: input.reasonCategory,
    discountType: input.discountType,
    discountValue: input.discountValue,
    amountDeducted: deduction,
    reasonNotes: input.reasonNotes,
    approvedBy: actor.displayName || 'Ban Giám đốc',
    approvedRole: actor.actorRole,
    approvedAt: new Date().toISOString(),
  };

  inv.discountsApplied = [...(inv.discountsApplied || []), newDiscount];
  const calculated = calculateInvoiceTotals(inv);
  Object.assign(inv, calculated);

  if (inv.remainingAmount === 0 && inv.paidAmount > 0) {
    inv.status = 'PAID';
  }

  // Record audit log
  await recordSystemAuditLog({
    actorId: actor.actorId || 'STAFF-MGR-002',
    actorName: actor.displayName || 'Ban Giám đốc / Quản lý',
    actorRole: actor.actorRole,
    actorRoleLabel: ROLE_LABELS[actor.actorRole] || actor.actorRole,
    actionType: 'DISCOUNT_APPLIED',
    actionLabel: 'Phê duyệt mức giảm giá đặc biệt',
    module: 'BILLING_PRICING',
    moduleLabel: 'Quản lý Phí & Bảng Giá',
    targetEntityId: inv.invoiceCode,
    targetEntityName: `Bảng kê thu phí ${inv.invoiceCode} - ${inv.residentName}`,
    residentId: inv.residentId,
    residentName: inv.residentName,
    summary: `Áp dụng giảm ${deduction.toLocaleString('vi-VN')} đ (${input.discountType === 'PERCENT' ? `${input.discountValue}%` : 'tiền mặt'}) cho ${inv.residentName}.`,
    details: `Căn cứ phê duyệt: ${input.reasonNotes}`,
    previousValue: `Tổng thực thu cũ: ${(inv.totalAmount + deduction).toLocaleString('vi-VN')} đ`,
    newValue: `Tổng thực thu mới: ${inv.totalAmount.toLocaleString('vi-VN')} đ (-${deduction.toLocaleString('vi-VN')} đ)`,
    severity: 'IMPORTANT',
  });

  return { ...inv };
}

export async function removeDiscountFromInvoice(
  actor: HumanActorSession,
  invoiceId: string,
  discountId: string
): Promise<ResidentMonthlyInvoice> {
  await new Promise((r) => setTimeout(r, 150));

  if (actor.actorRole !== 'SUPERVISOR' && actor.actorRole !== 'CARE_MANAGER') {
    throw new Error('Chỉ Ban Giám đốc và Quản lý mới có thẩm quyền điều chỉnh giảm giá.');
  }

  const inv = mockInvoices.find((i) => i.invoiceId === invoiceId);
  if (!inv) throw new Error('Không tìm thấy bảng kê thu phí.');

  const removed = inv.discountsApplied?.find((d) => d.id === discountId);
  inv.discountsApplied = (inv.discountsApplied || []).filter((d) => d.id !== discountId);
  const calculated = calculateInvoiceTotals(inv);
  Object.assign(inv, calculated);

  // Record audit log
  await recordSystemAuditLog({
    actorId: actor.actorId || 'STAFF-MGR-002',
    actorName: actor.displayName || 'Ban Giám đốc / Quản lý',
    actorRole: actor.actorRole,
    actorRoleLabel: ROLE_LABELS[actor.actorRole] || actor.actorRole,
    actionType: 'DISCOUNT_REMOVED',
    actionLabel: 'Hủy bỏ mức giảm giá đã cấp',
    module: 'BILLING_PRICING',
    moduleLabel: 'Quản lý Phí & Bảng Giá',
    targetEntityId: inv.invoiceCode,
    targetEntityName: `Bảng kê thu phí ${inv.invoiceCode} - ${inv.residentName}`,
    residentId: inv.residentId,
    residentName: inv.residentName,
    summary: `Hủy bỏ mức giảm giá "${removed?.name || discountId}" của ${inv.residentName}.`,
    details: `Thực hiện bởi ${actor.displayName} (${actor.actorRole}).`,
    severity: 'IMPORTANT',
  });

  return { ...inv };
}

export async function settleInvoice(
  actor: HumanActorSession,
  invoiceId: string
): Promise<ResidentMonthlyInvoice> {
  await new Promise((r) => setTimeout(r, 150));

  const inv = mockInvoices.find((i) => i.invoiceId === invoiceId);
  if (!inv) throw new Error('Không tìm thấy bảng kê thu phí.');

  if (inv.remainingAmount > 0) {
    throw new Error('Bảng kê còn số dư chưa thanh toán, không thể quyết toán khóa sổ.');
  }

  inv.status = 'SETTLED';
  inv.settledAt = new Date().toISOString();
  inv.settledBy = actor.displayName || 'Kế toán viên';

  // Record audit log
  await recordSystemAuditLog({
    actorId: actor.actorId || 'STAFF-ACC-004',
    actorName: actor.displayName || 'Kế toán viên',
    actorRole: actor.actorRole,
    actorRoleLabel: ROLE_LABELS[actor.actorRole] || actor.actorRole,
    actionType: 'INVOICE_SETTLED',
    actionLabel: 'Quyết toán khóa sổ thu phí',
    module: 'BILLING_PRICING',
    moduleLabel: 'Quản lý Phí & Bảng Giá',
    targetEntityId: inv.invoiceCode,
    targetEntityName: `Bảng kê thu phí ${inv.invoiceCode} - ${inv.residentName}`,
    residentId: inv.residentId,
    residentName: inv.residentName,
    summary: `Khóa sổ quyết toán bảng kê ${inv.invoiceCode} tháng ${inv.billingMonth} cho ${inv.residentName}.`,
    details: `Tổng thu: ${inv.totalAmount.toLocaleString('vi-VN')} đ. Số dư: 0 đ.`,
    previousValue: 'Trạng thái: PAID',
    newValue: 'Trạng thái: SETTLED (Đã khóa sổ)',
    severity: 'IMPORTANT',
  });

  return { ...inv };
}

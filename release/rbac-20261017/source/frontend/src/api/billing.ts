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
  contractType?: 'LONG_TERM' | 'SHORT_TERM';

  // I. Phí Chăm Sóc Cơ Bản
  basicPackageId: string;
  basicPackageName: string;
  basicPackageFee: number;

  // II. Tiền Đặt Cọc Ký Quỹ & Nợ Đặt Cọc (Thu 1 lần khi nhập viện)
  depositFee: number; // Tiền đặt cọc (VD: 20.000.000đ)
  depositStatus?: 'PAID' | 'UNPAID'; // Trạng thái hoàn tất cọc
  unpaidDepositDebt?: number; // Nợ tiền đặt cọc chưa thanh toán

  // Nợ Tháng Trước (Tự động cập nhật từ tháng trước liền kề)
  previousMonthDebt?: number;

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

  // Kiểm Duyệt & Phê Duyệt Phát Hành Cổng Thân Nhân
  auditStatus?: 'DRAFT' | 'PENDING_MANAGER' | 'MANAGER_APPROVED' | 'MANAGER_REPORTED' | 'DIRECTOR_APPROVED';
  reviewedByManagerAt?: string;
  reviewedByManagerName?: string;
  managerNotes?: string;
  reportedErrorReason?: string; // Nội dung Quản lý báo cáo sai sót cho Ban Giám đốc
  approvedByDirectorAt?: string;
  approvedByDirectorName?: string;
  directorEditNotes?: string;
  publishedToFamilyAt?: string;
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

export interface DepositItemConfig {
  id: string;
  name: string;
  amount: number;
  description: string;
}

export interface PricingMatrix {
  effectiveDate: string;
  basicCarePackages: BasicCarePackage[];
  supportServices: SupportServiceRate[];
  extendedCare: ExtendedCareRate[];
  policyRules: PolicyDiscountRule[];
  specialDiscountPolicies: SpecialDiscountPolicy[];
  depositFee?: DepositItemConfig;
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

  // VI. HẠNG MỤC THU TIỀN ĐẶT CỌC LƯU TRÚ (KÝ QUỶ)
  depositFee: {
    id: 'DEP-01',
    name: 'Tiền đặt cọc tiếp nhận lưu trú',
    amount: 20000000,
    description: 'Mỗi Cụ khi vào ở tại Trung Tâm Dưỡng Lão Tâm An sẽ nộp khoản tiền đặt cọc ký quỹ 20.000.000 đồng. Khoản tiền này nhằm bảo đảm thực hiện hợp đồng, bù đắp các chi phí phát sinh cấp cứu (nếu có) hoặc đối trừ khi thanh lý. Số tiền này sẽ được hoàn trả 100% cho Thân nhân khi kết thúc hợp đồng dịch vụ.',
  },
};

// In-memory persistent stores
let pricingMatrixState: PricingMatrix = JSON.parse(JSON.stringify(DEFAULT_PRICING_MATRIX));

/**
 * Tự động tra cứu & tính toán số tiền còn thiếu (nợ) của tháng trước liền kề đối với người cao tuổi
 */
export function getPreviousMonthDebt(residentId?: string, currentBillingMonth?: string): number {
  if (!residentId || !currentBillingMonth) return 0;

  let year: number, month: number;
  if (currentBillingMonth.includes('-')) {
    const parts = currentBillingMonth.split('-');
    year = parseInt(parts[0], 10);
    month = parseInt(parts[1], 10);
  } else if (currentBillingMonth.includes('/')) {
    const parts = currentBillingMonth.split('/');
    month = parseInt(parts[0], 10);
    year = parseInt(parts[1], 10);
  } else {
    return 0;
  }

  if (isNaN(year) || isNaN(month)) return 0;

  const prevYear = month === 1 ? year - 1 : year;
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevBillingMonthDash = `${prevYear}-${String(prevMonth).padStart(2, '0')}`;
  const prevBillingMonthSlash = `${String(prevMonth).padStart(2, '0')}/${prevYear}`;

  const prevInv = mockInvoices.find(
    (i) =>
      i.residentId === residentId &&
      (i.billingMonth === prevBillingMonthDash || i.billingMonth === prevBillingMonthSlash)
  );

  return prevInv ? (prevInv.remainingAmount || 0) : 0;
}

/**
 * Công thức tính toán chuẩn hóa & nhất quán 100% cho mọi Bảng kê thu phí tại Trung Tâm Dưỡng Lão Tâm An:
 * Tổng thực thu (theo từng tháng) = Phí cơ bản + Phí chăm sóc hỗ trợ + Phí chăm sóc mở rộng + Phụ thu Lễ Tết + Nợ tháng trước - Giảm trừ nghỉ phép/vắng mặt - Giảm giá (+ Suất ăn & Vật tư)
 * Tiền đặt cọc chỉ tính 1 lần khi nhập vào Trung tâm (nếu chưa đóng sẽ hiển thị Nợ tiền đặt cọc).
 */
export function calculateInvoiceTotals(
  inv: Partial<ResidentMonthlyInvoice>
): {
  supportServicesFee: number;
  leaveDeductionFee: number;
  totalDiscountAmount: number;
  extraMealsFee: number;
  consumablesFee: number;
  previousMonthDebt: number;
  unpaidDepositDebt: number;
  subtotalAmount: number;
  totalAmount: number;
  remainingAmount: number;
} {
  const basicFee = inv.basicPackageFee || 0;

  // III. Phí dịch vụ hỗ trợ (tính từ danh mục dịch vụ thực tế hoặc giữ 0 nếu không có dịch vụ hỗ trợ)
  const supportServicesFee = (inv.supportServiceItems && inv.supportServiceItems.length > 0)
    ? inv.supportServiceItems.reduce((sum, item) => sum + (item.totalPrice || item.unitPrice * item.quantity), 0)
    : (inv.supportServicesFee || 0);

  const extendedFee = inv.extendedCareFee || 0;
  const holidayFee = inv.holidaySurchargeFee || 0;

  // V. Giảm trừ vắng mặt RLA-BR-01
  const forceMajeureDays = inv.forceMajeureLeaveDays || 0;
  const regularDays = inv.regularLeaveDays || 0;
  const leaveDeductionFee = inv.leaveDeductionFee !== undefined
    ? inv.leaveDeductionFee
    : (forceMajeureDays * 200000) + (regularDays * 100000);

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

  // Nợ tháng trước: Tự động cập nhật số tiền còn thiếu của tháng trước liền kề
  const previousMonthDebt = inv.previousMonthDebt !== undefined
    ? inv.previousMonthDebt
    : getPreviousMonthDebt(inv.residentId, inv.billingMonth);

  // Tiền đặt cọc chỉ tính 1 lần khi nhập vào Trung tâm. Nếu chưa đóng cọc (depositStatus !== 'PAID'), tính nợ tiền đặt cọc
  const isDepositPaid = inv.depositStatus === 'PAID';
  const unpaidDepositDebt = isDepositPaid
    ? 0
    : (inv.unpaidDepositDebt !== undefined ? inv.unpaidDepositDebt : (inv.depositFee || 20000000));

  // Subtotal các khoản phí dịch vụ phát sinh hàng tháng
  const subtotalAmount = basicFee + supportServicesFee + extendedFee + holidayFee + extraMealsFee + consumablesFee;

  // Viện phí tháng này sau trừ các khoản giảm trừ & ưu đãi
  const currentMonthNet = Math.max(0, subtotalAmount - leaveDeductionFee - totalDiscountAmount);

  // TỔNG TIỀN CẦN THU / TỔNG PHẢI THU = Viện phí tháng này + Nợ tháng trước + Nợ tiền đặt cọc (nếu chưa đóng)
  const totalAmount = currentMonthNet + previousMonthDebt + unpaidDepositDebt;

  const paid = inv.paidAmount || 0;
  const remainingAmount = Math.max(0, totalAmount - paid);

  return {
    supportServicesFee,
    leaveDeductionFee,
    totalDiscountAmount,
    extraMealsFee,
    consumablesFee,
    previousMonthDebt,
    unpaidDepositDebt,
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

// NO SEED DATA — Production-ready empty state
let mockInvoices: ResidentMonthlyInvoice[] = [];

export async function reviewInvoiceByManager(
  actor: HumanActorSession,
  payload: {
    invoiceId: string;
    isAccurate: boolean;
    notesOrReason?: string;
  }
): Promise<ResidentMonthlyInvoice> {
  await new Promise((r) => setTimeout(r, 120));
  const inv = mockInvoices.find((i) => i.invoiceId === payload.invoiceId);
  if (!inv) throw new Error('Không tìm thấy bảng kê thu phí.');

  if (payload.isAccurate) {
    inv.auditStatus = 'MANAGER_APPROVED';
    inv.reviewedByManagerAt = new Date().toISOString();
    inv.reviewedByManagerName = actor.displayName || 'Nhân viên Quản lý';
    inv.managerNotes = payload.notesOrReason || 'Đã kiểm tra nội dung và xác nhận tính chính xác.';
  } else {
    inv.auditStatus = 'MANAGER_REPORTED';
    inv.reviewedByManagerAt = new Date().toISOString();
    inv.reviewedByManagerName = actor.displayName || 'Nhân viên Quản lý';
    inv.reportedErrorReason = payload.notesOrReason || 'Báo cáo có sai sót trong các hạng mục thu phí.';
  }

  await recordSystemAuditLog({
    actorId: actor.actorId || 'STAFF-MGR-001',
    actorName: actor.displayName || 'Quản Lý',
    actorRole: actor.actorRole,
    actorRoleLabel: ROLE_LABELS[actor.actorRole] || actor.actorRole,
    actionType: payload.isAccurate ? 'APPROVE' : 'REJECT',
    actionLabel: payload.isAccurate ? 'Quản lý xác nhận chính xác Bảng kê thu phí' : 'Quản lý báo cáo sai sót Bảng kê thu phí',
    module: 'BILLING_PRICING',
    moduleLabel: 'Quản lý Phí & Kế toán',
    targetEntityId: inv.invoiceId,
    targetEntityName: `${inv.invoiceCode} - ${inv.residentName}`,
    summary: payload.isAccurate
      ? `Nhân viên quản lý ${actor.displayName} đã thẩm định và xác nhận tính chính xác của bảng kê ${inv.invoiceCode}.`
      : `Nhân viên quản lý ${actor.displayName} đã báo cáo sai sót tới BGĐ cho bảng kê ${inv.invoiceCode}: ${payload.notesOrReason}`,
    severity: payload.isAccurate ? 'NORMAL' : 'IMPORTANT',
  });

  return JSON.parse(JSON.stringify(inv));
}

export async function updateInvoiceItemsByDirector(
  actor: HumanActorSession,
  payload: {
    invoiceId: string;
    basicPackageFee?: number;
    supportServicesFee?: number;
    extendedCareFee?: number;
    extendedCareDays?: number;
    regularLeaveDays?: number;
    forceMajeureLeaveDays?: number;
    holidayDays?: number;
    holidaySurchargeFee?: number;
    extraMealsFee?: number;
    consumablesFee?: number;
    previousMonthDebt?: number;
    depositStatus?: 'PAID' | 'UNPAID';
    unpaidDepositDebt?: number;
    directorEditNotes?: string;
  }
): Promise<ResidentMonthlyInvoice> {
  await new Promise((r) => setTimeout(r, 150));
  const inv = mockInvoices.find((i) => i.invoiceId === payload.invoiceId);
  if (!inv) throw new Error('Không tìm thấy bảng kê thu phí.');

  if (payload.basicPackageFee !== undefined) inv.basicPackageFee = payload.basicPackageFee;
  if (payload.supportServicesFee !== undefined) inv.supportServicesFee = payload.supportServicesFee;
  if (payload.extendedCareFee !== undefined) inv.extendedCareFee = payload.extendedCareFee;
  if (payload.extendedCareDays !== undefined) inv.extendedCareDays = payload.extendedCareDays;
  if (payload.regularLeaveDays !== undefined) inv.regularLeaveDays = payload.regularLeaveDays;
  if (payload.forceMajeureLeaveDays !== undefined) inv.forceMajeureLeaveDays = payload.forceMajeureLeaveDays;
  if (payload.holidayDays !== undefined) inv.holidayDays = payload.holidayDays;
  if (payload.holidaySurchargeFee !== undefined) inv.holidaySurchargeFee = payload.holidaySurchargeFee;
  if (payload.extraMealsFee !== undefined) inv.extraMealsFee = payload.extraMealsFee;
  if (payload.consumablesFee !== undefined) inv.consumablesFee = payload.consumablesFee;
  if (payload.previousMonthDebt !== undefined) inv.previousMonthDebt = payload.previousMonthDebt;
  if (payload.depositStatus !== undefined) inv.depositStatus = payload.depositStatus;
  if (payload.unpaidDepositDebt !== undefined) inv.unpaidDepositDebt = payload.unpaidDepositDebt;

  if (payload.directorEditNotes) inv.directorEditNotes = payload.directorEditNotes;

  // Tính toán lại các khoản vắng mặt & tổng cộng
  inv.leaveDays = (inv.forceMajeureLeaveDays || 0) + (inv.regularLeaveDays || 0);
  inv.leaveDeductionFee = ((inv.forceMajeureLeaveDays || 0) * 200000) + ((inv.regularLeaveDays || 0) * 100000);

  const totals = calculateInvoiceTotals(inv);
  inv.previousMonthDebt = totals.previousMonthDebt;
  inv.unpaidDepositDebt = totals.unpaidDepositDebt;
  inv.subtotalAmount = totals.subtotalAmount;
  inv.totalAmount = totals.totalAmount;
  inv.remainingAmount = totals.remainingAmount;

  // Đồng bộ trực tiếp sang mockDetailedFeeNotices để cập nhật ngay Cổng Thân Nhân & Trang in Thông báo thu phí:
  const noticeIndex = mockDetailedFeeNotices.findIndex(
    (n) =>
      n.residentId === inv.residentId ||
      n.id.includes(inv.invoiceCode) ||
      (inv.residentName && n.residentName.includes(inv.residentName.replace('Cụ ', '')))
  );

  if (noticeIndex !== -1) {
    const notice = mockDetailedFeeNotices[noticeIndex];
    notice.basicFee = inv.basicPackageFee;
    notice.supportFee = inv.supportServicesFee;
    notice.incurredFee = inv.holidaySurchargeFee;
    if (inv.holidaySurchargeFee > 0 && !notice.incurredContent) {
      notice.incurredContent = `Phụ thu Lễ Tết (${inv.holidayDays || 1} ngày)`;
    }
    notice.deductionFee = inv.leaveDeductionFee + inv.totalDiscountAmount;
    if (inv.leaveDays > 0 || inv.totalDiscountAmount > 0) {
      const parts = [];
      if (inv.leaveDays > 0) parts.push(`Giảm trừ ${inv.leaveDays} ngày vắng mặt`);
      if (inv.totalDiscountAmount > 0) parts.push(`Ưu đãi chính sách ${inv.totalDiscountAmount.toLocaleString('vi-VN')}đ`);
      notice.deductionNotes = parts.join(' & ');
    }
    notice.familyMealsFee = inv.extraMealsFee;
    notice.consumablesFee = inv.consumablesFee;
    notice.previousMonthDebt = inv.previousMonthDebt;
    notice.depositStatus = inv.depositStatus;
    notice.unpaidDepositDebt = inv.unpaidDepositDebt;
    notice.totalDue = inv.totalAmount;
    notice.remainingAmount = inv.remainingAmount;
    notice.isApproved = true;
    notice.isPublishedToFamilyPortal = true;
    notice.lastUpdatedBy = actor.displayName || 'Ban Giám Đốc';
    notice.lastUpdatedAt = new Date().toISOString();
  }

  await recordSystemAuditLog({
    actorId: actor.actorId || 'STAFF-DIR-001',
    actorName: actor.displayName || 'Ban Giám đốc',
    actorRole: actor.actorRole,
    actorRoleLabel: ROLE_LABELS[actor.actorRole] || actor.actorRole,
    actionType: 'UPDATE',
    actionLabel: 'Ban Giám đốc hiệu chỉnh các hạng mục Bảng kê thu phí',
    module: 'BILLING_PRICING',
    moduleLabel: 'Quản lý Phí & Kế toán',
    targetEntityId: inv.invoiceId,
    targetEntityName: `${inv.invoiceCode} - ${inv.residentName}`,
    summary: `Thành viên BGĐ ${actor.displayName} đã hiệu chỉnh các thông số/hạng mục của bảng kê ${inv.invoiceCode}. Ghi chú: ${payload.directorEditNotes || 'Đã điều chỉnh.'}`,
    severity: 'IMPORTANT',
  });

  return JSON.parse(JSON.stringify(inv));
}

export async function publishInvoiceToFamilyPortal(
  actor: HumanActorSession,
  invoiceId: string
): Promise<ResidentMonthlyInvoice> {
  await new Promise((r) => setTimeout(r, 120));
  const inv = mockInvoices.find((i) => i.invoiceId === invoiceId);
  if (!inv) throw new Error('Không tìm thấy bảng kê thu phí.');

  inv.auditStatus = 'DIRECTOR_APPROVED';
  inv.approvedByDirectorAt = new Date().toISOString();
  inv.approvedByDirectorName = actor.displayName || 'Thành viên Ban Giám đốc';
  inv.publishedToFamilyAt = new Date().toISOString();

  // Đồng bộ với mockDetailedFeeNotices nếu có
  const notice = mockDetailedFeeNotices.find((n) => n.residentId === inv.residentId || n.id.includes(inv.invoiceCode));
  if (notice) {
    notice.isApproved = true;
    notice.isPublishedToFamilyPortal = true;
    notice.approvedBy = actor.displayName || 'Ban Giám đốc';
    notice.approvedAt = new Date().toISOString();
  }

  await recordSystemAuditLog({
    actorId: actor.actorId || 'STAFF-DIR-001',
    actorName: actor.displayName || 'Ban Giám đốc',
    actorRole: actor.actorRole,
    actorRoleLabel: ROLE_LABELS[actor.actorRole] || actor.actorRole,
    actionType: 'APPROVE',
    actionLabel: 'Ban Giám đốc phê duyệt & Phát hành Cổng thân nhân',
    module: 'BILLING_PRICING',
    moduleLabel: 'Quản lý Phí & Kế toán',
    targetEntityId: inv.invoiceId,
    targetEntityName: `${inv.invoiceCode} - ${inv.residentName}`,
    summary: `Thành viên BGĐ ${actor.displayName} đã phê duyệt tính chính xác và chính thức phát hành Bảng kê thu phí ${inv.invoiceCode} tới Cổng Thân nhân.`,
    severity: 'CRITICAL',
  });

  return JSON.parse(JSON.stringify(inv));
}

// NO SEED DATA — Production-ready empty state
let mockReceipts: PaymentReceipt[] = [];

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

// ----------------------------------------------------------------------
// HẠNG MỤC 4: THÔNG BÁO THU PHÍ HÀNG THÁNG & ĐÓNG PHÍ (17 MỤC EXCEL)
// ----------------------------------------------------------------------
export interface DetailedMonthlyFeeNotice {
  id: string;
  residentId: string;
  residentName: string;
  residentCode: string;
  contractCode: string;
  billingMonth: string; // e.g. "09/2026"
  sponsorName?: string;
  sponsorPhone?: string;
  gender?: string;

  // 21 Mục Chi Phí Chi Tiết Theo Excel TB THU PHÍ TÂM AN 2026
  basicFee: number;                // 1. Phí cơ bản (1)
  supportFee: number;              // 2. Phí hỗ trợ (2)
  bathingLaundryFee: number;       // 3. Hỗ trợ tắm gội
  mobilityFee: number;             // 4. Hỗ trợ nâng đỡ, di chuyển
  hygieneFee: number;              // 5. Hỗ trợ vệ sinh
  feedingSondeFee: number;         // 6. Hỗ trợ xúc ăn / Hỗ trợ ăn qua sonde
  dementiaCareFee: number;         // 7. Chăm sóc NCT bị lẫn tuổi già
  soreCareFee: number;             // 8. Chăm sóc các ổ loét
  catheterCareFee: number;         // 9. Chăm sóc người đặt sonde bàng quang
  tracheostomyCareFee: number;     // 10. Chăm sóc người đặt nội khí quản
  woundDressingFee: number;        // 11. Thay băng, rửa vết thương
  rehabFee: number;                // 12. Vật lý trị liệu - PHCN
  incurredFee: number;             // 13. Phát sinh (3)
  incurredContent?: string;        // Nội dung phát sinh
  deductionFee: number;            // 14. Chi phí giảm trừ (4)
  deductionNotes?: string;          // Ghi chú chi tiết khoản giảm trừ
  previousMonthDebt: number;       // 15. Nợ tháng trước (5)
  debtNotes?: string;              // Ghi chú nợ
  depositStatus?: 'PAID' | 'UNPAID'; // Trạng thái đóng cọc
  unpaidDepositDebt?: number;      // Nợ tiền đặt cọc tiếp nhận lưu trú (ký quỹ) - Thu 1 lần khi nhập viện
  familyMealsFee: number;          // Tiền ăn cơm người nhà đăng ký tại Tâm An
  consumablesFee?: number;         // Phí vật tư y tế tiêu hao

  totalDue: number;                // TỔNG PHẢI THU (sum tự động)
  paidAmount: number;              // Đã thu
  remainingAmount: number;         // Còn phải thu (TỔNG PHẢI THU - Đã thu)
  status: 'PAID' | 'UNPAID' | 'PARTIAL'; // Trạng thái: Đã thu / Chưa thu / Thu một phần
  statusLabel: string;
  notes?: string;

  // Quy trình Kiểm duyệt & Phát hành Cổng Thân Nhân
  isApproved?: boolean;            // Đã được Kế toán/Quản lý kiểm duyệt
  isPublishedToFamilyPortal?: boolean; // Đã chính thức phát hành sang Cổng Thân Nhân
  approvedBy?: string;
  approvedAt?: string;
  approvalNotes?: string;

  lastUpdatedBy?: string;
  lastUpdatedAt?: string;
}

// NO SEED DATA — Production-ready empty state
let mockDetailedFeeNotices: DetailedMonthlyFeeNotice[] = [];

export async function fetchDetailedFeeNotices(
  residentId?: string,
  options?: { publishedOnly?: boolean }
): Promise<DetailedMonthlyFeeNotice[]> {
  await new Promise((r) => setTimeout(r, 100));
  let list = [...mockDetailedFeeNotices];
  if (residentId) {
    list = list.filter((n) => n.residentId === residentId);
  }
  if (options?.publishedOnly) {
    list = list.filter((n) => n.isPublishedToFamilyPortal);
  }
  return list;
}

export interface UpdateDetailedFeeNoticePayload {
  noticeId: string;
  basicFee: number;
  supportFee: number;
  bathingLaundryFee: number;
  mobilityFee: number;
  hygieneFee: number;
  feedingSondeFee: number;
  dementiaCareFee: number;
  soreCareFee: number;
  catheterCareFee: number;
  tracheostomyCareFee: number;
  woundDressingFee: number;
  rehabFee: number;
  incurredFee: number;
  incurredContent?: string;
  deductionFee: number;
  deductionNotes?: string;
  previousMonthDebt: number;
  debtNotes?: string;
  paidAmount: number;
  notes?: string;
}

export async function updateDetailedFeeNotice(
  actor: HumanActorSession,
  payload: UpdateDetailedFeeNoticePayload
): Promise<DetailedMonthlyFeeNotice> {
  await new Promise((r) => setTimeout(r, 150));

  const noticeIndex = mockDetailedFeeNotices.findIndex((n) => n.id === payload.noticeId);
  if (noticeIndex === -1) throw new Error('Không tìm thấy Thông báo thu phí');

  const old = mockDetailedFeeNotices[noticeIndex];

  const subServices =
    payload.bathingLaundryFee +
    payload.mobilityFee +
    payload.hygieneFee +
    payload.feedingSondeFee +
    payload.dementiaCareFee +
    payload.soreCareFee +
    payload.catheterCareFee +
    payload.tracheostomyCareFee +
    payload.woundDressingFee +
    payload.rehabFee;

  const effectiveSupport = subServices > 0 ? subServices : payload.supportFee;

  // Auto sum Total Must Collect
  const totalDue =
    payload.basicFee +
    effectiveSupport +
    payload.incurredFee -
    payload.deductionFee +
    payload.previousMonthDebt +
    old.familyMealsFee +
    (old.consumablesFee || 0) +
    (old.unpaidDepositDebt || (old.depositStatus === 'UNPAID' ? 20000000 : 0));

  const paidAmount = Math.max(0, payload.paidAmount);
  const remainingAmount = Math.max(0, totalDue - paidAmount);

  let status: 'PAID' | 'UNPAID' | 'PARTIAL' = 'UNPAID';
  let statusLabel = 'Chưa thu';

  if (paidAmount >= totalDue && totalDue > 0) {
    status = 'PAID';
    statusLabel = 'Đã thu';
  } else if (paidAmount > 0 && paidAmount < totalDue) {
    status = 'PARTIAL';
    statusLabel = 'Thu một phần';
  } else {
    status = 'UNPAID';
    statusLabel = 'Chưa thu';
  }

  const updated: DetailedMonthlyFeeNotice = {
    ...old,
    basicFee: payload.basicFee,
    supportFee: payload.supportFee,
    bathingLaundryFee: payload.bathingLaundryFee,
    mobilityFee: payload.mobilityFee,
    hygieneFee: payload.hygieneFee,
    feedingSondeFee: payload.feedingSondeFee,
    dementiaCareFee: payload.dementiaCareFee,
    soreCareFee: payload.soreCareFee,
    catheterCareFee: payload.catheterCareFee,
    tracheostomyCareFee: payload.tracheostomyCareFee,
    woundDressingFee: payload.woundDressingFee,
    rehabFee: payload.rehabFee,
    incurredFee: payload.incurredFee,
    incurredContent: payload.incurredContent,
    deductionFee: payload.deductionFee,
    previousMonthDebt: payload.previousMonthDebt,
    debtNotes: payload.debtNotes,
    totalDue,
    paidAmount,
    remainingAmount,
    status,
    statusLabel,
    notes: payload.notes || old.notes,
    lastUpdatedBy: actor.displayName || 'Kế toán viên',
    lastUpdatedAt: new Date().toISOString(),
  };

  mockDetailedFeeNotices[noticeIndex] = updated;

  await recordSystemAuditLog({
    actorId: actor.actorId || 'STAFF-ACC-001',
    actorName: actor.displayName || 'Kế toán viên',
    actorRole: actor.actorRole || 'ACCOUNTANT',
    actorRoleLabel: ROLE_LABELS[actor.actorRole] || actor.actorRole || 'Kế toán',
    actionType: 'UPDATE',
    actionLabel: 'Cập nhật bảng kê phí & thu tiền hàng tháng',
    module: 'BILLING_PRICING',
    moduleLabel: 'Quản Lý Thu Phí Tháng',
    targetEntityId: updated.id,
    targetEntityName: `Bảng kê thu phí cụ ${updated.residentName} (${updated.billingMonth})`,
    summary: `Kế toán cập nhật mức phí chi tiết. TỔNG PHẢI THU: ${totalDue.toLocaleString('vi-VN')} đ. Đã thu: ${paidAmount.toLocaleString('vi-VN')} đ. Còn phải thu: ${remainingAmount.toLocaleString('vi-VN')} đ. Tình trạng: ${statusLabel}.`,
    details: `Người thực hiện: ${actor.displayName} (${actor.actorRole})`,
    severity: 'IMPORTANT',
  });

  return updated;
}

export async function publishFeeNoticeToFamilyPortal(
  actor: HumanActorSession,
  noticeId: string,
  approvalNotesInput?: string
): Promise<DetailedMonthlyFeeNotice> {
  await new Promise((r) => setTimeout(r, 150));

  const noticeIndex = mockDetailedFeeNotices.findIndex((n) => n.id === noticeId);
  if (noticeIndex === -1) throw new Error('Không tìm thấy Thông báo thu phí');

  const old = mockDetailedFeeNotices[noticeIndex];

  const updated: DetailedMonthlyFeeNotice = {
    ...old,
    isApproved: true,
    isPublishedToFamilyPortal: true,
    approvedBy: actor.displayName || 'Kế toán trưởng',
    approvedAt: new Date().toISOString(),
    approvalNotes: approvalNotesInput || 'Đã kiểm duyệt & phát hành công khai Cổng Thân Nhân',
    lastUpdatedBy: actor.displayName || 'Kế toán viên',
    lastUpdatedAt: new Date().toISOString(),
  };

  mockDetailedFeeNotices[noticeIndex] = updated;

  await recordSystemAuditLog({
    actorId: actor.actorId || 'STAFF-ACC-001',
    actorName: actor.displayName || 'Kế toán viên',
    actorRole: actor.actorRole || 'ACCOUNTANT',
    actorRoleLabel: ROLE_LABELS[actor.actorRole] || actor.actorRole || 'Kế toán',
    actionType: 'UPDATE',
    actionLabel: 'Duyệt & Phát hành Thông báo thu phí sang Cổng Thân Nhân',
    module: 'BILLING_PRICING',
    moduleLabel: 'Quản Lý Thu Phí Tháng',
    targetEntityId: updated.id,
    targetEntityName: `Thông báo thu phí cụ ${updated.residentName} (${updated.billingMonth})`,
    summary: `Đã duyệt & phát hành công khai Thông báo thu phí tháng ${updated.billingMonth} sang Cổng Thân Nhân. TỔNG PHẢI THU: ${updated.totalDue.toLocaleString('vi-VN')} đ.`,
    details: `Người duyệt: ${actor.displayName} (${actor.actorRole}) | Ghi chú duyệt: ${approvalNotesInput || 'Phát hành chính thức'}`,
    severity: 'IMPORTANT',
  });

  return updated;
}

export async function updateFeeNoticePayment(
  actor: HumanActorSession,
  noticeId: string,
  paymentStatus: 'PAID' | 'UNPAID' | 'PARTIAL',
  paidAmountInput: number,
  notesInput?: string
): Promise<DetailedMonthlyFeeNotice> {
  await new Promise((r) => setTimeout(r, 150));

  const noticeIndex = mockDetailedFeeNotices.findIndex((n) => n.id === noticeId);
  if (noticeIndex === -1) throw new Error('Không tìm thấy Thông báo thu phí');

  const old = mockDetailedFeeNotices[noticeIndex];

  let newPaid = 0;
  let statusLabel = 'Chưa thu';

  if (paymentStatus === 'PAID') {
    newPaid = old.totalDue;
    statusLabel = 'Đã thu';
  } else if (paymentStatus === 'PARTIAL') {
    newPaid = Math.min(old.totalDue, Math.max(0, paidAmountInput));
    statusLabel = 'Thu một phần';
  } else {
    newPaid = 0;
    statusLabel = 'Chưa thu';
  }

  const remaining = Math.max(0, old.totalDue - newPaid);

  const updated: DetailedMonthlyFeeNotice = {
    ...old,
    paidAmount: newPaid,
    remainingAmount: remaining,
    status: paymentStatus,
    statusLabel,
    notes: notesInput || old.notes,
    lastUpdatedBy: actor.displayName || 'Kế toán viên',
    lastUpdatedAt: new Date().toISOString(),
  };

  mockDetailedFeeNotices[noticeIndex] = updated;

  await recordSystemAuditLog({
    actorId: actor.actorId || 'STAFF-ACC-001',
    actorName: actor.displayName || 'Kế toán viên',
    actorRole: actor.actorRole || 'ACCOUNTANT',
    actorRoleLabel: ROLE_LABELS[actor.actorRole] || actor.actorRole || 'Kế toán',
    actionType: 'UPDATE',
    actionLabel: 'Xác thực đóng phí / Cập nhật tiến trình thu phí',
    module: 'BILLING_PRICING',
    moduleLabel: 'Quản Lý Thu Phí Tháng',
    targetEntityId: updated.id,
    targetEntityName: `Thông báo thu phí cụ ${updated.residentName} (${updated.billingMonth})`,
    summary: `Cập nhật trạng thái thu phí sang "${updated.statusLabel}". Đã thu: ${newPaid.toLocaleString('vi-VN')} đ. Còn nợ: ${remaining.toLocaleString('vi-VN')} đ.`,
    details: `Người thực hiện: ${actor.displayName} (${actor.actorRole}) | Ghi chú: ${notesInput || 'Cập nhật từ hệ thống'}.`,
    severity: 'IMPORTANT',
  });

  return updated;
}

export async function addFamilyMealFeeToNotice(residentId: string, mealFeeAmount: number): Promise<void> {
  const noticeIndex = mockDetailedFeeNotices.findIndex((n) => n.residentId === residentId);
  if (noticeIndex !== -1) {
    const old = mockDetailedFeeNotices[noticeIndex];
    const newFamilyMeals = old.familyMealsFee + mealFeeAmount;
    const newTotalDue = old.totalDue + mealFeeAmount;
    const newRemaining = Math.max(0, newTotalDue - old.paidAmount);

    mockDetailedFeeNotices[noticeIndex] = {
      ...old,
      familyMealsFee: newFamilyMeals,
      totalDue: newTotalDue,
      remainingAmount: newRemaining,
    };
  }
}

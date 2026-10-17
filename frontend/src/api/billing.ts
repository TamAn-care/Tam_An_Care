import { HumanActorSession } from '../types/actor';



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
  effectiveDate: '',
  basicCarePackages: [],
  supportServices: [],
  extendedCare: [],
  policyRules: [],
  specialDiscountPolicies: [],
};


/**
 * Tự động tra cứu & tính toán số tiền còn thiếu (nợ) của tháng trước liền kề đối với người cao tuổi
 */
export function getPreviousMonthDebt(residentId?: string, currentBillingMonth?: string): number { throw new Error('FINANCE_DEBT_SOURCE_NOT_READY'); }

/** Legacy invoice arithmetic is disabled until canonical fee policies are verified. */
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
} { throw new Error('FINANCE_INVOICE_CALCULATION_REQUIRES_VERIFIED_POLICY'); }

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
}): ResidentMonthlyInvoice { throw new Error('FINANCE_INVOICE_CREATION_API_NOT_READY'); }



export async function reviewInvoiceByManager(
  actor: HumanActorSession,
  payload: {
    invoiceId: string;
    isAccurate: boolean;
    notesOrReason?: string;
  }
): Promise<ResidentMonthlyInvoice> { throw new Error('FINANCE_BILLING_WRITE_API_NOT_READY'); }

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
): Promise<ResidentMonthlyInvoice> { throw new Error('FINANCE_BILLING_WRITE_API_NOT_READY'); }

export async function publishInvoiceToFamilyPortal(
  actor: HumanActorSession,
  invoiceId: string
): Promise<ResidentMonthlyInvoice> { throw new Error('FINANCE_BILLING_WRITE_API_NOT_READY'); }



// Async API functions
export async function fetchMonthlyInvoices(month: string = '2026-09'): Promise<ResidentMonthlyInvoice[]> {
  // Verified Billing API unavailable: do not display mock data.
  throw new Error('FINANCE_INVOICE_LIST_API_NOT_READY');
}

export async function fetchInvoiceDetails(invoiceId: string): Promise<ResidentMonthlyInvoice | null> {
  // Verified Billing API unavailable: do not display mock data.
  throw new Error('FINANCE_INVOICE_DETAIL_API_NOT_READY');
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
): Promise<PaymentReceipt> { throw new Error('FINANCE_BILLING_WRITE_API_NOT_READY'); }

export async function fetchPaymentReceipts(invoiceId?: string): Promise<PaymentReceipt[]> {
  // Verified Billing API unavailable: do not display mock data.
  throw new Error('FINANCE_RECEIPT_LIST_API_NOT_READY');
}

export async function fetchPricingMatrix(): Promise<PricingMatrix> { throw new Error('FINANCE_PRICING_READ_API_NOT_READY'); }

export async function updatePricingMatrix(
  actor: HumanActorSession,
  matrix: Partial<PricingMatrix>
): Promise<PricingMatrix> { throw new Error('FINANCE_BILLING_WRITE_API_NOT_READY'); }

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
): Promise<ResidentMonthlyInvoice> { throw new Error('FINANCE_BILLING_WRITE_API_NOT_READY'); }

export async function removeDiscountFromInvoice(
  actor: HumanActorSession,
  invoiceId: string,
  discountId: string
): Promise<ResidentMonthlyInvoice> { throw new Error('FINANCE_BILLING_WRITE_API_NOT_READY'); }

export async function settleInvoice(
  actor: HumanActorSession,
  invoiceId: string
): Promise<ResidentMonthlyInvoice> { throw new Error('FINANCE_BILLING_WRITE_API_NOT_READY'); }

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



export async function fetchDetailedFeeNotices(
  residentId?: string,
  options?: { publishedOnly?: boolean }
): Promise<DetailedMonthlyFeeNotice[]> { throw new Error('FINANCE_FEE_NOTICE_LIST_API_NOT_READY'); }

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
): Promise<DetailedMonthlyFeeNotice> { throw new Error('FINANCE_BILLING_WRITE_API_NOT_READY'); }

export async function publishFeeNoticeToFamilyPortal(
  actor: HumanActorSession,
  noticeId: string,
  approvalNotesInput?: string
): Promise<DetailedMonthlyFeeNotice> { throw new Error('FINANCE_BILLING_WRITE_API_NOT_READY'); }

export async function updateFeeNoticePayment(
  actor: HumanActorSession,
  noticeId: string,
  paymentStatus: 'PAID' | 'UNPAID' | 'PARTIAL',
  paidAmountInput: number,
  notesInput?: string
): Promise<DetailedMonthlyFeeNotice> { throw new Error('FINANCE_BILLING_WRITE_API_NOT_READY'); }

export async function addFamilyMealFeeToNotice(residentId: string, mealFeeAmount: number): Promise<void> { throw new Error('FINANCE_BILLING_WRITE_API_NOT_READY'); }

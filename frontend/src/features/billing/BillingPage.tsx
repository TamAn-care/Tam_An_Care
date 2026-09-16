import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useActor } from '../../auth/ActorContext';
import { hasCapability } from '../../auth/role-policy';
import {
  fetchMonthlyInvoices,
  fetchPaymentReceipts,
  fetchPricingMatrix,
  fetchDetailedFeeNotices,
  updateDetailedFeeNotice,
  publishFeeNoticeToFamilyPortal,
  recordPayment,
  settleInvoice,
  updatePricingMatrix,
  applyDiscountToInvoice,
  removeDiscountFromInvoice,
  reviewInvoiceByManager,
  updateInvoiceItemsByDirector,
  publishInvoiceToFamilyPortal,
  DEFAULT_PRICING_MATRIX,
  DISCOUNT_CATEGORY_LABELS,
  ResidentMonthlyInvoice,
  DetailedMonthlyFeeNotice,
  UpdateDetailedFeeNoticePayload,
  PaymentReceipt,
  PricingMatrix,
  InvoiceStatus,
  PaymentMethod,
  SpecialDiscountPolicy,
} from '../../api/billing';
import { LoadingState, ErrorState } from '../../components/feedback/FeedbackStates';

const STATUS_CONFIG: Record<InvoiceStatus, { label: string; badgeClass: string; icon: string }> = {
  PENDING: { label: 'Chờ thanh toán', badgeClass: 'badge-warning', icon: '⏳' },
  PARTIAL: { label: 'Thu 1 phần', badgeClass: 'badge-info', icon: '🟡' },
  PAID: { label: 'Đã thu đủ', badgeClass: 'badge-success', icon: '✅' },
  SETTLED: { label: 'Đã khóa sổ', badgeClass: 'badge-neutral', icon: '🔒' },
};

const AUDIT_STATUS_CONFIG: Record<string, { label: string; badgeClass: string; icon: string }> = {
  DRAFT: { label: 'Bản nháp', badgeClass: 'badge-neutral', icon: '📝' },
  PENDING_MANAGER: { label: 'Chờ Quản lý duyệt', badgeClass: 'badge-warning', icon: '⏳' },
  MANAGER_APPROVED: { label: 'Quản lý đã duyệt', badgeClass: 'badge-info', icon: '🔍' },
  MANAGER_REPORTED: { label: 'Quản lý báo BÁO SAI SÓT', badgeClass: 'badge-danger', icon: '⚠️' },
  DIRECTOR_APPROVED: { label: 'Đã phát hành Cổng Thân nhân', badgeClass: 'badge-success', icon: '🌐' },
};

const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  BANK_TRANSFER: '🏦 Chuyển khoản',
  CASH: '💵 Tiền mặt',
  DEPOSIT_DEDUCTION: '📑 Trừ tiền cọc',
};

export default function BillingPage() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<'invoices' | 'pricing' | 'discounts' | 'receipts' | 'reports'>('invoices');
  const [selectedMonth, setSelectedMonth] = useState<string>('2026-09');
  const [selectedStatus, setSelectedStatus] = useState<InvoiceStatus | 'ALL'>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Edit, Publish & Print Detailed Fee Notice Modal State for Accountant
  const [editFeeNotice, setEditFeeNotice] = useState<DetailedMonthlyFeeNotice | null>(null);
  const [publishConfirmNotice, setPublishConfirmNotice] = useState<DetailedMonthlyFeeNotice | null>(null);
  const [printModalNotice, setPrintModalNotice] = useState<DetailedMonthlyFeeNotice | null>(null);
  const [publishNotesInput, setPublishNotesInput] = useState<string>('');
  const [feeNoticeForm, setFeeNoticeForm] = useState<UpdateDetailedFeeNoticePayload>({
    noticeId: '',
    basicFee: 0,
    supportFee: 0,
    bathingLaundryFee: 0,
    mobilityFee: 0,
    hygieneFee: 0,
    feedingSondeFee: 0,
    dementiaCareFee: 0,
    soreCareFee: 0,
    catheterCareFee: 0,
    tracheostomyCareFee: 0,
    woundDressingFee: 0,
    rehabFee: 0,
    incurredFee: 0,
    incurredContent: '',
    deductionFee: 0,
    previousMonthDebt: 0,
    debtNotes: '',
    paidAmount: 0,
    notes: '',
  });

  // Modals state
  const [detailModalInvoice, setDetailModalInvoice] = useState<ResidentMonthlyInvoice | null>(null);
  const [paymentModalInvoice, setPaymentModalInvoice] = useState<ResidentMonthlyInvoice | null>(null);
  const [payAmount, setPayAmount] = useState<number>(0);
  const [payMethod, setPayMethod] = useState<PaymentMethod>('BANK_TRANSFER');
  const [payRef, setPayRef] = useState<string>('');
  const [payNotes, setPayNotes] = useState<string>('');

  // Settle invoice modal
  const [settleModalInvoice, setSettleModalInvoice] = useState<ResidentMonthlyInvoice | null>(null);

  // Discount Modal state
  const [discountModalInvoice, setDiscountModalInvoice] = useState<ResidentMonthlyInvoice | null>(null);
  const [selectedPolicyId, setSelectedPolicyId] = useState<string>('CUSTOM');
  const [discountCategory, setDiscountCategory] = useState<'PREPAY' | 'POLICY_BENEFICIARY' | 'STAFF_FAMILY' | 'DIRECTOR_APPROVAL' | 'EVENT_PROMO' | 'SPECIAL_HARDSHIP' | 'OTHER'>('DIRECTOR_APPROVAL');
  const [discountName, setDiscountName] = useState<string>('Giảm giá theo thỏa thuận Ban Giám đốc');
  const [discountType, setDiscountType] = useState<'PERCENT' | 'FIXED_AMOUNT'>('PERCENT');
  const [discountValue, setDiscountValue] = useState<number>(5);
  const [discountNotes, setDiscountNotes] = useState<string>('');

  // Pricing Matrix edit state
  const [isEditingPricing, setIsEditingPricing] = useState(false);
  const [pricingForm, setPricingForm] = useState<PricingMatrix | null>(null);

  // Audit / Review state
  const [auditFilter, setAuditFilter] = useState<string>('ALL');
  const [managerReviewInvoice, setManagerReviewInvoice] = useState<ResidentMonthlyInvoice | null>(null);
  const [managerReviewNotes, setManagerReviewNotes] = useState<string>('');

  const [directorEditInvoice, setDirectorEditInvoice] = useState<ResidentMonthlyInvoice | null>(null);
  const [directorForm, setDirectorForm] = useState<Partial<ResidentMonthlyInvoice>>({});

  // Capabilities
  const canConfigurePricing = hasCapability(actor?.actorRole, 'canConfigurePricing');
  const canManageBilling = hasCapability(actor?.actorRole, 'canManageBilling');

  // Queries
  const detailedFeeNoticesQuery = useQuery({
    queryKey: ['billing-detailed-fee-notices'],
    queryFn: () => fetchDetailedFeeNotices(),
  });

  const invoicesQuery = useQuery({
    queryKey: ['billing-invoices', selectedMonth],
    queryFn: () => fetchMonthlyInvoices(selectedMonth),
  });

  const receiptsQuery = useQuery({
    queryKey: ['billing-receipts'],
    queryFn: () => fetchPaymentReceipts(),
  });

  const pricingQuery = useQuery({
    queryKey: ['billing-pricing'],
    queryFn: async () => {
      const p = await fetchPricingMatrix();
      setPricingForm(JSON.parse(JSON.stringify(p)));
      return p;
    },
  });

  // Detailed Fee Notice Mutation for Accountant
  const updateDetailedFeeNoticeMutation = useMutation({
    mutationFn: async (payload: UpdateDetailedFeeNoticePayload) => {
      return updateDetailedFeeNotice(actor!, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing-detailed-fee-notices'] });
      queryClient.invalidateQueries({ queryKey: ['family-fee-notices'] });
      setEditFeeNotice(null);
    },
  });

  const publishFeeNoticeMutation = useMutation({
    mutationFn: async ({ noticeId, notes }: { noticeId: string; notes?: string }) => {
      return publishFeeNoticeToFamilyPortal(actor!, noticeId, notes);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing-detailed-fee-notices'] });
      queryClient.invalidateQueries({ queryKey: ['family-fee-notices'] });
      setPublishConfirmNotice(null);
      setPublishNotesInput('');
    },
  });

  // Mutations
  const recordPaymentMutation = useMutation({
    mutationFn: async () => {
      if (!paymentModalInvoice) throw new Error('Vui lòng chọn bảng kê.');
      if (payAmount <= 0) throw new Error('Số tiền thanh toán phải lớn hơn 0.');

      return recordPayment(actor!, {
        invoiceId: paymentModalInvoice.invoiceId,
        amount: payAmount,
        paymentMethod: payMethod,
        transactionReference: payRef || `PAY-${Date.now().toString().slice(-6)}`,
        notes: payNotes || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['billing-receipts'] });
      setPaymentModalInvoice(null);
      setPayAmount(0);
      setPayRef('');
      setPayNotes('');
    },
  });

  const settleInvoiceMutation = useMutation({
    mutationFn: async () => {
      if (!settleModalInvoice) throw new Error('Vui lòng chọn bảng kê.');
      return settleInvoice(actor!, settleModalInvoice.invoiceId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing-invoices'] });
      setSettleModalInvoice(null);
    },
  });

  const updatePricingMutation = useMutation({
    mutationFn: async () => {
      if (!pricingForm) throw new Error('Dữ liệu biểu phí không hợp lệ.');
      return updatePricingMatrix(actor!, pricingForm);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing-pricing'] });
      setIsEditingPricing(false);
      alert('Đã cập nhật bảng giá và gói dịch vụ thành công!');
    },
    onError: (err: any) => {
      alert(err.message || 'Lỗi cập nhật bảng giá');
    },
  });

  const applyDiscountMutation = useMutation({
    mutationFn: async () => {
      if (!discountModalInvoice) throw new Error('Vui lòng chọn bảng kê.');
      if (discountValue <= 0) throw new Error('Mức giảm giá phải lớn hơn 0.');
      if (!discountNotes.trim()) throw new Error('Vui lòng nhập căn cứ phê duyệt giảm giá.');

      return applyDiscountToInvoice(actor!, {
        invoiceId: discountModalInvoice.invoiceId,
        name: discountName,
        reasonCategory: discountCategory,
        discountType: discountType,
        discountValue: discountValue,
        reasonNotes: discountNotes,
      });
    },
    onSuccess: (updatedInv) => {
      queryClient.invalidateQueries({ queryKey: ['billing-invoices'] });
      setDiscountModalInvoice(null);
      setDiscountNotes('');
      if (detailModalInvoice?.invoiceId === updatedInv.invoiceId) {
        setDetailModalInvoice(updatedInv);
      }
      alert('Đã áp dụng mức giảm giá vào bảng kê thu phí của Người cao tuổi thành công!');
    },
    onError: (err: any) => {
      alert(err.message || 'Lỗi khi áp dụng giảm giá');
    },
  });

  const removeDiscountMutation = useMutation({
    mutationFn: async ({ invoiceId, discountId }: { invoiceId: string; discountId: string }) => {
      return removeDiscountFromInvoice(actor!, invoiceId, discountId);
    },
    onSuccess: (updatedInv) => {
      queryClient.invalidateQueries({ queryKey: ['billing-invoices'] });
      if (detailModalInvoice?.invoiceId === updatedInv.invoiceId) {
        setDetailModalInvoice(updatedInv);
      }
    },
  });

  const reviewByManagerMutation = useMutation({
    mutationFn: async ({ invoiceId, isAccurate, notesOrReason }: { invoiceId: string; isAccurate: boolean; notesOrReason?: string }) => {
      return reviewInvoiceByManager(actor!, { invoiceId, isAccurate, notesOrReason });
    },
    onSuccess: (updated, vars) => {
      queryClient.invalidateQueries({ queryKey: ['billing-invoices'] });
      setManagerReviewInvoice(null);
      setManagerReviewNotes('');
      if (detailModalInvoice?.invoiceId === updated.invoiceId) {
        setDetailModalInvoice(updated);
      }
      alert(vars.isAccurate ? 'Đã thẩm định & xác nhận Bảng kê thu phí chính xác!' : 'Đã gửi báo cáo sai sót tới Ban Giám đốc thành công!');
    },
    onError: (err: any) => {
      alert(err.message || 'Lỗi kiểm duyệt');
    },
  });

  const updateByDirectorMutation = useMutation({
    mutationFn: async () => {
      if (!directorEditInvoice) throw new Error('Vui lòng chọn bảng kê.');
      return updateInvoiceItemsByDirector(actor!, {
        invoiceId: directorEditInvoice.invoiceId,
        basicPackageFee: directorForm.basicPackageFee,
        supportServicesFee: directorForm.supportServicesFee,
        extendedCareFee: directorForm.extendedCareFee,
        extendedCareDays: directorForm.extendedCareDays,
        regularLeaveDays: directorForm.regularLeaveDays,
        forceMajeureLeaveDays: directorForm.forceMajeureLeaveDays,
        holidayDays: directorForm.holidayDays,
        holidaySurchargeFee: directorForm.holidaySurchargeFee,
        extraMealsFee: directorForm.extraMealsFee,
        consumablesFee: directorForm.consumablesFee,
        previousMonthDebt: directorForm.previousMonthDebt,
        depositStatus: directorForm.depositStatus,
        unpaidDepositDebt: directorForm.unpaidDepositDebt,
        directorEditNotes: directorForm.directorEditNotes,
      });
    },
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['billing-invoices'] });
      setDirectorEditInvoice(null);
      if (detailModalInvoice?.invoiceId === updated.invoiceId) {
        setDetailModalInvoice(updated);
      }
      alert('Ban Giám đốc đã cập nhật & hiệu chỉnh các hạng mục Bảng kê thu phí thành công!');
    },
    onError: (err: any) => {
      alert(err.message || 'Lỗi hiệu chỉnh');
    },
  });

  const publishByDirectorMutation = useMutation({
    mutationFn: async (invoiceId: string) => {
      return publishInvoiceToFamilyPortal(actor!, invoiceId);
    },
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['billing-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['billing-detailed-fee-notices'] });
      if (detailModalInvoice?.invoiceId === updated.invoiceId) {
        setDetailModalInvoice(updated);
      }
      alert('Ban Giám đốc đã phê duyệt & chính thức phát hành Bảng kê thu phí tới Cổng Thân Nhân!');
    },
    onError: (err: any) => {
      alert(err.message || 'Lỗi phát hành');
    },
  });

  // Filtered Invoices & Audit Count
  const invoicesList = invoicesQuery.data || [];

  const reportedInvoicesCount = useMemo(() => {
    return invoicesList.filter((i) => i.auditStatus === 'MANAGER_REPORTED').length;
  }, [invoicesList]);

  const filteredInvoices = useMemo(() => {
    let list = invoicesList;
    if (selectedStatus !== 'ALL') {
      list = list.filter((i) => i.status === selectedStatus);
    }
    if (auditFilter !== 'ALL') {
      list = list.filter((i) => (i.auditStatus || 'PENDING_MANAGER') === auditFilter);
    }
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      list = list.filter(
        (i) =>
          i.residentName.toLowerCase().includes(q) ||
          i.invoiceCode.toLowerCase().includes(q) ||
          i.room.toLowerCase().includes(q)
      );
    }
    return list;
  }, [invoicesList, selectedStatus, auditFilter, searchTerm]);

  // Statistics
  const stats = useMemo(() => {
    const totalInvoices = invoicesList.length;
    const totalBilled = invoicesList.reduce((sum, i) => sum + i.totalAmount, 0);
    const totalCollected = invoicesList.reduce((sum, i) => sum + i.paidAmount, 0);
    const totalRemaining = invoicesList.reduce((sum, i) => sum + i.remainingAmount, 0);
    const totalDiscounts = invoicesList.reduce((sum, i) => sum + (i.totalDiscountAmount || 0), 0);
    const totalLeaveDeductions = invoicesList.reduce((sum, i) => sum + (i.leaveDeductionFee || 0), 0);

    return {
      totalInvoices,
      totalBilled,
      totalCollected,
      totalRemaining,
      totalDiscounts,
      totalLeaveDeductions,
    };
  }, [invoicesList]);

  const pricingData = pricingQuery.data || DEFAULT_PRICING_MATRIX;

  // Handle policy selection in Discount Modal
  const handleSelectPolicy = (policyId: string) => {
    setSelectedPolicyId(policyId);
    if (policyId === 'CUSTOM') {
      setDiscountName('Giảm giá theo thỏa thuận Ban Giám đốc');
      setDiscountCategory('DIRECTOR_APPROVAL');
      setDiscountType('PERCENT');
      setDiscountValue(5);
      return;
    }

    const policy = pricingData.specialDiscountPolicies.find((p) => p.id === policyId);
    if (policy) {
      setDiscountName(policy.name);
      setDiscountCategory(policy.reasonCategory);
      setDiscountType(policy.discountType);
      setDiscountValue(policy.discountValue);
    }
  };

  // Helper formatters
  const formatNum = (num: number) => (num ? num.toLocaleString('vi-VN') : '0');
  const formatVndText = (num: number) => `${formatNum(num)} đ`;

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', margin: 0, fontSize: '1.35rem' }}>
            <span>💳</span> Quản Lý Phí & Bảng Giá Dịch Vụ
          </h1>
          <p className="page-description" style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem' }}>
            Trung tâm Dưỡng lão Tâm An — Bảng giá dịch vụ áp dụng từ 01/07/2026, gói chăm sóc, giảm trừ vắng mặt & chính sách giảm giá đặc biệt.
          </p>
        </div>

      </div>

      {/* Universal Calculation Rule Banner */}
      <div
        className="no-print"
        style={{
          background: 'linear-gradient(135deg, #f0fdf4 0%, #e0f2fe 100%)',
          border: '1px solid #bbf7d0',
          borderRadius: '0.65rem',
          padding: '0.75rem 1rem',
          marginBottom: '1.25rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.85rem',
          fontSize: '0.83rem',
          color: '#1e293b',
        }}
      >
        <span style={{ fontSize: '1.4rem' }}>📐</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, color: '#14532d', marginBottom: '0.15rem' }}>
            NGUYÊN TẮC TÍNH PHÍ NHẤT QUÁN TOÀN VIỆN TÂM AN
          </div>
          <div>
            <b>Tổng thực thu</b> = 🏨 Phí cơ bản (gói phòng) + 💳 Tiền cọc (kỳ đầu) + 🩺 Phí hỗ trợ (chỉ khi có chỉ định) + 🏮 Phụ thu lễ - 📉 Giảm trừ nghỉ phép/tạm vắng - 🎁 Ưu đãi phê duyệt + 🍲 Suất ăn / 🩹 Vật tư y tế. <i>Cư dân không sử dụng dịch vụ hỗ trợ được tính phí hỗ trợ = 0đ.</i>
          </div>
        </div>
      </div>

      {/* Primary Tabs - Streamlined single-line layout */}
      <div
        className="tab-nav no-print"
        style={{
          display: 'flex',
          gap: '0.5rem',
          borderBottom: '2px solid #e2e8f0',
          marginBottom: '1.25rem',
          overflowX: 'auto',
          whiteSpace: 'nowrap',
          paddingBottom: '0.25rem',
          WebkitOverflowScrolling: 'touch',
        }}
      >

        <button
          type="button"
          className={`tab-item ${activeTab === 'invoices' ? 'active' : ''}`}
          onClick={() => setActiveTab('invoices')}
          style={{
            padding: '0.6rem 1rem',
            fontWeight: 600,
            fontSize: '0.88rem',
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            borderBottom: activeTab === 'invoices' ? '3px solid #15803d' : 'none',
            color: activeTab === 'invoices' ? '#15803d' : '#64748b',
          }}
        >
          📑 Bảng Kê Thu Phí
        </button>
        <button
          type="button"
          className={`tab-item ${activeTab === 'pricing' ? 'active' : ''}`}
          onClick={() => setActiveTab('pricing')}
          style={{
            padding: '0.6rem 1rem',
            fontWeight: 600,
            fontSize: '0.88rem',
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            borderBottom: activeTab === 'pricing' ? '3px solid #15803d' : 'none',
            color: activeTab === 'pricing' ? '#15803d' : '#64748b',
          }}
        >
          🏷️ Bảng Giá Dịch Vụ (01/07/2026)
        </button>
        <button
          type="button"
          className={`tab-item ${activeTab === 'discounts' ? 'active' : ''}`}
          onClick={() => setActiveTab('discounts')}
          style={{
            padding: '0.6rem 1rem',
            fontWeight: 600,
            fontSize: '0.88rem',
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            borderBottom: activeTab === 'discounts' ? '3px solid #15803d' : 'none',
            color: activeTab === 'discounts' ? '#15803d' : '#64748b',
          }}
        >
          🎁 Chính Sách Giảm Giá & Ưu Đãi
        </button>
        <button
          type="button"
          className={`tab-item ${activeTab === 'receipts' ? 'active' : ''}`}
          onClick={() => setActiveTab('receipts')}
          style={{
            padding: '0.6rem 1rem',
            fontWeight: 600,
            fontSize: '0.88rem',
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            borderBottom: activeTab === 'receipts' ? '3px solid #15803d' : 'none',
            color: activeTab === 'receipts' ? '#15803d' : '#64748b',
          }}
        >
          🧾 Lịch Sử Thu Tiền ({receiptsQuery.data?.length || 0})
        </button>
        <button
          type="button"
          className={`tab-item ${activeTab === 'reports' ? 'active' : ''}`}
          onClick={() => setActiveTab('reports')}
          style={{
            padding: '0.6rem 1rem',
            fontWeight: 600,
            fontSize: '0.88rem',
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            borderBottom: activeTab === 'reports' ? '3px solid #15803d' : 'none',
            color: activeTab === 'reports' ? '#15803d' : '#64748b',
          }}
        >
          📊 Báo Cáo Doanh Thu
        </button>
      </div>



      {/* ========================================================================= */}
      {/* TAB 1: BẢNG KÊ THU PHÍ */}
      {/* ========================================================================= */}
      {activeTab === 'invoices' && (
        <div>
          {/* Uniform 5 KPI Cards Grid */}
          <div className="no-print kpi-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.85rem', marginBottom: '1.25rem' }}>
            <div className="card" style={{ padding: '0.9rem 1rem', background: '#f8fafc', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '115px', border: '1px solid #e2e8f0', borderRadius: '0.65rem' }}>
              <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>TỔNG THU PHÍ PHÁT SINH</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', margin: '0.25rem 0', fontVariantNumeric: 'tabular-nums' }}>
                {formatVndText(stats.totalBilled)}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{stats.totalInvoices} hồ sơ cư dân</div>
            </div>

            <div className="card" style={{ padding: '0.9rem 1rem', background: '#f0fdf4', borderColor: '#bbf7d0', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '115px', borderRadius: '0.65rem' }}>
              <div style={{ fontSize: '0.72rem', color: '#166534', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>ĐÃ THU THỰC TẾ</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#15803d', margin: '0.25rem 0', fontVariantNumeric: 'tabular-nums' }}>
                {formatVndText(stats.totalCollected)}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#166534' }}>
                Đạt {stats.totalBilled > 0 ? Math.round((stats.totalCollected / stats.totalBilled) * 100) : 0}% kế hoạch thu
              </div>
            </div>

            <div className="card" style={{ padding: '0.9rem 1rem', background: '#fffbeb', borderColor: '#fde68a', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '115px', borderRadius: '0.65rem' }}>
              <div style={{ fontSize: '0.72rem', color: '#92400e', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>CÒN PHẢI THU</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#b45309', margin: '0.25rem 0', fontVariantNumeric: 'tabular-nums' }}>
                {formatVndText(stats.totalRemaining)}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#92400e' }}>Hạn nộp ngày 10 hàng tháng</div>
            </div>

            <div className="card" style={{ padding: '0.9rem 1rem', background: '#eff6ff', borderColor: '#bfdbfe', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '115px', borderRadius: '0.65rem' }}>
              <div style={{ fontSize: '0.72rem', color: '#1e40af', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>GIẢM GIÁ & ƯU ĐÃI ĐÃ DUYỆT</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#2563eb', margin: '0.25rem 0', fontVariantNumeric: 'tabular-nums' }}>
                {formatVndText(stats.totalDiscounts)}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#1e40af' }}>Phê duyệt theo chính sách & BGĐ</div>
            </div>

            <div className="card" style={{ padding: '0.9rem 1rem', background: '#faf5ff', borderColor: '#e9d5ff', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '115px', borderRadius: '0.65rem' }}>
              <div style={{ fontSize: '0.72rem', color: '#6b21a8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>GIẢM TRỪ NGHỈ PHÉP/TẠM VẮNG</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#7e22ce', margin: '0.25rem 0', fontVariantNumeric: 'tabular-nums' }}>
                {formatVndText(stats.totalLeaveDeductions)}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#6b21a8' }}>Bất khả kháng (200k) & Nghỉ (100k)</div>
            </div>
          </div>

          {/* Warning Banner for Manager Reported Invoices */}
          {reportedInvoicesCount > 0 && (
            <div className="no-print" style={{ background: '#fef2f2', border: '2px solid #f87171', borderRadius: '0.65rem', padding: '0.9rem 1.15rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.85rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ fontSize: '1.5rem' }}>⚠️</span>
                <div>
                  <h4 style={{ margin: 0, color: '#991b1b', fontSize: '0.95rem', fontWeight: 800 }}>
                    CÓ {reportedInvoicesCount} BẢNG KÊ THU PHÍ ĐƯỢC QUẢN LÝ BÁO CÁO SAI SÓT
                  </h4>
                  <div style={{ fontSize: '0.82rem', color: '#7f1d1d', marginTop: '0.2rem' }}>
                    Nhân viên Quản lý đã thẩm định và ghi nhận sai sót. Đề nghị Ban Giám đốc kiểm tra, hiệu chỉnh các hạng mục trước khi phê duyệt phát hành Cổng thân nhân.
                  </div>
                </div>
              </div>
              <button
                type="button"
                className="btn btn-neutral"
                style={{ background: '#fee2e2', color: '#991b1b', fontWeight: 700, border: '1px solid #fca5a5', fontSize: '0.82rem' }}
                onClick={() => setAuditFilter('MANAGER_REPORTED')}
              >
                🔍 Lọc Bảng Kê Báo Sai Sót ({reportedInvoicesCount})
              </button>
            </div>
          )}

          {/* Balanced Filter Toolbar */}
          <div className="card no-print filter-toolbar" style={{ padding: '0.9rem 1.15rem', marginBottom: '1.25rem', background: '#ffffff', borderRadius: '0.65rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', alignItems: 'flex-end' }}>
              <div>
                <label className="field-label" style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '0.35rem', display: 'block' }}>Kỳ thu phí:</label>
                <select className="text-input" style={{ height: '38px', padding: '0 0.65rem', width: '100%', boxSizing: 'border-box' }} value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}>
                  <option value="2026-09">Tháng 09/2026</option>
                  <option value="2026-08">Tháng 08/2026</option>
                  <option value="2026-07">Tháng 07/2026</option>
                </select>
              </div>

              <div>
                <label className="field-label" style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '0.35rem', display: 'block' }}>Thanh toán:</label>
                <select className="text-input" style={{ height: '38px', padding: '0 0.65rem', width: '100%', boxSizing: 'border-box' }} value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value as any)}>
                  <option value="ALL">-- Tất cả trạng thái --</option>
                  <option value="PENDING">⏳ Chờ thanh toán</option>
                  <option value="PARTIAL">🟡 Thu 1 phần</option>
                  <option value="PAID">✅ Đã thu đủ</option>
                  <option value="SETTLED">🔒 Đã quyết toán</option>
                </select>
              </div>

              <div>
                <label className="field-label" style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '0.35rem', display: 'block' }}>Kiểm duyệt & Duyệt BGĐ:</label>
                <select className="text-input" style={{ height: '38px', padding: '0 0.65rem', width: '100%', boxSizing: 'border-box' }} value={auditFilter} onChange={(e) => setAuditFilter(e.target.value)}>
                  <option value="ALL">-- Tất cả kiểm duyệt --</option>
                  <option value="PENDING_MANAGER">⏳ Chờ Quản lý duyệt</option>
                  <option value="MANAGER_APPROVED">🔍 Quản lý đã duyệt</option>
                  <option value="MANAGER_REPORTED">⚠️ Quản lý báo SAI SÓT</option>
                  <option value="DIRECTOR_APPROVED">🌐 BGĐ đã phát hành Cổng TN</option>
                </select>
              </div>

              <div>
                <label className="field-label" style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '0.35rem', display: 'block' }}>Tìm kiếm:</label>
                <input
                  type="text"
                  className="text-input"
                  style={{ height: '38px', padding: '0 0.75rem', width: '100%', boxSizing: 'border-box' }}
                  placeholder="Tìm theo tên Cụ, mã bảng kê..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Balanced Table */}
          {invoicesQuery.isLoading ? (
            <LoadingState title="Đang tải dữ liệu thu phí..." />
          ) : filteredInvoices.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '2.5rem', color: '#64748b', borderRadius: '0.65rem' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📑</div>
              <div>Không tìm thấy bảng kê thu phí nào phù hợp với bộ lọc.</div>
            </div>
          ) : (
            <div className="card no-print data-table-card" style={{ padding: 0, overflow: 'hidden', borderRadius: '0.65rem', border: '1px solid #e2e8f0' }}>
              <div className="table-responsive" style={{ overflowX: 'auto' }}>
                <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '2px solid #cbd5e1' }}>
                      <th style={{ padding: '0.75rem 0.6rem', textAlign: 'left', whiteSpace: 'nowrap' }}>Mã Bảng Kê</th>
                      <th style={{ padding: '0.75rem 0.6rem', textAlign: 'left', whiteSpace: 'nowrap' }}>Người Cao Tuổi</th>
                      <th style={{ padding: '0.75rem 0.6rem', textAlign: 'left', whiteSpace: 'nowrap' }}>Phòng & Gói Phòng</th>
                      <th style={{ padding: '0.75rem 0.6rem', textAlign: 'right', whiteSpace: 'nowrap' }}>Phí Cơ Bản (đồng)</th>
                      <th style={{ padding: '0.75rem 0.6rem', textAlign: 'right', whiteSpace: 'nowrap' }}>Phí CS Hỗ Trợ (đồng)</th>
                      <th style={{ padding: '0.75rem 0.6rem', textAlign: 'right', whiteSpace: 'nowrap' }}>Phí CS Mở Rộng (đồng)</th>
                      <th style={{ padding: '0.75rem 0.6rem', textAlign: 'right', whiteSpace: 'nowrap' }}>Phụ Thu Lễ Tết (đồng)</th>
                      <th style={{ padding: '0.75rem 0.6rem', textAlign: 'right', whiteSpace: 'nowrap' }}>Suất Ăn Thân Nhân (đồng)</th>
                      <th style={{ padding: '0.75rem 0.6rem', textAlign: 'right', whiteSpace: 'nowrap' }}>Vật Tư Tiêu Hao (đồng)</th>
                      <th style={{ padding: '0.75rem 0.6rem', textAlign: 'right', whiteSpace: 'nowrap' }}>Nợ Tháng Trước (đồng)</th>
                      <th style={{ padding: '0.75rem 0.6rem', textAlign: 'right', whiteSpace: 'nowrap' }}>Giảm trừ nghỉ phép/tạm vắng (đồng)</th>
                      <th style={{ padding: '0.75rem 0.6rem', textAlign: 'right', whiteSpace: 'nowrap' }}>Giảm Giá (đồng)</th>
                      <th style={{ padding: '0.75rem 0.6rem', textAlign: 'right', whiteSpace: 'nowrap' }}>Nợ Đặt Cọc (1 lần)</th>
                      <th style={{ padding: '0.75rem 0.6rem', textAlign: 'right', whiteSpace: 'nowrap' }}>Tổng Thực Thu (đồng)</th>
                      <th style={{ padding: '0.75rem 0.6rem', textAlign: 'right', whiteSpace: 'nowrap' }}>Đã Thu (đồng)</th>
                      <th style={{ padding: '0.75rem 0.6rem', textAlign: 'right', whiteSpace: 'nowrap' }}>Còn Nợ (đồng)</th>
                      <th style={{ padding: '0.75rem 0.6rem', textAlign: 'center', whiteSpace: 'nowrap' }}>Trạng Thái</th>
                      <th style={{ padding: '0.75rem 0.6rem', textAlign: 'center', whiteSpace: 'nowrap' }}>Kiểm Duyệt BGĐ</th>
                      <th style={{ padding: '0.75rem 0.6rem', textAlign: 'center', whiteSpace: 'nowrap' }}>Thao Tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredInvoices.map((inv) => {
                      const st = STATUS_CONFIG[inv.status];
                      const auditSt = AUDIT_STATUS_CONFIG[inv.auditStatus || 'PENDING_MANAGER'];
                      return (
                        <tr key={inv.invoiceId} style={{ borderBottom: '1px solid #f1f5f9', verticalAlign: 'middle' }}>
                          <td style={{ padding: '0.65rem 0.6rem' }}>
                            <code style={{ fontWeight: 700, color: '#0f172a' }}>{inv.invoiceCode}</code>
                            <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Kỳ: {inv.billingMonth}</div>
                          </td>
                          <td style={{ padding: '0.65rem 0.6rem' }}>
                            <div style={{ fontWeight: 700, color: '#1e293b' }}>{inv.residentName}</div>
                            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Mã: {inv.residentId}</div>
                          </td>
                          <td style={{ padding: '0.65rem 0.6rem' }}>
                            <div style={{ fontWeight: 600 }}>P.{inv.room} ({inv.bed})</div>
                            <div style={{ fontSize: '0.75rem', color: '#15803d' }}>{inv.basicPackageName}</div>
                          </td>
                          <td style={{ padding: '0.65rem 0.6rem', textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                            {formatNum(inv.basicPackageFee)}
                          </td>
                          <td style={{ padding: '0.65rem 0.6rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                            <div style={{ fontWeight: inv.supportServicesFee > 0 ? 700 : 400, color: inv.supportServicesFee > 0 ? '#0369a1' : '#64748b' }}>
                              {inv.supportServicesFee > 0 ? `+${formatNum(inv.supportServicesFee)}` : '0'}
                            </div>
                            {inv.supportServiceItems && inv.supportServiceItems.length > 0 ? (
                              <div style={{ fontSize: '0.72rem', color: '#0284c7', marginTop: '0.15rem', fontStyle: 'italic', maxWidth: '190px', marginLeft: 'auto' }}>
                                {inv.supportServiceItems.map((item) => `${item.serviceName} (${formatNum(item.totalPrice)}đ)`).join(', ')}
                              </div>
                            ) : (
                              <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '0.15rem' }}>
                                Không sử dụng
                              </div>
                            )}
                          </td>
                          <td style={{ padding: '0.65rem 0.6rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                            <div style={{ fontWeight: inv.extendedCareFee > 0 ? 700 : 400, color: inv.extendedCareFee > 0 ? '#7c3aed' : '#64748b' }}>
                              {inv.extendedCareFee > 0 ? `+${formatNum(inv.extendedCareFee)}` : '0'}
                            </div>
                            {inv.extendedCareFee > 0 ? (
                              <div style={{ fontSize: '0.72rem', color: '#6d28d9', marginTop: '0.15rem', fontStyle: 'italic', maxWidth: '160px', marginLeft: 'auto' }}>
                                CS mở rộng{inv.extendedCareDays ? ` (${inv.extendedCareDays} ngày)` : ''}
                              </div>
                            ) : (
                              <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '0.15rem' }}>
                                Không sử dụng
                              </div>
                            )}
                          </td>
                          <td style={{ padding: '0.65rem 0.6rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                            <div style={{ fontWeight: inv.holidaySurchargeFee > 0 ? 700 : 400, color: inv.holidaySurchargeFee > 0 ? '#d97706' : '#64748b' }}>
                              {inv.holidaySurchargeFee > 0 ? `+${formatNum(inv.holidaySurchargeFee)}` : '0'}
                            </div>
                            {inv.holidaySurchargeFee > 0 ? (
                              <div style={{ fontSize: '0.72rem', color: '#b45309', marginTop: '0.15rem', fontStyle: 'italic', maxWidth: '160px', marginLeft: 'auto' }}>
                                Lễ Tết ({inv.holidayDays || 1} ngày - {inv.contractType === 'SHORT_TERM' ? '300k/ngày' : '200k/ngày'})
                              </div>
                            ) : (
                              <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '0.15rem' }}>
                                Không phụ thu
                              </div>
                            )}
                          </td>
                          {/* Suất ăn thân nhân */}
                          <td style={{ padding: '0.65rem 0.6rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                            {inv.extraMealsFee > 0 ? (
                              <div>
                                <div style={{ fontWeight: 700, color: '#0284c7' }}>
                                  +{formatNum(inv.extraMealsFee)}
                                </div>
                                <div style={{ fontSize: '0.72rem', color: '#0369a1', fontStyle: 'italic', maxWidth: '150px', marginLeft: 'auto' }}>
                                  {inv.extraMealItems && inv.extraMealItems.length > 0 ? `${inv.extraMealItems.length} suất ăn` : 'Đăng ký ăn'}
                                </div>
                              </div>
                            ) : (
                              <span style={{ color: '#94a3b8' }}>0</span>
                            )}
                          </td>
                          {/* Vật tư tiêu hao */}
                          <td style={{ padding: '0.65rem 0.6rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                            {inv.consumablesFee > 0 ? (
                              <div>
                                <div style={{ fontWeight: 700, color: '#0d9488' }}>
                                  +{formatNum(inv.consumablesFee)}
                                </div>
                                <div style={{ fontSize: '0.72rem', color: '#0f766e', fontStyle: 'italic', maxWidth: '150px', marginLeft: 'auto' }}>
                                  {inv.consumableItems && inv.consumableItems.length > 0 ? `${inv.consumableItems.length} mục vật tư` : 'Vật tư y tế'}
                                </div>
                              </div>
                            ) : (
                              <span style={{ color: '#94a3b8' }}>0</span>
                            )}
                          </td>
                          {/* Nợ tháng trước */}
                          <td style={{ padding: '0.65rem 0.6rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                            {(inv.previousMonthDebt || 0) > 0 ? (
                              <div>
                                <span style={{ color: '#c2410c', fontWeight: 700 }}>
                                  +{formatNum(inv.previousMonthDebt || 0)}
                                </span>
                                <div style={{ fontSize: '0.7rem', color: '#ea580c', fontStyle: 'italic' }}>Tự động cập nhật</div>
                              </div>
                            ) : (
                              <span style={{ color: '#94a3b8' }}>0</span>
                            )}
                          </td>
                          <td style={{ padding: '0.65rem 0.6rem', textAlign: 'right', color: '#b91c1c', fontVariantNumeric: 'tabular-nums' }}>
                            {inv.leaveDeductionFee > 0 ? `-${formatNum(inv.leaveDeductionFee)}` : '0'}
                          </td>
                          <td style={{ padding: '0.65rem 0.6rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                            {inv.totalDiscountAmount > 0 ? (
                              <span style={{ color: '#16a34a', fontWeight: 700 }}>
                                -{formatNum(inv.totalDiscountAmount)}
                              </span>
                            ) : (
                              <span style={{ color: '#94a3b8' }}>0</span>
                            )}
                          </td>
                          {/* Nợ Đặt Cọc (1 lần khi nhập viện) */}
                          <td style={{ padding: '0.65rem 0.6rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                            {inv.depositStatus === 'UNPAID' || (inv.unpaidDepositDebt || 0) > 0 ? (
                              <div>
                                <span style={{ color: '#b91c1c', fontWeight: 700, fontSize: '0.8rem' }}>
                                  Nợ {formatNum(inv.unpaidDepositDebt || 20000000)}
                                </span>
                                <div style={{ fontSize: '0.7rem', color: '#dc2626', fontStyle: 'italic' }}>Cọc 1 lần nhập viện</div>
                              </div>
                            ) : (
                              <span style={{ color: '#0d9488', fontWeight: 600, fontSize: '0.8rem' }}>
                                ✓ Đã đóng cọc ({formatNum(inv.depositFee || 20000000)}đ)
                              </span>
                            )}
                          </td>
                          <td style={{ padding: '0.65rem 0.6rem', textAlign: 'right', fontWeight: 800, color: '#0f172a', fontSize: '0.98rem', fontVariantNumeric: 'tabular-nums' }}>
                            {formatNum(inv.totalAmount)}
                          </td>
                          <td style={{ padding: '0.65rem 0.6rem', textAlign: 'right', color: '#16a34a', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                            {formatNum(inv.paidAmount)}
                          </td>
                          <td style={{ padding: '0.65rem 0.6rem', textAlign: 'right', fontWeight: 700, color: inv.remainingAmount > 0 ? '#dc2626' : '#64748b', fontVariantNumeric: 'tabular-nums' }}>
                            {formatNum(inv.remainingAmount)}
                          </td>
                          <td style={{ padding: '0.65rem 0.6rem', textAlign: 'center' }}>
                            <span className={`badge ${st.badgeClass}`} style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', whiteSpace: 'nowrap' }}>
                              <span>{st.icon}</span>
                              <span>{st.label}</span>
                            </span>
                          </td>
                          <td style={{ padding: '0.65rem 0.6rem', textAlign: 'center' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem' }}>
                              <span className={`badge ${auditSt.badgeClass}`} style={{ fontSize: '0.72rem', padding: '0.2rem 0.45rem', display: 'inline-flex', alignItems: 'center', gap: '0.2rem', whiteSpace: 'nowrap' }}>
                                <span>{auditSt.icon}</span>
                                <span>{auditSt.label}</span>
                              </span>
                              {inv.auditStatus === 'MANAGER_REPORTED' && inv.reportedErrorReason && (
                                <div style={{ fontSize: '0.72rem', color: '#dc2626', fontWeight: 600, marginTop: '0.15rem', maxWidth: '170px', lineHeight: '1.2' }}>
                                  ⚠️ Lỗi báo: {inv.reportedErrorReason}
                                </div>
                              )}
                            </div>
                          </td>
                          <td style={{ padding: '0.65rem 0.6rem', textAlign: 'center' }}>
                            <div style={{ display: 'flex', gap: '0.3rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                              <button
                                type="button"
                                className="btn btn-neutral"
                                onClick={() => setDetailModalInvoice(inv)}
                                style={{ padding: '0.25rem 0.5rem', fontSize: '0.78rem' }}
                                title="Xem chi tiết bảng kê thu phí"
                              >
                                👁️ Chi tiết
                              </button>

                              <button
                                type="button"
                                className="btn btn-neutral"
                                style={{ padding: '0.25rem 0.5rem', fontSize: '0.78rem', background: '#f1f5f9', color: '#0f172a', fontWeight: 600, border: '1px solid #cbd5e1' }}
                                title="Xem bản xem trước & in Thông báo thu phí bản giấy A4"
                                onClick={() => {
                                  setPrintModalNotice({
                                    id: inv.invoiceCode,
                                    residentId: inv.residentId,
                                    residentName: inv.residentName,
                                    residentCode: inv.residentId,
                                    contractCode: `HD-${inv.residentId}`,
                                    billingMonth: inv.billingMonth,
                                    sponsorName: 'Thân nhân Cụ ' + inv.residentName,
                                    sponsorPhone: '0988xxxxxx',
                                    basicFee: inv.basicPackageFee,
                                    supportFee: inv.supportServicesFee,
                                    bathingLaundryFee: 0,
                                    mobilityFee: 0,
                                    hygieneFee: 0,
                                    feedingSondeFee: 0,
                                    dementiaCareFee: 0,
                                    soreCareFee: 0,
                                    catheterCareFee: 0,
                                    tracheostomyCareFee: 0,
                                    woundDressingFee: 0,
                                    rehabFee: 0,
                                    incurredFee: inv.holidaySurchargeFee,
                                    incurredContent: inv.holidaySurchargeFee > 0 ? `Phụ thu Lễ Tết (${inv.holidayDays || 1} ngày)` : undefined,
                                    deductionFee: inv.leaveDeductionFee + inv.totalDiscountAmount,
                                    previousMonthDebt: inv.previousMonthDebt || 0,
                                    debtNotes: inv.previousMonthDebt ? 'Nợ tháng trước tự động cập nhật' : undefined,
                                    depositStatus: inv.depositStatus || 'PAID',
                                    unpaidDepositDebt: inv.depositStatus === 'UNPAID' ? (inv.unpaidDepositDebt || 20000000) : 0,
                                    familyMealsFee: inv.extraMealsFee || 0,
                                    consumablesFee: inv.consumablesFee || 0,
                                    totalDue: inv.totalAmount,
                                    paidAmount: inv.paidAmount,
                                    remainingAmount: inv.remainingAmount,
                                    status: inv.status === 'PAID' ? 'PAID' : inv.status === 'PARTIAL' ? 'PARTIAL' : 'UNPAID',
                                    statusLabel: inv.status === 'PAID' ? 'Đã thu' : inv.status === 'PARTIAL' ? 'Thu một phần' : 'Chưa thu',
                                    isApproved: inv.auditStatus === 'DIRECTOR_APPROVED' || inv.auditStatus === 'MANAGER_APPROVED',
                                    isPublishedToFamilyPortal: inv.auditStatus === 'DIRECTOR_APPROVED',
                                    approvedBy: inv.approvedByDirectorName || inv.reviewedByManagerName || 'Bộ phận Kế toán',
                                  });
                                }}
                              >
                                🖨️ In Thông báo
                              </button>

                              {/* Thao tác Thẩm định cho Quản Lý */}
                              {canConfigurePricing && inv.auditStatus !== 'DIRECTOR_APPROVED' && (
                                <button
                                  type="button"
                                  className="btn btn-neutral"
                                  onClick={() => {
                                    setManagerReviewInvoice(inv);
                                    setManagerReviewNotes(inv.reportedErrorReason || inv.managerNotes || '');
                                  }}
                                  style={{ padding: '0.25rem 0.5rem', fontSize: '0.78rem', fontWeight: 600, color: '#0369a1', borderColor: '#bae6fd' }}
                                  title="Quản lý kiểm duyệt tính chính xác hoặc báo cáo sai sót"
                                >
                                  🔍 Thẩm định
                                </button>
                              )}

                              {/* Thao tác Hiệu chỉnh các hạng mục cho Ban Giám Đốc */}
                              {actor?.actorRole === 'SUPERVISOR' && inv.auditStatus !== 'DIRECTOR_APPROVED' && (
                                <button
                                  type="button"
                                  className="btn btn-primary"
                                  onClick={() => {
                                    setDirectorEditInvoice(inv);
                                    setDirectorForm({
                                      basicPackageFee: inv.basicPackageFee,
                                      supportServicesFee: inv.supportServicesFee,
                                      extendedCareFee: inv.extendedCareFee,
                                      extendedCareDays: inv.extendedCareDays || 0,
                                      regularLeaveDays: inv.regularLeaveDays || 0,
                                      forceMajeureLeaveDays: inv.forceMajeureLeaveDays || 0,
                                      holidayDays: inv.holidayDays || 0,
                                      holidaySurchargeFee: inv.holidaySurchargeFee || 0,
                                      extraMealsFee: inv.extraMealsFee || 0,
                                      consumablesFee: inv.consumablesFee || 0,
                                      directorEditNotes: inv.directorEditNotes || '',
                                    });
                                  }}
                                  style={{ padding: '0.25rem 0.5rem', fontSize: '0.78rem', fontWeight: 600 }}
                                  title="Ban Giám đốc hiệu chỉnh các hạng mục thu phí"
                                >
                                  ✏️ Hiệu chỉnh BGĐ
                                </button>
                              )}

                              {/* Thao tác Phê duyệt & Phát hành Cổng thân nhân cho Ban Giám Đốc */}
                              {actor?.actorRole === 'SUPERVISOR' && inv.auditStatus !== 'DIRECTOR_APPROVED' && (
                                <button
                                  type="button"
                                  className="btn btn-success"
                                  onClick={() => {
                                    if (window.confirm(`Xác nhận Ban Giám đốc phê duyệt tính chính xác & phát hành Bảng kê ${inv.invoiceCode} tới Cổng Thân nhân?`)) {
                                      publishByDirectorMutation.mutate(inv.invoiceId);
                                    }
                                  }}
                                  style={{ padding: '0.25rem 0.5rem', fontSize: '0.78rem', fontWeight: 700 }}
                                  title="Ban Giám đốc phê duyệt & phát hành gửi Cổng thân nhân"
                                >
                                  🚀 Duyệt & Phát hành
                                </button>
                              )}

                              {canConfigurePricing && inv.status !== 'SETTLED' && (
                                <button
                                  type="button"
                                  className="btn btn-success"
                                  onClick={() => {
                                    setDiscountModalInvoice(inv);
                                    handleSelectPolicy('CUSTOM');
                                  }}
                                  style={{ padding: '0.25rem 0.5rem', fontSize: '0.78rem', fontWeight: 600 }}
                                  title="Áp dụng mức giảm giá cho cụ"
                                >
                                  🎁 Giảm giá
                                </button>
                              )}

                              {canManageBilling && inv.remainingAmount > 0 && (
                                <button
                                  type="button"
                                  className="btn btn-primary"
                                  onClick={() => {
                                    setPaymentModalInvoice(inv);
                                    setPayAmount(inv.remainingAmount);
                                  }}
                                  style={{ padding: '0.25rem 0.5rem', fontSize: '0.78rem' }}
                                >
                                  💵 Thu tiền
                                </button>
                              )}

                              {canManageBilling && inv.status === 'PAID' && (
                                <button
                                  type="button"
                                  className="btn btn-neutral"
                                  onClick={() => setSettleModalInvoice(inv)}
                                  style={{ padding: '0.25rem 0.5rem', fontSize: '0.78rem', color: '#15803d', borderColor: '#86efac' }}
                                >
                                  🔒 Khóa sổ
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: BẢNG GIÁ DỊCH VỤ & GÓI CHĂM SÓC */}
      {/* ========================================================================= */}
      {activeTab === 'pricing' && (
        <div>
          {/* Top Bar for Pricing tab */}
          <div className="card" style={{ padding: '1rem 1.25rem', marginBottom: '1.25rem', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', borderRadius: '0.65rem' }}>
            <div>
              <h3 style={{ margin: 0, color: '#1e293b', fontSize: '1.15rem' }}>
                🏛️ Biểu Phí Dịch Vụ Trung Tâm Dưỡng Lão Tâm An
              </h3>
              <p style={{ margin: '0.2rem 0 0 0', color: '#64748b', fontSize: '0.85rem' }}>
                Bảng giá chính thức áp dụng từ ngày <b>{pricingData.effectiveDate}</b>. {canConfigurePricing ? 'Bạn có thẩm quyền chỉnh sửa bảng giá này.' : 'Chỉ Ban Giám đốc và Quản lý có quyền chỉnh sửa.'}
              </p>
            </div>

            {canConfigurePricing && (
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {!isEditingPricing ? (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => {
                      setPricingForm(JSON.parse(JSON.stringify(pricingData)));
                      setIsEditingPricing(true);
                    }}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600, fontSize: '0.85rem' }}
                  >
                    ✏️ Cấu Hình / Chỉnh Sửa Bảng Giá
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      className="btn btn-neutral"
                      onClick={() => {
                        setPricingForm(JSON.parse(JSON.stringify(pricingData)));
                        setIsEditingPricing(false);
                      }}
                    >
                      Hủy bỏ
                    </button>
                    <button
                      type="button"
                      className="btn btn-success"
                      onClick={() => updatePricingMutation.mutate()}
                      disabled={updatePricingMutation.isPending}
                      style={{ fontWeight: 700 }}
                    >
                      {updatePricingMutation.isPending ? 'Đang lưu...' : '💾 Lưu Bảng Giá Mới'}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Section I: Phí Dịch Vụ Chăm Sóc Cơ Bản */}
          <div className="card" style={{ marginBottom: '1.25rem', padding: '1.25rem', borderRadius: '0.65rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', borderBottom: '2px solid #15803d', paddingBottom: '0.5rem' }}>
              <span style={{ fontSize: '1.3rem' }}>🏨</span>
              <h2 style={{ margin: 0, fontSize: '1.15rem', color: '#166534', fontWeight: 800 }}>
                I. PHÍ DỊCH VỤ CHĂM SÓC CƠ BẢN
              </h2>
            </div>

            <div className="table-responsive">
              <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: '#f0fdf4', borderBottom: '2px solid #bbf7d0' }}>
                    <th style={{ width: '50px', textAlign: 'center', padding: '0.65rem' }}>STT</th>
                    <th style={{ padding: '0.65rem' }}>Nội Dung Dịch Vụ / Loại Phòng</th>
                    <th style={{ width: '130px', padding: '0.65rem' }}>Quy Cách</th>
                    <th style={{ width: '180px', textAlign: 'right', padding: '0.65rem' }}>Mức Phí / Tháng (đồng)</th>
                    <th style={{ padding: '0.65rem' }}>Ghi Chú & Tiện Ích</th>
                  </tr>
                </thead>
                <tbody>
                  {(isEditingPricing && pricingForm ? pricingForm.basicCarePackages : pricingData.basicCarePackages).map((pkg, idx) => (
                    <tr key={pkg.id} style={{ borderBottom: '1px solid #f1f5f9', verticalAlign: 'middle' }}>
                      <td style={{ textAlign: 'center', fontWeight: 700, padding: '0.65rem' }}>{pkg.stt}</td>
                      <td style={{ padding: '0.65rem' }}>
                        {isEditingPricing && pricingForm ? (
                          <input
                            type="text"
                            className="text-input"
                            value={pkg.name}
                            onChange={(e) => {
                              const updated = [...pricingForm.basicCarePackages];
                              updated[idx].name = e.target.value;
                              setPricingForm({ ...pricingForm, basicCarePackages: updated });
                            }}
                          />
                        ) : (
                          <div style={{ fontWeight: 700, color: '#1e293b' }}>{pkg.name}</div>
                        )}
                        <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.2rem' }}>{pkg.description}</div>
                      </td>
                      <td style={{ padding: '0.65rem' }}>
                        <span className="badge badge-neutral" style={{ whiteSpace: 'nowrap' }}>{pkg.bedCount}</span>
                      </td>
                      <td style={{ textAlign: 'right', padding: '0.65rem' }}>
                        {isEditingPricing && pricingForm ? (
                          <input
                            type="number"
                            step="100000"
                            className="text-input"
                            style={{ textAlign: 'right' }}
                            value={pkg.monthlyFee}
                            onChange={(e) => {
                              const updated = [...pricingForm.basicCarePackages];
                              updated[idx].monthlyFee = Number(e.target.value);
                              setPricingForm({ ...pricingForm, basicCarePackages: updated });
                            }}
                          />
                        ) : (
                          <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#15803d', fontVariantNumeric: 'tabular-nums' }}>
                            {formatNum(pkg.monthlyFee)}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '0.65rem' }}>
                        {isEditingPricing && pricingForm ? (
                          <input
                            type="text"
                            className="text-input"
                            value={pkg.note || ''}
                            onChange={(e) => {
                              const updated = [...pricingForm.basicCarePackages];
                              updated[idx].note = e.target.value;
                              setPricingForm({ ...pricingForm, basicCarePackages: updated });
                            }}
                          />
                        ) : (
                          <span style={{ fontSize: '0.85rem', color: '#4b5563' }}>{pkg.note || '—'}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Note box for Basic care */}
            <div style={{ background: '#f8fafc', padding: '0.85rem 1rem', borderRadius: '0.5rem', marginTop: '1rem', fontSize: '0.83rem', color: '#475569', borderLeft: '4px solid #15803d' }}>
              <b>💡 Tiện ích dịch vụ chăm sóc cơ bản bao gồm:</b> Phòng ở đạt tiêu chuẩn; vệ sinh khép kín; các tiện nghi điều hòa nóng lạnh; chuông báo y tế; tủ để đồ; giặt là quần áo; các đồ dùng tiêu hao (bàn chải, kem đánh răng). Bữa ăn đạt chuẩn dinh dưỡng theo từng thể trạng NCT. Các hoạt động vui chơi rèn luyện thể chất, tinh thần theo lịch hoạt động của Trung tâm. Nhân viên chăm sóc & nhân viên y tế trực 24/7.
            </div>
          </div>

          {/* Section II: Phí Dịch Vụ Chăm Sóc Hỗ Trợ */}
          <div className="card" style={{ marginBottom: '1.25rem', padding: '1.25rem', borderRadius: '0.65rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', borderBottom: '2px solid #0284c7', paddingBottom: '0.5rem' }}>
              <span style={{ fontSize: '1.3rem' }}>🩺</span>
              <h2 style={{ margin: 0, fontSize: '1.15rem', color: '#0369a1', fontWeight: 800 }}>
                II. PHÍ DỊCH VỤ CHĂM SÓC HỖ TRỢ
              </h2>
            </div>

            <div className="table-responsive">
              <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: '#f0f9ff', borderBottom: '2px solid #bae6fd' }}>
                    <th style={{ width: '50px', textAlign: 'center', padding: '0.65rem' }}>STT</th>
                    <th style={{ padding: '0.65rem' }}>Nội Dung Dịch Vụ Hỗ Trợ</th>
                    <th style={{ width: '100px', padding: '0.65rem' }}>Đơn Vị Tính</th>
                    <th style={{ width: '180px', textAlign: 'right', padding: '0.65rem' }}>Mức Phí (đồng)</th>
                    <th style={{ padding: '0.65rem' }}>Ghi Chú / Chi Tiết</th>
                  </tr>
                </thead>
                <tbody>
                  {(isEditingPricing && pricingForm ? pricingForm.supportServices : pricingData.supportServices).map((ss, idx) => (
                    <tr key={ss.id} style={{ borderBottom: '1px solid #f1f5f9', verticalAlign: 'middle' }}>
                      <td style={{ textAlign: 'center', fontWeight: 700, padding: '0.65rem' }}>{ss.stt}</td>
                      <td style={{ padding: '0.65rem' }}>
                        {isEditingPricing && pricingForm ? (
                          <input
                            type="text"
                            className="text-input"
                            value={ss.name}
                            onChange={(e) => {
                              const updated = [...pricingForm.supportServices];
                              updated[idx].name = e.target.value;
                              setPricingForm({ ...pricingForm, supportServices: updated });
                            }}
                          />
                        ) : (
                          <div style={{ fontWeight: 600, color: '#0f172a' }}>{ss.name}</div>
                        )}
                        {ss.pricingDetail && (
                          <div style={{ fontSize: '0.78rem', color: '#0369a1', marginTop: '0.2rem' }}>
                            • {ss.pricingDetail}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '0.65rem' }}>
                        <span className="badge badge-neutral" style={{ whiteSpace: 'nowrap' }}>{ss.unit}</span>
                      </td>
                      <td style={{ textAlign: 'right', padding: '0.65rem' }}>
                        {isEditingPricing && pricingForm ? (
                          <input
                            type="number"
                            className="text-input"
                            style={{ textAlign: 'right' }}
                            value={ss.priceMin}
                            onChange={(e) => {
                              const updated = [...pricingForm.supportServices];
                              updated[idx].priceMin = Number(e.target.value);
                              updated[idx].priceDisplay = `${formatNum(Number(e.target.value))}`;
                              setPricingForm({ ...pricingForm, supportServices: updated });
                            }}
                          />
                        ) : (
                          <div style={{ fontWeight: 700, color: '#0284c7', fontVariantNumeric: 'tabular-nums' }}>
                            {ss.priceDisplay}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '0.65rem' }}>
                        {isEditingPricing && pricingForm ? (
                          <input
                            type="text"
                            className="text-input"
                            value={ss.note || ''}
                            onChange={(e) => {
                              const updated = [...pricingForm.supportServices];
                              updated[idx].note = e.target.value;
                              setPricingForm({ ...pricingForm, supportServices: updated });
                            }}
                          />
                        ) : (
                          <span style={{ fontSize: '0.85rem', color: '#64748b' }}>{ss.note || '—'}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section III: Phí Chăm Sóc Mở Rộng */}
          <div className="card" style={{ marginBottom: '1.25rem', padding: '1.25rem', borderRadius: '0.65rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', borderBottom: '2px solid #7c3aed', paddingBottom: '0.5rem' }}>
              <span style={{ fontSize: '1.3rem' }}>🌟</span>
              <h2 style={{ margin: 0, fontSize: '1.15rem', color: '#6d28d9', fontWeight: 800 }}>
                III. PHÍ DỊCH VỤ CHĂM SÓC MỞ RỘNG
              </h2>
            </div>

            <div className="table-responsive">
              <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: '#faf5ff', borderBottom: '2px solid #e9d5ff' }}>
                    <th style={{ width: '50px', textAlign: 'center', padding: '0.65rem' }}>STT</th>
                    <th style={{ padding: '0.65rem' }}>Nội Dung Dịch Vụ Mở Rộng</th>
                    <th style={{ width: '100px', padding: '0.65rem' }}>Đơn Vị Tính</th>
                    <th style={{ width: '180px', textAlign: 'right', padding: '0.65rem' }}>Mức Phí (đồng)</th>
                    <th style={{ padding: '0.65rem' }}>Ghi Chú</th>
                  </tr>
                </thead>
                <tbody>
                  {(isEditingPricing && pricingForm ? pricingForm.extendedCare : pricingData.extendedCare).map((ec, idx) => (
                    <tr key={ec.id} style={{ borderBottom: '1px solid #f1f5f9', verticalAlign: 'middle' }}>
                      <td style={{ textAlign: 'center', fontWeight: 700, padding: '0.65rem' }}>{ec.stt}</td>
                      <td style={{ fontWeight: 600, color: '#1e293b', padding: '0.65rem' }}>
                        {isEditingPricing && pricingForm ? (
                          <input
                            type="text"
                            className="text-input"
                            value={ec.name}
                            onChange={(e) => {
                              const updated = [...pricingForm.extendedCare];
                              updated[idx].name = e.target.value;
                              setPricingForm({ ...pricingForm, extendedCare: updated });
                            }}
                          />
                        ) : (
                          ec.name
                        )}
                      </td>
                      <td style={{ padding: '0.65rem' }}>
                        {isEditingPricing && pricingForm ? (
                          <input
                            type="text"
                            className="text-input"
                            style={{ width: '80px' }}
                            value={ec.unit}
                            onChange={(e) => {
                              const updated = [...pricingForm.extendedCare];
                              updated[idx].unit = e.target.value;
                              setPricingForm({ ...pricingForm, extendedCare: updated });
                            }}
                          />
                        ) : (
                          <span className="badge badge-neutral" style={{ whiteSpace: 'nowrap' }}>{ec.unit}</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right', padding: '0.65rem' }}>
                        {isEditingPricing && pricingForm ? (
                          <input
                            type="number"
                            className="text-input"
                            style={{ textAlign: 'right', width: '130px' }}
                            value={ec.priceMin}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              const updated = [...pricingForm.extendedCare];
                              updated[idx].priceMin = val;
                              updated[idx].priceDisplay = ec.priceMax ? `${formatNum(val)} - ${formatNum(ec.priceMax)}` : `${formatNum(val)}`;
                              setPricingForm({ ...pricingForm, extendedCare: updated });
                            }}
                          />
                        ) : (
                          <div style={{ fontWeight: 700, color: '#7c3aed', fontVariantNumeric: 'tabular-nums' }}>
                            {ec.priceDisplay}
                          </div>
                        )}
                      </td>
                      <td style={{ fontSize: '0.85rem', color: '#64748b', padding: '0.65rem' }}>
                        {isEditingPricing && pricingForm ? (
                          <input
                            type="text"
                            className="text-input"
                            value={ec.note || ''}
                            onChange={(e) => {
                              const updated = [...pricingForm.extendedCare];
                              updated[idx].note = e.target.value;
                              setPricingForm({ ...pricingForm, extendedCare: updated });
                            }}
                          />
                        ) : (
                          <span style={{ fontSize: '0.85rem', color: '#64748b' }}>{ec.note || '—'}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section IV: Chính Sách Giảm Trừ & Phụ Thu */}
          <div className="card" style={{ padding: '1.25rem', borderRadius: '0.65rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', borderBottom: '2px solid #d97706', paddingBottom: '0.5rem' }}>
              <span style={{ fontSize: '1.3rem' }}>📑</span>
              <h2 style={{ margin: 0, fontSize: '1.15rem', color: '#b45309', fontWeight: 800 }}>
                IV. QUY TẮC GIẢM TRỪ VẮNG MẶT, ƯU ĐÃI THANH TOÁN & PHỤ THU LỄ TẾT
              </h2>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.85rem' }}>
              {(isEditingPricing && pricingForm ? pricingForm.policyRules : pricingData.policyRules).map((rule, idx) => (
                <div key={rule.id} style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '0.5rem', padding: '0.9rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '110px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {isEditingPricing && pricingForm ? (
                      <input
                        type="text"
                        className="text-input"
                        style={{ fontWeight: 700, color: '#92400e', fontSize: '0.85rem', flex: 1, minWidth: '150px' }}
                        value={rule.name}
                        onChange={(e) => {
                          const updated = [...pricingForm.policyRules];
                          updated[idx].name = e.target.value;
                          setPricingForm({ ...pricingForm, policyRules: updated });
                        }}
                      />
                    ) : (
                      <span style={{ fontWeight: 700, color: '#92400e', fontSize: '0.9rem' }}>{rule.name}</span>
                    )}

                    {isEditingPricing && pricingForm ? (
                      <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                        <input
                          type="number"
                          className="text-input"
                          style={{ width: '90px', textAlign: 'right', padding: '0.2rem 0.4rem', fontSize: '0.85rem' }}
                          value={rule.value}
                          onChange={(e) => {
                            const updated = [...pricingForm.policyRules];
                            updated[idx].value = Number(e.target.value);
                            setPricingForm({ ...pricingForm, policyRules: updated });
                          }}
                        />
                        <select
                          className="text-input"
                          style={{ padding: '0.2rem 0.3rem', fontSize: '0.8rem' }}
                          value={rule.valueType}
                          onChange={(e) => {
                            const updated = [...pricingForm.policyRules];
                            updated[idx].valueType = e.target.value as 'PERCENT' | 'FIXED_DAILY';
                            setPricingForm({ ...pricingForm, policyRules: updated });
                          }}
                        >
                          <option value="PERCENT">%</option>
                          <option value="FIXED_DAILY">đ/ngày</option>
                        </select>
                      </div>
                    ) : (
                      <span className="badge badge-warning" style={{ fontWeight: 800, whiteSpace: 'nowrap' }}>
                        {rule.valueType === 'PERCENT' ? `Giảm ${rule.value}%` : `${formatNum(rule.value)} đ/ngày`}
                      </span>
                    )}
                  </div>
                  {isEditingPricing && pricingForm ? (
                    <textarea
                      className="text-input"
                      rows={2}
                      style={{ marginTop: '0.4rem', fontSize: '0.82rem', width: '100%', resize: 'vertical' }}
                      value={rule.description}
                      onChange={(e) => {
                        const updated = [...pricingForm.policyRules];
                        updated[idx].description = e.target.value;
                        setPricingForm({ ...pricingForm, policyRules: updated });
                      }}
                    />
                  ) : (
                    <div style={{ fontSize: '0.82rem', color: '#78350f', marginTop: '0.4rem', lineHeight: '1.4' }}>
                      {rule.description}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Section V: Hạng Mục Thu Tiền Đặt Cọc */}
          {(() => {
            const depositConfig = (isEditingPricing && pricingForm ? pricingForm.depositFee : pricingData.depositFee) || {
              id: 'DEP-01',
              name: 'Tiền đặt cọc tiếp nhận lưu trú',
              amount: 20000000,
              description: 'Mỗi Cụ khi vào ở tại Trung Tâm Dưỡng Lão Tâm An sẽ nộp khoản tiền đặt cọc ký quỹ 20.000.000 đồng. Khoản tiền này nhằm bảo đảm thực hiện hợp đồng, bù đắp các chi phí phát sinh cấp cứu (nếu có) hoặc đối trừ khi thanh lý. Số tiền này sẽ được hoàn trả 100% cho Thân nhân khi kết thúc hợp đồng dịch vụ.',
            };

            return (
              <div className="card" style={{ padding: '1.25rem', borderRadius: '0.65rem', marginTop: '1.25rem', background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', borderBottom: '2px solid #16a34a', paddingBottom: '0.5rem' }}>
                  <span style={{ fontSize: '1.3rem' }}>💳</span>
                  <h2 style={{ margin: 0, fontSize: '1.15rem', color: '#166534', fontWeight: 800 }}>
                    V. HẠNG MỤC THU TIỀN ĐẶT CỌC LƯU TRÚ (KÝ QUỶ)
                  </h2>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                  <div style={{ flex: 1, minWidth: '280px' }}>
                    {isEditingPricing && pricingForm ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <label style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0f172a', whiteSpace: 'nowrap' }}>Tiền đặt cọc tiếp nhận lưu trú (VNĐ):</label>
                          <input
                            type="number"
                            className="text-input"
                            style={{ width: '180px', fontWeight: 700, color: '#15803d' }}
                            value={pricingForm.depositFee?.amount ?? 20000000}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              setPricingForm({
                                ...pricingForm,
                                depositFee: {
                                  ...(pricingForm.depositFee || depositConfig),
                                  amount: val,
                                },
                              });
                            }}
                          />
                        </div>
                        <div>
                          <label style={{ fontWeight: 600, fontSize: '0.85rem', color: '#334155', display: 'block', marginBottom: '0.2rem' }}>Diễn giải chính sách đặt cọc:</label>
                          <textarea
                            className="text-input"
                            rows={3}
                            style={{ width: '100%', fontSize: '0.85rem' }}
                            value={pricingForm.depositFee?.description ?? depositConfig.description}
                            onChange={(e) => {
                              setPricingForm({
                                ...pricingForm,
                                depositFee: {
                                  ...(pricingForm.depositFee || depositConfig),
                                  description: e.target.value,
                                },
                              });
                            }}
                          />
                        </div>
                      </div>
                    ) : (
                      <>
                        <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>
                          Tiền đặt cọc tiếp nhận lưu trú: <span style={{ color: '#15803d', fontWeight: 800 }}>{formatNum(depositConfig.amount)} VNĐ / hợp đồng</span>
                        </div>
                        <div style={{ fontSize: '0.85rem', color: '#334155', marginTop: '0.35rem', lineHeight: '1.5' }}>
                          {depositConfig.description}
                        </div>
                      </>
                    )}
                  </div>
                  <div className="badge badge-success" style={{ fontSize: '0.9rem', padding: '0.5rem 0.85rem', fontWeight: 700 }}>
                    Định mức: {formatNum(depositConfig.amount)} đ
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: CHÍNH SÁCH GIẢM GIÁ & ƯU ĐÃI ĐẶC BIỆT */}
      {/* ========================================================================= */}
      {activeTab === 'discounts' && (
        <div>
          <div className="card" style={{ padding: '1.15rem 1.25rem', marginBottom: '1.25rem', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', borderRadius: '0.65rem' }}>
            <div>
              <h3 style={{ margin: 0, color: '#1e293b', fontSize: '1.15rem' }}>
                🎁 Danh Mục Chính Sách Giảm Giá & Ưu Đãi Đặc Biệt
              </h3>
              <p style={{ margin: '0.2rem 0 0 0', color: '#64748b', fontSize: '0.85rem' }}>
                Được phê duyệt bởi Ban Giám đốc và Quản lý để áp dụng cho các trường hợp đặc biệt (Gia đình chính sách, người có công, người thân nhân viên, đóng trước...).
              </p>
            </div>

            {canConfigurePricing && (
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                {!isEditingPricing ? (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => {
                      setPricingForm(JSON.parse(JSON.stringify(pricingData)));
                      setIsEditingPricing(true);
                    }}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600, fontSize: '0.85rem' }}
                  >
                    ✏️ Cấu Hình / Chỉnh Sửa Chính Sách
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      className="btn btn-neutral"
                      onClick={() => {
                        setPricingForm(JSON.parse(JSON.stringify(pricingData)));
                        setIsEditingPricing(false);
                      }}
                    >
                      Hủy bỏ
                    </button>
                    <button
                      type="button"
                      className="btn btn-success"
                      onClick={() => updatePricingMutation.mutate()}
                      disabled={updatePricingMutation.isPending}
                      style={{ fontWeight: 700 }}
                    >
                      {updatePricingMutation.isPending ? 'Đang lưu...' : '💾 Lưu Chính Sách Mới'}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {isEditingPricing && pricingForm && (
            <div style={{ width: '100%', marginBottom: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  const newPolicy: SpecialDiscountPolicy = {
                    id: `DISC-${Date.now()}`,
                    code: `KM-${pricingForm.specialDiscountPolicies.length + 1}`,
                    name: 'Chính sách ưu đãi mới',
                    reasonCategory: 'OTHER',
                    discountType: 'PERCENT',
                    discountValue: 5,
                    description: 'Căn cứ phê duyệt và điều kiện áp dụng mức ưu đãi mới...',
                    approvedRole: 'SUPERVISOR',
                    isActive: true,
                  };
                  setPricingForm({
                    ...pricingForm,
                    specialDiscountPolicies: [...pricingForm.specialDiscountPolicies, newPolicy],
                  });
                }}
                style={{ fontWeight: 600, fontSize: '0.85rem' }}
              >
                ➕ Thêm Chính Sách Ưu Đãi Mới
              </button>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1rem', alignItems: 'stretch' }}>
            {(isEditingPricing && pricingForm ? pricingForm.specialDiscountPolicies : pricingData.specialDiscountPolicies).map((p, idx) => {
              const catInfo = DISCOUNT_CATEGORY_LABELS[p.reasonCategory] || { label: p.reasonCategory, icon: '🏷️' };
              return (
                <div
                  key={p.id}
                  className="card"
                  style={{
                    padding: '1.15rem',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    height: '100%',
                    minHeight: '220px',
                    borderTop: `4px solid ${p.isActive ? '#15803d' : '#94a3b8'}`,
                    borderRadius: '0.65rem',
                    background: p.isActive ? '#ffffff' : '#f8fafc',
                    border: '1px solid #e2e8f0',
                    boxSizing: 'border-box',
                    opacity: p.isActive ? 1 : 0.8,
                  }}
                >
                  {isEditingPricing && pricingForm ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                      {/* Phân loại & Trạng thái */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                        <select
                          className="text-input"
                          style={{ fontSize: '0.8rem', fontWeight: 600, padding: '0.2rem 0.4rem', flex: 1 }}
                          value={p.reasonCategory}
                          onChange={(e) => {
                            const updated = [...pricingForm.specialDiscountPolicies];
                            updated[idx].reasonCategory = e.target.value as any;
                            setPricingForm({ ...pricingForm, specialDiscountPolicies: updated });
                          }}
                        >
                          {Object.entries(DISCOUNT_CATEGORY_LABELS).map(([catKey, catVal]) => (
                            <option key={catKey} value={catKey}>
                              {catVal.icon} {catVal.label}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          className={p.isActive ? 'badge badge-success' : 'badge badge-neutral'}
                          onClick={() => {
                            const updated = [...pricingForm.specialDiscountPolicies];
                            updated[idx].isActive = !updated[idx].isActive;
                            setPricingForm({ ...pricingForm, specialDiscountPolicies: updated });
                          }}
                          style={{ cursor: 'pointer', border: 'none' }}
                        >
                          {p.isActive ? '🟢 Áp dụng' : '🔴 Ngưng'}
                        </button>
                      </div>

                      {/* Tên chính sách */}
                      <div>
                        <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '0.2rem' }}>Tên chính sách:</label>
                        <input
                          type="text"
                          className="text-input"
                          style={{ fontWeight: 700, color: '#0f172a', width: '100%' }}
                          value={p.name}
                          onChange={(e) => {
                            const updated = [...pricingForm.specialDiscountPolicies];
                            updated[idx].name = e.target.value;
                            setPricingForm({ ...pricingForm, specialDiscountPolicies: updated });
                          }}
                        />
                      </div>

                      {/* Mức giảm & Loại giảm */}
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <div style={{ flex: 1 }}>
                          <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '0.2rem' }}>Tỷ lệ / Mức giảm:</label>
                          <input
                            type="number"
                            className="text-input"
                            style={{ fontWeight: 700, textAlign: 'right', width: '100%', color: '#166534' }}
                            value={p.discountValue}
                            onChange={(e) => {
                              const updated = [...pricingForm.specialDiscountPolicies];
                              updated[idx].discountValue = Number(e.target.value);
                              setPricingForm({ ...pricingForm, specialDiscountPolicies: updated });
                            }}
                          />
                        </div>
                        <div style={{ width: '115px' }}>
                          <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '0.2rem' }}>Loại giảm:</label>
                          <select
                            className="text-input"
                            style={{ fontSize: '0.8rem', padding: '0.35rem 0.4rem', width: '100%' }}
                            value={p.discountType}
                            onChange={(e) => {
                              const updated = [...pricingForm.specialDiscountPolicies];
                              updated[idx].discountType = e.target.value as 'PERCENT' | 'FIXED_AMOUNT';
                              setPricingForm({ ...pricingForm, specialDiscountPolicies: updated });
                            }}
                          >
                            <option value="PERCENT">% Phần trăm</option>
                            <option value="FIXED_AMOUNT">VNĐ Cố định</option>
                          </select>
                        </div>
                      </div>

                      {/* Diễn giải */}
                      <div>
                        <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '0.2rem' }}>Diễn giải & Điều kiện áp dụng:</label>
                        <textarea
                          className="text-input"
                          rows={2}
                          style={{ fontSize: '0.82rem', width: '100%', resize: 'vertical' }}
                          value={p.description}
                          onChange={(e) => {
                            const updated = [...pricingForm.specialDiscountPolicies];
                            updated[idx].description = e.target.value;
                            setPricingForm({ ...pricingForm, specialDiscountPolicies: updated });
                          }}
                        />
                      </div>

                      {/* Mã & Nút Xóa */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.4rem', gap: '0.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Mã:</span>
                          <input
                            type="text"
                            className="text-input"
                            style={{ width: '110px', fontSize: '0.8rem', fontWeight: 600 }}
                            value={p.code}
                            onChange={(e) => {
                              const updated = [...pricingForm.specialDiscountPolicies];
                              updated[idx].code = e.target.value;
                              setPricingForm({ ...pricingForm, specialDiscountPolicies: updated });
                            }}
                          />
                        </div>
                        <button
                          type="button"
                          style={{ background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: '0.3rem', padding: '0.25rem 0.5rem', fontSize: '0.78rem', cursor: 'pointer', fontWeight: 600 }}
                          onClick={() => {
                            const updated = pricingForm.specialDiscountPolicies.filter((_, i) => i !== idx);
                            setPricingForm({ ...pricingForm, specialDiscountPolicies: updated });
                          }}
                        >
                          🗑️ Xóa
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', gap: '0.5rem' }}>
                          <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>
                            {catInfo.icon} {catInfo.label}
                          </span>
                          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                            {!p.isActive && <span className="badge badge-neutral" style={{ fontSize: '0.72rem' }}>Tạm ngưng</span>}
                            <span className="badge badge-success" style={{ fontWeight: 800, fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
                              {p.discountType === 'PERCENT' ? `Giảm ${p.discountValue}%` : `Giảm ${formatNum(p.discountValue)} đ`}
                            </span>
                          </div>
                        </div>

                        <h4 style={{ margin: '0 0 0.4rem 0', color: '#0f172a', fontSize: '1rem', fontWeight: 700, lineHeight: 1.3 }}>
                          {p.name}
                        </h4>

                        <p style={{ fontSize: '0.84rem', color: '#475569', margin: 0, lineHeight: '1.45' }}>
                          {p.description}
                        </p>
                      </div>

                      <div style={{ borderTop: '1px dashed #e2e8f0', paddingTop: '0.6rem', marginTop: '0.85rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem', color: '#64748b' }}>
                        <span>Mã: <code style={{ fontWeight: 600 }}>{p.code}</code></span>
                        <span>Thẩm quyền: <b style={{ color: '#166534' }}>Ban Giám đốc</b></span>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: PHIẾU THU & LỊCH SỬ THANH TOÁN */}
      {/* ========================================================================= */}
      {activeTab === 'receipts' && (
        <div>
          <div className="card" style={{ padding: 0, overflow: 'hidden', borderRadius: '0.65rem', border: '1px solid #e2e8f0' }}>
            <div className="table-responsive" style={{ overflowX: 'auto' }}>
              <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '2px solid #cbd5e1' }}>
                    <th style={{ padding: '0.75rem 0.6rem', textAlign: 'left', whiteSpace: 'nowrap' }}>Mã Phiếu Thu</th>
                    <th style={{ padding: '0.75rem 0.6rem', textAlign: 'left', whiteSpace: 'nowrap' }}>Mã Bảng Kê</th>
                    <th style={{ padding: '0.75rem 0.6rem', textAlign: 'left', whiteSpace: 'nowrap' }}>Người Cao Tuổi</th>
                    <th style={{ padding: '0.75rem 0.6rem', textAlign: 'right', whiteSpace: 'nowrap' }}>Số Tiền Thu (đồng)</th>
                    <th style={{ padding: '0.75rem 0.6rem', textAlign: 'left', whiteSpace: 'nowrap' }}>Hình Thức</th>
                    <th style={{ padding: '0.75rem 0.6rem', textAlign: 'left', whiteSpace: 'nowrap' }}>Mã Tham Chiếu</th>
                    <th style={{ padding: '0.75rem 0.6rem', textAlign: 'left', whiteSpace: 'nowrap' }}>Người Lập Phiếu</th>
                    <th style={{ padding: '0.75rem 0.6rem', textAlign: 'center', whiteSpace: 'nowrap' }}>Thời Gian</th>
                  </tr>
                </thead>
                <tbody>
                  {(receiptsQuery.data || []).map((rec) => (
                    <tr key={rec.receiptId} style={{ borderBottom: '1px solid #f1f5f9', verticalAlign: 'middle' }}>
                      <td style={{ padding: '0.65rem 0.6rem' }}><code style={{ fontWeight: 700 }}>{rec.receiptCode}</code></td>
                      <td style={{ padding: '0.65rem 0.6rem' }}><code>{rec.invoiceCode}</code></td>
                      <td style={{ padding: '0.65rem 0.6rem', fontWeight: 600 }}>{rec.residentName}</td>
                      <td style={{ padding: '0.65rem 0.6rem', textAlign: 'right', fontWeight: 800, color: '#15803d', fontSize: '0.98rem', fontVariantNumeric: 'tabular-nums' }}>
                        {formatNum(rec.amount)}
                      </td>
                      <td style={{ padding: '0.65rem 0.6rem' }}>
                        <span className="badge badge-info" style={{ whiteSpace: 'nowrap' }}>
                          {PAYMENT_METHOD_LABELS[rec.paymentMethod] || rec.paymentMethod}
                        </span>
                      </td>
                      <td style={{ padding: '0.65rem 0.6rem' }}><code>{rec.transactionReference}</code></td>
                      <td style={{ padding: '0.65rem 0.6rem' }}>{rec.receivedBy}</td>
                      <td style={{ padding: '0.65rem 0.6rem', textAlign: 'center', fontSize: '0.8rem', color: '#64748b', whiteSpace: 'nowrap' }}>
                        {new Date(rec.paidAt).toLocaleString('vi-VN')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: BÁO CÁO DOANH THU THU PHÍ */}
      {/* ========================================================================= */}
      {activeTab === 'reports' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
          <div className="card" style={{ padding: '1.25rem', borderRadius: '0.65rem' }}>
            <h3 style={{ margin: '0 0 1rem 0', color: '#1e293b', fontSize: '1.1rem' }}>📊 Cơ Cấu Thu Phí Tháng {selectedMonth}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.88rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.4rem', borderBottom: '1px solid #f1f5f9' }}>
                <span>🏨 Phí chăm sóc cơ bản:</span>
                <b>{formatVndText(invoicesList.reduce((s, i) => s + i.basicPackageFee, 0))}</b>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.4rem', borderBottom: '1px solid #f1f5f9' }}>
                <span>💳 Tiền đặt cọc lưu trú (ký quỹ):</span>
                <b style={{ color: '#0f766e' }}>{formatVndText(invoicesList.reduce((s, i) => s + (i.depositFee || 20000000), 0))}</b>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.4rem', borderBottom: '1px solid #f1f5f9' }}>
                <span>🩺 Phí dịch vụ chăm sóc hỗ trợ:</span>
                <b>{formatVndText(invoicesList.reduce((s, i) => s + i.supportServicesFee, 0))}</b>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.4rem', borderBottom: '1px solid #f1f5f9' }}>
                <span>✨ Phí dịch vụ chăm sóc mở rộng:</span>
                <b style={{ color: '#7c3aed' }}>{formatVndText(invoicesList.reduce((s, i) => s + (i.extendedCareFee || 0), 0))}</b>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.4rem', borderBottom: '1px solid #f1f5f9' }}>
                <span>📉 Giảm trừ nghỉ phép/tạm vắng:</span>
                <b style={{ color: '#b91c1c' }}>-{formatVndText(stats.totalLeaveDeductions)}</b>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.4rem', borderBottom: '1px solid #f1f5f9' }}>
                <span>🎁 Giảm giá & Ưu đãi đã duyệt:</span>
                <b style={{ color: '#2563eb' }}>-{formatVndText(stats.totalDiscounts)}</b>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '0.5rem', fontWeight: 800, fontSize: '1.05rem', color: '#15803d' }}>
                <span>Tổng Thực Thu:</span>
                <span>{formatVndText(stats.totalBilled)}</span>
              </div>
            </div>
          </div>

          <div className="card" style={{ padding: '1.25rem', borderRadius: '0.65rem' }}>
            <h3 style={{ margin: '0 0 1rem 0', color: '#1e293b', fontSize: '1.1rem' }}>📈 Hiệu Quả Thu Phí & Công Nợ</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem', fontSize: '0.85rem' }}>
                  <span>Tỷ lệ đã thu thành công:</span>
                  <b>{stats.totalBilled > 0 ? Math.round((stats.totalCollected / stats.totalBilled) * 100) : 0}%</b>
                </div>
                <div style={{ width: '100%', height: '10px', background: '#e2e8f0', borderRadius: '5px', overflow: 'hidden' }}>
                  <div style={{ width: `${stats.totalBilled > 0 ? (stats.totalCollected / stats.totalBilled) * 100 : 0}%`, height: '100%', background: '#16a34a' }} />
                </div>
              </div>

              <div style={{ background: '#f8fafc', padding: '0.85rem', borderRadius: '0.5rem', fontSize: '0.85rem', color: '#475569' }}>
                <div>• Tổng số hồ sơ đã quyết toán: <b>{invoicesList.filter((i) => i.status === 'SETTLED').length} cụ</b></div>
                <div style={{ marginTop: '0.3rem' }}>• Hồ sơ đang chờ thu hoặc thu một phần: <b>{invoicesList.filter((i) => i.status === 'PENDING' || i.status === 'PARTIAL').length} cụ</b></div>
                <div style={{ marginTop: '0.3rem' }}>• Quỹ tiền đặt cọc ký quỹ đang giữ: <b>{formatVndText(invoicesList.reduce((s, i) => s + i.depositBalance, 0))}</b></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: ÁP DỤNG GIẢM GIÁ CHO NGƯỜI CAO TUỔI */}
      {/* ========================================================================= */}
      {discountModalInvoice && (
        <div className="modal-overlay" onClick={() => setDiscountModalInvoice(null)}>
          <div
            className="modal-card"
            style={{
              background: '#ffffff',
              borderRadius: '0.75rem',
              padding: '1.5rem',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
              border: '1px solid #e2e8f0',
              maxWidth: '560px',
              width: '100%',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.65rem' }}>
              <h3 style={{ margin: 0, color: '#1e293b', fontSize: '1.15rem', fontWeight: 700 }}>
                🎁 Phê Duyệt Mức Giảm Giá Thu Phí
              </h3>
              <button
                type="button"
                className="btn btn-neutral"
                onClick={() => setDiscountModalInvoice(null)}
                style={{ padding: '0.2rem 0.6rem', fontSize: '1rem', lineHeight: 1 }}
              >
                ✕
              </button>
            </div>

            <div style={{ background: '#f0fdf4', padding: '0.75rem 0.85rem', borderRadius: '0.5rem', marginBottom: '1rem', border: '1px solid #bbf7d0', fontSize: '0.88rem' }}>
              <div>Người cao tuổi: <b>{discountModalInvoice.residentName}</b> (Mã: {discountModalInvoice.residentId})</div>
              <div>Phòng / Gói: <b>{discountModalInvoice.basicPackageName}</b> — Phí gốc: <b>{formatVndText(discountModalInvoice.basicPackageFee)}</b></div>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                applyDiscountMutation.mutate();
              }}
            >
              <label className="field-group" style={{ marginBottom: '1rem' }}>
                <span className="field-label">Chọn chính sách ưu đãi định sẵn:</span>
                <select
                  className="text-input"
                  value={selectedPolicyId}
                  onChange={(e) => handleSelectPolicy(e.target.value)}
                >
                  <option value="CUSTOM">✍️ Nhập mức giảm giá thỏa thuận riêng / tùy biến</option>
                  {pricingData.specialDiscountPolicies.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.discountType === 'PERCENT' ? `Giảm ${p.discountValue}%` : `Giảm ${formatNum(p.discountValue)} đ`})
                    </option>
                  ))}
                </select>
              </label>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                <label className="field-group">
                  <span className="field-label">Hình thức giảm giá *</span>
                  <select
                    className="text-input"
                    value={discountType}
                    onChange={(e) => setDiscountType(e.target.value as any)}
                  >
                    <option value="PERCENT">Theo phần trăm (%)</option>
                    <option value="FIXED_AMOUNT">Số tiền cố định (VNĐ)</option>
                  </select>
                </label>

                <label className="field-group">
                  <span className="field-label">
                    {discountType === 'PERCENT' ? 'Tỷ lệ giảm (%) *' : 'Số tiền giảm (VNĐ) *'}
                  </span>
                  <input
                    type="number"
                    min="1"
                    className="text-input"
                    value={discountValue}
                    onChange={(e) => setDiscountValue(Number(e.target.value))}
                    required
                  />
                </label>
              </div>

              <div style={{ background: '#eff6ff', padding: '0.75rem', borderRadius: '0.5rem', marginBottom: '1rem', fontSize: '0.88rem', color: '#1e40af' }}>
                💡 <b>Dự tính số tiền giảm trừ:</b>{' '}
                {discountType === 'PERCENT'
                  ? `${formatVndText(Math.round((discountModalInvoice.basicPackageFee * discountValue) / 100))} (${discountValue}% trên phí cơ bản)`
                  : formatVndText(discountValue)}
              </div>

              <label className="field-group" style={{ marginBottom: '1.25rem' }}>
                <span className="field-label">Lý do & Căn cứ phê duyệt giảm giá *</span>
                <textarea
                  className="text-input"
                  rows={3}
                  placeholder="Ví dụ: Theo biên bản thỏa thuận với gia đình ngày 01/09/2026, cụ là thương binh có công, phê duyệt giảm 10% phí chăm sóc cơ bản..."
                  value={discountNotes}
                  onChange={(e) => setDiscountNotes(e.target.value)}
                  required
                />
              </label>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', borderTop: '1px solid #e2e8f0', paddingTop: '1rem' }}>
                <button
                  type="button"
                  className="btn btn-neutral"
                  onClick={() => setDiscountModalInvoice(null)}
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="btn btn-success"
                  disabled={applyDiscountMutation.isPending || discountValue <= 0 || !discountNotes.trim()}
                  style={{ fontWeight: 700 }}
                >
                  {applyDiscountMutation.isPending ? 'Đang xử lý...' : 'Xác Nhận Phê Duyệt'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: CHI TIẾT BẢNG KÊ THU PHÍ */}
      {/* ========================================================================= */}
      {detailModalInvoice && (
        <div className="modal-overlay" onClick={() => setDetailModalInvoice(null)}>
          <div
            className="modal-card"
            style={{
              background: '#ffffff',
              borderRadius: '0.75rem',
              padding: '1.5rem',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
              border: '1px solid #e2e8f0',
              maxWidth: '650px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.65rem' }}>
              <div>
                <h3 style={{ margin: 0, color: '#1e293b', fontSize: '1.15rem', fontWeight: 800 }}>
                  📑 Chi Tiết Bảng Kê Thu Phí — {detailModalInvoice.invoiceCode}
                </h3>
                <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Kỳ thu phí: {detailModalInvoice.billingMonth}</div>
              </div>
              <button
                type="button"
                className="btn btn-neutral"
                onClick={() => setDetailModalInvoice(null)}
                style={{ padding: '0.2rem 0.6rem', fontSize: '1.1rem', lineHeight: 1 }}
              >
                ✕
              </button>
            </div>

            {/* Resident Header */}
            <div style={{ background: '#f8fafc', padding: '0.75rem 0.85rem', borderRadius: '0.5rem', marginBottom: '0.85rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #e2e8f0' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.98rem', color: '#0f172a' }}>{detailModalInvoice.residentName}</div>
                <div style={{ fontSize: '0.82rem', color: '#64748b' }}>
                  Phòng: {detailModalInvoice.room} ({detailModalInvoice.bed}) • Gói: {detailModalInvoice.basicPackageName}
                </div>
              </div>
              <span className={`badge ${STATUS_CONFIG[detailModalInvoice.status].badgeClass}`}>
                {STATUS_CONFIG[detailModalInvoice.status].label}
              </span>
            </div>

            {/* Audit Status Info Box */}
            <div style={{ background: detailModalInvoice.auditStatus === 'MANAGER_REPORTED' ? '#fef2f2' : detailModalInvoice.auditStatus === 'DIRECTOR_APPROVED' ? '#f0fdf4' : '#fffbeb', border: `1px solid ${detailModalInvoice.auditStatus === 'MANAGER_REPORTED' ? '#fca5a5' : detailModalInvoice.auditStatus === 'DIRECTOR_APPROVED' ? '#bbf7d0' : '#fde68a'}`, padding: '0.75rem 0.85rem', borderRadius: '0.5rem', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div style={{ fontWeight: 700, fontSize: '0.88rem', color: detailModalInvoice.auditStatus === 'MANAGER_REPORTED' ? '#991b1b' : detailModalInvoice.auditStatus === 'DIRECTOR_APPROVED' ? '#166534' : '#92400e' }}>
                  Trạng thái kiểm duyệt: {AUDIT_STATUS_CONFIG[detailModalInvoice.auditStatus || 'PENDING_MANAGER']?.icon} {AUDIT_STATUS_CONFIG[detailModalInvoice.auditStatus || 'PENDING_MANAGER']?.label}
                </div>
                {detailModalInvoice.publishedToFamilyAt && (
                  <span className="badge badge-success" style={{ fontSize: '0.75rem' }}>
                    🌐 Đã phát hành Cổng Thân nhân ({new Date(detailModalInvoice.publishedToFamilyAt).toLocaleDateString('vi-VN')})
                  </span>
                )}
              </div>
              {detailModalInvoice.reviewedByManagerName && (
                <div style={{ fontSize: '0.8rem', color: '#475569', marginTop: '0.3rem' }}>
                  <b>Nhân viên Quản lý thẩm định:</b> {detailModalInvoice.reviewedByManagerName} {detailModalInvoice.reviewedByManagerAt && `(${new Date(detailModalInvoice.reviewedByManagerAt).toLocaleDateString('vi-VN')})`}
                  {detailModalInvoice.managerNotes && <span> — Ghi chú: {detailModalInvoice.managerNotes}</span>}
                </div>
              )}
              {detailModalInvoice.reportedErrorReason && (
                <div style={{ fontSize: '0.82rem', color: '#dc2626', fontWeight: 600, marginTop: '0.35rem', background: '#fee2e2', padding: '0.4rem 0.65rem', borderRadius: '0.35rem' }}>
                  ⚠️ <b>Nội dung sai sót báo cáo BGĐ:</b> {detailModalInvoice.reportedErrorReason}
                </div>
              )}
              {detailModalInvoice.approvedByDirectorName && (
                <div style={{ fontSize: '0.8rem', color: '#166534', marginTop: '0.3rem', fontWeight: 600 }}>
                  <b>Thành viên BGĐ phê duyệt:</b> {detailModalInvoice.approvedByDirectorName} {detailModalInvoice.approvedByDirectorAt && `(${new Date(detailModalInvoice.approvedByDirectorAt).toLocaleDateString('vi-VN')})`}
                  {detailModalInvoice.directorEditNotes && <span> — Ghi chú hiệu chỉnh: {detailModalInvoice.directorEditNotes}</span>}
                </div>
              )}
            </div>

            {/* Breakdown Sections */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', fontSize: '0.88rem' }}>
              {/* I. Phí Cơ Bản */}
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.4rem', borderBottom: '1px solid #f1f5f9' }}>
                <span style={{ fontWeight: 600 }}>🏨 I. Phí chăm sóc cơ bản (Gói phòng):</span>
                <span style={{ fontWeight: 700 }}>{formatVndText(detailModalInvoice.basicPackageFee)}</span>
              </div>

              {/* II. Tiền Đặt Cọc */}
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.4rem', borderBottom: '1px solid #f1f5f9', background: '#f0fdf4', padding: '0.4rem 0.6rem', borderRadius: '0.35rem' }}>
                <span style={{ fontWeight: 600, color: '#0f766e' }}>💳 II. Tiền đặt cọc (Ký quỹ hoàn trả):</span>
                <span style={{ fontWeight: 700, color: '#0f766e' }}>{formatVndText(detailModalInvoice.depositFee || 20000000)}</span>
              </div>

              {/* III. Phí Hỗ Trợ */}
              {detailModalInvoice.supportServicesFee > 0 && (
                <div style={{ background: '#f0f9ff', padding: '0.6rem', borderRadius: '0.35rem', border: '1px solid #e0f2fe' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, color: '#0369a1' }}>
                    <span>🩺 III. Phí dịch vụ chăm sóc hỗ trợ:</span>
                    <span>+{formatVndText(detailModalInvoice.supportServicesFee)}</span>
                  </div>
                  {detailModalInvoice.supportServiceItems?.map((item, idx) => (
                    <div key={idx} style={{ fontSize: '0.8rem', color: '#475569', marginLeft: '0.75rem', marginTop: '0.2rem' }}>
                      • {item.serviceName}: {formatVndText(item.totalPrice)}
                    </div>
                  ))}
                </div>
              )}

              {/* III. Giảm Trừ Vắng Mặt */}
              {detailModalInvoice.leaveDeductionFee > 0 && (
                <div style={{ background: '#fef2f2', padding: '0.6rem', borderRadius: '0.35rem', border: '1px solid #fee2e2' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, color: '#b91c1c' }}>
                    <span>📉 III. Giảm trừ ngày vắng mặt ({detailModalInvoice.leaveDays} ngày):</span>
                    <span>-{formatVndText(detailModalInvoice.leaveDeductionFee)}</span>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#7f1d1d', marginLeft: '0.75rem', marginTop: '0.2rem' }}>
                    {detailModalInvoice.forceMajeureLeaveDays > 0 && `• Bất khả kháng (viện/pháp luật): ${detailModalInvoice.forceMajeureLeaveDays} ngày * 200k = ${formatVndText(detailModalInvoice.forceMajeureLeaveDays * 200000)}`}
                    {detailModalInvoice.regularLeaveDays > 0 && ` • Về thăm nhà: ${detailModalInvoice.regularLeaveDays} ngày * 100k = ${formatVndText(detailModalInvoice.regularLeaveDays * 100000)}`}
                  </div>
                </div>
              )}

              {/* IV. Giảm Giá & Ưu Đãi Đặc Biệt */}
              {detailModalInvoice.discountsApplied?.length > 0 && (
                <div style={{ background: '#eff6ff', padding: '0.6rem', borderRadius: '0.35rem', border: '1px solid #dbeafe' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: '#1e40af' }}>
                    <span>🎁 IV. Các khoản giảm giá & Ưu đãi đã phê duyệt:</span>
                    <span>-{formatVndText(detailModalInvoice.totalDiscountAmount)}</span>
                  </div>
                  {detailModalInvoice.discountsApplied.map((d) => (
                    <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#1e3a8a', marginLeft: '0.75rem', marginTop: '0.3rem', alignItems: 'center' }}>
                      <div>
                        • <b>{d.name}</b> ({d.discountType === 'PERCENT' ? `${d.discountValue}%` : formatVndText(d.discountValue)}) — {d.reasonNotes}
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Duyệt bởi: {d.approvedBy} ({d.approvedRole})</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontWeight: 700 }}>-{formatVndText(d.amountDeducted)}</span>
                        {canConfigurePricing && detailModalInvoice.status !== 'SETTLED' && (
                          <button
                            type="button"
                            className="btn btn-neutral"
                            style={{ padding: '0.1rem 0.4rem', fontSize: '0.75rem', color: '#dc2626' }}
                            onClick={() => removeDiscountMutation.mutate({ invoiceId: detailModalInvoice.invoiceId, discountId: d.id })}
                            title="Xóa mức giảm giá này"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* V. Phụ Thu Lễ Tết */}
              {detailModalInvoice.holidaySurchargeFee > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.4rem', borderBottom: '1px solid #f1f5f9', color: '#b45309' }}>
                  <span>🏮 V. Phụ thu ngày Lễ Tết ({detailModalInvoice.holidayDays || 1} ngày - {detailModalInvoice.contractType === 'SHORT_TERM' ? '300.000đ/ngày ngắn hạn' : '200.000đ/ngày dài hạn'}):</span>
                  <span>+{formatVndText(detailModalInvoice.holidaySurchargeFee)}</span>
                </div>
              )}

              {/* VI. Suất Ăn & Vật Tư */}
              {detailModalInvoice.extraMealsFee > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.4rem', borderBottom: '1px solid #f1f5f9' }}>
                  <span>🍲 Suất ăn thân nhân đăng ký:</span>
                  <span>+{formatVndText(detailModalInvoice.extraMealsFee)}</span>
                </div>
              )}

              {detailModalInvoice.consumablesFee > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.4rem', borderBottom: '1px solid #f1f5f9' }}>
                  <span>🩹 Vật tư y tế tiêu hao:</span>
                  <span>+{formatVndText(detailModalInvoice.consumablesFee)}</span>
                </div>
              )}

              {/* TOTALS */}
              <div style={{ background: '#f8fafc', padding: '0.75rem 0.85rem', borderRadius: '0.5rem', marginTop: '0.35rem', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>
                  <span>TỔNG TIỀN THỰC THU:</span>
                  <span style={{ color: '#15803d' }}>{formatVndText(detailModalInvoice.totalAmount)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#16a34a', marginTop: '0.25rem' }}>
                  <span>Đã thanh toán:</span>
                  <b>{formatVndText(detailModalInvoice.paidAmount)}</b>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', color: detailModalInvoice.remainingAmount > 0 ? '#dc2626' : '#64748b', fontWeight: 700, marginTop: '0.2rem' }}>
                  <span>Còn nợ chưa thu:</span>
                  <b>{formatVndText(detailModalInvoice.remainingAmount)}</b>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.25rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-neutral"
                style={{ fontWeight: 600, background: '#f1f5f9', color: '#0f172a', borderColor: '#cbd5e1' }}
                onClick={() => {
                  const inv = detailModalInvoice;
                  setDetailModalInvoice(null);
                  setPrintModalNotice({
                    id: inv.invoiceCode,
                    residentId: inv.residentId,
                    residentName: inv.residentName,
                    residentCode: inv.residentId,
                    contractCode: `HD-${inv.residentId}`,
                    billingMonth: inv.billingMonth,
                    sponsorName: 'Thân nhân Cụ ' + inv.residentName,
                    sponsorPhone: '0988xxxxxx',
                    basicFee: inv.basicPackageFee,
                    supportFee: inv.supportServicesFee,
                    bathingLaundryFee: 0,
                    mobilityFee: 0,
                    hygieneFee: 0,
                    feedingSondeFee: 0,
                    dementiaCareFee: 0,
                    soreCareFee: 0,
                    catheterCareFee: 0,
                    tracheostomyCareFee: 0,
                    woundDressingFee: 0,
                    rehabFee: 0,
                    incurredFee: inv.holidaySurchargeFee,
                    incurredContent: inv.holidaySurchargeFee > 0 ? `Phụ thu Lễ Tết (${inv.holidayDays || 1} ngày)` : undefined,
                    deductionFee: inv.leaveDeductionFee + inv.totalDiscountAmount,
                    previousMonthDebt: inv.previousMonthDebt || 0,
                    debtNotes: inv.previousMonthDebt ? 'Nợ tháng trước tự động cập nhật' : undefined,
                    depositStatus: inv.depositStatus || 'PAID',
                    unpaidDepositDebt: inv.depositStatus === 'UNPAID' ? (inv.unpaidDepositDebt || 20000000) : 0,
                    familyMealsFee: inv.extraMealsFee || 0,
                    consumablesFee: inv.consumablesFee || 0,
                    totalDue: inv.totalAmount,
                    paidAmount: inv.paidAmount,
                    remainingAmount: inv.remainingAmount,
                    status: inv.status === 'PAID' ? 'PAID' : inv.status === 'PARTIAL' ? 'PARTIAL' : 'UNPAID',
                    statusLabel: inv.status === 'PAID' ? 'Đã thu' : inv.status === 'PARTIAL' ? 'Thu một phần' : 'Chưa thu',
                    isApproved: inv.auditStatus === 'DIRECTOR_APPROVED' || inv.auditStatus === 'MANAGER_APPROVED',
                    isPublishedToFamilyPortal: inv.auditStatus === 'DIRECTOR_APPROVED',
                    approvedBy: inv.approvedByDirectorName || inv.reviewedByManagerName || 'Bộ phận Kế toán',
                  });
                }}
              >
                🖨️ In Thông Báo A4
              </button>
              {/* Quản lý Thẩm định */}
              {canConfigurePricing && detailModalInvoice.auditStatus !== 'DIRECTOR_APPROVED' && (
                <button
                  type="button"
                  className="btn btn-neutral"
                  style={{ fontWeight: 600, color: '#0369a1', borderColor: '#bae6fd' }}
                  onClick={() => {
                    setManagerReviewInvoice(detailModalInvoice);
                    setManagerReviewNotes(detailModalInvoice.reportedErrorReason || detailModalInvoice.managerNotes || '');
                  }}
                >
                  🔍 Thẩm Định (Quản Lý)
                </button>
              )}

              {/* BGĐ Hiệu chỉnh */}
              {actor?.actorRole === 'SUPERVISOR' && detailModalInvoice.auditStatus !== 'DIRECTOR_APPROVED' && (
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ fontWeight: 600 }}
                  onClick={() => {
                    setDirectorEditInvoice(detailModalInvoice);
                    setDirectorForm({
                      basicPackageFee: detailModalInvoice.basicPackageFee,
                      supportServicesFee: detailModalInvoice.supportServicesFee,
                      extendedCareFee: detailModalInvoice.extendedCareFee,
                      extendedCareDays: detailModalInvoice.extendedCareDays || 0,
                      regularLeaveDays: detailModalInvoice.regularLeaveDays || 0,
                      forceMajeureLeaveDays: detailModalInvoice.forceMajeureLeaveDays || 0,
                      holidayDays: detailModalInvoice.holidayDays || 0,
                      holidaySurchargeFee: detailModalInvoice.holidaySurchargeFee || 0,
                      extraMealsFee: detailModalInvoice.extraMealsFee || 0,
                      consumablesFee: detailModalInvoice.consumablesFee || 0,
                      directorEditNotes: detailModalInvoice.directorEditNotes || '',
                    });
                  }}
                >
                  ✏️ Hiệu Chỉnh BGĐ
                </button>
              )}

              {/* BGĐ Duyệt & Phát hành */}
              {actor?.actorRole === 'SUPERVISOR' && detailModalInvoice.auditStatus !== 'DIRECTOR_APPROVED' && (
                <button
                  type="button"
                  className="btn btn-success"
                  style={{ fontWeight: 700 }}
                  onClick={() => {
                    if (window.confirm(`Xác nhận Ban Giám đốc phê duyệt & phát hành Bảng kê ${detailModalInvoice.invoiceCode} tới Cổng Thân nhân?`)) {
                      publishByDirectorMutation.mutate(detailModalInvoice.invoiceId);
                    }
                  }}
                >
                  🚀 Duyệt & Phát Hành
                </button>
              )}

              {canConfigurePricing && detailModalInvoice.status !== 'SETTLED' && (
                <button
                  type="button"
                  className="btn btn-success"
                  onClick={() => {
                    setDiscountModalInvoice(detailModalInvoice);
                    handleSelectPolicy('CUSTOM');
                  }}
                  style={{ fontWeight: 600 }}
                >
                  🎁 Thêm Giảm Giá
                </button>
              )}
              <button
                type="button"
                className="btn btn-neutral"
                onClick={() => setDetailModalInvoice(null)}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: THU TIỀN THU PHÍ */}
      {/* ========================================================================= */}
      {paymentModalInvoice && (
        <div className="modal-overlay" onClick={() => setPaymentModalInvoice(null)}>
          <div
            className="modal-card"
            style={{
              background: '#ffffff',
              borderRadius: '0.75rem',
              padding: '1.5rem',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
              border: '1px solid #e2e8f0',
              maxWidth: '480px',
              width: '100%',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem' }}>
              <h3 style={{ margin: 0, color: '#1e293b', fontSize: '1.15rem' }}>
                💵 Lập Phiếu Thu Tiền
              </h3>
              <button
                type="button"
                className="btn btn-neutral"
                onClick={() => setPaymentModalInvoice(null)}
                style={{ padding: '0.2rem 0.6rem', fontSize: '1rem', lineHeight: 1 }}
              >
                ✕
              </button>
            </div>

            <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '0.5rem', marginBottom: '1rem', fontSize: '0.88rem' }}>
              <div>Cụ: <b>{paymentModalInvoice.residentName}</b> — Mã BK: <code>{paymentModalInvoice.invoiceCode}</code></div>
              <div>Còn nợ: <b style={{ color: '#dc2626' }}>{formatVndText(paymentModalInvoice.remainingAmount)}</b></div>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                recordPaymentMutation.mutate();
              }}
            >
              <label className="field-group" style={{ marginBottom: '1rem' }}>
                <span className="field-label">Số tiền thu (VNĐ) *</span>
                <input
                  type="number"
                  min="1"
                  max={paymentModalInvoice.remainingAmount}
                  className="text-input"
                  value={payAmount}
                  onChange={(e) => setPayAmount(Number(e.target.value))}
                  required
                />
              </label>

              <label className="field-group" style={{ marginBottom: '1rem' }}>
                <span className="field-label">Hình thức thu tiền *</span>
                <select
                  className="text-input"
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value as PaymentMethod)}
                >
                  <option value="BANK_TRANSFER">🏦 Chuyển khoản ngân hàng</option>
                  <option value="CASH">💵 Tiền mặt tại quầy</option>
                  <option value="DEPOSIT_DEDUCTION">📑 Trừ trực tiếp vào quỹ tiền đặt cọc</option>
                </select>
              </label>

              <label className="field-group" style={{ marginBottom: '1rem' }}>
                <span className="field-label">Mã giao dịch / Ghi chú đối soát</span>
                <input
                  type="text"
                  className="text-input"
                  placeholder="VD: VCB-19827361, hoặc Tên người chuyển..."
                  value={payRef}
                  onChange={(e) => setPayRef(e.target.value)}
                />
              </label>

              <label className="field-group" style={{ marginBottom: '1.25rem' }}>
                <span className="field-label">Ghi chú phiếu thu</span>
                <input
                  type="text"
                  className="text-input"
                  placeholder="Ghi chú thêm..."
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                />
              </label>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button
                  type="button"
                  className="btn btn-neutral"
                  onClick={() => setPaymentModalInvoice(null)}
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={recordPaymentMutation.isPending || payAmount <= 0}
                  style={{ fontWeight: 700 }}
                >
                  {recordPaymentMutation.isPending ? 'Đang lưu...' : 'Xác Nhận Thu Tiền'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: QUYẾT TOÁN KHÓA SỔ */}
      {/* ========================================================================= */}
      {settleModalInvoice && (
        <div className="modal-overlay" onClick={() => setSettleModalInvoice(null)}>
          <div
            className="modal-card"
            style={{
              background: '#ffffff',
              borderRadius: '0.75rem',
              padding: '1.5rem',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
              border: '1px solid #e2e8f0',
              maxWidth: '460px',
              width: '100%',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 1rem 0', color: '#1e293b' }}>
              🔒 Xác Nhận Khóa Sổ Thu Phí
            </h3>
            <p style={{ fontSize: '0.9rem', color: '#475569', lineHeight: '1.5' }}>
              Bạn đang quyết toán khóa sổ thu phí tháng {settleModalInvoice.billingMonth} cho cụ <b>{settleModalInvoice.residentName}</b>. Sau khi khóa sổ, bảng kê sẽ ở trạng thái đóng lưu trữ.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.25rem' }}>
              <button
                type="button"
                className="btn btn-neutral"
                onClick={() => setSettleModalInvoice(null)}
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={settleInvoiceMutation.isPending}
                onClick={() => settleInvoiceMutation.mutate()}
                style={{ fontWeight: 700 }}
              >
                {settleInvoiceMutation.isPending ? 'Đang khóa...' : 'Xác Nhận Khóa Sổ'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 5: NHẬP & CẬP NHẬT MỨC PHÍ THU THÁNG (KẾ TOÁN) */}
      {/* ========================================================================= */}
      {editFeeNotice && (
        <div className="modal-overlay" onClick={() => setEditFeeNotice(null)}>
          <div
            className="modal-card"
            style={{
              background: '#ffffff',
              borderRadius: '0.75rem',
              padding: '1.5rem',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
              border: '1px solid #e2e8f0',
              maxWidth: '840px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem' }}>
              <div>
                <h3 style={{ margin: 0, color: '#1e3a8a', fontSize: '1.2rem', fontWeight: 800 }}>
                  ✏️ Nhập & Cập Nhật Mức Phí Tháng {editFeeNotice.billingMonth}
                </h3>
                <div style={{ fontSize: '0.88rem', color: '#475569', marginTop: '0.2rem' }}>
                  Cụ <b>{editFeeNotice.residentName}</b> (Mã HĐ: {editFeeNotice.residentCode})
                </div>
              </div>
              <button
                type="button"
                className="btn btn-sm btn-neutral"
                onClick={() => setEditFeeNotice(null)}
              >
                ✕ Đóng
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                updateDetailedFeeNoticeMutation.mutate(feeNoticeForm);
              }}
              style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}
            >
              {/* Nhóm 1: Phí cơ bản & Hỗ trợ */}
              <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#166534', marginBottom: '0.75rem' }}>
                  1. Phí Cơ Bản & Phí Hỗ Trợ Chăm Sóc:
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
                  <label className="field-group">
                    <span className="field-label" style={{ fontWeight: 600 }}>Phí cơ bản [VNĐ]</span>
                    <input
                      type="number"
                      className="text-input"
                      value={feeNoticeForm.basicFee}
                      onChange={(e) => setFeeNoticeForm({ ...feeNoticeForm, basicFee: Number(e.target.value) || 0 })}
                    />
                  </label>
                  <label className="field-group">
                    <span className="field-label" style={{ fontWeight: 600 }}>Hỗ trợ tắm gội [VNĐ]</span>
                    <input
                      type="number"
                      className="text-input"
                      value={feeNoticeForm.bathingLaundryFee}
                      onChange={(e) => setFeeNoticeForm({ ...feeNoticeForm, bathingLaundryFee: Number(e.target.value) || 0 })}
                    />
                  </label>
                  <label className="field-group">
                    <span className="field-label" style={{ fontWeight: 600 }}>Hỗ trợ nâng đỡ, di chuyển [VNĐ]</span>
                    <input
                      type="number"
                      className="text-input"
                      value={feeNoticeForm.mobilityFee}
                      onChange={(e) => setFeeNoticeForm({ ...feeNoticeForm, mobilityFee: Number(e.target.value) || 0 })}
                    />
                  </label>
                  <label className="field-group">
                    <span className="field-label" style={{ fontWeight: 600 }}>Hỗ trợ vệ sinh [VNĐ]</span>
                    <input
                      type="number"
                      className="text-input"
                      value={feeNoticeForm.hygieneFee}
                      onChange={(e) => setFeeNoticeForm({ ...feeNoticeForm, hygieneFee: Number(e.target.value) || 0 })}
                    />
                  </label>
                  <label className="field-group">
                    <span className="field-label" style={{ fontWeight: 600 }}>Hỗ trợ xúc ăn / ăn sonde [VNĐ]</span>
                    <input
                      type="number"
                      className="text-input"
                      value={feeNoticeForm.feedingSondeFee}
                      onChange={(e) => setFeeNoticeForm({ ...feeNoticeForm, feedingSondeFee: Number(e.target.value) || 0 })}
                    />
                  </label>
                </div>
              </div>

              {/* Nhóm 2: Chăm sóc Y tế chuyên sâu */}
              <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#1e40af', marginBottom: '0.75rem' }}>
                  2. Phí Chăm Sóc Y Tế Chuyên Sâu:
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
                  <label className="field-group">
                    <span className="field-label" style={{ fontWeight: 600 }}>CS NCT lẫn tuổi già [VNĐ]</span>
                    <input
                      type="number"
                      className="text-input"
                      value={feeNoticeForm.dementiaCareFee}
                      onChange={(e) => setFeeNoticeForm({ ...feeNoticeForm, dementiaCareFee: Number(e.target.value) || 0 })}
                    />
                  </label>
                  <label className="field-group">
                    <span className="field-label" style={{ fontWeight: 600 }}>CS các ổ loét [VNĐ]</span>
                    <input
                      type="number"
                      className="text-input"
                      value={feeNoticeForm.soreCareFee}
                      onChange={(e) => setFeeNoticeForm({ ...feeNoticeForm, soreCareFee: Number(e.target.value) || 0 })}
                    />
                  </label>
                  <label className="field-group">
                    <span className="field-label" style={{ fontWeight: 600 }}>CS sonde bàng quang [VNĐ]</span>
                    <input
                      type="number"
                      className="text-input"
                      value={feeNoticeForm.catheterCareFee}
                      onChange={(e) => setFeeNoticeForm({ ...feeNoticeForm, catheterCareFee: Number(e.target.value) || 0 })}
                    />
                  </label>
                  <label className="field-group">
                    <span className="field-label" style={{ fontWeight: 600 }}>CS nội khí quản [VNĐ]</span>
                    <input
                      type="number"
                      className="text-input"
                      value={feeNoticeForm.tracheostomyCareFee}
                      onChange={(e) => setFeeNoticeForm({ ...feeNoticeForm, tracheostomyCareFee: Number(e.target.value) || 0 })}
                    />
                  </label>
                  <label className="field-group">
                    <span className="field-label" style={{ fontWeight: 600 }}>Thay băng, rửa vết thương [VNĐ]</span>
                    <input
                      type="number"
                      className="text-input"
                      value={feeNoticeForm.woundDressingFee}
                      onChange={(e) => setFeeNoticeForm({ ...feeNoticeForm, woundDressingFee: Number(e.target.value) || 0 })}
                    />
                  </label>
                  <label className="field-group">
                    <span className="field-label" style={{ fontWeight: 600 }}>VLTL - PHCN [VNĐ]</span>
                    <input
                      type="number"
                      className="text-input"
                      value={feeNoticeForm.rehabFee}
                      onChange={(e) => setFeeNoticeForm({ ...feeNoticeForm, rehabFee: Number(e.target.value) || 0 })}
                    />
                  </label>
                </div>
              </div>

              {/* Nhóm 3: Phát sinh, Giảm trừ & Dư nợ */}
              <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#991b1b', marginBottom: '0.75rem' }}>
                  3. Phát Sinh, Giảm Trừ & Nợ Tháng Trước:
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
                  <label className="field-group">
                    <span className="field-label" style={{ fontWeight: 600 }}>Phí phát sinh [VNĐ]</span>
                    <input
                      type="number"
                      className="text-input"
                      value={feeNoticeForm.incurredFee}
                      onChange={(e) => setFeeNoticeForm({ ...feeNoticeForm, incurredFee: Number(e.target.value) || 0 })}
                    />
                  </label>
                  <label className="field-group" style={{ gridColumn: 'span 2' }}>
                    <span className="field-label" style={{ fontWeight: 600 }}>Nội dung phát sinh (có thể nhập nhiều dòng phát sinh)</span>
                    <textarea
                      className="text-input"
                      rows={2}
                      placeholder="Mô tả nội dung phát sinh (xuống dòng nếu có nhiều khoản phát sinh, VD:&#10;• Phụ thu đi khám Bệnh viện&#10;• Tã bỉm & vật tư y tế bổ sung)"
                      value={feeNoticeForm.incurredContent || ''}
                      onChange={(e) => setFeeNoticeForm({ ...feeNoticeForm, incurredContent: e.target.value })}
                      style={{ resize: 'vertical', fontSize: '0.82rem' }}
                    />
                  </label>
                  <label className="field-group">
                    <span className="field-label" style={{ fontWeight: 600, color: '#dc2626' }}>Giảm trừ [VNĐ]</span>
                    <input
                      type="number"
                      className="text-input"
                      value={feeNoticeForm.deductionFee}
                      onChange={(e) => setFeeNoticeForm({ ...feeNoticeForm, deductionFee: Number(e.target.value) || 0 })}
                    />
                  </label>
                  <label className="field-group">
                    <span className="field-label" style={{ fontWeight: 600 }}>Nợ tháng trước [VNĐ]</span>
                    <input
                      type="number"
                      className="text-input"
                      value={feeNoticeForm.previousMonthDebt}
                      onChange={(e) => setFeeNoticeForm({ ...feeNoticeForm, previousMonthDebt: Number(e.target.value) || 0 })}
                    />
                  </label>
                  <label className="field-group" style={{ gridColumn: 'span 2' }}>
                    <span className="field-label" style={{ fontWeight: 600 }}>Ghi chú nợ</span>
                    <input
                      type="text"
                      className="text-input"
                      placeholder="Ghi chú về nợ cũ..."
                      value={feeNoticeForm.debtNotes || ''}
                      onChange={(e) => setFeeNoticeForm({ ...feeNoticeForm, debtNotes: e.target.value })}
                    />
                  </label>
                </div>
              </div>

              {/* Nhóm 4: Tiến trình thu tiền */}
              <div style={{ background: '#eff6ff', padding: '1rem', borderRadius: '0.5rem', border: '1px solid #bfdbfe' }}>
                <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#1e40af', marginBottom: '0.75rem' }}>
                  4. Số Tiền Thực Thu & Ghi Chú Đóng Phí:
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
                  <label className="field-group">
                    <span className="field-label" style={{ fontWeight: 700, color: '#1e40af' }}>Đã thu (Số tiền thực nhận) [VNĐ]</span>
                    <input
                      type="number"
                      className="text-input"
                      value={feeNoticeForm.paidAmount}
                      onChange={(e) => setFeeNoticeForm({ ...feeNoticeForm, paidAmount: Number(e.target.value) || 0 })}
                    />
                  </label>
                  <label className="field-group" style={{ gridColumn: 'span 2' }}>
                    <span className="field-label" style={{ fontWeight: 600 }}>Ghi chú xác thực / thu phí</span>
                    <input
                      type="text"
                      className="text-input"
                      placeholder="Ghi chú người nộp, phương thức..."
                      value={feeNoticeForm.notes || ''}
                      onChange={(e) => setFeeNoticeForm({ ...feeNoticeForm, notes: e.target.value })}
                    />
                  </label>
                </div>
              </div>

              {/* Hộp tính toán thời gian thực (Real-time auto sum) */}
              {(() => {
                const liveTotal =
                  feeNoticeForm.basicFee +
                  feeNoticeForm.bathingLaundryFee +
                  feeNoticeForm.mobilityFee +
                  feeNoticeForm.hygieneFee +
                  feeNoticeForm.feedingSondeFee +
                  feeNoticeForm.dementiaCareFee +
                  feeNoticeForm.soreCareFee +
                  feeNoticeForm.catheterCareFee +
                  feeNoticeForm.tracheostomyCareFee +
                  feeNoticeForm.woundDressingFee +
                  feeNoticeForm.rehabFee +
                  feeNoticeForm.incurredFee -
                  feeNoticeForm.deductionFee +
                  feeNoticeForm.previousMonthDebt +
                  (editFeeNotice.familyMealsFee || 0);

                const liveRemaining = Math.max(0, liveTotal - feeNoticeForm.paidAmount);
                const liveStatusLabel =
                  feeNoticeForm.paidAmount >= liveTotal && liveTotal > 0
                    ? 'Đã thu'
                    : feeNoticeForm.paidAmount > 0
                    ? 'Thu một phần'
                    : 'Chưa thu';

                return (
                  <div style={{ background: '#f0fdf4', border: '2px solid #a7f3d0', padding: '1rem 1.25rem', borderRadius: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                    <div>
                      <div style={{ fontSize: '0.9rem', color: '#166534', fontWeight: 600 }}>
                        💵 TỔNG PHẢI THU (sum tự động): <b style={{ fontSize: '1.25rem', color: '#15803d' }}>{liveTotal.toLocaleString('vi-VN')} đ</b>
                      </div>
                      <div style={{ fontSize: '0.85rem', color: '#475569', marginTop: '0.25rem' }}>
                        Đã thu: <b style={{ color: '#1e40af' }}>{feeNoticeForm.paidAmount.toLocaleString('vi-VN')} đ</b> | Còn phải thu (tự động): <b style={{ color: '#b91c1c' }}>{liveRemaining.toLocaleString('vi-VN')} đ</b>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <span className={`badge ${feeNoticeForm.paidAmount >= liveTotal && liveTotal > 0 ? 'badge-success' : feeNoticeForm.paidAmount > 0 ? 'badge-warning' : 'badge-danger'}`} style={{ fontSize: '0.88rem', fontWeight: 800, padding: '0.35rem 0.75rem' }}>
                        Tình trạng: {liveStatusLabel}
                      </span>
                    </div>
                  </div>
                );
              })()}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  className="btn btn-neutral"
                  onClick={() => setEditFeeNotice(null)}
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={updateDetailedFeeNoticeMutation.isPending}
                  style={{ fontWeight: 700, minWidth: '160px' }}
                >
                  {updateDetailedFeeNoticeMutation.isPending ? 'Đang lưu...' : '💾 Lưu & Cập Nhật Bảng Kê'}
                </button>
                <button
                  type="button"
                  className="btn btn-neutral"
                  onClick={() => {
                    if (editFeeNotice) {
                      const liveTotal =
                        feeNoticeForm.basicFee +
                        feeNoticeForm.bathingLaundryFee +
                        feeNoticeForm.mobilityFee +
                        feeNoticeForm.hygieneFee +
                        feeNoticeForm.feedingSondeFee +
                        feeNoticeForm.dementiaCareFee +
                        feeNoticeForm.soreCareFee +
                        feeNoticeForm.catheterCareFee +
                        feeNoticeForm.tracheostomyCareFee +
                        feeNoticeForm.woundDressingFee +
                        feeNoticeForm.rehabFee +
                        feeNoticeForm.incurredFee -
                        feeNoticeForm.deductionFee +
                        feeNoticeForm.previousMonthDebt +
                        (editFeeNotice.familyMealsFee || 0);
                      const liveRemaining = Math.max(0, liveTotal - feeNoticeForm.paidAmount);

                      const noticeToPrint = {
                        ...editFeeNotice,
                        ...feeNoticeForm,
                        totalDue: liveTotal,
                        remainingAmount: liveRemaining,
                        status:
                          feeNoticeForm.paidAmount >= liveTotal && liveTotal > 0
                            ? 'PAID'
                            : feeNoticeForm.paidAmount > 0
                            ? 'PARTIAL'
                            : 'UNPAID',
                      };
                      setEditFeeNotice(null);
                      setPrintModalNotice(noticeToPrint as DetailedMonthlyFeeNotice);
                    }
                  }}
                >
                  🖨️ In Bản Giấy
                </button>
                <button
                  type="button"
                  className="btn btn-success"
                  style={{ background: '#166534', color: '#ffffff', fontWeight: 700 }}
                  disabled={updateDetailedFeeNoticeMutation.isPending || publishFeeNoticeMutation.isPending}
                  onClick={async () => {
                    await updateDetailedFeeNoticeMutation.mutateAsync(feeNoticeForm);
                    if (editFeeNotice) {
                      const updatedNotice = { ...editFeeNotice, ...feeNoticeForm };
                      setPublishConfirmNotice(updatedNotice);
                    }
                  }}
                >
                  🚀 Lưu & Duyệt Gửi Cổng Thân Nhân
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 6: POP-UP HỎI XÁC NHẬN DUYỆT & PHÁT HÀNH SANG CỔNG THÂN NHÂN */}
      {/* ========================================================================= */}
      {publishConfirmNotice && (
        <div className="modal-overlay" onClick={() => setPublishConfirmNotice(null)}>
          <div
            className="modal-card"
            style={{
              background: '#ffffff',
              borderRadius: '0.75rem',
              padding: '1.75rem',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
              border: '2px solid #166534',
              maxWidth: '540px',
              width: '100%',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: '2.5rem', textAlign: 'center', marginBottom: '0.5rem' }}>🚀</div>
            <h3 style={{ margin: '0 0 0.5rem 0', color: '#166534', textAlign: 'center', fontSize: '1.25rem', fontWeight: 800 }}>
              Xác Nhận Duyệt & Phát Hành Thông Báo Thu Phí
            </h3>
            <p style={{ fontSize: '0.9rem', color: '#334155', lineHeight: '1.6', textAlign: 'center', margin: '0 0 1.25rem 0' }}>
              Bạn có chắc chắn muốn duyệt và phát hành Thông báo thu phí tháng <b>{publishConfirmNotice.billingMonth}</b> cho cụ <b>{publishConfirmNotice.residentName}</b> (Mã HĐ: {publishConfirmNotice.residentCode}) sang <b>Cổng Thân Nhân</b> không?
            </p>

            <div style={{ background: '#f0fdf4', padding: '0.85rem 1rem', borderRadius: '0.5rem', border: '1px solid #bbf7d0', marginBottom: '1.25rem', fontSize: '0.85rem' }}>
              <div><b>TỔNG PHẢI THU:</b> <span style={{ color: '#15803d', fontWeight: 800, fontSize: '1.05rem' }}>{publishConfirmNotice.totalDue.toLocaleString('vi-VN')} VNĐ</span></div>
              <div style={{ marginTop: '0.2rem', color: '#475569' }}>
                Đã thu: <b>{publishConfirmNotice.paidAmount.toLocaleString('vi-VN')} đ</b> | Còn phải thu: <b>{publishConfirmNotice.remainingAmount.toLocaleString('vi-VN')} đ</b>
              </div>
              <div style={{ fontSize: '0.78rem', color: '#15803d', fontStyle: 'italic', marginTop: '0.4rem' }}>
                ⚠️ Thông tin sau khi phát hành sẽ hiển thị công khai cho người nhà tra cứu tại Cổng Thân Nhân.
              </div>
            </div>

            <label className="field-group" style={{ marginBottom: '1.25rem' }}>
              <span className="field-label" style={{ fontWeight: 600 }}>Ghi chú kiểm duyệt (không bắt buộc)</span>
              <input
                type="text"
                className="text-input"
                placeholder="VD: Đã kiểm tra đối soát 100% dịch vụ & chỉ định..."
                value={publishNotesInput}
                onChange={(e) => setPublishNotesInput(e.target.value)}
              />
            </label>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                type="button"
                className="btn btn-neutral"
                onClick={() => setPublishConfirmNotice(null)}
              >
                Hủy Bỏ
              </button>
              <button
                type="button"
                className="btn btn-success"
                disabled={publishFeeNoticeMutation.isPending}
                onClick={() => {
                  publishFeeNoticeMutation.mutate({
                    noticeId: publishConfirmNotice.id,
                    notes: publishNotesInput || undefined,
                  });
                }}
                style={{ fontWeight: 800, background: '#166534', color: '#ffffff', minWidth: '180px' }}
              >
                {publishFeeNoticeMutation.isPending ? 'Đang duyệt...' : '✅ Chắc Chắn Duyệt & Gửi'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 7: TRANG XEM TRƯỚC & IN THÔNG BÁO THU PHÍ GIẤY A4 (PRINT PREVIEW) */}
      {/* ========================================================================= */}
      {printModalNotice && (
        <div className="modal-overlay print-modal-overlay" onClick={() => setPrintModalNotice(null)} style={{ overflowY: 'auto', padding: '2rem 1rem' }}>
          <style>{`
            @media print {
              @page {
                size: A4 portrait;
                margin: 5mm 8mm 5mm 8mm;
              }

              /* 1. Reset all layout wrappers to normal static block flow */
              html, body, #root, .app-shell, .main-shell, .page-content, .page-container {
                display: block !important;
                visibility: visible !important;
                position: static !important;
                overflow: visible !important;
                background: #ffffff !important;
                margin: 0 !important;
                padding: 0 !important;
                border: none !important;
                box-shadow: none !important;
                width: 100% !important;
                height: auto !important;
              }

              /* 2. Hide all non-printable UI elements and non-print modal overlays */
              .app-shell > aside,
              .sidebar,
              .navigation,
              .topbar,
              .page-header,
              .alert-card,
              .kpi-row,
              .kpi-box,
              .filter-toolbar,
              .table-responsive,
              .data-table,
              .data-table-card,
              .tab-nav,
              .no-print,
              .modal-overlay:not(.print-modal-overlay),
              .modal-backdrop:not(.print-modal-overlay),
              button {
                display: none !important;
              }

              /* 3. Printable A4 sheet styling */

              /* 4. Flatten print modal container to print flat on page */
              .print-modal-overlay,
              .modal-overlay.print-modal-overlay,
              .modal-backdrop.print-modal-overlay,
              .print-modal-overlay .modal-dialog,
              .print-modal-overlay .modal-dialog-lg,
              .print-modal-overlay .modal-card {
                position: static !important;
                display: block !important;
                visibility: visible !important;
                background: #ffffff !important;
                padding: 0 !important;
                margin: 0 !important;
                width: 100% !important;
                max-width: 100% !important;
                height: auto !important;
                max-height: none !important;
                overflow: visible !important;
                box-shadow: none !important;
                border: none !important;
              }

              /* 5. Printable A4 sheet styling */
              #printable-fee-notice-area,
              .printable-a4-sheet {
                display: block !important;
                visibility: visible !important;
                position: static !important;
                width: 100% !important;
                margin: 0 !important;
                padding: 0 !important;
                background: #ffffff !important;
                color: #000000 !important;
                font-size: 8.2pt !important;
                line-height: 1.25 !important;
                page-break-inside: avoid !important;
                break-inside: avoid !important;
              }

              #printable-fee-notice-area *,
              .printable-a4-sheet * {
                visibility: visible !important;
              }

              #printable-fee-notice-area h2 {
                font-size: 11.5pt !important;
                margin-bottom: 2px !important;
              }

              #printable-fee-notice-area table {
                font-size: 7.8pt !important;
              }

              #printable-fee-notice-area th,
              #printable-fee-notice-area td {
                padding: 2px 4px !important;
              }
            }
          `}</style>
          <div
            className="modal-card"
            style={{
              background: '#ffffff',
              borderRadius: '0.75rem',
              padding: '0',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
              maxWidth: '850px',
              width: '100%',
              margin: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Non-Printable Header */}
            <div className="no-print" style={{ padding: '0.85rem 1.25rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', borderTopLeftRadius: '0.75rem', borderTopRightRadius: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.2rem' }}>🖨️</span>
                <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#0f172a', fontWeight: 700 }}>
                  Xem Trước Bản In A4 - Thông Báo Thu Phí Tháng {printModalNotice.billingMonth}
                </h3>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                  type="button"
                  className="btn btn-neutral"
                  onClick={() => setPrintModalNotice(null)}
                  style={{ fontSize: '0.85rem' }}
                >
                  Đóng Window
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => window.print()}
                  style={{ fontWeight: 700, padding: '0.45rem 1.15rem', display: 'flex', alignItems: 'center', gap: '0.4rem', background: '#166534', borderColor: '#15803d' }}
                >
                  🖨️ In Bản Giấy A4 (Print)
                </button>
              </div>
            </div>

            {/* Printable A4 Content Box */}
            <div
              id="printable-fee-notice-area"
              className="printable-a4-sheet"
              style={{
                padding: '1.25rem 1.75rem',
                color: '#0f172a',
                fontFamily: 'Arial, "Helvetica Neue", Helvetica, sans-serif',
                lineHeight: 1.35,
                background: '#ffffff',
              }}
            >
              {/* Header: Logo, Center Name, Address & Hotline */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #166534', paddingBottom: '0.5rem', marginBottom: '0.65rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                  <img
                    src="/branding/tam-an-logo-master.png"
                    alt="Logo Trung tâm dưỡng lão Tâm An"
                    style={{ height: '65px', width: 'auto', objectFit: 'contain' }}
                  />
                  <div>
                    <div style={{ fontSize: '1.15rem', fontWeight: 900, color: '#166534', letterSpacing: '-0.01em', textTransform: 'uppercase' }}>
                      TRUNG TÂM DƯỠNG LÃO TÂM AN
                    </div>
                    <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#047857', fontStyle: 'italic', marginTop: '0.02rem' }}>
                      "Nơi Tuổi Già An Nhiên"
                    </div>
                    <div style={{ fontSize: '0.74rem', color: '#334155', marginTop: '0.15rem', lineHeight: '1.3' }}>
                      Địa chỉ: Khu phố Đông 8, Ocean Park 2, Nghĩa Trụ, Hưng Yên<br />
                      Hotline: <b style={{ color: '#166534' }}>0824 155 155</b>
                    </div>
                  </div>
                </div>

                <div style={{ textAlign: 'right', paddingRight: '0.75rem', flexShrink: 0 }}>
                  <div style={{ fontSize: '0.76rem', color: '#475569', whiteSpace: 'nowrap' }}>
                    Mẫu số: <b style={{ color: '#0f172a' }}>01/TBTP-TA</b>
                  </div>
                  <div style={{ fontSize: '0.76rem', color: '#475569', marginTop: '0.1rem', whiteSpace: 'nowrap' }}>
                    Ngày in: <b>{new Date().toLocaleDateString('vi-VN')}</b>
                  </div>
                  <div style={{ marginTop: '0.25rem' }}>
                    <span style={{
                      display: 'inline-block',
                      padding: '0.12rem 0.45rem',
                      borderRadius: '0.2rem',
                      fontSize: '0.7rem',
                      fontWeight: 800,
                      background: printModalNotice.isPublishedToFamilyPortal ? '#dcfce7' : '#fef3c7',
                      color: printModalNotice.isPublishedToFamilyPortal ? '#15803d' : '#b45309',
                      border: `1px solid ${printModalNotice.isPublishedToFamilyPortal ? '#86efac' : '#fde68a'}`,
                    }}>
                      {printModalNotice.isPublishedToFamilyPortal ? '✅ ĐÃ KIỂM DUYỆT' : '⏳ BẢN DỰ THẢO'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Title Section & Month Formatting */}
              {(() => {
                const monthRaw = printModalNotice.billingMonth || '09/2026';
                const parts = monthRaw.split(/[\/-]/);
                let mNum = '9';
                let yNum = '2026';
                if (parts.length === 2) {
                  if (parts[0].length === 4) {
                    yNum = parts[0];
                    mNum = parseInt(parts[1], 10).toString();
                  } else {
                    mNum = parseInt(parts[0], 10).toString();
                    yNum = parts[1];
                  }
                }
                const formattedMonthDisplay = `${mNum}/${yNum}`;

                const isFemale =
                  printModalNotice.gender === 'FEMALE' ||
                  printModalNotice.gender === 'Nữ' ||
                  printModalNotice.residentName.includes('Thị') ||
                  printModalNotice.residentName.includes('Bình');
                const salutation = isFemale ? 'bà' : 'ông';
                const cleanResidentName = printModalNotice.residentName
                  .replace(/^(Cụ ông|Cụ bà|Cụ|Ông|Bà)\s+/i, '')
                  .trim();

                // Filter only non-zero credit/fee items for printable table
                const rawItems = [
                  { name: 'Phí chăm sóc cơ bản (Gói phòng & ăn uống 3 bữa)', amount: printModalNotice.basicFee, note: '' },
                  { name: 'Hỗ trợ tắm gội', amount: printModalNotice.bathingLaundryFee, note: '' },
                  { name: 'Hỗ trợ nâng đỡ, di chuyển', amount: printModalNotice.mobilityFee, note: '' },
                  { name: 'Hỗ trợ vệ sinh cá nhân', amount: printModalNotice.hygieneFee, note: '' },
                  { name: 'Hỗ trợ xúc ăn & ăn qua sonde', amount: printModalNotice.feedingSondeFee, note: '' },
                  { name: 'Chăm sóc NCT bị lẫn tuổi già', amount: printModalNotice.dementiaCareFee, note: '' },
                  { name: 'Chăm sóc các ổ loét', amount: printModalNotice.soreCareFee, note: '' },
                  { name: 'Chăm sóc người đặt sonde bàng quang', amount: printModalNotice.catheterCareFee, note: '' },
                  { name: 'Chăm sóc người đặt nội khí quản', amount: printModalNotice.tracheostomyCareFee, note: '' },
                  { name: 'Thay băng, rửa vết thương', amount: printModalNotice.woundDressingFee, note: '' },
                  { name: 'Vật lý trị liệu - PHCN', amount: printModalNotice.rehabFee, note: '' },
                  { name: 'Suất ăn thân nhân đăng ký', amount: printModalNotice.familyMealsFee || 0, note: '' },
                  { name: 'Vật tư y tế tiêu hao', amount: printModalNotice.consumablesFee || 0, note: '' },
                  { name: 'Phí phát sinh', amount: printModalNotice.incurredFee, note: printModalNotice.incurredContent || '' },
                  { name: 'Chi phí giảm trừ / Khuyến mãi / Giảm trừ vắng mặt', amount: printModalNotice.deductionFee ? -printModalNotice.deductionFee : 0, note: '' },
                  { name: 'Nợ tháng trước chuyển sang', amount: printModalNotice.previousMonthDebt, note: printModalNotice.debtNotes || '' },
                  { name: 'Nợ tiền đặt cọc tiếp nhận lưu trú (ký quỹ)', amount: printModalNotice.unpaidDepositDebt || 0, note: 'Nợ cọc 1 lần khi nhập viện' },
                ];
                const activePrintItems = rawItems.filter(item => item.amount !== 0);

                return (
                  <>
                    {/* Centered Document Title */}
                    <div style={{ textAlign: 'center', marginBottom: '0.55rem' }}>
                      <h2 style={{ fontSize: '1.2rem', fontWeight: 900, color: '#0f172a', margin: '0 0 0.15rem 0', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                        THÔNG BÁO CHI PHÍ CHĂM SÓC & SINH HOẠT
                      </h2>
                      <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#166534' }}>
                        KỲ THU PHÍ: THÁNG {formattedMonthDisplay}
                      </div>
                    </div>

                    {/* Resident Profile Card */}
                    <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '0.35rem', padding: '0.5rem 0.85rem', marginBottom: '0.5rem', fontSize: '0.82rem' }}>
                      <div style={{ marginBottom: '0.25rem', fontSize: '0.85rem' }}>
                        <span style={{ color: '#64748b' }}>Kính gửi:</span>{' '}
                        <b>Quý gia đình / Người đại diện của {salutation}: {cleanResidentName}</b>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <div>
                          <span style={{ color: '#64748b' }}>Hợp đồng số:</span>{' '}
                          <b style={{ color: '#166534', fontFamily: 'monospace', fontSize: '0.88rem' }}>{printModalNotice.contractCode || printModalNotice.residentCode}</b>
                        </div>
                        <div>
                          <span style={{ color: '#64748b' }}>Mã cư dân:</span>{' '}
                          <b>{printModalNotice.residentCode}</b>
                        </div>
                      </div>
                    </div>

                    {/* Intro Sentence */}
                    <div style={{ fontSize: '0.78rem', color: '#334155', fontStyle: 'italic', marginBottom: '0.5rem' }}>
                      Chúng tôi xin thông báo chi tiết các khoản chi phí chăm sóc và sinh hoạt của {salutation} <b>{cleanResidentName}</b> trong tháng {mNum} như sau:
                    </div>

                    {/* Non-Zero Printable Items Table */}
                    <div style={{ marginBottom: '0.65rem' }}>
                      <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                        1. Chi tiết các khoản phí (Ghi có)
                      </div>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                        <thead>
                          <tr style={{ background: '#0f172a', color: '#ffffff' }}>
                            <th style={{ padding: '0.35rem 0.45rem', textAlign: 'center', width: '38px', fontWeight: 700, border: '1px solid #334155' }}>STT</th>
                            <th style={{ padding: '0.35rem 0.45rem', textAlign: 'left', fontWeight: 700, border: '1px solid #334155' }}>Nội dung</th>
                            <th style={{ padding: '0.35rem 0.45rem', textAlign: 'right', width: '135px', fontWeight: 700, border: '1px solid #334155' }}>Số tiền (VNĐ)</th>
                            <th style={{ padding: '0.35rem 0.45rem', textAlign: 'left', width: '170px', fontWeight: 700, border: '1px solid #334155' }}>Ghi chú</th>
                          </tr>
                        </thead>
                        <tbody>
                          {activePrintItems.map((item, idx) => (
                            <tr key={idx} style={{ borderBottom: '1px solid #cbd5e1', background: idx % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                              <td style={{ padding: '0.28rem 0.45rem', textAlign: 'center', color: '#64748b', borderRight: '1px solid #cbd5e1' }}>{idx + 1}</td>
                              <td style={{ padding: '0.28rem 0.45rem', fontWeight: idx === 0 ? 700 : 500, borderRight: '1px solid #cbd5e1' }}>{item.name}</td>
                              <td style={{ padding: '0.28rem 0.45rem', textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums', borderRight: '1px solid #cbd5e1', color: item.amount < 0 ? '#b91c1c' : '#0f172a' }}>
                                {item.amount.toLocaleString('vi-VN')}
                              </td>
                              <td style={{ padding: '0.28rem 0.45rem', fontSize: '0.74rem', color: '#475569', fontStyle: 'italic' }}>{item.note || '---'}</td>
                            </tr>
                          ))}
                          <tr style={{ background: '#fef3c7', fontWeight: 800, borderTop: '2px solid #b45309', borderBottom: '2px solid #b45309' }}>
                            <td colSpan={4} style={{ padding: '0.45rem 0.55rem', textAlign: 'center', color: '#92400e', fontSize: '0.92rem' }}>
                              TỔNG CỘNG PHẢI THU: <span style={{ color: '#b45309', fontSize: '1.02rem', marginLeft: '0.4rem' }}>{printModalNotice.totalDue.toLocaleString('vi-VN')} VNĐ</span>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* Payment Instructions Box (Section 2) */}
                    <div style={{ border: '1px solid #cbd5e1', borderRadius: '0.35rem', padding: '0.5rem 0.85rem', marginBottom: '0.65rem', background: '#ffffff', fontSize: '0.78rem', lineHeight: '1.38' }}>
                      <div style={{ fontSize: '0.84rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.2rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.15rem' }}>
                        2. Hướng dẫn thanh toán
                      </div>

                      <div style={{ marginBottom: '0.2rem' }}>
                        <b>Thời hạn thanh toán:</b> {(() => {
                          const printDate = new Date();
                          const endDate = new Date(printDate.getTime() + 9 * 24 * 60 * 60 * 1000);
                          const startD = printDate.getDate().toString().padStart(2, '0');
                          const startM = (printDate.getMonth() + 1).toString().padStart(2, '0');
                          const startY = printDate.getFullYear();
                          const endD = endDate.getDate().toString().padStart(2, '0');
                          const endM = (endDate.getMonth() + 1).toString().padStart(2, '0');
                          const endY = endDate.getFullYear();

                          if (startM === endM && startY === endY) {
                            return `Từ ngày ${startD} đến hết ngày ${endD} tháng ${endM} năm ${endY}`;
                          }
                          return `Từ ngày ${startD}/${startM}/${startY} đến hết ngày ${endD} tháng ${endM} năm ${endY}`;
                        })()}
                      </div>

                      <div style={{ fontWeight: 700, marginTop: '0.15rem', marginBottom: '0.08rem' }}>
                        Hình thức thanh toán:
                      </div>

                      <div style={{ paddingLeft: '0.4rem', marginBottom: '0.2rem' }}>
                        <div style={{ marginBottom: '0.08rem' }}>
                          • <b>Cách 1:</b> Thanh toán bằng tiền mặt tại văn phòng của Trung tâm.
                        </div>
                        <div>
                          • <b>Cách 2:</b> Chuyển khoản ngân hàng:
                          <div style={{ paddingLeft: '1rem', marginTop: '0.08rem', display: 'flex', flexDirection: 'column', gap: '0.04rem' }}>
                            <div>- Tên tài khoản: <b>Công ty CP TMDV An Thịnh Phát Group</b></div>
                            <div>- Số tài khoản: <b style={{ fontSize: '0.84rem', color: '#166534' }}>111603721868</b></div>
                            <div>- Ngân hàng: <b>Ngân hàng VietinBank</b></div>
                            <div>
                              - <b style={{ color: '#b91c1c' }}>Nội dung chuyển khoản: {printModalNotice.contractCode || printModalNotice.residentCode} - {cleanResidentName} - Phí T{mNum}_{yNum}</b>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div style={{ fontSize: '0.74rem', color: '#475569', fontStyle: 'italic', background: '#f8fafc', padding: '0.2rem 0.45rem', borderRadius: '0.25rem', borderLeft: '3px solid #166534', marginTop: '0.25rem' }}>
                        Lưu ý: Sau khi chuyển khoản, Quý Gia đình vui lòng gửi xác nhận giao dịch cho Trung tâm để thuận tiện đối soát và cập nhật.
                      </div>
                      <div style={{ fontSize: '0.76rem', color: '#0f172a', fontWeight: 600, marginTop: '0.25rem', textAlign: 'center' }}>
                        Mọi thắc mắc về chi phí, quý gia đình vui lòng liên hệ qua số điện thoại HOTLINE: <b>0824 155 155</b>.
                      </div>
                      <div style={{ fontSize: '0.78rem', color: '#166534', fontWeight: 700, fontStyle: 'italic', marginTop: '0.15rem', textAlign: 'center' }}>
                        Xin trân trọng cảm ơn sự đồng hành và tin tưởng của quý gia đình!
                      </div>
                    </div>
                  </>
                );
              })()}

              {/* Official 3-Column Signatures */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', textAlign: 'center', marginTop: '1.1rem', pageBreakInside: 'avoid', gap: '0.75rem' }}>
                <div>
                  <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.82rem' }}>NGƯỜI LẬP BẢNG</div>
                  <div style={{ fontSize: '0.72rem', color: '#64748b', fontStyle: 'italic', marginBottom: '3.5rem' }}>(Ký & ghi rõ họ tên)</div>
                  <div style={{ fontWeight: 600, color: '#334155', fontSize: '0.82rem' }}>{printModalNotice.approvedBy || 'Bộ phận Kế toán'}</div>
                </div>

                <div>
                  <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.85rem' }}>KẾ TOÁN TRƯỞNG</div>
                  <div style={{ fontSize: '0.72rem', color: '#64748b', fontStyle: 'italic', marginBottom: '3.5rem' }}>(Ký & ghi rõ họ tên)</div>
                  <div style={{ fontWeight: 600, color: '#334155', fontSize: '0.82rem' }}>Nguyễn Thị Kế Toán</div>
                </div>

                <div>
                  <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.82rem' }}>ĐẠI DIỆN TRUNG TÂM</div>
                  <div style={{ fontSize: '0.72rem', color: '#64748b', fontStyle: 'italic', marginBottom: '3.5rem' }}>(Ký, đóng dấu & ghi rõ họ tên)</div>
                  <div style={{ fontWeight: 600, color: '#334155', fontSize: '0.82rem' }}>Ban Giám Đốc Tâm An</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: QUẢN LÝ THẨM ĐỊNH & BÁO CÁO SAI SÓT */}
      {/* ========================================================================= */}
      {managerReviewInvoice && (
        <div className="modal-overlay" onClick={() => setManagerReviewInvoice(null)}>
          <div
            className="modal-card"
            style={{
              background: '#ffffff',
              borderRadius: '0.75rem',
              padding: '1.5rem',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
              border: '1px solid #e2e8f0',
              maxWidth: '560px',
              width: '100%',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.65rem' }}>
              <div>
                <h3 style={{ margin: 0, color: '#0369a1', fontSize: '1.15rem', fontWeight: 800 }}>
                  🔍 Kiểm Duyệt & Thẩm Định Bảng Kê (Quản Lý)
                </h3>
                <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Bảng kê {managerReviewInvoice.invoiceCode} — {managerReviewInvoice.residentName}</div>
              </div>
              <button
                type="button"
                className="btn btn-neutral"
                onClick={() => setManagerReviewInvoice(null)}
                style={{ padding: '0.2rem 0.6rem', fontSize: '1.1rem', lineHeight: 1 }}
              >
                ✕
              </button>
            </div>

            <div style={{ background: '#f0f9ff', padding: '0.75rem 0.85rem', borderRadius: '0.5rem', marginBottom: '1rem', border: '1px solid #bae6fd', fontSize: '0.85rem', color: '#0369a1' }}>
              ℹ️ Nhân viên Quản lý có trách nhiệm đối soát số ngày nghỉ phép, phí chăm sóc hỗ trợ, phụ thu Lễ Tết và vật tư trước khi chuyển Ban Giám đốc phê duyệt phát hành Cổng thân nhân.
            </div>

            <label className="field-group" style={{ marginBottom: '1.25rem' }}>
              <span className="field-label" style={{ fontWeight: 700 }}>Ghi chú thẩm định / Nội dung sai sót phát hiện:</span>
              <textarea
                className="text-input"
                rows={3}
                placeholder="Nếu Bảng kê chính xác: Nhập ghi chú xác nhận (nếu có).
Nếu có sai sót: Nhập chi tiết nội dung sai sót để báo cáo Ban Giám đốc (VD: Nhầm số ngày nghỉ phép thăm nhà, chưa giảm trừ nghỉ phép/tạm vắng...)"
                value={managerReviewNotes}
                onChange={(e) => setManagerReviewNotes(e.target.value)}
              />
            </label>

            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', borderTop: '1px solid #e2e8f0', paddingTop: '1rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-neutral"
                style={{ background: '#fee2e2', color: '#dc2626', borderColor: '#fca5a5', fontWeight: 700 }}
                disabled={reviewByManagerMutation.isPending}
                onClick={() => {
                  if (!managerReviewNotes.trim()) {
                    alert('Vui lòng nhập nội dung sai sót phát hiện để báo cáo Ban Giám đốc.');
                    return;
                  }
                  reviewByManagerMutation.mutate({
                    invoiceId: managerReviewInvoice.invoiceId,
                    isAccurate: false,
                    notesOrReason: managerReviewNotes,
                  });
                }}
              >
                ⚠️ Báo Cáo Sai Sót Cho BGĐ
              </button>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="button"
                  className="btn btn-neutral"
                  onClick={() => setManagerReviewInvoice(null)}
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  className="btn btn-success"
                  disabled={reviewByManagerMutation.isPending}
                  style={{ fontWeight: 700 }}
                  onClick={() => {
                    reviewByManagerMutation.mutate({
                      invoiceId: managerReviewInvoice.invoiceId,
                      isAccurate: true,
                      notesOrReason: managerReviewNotes || 'Đã kiểm tra và xác nhận Bảng kê chính xác 100%.',
                    });
                  }}
                >
                  {reviewByManagerMutation.isPending ? 'Đang gửi...' : '✅ Xác Nhận Chính Xác'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: BAN GIÁM ĐỐC HIỆU CHỈNH CÁC HẠNG MỤC BẢNG KÊ */}
      {/* ========================================================================= */}
      {directorEditInvoice && (
        <div className="modal-overlay" onClick={() => setDirectorEditInvoice(null)}>
          <div
            className="modal-card"
            style={{
              background: '#ffffff',
              borderRadius: '0.75rem',
              padding: '1.5rem',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
              border: '1px solid #e2e8f0',
              maxWidth: '680px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.65rem' }}>
              <div>
                <h3 style={{ margin: 0, color: '#166534', fontSize: '1.15rem', fontWeight: 800 }}>
                  ✏️ Hiệu Chỉnh Các Hạng Mục Bảng Kê (Ban Giám Đốc)
                </h3>
                <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Bảng kê {directorEditInvoice.invoiceCode} — {directorEditInvoice.residentName}</div>
              </div>
              <button
                type="button"
                className="btn btn-neutral"
                onClick={() => setDirectorEditInvoice(null)}
                style={{ padding: '0.2rem 0.6rem', fontSize: '1.1rem', lineHeight: 1 }}
              >
                ✕
              </button>
            </div>

            {directorEditInvoice.reportedErrorReason && (
              <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', padding: '0.75rem 0.85rem', borderRadius: '0.5rem', marginBottom: '1rem', fontSize: '0.84rem', color: '#991b1b' }}>
                ⚠️ <b>Báo cáo sai sót từ Nhân viên Quản lý ({directorEditInvoice.reviewedByManagerName || 'Quản lý'}):</b>
                <div style={{ marginTop: '0.25rem', fontStyle: 'italic' }}>"{directorEditInvoice.reportedErrorReason}"</div>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem', marginBottom: '1rem' }}>
              <div>
                <label className="field-label" style={{ fontSize: '0.8rem', fontWeight: 700 }}>🏨 Phí Chăm Sóc Cơ Bản (đồng):</label>
                <input
                  type="number"
                  className="text-input"
                  value={directorForm.basicPackageFee || 0}
                  onChange={(e) => setDirectorForm({ ...directorForm, basicPackageFee: Number(e.target.value) })}
                />
              </div>

              <div>
                <label className="field-label" style={{ fontSize: '0.8rem', fontWeight: 700 }}>🩺 Phí Chăm Sóc Hỗ Trợ (đồng):</label>
                <input
                  type="number"
                  className="text-input"
                  value={directorForm.supportServicesFee || 0}
                  onChange={(e) => setDirectorForm({ ...directorForm, supportServicesFee: Number(e.target.value) })}
                />
              </div>

              <div>
                <label className="field-label" style={{ fontSize: '0.8rem', fontWeight: 700 }}>🌟 Phí Chăm Sóc Mở Rộng (đồng):</label>
                <input
                  type="number"
                  className="text-input"
                  value={directorForm.extendedCareFee || 0}
                  onChange={(e) => setDirectorForm({ ...directorForm, extendedCareFee: Number(e.target.value) })}
                />
              </div>

              <div>
                <label className="field-label" style={{ fontSize: '0.8rem', fontWeight: 700 }}>📅 Số Ngày Vắng Mặt Thông Thường (100k/ngày):</label>
                <input
                  type="number"
                  className="text-input"
                  value={directorForm.regularLeaveDays || 0}
                  onChange={(e) => setDirectorForm({ ...directorForm, regularLeaveDays: Number(e.target.value) })}
                />
              </div>

              <div>
                <label className="field-label" style={{ fontSize: '0.8rem', fontWeight: 700 }}>🚑 Số Ngày Vắng Bất Khả Kháng (200k/ngày):</label>
                <input
                  type="number"
                  className="text-input"
                  value={directorForm.forceMajeureLeaveDays || 0}
                  onChange={(e) => setDirectorForm({ ...directorForm, forceMajeureLeaveDays: Number(e.target.value) })}
                />
              </div>

              <div>
                <label className="field-label" style={{ fontSize: '0.8rem', fontWeight: 700 }}>🏮 Phụ Thu Ngày Lễ Tết (đồng):</label>
                <input
                  type="number"
                  className="text-input"
                  value={directorForm.holidaySurchargeFee || 0}
                  onChange={(e) => setDirectorForm({ ...directorForm, holidaySurchargeFee: Number(e.target.value) })}
                />
              </div>

              <div>
                <label className="field-label" style={{ fontSize: '0.8rem', fontWeight: 700 }}>🍲 Chi Phí Suất Ăn Thân Nhân (đồng):</label>
                <input
                  type="number"
                  className="text-input"
                  value={directorForm.extraMealsFee || 0}
                  onChange={(e) => setDirectorForm({ ...directorForm, extraMealsFee: Number(e.target.value) })}
                />
              </div>

              <div>
                <label className="field-label" style={{ fontSize: '0.8rem', fontWeight: 700 }}>🩹 Vật Tư Y Tế Tiêu Hao (đồng):</label>
                <input
                  type="number"
                  className="text-input"
                  value={directorForm.consumablesFee || 0}
                  onChange={(e) => setDirectorForm({ ...directorForm, consumablesFee: Number(e.target.value) })}
                />
              </div>

              <div>
                <label className="field-label" style={{ fontSize: '0.8rem', fontWeight: 700 }}>📜 Nợ Tháng Trước (Tự động/Chỉnh sửa) (đồng):</label>
                <input
                  type="number"
                  className="text-input"
                  value={directorForm.previousMonthDebt || 0}
                  onChange={(e) => setDirectorForm({ ...directorForm, previousMonthDebt: Number(e.target.value) })}
                />
              </div>

              <div style={{ gridColumn: 'span 2' }}>
                <label className="field-label" style={{ fontSize: '0.8rem', fontWeight: 700 }}>🏦 Trạng Thái Đóng Tiền Đặt Cọc (Ký Quỹ 1 lần khi nhập viện):</label>
                <select
                  className="text-input"
                  value={directorForm.depositStatus || 'UNPAID'}
                  onChange={(e) => {
                    const status = e.target.value as 'PAID' | 'UNPAID';
                    setDirectorForm({
                      ...directorForm,
                      depositStatus: status,
                      unpaidDepositDebt: status === 'PAID' ? 0 : 20000000,
                    });
                  }}
                >
                  <option value="PAID">✓ Đã nộp tiền đặt cọc ký quỹ (0đ nợ cọc)</option>
                  <option value="UNPAID">⚠️ Chưa nộp tiền đặt cọc ký quỹ (Nợ 20.000.000đ hiển thị ở Cổng Thân Nhân)</option>
                </select>
              </div>
            </div>

            <label className="field-group" style={{ marginBottom: '1.25rem' }}>
              <span className="field-label" style={{ fontWeight: 700 }}>Ghi chú hiệu chỉnh của Ban Giám đốc:</span>
              <textarea
                className="text-input"
                rows={2}
                placeholder="Nhập căn cứ điều chỉnh các hạng mục thu phí..."
                value={directorForm.directorEditNotes || ''}
                onChange={(e) => setDirectorForm({ ...directorForm, directorEditNotes: e.target.value })}
              />
            </label>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', borderTop: '1px solid #e2e8f0', paddingTop: '1rem' }}>
              <button
                type="button"
                className="btn btn-neutral"
                onClick={() => setDirectorEditInvoice(null)}
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                className="btn btn-success"
                disabled={updateByDirectorMutation.isPending}
                style={{ fontWeight: 700 }}
                onClick={() => updateByDirectorMutation.mutate()}
              >
                {updateByDirectorMutation.isPending ? 'Đang lưu...' : '💾 Lưu Hiệu Chỉnh Bảng Kê'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

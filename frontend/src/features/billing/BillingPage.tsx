import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useActor } from '../../auth/ActorContext';
import { hasCapability } from '../../auth/role-policy';
import {
  fetchMonthlyInvoices,
  fetchPaymentReceipts,
  fetchPricingMatrix,
  recordPayment,
  settleInvoice,
  updatePricingMatrix,
  applyDiscountToInvoice,
  removeDiscountFromInvoice,
  DEFAULT_PRICING_MATRIX,
  DISCOUNT_CATEGORY_LABELS,
  ResidentMonthlyInvoice,
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

  // Capabilities
  const canConfigurePricing = hasCapability(actor?.actorRole, 'canConfigurePricing');
  const canManageBilling = hasCapability(actor?.actorRole, 'canManageBilling');

  // Queries
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

  // Filtered Invoices
  const invoicesList = invoicesQuery.data || [];
  const filteredInvoices = useMemo(() => {
    let list = invoicesList;
    if (selectedStatus !== 'ALL') {
      list = list.filter((i) => i.status === selectedStatus);
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
  }, [invoicesList, selectedStatus, searchTerm]);

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

        {/* RBAC Status Badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.45rem 0.85rem',
              borderRadius: '0.5rem',
              background: canConfigurePricing ? '#dcfce7' : '#f1f5f9',
              border: `1px solid ${canConfigurePricing ? '#86efac' : '#cbd5e1'}`,
              fontSize: '0.82rem',
              fontWeight: 600,
              color: canConfigurePricing ? '#166534' : '#475569',
            }}
          >
            <span>{canConfigurePricing ? '👑' : '🔒'}</span>
            <span>
              {canConfigurePricing
                ? 'Thẩm quyền cấu hình giá & Giảm giá: Ban Giám đốc & Quản lý'
                : 'Chế độ xem bảng giá (Chỉ BGĐ & Quản lý có quyền sửa giá)'}
            </span>
          </div>
        </div>
      </div>

      {/* Primary Tabs - Streamlined single-line layout */}
      <div
        className="tab-nav"
        style={{
          display: 'flex',
          gap: '0.5rem',
          borderBottom: '2px solid #e2e8f0',
          marginBottom: '1.25rem',
          overflowX: 'auto',
          whiteSpace: 'nowrap',
          paddingBottom: '0.25rem',
          scrollbarWidth: 'none',
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.85rem', marginBottom: '1.25rem' }}>
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
              <div style={{ fontSize: '0.72rem', color: '#6b21a8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>GIẢM TRỪ VẮNG MẶT (RLA)</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#7e22ce', margin: '0.25rem 0', fontVariantNumeric: 'tabular-nums' }}>
                {formatVndText(stats.totalLeaveDeductions)}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#6b21a8' }}>Bất khả kháng (200k) & Nghỉ (100k)</div>
            </div>
          </div>

          {/* Balanced Filter Toolbar */}
          <div className="card" style={{ padding: '0.9rem 1.15rem', marginBottom: '1.25rem', background: '#ffffff', borderRadius: '0.65rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', alignItems: 'flex-end' }}>
              <div>
                <label className="field-label" style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '0.35rem', display: 'block' }}>Kỳ thu phí:</label>
                <select className="text-input" style={{ height: '38px', padding: '0 0.65rem', width: '100%', boxSizing: 'border-box' }} value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}>
                  <option value="2026-09">Tháng 09/2026</option>
                  <option value="2026-08">Tháng 08/2026</option>
                  <option value="2026-07">Tháng 07/2026</option>
                </select>
              </div>

              <div>
                <label className="field-label" style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '0.35rem', display: 'block' }}>Trạng thái thanh toán:</label>
                <select className="text-input" style={{ height: '38px', padding: '0 0.65rem', width: '100%', boxSizing: 'border-box' }} value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value as any)}>
                  <option value="ALL">-- Tất cả trạng thái --</option>
                  <option value="PENDING">⏳ Chờ thanh toán</option>
                  <option value="PARTIAL">🟡 Thanh toán một phần</option>
                  <option value="PAID">✅ Đã thu đủ</option>
                  <option value="SETTLED">🔒 Đã quyết toán</option>
                </select>
              </div>

              <div style={{ gridColumn: 'span 2' }}>
                <label className="field-label" style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '0.35rem', display: 'block' }}>Tìm kiếm:</label>
                <input
                  type="text"
                  className="text-input"
                  style={{ height: '38px', padding: '0 0.75rem', width: '100%', boxSizing: 'border-box' }}
                  placeholder="Tìm theo tên Cụ, mã bảng kê, số phòng..."
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
            <div className="card" style={{ padding: 0, overflow: 'hidden', borderRadius: '0.65rem', border: '1px solid #e2e8f0' }}>
              <div className="table-responsive" style={{ overflowX: 'auto' }}>
                <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '2px solid #cbd5e1' }}>
                      <th style={{ padding: '0.75rem 0.6rem', textAlign: 'left', whiteSpace: 'nowrap' }}>Mã Bảng Kê</th>
                      <th style={{ padding: '0.75rem 0.6rem', textAlign: 'left', whiteSpace: 'nowrap' }}>Người Cao Tuổi</th>
                      <th style={{ padding: '0.75rem 0.6rem', textAlign: 'left', whiteSpace: 'nowrap' }}>Phòng & Gói Phòng</th>
                      <th style={{ padding: '0.75rem 0.6rem', textAlign: 'right', whiteSpace: 'nowrap' }}>Phí Cơ Bản (đồng)</th>
                      <th style={{ padding: '0.75rem 0.6rem', textAlign: 'right', whiteSpace: 'nowrap' }}>Phí Hỗ Trợ (đồng)</th>
                      <th style={{ padding: '0.75rem 0.6rem', textAlign: 'right', whiteSpace: 'nowrap' }}>Giảm Trừ RLA (đồng)</th>
                      <th style={{ padding: '0.75rem 0.6rem', textAlign: 'right', whiteSpace: 'nowrap' }}>Giảm Giá (đồng)</th>
                      <th style={{ padding: '0.75rem 0.6rem', textAlign: 'right', whiteSpace: 'nowrap' }}>Tổng Thực Thu (đồng)</th>
                      <th style={{ padding: '0.75rem 0.6rem', textAlign: 'right', whiteSpace: 'nowrap' }}>Đã Thu (đồng)</th>
                      <th style={{ padding: '0.75rem 0.6rem', textAlign: 'right', whiteSpace: 'nowrap' }}>Còn Nợ (đồng)</th>
                      <th style={{ padding: '0.75rem 0.6rem', textAlign: 'center', whiteSpace: 'nowrap' }}>Trạng Thái</th>
                      <th style={{ padding: '0.75rem 0.6rem', textAlign: 'center', whiteSpace: 'nowrap' }}>Thao Tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredInvoices.map((inv) => {
                      const st = STATUS_CONFIG[inv.status];
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
                          <td style={{ padding: '0.65rem 0.6rem', textAlign: 'right', color: '#0369a1', fontVariantNumeric: 'tabular-nums' }}>
                            {inv.supportServicesFee > 0 ? `+${formatNum(inv.supportServicesFee)}` : '0'}
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
                            <div style={{ display: 'flex', gap: '0.3rem', justifyContent: 'center', flexWrap: 'nowrap' }}>
                              <button
                                type="button"
                                className="btn btn-neutral"
                                onClick={() => setDetailModalInvoice(inv)}
                                style={{ padding: '0.25rem 0.5rem', fontSize: '0.78rem' }}
                                title="Xem chi tiết bảng kê thu phí"
                              >
                                👁️ Chi tiết
                              </button>

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
                      <td style={{ fontWeight: 600, color: '#1e293b', padding: '0.65rem' }}>{ec.name}</td>
                      <td style={{ padding: '0.65rem' }}>
                        <span className="badge badge-neutral" style={{ whiteSpace: 'nowrap' }}>{ec.unit}</span>
                      </td>
                      <td style={{ textAlign: 'right', padding: '0.65rem' }}>
                        <div style={{ fontWeight: 700, color: '#7c3aed', fontVariantNumeric: 'tabular-nums' }}>
                          {ec.priceDisplay}
                        </div>
                      </td>
                      <td style={{ fontSize: '0.85rem', color: '#64748b', padding: '0.65rem' }}>{ec.note || '—'}</td>
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
              {pricingData.policyRules.map((rule) => (
                <div key={rule.id} style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '0.5rem', padding: '0.9rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '110px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontWeight: 700, color: '#92400e', fontSize: '0.9rem' }}>{rule.name}</span>
                    <span className="badge badge-warning" style={{ fontWeight: 800, whiteSpace: 'nowrap' }}>
                      {rule.valueType === 'PERCENT' ? `Giảm ${rule.value}%` : `${formatNum(rule.value)} đ/ngày`}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.82rem', color: '#78350f', marginTop: '0.4rem', lineHeight: '1.4' }}>
                    {rule.description}
                  </div>
                </div>
              ))}
            </div>
          </div>
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
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem', alignItems: 'stretch' }}>
            {pricingData.specialDiscountPolicies.map((p) => {
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
                    minHeight: '200px',
                    borderTop: '4px solid #15803d',
                    borderRadius: '0.65rem',
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    boxSizing: 'border-box',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', gap: '0.5rem' }}>
                      <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>
                        {catInfo.icon} {catInfo.label}
                      </span>
                      <span className="badge badge-success" style={{ fontWeight: 800, fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
                        {p.discountType === 'PERCENT' ? `Giảm ${p.discountValue}%` : `Giảm ${formatNum(p.discountValue)} đ`}
                      </span>
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
                <span>🩺 Phí dịch vụ chăm sóc hỗ trợ:</span>
                <b>{formatVndText(invoicesList.reduce((s, i) => s + i.supportServicesFee, 0))}</b>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.4rem', borderBottom: '1px solid #f1f5f9' }}>
                <span>📉 Giảm trừ vắng mặt (RLA):</span>
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
            <div style={{ background: '#f8fafc', padding: '0.75rem 0.85rem', borderRadius: '0.5rem', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #e2e8f0' }}>
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

            {/* Breakdown Sections */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', fontSize: '0.88rem' }}>
              {/* I. Phí Cơ Bản */}
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.4rem', borderBottom: '1px solid #f1f5f9' }}>
                <span style={{ fontWeight: 600 }}>🏨 I. Phí chăm sóc cơ bản (Gói phòng):</span>
                <span style={{ fontWeight: 700 }}>{formatVndText(detailModalInvoice.basicPackageFee)}</span>
              </div>

              {/* II. Phí Hỗ Trợ */}
              {detailModalInvoice.supportServicesFee > 0 && (
                <div style={{ background: '#f0f9ff', padding: '0.6rem', borderRadius: '0.35rem', border: '1px solid #e0f2fe' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, color: '#0369a1' }}>
                    <span>🩺 II. Phí dịch vụ chăm sóc hỗ trợ:</span>
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
                  <span>🏮 V. Phụ thu ngày Lễ Tết ({detailModalInvoice.holidayDays} ngày):</span>
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

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.25rem' }}>
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
    </div>
  );
}

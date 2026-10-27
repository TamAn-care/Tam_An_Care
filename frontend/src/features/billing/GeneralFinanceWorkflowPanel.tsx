import { useMemo, useState } from 'react';
import { useActor } from '../../auth/ActorContext';
import { hasCapability } from '../../auth/role-policy';
import { apiRequest } from '../../api/client';

type WorkflowResponse = { invoiceId?: string; receiptId?: string; status?: string; allocationId?: string; replayed?: boolean; financeEntryId?: string };

const vnd = (value: string) => new Intl.NumberFormat('vi-VN').format(Number(value || 0)) + ' ₫';

export function GeneralFinanceWorkflowPanel() {
  const { actor } = useActor();
  const [contractId, setContractId] = useState('CONTRACT_V428');
  const [residentId, setResidentId] = useState('RES_V428');
  const [billingMonth, setBillingMonth] = useState('2026-07');
  const [invoiceId, setInvoiceId] = useState('');
  const [receiptId, setReceiptId] = useState('');
  const [receiptAmount, setReceiptAmount] = useState('0');
  const [allocationAmount, setAllocationAmount] = useState('0');
  const [period, setPeriod] = useState('2026-07');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const canManage = Boolean(actor && hasCapability(actor.actorRole, 'canManageBilling'));
  const canApprove = actor?.actorRole === 'ADMIN' || actor?.actorRole === 'SUPERVISOR';
  const canReview = actor?.actorRole === 'SUPERVISOR' || actor?.actorRole === 'ADMIN';
  const canClose = canApprove;
  const displayAmount = useMemo(() => vnd(receiptAmount), [receiptAmount]);

  async function run(action: () => Promise<WorkflowResponse | undefined>) {
    setBusy(true); setError(''); setMessage('');
    try { const result = await action(); setMessage(result?.status ? `Đã thực hiện: ${result.status}` : 'Đã thực hiện thành công.'); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Không thể thực hiện thao tác.'); }
    finally { setBusy(false); }
  }

  if (!canManage) return <section className="card" aria-label="Finance general" style={{ padding: '1rem' }}><strong>Quyền Finance</strong><p>Bạn không được cấp quyền thao tác Finance tổng hợp.</p></section>;

  return <section className="card" aria-label="Finance tổng hợp" style={{ padding: '1rem', marginBottom: '1rem' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
      <div><h2 style={{ margin: 0 }}>Finance tổng hợp</h2><p style={{ margin: '.35rem 0', color: '#64748b' }}>Hợp đồng → hóa đơn → thu tiền → sổ cái → khóa kỳ</p></div>
      <span className="badge-info">Vai trò: {actor?.actorRole}</span>
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: '.75rem', marginTop: '1rem' }}>
      <label> Mã hợp đồng<input aria-label="Mã hợp đồng Finance" value={contractId} onChange={e => setContractId(e.target.value)} /></label>
      <label> Mã người cao tuổi<input aria-label="Mã người cao tuổi Finance" value={residentId} onChange={e => setResidentId(e.target.value)} /></label>
      <label> Kỳ lập hóa đơn<input type="month" aria-label="Kỳ lập hóa đơn Finance" value={billingMonth} onChange={e => setBillingMonth(e.target.value)} /></label>
      <label> Kỳ khóa sổ<input type="month" aria-label="Kỳ khóa sổ Finance" value={period} onChange={e => setPeriod(e.target.value)} /></label>
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: '.75rem', marginTop: '1rem' }}>
      <div className="card" style={{ padding: '.85rem' }}><h3>1. Hợp đồng & hóa đơn</h3><p>Chỉ giá đã phê duyệt mới được lập hóa đơn.</p><button disabled={busy} onClick={() => run(async () => { const id = `INV_${Date.now()}`; setInvoiceId(id); return apiRequest('/api/finance-workflows/invoices/drafts', { method: 'POST', body: JSON.stringify({ invoiceId: id, invoiceCode: id, contractId, residentId, billingMonth }), actor }); })}>Lập hóa đơn nháp</button><input aria-label="Mã hóa đơn Finance" placeholder="Mã hóa đơn" value={invoiceId} onChange={e => setInvoiceId(e.target.value)} /><button disabled={busy || !invoiceId || !canReview} onClick={() => run(() => apiRequest(`/api/finance-workflows/invoices/${invoiceId}/review`, { method: 'POST', body: JSON.stringify({ reason: 'Kiểm tra hồ sơ Finance' }), actor }))}>Kiểm tra hóa đơn</button><button disabled={busy || !invoiceId || !canApprove} onClick={() => run(() => apiRequest(`/api/finance-workflows/invoices/${invoiceId}/approve`, { method: 'POST', body: JSON.stringify({ reason: 'Phê duyệt theo thẩm quyền' }), actor }))}>Phê duyệt hóa đơn</button><button disabled={busy || !invoiceId || !canApprove} onClick={() => run(() => apiRequest(`/api/finance-workflows/invoices/${invoiceId}/issue`, { method: 'POST', body: JSON.stringify({ reason: 'Phát hành hóa đơn đã duyệt' }), actor }))}>Phát hành hóa đơn</button></div>
      <div className="card" style={{ padding: '.85rem' }}><h3>2. Thu tiền & phân bổ</h3><label> Mã phiếu thu<input aria-label="Mã phiếu thu Finance" value={receiptId} onChange={e => setReceiptId(e.target.value)} placeholder="REC_..." /></label><label> Số tiền<input aria-label="Số tiền phiếu thu Finance" value={receiptAmount} onChange={e => setReceiptAmount(e.target.value)} inputMode="numeric" /></label><p>Số tiền hiển thị: {displayAmount}</p><button disabled={busy || !receiptId} onClick={() => run(() => apiRequest('/api/finance-workflows/receipts', { method: 'POST', body: JSON.stringify({ receiptId, receiptCode: receiptId, residentId, amountVnd: receiptAmount, receivedDate: new Date().toISOString().slice(0, 10), paymentMethod: 'BANK_TRANSFER', externalReference: receiptId }), actor }))}>Tạo phiếu thu</button><button disabled={busy || !receiptId || !canApprove} onClick={() => run(() => apiRequest(`/api/finance-workflows/receipts/${receiptId}/verify`, { method: 'POST', body: JSON.stringify({ reason: 'Xác minh chứng từ thu tiền' }), actor }))}>Xác minh phiếu thu</button><label> Số tiền phân bổ<input aria-label="Số tiền phân bổ Finance" value={allocationAmount} onChange={e => setAllocationAmount(e.target.value)} inputMode="numeric" /></label><button disabled={busy || !receiptId || !invoiceId} onClick={() => run(() => apiRequest('/api/finance-write/allocations', { method: 'POST', body: JSON.stringify({ receiptId, invoiceId, allocationId: `ALLOC_${Date.now()}`, amountVnd: allocationAmount, operationKey: `OP_${Date.now()}` }), actor }))}>Phân bổ khoản thu</button></div>
      <div className="card" style={{ padding: '.85rem' }}><h3>3. Sổ cái & kỳ kế toán</h3><p>Posted ledger không có nút sửa trực tiếp.</p><button disabled={busy || !invoiceId} onClick={() => run(() => apiRequest(`/api/finance-workflows/invoices/${invoiceId}/post-ledger`, { method: 'POST', body: JSON.stringify({ reason: 'Ghi nhận doanh thu theo hóa đơn' }), actor }))}>Ghi nhận sổ cái</button><button disabled={busy || !canClose} onClick={() => run(() => apiRequest(`/api/finance-workflows/periods/${period}/close`, { method: 'POST', body: JSON.stringify({ reason: 'Xác nhận khóa kỳ sau kiểm tra' }), actor }))}>Khóa kỳ</button><button disabled={busy || !canClose} onClick={() => run(() => apiRequest(`/api/finance-workflows/periods/${period}/reopen`, { method: 'POST', body: JSON.stringify({ reason: 'Mở lại kỳ theo yêu cầu được phê duyệt' }), actor }))}>Mở lại kỳ</button><div role="status" style={{ marginTop: '.75rem', padding: '.65rem', background: '#fff7ed', color: '#9a3412' }}>Báo cáo thực tế: Chưa đủ dữ liệu để xác nhận</div></div>
    </div>
    {message && <p role="status" style={{ color: '#166534' }}>{message}</p>}{error && <p role="alert" style={{ color: '#b91c1c' }}>{error}</p>}
  </section>;
}

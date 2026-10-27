import { useState } from 'react';
import { apiRequest } from '../../api/client';
import type { HumanActorSession } from '../../types/actor';

interface DraftResult {
  invoiceId: string;
  invoiceCode: string;
  billingMonth: string;
  packageFeeVnd: string;
  familyMealCount: number;
  familyMealTotalVnd: string;
  familyMeals: Array<{sourceEventId:string;serviceDate:string;mealType:string;quantity:string;unitPriceVnd:string;amountVnd:string;priceListVersion:number}>;
  totalAmountVnd: string;
  status: 'DRAFT';
  residentMealsIncludedInPackage: true;
}

function formatVnd(value: string): string {
  if (!/^\d+$/.test(value)) return '—';
  return BigInt(value).toLocaleString('vi-VN') + ' ₫';
}

function currentLocalMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function FamilyMealBillingDraftPanel({ actor }: { actor: HumanActorSession | null }) {
  const [residentId, setResidentId] = useState('');
  const [billingMonth, setBillingMonth] = useState(currentLocalMonth);
  const [result, setResult] = useState<DraftResult | null>(null);
  const [invoiceId, setInvoiceId] = useState('');
  const [actionReason, setActionReason] = useState('Đã rà soát nguồn và chứng từ');
  const [actionStatus, setActionStatus] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function createDraft() {
    setBusy(true);
    setError('');
    setResult(null);
    try {
      const draft = await apiRequest<DraftResult>('/api/finance-write/invoices/drafts/family-meals', {
        method: 'POST',
        actor,
        body: JSON.stringify({ residentId: residentId.trim(), billingMonth }),
      });
      if (draft.status !== 'DRAFT' || draft.residentMealsIncludedInPackage !== true) {
        throw new Error('FINANCE_DRAFT_RESPONSE_UNVERIFIED');
      }
      setResult(draft);
      setInvoiceId(draft.invoiceId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'FINANCE_BILLING_DRAFT_FAILED');
    } finally {
      setBusy(false);
    }
  }

  async function runAction(action: 'review' | 'approve' | 'issue') {
    if (!invoiceId.trim()) return;
    setBusy(true);
    setError('');
    setActionStatus('');
    try {
      const response = await apiRequest<Record<string, unknown>>(`/api/finance-write/invoices/${encodeURIComponent(invoiceId.trim())}/${action}`, {
        method: 'POST', actor, body: JSON.stringify({ reason: actionReason }),
      });
      setActionStatus(`Máy chủ xác nhận thao tác ${action}: ${String(response.status ?? 'OK')}.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'FINANCE_INVOICE_ACTION_FAILED');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="family-meal-billing-title" style={{ marginTop: '1rem', padding: '1rem', border: '1px solid #cbd5e1', borderRadius: '0.75rem', background: '#fff' }}>
      <h2 id="family-meal-billing-title">Lập nháp bảng kê bữa ăn người nhà</h2>
      <p>Bữa ăn người cao tuổi đã nằm trong giá gói hợp đồng và không tạo dòng thu riêng. Chỉ suất ăn người nhà đã được xác nhận cùng giá dịch vụ đã duyệt mới được đưa vào bản nháp.</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '0.75rem', alignItems: 'end' }}>
        <label>Mã cư dân
          <input value={residentId} onChange={event => setResidentId(event.target.value)} autoComplete="off" />
        </label>
        <label>Kỳ thu phí
          <input type="month" value={billingMonth} onChange={event => setBillingMonth(event.target.value)} />
        </label>
        <button type="button" className="btn btn-primary" disabled={busy || residentId.trim().length === 0 || !/^\d{4}-\d{2}$/.test(billingMonth)} onClick={createDraft}>
          {busy ? 'Đang lập bản nháp…' : 'Lập nháp từ nguồn đã xác nhận'}
        </button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '0.75rem', alignItems: 'end', marginTop: '0.75rem' }}>
        <label>Mã hóa đơn nháp
          <input value={invoiceId} onChange={event => setInvoiceId(event.target.value)} autoComplete="off" />
        </label>
        <label>Lý do rà soát / duyệt / phát hành
          <input value={actionReason} onChange={event => setActionReason(event.target.value)} minLength={5} maxLength={1000} />
        </label>
        <button type="button" className="btn btn-neutral" disabled={busy || !invoiceId.trim()} onClick={() => runAction('review')}>Rà soát</button>
        <button type="button" className="btn btn-neutral" disabled={busy || !invoiceId.trim()} onClick={() => runAction('approve')}>Duyệt</button>
        <button type="button" className="btn btn-primary" disabled={busy || !invoiceId.trim()} onClick={() => runAction('issue')}>Phát hành</button>
      </div>
      {actionStatus && <p role="status">{actionStatus}</p>}
      {error && <p role="alert" style={{ color: '#b91c1c' }}>Không lập được bản nháp: {error}</p>}
      {result && <div role="status" style={{ marginTop: '0.75rem' }}>
        <strong>{result.invoiceCode} · {result.invoiceId} · Bản nháp · {result.billingMonth}</strong>
        <ul>
          <li>Gói hợp đồng (đã gồm bữa ăn cư dân): {formatVnd(result.packageFeeVnd)}</li>
          <li>Suất ăn người nhà đã xác nhận: {result.familyMealCount} · {formatVnd(result.familyMealTotalVnd)}</li>
          <li>Tổng bản nháp: {formatVnd(result.totalAmountVnd)}</li>
        </ul>
        {result.familyMeals.length > 0 && <div style={{ overflowX: 'auto' }}>
          <table style={{ minWidth: 560, width: '100%', textAlign: 'left' }}>
            <thead><tr><th>Ngày</th><th>Bữa</th><th>Số suất</th><th>Đơn giá</th><th>Thành tiền</th><th>Phiên bản</th></tr></thead>
            <tbody>{result.familyMeals.map(meal => <tr key={meal.sourceEventId}>
              <td>{meal.serviceDate}</td><td>{meal.mealType}</td><td>{meal.quantity}</td>
              <td>{formatVnd(meal.unitPriceVnd)}</td><td>{formatVnd(meal.amountVnd)}</td><td>{meal.priceListVersion}</td>
            </tr>)}</tbody>
          </table>
        </div>}
        <p>Bản nháp này chưa được duyệt, chưa phát hành và chưa phải thông báo thu tiền.</p>
      </div>}
    </section>
  );
}

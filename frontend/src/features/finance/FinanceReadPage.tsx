
import { useEffect, useState } from 'react';
import { MonthlyOperatingResultPanel } from './MonthlyOperatingResultPanel';
import type { RequestOptions } from '../../api/client';
import {
  readFinanceInvoicesByMonth,
  readFinanceInvoiceDetail,
  readFinanceLatestReceipts,
  readFinanceReceiptsForInvoice,
  type FinanceInvoiceDetail,
} from '../../api/finance-read-client';
import {
  formatFinanceDate,
  formatFinanceMonth,
  type FinanceInvoice,
  type FinanceReceipt,
} from '../../api/finance-read-model';

type Props = { options: RequestOptions };

function thisMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function vnd(value: string): string {
  if (!/^(0|[1-9]\d*)$/.test(value)) {
    throw new Error('FINANCE_INVALID_VND');
  }
  return value.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ' đ';
}

function errorMessage(value: unknown): string {
  if (value instanceof Error) {
    if (/\b(401|403)\b|unauthorized|forbidden/i.test(value.message)) {
      return 'Không có quyền truy cập dữ liệu tài chính.';
    }
    if (/\b404\b|not.found/i.test(value.message)) {
      return 'Finance API chưa được kích hoạt.';
    }
  }
  return 'Không tải được dữ liệu tài chính. Vui lòng kiểm tra kết nối và quyền truy cập.';
}

export default function FinanceReadPage({ options }: Props) {
  const [month, setMonth] = useState(thisMonth);
  const [invoices, setInvoices] = useState<FinanceInvoice[]>([]);
  const [receipts, setReceipts] = useState<FinanceReceipt[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<FinanceInvoiceDetail | null>(null);
  const [allocations, setAllocations] = useState<FinanceReceipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    setInvoices([]);
    setReceipts([]);
    setSelected(null);
    setDetail(null);
    setAllocations([]);

    Promise.all([
      readFinanceInvoicesByMonth(month, options),
      readFinanceLatestReceipts(options),
    ]).then(([items, received]) => {
      if (!active) return;
      setInvoices(items);
      setReceipts(received);
    }).catch((reason: unknown) => {
      if (active) setError(errorMessage(reason));
    }).finally(() => {
      if (active) setLoading(false);
    });

    return () => { active = false; };
  }, [month, options, revision]);

  useEffect(() => {
    let active = true;
    setDetail(null);
    setAllocations([]);
    setDetailError(null);
    if (selected === null) {
      setDetailLoading(false);
      return () => { active = false; };
    }
    setDetailLoading(true);
    Promise.all([
      readFinanceInvoiceDetail(selected, options),
      readFinanceReceiptsForInvoice(selected, options),
    ]).then(([invoice, items]) => {
      if (!active) return;
      setDetail(invoice);
      setAllocations(items);
    }).catch((reason: unknown) => {
      if (active) setDetailError(errorMessage(reason));
    }).finally(() => {
      if (active) setDetailLoading(false);
    });
    return () => { active = false; };
  }, [selected, options, revision]);

  return (
    <main className="space-y-5 p-4 md:p-6">
      <header>
        <h1 className="text-2xl font-semibold">
          Tài chính — Hóa đơn và phiếu thu
        </h1>
        <p className="text-sm text-slate-600">
          Chế độ chỉ xem, dữ liệu từ Finance API.
        </p>
      </header>

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span>Tháng hóa đơn: {formatFinanceMonth(month)}</span>
          <input
            type="month"
            aria-label="Tháng hóa đơn"
            value={month}
            onChange={event => {
              const value = event.target.value;
              if (/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) {
                setMonth(value);
              }
            }}
            className="rounded border px-3 py-2"
          />
        </label>
        <button type="button"
          className="rounded border px-4 py-2"
          onClick={() => setRevision(value => value + 1)}>
          Làm mới
        </button>
      </div>

      <MonthlyOperatingResultPanel month={month} options={options} revision={revision} />

      <section aria-label="Danh sách hóa đơn" className="space-y-3">
        <h2 className="text-lg font-semibold">
          Hóa đơn tháng {formatFinanceMonth(month)}
        </h2>
        {loading && <p role="status">Đang tải chứng từ...</p>}
        {error && <p role="alert">{error}</p>}
        {!loading && !error && invoices.length === 0 &&
          <p>Chưa có hóa đơn trong tháng đã chọn.</p>}
        {!loading && !error && invoices.length > 0 &&
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr>
                  <th className="p-2 text-left">Mã hóa đơn</th>
                  <th className="p-2 text-left">Mã người cao tuổi</th>
                  <th className="p-2 text-left">Trạng thái</th>
                  <th className="p-2 text-right">Tổng tiền</th>
                  <th className="p-2 text-right">Đã phân bổ</th>
                  <th className="p-2 text-right">Còn lại</th>
                  <th className="p-2">Chi tiết</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map(item => (
                  <tr key={item.invoiceId} className="border-t">
                    <td className="p-2">{item.invoiceCode}</td>
                    <td className="p-2">{item.residentId}</td>
                    <td className="p-2">{item.status}</td>
                    <td className="p-2 text-right">{vnd(item.totalAmountVnd)}</td>
                    <td className="p-2 text-right">{vnd(item.allocatedAmountVnd)}</td>
                    <td className="p-2 text-right">{vnd(item.balanceVnd)}</td>
                    <td className="p-2">
                      <button type="button" className="underline"
                        onClick={() => setSelected(item.invoiceId)}>
                        Xem
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>}
      </section>

      {selected !== null &&
        <section aria-label="Chi tiết hóa đơn"
          className="space-y-3 rounded border p-4">
          <div className="flex justify-between gap-3">
            <h2 className="font-semibold">Chi tiết hóa đơn</h2>
            <button type="button" className="underline"
              onClick={() => setSelected(null)}>Đóng</button>
          </div>
          {detailLoading && <p role="status">Đang tải chi tiết...</p>}
          {detailError && <p role="alert">{detailError}</p>}
          {!detailLoading && detail &&
            <>
              <p>
                {detail.invoice.invoiceCode} — Tháng{' '}
                {formatFinanceMonth(detail.invoice.billingMonth)}
              </p>
              {detail.items.length === 0 &&
                <p>Chưa có khoản mục hóa đơn.</p>}
              {detail.items.length > 0 &&
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[500px] text-sm">
                    <thead>
                      <tr>
                        <th className="p-2 text-left">Khoản mục</th>
                        <th className="p-2 text-right">Số lượng</th>
                        <th className="p-2 text-right">Đơn giá</th>
                        <th className="p-2 text-right">Thành tiền</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.items.map(item =>
                        <tr key={item.itemId} className="border-t">
                          <td className="p-2">{item.description}</td>
                          <td className="p-2 text-right">{item.quantity}</td>
                          <td className="p-2 text-right">{vnd(item.unitPriceVnd)}</td>
                          <td className="p-2 text-right">{vnd(item.lineTotalVnd)}</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>}
              <h3 className="font-medium">Phiếu thu đã phân bổ</h3>
              {allocations.length === 0 &&
                <p>Chưa có phiếu thu phân bổ.</p>}
              {allocations.map(item =>
                <p key={item.receiptId}>
                  {item.receiptCode} — {formatFinanceDate(item.receivedDate)}
                  {' — '}
                  {item.amountAllocatedToInvoiceVnd === undefined
                    ? 'Thiếu số tiền phân bổ'
                    : vnd(item.amountAllocatedToInvoiceVnd)}
                </p>
              )}
            </>
          }
        </section>
      }

      <section aria-label="Phiếu thu gần đây" className="space-y-3">
        <h2 className="text-lg font-semibold">Phiếu thu gần đây</h2>
        {!loading && !error && receipts.length === 0 &&
          <p>Chưa có phiếu thu.</p>}
        {!loading && !error && receipts.map(item =>
          <p key={item.receiptId}>
            {item.receiptCode} — {formatFinanceDate(item.receivedDate)}
            {' — '}{vnd(item.amountVnd)}
          </p>
        )}
      </section>
    </main>
  );
}

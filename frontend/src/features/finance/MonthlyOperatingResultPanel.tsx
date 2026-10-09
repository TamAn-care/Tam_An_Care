import { useEffect, useState } from 'react';
import { apiRequest, type RequestOptions } from '../../api/client';

type Result = {
  source: 'POSTGRESQL';
  month: string;
  state: 'READY' | 'CHUA_DU_DU_LIEU';
  revenueVnd: string | null;
  expenseVnd: string | null;
  profitVnd: string | null;
  reasons: string[];
  ledgerSchemaReady: boolean;
  missingColumns: string[];
};

const MONEY = /^-?(0|[1-9]\d*)$/;
function money(value: string | null): string {
  if (value === null || !MONEY.test(value)) return 'Chưa đủ dữ liệu';
  return value.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ' đ';
}

export function MonthlyOperatingResultPanel({
  month, options, revision,
}: { month: string; options: RequestOptions; revision: number }) {
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setResult(null);
    setError(null);
    apiRequest<unknown>(`/api/finance-read/operating-result/month/${month}`, {
      ...options, method: 'GET',
    }).then(payload => {
      if (!active) return;
      if (!payload || typeof payload !== 'object' || Array.isArray(payload))
        throw new Error('INVALID_MONTHLY_RESULT');
      const item = payload as Partial<Result>;
      if (item.source !== 'POSTGRESQL' || item.month !== month ||
          (item.state !== 'READY' && item.state !== 'CHUA_DU_DU_LIEU') ||
          !Array.isArray(item.reasons) ||
          !Array.isArray(item.missingColumns)) throw new Error('INVALID_MONTHLY_RESULT');
      if (item.state === 'READY') {
        if (![item.revenueVnd,item.expenseVnd,item.profitVnd].every(
          value => typeof value === 'string' && MONEY.test(value)
        ) || item.reasons.length !== 0 || item.ledgerSchemaReady !== true)
          throw new Error('UNVERIFIED_MONTHLY_RESULT');
      }
      setResult(item as Result);
    }).catch(() => {
      if (active) setError('Báo cáo chưa được xác minh hoặc không thể truy cập. Không hiển thị số tiền.');
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [month, options, revision]);

  const ready = result?.state === 'READY' && !loading && !error;
  return (
    <section aria-label="Kết quả kinh doanh tháng" className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
      <h2 className="text-lg font-semibold text-slate-900">Kết quả kinh doanh tháng {month}</h2>
      <p className="mt-1 text-sm text-slate-600">Nguồn sổ cái ghi nhận; không tính doanh thu từ tổng phiếu thu.</p>
      {loading && <p role="status" className="mt-3">Đang xác minh dữ liệu tài chính...</p>}
      {error && <p role="alert" className="mt-3 text-amber-800">{error}</p>}
      {!loading && !error && result && (
        <>
          <p role="status" className="mt-3 font-medium">
            {ready ? 'Đã xác minh và đối soát' : 'CHƯA ĐỦ DỮ LIỆU — chưa được phép công bố lợi nhuận'}
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {([
              ['Doanh thu ghi nhận', result.revenueVnd],
              ['Chi phí ghi nhận', result.expenseVnd],
              ['Lợi nhuận / lỗ', result.profitVnd],
            ] as const).map(([label, amount]) => (
              <div key={label} className="rounded-lg bg-slate-50 p-3">
                <p className="text-sm text-slate-600">{label}</p>
                <p className="mt-1 text-lg font-semibold">{ready ? money(amount) : '—'}</p>
              </div>
            ))}
          </div>
          {!ready && (
            <div className="mt-3 text-sm text-slate-700">
              <p>Chưa có chứng nhận đối soát tháng độc lập và dữ liệu ledger đầy đủ.</p>
              {result.reasons.length > 0 && <p>Mã kiểm tra: {result.reasons.join(', ')}</p>}
              {result.missingColumns.length > 0 && <p>Cột sổ cái cần xác minh: {result.missingColumns.join(', ')}</p>}
            </div>
          )}
        </>
      )}
    </section>
  );
}

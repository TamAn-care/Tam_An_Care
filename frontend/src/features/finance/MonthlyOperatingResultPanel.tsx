import { useEffect, useState } from 'react';
import { apiRequest, type RequestOptions } from '../../api/client';

type Metric={month:string;state:'READY'|'CHUA_DU_DU_LIEU';reconciliationStatus:'DA_DOI_SOAT'|'CHUA_DOI_SOAT';source:'POSTGRESQL';
 revenueVnd:string|null;directCostVnd:string|null;grossProfitVnd:string|null;payrollVnd:string|null;
 operatingExpenseVnd:string|null;ebitdaVnd:string|null;depreciationVnd:string|null;interestVnd:string|null;
 profitBeforeTaxVnd:string|null;taxVnd:string|null;netProfitVnd:string|null;netMarginPercent:string|null;
 expenseVnd:string|null;profitVnd:string|null;residentCount:number|null;bedOccupancyPercent:string|null;
 revenuePerResidentVnd:string|null;expensePerResidentVnd:string|null;breakEvenRevenueVnd:string|null;
 reasons:string[];missingColumns:string[];ledgerSchemaReady:boolean;updatedAt:string};
const INTEGER=/^-?(0|[1-9]\d*)$/;
const DECIMAL=/^-?(0|[1-9]\d*)(\.\d{1,4})?$/;
function money(value:string|null):string {
 if(value===null||!INTEGER.test(value))return 'Chưa đủ dữ liệu';
 return value.replace(/\B(?=(\d{3})+(?!\d))/g,'.')+' đ';
}
function percent(value:string|null):string{return value!==null&&DECIMAL.test(value)?value+'%':'Chưa đủ dữ liệu';}
const metrics:[string,keyof Metric][]=[
 ['Doanh thu ghi nhận','revenueVnd'],['Chi phí trực tiếp','directCostVnd'],['Lợi nhuận gộp','grossProfitVnd'],
 ['Chi phí nhân sự','payrollVnd'],['Chi phí vận hành','operatingExpenseVnd'],['EBITDA','ebitdaVnd'],
 ['Khấu hao','depreciationVnd'],['Lãi vay','interestVnd'],['Lợi nhuận trước thuế','profitBeforeTaxVnd'],
 ['Thuế','taxVnd'],['Lợi nhuận ròng','netProfitVnd'],['Biên lợi nhuận','netMarginPercent'],
 ['Số người cao tuổi trong kỳ','residentCount'],['Công suất sử dụng giường','bedOccupancyPercent'],
 ['Doanh thu bình quân/người','revenuePerResidentVnd'],['Chi phí bình quân/người','expensePerResidentVnd'],
 ['Điểm hòa vốn','breakEvenRevenueVnd'],
];
export function MonthlyOperatingResultPanel({month,options,revision}:{month:string;options:RequestOptions;revision:number}){
 const [result,setResult]=useState<Metric|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState<string|null>(null);
 useEffect(()=>{
  let active=true;setLoading(true);setResult(null);setError(null);
  apiRequest<unknown>('/api/finance-read/operating-result/month/'+month,{...options,method:'GET'})
   .then(payload=>{
    if(!payload||typeof payload!=='object'||Array.isArray(payload))throw new Error('INVALID_MONTHLY_RESULT');
    const item=payload as Partial<Metric>;
    if(item.source!=='POSTGRESQL'||item.month!==month||(item.state!=='READY'&&item.state!=='CHUA_DU_DU_LIEU')||
      !Array.isArray(item.reasons)||!Array.isArray(item.missingColumns))throw new Error('INVALID_MONTHLY_RESULT');
    const amounts=['revenueVnd','directCostVnd','grossProfitVnd','payrollVnd','operatingExpenseVnd','ebitdaVnd',
      'depreciationVnd','interestVnd','profitBeforeTaxVnd','taxVnd','netProfitVnd','expenseVnd','profitVnd'];
    if(item.state==='READY'&&(!amounts.every(key=>typeof item[key as keyof Metric]==='string'&&INTEGER.test(item[key as keyof Metric] as string))||
      item.reasons.length!==0||item.ledgerSchemaReady!==true))throw new Error('UNVERIFIED_MONTHLY_RESULT');
    if(active)setResult(item as Metric);
   }).catch(()=>{if(active)setError('Báo cáo chưa được xác minh hoặc không thể truy cập. Không hiển thị số tiền.');})
   .finally(()=>{if(active)setLoading(false);});
  return()=>{active=false;};
 },[month,options,revision]);
 const ready=result?.state==='READY'&&!loading&&!error;
 return <section aria-label="Kết quả kinh doanh tháng" className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
  <h2 className="text-lg font-semibold text-slate-900">Kết quả kinh doanh tháng {month}</h2>
  <p className="mt-1 text-sm text-slate-600">Nguồn sổ cái ghi nhận PostgreSQL; tiền thu không được tính thay doanh thu.</p>
  {loading&&<p role="status" className="mt-3">Đang xác minh dữ liệu tài chính...</p>}
  {error&&<p role="alert" className="mt-3 text-amber-800">{error}</p>}
  {!loading&&!error&&result&&<>
   <p role="status" className="mt-3 font-medium">{result.reconciliationStatus==='DA_DOI_SOAT'?'ĐÃ ĐỐI SOÁT':'CHƯA ĐỐI SOÁT'} · {ready?'Đã xác minh':'CHƯA ĐỦ DỮ LIỆU — chưa được phép công bố lợi nhuận'}</p>
   <dl className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{metrics.map(([label,key])=>{
    const raw=result[key];
    const value=key==='netMarginPercent'||key==='bedOccupancyPercent'?percent(typeof raw==='string'?raw:null):
      key==='residentCount'?(typeof raw==='number'?raw.toLocaleString('vi-VN'):'Chưa đủ dữ liệu'):money(typeof raw==='string'?raw:null);
    return <div key={key} className="rounded-lg bg-slate-50 p-3"><dt className="text-sm text-slate-600">{label}</dt>
      <dd className="mt-1 text-lg font-semibold">{ready?value:'Chưa đủ dữ liệu'}</dd></div>;
   })}</dl>
   {!ready&&<div className="mt-3 text-sm text-slate-700">
    <p>Không đổi dữ liệu thiếu thành 0. Lợi nhuận chỉ công bố sau khi xác minh đủ sổ cái, chứng từ và đối soát kỳ.</p>
    {result.reasons.length>0&&<p>Thiếu bằng chứng: {result.reasons.join(', ')}</p>}
    {result.missingColumns.length>0&&<p>Cột ledger cần xác minh: {result.missingColumns.join(', ')}</p>}
   </div>}
   <p className="mt-2 text-xs text-slate-500">Cập nhật lúc: {new Date(result.updatedAt).toLocaleString('vi-VN')}</p>
  </>}
 </section>;
}

import { useState } from 'react';
/** V3.8.18.14 isolated form preview. No API calls, no persistence, no seed.
 * Deliberately NOT registered in Production Test router.
 */
type Kind='PAYROLL'|'REVENUE'|'OPERATING_EXPENSE'|'DIRECT_COST';
const isMoney=(x:string)=>/^(0|[1-9]\d*)$/.test(x);
export default function FinanceManualDraftPreview(){
 const [kind,setKind]=useState<Kind>('PAYROLL');
 const [base,setBase]=useState('');
 const [allowance,setAllowance]=useState('0');
 const [bonus,setBonus]=useState('0');
 const [deduct,setDeduct]=useState('0');
 const [other,setOther]=useState('');
 const [description,setDescription]=useState('');
 const [month,setMonth]=useState('');
 const [evidence,setEvidence]=useState('INTERNAL_VOUCHER');
 const validSalary=[base,allowance,bonus,deduct].every(isMoney);
 const gross=validSalary?BigInt(base)+BigInt(allowance)+BigInt(bonus):null;
 const net=gross!==null&&BigInt(deduct)<=gross?gross-BigInt(deduct):null;
 const valid=kind==='PAYROLL'?net!==null:isMoney(other);
 const label=(n:bigint|null)=>n===null?'Chưa đủ số liệu':n.toLocaleString('vi-VN')+' đ';
 return <section style={{maxWidth:760,margin:'auto',padding:24}}>
 <h2>Phiếu tài chính — bản nháp kiểm thử</h2>
 <p role="status">Chưa lưu lên hệ thống. Không tự động duyệt hoặc hạch toán.</p>
 <label>Loại chứng từ <select value={kind} onChange={e=>setKind(e.target.value as Kind)}>
 <option value="PAYROLL">Lương thỏa thuận</option><option value="OPERATING_EXPENSE">Chi phí vận hành</option>
 <option value="DIRECT_COST">Chi phí trực tiếp</option><option value="REVENUE">Thu nhập khác</option>
 </select></label>
 <p><label>Kỳ ghi nhận (YYYY-MM) <input type="month" value={month} onChange={e=>setMonth(e.target.value)}/></label></p>
 {kind==='PAYROLL'?<fieldset><legend>Khoản lương thỏa thuận (không bắt buộc theo ca)</legend>
 {([
 ['Lương thỏa thuận',base,setBase],['Phụ cấp',allowance,setAllowance],
 ['Thưởng',bonus,setBonus],['Khấu trừ',deduct,setDeduct]
 ] as const).map(([name,value,setValue])=><p key={name}><label>{name} (VND) <input inputMode="numeric" value={value} onChange={e=>setValue(e.target.value)}/></label></p>)}
 <p><strong>Tổng trước khấu trừ: {label(gross)}</strong></p>
 <p><strong>Thực lĩnh dự kiến: {label(net)}</strong></p>
 </fieldset>:<p><label>Số tiền VND <input inputMode="numeric" value={other} onChange={e=>setOther(e.target.value)}/></label></p>}
 <p><label>Chứng từ căn cứ <select value={evidence} onChange={e=>setEvidence(e.target.value)}>
 <option value="INTERNAL_VOUCHER">Phiếu nội bộ (không có hóa đơn)</option>
 <option value="SUPPLIER_INVOICE">Hóa đơn nhà cung cấp</option>
 <option value="SIGNED_AGREEMENT">Thỏa thuận đã ký</option>
 </select></label></p>
 <p><label>Diễn giải nghiệp vụ <textarea value={description} onChange={e=>setDescription(e.target.value)} rows={3}/></label></p>
 <p>{valid&&month&&description.trim().length>=8?'Đã đủ thông tin cơ bản để chuẩn bị chứng từ nháp; chưa có lưu trữ/phê duyệt.':'Vui lòng nhập số tiền, kỳ và nội dung nghiệp vụ hợp lệ.'}</p>
 <button type="button" disabled title="Chưa có API lưu chứng từ được phê duyệt">Lưu nháp (chưa kích hoạt)</button>
 </section>;
}

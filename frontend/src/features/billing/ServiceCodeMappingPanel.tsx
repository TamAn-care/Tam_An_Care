import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../../api/client';
import type { HumanActorSession } from '../../types/actor';

type PriceItem={serviceCode:string;name:string;scope:string;unit:string;amountVnd:string};
type PriceVersion={priceListId:string;code:string;version:number;status:string;effectiveFrom:string;effectiveTo:string|null;items:PriceItem[]};
type Mapping={mappingId:string;version:number;sourceDomain:string;sourceEntityId:string;serviceCode:string;serviceScope:string;priceListId:string;priceListVersion:number;effectiveFrom:string;effectiveTo:string|null;status:string;changeReason:string;sourceEvidenceRef:string|null};
const mappingUrl='/api/finance/service-mappings';
const priceUrl='/api/finance/service-prices';
const domains=['ROOM_TYPE','CARE_LEVEL','MEAL_PLAN','MEAL_CHARGE_TYPE'];
const status:Record<string,string>={DRAFT:'Bản nháp',PENDING_APPROVAL:'Chờ phê duyệt',APPROVED:'Đã phê duyệt',REJECTED:'Từ chối',SUPERSEDED:'Được thay thế'};

/** Effective-dated service mappings; backend enforces the same role and evidence checks. */
export function ServiceCodeMappingPanel({actor}:{actor:HumanActorSession|null}){
  const client=useQueryClient();
  const [domain,setDomain]=useState('ROOM_TYPE');const [sourceId,setSourceId]=useState('');const [mappingId,setMappingId]=useState('');const [priceVersion,setPriceVersion]=useState('');const [serviceCode,setServiceCode]=useState('');
  const [from,setFrom]=useState('');const [to,setTo]=useState('');const [supersedeFrom,setSupersedeFrom]=useState('');const [reason,setReason]=useState('');const [evidence,setEvidence]=useState('');const [message,setMessage]=useState('');
  const prices=useQuery({queryKey:['finance-service-prices'],queryFn:()=>apiRequest<PriceVersion[]>(priceUrl,{actor})});
  const mappings=useQuery({queryKey:['finance-service-mappings'],queryFn:()=>apiRequest<Mapping[]>(mappingUrl,{actor})});
  const versions=(prices.data??[]).filter(x=>x.status==='APPROVED');
  const chosen=versions.find(v=>`${v.priceListId}:${v.version}`===priceVersion);
  const expectedScope=domain==='ROOM_TYPE'?'ROOM':domain==='CARE_LEVEL'?'CARE':'MEAL';
  const sourceMappingIds=[...new Set((mappings.data??[]).filter(m=>m.sourceDomain===domain&&m.sourceEntityId===sourceId.trim()).map(m=>m.mappingId))];
  const items=useMemo(()=>chosen?.items.filter(i=>i.scope===expectedScope)??[],[chosen,expectedScope]);
  const refresh=async()=>{await client.invalidateQueries({queryKey:['finance-service-mappings']});};
  const create=useMutation({mutationFn:()=>apiRequest<{mappingId:string;version:number}>(mappingUrl,{actor,method:'POST',body:JSON.stringify({...(mappingId?{mappingId}:{}),sourceDomain:domain,sourceEntityId:sourceId.trim(),serviceCode,priceListId:chosen?.priceListId,priceListVersion:chosen?.version,effectiveFrom:from,effectiveTo:to||null,changeReason:reason,sourceEvidenceRef:evidence.trim()||null})}),onSuccess:async(result)=>{setMessage(`Đã lưu mapping nháp trên máy chủ · ${result.mappingId} v${result.version}.`);setReason('');await refresh();},onError:(e:Error)=>setMessage(e.message)});
  const action=useMutation({mutationFn:({row,verb}:{row:Mapping;verb:'submit'|'approve'|'reject'|'supersede'})=>apiRequest(`${mappingUrl}/${encodeURIComponent(row.mappingId)}/versions/${row.version}/${verb}`,{actor,method:'POST',body:JSON.stringify(verb==='submit'?{}:verb==='supersede'?{effectiveFrom:supersedeFrom,reason}:{reason})}),onSuccess:async()=>{setMessage('Thao tác đã được máy chủ xác nhận.');setReason('');await refresh();},onError:(e:Error)=>setMessage(e.message)});
  return <section className="card" style={{padding:'1rem',marginBottom:'1rem'}} aria-labelledby="service-code-mapping-title">
    <h2 id="service-code-mapping-title">Ánh xạ loại phòng, chăm sóc và tiền ăn</h2>
    <p>Chỉ mapping đã phê duyệt, trỏ tới mã dịch vụ trong phiên bản bảng giá hợp lệ, mới đủ điều kiện cho bộ tính phí. Màn hình không tự suy ra mã từ tên.</p>
    <p>Room type và care level được xác minh từ nguồn canonical hiện hữu. Mapping tiền ăn đang khóa vì chưa xác định được bảng nguồn meal-plan/meal-charge chính thức.</p>
    {mappings.isError&&<div role="alert">Không đọc được mapping: {(mappings.error as Error).message}</div>}
    {mappings.data&&<div style={{overflowX:'auto'}}><table><thead><tr><th>Nguồn</th><th>Dịch vụ</th><th>Bảng giá</th><th>Hiệu lực</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>{mappings.data.map(row=><tr key={`${row.mappingId}:${row.version}`}><td>{row.sourceDomain}: {row.sourceEntityId}</td><td>{row.serviceCode} / {row.serviceScope}</td><td>{row.priceListId} v{row.priceListVersion}</td><td>{row.effectiveFrom} – {row.effectiveTo||'không thời hạn'}</td><td>{status[row.status]??row.status}</td><td>{row.status==='DRAFT'&&<button type="button" onClick={()=>action.mutate({row,verb:'submit'})} disabled={action.isPending}>Trình duyệt</button>}{row.status==='PENDING_APPROVAL'&&<><button type="button" onClick={()=>action.mutate({row,verb:'approve'})} disabled={action.isPending||reason.trim().length<5}>Phê duyệt</button><button type="button" onClick={()=>action.mutate({row,verb:'reject'})} disabled={action.isPending||reason.trim().length<5}>Từ chối</button></>}{row.status==='APPROVED'&&<button type="button" onClick={()=>action.mutate({row,verb:'supersede'})} disabled={action.isPending||!supersedeFrom||reason.trim().length<5}>Thay thế từ ngày</button>}</td></tr>)}</tbody></table></div>}
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:8,marginTop:16}}>
      <label>Miền nguồn<select value={domain} onChange={e=>{setDomain(e.target.value);setServiceCode('');setPriceVersion('');setMappingId('');}}>{domains.map(x=><option key={x}>{x}</option>)}</select></label>
      <label>Mã canonical chính xác<input value={sourceId} onChange={e=>{setSourceId(e.target.value);setMappingId('');}} placeholder="Nhập ID/key có thật từ nguồn" /></label>
      <label>Mapping đang được version hóa<select value={mappingId} onChange={e=>setMappingId(e.target.value)}><option value="">Tạo mapping mới</option>{sourceMappingIds.map(id=><option key={id} value={id}>{id} · version tiếp theo</option>)}</select></label>
      <label>Bảng giá đã duyệt<select value={priceVersion} onChange={e=>{setPriceVersion(e.target.value);setServiceCode('');}}><option value="">Chọn phiên bản</option>{versions.map(v=><option key={`${v.priceListId}:${v.version}`} value={`${v.priceListId}:${v.version}`}>{v.code} · v{v.version} · {v.effectiveFrom}</option>)}</select></label>
      <label>Mã dịch vụ trong bảng giá<select value={serviceCode} onChange={e=>setServiceCode(e.target.value)}><option value="">Chọn mã</option>{items.map(i=><option key={i.serviceCode} value={i.serviceCode}>{i.serviceCode} · {i.name} · {i.amountVnd} VND/{i.unit}</option>)}</select></label>
      <label>Hiệu lực từ<input type="date" value={from} onChange={e=>setFrom(e.target.value)} /></label>
      <label>Hiệu lực đến (để trống nếu không hạn)<input type="date" value={to} onChange={e=>setTo(e.target.value)} /></label>
      <label>Ngày hiệu lực mapping mới khi thay thế<input type="date" value={supersedeFrom} onChange={e=>setSupersedeFrom(e.target.value)} /></label>
      <label>Lý do thay đổi<input value={reason} onChange={e=>setReason(e.target.value)} maxLength={1000} /></label>
      <label>Tham chiếu bằng chứng (nếu có)<input value={evidence} onChange={e=>setEvidence(e.target.value)} maxLength={200} /></label>
    </div>
    <button type="button" onClick={()=>create.mutate()} disabled={create.isPending||!sourceId.trim()||!chosen||!serviceCode||!from||reason.trim().length<5}>Tạo mapping nháp</button>
    {message&&<p role="status">{message}</p>}
  </section>;
}

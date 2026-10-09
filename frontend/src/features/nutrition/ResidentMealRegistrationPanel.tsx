import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useActor } from '../../auth/ActorContext';
import { listResidents } from '../../api/residents';
import { listResidentMeals, getResidentMealTotals, registerResidentMeal, updateResidentMeal, cancelResidentMeal, MealType } from '../../api/resident-meal-registrations';

const MEALS: {id:MealType; label:string}[] = [
  {id:'BREAKFAST',label:'Sáng'}, {id:'MORNING_SNACK',label:'Phụ sáng'},
  {id:'LUNCH',label:'Trưa'}, {id:'AFTERNOON_SNACK',label:'Phụ chiều'},
  {id:'DINNER',label:'Tối'}, {id:'EVENING_SNACK',label:'Phụ tối'},
];

export function ResidentMealRegistrationPanel() {
  const {actor}=useActor();
  const qc=useQueryClient();
  const role=actor?.actorRole;
  const canEdit=role==='CAREGIVER'||role==='CARE_MANAGER';
  const canUse=canEdit||role==='SUPERVISOR'||role==='NUTRITIONIST';
  const [date,setDate]=useState(()=>new Date().toLocaleDateString('en-CA'));
  const [residentId,setResidentId]=useState('');
  const [mealType,setMealType]=useState<MealType>('LUNCH');
  const [portions,setPortions]=useState(1);
  const [note,setNote]=useState('');
  const [error,setError]=useState('');
  const q=useQuery({queryKey:['real-resident-meals',actor?.actorId,date],
    queryFn:()=>listResidentMeals(actor!,date),enabled:!!actor&&canUse,retry:false});
  const totals=useQuery({queryKey:['real-resident-meal-totals',date],
    queryFn:()=>getResidentMealTotals(actor!,date),
    enabled:!!actor&&['CARE_MANAGER','SUPERVISOR','NUTRITIONIST'].includes(role||''),retry:false});
  const residents=useQuery({queryKey:['meal-residents',actor?.actorId],
    queryFn:()=>listResidents(actor!),enabled:!!actor&&canEdit,retry:false});
  const reload=()=>{qc.invalidateQueries({queryKey:['real-resident-meals']});qc.invalidateQueries({queryKey:['real-resident-meal-totals']});};
  const mutation=useMutation({mutationFn:async (op:{kind:'register'|'update'|'cancel';id?:string;revision?:number})=>{
    if(!actor) throw new Error('Chưa đăng nhập');
    if(op.kind==='register') return registerResidentMeal(actor,{residentId,mealDate:date,mealType,portions,note});
    if(!op.id||!op.revision) throw new Error('Bản ghi không hợp lệ');
    if(op.kind==='cancel') return cancelResidentMeal(actor,op.id,op.revision);
    return updateResidentMeal(actor,op.id,{portions,note,revision:op.revision});
  },onSuccess:()=>{setError('');reload();},onError:(e:Error)=>setError(e.message)});
  if(!actor||!canUse)return null;
  return <section style={{border:'1px solid #d1d5db',borderRadius:12,padding:16,background:'#fff'}}>
    <h3 style={{marginTop:0}}>Đăng ký suất ăn người cao tuổi — dữ liệu PostgreSQL</h3>
    <label>Ngày ăn: <input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label>
    {canEdit&&<div style={{display:'flex',flexWrap:'wrap',gap:8,marginTop:12,alignItems:'center'}}>
      <select aria-label="Chọn người cao tuổi" value={residentId} onChange={e=>setResidentId(e.target.value)}>
        <option value="">Chọn cụ cần đăng ký</option>
        {(residents.data||[]).map(r=><option key={r.resident.residentId} value={r.resident.residentId}>{r.resident.displayName}</option>)}
      </select>
      <select aria-label="Bữa ăn" value={mealType} onChange={e=>setMealType(e.target.value as MealType)}>
        {MEALS.map(m=><option key={m.id} value={m.id}>{m.label}</option>)}
      </select>
      <label>Số suất <input type="number" min={1} max={10} value={portions} onChange={e=>setPortions(Number(e.target.value))} style={{width:65}}/></label>
      <input aria-label="Ghi chú suất ăn" value={note} onChange={e=>setNote(e.target.value)} placeholder="Ghi chú (không thay đổi y lệnh)"/>
      <button disabled={!residentId||mutation.isPending||!Number.isSafeInteger(portions)||portions<1||portions>10} onClick={()=>mutation.mutate({kind:'register'})}>Đăng ký</button>
    </div>}
    {error&&<p role="alert" style={{color:'#b91c1c'}}>{error}</p>}
    {q.isError&&<p role="alert">Không đọc được dữ liệu suất ăn từ máy chủ. Không sử dụng số liệu giả thay thế.</p>}
    {q.isLoading&&<p>Đang lấy đăng ký thực tế...</p>}
    {q.isSuccess&&<div style={{overflowX:'auto',marginTop:12}}>
      {q.data.items.length===0?<p>Chưa có đăng ký hợp lệ được ghi nhận cho ngày này.</p>:
      <table style={{width:'100%',borderCollapse:'collapse'}}><thead><tr><th>Mã cụ</th><th>Bữa</th><th>Số suất</th><th>Trạng thái</th><th>Ghi chú</th><th>Thao tác</th></tr></thead>
        <tbody>{q.data.items.map(r=><tr key={r.registration_id}>
          <td>{r.resident_id}</td><td>{MEALS.find(m=>m.id===r.meal_type)?.label||r.meal_type}</td>
          <td>{r.portions}</td><td>{r.status==='REGISTERED'?'Đã đăng ký':'Đã hủy'}</td><td>{r.note}</td>
          <td>{canEdit&&r.status==='REGISTERED'?<div style={{display:'flex',gap:6}}>
            <button disabled={mutation.isPending} onClick={()=>{if(window.confirm('Cập nhật số suất theo các ô nhập phía trên?'))mutation.mutate({kind:'update',id:r.registration_id,revision:r.revision});}}>Cập nhật</button>
            <button disabled={mutation.isPending} onClick={()=>{if(window.confirm('Xác nhận hủy đăng ký?'))mutation.mutate({kind:'cancel',id:r.registration_id,revision:r.revision});}}>Hủy</button>
          </div>: 'Chỉ xem'}</td>
        </tr>)}</tbody></table>}
    </div>}
    {totals.isSuccess&&<div style={{marginTop:12}}><strong>Tổng hợp bếp: </strong>
      {totals.data.items.map(x=>`${MEALS.find(m=>m.id===x.meal_type)?.label||x.meal_type}: ${x.portions} suất / ${x.residents} cụ`).join(' • ')||'Chưa có đăng ký'}</div>}
    {totals.isError&&<p role="alert">Không thể tải tổng hợp suất ăn thực tế.</p>}
  </section>;
}

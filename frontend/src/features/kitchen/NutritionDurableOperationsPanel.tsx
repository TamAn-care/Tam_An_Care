import React, { useState } from 'react';
import type { HumanActorSession } from '../../types/actor';
import {
  acknowledgeTray,
  collectNutritionSample,
  dispatchTray,
  disposeNutritionSample,
  inspectNutritionHygiene,
  inspectNutritionSample,
  recordNutritionHygiene,
} from '../../api/nutrition-operations';

export function NutritionDurableOperationsPanel({ actor }: { actor: HumanActorSession | null }) {
  const [residentId, setResidentId] = useState('');
  const [registrationId, setRegistrationId] = useState('');
  const [dispatchId, setDispatchId] = useState('');
  const [sampleId, setSampleId] = useState('');
  const [recordId, setRecordId] = useState('');
  const [floor, setFloor] = useState('');
  const [portions, setPortions] = useState(1);
  const [message, setMessage] = useState('');
  const role = actor?.actorRole;

  if (!actor || !['NUTRITIONIST', 'CAREGIVER', 'CARE_MANAGER', 'SUPERVISOR'].includes(role || '')) return null;
  const run = async (action: () => Promise<unknown>) => {
    setMessage('Đang xử lý…');
    try { await action(); setMessage('Đã ghi nhận bền vững qua API.'); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Không thể ghi nhận thao tác.'); }
  };

  return (
    <section aria-label="Nutrition durable operations" style={{ marginBottom: '1rem', padding: '1rem', border: '1px solid #cbd5e1', borderRadius: 12, background: '#f8fafc' }}>
      <h3 style={{ marginTop: 0 }}>Nghiệp vụ dinh dưỡng bền vững</h3>
      <p style={{ color: '#475569' }}>Các thao tác dưới đây ghi trực tiếp qua API và không dùng dữ liệu mô phỏng.</p>
      {message && <p role="status">{message}</p>}
      {(role === 'NUTRITIONIST' || role === 'CARE_MANAGER') && (
        <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))' }}>
          <input aria-label="Resident ID" placeholder="Resident ID" value={residentId} onChange={e => setResidentId(e.target.value)} />
          <input aria-label="Meal registration ID" placeholder="Meal registration ID" value={registrationId} onChange={e => setRegistrationId(e.target.value)} />
          <input aria-label="Destination floor" placeholder="Destination floor" value={floor} onChange={e => setFloor(e.target.value)} />
          <input aria-label="Portions" type="number" min={1} max={10} value={portions} onChange={e => setPortions(Number(e.target.value))} />
          <button type="button" onClick={() => run(() => dispatchTray(actor, { registrationId, destinationFloor: floor, portions }))}>Ghi nhận xuất khay</button>
          <button type="button" onClick={() => run(() => recordNutritionHygiene(actor, { residentId, taskReference: 'NUTRITION_HYGIENE', status: 'COMPLETED' }))}>Tự xác nhận vệ sinh</button>
          <button type="button" onClick={() => run(() => collectNutritionSample(actor, { residentId, registrationId, mealDate: new Date().toISOString().slice(0, 10), mealType: 'LUNCH' }))}>Ghi nhận lấy mẫu 24 giờ</button>
        </div>
      )}
      {role === 'CAREGIVER' && <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))' }}>
        <input aria-label="Dispatch ID" placeholder="Dispatch ID" value={dispatchId} onChange={e => setDispatchId(e.target.value)} />
        <input aria-label="Assigned floor" placeholder="Assigned floor" value={floor} onChange={e => setFloor(e.target.value)} />
        <input aria-label="Received portions" type="number" min={0} value={portions} onChange={e => setPortions(Number(e.target.value))} />
        <button type="button" onClick={() => run(() => acknowledgeTray(actor, dispatchId, { floor, receivedPortions: portions }))}>Xác nhận nhận khay</button>
      </div>}
      {role === 'CARE_MANAGER' && <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', marginTop: 8 }}>
        <input aria-label="Hygiene record ID" placeholder="Hygiene record ID" value={recordId} onChange={e => setRecordId(e.target.value)} />
        <input aria-label="Sample ID" placeholder="Sample ID" value={sampleId} onChange={e => setSampleId(e.target.value)} />
        <button type="button" onClick={() => run(() => inspectNutritionHygiene(actor, { recordId, finding: 'Đã kiểm tra', decision: 'CONFIRMED' }))}>Kiểm tra vệ sinh</button>
        <button type="button" onClick={() => run(() => inspectNutritionSample(actor, { sampleId, finding: 'Đã kiểm tra thời gian lưu' }))}>Kiểm tra mẫu lưu</button>
        <button type="button" onClick={() => run(() => disposeNutritionSample(actor, sampleId))}>Ghi nhận hủy mẫu</button>
      </div>}
    </section>
  );
}

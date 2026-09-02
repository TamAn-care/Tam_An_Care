import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useActor } from '../../auth/ActorContext';
import {
  dischargeResident,
  listLifecycleHistory,
  listLifecycleResidents,
  listResidentCarePlans,
  updateResidentCarePlan,
  type CarePlanItem,
} from '../../api/resident-lifecycle';

export default function ResidentLifecyclePage() {
  const { actor } = useActor();
  const qc = useQueryClient();
  const [offset, setOffset] = useState(0);
  const [residentId, setResidentId] = useState('');
  const [reason, setReason] = useState('END_OF_SERVICE');
  const [note, setNote] = useState('');
  const [destination, setDestination] = useState('');
  const [confirmDischarge, setConfirmDischarge] = useState(false);
  const [planId, setPlanId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  const residents = useQuery({
    queryKey: ['resident-lifecycle-residents', offset],
    enabled: !!actor,
    queryFn: () => listLifecycleResidents(actor!, 100, offset),
  });

  const selected = useMemo(
    () => residents.data?.items.find(x => x.resident.residentId === residentId)?.resident,
    [residents.data, residentId],
  );

  const plans = useQuery({
    queryKey: ['resident-lifecycle-plans', residentId],
    enabled: !!actor && !!residentId,
    queryFn: () => listResidentCarePlans(actor!, residentId),
  });

  const history = useQuery({
    queryKey: ['resident-lifecycle-history', residentId],
    enabled: !!actor && !!residentId,
    queryFn: () => listLifecycleHistory(actor!, residentId),
  });

  const chosenPlan = plans.data?.items.find(x => x.carePlanId === planId);

  const updatePlan = useMutation({
    mutationFn: () =>
      updateResidentCarePlan(actor!, planId, {
        expectedUpdatedAt: chosenPlan!.updatedAt,
        title,
        description,
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['resident-lifecycle-plans', residentId] });
    },
  });

  const discharge = useMutation({
    mutationFn: () =>
      dischargeResident(actor!, residentId, { reason, note, destination }),
    onSuccess: async () => {
      setConfirmDischarge(false);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['resident-lifecycle-residents'] }),
        qc.invalidateQueries({ queryKey: ['resident-lifecycle-history', residentId] }),
        qc.invalidateQueries({ queryKey: ['residents'] }),
        qc.invalidateQueries({ queryKey: ['accommodation-overview'] }),
      ]);
    },
  });

  function choosePlan(p: CarePlanItem) {
    setPlanId(p.carePlanId);
    setTitle(p.title);
    setDescription(p.description ?? '');
  }

  if (!actor) {
    return <main><div className="notice notice-info">Cần đăng nhập bằng tài khoản nhân sự để quản lý vòng đời người cao tuổi.</div></main>;
  }

  return (
    <main>
      <header className="page-header">
        <div className="eyebrow">Resident Lifecycle</div>
        <h1 className="page-title">Vòng đời người cao tuổi</h1>
        <p className="page-description">
          Cập nhật kế hoạch chăm sóc, theo dõi lịch sử và kết thúc dịch vụ có kiểm soát.
        </p>
      </header>

      <section className="card">
        <label className="field-group">
          <span className="field-label">Người cao tuổi</span>
          <select className="text-input" value={residentId} onChange={e => {
            setResidentId(e.target.value); setPlanId('');
          }}>
            <option value="">Chọn hồ sơ</option>
            {(residents.data?.items ?? []).map(({ resident }) => (
              <option key={resident.residentId} value={resident.residentId}>
                {resident.residentCode} — {resident.displayName} — {resident.activeStatus ? 'Đang hoạt động' : 'Đã kết thúc'}
              </option>
            ))}
          </select>
        </label>
        <div>
          <button className="button button-subtle" disabled={offset === 0}
            onClick={() => setOffset(Math.max(0, offset - 100))}>Trang trước</button>{' '}
          <button className="button button-subtle"
            disabled={!residents.data || offset + 100 >= residents.data.total}
            onClick={() => setOffset(offset + 100)}>Trang sau</button>
        </div>
      </section>

      {selected && (
        <>
          <section className="card">
            <h2>Kế hoạch chăm sóc</h2>
            {(plans.data?.items ?? []).map(p => (
              <div key={p.carePlanId} style={{ marginBottom: 12 }}>
                <button className="button button-subtle" onClick={() => choosePlan(p)}>
                  {p.planCode} — {p.title} — {p.status}
                </button>
              </div>
            ))}
            {chosenPlan && (
              <div>
                <label className="field-group">
                  <span className="field-label">Tiêu đề</span>
                  <input className="text-input" value={title} onChange={e => setTitle(e.target.value)} />
                </label>
                <label className="field-group">
                  <span className="field-label">Nội dung</span>
                  <textarea className="text-input" value={description} onChange={e => setDescription(e.target.value)} />
                </label>
                <button className="button" disabled={updatePlan.isPending || !title.trim()}
                  onClick={() => updatePlan.mutate()}>
                  {updatePlan.isPending ? 'Đang lưu…' : 'Cập nhật kế hoạch'}
                </button>
              </div>
            )}
          </section>

          <section className="card">
            <h2>Lịch sử vòng đời</h2>
            {(history.data as any)?.items?.length
              ? (history.data as any).items.map((e: any) => (
                  <div key={e.lifecycleEventId}>
                    <strong>{e.eventType}</strong> — {e.reason} — {String(e.effectiveAt)}
                  </div>
                ))
              : <p>Chưa có sự kiện kết thúc dịch vụ.</p>}
          </section>

          {selected.activeStatus && (
            <section className="card">
              <h2>Kết thúc dịch vụ / Bàn giao về gia đình</h2>
              {actor?.actorRole === 'SUPERVISOR' ? (
                <>
                  <label className="field-group">
                    <span className="field-label">Lý do</span>
                    <select className="text-input" value={reason} onChange={e => setReason(e.target.value)}>
                      <option value="END_OF_SERVICE">Kết thúc dịch vụ</option>
                      <option value="RETURN_HOME">Về gia đình</option>
                      <option value="TRANSFER_FACILITY">Chuyển cơ sở khác</option>
                      <option value="HOSPITAL_TRANSFER">Chuyển bệnh viện</option>
                      <option value="OTHER">Khác</option>
                    </select>
                  </label>
                  <label className="field-group">
                    <span className="field-label">Nơi chuyển đến</span>
                    <input className="text-input" value={destination} onChange={e => setDestination(e.target.value)} />
                  </label>
                  <label className="field-group">
                    <span className="field-label">Ghi chú</span>
                    <textarea className="text-input" value={note} onChange={e => setNote(e.target.value)} />
                  </label>
                  <label>
                    <input type="checkbox" checked={confirmDischarge}
                      onChange={e => setConfirmDischarge(e.target.checked)} />{' '}
                    Tôi xác nhận kết thúc dịch vụ cho hồ sơ này.
                  </label>
                  <div style={{ marginTop: 12 }}>
                    <button className="button button-danger" disabled={!confirmDischarge || discharge.isPending}
                      onClick={() => discharge.mutate()}>
                      {discharge.isPending ? 'Đang xử lý…' : 'Phê duyệt kết thúc dịch vụ'}
                    </button>
                  </div>
                </>
              ) : (
                <div className="notice notice-warning">
                  Chỉ Giám sát / Ban Giám đốc mới có thẩm quyền ký duyệt kết thúc dịch vụ hoặc bàn giao người cao tuổi.
                </div>
              )}
            </section>
          )}
        </>
      )}
    </main>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { triggerPrint } from '../../utils/print';
import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import {
  assignBed,
  createBed,
  createBuilding,
  createFloor,
  createRoom,
  getAccommodationOverview,
  listBuildings,
  listFloors,
  listRooms,
  releaseBed,
  setBedStatus,
  transferBed,
} from '../../api/accommodation';

import { listResidents } from '../../api/residents';
import { useActor } from '../../auth/ActorContext';
import { formatCareLevel } from '../residents/resident-ui';
import { hasCapability } from '../../auth/role-policy';

const PAGE_SIZE = 250;

const BED_STATUS_LABEL: Record<string, { label: string; badgeClass: string }> = {
  AVAILABLE: { label: 'CÒN TRỐNG', badgeClass: 'badge badge-success' },
  UNOCCUPIED: { label: 'CÒN TRỐNG', badgeClass: 'badge badge-success' },
  OCCUPIED: { label: 'ĐANG SỬ DỤNG', badgeClass: 'badge badge-danger' },
  RESERVED: { label: 'ĐÃ GIỮ CHỖ', badgeClass: 'badge badge-warning' },
  TEMPORARILY_UNAVAILABLE: { label: 'TẠM NGƯNG', badgeClass: 'badge badge-neutral' },
  MAINTENANCE: { label: 'BẢO TRÌ', badgeClass: 'badge badge-neutral' },
  INACTIVE: { label: 'NGƯNG SỬ DỤNG', badgeClass: 'badge badge-neutral' },
};

type Action =
  | { type: 'ASSIGN'; bedId: string }
  | {
      type: 'TRANSFER';
      residentId: string;
      bedId: string;
    }
  | {
      type: 'RELEASE';
      residentId: string;
      reason?: string;
    }
  | {
      type: 'STATUS';
      bedId: string;
      status:
        | 'AVAILABLE'
        | 'TEMPORARILY_UNAVAILABLE'
        | 'MAINTENANCE';
    };

export default function AccommodationPage() {
  const { actor } = useActor();
  const qc = useQueryClient();

  const [residentId,setResidentId] = useState('');
  const [buildingId,setBuildingId] = useState('ALL');
  const [floorId,setFloorId] = useState('ALL');
  const [roomId,setRoomId] = useState('ALL');
  const [status,setStatus] = useState('ALL');
  const [search,setSearch] = useState('');
  const [offset,setOffset] = useState(0);

  const [bCode,setBCode] = useState('');
  const [bName,setBName] = useState('');
  const [fBuilding,setFBuilding] = useState('');
  const [fCode,setFCode] = useState('');
  const [fName,setFName] = useState('');
  const [rFloor,setRFloor] = useState('');
  const [rCode,setRCode] = useState('');
  const [rName,setRName] = useState('');
  const [bedRoom,setBedRoom] = useState('');
  const [bedCode,setBedCode] = useState('');
  const [bedName,setBedName] = useState('');

  const [releaseTarget, setReleaseTarget] = useState<{
    residentId: string;
    residentName: string;
    bedCode: string;
    roomName: string;
    floorName?: string;
  } | null>(null);

  const [releaseReason, setReleaseReason] = useState('Hồi phục sức khỏe về với gia đình');

  const [transferTarget, setTransferTarget] = useState<{
    residentId: string;
    residentName: string;
    currentBedCode: string;
    currentRoomName: string;
    targetBedId: string;
  } | null>(null);

  useEffect(() => {
    setOffset(0);
  }, [buildingId,floorId,roomId,status,search]);

  const overview = useQuery({
    queryKey: [
      'accommodation-overview',
      buildingId,
      floorId,
      roomId,
      status,
      search,
      offset,
    ],
    queryFn: () => getAccommodationOverview(
      actor!,
      {
        buildingId,
        floorId,
        roomId,
        status,
        search,
        limit: PAGE_SIZE,
        offset,
      },
    ),
    enabled: Boolean(actor),
  });

  const buildings = useQuery({
    queryKey: ['accommodation-buildings'],
    queryFn: () => listBuildings(actor!),
    enabled: Boolean(actor),
  });

  const floors = useQuery({
    queryKey: ['accommodation-floors',buildingId],
    queryFn: () => listFloors(
      actor!,
      buildingId === 'ALL' ? undefined : buildingId,
    ),
    enabled: Boolean(actor),
  });

  const rooms = useQuery({
    queryKey: ['accommodation-rooms',floorId],
    queryFn: () => listRooms(
      actor!,
      floorId === 'ALL' ? undefined : floorId,
    ),
    enabled: Boolean(actor),
  });

  const residents = useQuery({
    queryKey: ['residents','accommodation'],
    queryFn: () => listResidents(actor),
    enabled: Boolean(actor),
  });

  const selectedResident =
    overview.data?.items.find(
      x => x.residentId === residentId,
    );

  const currentResidentLocation = useMemo(() => {
    if (!residentId) return undefined;
    return overview.data?.items.find(
      x => x.residentId === residentId,
    );
  }, [overview.data,residentId]);

  async function refresh() {
    await qc.invalidateQueries({
      queryKey: ['accommodation-overview'],
    });
    await qc.invalidateQueries({
      queryKey: ['accommodation-buildings'],
    });
    await qc.invalidateQueries({
      queryKey: ['accommodation-floors'],
    });
    await qc.invalidateQueries({
      queryKey: ['accommodation-rooms'],
    });
    await qc.invalidateQueries({
      queryKey: ['residents'],
    });
  }

  const action = useMutation({
    mutationFn: async (a: Action) => {
      if (!actor) {
        throw new Error(
          'Chưa xác định nhân viên thao tác.',
        );
      }

      if (a.type === 'ASSIGN') {
        if (!residentId) {
          throw new Error(
            'Chọn người cao tuổi trước.',
          );
        }
        return assignBed(
          actor,
          a.bedId,
          residentId,
        );
      }

      if (a.type === 'TRANSFER') {
        return transferBed(
          actor,
          a.residentId,
          a.bedId,
        );
      }

      if (a.type === 'RELEASE') {
        return releaseBed(
          actor,
          a.residentId,
          a.reason || 'Chia tay Tâm An & Trả giường',
        );
      }

      return setBedStatus(
        actor,
        a.bedId,
        a.status,
      );
    },
    onSuccess: refresh,
  });

  const setup = useMutation({
    mutationFn: async (
      kind:
        | 'BUILDING'
        | 'FLOOR'
        | 'ROOM'
        | 'BED',
    ) => {
      if (!actor) {
        throw new Error(
          'Chưa xác định nhân viên thao tác.',
        );
      }

      if (kind === 'BUILDING') {
        return createBuilding(
          actor,
          { code:bCode,name:bName },
        );
      }

      if (kind === 'FLOOR') {
        return createFloor(
          actor,
          {
            buildingId:fBuilding,
            code:fCode,
            name:fName,
          },
        );
      }

      if (kind === 'ROOM') {
        return createRoom(
          actor,
          {
            floorId:rFloor,
            code:rCode,
            name:rName,
          },
        );
      }

      return createBed(
        actor,
        {
          roomId:bedRoom,
          code:bedCode,
          name:bedName,
        },
      );
    },
    onSuccess: async () => {
      setBCode('');
      setBName('');
      setFCode('');
      setFName('');
      setRCode('');
      setRName('');
      setBedCode('');
      setBedName('');
      await refresh();
    },
  });

  if (!actor) {
    return (
      <main className="page">
        <h1>Phòng & Giường</h1>
        <p>Cần xác định nhân viên đang thao tác.</p>
      </main>
    );
  }

  const canManage = hasCapability(actor?.actorRole, 'canManageAccommodation');
  const data = overview.data;
  const canPrev = offset > 0;
  const canNext =
    Boolean(data) &&
    offset + PAGE_SIZE < (data?.total ?? 0);

  const isDirectorOrManager = actor.actorRole === 'SUPERVISOR' || actor.actorRole === 'CARE_MANAGER' || actor.actorRole === 'ADMIN';

  return (
    <main className="page printable-a4-sheet">

      {data && isDirectorOrManager && (
        <div className="kpi-grid">
          <div className="kpi-box">
            <div className="kpi-title">Tổng số giường</div>
            <div className="kpi-number">{data.summary.total}</div>
            <div className="kpi-desc">Toàn bộ 29 phòng tại 4 tầng</div>
          </div>
          <div className="kpi-box">
            <div className="kpi-title">Đang sử dụng</div>
            <div className="kpi-number" style={{ color: '#16a34a' }}>{data.summary.occupied}</div>
            <div className="kpi-desc">Người cao tuổi đang ở</div>
          </div>
          <div className="kpi-box">
            <div className="kpi-title">Còn trống</div>
            <div className="kpi-number" style={{ color: '#2563eb' }}>{data.summary.available}</div>
            <div className="kpi-desc">Sẵn sàng tiếp nhận</div>
          </div>
          <div className="kpi-box">
            <div className="kpi-title">Đã giữ chỗ</div>
            <div className="kpi-number" style={{ color: '#d97706' }}>{data.summary.reserved}</div>
            <div className="kpi-desc">Hồ sơ chờ tiếp nhận</div>
          </div>
          <div className="kpi-box">
            <div className="kpi-title">Tạm ngưng / Bảo trì</div>
            <div className="kpi-number" style={{ color: '#64748b' }}>{data.summary.unavailable}</div>
            <div className="kpi-desc">Bảo dưỡng thiết bị</div>
          </div>
          <div className="kpi-box">
            <div className="kpi-title">Công suất giường</div>
            <div className="kpi-number" style={{ color: '#2563eb' }}>{data.summary.occupancyPercentage}%</div>
            <div className="kpi-desc">Tỷ lệ lấp đầy toàn Trung tâm</div>
          </div>
        </div>
      )}

      <section className="filter-toolbar">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.1rem', color: '#1e293b' }}>
            {canManage ? '⚡ Điều Phối & Phân Bổ Giường Nằm' : '👁️ Tra Cứu & Xem Sơ Đồ Phòng Giường'}
          </h2>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => triggerPrint()}
              className="btn btn-sm btn-neutral no-print"
              style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.35rem' }}
            >
              🖨️ In Báo Cáo Sơ Đồ Phòng (A4)
            </button>
            {currentResidentLocation && (
              <span className="badge badge-info">
                Vị trí hiện tại của cư dân: <b>{currentResidentLocation.roomName} / {currentResidentLocation.bedName}</b>
              </span>
            )}
          </div>
        </div>

        <div className="filter-toolbar-grid">
          {canManage && (
            <div>
              <label className="form-label">Chọn người cao tuổi cần xếp / chuyển</label>
              <select
                value={residentId}
                onChange={e => setResidentId(e.target.value)}
                className="form-select"
                style={{ width: '100%' }}
              >
                <option value="">-- Chọn người cao tuổi --</option>
                {(residents.data ?? []).map(({ resident }) => (
                  <option key={resident.residentId} value={resident.residentId}>
                    {resident.displayName} ({resident.residentCode})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="form-label">Lọc theo Tầng</label>
            <select
              value={floorId}
              onChange={e => {
                setFloorId(e.target.value);
                setRoomId('ALL');
              }}
              className="form-select"
              style={{ width: '100%' }}
            >
              <option value="ALL">Tất cả các tầng</option>
              {(floors.data ?? []).map(x => (
                <option key={x.floorId} value={x.floorId}>
                  {x.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="form-label">Lọc theo Phòng</label>
            <select
              value={roomId}
              onChange={e => setRoomId(e.target.value)}
              className="form-select"
              style={{ width: '100%' }}
            >
              <option value="ALL">Tất cả các phòng</option>
              {(rooms.data?.items ?? []).map(x => (
                <option key={x.roomId} value={x.roomId}>
                  {x.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="form-label">Trạng thái giường</label>
            <select
              value={status}
              onChange={e => setStatus(e.target.value)}
              className="form-select"
              style={{ width: '100%' }}
            >
              <option value="ALL">Tất cả trạng thái</option>
              <option value="AVAILABLE">CÒN TRỐNG</option>
              <option value="OCCUPIED">ĐANG SỬ DỤNG</option>
              <option value="RESERVED">ĐÃ GIỮ CHỖ</option>
              <option value="TEMPORARILY_UNAVAILABLE">TẠM NGƯNG</option>
              <option value="MAINTENANCE">BẢO TRÌ</option>
              <option value="INACTIVE">NGƯNG SỬ DỤNG</option>
            </select>
          </div>

          <div>
            <label className="form-label">Tìm kiếm nhanh</label>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Tìm phòng, số giường, tên cụ…"
              className="form-input"
            />
          </div>
        </div>

        {action.error && (
          <div className="alert-card alert-danger" style={{ marginTop: '0.75rem' }}>
            <span>{action.error instanceof Error ? action.error.message : 'Không thể hoàn tất thao tác.'}</span>
          </div>
        )}
      </section>

      <section className="entity-grid-cards">
        {overview.isLoading && <p>Đang tải sơ đồ phòng & giường…</p>}

        {(data?.items ?? []).map(x => {
          const occupied = Boolean(x.residentId);
          const available = x.bedStatus === 'AVAILABLE';
          const statusInfo = BED_STATUS_LABEL[x.bedStatus] ?? { label: x.bedStatus, badgeClass: 'badge badge-neutral' };

          return (
            <article className="entity-card-uniform" key={x.bedId}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                  <div>
                    <span style={{ fontWeight: 800, fontSize: '1.05rem', color: '#0f172a' }}>
                      {x.roomName}
                    </span>
                    <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '0.15rem' }}>
                      {x.floorName} • <b>{x.bedName}</b> ({x.bedCode})
                    </div>
                  </div>
                  <span className={statusInfo.badgeClass}>
                    {statusInfo.label}
                  </span>
                </div>

                {occupied ? (
                  <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '0.375rem', padding: '0.65rem 0.75rem', margin: '0.75rem 0' }}>
                    <div style={{ fontWeight: 700, color: '#991b1b', fontSize: '0.95rem' }}>
                      👤 {x.residentName}
                    </div>
                    <div style={{ fontSize: '0.82rem', color: '#7f1d1d', marginTop: '0.2rem' }}>
                      Mức chăm sóc: <b>{formatCareLevel(x.careLevel)}</b>
                    </div>
                  </div>
                ) : (
                  <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '0.375rem', padding: '0.65rem 0.75rem', margin: '0.75rem 0' }}>
                    <div style={{ fontSize: '0.85rem', color: '#166534', fontWeight: 600 }}>
                      ✨ Giường trống sẵn sàng tiếp nhận
                    </div>
                  </div>
                )}
              </div>

              <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                {canManage ? (
                  occupied ? (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem', width: '100%' }}>
                      <button
                        type="button"
                        disabled={action.isPending}
                        className="btn btn-sm btn-secondary"
                        style={{ fontSize: '0.78rem', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.2rem' }}
                        onClick={() => {
                          const availableBeds = (data?.items ?? []).filter(b => b.bedStatus === 'AVAILABLE');
                          setTransferTarget({
                            residentId: x.residentId!,
                            residentName: x.residentName || 'Người cao tuổi',
                            currentBedCode: x.bedCode,
                            currentRoomName: x.roomName,
                            targetBedId: availableBeds[0]?.bedId || '',
                          });
                        }}
                        title="Chuyển cụ sang phòng / giường khác"
                      >
                        🔄 Đổi Giường
                      </button>

                      <button
                        type="button"
                        disabled={action.isPending}
                        className="btn btn-sm btn-danger"
                        style={{ fontSize: '0.78rem', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.2rem' }}
                        onClick={() =>
                          setReleaseTarget({
                            residentId: x.residentId!,
                            residentName: x.residentName || 'Người cao tuổi',
                            bedCode: x.bedCode,
                            roomName: x.roomName,
                            floorName: x.floorName,
                          })
                        }
                        title="Chia tay Tâm An & Trả giường"
                      >
                        👋 Chia Tay
                      </button>
                    </div>
                  ) : (
                    <>
                      {residentId && (
                        <button
                          type="button"
                          disabled={action.isPending || !available}
                          className="btn btn-sm btn-primary"
                          style={{ flex: 1 }}
                          onClick={() =>
                            action.mutate(
                              selectedResident?.bedId
                                ? {
                                    type: 'TRANSFER',
                                    residentId,
                                    bedId: x.bedId,
                                  }
                                : {
                                    type: 'ASSIGN',
                                    bedId: x.bedId,
                                  },
                            )
                          }
                        >
                          {selectedResident?.bedId ? 'Chuyển sang giường này' : 'Xếp vào giường này'}
                        </button>
                      )}

                      {x.bedStatus === 'AVAILABLE' && (
                        <button
                          type="button"
                          disabled={action.isPending}
                          className="btn btn-sm btn-secondary"
                          onClick={() =>
                            action.mutate({
                              type: 'STATUS',
                              bedId: x.bedId,
                              status: 'MAINTENANCE',
                            })
                          }
                        >
                          Bảo trì
                        </button>
                      )}

                      {['TEMPORARILY_UNAVAILABLE', 'MAINTENANCE'].includes(x.bedStatus) && (
                        <button
                          type="button"
                          disabled={action.isPending}
                          className="btn btn-sm btn-success"
                          onClick={() =>
                            action.mutate({
                              type: 'STATUS',
                              bedId: x.bedId,
                              status: 'AVAILABLE',
                            })
                          }
                        >
                          Mở lại giường
                        </button>
                      )}
                    </>
                  )
                ) : (
                  <div style={{ fontSize: '0.8rem', color: '#94a3b8', textAlign: 'center', width: '100%', padding: '0.2rem 0' }}>
                    🔒 Chế độ xem thông tin vị trí giường
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </section>

      <div
        style={{
          display:'flex',
          gap:8,
          marginTop:14,
          alignItems:'center',
        }}
      >
        <button
          type="button"
          disabled={!canPrev}
          onClick={() =>
            setOffset(
              Math.max(0,offset-PAGE_SIZE),
            )
          }
        >
          Trang trước
        </button>

        <span>
          {data?.total ?? 0} giường
        </span>

        <button
          type="button"
          disabled={!canNext}
          onClick={() =>
            setOffset(offset+PAGE_SIZE)
          }
        >
          Trang sau
        </button>
      </div>

      <details
        className="card"
        style={{marginTop:20}}
      >
        <summary>Thiết lập cơ sở lưu trú</summary>

        <div
          style={{
            display:'grid',
            gap:14,
            marginTop:14,
          }}
        >
          <div>
            <h3>Tòa nhà</h3>
            <input
              placeholder="Mã"
              value={bCode}
              onChange={e => setBCode(e.target.value)}
            />
            <input
              placeholder="Tên"
              value={bName}
              onChange={e => setBName(e.target.value)}
            />
            <button
              type="button"
              onClick={() =>
                setup.mutate('BUILDING')
              }
            >
              Tạo tòa nhà
            </button>
          </div>

          <div>
            <h3>Tầng</h3>
            <select
              value={fBuilding}
              onChange={
                e => setFBuilding(e.target.value)
              }
            >
              <option value="">
                Chọn tòa nhà
              </option>
              {(buildings.data ?? []).map(x => (
                <option
                  key={x.buildingId}
                  value={x.buildingId}
                >
                  {x.name}
                </option>
              ))}
            </select>

            <input
              placeholder="Mã tầng"
              value={fCode}
              onChange={e => setFCode(e.target.value)}
            />
            <input
              placeholder="Tên tầng"
              value={fName}
              onChange={e => setFName(e.target.value)}
            />
            <button
              type="button"
              onClick={() =>
                setup.mutate('FLOOR')
              }
            >
              Tạo tầng
            </button>
          </div>

          <div>
            <h3>Phòng</h3>
            <select
              value={rFloor}
              onChange={
                e => setRFloor(e.target.value)
              }
            >
              <option value="">
                Chọn tầng
              </option>
              {(floors.data ?? []).map(x => (
                <option
                  key={x.floorId}
                  value={x.floorId}
                >
                  {x.name}
                </option>
              ))}
            </select>

            <input
              placeholder="Mã phòng"
              value={rCode}
              onChange={e => setRCode(e.target.value)}
            />
            <input
              placeholder="Tên phòng"
              value={rName}
              onChange={e => setRName(e.target.value)}
            />
            <button
              type="button"
              onClick={() =>
                setup.mutate('ROOM')
              }
            >
              Tạo phòng
            </button>
          </div>

          <div>
            <h3>Giường</h3>
            <select
              value={bedRoom}
              onChange={
                e => setBedRoom(e.target.value)
              }
            >
              <option value="">
                Chọn phòng
              </option>
              {(rooms.data?.items ?? []).map(x => (
                <option
                  key={x.roomId}
                  value={x.roomId}
                >
                  {x.name}
                </option>
              ))}
            </select>

            <input
              placeholder="Mã giường"
              value={bedCode}
              onChange={
                e => setBedCode(e.target.value)
              }
            />
            <input
              placeholder="Tên giường"
              value={bedName}
              onChange={
                e => setBedName(e.target.value)
              }
            />
            <button
              type="button"
              onClick={() =>
                setup.mutate('BED')
              }
            >
              Tạo giường
            </button>
          </div>
        </div>

        {setup.error && (
          <p role="alert">
            {setup.error instanceof Error
              ? setup.error.message
              : 'Không thể tạo dữ liệu.'}
          </p>
        )}
      </details>

      {/* Modal Hộp Thoại Xác Nhận Trả Giường */}
      {releaseTarget && (
        <div
          className="modal-backdrop"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1rem',
          }}
        >
          <div
            className="modal-card"
            style={{
              background: '#ffffff',
              borderRadius: '0.75rem',
              maxWidth: '92vw',
              width: '480px',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '1.5rem',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.1)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '50%',
                  background: '#fee2e2',
                  color: '#dc2626',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.4rem',
                  flexShrink: 0,
                }}
              >
                ⚠️
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#1e293b' }}>
                  👋 Chia Tay Tâm An & Trả Giường
                </h3>
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>
                  Thủ tục chia tay trung tâm & giải phóng vị trí giường nằm
                </p>
              </div>
            </div>

            <div
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '0.5rem',
                padding: '1rem',
                marginBottom: '1rem',
                fontSize: '0.9rem',
              }}
            >
              <div style={{ marginBottom: '0.5rem', color: '#1e293b' }}>
                👤 Người cao tuổi: <b>{releaseTarget.residentName}</b>
              </div>
              <div style={{ marginBottom: '0.75rem', color: '#1e293b' }}>
                🛏️ Vị trí hiện tại: <b>Giường {releaseTarget.bedCode} — Phòng {releaseTarget.roomName}</b> {releaseTarget.floorName ? `(${releaseTarget.floorName})` : ''}
              </div>

              <div style={{ marginBottom: '0.85rem' }}>
                <label style={{ display: 'block', fontWeight: 700, fontSize: '0.82rem', marginBottom: '0.3rem', color: '#334155' }}>
                  Lý do chia tay Tâm An & trả giường: <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <select
                  className="form-select"
                  style={{ width: '100%', padding: '0.45rem 0.75rem', fontSize: '0.85rem' }}
                  value={releaseReason}
                  onChange={(e) => setReleaseReason(e.target.value)}
                >
                  <option value="Hồi phục sức khỏe về với gia đình">🏡 Hồi phục sức khỏe về với gia đình</option>
                  <option value="Chuyển viện điều trị tuyến trên">🏥 Chuyển viện điều trị tuyến trên</option>
                  <option value="Theo nguyện vọng gia đình">👨‍👩‍👧‍👦 Theo nguyện vọng của gia đình</option>
                  <option value="Hoàn tất thời hạn hợp đồng lưu trú">📜 Hoàn tất thời hạn hợp đồng lưu trú</option>
                  <option value="Khác (Ghi rõ chi tiết)">📝 Lý do khác</option>
                </select>
              </div>

              <div
                style={{
                  background: '#fff1f2',
                  border: '1px solid #fecdd3',
                  borderRadius: '0.375rem',
                  padding: '0.75rem',
                  color: '#9f1239',
                  fontSize: '0.85rem',
                  lineHeight: 1.45,
                }}
              >
                <b>⚠️ Cảnh báo thao tác:</b> Thao tác này sẽ chuyển trạng thái cư dân thành <b>"Đã hoàn thành lưu trú"</b>, trả giường <b>"Giường {releaseTarget.bedCode}"</b> về trạng thái CÒN TRỐNG, và tự động phát <b>Bell Notice</b> thông báo tới Ban Giám đốc & các bộ phận liên quan.
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setReleaseTarget(null)}
                disabled={action.isPending}
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                className="btn btn-danger"
                disabled={action.isPending}
                onClick={async () => {
                  try {
                    await action.mutateAsync({
                      type: 'RELEASE',
                      residentId: releaseTarget.residentId,
                      reason: releaseReason,
                    });
                    setReleaseTarget(null);
                    alert(`✅ Đã hoàn tất thủ tục Chia Tay Tâm An & trả giường cho cụ ${releaseTarget.residentName}!`);
                  } catch (err: any) {
                    alert(err.message || 'Lỗi khi chia tay & trả giường');
                  }
                }}
              >
                {action.isPending ? '⏳ Đang xử lý...' : '👋 Xác Nhận Chia Tay & Trả Giường'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL ĐỔI PHÒNG & ĐỔI GIƯỜNG (BGĐ & QUẢN LÝ) */}
      {transferTarget && (
        <div
          className="modal-backdrop"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99999,
            padding: '1rem',
          }}
        >
          <div
            className="modal-card"
            style={{
              background: '#ffffff',
              borderRadius: '0.75rem',
              maxWidth: '540px',
              width: '100%',
              padding: '1.5rem',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem' }}>
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '50%',
                  background: '#e0f2fe',
                  color: '#0284c7',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.4rem',
                  flexShrink: 0,
                }}
              >
                🔄
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#166534' }}>
                  Đổi Phòng & Đổi Giường Cư Dân
                </h3>
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>
                  Điều chuyển cư dân sang phòng/giường mới còn trống
                </p>
              </div>
            </div>

            <div
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '0.5rem',
                padding: '1rem',
                marginBottom: '1rem',
                fontSize: '0.9rem',
              }}
            >
              <div style={{ marginBottom: '0.5rem', color: '#1e293b' }}>
                👤 Người cao tuổi: <b>{transferTarget.residentName}</b>
              </div>
              <div style={{ marginBottom: '0.85rem', color: '#1e293b' }}>
                🛏️ Giường hiện tại: <b style={{ color: '#dc2626' }}>Phòng {transferTarget.currentRoomName} — Giường {transferTarget.currentBedCode}</b>
              </div>

              <div style={{ marginBottom: '0.85rem' }}>
                <label style={{ display: 'block', fontWeight: 700, fontSize: '0.82rem', marginBottom: '0.35rem', color: '#334155' }}>
                  Chọn Phòng & Giường mới (CÒN TRỐNG): <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <select
                  className="form-select"
                  style={{ width: '100%', padding: '0.5rem 0.75rem', fontSize: '0.85rem' }}
                  value={transferTarget.targetBedId}
                  onChange={(e) => setTransferTarget({ ...transferTarget, targetBedId: e.target.value })}
                >
                  {((data?.items ?? []).filter(b => b.bedStatus === 'AVAILABLE')).length === 0 ? (
                    <option value="">(Không có giường trống nào)</option>
                  ) : (
                    (data?.items ?? [])
                      .filter(b => b.bedStatus === 'AVAILABLE')
                      .map(b => (
                        <option key={b.bedId} value={b.bedId}>
                          {b.floorName} — {b.roomName} ({b.bedName} / {b.bedCode})
                        </option>
                      ))
                  )}
                </select>
              </div>

              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '0.65rem 0.75rem', borderRadius: '0.375rem', fontSize: '0.82rem', color: '#166534' }}>
                💡 <b>Tự động đồng bộ:</b> Giường cũ sẽ giải phóng thành <b>CÒN TRỐNG</b>, giường mới thành <b>ĐANG SỬ DỤNG</b>. Bell Notice sẽ phát tới toàn thể nhân sự.
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setTransferTarget(null)}
                disabled={action.isPending}
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={action.isPending || !transferTarget.targetBedId}
                onClick={async () => {
                  try {
                    await action.mutateAsync({
                      type: 'TRANSFER',
                      residentId: transferTarget.residentId,
                      bedId: transferTarget.targetBedId,
                    });
                    setTransferTarget(null);
                    alert(`🎉 Đã điều chuyển cụ ${transferTarget.residentName} sang phòng/giường mới thành công!`);
                  } catch (err: any) {
                    alert(err.message || 'Lỗi khi đổi phòng giường');
                  }
                }}
              >
                {action.isPending ? '⏳ Đang lưu...' : '🔄 Xác Nhận Đổi Giường'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

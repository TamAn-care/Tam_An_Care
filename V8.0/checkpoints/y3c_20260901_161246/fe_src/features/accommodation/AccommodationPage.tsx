import { useEffect, useMemo, useState } from 'react';
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

const PAGE_SIZE = 100;

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

  const data=overview.data;
  const canPrev=offset>0;
  const canNext=
    Boolean(data) &&
    offset+PAGE_SIZE < (data?.total ?? 0);

  return (
    <main className="page">
      <div className="page-heading">
        <div>
          <h1>Phòng & Giường</h1>
          <p>
            Xếp giường, chuyển giường, trả giường
            và quản lý khả dụng tại một màn hình.
          </p>
        </div>
      </div>

      {data && (
        <section
          style={{
            display:'grid',
            gridTemplateColumns:
              'repeat(auto-fit,minmax(120px,1fr))',
            gap:10,
            marginBottom:16,
          }}
        >
          {[
            ['Tổng',data.summary.total],
            ['Đang sử dụng',data.summary.occupied],
            ['Còn trống',data.summary.available],
            ['Đã giữ',data.summary.reserved],
            ['Tạm ngưng',data.summary.unavailable],
            [
              'Công suất',
              `${data.summary.occupancyPercentage}%`,
            ],
          ].map(([k,v]) => (
            <article
              className="card"
              key={String(k)}
            >
              <small>{k}</small>
              <h2>{v}</h2>
            </article>
          ))}
        </section>
      )}

      <section
        className="card"
        style={{display:'grid',gap:10}}
      >
        <h2>Điều phối nhanh</h2>

        <label>
          Người cao tuổi
          <select
            value={residentId}
            onChange={
              e => setResidentId(e.target.value)
            }
          >
            <option value="">
              Chọn người cao tuổi
            </option>
            {(residents.data ?? []).map(
              ({resident}) => (
                <option
                  key={resident.residentId}
                  value={resident.residentId}
                >
                  {resident.displayName}
                </option>
              ),
            )}
          </select>
        </label>

        {currentResidentLocation && (
          <p>
            Vị trí hiện tại:{' '}
            <b>
              {currentResidentLocation.roomName}
              {' / '}
              {currentResidentLocation.bedName}
            </b>
          </p>
        )}

        <div
          style={{
            display:'grid',
            gridTemplateColumns:
              'repeat(auto-fit,minmax(150px,1fr))',
            gap:8,
          }}
        >
          <select
            value={buildingId}
            onChange={e => {
              setBuildingId(e.target.value);
              setFloorId('ALL');
              setRoomId('ALL');
            }}
          >
            <option value="ALL">Tất cả tòa</option>
            {(buildings.data ?? []).map(x => (
              <option
                key={x.buildingId}
                value={x.buildingId}
              >
                {x.name}
              </option>
            ))}
          </select>

          <select
            value={floorId}
            onChange={e => {
              setFloorId(e.target.value);
              setRoomId('ALL');
            }}
          >
            <option value="ALL">Tất cả tầng</option>
            {(floors.data ?? []).map(x => (
              <option
                key={x.floorId}
                value={x.floorId}
              >
                {x.name}
              </option>
            ))}
          </select>

          <select
            value={roomId}
            onChange={
              e => setRoomId(e.target.value)
            }
          >
            <option value="ALL">Tất cả phòng</option>
            {(rooms.data?.items ?? []).map(x => (
              <option
                key={x.roomId}
                value={x.roomId}
              >
                {x.name}
              </option>
            ))}
          </select>

          <select
            value={status}
            onChange={
              e => setStatus(e.target.value)
            }
          >
            <option value="ALL">
              Tất cả trạng thái
            </option>
            <option value="AVAILABLE">
              Còn trống
            </option>
            <option value="OCCUPIED">
              Đang sử dụng
            </option>
            <option value="RESERVED">
              Đã giữ
            </option>
            <option value="TEMPORARILY_UNAVAILABLE">
              Tạm ngưng
            </option>
            <option value="MAINTENANCE">
              Bảo trì
            </option>
            <option value="INACTIVE">
              Ngưng sử dụng
            </option>
          </select>

          <input
            value={search}
            onChange={
              e => setSearch(e.target.value)
            }
            placeholder="Tìm phòng, giường, cư dân…"
          />
        </div>

        {action.error && (
          <p role="alert">
            {action.error instanceof Error
              ? action.error.message
              : 'Không thể hoàn tất thao tác.'}
          </p>
        )}
      </section>

      <section
        style={{
          display:'grid',
          gap:10,
          marginTop:14,
        }}
      >
        {overview.isLoading && <p>Đang tải…</p>}

        {(data?.items ?? []).map(x => {
          const occupied=Boolean(x.residentId);
          const available=
            x.bedStatus === 'AVAILABLE';

          return (
            <article
              className="card"
              key={x.bedId}
            >
              <strong>
                {x.buildingName}
                {' / '}
                {x.floorName}
                {' / '}
                {x.roomName}
                {' / '}
                {x.bedName}
              </strong>

              <p>
                Trạng thái:{' '}
                <b>{x.bedStatus}</b>
              </p>

              {occupied ? (
                <>
                  <p>
                    {x.residentName}
                    {x.careLevel
                      ? ` · ${x.careLevel}`
                      : ''}
                  </p>

                  <button
                    type="button"
                    disabled={action.isPending}
                    onClick={() =>
                      action.mutate({
                        type:'RELEASE',
                        residentId:x.residentId!,
                      })
                    }
                  >
                    Trả giường
                  </button>
                </>
              ) : (
                <>
                  {residentId && (
                    <button
                      type="button"
                      disabled={
                        action.isPending ||
                        !available
                      }
                      onClick={() =>
                        action.mutate(
                          selectedResident?.bedId
                            ? {
                                type:'TRANSFER',
                                residentId,
                                bedId:x.bedId,
                              }
                            : {
                                type:'ASSIGN',
                                bedId:x.bedId,
                              },
                        )
                      }
                    >
                      {selectedResident?.bedId
                        ? 'Chuyển giường'
                        : 'Xếp giường'}
                    </button>
                  )}

                  {x.bedStatus === 'AVAILABLE' && (
                    <>
                      <button
                        type="button"
                        disabled={action.isPending}
                        onClick={() =>
                          action.mutate({
                            type:'STATUS',
                            bedId:x.bedId,
                            status:
                              'TEMPORARILY_UNAVAILABLE',
                          })
                        }
                      >
                        Tạm ngưng
                      </button>

                      <button
                        type="button"
                        disabled={action.isPending}
                        onClick={() =>
                          action.mutate({
                            type:'STATUS',
                            bedId:x.bedId,
                            status:'MAINTENANCE',
                          })
                        }
                      >
                        Bảo trì
                      </button>
                    </>
                  )}

                  {[
                    'TEMPORARILY_UNAVAILABLE',
                    'MAINTENANCE',
                  ].includes(x.bedStatus) && (
                    <button
                      type="button"
                      disabled={action.isPending}
                      onClick={() =>
                        action.mutate({
                          type:'STATUS',
                          bedId:x.bedId,
                          status:'AVAILABLE',
                        })
                      }
                    >
                      Đưa lại vào sử dụng
                    </button>
                  )}
                </>
              )}
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
    </main>
  );
}

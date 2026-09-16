import {
  useMemo,
  useState,
} from 'react';

import {
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';

import {
  Link,
} from 'react-router-dom';

import {
  listResidents,
} from '../../api/residents';

import {
  publishResidentBirthdayNotice,
} from '../../api/notifications';

import {
  releaseBed,
} from '../../api/accommodation';

import {
  listResidentAccessAssignments,
} from '../../api/resident-access-administration';

import {
  useActor,
} from '../../auth/ActorContext';

import {
  ApiError,
} from '../../api/errors';

import {
  EmptyState,
  ErrorState,
  LoadingState,
} from '../../components/feedback/FeedbackStates';

import {
  CARE_LEVEL_LABEL,
  formatVietnameseDate,
  GENDER_LABEL,
} from './resident-ui';

import { getAssignedResidentIdsForActor, hasCapability } from '../../auth/role-policy';
import ElderlyAvatar from '../../components/common/ElderlyAvatar';
import {
  addResidentFamilySupply,
  logSupplyUsage,
  fetchResidentFamilySupplies,
  SUPPLY_CATEGORY_LABELS,
  SupplyCategory,
  ResidentFamilySupplyItem,
} from '../../api/resident-supplies';
import {
  createPsychologicalAssessment,
  EMOTIONAL_STATE_META,
  SOCIAL_COMMUNICATION_META,
} from '../../api/psychological-assessment';

type StatusFilter =
  | 'ALL'
  | 'ACTIVE'
  | 'INACTIVE';

function isTodayBirthday(dateOfBirth?: string): boolean {
  if (!dateOfBirth) return false;
  const parts = dateOfBirth.split('-');
  if (parts.length < 3) return false;
  const today = new Date();
  const dobMonth = parseInt(parts[1], 10);
  const dobDate = parseInt(parts[2], 10);
  return dobMonth === (today.getMonth() + 1) && dobDate === today.getDate();
}

export function ResidentsPage() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  const actorId = actor?.actorId ?? '';
  const actorRole = actor?.actorRole ?? '';
  const actorName = actor?.displayName || 'Nhân viên';
  const isCaregiver = actorRole === 'CAREGIVER';
  const isDirectorOrManager =
    actorRole === 'SUPERVISOR' ||
    actorRole === 'CARE_MANAGER' ||
    actorRole === 'ADMIN';
  const canEvaluatePsychology = hasCapability(actor?.actorRole, 'canEvaluatePsychology');
  const canViewResidentSupplies = hasCapability(actor?.actorRole, 'canViewResidentSupplies');

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ACTIVE');

  // Modal state: Farewell Tam An
  const [farewellModalTarget, setFarewellModalTarget] = useState<any | null>(null);
  const [farewellReason, setFarewellReason] = useState('Hồi phục sức khỏe về với gia đình');

  // Modals state: Family Consumable Supplies (Item 1)
  const [selectedSupplyResident, setSelectedSupplyResident] = useState<any | null>(null);
  const [supplyTab, setSupplyTab] = useState<'RECEIVE' | 'LOG_USAGE'>('RECEIVE');
  const [supItemName, setSupItemName] = useState('');
  const [supCategory, setSupCategory] = useState<SupplyCategory>('MILK_NUTRITION');
  const [supQty, setSupQty] = useState<number>(1);
  const [supUnit, setSupUnit] = useState('Chai');
  const [supDeliveredBy, setSupDeliveredBy] = useState('');
  const [supStorage, setSupStorage] = useState('Tủ cá nhân');
  const [supNotes, setSupNotes] = useState('');

  // Modals state: Psychological Assessment (Item 3)
  const [selectedPsyResident, setSelectedPsyResident] = useState<any | null>(null);
  const [psyPeriod, setPsyPeriod] = useState<'MONTHLY' | 'QUARTERLY' | 'AD_HOC'>('MONTHLY');
  const [psyEmotionalState, setPsyEmotionalState] = useState<'CHEERFUL' | 'STABLE' | 'ANXIOUS' | 'DEPRESSED' | 'AGITATED' | 'APATHETIC'>('STABLE');
  const [psyEmotionalNotes, setPsyEmotionalNotes] = useState('');
  const [psySocialComm, setPsySocialComm] = useState<'ACTIVE' | 'NORMAL' | 'WITHDRAWN' | 'RESISTANT' | 'ISOLATED'>('NORMAL');
  const [psySocialNotes, setPsySocialNotes] = useState('');
  const [psyCognitive, setPsyCognitive] = useState<'ALERT' | 'MILD_FORGETFUL' | 'MODERATE_IMPAIRMENT' | 'DISORIENTED'>('ALERT');
  const [psySleep, setPsySleep] = useState<'GOOD' | 'INTERRUPTED' | 'INSOMNIA' | 'NIGHT_WANDERING'>('GOOD');
  const [psyConclusion, setPsyConclusion] = useState('');
  const [psyRecommendations, setPsyRecommendations] = useState('');

  const residentSuppliesQuery = useQuery({
    queryKey: ['family-supplies', selectedSupplyResident?.residentId],
    queryFn: () => fetchResidentFamilySupplies(selectedSupplyResident?.residentId),
    enabled: Boolean(actor && selectedSupplyResident),
  });

  const addSupplyMutation = useMutation({
    mutationFn: async () => {
      if (!selectedSupplyResident || !supItemName.trim()) {
        throw new Error('Vui lòng nhập tên đồ tiêu hao');
      }
      return addResidentFamilySupply(actor!, {
        residentId: selectedSupplyResident.residentId,
        residentName: selectedSupplyResident.displayName,
        itemName: supItemName.trim(),
        category: supCategory,
        categoryLabel: SUPPLY_CATEGORY_LABELS[supCategory],
        quantityReceived: supQty,
        unit: supUnit.trim() || 'Cái',
        receivedAt: new Date().toISOString(),
        deliveredBy: supDeliveredBy.trim() || 'Thân nhân',
        receivedByStaffId: actorId,
        receivedByStaffName: actorName,
        storageLocation: supStorage.trim() || 'Tủ cá nhân',
        notes: supNotes.trim() || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['family-supplies'] });
      setSupItemName('');
      setSupQty(1);
      setSupDeliveredBy('');
      setSupNotes('');
    },
  });

  const createPsyMutation = useMutation({
    mutationFn: async () => {
      if (!selectedPsyResident || !psyConclusion.trim()) {
        throw new Error('Vui lòng nhập kết luận tổng quát');
      }
      return createPsychologicalAssessment(actor!, {
        residentId: selectedPsyResident.residentId,
        residentName: selectedPsyResident.displayName,
        roomNumber: `Phòng ${selectedPsyResident.room || '101'}`,
        assessmentDate: new Date().toISOString().slice(0, 10),
        period: psyPeriod,
        periodLabel: psyPeriod === 'MONTHLY' ? 'Đánh giá định kỳ Hàng tháng' : psyPeriod === 'QUARTERLY' ? 'Đánh giá Hàng quý' : 'Đánh giá đột xuất',
        emotionalState: psyEmotionalState,
        emotionalStateLabel: EMOTIONAL_STATE_META[psyEmotionalState]?.label || psyEmotionalState,
        emotionalNotes: psyEmotionalNotes.trim() || undefined,
        socialCommunication: psySocialComm,
        socialCommunicationLabel: SOCIAL_COMMUNICATION_META[psySocialComm]?.label || psySocialComm,
        socialNotes: psySocialNotes.trim() || undefined,
        cognitiveMemory: psyCognitive,
        cognitiveMemoryLabel: psyCognitive === 'ALERT' ? 'Tỉnh táo' : 'Suy giảm trí nhớ',
        sleepQuality: psySleep,
        sleepQualityLabel: psySleep === 'GOOD' ? 'Giấc ngủ ngon' : 'Giấc ngủ kém',
        overallConclusion: psyConclusion.trim(),
        careRecommendations: psyRecommendations.trim() || 'Duy trì chăm sóc hiện tại',
      });
    },
    onSuccess: () => {
      setSelectedPsyResident(null);
      setPsyConclusion('');
      setPsyRecommendations('');
      setPsyEmotionalNotes('');
      setPsySocialNotes('');
    },
  });

  const query = useQuery({
    queryKey: [
      'residents',
      actorId,
      actorRole,
    ],
    queryFn: () =>
      listResidents(actor),
  });

  const assignmentsQuery = useQuery({
    queryKey: [
      'resident-assignments',
      actorId,
    ],
    queryFn: () =>
      listResidentAccessAssignments(actor!),
    enabled: Boolean(actor),
  });

  const myAssignedResidentIds = useMemo(() => {
    if (!isCaregiver) return null;
    return new Set(getAssignedResidentIdsForActor(actorId, actorName));
  }, [isCaregiver, actorId, actorName]);

  const residents =
    useMemo(() => {
      let rows = query.data ?? [];

      if (isCaregiver && myAssignedResidentIds) {
        rows = rows.filter(({ resident }) => myAssignedResidentIds.has(resident.residentId));
      }

      const normalizedSearch =
        search.trim().toLocaleLowerCase(
          'vi',
        );

      return rows.filter(({ resident }) => {
        if (
          statusFilter === 'ACTIVE' &&
          !resident.activeStatus
        ) {
          return false;
        }

        if (
          statusFilter === 'INACTIVE' &&
          resident.activeStatus
        ) {
          return false;
        }

        if (!normalizedSearch) {
          return true;
        }

        const haystack = [
          resident.displayName,
          resident.residentCode,
          resident.room ?? '',
          resident.bed ?? '',
        ]
          .join(' ')
          .toLocaleLowerCase('vi');

        return haystack.includes(
          normalizedSearch,
        );
      });
    }, [
      query.data,
      search,
      statusFilter,
      isCaregiver,
      myAssignedResidentIds,
    ]);

  const scopedTotalRows = useMemo(() => {
    let rows = query.data ?? [];
    if (isCaregiver && myAssignedResidentIds) {
      rows = rows.filter(({ resident }) => myAssignedResidentIds.has(resident.residentId));
    }
    return rows;
  }, [query.data, isCaregiver, myAssignedResidentIds]);

  const activeCount = scopedTotalRows.filter(
    ({ resident }) => resident.activeStatus,
  ).length;

  const level1Count = scopedTotalRows.filter(
    ({ resident }) => resident.careLevel === 'INDEPENDENT',
  ).length;

  const assistedCount = scopedTotalRows.filter(
    ({ resident }) => resident.careLevel !== 'INDEPENDENT',
  ).length;

  const errorDescription =
    query.error instanceof ApiError
      ? query.error.message
      : query.error instanceof Error
        ? query.error.message
        : 'Không thể tải danh sách người cao tuổi.';

  const exportResidentsCSV = () => {
    if (!residents) return;
    const headers = ['STT', 'Mã Cư Dân', 'Họ Và Tên', 'Ngày Sinh', 'Giới Tính', 'Phòng & Giường', 'Cấp Độ Chăm Sóc', 'Trạng Thái'];
    const rows = residents.map((item: any, index: number) => {
      const res = item.resident;
      return [
        index + 1,
        res.residentCode,
        `"${res.displayName}"`,
        res.dateOfBirth ? formatVietnameseDate(res.dateOfBirth) : '',
        GENDER_LABEL[res.gender as keyof typeof GENDER_LABEL] || res.gender,
        `"${res.room ? `Phòng ${res.room}` : ''} ${res.bed ? `Giường ${res.bed}` : ''}"`.trim(),
        CARE_LEVEL_LABEL[res.careLevel as keyof typeof CARE_LEVEL_LABEL] || res.careLevel,
        res.activeStatus ? 'Đang ở viện' : 'Đã ra viện',
      ];
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((e: any) => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Bao_Cao_Danh_Sach_Cu_Dan_TamAnCare_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
  };

  return (
    <>
      <header className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div className="eyebrow">
            {isCaregiver ? 'PHÂN QUYỀN CHĂM SÓC TRỰC TIẾP' : 'HỒ SƠ NỘI TRÚ'}
          </div>

          <h1 className="page-title">
            {isCaregiver ? `Cư Dân Phụ Trách (${actorName})` : 'Người Cao Tuổi'}
          </h1>
        </div>

        <button
          onClick={exportResidentsCSV}
          className="btn btn-secondary"
          style={{ background: '#f0fdf4', color: '#166534', borderColor: '#86efac', fontWeight: 700, marginTop: '0.5rem' }}
        >
          📥 Xuất Báo Cáo Cư Dân Excel/CSV
        </button>
      </header>

      <div className="kpi-grid">
        <div className="kpi-box">
          <div className="kpi-title">Tổng số hồ sơ</div>
          <div className="kpi-number">{isCaregiver ? scopedTotalRows.length : (query.data?.length ?? 0)}</div>
          <div className="kpi-desc">{isCaregiver ? 'Hồ sơ thuộc phân công phụ trách' : 'Toàn bộ hồ sơ trên hệ thống'}</div>
        </div>
        <div className="kpi-box">
          <div className="kpi-title">Đang lưu trú / Hoạt động</div>
          <div className="kpi-number" style={{ color: '#16a34a' }}>{activeCount}</div>
          <div className="kpi-desc">{isCaregiver ? 'Cư dân được phân công đang ở viện' : 'Cư dân đang ở trung tâm'}</div>
        </div>
        <div className="kpi-box">
          <div className="kpi-title">Mức (1) Tự phục vụ</div>
          <div className="kpi-number" style={{ color: '#2563eb' }}>{level1Count}</div>
          <div className="kpi-desc">{isCaregiver ? 'Thuộc phân công (Theo dõi y tế)' : 'Theo dõi y tế định kỳ'}</div>
        </div>
        <div className="kpi-box">
          <div className="kpi-title">Mức (2) & (3) Cần chăm sóc</div>
          <div className="kpi-number" style={{ color: '#ea580c' }}>{assistedCount}</div>
          <div className="kpi-desc">{isCaregiver ? 'Thuộc phân công (Hỗ trợ sinh hoạt)' : 'Hỗ trợ sinh hoạt & toàn diện'}</div>
        </div>
      </div>

      <section className="filter-toolbar">
        <div className="filter-toolbar-grid">
          <div style={{ gridColumn: 'span 2' }}>
            <label className="form-label">Tìm kiếm cư dân</label>
            <input
              className="form-input"
              type="search"
              value={search}
              placeholder="Nhập tên cụ, mã hồ sơ, phòng hoặc số giường…"
              onChange={(event) =>
                setSearch(
                  event.target.value,
                )
              }
              style={{ width: '100%' }}
            />
          </div>

          <div>
            <label className="form-label">Trạng thái lưu trú</label>
            <select
              className="form-select"
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(
                  event.target.value as StatusFilter,
                )
              }
              style={{ width: '100%' }}
            >
              <option value="ACTIVE">
                Đang lưu trú
              </option>
              <option value="INACTIVE">
                Không hoạt động
              </option>
              <option value="ALL">
                Tất cả trạng thái
              </option>
            </select>
          </div>

          <div>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={query.isFetching}
              onClick={() => {
                void query.refetch();
              }}
              style={{ width: '100%' }}
            >
              {query.isFetching
                ? 'Đang tải…'
                : 'Làm mới danh sách'}
            </button>
          </div>
        </div>
      </section>

      {query.isLoading && (
        <LoadingState
          title="Đang tải danh sách"
          description="Hệ thống đang lấy dữ liệu người cao tuổi."
        />
      )}

      {query.isError && (
        <ErrorState
          title="Không thể tải danh sách"
          description={errorDescription}
        />
      )}

      {query.isSuccess &&
        query.data.length === 0 && (
          <EmptyState
            title="Chưa có hồ sơ người cao tuổi"
            description="Backend hiện chưa có dữ liệu resident."
          />
        )}

      {query.isSuccess &&
        query.data.length > 0 &&
        residents.length === 0 && (
          <EmptyState
            title="Không có kết quả phù hợp"
            description="Thử thay đổi từ khóa hoặc bộ lọc."
          />
        )}

      {query.isSuccess &&
        residents.length > 0 && (
          <section
            className="entity-grid-cards"
            aria-label="Danh sách người cao tuổi"
          >
            {residents.map(
              ({ resident }) => (
                <article
                  key={resident.residentId}
                  className="entity-card-uniform"
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <ElderlyAvatar gender={resident.gender} name={resident.displayName} size={42} />
                        <div>
                          <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>
                            {resident.displayName}
                          </h3>
                          <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                            Mã hồ sơ: <b>{resident.residentCode}</b>
                          </div>
                        </div>
                      </div>

                      <span
                        className={
                          resident.activeStatus
                            ? 'badge badge-success'
                            : 'badge badge-neutral'
                        }
                      >
                        {resident.activeStatus
                          ? 'Đang lưu trú'
                          : 'Đã hoàn thành lưu trú'}
                      </span>
                    </div>

                    {isTodayBirthday(resident.dateOfBirth) && (
                      <div style={{ marginBottom: '0.5rem' }}>
                        <span
                          style={{
                            background: '#ffe4e6',
                            color: '#be123c',
                            border: '1px solid #fecdd3',
                            fontSize: '0.75rem',
                            fontWeight: 800,
                            padding: '0.25rem 0.6rem',
                            borderRadius: '9999px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.3rem',
                            boxShadow: '0 1px 2px rgba(190, 18, 60, 0.1)',
                          }}
                        >
                          🎉 🎂 Hom nay sinh nhật cụ!
                        </span>
                      </div>
                    )}

                    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '0.5rem', padding: '0.75rem', fontSize: '0.85rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', margin: '0.75rem 0' }}>
                      <div>
                        <div style={{ color: '#64748b', fontSize: '0.75rem' }}>Ngày sinh</div>
                        <b>{formatVietnameseDate(resident.dateOfBirth)}</b>
                      </div>
                      <div>
                        <div style={{ color: '#64748b', fontSize: '0.75rem' }}>Giới tính</div>
                        <b>{GENDER_LABEL[resident.gender] || resident.gender}</b>
                      </div>
                      <div>
                        <div style={{ color: '#64748b', fontSize: '0.75rem' }}>Phòng / Giường</div>
                        <b>{resident.room ? `Phòng ${resident.room} / ${resident.bed}` : '—'}</b>
                      </div>
                      <div>
                        <div style={{ color: '#64748b', fontSize: '0.75rem' }}>Mức chăm sóc</div>
                        <b style={{ color: '#0369a1' }}>{CARE_LEVEL_LABEL[resident.careLevel] || resident.careLevel}</b>
                      </div>
                    </div>
                  </div>

                  <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <Link
                      className="btn btn-sm btn-primary"
                      style={{ width: '100%', textAlign: 'center', display: 'block' }}
                      to={`/residents/${
                        encodeURIComponent(
                          resident.residentId,
                        )
                      }/care`}
                    >
                      Mở hồ sơ chăm sóc &rarr;
                    </Link>

                    <button
                      type="button"
                      className="btn btn-sm"
                      style={{
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        background: '#fff1f2',
                        color: '#be123c',
                        border: '1px solid #fecdd3',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.3rem',
                        cursor: 'pointer',
                        padding: '0.35rem 0.5rem',
                        borderRadius: '0.35rem',
                      }}
                      onClick={() => {
                        publishResidentBirthdayNotice(resident);
                        alert(`🎉 Đã phát Bell Notice mừng sinh nhật cụ ${resident.displayName} tới toàn thể viện Tâm An Care!`);
                      }}
                      title="Phát thông báo mừng sinh nhật cụ qua Bell Notice cho toàn bộ nhân sự Tâm An Care"
                    >
                      🎂 Bắn Bell Notice Sinh Nhật
                    </button>

                    {resident.activeStatus && isDirectorOrManager && (
                      <button
                        type="button"
                        className="btn btn-sm btn-danger"
                        style={{
                          fontSize: '0.78rem',
                          fontWeight: 700,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.3rem',
                          cursor: 'pointer',
                          padding: '0.35rem 0.5rem',
                          borderRadius: '0.35rem',
                        }}
                        onClick={() => setFarewellModalTarget(resident)}
                        title="Thực hiện thủ tục Chia Tay Tâm An & trả giường cho cụ (BGĐ & Quản lý)"
                      >
                        👋 Chia Tay Tâm An (Trả Giường)
                      </button>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.35rem' }}>
                      {canViewResidentSupplies ? (
                        <button
                          type="button"
                          className="btn btn-sm btn-neutral"
                          onClick={() => setSelectedSupplyResident(resident)}
                          style={{ fontSize: '0.78rem', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.2rem' }}
                          title="Tiếp nhận & Quản lý đồ tiêu hao gửi từ gia đình"
                        >
                          🎁 Đồ Gửi Cụ
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-sm btn-neutral"
                          disabled
                          style={{ fontSize: '0.78rem', opacity: 0.5, cursor: 'not-allowed' }}
                          title="Tài khoản không được phân quyền xem Đồ gửi cụ (chức năng thuộc về Nhân viên chăm sóc)"
                        >
                          🔒 Đồ Gửi Cụ
                        </button>
                      )}

                      {canEvaluatePsychology ? (
                        <button
                          type="button"
                          className="btn btn-sm btn-secondary"
                          onClick={() => setSelectedPsyResident(resident)}
                          style={{ fontSize: '0.78rem', fontWeight: 700, background: '#f0fdf4', color: '#166534', borderColor: '#86efac', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.2rem' }}
                          title="Lập phiếu đánh giá tâm lý & tự động xuất Cổng thân nhân"
                        >
                          🧠 Đánh Giá Tâm Lý
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-sm btn-neutral"
                          disabled
                          style={{ fontSize: '0.78rem', opacity: 0.6, cursor: 'not-allowed' }}
                          title="Chỉ Nhân viên Tâm lý & CTXH có quyền lập phiếu đánh giá"
                        >
                          🧠 Đánh Giá Tâm Lý
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              ),
            )}
          </section>
        )}

      {/* MODAL 1: QUẢN LÝ ĐỒ TIÊU HAO VẬT PHẨM GỬI TỪ GIA ĐÌNH (ITEM 1) */}
      {selectedSupplyResident && (
        <div className="modal-overlay" onClick={() => setSelectedSupplyResident(null)}>
          <div
            className="modal-card"
            style={{
              background: '#ffffff',
              borderRadius: '0.75rem',
              padding: '1.5rem',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
              border: '1px solid #e2e8f0',
              maxWidth: '620px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem' }}>
              <div>
                <h3 style={{ margin: 0, color: '#1e293b', fontSize: '1.15rem', fontWeight: 700 }}>
                  🎁 Đồ Tiêu Hao & Vật Phẩm Gửi — Cụ {selectedSupplyResident.displayName}
                </h3>
                <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                  Phòng {selectedSupplyResident.room || '101'} • Mã cư dân: {selectedSupplyResident.residentCode}
                </div>
              </div>
              <button
                type="button"
                className="btn btn-neutral"
                onClick={() => setSelectedSupplyResident(null)}
                style={{ padding: '0.2rem 0.6rem', fontSize: '1rem', lineHeight: 1 }}
              >
                ✕
              </button>
            </div>

            {/* Sub-tabs inside supply modal */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', borderBottom: '2px solid #e2e8f0', paddingBottom: '0.25rem' }}>
              <button
                type="button"
                className={`btn btn-sm ${supplyTab === 'RECEIVE' ? 'btn-primary' : 'btn-neutral'}`}
                onClick={() => setSupplyTab('RECEIVE')}
                style={{ fontWeight: 700 }}
              >
                📥 Tiếp Nhận Đồ Mới Từ Gia Đình
              </button>
              <button
                type="button"
                className={`btn btn-sm ${supplyTab === 'LOG_USAGE' ? 'btn-primary' : 'btn-neutral'}`}
                onClick={() => setSupplyTab('LOG_USAGE')}
                style={{ fontWeight: 700 }}
              >
                📋 Danh Sách & Nhật Ký Đã Dùng ({residentSuppliesQuery.data?.length || 0})
              </button>
            </div>

            {supplyTab === 'RECEIVE' ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  addSupplyMutation.mutate();
                }}
              >
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem', marginBottom: '0.85rem' }}>
                  <label className="field-group">
                    <span className="field-label">Tên đồ tiêu hao / vật phẩm *</span>
                    <input
                      className="text-input"
                      placeholder="VD: Sữa Ensure Gold 237ml, Tã bỉm Caryn, Táo Envy..."
                      value={supItemName}
                      onChange={(e) => setSupItemName(e.target.value)}
                      required
                    />
                  </label>

                  <label className="field-group">
                    <span className="field-label">Phân loại vật phẩm *</span>
                    <select
                      className="text-input"
                      value={supCategory}
                      onChange={(e) => setSupCategory(e.target.value as SupplyCategory)}
                    >
                      {Object.entries(SUPPLY_CATEGORY_LABELS).map(([k, label]) => (
                        <option key={k} value={k}>{label}</option>
                      ))}
                    </select>
                  </label>

                  <label className="field-group">
                    <span className="field-label">Số lượng tiếp nhận *</span>
                    <input
                      type="number"
                      min="1"
                      className="text-input"
                      value={supQty}
                      onChange={(e) => setSupQty(Number(e.target.value))}
                      required
                    />
                  </label>

                  <label className="field-group">
                    <span className="field-label">Đơn vị tính *</span>
                    <input
                      className="text-input"
                      placeholder="VD: chai, bịch, miếng, kg, bộ..."
                      value={supUnit}
                      onChange={(e) => setSupUnit(e.target.value)}
                      required
                    />
                  </label>

                  <label className="field-group">
                    <span className="field-label">Người thân gửi bàn giao</span>
                    <input
                      className="text-input"
                      placeholder="VD: Lê Gia Bảo (Con trai)"
                      value={supDeliveredBy}
                      onChange={(e) => setSupDeliveredBy(e.target.value)}
                    />
                  </label>

                  <label className="field-group">
                    <span className="field-label">Nơi bảo quản / Lưu trữ</span>
                    <input
                      className="text-input"
                      placeholder="VD: Tủ cá nhân P.101, Tủ lạnh Bếp..."
                      value={supStorage}
                      onChange={(e) => setSupStorage(e.target.value)}
                    />
                  </label>
                </div>

                <label className="field-group" style={{ marginBottom: '1.25rem' }}>
                  <span className="field-label">Hướng dẫn sử dụng & Ghi chú cho điều dưỡng</span>
                  <textarea
                    className="text-input"
                    rows={2}
                    placeholder="VD: Cho cụ uống 1 chai vào 15:00 bữa phụ chiều..."
                    value={supNotes}
                    onChange={(e) => setSupNotes(e.target.value)}
                  />
                </label>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                  <button
                    type="button"
                    className="btn btn-neutral"
                    onClick={() => setSelectedSupplyResident(null)}
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={addSupplyMutation.isPending || !supItemName.trim()}
                    style={{ fontWeight: 700 }}
                  >
                    {addSupplyMutation.isPending ? 'Đang lưu...' : 'Lưu Tiếp Nhận Vật Phẩm'}
                  </button>
                </div>
              </form>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                {residentSuppliesQuery.data?.length === 0 ? (
                  <div style={{ textAlign: 'center', color: '#64748b', padding: '1.5rem' }}>
                    Chưa có đồ tiêu hao nào được ghi nhận cho cụ.
                  </div>
                ) : (
                  residentSuppliesQuery.data?.map((sup) => (
                    <div
                      key={sup.id}
                      style={{
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: '0.5rem',
                        padding: '0.85rem',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <span style={{ fontWeight: 800, color: '#1e293b' }}>{sup.itemName}</span>
                          <span className="badge badge-info" style={{ marginLeft: '0.5rem', fontSize: '0.75rem' }}>
                            {sup.categoryLabel}
                          </span>
                        </div>
                        <span className={sup.status === 'EXHAUSTED' ? 'badge badge-neutral' : 'badge badge-success'}>
                          Còn: {sup.remainingQuantity} / {sup.quantityReceived} {sup.unit}
                        </span>
                      </div>

                      <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.3rem' }}>
                        Gia đình bàn giao: <b>{sup.deliveredBy}</b> • Tiếp nhận bởi: <b>{sup.receivedByStaffName}</b> lúc {new Date(sup.receivedAt).toLocaleDateString('vi-VN')}
                      </div>

                      {sup.notes && (
                        <div style={{ fontSize: '0.8rem', color: '#4b5563', marginTop: '0.2rem', fontStyle: 'italic' }}>
                          Lưu ý: "{sup.notes}"
                        </div>
                      )}

                      {/* Usage logs */}
                      {sup.usageLogs.length > 0 && (
                        <div style={{ marginTop: '0.5rem', background: '#ffffff', padding: '0.5rem', borderRadius: '0.35rem', border: '1px solid #cbd5e1', fontSize: '0.78rem' }}>
                          <div style={{ fontWeight: 700, color: '#15803d', marginBottom: '0.2rem' }}>Nhật ký sử dụng:</div>
                          {sup.usageLogs.map((log) => (
                            <div key={log.logId} style={{ color: '#475569' }}>
                              • {new Date(log.usedAt).toLocaleString('vi-VN')}: Đã dùng <b>{log.usedQuantity} {sup.unit}</b> bởi {log.usedByStaffName} ({log.note || 'Không có ghi chú'})
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL 2: LẬP PHIẾU ĐÁNH GIÁ TÂM LÝ ĐỊNH KỲ (ITEM 3 - CHỈ PSYCHOLOGIST / SOCIAL_WORKER) */}
      {selectedPsyResident && (
        <div className="modal-overlay" onClick={() => setSelectedPsyResident(null)}>
          <div
            className="modal-card"
            style={{
              background: '#ffffff',
              borderRadius: '0.75rem',
              padding: '1.5rem',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
              border: '1px solid #e2e8f0',
              maxWidth: '650px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem' }}>
              <div>
                <h3 style={{ margin: 0, color: '#1e293b', fontSize: '1.2rem', fontWeight: 700 }}>
                  🧠 Lập Phiếu Đánh Giá Tâm Lý & Công Tác Xã Hội
                </h3>
                <div style={{ fontSize: '0.8rem', color: '#166534', fontWeight: 600, marginTop: '0.1rem' }}>
                  Cụ {selectedPsyResident.displayName} (Phòng {selectedPsyResident.room || '101'}) — Tự động xuất Cổng Thân Nhân
                </div>
              </div>
              <button
                type="button"
                className="btn btn-neutral"
                onClick={() => setSelectedPsyResident(null)}
                style={{ padding: '0.2rem 0.6rem', fontSize: '1rem', lineHeight: 1 }}
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                createPsyMutation.mutate();
              }}
            >
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem', marginBottom: '0.85rem' }}>
                <label className="field-group">
                  <span className="field-label">Kỳ đánh giá *</span>
                  <select
                    className="text-input"
                    value={psyPeriod}
                    onChange={(e) => setPsyPeriod(e.target.value as any)}
                  >
                    <option value="MONTHLY">Định kỳ Hàng tháng</option>
                    <option value="QUARTERLY">Định kỳ Hàng quý</option>
                    <option value="AD_HOC">Đánh giá đột xuất / Tiếp nhận</option>
                  </select>
                </label>

                <label className="field-group">
                  <span className="field-label">Trạng thái Cảm xúc & Tinh thần *</span>
                  <select
                    className="text-input"
                    value={psyEmotionalState}
                    onChange={(e) => setPsyEmotionalState(e.target.value as any)}
                  >
                    {Object.entries(EMOTIONAL_STATE_META).map(([k, meta]) => (
                      <option key={k} value={k}>{meta.label}</option>
                    ))}
                  </select>
                </label>

                <label className="field-group">
                  <span className="field-label">Mức độ Giao tiếp Xã hội *</span>
                  <select
                    className="text-input"
                    value={psySocialComm}
                    onChange={(e) => setPsySocialComm(e.target.value as any)}
                  >
                    {Object.entries(SOCIAL_COMMUNICATION_META).map(([k, meta]) => (
                      <option key={k} value={k}>{meta.label}</option>
                    ))}
                  </select>
                </label>

                <label className="field-group">
                  <span className="field-label">Nhận thức & Trí nhớ *</span>
                  <select
                    className="text-input"
                    value={psyCognitive}
                    onChange={(e) => setPsyCognitive(e.target.value as any)}
                  >
                    <option value="ALERT">Tỉnh táo, nhận thức tốt</option>
                    <option value="MILD_FORGETFUL">Giảm nhớ ngắn hạn nhẹ</option>
                    <option value="MODERATE_IMPAIRMENT">Suy giảm nhận thức trung bình</option>
                    <option value="DISORIENTED">Lẫn lộn / Mất định hướng</option>
                  </select>
                </label>

                <label className="field-group" style={{ gridColumn: 'span 2' }}>
                  <span className="field-label">Giấc ngủ & Hoạt động ban đêm *</span>
                  <select
                    className="text-input"
                    value={psySleep}
                    onChange={(e) => setPsySleep(e.target.value as any)}
                  >
                    <option value="GOOD">Giấc ngủ ngon, ngủ sâu 7-8 tiếng</option>
                    <option value="INTERRUPTED">Giấc ngủ chập chờn, hay tỉnh giấc</option>
                    <option value="INSOMNIA">Mất ngủ, khó đi vào giấc ngủ</option>
                    <option value="NIGHT_WANDERING">Hay đi lại ban đêm (Chờn vờn)</option>
                  </select>
                </label>
              </div>

              <label className="field-group" style={{ marginBottom: '0.85rem' }}>
                <span className="field-label">Ghi chú diễn biến cảm xúc chi tiết</span>
                <input
                  className="text-input"
                  placeholder="VD: Cụ vui vẻ sau khi con thăm, thích nghe nhạc cổ điển..."
                  value={psyEmotionalNotes}
                  onChange={(e) => setPsyEmotionalNotes(e.target.value)}
                />
              </label>

              <label className="field-group" style={{ marginBottom: '0.85rem' }}>
                <span className="field-label">Kết luận tổng quát về tâm lý *</span>
                <textarea
                  className="text-input"
                  rows={2}
                  placeholder="VD: Tinh thần cụ ổn định, hòa nhập tốt với tập thể..."
                  value={psyConclusion}
                  onChange={(e) => setPsyConclusion(e.target.value)}
                  required
                />
              </label>

              <label className="field-group" style={{ marginBottom: '1.25rem' }}>
                <span className="field-label">Khuyến nghị dành cho Gia đình / Thân nhân</span>
                <textarea
                  className="text-input"
                  rows={2}
                  placeholder="VD: Đề xuất gia đình tăng cường gọi video call buổi tối..."
                  value={psyRecommendations}
                  onChange={(e) => setPsyRecommendations(e.target.value)}
                />
              </label>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button
                  type="button"
                  className="btn btn-neutral"
                  onClick={() => setSelectedPsyResident(null)}
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={createPsyMutation.isPending || !psyConclusion.trim()}
                  style={{ fontWeight: 700, background: '#16a34a' }}
                >
                  {createPsyMutation.isPending ? 'Đang lưu...' : 'Lưu & Xuất Lên Cổng Thân Nhân'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="notice notice-info resident-authority-note">
        <strong>
          Nguyên tắc phân quyền:
        </strong>{' '}
        Việc xuất hiện một người trong danh sách
        không đồng nghĩa người dùng có quyền mở
        hồ sơ chăm sóc. Backend tiếp tục quyết định
        quyền truy cập cho từng resident.
      </div>

      {/* MODAL CHIA TAY TÂM AN & TRẢ GIƯỜNG (BGĐ & QUẢN LÝ) */}
      {farewellModalTarget && (
        <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, padding: '1rem' }}>
          <div className="modal-card" style={{ background: '#ffffff', borderRadius: '0.75rem', maxWidth: '540px', width: '100%', padding: '1.5rem', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem' }}>
              <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: '#fee2e2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', flexShrink: 0 }}>
                👋
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#1e293b' }}>
                  Chia Tay Tâm An & Trả Giường
                </h3>
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>
                  Thủ tục chia tay trung tâm dành cho cư dân chuyển ra ngoài
                </p>
              </div>
            </div>

            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '0.5rem', padding: '1rem', marginBottom: '1rem', fontSize: '0.9rem' }}>
              <div style={{ marginBottom: '0.5rem', color: '#1e293b' }}>
                👤 Người cao tuổi: <b>{farewellModalTarget.displayName}</b> ({farewellModalTarget.residentCode})
              </div>
              <div style={{ marginBottom: '0.75rem', color: '#1e293b' }}>
                🛏️ Vị trí phòng giường: <b>{farewellModalTarget.room ? `Phòng ${farewellModalTarget.room} / Giường ${farewellModalTarget.bed}` : 'Chưa xếp giường'}</b>
              </div>

              <div style={{ marginBottom: '0.85rem' }}>
                <label style={{ display: 'block', fontWeight: 700, fontSize: '0.82rem', marginBottom: '0.3rem', color: '#334155' }}>
                  Lý do chia tay Tâm An: <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <select
                  className="form-select"
                  style={{ width: '100%', padding: '0.45rem 0.75rem', fontSize: '0.85rem' }}
                  value={farewellReason}
                  onChange={(e) => setFarewellReason(e.target.value)}
                >
                  <option value="Hồi phục sức khỏe về với gia đình">🏡 Hồi phục sức khỏe về với gia đình</option>
                  <option value="Chuyển viện điều trị tuyến trên">🏥 Chuyển viện điều trị tuyến trên</option>
                  <option value="Theo nguyện vọng gia đình">👨‍👩‍👧‍👦 Theo nguyện vọng của gia đình</option>
                  <option value="Hoàn tất thời hạn hợp đồng lưu trú">📜 Hoàn tất thời hạn hợp đồng lưu trú</option>
                  <option value="Khác (Ghi rõ chi tiết)">📝 Lý do khác</option>
                </select>
              </div>

              <div style={{ background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: '0.375rem', padding: '0.75rem', color: '#9f1239', fontSize: '0.85rem', lineHeight: 1.45 }}>
                <b>⚠️ Cảnh báo thao tác:</b> Thao tác này sẽ chuyển trạng thái cư dân thành <b>"Đã hoàn thành lưu trú"</b>, giải phóng giường về trạng thái CÒN TRỐNG, và phát <b>Bell Notice</b> tới Ban Giám đốc và toàn thể nhân sự Tâm An Care.
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setFarewellModalTarget(null)}
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={async () => {
                  try {
                    await releaseBed(actor!, farewellModalTarget.residentId, farewellReason);
                    await queryClient.invalidateQueries({ queryKey: ['residents'] });
                    await queryClient.invalidateQueries({ queryKey: ['accommodation-overview'] });
                    setFarewellModalTarget(null);
                    alert(`✅ Đã hoàn tất thủ tục Chia Tay Tâm An & trả giường cho cụ ${farewellModalTarget.displayName}!`);
                  } catch (err: any) {
                    alert(err.message || 'Lỗi khi thực hiện thủ tục chia tay');
                  }
                }}
              >
                👋 Xác Nhận Chia Tay & Trả Giường
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

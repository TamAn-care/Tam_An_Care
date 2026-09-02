import {
  useMemo,
  useState,
} from 'react';

import {
  useQuery,
} from '@tanstack/react-query';

import {
  Link,
} from 'react-router-dom';

import {
  listResidents,
} from '../../api/residents';

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

import { getAssignedResidentIdsForActor } from '../../auth/role-policy';

type StatusFilter =
  | 'ALL'
  | 'ACTIVE'
  | 'INACTIVE';

export function ResidentsPage() {
  const { actor } = useActor();
  const actorId = actor?.actorId ?? '';
  const actorRole = actor?.actorRole ?? '';
  const actorName = actor?.displayName || 'Nhân viên';
  const isCaregiver = actorRole === 'CAREGIVER';

  const [search, setSearch] =
    useState('');

  const [statusFilter, setStatusFilter] =
    useState<StatusFilter>('ACTIVE');

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

          <p className="page-description">
            {isCaregiver
              ? `Danh sách người cao tuổi được phân quyền trực tiếp cho bạn chăm sóc. Chỉ hiển thị thông tin nghiệp vụ và hồ sơ phục vụ công tác chăm sóc hàng ngày.`
              : 'Danh sách người cao tuổi đang lưu trú và điều trị tại Trung Tâm Dưỡng Lão Tâm An.'}
          </p>

          {isCaregiver && (
            <div className="alert-card alert-info" style={{ marginTop: '0.75rem', padding: '0.75rem 1rem' }}>
              <span>🤲 <b>Chế độ bảo mật phân quyền:</b> Bạn đang xem danh sách <b>{activeCount} người cao tuổi</b> thuộc phân công phụ trách trực tiếp của bạn.</span>
            </div>
          )}
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
          <div className="kpi-number">{query.data?.length ?? 0}</div>
          <div className="kpi-desc">Toàn bộ hồ sơ trên hệ thống</div>
        </div>
        <div className="kpi-box">
          <div className="kpi-title">Đang lưu trú / Hoạt động</div>
          <div className="kpi-number" style={{ color: '#16a34a' }}>{activeCount}</div>
          <div className="kpi-desc">Cư dân đang ở trung tâm</div>
        </div>
        <div className="kpi-box">
          <div className="kpi-title">Mức (1) Tự phục vụ</div>
          <div className="kpi-number" style={{ color: '#2563eb' }}>{level1Count}</div>
          <div className="kpi-desc">Theo dõi y tế định kỳ</div>
        </div>
        <div className="kpi-box">
          <div className="kpi-title">Mức (2) & (3) Cần chăm sóc</div>
          <div className="kpi-number" style={{ color: '#ea580c' }}>{assistedCount}</div>
          <div className="kpi-desc">Hỗ trợ sinh hoạt & toàn diện</div>
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
                Đang hoạt động
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
                        <div style={{
                          width: '40px',
                          height: '40px',
                          borderRadius: '50%',
                          background: '#e0f2fe',
                          color: '#0369a1',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700,
                          fontSize: '1rem',
                        }}>
                          {resident.displayName.charAt(resident.displayName.lastIndexOf(' ') + 1) || 'C'}
                        </div>
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
                          ? 'Đang hoạt động'
                          : 'Đã hoàn thành lưu trú'}
                      </span>
                    </div>

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

                  <div style={{ marginTop: '0.5rem' }}>
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
                  </div>
                </article>
              ),
            )}
          </section>
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
    </>
  );
}

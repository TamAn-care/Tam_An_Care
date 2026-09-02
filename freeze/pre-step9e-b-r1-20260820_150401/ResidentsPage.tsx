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

type StatusFilter =
  | 'ALL'
  | 'ACTIVE'
  | 'INACTIVE';

export function ResidentsPage() {
  const { actor } = useActor();

  const [search, setSearch] =
    useState('');

  const [statusFilter, setStatusFilter] =
    useState<StatusFilter>('ACTIVE');

  const query = useQuery({
    queryKey: [
      'residents',
      actor?.actorId ?? 'anonymous',
      actor?.actorRole ?? 'none',
    ],
    queryFn: () =>
      listResidents(actor),
  });

  const residents =
    useMemo(() => {
      const rows = query.data ?? [];

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
    ]);

  const activeCount =
    (query.data ?? []).filter(
      ({ resident }) =>
        resident.activeStatus,
    ).length;

  const errorDescription =
    query.error instanceof ApiError
      ? query.error.message
      : query.error instanceof Error
        ? query.error.message
        : 'Không thể tải danh sách người cao tuổi.';

  return (
    <>
      <header className="page-header">
        <div className="eyebrow">
          Quản lý người cao tuổi
        </div>

        <h1 className="page-title">
          Người cao tuổi
        </h1>

        <p className="page-description">
          Danh sách ngữ cảnh người cao tuổi
          do backend hiện hành cung cấp.
          Quyền mở hồ sơ chăm sóc được backend
          kiểm tra riêng cho từng người.
        </p>
      </header>

      <section className="resident-summary-grid">
        <div className="card resident-summary-card">
          <span className="metric-label">
            Tổng hồ sơ
          </span>

          <strong className="metric-value">
            {query.data?.length ?? '—'}
          </strong>
        </div>

        <div className="card resident-summary-card">
          <span className="metric-label">
            Đang lưu trú / hoạt động
          </span>

          <strong className="metric-value">
            {query.data
              ? activeCount
              : '—'}
          </strong>
        </div>
      </section>

      <section className="card">
        <div className="resident-toolbar">
          <label className="field-group">
            <span className="field-label">
              Tìm kiếm
            </span>

            <input
              className="text-input"
              type="search"
              value={search}
              placeholder="Tên, mã hồ sơ, phòng hoặc giường"
              onChange={(event) =>
                setSearch(
                  event.target.value,
                )
              }
            />
          </label>

          <label className="field-group">
            <span className="field-label">
              Trạng thái
            </span>

            <select
              className="text-input"
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(
                  event.target.value
                    as StatusFilter,
                )
              }
            >
              <option value="ACTIVE">
                Đang hoạt động
              </option>

              <option value="INACTIVE">
                Không hoạt động
              </option>

              <option value="ALL">
                Tất cả
              </option>
            </select>
          </label>

          <button
            type="button"
            className="button button-subtle resident-refresh"
            disabled={query.isFetching}
            onClick={() => {
              void query.refetch();
            }}
          >
            {query.isFetching
              ? 'Đang làm mới…'
              : 'Làm mới'}
          </button>
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
            className="resident-list"
            aria-label="Danh sách người cao tuổi"
          >
            {residents.map(
              ({ resident }) => (
                <article
                  key={resident.residentId}
                  className="card resident-card"
                >
                  <div className="resident-card-main">
                    <div>
                      <div className="resident-card-heading">
                        <h2>
                          {resident.displayName}
                        </h2>

                        <span
                          className={
                            resident.activeStatus
                              ? 'resident-status resident-status-active'
                              : 'resident-status'
                          }
                        >
                          {resident.activeStatus
                            ? 'Đang hoạt động'
                            : 'Không hoạt động'}
                        </span>
                      </div>

                      <div className="resident-code">
                        Mã: {resident.residentCode}
                      </div>
                    </div>

                    <dl className="resident-facts">
                      <div>
                        <dt>Ngày sinh</dt>
                        <dd>
                          {formatVietnameseDate(
                            resident.dateOfBirth,
                          )}
                        </dd>
                      </div>

                      <div>
                        <dt>Giới tính</dt>
                        <dd>
                          {
                            GENDER_LABEL[
                              resident.gender
                            ]
                          }
                        </dd>
                      </div>

                      <div>
                        <dt>Mức chăm sóc</dt>
                        <dd>
                          {
                            CARE_LEVEL_LABEL[
                              resident.careLevel
                            ]
                          }
                        </dd>
                      </div>

                      <div>
                        <dt>Phòng / giường</dt>
                        <dd>
                          {resident.room ?? '—'}
                          {' / '}
                          {resident.bed ?? '—'}
                        </dd>
                      </div>
                    </dl>
                  </div>

                  <div className="resident-card-actions">
                    <Link
                      className="button resident-open-button"
                      to={`/residents/${
                        encodeURIComponent(
                          resident.residentId,
                        )
                      }/care`}
                    >
                      Mở hồ sơ chăm sóc
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

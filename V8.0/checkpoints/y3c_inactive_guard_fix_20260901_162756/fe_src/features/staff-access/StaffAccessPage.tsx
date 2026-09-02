import {
  useMemo,
  useState,
} from 'react';

import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import {
  listStaffActors,
  type StaffActorStatus,
} from '../../api/staff-actors';

import {
  createResidentAccessAssignment,
  listResidentAccessAssignments,
  revokeResidentAccessAssignment,
  type AssignmentRole,
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

type RoleFilter =
  | 'ALL'
  | 'CAREGIVER'
  | 'NURSE'
  | 'SUPERVISOR';

type StatusFilter =
  | 'ALL'
  | StaffActorStatus;

const ROLE_LABEL = {
  CAREGIVER: 'Nhân viên chăm sóc',
  NURSE: 'Điều dưỡng',
  CARE_MANAGER: 'Quản lý chăm sóc',
  SUPERVISOR: 'Giám sát',
} as const;

const STATUS_LABEL: Record<StaffActorStatus, string> = {
  ACTIVE: 'Đang hoạt động',
  INACTIVE: 'Không hoạt động',
  SUSPENDED: 'Tạm đình chỉ',
  ARCHIVED: 'Đã lưu trữ',
};

function errorText(
  error: unknown,
  fallback: string,
): string {
  if (error instanceof ApiError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return fallback;
}

export function StaffAccessPage() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] =
    useState<RoleFilter>('ALL');
  const [statusFilter, setStatusFilter] =
    useState<StatusFilter>('ACTIVE');

  const [residentId, setResidentId] =
    useState('');
  const [assignmentActorId, setAssignmentActorId] =
    useState('');
  const [assignmentRole, setAssignmentRole] =
    useState<AssignmentRole>('CAREGIVER');
  const [feedback, setFeedback] =
    useState<string | null>(null);

  const staffQuery = useQuery({
    queryKey: [
      'staff-actors',
      actor?.actorId ?? 'anonymous',
      actor?.actorRole ?? 'none',
    ],
    enabled: Boolean(actor),
    queryFn: () =>
      listStaffActors(actor, { limit: 100 }),
    retry(failureCount, error) {
      if (
        error instanceof ApiError &&
        [400, 401, 403, 404].includes(
          error.status,
        )
      ) {
        return false;
      }

      return failureCount < 1;
    },
  });

  const assignmentQuery = useQuery({
    queryKey: [
      'resident-access-assignments',
      actor?.actorId ?? 'anonymous',
    ],
    enabled: Boolean(actor),
    queryFn: () => {
      if (!actor) {
        throw new Error(
          'Chưa xác định phiên làm việc.',
        );
      }

      return listResidentAccessAssignments(actor);
    },
    retry: false,
  });

  const staff = useMemo(() => {
    const rows = staffQuery.data ?? [];
    const needle =
      search.trim().toLocaleLowerCase('vi');

    return rows.filter((item) => {
      if (
        roleFilter !== 'ALL' &&
        item.primaryOperationalRole !== roleFilter
      ) {
        return false;
      }

      if (
        statusFilter !== 'ALL' &&
        item.status !== statusFilter
      ) {
        return false;
      }

      if (!needle) {
        return true;
      }

      return [
        item.displayName,
        item.staffCode,
        item.actorId,
        item.employmentReference ?? '',
      ]
        .join(' ')
        .toLocaleLowerCase('vi')
        .includes(needle);
    });
  }, [
    staffQuery.data,
    search,
    roleFilter,
    statusFilter,
  ]);

  const assignableStaff = useMemo(
    () =>
      (staffQuery.data ?? []).filter(
        (item) =>
          item.status === 'ACTIVE' &&
          (
            item.primaryOperationalRole ===
              'CAREGIVER' ||
            item.primaryOperationalRole ===
              'NURSE'
          ),
      ),
    [staffQuery.data],
  );

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!actor) {
        throw new Error(
          'Chưa xác định phiên làm việc.',
        );
      }

      const normalizedResident =
        residentId.trim();
      const normalizedActor =
        assignmentActorId.trim();

      if (!normalizedResident) {
        throw new Error(
          'Vui lòng nhập Resident ID.',
        );
      }

      if (!normalizedActor) {
        throw new Error(
          'Vui lòng chọn nhân sự.',
        );
      }

      return createResidentAccessAssignment(
        actor,
        {
          residentId: normalizedResident,
          actorId: normalizedActor,
          actorRole: assignmentRole,
          accessScope: 'CARE',
        },
      );
    },
    onSuccess: async () => {
      setFeedback(
        'Đã tạo phân công chăm sóc.',
      );
      await queryClient.invalidateQueries({
        queryKey: [
          'resident-access-assignments',
        ],
      });
    },
    onError(error) {
      setFeedback(
        errorText(
          error,
          'Không thể tạo phân công.',
        ),
      );
    },
  });

  const revokeMutation = useMutation({
    mutationFn: async (
      assignmentId: string,
    ) => {
      if (!actor) {
        throw new Error(
          'Chưa xác định phiên làm việc.',
        );
      }

      return revokeResidentAccessAssignment(
        actor,
        assignmentId,
        {
          revocationReason:
            'Thu hồi từ giao diện quản trị',
        },
      );
    },
    onSuccess: async () => {
      setFeedback(
        'Đã thu hồi phân công.',
      );
      await queryClient.invalidateQueries({
        queryKey: [
          'resident-access-assignments',
        ],
      });
    },
    onError(error) {
      setFeedback(
        errorText(
          error,
          'Không thể thu hồi phân công.',
        ),
      );
    },
  });

  if (!actor) {
    return (
      <EmptyState
        title="Chưa xác định người dùng"
        description="Vui lòng xác định phiên làm việc."
      />
    );
  }

  return (
    <>
      <header className="page-header">
        <div className="eyebrow">
          Quản trị vận hành
        </div>

        <h1 className="page-title">
          Nhân sự & phân quyền
        </h1>

        <p className="page-description">
          Danh sách nhân sự và phân công truy cập
          hồ sơ chăm sóc. Backend tiếp tục là
          nguồn thẩm quyền cuối cùng.
        </p>
      </header>

      <section className="staff-summary-grid">
        <div className="card">
          <span className="metric-label">
            Tổng nhân sự
          </span>
          <strong className="metric-value">
            {staffQuery.data?.length ?? '—'}
          </strong>
        </div>

        <div className="card">
          <span className="metric-label">
            Đang hoạt động
          </span>
          <strong className="metric-value">
            {staffQuery.data
              ? staffQuery.data.filter(
                  (item) =>
                    item.status === 'ACTIVE',
                ).length
              : '—'}
          </strong>
        </div>

        <div className="card">
          <span className="metric-label">
            Phân công hiện có
          </span>
          <strong className="metric-value">
            {assignmentQuery.data?.length ?? '—'}
          </strong>
        </div>
      </section>

      <section className="card">
        <div className="section-heading">
          <div>
            <h2>Danh sách nhân sự</h2>
            <p className="helper">
              Tìm theo tên, mã nhân sự hoặc
              Actor ID.
            </p>
          </div>

          <button
            type="button"
            className="button button-subtle"
            disabled={staffQuery.isFetching}
            onClick={() => {
              void staffQuery.refetch();
            }}
          >
            {staffQuery.isFetching
              ? 'Đang làm mới…'
              : 'Làm mới'}
          </button>
        </div>

        <div className="staff-toolbar">
          <label className="field-group">
            <span className="field-label">
              Tìm kiếm
            </span>
            <input
              className="text-input"
              type="search"
              value={search}
              placeholder="Tên, mã nhân sự hoặc Actor ID"
              onChange={(event) =>
                setSearch(event.target.value)
              }
            />
          </label>

          <label className="field-group">
            <span className="field-label">
              Vai trò
            </span>
            <select
              className="text-input"
              value={roleFilter}
              onChange={(event) =>
                setRoleFilter(
                  event.target.value as RoleFilter,
                )
              }
            >
              <option value="ALL">Tất cả</option>
              <option value="CAREGIVER">
                Nhân viên chăm sóc
              </option>
              <option value="NURSE">
                Điều dưỡng
              </option>
              <option value="SUPERVISOR">
                Giám sát
              </option>
            </select>
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
                  event.target.value as StatusFilter,
                )
              }
            >
              <option value="ACTIVE">
                Đang hoạt động
              </option>
              <option value="INACTIVE">
                Không hoạt động
              </option>
              <option value="SUSPENDED">
                Tạm đình chỉ
              </option>
              <option value="ARCHIVED">
                Đã lưu trữ
              </option>
              <option value="ALL">
                Tất cả
              </option>
            </select>
          </label>
        </div>
      </section>

      {staffQuery.isLoading && (
        <LoadingState
          title="Đang tải nhân sự"
          description="Hệ thống đang lấy danh sách nhân sự."
        />
      )}

      {staffQuery.isError && (
        <ErrorState
          title="Không thể tải nhân sự"
          description={errorText(
            staffQuery.error,
            'Không thể tải danh sách nhân sự.',
          )}
        />
      )}

      {staffQuery.isSuccess &&
        staff.length === 0 && (
          <EmptyState
            title="Không có nhân sự phù hợp"
            description="Thử thay đổi từ khóa hoặc bộ lọc."
          />
        )}

      {staffQuery.isSuccess &&
        staff.length > 0 && (
          <section
            className="staff-list"
            aria-label="Danh sách nhân sự"
          >
            {staff.map((item) => (
              <article
                key={item.actorId}
                className="card staff-card"
              >
                <div className="staff-card-heading">
                  <div>
                    <h2>{item.displayName}</h2>
                    <div className="resident-code">
                      {item.staffCode}
                    </div>
                  </div>

                  <span
                    className={
                      item.status === 'ACTIVE'
                        ? 'resident-status resident-status-active'
                        : 'resident-status'
                    }
                  >
                    {STATUS_LABEL[item.status]}
                  </span>
                </div>

                <dl className="resident-facts">
                  <div>
                    <dt>Vai trò</dt>
                    <dd>
                      {
                        ROLE_LABEL[
                          item.primaryOperationalRole
                        ]
                      }
                    </dd>
                  </div>

                  <div>
                    <dt>Actor ID</dt>
                    <dd>{item.actorId}</dd>
                  </div>

                  <div>
                    <dt>Tham chiếu lao động</dt>
                    <dd>
                      {item.employmentReference ??
                        '—'}
                    </dd>
                  </div>
                </dl>
              </article>
            ))}
          </section>
        )}

      <section className="card staff-access-section">
        <div className="section-heading">
          <div>
            <h2>Tạo phân công chăm sóc</h2>
            <p className="helper">
              Chỉ CAREGIVER hoặc NURSE đang hoạt
              động mới nên được chọn.
            </p>
          </div>
        </div>

        <div className="staff-assignment-form">
          <label className="field-group">
            <span className="field-label">
              Resident ID
            </span>
            <input
              className="text-input"
              value={residentId}
              onChange={(event) =>
                setResidentId(event.target.value)
              }
              placeholder="resident-id"
            />
          </label>

          <label className="field-group">
            <span className="field-label">
              Nhân sự
            </span>
            <select
              className="text-input"
              value={assignmentActorId}
              onChange={(event) => {
                const next =
                  event.target.value;
                setAssignmentActorId(next);

                const selected =
                  assignableStaff.find(
                    (item) =>
                      item.actorId === next,
                  );

                if (
                  selected &&
                  selected.primaryOperationalRole !==
                    'SUPERVISOR'
                ) {
                  setAssignmentRole(
                    selected.primaryOperationalRole,
                  );
                }
              }}
            >
              <option value="">
                Chọn nhân sự
              </option>
              {assignableStaff.map((item) => (
                <option
                  key={item.actorId}
                  value={item.actorId}
                >
                  {item.displayName} — {
                    ROLE_LABEL[
                      item.primaryOperationalRole
                    ]
                  }
                </option>
              ))}
            </select>
          </label>

          <label className="field-group">
            <span className="field-label">
              Vai trò phân công
            </span>
            <select
              className="text-input"
              value={assignmentRole}
              onChange={(event) =>
                setAssignmentRole(
                  event.target.value as AssignmentRole,
                )
              }
            >
              <option value="CAREGIVER">
                Nhân viên chăm sóc
              </option>
              <option value="NURSE">
                Điều dưỡng
              </option>
            </select>
          </label>

          <button
            type="button"
            className="button button-primary"
            disabled={createMutation.isPending}
            onClick={() => {
              setFeedback(null);
              createMutation.mutate();
            }}
          >
            {createMutation.isPending
              ? 'Đang tạo…'
              : 'Tạo phân công'}
          </button>
        </div>

        {feedback && (
          <div
            className="notice notice-info staff-feedback"
            role="status"
          >
            {feedback}
          </div>
        )}
      </section>

      <section className="card staff-access-section">
        <div className="section-heading">
          <div>
            <h2>Phân công hiện tại</h2>
            <p className="helper">
              Thu hồi phân công được gửi tới backend
              để kiểm tra thẩm quyền.
            </p>
          </div>

          <button
            type="button"
            className="button button-subtle"
            disabled={assignmentQuery.isFetching}
            onClick={() => {
              void assignmentQuery.refetch();
            }}
          >
            Làm mới
          </button>
        </div>

        {assignmentQuery.isLoading && (
          <LoadingState
            title="Đang tải phân công"
            description="Hệ thống đang lấy dữ liệu phân quyền."
          />
        )}

        {assignmentQuery.isError && (
          <ErrorState
            title="Không thể tải phân công"
            description={errorText(
              assignmentQuery.error,
              'Không thể tải dữ liệu phân quyền.',
            )}
          />
        )}

        {assignmentQuery.isSuccess &&
          assignmentQuery.data.length === 0 && (
            <EmptyState
              title="Chưa có phân công"
              description="Hiện chưa có phân công truy cập."
            />
          )}

        {assignmentQuery.isSuccess &&
          assignmentQuery.data.length > 0 && (
            <div className="assignment-list">
              {assignmentQuery.data.map(
                (assignment) => (
                  <article
                    key={
                      assignment
                        .residentAccessAssignmentId
                    }
                    className="assignment-row"
                  >
                    <div>
                      <strong>
                        {assignment.actorId}
                      </strong>
                      <div className="helper">
                        Resident: {
                          assignment.residentId
                        } · {
                          ROLE_LABEL[
                            assignment.actorRole
                          ]
                        } · {
                          assignment.status
                        }
                      </div>
                    </div>

                    {assignment.status ===
                      'ACTIVE' && (
                      <button
                        type="button"
                        className="button button-subtle"
                        disabled={
                          revokeMutation.isPending
                        }
                        onClick={() => {
                          setFeedback(null);
                          revokeMutation.mutate(
                            assignment
                              .residentAccessAssignmentId,
                          );
                        }}
                      >
                        Thu hồi
                      </button>
                    )}
                  </article>
                ),
              )}
            </div>
          )}
      </section>

      <div className="notice notice-info">
        <strong>Nguyên tắc phân quyền:</strong>{' '}
        giao diện chỉ hỗ trợ thao tác. Backend
        xác thực SUPERVISOR, vai trò nhân sự,
        vòng đời, trùng phân công và phạm vi
        truy cập.
      </div>
    </>
  );
}

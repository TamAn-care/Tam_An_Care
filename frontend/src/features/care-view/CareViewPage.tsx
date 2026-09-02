import {
  useQuery,
} from '@tanstack/react-query';

import {
  Link,
  useParams,
} from 'react-router-dom';

import {
  getResidentCareView,
} from '../../api/residents';

import {
  useActor,
} from '../../auth/ActorContext';

import {
  ROLE_LABELS,
  getAssignedResidentIdsForActor,
} from '../../auth/role-policy';
import { useMemo } from 'react';

import {
  ApiError,
} from '../../api/errors';

import {
  EmptyState,
  ErrorState,
  LoadingState,
} from '../../components/feedback/FeedbackStates';

import {
  AVAILABILITY_LABEL,
  textFromRecord,
} from '../residents/resident-ui';

function availabilityClass(
  value: 'AVAILABLE' | 'EMPTY' | 'UNAVAILABLE',
): string {
  if (value === 'AVAILABLE') {
    return 'availability availability-available';
  }

  if (value === 'EMPTY') {
    return 'availability availability-empty';
  }

  return 'availability availability-unavailable';
}

export function CareViewPage() {
  const { residentId } =
    useParams();

  const { actor } = useActor();

  const normalizedResidentId =
    residentId ?? '';

  const query = useQuery({
    queryKey: [
      'resident-care-view',
      normalizedResidentId,
      actor?.actorId ?? 'none',
      actor?.actorRole ?? 'none',
    ],

    enabled:
      Boolean(normalizedResidentId) &&
      Boolean(actor),

    queryFn: () => {
      if (!actor) {
        throw new Error(
          'Chưa có ngữ cảnh người dùng.',
        );
      }

      return getResidentCareView(
        normalizedResidentId,
        actor,
      );
    },

    retry(failureCount, error) {
      if (
        error instanceof ApiError &&
        [401, 403, 404].includes(
          error.status,
        )
      ) {
        return false;
      }

      return failureCount < 1;
    },
  });

  if (!normalizedResidentId) {
    return (
      <ErrorState
        title="Không thể mở hồ sơ"
        description="Mã resident không hợp lệ."
      />
    );
  }

  if (!actor) {
    return (
      <EmptyState
        title="Chưa xác định người dùng"
        description="Vui lòng xác định phiên làm việc trước khi mở hồ sơ chăm sóc."
      />
    );
  }

  if (query.isLoading) {
    return (
      <>
        <header className="page-header">
          <div className="eyebrow">
            Hồ sơ chăm sóc
          </div>

          <h1 className="page-title">
            Đang kiểm tra quyền truy cập
          </h1>
        </header>

        <LoadingState
          title="Đang tải hồ sơ chăm sóc"
          description="Backend đang xác thực quyền và tổng hợp dữ liệu vận hành."
        />
      </>
    );
  }

  if (query.isError) {
    const isNonDisclosure =
      query.error instanceof ApiError &&
      query.error.status === 404;

    const description =
      isNonDisclosure
        ? 'Dữ liệu không khả dụng hoặc bạn không có quyền truy cập hồ sơ này.'
        : query.error instanceof Error
          ? query.error.message
          : 'Không thể tải hồ sơ chăm sóc.';

    return (
      <>
        <header className="page-header">
          <div className="eyebrow">
            Hồ sơ chăm sóc
          </div>

          <h1 className="page-title">
            Không thể mở hồ sơ
          </h1>

          <p className="page-description">
            Hệ thống không tiết lộ thêm thông tin
            khi quyền truy cập không được xác nhận.
          </p>
        </header>

        <ErrorState
          title={
            isNonDisclosure
              ? 'Hồ sơ không khả dụng'
              : 'Không thể tải dữ liệu'
          }
          description={description}
        />

        <div className="resident-back-row">
          <Link
            to="/residents"
            className="button button-subtle"
          >
            Quay lại danh sách
          </Link>
        </div>
      </>
    );
  }

  const data = query.data;

  if (!data) {
    return (
      <EmptyState
        title="Chưa có dữ liệu"
        description="Care View chưa trả về dữ liệu."
      />
    );
  }

  const residentName =
    textFromRecord(
      data.resident,
      'displayName',
    ) ??
    textFromRecord(
      data.resident,
      'display_name',
    ) ??
    'Hồ sơ chăm sóc';

  const residentCode =
    textFromRecord(
      data.resident,
      'residentCode',
    ) ??
    textFromRecord(
      data.resident,
      'resident_code',
    );

  const room =
    textFromRecord(
      data.resident,
      'room',
    );

  const bed =
    textFromRecord(
      data.resident,
      'bed',
    );

  const isSupervisorOrAdmin =
    actor.actorRole === 'SUPERVISOR' ||
    actor.actorRole === 'CARE_MANAGER' ||
    actor.actorRole === 'ADMIN' ||
    actor.actorRole === 'RECEPTIONIST';

  const assignedResidentIds = useMemo(() => {
    return new Set(
      getAssignedResidentIdsForActor(actor.actorId, actor.displayName).map(id => id.toLowerCase())
    );
  }, [actor.actorId, actor.displayName]);

  const targetResidentId = (textFromRecord(data.resident, 'residentId') || textFromRecord(data.resident, 'resident_id') || normalizedResidentId).toLowerCase();
  const targetResidentCode = (textFromRecord(data.resident, 'residentCode') || textFromRecord(data.resident, 'resident_code') || '').toLowerCase();

  const isAuthorized =
    isSupervisorOrAdmin ||
    assignedResidentIds.has(targetResidentId) ||
    assignedResidentIds.has(targetResidentCode) ||
    assignedResidentIds.has(normalizedResidentId.toLowerCase());

  if (!isAuthorized) {
    return (
      <main className="page" style={{ padding: '2rem 1rem' }}>
        <div className="card" style={{ background: '#fff1f2', border: '1.5px solid #fecdd3', borderRadius: '0.75rem', padding: '2.5rem 1.5rem', textAlign: 'center', maxWidth: '680px', margin: '2rem auto', boxShadow: '0 10px 15px -3px rgba(225, 29, 72, 0.08)' }}>
          <div style={{ fontSize: '3.5rem', marginBottom: '0.5rem' }}>🔒</div>
          <h2 style={{ color: '#9f1239', margin: '0 0 0.5rem 0', fontSize: '1.35rem', fontWeight: 800 }}>
            Hạn Chế Truy Cập Hồ Sơ Chăm Sóc Cư Dân
          </h2>
          <p style={{ color: '#881337', fontSize: '0.92rem', lineHeight: '1.6', marginBottom: '1.25rem' }}>
            Tài khoản <b>{actor.displayName}</b> ({ROLE_LABELS[actor.actorRole] || actor.actorRole}) chưa được Ban Giám đốc phân công phụ trách cư dân <b>{residentName}</b> ({residentCode || normalizedResidentId}).
          </p>

          <div style={{ background: '#ffffff', border: '1px solid #fda4af', borderRadius: '0.5rem', padding: '1rem 1.25rem', textAlign: 'left', marginBottom: '1.5rem', fontSize: '0.86rem' }}>
            <div style={{ fontWeight: 700, color: '#9f1239', marginBottom: '0.35rem' }}>📋 Quy định bảo mật thông tin & phân quyền y khoa:</div>
            <div style={{ color: '#475569', lineHeight: '1.5' }}>
              Nhằm đảm bảo an toàn thông tin sức khỏe cá nhân (eMAR) và tuân thủ quy trình phân công chăm sóc, chỉ những Điều dưỡng và Chăm sóc viên được <b>cấp quyền phụ trách trực tiếp</b> mới có thể xem và ghi nhận nhật ký chăm sóc cho cư dân này.
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/residents" className="btn btn-secondary" style={{ padding: '0.55rem 1.25rem', textDecoration: 'none' }}>
              &larr; Quay lại danh sách người cao tuổi
            </Link>
            {isSupervisorOrAdmin && (
              <Link to="/staff-access" className="btn btn-primary" style={{ padding: '0.55rem 1.25rem', textDecoration: 'none' }}>
                ⚙️ Cấp quyền phân công nhân sự
              </Link>
            )}
          </div>
        </div>
      </main>
    );
  }

  const sections = [
    {
      key: 'carePlan',
      label: 'Kế hoạch chăm sóc',
      availability:
        data.availability.carePlan,
      count:
        data.carePlan ? 1 : 0,
    },
    {
      key: 'workQueue',
      label: 'Công việc chăm sóc',
      availability:
        data.availability.workQueue,
      count:
        data.workQueue.length,
    },
    {
      key: 'clinical',
      label: 'Theo dõi lâm sàng',
      availability:
        data.availability.clinical,
      count:
        data.clinical.length,
    },
    {
      key: 'medicationOrders',
      label: 'Y lệnh thuốc',
      availability:
        data.availability
          .medicationOrders,
      count:
        data.medication.orders.length,
    },
    {
      key: 'medicationAdministrations',
      label: 'Lần dùng thuốc',
      availability:
        data.availability
          .medicationAdministrations,
      count:
        data.medication
          .administrations.length,
    },
    {
      key: 'incidents',
      label: 'Sự cố',
      availability:
        data.availability.incidents,
      count:
        data.incidents.length,
    },
  ];

  return (
    <>
      <div className="resident-back-row">
        <Link
          to="/residents"
          className="button button-subtle"
        >
          ← Danh sách người cao tuổi
        </Link>

        <button
          type="button"
          className="button button-subtle"
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

      <header className="page-header care-view-header">
        <div className="eyebrow">
          Hồ sơ chăm sóc vận hành
        </div>

        <h1 className="page-title">
          {residentName}
        </h1>

        <p className="page-description">
          {residentCode
            ? `Mã hồ sơ: ${residentCode}`
            : `Resident ID: ${normalizedResidentId}`}
        </p>

        <div className="care-view-meta">
          <span>
            Phòng: {room ?? '—'}
          </span>

          <span>
            Giường: {bed ?? '—'}
          </span>

          <span>
            Chế độ: Chỉ đọc
          </span>
        </div>
      </header>

      <section className="card care-authority-card">
        <div className="section-heading">
          <div>
            <h2>
              Quyền truy cập đã được xác nhận
            </h2>

            <p className="helper">
              Backend đã xác thực actor và
              canonical resident scope.
            </p>
          </div>

          <span className="resident-status resident-status-active">
            Được phép truy cập
          </span>
        </div>

        <dl className="care-authority-facts">
          <div>
            <dt>Vai trò</dt>
            <dd>{ROLE_LABELS[data.access.actorRole as keyof typeof ROLE_LABELS] || data.access.actorRole}</dd>
          </div>

          <div>
            <dt>Phạm vi</dt>
            <dd>{data.access.scope}</dd>
          </div>

          <div>
            <dt>Phạm vi cư dân</dt>
            <dd>
              {
                data.access
                  .residentScopeEnforcement
              }
            </dd>
          </div>

          <div>
            <dt>Redaction</dt>
            <dd>
              {data.access.redactionApplied
                ? 'Có'
                : 'Không'}
            </dd>
          </div>
        </dl>
      </section>

      <section className="care-domain-grid">
        {sections.map((section) => (
          <article
            key={section.key}
            className="card care-domain-card"
          >
            <div className="care-domain-top">
              <h2>{section.label}</h2>

              <span
                className={availabilityClass(
                  section.availability,
                )}
              >
                {
                  AVAILABILITY_LABEL[
                    section.availability
                  ]
                }
              </span>
            </div>

            <strong className="care-domain-count">
              {section.count}
            </strong>

            <span className="helper">
              bản ghi trong Care View hiện tại
            </span>
          </article>
        ))}
      </section>

      <section className="card">
        <div className="section-heading">
          <div>
            <h2>
              Trạng thái dữ liệu
            </h2>

            <p className="helper">
              Dữ liệu được tổng hợp tại thời điểm
              Care View được tạo.
            </p>
          </div>

          <span className="status">
            Read only
          </span>
        </div>

        <dl className="care-authority-facts">
          <div>
            <dt>Generated at</dt>
            <dd>
              {new Date(
                data.generatedAt,
              ).toLocaleString('vi-VN')}
            </dd>
          </div>

          <div>
            <dt>Server authorized</dt>
            <dd>
              {data.access.serverAuthorized
                ? 'Có'
                : 'Không'}
            </dd>
          </div>

          <div>
            <dt>Cross-domain mutation</dt>
            <dd>
              {data.authority
                .crossDomainMutation
                ? 'Cho phép'
                : 'Không'}
            </dd>
          </div>

          <div>
            <dt>View mode</dt>
            <dd>{data.viewMode}</dd>
          </div>
        </dl>
      </section>

      <div
        className="notice notice-info"
        role="note"
      >
        <strong>
          Phiên bản V7.5 hiện chỉ đọc:
        </strong>{' '}
        màn hình này không tạo, sửa hoặc xóa dữ
        liệu chăm sóc. Mọi quyền truy cập vẫn do
        backend V7.4.3 quyết định.
      </div>
    </>
  );
}

import {
  DevelopmentActorPanel,
} from '../../auth/DevelopmentActorPanel';

import {
  useActor,
} from '../../auth/ActorContext';

import {
  useEffect,
  useState,
} from 'react';

import {
  ROLE_LABELS,
} from '../../auth/role-policy';

import {
  getOperationalDashboard,
} from '../../api/operational-care';

export function DashboardPage() {
  const { actor } = useActor();

  const [
    dashboard,
    setDashboard,
  ] = useState<any>(null);

  const [
    dashboardError,
    setDashboardError,
  ] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (!actor) {
      setDashboard(null);
      setDashboardError(null);
      return;
    }

    getOperationalDashboard({
      actorId: actor.actorId,
      actorRole: actor.actorRole,
    })
      .then((result) => {
        if (!cancelled) {
          setDashboard(result);
          setDashboardError(null);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setDashboard(null);

          setDashboardError(
            error instanceof Error
              ? error.message
              : 'Không tải được dữ liệu vận hành.',
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [actor]);

  return (
    <>
      <header className="page-header">
        <div className="eyebrow">
          Không gian vận hành
        </div>

        <h1 className="page-title">
          Tổng quan
        </h1>

        <p className="page-description">
          Theo dõi hoạt động chăm sóc và
          các nội dung cần chú ý trong ngày.
        </p>
      </header>

      {actor && (
        <section className="card">
          <div className="section-heading">
            <div>
              <h2>
                Phiên làm việc hiện tại
              </h2>

              <p className="helper">
                Backend tiếp tục kiểm tra
                quyền ở mọi API request.
              </p>
            </div>

            <span className="status">
              <span className="status-dot" />

              {
                ROLE_LABELS[
                  actor.actorRole
                ]
              }
            </span>
          </div>
        </section>
      )}

      <div className="grid">
        <section className="card">
          <span className="metric-label">
            Người cao tuổi
          </span>

          <strong className="metric-value">
            —
          </strong>

          {dashboardError ? (
            <p className="helper">
              {dashboardError}
            </p>
          ) : (
            <div className="metric-grid">
              <div>
                <span className="metric-label">
                  Người cao tuổi hiển thị
                </span>

                <strong className="metric-value">
                  {dashboard?.summary?.visibleResidents ?? 0}
                </strong>
              </div>

              <div>
                <span className="metric-label">
                  Công việc đang mở
                </span>

                <strong className="metric-value">
                  {dashboard?.summary?.openTasks ?? 0}
                </strong>
              </div>

              <div>
                <span className="metric-label">
                  Đang thực hiện
                </span>

                <strong className="metric-value">
                  {dashboard?.summary?.inReviewTasks ?? 0}
                </strong>
              </div>

              <div>
                <span className="metric-label">
                  Chưa phân công
                </span>

                <strong className="metric-value">
                  {dashboard?.summary?.unassignedTasks ?? 0}
                </strong>
              </div>
            </div>
          )}
        </section>

        <section className="card">
          <span className="metric-label">
            Cần chú ý
          </span>

          <strong className="metric-value">
            —
          </strong>

          <p className="helper">
            Chưa tải dữ liệu vận hành.
          </p>
        </section>

        <section className="card">
          <span className="metric-label">
            Công việc
          </span>

          <strong className="metric-value">
            —
          </strong>

          <p className="helper">
            Chưa tải work queue.
          </p>
        </section>
      </div>

      <DevelopmentActorPanel />
    </>
  );
}

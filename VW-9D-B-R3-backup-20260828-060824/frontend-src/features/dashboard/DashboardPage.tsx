import {
  DevelopmentActorPanel,
} from '../../auth/DevelopmentActorPanel';

import {
  useActor,
} from '../../auth/ActorContext';

import {
  ROLE_LABELS,
} from '../../auth/role-policy';

export function DashboardPage() {
  const { actor } = useActor();

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

          <p className="helper">
            Dữ liệu thật sẽ được kết nối
            tại bước dashboard integration.
          </p>
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

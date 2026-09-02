import {
  DevelopmentActorPanel,
} from '../../auth/DevelopmentActorPanel';

export function DashboardPage() {
  return (
    <>
      <header className="page-header">
        <h1 className="page-title">
          Tổng quan
        </h1>

        <p className="page-description">
          Nền tảng giao diện V7.5 đã được
          khởi tạo. Dữ liệu dashboard thật
          sẽ được tích hợp ở bước tiếp theo.
        </p>
      </header>

      <div className="grid">
        <section className="card">
          <strong>
            Hệ thống frontend
          </strong>
          <p className="placeholder">
            React + TypeScript + Vite
          </p>
        </section>

        <section className="card">
          <strong>
            Quyền truy cập
          </strong>
          <p className="placeholder">
            Backend V7.4.3 vẫn là nguồn
            thẩm quyền duy nhất.
          </p>
        </section>

        <section className="card">
          <strong>
            Trạng thái
          </strong>
          <p className="placeholder">
            STEP 9C foundation
          </p>
        </section>
      </div>

      <DevelopmentActorPanel />
    </>
  );
}

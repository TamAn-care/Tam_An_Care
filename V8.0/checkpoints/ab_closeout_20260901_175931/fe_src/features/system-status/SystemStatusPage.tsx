import {
  API_BASE_URL,
} from '../../api/client';

export function SystemStatusPage() {
  return (
    <>
      <header className="page-header">
        <h1 className="page-title">
          Trạng thái hệ thống
        </h1>

        <p className="page-description">
          Thông tin kết nối nền tảng.
        </p>
      </header>

      <section className="card">
        <strong>Backend API</strong>
        <p>{API_BASE_URL}</p>
      </section>
    </>
  );
}

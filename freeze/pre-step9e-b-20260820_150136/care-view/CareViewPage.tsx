import {
  useParams,
} from 'react-router-dom';

export function CareViewPage() {
  const { residentId } =
    useParams();

  return (
    <>
      <header className="page-header">
        <h1 className="page-title">
          Hồ sơ chăm sóc
        </h1>

        <p className="page-description">
          Resident ID: {residentId}
        </p>
      </header>

      <section className="card">
        <p className="placeholder">
          Care View API sẽ được kết nối
          sau foundation gate.
        </p>
      </section>
    </>
  );
}

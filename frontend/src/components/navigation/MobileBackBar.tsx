import { useLocation, useNavigate } from 'react-router-dom';

export function MobileBackBar() {
  const navigate = useNavigate();
  const location = useLocation();

  if (location.pathname === '/' || location.pathname === '/dashboard') {
    return null;
  }

  const goBack = () => {
    const idx = (window.history.state as { idx?: unknown } | null)?.idx;
    if (typeof idx === 'number' && idx > 0) {
      navigate(-1);
    } else {
      navigate('/dashboard', { replace: true });
    }
  };

  return (
    <nav className="tamancare-mobile-back-bar no-print" aria-label="Điều hướng quay lại">
      <button
        type="button"
        className="tamancare-mobile-back-button"
        onClick={goBack}
        aria-label="Quay lại trang trước"
      >
        <span aria-hidden="true">←</span>
        <span>Quay lại</span>
      </button>
    </nav>
  );
}

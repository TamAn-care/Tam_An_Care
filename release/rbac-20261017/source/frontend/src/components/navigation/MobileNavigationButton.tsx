interface Props {
  open: boolean;
  onToggle: () => void;
}

export function MobileNavigationButton({
  open,
  onToggle,
}: Props) {
  return (
    <button
      type="button"
      className="mobile-menu-button"
      aria-expanded={open}
      aria-controls="application-sidebar"
      onClick={onToggle}
    >
      <span aria-hidden="true">
        {open ? '×' : '☰'}
      </span>

      <span>
        {open ? 'Đóng menu' : 'Menu'}
      </span>
    </button>
  );
}

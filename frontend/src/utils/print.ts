/**
 * Utility helper for triggering high-fidelity window print across Tam An Care.
 * Handles DOM flush and animation frame delays for desktop browsers,
 * while executing synchronously on mobile devices to preserve user gesture context
 * required by iOS Safari and Android Chrome to open the native print preview & printer selection screen.
 */
export function triggerPrint(onComplete?: () => void): void {
  // Ensure keyboard focus is cleared from triggering button to avoid visual artifact
  if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
    document.activeElement.blur();
  }

  // Detect mobile environment (iOS Safari, Android Chrome, mobile webviews, touch screens, screen width < 768px)
  const isMobile = typeof window !== 'undefined' && (
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
    window.matchMedia('(max-width: 767px)').matches ||
    ('ontouchstart' in window || navigator.maxTouchPoints > 0)
  );

  const executePrint = () => {
    try {
      if (typeof window !== 'undefined' && typeof window.print === 'function') {
        window.print();
      } else {
        alert('Trình duyệt hiện tại không hỗ trợ chức năng in (window.print). Vui lòng thử lại trên Safari hoặc Google Chrome.');
      }
    } catch (err) {
      console.error('[TamAnCare Print] Lỗi khi kích hoạt window.print():', err);
      alert('Không thể mở giao diện in. Vui lòng kiểm tra quyền truy cập máy in trên thiết bị.');
    } finally {
      if (onComplete) {
        onComplete();
      }
    }
  };

  if (isMobile) {
    // On mobile devices, window.print MUST execute synchronously in response to user tap/click gesture
    executePrint();
  } else {
    // On desktop browsers, double rAF + short timeout ensures React state & CSS @media print styling finish rendering
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setTimeout(executePrint, 50);
      });
    });
  }
}



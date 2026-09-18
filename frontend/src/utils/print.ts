/**
 * Utility helper for triggering high-fidelity window print across Tam An Care.
 * Handles DOM flush and animation frame delays to ensure React component state
 * and CSS @media print styling are fully applied before opening native print dialog.
 */
export function triggerPrint(onComplete?: () => void): void {
  // Ensure keyboard focus is cleared from triggering button to avoid visual artifact
  if (document.activeElement instanceof HTMLElement) {
    document.activeElement.blur();
  }

  // Double animation frame + 150ms delay ensures React component state, conditional renders,
  // and CSS @media print styling are completely painted before opening native print dialog.
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      setTimeout(() => {
        try {
          window.print();
        } catch (err) {
          console.error('[TamAnCare Print] Error triggering window.print():', err);
        } finally {
          if (onComplete) {
            onComplete();
          }
        }
      }, 150);
    });
  });
}


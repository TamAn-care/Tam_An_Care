import React, { useEffect } from 'react';

/**
 * GlobalModalResizer
 * Enables dragging edges & corners to resize all desktop pop-up windows across the app.
 * E.g., "Phiếu Đánh Giá Sức Khỏe Định Kỳ Cho Người Cao Tuổi" modal window.
 */
export const GlobalModalResizer: React.FC = () => {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const HANDLE_DIRECTIONS = ['n', 's', 'e', 'w', 'nw', 'ne', 'sw', 'se'] as const;
    type Direction = (typeof HANDLE_DIRECTIONS)[number];

    const attachResizeHandles = (modalEl: HTMLElement) => {
      // Prevent attaching duplicate handles
      if (modalEl.dataset.resizableAttached === 'true') return;
      modalEl.dataset.resizableAttached = 'true';

      // Ensure modal element has relative positioning for handle anchors
      const computedPos = window.getComputedStyle(modalEl).position;
      if (computedPos === 'static') {
        modalEl.style.position = 'relative';
      }

      // 1. Create and attach 8 directional handles
      HANDLE_DIRECTIONS.forEach((dir: Direction) => {
        const handle = document.createElement('div');
        handle.className = `modal-resize-handle modal-resize-handle-${dir}`;
        handle.dataset.direction = dir;

        handle.addEventListener('mousedown', (e: MouseEvent) => {
          // Only active on desktop viewports (width >= 768px)
          if (window.innerWidth < 768) return;
          if (e.button !== 0) return; // Left mouse click only

          e.preventDefault();
          e.stopPropagation();

          const startX = e.clientX;
          const startY = e.clientY;
          const rect = modalEl.getBoundingClientRect();
          const startWidth = rect.width;
          const startHeight = rect.height;

          // Detect overlay alignment to compute symmetric/asymmetric stretching
          const parentOverlay =
            modalEl.closest('.modal-overlay, .modal-backdrop, .print-modal-overlay') || modalEl.parentElement;
          const parentStyle = parentOverlay ? window.getComputedStyle(parentOverlay) : null;
          const isFlexCenteredX = parentStyle ? parentStyle.justifyContent.includes('center') : true;
          const isFlexCenteredY = parentStyle ? parentStyle.alignItems.includes('center') : true;

          // Override restrictive inline constraints during drag
          modalEl.style.maxWidth = '98vw';
          modalEl.style.maxHeight = '96vh';
          modalEl.style.boxSizing = 'border-box';
          document.body.classList.add('is-modal-resizing');

          const onMouseMove = (moveEvt: MouseEvent) => {
            const dx = moveEvt.clientX - startX;
            const dy = moveEvt.clientY - startY;

            let newWidth = startWidth;
            let newHeight = startHeight;

            // Horizontal resize calculation
            if (dir.includes('e')) {
              newWidth = isFlexCenteredX ? startWidth + dx * 2 : startWidth + dx;
            } else if (dir.includes('w')) {
              newWidth = isFlexCenteredX ? startWidth - dx * 2 : startWidth - dx;
            }

            // Vertical resize calculation
            if (dir.includes('s')) {
              newHeight = isFlexCenteredY ? startHeight + dy * 2 : startHeight + dy;
            } else if (dir.includes('n')) {
              newHeight = isFlexCenteredY ? startHeight - dy * 2 : startHeight - dy;
            }

            // Enforce safe boundaries
            const minW = 320;
            const maxW = Math.max(minW, window.innerWidth - 32);
            const minH = 200;
            const maxH = Math.max(minH, window.innerHeight - 32);

            newWidth = Math.max(minW, Math.min(maxW, newWidth));
            newHeight = Math.max(minH, Math.min(maxH, newHeight));

            if (dir.includes('e') || dir.includes('w')) {
              modalEl.style.width = `${Math.round(newWidth)}px`;
            }
            if (dir.includes('s') || dir.includes('n')) {
              modalEl.style.height = `${Math.round(newHeight)}px`;
            }
          };

          const onMouseUp = () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
            document.body.classList.remove('is-modal-resizing');
          };

          window.addEventListener('mousemove', onMouseMove);
          window.addEventListener('mouseup', onMouseUp);
        });

        // Double click handle to reset modal size to default
        handle.addEventListener('dblclick', (e: MouseEvent) => {
          e.preventDefault();
          e.stopPropagation();
          modalEl.style.width = '';
          modalEl.style.height = '';
          modalEl.style.maxWidth = '';
          modalEl.style.maxHeight = '';
        });

        modalEl.appendChild(handle);
      });

      // 2. Add visual corner grip affordance on bottom-right corner
      if (!modalEl.querySelector('.modal-resize-grip-se')) {
        const grip = document.createElement('div');
        grip.className = 'modal-resize-grip-se';
        grip.title = 'Đặt chuột vào góc/cạnh để kéo mở rộng hoặc thu hẹp cửa sổ (Nhấp kép để khôi phục)';

        grip.addEventListener('dblclick', (e: MouseEvent) => {
          e.preventDefault();
          e.stopPropagation();
          modalEl.style.width = '';
          modalEl.style.height = '';
          modalEl.style.maxWidth = '';
          modalEl.style.maxHeight = '';
        });

        modalEl.appendChild(grip);
      }
    };

    const scanAndAttach = () => {
      if (window.innerWidth < 768) return;

      // Selectors matching modal pop-up windows
      const modalSelectors = [
        '.modal-card',
        '.modal-dialog',
        '.modal-print-card',
        '[role="dialog"]',
        '[data-modal="true"]',
      ];

      modalSelectors.forEach((sel) => {
        document.querySelectorAll<HTMLElement>(sel).forEach(attachResizeHandles);
      });

      // Scan direct children of modal overlays if not matched by class name
      document
        .querySelectorAll<HTMLElement>('.modal-overlay, .modal-backdrop, .print-modal-overlay')
        .forEach((overlay) => {
          Array.from(overlay.children).forEach((child) => {
            if (child instanceof HTMLElement && !child.classList.contains('modal-resize-handle')) {
              const style = window.getComputedStyle(child);
              if (
                style.display !== 'none' &&
                (child.classList.contains('modal-card') ||
                  child.classList.contains('modal-dialog') ||
                  child.classList.contains('printable-a4-sheet') ||
                  style.backgroundColor !== 'transparent')
              ) {
                attachResizeHandles(child);
              }
            }
          });
        });
    };

    // Initial scan
    scanAndAttach();

    // Observe DOM mutations to auto-attach handles on dynamically opened popups
    const observer = new MutationObserver(() => {
      scanAndAttach();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    const handleResize = () => {
      scanAndAttach();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return null;
};

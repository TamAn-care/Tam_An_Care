import React from 'react';

/**
 * @deprecated Tester mode has been removed per system specification.
 */
export interface TesterPortalModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function TesterPortalModal({ isOpen, onClose }: TesterPortalModalProps) {
  if (!isOpen) return null;
  return (
    <div style={{ display: 'none' }}>
      <button type="button" onClick={onClose}>Close</button>
    </div>
  );
}

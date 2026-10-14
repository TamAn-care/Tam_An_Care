import React from 'react';
import { InitialPsychologyBaselineDraft } from '../psychosocial/InitialPsychologyBaselineDraft';
import { ModuleLauncherGrid } from '../../components/navigation/AppNavigation';

export function DashboardPage() {
  return (
    <div className="page-content">
      <InitialPsychologyBaselineDraft />
      <div style={{ marginTop: '0.5rem', marginBottom: '1.75rem' }}>
        <ModuleLauncherGrid />
      </div>
    </div>
  );
}


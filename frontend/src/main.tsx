import React from 'react';
import ReactDOM from 'react-dom/client';

import {
  App,
} from './app/App';

import {
  AppProviders,
} from './app/providers';

import './design/globals.css';


const GO_LIVE_SIMULATION_CLEANUP_KEY =
  'tamancare_golive_simulation_cleanup_20261001_v1';

const AUTH_STORAGE_KEYS = new Set([
  'taman-care-production-access-token',
  'taman-care-v75-development-actor',
]);

const GO_LIVE_EXACT_STORAGE_KEYS = new Set([
  'taman_kitchen_floor_delivery_v2',
  'taman_kitchen_hygiene_checks_v2',
  'taman_kitchen_meal_stage_v2',
  'taman_nutrition_diet_profiles',
  'taman_nutrition_extra_meals',
  'taman_service_contracts_v1',
  'taman_weekly_menu_schedule_v2',
  'taman_workforce_shifts_v1',
  'taman_care_mock_work_events',
]);

const GO_LIVE_STORAGE_PREFIXES = [
  'taman_care_mock_adl_',
  'taman_care_mock_vitals_',
  'taman_care_mock_vitals_history_',
];

function shouldRemoveGoLiveSimulationKey(key: string): boolean {
  if (AUTH_STORAGE_KEYS.has(key)) return false;
  if (GO_LIVE_EXACT_STORAGE_KEYS.has(key)) return true;

  return GO_LIVE_STORAGE_PREFIXES.some(
    (prefix) => key.startsWith(prefix),
  );
}

function cleanStorage(storage: Storage): string[] {
  const removed: string[] = [];
  const keys: string[] = [];

  for (let i = 0; i < storage.length; i += 1) {
    const key = storage.key(i);
    if (key) keys.push(key);
  }

  for (const key of keys) {
    if (shouldRemoveGoLiveSimulationKey(key)) {
      storage.removeItem(key);
      removed.push(key);
    }
  }

  return removed;
}

function runGoLiveBrowserStateMigration(): void {
  if (typeof window === 'undefined') return;

  try {
    if (
      window.localStorage.getItem(
        GO_LIVE_SIMULATION_CLEANUP_KEY,
      ) === 'complete'
    ) return;

    const removedLocalStorageKeys =
      cleanStorage(window.localStorage);

    const removedSessionStorageKeys =
      cleanStorage(window.sessionStorage);

    window.localStorage.setItem(
      GO_LIVE_SIMULATION_CLEANUP_KEY,
      'complete',
    );

    console.info(
      '[TamAnCare] Go-live browser-state migration complete.',
      {
        removedLocalStorageKeys,
        removedSessionStorageKeys,
        authenticationPreserved: true,
      },
    );
  } catch (error) {
    console.warn(
      '[TamAnCare] Browser-state migration could not complete.',
      error,
    );
  }
}

runGoLiveBrowserStateMigration();

ReactDOM.createRoot(
  document.getElementById('root')!,
).render(
  <React.StrictMode>
    <AppProviders>
      <App />
    </AppProviders>
  </React.StrictMode>,
);

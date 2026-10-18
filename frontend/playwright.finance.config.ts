import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.FINANCE_E2E_BASE_URL;

export default defineConfig({
  testDir: './e2e',
  testMatch: 'finance-pricing.spec.ts',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 10_000 },
  reporter: 'list',
  outputDir: 'test-results/finance',
  use: {
    baseURL,
    // The test logs in through the real form. Traces are started manually after login
    // so auth request bodies never enter downloadable artifacts.
    trace: 'off',
    screenshot: 'only-on-failure',
    video: 'off',
    actionTimeout: 15_000,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 } } },
  ],
  metadata: { environment: process.env.FINANCE_E2E_ENVIRONMENT || 'synthetic-isolated' },
});

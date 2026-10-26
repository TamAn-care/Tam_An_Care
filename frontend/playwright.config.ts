import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 20_000,
  fullyParallel: false,
  use: { baseURL: 'http://127.0.0.1:33124', headless: true },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 } } },
    { name: 'mobile', use: { ...devices['iPhone 13'] } },
    { name: 'tablet', use: { ...devices['iPad Mini'] } },
  ],
});

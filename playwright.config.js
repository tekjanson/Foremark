// playwright.config.js
import { defineConfig, devices } from '@playwright/test';

const PORT = process.env.E2E_PORT || 3777;
const DATA_DIR = process.env.E2E_DATA_DIR || `./data-e2e/run-${Date.now()}`;

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  reporter: process.env.CI ? 'line' : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: `node server/server.js`,
    env: {
      PORT: String(PORT),
      DATA_DIR,
    },
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: false,
    timeout: 20_000,
  },
});

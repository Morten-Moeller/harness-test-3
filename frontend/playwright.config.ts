import { defineConfig } from '@playwright/test'

const databaseUrl = process.env.DATABASE_URL ?? 'postgres://todo:todo@localhost:5432/todo?sslmode=disable'
const backendAddr = '127.0.0.1:8090'
const frontendUrl = 'http://localhost:5173'

export default defineConfig({
  testDir: 'e2e',
  globalSetup: './e2e/global-setup.ts',
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: frontendUrl,
    testIdAttribute: 'data-testid',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  webServer: [
    {
      command: 'go run ./cmd/server',
      cwd: '../backend',
      url: `http://${backendAddr}/api/lists`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: { DATABASE_URL: databaseUrl, HTTP_ADDR: backendAddr, LOG_LEVEL: 'info' },
    },
    {
      command: 'pnpm exec vite --strictPort',
      url: frontendUrl,
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
})

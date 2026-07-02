import { defineConfig, devices } from '@playwright/test';

const PORT = 5173;
const baseURL = `http://localhost:${PORT}`;

// End-to-end tests run against a real browser driving the built app served by
// Vite. Unit tests (Vitest) live under src/**/*.test.ts; these e2e specs live
// under e2e/**/*.spec.ts so the two runners never pick up each other's files.
export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['html', { open: 'never' }], ['list']] : 'list',

  use: {
    baseURL,
    // The app is mobile-first (max-w-md); test at a phone-ish viewport.
    viewport: { width: 390, height: 844 },
    trace: 'on-first-retry',
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 } } },
  ],

  // Vite dev is a clean target for e2e: vite-plugin-pwa keeps the service worker
  // off in dev, so there is no cache to make tests flaky. strictPort makes a port
  // clash fail loudly instead of silently serving on another port.
  webServer: {
    command: `npm run dev -- --port ${PORT} --strictPort`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});

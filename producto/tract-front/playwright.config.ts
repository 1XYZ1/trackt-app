import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  retries: 2,
  reporter: [
    ['html', { open: 'never' }],
    ['list'],
  ],
  use: {
    baseURL: process.env.E2E_BASE_URL || 'https://trackt-front.vercel.app',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      testIgnore: '**/qr-mobile.spec.ts',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
    {
      name: 'mobile',
      testMatch: '**/qr-mobile.spec.ts',
      use: {
        // Pixel 5 emulates chromium-based mobile (isMobile:true, touch:true).
        // iPhone 14 Pro Max uses webkit which is not installed in this env.
        ...devices['Pixel 5'],
      },
    },
  ],
});

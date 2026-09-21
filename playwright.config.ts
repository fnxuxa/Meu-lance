import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  retries: 0,
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:5178', screenshot: 'only-on-failure' },
  projects: [
    {
      name: 'desktop',
      use: {
        ...devices['Desktop Chrome'],
        channel: process.env.PLAYWRIGHT_CHANNEL === 'chromium' ? undefined : 'msedge',
      },
    },
    {
      name: 'mobile',
      use: {
        ...devices['iPhone 13'],
        defaultBrowserType: 'chromium',
        channel: process.env.PLAYWRIGHT_CHANNEL === 'chromium' ? undefined : 'msedge',
        viewport: { width: 375, height: 812 },
      },
    },
  ],
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 5178 --strictPort',
    url: 'http://127.0.0.1:5178',
    reuseExistingServer: false,
    env: { VITE_SUPABASE_URL: '', VITE_SUPABASE_ANON_KEY: '' },
  },
});

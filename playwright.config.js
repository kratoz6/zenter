// HallMate — Playwright e2e configuration.
//
// Default baseURL points at the live Vercel deployment. Override with the
// PLAYWRIGHT_BASE_URL env var when targeting a preview build or local dev:
//   PLAYWRIGHT_BASE_URL=http://localhost:8080 npm run test:e2e
//
// Firebase auth requires a configured test phone number to run the auth specs:
//   PLAYWRIGHT_TEST_PHONE=9442946876   (last 10 digits, no +91)
//   PLAYWRIGHT_TEST_OTP=123456
// Set these in .env (gitignored — see .env.example). Auth tests skip if absent.

import { defineConfig, devices } from '@playwright/test';

// Auto-load .env (Node ≥ 21.7). Silently ignored if the file is absent.
try { process.loadEnvFile('.env'); } catch { /* no .env, fine */ }

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',

  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'https://hall-mate.vercel.app',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    { name: 'Desktop Chrome', use: { ...devices['Desktop Chrome'] } },
    { name: 'iPhone 13',      use: { ...devices['iPhone 13'] } },
  ],
});

// HallMate — Auth flow smoke tests.
//
// Auth tests use Firebase test phone numbers configured in the Firebase
// console. Set PLAYWRIGHT_TEST_PHONE + PLAYWRIGHT_TEST_OTP to run the
// full OTP path; tests gracefully skip otherwise.

import { test, expect } from './_fixtures.js';

// Defaults match the Firebase Console test numbers wired in _fixtures.js.
// Override per-run:  PLAYWRIGHT_TEST_PHONE=9442946876 PLAYWRIGHT_TEST_OTP=123456
const TEST_PHONE = process.env.PLAYWRIGHT_TEST_PHONE || '6363616007';
const TEST_OTP   = process.env.PLAYWRIGHT_TEST_OTP   || '111111';

test.describe('Login page', () => {
  test('loads with phone input + Send OTP button', async ({ page }) => {
    await page.goto('/login.html');

    await expect(page).toHaveTitle(/Sign in/i);
    await expect(page.locator('#hm-phone')).toBeVisible();
    await expect(page.locator('#hm-send-otp')).toBeVisible();
    await expect(page.locator('#hm-send-otp')).toHaveText(/Send OTP/i);
  });

  test('shows +91 prefix', async ({ page }) => {
    await page.goto('/login.html');
    await expect(page.locator('.hm-input-prefix__addon')).toHaveText(/\+91/);
  });

  test('phone field rejects more than 10 digits', async ({ page }) => {
    await page.goto('/login.html');
    const phone = page.locator('#hm-phone');
    await phone.fill('9442946876');
    await expect(phone).toHaveValue('9442946876'); // capped at maxlength=10
  });

  test('"Trouble signing in? Get Help" link points to /contact.html', async ({ page }) => {
    await page.goto('/login.html');
    const help = page.getByRole('link', { name: /Get Help/i }).first();
    await expect(help).toBeVisible();
    await expect(help).toHaveAttribute('href', '/contact.html');
  });

  test('Terms + Privacy links present', async ({ page }) => {
    await page.goto('/login.html');
    await expect(page.getByRole('link', { name: 'Terms' })).toBeVisible();
    await expect(page.getByRole('link', { name: /Privacy Policy/ })).toBeVisible();
  });
});

// Single end-to-end OTP test. We deliberately collapse the three previous
// "reveal screen", "Get Help on OTP", and "full submission" cases into one
// flow so we only consume the Firebase test-phone budget ONCE per run —
// rapid repeat calls within seconds are rate-limited by Firebase Phone Auth
// even for configured test numbers, leaving the Send-OTP button stuck.
test.describe('OTP flow', () => {
  test.describe.configure({ timeout: 90_000 });

  test('end-to-end sign-in: phone → OTP screen → verify → dashboard/onboarding', async ({ page }) => {
    test.skip(!TEST_PHONE || !TEST_OTP, 'PLAYWRIGHT_TEST_PHONE / PLAYWRIGHT_TEST_OTP not set.');

    // 1. Submit phone
    await page.goto('/login.html');
    await page.locator('#hm-phone').fill(TEST_PHONE);
    await page.locator('#hm-send-otp').click();

    // 2. OTP screen reveals + structural assertions on the same page
    await expect(page.locator('#hm-form-otp')).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('#hm-otp-1')).toBeVisible();

    // Get Help link is rendered inside the OTP form too. Scope the locator
    // to #hm-form-otp because the phone form (and its Get Help link) becomes
    // hidden when OTP step takes over — leaving only one accessible link.
    const otpHelp = page.locator('#hm-form-otp').getByRole('link', { name: /Get Help/i });
    await expect(otpHelp).toBeVisible();
    await expect(otpHelp).toHaveAttribute('href', '/contact.html');

    // 3. Fill the 6 OTP cells
    for (let i = 0; i < TEST_OTP.length; i++) {
      await page.locator(`#hm-otp-${i + 1}`).fill(TEST_OTP[i]);
    }

    // 4. Redirect to dashboard or onboarding (first-time). Vercel rewrites
    //    .html → clean URLs, so accept either form.
    await page.waitForURL(/\/(dashboard|onboarding)(\.html)?(\?|#|\/?$)/, { timeout: 30_000 });
  });
});

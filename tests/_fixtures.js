// HallMate — Shared Playwright fixtures.
//
// Extends the default `test` so every spec automatically runs with E2E mode
// active. The init script runs BEFORE any page module loads, so when
// firebase-config.js boots it sees window.__hm_e2e = true and sets
// auth.settings.appVerificationDisabledForTesting = true — bypassing
// reCAPTCHA for Firebase test phone numbers.
//
// Usage in spec files:
//   import { test, expect } from './_fixtures.js';

import { test as base, expect } from '@playwright/test';

// reCAPTCHA is disabled globally in firebase-config.js — no init script needed.
export const test = base.extend({});

export { expect };

// Shared sign-in helper.
//
// PLAYWRIGHT_TEST_PHONE  — 10-digit number (e.g. "6363616007") OR a longer
//   string from which the last 10 digits are used (the login field strips the
//   +91 prefix; normalizePhoneIN in utils.js only accepts 10-digit Indian
//   numbers starting with 6-9, so we always extract the last 10).
// PLAYWRIGHT_TEST_OTP    — fixed OTP code set in Firebase Console (e.g. "111111")
//
// Defaults (Firebase Console test numbers configured for this project):
//   Primary:   PHONE=6363616007  OTP=111111
//   Secondary: PHONE=9442946876  OTP=123456
export async function signIn(page) {
  const rawPhone = process.env.PLAYWRIGHT_TEST_PHONE || '6363616007';
  const otp      = process.env.PLAYWRIGHT_TEST_OTP   || '111111';

  // Extract the last 10 digits so callers can pass full numbers like
  // "636363616007" or "919442946876" without worrying about the +91 prefix
  // that the login page renders.
  const digits = rawPhone.replace(/\D/g, '');
  const phone  = digits.length > 10 ? digits.slice(-10) : digits;

  await page.goto('/login.html');
  await page.locator('#hm-phone').fill(phone);
  await page.locator('#hm-send-otp').click();
  // Wait for OTP screen — reCAPTCHA is bypassed by the E2E fixture flag.
  await page.waitForSelector('#hm-form-otp:not([hidden])', { timeout: 15_000 });
  for (let i = 0; i < otp.length; i++) {
    await page.locator(`#hm-otp-${i + 1}`).fill(otp[i]);
  }
  await page.waitForURL(/\/(dashboard|onboarding)\.html/, { timeout: 20_000 });
}

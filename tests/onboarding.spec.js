// HallMate — Onboarding flow tests.
//
// Onboarding requires an authenticated user. Tests that need auth skip
// unless PLAYWRIGHT_TEST_PHONE + PLAYWRIGHT_TEST_OTP are configured.
// Public-shell assertions (auth-gate redirect, structural checks)
// run unconditionally.

import { test, expect, signIn } from './_fixtures.js';

const TEST_PHONE = process.env.PLAYWRIGHT_TEST_PHONE || '6363616007';
const TEST_OTP   = process.env.PLAYWRIGHT_TEST_OTP   || '111111';

test.describe('Onboarding — auth gate', () => {
  test('redirects unauthenticated visitor to login', async ({ page }) => {
    await page.goto('/onboarding.html');
    await page.waitForURL(/\/login(\.html)?(\?|#|\/?$)/, { timeout: 10_000 });
  });
});

test.describe('Onboarding — Step 2 cascade', () => {
  test.skip(!TEST_PHONE || !TEST_OTP, 'auth-only suite — set PLAYWRIGHT_TEST_PHONE/_OTP.');

  test.beforeEach(async ({ page }) => {
    await signIn(page);
    if (!/\/onboarding/.test(page.url())) {
      test.skip(true, 'User already completed onboarding — switch to a fresh test number.');
    }
  });

  test('district stays disabled until state is selected', async ({ page }) => {
    // Walk through step 1 first
    await page.locator('#hm-name').fill('Playwright Tester');
    await page.locator('#hm-gender').selectOption('Male');
    await page.locator('#hm-form-step1 button[type=submit]').click();

    const district = page.locator('#hm-district');
    await expect(district).toBeDisabled();

    await page.locator('#hm-state').selectOption('Tamil Nadu');
    await expect(district).toBeEnabled();

    // District options should now include some Tamil Nadu districts
    const optionCount = await district.locator('option').count();
    expect(optionCount).toBeGreaterThan(5);
  });

  test('changing state resets district', async ({ page }) => {
    await page.locator('#hm-name').fill('Playwright Tester');
    await page.locator('#hm-gender').selectOption('Male');
    await page.locator('#hm-form-step1 button[type=submit]').click();

    await page.locator('#hm-state').selectOption('Tamil Nadu');
    await page.locator('#hm-district').selectOption({ index: 1 });
    const before = await page.locator('#hm-district').inputValue();
    expect(before).not.toBe('');

    await page.locator('#hm-state').selectOption('Kerala');
    await expect(page.locator('#hm-district')).toHaveValue('');
  });
});

test.describe('Onboarding — validation', () => {
  test.skip(!TEST_PHONE || !TEST_OTP, 'auth-only suite — set PLAYWRIGHT_TEST_PHONE/_OTP.');

  test('Step 1 blocks progression when name + gender are empty', async ({ page }) => {
    await signIn(page);
    test.skip(!/\/onboarding/.test(page.url()), 'Onboarding already complete.');

    await page.locator('#hm-form-step1 button[type=submit]').click();
    // Stay on step 1
    await expect(page.locator('[data-step-panel="1"]')).toBeVisible();
    await expect(page.locator('[data-step-panel="2"]')).toBeHidden();
  });
});

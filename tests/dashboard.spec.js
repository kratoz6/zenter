// HallMate — Dashboard tests.
//
// Dashboard requires auth. Auth-gated assertions skip unless credentials
// are provided; the public-shell redirect test runs unconditionally.

import { test, expect, signIn } from './_fixtures.js';

const TEST_PHONE = process.env.PLAYWRIGHT_TEST_PHONE || '6363616007';
const TEST_OTP   = process.env.PLAYWRIGHT_TEST_OTP   || '111111';

test.describe('Dashboard — auth gate', () => {
  test('redirects unauthenticated visitor to login', async ({ page }) => {
    await page.goto('/dashboard.html');
    await page.waitForURL(/\/login(\.html)?(\?|#|\/?$)/, { timeout: 10_000 });
  });
});

test.describe('Dashboard — authenticated shell', () => {
  test.skip(!TEST_PHONE || !TEST_OTP, 'auth-only suite — set PLAYWRIGHT_TEST_PHONE/_OTP.');

  test.beforeEach(async ({ page }) => {
    await signIn(page);
    if (!/\/dashboard/.test(page.url())) {
      await page.goto('/dashboard.html');
    }
  });

  test('tab bar renders with Find Mates + Connections', async ({ page }) => {
    const tabs = page.locator('.hm-tab[data-tab]');
    await expect(tabs).toHaveCount(2);
    await expect(tabs.nth(0)).toHaveText(/Find Mates/);
    await expect(tabs.nth(1)).toHaveText(/Connections/);
  });

  test('Find Mates tab is active by default', async ({ page }) => {
    await expect(page.locator('.hm-tab[data-tab="find-mates"]')).toHaveClass(/is-active/);
    await expect(page.locator('#hm-panel-find-mates')).toBeVisible();
    await expect(page.locator('#hm-panel-connections')).toBeHidden();
  });

  test('clicking Connections tab swaps panels + updates URL hash', async ({ page }) => {
    await page.locator('.hm-tab[data-tab="connections"]').click();

    await expect(page.locator('.hm-tab[data-tab="connections"]')).toHaveClass(/is-active/);
    await expect(page.locator('#hm-panel-connections')).toBeVisible();
    await expect(page.locator('#hm-panel-find-mates')).toBeHidden();
    expect(page.url()).toMatch(/#connections$/);
  });

  test('direct load of /dashboard.html#connections opens Connections tab', async ({ page }) => {
    await page.goto('/dashboard.html#connections');
    await expect(page.locator('.hm-tab[data-tab="connections"]')).toHaveClass(/is-active/);
    await expect(page.locator('#hm-panel-connections')).toBeVisible();
  });

  test('sidebar filters render (state, district, centre, gender)', async ({ page }) => {
    await expect(page.locator('#hm-filter-state')).toBeVisible();
    await expect(page.locator('#hm-filter-district')).toBeVisible();
    await expect(page.locator('#hm-filter-center')).toBeVisible();
    await expect(page.locator('#hm-filter-gender')).toBeVisible();
  });

  test('travel + stay quick filters render above grid', async ({ page }) => {
    await expect(page.locator('#hm-filter-travel')).toBeVisible();
    await expect(page.locator('#hm-filter-stay')).toBeVisible();
  });

  test('district filter is empty until state picked, then populated', async ({ page }) => {
    const district = page.locator('#hm-filter-district');
    const before = await district.locator('option').count();
    expect(before).toBeLessThanOrEqual(1); // only "All districts"

    await page.locator('#hm-filter-state').selectOption('Tamil Nadu');
    const after = await district.locator('option').count();
    expect(after).toBeGreaterThan(5);
  });

  test('no duplicate navbar Find Mates / Connections links', async ({ page }) => {
    // Tabs live in the content area; navbar should NOT have these as nav links.
    const navFindMates = page.locator('.hm-nav-links a:has-text("Find Mates")');
    const navConnections = page.locator('.hm-nav-links a:has-text("Connections")');
    await expect(navFindMates).toHaveCount(0);
    await expect(navConnections).toHaveCount(0);
  });

  test('navbar shows avatar dropdown when logged in', async ({ page }) => {
    await expect(page.locator('#hm-avatar-btn')).toBeVisible();
  });
});

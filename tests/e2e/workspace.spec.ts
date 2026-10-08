import { test, expect, type Page } from '@playwright/test';
import { createHash } from 'node:crypto';
function demoId(label: string) {
  const d = createHash('sha256').update(`proview-demo:${label}`).digest('hex');
  return `${d.slice(0, 8)}-${d.slice(8, 12)}-4${d.slice(13, 16)}-a${d.slice(17, 20)}-${d.slice(20, 32)}`;
}
const password = process.env.DEMO_PASSWORD ?? 'ProViewDemo!2026';
async function login(page: Page, identifier: string) {
  await page.goto('/login');
  await page.getByLabel('Email or username').fill(identifier);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole('heading', { name: /Hello,/ })).toBeVisible();
}
test('student session refresh, role boundaries, PDF and no external runtime requests', async ({
  page,
  context,
}) => {
  const external: string[] = [];
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await context.route('**/*', (route) => {
    const url = new URL(route.request().url());
    if (
      ['http:', 'https:'].includes(url.protocol) &&
      !['localhost', '127.0.0.1'].includes(url.hostname)
    ) {
      external.push(url.href);
      return route.abort();
    }
    return route.continue();
  });
  await login(page, 'student1');
  await expect(page.locator('.stat-card')).toHaveCount(4);
  await page.screenshot({ path: 'test-results/dashboard-desktop.png', fullPage: true });
  expect(await page.evaluate(() => Object.keys(localStorage))).toEqual([]);
  const cookies = await context.cookies();
  expect(cookies.find((cookie) => cookie.name === 'proview_refresh')?.httpOnly).toBe(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: /Hello,/ })).toBeVisible();
  await page.goto('/admin/users');
  await expect(
    page.getByRole('heading', { name: 'This area requires staff access.' }),
  ).toBeVisible();
  await page.goto('/projects');
  await expect(page.getByRole('heading', { name: 'My projects' })).toBeVisible();
  await page.goto(`/submissions/${demoId('active-group-1-submission-1')}`);
  await expect(page.getByRole('tab', { name: /Document/ })).toBeVisible();
  await expect(page.locator('.pdf-viewer')).toBeVisible();
  await page.goto('/notifications');
  await expect(page.getByRole('heading', { name: 'Notifications' })).toBeVisible();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto('/projects');
  await expect(page).toHaveURL(/\/login/);
  expect(external).toEqual([]);
  expect(errors).toEqual([]);
});
test('instructor and administrator pages resolve real data', async ({ page }) => {
  const failures: string[] = [];
  page.on('pageerror', (error) => failures.push(error.message));
  await login(page, 'instructor');
  for (const path of [
    '/courses',
    '/review-management',
    '/grading',
    '/similarity-checks',
    '/archive',
  ]) {
    await page.goto(path);
    await expect(page.getByRole('button', { name: 'Sign out', exact: true })).toBeVisible();
    await page.waitForLoadState('networkidle');
    await expect(page.locator('main h1').first()).toBeVisible();
    await expect(page.getByText('Something went wrong', { exact: true })).toHaveCount(0);
  }
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await login(page, 'admin');
  await page.goto('/admin/users');
  await expect(page.getByRole('heading', { name: 'User accounts' })).toBeVisible();
  await expect(page.locator('tbody')).toContainText('Demo Administrator');
  await page.goto('/admin/audit');
  await expect(page.locator('tbody tr').first()).toBeVisible();
  expect(failures).toEqual([]);
});
test('student uploads and explicitly submits an immutable PDF version through the UI', async ({
  page,
}) => {
  await login(page, 'student10');
  await page.goto(`/submissions/${demoId('active-group-4-submission-1')}`);
  await page.getByRole('button', { name: '↑ Upload revision' }).click();
  await page.getByLabel('PDF document').setInputFiles('apps/api/prisma/assets/demo-report.pdf');
  const changeNote = `Browser acceptance: preserved version history ${Date.now()}`;
  await page.getByLabel('What changed?').fill(changeNote);
  const uploaded = page.waitForResponse(
    (response) => response.url().includes('/versions') && response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Upload PDF', exact: true }).click();
  const response = await uploaded;
  expect(response.status()).toBe(201);
  const version = await response.json();
  await expect(
    page.getByText(
      'PDF uploaded as a new version. Choose Submit version when it is ready for review.',
      { exact: true },
    ),
  ).toBeVisible();
  await page.getByRole('combobox', { name: 'Choose document version' }).selectOption(version.id);
  await expect(page.locator('.pdf-viewer')).toBeVisible();
  page.once('dialog', (dialog) => dialog.accept());
  const submit = page.waitForResponse(
    (response) => response.url().endsWith('/submit') && response.request().method() === 'POST',
  );
  await page
    .getByRole('button', { name: `Submit version ${version.versionNumber}`, exact: true })
    .click();
  expect((await submit).status()).toBe(201);
  await expect(page.getByText('Version submitted.', { exact: true })).toBeVisible();
  await page.getByRole('tab', { name: 'Version history' }).click();
  await expect(page.getByText(changeNote, { exact: true })).toBeVisible();
});
test('peer reviewer saves a collaborative rubric draft through the UI', async ({ page }) => {
  await login(page, 'student10');
  await page.goto(`/reviews/${demoId('active-group-2-submission-1-assignment-4')}`);
  await expect(page.getByRole('heading', { name: 'Your review draft' })).toBeVisible();
  await page
    .getByLabel('Overall comments')
    .fill('Browser acceptance: traceable assessment saved to the server.');
  const saved = page.waitForResponse(
    (response) => response.url().endsWith('/review') && response.request().method() === 'PUT',
  );
  await page.getByRole('button', { name: 'Save draft', exact: true }).click();
  expect((await saved).status()).toBe(200);
  await expect(
    page.getByText('Draft saved to the server. Your team can continue from this revision.'),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Overall comments')).toHaveValue(
    'Browser acceptance: traceable assessment saved to the server.',
  );
});
test('mobile navigation remains usable without horizontal page overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, 'student2');
  await page.getByRole('button', { name: 'Toggle navigation' }).click();
  await page
    .getByRole('navigation', { name: 'Main navigation' })
    .getByRole('link', { name: /My projects/ })
    .click();
  await expect(page.getByRole('heading', { name: 'My projects' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await expect
    .poll(() =>
      page.locator('.sidebar').evaluate((element) => element.getBoundingClientRect().right),
    )
    .toBeLessThanOrEqual(0);
  await page.screenshot({ path: 'test-results/projects-mobile.png', fullPage: true });
});

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
  await page.getByRole('button', { name: 'Login to ProView' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole('heading', { name: 'Overview', exact: true })).toBeVisible();
}
test('student session refresh, role boundaries, PDF and no external runtime requests', async ({
  page,
  context,
}) => {
  const external: string[] = [];
  const errors: string[] = [];
  const recordPrefetches: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await context.route('**/*', (route) => {
    const url = new URL(route.request().url());
    if (
      route.request().headers()['next-router-prefetch'] === '1' &&
      /^\/(offerings|projects|submissions|reviews)\/[^/]+$/.test(url.pathname)
    )
      recordPrefetches.push(url.pathname);
    if (
      ['http:', 'https:'].includes(url.protocol) &&
      !['localhost', '127.0.0.1'].includes(url.hostname)
    ) {
      external.push(url.href);
      return route.abort();
    }
    return route.continue();
  });
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Login', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'New user?', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Sign Up', exact: true })).toHaveCount(0);
  await page.screenshot({ path: 'test-results/login-desktop.png', fullPage: true });
  await login(page, 'student1');
  await expect(
    page
      .getByRole('navigation', { name: 'Main navigation' })
      .getByRole('link', { name: 'Overview', exact: true }),
  ).toHaveAttribute('aria-current', 'page');
  await page.evaluate(() => document.fonts.ready);
  expect(await page.evaluate(() => document.fonts.check('800 25px "ProView Montserrat"'))).toBe(
    true,
  );
  expect(await page.evaluate(() => document.fonts.check('400 14px "ProView Noto Sans"'))).toBe(
    true,
  );
  const searchResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'GET' &&
      response.url().includes('/offerings?') &&
      response.url().includes('search=IT3120E'),
  );
  await page
    .getByRole('search', { name: 'Course search', exact: true })
    .getByRole('searchbox')
    .fill('IT3120E');
  await page
    .getByRole('search', { name: 'Course search', exact: true })
    .getByRole('button', { name: 'Search', exact: true })
    .click();
  const searched = await searchResponse;
  expect(searched.ok()).toBe(true);
  expect((await searched.json()).items.length).toBeGreaterThan(0);
  await expect(page).toHaveURL(/\/courses\?search=IT3120E$/);
  await expect(page.getByLabel('Search courses', { exact: true })).toHaveValue('IT3120E');
  // Repeating the same header query must restore it after the local filter changes.
  await page.getByLabel('Search courses', { exact: true }).fill('no-such-course-proview-search');
  await page
    .getByRole('search', { name: 'Course search', exact: true })
    .getByRole('searchbox')
    .fill('IT3120E');
  await page
    .getByRole('search', { name: 'Course search', exact: true })
    .getByRole('button', { name: 'Search', exact: true })
    .click();
  await expect(page.getByLabel('Search courses', { exact: true })).toHaveValue('IT3120E');

  await page.goto('/dashboard');
  await expect(page.getByRole('heading', { name: 'Overview', exact: true })).toBeVisible();
  const brand = page.locator('.site-header .proview-brand');
  expect(await brand.locator('img').evaluate((img) => (img as HTMLImageElement).naturalWidth)).toBe(
    1254,
  );
  await expect(brand.locator('.proview-wordmark')).toHaveText('ProView');
  await expect(page.locator('.stat-card')).toHaveCount(4);
  await page.screenshot({ path: 'test-results/dashboard-desktop.png', fullPage: true });
  expect(await page.evaluate(() => Object.keys(localStorage))).toEqual([]);
  const cookies = await context.cookies();
  expect(cookies.find((cookie) => cookie.name === 'proview_refresh')?.httpOnly).toBe(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Overview', exact: true })).toBeVisible();
  await page.goto('/admin/users');
  await expect(
    page.getByRole('heading', { name: 'This area requires staff access.' }),
  ).toBeVisible();
  await page.goto('/projects');
  await expect(page.getByRole('heading', { name: 'My projects' })).toBeVisible();
  await page.goto(`/submissions/${demoId('active-group-1-submission-1')}`);
  await expect(page.getByRole('tab', { name: /Document/ })).toBeVisible();
  await expect(page.locator('.pdf-viewer')).toBeVisible();
  await page.screenshot({ path: 'test-results/submission-desktop.png', fullPage: true });
  await page.goto('/profile');
  await expect(
    page.getByRole('heading', { name: 'Your academic history', exact: true }),
  ).toBeVisible();
  // Repeated lifecycle runs can create newer completed projects. Older evidence
  // must remain reachable through the profile's real pagination.
  const historicalProject = page.getByRole('heading', {
    name: 'Campus Resource Booking',
    exact: true,
  });
  await expect(page.locator('.project-card h3').first()).toBeVisible();
  for (let pageNumber = 1; pageNumber < 50 && !(await historicalProject.count()); pageNumber++) {
    const next = page
      .getByRole('navigation', { name: 'Page navigation', exact: true })
      .getByRole('button', { name: 'Next', exact: true });
    if (!(await next.count()) || !(await next.isEnabled())) break;
    const pending = page.waitForResponse(
      (response) =>
        response.url().includes('/archive/own?') && response.request().method() === 'GET',
    );
    const [, response] = await Promise.all([next.click(), pending]);
    expect(response.ok()).toBe(true);
    const data = await response.json();
    await expect(
      page.getByRole('heading', { name: data.items[0].title, exact: true }),
    ).toBeVisible();
  }
  await expect(historicalProject).toBeVisible();
  await expect(
    page
      .locator('.project-card')
      .filter({ has: page.getByRole('heading', { name: 'Campus Resource Booking', exact: true }) })
      .getByText('Published grade:'),
  ).toBeVisible();
  await page.goto('/notifications');
  await expect(page.getByRole('heading', { name: 'Notifications' })).toBeVisible();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto('/projects');
  await expect(page).toHaveURL(/\/login/);
  expect(external).toEqual([]);
  expect(recordPrefetches).toEqual([]);
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
    await page
      .getByRole('navigation', { name: 'Main navigation' })
      .locator(`a[href="${path}"]`)
      .click();
    await expect(page.getByRole('button', { name: 'Sign out', exact: true })).toBeVisible();
    await page.waitForLoadState('networkidle');
    await expect(page.locator('main h1').first()).toBeVisible();
    await expect(page.getByText('Something went wrong', { exact: true })).toHaveCount(0);
  }
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await login(page, 'admin');
  await expect(page.getByRole('heading', { name: 'Administration', exact: true })).toBeVisible();
  for (const href of ['/grading', '/similarity-checks', '/reviews', '/courses']) {
    await expect(page.locator(`main a[href="${href}"]`)).toHaveCount(0);
  }
  await page
    .getByRole('search', { name: 'User account search', exact: true })
    .getByRole('searchbox')
    .fill('administrator');
  await page
    .getByRole('search', { name: 'User account search', exact: true })
    .getByRole('button', { name: 'Search', exact: true })
    .click();
  await expect(page).toHaveURL(/\/admin\/users\?search=administrator$/);
  await expect(page.getByLabel('Search users', { exact: true })).toHaveValue('administrator');
  await expect(page.locator('tbody')).toContainText('Demo Administrator');
  await page.goto('/dashboard');
  await expect(page.getByRole('heading', { name: 'Administration', exact: true })).toBeVisible();
  await page.screenshot({ path: 'test-results/admin-desktop.png', fullPage: true });
  await page
    .getByRole('navigation', { name: 'Main navigation' })
    .locator('a[href="/admin/users"]')
    .click();
  await expect(page.getByRole('heading', { name: 'User accounts' })).toBeVisible();
  await expect(page.locator('tbody')).toContainText('Demo Administrator');
  await page
    .getByRole('navigation', { name: 'Main navigation' })
    .locator('a[href="/admin/audit"]')
    .click();
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
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Login', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: 'test-results/login-mobile.png', fullPage: true });
  await login(page, 'student2');
  await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeHidden();
  await page.getByRole('button', { name: 'Toggle navigation' }).click();
  await page
    .getByRole('navigation', { name: 'Main navigation' })
    .getByRole('link', { name: /My projects/ })
    .click();
  await expect(page.getByRole('heading', { name: 'My projects' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeHidden();
  await expect(page.getByRole('button', { name: 'Toggle navigation' })).toHaveAttribute(
    'aria-expanded',
    'false',
  );
  await page.screenshot({ path: 'test-results/projects-mobile.png', fullPage: true });
  await page.setViewportSize({ width: 320, height: 740 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.getByRole('button', { name: 'Toggle navigation' }).click();
  await expect(
    page
      .getByRole('navigation', { name: 'Main navigation' })
      .getByRole('link', { name: 'My projects', exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: 'test-results/menu-mobile-320.png', fullPage: true });
});
test('instructor saves and publishes a grade for the exact evidence through the UI', async ({
  page,
}) => {
  await login(page, 'instructor');
  await page.goto(`/grading/${demoId('active-group-2-submission-2')}`);
  await expect(page.getByRole('heading', { name: 'Instructor assessment' })).toBeVisible();
  const scores = page.locator('input[name^="score-"]');
  await expect(scores).toHaveCount(4);
  for (const score of await scores.all()) await score.fill('8');
  await page
    .getByLabel('Overall feedback')
    .fill('Browser grading acceptance: exact evidence verified.');
  const correction = page.getByLabel('Reason for correcting the published grade');
  if (await correction.isVisible())
    await correction.fill('Repeatable acceptance correction with audit evidence.');
  const saved = page.waitForResponse(
    (response) => response.url().endsWith('/grade') && response.request().method() === 'PUT',
  );
  await page.getByRole('button', { name: 'Save private draft', exact: true }).click();
  const response = await saved;
  expect(response.status()).toBe(200);
  const grade = await response.json();
  expect(response.request().postDataJSON().submissionVersionId).toBe(
    grade.draft.submissionVersionId,
  );
  expect(response.request().postDataJSON().rubricRevisionId).toBe(grade.draft.rubricRevisionId);
  await expect(page.getByText('Private grade draft saved.', { exact: true })).toBeVisible();
  page.once('dialog', (dialog) => dialog.accept());
  const published = page.waitForResponse(
    (response) => response.url().endsWith('/publish') && response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Publish grade', exact: true }).click();
  const publish = await published;
  expect(publish.status()).toBe(201);
  expect(publish.request().postDataJSON().gradeRevisionId).toBe(grade.draft.id);
  expect((await publish.json()).published.overall).toBe(8);
  await expect(page.getByText('Grade published.', { exact: true })).toBeVisible();
});

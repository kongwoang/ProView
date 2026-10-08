import { test, expect, type Page, type Browser } from '@playwright/test';
import { dateInput } from '../../apps/web/lib/date-time';

test.use({ actionTimeout: 10_000 });

const stamp = () => new Date().toISOString().replace(/[-:.TZ]/g, '');
const offeringZone = 'America/New_York';
const localDate = (days: number, zone = offeringZone) =>
  dateInput(new Date(Date.now() + days * 86_400_000).toISOString(), zone);
async function action(page: Page, suffix: string, method: string, click: () => Promise<unknown>) {
  const pending = page.waitForResponse(
    (response) =>
      (response.url().endsWith(suffix) ||
        (suffix.endsWith('/') && response.url().includes(suffix))) &&
      response.request().method() === method,
    { timeout: 10_000 },
  );
  const [, response] = await Promise.all([click(), pending]);
  expect(response.ok(), `${method} ${suffix}: HTTP ${response.status()}`).toBe(true);
  return response.json();
}
async function actor(browser: Browser, username: string, origin: string) {
  const context = await browser.newContext({ baseURL: origin, timezoneId: 'UTC' });
  const page = await context.newPage();
  page.on('dialog', (dialog) => dialog.accept('Browser lifecycle acceptance: verified conflict.'));
  await page.goto('/login');
  await page.getByLabel('Email or username').fill(username);
  await page.getByLabel('Password', { exact: true }).fill('ProViewDemo!2026');
  const session = await action(page, '/auth/login', 'POST', () =>
    page.getByRole('button', { name: 'Login to ProView', exact: true }).click(),
  );
  await expect(page.getByRole('heading', { name: 'Overview', exact: true })).toBeVisible();
  return { page, context, token: session.accessToken as string };
}
async function nav(page: Page, path: string) {
  await page.bringToFront();
  await page
    .getByRole('navigation', { name: 'Main navigation' })
    .locator(`a[href="${path}"]`)
    .click();
  await expect(page).toHaveURL((url) => url.pathname === path, { timeout: 30_000 });
}
async function offering(page: Page, id: string, semester: string) {
  await nav(page, '/courses');
  await page.getByLabel('Search courses', { exact: true }).fill(semester);
  await page.locator(`a[href="/offerings/${id}"]`).first().click();
}
async function project(page: Page, title: string) {
  await nav(page, '/projects');
  await page.getByRole('link', { name: title, exact: true }).click();
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible({
    timeout: 30_000,
  });
}
async function startSubmission(page: Page, title: string, stage: string) {
  await project(page, title);
  const submission = await action(page, '/submissions', 'POST', () =>
    page
      .locator('.list-row')
      .filter({ has: page.getByRole('heading', { name: stage, exact: true }) })
      .getByRole('button', { name: 'Start submission', exact: true })
      .click(),
  );
  // Creation resolves before invalidation/navigation and the first route chunk load.
  await expect(page).toHaveURL((url) => url.pathname === `/submissions/${submission.id}`, {
    timeout: 30_000,
  });
  await expect(page.getByRole('button', { name: /Upload revision/ })).toBeVisible({
    timeout: 30_000,
  });
  return submission;
}
async function openSubmission(page: Page, title: string, stage: string) {
  await project(page, title);
  await page
    .locator('.list-row')
    .filter({ has: page.getByRole('heading', { name: stage, exact: true }) })
    .getByRole('link', { name: /Open submission/ })
    .click();
  await expect(page).toHaveURL((url) => url.pathname.startsWith('/submissions/'), {
    timeout: 30_000,
  });
  await expect(page.getByRole('tab', { name: 'Document', exact: true })).toBeVisible({
    timeout: 30_000,
  });
}
async function upload(page: Page, id: string, note: string) {
  await page.getByRole('button', { name: /Upload revision/ }).click();
  await page.getByLabel('PDF document').setInputFiles('apps/api/prisma/assets/demo-report.pdf');
  await page.getByLabel('What changed?').fill(note);
  const result = await action(page, `/submissions/${id}/versions`, 'POST', () =>
    page.getByRole('button', { name: 'Upload PDF', exact: true }).click(),
  );
  await expect(page.getByRole('heading', { name: 'Upload a new PDF version' })).toHaveCount(0);
  return result;
}
async function submitReview(page: Page, comment: string) {
  await expect(page.getByRole('heading', { name: 'Your review draft', exact: true })).toBeVisible();
  for (const score of await page.locator('input[name^="score-"]').all()) await score.fill('8');
  for (const feedback of await page.getByLabel('Criterion feedback', { exact: true }).all())
    await feedback.fill('Evidence is clear and the scope is feasible.');
  await page.getByLabel('Overall comments', { exact: true }).fill(comment);
  const recommendation = page.getByLabel('Recommendation', { exact: true });
  if (await recommendation.count()) await recommendation.selectOption({ index: 1 });
  await action(page, '/submit', 'POST', () =>
    page.getByRole('button', { name: 'Submit review', exact: true }).click(),
  );
  await expect(page.getByRole('heading', { name: 'Submitted review', exact: true })).toBeVisible();
}
async function grade(page: Page, offeringId: string, title: string, stage: string, publish = true) {
  await nav(page, '/grading');
  await page.getByLabel('Select grading course').selectOption(offeringId);
  await page
    .locator('.project-card')
    .filter({ has: page.getByRole('link', { name: title, exact: true }) })
    .filter({ hasText: stage })
    .getByRole('link', { name: /Review & grade/ })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Instructor assessment', exact: true }),
  ).toBeVisible();
  await expect(page.locator('input[name^="score-"]')).toHaveCount(3);
  for (const score of await page.locator('input[name^="score-"]').all()) await score.fill('8');
  await page
    .getByLabel('Overall feedback', { exact: true })
    .fill(`Verified ${stage} lifecycle assessment.`);
  await action(page, '/grade', 'PUT', () =>
    page.getByRole('button', { name: 'Save private draft', exact: true }).click(),
  );
  if (publish)
    await action(page, '/publish', 'POST', () =>
      page.getByRole('button', { name: 'Publish grade', exact: true }).click(),
    );
}

test('@lifecycle instructor setup → proposal versions → assignment/COI → anonymous reviews → rebuttal → COOPY → grade → later-cohort archive', async ({
  browser,
  baseURL,
}) => {
  test.setTimeout(300_000);
  const actors = [];
  try {
    const teacher = await actor(browser, 'instructor', baseURL!);
    actors.push(teacher);
    const p = teacher.page;
    const semester = `Lifecycle-${stamp()}`;
    await nav(p, '/courses');
    await p.getByRole('button', { name: '+ New offering', exact: true }).click();
    await p.getByLabel('Course', { exact: true }).selectOption({ index: 1 });
    await p.getByLabel('Semester', { exact: true }).fill(semester);
    await p.getByLabel('Academic year').fill('2026–2027');
    await p.getByLabel('Timezone', { exact: true }).fill(offeringZone);
    const termStart = new Date(Date.now() - 7 * 86_400_000);
    termStart.setUTCSeconds(0, 0);
    await p.getByLabel('Term starts').fill(dateInput(termStart.toISOString(), offeringZone));
    await p.getByLabel('Term ends').fill(localDate(30));
    const expectedTermStart = termStart.toISOString();
    const created = await action(p, '/offerings', 'POST', () =>
      p.getByRole('button', { name: 'Create offering', exact: true }).click(),
    );
    expect(created.timezone).toBe(offeringZone);
    expect(created.termStartAt).toBe(expectedTermStart);
    await p.getByLabel('Search courses', { exact: true }).fill(semester);
    await p.locator(`a[href="/offerings/${created.id}"]`).first().click();
    await p.getByRole('tab', { name: 'Stages & rubrics', exact: true }).click();
    for (const stage of ['Proposal', 'Final Report']) {
      await p
        .locator('.list-row')
        .filter({ has: p.getByRole('heading', { name: new RegExp(`^\\d+\\. ${stage}$`) }) })
        .getByRole('button', { name: 'Edit stage', exact: true })
        .click();
      await p.getByLabel('Opens at', { exact: true }).fill(localDate(-1));
      await p.getByLabel('Submission deadline', { exact: true }).fill(localDate(2));
      await p.getByLabel('Review deadline', { exact: true }).fill(localDate(3));
      await p.getByLabel('Rebuttal deadline', { exact: true }).fill(localDate(4));
      if (stage === 'Final Report') {
        await p.getByLabel('Enable reviews', { exact: true }).uncheck();
        await p.getByLabel('Enable rebuttal', { exact: true }).uncheck();
        await p.getByLabel('Peer reviews per submission').fill('0');
      }
      await action(p, '/stages/', 'PATCH', () =>
        p.getByRole('button', { name: 'Save stage', exact: true }).click(),
      );
      await expect(p.getByLabel('Stage name', { exact: true })).toHaveCount(0);
    }
    // Publish a fresh rubric before any assignment pins its immutable criteria.
    await p
      .locator('.list-row')
      .filter({ has: p.getByRole('heading', { name: /^1\. Proposal$/ }) })
      .getByRole('button', { name: 'Rubric', exact: true })
      .click();
    await p.getByLabel('Criterion title', { exact: true }).first().fill('Lifecycle clarity');
    await action(p, '/stages/', 'PATCH', () =>
      p.getByRole('button', { name: 'Save new rubric', exact: true }).click(),
    );
    await expect(p.getByRole('heading', { name: 'Proposal · rubric', exact: true })).toHaveCount(0);
    await p.getByRole('tab', { name: 'Settings', exact: true }).click();
    await p.getByLabel('Status', { exact: true }).selectOption('ACTIVE');
    await action(p, `/offerings/${created.id}`, 'PATCH', () =>
      p.getByRole('button', { name: 'Save settings', exact: true }).click(),
    );
    await p.getByRole('tab', { name: 'Roster', exact: true }).click();
    await p
      .getByLabel('CSV content')
      .fill(
        'email,role\nstudent1@proview.local,STUDENT\nstudent2@proview.local,STUDENT\nstudent3@proview.local,STUDENT',
      );
    await action(p, '/roster/preview', 'POST', () =>
      p.getByRole('button', { name: 'Validate CSV', exact: true }).click(),
    );
    await action(p, '/roster/import', 'POST', () =>
      p.getByRole('button', { name: 'Commit import', exact: true }).click(),
    );
    await expect(
      p.getByRole('table').getByText('student3@proview.local', { exact: true }),
    ).toBeVisible();
    await p.getByRole('tab', { name: 'Groups', exact: true }).click();
    const groups = [];
    const titles = [1, 2, 3].map((n) => `${semester} project ${n}`);
    for (let n = 1; n <= 3; n++) {
      await p.getByRole('button', { name: '+ Create group', exact: true }).click();
      await p.getByLabel('Group name', { exact: true }).fill(`${semester} team ${n}`);
      await p.getByLabel('Project title', { exact: true }).fill(titles[n - 1]);
      await p.getByRole('checkbox', { name: new RegExp(`student${n}@proview\.local`) }).check();
      groups.push(
        await action(p, '/groups', 'POST', () =>
          p.getByRole('button', { name: 'Save group', exact: true }).click(),
        ),
      );
      await expect(p.getByLabel('Group name', { exact: true })).toHaveCount(0);
    }
    const students = [];
    const proposals = [];
    for (let n = 1; n <= 3; n++) {
      const current = await actor(browser, `student${n}`, baseURL!);
      actors.push(current);
      students.push(current);
      const submission = await startSubmission(current.page, titles[n - 1], 'Proposal');
      proposals.push(submission);
      submission.versionId = (await upload(current.page, submission.id, 'First proposal draft')).id;
      if (n === 1)
        submission.versionId = (
          await upload(current.page, submission.id, 'Improved proposal v2')
        ).id;
      await action(current.page, `/submissions/${submission.id}/submit`, 'POST', () =>
        current.page
          .getByRole('button', { name: `Submit version ${n === 1 ? 2 : 1}`, exact: true })
          .click(),
      );
      if (n === 1) {
        await current.page.getByRole('tab', { name: 'Version history', exact: true }).click();
        await expect(current.page.getByText('First proposal draft', { exact: true })).toBeVisible();
        await expect(current.page.getByText('Improved proposal v2', { exact: true })).toBeVisible();
      }
    }
    await nav(p, '/review-management');
    await p.getByLabel('Review management course').selectOption(created.id);
    await p.getByLabel('Submission stage', { exact: true }).selectOption({ label: 'Proposal' });
    const plan = await action(p, '/assignment-plans', 'POST', () =>
      p.getByRole('button', { name: 'Generate preview', exact: true }).click(),
    );
    expect(plan.status).toBe('READY');
    expect(plan.pairs).toHaveLength(6);
    for (const pair of plan.pairs) {
      const authorIndex = proposals.findIndex((s) => s.id === pair.submissionId);
      expect(pair.reviewerGroupId).not.toBe(groups[authorIndex].id);
    }
    expect(Object.values(plan.workloadAfter)).toEqual([2, 2, 2]);
    await action(p, `/assignment-plans/${plan.id}/apply`, 'POST', () =>
      p.getByRole('button', { name: 'Apply assignment plan', exact: true }).click(),
    );
    // Two peers review project 1. One declares a conflict and is explicitly replaced by the instructor.
    const conflicted = students[1].page;
    await nav(conflicted, '/reviews');
    await conflicted
      .getByRole('row')
      .filter({ hasText: titles[0] })
      .getByRole('link', { name: /Open review/ })
      .click();
    await conflicted
      .getByRole('button', { name: 'Declare conflict of interest', exact: true })
      .click();
    await conflicted
      .getByLabel('Explain the conflict')
      .fill('Prior collaboration requires reassignment.');
    await action(conflicted, '/conflicts', 'POST', () =>
      conflicted.getByRole('button', { name: 'Submit declaration', exact: true }).click(),
    );
    // Re-enter via the navigation so the other actor sees the latest server state.
    await nav(p, '/courses');
    await nav(p, '/review-management');
    await p.reload();
    await p.getByLabel('Review management course').selectOption(created.id);
    const conflictCard = p
      .locator('.review-card')
      .filter({ hasText: 'Prior collaboration requires reassignment.' });
    await action(p, '/decision', 'POST', () =>
      conflictCard.getByRole('button', { name: 'Approve reassignment', exact: true }).click(),
    );
    await conflictCard.getByRole('button', { name: 'Select replacement', exact: true }).click();
    await p
      .getByLabel('Reviewer', { exact: true })
      .selectOption({ label: 'Dr. Minh Nguyen · Instructor' });
    await action(p, '/replacement', 'POST', () =>
      p.getByRole('button', { name: 'Assign reviewer', exact: true }).click(),
    );
    const instructorCard = p
      .locator('.review-card')
      .filter({ has: p.getByRole('link', { name: titles[0], exact: true }) })
      .filter({ hasText: 'Proposal · Instructor' });
    await instructorCard.getByRole('link', { name: 'Review details', exact: true }).click();
    await submitReview(p, 'Instructor replacement feedback for the proposal.');
    const peer = students[2].page;
    await nav(peer, '/reviews');
    await peer
      .getByRole('row')
      .filter({ hasText: titles[0] })
      .getByRole('link', { name: /Open review/ })
      .click();
    await submitReview(peer, 'Peer feedback from an anonymous reviewer.');
    await nav(p, '/review-management');
    await p.reload();
    await p.getByLabel('Review management course').selectOption(created.id);
    await p.getByRole('link', { name: titles[0], exact: true }).first().click();
    await expect(p).toHaveURL((url) => url.pathname === `/submissions/${proposals[0].id}`, {
      timeout: 30_000,
    });
    await p.getByRole('tab', { name: 'Reviews', exact: true }).click();
    await expect(p.getByText(`${semester} team 3`, { exact: true })).toBeVisible();
    await p.getByRole('button', { name: 'Release reviews', exact: true }).click();
    await p
      .getByLabel('Reason for incomplete reviews or waived rebuttal (if needed)')
      .fill(
        'Approved COI removed one peer; instructor replacement review is complete and remaining peer quota is explicitly waived.',
      );
    await action(p, `/submissions/${proposals[0].id}/reviews/release`, 'POST', () =>
      p.getByRole('button', { name: 'Confirm release', exact: true }).click(),
    );
    const author = students[0].page;
    await openSubmission(author, titles[0], 'Proposal');
    await author.reload();
    await author.getByRole('tab', { name: 'Reviews', exact: true }).click();
    await expect(
      author.getByText('Peer feedback from an anonymous reviewer.', { exact: true }),
    ).toBeVisible();
    await expect(author.getByText(`${semester} team 3`, { exact: true })).toHaveCount(0);
    await expect(author.getByText('Dr. Minh Nguyen', { exact: true })).toHaveCount(0);
    await author.getByRole('tab', { name: 'Rebuttal', exact: true }).click();
    await author
      .getByLabel('General response', { exact: true })
      .fill('We have clarified the methods and updated the project scope.');
    await action(author, '/finalize', 'POST', () =>
      author.getByRole('button', { name: 'Finalize rebuttal', exact: true }).click(),
    );
    await expect(author.getByLabel('General response', { exact: true })).toBeDisabled();
    await grade(p, created.id, titles[0], 'Proposal', false);
    await expect(
      p.getByText('We have clarified the methods and updated the project scope.', { exact: true }),
    ).toBeVisible();
    await openSubmission(author, titles[0], 'Proposal');
    await author.reload();
    await author.getByRole('tab', { name: 'Grade', exact: true }).click();
    await expect(
      author.getByRole('heading', { name: 'Your grade has not been published', exact: true }),
    ).toBeVisible();
    await action(p, '/publish', 'POST', () =>
      p.getByRole('button', { name: 'Publish grade', exact: true }).click(),
    );
    await openSubmission(author, titles[0], 'Proposal');
    await author.reload();
    await author.getByRole('tab', { name: 'Grade', exact: true }).click();
    await expect(
      author.getByText('Verified Proposal lifecycle assessment.', { exact: true }),
    ).toBeVisible();
    const final = await startSubmission(author, titles[0], 'Final Report');
    const finalVersion = await upload(author, final.id, 'Final report after rebuttal');
    await action(author, `/submissions/${final.id}/submit`, 'POST', () =>
      author.getByRole('button', { name: 'Submit version 1', exact: true }).click(),
    );
    await nav(p, '/similarity-checks');
    await p.getByLabel('Search similarity checks').fill(titles[0]);
    const queueRow = p.getByRole('row').filter({ hasText: titles[0] });
    await expect(queueRow.getByText('PENDING', { exact: true })).toBeVisible();
    await queueRow.getByRole('button', { name: 'Manage check', exact: true }).click();
    await action(p, '/mark-external', 'POST', () =>
      p.getByRole('button', { name: 'Mark submitted to COOPY', exact: true }).click(),
    );
    await expect(
      p.getByRole('button', { name: 'Mark submitted to COOPY', exact: true }),
    ).toHaveCount(0);
    await expect(queueRow.getByText('SUBMITTED EXTERNALLY', { exact: true })).toBeVisible();
    await p.getByLabel('Similarity percentage', { exact: true }).fill('12.5');
    await p.getByLabel('Result date', { exact: true }).fill(localDate(0, 'UTC'));
    await p
      .getByLabel('Notes', { exact: true })
      .fill('Manual COOPY evidence recorded by the instructor.');
    await action(p, '/complete', 'POST', () =>
      p.getByRole('button', { name: 'Record action', exact: true }).click(),
    );
    await expect(queueRow.getByText('COMPLETED', { exact: true })).toBeVisible();
    await queueRow.getByRole('link', { name: titles[0], exact: true }).click();
    await action(p, `/submissions/${final.id}/finalize-input`, 'POST', () =>
      p.getByRole('button', { name: 'Finalize input for grading', exact: true }).click(),
    );
    await grade(p, created.id, titles[0], 'Final Report');
    await expect(p.getByText('12.5%', { exact: false })).toBeVisible();
    await offering(p, created.id, semester);
    await p.getByRole('tab', { name: 'Settings', exact: true }).click();
    await p.getByLabel('Status', { exact: true }).selectOption('CLOSED');
    await action(p, `/offerings/${created.id}`, 'PATCH', () =>
      p.getByRole('button', { name: 'Save settings', exact: true }).click(),
    );
    await nav(p, '/archive');
    await p.getByLabel('Search archive').fill(titles[0]);
    await p
      .locator('.list-row')
      .filter({ has: p.getByRole('link', { name: 'Final Report', exact: true }) })
      .getByRole('button', { name: 'Approve reference', exact: true })
      .click();
    await expect(p.getByText('Reference report published.', { exact: true })).toBeVisible();
    // Copy only configuration to a later cohort, then enroll a different student.
    await nav(p, '/courses');
    await p.getByRole('button', { name: '+ New offering', exact: true }).click();
    await p.getByLabel('Course', { exact: true }).selectOption(created.courseId);
    await p.getByLabel('Semester', { exact: true }).fill(`${semester}-later`);
    await p.getByLabel('Academic year').fill('2027–2028');
    await p.getByLabel('Timezone', { exact: true }).fill(offeringZone);
    await p.getByLabel('Term starts').fill(localDate(90));
    await p.getByLabel('Term ends').fill(localDate(120));
    await p.getByLabel('Find source offering', { exact: true }).fill(semester);
    await p.getByLabel('Copy configuration from').selectOption(created.id);
    const later = await action(p, '/offerings', 'POST', () =>
      p.getByRole('button', { name: 'Create offering', exact: true }).click(),
    );
    await p.getByLabel('Search courses', { exact: true }).fill(`${semester}-later`);
    await p.locator(`a[href="/offerings/${later.id}"]`).first().click();
    await p.getByRole('tab', { name: 'Groups', exact: true }).click();
    await expect(p.getByRole('heading', { name: 'No groups yet', exact: true })).toBeVisible();
    await p.getByRole('tab', { name: 'Roster', exact: true }).click();
    await expect(
      p.getByRole('table').getByText('student1@proview.local', { exact: true }),
    ).toHaveCount(0);
    await p.getByLabel('Account email', { exact: true }).fill('student5@proview.local');
    await action(p, '/roster', 'POST', () =>
      p.getByRole('button', { name: 'Add member', exact: true }).click(),
    );
    await p.getByRole('tab', { name: 'Settings', exact: true }).click();
    await p.getByLabel('Status', { exact: true }).selectOption('ACTIVE');
    await action(p, `/offerings/${later.id}`, 'PATCH', () =>
      p.getByRole('button', { name: 'Save settings', exact: true }).click(),
    );
    const reader = await actor(browser, 'student5', baseURL!);
    actors.push(reader);
    await nav(reader.page, '/archive');
    await reader.page.getByRole('button', { name: 'Reference library', exact: true }).click();
    await reader.page.getByLabel('Search archive').fill(titles[0]);
    await expect(reader.page.getByRole('heading', { name: titles[0], exact: true })).toBeVisible();
    const referencePdf = reader.page.waitForResponse(
      (response) =>
        response.url().includes('/archive/publications/') && response.url().endsWith('/file'),
    );
    await reader.page.getByRole('button', { name: 'Read report →', exact: true }).click();
    const pdfResponse = await referencePdf;
    expect(pdfResponse.status()).toBe(200);
    expect(pdfResponse.headers()['content-type']).toContain('application/pdf');
    await expect(reader.page.locator('.pdf-viewer')).toBeVisible();
    const prefix = await reader.page.locator('.pdf-viewer').evaluate(async (frame) => {
      const pdf = await fetch((frame as HTMLIFrameElement).src);
      return (await pdf.text()).slice(0, 5);
    });
    expect(prefix).toBe('%PDF-');
    // Direct HTTP proves neither a non-approved proposal nor an unrelated student can bypass the UI.
    const proposalFile = await reader.context.request.get(
      `/api/v1/versions/${proposals[0].versionId}/file`,
      {
        headers: { Authorization: `Bearer ${reader.token}` },
      },
    );
    expect([403, 404]).toContain(proposalFile.status());
    const unauthorized = await students[1].context.request.get(
      `/api/v1/versions/${finalVersion.id}/file`,
      {
        headers: { Authorization: `Bearer ${students[1].token}` },
      },
    );
    expect([403, 404]).toContain(unauthorized.status());
    await reader.page.screenshot({
      path: 'test-results/full-lifecycle-archive.png',
      fullPage: true,
    });
  } finally {
    await Promise.allSettled(actors.map((current) => current.context.close()));
  }
});

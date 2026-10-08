import test from 'node:test';
import assert from 'node:assert/strict';
import { inputWindow } from '../src/modules/submissions/submissions.service';
const openAt = new Date('2026-10-08T00:00:00.000Z');
const deadline = new Date('2026-10-09T00:00:00.000Z');
type Window = Parameters<typeof inputWindow>[0];
const submission = {
  inputLockedAt: null,
  status: 'DRAFT',
  reopenUntil: null,
  offering: { status: 'ACTIVE' },
  stage: { openAt, submissionDeadline: deadline },
} as Window;
test('opening is inclusive and the exact submission deadline is closed', () => {
  assert.equal(inputWindow(submission, new Date(openAt.getTime() - 1)), false);
  assert.equal(inputWindow(submission, openAt), true);
  assert.equal(inputWindow(submission, new Date(deadline.getTime() - 1)), true);
  assert.equal(inputWindow(submission, deadline), false);
});
test('a reasoned reopen window can extend input but never override evidence locks', () => {
  const reopened = { ...submission, reopenUntil: new Date(deadline.getTime() + 3600_000) };
  assert.equal(inputWindow(reopened, deadline), true);
  assert.equal(inputWindow(reopened, reopened.reopenUntil), false);
  assert.equal(inputWindow({ ...reopened, inputLockedAt: openAt }, deadline), false);
  assert.equal(inputWindow({ ...reopened, status: 'UNDER_REVIEW' }, deadline), false);
});
test('an inactive offering closes input even inside a valid reopen window', () => {
  assert.equal(
    inputWindow(
      {
        ...submission,
        offering: { ...submission.offering, status: 'CLOSED' },
        reopenUntil: new Date(deadline.getTime() + 3600_000),
      },
      openAt,
    ),
    false,
  );
});

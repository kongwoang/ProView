import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

const base = process.env.SMOKE_API_URL || 'http://127.0.0.1:3001';
const origin = process.env.FRONTEND_URL || 'http://localhost:3000';
const password = process.env.DEMO_PASSWORD || 'ProViewDemo!2026';
let assertions = 0;
async function api(path, actor, method = 'GET', body, expected = 200) {
  const response = await fetch(`${base}/api/v1${path}`, {
    method,
    headers: {
      Origin: origin,
      ...(actor ? { Authorization: `Bearer ${actor.accessToken}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json();
  assert.equal(response.status, expected, `${method} ${path}: ${JSON.stringify(data)}`);
  assertions++;
  return data;
}
async function upload(id, actor, content, name = 'report.pdf', expected = 201) {
  const form = new FormData();
  form.append('file', new Blob([content], { type: 'application/pdf' }), name);
  form.append('changeNote', 'Acceptance version');
  const response = await fetch(`${base}/api/v1/submissions/${id}/versions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${actor.accessToken}` },
    body: form,
  });
  const data = await response.json();
  assert.equal(response.status, expected, JSON.stringify(data));
  assertions++;
  return data;
}
const admin = await api('/auth/login', null, 'POST', { identifier: 'admin', password });
const instructor = await api('/auth/login', null, 'POST', { identifier: 'instructor', password });
const student = await api('/auth/login', null, 'POST', { identifier: 'student1', password });
const outsider = await api('/auth/login', null, 'POST', { identifier: 'student3', password });
const suffix = Date.now().toString(36);
const course = await api(
  '/courses',
  admin,
  'POST',
  { code: `QA-${suffix}`, title: 'Acceptance Course', description: 'Isolated integration fixture' },
  201,
);
await api('/courses', student, 'POST', { code: `BAD-${suffix}`, title: 'Unauthorized' }, 403);
await api(`/courses/${course.id}`, admin, 'PATCH', {
  code: course.code,
  title: 'Acceptance Course revised',
  description: '',
});
const offering = await api(
  '/offerings',
  instructor,
  'POST',
  {
    courseId: course.id,
    semester: suffix,
    academicYear: '2026-2027',
    termStartAt: new Date(Date.now() - 86400_000).toISOString(),
    termEndAt: new Date(Date.now() + 90 * 86400_000).toISOString(),
  },
  201,
);
const original = await api(`/offerings/${offering.id}`, instructor);
assert.equal(original.stages.length, 2);
assertions++;
await api(`/offerings/${offering.id}`, student, 'GET', undefined, 404);
const previewBad = await api(
  `/offerings/${offering.id}/roster/preview`,
  instructor,
  'POST',
  { csv: 'email\nstudent1@proview.local\nunknown@proview.local\nstudent1@proview.local' },
  201,
);
assert.equal(previewBad.summary.errors, 2);
assertions++;
await api(
  `/offerings/${offering.id}/roster/import`,
  instructor,
  'POST',
  { previewId: previewBad.previewId },
  400,
);
const preview = await api(
  `/offerings/${offering.id}/roster/preview`,
  instructor,
  'POST',
  { csv: 'email\nstudent1@proview.local\nstudent2@proview.local' },
  201,
);
await api(
  `/offerings/${offering.id}/roster/import`,
  instructor,
  'POST',
  { previewId: preview.previewId },
  201,
);
await api(
  `/offerings/${offering.id}/roster/import`,
  instructor,
  'POST',
  { previewId: preview.previewId },
  201,
);
const roster = await api(`/offerings/${offering.id}/roster`, instructor);
const students = roster.filter((row) => row.role === 'STUDENT');
assert.equal(students.length, 2);
assertions++;
const group = await api(
  `/offerings/${offering.id}/groups`,
  instructor,
  'POST',
  {
    name: 'Acceptance Group',
    title: 'A real PDF workflow',
    memberIds: students.map((row) => row.userId),
  },
  201,
);
await api(
  `/offerings/${offering.id}/groups`,
  instructor,
  'POST',
  { name: 'Invalid duplicate group', title: 'Invalid membership', memberIds: [student.user.id] },
  409,
);
await api(`/offerings/${offering.id}`, instructor, 'PATCH', {
  revision: original.revision,
  status: 'ACTIVE',
});
const stage = original.stages[0];
const submission = await api(
  `/projects/${group.project.id}/submissions`,
  student,
  'POST',
  { stageId: stage.id },
  201,
);
const pdf1 = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n');
const pdf2 = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Version /1.4 >>\nendobj\n%%EOF\n');
await upload(submission.id, student, Buffer.from('not a PDF'), 'fake.pdf', 400);
await upload(submission.id, student, pdf1, 'bad.txt', 400);
const uploads = await Promise.all([
  upload(submission.id, student, pdf1),
  upload(submission.id, student, pdf2),
]);
assert.deepEqual(uploads.map((version) => version.versionNumber).sort(), [1, 2]);
assertions++;
const detail = await api(`/submissions/${submission.id}`, student);
assert.equal(detail.versions.length, 2);
assert.equal(detail.status, 'DRAFT');
assert.equal(JSON.stringify(detail).includes('storageKey'), false);
assertions += 3;
const selected = uploads[0];
const submitted = await api(
  `/submissions/${submission.id}/submit`,
  student,
  'POST',
  { versionId: selected.id, revision: detail.revision },
  201,
);
await api(
  `/submissions/${submission.id}/submit`,
  student,
  'POST',
  { versionId: selected.id, revision: detail.revision },
  201,
);
await api(
  `/submissions/${submission.id}/submit`,
  student,
  'POST',
  { versionId: uploads[1].id, revision: detail.revision },
  409,
);
await api(`/submissions/${submission.id}`, outsider, 'GET', undefined, 404);
await api(
  `/groups/${group.id}`,
  instructor,
  'PATCH',
  { revision: group.revision, memberIds: [student.user.id] },
  409,
);
const file = await fetch(`${base}/api/v1/versions/${selected.id}/file`, {
  headers: { Authorization: `Bearer ${student.accessToken}` },
});
assert.equal(file.status, 200);
assert.equal(
  createHash('sha256')
    .update(Buffer.from(await file.arrayBuffer()))
    .digest('hex'),
  selected.sha256,
);
assertions += 2;
const partial = await fetch(`${base}/api/v1/versions/${selected.id}/file`, {
  headers: { Authorization: `Bearer ${student.accessToken}`, Range: 'bytes=0-4' },
});
assert.equal(partial.status, 206);
assert.equal(await partial.text(), '%PDF-');
assertions += 2;
await api(`/versions/${selected.id}/file`, outsider, 'GET', undefined, 404);
await api(`/versions/${selected.id}/file`, null, 'GET', undefined, 401);
await api(
  `/submissions/${submission.id}/reopen`,
  instructor,
  'POST',
  {
    revision: submitted.revision,
    reason: 'Acceptance test revision',
    until: new Date(Date.now() + 86400_000).toISOString(),
  },
  201,
);
const reopened = await api(`/submissions/${submission.id}`, student);
assert.equal(reopened.reviewCycle, 2);
assert.equal(reopened.versions.length, 2);
assert.equal(reopened.submittedVersionId, null);
assertions += 3;
const copy = await api(
  '/offerings',
  instructor,
  'POST',
  {
    courseId: course.id,
    semester: `${suffix}-copy`,
    academicYear: '2026-2027',
    termStartAt: new Date(Date.now() + 100 * 86400_000).toISOString(),
    termEndAt: new Date(Date.now() + 200 * 86400_000).toISOString(),
    copyFromOfferingId: offering.id,
  },
  201,
);
const copied = await api(`/offerings/${copy.id}`, instructor);
assert.equal(copied.groups.length, 0);
assert.equal(copied.stages.length, 2);
assert.notEqual(copied.stages[0].rubricRevisionId, stage.rubricRevisionId);
assertions += 3;
console.log(`PASS ${assertions} course/submission API assertions; fixture course ${course.code}`);

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const base = process.env.SMOKE_API_URL || 'http://127.0.0.1:3001';
const origin = process.env.FRONTEND_URL || 'http://localhost:3000';
const demoPassword = process.env.DEMO_PASSWORD || 'ProViewDemo!2026';
let assertions = 0;
let gradeEvidence;
let gradeDraftId;
async function request(path, actor, method = 'GET', body, expected = 200, extraHeaders = {}) {
  if (body && method === 'PUT' && /^\/submissions\/[^/]+\/grade$/.test(path))
    body = { ...gradeEvidence, ...body };
  if (body && /^\/grades\/[^/]+\/publish$/.test(path))
    body = { gradeRevisionId: gradeDraftId, ...body };
  const response = await fetch(`${base}/api/v1${path}`, {
    method,
    headers: {
      Origin: origin,
      ...(actor ? { Authorization: `Bearer ${actor.accessToken}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...extraHeaders,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json();
  assert.equal(response.status, expected, `${method} ${path}: ${JSON.stringify(data)}`);
  assertions++;
  if (data.draft?.id) gradeDraftId = data.draft.id;
  return { data, cookie: response.headers.get('set-cookie')?.split(';')[0] };
}
const api = async (...args) => (await request(...args)).data;
const login = async (identifier, password = demoPassword) =>
  request('/auth/login', null, 'POST', { identifier, password });
await api('/me', null, 'GET', undefined, 401);
await api('/auth/login', null, 'POST', { identifier: 'admin', password: demoPassword }, 403, {
  Origin: 'https://unauthorized.invalid',
});
const admin = (await login('admin')).data;
const instructor = (await login('instructor')).data;
const student = (await login('student7')).data;
const laterStudent = (await login('student8')).data;
const outsider = (await login('student9')).data;
for (const session of [admin, instructor, student, laterStudent, outsider]) {
  assert.deepEqual(Object.keys(session).sort(), ['accessToken', 'user']);
  assert.deepEqual(Object.keys(session.user).sort(), [
    'displayName',
    'email',
    'id',
    'role',
    'username',
  ]);
  assert.equal(typeof session.accessToken, 'string');
  const profile = await api('/me', session);
  assert.deepEqual(profile, session.user);
  assertions += 4;
}
const invalidProfile = await api('/me', student, 'PATCH', { role: 'ADMIN' }, 400);
assert.ok(Array.isArray(invalidProfile.fieldErrors));
assert.equal(typeof invalidProfile.requestId, 'string');
assertions += 2;
await api('/users', student, 'GET', undefined, 403);
await api('/audit-logs', instructor, 'GET', undefined, 403);
await api('/archive/manage', student, 'GET', undefined, 403);
await api('/me', student, 'PATCH', { role: 'ADMIN' }, 400);
const suffix = Date.now().toString(36);
const tempPassword = 'AcceptancePassword!2026';
const temp = await api(
  '/users',
  admin,
  'POST',
  {
    email: `auth-${suffix}@example.test`,
    username: `auth-${suffix}`,
    displayName: 'Temporary acceptance user',
    role: 'STUDENT',
    password: tempPassword,
  },
  201,
);
let auth = await login(temp.username, tempPassword);
const firstCookie = auth.cookie;
assert.ok(firstCookie);
assertions++;
auth = await request('/auth/refresh', null, 'POST', undefined, 200, { Cookie: firstCookie });
assert.notEqual(auth.cookie, firstCookie);
assertions++;
await api('/me', auth.data);
await api('/auth/refresh', null, 'POST', undefined, 401, { Cookie: firstCookie });
await api('/me', auth.data, 'GET', undefined, 401);
auth = await login(temp.username, tempPassword);
await api(
  '/me/password',
  auth.data,
  'POST',
  { currentPassword: 'wrong-password', newPassword: 'UpdatedPassword!2026' },
  403,
);
await api('/me/password', auth.data, 'POST', {
  currentPassword: tempPassword,
  newPassword: 'UpdatedPassword!2026',
});
await api('/me', auth.data, 'GET', undefined, 401);
auth = await login(temp.username, 'UpdatedPassword!2026');
await api(`/users/${temp.id}/password-reset`, admin, 'POST', { newPassword: tempPassword }, 201);
await api('/me', auth.data, 'GET', undefined, 401);
auth = await login(temp.username, tempPassword);
await api('/auth/logout', null, 'POST', undefined, 200, { Cookie: auth.cookie });
await api('/me', auth.data, 'GET', undefined, 401);
auth = await login(temp.username, tempPassword);
await api(`/users/${temp.id}`, admin, 'PATCH', { isActive: false });
await api('/me', auth.data, 'GET', undefined, 401);
await api('/auth/login', null, 'POST', { identifier: temp.username, password: tempPassword }, 401);

const course = await api(
  '/courses',
  admin,
  'POST',
  { code: `GRADE-${suffix}`, title: 'Grading and archive acceptance' },
  201,
);
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
let offeringDetail = await api(`/offerings/${offering.id}`, instructor);
const initialStage = offeringDetail.stages[0];
await api(`/stages/${initialStage.id}`, instructor, 'PATCH', {
  revision: initialStage.revision,
  name: 'Final Report',
  sequence: initialStage.sequence,
  rubricRevisionId: initialStage.rubricRevisionId,
  openAt: new Date(Date.now() - 86400_000).toISOString(),
  submissionDeadline: new Date(Date.now() + 7 * 86400_000).toISOString(),
  allowReviews: false,
  allowRebuttal: false,
  requireSimilarityCheck: true,
  peerReviewCount: 0,
});
await api(
  `/offerings/${offering.id}/roster`,
  instructor,
  'POST',
  { email: student.user.email },
  201,
);
const group = await api(
  `/offerings/${offering.id}/groups`,
  instructor,
  'POST',
  {
    name: 'Grading acceptance group',
    title: 'Version-bound evidence',
    memberIds: [student.user.id],
  },
  201,
);
await api(`/offerings/${offering.id}`, instructor, 'PATCH', {
  revision: offeringDetail.revision,
  status: 'ACTIVE',
});
const submission = await api(
  `/projects/${group.project.id}/submissions`,
  student,
  'POST',
  { stageId: initialStage.id },
  201,
);
const pdf = await readFile(new URL('../apps/api/prisma/assets/demo-report.pdf', import.meta.url));
async function upload(path, actor) {
  const form = new FormData();
  form.append('file', new Blob([pdf], { type: 'application/pdf' }), 'acceptance.pdf');
  const response = await fetch(`${base}/api/v1${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${actor.accessToken}` },
    body: form,
  });
  const data = await response.json();
  assert.equal(response.status, 201, JSON.stringify(data));
  assertions++;
  return data;
}
let version = await upload(`/submissions/${submission.id}/versions`, student);
const firstVersionId = version.id;
let detail = await api(`/submissions/${submission.id}`, student);
let submitted = await api(
  `/submissions/${submission.id}/submit`,
  student,
  'POST',
  { versionId: version.id, revision: detail.revision },
  201,
);
let checks = await api(`/similarity-checks?search=Version-bound`, instructor);
let check = checks.items.find((row) => row.version.id === version.id);
assert.ok(check);
assertions++;
check = await api(
  `/similarity-checks/${check.id}/mark-external`,
  instructor,
  'POST',
  { revision: check.revision },
  201,
);
check = await api(
  `/similarity-checks/${check.id}/complete`,
  instructor,
  'POST',
  {
    revision: check.revision,
    percentage: 12.5,
    resultDate: new Date().toISOString(),
    notes: 'Manually recorded external result',
  },
  201,
);
await api(
  `/submissions/${submission.id}/reopen`,
  instructor,
  'POST',
  {
    revision: submitted.revision,
    reason: 'Acceptance requires a newer evidence version',
    until: new Date(Date.now() + 86400_000).toISOString(),
  },
  201,
);
version = await upload(`/submissions/${submission.id}/versions`, student);
detail = await api(`/submissions/${submission.id}`, student);
submitted = await api(
  `/submissions/${submission.id}/submit`,
  student,
  'POST',
  { versionId: version.id, revision: detail.revision },
  201,
);
checks = await api('/similarity-checks?search=Version-bound', instructor);
check = checks.items.find((row) => row.version.id === version.id);
assert.equal(check.status, 'PENDING');
assertions++;
const context = await api(`/submissions/${submission.id}/grading-context`, instructor);
gradeEvidence = {
  reviewCycle: context.submission.reviewCycle,
  submissionVersionId: context.submission.submittedVersionId,
  rubricRevisionId: context.rubric.id,
};
await api(
  `/submissions/${submission.id}/grade`,
  instructor,
  'PUT',
  { revision: 0, submissionVersionId: firstVersionId, criterionScores: [] },
  409,
);
await api(
  `/submissions/${submission.id}/grade`,
  instructor,
  'PUT',
  { revision: 0, reviewCycle: context.submission.reviewCycle - 1, criterionScores: [] },
  409,
);
const scores = context.rubric.criteria.map((criterion) => ({
  criterionId: criterion.id,
  score: 8,
  comment: 'Evidence verified',
}));
await api(`/submissions/${submission.id}/grading-context`, student, 'GET', undefined, 403);
await api(`/submissions/${submission.id}/grade`, outsider, 'GET', undefined, 404);
await api(
  `/submissions/${submission.id}/grade`,
  instructor,
  'PUT',
  { revision: 0, criterionScores: scores, overall: 9 },
  400,
);
let grade = await api(`/submissions/${submission.id}/grade`, instructor, 'PUT', {
  revision: 0,
  criterionScores: [],
  feedback: 'Incomplete grading',
});
assert.equal(grade.draft.overall, null);
assertions++;
await api(
  `/grades/${grade.id}/publish`,
  instructor,
  'POST',
  { revision: grade.draft.revision },
  409,
);
await api(
  `/submissions/${submission.id}/finalize-input`,
  instructor,
  'POST',
  { revision: submitted.revision },
  201,
);
await api(
  `/grades/${grade.id}/publish`,
  instructor,
  'POST',
  { revision: grade.draft.revision },
  400,
);
grade = await api(`/submissions/${submission.id}/grade`, instructor, 'PUT', {
  revision: grade.draft.revision,
  criterionScores: scores,
  feedback: 'Complete evidence',
});
assert.equal(grade.draft.overall, 8);
assertions++;
await api(
  `/grades/${grade.id}/publish`,
  instructor,
  'POST',
  { revision: grade.draft.revision },
  409,
);
const authorGrade = await api(`/submissions/${submission.id}/grade`, student);
assert.equal(authorGrade.grade, null);
assert.equal('draft' in authorGrade, false);
assertions += 2;
await api('/similarity-checks', student, 'GET', undefined, 403);
await api(
  `/similarity-checks/${check.id}/waive`,
  instructor,
  'POST',
  { revision: check.revision },
  400,
);
check = await api(
  `/similarity-checks/${check.id}/fail`,
  instructor,
  'POST',
  { revision: check.revision, reason: 'External service temporarily unavailable' },
  201,
);
check = await api(
  `/similarity-checks/${check.id}/retry`,
  instructor,
  'POST',
  { revision: check.revision, reason: 'Instructor requested a second attempt' },
  201,
);
const resultFile = await upload(`/similarity-checks/${check.id}/result-files`, instructor);
assert.equal('storageKey' in resultFile, false);
assertions++;
await api(
  `/similarity-checks/${check.id}/waive`,
  instructor,
  'POST',
  { revision: check.revision - 1, reason: 'Stale command' },
  409,
);
check = await api(
  `/similarity-checks/${check.id}/waive`,
  instructor,
  'POST',
  { revision: check.revision, reason: 'Instructor approved a documented waiver' },
  201,
);
let published = await api(
  `/grades/${grade.id}/publish`,
  instructor,
  'POST',
  { revision: grade.draft.revision },
  201,
);
const firstGradeRevisionId = published.published.id;
assert.equal(published.published.submissionVersionId, version.id);
assertions++;
await api(
  `/submissions/${submission.id}/grade`,
  instructor,
  'PUT',
  { revision: 0, criterionScores: scores },
  400,
);
grade = await api(`/submissions/${submission.id}/grade`, instructor, 'PUT', {
  revision: 0,
  criterionScores: scores,
  overall: 9,
  overrideReason: 'Additional evidence considered',
  correctionReason: 'Correct a documented grading omission',
  feedback: 'Revised final feedback',
});
await api(
  `/grades/${grade.id}/publish`,
  instructor,
  'POST',
  { revision: grade.draft.revision, gradeRevisionId: firstGradeRevisionId },
  409,
);
published = await api(
  `/grades/${grade.id}/publish`,
  instructor,
  'POST',
  { revision: grade.draft.revision },
  201,
);
assert.equal(published.published.overall, 9);
assert.equal(published.published.calculatedOverall, 8);
assertions += 2;
const finalAuthorGrade = await api(`/submissions/${submission.id}/grade`, student);
assert.equal(finalAuthorGrade.grade.overall, 9);
assert.equal(finalAuthorGrade.grade.status, 'PUBLISHED');
assertions += 2;

const later = await api(
  '/offerings',
  instructor,
  'POST',
  {
    courseId: course.id,
    semester: `${suffix}-later`,
    academicYear: '2027',
    termStartAt: new Date(Date.now() + 100 * 86400_000).toISOString(),
    termEndAt: new Date(Date.now() + 190 * 86400_000).toISOString(),
  },
  201,
);
await api(
  `/offerings/${later.id}/roster`,
  instructor,
  'POST',
  { email: laterStudent.user.email },
  201,
);
offeringDetail = await api(`/offerings/${offering.id}`, instructor);
await api(`/offerings/${offering.id}`, instructor, 'PATCH', {
  revision: offeringDetail.revision,
  status: 'CLOSED',
});
const publication = await api(
  '/archive/publications',
  instructor,
  'POST',
  { submissionVersionId: version.id, allowDownload: false },
  201,
);
const own = await api(`/archive/own?courseId=${course.id}`, student);
assert.equal(own.items[0].submissions[0].grade.overall, 9);
assertions++;
const references = await api(`/archive/references?courseId=${course.id}`, laterStudent);
assert.ok(references.items.some((row) => row.id === publication.id));
assert.equal(JSON.stringify(references).includes('storageKey'), false);
assertions += 2;
await api(
  `/archive/references?student=An&courseId=${course.id}`,
  laterStudent,
  'GET',
  undefined,
  403,
);
const invisible = await api(`/archive/references?courseId=${course.id}`, outsider);
assert.equal(invisible.total, 0);
assertions++;
const file = await fetch(`${base}/api/v1/archive/publications/${publication.id}/file`, {
  headers: { Authorization: `Bearer ${laterStudent.accessToken}` },
});
assert.equal(file.status, 200);
assert.equal(file.headers.get('cache-control'), 'private, no-store');
assert.equal((await file.arrayBuffer()).byteLength, pdf.byteLength);
assertions += 3;
await api(`/archive/publications/${publication.id}/download`, laterStudent, 'GET', undefined, 403);
await api(`/archive/publications/${publication.id}/file`, outsider, 'GET', undefined, 404);
await api(
  `/archive/publications/${publication.id}/revoke`,
  instructor,
  'POST',
  { reason: 'Acceptance revocation' },
  201,
);
await api(`/archive/publications/${publication.id}/file`, laterStudent, 'GET', undefined, 404);
await new Promise((resolve) => setTimeout(resolve, 2000));
const notifications = await api('/notifications', student);
assert.ok(notifications.items.some((row) => row.type === 'GRADE_PUBLISHED'));
assertions++;
const audit = await api('/audit-logs?action=GRADE_PUBLISHED', admin);
assert.ok(audit.items.some((row) => row.entityId === grade.id));
assertions++;
console.log(
  `PASS ${assertions} auth/grading/similarity/archive HTTP assertions; fixture course ${course.code}`,
);

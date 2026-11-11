import assert from 'node:assert/strict';

const origin = process.env.ATLAS_BASE_URL || 'http://127.0.0.1:4173';
const passwords = {
  'student.1': process.env.ATLAS_STUDENT_1_PASSWORD,
  'student.2': process.env.ATLAS_STUDENT_2_PASSWORD,
  teacher: process.env.ATLAS_TEACHER_PASSWORD,
  admin: process.env.ATLAS_ADMIN_PASSWORD,
};
for (const [login, password] of Object.entries(passwords)) {
  assert.ok(password, `Missing test password for ${login}`);
}

async function call(path, { method = 'GET', body, cookie, requestOrigin } = {}) {
  const response = await fetch(origin + path, {
    method,
    headers: {
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      ...(cookie ? { cookie } : {}),
      ...(requestOrigin ? { origin: requestOrigin } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: response.status, data, cookie: response.headers.get('set-cookie')?.split(';')[0] };
}

async function login(login) {
  const result = await call('/api/login', { method: 'POST', body: { login, password: passwords[login] }, requestOrigin: origin });
  assert.equal(result.status, 200, `${login}: ${JSON.stringify(result.data)}`);
  assert.ok(result.cookie, `${login}: session cookie missing`);
  return result;
}

const anonymous = await call('/api/me');
assert.equal(anonymous.status, 401, 'Anonymous profile must be denied');
const badPassword = await call('/api/login', { method: 'POST', body: { login: 'student.1', password: 'wrong' }, requestOrigin: origin });
assert.equal(badPassword.status, 401, 'Wrong password must be denied');

const s1 = await login('student.1');
const s2 = await login('student.2');
const teacher = await login('teacher');
const admin = await login('admin');
const p1 = await call('/api/me', { cookie: s1.cookie });
const p2 = await call('/api/me', { cookie: s2.cookie });
assert.equal(p1.status, 200);
assert.equal(p2.status, 200);
assert.notEqual(p1.data.user.id, p2.data.user.id, 'Students must be different users');
assert.notEqual(p1.data.user.groupId, p2.data.user.groupId, 'Students must have different demo groups');

for (const session of [s1, s2]) {
  for (const endpoint of ['/api/dashboard', '/api/schedule', '/api/grades', '/api/requests', '/api/news']) {
    const result = await call(endpoint, { cookie: session.cookie });
    assert.equal(result.status, 200, `${endpoint}: ${JSON.stringify(result.data)}`);
  }
}

const grades1 = await call('/api/grades', { cookie: s1.cookie });
const grades2 = await call('/api/grades', { cookie: s2.cookie });
assert.notDeepEqual(grades1.data, grades2.data, 'Student grade data must differ');

const requests1 = await call('/api/requests?userId=' + encodeURIComponent(p2.data.user.id), { cookie: s1.cookie });
assert.equal(requests1.status, 200);
assert.ok((requests1.data.requests || []).every((request) => !request.userId || request.userId === p1.data.user.id), 'Query substitution exposed another student request');

const studentNews = await call('/api/news', { method: 'POST', body: { title: 'Forbidden', body: 'Forbidden', scope: 'all' }, cookie: s1.cookie, requestOrigin: origin });
assert.equal(studentNews.status, 403, 'Student may not publish news');

const foreignOrigin = await call('/api/requests', { method: 'POST', body: { type: 'Справка об обучении', comment: 'CSRF test' }, cookie: s1.cookie, requestOrigin: 'https://foreign.example' });
assert.equal(foreignOrigin.status, 403, 'Foreign Origin write must be denied');

const marker = 'Проверка сохранения ' + Date.now();
const created = await call('/api/requests', { method: 'POST', body: { type: 'Справка об обучении', comment: marker }, cookie: s1.cookie, requestOrigin: origin });
assert.ok([200, 201].includes(created.status), `Create request: ${JSON.stringify(created.data)}`);
const after = await call('/api/requests', { cookie: s1.cookie });
assert.ok((after.data.requests || []).some((request) => request.comment === marker), 'Created request did not persist');
const otherAfter = await call('/api/requests', { cookie: s2.cookie });
assert.ok(!(otherAfter.data.requests || []).some((request) => request.comment === marker), 'Created request leaked to another student');

const staff = await call('/api/staff', { cookie: teacher.cookie });
assert.equal(staff.status, 200, 'Teacher staff view missing');
const adminStaff = await call('/api/staff', { cookie: admin.cookie });
assert.equal(adminStaff.status, 200, 'Admin staff view missing');
console.log('PASS: login, two isolated students, dashboard, persistent request, role and CSRF checks');

// Integration journeys for a disposable/local demo database.
// Requests, news, messages and folders remain as clearly marked QA records;
// the public API intentionally does not delete those records.
import assert from 'node:assert/strict';

let config = {};
if (process.argv.includes('--stdin')) {
  if (process.stdin.isTTY) process.stdin.setRawMode(true);
  process.stdin.setEncoding('utf8');
  console.log('Ready for QA JSON on stdin (input is hidden).');
  const input = await new Promise(resolve => {
    let value = '';
    process.stdin.on('data', function read(chunk) {
      value += chunk;
      if (value.includes('\n') || value.includes('\r')) {
        process.stdin.removeListener('data', read);
        process.stdin.pause();
        resolve(value.trim());
      }
    });
    process.stdin.resume();
  });
  config = JSON.parse(input);
}
const base = config.base || process.env.ATLAS_BASE_URL || 'http://127.0.0.1:4183';
// Never forward the private Site capability to another host or a redirect.
if (config.bypass) assert.equal(base, 'https://atlas-dekanat-2026.topcup.chatgpt.site');
const passwords = {
  'student.1': config.accounts?.['student.1'] || process.env.ATLAS_STUDENT_1_PASSWORD,
  'student.2': config.accounts?.['student.2'] || process.env.ATLAS_STUDENT_2_PASSWORD,
  teacher: config.accounts?.teacher || process.env.ATLAS_TEACHER_PASSWORD,
  admin: config.accounts?.admin || process.env.ATLAS_ADMIN_PASSWORD,
};
const includeGradeCreation = config.includeGradeCreation ?? process.env.ATLAS_TEST_CREATE_GRADE === '1';
for (const [login, password] of Object.entries(passwords)) assert.ok(password, `Missing test password for ${login}`);
const marker = `[QA ${new Date().toISOString()}]`;
const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Moscow', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const sessions = {};
let checks = 0;
function check(condition, message) { assert.ok(condition, message); checks++; }
function equal(actual, expected, message) { assert.equal(actual, expected, message); checks++; }
async function call(path, { login, method = 'GET', body, origin = base, raw, cookie } = {}) {
  const response = await fetch(base + path, {
    method,
    redirect: 'manual',
    headers: {
      ...(config.bypass ? { 'OAI-Sites-Authorization': 'Bearer ' + config.bypass } : {}),
      ...(cookie || sessions[login] ? { cookie: cookie || sessions[login] } : {}),
      ...(body !== undefined || raw !== undefined ? { 'content-type': 'application/json' } : {}),
      ...(!['GET', 'HEAD'].includes(method) ? { origin } : {}),
    },
    body: raw ?? (body === undefined ? undefined : JSON.stringify(body)),
  });
  const text = await response.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: response.status, data, headers: response.headers, cookie: response.headers.get('set-cookie')?.split(';')[0] };
}
async function expect(path, options, status = 200) {
  const result = await call(path, options);
  equal(result.status, status, `${options?.login || 'anonymous'} ${options?.method || 'GET'} ${path}: ${JSON.stringify(result.data)}`);
  return result.data;
}
async function signIn(login) {
  const response = await call('/api/login', { method: 'POST', body: { login, password: passwords[login] } });
  equal(response.status, 200, `Login ${login}`);
  check(response.cookie, `Session cookie ${login}`);
  check(/HttpOnly/i.test(response.headers.get('set-cookie')), `HttpOnly ${login}`);
  sessions[login] = response.cookie;
  return response.data.user;
}
const createdHomework = [];
const createdLessons = [];
let gradeRestore;
try {
  await expect('/api/me', {}, 401);
  await expect('/api/login', { method: 'POST', body: { login: 'student.1', password: 'invalid' } }, 401);
  const users = {};
  for (const login of Object.keys(passwords)) users[login] = await signIn(login);
  for (const login of Object.keys(passwords)) {
    for (const path of ['/api/me', '/api/dashboard', '/api/schedule', '/api/news', '/api/chats', '/api/resources', '/api/homework', '/api/student-services']) {
      await expect(path, { login });
    }
  }
  equal(users['student.1'].tag, 'Староста', 'Starosta is student.1');
  check(users['student.1'].groupId !== users['student.2'].groupId, 'Separate student groups');
  await expect('/api/staff', { login: 'student.1' }, 403);
  await expect('/api/grades', { login: 'teacher' }, 403);
  await expect('/api/unknown', { login: 'admin' }, 404);
  await expect('/api/news', { login: 'admin', method: 'POST', raw: '{invalid' }, 400);

  // Student request -> admin processing -> student sees final result.
  const request = (await expect('/api/requests', { login: 'student.2', method: 'POST', body: { type: 'Справка об обучении', comment: marker + ' Полный цикл заявки' } }, 201)).request;
  equal(request.status, 'submitted', 'New request status');
  await expect(`/api/requests/${request.id}`, { login: 'student.1' }, 403);
  await expect(`/api/requests/${request.id}`, { login: 'teacher' }, 403);
  const otherRequests = await expect('/api/requests?userId=' + users['student.2'].id, { login: 'student.1' });
  check(!otherRequests.requests.some(item => item.id === request.id), 'Request list ignores foreign userId');
  await expect(`/api/requests/${request.id}`, { login: 'student.2', method: 'PATCH', body: { status: 'ready' } }, 403);
  await expect(`/api/requests/${request.id}`, { login: 'admin', method: 'PATCH', body: { status: 'unknown' } }, 400);
  for (const status of ['in_review', 'ready', 'rejected', 'submitted', 'ready']) {
    await expect(`/api/requests/${request.id}`, { login: 'admin', method: 'PATCH', body: { status, staffReply: marker + ' Ответ деканата' } });
    const own = (await expect(`/api/requests/${request.id}`, { login: 'student.2' })).request;
    equal(own.status, status, 'Student sees admin request status');
    check(own.staffReply.includes(marker), 'Student sees staff reply');
  }
  await expect('/api/requests', { login: 'teacher', method: 'POST', body: { type: 'Справка об обучении', comment: marker } }, 403);
  await expect('/api/requests', { login: 'student.2', method: 'POST', body: { type: 'Справка об обучении', comment: marker }, origin: 'https://foreign.example' }, 403);

  // Homework creation/editing, role restrictions and date/group isolation.
  const homeworkBody = { groupId: 'g1', subject: 'Проектирование интерфейсов', date, dueDate: date, title: marker + ' ДЗ', body: 'Подготовьте макет трёх состояний кнопки.' };
  await expect('/api/homework', { login: 'student.2', method: 'POST', body: homeworkBody }, 403);
  await expect('/api/homework', { login: 'student.1', method: 'POST', body: { ...homeworkBody, groupId: 'g2' } }, 403);
  await expect('/api/homework', { login: 'teacher', method: 'POST', body: { ...homeworkBody, subject: 'Аналитика данных' } }, 403);
  await expect('/api/homework', { login: 'student.1', method: 'POST', body: { ...homeworkBody, date: '2026-02-30' } }, 400);
  await expect('/api/homework', { login: 'admin', method: 'POST', body: { ...homeworkBody, dueDate: '2020-01-01' } }, 400);
  for (const login of ['student.1', 'teacher', 'admin']) {
    const item = (await expect('/api/homework', { login, method: 'POST', body: { ...homeworkBody, title: marker + ' ' + login } }, 201)).assignment;
    createdHomework.push(item.id);
    const updated = (await expect('/api/homework/' + item.id, { login, method: 'PATCH', body: { title: marker + ' Исправлено ' + login, body: 'Уточнение задания.' } })).assignment;
    check(updated.title.includes('Исправлено'), login + ' can edit own homework');
    const ownList = await expect(`/api/homework?from=${date}&to=${date}`, { login: 'student.1' });
    check(ownList.assignments.some(task => task.id === item.id && task.body === 'Уточнение задания.'), 'Homework persists for own group');
    const foreignList = await expect(`/api/homework?from=${date}&to=${date}`, { login: 'student.2' });
    check(!foreignList.assignments.some(task => task.id === item.id), 'Homework isolated by group');
  }
  await expect('/api/homework/' + createdHomework[0], { login: 'teacher', method: 'PATCH', body: { title: marker } }, 403);
  await expect('/api/homework/' + createdHomework[1], { login: 'student.1', method: 'PATCH', body: { title: marker } }, 403);
  await expect('/api/homework/' + createdHomework[0], { login: 'admin', method: 'PATCH', body: { title: marker + ' Исправлено администрацией' } });
  await expect('/api/homework?from=2026-11-20&to=2026-11-01', { login: 'admin' }, 400);

  // Teacher's journal: edit one permitted entry, view as student, restore original.
  const staff = await expect('/api/staff', { login: 'teacher' });
  const row = staff.roster.find(item => item.gradeId && item.id === users['student.1'].id);
  check(row, 'Editable existing teacher grade');
  gradeRestore = { studentId: row.id, subject: row.subject, gradeId: row.gradeId, value: row.value, kind: row.kind, note: row.note, attended: row.attended, totalClasses: row.totalClasses };
  const gradeBody = { ...gradeRestore, value: row.value === 5 ? 4 : 5, note: marker + ' Проверка журнала', attended: 7, totalClasses: 8 };
  await expect('/api/grades', { login: 'teacher', method: 'POST', body: gradeBody });
  const studentGrades = await expect('/api/grades', { login: 'student.1' });
  const grade = studentGrades.subjects.find(item => item.id === row.gradeId);
  equal(grade.value, gradeBody.value, 'Student sees updated grade');
  equal(grade.attended, 7, 'Student sees updated attendance');
  check(!(await expect('/api/grades', { login: 'student.2' })).subjects.some(item => item.id === row.gradeId), 'Grades isolated');
  await expect('/api/grades', { login: 'student.1', method: 'POST', body: gradeBody }, 403);
  await expect('/api/grades', { login: 'admin', method: 'POST', body: gradeBody }, 403);
  await expect('/api/grades', { login: 'teacher', method: 'POST', body: { ...gradeBody, subject: 'Аналитика данных' } }, 403);
  await expect('/api/grades', { login: 'teacher', method: 'POST', body: { ...gradeBody, value: 6 } }, 400);
  await expect('/api/grades', { login: 'teacher', method: 'POST', body: { ...gradeBody, attended: 9 } }, 400);

  // News scope and author attribution.
  const teacherNews = (await expect('/api/news', { login: 'teacher', method: 'POST', body: { title: marker + ' Группа', body: 'Тестовое объявление преподавателя.', scope: 'group', groupId: 'g1' } }, 201)).news;
  const adminNews = (await expect('/api/news', { login: 'admin', method: 'POST', body: { title: marker + ' Университет', body: 'Тестовое объявление администрации.', scope: 'all' } }, 201)).news;
  for (const login of ['student.1', 'student.2']) {
    const news = (await expect('/api/news', { login })).news;
    check(news.some(item => item.id === adminNews.id && item.authorId === users.admin.id), 'All-campus admin news visible with author');
    equal(news.some(item => item.id === teacherNews.id), login === 'student.1', 'Group news isolation');
  }
  await expect('/api/news', { login: 'teacher', method: 'POST', body: { title: marker, body: 'test', scope: 'all' } }, 403);
  await expect('/api/news', { login: 'student.1', method: 'POST', body: { title: marker, body: 'test', scope: 'group', groupId: 'g1' } }, 403);

  // Chat participants can send; other-group and folder ownership are enforced.
  const chats = {};
  for (const login of Object.keys(passwords)) chats[login] = (await expect('/api/chats', { login })).chats;
  for (const login of ['student.1', 'student.2', 'teacher']) {
    check(chats[login].length, 'Chat membership for ' + login);
    const chatId = chats[login][0].id;
    const message = (await expect('/api/chat-messages', { login, method: 'POST', body: { chatId, body: marker + ' Сообщение от ' + login } }, 201)).message;
    const after = (await expect('/api/chats', { login })).chats.find(item => item.id === chatId);
    check(after.messages.some(item => item.id === message.id && item.authorId === users[login].id), 'Chat message persists ' + login);
  }
  // Administration has no default chat memberships in the seeded demo.
  await expect('/api/chat-messages', { login: 'admin', method: 'POST', body: { chatId: 'c1', body: marker } }, 403);
  await expect('/api/chat-messages', { login: 'student.2', method: 'POST', body: { chatId: 'c1', body: marker } }, 403);
  const folder = (await expect('/api/chat-folders', { login: 'student.1', method: 'POST', body: { name: 'QA ' + Date.now() } }, 201)).folder;
  await expect('/api/chat-folders', { login: 'student.1', method: 'POST', body: { name: folder.name } }, 409);
  await expect('/api/chats/c1/folder', { login: 'student.1', method: 'PATCH', body: { folderId: folder.id } });
  const ownChat = (await expect('/api/chats', { login: 'student.1' })).chats.find(item => item.id === 'c1');
  equal(ownChat.folder, folder.name, 'Chat folder assignment persists');
  await expect('/api/chats/c2/folder', { login: 'student.2', method: 'PATCH', body: { folderId: folder.id } }, 403);
  await expect('/api/chats/c1/folder', { login: 'student.1', method: 'PATCH', body: { folderId: null } });

  // Administrator creates, changes and removes a weekly lesson; conflicting
  // group, teacher and room must all block overlapping writes.
  const lesson = { groupId: 'g1', weekday: 0, startTime: '22:00', endTime: '22:30', subject: marker + ' Консультация', type: 'Консультация', room: 'QA-999', teacherId: 't1', teacher: users.teacher.name, changed: false, changeNote: '' };
  await expect('/api/schedule', { login: 'teacher', method: 'POST', body: lesson }, 403);
  const createdLesson = (await expect('/api/schedule', { login: 'admin', method: 'POST', body: lesson }, 201)).lesson.id;
  createdLessons.push(createdLesson);
  const modified = { ...lesson, id: createdLesson, startTime: '22:10', endTime: '22:40', room: 'QA-998', changed: true, changeNote: marker + ' Перенос аудитории' };
  await expect('/api/schedule', { login: 'admin', method: 'POST', body: modified });
  const visibleLesson = (await expect('/api/schedule', { login: 'student.1' })).lessons.find(item => item.id === createdLesson);
  check(visibleLesson && visibleLesson.startTime === '22:10' && visibleLesson.changed && visibleLesson.changeNote === modified.changeNote, 'Student sees changed weekly lesson');
  check(!(await expect('/api/schedule', { login: 'student.2' })).lessons.some(item => item.id === createdLesson), 'Group schedule isolation');
  const teacherSchedule = await expect('/api/schedule?teacherId=t1', { login: 'student.2' });
  check(teacherSchedule.lessons.some(item => item.id === createdLesson), 'Student can view teacher schedule across groups');
  for (const conflict of [
    { groupId: 'g1', room: 'QA-other', teacherId: null, teacher: 'QA Преподаватель' },
    { groupId: 'g2', room: 'QA-other', teacherId: 't1' },
    { groupId: 'g2', room: 'QA-998', teacherId: null, teacher: 'QA Преподаватель' },
  ]) await expect('/api/schedule', { login: 'admin', method: 'POST', body: { ...lesson, ...conflict, startTime: '22:20', endTime: '22:50' } }, 409);
  await expect('/api/schedule', { login: 'admin', method: 'POST', body: { ...lesson, endTime: '21:00' } }, 400);
  await expect('/api/schedule/' + createdLesson, { login: 'student.1', method: 'DELETE' }, 403);

  // Run only on a disposable database: the API intentionally cannot erase
  // grade history. This catches a null roster subject before the first grade
  // and ensures updates select the specific gradeId among multiple entries.
  if (includeGradeCreation) {
    const newSubject = marker + ' Новая дисциплина';
    const firstLesson = (await expect('/api/schedule', { login: 'admin', method: 'POST', body: { ...lesson, startTime: '23:00', endTime: '23:30', subject: newSubject } }, 201)).lesson;
    createdLessons.push(firstLesson.id);
    const newStaff = await expect('/api/staff', { login: 'teacher' });
    const firstRow = newStaff.roster.find(item => item.id === users['student.1'].id && item.subject === newSubject);
    check(firstRow && !firstRow.gradeId, 'New subject appears by name before first grade');
    const firstGrade = (await expect('/api/grades', { login: 'teacher', method: 'POST', body: { studentId: firstRow.id, subject: firstRow.subject, value: 4, kind: 'grade', note: marker, attended: 1, totalClasses: 2 } }, 201)).grade;
    const secondGrade = (await expect('/api/grades', { login: 'teacher', method: 'POST', body: { studentId: firstRow.id, subject: firstRow.subject, value: 3, kind: 'grade', note: marker + ' Вторая запись', attended: 0, totalClasses: 0 } }, 201)).grade;
    await expect('/api/grades', { login: 'teacher', method: 'POST', body: { studentId: firstRow.id, subject: firstRow.subject, gradeId: secondGrade.id, value: 5, kind: 'grade', note: marker + ' Изменена вторая', attended: 0, totalClasses: 0 } });
    const afterGrades = (await expect('/api/grades', { login: 'student.1' })).subjects;
    equal(afterGrades.find(item => item.id === firstGrade.id)?.value, 4, 'First grade stays unchanged');
    equal(afterGrades.find(item => item.id === secondGrade.id)?.value, 5, 'Specific second gradeId is changed');
  }

  // Minimal public card, supported subjects and final session revocation.
  const profile = (await expect('/api/people/u2', { login: 'student.1' })).profile;
  for (const privateKey of ['login', 'password', 'password_hash', 'password_salt', 'grades', 'requests']) check(!(privateKey in profile), 'Public profile excludes ' + privateKey);
  for (const login of ['student.1', 'student.2']) {
    const materials = await expect('/api/resources', { login });
    check(materials.subjects.every(subject => subject.resources.length > 0), 'Each visible discipline has published materials');
    check((await expect('/api/student-services', { login })).leadership.length > 0, 'Group leadership available');
  }
  const oldCookie = sessions['student.2'];
  await expect('/api/logout', { login: 'student.2', method: 'POST', body: {} });
  await expect('/api/me', { cookie: oldCookie }, 401);
  await signIn('student.2');
  const persisted = (await expect('/api/requests/' + request.id, { login: 'student.2' })).request;
  equal(persisted.status, 'ready', 'Request persists after relogin');
} finally {
  // Restore only records this script created or deliberately changed.
  if (gradeRestore) await expect('/api/grades', { login: 'teacher', method: 'POST', body: gradeRestore });
  for (const id of createdLessons) await expect('/api/schedule/' + id, { login: 'admin', method: 'DELETE' });
  for (const id of createdHomework) await expect('/api/homework/' + id, { login: 'admin', method: 'DELETE' });
}
console.log(`PASS: ${checks} checks across four role journeys, isolation, persistence and invalid input. Marker: ${marker}`);

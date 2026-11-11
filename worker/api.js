// Concatenated into the single Cloudflare Worker entrypoint. No imports required.
class AtlasApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function atlasJson(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
      ...extraHeaders,
    },
  });
}

function atlasFail(status, message) {
  throw new AtlasApiError(status, message);
}

function atlasHex(bytes) {
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function atlasUnhex(value) {
  const out = new Uint8Array(value.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(value.slice(i * 2, i * 2 + 2), 16);
  return out;
}

async function atlasSha256(value) {
  return atlasHex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
}

async function atlasVerifyPassword(password, row) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: atlasUnhex(row.password_salt), iterations: row.password_iterations },
    key,
    256,
  );
  const actual = atlasHex(bits);
  // Compare all bytes so a wrong prefix does not short-circuit.
  let mismatch = 0;
  for (let i = 0; i < actual.length; i++) mismatch |= actual.charCodeAt(i) ^ row.password_hash.charCodeAt(i);
  return mismatch === 0;
}

function atlasCookie(request, value, maxAge) {
  const url = new URL(request.url);
  const localHttp = url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  return `atlas_session=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${localHttp ? '' : '; Secure'}`;
}

function atlasSessionToken(request) {
  const match = /(?:^|;\s*)atlas_session=([a-f0-9]{64})(?:;|$)/.exec(request.headers.get('Cookie') || '');
  return match ? match[1] : null;
}

function atlasSafeUser(row) {
  return {
    id: row.id,
    login: row.login,
    name: row.name,
    initials: row.initials,
    role: row.role,
    faculty: row.faculty,
    direction: row.direction,
    course: row.course,
    groupId: row.role==='student'?row.group_id:null,
    group: row.role==='student'?(row.group_name || null):null,
    tag: row.tag,
    accent: row.accent,
    bio: row.bio || '',
    contactEmail: row.contact_email || '',
    phone: row.phone || '',
  };
}

async function atlasGetUser(request, db) {
  const token = atlasSessionToken(request);
  if (!token) return null;
  const tokenHash = await atlasSha256(token);
  const row = await db.prepare(`
    SELECT u.*, g.name AS group_name
    FROM sessions s JOIN users u ON u.id = s.user_id
    LEFT JOIN groups g ON g.id = u.group_id
    WHERE s.token_hash = ? AND s.expires_at > ?
  `).bind(tokenHash, Date.now()).first();
  return row || null;
}

function atlasCheckOrigin(request) {
  const origin = request.headers.get('Origin');
  const own = new URL(request.url).origin;
  if (origin && origin !== own) atlasFail(403, 'Запрос с другого сайта отклонён.');
  const fetchSite = request.headers.get('Sec-Fetch-Site');
  if (!origin && fetchSite && !['same-origin', 'none'].includes(fetchSite)) {
    atlasFail(403, 'Запрос с другого сайта отклонён.');
  }
}

async function atlasBody(request) {
  const type = request.headers.get('Content-Type') || '';
  if (!type.toLowerCase().includes('application/json')) atlasFail(415, 'Ожидается JSON.');
  const length = Number(request.headers.get('Content-Length') || 0);
  if (length > 65_536) atlasFail(413, 'Данные слишком большие.');
  let text;
  try { text = await request.text(); } catch { atlasFail(400, 'Не удалось прочитать запрос.'); }
  if (text.length > 65_536) atlasFail(413, 'Данные слишком большие.');
  try {
    const value = JSON.parse(text);
    if (!value || typeof value !== 'object' || Array.isArray(value)) atlasFail(400, 'Ожидается объект JSON.');
    return value;
  } catch (error) {
    if (error instanceof AtlasApiError) throw error;
    atlasFail(400, 'Некорректный JSON.');
  }
}

function atlasString(value, label, max = 500, min = 1) {
  if (typeof value !== 'string') atlasFail(400, `${label}: требуется текст.`);
  const trimmed = value.trim();
  if (trimmed.length < min || trimmed.length > max) atlasFail(400, `${label}: длина от ${min} до ${max} символов.`);
  return trimmed;
}

function atlasRole(user, ...roles) {
  if (!roles.includes(user.role)) atlasFail(403, 'Недостаточно прав.');
}

function atlasLesson(row) {
  return {
    id: row.id, groupId: row.group_id, groupIds:atlasLessonGroupIds(row), group: (row.group_names_json&&JSON.parse(row.group_names_json).length?JSON.parse(row.group_names_json).join(', '):row.group_name)||null,weekPattern:row.week_pattern||'all',singleDate:row.single_date||null,active:row.active!==0,
    weekday: row.weekday, startTime: row.start_time, endTime: row.end_time,
    subject: row.subject, type: row.type, room: row.room,
    teacher: row.teacher_name, teacherId: row.teacher_id || `name:${row.teacher_name}`,
    changed: Boolean(row.changed), changeNote: row.change_note,
  };
}

function atlasNews(row) {
  return {
    id: row.id, title: row.title, body: row.body,
    authorId: row.author_id, author: row.author_name, authorRole: row.author_role,
    scope: row.scope, groupId: row.group_id, group: row.group_name || null,
    createdAt: row.created_at, pinned: Boolean(row.pinned), deadline: row.deadline,
  };
}

function atlasRequest(row) {
  return {
    id: row.id, type: row.type, comment: row.comment, status: row.status,
    createdAt: row.created_at, updatedAt: row.updated_at, staffReply: row.staff_reply,
    userId: row.user_id, student: row.student_name || null,
  };
}

function atlasMoscowDate() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Moscow', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return new Date(Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day)));
}

function atlasWeekStart(weekOffset = 0) {
  const date = atlasMoscowDate();
  const weekday = date.getUTCDay();
  date.setUTCDate(date.getUTCDate() - ((weekday + 6) % 7) + weekOffset * 7);
  return date;
}

function atlasDateForWeekday(weekStart, weekday) {
  const date = new Date(weekStart);
  date.setUTCDate(date.getUTCDate() + ((weekday + 6) % 7));
  return date.toISOString().slice(0, 10);
}

async function atlasLessons(db, user, url) {
  const requestedTeacher = url.searchParams.get('teacherId');
  const requestedGroup = url.searchParams.get('groupId');
  let sql = `SELECT l.*,g.name AS group_name,(SELECT json_group_array(group_id) FROM lesson_groups lg WHERE lg.lesson_id=l.id) AS group_ids_json,(SELECT json_group_array(g2.name) FROM lesson_groups lg JOIN groups g2 ON g2.id=lg.group_id WHERE lg.lesson_id=l.id) AS group_names_json FROM teaching_assignments l JOIN groups g ON g.id=l.group_id`;
  let bindings = [];
  if (requestedTeacher) {
    if (requestedTeacher.startsWith('name:')) {
      const name = requestedTeacher.slice(5);
      const teacher = await db.prepare('SELECT id FROM lessons WHERE teacher_name=? LIMIT 1').bind(name).first();
      if (!teacher) atlasFail(404, 'Преподаватель не найден.');
      sql += ' WHERE l.teacher_name=?';
      bindings = [name];
    } else {
      const teacher = await db.prepare("SELECT id FROM users WHERE id=? AND role='teacher'").bind(requestedTeacher).first();
      if (!teacher) atlasFail(404, 'Преподаватель не найден.');
      sql += ' WHERE l.teacher_id=?';
      bindings = [requestedTeacher];
    }
  } else if (user.role === 'student') {
    if (requestedGroup && requestedGroup !== user.group_id) atlasFail(403, 'Расписание другой группы недоступно.');
    sql += ' WHERE l.group_id=?';
    bindings = [user.group_id];
  } else if (user.role === 'teacher') {
    if (requestedGroup) {
      const allowed = await db.prepare('SELECT id FROM teaching_assignments WHERE teacher_id=? AND group_id=? LIMIT 1').bind(user.id, requestedGroup).first();
      if (!allowed) atlasFail(403, 'Группа недоступна.');
      sql += ' WHERE l.group_id=?';
      bindings = [requestedGroup];
    } else {
      sql += ' WHERE l.teacher_id=?';
      bindings = [user.id];
    }
  } else if (requestedGroup) {
    sql += ' WHERE l.group_id=?';
    bindings = [requestedGroup];
  }
  sql += ' ORDER BY l.weekday,l.start_time,l.group_id';
  const result = await db.prepare(sql).bind(...bindings).all();
  return [...new Map(result.results.filter(row=>!row.single_date&&row.active!==0).map(row=>[row.id,atlasLesson(row)])).values()];
}

async function atlasGrades(db, user) {
  atlasRole(user, 'student');
  const rows = (await db.prepare(`
    SELECT g.*, t.name AS teacher_name FROM grades g
    LEFT JOIN users t ON t.id=g.teacher_id WHERE g.student_id=?
    ORDER BY g.subject,g.recorded_at DESC
  `).bind(user.id).all()).results;
  const subjects = rows.map((row) => ({
    id: row.id, title: row.subject, subject: row.subject, teacher: row.teacher_name,
    value: row.value, kind: row.kind, note: row.note, recordedAt: row.recorded_at,
    attended: row.attended, totalClasses: row.total_classes,
    attendance: row.total_classes ? Math.round(row.attended * 100 / row.total_classes) : null,
  }));
  const counted = rows.filter((row) => row.kind !== 'credit');
  const average = counted.length ? Math.round(counted.reduce((sum, row) => sum + row.value, 0) / counted.length * 10) / 10 : null;
  const attended = rows.reduce((sum, row) => sum + row.attended, 0);
  const total = rows.reduce((sum, row) => sum + row.total_classes, 0);
  const exams = (await db.prepare('SELECT * FROM exams WHERE student_id=? ORDER BY exam_date').bind(user.id).all()).results.map((row) => ({
    id: row.id, subject: row.subject, kind: row.kind, date: row.exam_date, room: row.room, status: row.status,
  }));
  return { subjects, exams, average, attendance: total ? Math.round(attended * 100 / total) : null, attended, totalClasses: total };
}

async function atlasNewsList(db, user, limit = 100, includeAttachments = true) {
  let condition = '';
  let args = [];
  if (user.role === 'student') {
    condition = "WHERE n.scope='all' OR (n.scope='group' AND n.group_id=?)";
    args = [user.group_id];
  } else if (user.role === 'teacher') {
    condition = "WHERE n.scope='all' OR n.author_id=? OR n.group_id IN (SELECT group_id FROM teaching_assignments WHERE teacher_id=?)";
    args = [user.id, user.id];
  }
  const rows = (await db.prepare(`
    SELECT n.*,u.name AS author_name,u.role AS author_role,g.name AS group_name
    FROM news n JOIN users u ON u.id=n.author_id LEFT JOIN groups g ON g.id=n.group_id
    ${condition ? 'WHERE ('+condition.slice(6)+') AND n.archived=0' : 'WHERE n.archived=0'} ORDER BY n.pinned DESC,n.created_at DESC LIMIT ?
  `).bind(...args, limit).all()).results;
  if (!includeAttachments || !rows.length) return rows.map(atlasNews);
  const files=(await db.prepare(`SELECT id,name,mime,size,kind,news_id FROM uploads WHERE news_id IN (${rows.map(()=>'?').join(',')}) ORDER BY created_at,id`).bind(...rows.map(row=>row.id)).all()).results;
  const grouped=new Map();for(const file of files){if(!grouped.has(file.news_id))grouped.set(file.news_id,[]);grouped.get(file.news_id).push(atlasFile(file));}
  return rows.map(row=>({...atlasNews(row),attachments:grouped.get(row.id)||[]}));
}

async function atlasRequests(db, user) {
  const staff = user.role === 'admin';
  const rows = (await db.prepare(`
    SELECT r.*,u.name AS student_name FROM requests r JOIN users u ON u.id=r.user_id
    ${staff ? '' : 'WHERE r.user_id=?'} ORDER BY r.created_at DESC
  `).bind(...(staff ? [] : [user.id])).all()).results;
  return rows.map(atlasRequest);
}

async function atlasDashboard(db, user, request) {
  const url = new URL(request.url);
  const lessons = await atlasLessons(db, user, url);
  const campusDate = atlasMoscowDate();
  const todayDay = campusDate.getUTCDay();
  let nextDay = todayDay;
  let today = lessons.filter((lesson) => lesson.weekday === todayDay);
  if (!today.length) {
    for (let offset = 1; offset <= 7; offset++) {
      const day = (todayDay + offset) % 7;
      today = lessons.filter((lesson) => lesson.weekday === day);
      if (today.length) { nextDay = day; break; }
    }
  }
  const displayDate = new Date(campusDate);
  displayDate.setUTCDate(displayDate.getUTCDate() + ((nextDay - todayDay + 7) % 7));
  const [grades,ownRequests,news,unread,calendar]=await Promise.all([
    user.role==='student'?atlasGrades(db,user):null,
    user.role==='student'?atlasRequests(db,user):[],
    atlasNewsList(db,user,4),
    typeof atlasChatUnreadCounts==='function'?atlasChatUnreadCounts(db,user):{totalUnread:0},
    typeof atlasCalendarToday==='function'?atlasCalendarToday(db,user,request):{},
  ]);
  const pendingRequests = ownRequests.filter((item) => ['submitted', 'in_review'].includes(item.status)).length;
  const deadlines = news.filter((item) => item.deadline).map((item) => ({ id: item.id, title: item.title, date: item.deadline, kind: 'announcement' }));
  if (grades) deadlines.push(...grades.exams.map((exam) => ({ id: exam.id, title: exam.subject, date: exam.date, kind: 'exam' })));
  const todayIso=campusDate.toISOString().slice(0,10);
  if(user.role==='student'){const due=(await db.prepare('SELECT id,subject,title,lesson_date,due_date,group_id FROM homework WHERE group_id=? AND due_date>=? AND due_date<=? ORDER BY due_date LIMIT 15').bind(user.group_id,todayIso,atlasDateAdd(todayIso,30)).all()).results;deadlines.push(...due.map(row=>({id:row.id,title:row.title,date:row.due_date,kind:'homework',subject:row.subject,lessonDate:row.lesson_date,groupId:row.group_id})));}
  deadlines.sort((a, b) => a.date.localeCompare(b.date));
  return {
    user: atlasSafeUser(user), today, nextLesson: today[0] || null,
    displayDate: displayDate.toISOString().slice(0, 10), todayIsNextDay: nextDay !== todayDay,
    gradeAverage: grades?.average ?? null, attendance: grades?.attendance ?? null,
    pendingRequests, unreadMessages: unread.totalUnread, news, deadlines: deadlines.filter(item=>item.date>=todayIso).slice(0, 5),
    ...calendar,
  };
}

async function atlasGroup(db, user, url) {
  let groupId = user.role === 'student' ? user.group_id : url.searchParams.get('groupId');
  if(!groupId&&user.role!=='student')return {group:null,clubs:(await atlasClubs(db,user))};
  if (user.role === 'student' && url.searchParams.get('groupId') && url.searchParams.get('groupId') !== user.group_id) atlasFail(403, 'Группа недоступна.');
  if (user.role === 'teacher') {
    const allowed = await db.prepare('SELECT id FROM teaching_assignments WHERE teacher_id=? AND group_id=? LIMIT 1').bind(user.id, groupId).first();
    if (!allowed) atlasFail(403, 'Группа недоступна.');
  }
  const group = await db.prepare('SELECT * FROM groups WHERE id=?').bind(groupId).first();
  if (!group) atlasFail(404, 'Группа не найдена.');
  const members = (await db.prepare("SELECT id,name,initials,tag,accent FROM users WHERE group_id=? AND role='student' ORDER BY name").bind(groupId).all()).results;
  const clubRows = (await db.prepare(`
    SELECT c.*,cm.role AS membership_role FROM clubs c
    LEFT JOIN club_members cm ON cm.club_id=c.id AND cm.user_id=? ORDER BY c.name
  `).bind(user.id).all()).results;
  return {
    group: { id: group.id, name: group.name, faculty: group.faculty, direction: group.direction, course: group.course, description: group.description, members },
    clubs: clubRows.map((row) => ({ id: row.id, name: row.name, description: row.description, color: row.color, priority: row.priority, isMember: Boolean(row.membership_role), role: row.membership_role })),
  };
}

async function atlasChats(db, user) {
  const rows = (await db.prepare(`
    SELECT c.*,cm.role AS member_role,a.folder_id,f.name AS user_folder
    FROM chats c JOIN chat_members cm ON cm.chat_id=c.id
    LEFT JOIN chat_folder_assignments a ON a.chat_id=c.id AND a.user_id=cm.user_id
    LEFT JOIN chat_folders f ON f.id=a.folder_id
    WHERE cm.user_id=? AND (c.kind<>'group' OR (?='student' AND c.group_id=?)) ORDER BY c.folder,c.title
  `).bind(user.id,user.role,user.group_id).all()).results;
  for(const row of rows)if(row.kind==='direct'){const peer=await db.prepare('SELECT u.name,u.id FROM chat_members cm JOIN users u ON u.id=cm.user_id WHERE cm.chat_id=? AND cm.user_id<>? ORDER BY u.id LIMIT 1').bind(row.id,user.id).first();if(peer){row.title=peer.name;row.peer_id=peer.id;}row.description='Личная переписка';}
  const [unread,messageResult]=await Promise.all([
    typeof atlasChatUnreadCounts==='function'?atlasChatUnreadCounts(db,user):{byChat:{}},
    rows.length?db.prepare(`SELECT * FROM (
      SELECT m.id,m.chat_id,m.body,m.created_at,m.author_id,u.name AS author,u.initials,m.rowid AS sequence,
      ROW_NUMBER() OVER (PARTITION BY m.chat_id ORDER BY m.rowid DESC) AS position
      FROM messages m JOIN users u ON u.id=m.author_id WHERE m.chat_id IN (${rows.map(()=>'?').join(',')})
    ) WHERE position<=50 ORDER BY sequence`).bind(...rows.map(row=>row.id)).all():{results:[]},
  ]);
  const messagesByChat=new Map();for(const message of messageResult.results){if(!messagesByChat.has(message.chat_id))messagesByChat.set(message.chat_id,[]);messagesByChat.get(message.chat_id).push({id:message.id,body:message.body,createdAt:message.created_at,authorId:message.author_id,author:message.author,initials:message.initials});}
  const chats=rows.map(row=>({id:row.id,title:row.title,kind:row.kind,groupId:row.group_id,clubId:row.club_id,folder:row.user_folder||row.folder,folderId:row.folder_id||null,description:row.description,memberRole:row.member_role,peerId:row.peer_id||null,messages:messagesByChat.get(row.id)||[],unread:unread.byChat[row.id]||0}));
  return chats;
}

async function atlasChatFolders(db, user) {
  const rows = (await db.prepare('SELECT id,name,created_at FROM chat_folders WHERE user_id=? ORDER BY name').bind(user.id).all()).results;
  return rows.map((row) => ({ id: row.id, name: row.name, createdAt: row.created_at }));
}

function atlasResource(row) {
  return { id:row.id, subject:row.subject, title:row.title, type:row.type, description:row.description,
    body:row.body, groupId:row.group_id, group:row.group_name || null, authorId:row.kind==='teacher'?row.author_id:null,
    author:row.kind==='teacher'?row.author:null, authorRole:row.kind==='teacher'?row.author_role:null,
    kind:row.kind, createdAt:row.created_at };
}
async function atlasResourceOptions(db,user) {
  const args=user.role==='teacher'?[user.id]:user.role==='student'?[user.group_id]:[];
  const condition=user.role==='teacher'?' WHERE l.teacher_id=?':user.role==='student'?' WHERE l.group_id=?':'';
  const options=(await db.prepare(`SELECT DISTINCT l.group_id AS groupId,g.name AS group_name,l.subject FROM teaching_assignments l JOIN groups g ON g.id=l.group_id${condition} ORDER BY g.name,l.subject`).bind(...args).all()).results.map(row=>({groupId:row.groupId,group:row.group_name,subject:row.subject}));
  const groups=[...new Map(options.map(row=>[row.groupId,{id:row.groupId,name:row.group}])).values()];
  return {canPublish:['teacher','admin'].includes(user.role),options,groups};
}
async function atlasResources(db, user) {
  let query = `SELECT r.*,u.name AS author,u.role AS author_role,g.name AS group_name FROM resources r LEFT JOIN users u ON u.id=r.author_id LEFT JOIN groups g ON g.id=r.group_id`;
  const args = [];
  if (user.role === 'student') { query += ' WHERE (r.group_id=? OR r.group_id IS NULL)'; args.push(user.group_id); }
  if (user.role === 'teacher') { query += ' WHERE (r.group_id IS NULL OR r.author_id=? OR r.group_id IN (SELECT group_id FROM teaching_assignments WHERE teacher_id=?))'; args.push(user.id, user.id); }
  query += (user.role==='admin'?' WHERE':' AND')+' r.archived=0 ORDER BY r.subject,r.kind,r.created_at DESC,r.title';
  const rows = (await db.prepare(query).bind(...args).all()).results;
  const bySubject = new Map();
  for (const row of rows) {
    if (!bySubject.has(row.subject)) bySubject.set(row.subject, { name: row.subject, resources: [] });
    bySubject.get(row.subject).resources.push(atlasResource(row));
  }
  return {subjects:Array.from(bySubject.values()),...await atlasResourceOptions(db,user)};
}
async function atlasPublishResource(db,user,body) {
  atlasRole(user,'teacher','admin');
  const subject=atlasString(body.subject,'Дисциплина',120);
  const kind=body.kind || (user.role==='teacher'?'teacher':'general');
  if (!['general','teacher'].includes(kind)) atlasFail(400,'Укажите вид материала.');
  if (kind!==(user.role==='teacher'?'teacher':'general')) atlasFail(403,user.role==='teacher'?'Преподаватель публикует собственные материалы.':'Общие пособия публикуются от учебного офиса.');
  const groupId=body.groupId===null || body.groupId===undefined || body.groupId===''?null:atlasString(body.groupId,'Группа',40);
  const known=await db.prepare('SELECT id FROM lessons WHERE subject=? LIMIT 1').bind(subject).first();
  if (!known) atlasFail(404,'Дисциплина не найдена.');
  if (groupId && !(await db.prepare('SELECT id FROM groups WHERE id=?').bind(groupId).first())) atlasFail(404,'Группа не найдена.');
  if (groupId && !(await db.prepare('SELECT id FROM teaching_assignments WHERE group_id=? AND subject=? LIMIT 1').bind(groupId,subject).first())) atlasFail(400,'Предмет отсутствует в расписании выбранной группы.');
  if (user.role==='teacher') {
    if (!groupId || !(await db.prepare('SELECT id FROM teaching_assignments WHERE teacher_id=? AND group_id=? AND subject=? LIMIT 1').bind(user.id,groupId,subject).first())) atlasFail(403,'Публикация доступна только по своим дисциплинам и группам.');
  }
  const title=atlasString(body.title,'Название',160),type=atlasString(body.type || 'Пособие','Тип',40),description=atlasString(body.description || '','Описание',400,0),content=atlasString(body.body,'Содержание',8000);
  const id=crypto.randomUUID(),now=new Date().toISOString();
  await db.prepare('INSERT INTO resources(id,subject,title,type,description,body,group_id,author_id,kind,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)').bind(id,subject,title,type,description,content,groupId,user.id,kind,now).run();
  const row=await db.prepare('SELECT r.*,u.name AS author,u.role AS author_role,g.name AS group_name FROM resources r LEFT JOIN users u ON u.id=r.author_id LEFT JOIN groups g ON g.id=r.group_id WHERE r.id=?').bind(id).first();
  return atlasResource(row);
}

async function atlasStaff(db, user) {
  atlasRole(user, 'teacher', 'admin');
  if (user.role === 'admin') {
    const groups = (await db.prepare('SELECT * FROM groups ORDER BY name').all()).results;
    return { role: 'admin', requests: await atlasRequests(db, user), groups, news: await atlasNewsList(db, user, 20) };
  }
  const groups = (await db.prepare(`
    SELECT DISTINCT g.id,g.name,g.faculty,g.direction,g.course FROM groups g
    JOIN teaching_assignments l ON l.group_id=g.id WHERE l.teacher_id=? ORDER BY g.name
  `).bind(user.id).all()).results;
  const roster = (await db.prepare(`
    SELECT u.id,u.name,u.initials,u.group_id,g.name AS group_name,u.tag,
      gr.id AS grade_id,l.subject AS subject,gr.value,gr.kind,gr.note,gr.attended,gr.total_classes
    FROM users u JOIN groups g ON g.id=u.group_id
    JOIN teaching_assignments l ON l.group_id=u.group_id AND l.teacher_id=?
    LEFT JOIN grades gr ON gr.student_id=u.id AND gr.teacher_id=? AND gr.subject=l.subject
    WHERE u.role='student' GROUP BY u.id,l.subject,gr.id ORDER BY g.name,u.name,l.subject
  `).bind(user.id, user.id).all()).results.map((row) => ({
    id: row.id, name: row.name, initials: row.initials, groupId: row.group_id,
    group: row.group_name, tag: row.tag, gradeId: row.grade_id,
    subject: row.subject, value: row.value, kind: row.kind, note: row.note,
    attended: row.attended, totalClasses: row.total_classes,
  }));
  return { role: 'teacher', groups, roster, schedule: await atlasLessons(db, user, new URL('https://example.invalid/api/schedule')) };
}

function atlasIsoDate(value, label = 'Дата') {
  const text = atlasString(value, label, 10);
  if (!/^20\d{2}-\d{2}-\d{2}$/.test(text)) atlasFail(400, `${label}: укажите дату в формате ГГГГ-ММ-ДД.`);
  const date = new Date(`${text}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== text) atlasFail(400, `${label}: такой даты не существует.`);
  return text;
}

function atlasDateAdd(value, days) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

async function atlasTeachers(db) {
  const registered = (await db.prepare("SELECT id,name,initials FROM users WHERE role='teacher' ORDER BY name").all()).results;
  const names = (await db.prepare('SELECT DISTINCT teacher_name AS name FROM lessons ORDER BY teacher_name').all()).results;
  const byName = new Map(registered.map((teacher) => [teacher.name, teacher]));
  for (const row of names) if (!byName.has(row.name)) byName.set(row.name, {
    id: `name:${row.name}`, name: row.name,
    initials: row.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join(''),
  });
  return Array.from(byName.values()).sort((a, b) => a.name.localeCompare(b.name, 'ru'));
}

async function atlasHomeworkOptions(db, user) {
  let sql = 'SELECT DISTINCT g.id,g.name,l.subject FROM groups g JOIN teaching_assignments l ON l.group_id=g.id';
  const args = [];
  if (user.role === 'student') { sql += ' WHERE g.id=?'; args.push(user.group_id); }
  if (user.role === 'teacher') { sql += ' WHERE l.teacher_id=?'; args.push(user.id); }
  const rows = (await db.prepare(sql + ' ORDER BY g.name,l.subject').bind(...args).all()).results;
  const groups = Array.from(new Map(rows.map((row) => [row.id, { id: row.id, name: row.name }])).values());
  return {
    groups, subjects: Array.from(new Set(rows.map((row) => row.subject))),
    options: rows.map((row) => ({ groupId: row.id, subject: row.subject })),
    canCreate: user.role === 'admin' || user.role === 'teacher' || (user.role === 'student' && user.tag === 'Староста'),
  };
}

async function atlasHomeworkPermission(db, user, groupId, subject) {
  if (user.role === 'student' && (user.tag !== 'Староста' || groupId !== user.group_id)) atlasFail(403, 'Добавлять задания может староста только своей группы.');
  const group = await db.prepare('SELECT id FROM groups WHERE id=?').bind(groupId).first();
  if (!group) atlasFail(404, 'Группа не найдена.');
  if (user.role === 'admin') return;
  const lesson = await db.prepare('SELECT id FROM teaching_assignments WHERE group_id=? AND subject=? LIMIT 1').bind(groupId, subject).first();
  if (!lesson) atlasFail(400, 'В расписании этой группы нет выбранной дисциплины.');
  if (user.role === 'teacher') {
    const taught = await db.prepare('SELECT id FROM teaching_assignments WHERE group_id=? AND subject=? AND teacher_id=? LIMIT 1').bind(groupId, subject, user.id).first();
    if (!taught) atlasFail(403, 'Преподаватель может добавлять задания только по своим дисциплинам и группам.');
  }
}

function atlasHomeworkRow(row, user) {
  return {
    id: row.id, groupId: row.group_id, group: row.group_name, subject: row.subject,
    date: row.lesson_date, dueDate: row.due_date, title: row.title, body: row.body,
    authorId: row.author_id, author: row.author_name, authorRole: row.author_role, authorTag: row.author_tag,
    createdAt: row.created_at, updatedAt: row.updated_at,
    canEdit: user.role === 'admin' || (row.author_id === user.id && (user.role === 'teacher' || user.tag === 'Староста')),
  };
}

async function atlasHomeworkList(db, user, url) {
  const from = atlasIsoDate(url.searchParams.get('from') || atlasWeekStart().toISOString().slice(0, 10), 'Начало периода');
  const to = atlasIsoDate(url.searchParams.get('to') || atlasDateAdd(from, 6), 'Конец периода');
  if (to < from || (new Date(to) - new Date(from)) / 86400000 > 62) atlasFail(400, 'Выберите период до 63 дней.');
  let query = `SELECT h.*,g.name AS group_name,u.name AS author_name,u.role AS author_role,u.tag AS author_tag FROM homework h JOIN groups g ON g.id=h.group_id JOIN users u ON u.id=h.author_id WHERE h.lesson_date BETWEEN ? AND ?`;
  const args = [from, to];
  if (user.role === 'student') { query += ' AND h.group_id=?'; args.push(user.group_id); }
  if (user.role === 'teacher') { query += ' AND EXISTS (SELECT 1 FROM teaching_assignments l WHERE l.group_id=h.group_id AND l.subject=h.subject AND l.teacher_id=?)'; args.push(user.id); }
  query += ' ORDER BY h.lesson_date,h.subject,h.created_at DESC';
  const rows = (await db.prepare(query).bind(...args).all()).results;
  return { assignments: rows.map((row) => atlasHomeworkRow(row, user)), ...await atlasHomeworkOptions(db, user), from, to };
}

async function atlasHomeworkWrite(db, user, body, existing = null) {
  const groupId = atlasString(body.groupId ?? existing?.group_id, 'Группа', 40);
  const subject = atlasString(body.subject ?? existing?.subject, 'Дисциплина', 120);
  await atlasHomeworkPermission(db, user, groupId, subject);
  const date = atlasIsoDate(body.date ?? existing?.lesson_date, 'Дата занятия');
  const dueDate = atlasIsoDate(body.dueDate ?? existing?.due_date ?? date, 'Срок выполнения');
  if (dueDate < date) atlasFail(400, 'Срок выполнения не может быть раньше даты занятия.');
  const title = atlasString(body.title ?? existing?.title, 'Заголовок', 160);
  const content = atlasString(body.body ?? existing?.body, 'Задание', 4000);
  const id = existing?.id || crypto.randomUUID();
  const now = new Date().toISOString();
  if (existing) await db.prepare('UPDATE homework SET group_id=?,subject=?,lesson_date=?,due_date=?,title=?,body=?,updated_at=? WHERE id=?').bind(groupId, subject, date, dueDate, title, content, now, id).run();
  else await db.prepare('INSERT INTO homework(id,group_id,subject,lesson_date,due_date,title,body,author_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)').bind(id, groupId, subject, date, dueDate, title, content, user.id, now, now).run();
  const row = await db.prepare('SELECT h.*,g.name AS group_name,u.name AS author_name,u.role AS author_role,u.tag AS author_tag FROM homework h JOIN groups g ON g.id=h.group_id JOIN users u ON u.id=h.author_id WHERE h.id=?').bind(id).first();
  return atlasHomeworkRow(row, user);
}

const ATLAS_STUDENT_CONTACTS = [
  { id:'dean-office',name:'Мария Петрова',role:'admin',position:'Специалист учебного офиса',description:'Справки, заявления, академические вопросы и маршрутизация обращений.',office:'Корпус А · кабинет 101',hours:'Пн–пт, 09:00–17:00',email:'office@example.invalid',profileId:'a1',kind:'dean' },
  { id:'dean-head',name:'Александр Ветров',role:'admin',position:'Заместитель декана по работе со студентами',description:'Сложные учебные ситуации, индивидуальные траектории и вопросы организации обучения.',office:'Корпус А · кабинет 103',hours:'Вт и чт, 14:00–16:00 · по записи',email:'dean@example.invalid',profileId:'contact:dean-head',kind:'dean' },
  { id:'curator-g1',name:'Софья Ларина',role:'curator',position:'Куратор группы ИД-24-1',description:'Помогает освоиться в университете, организовать учебную работу и найти нужный сервис.',office:'Студенческий центр · 2 этаж',hours:'Пн, ср, пт, 12:00–16:00',email:'curator.design@example.invalid',profileId:'contact:curator-g1',kind:'curator',groupId:'g1' },
  { id:'curator-g2',name:'Виктор Зорин',role:'curator',position:'Куратор группы ПИ-23-2',description:'Учебная адаптация, внеучебные проекты и помощь с организационными вопросами.',office:'Корпус Б · кабинет 106',hours:'Пн–пт, 13:00–16:00',email:'curator.engineering@example.invalid',profileId:'contact:curator-g2',kind:'curator',groupId:'g2' },
  { id:'wellbeing',name:'Алина Мирная',role:'support',position:'Специалист службы благополучия',description:'Конфиденциальная запись на консультацию по стрессу, адаптации и учебной нагрузке. Демонстрационный контакт.',office:'Студенческий центр · кабинет 204',hours:'Пн–пт, 10:00–18:00 · по записи',email:'wellbeing@example.invalid',profileId:'contact:wellbeing',kind:'support' },
  { id:'it-support',name:'Илья Северин',role:'support',position:'Поддержка цифровых сервисов',description:'Проблемы со входом, отображением расписания и работой личного кабинета.',office:'Онлайн · учебный офис',hours:'Пн–пт, 09:00–18:00',email:'help@example.invalid',profileId:'contact:it-support',kind:'support' },
  { id:'starosta-g2',name:'Артём Лебедев',role:'student',position:'Староста группы ПИ-23-2',description:'Собирает организационные вопросы группы и передаёт объявления преподавателей.',office:'Групповой чат ПИ-23-2',hours:'В учебные дни, 09:00–18:00',email:'group.pi@example.invalid',profileId:'contact:starosta-g2',kind:'leadership',groupId:'g2' },
];

async function atlasStudentServices(db, user) {
  const groupId = user.role === 'student' ? user.group_id : null;
  const leaders = (await db.prepare(`SELECT u.id,u.name,u.initials,u.group_id,g.name AS group_name FROM users u JOIN groups g ON g.id=u.group_id WHERE u.role='student' AND u.tag='Староста'${groupId ? ' AND u.group_id=?' : ''} ORDER BY g.name`).bind(...(groupId ? [groupId] : [])).all()).results.map((row) => ({
    id:`leader-${row.id}`,name:row.name,initials:row.initials,role:'student',position:`Староста группы ${row.group_name}`,description:'Организационные вопросы группы, объявления и связь с преподавателями.',office:`Групповой чат ${row.group_name}`,hours:'В учебные дни',email:'group.design@example.invalid',profileId:row.id,kind:'leadership',groupId:row.group_id,
  }));
  const fallbacks = ATLAS_STUDENT_CONTACTS.filter((contact) => contact.kind === 'leadership' && (!groupId || contact.groupId === groupId) && !leaders.some((leader) => leader.groupId === contact.groupId));
  return {
    contacts: ATLAS_STUDENT_CONTACTS.filter((contact) => contact.kind === 'dean'),
    leadership: [...leaders, ...fallbacks],
    services: ATLAS_STUDENT_CONTACTS.filter((contact) => ['curator','support'].includes(contact.kind) && (!contact.groupId || !groupId || contact.groupId === groupId)),
    demoNotice:'Все контакты вымышлены. Адреса example.invalid приведены только для демонстрации и не принимают письма.',
  };
}

async function atlasPublicProfile(db, id, user) {
  if (id.startsWith('contact:')) {
    const contact = ATLAS_STUDENT_CONTACTS.find((item) => item.id === id.slice(8));
    if (!contact) atlasFail(404, 'Контакт не найден.');
    if(contact.role==='student')return {profile:{id,name:contact.name,initials:contact.name.split(/\s+/).slice(0,2).map(part=>part[0]).join(''),role:'student',tag:'Староста',position:'Староста',description:'Общедоступная карточка участника. Личный кабинет закрыт.'}};
    return { profile:{id,name:contact.name,initials:contact.name.split(/\s+/).map((part)=>part[0]).slice(0,2).join(''),role:contact.role,tag:contact.kind==='leadership'?'Староста':contact.position,faculty:'Студенческие сервисы',group:contact.groupId==='g2'?'ПИ-23-2':contact.groupId==='g1'?'ИД-24-1':null,position:contact.position,description:contact.description} };
  }
  if (id.startsWith('name:')) {
    const name = id.slice(5);
    const rows = (await db.prepare('SELECT DISTINCT l.subject,g.faculty FROM teaching_assignments l JOIN groups g ON g.id=l.group_id WHERE l.teacher_name=? UNION SELECT DISTINCT e.subject,g.faculty FROM schedule_exceptions e JOIN groups g ON g.id=e.group_id WHERE e.teacher_name=? AND e.active=1').bind(name,name).all()).results;
    if (!rows.length) atlasFail(404, 'Преподаватель не найден.');
    return { profile:{id,name,initials:name.split(/\s+/).slice(0,2).map((part)=>part[0]).join(''),role:'teacher',tag:'Преподаватель',faculty:rows[0].faculty,group:null,position:'Преподаватель',description:`Дисциплины: ${rows.map((row)=>row.subject).join(', ')}.`},scheduleTeacherId:id };
  }
  const row = await db.prepare('SELECT u.id,u.name,u.initials,u.role,u.tag,u.faculty,g.name AS group_name FROM users u LEFT JOIN groups g ON g.id=u.group_id WHERE u.id=?').bind(id).first();
  if (!row) atlasFail(404, 'Участник не найден.');
  const canMessage=(await atlasMessageContacts(db,user)).some(p=>p.id===row.id);
  if(row.role==='student')return {profile:{canMessage,id:row.id,name:row.name,initials:row.initials,role:'student',tag:row.tag,position:row.tag||'Студент',description:'Общедоступная карточка участника. Личный кабинет закрыт.'}};
  return { profile:{canMessage,id:row.id,name:row.name,initials:row.initials,role:row.role,tag:row.tag,faculty:row.faculty,group:null,position:row.role==='teacher'?'Преподаватель':row.role==='admin'?'Сотрудник учебного офиса':row.tag,description:row.role==='student'?'Участник учебной группы. Здесь показана только общедоступная карточка.':row.role==='teacher'?'Учебные вопросы и консультации по своим дисциплинам.':'Помощь с учебными и организационными вопросами.'},...(row.role==='teacher'?{scheduleTeacherId:row.id}:{}) };
}

async function atlasScheduleConflict(db, input) {
  const rows = (await db.prepare('SELECT l.*,g.name AS group_name FROM teaching_assignments l JOIN groups g ON g.id=l.group_id WHERE l.weekday=? AND l.start_time<? AND l.end_time>? AND l.id<>?').bind(input.weekday,input.endTime,input.startTime,input.id || '').all()).results;
  const normal = (value) => String(value || '').normalize('NFKC').trim().toLocaleLowerCase('ru-RU');
  const conflict = rows.filter(row=>!row.single_date&&atlasCyclePatternsOverlap(row.week_pattern,input.weekPattern)).find((row) => atlasLessonGroupIds(input).includes(row.group_id) || normal(row.room) === normal(input.room) || normal(row.teacher_name) === normal(input.teacherName));
  if (conflict) atlasFail(409, `Пересечение с занятием «${conflict.subject}», ${conflict.start_time}–${conflict.end_time}, группа ${conflict.group_name}, ${conflict.room}. Проверьте время, группу, преподавателя и аудиторию.`);
}

const ATLAS_SUBJECT_NOTES = {
  'Проектирование интерфейсов':['Исследуйте задачу пользователя: контекст, цель, ограничение и критерий успеха. Разложите путь на шаги, затем нарисуйте структуру экрана и проверьте её на сценарии.','Составьте короткий сценарий, сделайте бумажный прототип из трёх экранов и проверьте, понятно ли следующее действие без подсказки.'],
  'Дизайн-системы':['Дизайн-система объединяет правила, токены и повторяемые компоненты. У компонента должны быть назначение, варианты, состояния, правила размеров и доступное имя.','Опишите кнопку в состояниях по умолчанию, наведение, фокус, загрузка, ошибка и недоступно. Проверьте контраст и использование с клавиатуры.'],
  'Аналитика данных':['Начинайте анализ с вопроса и определения метрики. Проверьте пропуски, единицы измерения, повторяющиеся строки и источники смещения. Среднее не заменяет анализ распределения.','Соберите небольшой вымышленный набор данных, сравните среднее и медиану, выберите диаграмму и напишите один вывод с ограничениями.'],
  'Типографика в интерфейсах':['Иерархия текста строится на размере, насыщенности, интервалах и контрасте. Основной текст должен оставаться читаемым на узком экране; длина строки и межстрочный интервал влияют на комфорт.','Сверстайте заголовок, описание, список и сообщение об ошибке. Проверьте иерархию без цвета и масштаб страницы до 200 процентов.'],
  'Продуктовое мышление':['Продуктовая гипотеза связывает проблему, аудиторию, изменение и измеримый результат. Решение оценивают по пользе, затратам, ограничениям и доказательствам, а не только по числу функций.','Сформулируйте проблему, три гипотезы и простой способ проверить каждую. Выберите минимальный сценарий и метрику его успешного выполнения.'],
  'Алгоритмы и структуры данных':['Оценивайте алгоритм через корректность, время и память. Массив, список, хеш-таблица и дерево решают разные задачи. Проверяйте пустой ввод, повторы и граничные значения.','Реализуйте поиск в небольшом массиве, объясните сложность и придумайте пять граничных примеров. Сравните линейный и двоичный поиск.'],
  'Инженерия интерфейсов':['Интерфейс связывает состояние, события и представление. Явно описывайте загрузку, успех, пустой результат и ошибку. Семантические элементы облегчают доступность и автоматическую проверку.','Соберите форму с подписями, валидацией и обратной связью. Проверьте отправку с клавиатуры, повторную отправку и восстановление после ошибки.'],
  'Базы данных':['Схема описывает сущности, ключи, связи и ограничения. Нормализация уменьшает дублирование. Транзакция сохраняет согласованность связанных изменений; запросы должны использовать параметры.','Нарисуйте таблицы студентов, групп и занятий. Выберите ключи, связи и индексы, затем составьте запрос расписания одной группы.'],
  'Машинное обучение':['Разделяйте обучающую и проверочную выборки до настройки модели. Избегайте утечки целевого признака. Метрика должна соответствовать задаче, а базовая модель задаёт точку сравнения.','Опишите задачу классификации, признаки и целевую переменную. Выберите метрику, способ разбиения и три источника возможной ошибки.'],
};

async function atlasEnsureStudentTools(db) {
  const marker = await db.prepare("SELECT value FROM app_state WHERE key='student_tools_seed_version'").first();
  if (marker) return;
  const rows = (await db.prepare('SELECT group_id,subject,MIN(weekday) AS weekday,MAX(teacher_id) AS teacher_id FROM lessons GROUP BY group_id,subject ORDER BY group_id,subject').all()).results;
  const statements = [];
  const weekStart = atlasWeekStart();
  const now = new Date().toISOString();
  rows.forEach((row,index) => {
    const notes = ATLAS_SUBJECT_NOTES[row.subject] || ['Разберите основные понятия дисциплины, связи между ними и пример практического применения.','Решите учебный пример, объясните выбранный подход и проверьте результат на граничных случаях.'];
    statements.push(db.prepare('INSERT OR IGNORE INTO resources(id,subject,title,type,description,body,group_id,author_id) VALUES(?,?,?,?,?,?,?,?)').bind(`v3-ref-${row.group_id}-${index}-1`,row.subject,'Опорный конспект','Справочник','Основные идеи и порядок самостоятельной работы.',`${notes[0]}\n\nКак работать: прочитайте конспект, выпишите незнакомые термины, разберите пример и сформулируйте вопрос для занятия. Это общий демонстрационный материал, а не официальный учебник.`,row.group_id,row.teacher_id || null));
    statements.push(db.prepare('INSERT OR IGNORE INTO resources(id,subject,title,type,description,body,group_id,author_id) VALUES(?,?,?,?,?,?,?,?)').bind(`v3-ref-${row.group_id}-${index}-2`,row.subject,'Практика и самопроверка','Практикум','Небольшой пример и вопросы для закрепления.',`${notes[1]}\n\nСамопроверка: могу ли я объяснить решение своими словами? Какие исходные условия важны? Где подход перестаёт работать? Зафиксируйте результат и один вопрос преподавателю.`,row.group_id,row.teacher_id || null));
    const date = atlasDateForWeekday(weekStart,Number(row.weekday));
    statements.push(db.prepare('INSERT OR IGNORE INTO homework(id,group_id,subject,lesson_date,due_date,title,body,author_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)').bind(`v3-hw-${row.group_id}-${index}`,row.group_id,row.subject,date,atlasDateAdd(date,2),'Практика после занятия',`${notes[1]} Подготовьте краткий результат и вопросы для обсуждения.`,row.teacher_id || 'a1',now,now));
  });
  statements.push(db.prepare("INSERT OR REPLACE INTO app_state(key,value) VALUES('student_tools_seed_version','3')"));
  statements.push(db.prepare("UPDATE app_state SET value='3' WHERE key='seed_version' AND CAST(value AS INTEGER)<3"));
  await db.batch(statements);
}


const ATLAS_SEED_SQL = `
INSERT OR IGNORE INTO groups VALUES
('g1','ИД-24-1','Факультет цифровых технологий','Интерактивный дизайн',2,'Команда будущих дизайнеров цифровых сервисов.'),
('g2','ПИ-23-2','Факультет цифровых технологий','Программная инженерия',3,'Разработка и исследование цифровых продуктов.');
INSERT OR IGNORE INTO users(id,login,password_hash,password_salt,password_iterations,role,name,initials,faculty,direction,course,group_id,tag,accent) VALUES
('u1','student.1','83ac01a806e790c05091047ef7759244b1ce25d187cdad453a2987af8b93a6dc','ac311e3026007b848268eb00174b9ccb',100000,'student','Майя Орлова','МО','Факультет цифровых технологий','Интерактивный дизайн',2,'g1','Староста','violet'),
('u2','student.2','0508653693499fecaeb84b34750c6bccf0e8b3d638b2837d2df72d6110458871','47cbaf3639919c0946c336ab17b4d9d7',100000,'student','Никита Каримов','НК','Факультет цифровых технологий','Программная инженерия',3,'g2','Студент','cyan'),
('t1','teacher','2aba28fd596e9112f1a24b6ea30faf388bd6aa8095d4b1e734b447d609446bc1','0768966cb5523f1fbcc20e6d437c337f',100000,'teacher','Елена Белова','ЕБ','Факультет цифровых технологий','Проектирование интерфейсов',NULL,NULL,'Преподаватель','amber'),
('a1','admin','b7e160345cccc82bf8787d3ef50ad107d3ccd7607d30d44da93f559ec11a8492','b6b2455ee2b6746c37b2cdf44c20cd1c',100000,'admin','Мария Петрова','МП','Учебный офис','Деканат',NULL,NULL,'Администратор','rose');
INSERT OR IGNORE INTO lessons(id,group_id,weekday,start_time,end_time,subject,type,room,teacher_id,teacher_name,changed,change_note) VALUES
('l1','g1',1,'09:00','10:30','Проектирование интерфейсов','Практика','Корпус А · 304','t1','Елена Белова',0,''),
('l2','g1',1,'10:45','12:15','Аналитика данных','Лекция','Корпус Б · 201',NULL,'Ирина Соколова',0,''),
('l3','g1',2,'09:00','10:30','Дизайн-системы','Практика','Корпус А · 305','t1','Елена Белова',1,'Аудитория изменена: занятие в 305 вместо 302'),
('l4','g1',2,'10:45','12:15','Типографика в интерфейсах','Семинар','Корпус А · 307',NULL,'Олег Миронов',0,''),
('l5','g1',3,'12:30','14:00','Продуктовое мышление','Лекция','Корпус В · 101',NULL,'Анна Романова',0,''),
('l6','g1',4,'09:00','10:30','Проектирование интерфейсов','Лекция','Корпус А · 112','t1','Елена Белова',0,''),
('l7','g1',5,'10:45','12:15','Аналитика данных','Практика','Корпус Б · 205',NULL,'Ирина Соколова',0,''),
('l8','g2',1,'10:45','12:15','Алгоритмы и структуры данных','Лекция','Корпус Б · 402',NULL,'Дмитрий Волков',0,''),
('l9','g2',1,'12:30','14:00','Инженерия интерфейсов','Практика','Корпус А · 305','t1','Елена Белова',0,''),
('l10','g2',2,'10:45','12:15','Базы данных','Практика','Корпус Б · 208',NULL,'Павел Орлов',1,'Начало перенесено на 10:45'),
('l11','g2',3,'09:00','10:30','Инженерия интерфейсов','Лекция','Корпус А · 112','t1','Елена Белова',0,''),
('l12','g2',3,'10:45','12:15','Машинное обучение','Лекция','Корпус В · 210',NULL,'София Руденко',0,''),
('l13','g2',4,'12:30','14:00','Алгоритмы и структуры данных','Практика','Корпус Б · 402',NULL,'Дмитрий Волков',0,''),
('l14','g2',5,'09:00','10:30','Базы данных','Лекция','Корпус Б · 208',NULL,'Павел Орлов',0,'');
INSERT OR IGNORE INTO grades VALUES
('gr1','u1','Проектирование интерфейсов','t1',5,'grade','Модульный проект','2026-10-29',11,12),
('gr2','u1','Дизайн-системы','t1',5,'credit','Зачтено','2026-11-03',9,10),
('gr3','u1','Аналитика данных',NULL,4,'grade','Контрольная работа','2026-10-22',8,10),
('gr4','u1','Типографика в интерфейсах',NULL,5,'grade','Практическая работа','2026-10-31',7,8),
('gr5','u1','Продуктовое мышление',NULL,4,'grade','Групповой кейс','2026-11-04',8,9),
('gr6','u2','Алгоритмы и структуры данных',NULL,4,'grade','Контрольная работа','2026-10-28',11,13),
('gr7','u2','Инженерия интерфейсов','t1',5,'grade','Курсовой модуль','2026-11-02',10,12),
('gr8','u2','Базы данных',NULL,4,'credit','Зачтено','2026-11-01',8,11),
('gr9','u2','Машинное обучение',NULL,4,'grade','Лабораторная работа','2026-11-05',7,10);
INSERT OR IGNORE INTO exams VALUES
('ex1','u1','Проектирование интерфейсов','Экзамен','2026-12-15','Корпус А · 304','Запланирован'),
('ex2','u1','Аналитика данных','Зачёт','2026-12-10','Корпус Б · 201','Запланирован'),
('ex3','u2','Алгоритмы и структуры данных','Экзамен','2026-12-17','Корпус Б · 402','Запланирован'),
('ex4','u2','Базы данных','Зачёт','2026-12-11','Корпус Б · 208','Запланирован');
INSERT OR IGNORE INTO requests VALUES
('r1','u1','Справка об обучении','Для оформления транспортной карты','in_review','2026-11-04T10:20:00Z','2026-11-05T08:45:00Z','Заявка принята учебным офисом.'),
('r2','u2','Справка об обучении','Для оформления льготы','ready','2026-11-03T11:15:00Z','2026-11-06T09:30:00Z','Справка готова. Заберите в учебном офисе.');
INSERT OR IGNORE INTO news(id,author_id,scope,group_id,title,body,created_at,pinned,deadline) VALUES
('n1','a1','all',NULL,'Неделя проектов уже близко','С 16 ноября открывается запись на консультации по итоговым проектам. Выберите удобный слот в учебном офисе.','2026-11-06T09:00:00Z',1,'2026-11-16'),
('n2','t1','group','g1','Практика по дизайн-системам','Ко вторнику подготовьте компонент с тремя состояниями. Материалы есть в разделе «Библиотека».','2026-11-05T14:30:00Z',0,'2026-11-17'),
('n3','t1','group','g2','Разбор курсовых проектов','На следующей практике разберём прототипы интерфейсов. Возьмите с собой текущую версию проекта.','2026-11-05T12:00:00Z',0,'2026-11-18'),
('n4','a1','all',NULL,'Окно заявок на справки','Заявки на справки можно отправлять прямо в цифровом кабинете. Статус обновляется без звонка в деканат.','2026-11-02T08:00:00Z',0,NULL);
INSERT OR IGNORE INTO clubs(id,name,description,color,priority) VALUES
('club1','Медиацентр','Фото, видео и истории студенческой жизни.','pink','Публикации и съёмки'),
('club2','Кураторы первокурсников','Помогаем новым студентам освоиться в кампусе.','mint','Поддержка студентов');
INSERT OR IGNORE INTO club_members VALUES
('club1','u1','Координатор'),('club1','u2','Участник'),('club2','u1','Наставник');
INSERT OR IGNORE INTO chats VALUES
('c1','ИД-24-1','group','g1',NULL,'Группа','Общий чат группы'),
('c2','ПИ-23-2','group','g2',NULL,'Группа','Общий чат группы'),
('c3','Медиацентр','club',NULL,'club1','Клубы','Проекты медиацентра'),
('c4','Связь с преподавателем','direct',NULL,NULL,'Учёба','Диалог со старостой');
INSERT OR IGNORE INTO chat_members VALUES
('c1','u1','starosta'),
('c2','u2','member'),
('c3','u1','coordinator'),('c3','u2','member'),
('c4','u1','member'),('c4','t1','member');
INSERT OR IGNORE INTO messages VALUES
('m1','c1','u1','Всем привет! Я добавила расписание консультаций в материалы группы.','2026-11-06T11:05:00Z'),
('m2','c1','t1','Спасибо, Майя. Завтра отвечу на вопросы по проекту.','2026-11-06T11:18:00Z'),
('m3','c2','u2','Кто идёт на открытую лекцию в пятницу?','2026-11-06T12:20:00Z'),
('m4','c3','u1','В четверг снимаем короткий ролик о неделе проектов.','2026-11-06T13:10:00Z'),
('m5','c4','t1','Майя, пожалуйста, передайте группе информацию о переносе аудитории.','2026-11-06T14:02:00Z');
INSERT OR IGNORE INTO resources(id,subject,title,type,description,body,group_id,author_id) VALUES
('res1','Проектирование интерфейсов','Как провести UX-исследование','Конспект','Короткий план исследования перед запуском проекта.','Определите задачу и аудиторию. Сформулируйте гипотезу, подготовьте вопросы без подсказок, проведите пять интервью и зафиксируйте повторяющиеся темы.','g1','t1'),
('res2','Дизайн-системы','Компонент и состояния','Практикум','Памятка по вариантам интерфейсного элемента.','Опишите назначение компонента. Покажите состояния по умолчанию, при наведении, в фокусе и при ошибке. Проверьте контраст и управление с клавиатуры.','g1','t1'),
('res3','Аналитика данных','Основы визуализации','Конспект','Как выбирать график под вопрос.','Сначала сформулируйте вопрос к данным. Для сравнения категорий используйте столбцы, для изменения во времени — линию. Подписывайте оси и источник.','g1',NULL),
('res4','Инженерия интерфейсов','Доступность веб-интерфейсов','Практикум','Список проверок для курсового проекта.','Проверьте навигацию с клавиатуры, видимый фокус, контраст, подписи форм и адаптацию на экране шириной 360 пикселей.','g2','t1'),
('res5','Базы данных','Нормализация схемы','Конспект','Краткое введение в связи и ключи.','У каждой таблицы должен быть первичный ключ. Выделите независимые сущности, задайте связи внешними ключами и проверьте ограничения целостности.','g2',NULL);
INSERT OR REPLACE INTO app_state (key,value) VALUES ('seed_version','2');
`;

// Password-hash compatibility upgrade for the four public demo accounts only.
// Cloudflare Workers supports at most 100,000 PBKDF2 iterations.
const ATLAS_DEMO_PASSWORD_UPGRADE = [
  {
    "id": "u1",
    "login": "student.1",
    "salt": "ac311e3026007b848268eb00174b9ccb",
    "hash": "83ac01a806e790c05091047ef7759244b1ce25d187cdad453a2987af8b93a6dc"
  },
  {
    "id": "u2",
    "login": "student.2",
    "salt": "47cbaf3639919c0946c336ab17b4d9d7",
    "hash": "0508653693499fecaeb84b34750c6bccf0e8b3d638b2837d2df72d6110458871"
  },
  {
    "id": "t1",
    "login": "teacher",
    "salt": "0768966cb5523f1fbcc20e6d437c337f",
    "hash": "2aba28fd596e9112f1a24b6ea30faf388bd6aa8095d4b1e734b447d609446bc1"
  },
  {
    "id": "a1",
    "login": "admin",
    "salt": "b6b2455ee2b6746c37b2cdf44c20cd1c",
    "hash": "b7e160345cccc82bf8787d3ef50ad107d3ccd7607d30d44da93f559ec11a8492"
  }
];

async function atlasEnsureSeed(db) {
  const marker = await db.prepare("SELECT value FROM app_state WHERE key='seed_version'").first();
  if (marker?.value === '1') {
    const updates = ATLAS_DEMO_PASSWORD_UPGRADE.map((account) => db.prepare(
      'UPDATE users SET password_hash=?, password_iterations=? WHERE id=? AND login=? AND password_salt=?'
    ).bind(account.hash, 100000, account.id, account.login, account.salt));
    updates.push(db.prepare("UPDATE app_state SET value='2' WHERE key='seed_version'"));
    await db.batch(updates);
    return;
  }
  // Do not downgrade a database initialized by a future version.
  if (marker) return;
  const statements = ATLAS_SEED_SQL.split(';').map((part) => part.trim()).filter(Boolean);
  await db.batch(statements.map((sql) => db.prepare(sql)));
}

const ATLAS_CLUB_PUBLISH_ROLES = ['Организатор','Куратор','Редактор','Координатор','Наставник'];
async function atlasClubCanPublish(db,user,clubId) {
  if (user.role==='admin') return true;
  const row=await db.prepare('SELECT role FROM club_members WHERE club_id=? AND user_id=?').bind(clubId,user.id).first();
  return Boolean(row && ATLAS_CLUB_PUBLISH_ROLES.includes(row.role));
}
async function atlasClubs(db,user) {
  const rows=(await db.prepare(`SELECT c.*,cm.role AS member_role,
    (SELECT COUNT(*) FROM club_members m WHERE m.club_id=c.id) AS member_count,
    (SELECT COUNT(*) FROM club_posts p WHERE p.club_id=c.id AND p.archived=0) AS post_count,
    (SELECT ch.id FROM chats ch JOIN chat_members m ON m.chat_id=ch.id WHERE ch.club_id=c.id AND m.user_id=? ORDER BY ch.id LIMIT 1) AS chat_id
    FROM clubs c LEFT JOIN club_members cm ON cm.club_id=c.id AND cm.user_id=? ORDER BY c.name`).bind(user.id,user.id).all()).results;
  return rows.map(row=>({id:row.id,name:row.name,description:row.description,color:row.color,priority:row.priority,
    about:row.about,meetingPlace:row.meeting_place,schedule:row.schedule,isMember:Boolean(row.member_role),
    memberRole:row.member_role || null,role:row.member_role || null,memberCount:row.member_count,postCount:row.post_count,
    canPublish:user.role==='admin' || ATLAS_CLUB_PUBLISH_ROLES.includes(row.member_role),chatId:row.chat_id || null}));
}
async function atlasClubPost(db,id) {
  const row=await db.prepare('SELECT p.*,u.name AS author,u.role AS author_role FROM club_posts p JOIN users u ON u.id=p.author_id WHERE p.id=?').bind(id).first();
  if (!row) atlasFail(404,'Публикация не найдена.');
  return {id:row.id,clubId:row.club_id,title:row.title,body:row.body,authorId:row.author_id,author:row.author,authorRole:row.author_role,createdAt:row.created_at,attachments:await atlasAttachments(db,'club_post_id',id)};
}
async function atlasClubDetail(db,user,id) {
  const club=(await atlasClubs(db,user)).find(item=>item.id===id);
  if (!club) atlasFail(404,'Клуб не найден.');
  const rows=(await db.prepare('SELECT id FROM club_posts WHERE club_id=? AND archived=0 ORDER BY created_at DESC,id DESC LIMIT 100').bind(id).all()).results;
  return {club,posts:await Promise.all(rows.map(row=>atlasClubPost(db,row.id)))};
}
function atlasFile(row) {
  return {id:row.id,name:row.name,mime:row.mime,size:row.size,kind:row.kind,url:'/api/files/'+encodeURIComponent(row.id)};
}
async function atlasAttachments(db,field,id) {
  if (!['news_id','club_post_id'].includes(field)) throw new Error('Invalid attachment association');
  const rows=(await db.prepare(`SELECT id,name,mime,size,kind FROM uploads WHERE ${field}=? ORDER BY created_at,id`).bind(id).all()).results;
  return rows.map(atlasFile);
}
async function atlasAttachmentRows(db,user,ids) {
  if (ids===undefined) return [];
  if (!Array.isArray(ids) || ids.length>4 || new Set(ids).size!==ids.length) atlasFail(400,'Прикрепите не больше четырёх разных файлов.');
  const rows=[];
  for (const value of ids) {
    const id=atlasString(value,'Вложение',80);
    const row=await db.prepare('SELECT * FROM uploads WHERE id=?').bind(id).first();
    if (!row || row.owner_id!==user.id || row.news_id || row.club_post_id) atlasFail(403,'Вложение недоступно или уже опубликовано.');
    rows.push(row);
  }
  if (rows.reduce((sum,row)=>sum+row.size,0)>12*1024*1024) atlasFail(400,'Общий размер вложений должен быть не больше 12 МБ.');
  return rows;
}
async function atlasMayUpload(db,user) {
  if (['teacher','admin'].includes(user.role)) return true;
  const rows=(await db.prepare('SELECT role FROM club_members WHERE user_id=?').bind(user.id).all()).results;
  return rows.some(row=>ATLAS_CLUB_PUBLISH_ROLES.includes(row.role));
}
async function atlasReadMultipart(request) {
  const contentType=request.headers.get('content-type') || '';
  if (!/^multipart\/form-data\s*;/i.test(contentType)) atlasFail(415,'Выберите файл для загрузки.');
  const limit=6*1024*1024;
  if (Number(request.headers.get('content-length') || 0)>limit) atlasFail(413,'Файл должен быть не больше 5 МБ.');
  const reader=request.body?.getReader();
  if (!reader) atlasFail(400,'Не удалось прочитать файл.');
  const chunks=[];let size=0;
  while (true) {
    const {value,done}=await reader.read();if(done)break;
    size+=value.length;
    if(size>limit){await reader.cancel();atlasFail(413,'Файл должен быть не больше 5 МБ.');}
    chunks.push(value);
  }
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  try {return await new Response(bytes,{headers:{'content-type':contentType}}).formData();}
  catch {atlasFail(400,'Некорректная загрузка файла.');}
}
function atlasUploadType(name,bytes,claimedMime) {
  const ext=name.split('.').pop().toLowerCase();
  const head=Array.from(bytes.slice(0,16));
  const types={png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',pdf:'application/pdf',txt:'text/plain',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',pptx:'application/vnd.openxmlformats-officedocument.presentationml.presentation'};
  const mime=types[ext];
  if (!mime) atlasFail(415,'Поддерживаются PNG, JPEG, WebP, PDF, TXT, DOCX, XLSX и PPTX.');
  const claimed=(claimedMime || '').toLowerCase().split(';')[0];
  if (claimed && !['application/octet-stream','application/zip',mime].includes(claimed)) atlasFail(415,'Тип файла не совпадает с расширением.');
  let valid=false;
  if(ext==='png')valid=head.slice(0,8).join(',')==='137,80,78,71,13,10,26,10';
  else if(['jpg','jpeg'].includes(ext))valid=head[0]===255&&head[1]===216&&head[2]===255;
  else if(ext==='webp')valid=String.fromCharCode(...head.slice(0,4))==='RIFF'&&String.fromCharCode(...head.slice(8,12))==='WEBP';
  else if(ext==='pdf')valid=String.fromCharCode(...head.slice(0,5))==='%PDF-';
  else if(ext==='txt'){
    try {const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);valid=!text.includes('\u0000');}catch {valid=false;}
  }else valid=head[0]===80&&head[1]===75&&head[2]===3&&head[3]===4;
  if(!valid)atlasFail(415,'Содержимое файла не соответствует его формату.');
  return {mime,kind:mime.startsWith('image/')?'image':'file'};
}
async function atlasExpireDrafts(env,db,user) {
  const cutoff=new Date(Date.now()-24*60*60*1000).toISOString();
  const rows=(await db.prepare('SELECT id,storage_key FROM uploads WHERE owner_id=? AND news_id IS NULL AND club_post_id IS NULL AND created_at<? ORDER BY created_at LIMIT 20').bind(user.id,cutoff).all()).results;
  for(const row of rows){
    // The condition is checked again at deletion time: a published attachment
    // must never be removed when a stale draft races with publication.
    const result=await db.prepare('DELETE FROM uploads WHERE id=? AND owner_id=? AND news_id IS NULL AND club_post_id IS NULL AND created_at<?').bind(row.id,user.id,cutoff).run();
    if(result.meta?.changes)await env.BUCKET.delete(row.storage_key);
  }
}
async function atlasUpload(request,env,db,user) {
  if (!(await atlasMayUpload(db,user))) atlasFail(403,'Вложения доступны авторам объявлений и редакторам клубов.');
  if (!env.BUCKET) atlasFail(503,'Хранилище файлов временно недоступно.');
  await atlasExpireDrafts(env,db,user);
  const pending=await db.prepare('SELECT COUNT(*) AS count FROM uploads WHERE owner_id=? AND news_id IS NULL AND club_post_id IS NULL').bind(user.id).first();
  if (pending.count>=20) atlasFail(409,'Слишком много неопубликованных файлов. Удалите лишние вложения из черновиков.');
  const form=await atlasReadMultipart(request),entries=form.getAll('file');
  if(entries.length!==1 || typeof entries[0]==='string')atlasFail(400,'Загружайте по одному файлу.');
  const file=entries[0];
  if(!file.size || file.size>5*1024*1024)atlasFail(413,'Файл должен быть от 1 байта до 5 МБ.');
  const name=atlasString(file.name,'Имя файла',160);
  if(/[\x00-\x1f\x7f\\/<>]/.test(name))atlasFail(400,'Некорректное имя файла.');
  const bytes=new Uint8Array(await file.arrayBuffer()),{mime,kind}=atlasUploadType(name,bytes,file.type);
  const id=crypto.randomUUID(),key='uploads/'+id,now=new Date().toISOString();
  await env.BUCKET.put(key,bytes,{httpMetadata:{contentType:mime}});
  try {await db.prepare('INSERT INTO uploads(id,owner_id,storage_key,name,mime,size,kind,created_at) VALUES(?,?,?,?,?,?,?,?)').bind(id,user.id,key,name,mime,file.size,kind,now).run();}
  catch(error){await env.BUCKET.delete(key);throw error;}
  return atlasFile({id,name,mime,size:file.size,kind});
}
async function atlasCanReadNews(db,user,id) {
  const row=await db.prepare('SELECT author_id,scope,group_id FROM news WHERE id=?').bind(id).first();
  if(!row)return false;
  if(user.role==='admin' || row.scope==='all')return true;
  if(user.role==='student')return row.group_id===user.group_id;
  if(row.author_id===user.id)return true;
  return Boolean(await db.prepare('SELECT id FROM teaching_assignments WHERE teacher_id=? AND group_id=? LIMIT 1').bind(user.id,row.group_id).first());
}
async function atlasReadFile(env,db,user,id,headOnly=false) {
  const row=await db.prepare('SELECT * FROM uploads WHERE id=?').bind(id).first();
  if(!row)atlasFail(404,'Файл не найден.');
  if(typeof atlasManagementCanReadAttachment==='function'&&!(await atlasManagementCanReadAttachment(db,user,row)))atlasFail(403,'Вложение находится в архиве публикации.');
  const readable=row.news_id ? await atlasCanReadNews(db,user,row.news_id) : row.club_post_id ? Boolean(await db.prepare('SELECT id FROM club_posts WHERE id=?').bind(row.club_post_id).first()) : row.owner_id===user.id;
  if(!readable)atlasFail(403,'Файл недоступен.');
  if(!env.BUCKET)atlasFail(503,'Хранилище файлов временно недоступно.');
  const object=await env.BUCKET.get(row.storage_key);
  if(!object)atlasFail(404,'Файл не найден в хранилище.');
  const fallback=row.name.replace(/[^a-zA-Z0-9._-]/g,'_');
  const disposition=`${row.kind==='image'?'inline':'attachment'}; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(row.name)}`;
  return new Response(headOnly?null:object.body,{headers:{'Content-Type':row.mime,'Content-Length':String(row.size),'Content-Disposition':disposition,'X-Content-Type-Options':'nosniff','Cache-Control':'private, no-store'}});
}
async function atlasPatchSelf(db,user,body) {
  const allowed=['name','bio','contactEmail','phone'];
  if(Object.keys(body).some(key=>!allowed.includes(key)))atlasFail(403,'Роль, учебная группа и данные об обучении меняются только учебным офисом.');
  const name=atlasString(body.name ?? user.name,'Имя',120);
  const bio=atlasString(body.bio ?? user.bio ?? '','О себе',600,0);
  const email=atlasString(body.contactEmail ?? user.contact_email ?? '','Контактная почта',160,0);
  if(email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))atlasFail(400,'Проверьте адрес электронной почты.');
  const phone=atlasString(body.phone ?? user.phone ?? '','Телефон',40,0);
  if(phone && !/^[+\d\s().-]{3,40}$/.test(phone))atlasFail(400,'Проверьте номер телефона.');
  const initials=name.split(/\s+/).slice(0,2).map(word=>word[0]).join('').toLocaleUpperCase('ru-RU');
  const statements=[db.prepare('UPDATE users SET name=?,initials=?,bio=?,contact_email=?,phone=? WHERE id=?').bind(name,initials,bio,email,phone,user.id)];
  if(user.role==='teacher'){statements.push(db.prepare('UPDATE lessons SET teacher_name=? WHERE teacher_id=?').bind(name,user.id));statements.push(db.prepare('UPDATE schedule_exceptions SET teacher_name=? WHERE teacher_id=?').bind(name,user.id));}
  await db.batch(statements);
  return atlasSafeUser({...user,name,initials,bio,contact_email:email,phone});
}
async function atlasEnsureCommunity(db) {
  const marker=await db.prepare("SELECT value FROM app_state WHERE key='community_seed_version'").first();
  if(marker)return;
  const now=new Date().toISOString();
  const statements=[
    db.prepare("UPDATE resources SET kind='teacher',created_at=? WHERE author_id IN (SELECT id FROM users WHERE role='teacher') AND id NOT LIKE 'v3-ref-%'").bind(now),
    db.prepare("UPDATE resources SET author_id=NULL,kind='general',created_at=? WHERE id LIKE 'v3-ref-%'").bind(now),
    db.prepare("UPDATE resources SET created_at=? WHERE created_at=''").bind(now),
    db.prepare("UPDATE clubs SET about=?,meeting_place=?,schedule=? WHERE id='club1' AND about=''").bind('Медиацентр рассказывает о жизни университета: создаём фотоистории, интервью, афиши и короткие видео. На встречах распределяем задачи и учимся работать с визуальным материалом.','Студенческий центр · медиастудия 204','Четверг, 17:00–18:30'),
    db.prepare("UPDATE clubs SET about=?,meeting_place=?,schedule=? WHERE id='club2' AND about=''").bind('Наставники помогают первокурсникам разобраться в учебных сервисах и найти своё сообщество. Обсуждаем адаптацию, готовим встречи групп и делимся проверенными маршрутами помощи.','Студенческий центр · зал встреч','Вторник, 16:30–17:30'),
    db.prepare('INSERT OR IGNORE INTO clubs(id,name,description,color,priority,about,meeting_place,schedule) VALUES(?,?,?,?,?,?,?,?)').bind('club3','Дизайн-лаборатория','Проверяем идеи и собираем полезные цифровые продукты.','violet','Исследования и прототипы','Открытая мастерская для тех, кому интересны интерфейсы, исследования и доступность. Разбираем реальные учебные задачи и проводим взаимные просмотры проектов.','Корпус А · проектная 310','Среда, 17:00–18:30'),
    db.prepare('INSERT OR IGNORE INTO clubs(id,name,description,color,priority,about,meeting_place,schedule) VALUES(?,?,?,?,?,?,?,?)').bind('club4','Клуб активного отдыха','Командные игры, прогулки и движение после учёбы.','mint','Спорт и общение','Вместе планируем небольшие походы, любительские турниры и активные выходные. Участники сами предлагают маршруты и помогают новичкам освоиться.','Спортивный корпус · холл','Пятница, 17:30–19:00'),
    db.prepare('INSERT OR IGNORE INTO club_members(club_id,user_id,role) VALUES(?,?,?)').bind('club3','t1','Куратор'),
    db.prepare('INSERT OR IGNORE INTO club_posts(id,club_id,author_id,title,body,created_at) VALUES(?,?,?,?,?,?)').bind('club-post-media-welcome','club1','u1','Знакомимся с медиацентром','На этой неделе собираем идеи для фотоистории о кампусе. Приносите наблюдения и короткие сюжеты — обсудим их на встрече в четверг.',now),
    db.prepare('INSERT OR IGNORE INTO club_posts(id,club_id,author_id,title,body,created_at) VALUES(?,?,?,?,?,?)').bind('club-post-curators-welcome','club2','u1','Встреча команды наставников','Собираем частые вопросы первокурсников и готовим понятную памятку по учебным сервисам. Вопросы участников можно обсудить в чате клуба.',now),
    db.prepare('INSERT OR IGNORE INTO club_posts(id,club_id,author_id,title,body,created_at) VALUES(?,?,?,?,?,?)').bind('club-post-design-welcome','club3','t1','Открытый просмотр прототипов','Разберём навигацию и состояния интерфейса на примерах студенческих проектов. Для знакомства с лабораторией достаточно интереса и одного вопроса.',now),
    db.prepare('INSERT OR IGNORE INTO club_posts(id,club_id,author_id,title,body,created_at) VALUES(?,?,?,?,?,?)').bind('club-post-sport-welcome','club4','a1','Знакомство с клубом','Планируем прогулку по кампусу и дружеский турнир. Место и время встречи указаны в информации о клубе. Это демонстрационная программа сообщества.',now),
  ];
  await db.batch(statements);
  const clubs=(await db.prepare('SELECT id,name,description FROM clubs').all()).results;
  const chatStatements=[];
  for(const club of clubs){
    const existing=await db.prepare('SELECT id FROM chats WHERE club_id=? ORDER BY id LIMIT 1').bind(club.id).first();
    const chatId=existing?.id || 'club-chat-'+club.id;
    if(!existing)chatStatements.push(db.prepare('INSERT OR IGNORE INTO chats(id,title,kind,group_id,club_id,folder,description) VALUES(?,?,?,?,?,?,?)').bind(chatId,club.name,'club',null,club.id,'Клубы',club.description));
    const members=(await db.prepare('SELECT user_id,role FROM club_members WHERE club_id=?').bind(club.id).all()).results;
    for(const member of members)chatStatements.push(db.prepare('INSERT OR IGNORE INTO chat_members(chat_id,user_id,role) VALUES(?,?,?)').bind(chatId,member.user_id,ATLAS_CLUB_PUBLISH_ROLES.includes(member.role)?'editor':'member'));
  }
  chatStatements.push(db.prepare("INSERT OR REPLACE INTO app_state(key,value) VALUES('community_seed_version','7')"));
  await db.batch(chatStatements);
}

// Cache schema/seed readiness only. Never cache users, sessions or permissions here.
const atlasReadyDatabases = new WeakMap();
async function atlasEnsureReady(db) {
  if (!atlasReadyDatabases.has(db)) {
    const ready=(async()=>{await atlasEnsureSeed(db);await atlasEnsureStudentTools(db);await atlasEnsureCommunity(db);await campusEnsure(db);})();
    atlasReadyDatabases.set(db,ready);
    ready.catch(()=>atlasReadyDatabases.delete(db));
  }
  await atlasReadyDatabases.get(db);
}
async function handleApi(request, env) {
  try {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method.toUpperCase();
    const db = env.DB;
    if (!db) atlasFail(503, 'Хранилище данных временно недоступно.');
    await atlasEnsureReady(db);
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) atlasCheckOrigin(request);

    if (method === 'POST' && path === '/api/login') {
      const body = await atlasBody(request);
      const login = atlasString(body.login, 'Логин', 80).toLowerCase();
      const password = atlasString(body.password, 'Пароль', 200);
      const row = await db.prepare(`SELECT u.*,g.name AS group_name FROM users u LEFT JOIN groups g ON g.id=u.group_id WHERE u.login=?`).bind(login).first();
      if (!row || !(await atlasVerifyPassword(password, row))) atlasFail(401, 'Неверный логин или пароль.');
      const token = atlasHex(crypto.getRandomValues(new Uint8Array(32)));
      const now = Date.now();
      await db.prepare('INSERT INTO sessions (token_hash,user_id,created_at,expires_at) VALUES (?,?,?,?)')
        .bind(await atlasSha256(token), row.id, now, now + 7 * 24 * 60 * 60 * 1000).run();
      return atlasJson({ user: atlasSafeUser(row) }, 200, { 'Set-Cookie': atlasCookie(request, token, 604800) });
    }

    const user = await atlasGetUser(request, db);
    if (!user) atlasFail(401, 'Войдите в аккаунт.');

    if (method === 'POST' && path === '/api/logout') {
      const token = atlasSessionToken(request);
      if (token) await db.prepare('DELETE FROM sessions WHERE token_hash=?').bind(await atlasSha256(token)).run();
      return atlasJson({ ok: true }, 200, { 'Set-Cookie': atlasCookie(request, '', 0) });
    }
    for(const handler of [handleCyclesApi,handleMessagingApi,handleCampusApi,typeof handleCalendarApi==='function'?handleCalendarApi:null,typeof handleActivityApi==='function'?handleActivityApi:null,typeof handleManagementApi==='function'?handleManagementApi:null]){if(handler){const response=await handler(request,env,db,user,url);if(response)return response;}}
    if (method === 'GET' && path === '/api/me') return atlasJson({ user: atlasSafeUser(user) });
    if (method === 'PATCH' && path === '/api/me') return atlasJson({user:await atlasPatchSelf(db,user,await atlasBody(request))});
    if (method === 'POST' && path === '/api/resources') return atlasJson({resource:await atlasPublishResource(db,user,await atlasBody(request))},201);
    if (method === 'GET' && path === '/api/clubs') return atlasJson({clubs:await atlasClubs(db,user)});
    if (method === 'GET' && /^\/api\/clubs\/[^/]+$/.test(path)) return atlasJson(await atlasClubDetail(db,user,decodeURIComponent(path.split('/')[3])));
    if (method === 'POST' && /^\/api\/clubs\/[^/]+\/posts$/.test(path)) {
      const clubId=decodeURIComponent(path.split('/')[3]);
      if(!(await db.prepare('SELECT id FROM clubs WHERE id=?').bind(clubId).first()))atlasFail(404,'Клуб не найден.');
      if(!(await atlasClubCanPublish(db,user,clubId)))atlasFail(403,'Публикации доступны редакторам этого клуба и администрации.');
      const body=await atlasBody(request),title=atlasString(body.title,'Заголовок',140),content=atlasString(body.body,'Текст',4000);
      const attachments=await atlasAttachmentRows(db,user,body.attachmentIds),id=crypto.randomUUID(),now=new Date().toISOString();
      await db.batch([db.prepare('INSERT INTO club_posts(id,club_id,author_id,title,body,created_at) VALUES(?,?,?,?,?,?)').bind(id,clubId,user.id,title,content,now),...attachments.map(file=>db.prepare('UPDATE uploads SET club_post_id=? WHERE id=? AND owner_id=? AND news_id IS NULL AND club_post_id IS NULL').bind(id,file.id,user.id))]);
      return atlasJson({post:await atlasClubPost(db,id)},201);
    }
    if (method === 'POST' && path === '/api/uploads') return atlasJson({file:await atlasUpload(request,env,db,user)},201);
    if (['GET','HEAD'].includes(method) && /^\/api\/files\/[^/]+$/.test(path)) return await atlasReadFile(env,db,user,decodeURIComponent(path.split('/')[3]),method==='HEAD');
    if (method === 'DELETE' && /^\/api\/uploads\/[^/]+$/.test(path)) {
      const id=decodeURIComponent(path.split('/')[3]);
      const row=await db.prepare('SELECT * FROM uploads WHERE id=?').bind(id).first();
      if(!row)atlasFail(404,'Вложение не найдено.');
      if(row.owner_id!==user.id)atlasFail(403,'Вложение недоступно.');
      if(row.news_id || row.club_post_id)atlasFail(409,'Опубликованные вложения нельзя удалить из черновика.');
      if(!env.BUCKET)atlasFail(503,'Хранилище файлов временно недоступно.');
      const removed=await db.prepare('DELETE FROM uploads WHERE id=? AND owner_id=? AND news_id IS NULL AND club_post_id IS NULL').bind(id,user.id).run();
      if(!removed.meta?.changes)atlasFail(409,'Вложение уже опубликовано.');
      await env.BUCKET.delete(row.storage_key);
      return atlasJson({ok:true,id});
    }

    if (method === 'GET' && path === '/api/dashboard') return atlasJson(await atlasDashboard(db, user, request));
    if (method === 'GET' && path === '/api/schedule') {
      if(typeof atlasCalendarSchedule==='function')return atlasJson(await atlasCalendarSchedule(db,user,url));
      const offset = Number(url.searchParams.get('week') || 0);
      if (!Number.isInteger(offset) || offset < -52 || offset > 52) atlasFail(400, 'Неделя недоступна.');
      const weekStart = atlasWeekStart(offset);
      const lessons = (await atlasLessons(db, user, url)).map((lesson) => ({ ...lesson, date: atlasDateForWeekday(weekStart, lesson.weekday) }));
      const teachers = await atlasTeachers(db);
      return atlasJson({ lessons, teachers, group: user.group_name || null, weekStart: weekStart.toISOString().slice(0, 10), weekOffset: offset });
    }
    if (method === 'GET' && path === '/api/grades') return atlasJson(await atlasGrades(db, user));
    if (method === 'GET' && path === '/api/requests') return atlasJson({ requests: await atlasRequests(db, user) });
    if (method === 'GET' && /^\/api\/requests\/[^/]+$/.test(path)) {
      const id = decodeURIComponent(path.slice('/api/requests/'.length));
      const row = await db.prepare('SELECT r.*,u.name AS student_name FROM requests r JOIN users u ON u.id=r.user_id WHERE r.id=?').bind(id).first();
      if (!row) atlasFail(404, 'Заявка не найдена.');
      if (user.role !== 'admin' && row.user_id !== user.id) atlasFail(403, 'Заявка недоступна.');
      return atlasJson({ request: atlasRequest(row) });
    }
    if (method === 'GET' && path === '/api/news') return atlasJson({ news: await atlasNewsList(db, user) });
    if (method === 'GET' && path === '/api/chats') return atlasJson({ chats: await atlasChats(db, user), folders: await atlasChatFolders(db, user) });
    if (method === 'GET' && path === '/api/resources') return atlasJson(await atlasResources(db, user));
    if (method === 'GET' && path === '/api/group') return atlasJson(await atlasGroup(db, user, url));
    if (method === 'GET' && path === '/api/staff') return atlasJson(await atlasStaff(db, user));

    if (method === 'GET' && path === '/api/homework') return atlasJson(await atlasHomeworkList(db, user, url));
    if (method === 'GET' && path === '/api/student-services') return atlasJson(await atlasStudentServices(db, user));
    if (method === 'GET' && /^\/api\/people\/[^/]+$/.test(path)) return atlasJson(await atlasPublicProfile(db, decodeURIComponent(path.slice('/api/people/'.length)),user));
    if (method === 'GET' && /^\/api\/profiles\/[^/]+$/.test(path)) {
      const id=decodeURIComponent(path.slice('/api/profiles/'.length));
      if(id!==user.id)atlasFail(403,'Личный профиль доступен только владельцу.');
      return atlasJson({profile:atlasSafeUser(user)});
    }
    if (method === 'POST' && path === '/api/homework') {
      const body = await atlasBody(request);
      return atlasJson({ assignment: await atlasHomeworkWrite(db, user, body) }, 201);
    }
    if (['PATCH','DELETE'].includes(method) && /^\/api\/homework\/[^/]+$/.test(path)) {
      const id = decodeURIComponent(path.slice('/api/homework/'.length));
      const existing = await db.prepare('SELECT * FROM homework WHERE id=?').bind(id).first();
      if (!existing) atlasFail(404, 'Задание не найдено.');
      if (user.role !== 'admin' && existing.author_id !== user.id) atlasFail(403, 'Изменять задание может его автор или администрация.');
      await atlasHomeworkPermission(db, user, existing.group_id, existing.subject);
      if (method === 'DELETE') {
        await db.prepare('DELETE FROM homework WHERE id=?').bind(id).run();
        return atlasJson({ ok:true, id });
      }
      return atlasJson({ assignment: await atlasHomeworkWrite(db, user, await atlasBody(request), existing) });
    }
    if (method === 'DELETE' && /^\/api\/schedule\/[^/]+$/.test(path)) {
      atlasRole(user, 'admin');
      const id = decodeURIComponent(path.slice('/api/schedule/'.length));
      const existing = await db.prepare('SELECT id FROM lessons WHERE id=?').bind(id).first();
      if (!existing) atlasFail(404, 'Занятие не найдено.');
      const dated=await db.prepare('SELECT id FROM schedule_exceptions WHERE lesson_id=? AND active=1 LIMIT 1').bind(id).first();
      if(dated)atlasFail(409,'У занятия есть разовые изменения. Сначала восстановите исходные пары, затем удалите шаблон.');
      await db.prepare('DELETE FROM lessons WHERE id=?').bind(id).run();
      return atlasJson({ ok:true, id });
    }


    if (method === 'POST' && path === '/api/requests') {
      atlasRole(user, 'student');
      const body = await atlasBody(request);
      const type = atlasString(body.type, 'Тип заявки', 80);
      const comment = atlasString(body.comment ?? '', 'Комментарий', 1000, 0);
      const now = new Date().toISOString();
      const id = crypto.randomUUID();
      await db.prepare('INSERT INTO requests (id,user_id,type,comment,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?)')
        .bind(id, user.id, type, comment, 'submitted', now, now).run();
      return atlasJson({ request: { id, type, comment, status: 'submitted', createdAt: now, updatedAt: now, staffReply: '', userId: user.id, student: user.name } }, 201);
    }

    if (method === 'POST' && path === '/api/news') {
      atlasRole(user, 'teacher', 'admin');
      const body = await atlasBody(request);
      const title = atlasString(body.title, 'Заголовок', 140);
      const content = atlasString(body.body, 'Текст', 4000);
      const deadline=typeof atlasManagementDeadline==='function'?atlasManagementDeadline(body.deadline):null;
      const scope = body.scope;
      if (!['all', 'group'].includes(scope)) atlasFail(400, 'Укажите аудиторию новости.');
      if (user.role === 'teacher' && scope === 'all') atlasFail(403, 'Объявления для всего университета публикует администрация.');
      const groupId = scope === 'group' ? atlasString(body.groupId, 'Группа', 40) : null;
      if (groupId) {
        const group = await db.prepare('SELECT id FROM groups WHERE id=?').bind(groupId).first();
        if (!group) atlasFail(404, 'Группа не найдена.');
        if (user.role === 'teacher') {
          const teaches = await db.prepare('SELECT id FROM teaching_assignments WHERE teacher_id=? AND group_id=? LIMIT 1').bind(user.id, groupId).first();
          if (!teaches) atlasFail(403, 'Группа недоступна.');
        }
      }
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      const attachments=await atlasAttachmentRows(db,user,body.attachmentIds);
      await db.batch([db.prepare('INSERT INTO news (id,author_id,scope,group_id,title,body,created_at,pinned,deadline) VALUES (?,?,?,?,?,?,?,?,?)')
        .bind(id, user.id, scope, groupId, title, content, now, 0, deadline),...attachments.map(file=>db.prepare('UPDATE uploads SET news_id=? WHERE id=? AND owner_id=? AND news_id IS NULL AND club_post_id IS NULL').bind(id,file.id,user.id))]);
      return atlasJson({ news: { id, title, body: content, authorId: user.id, author: user.name, authorRole: user.role, scope, groupId, group: null, createdAt: now, pinned: false, deadline, attachments:await atlasAttachments(db,'news_id',id) } }, 201);
    }

    if (method === 'POST' && path === '/api/chat-messages') {
      const body = await atlasBody(request);
      const chatId = atlasString(body.chatId, 'Чат', 80);
      const content = atlasString(body.body, 'Сообщение', 2000);
      await atlasChatMembership(db,user,chatId);
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      await db.prepare('INSERT INTO messages (id,chat_id,author_id,body,created_at) VALUES (?,?,?,?,?)').bind(id, chatId, user.id, content, now).run();
      return atlasJson({ message: { id, body: content, createdAt: now, authorId: user.id, author: user.name, initials: user.initials } }, 201);
    }

    if (method === 'POST' && path === '/api/chat-folders') {
      const body = await atlasBody(request);
      const name = atlasString(body.name, 'Название папки', 40);
      const existing = await db.prepare('SELECT id FROM chat_folders WHERE user_id=? AND name=? COLLATE NOCASE').bind(user.id, name).first();
      if (existing) atlasFail(409, 'Такая папка уже есть.');
      const id = crypto.randomUUID();
      const createdAt = new Date().toISOString();
      await db.prepare('INSERT INTO chat_folders (id,user_id,name,created_at) VALUES (?,?,?,?)').bind(id, user.id, name, createdAt).run();
      return atlasJson({ folder: { id, name, createdAt } }, 201);
    }

    if (method === 'PATCH' && /^\/api\/chats\/[^/]+\/folder$/.test(path)) {
      const chatId = decodeURIComponent(path.split('/')[3]);
      await atlasChatMembership(db,user,chatId);
      const body = await atlasBody(request);
      const folderId = body.folderId === null ? null : atlasString(body.folderId, 'Папка', 80);
      if (folderId) {
        const folder = await db.prepare('SELECT id,name FROM chat_folders WHERE id=? AND user_id=?').bind(folderId, user.id).first();
        if (!folder) atlasFail(403, 'Папка недоступна.');
        await db.prepare(`
          INSERT INTO chat_folder_assignments (chat_id,user_id,folder_id) VALUES (?,?,?)
          ON CONFLICT(chat_id,user_id) DO UPDATE SET folder_id=excluded.folder_id
        `).bind(chatId, user.id, folderId).run();
        return atlasJson({ chatId, folderId, folder: folder.name });
      }
      await db.prepare('DELETE FROM chat_folder_assignments WHERE chat_id=? AND user_id=?').bind(chatId, user.id).run();
      const chat = await db.prepare('SELECT folder FROM chats WHERE id=?').bind(chatId).first();
      return atlasJson({ chatId, folderId: null, folder: chat.folder });
    }

    if (method === 'POST' && path === '/api/schedule') {
      atlasRole(user, 'admin');
      const body = await atlasBody(request);
      const groupId = atlasString(body.groupId, 'Группа', 40);
      const group = await db.prepare('SELECT id FROM groups WHERE id=?').bind(groupId).first();
      if (!group) atlasFail(404, 'Группа не найдена.');
      const weekday = Number(body.weekday);
      if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) atlasFail(400, 'Некорректный день недели.');
      const startTime = atlasString(body.startTime, 'Начало', 5);
      const endTime = atlasString(body.endTime, 'Конец', 5);
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(endTime) || endTime <= startTime) atlasFail(400, 'Некорректное время занятия.');
      const subject = atlasString(body.subject, 'Дисциплина', 120);
      const type = atlasString(body.type, 'Тип занятия', 40);
      const room = atlasString(body.room, 'Аудитория', 80);
      let teacherId = body.teacherId || null;
      let teacherName;
      if (typeof teacherId === 'string' && teacherId.startsWith('name:')) {
        teacherName = atlasString(teacherId.slice(5), 'Преподаватель', 120);
        const known = await db.prepare('SELECT id FROM lessons WHERE teacher_name=? LIMIT 1').bind(teacherName).first();
        if (!known) atlasFail(404, 'Преподаватель не найден.');
        teacherId = null;
      } else if (teacherId) {
        const teacher = await db.prepare("SELECT id,name FROM users WHERE id=? AND role='teacher'").bind(teacherId).first();
        if (!teacher) atlasFail(404, 'Преподаватель не найден.');
        teacherName = teacher.name;
      } else {
        teacherName = atlasString(body.teacher || body.teacherName || '', 'Преподаватель', 120);
      }
      const id = body.id ? atlasString(body.id, 'Занятие', 80) : crypto.randomUUID();
      const existingTemplate=body.id?await db.prepare('SELECT * FROM lessons WHERE id=?').bind(id).first():null;
      if(body.id&&!existingTemplate)atlasFail(404,'Занятие не найдено.');
      if(typeof atlasCalendarValidateTemplate==='function')await atlasCalendarValidateTemplate(db,existingTemplate,{id,groupId,weekday,subject,type,startTime,endTime,room,teacherId,teacherName});
      await atlasScheduleConflict(db, { id, groupId, weekday, startTime, endTime, room, teacherName });
      const changed = body.changed ? 1 : 0;
      const changeNote = atlasString(body.changeNote || '', 'Изменение', 300, 0);
      await db.prepare(`
        INSERT INTO lessons (id,group_id,weekday,start_time,end_time,subject,type,room,teacher_id,teacher_name,changed,change_note)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET
        group_id=excluded.group_id,weekday=excluded.weekday,start_time=excluded.start_time,end_time=excluded.end_time,
        subject=excluded.subject,type=excluded.type,room=excluded.room,teacher_id=excluded.teacher_id,
        teacher_name=excluded.teacher_name,changed=excluded.changed,change_note=excluded.change_note
      `).bind(id, groupId, weekday, startTime, endTime, subject, type, room, teacherId, teacherName, changed, changeNote).run();
      return atlasJson({ lesson: { id, groupId, weekday, startTime, endTime, subject, type, room, teacher: teacherName, teacherId, changed: Boolean(changed), changeNote } }, body.id ? 200 : 201);
    }

    if (method === 'POST' && path === '/api/grades') {
      atlasRole(user, 'teacher');
      const body = await atlasBody(request);
      const studentId = atlasString(body.studentId, 'Студент', 80);
      const student = await db.prepare("SELECT id,group_id FROM users WHERE id=? AND role='student'").bind(studentId).first();
      if (!student) atlasFail(404, 'Студент не найден.');
      const subject = atlasString(body.subject, 'Дисциплина', 120);
      const taught = await db.prepare('SELECT id FROM teaching_assignments WHERE group_id=? AND teacher_id=? AND subject=? LIMIT 1').bind(student.group_id, user.id, subject).first();
      if (!taught) atlasFail(403, 'Оценку по этой дисциплине может выставить только её преподаватель.');
      const value = Number(body.value);
      if (!Number.isInteger(value) || value < 2 || value > 5) atlasFail(400, 'Оценка должна быть от 2 до 5.');
      const kind = body.kind || 'grade';
      if (!['grade', 'credit', 'exam'].includes(kind)) atlasFail(400, 'Некорректный тип оценки.');
      const note = atlasString(body.note || '', 'Комментарий', 300, 0);
      const attended = Number(body.attended ?? 0);
      const totalClasses = Number(body.totalClasses ?? 0);
      if (!Number.isInteger(attended) || !Number.isInteger(totalClasses) || attended < 0 || totalClasses < attended || totalClasses > 1000) atlasFail(400, 'Некорректные данные о посещении.');
      const id = body.gradeId ? atlasString(body.gradeId, 'Запись', 80) : crypto.randomUUID();
      if (body.gradeId) {
        const existing = await db.prepare('SELECT id FROM grades WHERE id=? AND student_id=? AND teacher_id=? AND subject=?').bind(id, studentId, user.id, subject).first();
        if (!existing) atlasFail(403, 'Запись недоступна.');
      }
      const recordedAt = new Date().toISOString().slice(0, 10);
      await db.prepare(`
        INSERT INTO grades (id,student_id,subject,teacher_id,value,kind,note,recorded_at,attended,total_classes)
        VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET
        value=excluded.value,kind=excluded.kind,note=excluded.note,recorded_at=excluded.recorded_at,
        attended=excluded.attended,total_classes=excluded.total_classes
      `).bind(id, studentId, subject, user.id, value, kind, note, recordedAt, attended, totalClasses).run();
      return atlasJson({ grade: { id, studentId, subject, value, kind, note, recordedAt, attended, totalClasses } }, body.gradeId ? 200 : 201);
    }

    if (method === 'PATCH' && /^\/api\/requests\/[^/]+$/.test(path)) {
      atlasRole(user, 'admin');
      const id = decodeURIComponent(path.slice('/api/requests/'.length));
      const row = await db.prepare('SELECT id FROM requests WHERE id=?').bind(id).first();
      if (!row) atlasFail(404, 'Заявка не найдена.');
      const body = await atlasBody(request);
      if (!['submitted', 'in_review', 'ready', 'rejected'].includes(body.status)) atlasFail(400, 'Некорректный статус.');
      const staffReply = atlasString(body.staffReply || '', 'Ответ', 1000, 0);
      const now = new Date().toISOString();
      await db.prepare('UPDATE requests SET status=?,staff_reply=?,updated_at=? WHERE id=?').bind(body.status, staffReply, now, id).run();
      const updated = await db.prepare('SELECT r.*,u.name AS student_name FROM requests r JOIN users u ON u.id=r.user_id WHERE r.id=?').bind(id).first();
      return atlasJson({ request: atlasRequest(updated) });
    }

    atlasFail(404, 'Маршрут не найден.');
  } catch (error) {
    if (error instanceof AtlasApiError) return atlasJson({ error: error.message }, error.status);
    console.error('Atlas API error', error);
    return atlasJson({ error: 'Временная ошибка сервера. Повторите попытку.' }, 500);
  }
}


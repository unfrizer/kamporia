// Campus services share the existing session, Origin check and role model.
const CAMPUS_WIDGET_IDS=['schedule','plan','progress','events','news','requests','meetings','quick'];
const CAMPUS_BUILDINGS=[{id:'A',name:'Учебный корпус А',x:95,y:104},{id:'B',name:'Лабораторный корпус Б',x:285,y:104},{id:'C',name:'Корпус В · студенческий центр',x:430,y:236}];
function campusInteger(value,min,max,label){const n=Number(value);if(!Number.isInteger(n)||n<min||n>max)atlasFail(400,label+': недопустимое значение.');return n;}
function campusText(value,label,max=160,optional=false){return optional&&(!value||!String(value).trim())?'':atlasString(value,label,max);}
function campusInstant(value,label='Дата и время'){
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{3})?)?(?:Z|[+-]\d{2}:\d{2})?$/.test(value))atlasFail(400,label+': укажите дату и время.');
 atlasIsoDate(value.slice(0,10),label);
 const d=new Date(/(?:Z|[+-]\d{2}:\d{2})$/.test(value)?value:value+(value.length===16?':00':'')+'+03:00');if(!Number.isFinite(d.getTime()))atlasFail(400,label+': некорректное время.');
 if(d.getTime()<Date.now()-60000||d.getTime()>Date.now()+370*86400000)atlasFail(400,'Выберите будущее время в пределах года.');return d.toISOString();
}
function campusPeriod(body,maxMinutes=720){const start=campusInstant(body.startsAt),end=campusInstant(body.endsAt);if(end<=start||Date.parse(end)-Date.parse(start)>maxMinutes*60000)atlasFail(400,'Проверьте длительность встречи.');return {start,end};}
function campusDay(value){return new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Moscow',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));}
async function campusScope(db,user,groupId,subject){
 if(user.role==='student'){if(groupId&&groupId!==user.group_id)atlasFail(403,'Предмет другой группы недоступен.');groupId=user.group_id;}
 const choices=await atlasHomeworkOptions(db,user);const selected=choices.options.find(x=>x.groupId===groupId&&x.subject===subject);
 if(!selected)atlasFail(403,'Дисциплина или группа недоступна.');return {groupId,subject,choices};
}
async function campusPreferences(db,user){const row=await db.prepare('SELECT * FROM campus_preferences WHERE user_id=?').bind(user.id).first();const allowed=CAMPUS_WIDGET_IDS.filter(x=>(x!=='progress'||user.role==='student')&&(x!=='requests'||user.role!=='teacher')),defaults=['schedule','plan',user.role==='student'?'progress':'meetings','news','events','quick'];return {widgets:row?JSON.parse(row.widgets_json).filter(x=>allowed.includes(x)):defaults,allowed,compact:Boolean(row?.compact)};}
async function campusEventRows(db,user){return (await db.prepare(`SELECT e.*,c.name AS club_name,c.color AS club_color,cm.role AS member_role,em.status AS my_status,
 (SELECT COUNT(*) FROM campus_event_members m WHERE m.event_id=e.id AND m.status='going') AS participants
 FROM campus_events e JOIN clubs c ON c.id=e.club_id LEFT JOIN club_members cm ON cm.club_id=e.club_id AND cm.user_id=?
 LEFT JOIN campus_event_members em ON em.event_id=e.id AND em.user_id=?
 WHERE (e.audience='all' OR cm.user_id IS NOT NULL OR ?='admin') AND e.ends_at>=? ORDER BY e.starts_at LIMIT 300`)
 .bind(user.id,user.id,user.role,new Date(Date.now()-14*86400000).toISOString()).all()).results;}
function campusEvent(row,user){return {id:row.id,clubId:row.club_id,club:row.club_name,title:row.title,body:row.body,startsAt:row.starts_at,endsAt:row.ends_at,place:row.place,capacity:row.capacity,participants:row.participants,remaining:Math.max(0,row.capacity-row.participants),audience:row.audience,cover:row.cover,status:row.status,isGoing:row.my_status==='going',isMember:Boolean(row.member_role),canManage:user.role==='admin'||ATLAS_CLUB_PUBLISH_ROLES.includes(row.member_role),updatedAt:row.updated_at};}
async function campusEventById(db,user,id){const row=await db.prepare(`SELECT e.*,c.name AS club_name,cm.role AS member_role FROM campus_events e JOIN clubs c ON c.id=e.club_id LEFT JOIN club_members cm ON cm.club_id=e.club_id AND cm.user_id=? WHERE e.id=?`).bind(user.id,id).first();if(!row)atlasFail(404,'Событие не найдено.');if(row.audience==='members'&&!row.member_role&&user.role!=='admin')atlasFail(403,'Событие доступно участникам клуба.');return row;}
async function campusEvents(db,user){const [rows,clubs]=await Promise.all([campusEventRows(db,user),atlasClubs(db,user)]);return {events:rows.map(x=>campusEvent(x,user)),clubs:clubs.map(x=>({id:x.id,name:x.name,canManage:x.canPublish,isMember:x.isMember}))};}
async function campusSlotRows(db,user){
 const rows=(await db.prepare(`SELECT s.*,u.name AS owner_name,u.role AS owner_role,g.name AS group_name,
 b.id AS booking_id,b.user_id AS booked_by,b.topic,b.status AS booking_status,b.updated_at AS booking_updated,bu.name AS student_name
 FROM campus_slots s JOIN users u ON u.id=s.owner_id LEFT JOIN groups g ON g.id=s.group_id
 LEFT JOIN campus_bookings b ON b.slot_id=s.id AND b.status='confirmed' LEFT JOIN users bu ON bu.id=b.user_id
 WHERE s.ends_at>=? AND (s.group_id IS NULL OR s.group_id=? OR s.owner_id=? OR ?='admin' OR b.user_id=?) ORDER BY s.starts_at LIMIT 300`)
 .bind(new Date(Date.now()-7*86400000).toISOString(),user.group_id||'',user.id,user.role,user.id).all()).results;
 return rows.map(row=>{const manager=row.owner_id===user.id||user.role==='admin',mine=row.booked_by===user.id;return {id:row.id,ownerId:row.owner_id,owner:row.owner_name,ownerRole:row.owner_role,groupId:row.group_id,group:row.group_name,startsAt:row.starts_at,endsAt:row.ends_at,place:row.format==='online'&&!mine&&!manager?'Ссылка появится после записи':row.place,format:row.format,status:row.status,available:row.status==='active'&&!row.booking_id&&row.starts_at>new Date().toISOString(),mine,canManage:manager,booking:row.booking_id&&(mine||manager)?{id:row.booking_id,studentId:row.booked_by,student:row.student_name,topic:row.topic}:null};});
}
async function campusConsultations(db,user){const [slots,staff,options]=await Promise.all([campusSlotRows(db,user),db.prepare("SELECT id,name,role FROM users WHERE role IN ('teacher','admin') ORDER BY name").all(),atlasHomeworkOptions(db,user)]);return {slots,staff:staff.results,groups:options.groups,canCreate:user.role!=='student'};}
async function campusBusy(db,userId,role,start,end){
 const person=await db.prepare('SELECT group_id FROM users WHERE id=?').bind(userId).first();
 const {base,exceptions}=await atlasCalendarRows(db);const from=campusDay(start),to=campusDay(end);
 const lessons=atlasCalendarExpand(base,exceptions,from,to).filter(x=>!['cancelled','moved-away'].includes(x.status)&&(role==='student'?atlasLessonHasGroup(x,person?.group_id):x.teacherId===userId));
 return lessons.find(x=>new Date(x.date+'T'+x.startTime+':00+03:00').toISOString()<end&&new Date(x.date+'T'+x.endTime+':00+03:00').toISOString()>start);
}
async function campusPlan(db,user){
 const today=atlasMoscowDate().toISOString().slice(0,10),from=atlasDateAdd(today,-90),to=atlasDateAdd(today,370),items=[];
 let hsql='SELECT * FROM homework h WHERE h.due_date BETWEEN ? AND ?',args=[from,to];
 if(user.role==='student'){hsql+=' AND h.group_id=?';args.push(user.group_id);}if(user.role==='teacher'){hsql+=' AND EXISTS(SELECT 1 FROM teaching_assignments l WHERE l.group_id=h.group_id AND l.subject=h.subject AND l.teacher_id=?)';args.push(user.id);}
 const [hw,tasks,progress,news,events,slots]=await Promise.all([db.prepare(hsql+' ORDER BY h.due_date LIMIT 300').bind(...args).all(),db.prepare('SELECT * FROM campus_tasks WHERE user_id=? ORDER BY due_date').bind(user.id).all(),db.prepare('SELECT source_key,status FROM campus_progress WHERE user_id=?').bind(user.id).all(),atlasNewsList(db,user,100,false),campusEventRows(db,user),campusSlotRows(db,user)]);
 const add=(key,kind,title,date,extra={})=>items.push({key,kind,title,date,status:'todo',...extra});
 for(const h of hw.results)add('homework:'+h.id,'homework',h.title,h.due_date,{subject:h.subject,groupId:h.group_id,lessonDate:h.lesson_date});
 for(const t of tasks.results)add('task:'+t.id,'task',t.title,t.due_date,{subject:t.subject,status:t.status,id:t.id});
 for(const n of news)if(n.deadline&&!n.archived)add('news:'+n.id,'news',n.title,n.deadline);
 if(user.role==='student'){const exams=(await db.prepare('SELECT * FROM exams WHERE student_id=? AND exam_date BETWEEN ? AND ?').bind(user.id,from,to).all()).results;for(const e of exams)add('exam:'+e.id,'exam',e.subject,e.exam_date,{subject:e.subject,place:e.room});}
 for(const e of events)if(e.my_status==='going'&&e.status==='published')add('event:'+e.id,'event',e.title,campusDay(e.starts_at),{startsAt:e.starts_at,clubId:e.club_id});
 for(const s of slots)if((s.mine||s.canManage&&s.booking)&&s.status==='active')add('slot:'+s.id,'consultation','Консультация · '+s.owner,campusDay(s.startsAt),{startsAt:s.startsAt,place:s.place});
 const statuses=new Map(progress.results.map(x=>[x.source_key,x.status]));for(const item of items){item.status=statuses.get(item.key)||item.status;item.overdue=item.date<today&&item.status!=='done';}
 return {items:items.sort((a,b)=>a.date.localeCompare(b.date)||a.title.localeCompare(b.title)),today};
}
async function campusCanProgress(db,user,key){
 if(typeof key!=='string'||key.length>180)atlasFail(400,'Некорректная задача.');const type=key.slice(0,key.indexOf(':')),id=key.slice(key.indexOf(':')+1);let row;
 if(type==='task'){row=await db.prepare('SELECT user_id FROM campus_tasks WHERE id=?').bind(id).first();if(row?.user_id===user.id)return;}
 if(type==='homework'){row=await db.prepare('SELECT * FROM homework WHERE id=?').bind(id).first();if(row){if(user.role==='admin'||user.role==='student'&&row.group_id===user.group_id)return;if(user.role==='teacher'&&await db.prepare('SELECT id FROM teaching_assignments WHERE group_id=? AND subject=? AND teacher_id=?').bind(row.group_id,row.subject,user.id).first())return;}}
 if(type==='exam'&&await db.prepare('SELECT id FROM exams WHERE id=? AND student_id=?').bind(id,user.id).first())return;
 if(type==='news'&&await atlasCanReadNews(db,user,id))return;
 if(type==='event'){await campusEventById(db,user,id);if(await db.prepare("SELECT event_id FROM campus_event_members WHERE event_id=? AND user_id=? AND status='going'").bind(id,user.id).first())return;}
 if(type==='slot'){row=await db.prepare('SELECT owner_id FROM campus_slots WHERE id=?').bind(id).first();if(row?.owner_id===user.id||row&&user.role==='admin'||await db.prepare("SELECT id FROM campus_bookings WHERE slot_id=? AND user_id=? AND status='confirmed'").bind(id,user.id).first())return;}
 atlasFail(403,'Задача недоступна.');
}
async function campusHub(db,user,url){
 const subject=campusText(url.searchParams.get('subject'),'Предмет',120),opts=await atlasHomeworkOptions(db,user),groupId=url.searchParams.get('groupId')||user.group_id||opts.options.find(x=>x.subject===subject)?.groupId;
 await campusScope(db,user,groupId,subject);
 const today=atlasMoscowDate().toISOString().slice(0,10),[raw,materials,hw,grades,teachers,rule]=await Promise.all([
 atlasCalendarRows(db),atlasResources(db,user),db.prepare('SELECT h.*,u.name AS author FROM homework h JOIN users u ON u.id=h.author_id WHERE h.group_id=? AND h.subject=? AND h.due_date>=? ORDER BY h.due_date LIMIT 30').bind(groupId,subject,atlasDateAdd(today,-14)).all(),
 user.role==='student'?atlasGrades(db,user):Promise.resolve(null),db.prepare("SELECT DISTINCT COALESCE(u.id,'name:'||l.teacher_name) AS id,COALESCE(u.name,l.teacher_name) AS name,CASE WHEN u.id IS NULL THEN 0 ELSE 1 END AS canBook FROM teaching_assignments l LEFT JOIN users u ON u.id=l.teacher_id WHERE l.group_id=? AND l.subject=?").bind(groupId,subject).all(),db.prepare('SELECT * FROM campus_grading WHERE group_id=? AND subject=?').bind(groupId,subject).first()]);
 return {subject,groupId,group:opts.groups.find(x=>x.id===groupId)?.name,options:opts.options,groups:opts.groups,lessons:atlasCalendarExpand(raw.base,raw.exceptions,today,atlasDateAdd(today,21)).filter(x=>atlasLessonHasGroup(x,groupId)&&x.subject===subject),homework:hw.results.map(x=>({...atlasHomeworkRow(x,user),author:x.author})),resources:materials.subjects.find(x=>x.name===subject)?.resources||[],grades:grades?.subjects.filter(x=>x.subject===subject)||[],teachers:teachers.results,canManage:user.role!=='student',rule:rule?{currentWeight:rule.current_weight,futureWeight:100-rule.current_weight,note:rule.note}:null};
}
async function campusForecast(db,user){
 const options=await atlasHomeworkOptions(db,user),rules=(await db.prepare('SELECT r.*,u.name AS author FROM campus_grading r JOIN users u ON u.id=r.author_id ORDER BY r.subject').all()).results;
 const grades=user.role==='student'?await atlasGrades(db,user):null;
 return {options:options.options,groups:options.groups,rules:rules.filter(r=>options.options.some(x=>x.groupId===r.group_id&&x.subject===r.subject)).map(r=>({groupId:r.group_id,subject:r.subject,currentWeight:r.current_weight,futureWeight:100-r.current_weight,note:r.note,author:r.author})),grades:grades?.subjects||[],canManage:user.role!=='student'};
}
async function campusMap(db){return {buildings:CAMPUS_BUILDINGS,places:(await db.prepare('SELECT * FROM campus_places ORDER BY building,floor,room').all()).results,concept:true};}
async function campusEnsure(db){
 const key='campus-v12';if(await db.prepare('SELECT value FROM app_state WHERE key=?').bind(key).first())return;
 const admin=await db.prepare("SELECT id FROM users WHERE role='admin' ORDER BY id LIMIT 1").first();const now=new Date().toISOString();
 if(admin){const clubs=(await db.prepare('SELECT * FROM clubs ORDER BY id').all()).results;for(const [i,club]of clubs.entries()){
  const day=atlasDateAdd(atlasMoscowDate().toISOString().slice(0,10),3+i),start=new Date(day+'T18:00:00+03:00').toISOString(),end=new Date(day+'T19:30:00+03:00').toISOString();
  await db.prepare("INSERT OR IGNORE INTO campus_events(id,club_id,author_id,title,body,starts_at,ends_at,place,capacity,audience,cover,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)").bind('campus-demo-'+club.id,club.id,admin.id,['Вечер идей и знакомства','Практикум: делаем вместе','Открытая встреча сообщества','День новых проектов'][i%4],'Команда «'+club.name+'» приглашает на демонстрационную встречу. Познакомимся с командой, обсудим идеи и выберем следующий проект.',start,end,'Студенческий центр · зал 201',18+i*4,i===3?'members':'all',['orbit','studio','nature','sport'][i%4],now,now).run();
 }
 const scopes=(await db.prepare('SELECT group_id,subject,MIN(teacher_id) AS teacher_id FROM lessons GROUP BY group_id,subject ORDER BY group_id,subject LIMIT 4').all()).results;for(const row of scopes)await db.prepare('INSERT OR IGNORE INTO campus_grading(group_id,subject,author_id,current_weight,note,updated_at) VALUES(?,?,?,?,?,?)').bind(row.group_id,row.subject,row.teacher_id||admin.id,70,'Демонстрационное правило: среднее текущих оценок — 70%, следующая итоговая работа — 30%.',now).run();
 }
 const rooms=(await db.prepare("SELECT DISTINCT room FROM lessons UNION SELECT DISTINCT room FROM exams").all()).results;
 for(const [i,item]of rooms.entries()){const room=item.room;if(!room||/онлайн|online/i.test(room))continue;const building=/[вc]-|корпус\s*в/i.test(room)?'C':/[бb]-|корпус\s*б/i.test(room)?'B':'A',number=(room.match(/\d{2,3}/)||[])[0],floor=number?Math.min(6,Math.max(1,Number(number[0]))):1;await db.prepare('INSERT OR IGNORE INTO campus_places(room,title,building,floor,directions,updated_at) VALUES(?,?,?,?,?,?)').bind(room,'Аудитория '+(number||room),building,floor,'Через главный вход, затем по указателям к аудитории '+room+'. Схема вымышленного кампуса.',now).run();}
 for(const [room,title,building,floor,directions]of [['Деканат','Учебный офис','A',1,'Главный вход корпуса А, первый этаж, направо.'],['Библиотека','Библиотека','B',1,'Первый этаж корпуса Б, центральный холл.'],['Поддержка','Студенческая поддержка','C',2,'Студенческий центр, второй этаж, зона консультаций.'],['Студенческий центр · зал 201','Зал встреч клубов','C',2,'Студенческий центр, второй этаж, большой зал.']])await db.prepare('INSERT OR IGNORE INTO campus_places(room,title,building,floor,directions,updated_at) VALUES(?,?,?,?,?,?)').bind(room,title,building,floor,directions,now).run();
 const staff=(await db.prepare("SELECT id,role FROM users WHERE role IN ('teacher','admin')").all()).results;
 for(const person of staff){for(let offset=2;offset<=3;offset++){const day=atlasDateAdd(atlasMoscowDate().toISOString().slice(0,10),offset),start=new Date(day+'T18:00:00+03:00').toISOString(),end=new Date(day+'T18:30:00+03:00').toISOString();if(await campusBusy(db,person.id,person.role,start,end))continue;await db.prepare('INSERT OR IGNORE INTO campus_slots(id,owner_id,starts_at,ends_at,place,format,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)').bind('campus-demo-slot-'+person.id+'-'+offset,person.id,start,end,person.role==='admin'?'Деканат':'Библиотека','offline',now,now).run();}}
 await db.prepare('INSERT OR IGNORE INTO app_state(key,value) VALUES(?,?)').bind(key,now).run();
}
async function handleCampusApi(request,env,db,user,url){
 const path=url.pathname,method=request.method;if(!path.startsWith('/api/campus/'))return null;
 if(method==='GET'){
  if(path==='/api/campus/overview'){const [plan,preferences,events,consultations]=await Promise.all([campusPlan(db,user),campusPreferences(db,user),campusEvents(db,user),campusConsultations(db,user)]);return atlasJson({plan,preferences,events,consultations});}
  if(path==='/api/campus/plan')return atlasJson(await campusPlan(db,user));
  if(path==='/api/campus/preferences')return atlasJson(await campusPreferences(db,user));
  if(path==='/api/campus/events')return atlasJson(await campusEvents(db,user));
  if(path==='/api/campus/consultations')return atlasJson(await campusConsultations(db,user));
  if(path==='/api/campus/subject')return atlasJson(await campusHub(db,user,url));
  if(path==='/api/campus/forecast')return atlasJson(await campusForecast(db,user));
  if(path==='/api/campus/map')return atlasJson(await campusMap(db));
  if(/^\/api\/campus\/events\/[^/]+\/members$/.test(path)){const e=await campusEventById(db,user,path.split('/')[4]);if(!await atlasClubCanPublish(db,user,e.club_id))atlasFail(403,'Список участников доступен команде клуба.');return atlasJson({members:(await db.prepare("SELECT u.id,u.name,u.tag,m.updated_at AS registeredAt FROM campus_event_members m JOIN users u ON u.id=m.user_id WHERE m.event_id=? AND m.status='going' ORDER BY m.updated_at").bind(e.id).all()).results});}
 }
 if(method==='GET')atlasFail(404,'Раздел не найден.');
 const body=await atlasBody(request),now=new Date().toISOString();
 if(method==='PUT'&&path==='/api/campus/preferences'){
  const allowed=CAMPUS_WIDGET_IDS.filter(x=>(x!=='progress'||user.role==='student')&&(x!=='requests'||user.role!=='teacher'));if(!Array.isArray(body.widgets)||body.widgets.length<1||body.widgets.length>allowed.length||new Set(body.widgets).size!==body.widgets.length||body.widgets.some(x=>!allowed.includes(x)))atlasFail(400,'Выберите корректный набор карточек.');
  if(typeof body.compact!=='boolean')atlasFail(400,'Некорректный режим карточек.');await db.prepare('INSERT INTO campus_preferences(user_id,widgets_json,compact,updated_at) VALUES(?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET widgets_json=excluded.widgets_json,compact=excluded.compact,updated_at=excluded.updated_at').bind(user.id,JSON.stringify(body.widgets),Number(body.compact),now).run();return atlasJson(await campusPreferences(db,user));
 }
 if(method==='POST'&&path==='/api/campus/tasks'){
  const count=await db.prepare('SELECT COUNT(*) AS n FROM campus_tasks WHERE user_id=?').bind(user.id).first();if(count.n>=200)atlasFail(400,'Не более 200 личных задач.');const title=campusText(body.title,'Задача',140),subject=campusText(body.subject,'Предмет',120,true),date=atlasCalendarDate(body.dueDate);const id=crypto.randomUUID();await db.prepare('INSERT INTO campus_tasks(id,user_id,title,subject,due_date,created_at,updated_at) VALUES(?,?,?,?,?,?,?)').bind(id,user.id,title,subject,date,now,now).run();return atlasJson({id},201);
 }
 if(method==='PATCH'&&path==='/api/campus/progress'){
  if(!['todo','doing','done'].includes(body.status))atlasFail(400,'Некорректный статус.');await campusCanProgress(db,user,body.key);if(body.key.startsWith('task:'))await db.prepare('UPDATE campus_tasks SET status=?,updated_at=? WHERE id=? AND user_id=?').bind(body.status,now,body.key.slice(5),user.id).run();else await db.prepare('INSERT INTO campus_progress(user_id,source_key,status,updated_at) VALUES(?,?,?,?) ON CONFLICT(user_id,source_key) DO UPDATE SET status=excluded.status,updated_at=excluded.updated_at').bind(user.id,body.key,body.status,now).run();return atlasJson({ok:true});
 }
 if(method==='PATCH'&&/^\/api\/campus\/tasks\/[^/]+$/.test(path)){const result=await db.prepare('UPDATE campus_tasks SET title=?,subject=?,due_date=?,updated_at=? WHERE id=? AND user_id=?').bind(campusText(body.title,'Задача',140),campusText(body.subject,'Предмет',120,true),atlasCalendarDate(body.dueDate),now,path.split('/')[4],user.id).run();if(!result.meta.changes)atlasFail(403,'Задача недоступна.');return atlasJson({ok:true});}
 if(method==='DELETE'&&/^\/api\/campus\/tasks\/[^/]+$/.test(path)){const result=await db.prepare('DELETE FROM campus_tasks WHERE id=? AND user_id=?').bind(path.split('/')[4],user.id).run();if(!result.meta.changes)atlasFail(403,'Задача недоступна.');return atlasJson({ok:true});}
 if((method==='POST'&&path==='/api/campus/events')||(method==='PATCH'&&/^\/api\/campus\/events\/[^/]+$/.test(path))){
  const existing=method==='PATCH'?await campusEventById(db,user,path.split('/')[4]):null,clubId=existing?.club_id||campusText(body.clubId,'Клуб',80);
  if(!await db.prepare('SELECT id FROM clubs WHERE id=?').bind(clubId).first())atlasFail(404,'Клуб не найден.');if(!await atlasClubCanPublish(db,user,clubId))atlasFail(403,'Мероприятия создаёт команда клуба.');
  const {start,end}=campusPeriod(body),title=campusText(body.title,'Название',140),content=campusText(body.body,'Описание',3000),place=campusText(body.place,'Место',120),capacity=campusInteger(body.capacity,1,500,'Число мест');
  if(!['all','members'].includes(body.audience)||!['orbit','studio','nature','sport'].includes(body.cover))atlasFail(400,'Некорректное оформление или аудитория.');
  if(existing){const count=await db.prepare("SELECT COUNT(*) AS n FROM campus_event_members WHERE event_id=? AND status='going'").bind(existing.id).first();if(capacity<count.n)atlasFail(409,'Нельзя уменьшить число мест ниже количества участников.');if(existing.status==='cancelled')atlasFail(409,'Отменённое событие нельзя редактировать.');
   if(body.audience!==existing.audience&&count.n>0)atlasFail(409,'Аудиторию нельзя менять после появления записей.');const result=await db.prepare("UPDATE campus_events SET title=?,body=?,starts_at=?,ends_at=?,place=?,capacity=?,audience=?,cover=?,updated_at=? WHERE id=? AND (SELECT COUNT(*) FROM campus_event_members WHERE event_id=? AND status='going')<=? AND (audience=? OR NOT EXISTS(SELECT 1 FROM campus_event_members WHERE event_id=? AND status='going'))").bind(title,content,start,end,place,capacity,body.audience,body.cover,now,existing.id,existing.id,capacity,body.audience,existing.id).run();if(!result.meta.changes)atlasFail(409,'Количество участников изменилось. Обновите событие.');return atlasJson({id:existing.id});}
  const id=crypto.randomUUID();await db.prepare('INSERT INTO campus_events(id,club_id,author_id,title,body,starts_at,ends_at,place,capacity,audience,cover,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(id,clubId,user.id,title,content,start,end,place,capacity,body.audience,body.cover,now,now).run();return atlasJson({id},201);
 }
 if(method==='POST'&&/^\/api\/campus\/events\/[^/]+\/(join|leave|cancel)$/.test(path)){
  const [, , , ,id,action]=path.split('/'),row=await campusEventById(db,user,id);
  if(action==='cancel'){if(!await atlasClubCanPublish(db,user,row.club_id))atlasFail(403,'Отменить событие может команда клуба.');await db.prepare("UPDATE campus_events SET status='cancelled',updated_at=? WHERE id=?").bind(now,id).run();return atlasJson({ok:true});}
  if(action==='leave'){await db.prepare("UPDATE campus_event_members SET status='cancelled',updated_at=? WHERE event_id=? AND user_id=?").bind(now,id,user.id).run();return atlasJson({ok:true});}
  if(row.status!=='published'||row.starts_at<=now)atlasFail(409,'Запись закрыта.');
  if(await db.prepare("SELECT event_id FROM campus_event_members WHERE event_id=? AND user_id=? AND status='going'").bind(id,user.id).first())return atlasJson({ok:true});
  const result=await db.prepare(`INSERT INTO campus_event_members(event_id,user_id,status,updated_at) SELECT ?,?,'going',? WHERE EXISTS(SELECT 1 FROM campus_events e WHERE e.id=? AND e.status='published' AND e.starts_at>? AND (e.audience='all' OR ?='admin' OR EXISTS(SELECT 1 FROM club_members cm WHERE cm.club_id=e.club_id AND cm.user_id=?)) AND (SELECT COUNT(*) FROM campus_event_members m WHERE m.event_id=e.id AND m.status='going')<e.capacity) ON CONFLICT(event_id,user_id) DO UPDATE SET status='going',updated_at=excluded.updated_at`).bind(id,user.id,now,id,now,user.role,user.id).run();if(!result.meta.changes)atlasFail(409,'Свободные места закончились.');return atlasJson({ok:true});
 }
 if(method==='POST'&&path==='/api/campus/slots'){
  atlasRole(user,'teacher','admin');const {start,end}=campusPeriod(body,120),place=campusText(body.place,'Место или ссылка',160),groupId=body.groupId||null;if(!['offline','online'].includes(body.format))atlasFail(400,'Выберите формат.');
  if(groupId){const groups=(await atlasHomeworkOptions(db,user)).groups;if(!groups.some(g=>g.id===groupId))atlasFail(403,'Группа недоступна.');}
  if(await campusBusy(db,user.id,user.role,start,end))atlasFail(409,'Это время занято вашим занятием.');
  const id=crypto.randomUUID(),result=await db.prepare(`INSERT INTO campus_slots(id,owner_id,group_id,starts_at,ends_at,place,format,created_at,updated_at) SELECT ?,?,?,?,?,?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM campus_slots WHERE owner_id=? AND status='active' AND starts_at<? AND ends_at>?)`).bind(id,user.id,groupId,start,end,place,body.format,now,now,user.id,end,start).run();if(!result.meta.changes)atlasFail(409,'В это время уже есть консультация.');return atlasJson({id},201);
 }
 if(method==='POST'&&/^\/api\/campus\/slots\/[^/]+\/(book|cancel)$/.test(path)){
  const id=path.split('/')[4],row=await db.prepare('SELECT s.*,u.role AS owner_role FROM campus_slots s JOIN users u ON u.id=s.owner_id WHERE s.id=?').bind(id).first();if(!row)atlasFail(404,'Время не найдено.');
  if(path.endsWith('/cancel')){if(row.owner_id!==user.id&&user.role!=='admin')atlasFail(403,'Отмена доступна владельцу консультации.');await db.batch([db.prepare("UPDATE campus_slots SET status='cancelled',updated_at=? WHERE id=?").bind(now,id),db.prepare("UPDATE campus_bookings SET status='cancelled',updated_at=? WHERE slot_id=? AND status='confirmed'").bind(now,id)]);return atlasJson({ok:true});}
  atlasRole(user,'student');if(row.group_id&&row.group_id!==user.group_id)atlasFail(403,'Это время предназначено другой группе.');if(row.starts_at<=now||row.status!=='active')atlasFail(409,'Это время больше недоступно.');
  const topic=campusText(body.topic,'Тема консультации',400);if(await campusBusy(db,user.id,'student',row.starts_at,row.ends_at)||await campusBusy(db,row.owner_id,row.owner_role,row.starts_at,row.ends_at))atlasFail(409,'Консультация пересекается с занятием. Выберите другое время.');
  const bookingId=crypto.randomUUID();try{const result=await db.prepare(`INSERT INTO campus_bookings(id,slot_id,user_id,topic,status,created_at,updated_at) SELECT ?,?,?,?,'confirmed',?,? WHERE EXISTS(SELECT 1 FROM campus_slots WHERE id=? AND status='active') AND NOT EXISTS(SELECT 1 FROM campus_bookings b JOIN campus_slots s ON s.id=b.slot_id WHERE b.status='confirmed' AND (b.slot_id=? OR b.user_id=? AND s.starts_at<? AND s.ends_at>?))`).bind(bookingId,id,user.id,topic,now,now,id,id,user.id,row.ends_at,row.starts_at).run();if(!result.meta.changes)atlasFail(409,'Место уже заняли или у вас есть другая встреча в это время.');}catch(error){if(error instanceof AtlasApiError)throw error;if(/unique|constraint/i.test(error.message))atlasFail(409,'Место уже заняли.');throw error;}return atlasJson({id:bookingId},201);
 }
 if(method==='POST'&&/^\/api\/campus\/bookings\/[^/]+\/cancel$/.test(path)){const id=path.split('/')[4],row=await db.prepare('SELECT b.*,s.owner_id FROM campus_bookings b JOIN campus_slots s ON s.id=b.slot_id WHERE b.id=?').bind(id).first();if(!row||![row.user_id,row.owner_id].includes(user.id)&&user.role!=='admin')atlasFail(403,'Запись недоступна.');await db.prepare("UPDATE campus_bookings SET status='cancelled',updated_at=? WHERE id=?").bind(now,id).run();return atlasJson({ok:true});}
 if(method==='PUT'&&path==='/api/campus/grading'){
  atlasRole(user,'teacher','admin');const groupId=campusText(body.groupId,'Группа',80),subject=campusText(body.subject,'Предмет',120);await campusScope(db,user,groupId,subject);const weight=campusInteger(body.currentWeight,5,95,'Вес текущих оценок'),note=campusText(body.note,'Пояснение',600,true);
  await db.prepare('INSERT INTO campus_grading(group_id,subject,author_id,current_weight,note,updated_at) VALUES(?,?,?,?,?,?) ON CONFLICT(group_id,subject) DO UPDATE SET author_id=excluded.author_id,current_weight=excluded.current_weight,note=excluded.note,updated_at=excluded.updated_at').bind(groupId,subject,user.id,weight,note,now).run();return atlasJson({ok:true});
 }
 if(method==='PUT'&&path==='/api/campus/places'){atlasRole(user,'admin');const room=campusText(body.room,'Аудитория',120),title=campusText(body.title,'Название',140),directions=campusText(body.directions,'Как пройти',600),floor=campusInteger(body.floor,1,6,'Этаж');if(!CAMPUS_BUILDINGS.some(x=>x.id===body.building))atlasFail(400,'Выберите корпус.');await db.prepare('INSERT INTO campus_places(room,title,building,floor,directions,updated_at) VALUES(?,?,?,?,?,?) ON CONFLICT(room) DO UPDATE SET title=excluded.title,building=excluded.building,floor=excluded.floor,directions=excluded.directions,updated_at=excluded.updated_at').bind(room,title,body.building,floor,directions,now).run();return atlasJson({ok:true});}
 atlasFail(404,'Действие не найдено.');
}
async function campusActivity(db,user){
 const [events,bookings]=await Promise.all([campusEventRows(db,user),db.prepare(`SELECT b.*,s.owner_id,s.starts_at,s.place,s.status AS slot_status,u.name AS owner_name FROM campus_bookings b JOIN campus_slots s ON s.id=b.slot_id JOIN users u ON u.id=s.owner_id WHERE (b.user_id=? OR s.owner_id=?) AND s.ends_at>=? ORDER BY s.starts_at LIMIT 100`).bind(user.id,user.id,new Date(Date.now()-7*86400000).toISOString()).all()]);
 const today=atlasMoscowDate().toISOString().slice(0,10),personal=(await db.prepare("SELECT * FROM campus_tasks WHERE user_id=? AND status<>'done' AND due_date BETWEEN ? AND ? LIMIT 40").bind(user.id,atlasDateAdd(today,-2),atlasDateAdd(today,2)).all()).results;
 const out=personal.map(t=>({kind:'deadline',entityKey:'campus-task:'+t.id,id:t.id,version:t.updated_at+':'+t.due_date,title:t.due_date<today?'Проверьте личную задачу':'Срок личной задачи',body:t.title+' · '+atlasActivityDateText(t.due_date),createdAt:new Date().toISOString(),link:{view:'plan',filter:t.due_date<today?'overdue':'all',id:t.id},visibleUntil:atlasDateAdd(t.due_date,3)+'T00:00:00.000Z'})),now=new Date().toISOString();for(const e of events)if(e.my_status==='going'&&e.ends_at>now){out.push({kind:'campus',entityKey:'campus-event:'+e.id,id:e.id,version:e.updated_at+':'+e.status,title:e.status==='cancelled'?'Событие клуба отменено':'Вы идёте на событие клуба',body:e.title+' · '+atlasActivityDateText(campusDay(e.starts_at)),createdAt:e.updated_at,link:{view:'events',clubId:e.club_id,id:e.id},visibleUntil:e.ends_at});if(e.status==='published'&&Date.parse(e.starts_at)-Date.now()<86400000)out.push({kind:'deadline',entityKey:'campus-event:'+e.id,id:e.id,version:e.updated_at+':reminder',title:'Встреча клуба уже скоро',body:e.title+' · '+e.place,createdAt:now,link:{view:'events',clubId:e.club_id,id:e.id},visibleUntil:e.ends_at});}
 for(const b of bookings.results)out.push({kind:'consultation',entityKey:'campus-booking:'+b.id,id:b.id,version:b.updated_at+':'+b.status,title:b.status==='cancelled'?'Консультация отменена':'Запись на консультацию',body:b.owner_name+' · '+atlasActivityDateText(campusDay(b.starts_at))+' · '+b.place,createdAt:b.updated_at,link:{view:'consultations'},visibleUntil:null});return out;
}

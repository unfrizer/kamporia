// Date-specific changes are kept separately from the recurring weekly template.
function atlasCalendarDate(value,label='Дата') {
  const date=atlasIsoDate(value,label),today=atlasMoscowDate().toISOString().slice(0,10);
  if(date<atlasDateAdd(today,-370)||date>atlasDateAdd(today,370))atlasFail(400,'Датированные изменения доступны в пределах года.');
  return date;
}
function atlasCalendarWeekday(date) { return new Date(date+'T12:00:00Z').getUTCDay(); }
function atlasCalendarException(row) {
  return {id:row.id,lessonId:row.lesson_id,originalDate:row.original_date,action:row.action,targetDate:row.target_date,groupId:row.group_id,subject:row.subject,type:row.type,startTime:row.start_time,endTime:row.end_time,room:row.room,teacherId:row.teacher_id||'name:'+row.teacher_name,teacher:row.teacher_name,note:row.note,authorId:row.author_id,active:Boolean(row.active),createdAt:row.created_at,updatedAt:row.updated_at};
}
async function atlasCalendarRows(db) {
 const [base,exceptions,settings]=await db.batch([
  db.prepare("SELECT l.*,g.name AS group_name,(SELECT json_group_array(group_id) FROM lesson_groups lg WHERE lg.lesson_id=l.id) AS group_ids_json,(SELECT json_group_array(g2.name) FROM lesson_groups lg JOIN groups g2 ON g2.id=lg.group_id WHERE lg.lesson_id=l.id) AS group_names_json FROM lessons l JOIN groups g ON g.id=l.group_id ORDER BY l.weekday,l.start_time"),
  db.prepare('SELECT e.*,g.name AS group_name FROM schedule_exceptions e JOIN groups g ON g.id=e.group_id WHERE e.active=1'),db.prepare('SELECT * FROM schedule_cycle_config WHERE id=1')
 ]);const config=atlasCycleConfigValue(settings.results[0]);return {base:base.results.map(row=>({...row,_cycle:config})),exceptions:exceptions.results,config};
}
function atlasCalendarExpand(baseRows,exceptions,from,to,config=baseRows[0]?._cycle||atlasCycleDefault()) {
 const index=new Map(exceptions.map(row=>[row.lesson_id+'|'+row.original_date,row])),rows=[];
 function exceptionLesson(base,row,date,status){return {...atlasLesson(base),baseTeacherId:base.teacher_id,id:row.lesson_id,baseLessonId:row.lesson_id,date,weekday:atlasCalendarWeekday(date),originalDate:row.original_date,exceptionId:row.id,status,action:row.action,targetDate:row.target_date,startTime:row.start_time,endTime:row.end_time,room:row.room,teacherId:row.teacher_id||'name:'+row.teacher_name,teacher:row.teacher_name,subject:row.subject,type:row.type,changed:true,changeNote:row.note||(status==='cancelled'?'Занятие отменено на эту дату':status==='moved-away'?'Занятие перенесено на '+row.target_date:'Изменение только на эту дату'),exception:atlasCalendarException(row)};}
 for(let date=from;date<=to;date=atlasDateAdd(date,1))for(const base of baseRows){
  if(base.single_date||base.active===0||Number(base.weekday)!==atlasCalendarWeekday(date)||!atlasCycleMatches(base,date,config))continue;
  const e=index.get(base.id+'|'+date);
  if(!e)rows.push({...atlasLesson(base),baseTeacherId:base.teacher_id,baseLessonId:base.id,date,originalDate:date,status:'scheduled'});
  else if(e.action==='cancel')rows.push(exceptionLesson(base,e,date,'cancelled'));
  else if(e.target_date!==date)rows.push({...exceptionLesson(base,e,date,'moved-away'),startTime:base.start_time,endTime:base.end_time,room:base.room,teacherId:base.teacher_id||'name:'+base.teacher_name,teacher:base.teacher_name});
  else rows.push(exceptionLesson(base,e,date,'changed'));
 }
 const byId=new Map(baseRows.map(row=>[row.id,row]));
 for(const e of exceptions){const base=byId.get(e.lesson_id);if(base&&e.action==='change'&&e.target_date!==e.original_date&&e.target_date>=from&&e.target_date<=to&&atlasCycleMatches(base,e.original_date,config))rows.push(exceptionLesson(base,e,e.target_date,'moved'));}
 for(const row of baseRows.filter(r=>r.single_date)){
  if(row.single_date>=from&&row.single_date<=to)rows.push(atlasSingleLesson(row,row.single_date,row.active===0?'cancelled':row.single_date!==row.single_original_date?'moved':'added'));
  if(row.single_original_date!==row.single_date&&row.single_original_date>=from&&row.single_original_date<=to)rows.push(atlasSingleLesson(row,row.single_original_date,'moved-away'));
 }
 return rows.sort((a,b)=>a.date.localeCompare(b.date)||a.startTime.localeCompare(b.startTime)||a.groupId.localeCompare(b.groupId));
}
async function atlasCalendarFilter(db,user,url,lessons,baseRows,exceptions) {
  const teacherId=url.searchParams.get('teacherId'),groupId=url.searchParams.get('groupId');
  if(teacherId) {
    let name;
    if(teacherId.startsWith('name:')) {
      name=teacherId.slice(5);
      if(!baseRows.some(row=>row.teacher_name===name)&&!exceptions.some(row=>row.teacher_name===name))atlasFail(404,'Преподаватель не найден.');
    } else {
      const teacher=await db.prepare("SELECT id,name FROM users WHERE id=? AND role='teacher'").bind(teacherId).first();
      if(!teacher)atlasFail(404,'Преподаватель не найден.');
      name=teacher.name;
    }
    return lessons.filter(item=>teacherId.startsWith('name:')?item.teacher===name:item.teacherId===teacherId);
  }
  if(user.role==='student') {
    if(groupId&&groupId!==user.group_id)atlasFail(403,'Расписание другой группы недоступно.');
    return lessons.filter(item=>atlasLessonHasGroup(item,user.group_id));
  }
  if(user.role==='teacher') {
    if(groupId) {
      if(!baseRows.some(row=>atlasLessonHasGroup(row,groupId)&&row.teacher_id===user.id)&&!exceptions.some(row=>row.group_id===groupId&&row.teacher_id===user.id))atlasFail(403,'Группа недоступна.');
      return lessons.filter(item=>atlasLessonHasGroup(item,groupId));
    }
    return lessons.filter(item=>item.teacherId===user.id);
  }
  return groupId?lessons.filter(item=>atlasLessonHasGroup(item,groupId)):lessons;
}
async function atlasCalendarTeachers(db,exceptions) {
  const teachers=await atlasTeachers(db),names=new Set(teachers.map(item=>item.name));
  for(const row of exceptions)if(!names.has(row.teacher_name)){names.add(row.teacher_name);teachers.push({id:row.teacher_id||'name:'+row.teacher_name,name:row.teacher_name,initials:row.teacher_name.split(/\s+/).slice(0,2).map(item=>item[0]).join('')});}
  return teachers.sort((a,b)=>a.name.localeCompare(b.name,'ru'));
}
async function atlasCalendarSchedule(db,user,url) {
  const offset=Number(url.searchParams.get('week')||0);
  if(!Number.isInteger(offset)||offset < -52||offset > 52)atlasFail(400,'Неделя недоступна.');
  const weekStart=atlasWeekStart(offset),from=weekStart.toISOString().slice(0,10),to=atlasDateAdd(from,6),raw=await atlasCalendarRows(db),cycleConfig=raw.config,cycleWeek=atlasCycleWeek(cycleConfig,from);
  if(url.searchParams.get('template')==='1') {
    atlasRole(user,'admin');
    return {lessons:(await atlasLessons(db,user,url)).map(lesson=>({...lesson,date:atlasDateForWeekday(weekStart,lesson.weekday),baseLessonId:lesson.id,template:true})),teachers:await atlasTeachers(db),group:user.group_name||null,weekStart:from,weekOffset:offset,template:true,cycleConfig,cycleWeek};
  }
  const {base,exceptions}=raw;
  const lessons=(await atlasCalendarFilter(db,user,url,atlasCalendarExpand(base,exceptions,from,to),base,exceptions)).map(item=>({...item,canEdit:user.role==='admin'||user.role==='teacher'&&item.teacherId===user.id&&base.find(b=>b.id===(item.baseLessonId||item.id))?.teacher_id===user.id}));
  return {lessons,teachers:await atlasCalendarTeachers(db,exceptions),group:user.group_name||null,weekStart:from,weekOffset:offset,template:false,cycleConfig,cycleWeek};
}
async function atlasCalendarToday(db,user,request) {
  const url=new URL(request.url),{base,exceptions,config}=await atlasCalendarRows(db),date=atlasMoscowDate().toISOString().slice(0,10);
  const visible=await atlasCalendarFilter(db,user,url,atlasCalendarExpand(base,exceptions,date,atlasDateAdd(date,21)),base,exceptions);
  const active=visible.filter(item=>!['cancelled','moved-away'].includes(item.status));
  // Keep today's cancellation notices visible; select the next teaching day only when today has no entries at all.
  const actualToday=visible.filter(item=>item.date===date);
  const displayDate=actualToday.length?date:active[0]?.date||date;
  const today=visible.filter(item=>item.date===displayDate);
  const nowParts=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Moscow',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date());
  const nextLesson=active.find(item=>item.date>date||(item.date===date&&item.endTime>nowParts))||null;
  return {today,nextLesson,displayDate,todayIsNextDay:displayDate!==date,cycleConfig:config,cycleWeek:atlasCycleWeek(config,displayDate)};
}
async function atlasCalendarTeacher(db,body,base) {
  const id=body.teacherId===undefined?(base.teacher_id||null):body.teacherId;
  if(id&&typeof id!=='string')atlasFail(400,'Некорректный преподаватель.');
  if(id&&!id.startsWith('name:')) {
    const teacher=await db.prepare("SELECT id,name FROM users WHERE id=? AND role='teacher'").bind(id).first();
    if(!teacher)atlasFail(404,'Преподаватель не найден.');
    return {id:teacher.id,name:teacher.name};
  }
  const name=atlasString(id?.startsWith('name:')?id.slice(5):(body.teacher??base.teacher_name),'Преподаватель',120);
  return {id:null,name};
}
function atlasCalendarTimes(start,end) {
  const pattern=/^([01]\d|2[0-3]):[0-5]\d$/;
  if(!pattern.test(start)||!pattern.test(end)||end<=start)atlasFail(400,'Некорректное время занятия.');
}
async function atlasCalendarConflict(db,candidate,ignoreId=null) {
 const {base,exceptions}=await atlasCalendarRows(db),remaining=exceptions.filter(e=>e.id!==ignoreId);
 const effective=atlasCalendarExpand(base,remaining,candidate.target_date,candidate.target_date).filter(l=>!calendarCycleUnavailable(l));
 const proposed={groupId:candidate.group_id,groupIds:atlasLessonGroupIds(candidate),startTime:candidate.start_time,endTime:candidate.end_time,room:candidate.room,teacherId:candidate.teacher_id,teacher:candidate.teacher_name};
 const conflict=effective.find(l=>!(l.baseLessonId===candidate.lesson_id&&(l.singleDate||l.originalDate===candidate.original_date))&&atlasCycleLessonConflict(l,proposed));
 if(conflict)atlasFail(409,'На '+candidate.target_date+' уже есть занятие «'+conflict.subject+'», '+conflict.startTime+'–'+conflict.endTime+', '+conflict.group+', '+conflict.room+'.');
 await atlasCycleBookingConflict(db,proposed,candidate.target_date);
}
async function atlasCalendarWrite(db,user,body,existing=null) {
  atlasRole(user,'admin','teacher');
  const revision=await atlasScheduleRevision(db);
  const lessonId=atlasString(body.lessonId??existing?.lesson_id,'Занятие',80);
  const base=await db.prepare('SELECT l.*,g.name AS group_name FROM lessons l JOIN groups g ON g.id=l.group_id WHERE l.id=?').bind(lessonId).first();
  if(!base)atlasFail(404,'Занятие не найдено.');
  if(base.single_date)atlasFail(400,'Для этой пары используйте изменение разового занятия.');
  const groupIds=await atlasGroupsForLesson(db,base);
  if(existing&&existing.lesson_id!==lessonId)atlasFail(400,'Нельзя менять исходное занятие датированного изменения.');
  const originalDate=atlasCalendarDate(body.originalDate??existing?.original_date,'Исходная дата');
  if(existing&&existing.original_date!==originalDate)atlasFail(400,'Исходную дату существующего изменения менять нельзя.');
  if(atlasCalendarWeekday(originalDate)!==Number(base.weekday))atlasFail(400,'На исходную дату у этого занятия нет пары в недельном шаблоне.');
  if(!atlasCycleMatches(base,originalDate,await atlasCycleConfig(db)))atlasFail(400,'В эту неделю занятие отсутствует в шаблоне.');
  const previous=existing||await db.prepare('SELECT * FROM schedule_exceptions WHERE lesson_id=? AND original_date=?').bind(lessonId,originalDate).first();
  if(!existing&&previous?.active)atlasFail(409,'Для этой пары уже есть изменение. Откройте его для редактирования.');
  if(user.role==='teacher'&&(base.teacher_id!==user.id||(previous?.active&&previous.teacher_id!==user.id)))atlasFail(403,'Изменять можно только свои занятия.');
  if(user.role==='teacher'&&body.teacherId!==undefined&&body.teacherId!==user.id)atlasFail(403,'Назначить другого преподавателя может администрация.');
  const action=body.action??existing?.action??'change';
  if(!['change','cancel'].includes(action))atlasFail(400,'Укажите изменение или отмену занятия.');
  const teacher=await atlasCalendarTeacher(db,body,existing||base);
  const candidate={id:previous?.id||crypto.randomUUID(),lesson_id:lessonId,original_date:originalDate,action,target_date:action==='cancel'?originalDate:atlasCalendarDate(body.targetDate??existing?.target_date??originalDate,'Новая дата'),group_id:base.group_id,subject:base.subject,type:base.type,start_time:atlasString(body.startTime??existing?.start_time??base.start_time,'Начало',5),end_time:atlasString(body.endTime??existing?.end_time??base.end_time,'Конец',5),room:atlasString(body.room??existing?.room??base.room,'Аудитория',80),teacher_id:teacher.id,teacher_name:teacher.name,note:atlasString(body.note??existing?.note??'','Комментарий',300,0),author_id:user.id,active:1,created_at:previous?.created_at||new Date().toISOString(),updated_at:new Date().toISOString()};
  atlasCalendarTimes(candidate.start_time,candidate.end_time);
  if(action==='change')await atlasCalendarConflict(db,{...candidate,_group_ids:groupIds},candidate.id);
  await atlasScheduleCommit(db,revision,[db.prepare(`INSERT INTO schedule_exceptions(id,lesson_id,original_date,action,target_date,group_id,subject,type,start_time,end_time,room,teacher_id,teacher_name,note,author_id,active,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(lesson_id,original_date) DO UPDATE SET action=excluded.action,target_date=excluded.target_date,group_id=excluded.group_id,subject=excluded.subject,type=excluded.type,start_time=excluded.start_time,end_time=excluded.end_time,room=excluded.room,teacher_id=excluded.teacher_id,teacher_name=excluded.teacher_name,note=excluded.note,author_id=excluded.author_id,active=1,updated_at=excluded.updated_at`).bind(...Object.values(candidate)),atlasScheduleUpdate(db,user,{kind:'exception',id:candidate.id,groupId:base.group_id,groupIds,teacherId:candidate.teacher_id,previousTeacherId:base.teacher_id,title:action==='cancel'?'Занятие отменено':'Перенос или изменение занятия',body:base.subject+' · '+atlasActivityDateText(originalDate)+(candidate.target_date!==originalDate?' → '+atlasActivityDateText(candidate.target_date):'')+' · '+candidate.start_time+'–'+candidate.end_time+' · '+candidate.room+(candidate.note?' — '+candidate.note:''),date:action==='cancel'?originalDate:candidate.target_date})]);
  return atlasCalendarException(candidate);
}
// Root calls this before changing an existing weekly template. Dated snapshots keep their own times/room.
async function atlasCalendarValidateTemplate(db,existing,candidate) {
 const {base,exceptions,config}=await atlasCalendarRows(db),old=base.find(r=>r.id===existing?.id);
 if(existing&&exceptions.some(e=>e.lesson_id===existing.id)&&(JSON.stringify(atlasLessonGroupIds(old).sort())!==JSON.stringify([...candidate.groupIds].sort())||Number(existing.weekday)!==Number(candidate.weekday)||existing.subject!==candidate.subject||existing.week_pattern!==candidate.weekPattern))atlasFail(409,'У занятия есть датированные изменения. Сначала восстановите эти пары, затем меняйте группы, день, дисциплину или тип недели.');
 const id=candidate.id||existing?.id||'calendar-candidate',proposed={...existing,id,group_id:candidate.groupId,_group_ids:candidate.groupIds,_cycle:config,weekday:Number(candidate.weekday),subject:candidate.subject,type:candidate.type,start_time:candidate.startTime,end_time:candidate.endTime,room:candidate.room,teacher_id:candidate.teacherId||null,teacher_name:candidate.teacherName,week_pattern:candidate.weekPattern,active:1,single_date:null};
 const rows=[...base.filter(r=>r.id!==id),proposed],dates=new Set([...exceptions.flatMap(e=>[e.original_date,e.target_date]),...base.filter(r=>r.single_date).flatMap(r=>[r.single_date,r.single_original_date])]);
 const meetings=(await db.prepare("SELECT DISTINCT s.starts_at FROM campus_slots s JOIN campus_bookings b ON b.slot_id=s.id JOIN users u ON u.id=b.user_id WHERE b.status='confirmed' AND s.status='active' AND s.ends_at>? AND (s.owner_id=? OR u.group_id IN (SELECT value FROM json_each(?)))").bind(new Date().toISOString(),candidate.teacherId,JSON.stringify(candidate.groupIds)).all()).results;
 for(const meeting of meetings)dates.add(campusDay(meeting.starts_at));
 for(const date of dates){const effective=atlasCalendarExpand(rows,exceptions,date,date,config).filter(l=>!calendarCycleUnavailable(l)),own=effective.filter(l=>l.baseLessonId===id),others=effective.filter(l=>l.baseLessonId!==id);for(const lesson of own){const conflict=others.find(l=>atlasCycleLessonConflict(lesson,l));if(conflict)atlasFail(409,'Шаблон пересекается с датированным занятием «'+conflict.subject+'» на '+date+'.');await atlasCycleBookingConflict(db,lesson,date);}}
}
async function handleCalendarApi(request,env,db,user,url) {
  void env;
  const method=request.method.toUpperCase(),path=url.pathname;
  if(method==='GET'&&path==='/api/schedule')return atlasJson(await atlasCalendarSchedule(db,user,url));
  if(path==='/api/schedule-exceptions'&&method==='GET') {
    atlasRole(user,'admin');
    const from=atlasCalendarDate(url.searchParams.get('from')||atlasWeekStart().toISOString().slice(0,10));
    const to=atlasCalendarDate(url.searchParams.get('to')||atlasDateAdd(from,6));
    if(to<from||Date.parse(to)-Date.parse(from)>63*86400000)atlasFail(400,'Выберите период не более 63 дней.');
    const rows=(await db.prepare('SELECT * FROM schedule_exceptions WHERE active=1 AND (original_date BETWEEN ? AND ? OR target_date BETWEEN ? AND ?) ORDER BY original_date,start_time').bind(from,to,from,to).all()).results;
    return atlasJson({exceptions:rows.map(atlasCalendarException),from,to});
  }
  if(path==='/api/schedule-exceptions'&&method==='POST')return atlasJson({exception:await atlasCalendarWrite(db,user,await atlasBody(request))},201);
  if(/^\/api\/schedule-exceptions\/[^/]+$/.test(path)&&['PATCH','DELETE'].includes(method)) {
    atlasRole(user,'admin','teacher');
    const revision=await atlasScheduleRevision(db);
    const id=decodeURIComponent(path.split('/')[3]),existing=await db.prepare('SELECT * FROM schedule_exceptions WHERE id=? AND active=1').bind(id).first();
    if(!existing)atlasFail(404,'Изменение не найдено.');
    if(method==='PATCH')return atlasJson({exception:await atlasCalendarWrite(db,user,await atlasBody(request),existing)});
    const base=await db.prepare('SELECT * FROM lessons WHERE id=?').bind(existing.lesson_id).first();
    if(!base)atlasFail(404,'Исходное занятие не найдено.');
    if(user.role==='teacher'&&(base.teacher_id!==user.id||existing.teacher_id!==user.id))atlasFail(403,'Восстановить можно только своё занятие.');
    const groupIds=await atlasGroupsForLesson(db,base);
    await atlasCalendarConflict(db,{...existing,_group_ids:groupIds,target_date:existing.original_date,group_id:base.group_id,start_time:base.start_time,end_time:base.end_time,room:base.room,teacher_id:base.teacher_id,teacher_name:base.teacher_name},id);
    const now=new Date().toISOString();
    await atlasScheduleCommit(db,revision,[db.prepare('UPDATE schedule_exceptions SET active=0,author_id=?,updated_at=? WHERE id=?').bind(user.id,now,id),atlasScheduleUpdate(db,user,{kind:'exception',id,groupId:base.group_id,groupIds,teacherId:base.teacher_id,previousTeacherId:existing.teacher_id,title:'Занятие восстановлено',body:base.subject+' · '+atlasActivityDateText(existing.original_date)+' · '+base.start_time+'–'+base.end_time+' · '+base.room,date:existing.original_date})]);
    return atlasJson({ok:true,restored:true,exception:atlasCalendarException({...existing,active:0,updated_at:now,author_id:user.id})});
  }
  return null;
}

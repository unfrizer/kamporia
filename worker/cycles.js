// A university defines its own two-week anchor; calendar years never reset the cycle.
const ATLAS_CYCLE_PRESETS={numbered:['1-я неделя','2-я неделя'],upper:['Верхняя','Нижняя'],parity:['Нечётная','Чётная']};
function atlasCycleDefault(){return {enabled:false,mode:'numbered',calculation:'anchor',firstLabel:'1-я неделя',secondLabel:'2-я неделя',anchorDate:'1970-01-05',anchorType:1,updatedAt:''};}
function atlasCycleConfigValue(r){return r?{enabled:Boolean(r.enabled),mode:r.mode,calculation:r.calculation||'anchor',firstLabel:r.first_label,secondLabel:r.second_label,anchorDate:r.anchor_date,anchorType:r.anchor_type,updatedAt:r.updated_at}:atlasCycleDefault();}
async function atlasCycleConfig(db){return atlasCycleConfigValue(await db.prepare('SELECT * FROM schedule_cycle_config WHERE id=1').first());}
function atlasCycleMonday(date){return atlasDateAdd(date,-((atlasCalendarWeekday(date)+6)%7));}
function atlasCalendarWeekNumber(date){const d=new Date(date+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+4-(d.getUTCDay()||7));return Math.ceil(((d-new Date(Date.UTC(d.getUTCFullYear(),0,1)))/86400000+1)/7);}
function atlasCycleWeek(config,date){const monday=atlasCycleMonday(date),weeks=config.calculation==='calendar'?atlasCalendarWeekNumber(monday)-atlasCalendarWeekNumber(config.anchorDate):Math.round((Date.parse(monday+'T12:00:00Z')-Date.parse(config.anchorDate+'T12:00:00Z'))/604800000),type=((weeks+config.anchorType-1)%2+2)%2+1;return {enabled:config.enabled,type,key:type===1?'first':'second',label:type===1?config.firstLabel:config.secondLabel,weekStart:monday,calendarNumber:atlasCalendarWeekNumber(monday)};}
function atlasCycleMatches(row,date,config){return !config.enabled||!row.week_pattern||row.week_pattern==='all'||row.week_pattern===atlasCycleWeek(config,date).key;}
function atlasCyclePatternsOverlap(a='all',b='all'){return a==='all'||b==='all'||a===b;}
async function atlasScheduleRevision(db){return (await db.prepare('SELECT revision FROM schedule_revision WHERE id=1').first()).revision;}
async function atlasScheduleCommit(db,revision,statements){
 try{return await db.batch([db.prepare('UPDATE schedule_revision SET revision=CASE WHEN revision=? THEN revision+1 ELSE -1 END WHERE id=1').bind(revision),...statements]);}
 catch(error){if(/schedule_revision_valid/.test(String(error.message)+' '+String(error.cause?.message||'')))atlasFail(409,'Расписание уже изменилось. Обновите данные и повторите сохранение.');throw error;}
}
function atlasLessonGroupIds(row){const ids=row?.groupIds||row?._group_ids||(row?.group_ids_json?JSON.parse(row.group_ids_json):null);return ids?.length?[...new Set(ids)]:[row?.group_id||row?.groupId].filter(Boolean);}
function atlasLessonHasGroup(row,id){return atlasLessonGroupIds(row).includes(id);}
async function atlasGroupsForLesson(db,row){const rows=(await db.prepare('SELECT group_id FROM lesson_groups WHERE lesson_id=? ORDER BY group_id').bind(row.id).all()).results;return rows.length?rows.map(r=>r.group_id):atlasLessonGroupIds(row);}
async function atlasCycleBookingConflict(db,lesson,date){
 const start=new Date(date+'T'+lesson.startTime+':00+03:00').toISOString(),end=new Date(date+'T'+lesson.endTime+':00+03:00').toISOString();
 const meeting=await db.prepare("SELECT s.id FROM campus_slots s JOIN campus_bookings b ON b.slot_id=s.id JOIN users u ON u.id=b.user_id WHERE s.status='active' AND b.status='confirmed' AND s.starts_at<? AND s.ends_at>? AND (s.owner_id=? OR u.group_id IN (SELECT value FROM json_each(?))) LIMIT 1").bind(end,start,lesson.teacherId||null,JSON.stringify(atlasLessonGroupIds(lesson))).first();
 if(meeting)atlasFail(409,'В это время уже есть подтверждённая консультация преподавателя или студента выбранных групп.');
}
async function atlasValidateLessonGroups(db,body,fallback){const input=body.groupIds??(body.groupId?[body.groupId]:fallback);if(!Array.isArray(input)||!input.length||input.some(id=>typeof id!=='string'||!id.trim()))atlasFail(400,'Выберите хотя бы одну учебную группу.');const ids=[...new Set(input)];const count=await db.prepare('SELECT COUNT(*) AS n FROM groups WHERE id IN (SELECT value FROM json_each(?))').bind(JSON.stringify(ids)).first();if(count.n!==ids.length)atlasFail(404,'Одна из групп не найдена.');return ids;}
function atlasLessonGroupsStatement(db,id,ids){return db.prepare('INSERT INTO lesson_groups(lesson_id,group_id) SELECT ?,value FROM json_each(?)').bind(id,JSON.stringify(ids));}
function atlasScheduleUpdate(db,user,data){
 const groups=[...new Set([...(data.groupIds||[]),...(data.previousGroupIds||[]),data.groupId,data.previousGroupId].filter(Boolean))];
 return db.prepare('INSERT INTO schedule_updates(id,entity_kind,entity_id,group_id,previous_group_id,teacher_id,previous_teacher_id,actor_id,title,body,lesson_date,created_at,group_ids_json) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(),data.kind,data.id,data.groupId||null,data.previousGroupId||null,data.teacherId||null,data.previousTeacherId||null,user.id,data.title,data.body,data.date||null,new Date().toISOString(),JSON.stringify(groups));
}
function atlasCycleNextDate(row,config){const today=atlasMoscowDate().toISOString().slice(0,10);for(let n=0;n<21;n++){const date=atlasDateAdd(today,n);if(atlasCalendarWeekday(date)===Number(row.weekday)&&atlasCycleMatches(row,date,config))return date;}return today;}
function atlasSingleLesson(row,date,status){
 return {...atlasLesson(row),baseTeacherId:row.teacher_id,baseLessonId:row.id,date,originalDate:row.single_original_date||row.single_date,targetDate:row.single_date,singleDate:row.single_date,status,changed:true,changeNote:row.change_note|| (status==='cancelled'?'Разовое занятие отменено':status==='moved-away'?'Перенос разового занятия на '+row.single_date:status==='moved'?'Разовое занятие перенесено':'Добавлено разовое занятие')};
}
async function atlasOccurrenceOptions(db,user){
 atlasRole(user,'teacher','admin');const options=await atlasHomeworkOptions(db,user);
 return {...options,groups:user.role==='admin'?(await db.prepare('SELECT id,name FROM groups ORDER BY name').all()).results:options.groups,teachers:user.role==='admin'?await atlasTeachers(db):[{id:user.id,name:user.name}],teacherId:user.role==='teacher'?user.id:null};
}
async function atlasOccurrenceWrite(db,user,body,existing=null,expectedRevision=null){
 atlasRole(user,'teacher','admin');const revision=expectedRevision??await atlasScheduleRevision(db);
 if(existing&&user.role==='teacher'&&existing.teacher_id!==user.id)atlasFail(403,'Изменять можно только свои занятия.');
 const oldGroups=existing?atlasLessonGroupIds(existing):[],groupIds=await atlasValidateLessonGroups(db,body,oldGroups),groupId=existing?.group_id||groupIds[0],subject=atlasString(body.subject??existing?.subject,'Дисциплина',120);
 if(existing&&(JSON.stringify([...groupIds].sort())!==JSON.stringify([...oldGroups].sort())||subject!==existing.subject))atlasFail(400,'Группы и дисциплина разового занятия не меняются. Создайте новую пару.');
 if(user.role==='teacher'&&!existing){const n=await db.prepare('SELECT COUNT(DISTINCT group_id) AS n FROM teaching_assignments WHERE teacher_id=? AND subject=? AND group_id IN (SELECT value FROM json_each(?))').bind(user.id,subject,JSON.stringify(groupIds)).first();if(n.n!==groupIds.length)atlasFail(403,'Добавляйте занятия только по своим дисциплинам и группам.');}
 if(user.role==='teacher'&&body.teacherId!==undefined&&body.teacherId!==user.id)atlasFail(403,'Занятие можно назначить только себе.');
 const teacher=user.role==='teacher'?{id:user.id,name:user.name}:await atlasCalendarTeacher(db,body,existing||{});
 const date=atlasCalendarDate(body.targetDate??body.date??existing?.single_date,'Дата занятия'),action=body.action||'change';
 if(!['change','cancel','restore'].includes(action)||!existing&&action!=='change')atlasFail(400,'Некорректное действие с разовым занятием.');
 if(existing?.active===0&&action==='change')atlasFail(409,'Сначала восстановите отменённое занятие.');
 const active=action==='cancel'?0:1,now=new Date().toISOString();
 const row={...existing,_group_ids:groupIds,id:existing?.id||crypto.randomUUID(),group_id:groupId,weekday:atlasCalendarWeekday(date),start_time:atlasString(body.startTime??existing?.start_time,'Начало',5),end_time:atlasString(body.endTime??existing?.end_time,'Конец',5),subject,type:atlasString(body.type??existing?.type??'Практика','Тип занятия',40),room:atlasString(body.room??existing?.room,'Аудитория',80),teacher_id:teacher.id,teacher_name:teacher.name,changed:1,change_note:atlasString(body.note??existing?.change_note??'','Комментарий',300,0),week_pattern:'all',single_date:date,single_original_date:existing?.single_original_date||date,active,author_id:existing?.author_id||user.id,created_at:existing?.created_at||now,updated_at:now};
 atlasCalendarTimes(row.start_time,row.end_time);
 if(active)await atlasCalendarConflict(db,{lesson_id:row.id,original_date:row.single_original_date,target_date:date,group_id:groupId,_group_ids:groupIds,start_time:row.start_time,end_time:row.end_time,room:row.room,teacher_id:row.teacher_id,teacher_name:row.teacher_name});
 const title=!existing?'Добавлено занятие':action==='cancel'?'Занятие отменено':action==='restore'?'Занятие восстановлено':'Разовое занятие изменено';
 const columns=['id','group_id','weekday','start_time','end_time','subject','type','room','teacher_id','teacher_name','changed','change_note','week_pattern','single_date','single_original_date','active','author_id','created_at','updated_at'];
 await atlasScheduleCommit(db,revision,[db.prepare(`INSERT INTO lessons(${columns.join(',')}) VALUES(${columns.map(()=>'?').join(',')}) ON CONFLICT(id) DO UPDATE SET weekday=excluded.weekday,start_time=excluded.start_time,end_time=excluded.end_time,room=excluded.room,teacher_id=excluded.teacher_id,teacher_name=excluded.teacher_name,type=excluded.type,change_note=excluded.change_note,single_date=excluded.single_date,active=excluded.active,updated_at=excluded.updated_at`).bind(...columns.map(k=>row[k])),db.prepare('DELETE FROM lesson_groups WHERE lesson_id=?').bind(row.id),atlasLessonGroupsStatement(db,row.id,groupIds),atlasScheduleUpdate(db,user,{kind:'occurrence',id:row.id,groupId,groupIds,teacherId:row.teacher_id,previousTeacherId:existing?.teacher_id,title,body:subject+' · '+atlasActivityDateText(date)+' · '+row.start_time+'–'+row.end_time+' · '+row.room+(row.change_note?' — '+row.change_note:''),date})]);
 return atlasSingleLesson(row,date,active?'added':'cancelled');
}
async function atlasCycleTemplateWrite(db,user,body){
 atlasRole(user,'admin');const revision=await atlasScheduleRevision(db),config=await atlasCycleConfig(db);
 const id=body.id?atlasString(body.id,'Занятие',80):crypto.randomUUID(),existing=body.id?await db.prepare('SELECT l.*,(SELECT json_group_array(group_id) FROM lesson_groups lg WHERE lg.lesson_id=l.id) AS group_ids_json FROM lessons l WHERE id=?').bind(id).first():null;
 const groupIds=await atlasValidateLessonGroups(db,body,existing?atlasLessonGroupIds(existing):null),groupId=groupIds[0];
 if(body.id&&!existing)atlasFail(404,'Занятие не найдено.');if(existing?.single_date)atlasFail(400,'Для разового занятия используйте изменение по дате.');
 const weekday=Number(body.weekday);if(!Number.isInteger(weekday)||weekday<0||weekday>6)atlasFail(400,'Некорректный день недели.');
 const startTime=atlasString(body.startTime,'Начало',5),endTime=atlasString(body.endTime,'Конец',5);atlasCalendarTimes(startTime,endTime);
 const subject=atlasString(body.subject,'Дисциплина',120),type=atlasString(body.type,'Тип занятия',40),room=atlasString(body.room,'Аудитория',80),weekPattern=body.weekPattern??existing?.week_pattern??'all';
 if(!['all','first','second'].includes(weekPattern)||!config.enabled&&weekPattern!=='all')atlasFail(400,'Сначала настройте чередование недель или выберите каждую неделю.');
 const teacher=await atlasCalendarTeacher(db,body,existing||{}),candidate={id,groupId,groupIds,weekday,subject,type,startTime,endTime,room,teacherId:teacher.id,teacherName:teacher.name,weekPattern};
 await atlasCalendarValidateTemplate(db,existing,candidate);await atlasScheduleConflict(db,candidate);
 const changed=body.changed?1:0,changeNote=atlasString(body.changeNote||'','Изменение',300,0),now=new Date().toISOString();
 await atlasScheduleCommit(db,revision,[db.prepare(`INSERT INTO lessons(id,group_id,weekday,start_time,end_time,subject,type,room,teacher_id,teacher_name,changed,change_note,week_pattern,author_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET group_id=excluded.group_id,weekday=excluded.weekday,start_time=excluded.start_time,end_time=excluded.end_time,subject=excluded.subject,type=excluded.type,room=excluded.room,teacher_id=excluded.teacher_id,teacher_name=excluded.teacher_name,changed=excluded.changed,change_note=excluded.change_note,week_pattern=excluded.week_pattern,updated_at=excluded.updated_at`).bind(id,groupId,weekday,startTime,endTime,subject,type,room,teacher.id,teacher.name,changed,changeNote,weekPattern,user.id,now,now),db.prepare('DELETE FROM lesson_groups WHERE lesson_id=?').bind(id),atlasLessonGroupsStatement(db,id,groupIds),atlasScheduleUpdate(db,user,{kind:'lesson',id,groupId,groupIds,previousGroupIds:existing?atlasLessonGroupIds(existing):[],previousGroupId:existing?.group_id,teacherId:teacher.id,previousTeacherId:existing?.teacher_id,title:existing?'Изменён недельный шаблон':'Добавлено занятие в шаблон',body:subject+' · '+startTime+'–'+endTime+' · '+room+' · '+(weekPattern==='all'?'Каждую неделю':weekPattern==='first'?config.firstLabel:config.secondLabel),date:atlasCycleNextDate({weekday,week_pattern:weekPattern},config)})]);
 return {lesson:{id,groupId,groupIds,weekday,startTime,endTime,subject,type,room,teacher:teacher.name,teacherId:teacher.id,changed:Boolean(changed),changeNote,weekPattern},created:!existing};
}
async function atlasCycleValidateConfig(db,next){
 const raw=await atlasCalendarRows(db);
 if(!next.enabled&&raw.base.some(r=>!r.single_date&&r.week_pattern!=='all'))atlasFail(409,'В шаблоне есть пары для разных недель. Сначала переведите их в «Каждую неделю» или удалите.');
 for(const e of raw.exceptions){const row=raw.base.find(r=>r.id===e.lesson_id);if(row&&!atlasCycleMatches(row,e.original_date,next))atlasFail(409,'Новая опорная неделя исключает пару с разовым изменением на '+e.original_date+'. Сначала восстановите её.');}
 const dates=new Set([...raw.exceptions.flatMap(e=>[e.original_date,e.target_date]),...raw.base.filter(r=>r.single_date).flatMap(r=>[r.single_date,r.single_original_date])]);
 const meetings=(await db.prepare("SELECT s.starts_at FROM campus_slots s JOIN campus_bookings b ON b.slot_id=s.id WHERE b.status='confirmed' AND s.status='active' AND s.ends_at>?").bind(new Date().toISOString()).all()).results;for(const meeting of meetings)dates.add(campusDay(meeting.starts_at));
 for(const date of dates){const lessons=atlasCalendarExpand(raw.base,raw.exceptions,date,date,next).filter(l=>!calendarCycleUnavailable(l));for(let i=0;i<lessons.length;i++){for(let j=i+1;j<lessons.length;j++)if(atlasCycleLessonConflict(lessons[i],lessons[j]))atlasFail(409,'Настройки создают пересечение на '+date+': '+lessons[i].subject+' и '+lessons[j].subject+'.');await atlasCycleBookingConflict(db,lessons[i],date);}}
}
function calendarCycleUnavailable(row){return ['cancelled','moved-away'].includes(row.status);}
function atlasCycleLessonConflict(a,b){const normal=v=>String(v||'').normalize('NFKC').trim().toLocaleLowerCase('ru');return a.startTime<b.endTime&&a.endTime>b.startTime&&(atlasLessonGroupIds(a).some(id=>atlasLessonHasGroup(b,id))||normal(a.room)===normal(b.room)||a.teacherId&&!a.teacherId.startsWith('name:')&&a.teacherId===b.teacherId||normal(a.teacher)===normal(b.teacher));}
async function atlasCycleActivity(db,user,cutoff){
 let sql='SELECT * FROM schedule_updates WHERE created_at>=?',args=[cutoff];
 if(user.role==='student'){sql+=" AND (entity_kind='cycle' OR EXISTS(SELECT 1 FROM json_each(schedule_updates.group_ids_json) WHERE value=?))";args.push(user.group_id);}
 if(user.role==='teacher'){sql+=' AND (entity_kind=\'cycle\' OR teacher_id=? OR previous_teacher_id=?)';args.push(user.id,user.id);}
 const rows=(await db.prepare(sql+' ORDER BY created_at DESC,id DESC LIMIT 150').bind(...args).all()).results;
 return rows.map(r=>({kind:'schedule',entityKey:r.entity_kind+':'+r.entity_id,id:r.id,version:r.id,title:r.title,body:r.body,createdAt:r.created_at,visibleUntil:null,link:{view:'schedule',...(r.lesson_date?{date:r.lesson_date}:{}),id:r.entity_id}}));
}
async function handleCyclesApi(request,env,db,user,url){
 void env;const path=url.pathname,method=request.method;
 if(path==='/api/schedule-cycle'&&method==='GET'){const config=await atlasCycleConfig(db);return atlasJson({config,week:atlasCycleWeek(config,atlasMoscowDate().toISOString().slice(0,10))});}
 if(path==='/api/schedule-cycle'&&method==='PUT'){
  atlasRole(user,'admin');const revision=await atlasScheduleRevision(db),body=await atlasBody(request);
  if(typeof body.enabled!=='boolean'||!['numbered','upper','parity','custom'].includes(body.mode))atlasFail(400,'Выберите вариант чередования.');
  const labels=ATLAS_CYCLE_PRESETS[body.mode]||[atlasString(body.firstLabel,'Первая неделя',24),atlasString(body.secondLabel,'Вторая неделя',24)];
  if(labels[0].toLocaleLowerCase('ru')===labels[1].toLocaleLowerCase('ru'))atlasFail(400,'Названия недель должны различаться.');
  const anchor=atlasIsoDate(body.anchorDate,'Опорная дата'),anchorType=Number(body.anchorType),calculation=body.calculation||'anchor';if(![1,2].includes(anchorType))atlasFail(400,'Укажите тип опорной недели.');if(!['anchor','calendar'].includes(calculation))atlasFail(400,'Выберите способ подсчёта недель.');
  const next={enabled:body.enabled,mode:body.mode,calculation,firstLabel:labels[0],secondLabel:labels[1],anchorDate:atlasCycleMonday(anchor),anchorType,updatedAt:new Date().toISOString()};await atlasCycleValidateConfig(db,next);
  await atlasScheduleCommit(db,revision,[db.prepare('UPDATE schedule_cycle_config SET enabled=?,mode=?,calculation=?,first_label=?,second_label=?,anchor_date=?,anchor_type=?,updated_at=? WHERE id=1').bind(Number(next.enabled),next.mode,calculation,...labels,next.anchorDate,anchorType,next.updatedAt),atlasScheduleUpdate(db,user,{kind:'cycle',id:'config',title:'Настройки учебных недель изменены',body:next.enabled?labels.join(' / ')+'. '+(calculation==='calendar'?'Календарный подсчёт. ':'Непрерывный учебный цикл. ')+'Опорная неделя с '+next.anchorDate+' — '+labels[anchorType-1]+'.':'Расписание переведено на одинаковые недели.'})]);return atlasJson({config:next,week:atlasCycleWeek(next,atlasMoscowDate().toISOString().slice(0,10))});
 }
 if(path==='/api/schedule'&&method==='POST'){const result=await atlasCycleTemplateWrite(db,user,await atlasBody(request));return atlasJson({lesson:result.lesson},result.created?201:200);}
 if(/^\/api\/schedule\/[^/]+$/.test(path)&&method==='DELETE'){
  atlasRole(user,'admin');const revision=await atlasScheduleRevision(db),id=decodeURIComponent(path.split('/')[3]),row=await db.prepare('SELECT * FROM lessons WHERE id=?').bind(id).first();if(!row)atlasFail(404,'Занятие не найдено.');if(row.single_date)atlasFail(400,'Отмените разовое занятие по дате.');
  if(await db.prepare('SELECT id FROM schedule_exceptions WHERE lesson_id=? AND active=1 LIMIT 1').bind(id).first())atlasFail(409,'У занятия есть разовые изменения. Сначала восстановите исходные пары, затем удалите шаблон.');
  await atlasScheduleCommit(db,revision,[db.prepare('DELETE FROM lessons WHERE id=?').bind(id),atlasScheduleUpdate(db,user,{kind:'lesson',id,groupId:row.group_id,groupIds:await atlasGroupsForLesson(db,row),teacherId:row.teacher_id,title:'Занятие удалено из шаблона',body:row.subject+' · '+row.start_time+'–'+row.end_time+' · '+row.room,date:atlasCycleNextDate(row,await atlasCycleConfig(db))})]);return atlasJson({ok:true,id});
 }
 if(path==='/api/schedule-occurrence-options'&&method==='GET')return atlasJson(await atlasOccurrenceOptions(db,user));
 if(path==='/api/schedule-occurrences'&&method==='POST')return atlasJson({lesson:await atlasOccurrenceWrite(db,user,await atlasBody(request))},201);
 if(/^\/api\/schedule-occurrences\/[^/]+$/.test(path)&&method==='PATCH'){
  atlasRole(user,'teacher','admin');const revision=await atlasScheduleRevision(db),id=decodeURIComponent(path.split('/')[3]),row=await db.prepare('SELECT l.*,(SELECT json_group_array(group_id) FROM lesson_groups lg WHERE lg.lesson_id=l.id) AS group_ids_json FROM lessons l WHERE id=? AND single_date IS NOT NULL').bind(id).first();if(!row)atlasFail(404,'Разовое занятие не найдено.');return atlasJson({lesson:await atlasOccurrenceWrite(db,user,await atlasBody(request),row,revision)});
 }
 return null;
}

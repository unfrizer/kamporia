// Alternation, joint groups and staff-added dates: isolated localhost only.
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
const base=process.env.ATLAS_BASE_URL||'http://127.0.0.1:4198';if(!['127.0.0.1','localhost'].includes(new URL(base).hostname))throw Error('Isolated localhost copy required');
const accounts={a:['student.1',process.env.ATLAS_STUDENT_1_PASSWORD],b:['student.2',process.env.ATLAS_STUDENT_2_PASSWORD],t:['teacher',process.env.ATLAS_TEACHER_PASSWORD],admin:['admin',process.env.ATLAS_ADMIN_PASSWORD]};
if(Object.values(accounts).some(v=>!v[1]))throw Error('Passwords required in environment');
const cookies={},templates=[],singles=[],homework=[],fixtureGroups=[];let checks=0,exception;const marker='QA CYCLE '+Date.now();
function ok(v,m){assert.ok(v,m);checks++;}function eq(a,b,m){assert.deepEqual(a,b,m);checks++;}
async function req(who,path,method='GET',body,status=200){const r=await fetch(base+path,{method,signal:AbortSignal.timeout(20000),headers:{...(cookies[who]?{Cookie:cookies[who]}:{}),...(body!==undefined?{Origin:base,'Content-Type':'application/json'}:{})},body:body===undefined?undefined:JSON.stringify(body)});const data=await r.json();ok((Array.isArray(status)?status:[status]).includes(r.status),who+' '+method+' '+path+' '+r.status+': '+(data.error||''));for(const c of r.headers.getSetCookie())if(c.startsWith('atlas_session='))cookies[who]=c.split(';')[0];return data;}
const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Moscow',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
function add(date,n){const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);}function monday(date){return add(date,-((new Date(date+'T12:00:00Z').getUTCDay()+6)%7));}
const anchor=monday(today.slice(0,4)+'-12-28'),firstDate=add(anchor,6),secondDate=add(firstDate,7),currentMonday=monday(today);
async function schedule(who,date){const week=Math.round((Date.parse(monday(date))-Date.parse(currentMonday))/604800000);return req(who,'/api/schedule?week='+week);}
for(const [who,[login,password]]of Object.entries(accounts))await req(who,'/api/login','POST',{login,password});
await req('anon','/api/schedule-cycle','GET',undefined,401);await req('a','/api/schedule-occurrence-options','GET',undefined,403);
const initial=(await req('admin','/api/schedule-cycle')).config;
const config={enabled:true,mode:'numbered',anchorDate:add(anchor,2),anchorType:1};
for(const who of ['a','b','t'])await req(who,'/api/schedule-cycle','PUT',config,403);
await req('admin','/api/schedule-cycle','PUT',{...config,mode:'custom',firstLabel:'Одна',secondLabel:'Одна'},400);
await req('admin','/api/schedule-cycle','PUT',{...config,anchorType:3},400);
let setting=(await req('admin','/api/schedule-cycle','PUT',config)).config;eq(setting.anchorDate,anchor,'Anchor normalized to Monday');
eq((await schedule('a',anchor)).cycleWeek.label,'1-я неделя','First week at year boundary');eq((await schedule('a',add(anchor,7))).cycleWeek.label,'2-я неделя','Second week across New Year');eq((await schedule('a',add(anchor,-7))).cycleWeek.label,'2-я неделя','Weeks before anchor use normalized modulo');
await req('admin','/api/schedule-cycle','PUT',{...config,calculation:'invalid'},400);
await req('admin','/api/schedule-cycle','PUT',{...config,calculation:'calendar'});
const calendarEnd=(await schedule('a',anchor)).cycleWeek,calendarStart=(await schedule('a',add(anchor,7))).cycleWeek;
if(today.startsWith('2026')){eq(calendarEnd.calendarNumber,53,'2026 ends with calendar week 53');eq(calendarStart.calendarNumber,1,'2027 begins with calendar week 1');eq(calendarStart.label,'1-я неделя','Calendar counting can repeat the type after week 53');}
await req('admin','/api/schedule-cycle','PUT',config);
setting=(await req('admin','/api/schedule-cycle','PUT',{...config,mode:'upper',anchorType:2})).config;
eq((await schedule('a',anchor)).cycleWeek.label,'Нижняя','University can choose lower for anchor');eq((await schedule('a',add(anchor,7))).cycleWeek.label,'Верхняя','Upper follows lower');
await req('admin','/api/schedule-cycle','PUT',{...config,mode:'custom',firstLabel:'Неделя практики',secondLabel:'Неделя проектов'});
eq((await schedule('a',anchor)).cycleWeek.label,'Неделя практики','Custom names');
await req('admin','/api/schedule-cycle','PUT',{...config,mode:'parity',anchorType:2});eq((await schedule('a',anchor)).cycleWeek.label,'Чётная','Parity follows university anchor, not ISO week number');
await req('admin','/api/schedule-cycle','PUT',config);
const draft={groupId:'g1',groupIds:['g1','g2'],weekday:0,startTime:'22:00',endTime:'22:30',subject:marker+' Поток',type:'Лекция',room:'QA CYCLE общий зал',teacherId:'t1',weekPattern:'first'};
try{
 const first=(await req('admin','/api/schedule','POST',draft,201)).lesson;templates.push(first.id);eq(first.groupIds,['g1','g2'],'Shared class stores both groups');
 const second=(await req('admin','/api/schedule','POST',{...draft,groupIds:['g1'],subject:marker+' Вторая',weekPattern:'second'},201)).lesson;templates.push(second.id);
 for(const who of ['a','b']){const rows=(await schedule(who,firstDate)).lessons.filter(l=>l.id===first.id);eq(rows.length,1,'One shared record per student');eq(rows[0].groupIds,['g1','g2'],'Shared audience visible');ok(!(await schedule(who,secondDate)).lessons.some(l=>l.id===first.id),'First-week class absent on second week');}
 ok((await schedule('a',secondDate)).lessons.some(l=>l.id===second.id),'Second-week class appears');ok(!(await schedule('b',secondDate)).lessons.some(l=>l.id===second.id),'Other group excluded');
 await req('admin','/api/schedule','POST',{...draft,groupIds:['g2'],teacherId:null,teacher:'Другой преподаватель',room:'Другой зал'},409);
 await req('admin','/api/schedule','POST',{...draft,subject:'Любая неделя',weekPattern:'all'},409);
 await req('admin','/api/schedule-cycle','PUT',{...config,enabled:false},409);
 const hub=await req('b','/api/campus/subject?groupId=g2&subject='+encodeURIComponent(draft.subject));ok(hub.lessons.some(l=>l.id===first.id),'Subject hub includes second group');
 const hw=(await req('t','/api/homework','POST',{groupId:'g2',subject:draft.subject,date:firstDate,dueDate:add(firstDate,1),title:marker,body:'Задание участникам второй группы.'},201)).assignment;homework.push(hw.id);
 const body={lessonId:first.id,originalDate:firstDate,action:'change',targetDate:add(firstDate,1),startTime:'22:00',endTime:'22:30',room:'QA перенос потока',teacherId:'t1',note:marker};
 await req('t','/api/schedule-exceptions','POST',{...body,originalDate:secondDate,targetDate:secondDate},400);
 exception=(await req('t','/api/schedule-exceptions','POST',body,201)).exception;
 for(const who of ['a','b'])ok((await schedule(who,add(firstDate,1))).lessons.some(l=>l.id===first.id&&l.date===add(firstDate,1)&&l.status==='moved'),'Move reaches every group');
 await req('admin','/api/schedule-cycle','PUT',{...config,anchorType:2},409);
 await req('admin','/api/schedule','POST',{...draft,id:first.id,groupIds:['g1']},409);
 await req('t','/api/schedule-exceptions/'+exception.id,'DELETE',{});exception=null;
 await req('admin','/api/schedule','POST',{...draft,id:first.id,room:'QA CYCLE обновлённый зал'});
 for(const who of ['a','b'])eq((await schedule(who,firstDate)).lessons.find(l=>l.id===first.id)?.room,'QA CYCLE обновлённый зал','Room edit reaches every group');
 const occurrences={groupIds:['g1','g2'],subject:draft.subject,type:'Практика',date:secondDate,startTime:'23:45',endTime:'23:59',room:'QA разовая 1000-А',teacherId:'t1',note:marker};
 await req('a','/api/schedule-occurrences','POST',occurrences,403);await req('t','/api/schedule-occurrences','POST',{...occurrences,teacherId:'a1'},403);await req('t','/api/schedule-occurrences','POST',{...occurrences,subject:'Не моя дисциплина'},403);
 const added=(await req('t','/api/schedule-occurrences','POST',occurrences,201)).lesson;singles.push(added.id);
 for(const who of ['a','b']){eq((await schedule(who,secondDate)).lessons.filter(l=>l.id===added.id).length,1,'Added class visible in both groups');ok(!(await schedule(who,add(secondDate,7))).lessons.some(l=>l.id===added.id),'Added class does not repeat');}
 await req('t','/api/schedule-occurrences/'+added.id,'PATCH',{room:'QA новое помещение',note:marker+' исправлено'});
 await req('t','/api/schedule-occurrences/'+added.id,'PATCH',{action:'cancel'});
 for(const who of ['a','b']){const notifications=(await req(who,'/api/notifications')).notifications.filter(n=>n.kind==='schedule'&&n.link?.id===added.id);ok(notifications.some(n=>n.title==='Добавлено занятие'),'Offline recipient retains creation notification');ok(notifications.some(n=>n.title==='Разовое занятие изменено'),'Offline recipient retains update notification');ok(notifications.some(n=>n.title==='Занятие отменено'),'Offline recipient retains cancellation notification');eq((await schedule(who,secondDate)).lessons.find(l=>l.id===added.id)?.status,'cancelled','Cancellation visible');}
 const competing=(await req('admin','/api/schedule-occurrences','POST',{...occurrences,subject:marker+' Занято',teacherId:null,teacher:'Другой преподаватель'},201)).lesson;singles.push(competing.id);
 await req('t','/api/schedule-occurrences/'+competing.id,'PATCH',{action:'cancel'},403);await req('t','/api/schedule-occurrences/'+added.id,'PATCH',{action:'restore'},409);
 await req('admin','/api/schedule-occurrences/'+competing.id,'PATCH',{action:'cancel'});await req('t','/api/schedule-occurrences/'+added.id,'PATCH',{action:'restore'});
 await req('t','/api/schedule-occurrences/'+added.id,'PATCH',{targetDate:add(secondDate,1)});
 for(const who of ['a','b']){ok((await schedule(who,secondDate)).lessons.some(l=>l.id===added.id&&l.status==='moved-away'),'Original date retains move notice');ok((await schedule(who,add(secondDate,1))).lessons.some(l=>l.id===added.id&&l.date===add(secondDate,1)&&l.status==='moved'),'New date receives moved class');}
 const raceBody={...occurrences,groupIds:['g1'],date:add(secondDate,2),startTime:'22:45',endTime:'23:00',subject:draft.subject,note:marker+' гонка'};
 const race=await Promise.all([req('t','/api/schedule-occurrences','POST',raceBody,[201,409]),req('t','/api/schedule-occurrences','POST',raceBody,[201,409])]);
 eq(race.filter(r=>r.lesson).length,1,'Only one concurrent conflicting creation succeeds');if(race.find(r=>r.lesson))singles.push(race.find(r=>r.lesson).lesson.id);
 eq((await schedule('a',raceBody.date)).lessons.filter(l=>l.changeNote===raceBody.note).length,1,'No duplicate after race');
 if(process.env.ATLAS_QA_DATABASE){
  const db=new DatabaseSync(process.env.ATLAS_QA_DATABASE);for(let n=0;n<120;n++){const id='qa-cycle-group-'+n;db.prepare('INSERT INTO groups(id,name,faculty,direction,course,description) VALUES(?,?,?,?,?,?)').run(id,'Тестовая группа '+n,'Тестовый факультет','Тестовое направление',1,'Локальная проверка');fixtureGroups.push(id);}db.close();
  const ids=['g1','g2',...fixtureGroups],wide=(await req('admin','/api/schedule','POST',{...draft,groupIds:ids,startTime:'21:30',endTime:'21:45',weekPattern:'all',subject:marker+' Без лимита'},201)).lesson;templates.push(wide.id);eq(wide.groupIds.length,122,'No arbitrary group count cap');
  for(const who of ['a','b'])eq((await schedule(who,firstDate)).lessons.filter(l=>l.id===wide.id).length,1,'Many-group lesson remains one record');
  const classOther=(await req('admin','/api/schedule','POST',{...draft,groupIds:[fixtureGroups.at(-1)],startTime:'21:30',endTime:'21:45',room:'Иная аудитория',teacherId:null,teacher:'Иной преподаватель',subject:marker+' Конфликт последней группы'},409));ok(classOther.error,'Conflict checks the last selected group');
 }
 const before=(await req('b','/api/notifications')).notifications.filter(n=>n.kind==='schedule'&&n.link?.id===added.id).map(n=>n.id);const again=(await req('b','/api/notifications')).notifications.filter(n=>n.kind==='schedule'&&n.link?.id===added.id).map(n=>n.id);eq(again,before,'Repeated reads do not duplicate notifications');
}finally{
 if(exception)await req('admin','/api/schedule-exceptions/'+exception.id,'DELETE',{});
 for(const id of homework)await req('admin','/api/homework/'+id,'DELETE',{});
 for(const id of singles)await req('admin','/api/schedule-occurrences/'+id,'PATCH',{action:'cancel'});
 for(const id of templates.reverse())await req('admin','/api/schedule/'+id,'DELETE',{});
 // Remove disposable one-offs and their audience before deleting fixture groups.
 if(process.env.ATLAS_QA_DATABASE){const db=new DatabaseSync(process.env.ATLAS_QA_DATABASE);for(const id of singles){db.prepare('DELETE FROM lesson_groups WHERE lesson_id=?').run(id);db.prepare('DELETE FROM lessons WHERE id=?').run(id);}for(const id of fixtureGroups)db.prepare('DELETE FROM groups WHERE id=?').run(id);db.close();}
 await req('admin','/api/schedule-cycle','PUT',{...initial,anchorDate:initial.anchorDate.startsWith('20')?initial.anchorDate:currentMonday});
}
console.log('PASS: '+checks+' cycle checks: custom anchor, New Year, multi-group lessons, one-off staff changes, durable notifications and write races.');

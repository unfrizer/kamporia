// Calendar integration checks. Run against a demo database; created lessons are removed in finally.
import assert from 'node:assert/strict';
let config={};
if(process.argv.includes('--stdin')){
 if(process.stdin.isTTY)process.stdin.setRawMode(true);process.stdin.setEncoding('utf8');
 console.log('Ready for calendar QA JSON on stdin (input is hidden).');
 config=JSON.parse(await new Promise(resolve=>{let value='';process.stdin.on('data',function read(chunk){value+=chunk;if(/[\r\n]/.test(value)){process.stdin.removeListener('data',read);process.stdin.pause();resolve(value.trim());}});process.stdin.resume();}));
}
const base=config.base||process.env.ATLAS_BASE_URL||'http://127.0.0.1:4183';
if(config.bypass)assert.equal(base,'https://atlas-dekanat-2026.topcup.chatgpt.site');
const accounts=config.accounts||{'student.1':process.env.ATLAS_STUDENT_1_PASSWORD,'student.2':process.env.ATLAS_STUDENT_2_PASSWORD,teacher:process.env.ATLAS_TEACHER_PASSWORD,admin:process.env.ATLAS_ADMIN_PASSWORD};
for(const [name,password] of Object.entries(accounts))assert.ok(password,'Missing password for '+name);
const sessions={},lessons=[],marker='[QA calendar '+new Date().toISOString()+']';let checks=0;
function check(value,message){assert.ok(value,message);checks++;}
function equal(value,expected,message){assert.equal(value,expected,message);checks++;if(config.bypass&&checks%20===0)console.log('Calendar QA: '+checks+' checks passed.');}
async function call(path,{login,method='GET',body}={}){
 const response=await fetch(base+path,{method,redirect:'manual',signal:AbortSignal.timeout(30000),headers:{...(config.bypass?{'OAI-Sites-Authorization':'Bearer '+config.bypass}:{}),...(sessions[login]?{cookie:sessions[login]}:{}),...(body!==undefined?{'content-type':'application/json'}:{}),...(!['GET','HEAD'].includes(method)?{origin:base}:{})},body:body===undefined?undefined:JSON.stringify(body)});
 const data=await response.json();return {status:response.status,data,cookie:response.headers.get('set-cookie')?.split(';')[0]};
}
async function expect(path,options,status=200){const result=await call(path,options);equal(result.status,status,(options?.login||'anonymous')+' '+(options?.method||'GET')+' '+path+' '+JSON.stringify(result.data));return result.data;}
function add(date,days){const value=new Date(date+'T12:00:00Z');value.setUTCDate(value.getUTCDate()+days);return value.toISOString().slice(0,10);}
const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Moscow',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const weekday=new Date(today+'T12:00:00Z').getUTCDay(),monday=add(today,-((weekday+6)%7)),sunday=add(monday,6),nextMonday=add(monday,7);
let lesson,exception;
try {
 for(const [login,password] of Object.entries(accounts)){const response=await call('/api/login',{method:'POST',body:{login,password}});equal(response.status,200,'Login '+login);sessions[login]=response.cookie;}
 await expect('/api/schedule?template=1',{login:'student.1'},403);
 await expect('/api/schedule?template=1',{login:'teacher'},403);
 const draft={groupId:'g1',weekday:0,startTime:'20:00',endTime:'20:30',subject:marker,type:'Консультация',room:'QA CAL-901',teacherId:'t1',teacher:'Елена Белова',changed:false,changeNote:''};
 lesson=(await expect('/api/schedule',{login:'admin',method:'POST',body:draft},201)).lesson;lessons.push(lesson.id);
 const body={lessonId:lesson.id,originalDate:sunday,action:'change',targetDate:sunday,startTime:'22:00',endTime:'22:30',room:'QA CAL-902',teacherId:'t1',note:marker+' Только одна дата'};
 for(const login of ['student.1','student.2'])await expect('/api/schedule-exceptions',{login,method:'POST',body},403);
 await expect('/api/schedule-exceptions',{login:'admin',method:'POST',body:{...body,originalDate:add(sunday,1)}},400);
 await expect('/api/schedule-exceptions',{login:'admin',method:'POST',body:{...body,targetDate:'2026-02-30'}},400);
 await expect('/api/schedule-exceptions',{login:'admin',method:'POST',body:{...body,endTime:'21:00'}},400);
 exception=(await expect('/api/schedule-exceptions',{login:'teacher',method:'POST',body},201)).exception;
 equal(exception.originalDate,sunday,'Original occurrence preserved');equal(exception.targetDate,sunday,'Same-date edit target');
 await expect('/api/schedule-exceptions',{login:'admin',method:'POST',body},409);
 let schedule=(await expect('/api/schedule?week=0',{login:'student.1'})).lessons;
 const changed=schedule.find(item=>item.id===lesson.id&&item.date===sunday);
 equal(changed?.status,'changed','Student sees dated change');equal(changed?.startTime,'22:00','Changed time visible');equal(changed?.room,'QA CAL-902','Changed room visible');equal(changed?.exceptionId,exception.id,'Dated record identity');
 const nextWeek=(await expect('/api/schedule?week=1',{login:'student.1'})).lessons.find(item=>item.id===lesson.id&&item.date===add(sunday,7));
 equal(nextWeek?.startTime,'20:00','Next week retains template');equal(nextWeek?.status,'scheduled','Next week is unchanged');
 const template=(await expect('/api/schedule?template=1',{login:'admin'})).lessons.find(item=>item.id===lesson.id);
 equal(template?.startTime,'20:00','Template time unchanged');equal(template?.room,'QA CAL-901','Template room unchanged');
 check(!(await expect('/api/schedule',{login:'student.2'})).lessons.some(item=>item.id===lesson.id),'Other group does not receive lesson');
 await expect('/api/schedule-exceptions/'+exception.id,{login:'teacher',method:'PATCH',body:{note:marker+' Уточнение преподавателя'}});
 await expect('/api/schedule-exceptions/'+exception.id,{login:'admin',method:'PATCH',body:{targetDate:nextMonday,startTime:'21:00',endTime:'21:30',note:marker+' Cross-week move'}});
 const origin=(await expect('/api/schedule?week=0',{login:'student.1'})).lessons.find(item=>item.id===lesson.id&&item.date===sunday);
 equal(origin?.status,'moved-away','Source notice remains');equal(origin?.startTime,'20:00','Source shows original time');equal(origin?.targetDate,nextMonday,'Source points to new date');
 const target=(await expect('/api/schedule?week=1',{login:'student.1'})).lessons.find(item=>item.id===lesson.id&&item.date===nextMonday);
 equal(target?.status,'moved','Incoming cross-week pair appears');equal(target?.startTime,'21:00','Incoming move time');equal(target?.originalDate,sunday,'Incoming move remembers original date');
 const byTeacher=(await expect('/api/schedule?week=1&teacherId=t1',{login:'student.2'})).lessons;
 check(byTeacher.some(item=>item.id===lesson.id&&item.date===nextMonday),'Other group can deliberately view teacher timetable');
 await expect('/api/schedule-exceptions/'+exception.id,{login:'admin',method:'PATCH',body:{teacherId:null,teacher:'QA приглашённый преподаватель'}});
 const replacement=(await expect('/api/schedule?week=1&teacherId='+encodeURIComponent('name:QA приглашённый преподаватель'),{login:'student.2'})).lessons;
 check(replacement.some(item=>item.id===lesson.id&&item.date===nextMonday),'Replacement teacher timetable includes incoming occurrence');
 check(!(await expect('/api/schedule?week=1&teacherId=t1',{login:'teacher'})).lessons.some(item=>item.id===lesson.id&&item.date===nextMonday),'Original teacher is not teaching replacement occurrence');
 await expect('/api/schedule-exceptions/'+exception.id,{login:'admin',method:'PATCH',body:{teacherId:'t1'}});
 // Ordinary recurring conflict checks do not catch this date-specific occupancy.
 await expect('/api/schedule',{login:'admin',method:'POST',body:{...draft,groupId:'g2',weekday:1,startTime:'21:10',endTime:'21:40',subject:marker+' conflict',room:'QA CAL-903'}},409);
 await expect('/api/schedule',{login:'admin',method:'POST',body:{...draft,id:lesson.id,weekday:1}},409);
 // A different teacher in a different room still conflicts for the same group.
 const second=(await expect('/api/schedule',{login:'admin',method:'POST',body:{...draft,groupId:'g2',weekday:2,startTime:'20:00',endTime:'20:30',subject:marker+' second',room:'QA CAL-904',teacherId:null,teacher:'QA Преподаватель'}},201)).lesson;lessons.push(second.id);
 await expect('/api/schedule-exceptions',{login:'admin',method:'POST',body:{lessonId:second.id,originalDate:add(monday,1),action:'change',targetDate:nextMonday,startTime:'21:10',endTime:'21:20',room:'QA CAL-902',teacherId:null,teacher:'Другой QA преподаватель'}},409);
 // Restore removes only the dated change and is audited as inactive.
 await expect('/api/schedule-exceptions/'+exception.id,{login:'student.1',method:'DELETE'},403);
 const restored=await expect('/api/schedule-exceptions/'+exception.id,{login:'admin',method:'DELETE'});
 equal(restored.exception.active,false,'Restoration retains inactive audit record');
 equal((await expect('/api/schedule?week=0',{login:'student.1'})).lessons.find(item=>item.id===lesson.id)?.startTime,'20:00','Restored source follows template');
 check(!(await expect('/api/schedule?week=1',{login:'student.1'})).lessons.some(item=>item.id===lesson.id&&item.date===nextMonday),'Restored move disappears from target');
 const cancel=(await expect('/api/schedule-exceptions',{login:'admin',method:'POST',body:{lessonId:lesson.id,originalDate:sunday,action:'cancel',note:marker+' Cancel'}},201)).exception;
 equal(cancel.id,exception.id,'Reactivation reuses occurrence audit identity');
 equal((await expect('/api/schedule?week=0',{login:'student.1'})).lessons.find(item=>item.id===lesson.id)?.status,'cancelled','Cancellation visibly marked');
 const occupied=(await expect('/api/schedule-exceptions',{login:'admin',method:'POST',body:{lessonId:second.id,originalDate:add(monday,1),action:'change',targetDate:sunday,startTime:'20:00',endTime:'20:30',room:'QA CAL-901',teacherId:null,teacher:'QA Преподаватель'}},201)).exception;
 await expect('/api/schedule-exceptions/'+cancel.id,{login:'admin',method:'DELETE'},409);
 await expect('/api/schedule-exceptions/'+occupied.id,{login:'admin',method:'DELETE'});
 await expect('/api/schedule-exceptions/'+cancel.id,{login:'admin',method:'DELETE'});
 const list=await expect('/api/schedule-exceptions?from='+monday+'&to='+add(monday,13),{login:'admin'});
 check(!list.exceptions.some(item=>[cancel.id,occupied.id].includes(item.id)),'Restored audit entries not treated as active exceptions');
 await expect('/api/schedule-exceptions?from='+monday+'&to='+add(monday,13),{login:'student.1'},403);
 const now=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Moscow',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date());
 for(const login of ['student.1','teacher','admin']) {
  const dashboard=await expect('/api/dashboard',{login}),next=dashboard.nextLesson;
  if(next){check(next.date>=today,'Next pair is not in the past');check(!['cancelled','moved-away'].includes(next.status),'Next pair is an actual class');if(next.date===today)check(next.endTime>now,'Ended pair is not shown as next');}
 }
} finally {
 for(const id of lessons.reverse())await expect('/api/schedule/'+id,{login:'admin',method:'DELETE'});
}
console.log(`PASS: ${checks} calendar checks. ${marker}`);

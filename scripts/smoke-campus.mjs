// Mutating integration tests: run on an isolated localhost copy, never production.
import assert from 'node:assert/strict';
const base=process.env.ATLAS_BASE_URL||'http://127.0.0.1:4198';
if(!['127.0.0.1','localhost'].includes(new URL(base).hostname))throw Error('Campus tests require an isolated localhost database');
const accounts={a:['student.1',process.env.ATLAS_STUDENT_1_PASSWORD],b:['student.2',process.env.ATLAS_STUDENT_2_PASSWORD],t:['teacher',process.env.ATLAS_TEACHER_PASSWORD],admin:['admin',process.env.ATLAS_ADMIN_PASSWORD]};
if(Object.values(accounts).some(x=>!x[1]))throw Error('Four demo passwords must be provided in environment');
const cookies={},people={};let checks=0;
function ok(value,message){assert.ok(value,message);checks++;}
function equal(a,b,message){assert.deepEqual(a,b,message);checks++;}
async function req(who,path,method='GET',body,expected=200){
 const response=await fetch(base+path,{method,signal:AbortSignal.timeout(15000),headers:{...(cookies[who]?{Cookie:cookies[who]}:{}),...(body!==undefined?{Origin:base,'Content-Type':'application/json'}:{})},body:body===undefined?undefined:JSON.stringify(body)});
 const data=await response.json();equal(response.status,expected,`${who} ${method} ${path}: ${data.error||''}`);
 for(const value of response.headers.getSetCookie()){if(value.startsWith('atlas_session='))cookies[who]=value.split(';')[0];}return data;
}
const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Moscow',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
function dayAdd(n){const d=new Date(today+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);}
function period(n,hour='21:00'){const start=new Date(dayAdd(n)+'T'+hour+':00+03:00');return {startsAt:start.toISOString(),endsAt:new Date(start.getTime()+30*60000).toISOString()};}
const stamp='QA CAMPUS '+Date.now();
for(const [who,[login,password]]of Object.entries(accounts)){const d=await req(who,'/api/login','POST',{login,password});people[who]=d.user;}
for(const path of ['/api/campus/overview','/api/campus/plan','/api/campus/events','/api/campus/consultations','/api/campus/forecast','/api/campus/map'])await req('anon',path,'GET',undefined,401);
const overA=await req('a','/api/campus/overview'),overB=await req('b','/api/campus/overview');
ok(overA.plan.items.filter(x=>x.kind==='homework').every(x=>x.groupId===people.a.groupId),'A plan group isolation');
ok(overB.plan.items.filter(x=>x.kind==='homework').every(x=>x.groupId===people.b.groupId),'B plan group isolation');
const task=await req('a','/api/campus/tasks','POST',{title:stamp,subject:'Личная заметка',dueDate:dayAdd(2)},201);
await req('a','/api/campus/progress','PATCH',{key:'task:'+task.id,status:'doing'});
ok((await req('a','/api/campus/plan')).items.some(x=>x.key==='task:'+task.id&&x.status==='doing'),'Task progress persists');
ok((await req('a','/api/notifications')).notifications.some(x=>x.kind==='deadline'&&x.body.includes(stamp)),'Personal task deadline reminder');
ok(!(await req('b','/api/notifications')).notifications.some(x=>x.body.includes(stamp)),'Personal deadline reminder isolated');
ok(!(await req('b','/api/campus/plan')).items.some(x=>x.key==='task:'+task.id),'Personal task hidden');
await req('b','/api/campus/tasks/'+task.id,'PATCH',{title:'Чужое',subject:'',dueDate:dayAdd(2)},403);
await req('b','/api/campus/tasks/'+task.id,'DELETE',{},403);
await req('b','/api/campus/progress','PATCH',{key:'task:'+task.id,status:'done'},403);
await req('a','/api/campus/progress','PATCH',{key:'task:'+task.id,status:'invalid'},400);
await req('a','/api/campus/tasks','POST',{title:'Bad date',dueDate:'2026-02-31'},400);
await req('a','/api/campus/tasks/'+task.id,'PATCH',{title:stamp+' edited',subject:'Личная заметка',dueDate:dayAdd(3)});
const homework=overA.plan.items.find(x=>x.kind==='homework');
if(homework){await req('a','/api/campus/progress','PATCH',{key:homework.key,status:'done'});await req('b','/api/campus/progress','PATCH',{key:homework.key,status:'done'},403);ok((await req('a','/api/campus/plan')).items.find(x=>x.key===homework.key)?.status==='done','Own homework progress');}
const prefsA=await req('a','/api/campus/preferences'),prefsB=await req('b','/api/campus/preferences');
await req('a','/api/campus/preferences','PUT',{widgets:['plan','schedule','events'],compact:true});
await req('a','/api/logout','POST',{});await req('a','/api/login','POST',{login:accounts.a[0],password:accounts.a[1]});
equal((await req('a','/api/campus/preferences')).widgets,['plan','schedule','events'],'Card order persists across login');
equal(await req('b','/api/campus/preferences'),prefsB,'Preferences isolated');
await req('a','/api/campus/preferences','PUT',{widgets:['plan','plan'],compact:true},400);
await req('a','/api/campus/preferences','PUT',{widgets:['unknown'],compact:false},400);
await req('a','/api/campus/preferences','PUT',{widgets:[],compact:false},400);
await req('t','/api/campus/preferences','PUT',{widgets:['progress'],compact:false},400);
const adminEvents=await req('admin','/api/campus/events'),clubsB=(await req('b','/api/campus/events')).clubs,clubsA=(await req('a','/api/campus/events')).clubs;
const club=adminEvents.clubs.find(c=>!clubsB.find(x=>x.id===c.id)?.isMember&&clubsA.find(x=>x.id===c.id)?.isMember)||adminEvents.clubs[0];
const eventBody={clubId:club.id,title:stamp,body:'Встреча для проверки записи и прав.',...period(12),place:'Библиотека',capacity:1,audience:'all',cover:'studio'};
await req('b','/api/campus/events','POST',eventBody,403);
const event=await req('admin','/api/campus/events','POST',eventBody,201),eventPath='/api/campus/events/'+event.id;
const race=await Promise.all(['a','b'].map(async who=>{const r=await fetch(base+eventPath+'/join',{method:'POST',headers:{Cookie:cookies[who],Origin:base,'Content-Type':'application/json'},body:'{}'});return {who,status:r.status};}));
equal(race.map(x=>x.status).sort(),[200,409],'Exactly one last-seat winner');
const winner=race.find(x=>x.status===200).who,loser=winner==='a'?'b':'a';
equal((await req('admin','/api/campus/events')).events.find(x=>x.id===event.id).participants,1,'Capacity never exceeded');
await req('b',eventPath+'/members','GET',undefined,403);
const members=await req('admin',eventPath+'/members');equal(members.members.length,1,'Organizer attendee list');ok(members.members.every(x=>!('contact_email'in x)&&!('login'in x)),'Minimal attendee details');
await req('b',eventPath,'PATCH',{...eventBody,title:'Forbidden'},403);
await req('admin',eventPath,'PATCH',{...eventBody,audience:'members'},409);
await req(winner,eventPath+'/leave','POST',{});await req(loser,eventPath+'/join','POST',{});
await req(loser,eventPath+'/leave','POST',{});
await req('admin',eventPath,'PATCH',{...eventBody,capacity:2});
await Promise.all(['a','b'].map(who=>req(who,eventPath+'/join','POST',{})));
await req('admin',eventPath,'PATCH',{...eventBody,capacity:1},409);
await req('admin',eventPath+'/cancel','POST',{});
await req('a',eventPath+'/join','POST',{},409);
const notifications=await req('a','/api/notifications');ok(notifications.notifications.some(n=>n.kind==='campus'&&n.title.includes('отменено')),'Registered student receives cancellation');
const privateEvent=await req('admin','/api/campus/events','POST',{...eventBody,title:stamp+' private',...period(13),audience:'members'},201);
ok(!(await req('b','/api/campus/events')).events.some(x=>x.id===privateEvent.id),'Private event not listed outside club');
await req('b','/api/campus/events/'+privateEvent.id+'/join','POST',{},403);
await req('b','/api/campus/progress','PATCH',{key:'event:'+privateEvent.id,status:'done'},403);
const memberA=(await req('a','/api/clubs')).clubs.find(x=>x.id===club.id);
if(memberA?.isMember){
 await req('a','/api/campus/events/'+privateEvent.id+'/join','POST',{});
 await req('admin','/api/admin/clubs/'+club.id+'/members/'+people.a.id,'DELETE',{});
 ok(!(await req('a','/api/campus/events')).events.some(x=>x.id===privateEvent.id),'Removed club member loses private event');
 equal((await req('admin','/api/campus/events')).events.find(x=>x.id===privateEvent.id).participants,0,'Revoked membership frees private event seat');
 await req('admin','/api/admin/clubs/'+club.id+'/members/'+people.a.id,'PUT',{role:memberA.memberRole||memberA.role||'Участник'});
}

const slotBody={...period(18),place:'Библиотека',format:'offline',groupId:''};
await req('a','/api/campus/slots','POST',slotBody,403);
const slot=await req('t','/api/campus/slots','POST',slotBody,201),slotPath='/api/campus/slots/'+slot.id;
await req('t','/api/campus/slots','POST',slotBody,409);
await req('t','/api/campus/slots','POST',{...slotBody,startsAt:'2026-02-31T10:00',endsAt:'2026-02-31T10:30'},400);
const raceBookings=await Promise.all(['a','b'].map(async who=>{const r=await fetch(base+slotPath+'/book',{method:'POST',headers:{Cookie:cookies[who],Origin:base,'Content-Type':'application/json'},body:JSON.stringify({topic:stamp+' PRIVATE '+who})});return {who,status:r.status,data:await r.json()};}));
equal(raceBookings.map(x=>x.status).sort(),[201,409],'Exactly one appointment winner');
const booked=raceBookings.find(x=>x.status===201),other=booked.who==='a'?'b':'a';
const otherSlots=await req(other,'/api/campus/consultations');equal(otherSlots.slots.find(x=>x.id===slot.id).booking,null,'Other student cannot read booking');ok(!JSON.stringify(otherSlots).includes(stamp+' PRIVATE'),'Topic stays private');
const staffSlots=await req('t','/api/campus/consultations');equal(staffSlots.slots.find(x=>x.id===slot.id).booking.topic,stamp+' PRIVATE '+booked.who,'Owner sees appointment topic');
await req(other,'/api/campus/bookings/'+booked.data.id+'/cancel','POST',{},403);
const parallelSlot=await req('admin','/api/campus/slots','POST',slotBody,201);
await req(booked.who,'/api/campus/slots/'+parallelSlot.id+'/book','POST',{topic:'Overlap'},409);
await req(booked.who,'/api/campus/bookings/'+booked.data.id+'/cancel','POST',{});
await req(other,slotPath+'/book','POST',{topic:'Freed slot'},201);
await req('t','/api/campus/slots/'+parallelSlot.id+'/cancel','POST',{},403);
await req('t',slotPath+'/cancel','POST',{});
ok((await req(other,'/api/notifications')).notifications.some(n=>n.kind==='consultation'&&n.title.includes('отменена')),'Consultation cancellation notification');
const restricted=await req('t','/api/campus/slots','POST',{...period(20),place:'Деканат',format:'offline',groupId:people.a.groupId},201);
ok(!(await req('b','/api/campus/consultations')).slots.some(x=>x.id===restricted.id),'Other group cannot list restricted slot');
await req('b','/api/campus/slots/'+restricted.id+'/book','POST',{topic:'Forbidden'},403);
const restrictedBooking=await req('a','/api/campus/slots/'+restricted.id+'/book','POST',{topic:'Existing personal appointment'},201);
await req('admin','/api/admin/people/'+people.a.id,'PATCH',{groupId:people.b.groupId,tag:'Студент'});
ok((await req('a','/api/campus/consultations')).slots.some(x=>x.id===restricted.id&&x.mine),'Own booking remains visible after group change');
await req('a','/api/campus/bookings/'+restrictedBooking.id+'/cancel','POST',{});
await req('admin','/api/admin/people/'+people.a.id,'PATCH',{groupId:people.a.groupId,tag:people.a.tag});
const onlineLink='https://meet.example.invalid/private-demo';
const online=await req('admin','/api/campus/slots','POST',{...period(25),place:onlineLink,format:'online'},201);
ok(!JSON.stringify(await req('b','/api/campus/consultations')).includes(onlineLink),'Online meeting URL hidden before booking');
await req('a','/api/campus/slots/'+online.id+'/book','POST',{topic:'Online appointment'},201);
equal((await req('a','/api/campus/consultations')).slots.find(x=>x.id===online.id).place,onlineLink,'Confirmed student gets meeting URL');
ok(!JSON.stringify(await req('b','/api/campus/consultations')).includes(onlineLink),'Online meeting URL hidden from other student');
await req('admin','/api/campus/slots/'+online.id+'/cancel','POST',{});
const teacherLessons=(await req('t','/api/schedule?week=1')).lessons.filter(x=>!['cancelled','moved-away'].includes(x.status));
if(teacherLessons.length){const l=teacherLessons[0];const start=new Date(l.date+'T'+l.startTime+':00+03:00');await req('t','/api/campus/slots','POST',{startsAt:start.toISOString(),endsAt:new Date(start.getTime()+15*60000).toISOString(),place:'Библиотека',format:'offline'},409);}
const studentLessons=(await req('a','/api/schedule?week=1')).lessons.filter(x=>!['cancelled','moved-away'].includes(x.status));
if(studentLessons.length){const l=studentLessons[0],start=new Date(l.date+'T'+l.startTime+':00+03:00'),s=await req('admin','/api/campus/slots','POST',{startsAt:start.toISOString(),endsAt:new Date(start.getTime()+15*60000).toISOString(),place:'Деканат',format:'offline'},201);await req('a','/api/campus/slots/'+s.id+'/book','POST',{topic:'Class conflict'},409);await req('admin','/api/campus/slots/'+s.id+'/cancel','POST',{});}
const beforeGrades=await req('a','/api/grades'),forecast=await req('t','/api/campus/forecast');
const scope=forecast.options.find(x=>x.groupId===people.a.groupId)||forecast.options[0];ok(!!scope,'Teacher scope is available');
await req('a','/api/campus/grading','PUT',{...scope,currentWeight:50,note:'Forbidden'},403);
await req('t','/api/campus/grading','PUT',{groupId:scope.groupId,subject:'Несуществующий предмет',currentWeight:50},403);
await req('t','/api/campus/grading','PUT',{...scope,currentWeight:101},400);
await req('t','/api/campus/grading','PUT',{...scope,currentWeight:50,note:stamp});
const forecastA=await req('a','/api/campus/forecast'),forecastB=await req('b','/api/campus/forecast');
ok(forecastA.rules.every(r=>r.groupId===people.a.groupId),'Forecast A group scope');ok(forecastB.rules.every(r=>r.groupId===people.b.groupId),'Forecast B group scope');
if(scope.groupId===people.a.groupId){const rule=forecastA.rules.find(r=>r.subject===scope.subject);equal(rule.currentWeight,50,'Teacher rule saved');equal(rule.futureWeight,50,'Weights sum to 100');}
equal(await req('a','/api/grades'),beforeGrades,'Forecast does not mutate grade book');
const hubPath='/api/campus/subject?subject='+encodeURIComponent(scope.subject)+'&groupId='+encodeURIComponent(scope.groupId);
const hub=await req(scope.groupId===people.a.groupId?'a':'t',hubPath);equal(hub.groupId,scope.groupId,'Subject context');ok(hub.lessons.every(x=>x.subject===scope.subject&&x.groupId===scope.groupId),'Subject lessons filtered');
ok(hub.teachers.length>0&&hub.teachers.every(x=>x.name),'Subject teacher names available');
if(scope.groupId===people.a.groupId){await req('b',hubPath,'GET',undefined,403);ok(hub.homework.every(x=>x.subject===scope.subject&&x.groupId===scope.groupId),'Subject homework scope');}
const teacherHub=await req('t',hubPath);equal(teacherHub.grades,[],'Subject hub does not expose student grades to staff');
const map=await req('a','/api/campus/map');equal(map.buildings.length,3,'Three demo buildings');ok(map.concept&&map.places.length>0,'Demo map is populated');
ok(map.places.filter(x=>x.room.includes('Корпус В')).every(x=>x.building==='C'),'Building В rooms are mapped to building В');
const place={room:stamp,title:'Тестовая аудитория',building:'B',floor:3,directions:'От лестницы направо.'};
await req('t','/api/campus/places','PUT',place,403);await req('admin','/api/campus/places','PUT',{...place,floor:20},400);await req('admin','/api/campus/places','PUT',place);
const found=(await req('a','/api/campus/map')).places.find(x=>x.room===stamp);equal([found.building,found.floor,found.directions],['B',3,place.directions],'Map edit persists');
await req('anon','/api/campus/tasks','POST',{title:'Forbidden',dueDate:dayAdd(2)},401);
const badOrigin=await fetch(base+'/api/campus/tasks',{method:'POST',headers:{Cookie:cookies.a,Origin:'https://foreign.example','Content-Type':'application/json'},body:JSON.stringify({title:'Forbidden',dueDate:dayAdd(2)})});equal(badOrigin.status,403,'New endpoints enforce Origin');
await req('a','/api/campus/preferences','PUT',{widgets:prefsA.widgets,compact:prefsA.compact});
await req('a','/api/campus/tasks/'+task.id,'DELETE',{});ok(!(await req('a','/api/campus/plan')).items.some(x=>x.key==='task:'+task.id),'Personal task removal');
await req('admin','/api/campus/events/'+privateEvent.id+'/cancel','POST',{});
await req('t','/api/campus/slots/'+restricted.id+'/cancel','POST',{});await req('admin','/api/campus/slots/'+parallelSlot.id+'/cancel','POST',{});
for(const who of Object.keys(accounts))await req(who,'/api/logout','POST',{});
console.log(`PASS: ${checks} campus checks: private plan, preferences, event and appointment races, permissions, subject hub, forecast, map, notifications.`);

// Mutating tests use an isolated localhost database only.
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
const base=process.env.ATLAS_BASE_URL||'http://127.0.0.1:4198';
if(!['127.0.0.1','localhost'].includes(new URL(base).hostname))throw Error('Isolated localhost copy required');
const accounts={a:['student.1',process.env.ATLAS_STUDENT_1_PASSWORD],b:['student.2',process.env.ATLAS_STUDENT_2_PASSWORD],t:['teacher',process.env.ATLAS_TEACHER_PASSWORD],admin:['admin',process.env.ATLAS_ADMIN_PASSWORD]};
if(Object.values(accounts).some(x=>!x[1]))throw Error('Demo passwords required in environment');
const sessions={};let checks=0;const marker='QA roles '+Date.now();
function ok(v,m){assert.ok(v,m);checks++;}function eq(a,b,m){assert.deepEqual(a,b,m);checks++;}
async function req(who,path,method='GET',body,status=200){const r=await fetch(base+path,{method,signal:AbortSignal.timeout(15000),headers:{...(sessions[who]?{Cookie:sessions[who]}:{}),...(body!==undefined?{Origin:base,'Content-Type':'application/json'}:{})},body:body===undefined?undefined:JSON.stringify(body)});const data=await r.json();ok((Array.isArray(status)?status:[status]).includes(r.status),who+' '+method+' '+path+': '+r.status+' '+(data.error||''));for(const v of r.headers.getSetCookie())if(v.startsWith('atlas_session='))sessions[who]=v.split(';')[0];return data;}
for(const [who,[login,password]]of Object.entries(accounts))await req(who,'/api/login','POST',{login,password});
await req('anon','/api/chat-contacts','GET',undefined,401);
for(const who of ['t','admin']){
 const me=(await req(who,'/api/me')).user;eq(me.groupId,null,'Staff has no study group');eq(me.group,null,'No group label');
 eq((await req(who,'/api/group')).group,null,'No automatically selected group');
 ok((await req(who,'/api/chats')).chats.every(c=>c.kind!=='group'),'No student group chat in staff account');
 for(const id of ['c1','c2']){await req(who,'/api/chat-updates?chatId='+id,'GET',undefined,403);await req(who,'/api/chats/'+id+'/read','POST',{},403);await req(who,'/api/chat-messages','POST',{chatId:id,body:marker},403);await req(who,'/api/chats/'+id+'/folder','PATCH',{folderId:null},403);}
 const contacts=(await req(who,'/api/chat-contacts')).contacts;ok(contacts.some(p=>p.id==='u1'&&p.tag==='Староста'),'Headman available');ok(contacts.some(p=>p.id==='u2'),'Students of taught groups available');ok(contacts.every(p=>!('login'in p)&&!('contactEmail'in p)&&!('phone'in p)),'Contacts contain no private fields');
}
// Even a stale or accidentally reinserted membership must not override the role boundary.
if(process.env.ATLAS_QA_DATABASE){const db=new DatabaseSync(process.env.ATLAS_QA_DATABASE);try{db.prepare("INSERT OR IGNORE INTO chat_members VALUES('c1','t1','teacher')").run();ok((await req('t','/api/chats')).chats.every(c=>c.id!=='c1'),'Legacy membership hidden');await req('t','/api/chat-messages','POST',{chatId:'c1',body:marker},403);const notifications=await req('t','/api/notifications');ok(!Object.hasOwn(notifications.unreadByChat||{},'c1'),'Hidden group not counted as unread');}finally{db.prepare("DELETE FROM chat_members WHERE chat_id='c1' AND user_id='t1'").run();db.close();}}
await req('a','/api/direct-chats','POST',{userId:'u2'},403);
await req('a','/api/direct-chats','POST',{userId:'u1'},400);
await req('t','/api/direct-chats','POST',{userId:'missing'},403);
const prior=await req('t','/api/direct-chats','POST',{userId:'u1'});eq(prior.chatId,'c4','Existing personal history reused');
const race=await Promise.all([req('admin','/api/direct-chats','POST',{userId:'u2'},[200,201]),req('admin','/api/direct-chats','POST',{userId:'u2'},[200,201])]);eq(race[0].chatId,race[1].chatId,'Concurrent dialog creation has one id');
const id=race[0].chatId;eq((await req('admin','/api/chats')).chats.find(c=>c.id===id)?.title,'Никита Каримов','Dialog title is peer name');eq((await req('b','/api/chats')).chats.find(c=>c.id===id)?.title,'Мария Петрова','Reverse dialog title');
const msg=(await req('admin','/api/chat-messages','POST',{chatId:id,body:marker},201)).message;
ok((await req('b','/api/chat-updates?chatId='+id)).messages.some(m=>m.id===msg.id),'Private message delivered');await req('a','/api/chat-updates?chatId='+id,'GET',undefined,403);await req('t','/api/chat-updates?chatId='+id,'GET',undefined,403);
await req('b','/api/chat-messages','POST',{chatId:id,body:marker+' Ответ'},201);
ok((await req('t','/api/people/u1')).profile.canMessage,'Profile offers permitted dialog');ok(!(await req('a','/api/people/u2')).profile.canMessage,'Profile hides unavailable dialog');
const now=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Moscow',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());const date=new Date(now+'T12:00:00Z');date.setUTCDate(date.getUTCDate()+((7-date.getUTCDay())%7));const sunday=date.toISOString().slice(0,10);
const template={groupId:'g1',weekday:0,startTime:'18:30',endTime:'19:00',subject:marker,type:'Практика',room:'QA роли 1234567890-А',teacherId:'t1'};
let own,other,exception;
try{
 own=(await req('admin','/api/schedule','POST',template,201)).lesson;
 other=(await req('admin','/api/schedule','POST',{...template,startTime:'19:00',endTime:'19:30',subject:marker+' Чужая',teacherId:null,teacher:'Другой преподаватель'},201)).lesson;
 const body={lessonId:own.id,originalDate:sunday,action:'change',targetDate:sunday,startTime:'20:00',endTime:'20:30',room:'QA аудитория 12345678901234567890',teacherId:'t1',note:marker};
 await req('a','/api/schedule-exceptions','POST',body,403);await req('t','/api/schedule','POST',template,403);
 await req('t','/api/schedule-exceptions','POST',{...body,lessonId:other.id},403);await req('t','/api/schedule-exceptions','POST',{...body,teacherId:null},403);
 await req('t','/api/schedule-exceptions','POST',{...body,startTime:'19:00',endTime:'19:30'},409);
 exception=(await req('t','/api/schedule-exceptions','POST',body,201)).exception;
 let visible=(await req('a','/api/schedule')).lessons.find(l=>l.id===own.id&&l.originalDate===sunday);eq(visible.room,body.room,'Student sees teacher room change');
 ok((await req('t','/api/schedule')).lessons.find(l=>l.id===own.id&&l.date===sunday).canEdit,'Teacher sees own edit action');
 await req('t','/api/schedule-exceptions/'+exception.id,'PATCH',{note:marker+' Уточнение'});
 await req('t','/api/schedule-exceptions/'+exception.id,'PATCH',{teacherId:null,teacher:'Другой'},403);
 await req('admin','/api/schedule-exceptions/'+exception.id,'PATCH',{teacherId:null,teacher:'Другой преподаватель'});
 await req('t','/api/schedule-exceptions/'+exception.id,'PATCH',{note:'Чужая пара'},403);await req('t','/api/schedule-exceptions/'+exception.id,'DELETE',{},403);
 await req('admin','/api/schedule-exceptions/'+exception.id,'DELETE',{});exception=null;
 exception=(await req('t','/api/schedule-exceptions','POST',{...body,action:'cancel'},201)).exception;
 eq((await req('a','/api/schedule')).lessons.find(l=>l.id===own.id&&l.originalDate===sunday)?.status,'cancelled','Teacher cancellation visible');
 await req('t','/api/schedule-exceptions/'+exception.id,'DELETE',{});exception=null;
 eq((await req('a','/api/schedule')).lessons.find(l=>l.id===own.id&&l.originalDate===sunday)?.room,template.room,'Teacher restores original pair');
}finally{if(exception)await req('admin','/api/schedule-exceptions/'+exception.id,'DELETE',{});for(const lesson of [other,own])if(lesson)await req('admin','/api/schedule/'+lesson.id,'DELETE',{});}
console.log('PASS: '+checks+' refinements checks: staff isolation, private messaging, races, own schedule edits and conflicts.');

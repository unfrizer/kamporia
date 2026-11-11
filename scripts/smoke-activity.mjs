import assert from 'node:assert/strict';
let config={};
if(process.argv.includes('--stdin')){
 if(process.stdin.isTTY)process.stdin.setRawMode(true);process.stdin.setEncoding('utf8');
 console.log('Ready for activity QA JSON on stdin (input is hidden).');
 config=JSON.parse(await new Promise(resolve=>{let text='';process.stdin.on('data',function read(chunk){text+=chunk;if(/[\r\n]/.test(text)){process.stdin.removeListener('data',read);process.stdin.pause();resolve(text.trim());}});process.stdin.resume();}));
}
const base=config.base||process.env.ATLAS_BASE_URL||'http://127.0.0.1:4184';
if(config.bypass)assert.equal(base,'https://atlas-dekanat-2026.topcup.chatgpt.site');
const accounts=config.accounts||{'student.1':process.env.ATLAS_STUDENT_1_PASSWORD,'student.2':process.env.ATLAS_STUDENT_2_PASSWORD,teacher:process.env.ATLAS_TEACHER_PASSWORD,admin:process.env.ATLAS_ADMIN_PASSWORD};
for(const [login,password]of Object.entries(accounts))assert.ok(password,'Missing password '+login);
let checks=0;const sessions={},users={},hwIds=[],lessonIds=[],exceptionIds=[],newsIds=[];
const marker='[QA activity '+new Date().toISOString()+']';
const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Moscow',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const add=(date,days)=>{const d=new Date(date+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10);};
function equal(actual,expected,message){assert.equal(actual,expected,message);checks++;if(config.bypass&&checks%25===0)console.log('Activity QA: '+checks+' checks passed.');}
function check(value,message){assert.ok(value,message);checks++;}
async function call(path,{login,method='GET',body,cookie,origin=base}={}){
 const response=await fetch(base+path,{method,redirect:'manual',signal:AbortSignal.timeout(30000),headers:{...(config.bypass?{'OAI-Sites-Authorization':'Bearer '+config.bypass}:{}),...(cookie||sessions[login]?{cookie:cookie||sessions[login]}:{}),...(body!==undefined?{'content-type':'application/json'}:{}),...(['GET','HEAD'].includes(method)?{}:{origin})},body:body===undefined?undefined:JSON.stringify(body)});
 const data=await response.json();return {status:response.status,data,cookie:response.headers.get('set-cookie')?.split(';')[0]};
}
async function expect(path,options,status=200){const r=await call(path,options);equal(r.status,status,`${options?.login||'anonymous'} ${options?.method||'GET'} ${path}: ${JSON.stringify(r.data)}`);return r.data;}
async function login(name){const r=await call('/api/login',{method:'POST',body:{login:name,password:accounts[name]}});equal(r.status,200,'login '+name);sessions[name]=r.cookie;users[name]=r.data.user;}
const notifications=login=>expect('/api/notifications',{login});
try{
 await expect('/api/notifications',{},401);
 for(const name of Object.keys(accounts))await login(name);
 for(const name of Object.keys(accounts)){const data=await notifications(name);check(Array.isArray(data.notifications),'notification array');equal(data.unreadCount,data.notifications.filter(row=>!row.read).length,'accurate unread count');check(Number.isInteger(data.unreadMessages),'real message count');}
 const initial=await notifications('student.1'),again=await notifications('student.1');
 equal(initial.notifications.map(row=>row.id).sort().join(','),again.notifications.map(row=>row.id).sort().join(','),'poll does not duplicate events');
 const baseline=initial.notifications[0];check(baseline,'seed event available');
 await expect('/api/notifications/'+baseline.id+'/read',{login:'student.2',method:'PATCH',body:{read:true}},403);
 await expect('/api/notifications/'+baseline.id+'/read',{login:'student.1',method:'PATCH',body:{read:true}});
 check((await notifications('student.1')).notifications.find(row=>row.id===baseline.id)?.read,'read marker visible');
 await expect('/api/notifications/'+baseline.id+'/read',{login:'student.1',method:'PATCH',body:{read:false}});
 equal((await notifications('student.1')).notifications.find(row=>row.id===baseline.id)?.read,false,'mark unread');
 await expect('/api/notifications/'+baseline.id+'/read',{login:'student.1',method:'PATCH',body:{read:'yes'}},400);
 await expect('/api/notifications/read-all',{login:'student.1',method:'POST',body:{}});
 equal((await notifications('student.1')).unreadCount,0,'read all');
 const hwBody={groupId:'g1',subject:'Проектирование интерфейсов',date:today,dueDate:add(today,1),title:marker+' Задание',body:'Вымышленное задание для проверки событий.'};
 const homework=(await expect('/api/homework',{login:'teacher',method:'POST',body:hwBody},201)).assignment;hwIds.push(homework.id);
 const hwEvents=(await notifications('student.1')).notifications.filter(row=>row.link.id===homework.id);
 check(hwEvents.some(row=>row.kind==='homework'&&!row.read),'new homework unread');check(hwEvents.some(row=>row.kind==='deadline'),'homework deadline reminder');
 check(!(await notifications('student.2')).notifications.some(row=>row.link.id===homework.id),'other group does not see homework events');
 const oldHwEvent=hwEvents.find(row=>row.kind==='homework');
 await expect('/api/homework/'+homework.id,{login:'teacher',method:'PATCH',body:{title:marker+' Уточнение'}});
 const changed=(await notifications('student.1')).notifications.filter(row=>row.link.id===homework.id&&row.kind==='homework');
 check(changed.some(row=>row.id!==oldHwEvent.id&&/обновлено/.test(row.title)),'updated homework creates distinct event');
 const overdue=(await expect('/api/homework',{login:'teacher',method:'POST',body:{...hwBody,date:add(today,-2),dueDate:add(today,-1),title:marker+' Срок прошёл'}},201)).assignment;hwIds.push(overdue.id);
 check((await notifications('student.1')).notifications.some(row=>row.link.id===overdue.id&&row.kind==='deadline'&&/просроченное/.test(row.title)),'recent overdue reminder');
 const request=(await expect('/api/requests',{login:'student.2',method:'POST',body:{type:'Справка об обучении',comment:marker}},201)).request;
 await expect('/api/requests/'+request.id,{login:'admin',method:'PATCH',body:{status:'ready',staffReply:marker+' Готово'}});
 check((await notifications('student.2')).notifications.some(row=>row.kind==='request'&&row.link.id===request.id&&row.body.includes(marker)),'own dean reply notification');
 check(!(await notifications('student.1')).notifications.some(row=>row.link.id===request.id),'foreign dean reply hidden');
 const news=(await expect('/api/news',{login:'teacher',method:'POST',body:{title:marker+' Объявление',body:'Вымышленная публикация.',scope:'group',groupId:'g1'}},201)).news;newsIds.push(news.id);
 check((await notifications('student.1')).notifications.some(row=>row.kind==='news'&&row.link.id===news.id),'group announcement notification');
 check(!(await notifications('student.2')).notifications.some(row=>row.link.id===news.id),'group announcement isolated');
 await expect('/api/news/'+news.id+'/archive',{login:'teacher',method:'POST',body:{archived:true}});
 check(!(await notifications('student.1')).notifications.some(row=>row.link.id===news.id),'archived publication no longer leaks through events');
 await expect('/api/news/'+news.id+'/archive',{login:'teacher',method:'POST',body:{archived:false}});
 const people=await expect('/api/admin/people',{login:'admin'}),own=people.users.find(row=>row.id===users['student.1'].id);
 await expect('/api/admin/people/'+own.id,{login:'admin',method:'PATCH',body:{groupId:'g2',tag:'Студент'}});
 try{check(!(await notifications('student.1')).notifications.some(row=>row.link.id===homework.id||row.link.id===news.id),'group transfer invalidates old group event history');await expect('/api/chat-updates?chatId=c1',{login:'student.1'},403);}finally{await expect('/api/admin/people/'+own.id,{login:'admin',method:'PATCH',body:{groupId:own.groupId,tag:own.tag}});}
 const sunday=add(today,(7-new Date(today+'T00:00:00Z').getUTCDay())%7);
 const lesson=(await expect('/api/schedule',{login:'admin',method:'POST',body:{groupId:'g1',weekday:0,startTime:'22:50',endTime:'23:10',subject:marker+' Консультация',type:'Консультация',room:marker.slice(0,60),teacherId:'t1',teacher:'Елена Белова',changed:false,changeNote:''}},201)).lesson;lessonIds.push(lesson.id);
 const exception=(await expect('/api/schedule-exceptions',{login:'admin',method:'POST',body:{lessonId:lesson.id,originalDate:sunday,action:'cancel',note:marker+' Отмена'}},201)).exception;exceptionIds.push(exception.id);
 check((await notifications('student.1')).notifications.some(row=>row.kind==='schedule'&&row.link.id===exception.id&&/отменено/.test(row.title)),'calendar cancellation event');
 check(!(await notifications('student.2')).notifications.some(row=>row.link.id===exception.id),'calendar event group isolation');
 await expect('/api/schedule-exceptions/'+exception.id,{login:'admin',method:'DELETE'});exceptionIds.splice(exceptionIds.indexOf(exception.id),1);
 check((await notifications('student.1')).notifications.some(row=>row.link.id===exception.id&&/восстановлено/.test(row.title)),'calendar restoration event');
 await expect('/api/chat-updates?chatId=c2',{login:'student.1'},403);
 await expect('/api/chats/c2/read',{login:'student.1',method:'POST',body:{}},403);
 await expect('/api/chat-updates?chatId=c3&after=not-a-message',{login:'student.1'},400);
 await expect('/api/chats/c3/read',{login:'student.1',method:'POST',body:{}});
 const start=await expect('/api/chat-updates?chatId=c3',{login:'student.1'});equal(start.unreadCount,0,'read cursor reset');
 const message=(await expect('/api/chat-messages',{login:'student.2',method:'POST',body:{chatId:'c3',body:marker+' Сообщение'}},201)).message;
 const incoming=await expect('/api/chat-updates?chatId=c3'+(start.cursor?'&after='+encodeURIComponent(start.cursor):''),{login:'student.1'});
 check(incoming.messages.some(row=>row.id===message.id),'incremental message delivered');equal(incoming.unreadCount,1,'incoming unread count');
 const outgoing=(await expect('/api/chat-messages',{login:'student.1',method:'POST',body:{chatId:'c3',body:marker+' Ответ'}},201)).message;
 equal((await expect('/api/chat-updates?chatId=c3',{login:'student.1'})).unreadCount,1,'own message does not increment unread');
 await expect('/api/chats/c3/read',{login:'student.1',method:'POST',body:{lastMessageId:outgoing.id}});
 equal((await expect('/api/chat-updates?chatId=c3',{login:'student.1'})).unreadCount,0,'visible messages marked read');
 await expect('/api/chats/c3/read',{login:'student.1',method:'POST',body:{lastMessageId:start.cursor}});
 equal((await expect('/api/chat-updates?chatId=c3',{login:'student.1'})).unreadCount,0,'older read cursor cannot regress');
 if(config.localDatabasePath){
  const {DatabaseSync}=await import('node:sqlite'),sqlite=new DatabaseSync(config.localDatabasePath);const stamp=new Date().toISOString(),a='z-'+crypto.randomUUID(),b='a-'+crypto.randomUUID();
  const insert=sqlite.prepare('INSERT INTO messages(id,chat_id,author_id,body,created_at) VALUES(?,?,?,?,?)');insert.run(a,'c3','u2',marker+' tie-first',stamp);insert.run(b,'c3','u2',marker+' tie-second',stamp);sqlite.close();
  const ties=await expect('/api/chat-updates?chatId=c3&after='+outgoing.id,{login:'student.1'});equal(ties.messages.map(row=>row.id).join(','),a+','+b,'same timestamp follows insertion order rather than random UUID');
  await expect('/api/chats/c3/read',{login:'student.1',method:'POST',body:{lastMessageId:a}});
  equal((await expect('/api/chat-updates?chatId=c3',{login:'student.1'})).unreadCount,1,'partial read sees second same-timestamp message');
  const afterA=await expect('/api/chat-updates?chatId=c3&after='+a,{login:'student.1'});equal(afterA.messages[0].id,b,'cursor does not skip same-timestamp lower UUID');
  await expect('/api/chats/c3/read',{login:'student.1',method:'POST',body:{lastMessageId:b}});
 }
 await expect('/api/notifications/'+baseline.id+'/read',{login:'student.1',method:'PATCH',body:{read:true}});
 await login('student.1');check((await notifications('student.1')).notifications.find(row=>row.id===baseline.id)?.read,'read state survives relogin');
 equal((await expect('/api/chat-updates?chatId=c3',{login:'student.1'})).unreadCount,0,'chat cursor survives relogin');
 await expect('/api/chats/c3/read',{login:'student.1',method:'POST',body:{},origin:'https://foreign.example'},403);
 const card=await expect('/api/people/u2',{login:'student.1'});check(!('contactEmail' in (card.profile||card)),'public directory has no personal contact');
 await expect('/api/profiles/u2',{login:'student.1'},403);
}finally{
 for(const id of exceptionIds)await call('/api/schedule-exceptions/'+id,{login:'admin',method:'DELETE'});
 for(const id of lessonIds)await call('/api/schedule/'+id,{login:'admin',method:'DELETE'});
 for(const id of hwIds)await call('/api/homework/'+id,{login:'admin',method:'DELETE'});
 for(const id of newsIds)await call('/api/news/'+id+'/archive',{login:'admin',method:'POST',body:{archived:true}});
}
console.log(`PASS: ${checks} activity checks. ${marker}`);

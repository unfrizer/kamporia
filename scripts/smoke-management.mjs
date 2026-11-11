import assert from 'node:assert/strict';
let config={};
if(process.argv.includes('--stdin')){
 if(process.stdin.isTTY)process.stdin.setRawMode(true);process.stdin.setEncoding('utf8');console.log('Ready for management QA JSON on stdin (input is hidden).');
 config=JSON.parse(await new Promise(resolve=>{let text='';process.stdin.on('data',function read(chunk){text+=chunk;if(/[\r\n]/.test(text)){process.stdin.removeListener('data',read);process.stdin.pause();resolve(text.trim());}});process.stdin.resume();}));
}
const base=config.base||process.env.ATLAS_BASE_URL||'http://127.0.0.1:4185';
if(config.bypass)assert.equal(base,'https://atlas-dekanat-2026.topcup.chatgpt.site');
const accounts=config.accounts||{'student.1':process.env.ATLAS_STUDENT_1_PASSWORD,'student.2':process.env.ATLAS_STUDENT_2_PASSWORD,teacher:process.env.ATLAS_TEACHER_PASSWORD,admin:process.env.ATLAS_ADMIN_PASSWORD};
for(const [login,password]of Object.entries(accounts))assert.ok(password,'Missing password '+login);
const sessions={},created=[],original={};let checks=0;const homeworkIds=[];
const pngHex=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jK1cAAAAASUVORK5CYII=','base64').toString('hex');
const marker='[QA management '+new Date().toISOString()+']';
function check(value,message){assert.ok(value,message);checks++;}
function equal(actual,expected,message){assert.equal(actual,expected,message);checks++;if(config.bypass&&checks%25===0)console.log('Management QA: '+checks+' checks passed.');}
async function call(path,{login,method='GET',body,form}={}){
 const response=await fetch(base+path,{method,redirect:'manual',signal:AbortSignal.timeout(30000),headers:{...(config.bypass?{'OAI-Sites-Authorization':'Bearer '+config.bypass}:{}),...(sessions[login]?{cookie:sessions[login]}:{}),...(body!==undefined?{'content-type':'application/json'}:{}),...(method==='GET'?{}:{origin:base})},body:form||(body!==undefined?JSON.stringify(body):undefined)});
 const bytes=new Uint8Array(await response.arrayBuffer());let data;try{data=JSON.parse(new TextDecoder().decode(bytes));}catch{data=null;}return {status:response.status,data,bytes,cookie:response.headers.get('set-cookie')?.split(';')[0]};
}
async function expect(path,opts,status=200){const result=await call(path,opts);equal(result.status,status,`${opts?.login||'anonymous'} ${opts?.method||'GET'} ${path}: ${JSON.stringify(result.data)}`);return result.data;}
async function upload(login){const form=new FormData();form.append('file',new Blob([Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jK1cAAAAASUVORK5CYII=','base64'))],{type:'image/png'}),'management-test.png');return (await expect('/api/uploads',{login,method:'POST',form},201)).file;}
const publicationPath=item=>item.type==='club'?`/api/clubs/${item.clubId}/posts/${item.id}`:`/api/${item.type==='news'?'news':'resources'}/${item.id}`;
try{
 for(const [login,password]of Object.entries(accounts)){const response=await call('/api/login',{method:'POST',body:{login,password}});equal(response.status,200,'Login '+login);sessions[login]=response.cookie;check(response.cookie,'Session '+login);}
 const people=await expect('/api/admin/people',{login:'admin'});for(const person of people.users)original[person.id]=person;
 await expect('/api/admin/people',{login:'student.1'},403);await expect('/api/admin/people',{login:'teacher'},403);
 await expect('/api/admin/people/u2',{login:'student.1',method:'PATCH',body:{groupId:'g1',tag:'Староста'}},403);
 await expect('/api/admin/people/u2',{login:'admin',method:'PATCH',body:{role:'admin'}},400);
 await expect('/api/admin/people/a1',{login:'admin',method:'PATCH',body:{groupId:'g1'}},404);
 await expect('/api/admin/people/u2',{login:'admin',method:'PATCH',body:{groupId:'g1',tag:'Староста'}});
 const after=(await expect('/api/admin/people',{login:'admin'})).users;
 equal(after.find(u=>u.id==='u2').groupId,'g1','Group changed');equal(after.find(u=>u.id==='u2').tag,'Староста','Headman appointed');equal(after.find(u=>u.id==='u1').tag,'Студент','Previous headman demoted');
 equal(after.find(u=>u.id==='u2').direction,people.groups.find(g=>g.id==='g1').direction,'Academic data from group');
 const chats=(await expect('/api/chats',{login:'student.2'})).chats;check(chats.some(c=>c.id==='c1'),'New group chat granted');check(!chats.some(c=>c.id==='c2'),'Old group chat removed');
 await expect('/api/chat-messages',{login:'student.2',method:'POST',body:{chatId:'c2',body:'Denied'}},403);
 const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Moscow',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());const homework={groupId:'g1',subject:'Дизайн-системы',date,dueDate:date,title:marker+' Headman',body:'QA'};
 await expect('/api/homework',{login:'student.1',method:'POST',body:homework},403);const assigned=(await expect('/api/homework',{login:'student.2',method:'POST',body:homework},201)).assignment;homeworkIds.push(assigned.id);
 await expect('/api/admin/people/u2',{login:'admin',method:'PATCH',body:{groupId:original.u2.groupId,tag:original.u2.tag}});await expect('/api/admin/people/u1',{login:'admin',method:'PATCH',body:{groupId:original.u1.groupId,tag:original.u1.tag}});
 await expect('/api/admin/clubs/club1/members/u2',{login:'teacher',method:'PUT',body:{role:'Редактор'}},403);
 await expect('/api/admin/clubs/club1/members/u2',{login:'admin',method:'PUT',body:{role:'admin'}},400);
 await expect('/api/clubs/club1/posts',{login:'student.2',method:'POST',body:{title:marker,body:'Denied'}},403);
 await expect('/api/admin/clubs/club1/members/u2',{login:'admin',method:'PUT',body:{role:'Редактор'}});
 check((await expect('/api/clubs/club1',{login:'student.2'})).club.canPublish,'Editor can publish');
 const post=(await expect('/api/clubs/club1/posts',{login:'student.2',method:'POST',body:{title:marker+' club',body:'Initial club news'}},201)).post;created.push({type:'club',clubId:'club1',id:post.id});
 await expect('/api/clubs/club1/posts/'+post.id,{login:'student.2',method:'PATCH',body:{title:marker+' edited club',body:'Edited text'}});
 await expect('/api/clubs/club1/posts/'+post.id,{login:'teacher',method:'PATCH',body:{body:'Denied'}},403);
 await expect('/api/clubs/club1/posts/'+post.id+'/archive',{login:'student.2',method:'POST',body:{archived:true}});
 check(!(await expect('/api/clubs/club1',{login:'student.1'})).posts.some(p=>p.id===post.id),'Archived wall post hidden');
 await expect('/api/clubs/club1/posts/'+post.id+'/archive',{login:'student.2',method:'POST',body:{archived:false}});
 await expect('/api/admin/clubs/club1/members/u2',{login:'admin',method:'PUT',body:{role:'Участник'}});
 await expect('/api/clubs/club1/posts/'+post.id,{login:'student.2',method:'PATCH',body:{body:'Revoked'}},403);
 await expect('/api/clubs/club1/posts/'+post.id+'/archive',{login:'admin',method:'POST',body:{archived:true}});check(!(await expect('/api/publication-archive',{login:'student.2'})).items.find(item=>item.id===post.id).canRestore,'Former editor cannot restore');await expect('/api/clubs/club1/posts/'+post.id+'/archive',{login:'student.2',method:'POST',body:{archived:false}},403);await expect('/api/clubs/club1/posts/'+post.id+'/archive',{login:'admin',method:'POST',body:{archived:false}});
 await expect('/api/admin/clubs/club1/members/u2',{login:'admin',method:'DELETE'});
 check(!(await expect('/api/chats',{login:'student.2'})).chats.some(c=>c.clubId==='club1'),'Membership removal revokes chat');
 await expect('/api/chat-messages',{login:'student.2',method:'POST',body:{chatId:'c3',body:'Denied'}},403);
 await expect('/api/admin/clubs/club1/members/u2',{login:'admin',method:'PUT',body:{role:'Участник'}});
 const image=await upload('teacher');
 const news=(await expect('/api/news',{login:'teacher',method:'POST',body:{title:marker+' news',body:'Initial',scope:'group',groupId:'g1',attachmentIds:[image.id]}},201)).news;created.push({type:'news',id:news.id});
 await expect('/api/news/'+news.id,{login:'student.1',method:'PATCH',body:{body:'Denied'}},403);
 await expect('/api/news/'+news.id,{login:'teacher',method:'PATCH',body:{scope:'all'}},403);
 await expect('/api/news/'+news.id,{login:'teacher',method:'PATCH',body:{deadline:'2026-02-30'}},400);
 await expect('/api/news/'+news.id,{login:'teacher',method:'PATCH',body:{authorId:'a1'}},400);
 const updated=(await expect('/api/news/'+news.id,{login:'teacher',method:'PATCH',body:{title:marker+' edited',body:'New body',deadline:'2026-11-20'}})).news;
 equal(updated.body,'New body','News edited');equal(updated.deadline,'2026-11-20','Deadline saved');equal(updated.attachments[0].id,image.id,'Editing retains file');
 equal((await call(image.url,{login:'student.1'})).status,200,'File visible to audience');equal((await call(image.url,{login:'student.2'})).status,403,'File group isolation');
 await expect('/api/news/'+news.id+'/archive',{login:'teacher',method:'POST',body:{archived:true}});
 check(!(await expect('/api/news',{login:'student.1'})).news.some(n=>n.id===news.id),'Archived announcement hidden');
 equal((await call(image.url,{login:'student.1'})).status,403,'Archived file hidden from audience');equal((await call(image.url,{login:'teacher'})).status,200,'Archived file retained for author');equal((await call(image.url,{login:'admin'})).status,200,'Archived file retained for admin');
 check((await expect('/api/publication-archive',{login:'teacher'})).items.some(n=>n.id===news.id),'Author sees own archive');check(!(await expect('/api/publication-archive',{login:'student.1'})).items.some(n=>n.id===news.id),'Other user archive isolation');
 await expect('/api/news/'+news.id+'/archive',{login:'student.2',method:'POST',body:{archived:false}},403);
 await expect('/api/news/'+news.id+'/archive',{login:'teacher',method:'POST',body:{archived:false}});
 const restoredFile=await call(image.url,{login:'student.1'});equal(restoredFile.status,200,'Restoring retains exact file');equal(Buffer.from(restoredFile.bytes).toString('hex'),pngHex,'Restored PNG bytes unchanged');
 const wallFile=await upload('student.1');const wallPost=(await expect('/api/clubs/club1/posts',{login:'student.1',method:'POST',body:{title:marker+' File wall',body:'QA file',attachmentIds:[wallFile.id]}},201)).post;created.push({type:'club',clubId:'club1',id:wallPost.id});await expect('/api/clubs/club1/posts/'+wallPost.id+'/archive',{login:'student.1',method:'POST',body:{archived:true}});equal((await call(wallFile.url,{login:'student.2'})).status,403,'Archived wall file hidden from member');equal((await call(wallFile.url,{login:'teacher'})).status,403,'Archived wall file hidden from nonmember');equal((await call(wallFile.url,{login:'student.1'})).status,200,'Archived wall file retained for author');await expect('/api/clubs/club1/posts/'+wallPost.id+'/archive',{login:'student.1',method:'POST',body:{archived:false}});equal((await call(wallFile.url,{login:'student.2'})).status,200,'Restored wall attachment visible');
 const resourceBody={subject:'Дизайн-системы',groupId:'g1',kind:'teacher',title:marker+' resource',type:'Конспект',description:'QA',body:'Initial resource'};
 const resource=(await expect('/api/resources',{login:'teacher',method:'POST',body:resourceBody},201)).resource;created.push({type:'resource',id:resource.id});
 const changed=(await expect('/api/resources/'+resource.id,{login:'teacher',method:'PATCH',body:{title:marker+' edited resource',body:'Edited material'}})).resource;equal(changed.body,'Edited material','Resource edited');
 await expect('/api/resources/'+resource.id,{login:'teacher',method:'PATCH',body:{subject:'Базы данных',groupId:'g2'}},403);
 await expect('/api/resources/'+resource.id,{login:'student.1',method:'PATCH',body:{body:'Denied'}},403);
 await expect('/api/resources/'+resource.id+'/archive',{login:'teacher',method:'POST',body:{archived:true}});
 check(!(await expect('/api/resources',{login:'student.1'})).subjects.flatMap(s=>s.resources).some(r=>r.id===resource.id),'Archived resource hidden');
 await expect('/api/resources/'+resource.id+'/archive',{login:'teacher',method:'POST',body:{archived:false}});
 check((await expect('/api/resources',{login:'student.1'})).subjects.flatMap(s=>s.resources).some(r=>r.id===resource.id),'Restored resource visible');
 const general=(await expect('/api/resources',{login:'admin',method:'POST',body:{...resourceBody,kind:'general',title:marker+' general'}},201)).resource;created.push({type:'resource',id:general.id});
 await expect('/api/resources/'+general.id,{login:'teacher',method:'PATCH',body:{body:'Denied'}},403);
 await expect('/api/resources/'+general.id,{login:'admin',method:'PATCH',body:{body:'Admin update'}});
 await expect('/api/news/'+news.id+'/archive',{login:'admin',method:'POST',body:{archived:true}});
 check((await expect('/api/publication-archive',{login:'admin'})).items.some(item=>item.id===news.id),'Admin sees complete archive');
}finally{
 if(original.u2){await expect('/api/admin/people/u2',{login:'admin',method:'PATCH',body:{groupId:original.u2.groupId,tag:original.u2.tag}});await expect('/api/admin/people/u1',{login:'admin',method:'PATCH',body:{groupId:original.u1.groupId,tag:original.u1.tag}});const membership=original.u2.clubs.find(m=>m.clubId==='club1');await expect('/api/admin/clubs/club1/members/u2',{login:'admin',method:membership?'PUT':'DELETE',body:membership?{role:membership.role}:undefined});}
 for(const id of homeworkIds)await expect('/api/homework/'+id,{login:'admin',method:'DELETE'});
 for(const item of created)await expect(publicationPath(item)+'/archive',{login:'admin',method:'POST',body:{archived:true}});
}
console.log(`PASS: ${checks} management checks. ${marker}`);

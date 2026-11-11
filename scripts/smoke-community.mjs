import assert from 'node:assert/strict';
let config={};
if(process.argv.includes('--stdin')){
  if(process.stdin.isTTY)process.stdin.setRawMode(true);
  process.stdin.setEncoding('utf8');
  console.log('Ready for community QA JSON on stdin (input is hidden).');
  config=JSON.parse(await new Promise(resolve=>{let value='';process.stdin.on('data',function read(chunk){value+=chunk;if(/[\r\n]/.test(value)){process.stdin.removeListener('data',read);process.stdin.pause();resolve(value.trim());}});process.stdin.resume();}));
}
const base=config.base || process.env.ATLAS_BASE_URL || 'http://127.0.0.1:4183';
if(config.bypass)assert.equal(base,'https://atlas-dekanat-2026.topcup.chatgpt.site');
const accounts=config.accounts || {'student.1':process.env.ATLAS_STUDENT_1_PASSWORD,'student.2':process.env.ATLAS_STUDENT_2_PASSWORD,teacher:process.env.ATLAS_TEACHER_PASSWORD,admin:process.env.ATLAS_ADMIN_PASSWORD};
for(const [login,password] of Object.entries(accounts))assert.ok(password,'Missing password for '+login);
const sessions={},originalUsers={},uploaded=[];
const evidence={base};
let checks=0;
const marker='[QA community '+new Date().toISOString()+']';
function tick(){checks++;if(config.bypass&&checks%25===0)console.log('Community QA: '+checks+' checks passed.');}
function equal(actual,expected,message){assert.equal(actual,expected,message);tick();}
function check(value,message){assert.ok(value,message);tick();}
async function call(path,{login,method='GET',body,form,raw,origin=base}={}){
 const response=await fetch(base+path,{method,redirect:'manual',signal:AbortSignal.timeout(30000),headers:{...(config.bypass?{'OAI-Sites-Authorization':'Bearer '+config.bypass}:{}),...(sessions[login]?{cookie:sessions[login]}:{}),...((body!==undefined||raw!==undefined)?{'content-type':'application/json'}:{}),...(!['GET','HEAD'].includes(method)?{origin}:{})},body:form || raw || (body===undefined?undefined:JSON.stringify(body))});
 const bytes=new Uint8Array(await response.arrayBuffer());let data;
 try{data=JSON.parse(new TextDecoder().decode(bytes));}catch{data=null;}
 return {status:response.status,data,bytes,headers:response.headers,cookie:response.headers.get('set-cookie')?.split(';')[0]};
}
async function expect(path,options,status=200){const result=await call(path,options);equal(result.status,status,(options?.login||'anonymous')+' '+(options?.method||'GET')+' '+path+' '+JSON.stringify(result.data));return result.data;}
async function upload(login,name,contents,mime,status=201){const form=new FormData();form.append('file',new Blob([contents],{type:mime}),name);const result=await call('/api/uploads',{login,method:'POST',form});equal(result.status,status,'Upload '+name+' '+JSON.stringify(result.data));if(status===201){uploaded.push({id:result.data.file.id,login,attached:false});return result.data.file;}return result;}
const png=Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jK1cAAAAASUVORK5CYII=','base64'));
const pdf=new TextEncoder().encode('%PDF-1.4\n% QA fictional document\n%%EOF');
if(config.verifyPersistence){
 const e=config.verifyPersistence;
 for(const [login,password] of Object.entries(accounts)){
  const r=await call('/api/login',{method:'POST',body:{login,password}});equal(r.status,200,'Persistence login '+login);sessions[login]=r.cookie;
 }
 const image=await call('/api/files/'+e.imageId,{login:'student.1'}),document=await call('/api/files/'+e.documentId,{login:'student.1'});
 equal(image.status,200,'Image persists after restart');equal(document.status,200,'Document persists after restart');
 equal(Buffer.from(image.bytes).toString('hex'),Buffer.from(png).toString('hex'),'Persistent PNG bytes exact');equal(Buffer.from(document.bytes).toString('hex'),Buffer.from(pdf).toString('hex'),'Persistent PDF bytes exact');
 check((await expect('/api/news',{login:'student.1'})).news.some(n=>n.id===e.newsId&&n.attachments.length===2),'News attachment metadata persists');
 check((await expect('/api/clubs/club1',{login:'student.2'})).posts.some(p=>p.id===e.clubPostId),'Club wall post persists');
 check((await expect('/api/resources',{login:'student.1'})).subjects.flatMap(s=>s.resources).some(r=>r.id===e.teacherResourceId),'Teacher material persists');
 console.log('PASS: '+checks+' persistence checks after restart.');process.exit(0);
}

try{
 await expect('/api/clubs',{},401);
 for(const [login,password] of Object.entries(accounts)){
   const result=await call('/api/login',{method:'POST',body:{login,password}});equal(result.status,200,'Login '+login);check(result.cookie,'Session '+login);sessions[login]=result.cookie;originalUsers[login]=result.data.user;
 }
 for(const login of Object.keys(accounts)){
   const own=originalUsers[login],name=own.name+' QA';
   const saved=(await expect('/api/me',{login,method:'PATCH',body:{name,bio:marker,contactEmail:'qa@example.invalid',phone:'+7 (000) 000-00-00'}})).user;
   equal(saved.name,name,'Profile name '+login);equal(saved.bio,marker,'Profile bio '+login);equal(saved.contactEmail,'qa@example.invalid','Profile contact '+login);
   const again=(await expect('/api/me',{login})).user;equal(again.phone,'+7 (000) 000-00-00','Profile persists '+login);
   const publicCard=(await expect('/api/people/'+own.id,{login:'student.2'})).profile;
   check(!('contactEmail' in publicCard)&&!('phone' in publicCard)&&!('bio' in publicCard),'Public profile excludes private fields');
 }
 const teacherLessons=await expect('/api/schedule?teacherId=t1',{login:'student.1'});check(teacherLessons.lessons.every(row=>row.teacher===originalUsers.teacher.name+' QA'),'Teacher name is canonical in schedule');
 for(const body of [{role:'admin'},{groupId:'g1'},{faculty:'QA'},{course:99},{tag:'Староста'},{login:'admin'}])await expect('/api/me',{login:'student.2',method:'PATCH',body},403);
 await expect('/api/me',{login:'student.1',method:'PATCH',body:{contactEmail:'invalid'}},400);
 await expect('/api/me',{login:'student.1',method:'PATCH',body:{phone:'not a phone'}},400);
 await expect('/api/me',{login:'student.1',method:'PATCH',body:{bio:'a'.repeat(601)}},400);
 await expect('/api/me',{login:'student.1',method:'PATCH',body:{name:'QA'},origin:'https://foreign.example'},403);
 const allClubs=await expect('/api/clubs',{login:'student.1'});check(allClubs.clubs.length>=4,'University catalog includes all four clubs');
 const media=allClubs.clubs.find(c=>c.id==='club1');check(media.isMember&&media.canPublish&&media.chatId,'Coordinator can publish and access chat');
 const curator=allClubs.clubs.find(c=>c.id==='club2');check(curator.isMember&&curator.canPublish&&curator.chatId,'Mentor has matching club chat');
 const regularClubs=await expect('/api/clubs',{login:'student.2'}),regularMedia=regularClubs.clubs.find(c=>c.id==='club1');check(regularMedia.isMember&&!regularMedia.canPublish&&regularMedia.chatId,'Regular member sees chat but cannot publish');
 const outsider=regularClubs.clubs.find(c=>c.id==='club2');check(!outsider.isMember&&!outsider.chatId&&!outsider.canPublish,'Nonmember has no private chat');
 for(const club of allClubs.clubs){const detail=await expect('/api/clubs/'+club.id,{login:'student.2'});check(detail.posts.length>0&&detail.club.about&&detail.club.meetingPlace&&detail.club.schedule,'Every club has readable wall and details');}
 await expect('/api/clubs/missing',{login:'student.1'},404);
 const postBody={title:marker+' Стена клуба',body:'Вымышленная проверочная публикация сообщества.'};
 await expect('/api/clubs/club1/posts',{login:'student.2',method:'POST',body:postBody},403);
 await expect('/api/clubs/club2/posts',{login:'student.2',method:'POST',body:postBody},403);
 await expect('/api/clubs/club4/posts',{login:'teacher',method:'POST',body:postBody},403);
 const wallPost=(await expect('/api/clubs/club1/posts',{login:'student.1',method:'POST',body:postBody},201)).post;equal(wallPost.authorId,'u1','Club post has correct author');
 check((await expect('/api/clubs/club1',{login:'student.2'})).posts.some(p=>p.id===wallPost.id),'Other member can read wall');
 await expect('/api/clubs/club4/posts',{login:'admin',method:'POST',body:{...postBody,title:marker+' Администратор'}},201);
 const resources=await expect('/api/resources',{login:'teacher'});check(resources.canPublish&&resources.options.length>0&&resources.groups.length>0,'Resource publishing metadata');
 check(resources.subjects.some(s=>s.resources.some(r=>r.kind==='general'&&!r.authorId&&!r.author)),'General manuals are anonymous');
 check(resources.subjects.some(s=>s.resources.some(r=>r.kind==='teacher'&&r.authorId==='t1')),'Teacher material keeps author');
 const resourceBody={groupId:'g1',subject:'Дизайн-системы',title:marker+' Материал',type:'Пособие',description:'Проверка атрибуции',body:'Вымышленный материал с собственным автором.',kind:'teacher'};
 await expect('/api/resources',{login:'student.1',method:'POST',body:resourceBody},403);
 await expect('/api/resources',{login:'teacher',method:'POST',body:{...resourceBody,subject:'Аналитика данных'}},403);
 await expect('/api/resources',{login:'teacher',method:'POST',body:{...resourceBody,kind:'general'}},403);
 await expect('/api/resources',{login:'teacher',method:'POST',body:{...resourceBody,groupId:null}},403);
 const teacherResource=(await expect('/api/resources',{login:'teacher',method:'POST',body:resourceBody},201)).resource;equal(teacherResource.authorId,'t1','Material author id');equal(teacherResource.kind,'teacher','Teacher-specific material kind');evidence.teacherResourceId=teacherResource.id;
 const resourcesOne=(await expect('/api/resources',{login:'student.1'})).subjects.flatMap(s=>s.resources),resourcesTwo=(await expect('/api/resources',{login:'student.2'})).subjects.flatMap(s=>s.resources);
 check(resourcesOne.some(r=>r.id===teacherResource.id),'Own group sees material');check(!resourcesTwo.some(r=>r.id===teacherResource.id),'Other group cannot see material');
 const general=(await expect('/api/resources',{login:'admin',method:'POST',body:{...resourceBody,groupId:null,kind:'general',title:marker+' Общее пособие'}},201)).resource;
 equal(general.authorId,null,'General manual has no teacher attribution');check((await expect('/api/resources',{login:'student.2'})).subjects.flatMap(s=>s.resources).some(r=>r.id===general.id),'Global manual visible across groups');
 await upload('student.2','qa.txt','QA','text/plain',403);
 await upload('teacher','qa.svg','<svg/>','image/svg+xml',415);
 await upload('teacher','qa.png','not a png','image/png',415);
 await upload('teacher','qa.pdf',pdf,'text/html',415);
 await upload('teacher','qa.txt',new Uint8Array([65,0,66]),'text/plain',415);
 await upload('teacher','qa.txt','x'.repeat(5*1024*1024+1),'text/plain',413);
 const image=await upload('teacher','Тестовый рисунок.png',png,'image/png');equal(image.kind,'image','Image recognized');equal(image.url,'/api/files/'+image.id,'Stable protected file URL');
 const imageResponse=await call(image.url,{login:'teacher'});equal(imageResponse.status,200,'Author reads draft');equal(imageResponse.headers.get('content-type'),'image/png','Image MIME');check(imageResponse.headers.get('content-disposition').startsWith('inline'),'Images render inline');equal(Buffer.from(imageResponse.bytes).toString('hex'),Buffer.from(png).toString('hex'),'Stored bytes preserved');
 equal((await call(image.url,{login:'student.1'})).status,403,'Draft file private to author');
 await expect('/api/news',{login:'admin',method:'POST',body:{title:marker,body:'QA',scope:'all',attachmentIds:[image.id]}},403);
 const document=await upload('teacher','Учебная памятка.pdf',pdf,'application/pdf');
 const news=(await expect('/api/news',{login:'teacher',method:'POST',body:{title:marker+' Вложения',body:'Вымышленное объявление с изображением и файлом.',scope:'group',groupId:'g1',attachmentIds:[image.id,document.id]}},201)).news;
 uploaded.find(f=>f.id===image.id).attached=true;uploaded.find(f=>f.id===document.id).attached=true;
 equal(news.attachments.length,2,'News returns attachments');evidence.newsId=news.id;evidence.imageId=image.id;evidence.documentId=document.id;
 const visibleNews=(await expect('/api/news',{login:'student.1'})).news.find(n=>n.id===news.id);equal(visibleNews.attachments[0].id,image.id,'News read returns same attachment');
 const docResponse=await call(document.url,{login:'student.1'});equal(docResponse.status,200,'Own group downloads document');check(docResponse.headers.get('content-disposition').startsWith('attachment'),'Documents download as attachment');check(docResponse.headers.get('content-disposition').includes("filename*=UTF-8''"),'Unicode filename encoded');equal(docResponse.headers.get('x-content-type-options'),'nosniff','No MIME sniffing');
 equal((await call(document.url,{login:'student.2'})).status,403,'Foreign group denied attached file');equal((await call(document.url)).status,401,'Anonymous file denied');
 await expect('/api/news',{login:'teacher',method:'POST',body:{title:marker,body:'QA',scope:'group',groupId:'g1',attachmentIds:[image.id]}},403);
 await expect('/api/uploads/'+image.id,{login:'teacher',method:'DELETE'},409);
 const head=await call(image.url,{login:'student.1',method:'HEAD'});equal(head.status,200,'File HEAD');equal(head.bytes.length,0,'HEAD body empty');
 const draft=await upload('student.1','club-notes.txt','QA club notes','text/plain');
 const clubPost=(await expect('/api/clubs/club1/posts',{login:'student.1',method:'POST',body:{...postBody,title:marker+' Вложение клуба',attachmentIds:[draft.id]}},201)).post;uploaded.find(f=>f.id===draft.id).attached=true;equal(clubPost.attachments.length,1,'Club post attachment');evidence.clubPostId=clubPost.id;equal((await call(draft.url,{login:'teacher'})).status,200,'Club wall attachment readable to nonmember');
 const removable=await upload('teacher','draft.txt','QA draft','text/plain');
 await expect('/api/uploads/'+removable.id,{login:'admin',method:'DELETE'},403);
 await expect('/api/uploads/'+removable.id,{login:'teacher',method:'DELETE'});uploaded.find(f=>f.id===removable.id).attached=true;equal((await call(removable.url,{login:'teacher'})).status,404,'Removed draft file absent');
 const ttlDatabase=config.localDatabasePath || process.env.ATLAS_TEST_DATABASE_PATH;
 if(ttlDatabase){
   check(new URL(base).hostname==='127.0.0.1','TTL SQL fixture confined to local test');
   const stale=await upload('teacher','stale.txt','QA stale draft','text/plain');
   const {DatabaseSync}=await import('node:sqlite');const sqlite=new DatabaseSync(ttlDatabase);
   const oldDate=new Date(Date.now()-25*60*60*1000).toISOString();
   sqlite.prepare('UPDATE uploads SET created_at=? WHERE id IN (?,?)').run(oldDate,stale.id,image.id);sqlite.close();
   const fresh=await upload('teacher','fresh.txt','QA fresh draft','text/plain');
   equal((await call(stale.url,{login:'teacher'})).status,404,'Stale draft expires on new upload');uploaded.find(f=>f.id===stale.id).attached=true;
   equal((await call(image.url,{login:'student.1'})).status,200,'Old published image survives draft cleanup');
 }
 const duplicates=await upload('teacher','duplicate.txt','QA duplicate','text/plain');
 await expect('/api/news',{login:'teacher',method:'POST',body:{title:marker,body:'QA',scope:'group',groupId:'g1',attachmentIds:[duplicates.id,duplicates.id]}},400);
 await expect('/api/news',{login:'teacher',method:'POST',body:{title:marker,body:'QA',scope:'group',groupId:'g1',attachmentIds:[1,2,3,4,5]}},400);
}finally{
 for(const [login,user] of Object.entries(originalUsers))await expect('/api/me',{login,method:'PATCH',body:{name:user.name,bio:user.bio||'',contactEmail:user.contactEmail||'',phone:user.phone||''}});
 for(const file of uploaded.filter(f=>!f.attached))await expect('/api/uploads/'+file.id,{login:file.login,method:'DELETE'});
}
const evidencePath=config.evidencePath || process.env.ATLAS_QA_EVIDENCE;if(evidencePath){const fs=await import('node:fs/promises');await fs.writeFile(evidencePath,JSON.stringify(evidence,null,2));}
console.log(`PASS: ${checks} community checks. ${marker}`);

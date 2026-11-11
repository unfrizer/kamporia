// Staff communicate with students through private dialogs, never student group chats.
async function atlasMessageContacts(db,user){
 const rows=(await db.prepare(`SELECT u.id,u.name,u.initials,u.role,u.tag,u.group_id,g.name AS group_name FROM users u LEFT JOIN groups g ON g.id=u.group_id
 WHERE u.id<>? AND (?='admin' OR u.role='admin' OR (?='teacher' AND (u.role='teacher' OR (u.role='student' AND EXISTS(SELECT 1 FROM teaching_assignments l WHERE l.teacher_id=? AND l.group_id=u.group_id)))) OR (?='student' AND ((u.role='student' AND u.group_id=?) OR (u.role='teacher' AND EXISTS(SELECT 1 FROM teaching_assignments l WHERE l.teacher_id=u.id AND l.group_id=?))))) ORDER BY u.role,u.name`).bind(user.id,user.role,user.role,user.id,user.role,user.group_id,user.group_id).all()).results;
 return rows.map(r=>({id:r.id,name:r.name,initials:r.initials,role:r.role,tag:r.tag,group:r.role==='student'?r.group_name:null}));
}
async function handleMessagingApi(request,env,db,user,url){
 void env;
 if(request.method==='GET'&&url.pathname==='/api/chat-contacts')return atlasJson({contacts:await atlasMessageContacts(db,user)});
 if(request.method!=='POST'||url.pathname!=='/api/direct-chats')return null;
 const body=await atlasBody(request),targetId=atlasString(body.userId,'Получатель',80);
 if(targetId===user.id)atlasFail(400,'Выберите другого участника.');
 const target=(await atlasMessageContacts(db,user)).find(p=>p.id===targetId);
 if(!target)atlasFail(403,'Личная переписка с этим участником недоступна.');
 const existing=await db.prepare(`SELECT c.id FROM chats c JOIN chat_members a ON a.chat_id=c.id AND a.user_id=? JOIN chat_members b ON b.chat_id=c.id AND b.user_id=? WHERE c.kind='direct' AND (SELECT COUNT(*) FROM chat_members m WHERE m.chat_id=c.id)=2 ORDER BY c.id LIMIT 1`).bind(user.id,targetId).first();
 if(existing)return atlasJson({chatId:existing.id},200);
 const id='direct-'+(await atlasSha256(JSON.stringify([user.id,targetId].sort()))).slice(0,40);
 await db.batch([
  db.prepare("INSERT OR IGNORE INTO chats(id,title,kind,group_id,club_id,folder,description) VALUES(?,'Личная переписка','direct',NULL,NULL,'Личные','Диалог двух участников')").bind(id),
  ...[user.id,targetId].map(person=>db.prepare("INSERT OR IGNORE INTO chat_members(chat_id,user_id,role) VALUES(?,?,'member')").bind(id,person))
 ]);
 return atlasJson({chatId:id},201);
}

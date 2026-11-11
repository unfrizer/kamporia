// Personal activity and stable, insertion-ordered chat cursors.
async function atlasChatUnreadCounts(db,user) {
  const rows=(await db.prepare(`SELECT cm.chat_id,COUNT(m.id) AS unread FROM chat_members cm
    LEFT JOIN chat_read_cursors c ON c.chat_id=cm.chat_id AND c.user_id=cm.user_id
    LEFT JOIN messages m ON m.chat_id=cm.chat_id AND m.rowid>COALESCE(c.last_message_rowid,0) AND m.author_id<>cm.user_id
    JOIN chats ch ON ch.id=cm.chat_id WHERE cm.user_id=? AND (ch.kind<>'group' OR (?='student' AND ch.group_id=?)) GROUP BY cm.chat_id`).bind(user.id,user.role,user.group_id).all()).results;
  const byChat={};let totalUnread=0;
  for(const row of rows){byChat[row.chat_id]=Number(row.unread)||0;totalUnread+=byChat[row.chat_id];}
  return {byChat,totalUnread};
}
async function atlasChatMembership(db,user,id) {
  const membership=await db.prepare("SELECT cm.chat_id FROM chat_members cm JOIN chats c ON c.id=cm.chat_id WHERE cm.user_id=? AND cm.chat_id=? AND (c.kind<>'group' OR (?='student' AND c.group_id=?))").bind(user.id,id,user.role,user.group_id).first();
  if(!membership)atlasFail(403,'Чат доступен только его участникам.');
}
async function atlasReadChat(db,user,id,lastMessageId) {
  await atlasChatMembership(db,user,id);
  let row;
  if(lastMessageId){row=await db.prepare('SELECT rowid AS sequence,id FROM messages WHERE id=? AND chat_id=?').bind(atlasString(lastMessageId,'Сообщение',80),id).first();if(!row)atlasFail(400,'Сообщение не принадлежит этому чату.');}
  else row=await db.prepare('SELECT rowid AS sequence,id FROM messages WHERE chat_id=? ORDER BY rowid DESC LIMIT 1').bind(id).first();
  const sequence=Number(row?.sequence)||0,now=new Date().toISOString();
  await db.prepare(`INSERT INTO chat_read_cursors(user_id,chat_id,last_message_rowid,last_message_id,updated_at) VALUES(?,?,?,?,?)
    ON CONFLICT(user_id,chat_id) DO UPDATE SET
    last_message_id=CASE WHEN excluded.last_message_rowid>=chat_read_cursors.last_message_rowid THEN excluded.last_message_id ELSE chat_read_cursors.last_message_id END,
    last_message_rowid=MAX(chat_read_cursors.last_message_rowid,excluded.last_message_rowid),updated_at=excluded.updated_at`)
    .bind(user.id,id,sequence,row?.id||null,now).run();
  return {ok:true,chatId:id,...await atlasChatUnreadCounts(db,user)};
}
async function atlasChatUpdates(db,user,url) {
  const chatId=atlasString(url.searchParams.get('chatId'),'Чат',80);
  await atlasChatMembership(db,user,chatId);
  const after=url.searchParams.get('after');let sequence=0;
  if(after){const cursor=await db.prepare('SELECT rowid AS sequence FROM messages WHERE id=? AND chat_id=?').bind(atlasString(after,'Курсор',80),chatId).first();if(!cursor)atlasFail(400,'Курсор не принадлежит этому чату.');sequence=Number(cursor.sequence);}
  const rows=(await db.prepare(`SELECT m.rowid AS sequence,m.id,m.body,m.created_at,m.author_id,u.name AS author,u.initials FROM messages m JOIN users u ON u.id=m.author_id
    WHERE m.chat_id=? ${after?'AND m.rowid>?':''} ORDER BY m.rowid ${after?'ASC':'DESC'} LIMIT ${after?101:50}`).bind(...(after?[chatId,sequence]:[chatId])).all()).results;
  const hasMore=Boolean(after&&rows.length>100);let page=rows.slice(0,100);if(!after)page.reverse();
  const messages=page.map(row=>({id:row.id,sequence:Number(row.sequence),body:row.body,createdAt:row.created_at,authorId:row.author_id,author:row.author,initials:row.initials}));
  const counts=await atlasChatUnreadCounts(db,user);
  return {chatId,messages,hasMore,cursor:messages.at(-1)?.id||after||null,unreadCount:counts.byChat[chatId]||0,unreadMessages:counts.totalUnread,unreadByChat:counts.byChat};
}
function atlasActivityDateText(value){return new Intl.DateTimeFormat('ru-RU',{day:'numeric',month:'long'}).format(new Date(value+'T12:00:00Z'));}
async function atlasActivityCandidates(db,user) {
  const now=new Date(),today=atlasMoscowDate().toISOString().slice(0,10),cutoff=new Date(now.getTime()-30*86400000).toISOString();
  const events=[],allowed=new Set();
  const add=(kind,entity,id,version,title,body,createdAt,link,visibleUntil=null)=>{
    const entityKey=entity+':'+id;allowed.add(entityKey);events.push({kind,entityKey,id,version:String(version),title,body,createdAt:createdAt||now.toISOString(),link,visibleUntil});
  };
  let hwSql=`SELECT h.*,g.name AS group_name FROM homework h JOIN groups g ON g.id=h.group_id WHERE h.updated_at>=? AND h.due_date>=? AND h.lesson_date<=?`;
  const hwArgs=[cutoff,atlasDateAdd(today,-14),atlasDateAdd(today,60)];
  if(user.role==='student'){hwSql+=' AND h.group_id=?';hwArgs.push(user.group_id);}
  if(user.role==='teacher'){hwSql+=' AND EXISTS(SELECT 1 FROM teaching_assignments l WHERE l.teacher_id=? AND l.group_id=h.group_id AND l.subject=h.subject)';hwArgs.push(user.id);}
  const homework=(await db.prepare(hwSql+' ORDER BY h.updated_at DESC LIMIT 100').bind(...hwArgs).all()).results;
  for(const row of homework){
    const link={view:'homework',date:row.lesson_date,subject:row.subject,groupId:row.group_id,id:row.id};
    const updated=row.updated_at!==row.created_at;
    if(row.author_id!==user.id)add('homework','homework',row.id,row.updated_at,updated?'Домашнее задание обновлено':'Новое домашнее задание',`${row.subject}: ${row.title}. Срок — ${atlasActivityDateText(row.due_date)}.`,row.updated_at,link);
    else allowed.add('homework:'+row.id);
    if(user.role==='student'&&row.due_date>=atlasDateAdd(today,-2)&&row.due_date<=atlasDateAdd(today,2)){
      const overdue=row.due_date<today;
      add('deadline','homework',row.id,row.updated_at+':'+row.due_date+':'+(overdue?'late':'soon'),overdue?'Проверьте просроченное задание':'Приближается срок задания',`${row.subject}: ${row.title}. ${overdue?'Срок был':'Сдать до'} ${atlasActivityDateText(row.due_date)}.`,now.toISOString(),link,atlasDateAdd(row.due_date,3)+'T00:00:00.000Z');
    }
  }
  if(user.role==='student'){
    const requests=(await db.prepare('SELECT * FROM requests WHERE user_id=? AND updated_at>=? ORDER BY updated_at DESC LIMIT 70').bind(user.id,cutoff).all()).results;
    const statuses={submitted:'Отправлена',in_review:'На рассмотрении',ready:'Готово',rejected:'Отклонена'};
    for(const row of requests){allowed.add('request:'+row.id);if(row.status!=='submitted'||row.staff_reply)add('request','request',row.id,row.updated_at+':'+row.status+':'+row.staff_reply,'Ответ деканата: '+statuses[row.status],row.type+(row.staff_reply?' — '+row.staff_reply:''),row.updated_at,{view:'requests',id:row.id});}
  }else if(user.role==='admin'){
    const requests=(await db.prepare('SELECT r.*,u.name AS student FROM requests r JOIN users u ON u.id=r.user_id WHERE r.created_at>=? ORDER BY r.created_at DESC LIMIT 70').bind(cutoff).all()).results;
    for(const row of requests)add('request','request',row.id,row.created_at,'Новая заявка студента',`${row.student}: ${row.type}`,row.created_at,{view:'requests',id:row.id});
  }
  const news=await atlasNewsList(db,user,100,false);
  for(const row of news){
    if(row.createdAt<cutoff||row.archived)continue;
    allowed.add('news:'+row.id);
    if(row.authorId!==user.id)add('news','news',row.id,row.updatedAt||row.createdAt,'Новое объявление',row.title,row.updatedAt||row.createdAt,{view:'news',id:row.id});
    if(row.deadline&&row.deadline>=today&&row.deadline<=atlasDateAdd(today,2))add('deadline','news',row.id,row.deadline,'Ближайшая дата',`${row.title} — ${atlasActivityDateText(row.deadline)}`,now.toISOString(),{view:'news',id:row.id},atlasDateAdd(row.deadline,1)+'T00:00:00.000Z');
  }
  const logged=new Set((await db.prepare('SELECT DISTINCT entity_kind,entity_id FROM schedule_updates').all()).results.map(r=>r.entity_kind+':'+r.entity_id));
  const lessons=await atlasLessons(db,user,new URL('https://example.invalid/api/schedule'));
  for(const row of lessons){
    if(logged.has('lesson:'+row.id)){allowed.add('lesson:'+row.id);continue;}
    if(!row.changed)continue;const date=atlasDateAdd(today,(Number(row.weekday)-new Date(today+'T00:00:00Z').getUTCDay()+7)%7);
    add('schedule','lesson',row.id,[row.startTime,row.endTime,row.room,row.teacherId,row.changeNote].join('|'),'Изменение недельного расписания',`${row.subject}: ${row.changeNote||row.room+' · '+row.startTime}`,now.toISOString(),{view:'schedule',date,id:row.id});
  }
  let exSql=`SELECT e.*,l.teacher_id AS base_teacher_id FROM schedule_exceptions e JOIN lessons l ON l.id=e.lesson_id WHERE e.updated_at>=? AND (e.original_date>=? OR e.target_date>=?)`,exArgs=[cutoff,atlasDateAdd(today,-7),atlasDateAdd(today,-7)];
  if(user.role==='student'){exSql+=' AND EXISTS(SELECT 1 FROM teaching_assignments ta WHERE ta.id=e.lesson_id AND ta.group_id=?)';exArgs.push(user.group_id);}
  if(user.role==='teacher'){exSql+=' AND (e.teacher_id=? OR l.teacher_id=?)';exArgs.push(user.id,user.id);}
  const exceptions=(await db.prepare(exSql+' ORDER BY e.updated_at DESC LIMIT 100').bind(...exArgs).all()).results;
  for(const row of exceptions){
    if(logged.has('exception:'+row.id)){allowed.add('exception:'+row.id);continue;}
    const restored=Number(row.active)===0,cancelled=row.action==='cancel';
    add('schedule','exception',row.id,row.updated_at,restored?'Занятие восстановлено':cancelled?'Занятие отменено':'Перенос или изменение занятия',`${row.subject} · ${atlasActivityDateText(row.original_date)}${!restored&&!cancelled&&row.target_date!==row.original_date?' → '+atlasActivityDateText(row.target_date):''}${row.note?' — '+row.note:''}`,row.updated_at,{view:'schedule',date:restored||cancelled?row.original_date:row.target_date,id:row.id});
  }
  for(const event of await atlasCycleActivity(db,user,cutoff)){allowed.add(event.entityKey);events.push(event);}
  for(const event of await campusActivity(db,user)){allowed.add(event.entityKey);events.push(event);}
  return {events,allowed,now:now.toISOString()};
}
async function atlasActivityList(db,user) {
  const {events,allowed,now}=await atlasActivityCandidates(db,user);
  const candidates=await Promise.all(events.map(async event=>{
    const sourceKey=event.kind+':'+event.entityKey+':'+(await atlasSha256(event.version)).slice(0,24);
    return {...event,sourceKey,id:await atlasSha256(user.id+'\n'+sourceKey)};
  }));
  const existing=new Set((await db.prepare('SELECT id FROM activity_notifications WHERE user_id=?').bind(user.id).all()).results.map(row=>row.id));
  const inserts=candidates.filter(event=>!existing.has(event.id)).map(event=>db.prepare('INSERT OR IGNORE INTO activity_notifications(id,user_id,source_key,entity_key,kind,title,body,created_at,visible_until,link_json) VALUES(?,?,?,?,?,?,?,?,?,?)').bind(event.id,user.id,event.sourceKey,event.entityKey,event.kind,event.title,event.body,event.createdAt,event.visibleUntil,JSON.stringify(event.link)));
  // Keep individual D1 batches bounded for a newly opened account.
  for(let offset=0;offset<inserts.length;offset+=70)await db.batch(inserts.slice(offset,offset+70));
  const rows=(await db.prepare('SELECT * FROM activity_notifications WHERE user_id=? AND created_at>=? AND (visible_until IS NULL OR visible_until>?) ORDER BY created_at DESC,id DESC LIMIT 200').bind(user.id,new Date(Date.now()-30*86400000).toISOString(),now).all()).results;
  const notifications=rows.filter(row=>allowed.has(row.entity_key)).map(row=>({id:row.id,kind:row.kind,title:row.title,body:row.body,createdAt:row.created_at,read:Boolean(row.read_at),link:JSON.parse(row.link_json)}));
  const counts=await atlasChatUnreadCounts(db,user);
  return {notifications,unreadCount:notifications.filter(row=>!row.read).length,unreadMessages:counts.totalUnread,unreadByChat:counts.byChat};
}
async function handleActivityApi(request,env,db,user,url) {
  void env;const method=request.method,path=url.pathname;
  if(method==='GET'&&path==='/api/notifications')return atlasJson(await atlasActivityList(db,user));
  if(method==='POST'&&path==='/api/notifications/read-all'){
    await atlasBody(request);await atlasActivityList(db,user);await db.prepare('UPDATE activity_notifications SET read_at=? WHERE user_id=? AND read_at IS NULL').bind(new Date().toISOString(),user.id).run();return atlasJson({ok:true,...await atlasActivityList(db,user)});
  }
  if(method==='PATCH'&&/^\/api\/notifications\/[^/]+\/read$/.test(path)){
    const id=decodeURIComponent(path.split('/')[3]),body=await atlasBody(request);
    const visible=await atlasActivityList(db,user);
    if(!visible.notifications.some(row=>row.id===id))atlasFail(403,'Уведомление недоступно.');
    if(body.read!==undefined&&typeof body.read!=='boolean')atlasFail(400,'Некорректная отметка прочтения.');
    await db.prepare('UPDATE activity_notifications SET read_at=? WHERE id=? AND user_id=?').bind(body.read===false?null:new Date().toISOString(),id,user.id).run();return atlasJson({ok:true});
  }
  if(method==='GET'&&path==='/api/chat-updates')return atlasJson(await atlasChatUpdates(db,user,url));
  if(method==='POST'&&/^\/api\/chats\/[^/]+\/read$/.test(path)){
    const body=await atlasBody(request);return atlasJson(await atlasReadChat(db,user,decodeURIComponent(path.split('/')[3]),body.lastMessageId));
  }
  return null;
}

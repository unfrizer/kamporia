// Reversible publication management and administration. Appended to worker/api.js.
const ATLAS_GROUP_TAGS=['Студент','Староста','Заместитель старосты'];
const ATLAS_MANAGEMENT_CLUB_ROLES=['Участник','Редактор','Куратор','Координатор','Наставник','Организатор'];
function atlasManagementDeadline(value) {
  if(value===undefined||value===null||value==='')return null;
  return atlasIsoDate(value,'Срок объявления');
}
function atlasManagementId(value) {
  try{return atlasString(decodeURIComponent(value),'Идентификатор',80);}catch(error){if(error instanceof AtlasApiError)throw error;atlasFail(400,'Некорректный адрес.');}
}
function atlasManagementFields(body,allowed) {
  if(Object.keys(body).some(key=>!allowed.includes(key)))atlasFail(400,'Указаны неподдерживаемые поля.');
}
async function atlasManagementMayChange(db,user,row,type) {
  if(user.role==='admin')return true;
  if(row.author_id!==user.id)return false;
  return type==='club'?await atlasClubCanPublish(db,user,row.club_id):user.role==='teacher';
}
async function atlasManagementRequireChange(db,user,row,type) {
  if(!(await atlasManagementMayChange(db,user,row,type)))atlasFail(403,'Изменять публикацию может её автор с действующими правами или администрация.');
}
async function atlasManagementNewsAudience(db,user,scope,groupId) {
  if(!['all','group'].includes(scope))atlasFail(400,'Укажите аудиторию новости.');
  if(user.role!=='admin'&&scope==='all')atlasFail(403,'Объявления для всего университета публикует администрация.');
  if(scope==='all')return null;
  const id=atlasString(groupId,'Группа',40);
  if(!(await db.prepare('SELECT id FROM groups WHERE id=?').bind(id).first()))atlasFail(404,'Группа не найдена.');
  if(user.role==='teacher'&&!(await db.prepare('SELECT id FROM teaching_assignments WHERE group_id=? AND teacher_id=? LIMIT 1').bind(id,user.id).first()))atlasFail(403,'Группа недоступна преподавателю.');
  return id;
}
async function atlasManagementResourceAudience(db,user,row,body) {
  const subject=atlasString(body.subject??row.subject,'Дисциплина',120);
  const groupId=body.groupId===undefined?row.group_id:body.groupId===null||body.groupId===''?null:atlasString(body.groupId,'Группа',40);
  if(!(await db.prepare('SELECT id FROM lessons WHERE subject=? LIMIT 1').bind(subject).first()))atlasFail(404,'Дисциплина не найдена.');
  if(groupId&&!(await db.prepare('SELECT id FROM teaching_assignments WHERE group_id=? AND subject=? LIMIT 1').bind(groupId,subject).first()))atlasFail(400,'Предмет отсутствует в выбранной группе.');
  if(user.role==='teacher'&&(!groupId||!(await db.prepare('SELECT id FROM teaching_assignments WHERE teacher_id=? AND group_id=? AND subject=? LIMIT 1').bind(user.id,groupId,subject).first())))atlasFail(403,'Материал относится к чужой группе или дисциплине.');
  return {subject,groupId};
}
async function atlasManagementPublication(db,type,id,clubId) {
  const table={news:'news',resource:'resources',club:'club_posts'}[type];
  if(!table)atlasFail(404,'Вид публикации не найден.');
  const row=await db.prepare(`SELECT * FROM ${table} WHERE id=?`).bind(id).first();
  if(!row||(type==='club'&&clubId&&row.club_id!==clubId))atlasFail(404,'Публикация не найдена.');
  return row;
}
async function atlasManagementNewsResult(db,id) {
  const row=await db.prepare('SELECT n.*,u.name AS author_name,u.role AS author_role,g.name AS group_name FROM news n JOIN users u ON u.id=n.author_id LEFT JOIN groups g ON g.id=n.group_id WHERE n.id=?').bind(id).first();
  return {...atlasNews(row),archived:Boolean(row.archived),updatedAt:row.updated_at,attachments:await atlasAttachments(db,'news_id',id)};
}
async function atlasManagementResourceResult(db,id) {
  const row=await db.prepare('SELECT r.*,u.name AS author,u.role AS author_role,g.name AS group_name FROM resources r LEFT JOIN users u ON u.id=r.author_id LEFT JOIN groups g ON g.id=r.group_id WHERE r.id=?').bind(id).first();
  return {...atlasResource(row),archived:Boolean(row.archived),updatedAt:row.updated_at};
}
async function atlasManagementCanReadAttachment(db,user,file) {
  if(file.news_id){const news=await db.prepare('SELECT author_id,archived FROM news WHERE id=?').bind(file.news_id).first();if(!news)return false;if(news.archived)return user.role==='admin'||news.author_id===user.id;return atlasCanReadNews(db,user,file.news_id);}
  if(file.club_post_id){const post=await db.prepare('SELECT author_id,archived FROM club_posts WHERE id=?').bind(file.club_post_id).first();return Boolean(post&&(!post.archived||post.author_id===user.id||user.role==='admin'));}
  return file.owner_id===user.id;
}
async function atlasManagementArchive(db,user) {
  const entries=[];
  for(const [type,table] of [['news','news'],['resource','resources'],['club','club_posts']]){
    const condition=user.role==='admin'?'':' AND p.author_id=?';
    const rows=(await db.prepare(`SELECT p.*,u.name AS author FROM ${table} p JOIN users u ON u.id=p.author_id WHERE p.archived=1${condition} ORDER BY p.updated_at DESC,p.created_at DESC LIMIT 100`).bind(...(user.role==='admin'?[]:[user.id])).all()).results;
    for(const row of rows)entries.push({id:row.id,type,clubId:row.club_id||null,title:row.title,body:row.body,authorId:row.author_id,author:row.author,createdAt:row.created_at,archivedAt:row.updated_at,canRestore:await atlasManagementMayChange(db,user,row,type)});
  }
  entries.sort((a,b)=>b.archivedAt.localeCompare(a.archivedAt));
  return {items:entries.slice(0,200)};
}
async function atlasManagementPeople(db,user) {
  atlasRole(user,'admin');
  const users=(await db.prepare('SELECT u.id,u.name,u.role,u.group_id,g.name AS group_name,u.tag,u.faculty,u.direction,u.course FROM users u LEFT JOIN groups g ON g.id=u.group_id ORDER BY u.role,u.name').all()).results;
  const groups=(await db.prepare('SELECT id,name,faculty,direction,course FROM groups ORDER BY name').all()).results;
  const clubs=(await db.prepare('SELECT id,name,description FROM clubs ORDER BY name').all()).results;
  const memberships=(await db.prepare('SELECT club_id,user_id,role FROM club_members').all()).results;
  return {users:users.map(row=>({id:row.id,name:row.name,role:row.role,groupId:row.group_id,group:row.group_name,tag:row.tag,faculty:row.faculty,direction:row.direction,course:row.course,clubs:memberships.filter(m=>m.user_id===row.id).map(m=>({clubId:m.club_id,role:m.role}))})),groups,clubs,groupTags:ATLAS_GROUP_TAGS,clubRoles:ATLAS_MANAGEMENT_CLUB_ROLES};
}
async function atlasManagementStudent(db,user,id,body) {
  atlasRole(user,'admin');atlasManagementFields(body,['groupId','tag']);
  const student=await db.prepare("SELECT * FROM users WHERE id=? AND role='student'").bind(id).first();
  if(!student)atlasFail(404,'Студент не найден.');
  const groupId=atlasString(body.groupId??student.group_id,'Группа',40),tag=body.tag??(student.tag||'Студент');
  if(!ATLAS_GROUP_TAGS.includes(tag))atlasFail(400,'Выберите допустимый статус в группе.');
  const group=await db.prepare('SELECT * FROM groups WHERE id=?').bind(groupId).first();if(!group)atlasFail(404,'Группа не найдена.');
  const changes=[];
  if(tag==='Староста'){changes.push(db.prepare("UPDATE chat_members SET role='member' WHERE chat_id IN (SELECT id FROM chats WHERE kind='group' AND group_id=?) AND user_id IN (SELECT id FROM users WHERE role='student' AND group_id=? AND tag='Староста' AND id<>?)").bind(groupId,groupId,id));changes.push(db.prepare("UPDATE users SET tag='Студент' WHERE role='student' AND group_id=? AND tag='Староста' AND id<>?").bind(groupId,id));}
  changes.push(db.prepare('UPDATE users SET group_id=?,faculty=?,direction=?,course=?,tag=? WHERE id=?').bind(groupId,group.faculty,group.direction,group.course,tag,id));
  changes.push(db.prepare("DELETE FROM chat_folder_assignments WHERE user_id=? AND chat_id IN (SELECT id FROM chats WHERE kind='group' AND group_id<>?)").bind(id,groupId));
  changes.push(db.prepare("DELETE FROM chat_members WHERE user_id=? AND chat_id IN (SELECT id FROM chats WHERE kind='group' AND group_id<>?)").bind(id,groupId));
  const chats=(await db.prepare("SELECT id FROM chats WHERE kind='group' AND group_id=?").bind(groupId).all()).results;
  for(const chat of chats)changes.push(db.prepare('INSERT INTO chat_members(chat_id,user_id,role) VALUES(?,?,?) ON CONFLICT(chat_id,user_id) DO UPDATE SET role=excluded.role').bind(chat.id,id,tag==='Староста'?'headman':'member'));
  await db.batch(changes);
  return (await atlasManagementPeople(db,user)).users.find(row=>row.id===id);
}
async function atlasManagementClubMember(db,user,clubId,userId,method,body) {
  atlasRole(user,'admin');
  const club=await db.prepare('SELECT id,name,description FROM clubs WHERE id=?').bind(clubId).first();if(!club)atlasFail(404,'Клуб не найден.');
  if(!(await db.prepare('SELECT id FROM users WHERE id=?').bind(userId).first()))atlasFail(404,'Пользователь не найден.');
  const chats=(await db.prepare("SELECT id FROM chats WHERE kind='club' AND club_id=?").bind(clubId).all()).results;
  const changes=[];
  if(method==='DELETE'){
    changes.push(db.prepare('DELETE FROM club_members WHERE club_id=? AND user_id=?').bind(clubId,userId));
    changes.push(db.prepare("UPDATE campus_event_members SET status='cancelled',updated_at=? WHERE user_id=? AND event_id IN (SELECT id FROM campus_events WHERE club_id=? AND audience='members')").bind(new Date().toISOString(),userId,clubId));
    for(const chat of chats){changes.push(db.prepare('DELETE FROM chat_folder_assignments WHERE chat_id=? AND user_id=?').bind(chat.id,userId));changes.push(db.prepare('DELETE FROM chat_members WHERE chat_id=? AND user_id=?').bind(chat.id,userId));}
  }else{
    atlasManagementFields(body,['role']);const role=body.role||'Участник';if(!ATLAS_MANAGEMENT_CLUB_ROLES.includes(role))atlasFail(400,'Выберите роль в клубе.');
    changes.push(db.prepare('INSERT INTO club_members(club_id,user_id,role) VALUES(?,?,?) ON CONFLICT(club_id,user_id) DO UPDATE SET role=excluded.role').bind(clubId,userId,role));
    if(!chats.length){const id='club-chat-'+clubId;changes.push(db.prepare("INSERT OR IGNORE INTO chats(id,title,kind,group_id,club_id,folder,description) VALUES(?,?,'club',NULL,?,'Клубы',?)").bind(id,club.name,clubId,club.description));chats.push({id});}
    for(const chat of chats)changes.push(db.prepare('INSERT INTO chat_members(chat_id,user_id,role) VALUES(?,?,?) ON CONFLICT(chat_id,user_id) DO UPDATE SET role=excluded.role').bind(chat.id,userId,role==='Участник'?'member':'editor'));
  }
  await db.batch(changes);return {ok:true,clubId,userId,isMember:method!=='DELETE'};
}
async function handleManagementApi(request,env,db,user,url) {
  void env;const path=url.pathname,method=request.method.toUpperCase();
  if(method==='GET'&&path==='/api/publication-archive')return atlasJson(await atlasManagementArchive(db,user));
  if(method==='GET'&&path==='/api/admin/people')return atlasJson(await atlasManagementPeople(db,user));
  const person=path.match(/^\/api\/admin\/people\/([^/]+)$/);
  if(person&&method==='PATCH')return atlasJson({user:await atlasManagementStudent(db,user,atlasManagementId(person[1]),await atlasBody(request))});
  const member=path.match(/^\/api\/admin\/clubs\/([^/]+)\/members\/([^/]+)$/);
  if(member&&['PUT','DELETE'].includes(method))return atlasJson(await atlasManagementClubMember(db,user,atlasManagementId(member[1]),atlasManagementId(member[2]),method,method==='PUT'?await atlasBody(request):{}));
  const direct=path.match(/^\/api\/(news|resources)\/([^/]+)(\/archive)?$/),club=path.match(/^\/api\/clubs\/([^/]+)\/posts\/([^/]+)(\/archive)?$/);
  if(!direct&&!club)return null;
  const type=club?'club':direct[1]==='news'?'news':'resource',id=atlasManagementId(club?club[2]:direct[2]),clubId=club?atlasManagementId(club[1]):null,archive=Boolean(club?club[3]:direct[3]);
  if((archive&&method!=='POST')||(!archive&&method!=='PATCH'))return null;
  const row=await atlasManagementPublication(db,type,id,clubId);await atlasManagementRequireChange(db,user,row,type);const body=await atlasBody(request),now=new Date().toISOString(),table={news:'news',resource:'resources',club:'club_posts'}[type];
  if(archive){atlasManagementFields(body,['archived']);if(typeof body.archived!=='boolean')atlasFail(400,'Укажите действие архива.');
    if(!body.archived){if(type==='news')await atlasManagementNewsAudience(db,user,row.scope,row.group_id);if(type==='resource')await atlasManagementResourceAudience(db,user,row,{});}
    await db.prepare(`UPDATE ${table} SET archived=?,updated_at=?,updated_by=? WHERE id=?`).bind(body.archived?1:0,now,user.id,id).run();return atlasJson({ok:true,id,type,archived:body.archived});
  }
  if(type==='news'){
    atlasManagementFields(body,['title','body','scope','groupId','deadline']);const scope=body.scope??row.scope,groupId=await atlasManagementNewsAudience(db,user,scope,body.groupId===undefined?row.group_id:body.groupId);
    const deadline=body.deadline===undefined?row.deadline:atlasManagementDeadline(body.deadline);
    await db.prepare('UPDATE news SET title=?,body=?,scope=?,group_id=?,deadline=?,updated_at=?,updated_by=? WHERE id=?').bind(atlasString(body.title??row.title,'Заголовок',140),atlasString(body.body??row.body,'Текст',4000),scope,groupId,deadline,now,user.id,id).run();return atlasJson({news:await atlasManagementNewsResult(db,id)});
  }
  if(type==='resource'){
    atlasManagementFields(body,['title','body','description','type','subject','groupId']);const target=await atlasManagementResourceAudience(db,user,row,body);
    await db.prepare('UPDATE resources SET subject=?,group_id=?,title=?,type=?,description=?,body=?,updated_at=?,updated_by=? WHERE id=?').bind(target.subject,target.groupId,atlasString(body.title??row.title,'Название',160),atlasString(body.type??row.type,'Формат',40),atlasString(body.description??row.description,'Описание',400,0),atlasString(body.body??row.body,'Содержание',8000),now,user.id,id).run();return atlasJson({resource:await atlasManagementResourceResult(db,id)});
  }
  atlasManagementFields(body,['title','body']);await db.prepare('UPDATE club_posts SET title=?,body=?,updated_at=?,updated_by=? WHERE id=?').bind(atlasString(body.title??row.title,'Заголовок',140),atlasString(body.body??row.body,'Текст',4000),now,user.id,id).run();return atlasJson({post:{...await atlasClubPost(db,id),archived:Boolean(row.archived),updatedAt:now}});
}

// Publication editing, reversible archive, and the administration directory.
function managementData(){return state.data.management||{users:[],groups:[],clubs:[],groupTags:[],clubRoles:[]};}
function managementPublicationLabel(type){return {news:'Объявление',resource:'Учебный материал',club:'Новость клуба'}[type]||'Публикация';}
function publicationManageActions(item,type,clubId=''){
  const own=String(item.authorId||'')===String(state.user?.id);
  const allowed=state.user?.role==='admin'||(own&&(type==='club'?Boolean(state.data.clubDetail?.club?.canPublish):state.user?.role==='teacher'));
  if(!allowed)return '';
  return `<div class="management-publication-actions"><button class="btn btn-ghost btn-small" data-management-edit="${esc(item.id)}" data-publication-type="${type}" data-club-id="${esc(clubId)}">${icon('edit','icon-sm')} Изменить</button><button class="btn btn-ghost btn-small" data-management-archive="${esc(item.id)}" data-publication-type="${type}" data-club-id="${esc(clubId)}">${icon('folder','icon-sm')} В архив</button></div>`;
}
function managementFindPublication(type,id){
  const items=type==='news'?arr(state.data.news):type==='resource'?arr(state.data.resources).flatMap(subject=>arr(subject.resources)):arr(state.data.clubDetail?.posts);
  return items.find(item=>String(item.id)===String(id));
}
function managementPublicationPath(type,id,clubId){return type==='club'?`/api/clubs/${encodeURIComponent(clubId)}/posts/${encodeURIComponent(id)}`:`/api/${type==='resource'?'resources':'news'}/${encodeURIComponent(id)}`;}
function managementPeopleResults(){
  const data=managementData(),term=String(state.managementSearch||'').trim().toLocaleLowerCase('ru');
  const users=arr(data.users).filter(user=>!term||[user.name,user.group,user.tag,roleName(user.role)].join(' ').toLocaleLowerCase('ru').includes(term));
  return users.length?`<div class="management-people-list">${users.map(user=>`<article class="card management-person"><div class="management-person-main"><span class="avatar">${esc(initials(user.name))}</span><div><h3>${esc(user.name)}</h3><span>${esc(roleName(user.role))}${user.group?' · '+esc(user.group):''}</span></div></div><div class="management-person-tags">${user.tag?`<span class="tag">${esc(user.tag)}</span>`:''}<small>${quantity(arr(user.clubs).length,['клуб','клуба','клубов'])}</small></div><div class="management-person-actions">${user.role==='student'?`<button class="btn btn-ghost btn-small" data-management-student="${esc(user.id)}">${icon('grades','icon-sm')} Группа и статус</button>`:''}<button class="btn btn-light btn-small" data-management-clubs="${esc(user.id)}">${icon('users','icon-sm')} Участие в клубах</button></div></article>`).join('')}</div>`:emptyState('Пользователь не найден','Попробуйте другое имя, группу или статус.','search');
}
function renderManagement(){
  if(state.user?.role!=='admin')return emptyState('Раздел доступен администрации','Для управления группами и клубами нужен аккаунт учебного офиса.','users');
  const data=managementData();
  return `${pageHeader('Учебный офис','Люди и роли','Учебные группы, старосты и команды университетских клубов.')}<div class="management-overview"><div class="card management-stat"><strong>${arr(data.users).length}</strong><span>Пользователей</span></div><div class="card management-stat"><strong>${arr(data.groups).length}</strong><span>Учебных групп</span></div><div class="card management-stat"><strong>${arr(data.clubs).length}</strong><span>Клубов</span></div></div><div class="management-toolbar"><label>${icon('search')}<input type="search" id="management-search" value="${esc(state.managementSearch||'')}" placeholder="Имя, группа или статус" aria-label="Найти пользователя"></label><p>Логины и системные роли здесь не изменяются.</p></div><div id="management-people-results">${managementPeopleResults()}</div>`;
}
function renderArchive(){
  const items=arr(state.data.archive?.items);
  return `${pageHeader('Управление публикациями','Архив','Публикации скрыты из обычных разделов. Их можно вернуть без потери текста и вложений.')}<div class="info-banner">${icon('info')}<span>${state.user?.role==='admin'?'Администрация видит весь архив.':'Здесь только ваши архивные публикации.'} Архивирование сохраняет запись и её файлы.</span></div>${items.length?`<div class="management-archive-grid">${items.map(item=>`<article class="card management-archive-card"><div class="management-archive-meta"><span class="tag">${managementPublicationLabel(item.type)}</span><time>${esc(dateFmt(item.archivedAt||item.createdAt))}</time></div><h2>${esc(item.title)}</h2><p>${esc(String(item.body||'').slice(0,240))}${String(item.body||'').length>240?'…':''}</p><div class="management-archive-bottom"><span>${esc(item.author)}</span>${item.canRestore?`<button class="btn btn-light btn-small" data-management-restore="${esc(item.id)}" data-publication-type="${esc(item.type)}" data-club-id="${esc(item.clubId||'')}">${icon('arrowLeft','icon-sm')} Восстановить</button>`:'<small>Для восстановления нужны действующие права публикации.</small>'}</div></article>`).join('')}</div>`:emptyState('Архив пока пуст','Уберите ненужную публикацию в архив. Она появится здесь и будет доступна для восстановления.','folder')}`;
}
function renderManagementModal(modal){
  const data=managementData();
  if(modal.type==='management-student'){
    const user=arr(data.users).find(item=>item.id===modal.id);if(!user)return '';
    return extModalShell('Группа и статус',user.name,`<form id="management-student-form"><div class="field"><label for="management-group">Учебная группа</label><select id="management-group" name="groupId" required>${arr(data.groups).map(group=>`<option value="${esc(group.id)}" ${group.id===user.groupId?'selected':''}>${esc(group.name)}</option>`).join('')}</select></div><div class="field"><label for="management-tag">Статус в группе</label><select id="management-tag" name="tag">${arr(data.groupTags).map(tag=>`<option ${tag===user.tag?'selected':''}>${esc(tag)}</option>`).join('')}</select></div><div class="settings-note">${icon('info')}<span>Направление, факультет и курс будут взяты из выбранной группы. В группе может быть один староста: при новом назначении прежний получит статус студента. Доступ к групповым чатам обновится автоматически.</span></div>${extModalActions('Сохранить')}</form>`,'Учебные данные');
  }
  if(modal.type==='management-clubs'){
    const user=arr(data.users).find(item=>item.id===modal.id);if(!user)return '';
    return extModalShell('Участие в клубах',user.name,`<form id="management-clubs-form"><div class="management-club-assignments">${arr(data.clubs).map(club=>{const membership=arr(user.clubs).find(item=>item.clubId===club.id);return `<div class="management-club-assignment"><label for="management-club-${esc(club.id)}"><strong>${esc(club.name)}</strong><span>${esc(club.description)}</span></label><select id="management-club-${esc(club.id)}" name="club:${esc(club.id)}"><option value="">Не участвует</option>${arr(data.clubRoles).map(role=>`<option value="${esc(role)}" ${membership?.role===role?'selected':''}>${esc(role)}</option>`).join('')}</select></div>`;}).join('')}</div><div class="settings-note">${icon('info')}<span>Участник получает доступ к чату. Редактор, куратор и координатор также могут публиковать новости. Удалённое участие можно назначить снова.</span></div>${extModalActions('Сохранить участие')}</form>`,'Команды университета');
  }
  if(modal.type==='management-archive')return extModalShell('Убрать публикацию в архив?',managementPublicationLabel(modal.publicationType),`<form id="management-archive-form"><div class="management-confirm"><h3>${esc(modal.item?.title)}</h3><p>Запись исчезнет из общей ленты, но текст и вложения сохранятся. Вернуть публикацию можно в разделе «Архив».</p></div>${extModalActions('В архив')}</form>`,'Публикация');
  if(modal.type!=='management-edit')return '';
  const item=modal.item||{},type=modal.publicationType,resource=type==='resource',club=type==='club',admin=state.user.role==='admin';
  const groups=resource?arr(state.data.resourceMeta?.groups):arr(state.data.staff?.groups),groupId=item.groupId||'';
  return extModalShell('Изменить публикацию',managementPublicationLabel(type),`<form id="management-edit-form">${resource?`<div class="ext-form-grid"><div class="field"><label for="management-resource-group">Для группы</label><select id="management-resource-group" name="groupId">${admin?'<option value="">Все подходящие группы</option>':''}${groups.map(group=>`<option value="${esc(group.id)}" ${group.id===groupId?'selected':''}>${esc(group.name)}</option>`).join('')}</select></div><div class="field"><label for="management-resource-subject">Предмет</label><select id="management-resource-subject" name="subject" required>${resourceFormSubjects(groupId).map(subject=>`<option ${subject===item.subject?'selected':''}>${esc(subject)}</option>`).join('')}</select></div></div>`:''}<div class="field"><label for="management-title">Заголовок</label><input id="management-title" name="title" value="${esc(item.title)}" maxlength="${resource?160:140}" required></div>${resource?`<div class="ext-form-grid"><div class="field"><label for="management-resource-type">Формат</label><input id="management-resource-type" name="type" maxlength="40" value="${esc(item.type)}" required></div><div class="field"><label for="management-description">Краткое описание</label><input id="management-description" name="description" maxlength="400" value="${esc(item.description)}"></div></div>`:''}<div class="field"><label for="management-body">${resource?'Содержание':'Текст публикации'}</label><textarea id="management-body" name="body" maxlength="${resource?8000:4000}" required>${esc(item.body)}</textarea></div>${!club&&!resource?`<div class="ext-form-grid"><div class="field"><label for="management-news-scope">Кому показать</label><select id="management-news-scope" name="scope">${admin?`<option value="all" ${item.scope==='all'?'selected':''}>Всем в университете</option>`:''}<option value="group" ${item.scope==='group'?'selected':''}>Конкретной группе</option></select></div><div class="field" id="management-news-group-field" ${item.scope==='all'?'hidden':''}><label for="management-news-group">Учебная группа</label><select id="management-news-group" name="groupId">${groups.map(group=>`<option value="${esc(group.id)}" ${group.id===item.groupId?'selected':''}>${esc(group.name)}</option>`).join('')}</select></div></div><div class="field"><label for="management-news-deadline">Напомнить о сроке</label><input id="management-news-deadline" name="deadline" type="date" value="${esc(item.deadline||'')}"><small class="muted">Можно оставить пустым, если у объявления нет дедлайна.</small></div>`:''}<div class="settings-note">${icon('info')}<span>${arr(item.attachments).length?'Ранее прикреплённые изображения и документы сохранятся.':'Изменения появятся у читателей после сохранения.'}</span></div>${extModalActions('Сохранить изменения')}</form>`,'Редактирование');
}
async function managementRefresh(type){
  if(type==='resource')await loadData(['resources']);
  else if(type==='news')await loadData(isStaff()?['news','dashboard','staff']:['news','dashboard']);
  else {if(state.clubId)state.data.clubDetail=await api('/api/clubs/'+encodeURIComponent(state.clubId));await loadData(['clubs']);}
}
async function managementClick(event){
  const nav=event.target.closest('[data-view]');
  if(nav&&['people','archive'].includes(nav.dataset.view)){
    event.preventDefault();try{const view=nav.dataset.view;if(view==='people'&&state.user.role!=='admin')throw new Error('Раздел доступен администрации.');state.data[view==='people'?'management':'archive']=await api(view==='people'?'/api/admin/people':'/api/publication-archive');state.view=view;state.modal=null;state.menu=false;render();window.scrollTo({top:0,behavior:'smooth'});}catch(error){toast(error.message,true);}return true;
  }
  const person=event.target.closest('[data-management-student],[data-management-clubs]');
  if(person){state.modal={type:person.hasAttribute('data-management-student')?'management-student':'management-clubs',id:person.dataset.managementStudent||person.dataset.managementClubs};render();return true;}
  const action=event.target.closest('[data-management-edit],[data-management-archive],[data-management-restore]');if(!action)return false;
  const type=action.dataset.publicationType,id=action.dataset.managementEdit||action.dataset.managementArchive||action.dataset.managementRestore,clubId=action.dataset.clubId;
  if(action.hasAttribute('data-management-restore')){
    if(state.busy)return true;action.disabled=true;
    try{await api(managementPublicationPath(type,id,clubId)+'/archive','POST',{archived:false});state.data.archive=await api('/api/publication-archive');await managementRefresh(type);render();toast('Публикация восстановлена.');}catch(error){toast(error.message,true);}finally{if(action.isConnected)action.disabled=false;}return true;
  }
  const item=managementFindPublication(type,id);if(!item){toast('Публикация изменилась. Откройте раздел ещё раз.',true);return true;}
  state.modal={type:action.hasAttribute('data-management-edit')?'management-edit':'management-archive',publicationType:type,id,clubId,item};render();return true;
}
async function managementChange(event){
  if(event.target.id==='management-news-scope'){const field=root.querySelector('#management-news-group-field');if(field)field.hidden=event.target.value!=='group';return true;}
  if(event.target.id==='management-resource-group'){const select=root.querySelector('#management-resource-subject'),old=select?.value;if(select)select.innerHTML=resourceFormSubjects(event.target.value).map(subject=>`<option ${subject===old?'selected':''}>${esc(subject)}</option>`).join('');return true;}
  if(event.target.id==='management-search'){state.managementSearch=event.target.value;const container=root.querySelector('#management-people-results');if(container)container.innerHTML=managementPeopleResults();return true;}
  return false;
}
async function managementSubmit(form,values){
  if(!['management-edit-form','management-archive-form','management-student-form','management-clubs-form'].includes(form.id))return false;
  const modal=state.modal;
  if(form.id==='management-edit-form'){await api(managementPublicationPath(modal.publicationType,modal.id,modal.clubId),'PATCH',values);if(modal.publicationType==='resource'){state.resourceSubject=values.subject;state.resourceAuthor='';}await managementRefresh(modal.publicationType);toast('Публикация обновлена.');}
  if(form.id==='management-archive-form'){await api(managementPublicationPath(modal.publicationType,modal.id,modal.clubId)+'/archive','POST',{archived:true});await managementRefresh(modal.publicationType);toast('Публикация сохранена в архиве.');}
  if(form.id==='management-student-form'){await api('/api/admin/people/'+encodeURIComponent(modal.id),'PATCH',{groupId:values.groupId,tag:values.tag});state.data.management=await api('/api/admin/people');await loadData(['group','staff']);toast('Группа и статус обновлены.');}
  if(form.id==='management-clubs-form'){
    const person=arr(managementData().users).find(user=>user.id===modal.id);
    for(const club of arr(managementData().clubs)){const before=arr(person?.clubs).find(m=>m.clubId===club.id)?.role||'',after=values['club:'+club.id]||'';if(before===after)continue;await api(`/api/admin/clubs/${encodeURIComponent(club.id)}/members/${encodeURIComponent(modal.id)}`,after?'PUT':'DELETE',after?{role:after}:undefined);}
    state.data.management=await api('/api/admin/people');await loadData(['clubs','group']);toast('Участие и роли в клубах обновлены.');
  }
  return true;
}
root.addEventListener('input',event=>{if(event.target.id==='management-search')void managementChange(event);});

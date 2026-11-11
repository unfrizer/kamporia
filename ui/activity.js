// Personal notifications and incremental chat updates. Injected in the app closure.
const activityRuntime={userKey:'',generation:0,timer:null,controller:null,inFlight:false,lastNotifications:0,lastMe:0,chatId:'',cursor:null,showNew:0};
const activityDrafts=new Map();
const activityIcon=kind=>({homework:'grades',deadline:'clock',schedule:'calendar',request:'file',news:'news'}[kind]||'bell');
const activityKind=kind=>({homework:'Домашние задания',deadline:'Сроки',schedule:'Расписание',request:'Деканат',news:'Объявления',campus:'Клубы',consultation:'Консультации'}[kind]||'Событие');
function activityData(){return state.data.notifications||{notifications:[],unreadCount:0,unreadMessages:0,unreadByChat:{}};}
function activityScope(user=state.user){return user?[user.id,user.role,user.groupId,user.tag].join('|'):'';}
function activityDraftKey(chatId){return `${state.user?.id||''}:${chatId||''}`;}
function activityMessageHtml(message){return `<div class="message ${String(message.authorId)===String(state.user?.id)?'own':''}" data-message-id="${esc(message.id)}"><strong>${personButton(message.authorId,message.author||'Участник')}</strong><p>${esc(message.body)}</p><time>${esc(dateFmt(message.createdAt,{hour:'2-digit',minute:'2-digit'}))}</time></div>`;}
function renderLiveChats(){
  const chats=arr(state.data.chats?.chats),customFolders=arr(state.data.chats?.folders);
  const folders=[...new Set([...chats.map(chat=>chat.folder||'Основные'),...customFolders.map(folder=>folder.name)])];
  const active=chats.find(chat=>String(chat.id)===String(state.selectedChat))||chats[0];if(active)state.selectedChat=active.id;
  const oldArea=root.querySelector('[data-activity-chat]');
  activityRuntime.restoreScroll=oldArea&&oldArea.dataset.activityChat===String(active?.id)&&!activityRuntime.forceBottom&&!activityChatAtBottom(oldArea)?{chatId:String(active.id),top:oldArea.scrollTop}:null;
  const messages=arr(active?.messages),draft=activityDrafts.get(activityDraftKey(active?.id))||'';
  return `${pageHeader('Связь с университетом','Сообщения','Личные диалоги и чаты ваших сообществ — с автоматическим обновлением.',`<button class="btn btn-primary" data-message-contacts>${icon('chat')} Написать</button><button class="btn btn-light" data-action="new-chat-folder">${icon('folder')} Новая папка</button>`)}${chats.length?`<div class="card chat-layout"><div class="chat-sidebar"><div class="chat-side-head">Все чаты <span class="muted">· ${chats.length}</span><button class="icon-btn" data-action="new-chat-folder" aria-label="Создать папку">${icon('plus','icon-sm')}</button></div><div class="chat-groups">${folders.map(folder=>`<div class="chat-group-label">${esc(folder)}</div>${chats.filter(chat=>(chat.folder||'Основные')===folder).map(chat=>`<button class="chat-item ${String(chat.id)===String(active.id)?'active':''}" data-chat="${esc(chat.id)}"><span class="avatar">${esc(initials(chat.title))}</span><span style="min-width:0;flex:1"><strong>${esc(chat.title)}</strong><small>${esc(chat.description||arr(chat.messages).at(-1)?.body||'Чат группы')}</small></span><span class="activity-unread nav-badge" data-chat-count="${esc(chat.id)}" ${Number(chat.unread)?'':'hidden'}>${Math.min(99,Number(chat.unread)||0)}</span></button>`).join('')}`).join('')}</div></div><div class="chat-window"><div class="chat-head"><div><strong>${esc(active.title)}</strong><small>${esc(active.description||'Университетский чат')}</small></div><label class="chat-folder-control">${icon('folder','icon-sm')}<select id="chat-folder-select" aria-label="Переместить чат в папку"><option value="">Исходная папка</option>${options(customFolders,active.folderId)}</select></label></div><div class="activity-chat-status" role="status" data-chat-connection>Сообщения обновляются автоматически</div><div class="chat-messages" data-activity-chat="${esc(active.id)}">${messages.length?messages.map(activityMessageHtml).join(''):`<div class="activity-chat-empty">${emptyState('Пока нет сообщений','Начните обсуждение — сообщение увидят участники чата.','chat')}</div>`}</div><button class="activity-new-messages" type="button" data-activity-action="show-new" hidden>Новые сообщения ${icon('down','icon-sm')}</button><form id="chat-form" class="chat-compose"><input id="live-chat-body" data-live-chat-body name="body" aria-label="Сообщение" maxlength="2000" placeholder="Написать сообщение…" value="${esc(draft)}" required><button class="btn btn-primary" type="submit" aria-label="Отправить сообщение" ${state.busy?'disabled':''}>${icon('send')}</button></form></div></div>`:emptyState('Чатов пока нет','Нажмите «Написать», чтобы выбрать собеседника.','chat')}`;
}
function renderNotifications(){
  const data=activityData(),unreadOnly=state.notificationFilter==='unread';
  const items=arr(data.notifications).filter(item=>!unreadOnly||!item.read);
  return `${pageHeader('Всегда в курсе','Уведомления','Переносы пар, сроки домашних заданий и ответы деканата — в одном месте.',Number(data.unreadCount)?`<button class="btn btn-ghost" data-activity-action="read-all">${icon('check')} Прочитать все</button>`:'')}<div class="activity-notification-toolbar"><div class="tabs" aria-label="Фильтр уведомлений"><button class="tab ${!unreadOnly?'active':''}" data-activity-filter="all">Все события</button><button class="tab ${unreadOnly?'active':''}" data-activity-filter="unread">Непрочитанные <span>${Number(data.unreadCount)||0}</span></button></div><span class="muted">Последние 30 дней</span></div>${items.length?`<div class="activity-notification-list">${items.map(item=>`<article class="card activity-notification ${item.read?'is-read':'is-unread'}" data-notification-id="${esc(item.id)}"><span class="activity-event-icon">${icon(activityIcon(item.kind))}</span><div class="activity-event-copy"><div class="activity-event-meta"><span>${activityKind(item.kind)}</span><time>${esc(dateFmt(item.createdAt,{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}))}</time>${!item.read?'<i aria-label="Не прочитано"></i>':''}</div><h2>${esc(item.title)}</h2><p>${esc(item.body)}</p><div class="activity-event-actions"><button class="btn btn-light btn-small" data-notification-open="${esc(item.id)}">Открыть ${icon('arrow','icon-sm')}</button><button class="activity-read-toggle" data-notification-read="${esc(item.id)}">${item.read?'Отметить непрочитанным':'Отметить прочитанным'}</button></div></div></article>`).join('')}</div>`:`<div class="card card-pad">${emptyState(unreadOnly?'Всё прочитано':'Пока нет новых событий',unreadOnly?'Новые события появятся здесь автоматически.':'Здесь появятся изменения расписания, задания и ответы учебного офиса.','bell')}</div>`}`;
}
function activityUpdateBadges(){
  const data=activityData(),count=Number(data.unreadCount)||0,total=Number(data.unreadMessages)||0;
  root.querySelectorAll('[data-notification-count]').forEach(node=>{node.textContent=count>99?'99+':String(count);node.hidden=!count;});
  const bell=root.querySelector('[data-view="notifications"]');if(bell)bell.setAttribute('aria-label',count?`Уведомления: непрочитано ${count}`:'Уведомления');
  for(const button of root.querySelectorAll('button[data-view="chats"]')){
    let badge=button.querySelector('[data-chat-unread-count]');
    if(!badge){badge=document.createElement('span');badge.dataset.chatUnreadCount='';badge.className='activity-chat-count';badge.setAttribute('aria-hidden','true');button.appendChild(badge);}
    badge.textContent=total>99?'99+':String(total);badge.hidden=!total;
  }
  root.querySelectorAll('[data-chat-count]').forEach(node=>{const value=Number(data.unreadByChat?.[node.dataset.chatCount])||0;node.textContent=value>99?'99+':String(value);node.hidden=!value;});
  for(const chat of arr(state.data.chats?.chats))chat.unread=Number(data.unreadByChat?.[chat.id])||0;
  if(state.data.dashboard)state.data.dashboard.unreadMessages=total;
}
function activityApplyCounts(result){
  const data=activityData();
  if(result.notifications)state.data.notifications=result;
  else {data.unreadMessages=Number(result.unreadMessages??result.totalUnread)||0;data.unreadByChat=result.unreadByChat||result.byChat||{};state.data.notifications=data;}
  activityUpdateBadges();
}
async function activityFetch(path,{method='GET',body,signal}={}){
  const response=await fetch(path,{method,credentials:'same-origin',signal,headers:body===undefined?{}:{'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
  const result=await response.json().catch(()=>({}));
  if(!response.ok){const error=new Error(result.error||'Не удалось обновить события.');error.status=response.status;throw error;}return result;
}
function activityStop(){
  if(activityRuntime.timer)clearInterval(activityRuntime.timer);activityRuntime.timer=null;
  activityRuntime.controller?.abort();activityRuntime.controller=null;activityRuntime.inFlight=false;activityRuntime.generation++;
}
function activityChatAtBottom(area){return !area||area.scrollHeight-area.scrollTop-area.clientHeight<90;}
async function activityMarkVisibleRead(chatId,generation=activityRuntime.generation){
  const area=root.querySelector('[data-activity-chat]');
  if(!area||area.dataset.activityChat!==chatId||!activityChatAtBottom(area))return;
  const id=area.querySelector('[data-message-id]:last-child')?.dataset.messageId;
  if(!id)return;
  if(activityRuntime.lastRead===chatId+':'+id)return;
  activityRuntime.lastRead=chatId+':'+id;
  try{const counts=await activityFetch('/api/chats/'+encodeURIComponent(chatId)+'/read',{method:'POST',body:{lastMessageId:id},signal:activityRuntime.controller?.signal});if(generation===activityRuntime.generation&&state.user&&state.view==='chats'&&String(state.selectedChat)===chatId)activityApplyCounts(counts);}catch(error){if(error.name!=='AbortError')activityRuntime.lastRead='';}
}
function activityMergeChat(result){
  const chat=arr(state.data.chats?.chats).find(item=>String(item.id)===String(result.chatId));if(!chat)return;
  const area=root.querySelector('[data-activity-chat]');if(!area||area.dataset.activityChat!==result.chatId)return;
  const atBottom=activityChatAtBottom(area),messages=arr(result.messages);
  if(!activityRuntime.cursor){chat.messages=messages;area.innerHTML=messages.length?messages.map(activityMessageHtml).join(''):`<div class="activity-chat-empty">${emptyState('Пока нет сообщений','Начните обсуждение — сообщение увидят участники чата.','chat')}</div>`;}
  else{
    const known=new Set(arr(chat.messages).map(item=>item.id)),fresh=messages.filter(item=>!known.has(item.id));
    chat.messages=[...arr(chat.messages),...fresh].slice(-300);
    if(fresh.length){area.querySelector('.activity-chat-empty')?.remove();area.insertAdjacentHTML('beforeend',fresh.map(activityMessageHtml).join(''));activityRuntime.showNew+=fresh.filter(item=>item.authorId!==state.user.id).length;}
  }
  activityRuntime.cursor=result.cursor||activityRuntime.cursor;activityApplyCounts(result);
  const indicator=root.querySelector('[data-activity-action="show-new"]');
  if(atBottom){area.scrollTop=area.scrollHeight;activityRuntime.showNew=0;if(indicator)indicator.hidden=true;void activityMarkVisibleRead(String(result.chatId));}
  else if(indicator&&activityRuntime.showNew){indicator.hidden=false;indicator.innerHTML=`Новые сообщения · ${activityRuntime.showNew} ${icon('down','icon-sm')}`;}
  const status=root.querySelector('[data-chat-connection]');if(status){status.textContent='Сообщения обновляются автоматически';status.classList.remove('is-offline');}
}
async function activityRefreshNotifications({renderPage=false,signal}={}){
  const generation=activityRuntime.generation,scope=activityScope();
  const result=await activityFetch('/api/notifications',{signal});
  if(generation!==activityRuntime.generation||scope!==activityScope())return;
  const prior=JSON.stringify(activityData());state.data.notifications=result;activityRuntime.lastNotifications=Date.now();activityUpdateBadges();
  if(state.view==='notifications'&&(renderPage||prior!==JSON.stringify(result))&&!state.modal){const target=root.querySelector('#main-content');if(target)target.innerHTML=`<p class="concept-notice">${icon('info','icon-sm')}<span>Конкурсный концепт. Не официальный сервис вуза. Все данные вымышлены.</span></p>${renderNotifications()}`;}
}
async function activityPoll(){
  if(activityRuntime.inFlight||!state.user||state.loading||document.hidden)return;
  const scope=activityScope(),generation=activityRuntime.generation;
  activityRuntime.inFlight=true;const controller=new AbortController();activityRuntime.controller=controller;
  try{
    if(Date.now()-activityRuntime.lastMe>30000){
      const result=await activityFetch('/api/me',{signal:controller.signal});activityRuntime.lastMe=Date.now();
      if(generation!==activityRuntime.generation||scope!==activityScope())return;
      if(activityScope(result.user)!==scope){
        activityStop();activityDrafts.clear();state.user=result.user;state.data={};state.modal=null;state.selectedChat=null;state.teacherId='';
        toast('Ваши учебные данные обновились. Загружаем доступные разделы.');await boot();return;
      }
      state.user={...state.user,...result.user};
    }
    const notificationRefresh=Date.now()-activityRuntime.lastNotifications>15000?activityRefreshNotifications({signal:controller.signal}):Promise.resolve();
    notificationRefresh.catch(()=>{});
    if(generation!==activityRuntime.generation||scope!==activityScope())return;
    if(state.view==='chats'&&state.selectedChat&&!state.modal){
      const chatId=String(state.selectedChat);
      if(activityRuntime.chatId!==chatId){activityRuntime.chatId=chatId;activityRuntime.cursor=null;activityRuntime.showNew=0;activityRuntime.lastRead='';}
      const result=await activityFetch('/api/chat-updates?chatId='+encodeURIComponent(chatId)+(activityRuntime.cursor?'&after='+encodeURIComponent(activityRuntime.cursor):''),{signal:controller.signal});
      if(generation===activityRuntime.generation&&scope===activityScope()&&state.view==='chats'&&String(state.selectedChat)===chatId)activityMergeChat(result);
    }
    await notificationRefresh;
  }catch(error){
    if(error.name==='AbortError'||generation!==activityRuntime.generation)return;
    if(error.status===401){activityStop();activityDrafts.clear();state.user=null;state.data={};state.modal=null;render();return;}
    const status=root.querySelector('[data-chat-connection]');if(status){status.textContent='Связь прервалась. Попробуем обновить снова.';status.classList.add('is-offline');}
  }finally{if(generation===activityRuntime.generation){activityRuntime.inFlight=false;if(activityRuntime.controller===controller)activityRuntime.controller=null;}}
}
function activityAfterRender(){
  const scope=activityScope();
  if(scope!==activityRuntime.userKey){activityStop();activityRuntime.userKey=scope;activityRuntime.chatId='';activityRuntime.cursor=null;activityRuntime.lastRead='';activityRuntime.lastNotifications=state.data.notifications?Date.now():0;activityRuntime.lastMe=Date.now();activityDrafts.clear();}
  if(!scope||document.hidden){activityStop();return;}
  const area=root.querySelector('[data-activity-chat]');
  if(area&&activityRuntime.restoreScroll?.chatId===area.dataset.activityChat)area.scrollTop=activityRuntime.restoreScroll.top;
  activityRuntime.restoreScroll=null;activityRuntime.forceBottom=false;
  activityUpdateBadges();
  if(!activityRuntime.timer)activityRuntime.timer=setInterval(()=>void activityPoll(),5000);
  if(state.view==='chats'&&String(state.selectedChat||'')!==activityRuntime.chatId){activityRuntime.chatId=String(state.selectedChat||'');activityRuntime.cursor=null;activityRuntime.lastRead='';activityRuntime.showNew=0;}
  queueMicrotask(()=>void activityPoll());
}
async function activityOpenNotification(item){
  const scope=activityScope(),generation=activityRuntime.generation;
  await api('/api/notifications/'+encodeURIComponent(item.id)+'/read','PATCH',{read:true});
  if(scope!==activityScope()||generation!==activityRuntime.generation)return;
  const current=arr(activityData().notifications).find(value=>value.id===item.id);if(current)current.read=true;
  state.data.notifications.unreadCount=arr(activityData().notifications).filter(value=>!value.read).length;
  const link=item.link||{},view=link.view||'home';state.modal=null;state.menu=false;state.view=view;
  if(view==='plan')state.campusPlanFilter=link.filter||'all';
  if(view==='events'){state.campusEventClub=link.clubId||'';state.campusEventDate='';state.campusEventFilter='mine';}
  if(view==='consultations'){state.campusConsultStaff='';state.campusConsultFilter='all';}
  if(view==='homework'){state.homeworkDate=link.date||campusToday();state.homeworkSubject=link.subject||'';state.homeworkGroup=state.user.role==='student'?'':link.groupId||'';await extLoadHomework();}
  else if(view==='schedule'){state.scheduleDate=link.date||campusToday();state.weekOffset=dateWeekOffset(state.scheduleDate);state.scheduleMode='day';state.teacherId='';await loadData(['schedule','homework']);}
  else{const keys=viewDataKeys(view);if(keys)await loadData(keys);}
  render();window.scrollTo({top:0,behavior:'smooth'});
}
async function activityClick(event){
  const chat=event.target.closest('[data-chat]');
  if(chat){state.selectedChat=chat.dataset.chat;activityRuntime.chatId='';render();return true;}
  const open=event.target.closest('[data-notification-open]');
  if(open){const item=arr(activityData().notifications).find(value=>value.id===open.dataset.notificationOpen);if(item)try{await activityOpenNotification(item);}catch(error){toast(error.message,true);}return true;}
  const read=event.target.closest('[data-notification-read]');
  if(read){const item=arr(activityData().notifications).find(value=>value.id===read.dataset.notificationRead);if(item)try{const scope=activityScope(),generation=activityRuntime.generation,next=!item.read;await api('/api/notifications/'+encodeURIComponent(item.id)+'/read','PATCH',{read:next});if(scope!==activityScope()||generation!==activityRuntime.generation)return true;const current=arr(activityData().notifications).find(value=>value.id===item.id);if(current)current.read=next;state.data.notifications.unreadCount=arr(activityData().notifications).filter(value=>!value.read).length;render();}catch(error){toast(error.message,true);}return true;}
  const filter=event.target.closest('[data-activity-filter]');if(filter){state.notificationFilter=filter.dataset.activityFilter;render();return true;}
  const action=event.target.closest('[data-activity-action]');
  if(action?.dataset.activityAction==='read-all'){try{const scope=activityScope(),generation=activityRuntime.generation,result=await api('/api/notifications/read-all','POST',{});if(scope!==activityScope()||generation!==activityRuntime.generation)return true;state.data.notifications=result;render();toast('Все уведомления отмечены прочитанными.');}catch(error){toast(error.message,true);}return true;}
  if(action?.dataset.activityAction==='show-new'){const area=root.querySelector('[data-activity-chat]');if(area){area.scrollTop=area.scrollHeight;action.hidden=true;activityRuntime.showNew=0;void activityMarkVisibleRead(area.dataset.activityChat);}return true;}
  return false;
}
async function activityChange(){return false;}
async function activitySubmit(form,values){
  if(form.id!=='chat-form')return false;
  const userId=state.user.id,chatId=String(state.selectedChat),body=String(values.body||'').trim();
  const result=await api('/api/chat-messages','POST',{chatId,body});
  if(state.user?.id!==userId)return true;
  activityDrafts.delete(activityDraftKey(chatId));const chat=arr(state.data.chats?.chats).find(item=>String(item.id)===chatId);
  if(chat&&result.message&&!arr(chat.messages).some(item=>item.id===result.message.id))chat.messages=[...arr(chat.messages),result.message];
  activityRuntime.chatId='';activityRuntime.cursor=null;activityRuntime.forceBottom=true;toast('Сообщение отправлено.');return true;
}
root.addEventListener('input',event=>{if(event.target.matches('[data-live-chat-body]'))activityDrafts.set(activityDraftKey(state.selectedChat),event.target.value);});
root.addEventListener('scroll',event=>{if(event.target.matches?.('[data-activity-chat]')&&activityChatAtBottom(event.target)){const indicator=root.querySelector('[data-activity-action="show-new"]');if(indicator)indicator.hidden=true;activityRuntime.showNew=0;void activityMarkVisibleRead(event.target.dataset.activityChat);}},true);
document.addEventListener('visibilitychange',()=>{if(document.hidden)activityStop();else activityAfterRender();});

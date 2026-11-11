function displayRoleTag(value){return ({student:'Студент',teacher:'Преподаватель',admin:'Администратор',member:'Участник',headman:'Староста',starosta:'Староста',coordinator:'Координатор',editor:'Редактор',curator:'Куратор',support:'Поддержка студентов'}[value]||value||'');}
function messagingContactRows(contacts,query=''){
 const search=query.trim().toLocaleLowerCase('ru');
 const visible=contacts.filter(p=>(p.name+' '+(p.group||'')+' '+roleName(p.role)+' '+displayRoleTag(p.tag)).toLocaleLowerCase('ru').includes(search));
 return visible.map(p=>`<button class="messaging-contact" data-direct-user="${esc(p.id)}"><span class="avatar">${esc(p.initials||initials(p.name))}</span><span><strong>${esc(p.name)}</strong><small>${esc(roleName(p.role))}${p.group?' · '+esc(p.group):''}${p.tag&&displayRoleTag(p.tag)!==roleName(p.role)?' · '+esc(displayRoleTag(p.tag)):''}</small></span>${icon('chat','icon-sm')}</button>`).join('')||'<p class="muted">Подходящих участников нет.</p>';
}
function renderMessagingModal(modal){
 if(modal.type!=='message-contacts')return '';
 return extModalShell('Кому написать?','Личная переписка доступна только вам и собеседнику.',`<label class="field"><span>Имя, группа или роль</span><input id="message-contact-search" type="search" placeholder="Найти участника" autocomplete="off"></label><div class="messaging-contacts" id="message-contact-results">${messagingContactRows(modal.contacts)}</div>`,'Сообщения');
}
async function messagingClick(event){
 const button=event.target.closest('[data-message-contacts],[data-direct-user]');if(!button)return false;
 event.preventDefault();
 if(button.hasAttribute('data-message-contacts')){const result=await api('/api/chat-contacts');state.modal={type:'message-contacts',contacts:arr(result.contacts)};render();return true;}
 if(button.disabled)return true;button.disabled=true;
 try{const result=await api('/api/direct-chats','POST',{userId:button.dataset.directUser});await loadData(['chats']);state.selectedChat=result.chatId;activityRuntime.chatId='';await navigateView('chats');}catch(error){button.disabled=false;throw error;}
 return true;
}
root.addEventListener('input',event=>{if(event.target.id!=='message-contact-search')return;const result=root.querySelector('#message-contact-results');if(result)result.innerHTML=messagingContactRows(arr(state.modal?.contacts),event.target.value);});

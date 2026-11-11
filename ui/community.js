// Clubs and group views. Injected inside the application closure.
function communityClubs() {
  const data = state.data.clubs;
  return arr(Array.isArray(data) ? data : data?.clubs);
}
function communityClubColor(club) {
  return /^#[0-9a-f]{6}$/i.test(String(club?.color || '')) ? club.color : '#635de9';
}
function communityClubIcon(club) {
  const name = String(club?.name || '').toLocaleLowerCase('ru');
  if (/спорт|бег|туризм/.test(name)) return 'award';
  if (/науч|исслед|дебат/.test(name)) return 'grades';
  if (/волонт|куратор|помощ/.test(name)) return 'users';
  return 'spark';
}
function communityFilteredClubs() {
  const term = String(state.clubSearch || '').trim().toLocaleLowerCase('ru');
  return communityClubs().filter(club => (state.clubFilter !== 'mine' || club.isMember) && (!term || [club.name,club.description,club.priority].join(' ').toLocaleLowerCase('ru').includes(term)));
}
function communityMembership(club) {
  const role = club.memberRole || club.role;
  return club.isMember ? `<span class="community-membership">${icon('check','icon-sm')} Вы участвуете${role ? ` · ${esc(role)}` : ''}</span>` : `<span class="community-open">${icon('users','icon-sm')} Знакомство с сообществом</span>`;
}
function communityClubCard(club) {
  return `<article class="card community-card" style="--community-color:${communityClubColor(club)}">
    <div class="community-card-top"><span class="community-symbol">${icon(communityClubIcon(club),'icon-lg')}</span>${club.priority ? `<span class="community-category">${esc(club.priority)}</span>` : ''}</div>
    <h3>${esc(club.name)}</h3><p class="community-card-description">${esc(club.description || 'Инициативы и проекты университетского сообщества.')}</p>
    <div class="community-card-numbers"><span>${icon('users','icon-sm')} ${quantity(Number(club.memberCount) || 0,['участник','участника','участников'])}</span><span>${icon('news','icon-sm')} ${quantity(Number(club.postCount) || 0,['публикация','публикации','публикаций'])}</span></div>
    ${communityMembership(club)}
    <div class="community-card-actions"><button class="btn btn-light" data-community-open="${esc(club.id)}" aria-label="Открыть клуб: ${esc(club.name)}">О клубе и новости ${icon('arrow','icon-sm')}</button>${club.isMember && club.chatId ? `<button class="icon-btn" data-community-chat="${esc(club.chatId)}" aria-label="Чат клуба: ${esc(club.name)}" title="Открыть чат клуба">${icon('chat')}</button>` : ''}</div>
  </article>`;
}
function communityCatalogResults() {
  const clubs = communityFilteredClubs();
  if (clubs.length) return `<div class="community-catalog-grid">${clubs.map(communityClubCard).join('')}</div>`;
  return `<div class="card community-catalog-empty">${emptyState(state.clubFilter === 'mine' ? 'Пока нет подходящих клубов' : 'Не нашли такое сообщество',state.clubFilter === 'mine' ? 'Посмотрите каталог университета: там можно познакомиться с клубами и их новостями.' : 'Попробуйте другое название или направление.','search')}<button class="btn btn-ghost" data-community-action="reset-filters">Показать все клубы</button></div>`;
}
function renderCommunityGroup() {
  const group = state.data.group?.group;
  const members = arr(group?.members);
  const clubs = communityClubs();
  const mine = clubs.filter(club => club.isMember);
  return `${pageHeader('Университетское сообщество','Группа и клубы','Учебная команда и сообщества, в которых хочется участвовать.')}
    ${group ? `<section class="card community-study-group"><div class="community-group-summary"><span class="community-group-symbol">${icon('users','icon-lg')}</span><div><span class="eyebrow">Моя учебная группа</span><h2>${esc(group.name)}</h2><p>${esc(group.direction || group.faculty || group.description || '')}</p></div><span class="tag">${quantity(members.length,['участник','участника','участников'])}</span></div><div class="community-group-members">${members.map(member=>`<div class="community-member"><span class="avatar">${esc(member.initials || initials(member.name))}</span><div>${personButton(member.id,member.name,'student')}<small>${esc(member.tag || 'Студент')}</small></div></div>`).join('')}</div></section>` : ''}
    <section class="community-catalog"><div class="section-title community-catalog-heading"><div><span class="eyebrow">Найти своих</span><h2>Клубы университета</h2><p>Откройте сообщество, почитайте стену и узнайте, чем живёт его команда.</p></div><div class="community-catalog-total"><strong>${clubs.length}</strong><span>${quantity(mine.length,['ваш клуб','ваших клуба','ваших клубов'])}</span></div></div>
    <div class="community-toolbar"><div class="tabs" aria-label="Фильтр клубов"><button class="tab ${state.clubFilter !== 'mine' ? 'active' : ''}" data-community-filter="all">Все клубы <span>${clubs.length}</span></button><button class="tab ${state.clubFilter === 'mine' ? 'active' : ''}" data-community-filter="mine">Мои клубы <span>${mine.length}</span></button></div><label class="community-search" for="community-search">${icon('search')}<input id="community-search" type="search" value="${esc(state.clubSearch || '')}" placeholder="Название или интерес" aria-label="Найти клуб" autocomplete="off"></label></div>
    <div id="community-results" aria-live="polite">${communityCatalogResults()}</div></section>`;
}
function communityPost(post) {
  const attachments = arr(post.attachments);
  return `<article class="card community-post"><div class="community-post-author"><span class="avatar">${esc(initials(post.author))}</span><div>${personButton(post.authorId,post.author || 'Команда клуба',post.authorRole)}<time datetime="${esc(post.createdAt || '')}">${esc(dateFmt(post.createdAt,{day:'numeric',month:'long',year:'numeric'}))}</time></div><span class="tag">Новость клуба</span></div><h3>${esc(post.title)}</h3><div class="community-post-body">${extParagraphs(post.body)}</div>${attachments.length && typeof renderAttachmentMedia === 'function' ? renderAttachmentMedia(attachments) : ''}${publicationManageActions(post,'club',state.clubId)}</article>`;
}
function renderClubPage() {
  const detail = state.data.clubDetail;
  const club = detail?.club;
  if (!club || String(club.id) !== String(state.clubId)) return `${pageHeader('Сообщества','Клуб не найден','Вернитесь к каталогу и выберите сообщество.')}<button class="btn btn-primary" data-view="group">${icon('arrowLeft')} Каталог клубов</button>`;
  const posts = arr(detail.posts);
  return `<div class="community-back"><button class="btn btn-ghost" data-view="group">${icon('arrowLeft','icon-sm')} Все клубы</button></div>
    <section class="card community-hero" style="--community-color:${communityClubColor(club)}"><div class="community-hero-mark">${icon(communityClubIcon(club))}</div><div class="community-hero-copy"><span class="eyebrow">${esc(club.priority || 'Сообщество университета')}</span><h1>${esc(club.name)}</h1><p>${esc(club.description || '')}</p>${communityMembership(club)}</div><div class="community-hero-actions">${club.isMember && club.chatId ? `<button class="btn btn-primary" data-community-chat="${esc(club.chatId)}">${icon('chat')} Чат клуба</button>` : ''}${club.canPublish ? `<button class="btn btn-ghost" data-community-action="new-post">${icon('plus')} Написать на стене</button>` : ''}</div></section>
    ${campusClubEventPanel()}<div class="community-detail-layout"><section class="community-wall"><div class="section-title"><h2>Стена сообщества</h2><span class="muted">${quantity(posts.length,['публикация','публикации','публикаций'])}</span></div>${posts.length ? posts.map(communityPost).join('') : `<div class="card community-wall-empty">${emptyState('Здесь начинается история клуба',club.canPublish ? 'Поделитесь первым событием, встречей или планом команды.' : 'Новости и объявления команды появятся на этой стене.','news')}${club.canPublish ? `<button class="btn btn-primary" data-community-action="new-post">${icon('plus')} Первая публикация</button>` : ''}</div>`}</section>
    <aside class="community-about"><section class="card community-about-card"><span class="eyebrow">Познакомимся</span><h2>О сообществе</h2><p>${extParagraphs(club.about || club.description || '')}</p><dl>${club.meetingPlace ? `<div><dt>${icon('users','icon-sm')} Место встреч</dt><dd>${esc(club.meetingPlace)}</dd></div>` : ''}${club.schedule ? `<div><dt>${icon('clock','icon-sm')} Когда собираемся</dt><dd>${esc(club.schedule)}</dd></div>` : ''}<div><dt>${icon('users','icon-sm')} Команда</dt><dd>${quantity(Number(club.memberCount) || 0,['участник','участника','участников'])}</dd></div></dl></section>${club.isMember ? `<section class="card community-role-card">${icon('check')}<div><strong>Вы в команде</strong><p>${esc(club.memberRole || club.role || 'Участник')}${club.canPublish ? ' · можете публиковать новости на стене' : ''}</p></div></section>` : `<div class="community-about-note">${icon('info')}<p>Стену могут читать все пользователи. Чат доступен участникам клуба.</p></div>`}</aside></div>`;
}
function renderCommunityModal(modal) {
  if (modal?.type !== 'club-post') return '';
  const club = state.data.clubDetail?.club;
  return extModalShell('Новая публикация клуба',`Новость появится на стене «${club?.name || 'Сообщества'}». Её увидят все пользователи.`,`<form id="community-post-form"><div class="field"><label for="community-post-title">Заголовок</label><input id="community-post-title" name="title" maxlength="140" required placeholder="Например, встречаемся в пятницу"></div><div class="field"><label for="community-post-body">Текст публикации</label><textarea id="community-post-body" name="body" maxlength="4000" required placeholder="Что произойдёт, где и как принять участие"></textarea></div>${typeof renderAttachmentComposer === 'function' ? renderAttachmentComposer() : ''}${extModalActions('Опубликовать')}</form>`,'Стена сообщества');
}
async function communityClick(event) {
  const open = event.target.closest('[data-community-open]');
  if (open) {
    const button = open;
    button.disabled = true;
    try {
      const id = button.dataset.communityOpen;
      await navigateView('club/'+encodeURIComponent(id));
    } catch (error) { toast(error.message || 'Не удалось открыть клуб.',true); }
    finally { button.disabled = false; }
    return true;
  }
  const chat = event.target.closest('[data-community-chat]');
  if (chat) {
    chat.disabled = true;
    try {
      const id = chat.dataset.communityChat;
      await loadData(['chats']);
      if (!arr(state.data.chats?.chats).some(item=>String(item.id)===String(id))) throw new Error('Чат доступен только участникам клуба.');
      state.selectedChat = id; state.view = 'chats'; state.modal = null; state.menu = false;
      render(); window.scrollTo({top:0,behavior:'smooth'});
    } catch (error) { toast(error.message || 'Не удалось открыть чат.',true); }
    finally { chat.disabled = false; }
    return true;
  }
  const filter = event.target.closest('[data-community-filter]');
  if (filter) { state.clubFilter = filter.dataset.communityFilter === 'mine' ? 'mine' : 'all'; render(); return true; }
  const action = event.target.closest('[data-community-action]');
  if (!action) return false;
  if (action.dataset.communityAction === 'reset-filters') { state.clubFilter='all';state.clubSearch='';render();return true; }
  if (action.dataset.communityAction === 'new-post') {
    if (!state.data.clubDetail?.club?.canPublish) { toast('Публикации доступны команде клуба.',true); return true; }
    state.modal={type:'club-post',attachments:[]};render();return true;
  }
  return false;
}
async function communityChange(event) {
  if (event.target.id !== 'community-search') return false;
  state.clubSearch=event.target.value;
  const results=root.querySelector('#community-results');
  if (results) results.innerHTML=communityCatalogResults();
  return true;
}
async function communitySubmit(form, values) {
  if (form.id !== 'community-post-form') return false;
  const club=state.data.clubDetail?.club;
  if (Number(state.modal?.uploading) > 0) throw new Error('Дождитесь завершения загрузки вложений.');
  if (!club?.canPublish || !state.clubId) throw new Error('Публикации доступны команде клуба.');
  const result=await api(`/api/clubs/${encodeURIComponent(state.clubId)}/posts`,'POST',{title:values.title,body:values.body,attachmentIds:arr(state.modal?.attachments).map(file=>file.id)});
  if(state.modal)state.modal.published=true;
  if (result.post) state.data.clubDetail.posts=[result.post,...arr(state.data.clubDetail.posts)];
  try {
    state.data.clubDetail=await api('/api/clubs/'+encodeURIComponent(state.clubId));
    state.data.clubs=await api('/api/clubs');
  } catch { /* The publication succeeded; keep its result instead of inviting a duplicate. */ }
  toast('Новость опубликована на стене клуба.');
  return true;
}
root.addEventListener('input', event => {
  if (event.target.id === 'community-search') void communityChange(event);
});

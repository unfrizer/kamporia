// Injected into the application closure. The compact topbar card remains separate.
function openAccount() {
  if (!state.user) return;
  state.menu = false;
  state.modal = { type: 'account-detail' };
  render();
}

function accountAcademicRows(user) {
  return [
    ['Факультет', user.faculty],
    ['Направление', user.direction],
    ['Курс', user.role==='student'&&user.course ? `${user.course} курс` : ''],
    ['Учебная группа', user.role==='student'?user.group:''],
    ['Статус в группе', user.role==='student'&&user.tag && displayRoleTag(user.tag) !== roleName(user.role) ? displayRoleTag(user.tag) : ''],
  ].filter(([, value]) => value !== undefined && value !== null && String(value).trim());
}

function accountDefinitionRows(rows) {
  return rows.map(([label, value]) => `<div><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`).join('');
}

function accountModalShell(title, description, content, editing = false) {
  return `<div class="modal-backdrop" data-action="backdrop"><section class="modal account-modal${editing ? ' account-modal-edit' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="modal-head"><div><span class="eyebrow">Личный кабинет</span><h2>${esc(title)}</h2><p>${esc(description)}</p></div><button class="icon-btn" data-action="modal-close" aria-label="Закрыть">${icon('close')}</button></div>${content}</section></div>`;
}

function renderAccountModal(modal) {
  if (!['account-detail', 'account-edit'].includes(modal?.type) || !state.user) return '';
  const user = state.user;
  const academics = accountAcademicRows(user);
  const student = user.role === 'student';
  if (modal.type === 'account-detail') {
    const contacts = [['Электронная почта', user.contactEmail], ['Телефон', user.phone]].filter(([, value]) => value);
    return accountModalShell('Мой профиль', 'Личная информация и данные вашего аккаунта.', `
      <div class="account-identity"><span class="account-avatar" aria-hidden="true">${esc(userInitials(user))}</span><div class="account-identity-copy"><span class="account-role">${esc(roleName(user.role))}${user.tag && user.tag !== roleName(user.role) ? ` <span aria-hidden="true">·</span> ${esc(displayRoleTag(user.tag))}` : ''}</span><h3>${esc(user.name)}</h3></div></div>
      <div class="account-grid"><section class="account-panel"><div class="account-section-title">${icon(student ? 'grades' : 'award', 'icon-sm')}<h3>${student ? 'Учёба' : 'Университет'}</h3></div>${academics.length ? `<dl class="account-details">${accountDefinitionRows(academics)}</dl>` : `<p class="account-empty">${student ? 'Учебные данные появятся после зачисления в группу.' : 'Профиль сотрудника университета.'}</p>`}<p class="account-panel-note">Учебные данные и роль задаёт администрация.</p></section>
      <section class="account-panel"><div class="account-section-title">${icon('users', 'icon-sm')}<h3>О себе и контакты</h3></div>${user.bio ? `<p class="account-bio">${esc(user.bio)}</p>` : `<p class="account-empty">${student ? 'Расскажите о своих интересах и учебных проектах.' : 'Добавьте несколько слов о своей работе и интересах.'}</p>`}${contacts.length ? `<dl class="account-details account-contacts">${accountDefinitionRows(contacts)}</dl>` : '<p class="account-contact-placeholder">Контакты пока не указаны.</p>'}<p class="account-panel-note">Эти контакты видны только вам.</p></section></div>
      <div class="modal-actions account-actions"><button class="btn btn-ghost" data-action="logout">${icon('logout', 'icon-sm')} Выйти из аккаунта</button><button class="btn btn-primary" data-account-action="edit">${icon('edit', 'icon-sm')} Редактировать профиль</button></div>`);
  }
  return accountModalShell('Редактировать профиль', 'Имя, описание и контакты можно изменить здесь.', `
    <form id="account-form"><div class="field"><label for="account-name">Имя и фамилия</label><input id="account-name" name="name" value="${esc(user.name)}" maxlength="120" autocomplete="name" required><small class="account-field-hint">Имя отображается в сообщениях и публикациях.</small></div><div class="field"><label for="account-bio">О себе</label><textarea id="account-bio" name="bio" maxlength="600" rows="3" placeholder="Интересы, проекты или несколько слов о себе">${esc(user.bio || '')}</textarea></div><div class="account-form-grid"><div class="field"><label for="account-email">Электронная почта</label><input id="account-email" name="contactEmail" type="email" value="${esc(user.contactEmail || '')}" maxlength="160" autocomplete="email" placeholder="name@example.ru"></div><div class="field"><label for="account-phone">Телефон</label><input id="account-phone" name="phone" type="tel" value="${esc(user.phone || '')}" maxlength="40" autocomplete="tel" placeholder="+7 …"></div></div><div class="account-edit-note">${icon('info', 'icon-sm')}<p>Контакты видны только вам. Учебную группу, направление и роль изменяет администрация.</p></div><div class="account-form-error" role="alert" hidden></div><div class="modal-actions account-actions"><button class="btn btn-ghost" type="button" data-account-action="detail">Отмена</button><button class="btn btn-primary" type="submit">Сохранить изменения ${icon('check', 'icon-sm')}</button></div></form>`, true);
}

function accountClick(event) {
  const target = event.target.closest('[data-account-action],[data-view="account"]');
  if (!target || !state.user) return false;
  event.preventDefault();
  if (state.busy) return true;
  const action = target.dataset.accountAction || 'open';
  if (action === 'open' || action === 'detail') openAccount();
  else if (action === 'edit') { state.modal = { type: 'account-edit' }; render(); }
  return true;
}

function accountUpdateCachedIdentity(user) {
  // Refresh already visible bylines while keeping data and permissions intact.
  const visit = value => {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) { value.forEach(visit); return; }
    if (String(value.authorId || '') === String(user.id)) {
      value.author = user.name;
      if ('initials' in value) value.initials = user.initials;
    }
    if (String(value.id || '') === String(user.id) && 'name' in value) {
      value.name = user.name;
      if ('initials' in value) value.initials = user.initials;
    }
    if (String(value.profileId || '') === String(user.id) && 'name' in value) value.name = user.name;
    if (String(value.teacherId || '') === String(user.id) && 'teacher' in value) value.teacher = user.name;
    Object.values(value).forEach(visit);
  };
  visit(state.data);
  if (state.data.dashboard?.user) state.data.dashboard.user = { ...user };
}

async function accountSubmit(form) {
  if (form?.id !== 'account-form') return false;
  if (state.busy || !state.user) return true;
  const values = Object.fromEntries(new FormData(form));
  const editingModal = state.modal;
  const userId = state.user.id;
  const submit = form.querySelector('[type="submit"]');
  const errorBox = form.querySelector('.account-form-error');
  state.busy = true;
  if (submit) { submit.disabled = true; submit.textContent = 'Сохраняем…'; }
  if (errorBox) { errorBox.hidden = true; errorBox.textContent = ''; }
  try {
    const result = await api('/api/me', 'PATCH', {
      name: String(values.name || '').trim(),
      bio: String(values.bio || '').trim(),
      contactEmail: String(values.contactEmail || '').trim(),
      phone: String(values.phone || '').trim(),
    });
    if (!result.user) throw new Error('Не удалось получить обновлённый профиль.');
    // A completed request must not reopen a dismissed window or undo logout.
    if (state.user?.id !== userId) return true;
    state.user = result.user;
    accountUpdateCachedIdentity(result.user);
    state.busy = false;
    if (state.modal === editingModal) state.modal = { type: 'account-detail' };
    render();
    toast('Профиль обновлён.');
  } catch (error) {
    if (errorBox?.isConnected) {
      errorBox.hidden = false;
      errorBox.textContent = error.message || 'Не удалось сохранить профиль. Попробуйте ещё раз.';
    } else toast(error.message || 'Не удалось сохранить профиль.', true);
  } finally {
    state.busy = false;
    if (submit?.isConnected) {
      submit.disabled = false;
      submit.innerHTML = `Сохранить изменения ${icon('check', 'icon-sm')}`;
    }
  }
  return true;
}

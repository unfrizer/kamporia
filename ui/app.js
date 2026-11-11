(() => {
  'use strict';

  const root = document.getElementById('app');
  const toastRoot = document.getElementById('toast-root');
  const palette = ['#635de9', '#437bd9', '#0e9e94', '#2b946a', '#dc7260', '#cd6598', '#b28132', '#59647b'];
  const iconPaths = {
    home: '<path d="m3 10 9-7 9 7v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 21v-7h6v7"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',
    grades: '<path d="M4 19.5V5a2 2 0 0 1 2-2h14v18H6a2 2 0 0 1 0-4h14"/><path d="M8 8h8M8 12h5"/>',
    news: '<path d="M4 4h14a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4Z"/><path d="M8 9h8M8 13h8M8 17h5"/><path d="M4 7H2v12a2 2 0 0 0 2 2"/>',
    file: '<path d="M6 3h8l5 5v13H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"/><path d="M14 3v6h5M8 13h7M8 17h7"/>',
    chat: '<path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5 9 9 0 0 1-4-.9L3 21l1.9-5.5a9 9 0 0 1-.9-4A8.5 8.5 0 0 1 12.5 3 8.5 8.5 0 0 1 21 11.5Z"/><path d="M8 11h9M8 14h6"/>',
    folder: '<path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M16 3a4 4 0 0 1 0 8M22 21v-2a4 4 0 0 0-3-3.87"/><circle cx="9" cy="7" r="4"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .32 1.77l.06.06-1.95 1.95-.06-.06A1.6 1.6 0 0 0 16 18.4a1.6 1.6 0 0 0-1 .6 1.6 1.6 0 0 0-.4 1.06V21h-2.8v-.94A1.6 1.6 0 0 0 10.6 18.4a1.6 1.6 0 0 0-1.77.32l-.06.06-1.95-1.95.06-.06A1.6 1.6 0 0 0 7.2 15a1.6 1.6 0 0 0-1.26-.6H5v-2.8h.94A1.6 1.6 0 0 0 7.2 10.4a1.6 1.6 0 0 0-.32-1.77l-.06-.06 1.95-1.95.06.06A1.6 1.6 0 0 0 10.6 7.2a1.6 1.6 0 0 0 1.2-1.54V5h2.8v.66A1.6 1.6 0 0 0 16 7.2a1.6 1.6 0 0 0 1.77-.32l.06-.06 1.95 1.95-.06.06A1.6 1.6 0 0 0 19.4 10.4a1.6 1.6 0 0 0 1.26.6H21v2.8h-.34A1.6 1.6 0 0 0 19.4 15Z"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
    bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4"/>',
    arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
    arrowLeft: '<path d="M19 12H5m6-6-6 6 6 6"/>',
    chevron: '<path d="m9 18 6-6-6-6"/>',
    down: '<path d="m6 9 6 6 6-6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    close: '<path d="M18 6 6 18M6 6l12 12"/>',
    check: '<path d="m4 12 5 5L20 6"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    pin: '<path d="m16 3 5 5-3 1-3 4-1 3-3-3-4 4-1-1 4-4-3-3 3-1 4-3z"/>',
    edit: '<path d="M12 20h9M16 4l4 4-12 12H4v-4L16 4Z"/>',
    send: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
    alert: '<path d="m12 3 10 18H2L12 3Z"/><path d="M12 9v5M12 17h.01"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/>',
    moon: '<path d="M20 15.3A8 8 0 0 1 8.7 4 8.5 8.5 0 1 0 20 15.3Z"/>',
    palette: '<circle cx="12" cy="12" r="9"/><path d="M7 13h.01M9 8h.01M15 8h.01M18 12h.01M15 17a2 2 0 1 0 2 2"/>',
    spark: '<path d="m12 2 1.6 7.4L21 11l-7.4 1.6L12 20l-1.6-7.4L3 11l7.4-1.6L12 2ZM19 18l.5 2.5L22 21l-2.5.5L19 24l-.5-2.5L16 21l2.5-.5L19 18Z"/>',
    chart: '<path d="M3 21V3M3 21h18M7 17l4-5 3 2 6-8"/>',
    award: '<circle cx="12" cy="8" r="5"/><path d="m8.5 12-2 9 5.5-3 5.5 3-2-9"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    external: '<path d="M14 4h6v6M20 4l-9 9M20 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h5"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m16 16 5 5"/>',
  };
  const icon = (name, cls = '') => `<svg class="icon ${cls}" viewBox="0 0 24 24" aria-hidden="true">${iconPaths[name] || iconPaths.info}</svg>`;
  const logo = () => `<span class="brand"><span class="brand-mark"><svg viewBox="0 0 44 44" fill="none" aria-hidden="true"><path d="M10 9h7v12L29 9h9L23 23l15 12H28L17 25v10h-7V9Z" fill="currentColor"/></svg></span><span class="brand-name">кампо<span>рия</span></span></span>`;
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const arr = value => Array.isArray(value) ? value : [];
  const pick = (value, ...keys) => keys.map(key => value?.[key]).find(item => item !== undefined && item !== null);
  const dateFmt = (value, options = { day: 'numeric', month: 'long' }) => {
    if (!value) return '—';
    const d = new Date(String(value).length === 10 ? `${value}T12:00:00+03:00` : value);
    return Number.isNaN(d.getTime()) ? String(value) : new Intl.DateTimeFormat('ru-RU', {...options,timeZone:'Europe/Moscow'}).format(d);
  };
  const quantity=(count,forms)=>`${count} ${forms[({one:0,few:1,many:2,other:2}[new Intl.PluralRules('ru').select(count)])]}`;
  const shortDate = value => dateFmt(value, { day: 'numeric', month: 'short' });
  const roleName = role => ({ student: 'Студент', teacher: 'Преподаватель', admin: 'Администрация', curator:'Куратор', support:'Поддержка студентов' }[role] || 'Участник');
  const firstName = name => String(name || '').trim().split(/\s+/)[0] || 'друг';
  const initials = name => String(name || '').split(/\s+/).slice(0, 2).map(s => s[0] || '').join('').toUpperCase() || 'А';
  const userInitials = user => user?.initials || initials(user?.name);
  const isStaff = () => state.user?.role === 'teacher' || state.user?.role === 'admin';
  const isStudent = () => state.user?.role === 'student';
  const normalized = {
    dashboard: value => value || {},
    schedule: value => ({ lessons: arr(pick(value, 'lessons', 'schedule')), teachers: arr(value?.teachers), group: value?.group, weekStart: value?.weekStart,cycleConfig:value?.cycleConfig,cycleWeek:value?.cycleWeek }),
    grades: value => ({ subjects: arr(pick(value, 'subjects', 'grades')), exams: arr(value?.exams), average: value?.average, attendance: value?.attendance, attended: value?.attended, totalClasses: value?.totalClasses }),
    requests: value => arr(pick(value, 'requests', 'items') || value),
    news: value => arr(pick(value, 'news', 'items') || value),
    chats: value => ({ chats: arr(pick(value, 'chats', 'items') || value), folders: arr(value?.folders) }),
    resources: value => { state.data.resourceMeta={canPublish:Boolean(value?.canPublish),options:arr(value?.options),groups:arr(value?.groups)};return arr(pick(value, 'subjects', 'resources') || value); },
    clubs: value => value || {clubs:[]},
    group: value => ({ group: value?.group || null, clubs: arr(value?.clubs) }),
    staff: value => value || {},
    homework: value => value || {assignments:[],groups:[],subjects:[],canCreate:false},
    services: value => value || {contacts:[],leadership:[],services:[]},
    notifications:value=>value||{notifications:[],unreadCount:0},management:value=>value||{users:[],groups:[],clubs:[]},archive:value=>value||{items:[]},
  };

  function campusToday() {
    const parts = new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Moscow',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
    const get = name => parts.find(part => part.type === name).value;
    return `${get('year')}-${get('month')}-${get('day')}`;
  }
  function dateAdd(iso, days) { const date=new Date(iso+'T12:00:00Z'); date.setUTCDate(date.getUTCDate()+days); return date.toISOString().slice(0,10); }
  function mondayOf(iso) { const day=new Date(iso+'T12:00:00Z').getUTCDay(); return dateAdd(iso,-((day+6)%7)); }
  function dateWeekOffset(iso) { return Math.round((Date.parse(mondayOf(iso))-Date.parse(mondayOf(campusToday())))/604800000); }
  function homeworkRange() { const base=state.view==='homework'?state.homeworkDate:state.scheduleDate; const from=mondayOf(base||campusToday()); return `from=${from}&to=${dateAdd(from,6)}`; }
  async function selectScheduleDate(iso) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)||Number.isNaN(Date.parse(iso))) return;
    const offset=dateWeekOffset(iso);
    if(Math.abs(offset)>52) { toast('Доступно расписание в пределах года.',true); return; }
    state.scheduleDate=iso; state.weekOffset=offset;
    await navigateView('schedule',{scroll:false});
  }
  function personButton(id,name,role='') { return `<button type="button" class="person-link" data-person-id="${esc(id||'')}" data-person-name="${esc(name||'Участник')}" data-person-role="${esc(role)}">${esc(name||'Участник')}</button>`; }
  async function openPerson(id,name='',role='') {
    state.menu=false;
    if(String(id)===String(state.user.id)) { state.modal={type:'person',profile:{id:state.user.id,name:state.user.name,initials:state.user.initials,role:state.user.role,tag:state.user.tag,faculty:state.user.faculty,group:state.user.group}}; render(); return; }
    const requestId=Date.now()+Math.random();
    state.modal={type:'person',profile:{id,name,role},loading:true,requestId}; render();
    try { const result=await api('/api/people/'+encodeURIComponent(id)); if(state.modal?.requestId!==requestId)return; state.modal={type:'person',profile:result.profile,scheduleTeacherId:result.scheduleTeacherId}; }
    catch(error) { if(state.modal?.requestId!==requestId)return; state.modal={type:'person',profile:{id,name,role,description:'Краткая карточка участника университетского сообщества.'}}; }
    render();
  }
  function lessonHomework(lesson,date) {
    if(!date)return '';
    const count=arr(state.data.homework?.assignments).filter(item=>item.date===date&&item.subject===lesson.subject&&(!lesson.groupId||item.groupId===cycleLessonGroup(lesson))).length;
    return `<button type="button" class="lesson-homework" data-ext-action="homework-lesson" data-group-id="${esc(cycleLessonGroup(lesson)||'')}" data-subject="${esc(lesson.subject)}" data-date="${esc(date)}">${icon('grades','icon-sm')} ${count?`Домашнее задание · ${count}`:'Домашнее задание'}</button>`;
  }

  const savedTheme = localStorage.getItem('atlas-theme');
  const savedAccent = localStorage.getItem('atlas-accent');
  const state = {
    user: null, view: 'home', modal: null, loading: true, busy: false, loginError: '', bootError: '', menu: false,
    theme: savedTheme === 'dark' ? 'dark' : 'light',
    accent: /^#[0-9a-f]{6}$/i.test(savedAccent || '') ? savedAccent : palette[0],
    data: {}, scheduleMode: 'week', weekOffset: 0, scheduleDate:campusToday(), teacherId: '', selectedChat: null,
    homeworkDate:campusToday(),homeworkSubject:'',plannerGroup:'',plannerDay:1,guideSection:'start',resourceSubject:'',
  };

  function applyAppearance() {
    document.documentElement.dataset.theme = state.theme;
    document.documentElement.style.setProperty('--accent', state.accent);
    const red = parseInt(state.accent.slice(1,3),16), green = parseInt(state.accent.slice(3,5),16), blue = parseInt(state.accent.slice(5,7),16);
    const luminance = (r,g,b) => [r,g,b].map(v => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }).reduce((sum,v,index) => sum + v * [.2126,.7152,.0722][index],0);
    const lum = luminance(red,green,blue);
    const whiteContrast = 1.05 / (lum + .05);
    document.documentElement.style.setProperty('--on-accent', whiteContrast >= 4.5 ? '#ffffff' : '#000000');
    const deep = whiteContrast >= 4.5 ? state.accent : `#${[red,green,blue].map((v,index) => Math.round(v*.33 + [20,20,46][index]*.67).toString(16).padStart(2,'0')).join('')}`;
    document.documentElement.style.setProperty('--accent-surface', deep);
    const strong = state.theme === 'dark'
      ? [red,green,blue].map(v => Math.round(v*.42+255*.58))
      : [red,green,blue].map(v => Math.round(v*.38+19*.62));
    document.documentElement.style.setProperty('--accent-strong', `#${strong.map(v => v.toString(16).padStart(2,'0')).join('')}`);
    document.querySelector('meta[name="theme-color"]').content = state.theme === 'dark' ? '#111421' : '#f5f6fa';
  }
  applyAppearance();

  async function api(path, method = 'GET', body, options = {}) { return perfRequest(path,method,body,options); }
  async function loadData(keys, {cache=false}={}) {
    const context=perfContextVersion,scope=perfScope();
    return Promise.allSettled([...new Set(keys)].map(async key=>{
      const url=perfDataUrls()[key];if(!url)return false;
      const sequence=(perfLoadSequence.get(key)||0)+1;perfLoadSequence.set(key,sequence);
      try {
        const data=await api(url,'GET',undefined,{cacheMs:cache?15000:0});
        if(context!==perfContextVersion||scope!==perfScope()||perfLoadSequence.get(key)!==sequence||perfDataUrls()[key]!==url)return false;
        state.data[key]=(normalized[key]||((value)=>value))(data);perfDataSlots.set(key,url);delete state.dataErrors?.[key];return true;
      } catch(error) {
        if(context!==perfContextVersion||scope!==perfScope()||perfLoadSequence.get(key)!==sequence)return false;
        if(error.status===401){perfResetContext();state.user=null;state.data={};throw error;}
        state.dataErrors||={};state.dataErrors[key]=error.message;
        return false;
      }
    }));
  }
  function currentRoute() { if(state.view==='subject')return 'subject/'+encodeURIComponent(state.campusGroup||'')+'/'+encodeURIComponent(state.campusSubject||''); return state.view==='club' ? 'club/'+encodeURIComponent(state.clubId||'') : state.view; }
  async function loadClubRoute(){try{state.data.clubDetail=await api('/api/clubs/'+encodeURIComponent(state.clubId));}catch(error){state.view='group';state.clubId='';toast(error.message,true);}}
  function routeView(value) {
    if(value.startsWith('subject/')){try{const parts=value.split('/');state.campusGroup=decodeURIComponent(parts[1]||'');state.campusSubject=decodeURIComponent(parts[2]||'');if(state.campusSubject.length<=120&&state.campusSubject)return 'subject';}catch{}return 'home';}
    if(value.startsWith('club/')){try{const id=decodeURIComponent(value.slice(5));if(id.length&&id.length<=80){state.clubId=id;return 'club';}}catch{}return 'group';}
    const allowed = ['home','plan','events','consultations','campus','subject','schedule','requests','news','chats','resources','group','homework','services','settings','notifications','archive'];
    if (isStudent()) allowed.push('grades');
    if (isStaff()) allowed.push('staff');
    if (state.user?.role === 'admin') allowed.push('planner','guide','people');
    return allowed.includes(value) ? value : 'home';
  }
  function viewDataKeys(view) {
    const keys={home:['dashboard','homework','campusOverview'],plan:['campusPlan'],events:['campusEvents'],consultations:['campusConsultations'],campus:['campusMap'],subject:['campusHub'],schedule:['schedule','homework'],grades:['grades'],requests:['requests'],news:['news'],chats:['chats'],resources:['resources'],group:['group','clubs'],club:['clubDetail','campusEvents'],homework:['homework'],services:['services'],notifications:['notifications'],people:['management'],archive:['archive'],staff:['staff','requests','schedule','news'],planner:['staff','plannerSchedule','schedule']}[view]||[];
    return isStaff()&&['home','news'].includes(view)?[...keys,'staff','news']:keys;
  }
  async function restoreRoute() {
    if (!state.user || state.loading) return;
    const target=location.hash.slice(1)||'home';
    if(target===currentRoute()&&!state.modal)return;
    await navigateView(target,{scroll:false});
  }
  window.addEventListener('hashchange', () => restoreRoute().catch(error => toast(error.message,true)));
  window.addEventListener('popstate', () => restoreRoute().catch(error => toast(error.message,true)));
  async function boot() {
    perfResetContext();state.data={};state.dataErrors={};state.loading=true;state.routeLoading=null;state.routeError='';render();
    try {
      const session=await api('/api/me');state.user=session.user||session;
      state.view=routeView(location.hash.slice(1));
      await loadData([...viewDataKeys(state.view),'clubs']);
      if(state.user){const failures=viewDataKeys(state.view).filter(key=>state.dataErrors[key]);if(failures.length)state.routeError=state.dataErrors[failures[0]];}
    } catch(error) {state.user=null;if(error.status!==401)state.bootError=error.message||'Не удалось подключиться к серверу.';}
    finally {state.loading=false;render();}
  }
  function toast(message, error = false) {
    const node = document.createElement('div');
    node.className = `toast${error ? ' error' : ''}`;
    node.textContent = message;
    toastRoot.appendChild(node);
    setTimeout(() => node.remove(), 4000);
  }

  function render() {
    syncPublicationDraft();
    if (state.loading) { root.innerHTML = `<div class="loading"><div class="loading-inner">${logo()}<span>Собираем ваш учебный день…</span></div></div>`; return; }
    if (state.user && location.hash !== '#'+currentRoute()) history.pushState(null,'','#'+currentRoute());
    root.innerHTML = state.user ? renderShell() : renderLogin();
    if (state.user && state.modal) { root.insertAdjacentHTML('beforeend', renderModal()); requestAnimationFrame(()=>root.querySelector('.modal button, .modal input')?.focus()); }
    document.body.classList.toggle('modal-open',Boolean(state.user&&state.modal));
    if (state.view === 'chats') {
      const area = root.querySelector('.chat-messages');
      if (area) area.scrollTop = area.scrollHeight;
    }
    activityAfterRender();
  }

  function renderLogin() {
    return `<main class="login screen-enter">
      <section class="login-art">
        ${logo()}
        <div class="orbit" aria-hidden="true"><div class="orbit-ring"></div><div class="orbit-ring"></div><div class="orbit-ring"></div><div class="orbit-core"><svg viewBox="0 0 44 44" fill="none"><path d="M10 9h7v12L29 9h9L23 23l15 12H28L17 25v10h-7V9Z" fill="currentColor"/></svg></div><div class="orbit-chip orbit-chip-one">${icon('calendar')} Всё по расписанию</div><div class="orbit-chip orbit-chip-two">${icon('chat')} Свои люди рядом</div><div class="orbit-chip orbit-chip-three">${icon('spark')} Одна точка входа</div></div>
        <div class="login-copy"><span class="eyebrow">Цифровой деканат нового поколения</span><h1>Твой вуз.<br><em>Твой ритм.</em><br>Твоя Кампория.</h1><p>Расписание, оценки, новости и общение — в одном понятном пространстве для всей университетской команды.</p></div>
        <div class="login-proof"><div class="avatar-stack"><span>С</span><span>П</span><span>А</span></div><span>Студенты, преподаватели и администрация — вместе.</span></div>
      </section>
      <section class="login-panel"><div class="login-card"><span class="eyebrow">Рады вас видеть</span><h2>Войти в Кампорию</h2><p>Выберите демонстрационную роль или введите свой логин. Пароли приведены в инструкции к проекту.</p>
        <form id="login-form"><div class="field"><label for="login">Логин</label><input id="login" name="login" autocomplete="username" placeholder="Ваш логин" required></div><div class="field"><label for="password">Пароль</label><input id="password" name="password" type="password" autocomplete="current-password" placeholder="Введите пароль" required></div><div class="login-error" role="alert">${esc(state.loginError || state.bootError)}</div><button class="btn btn-primary" type="submit" ${state.busy ? 'disabled' : ''}>${state.busy ? 'Входим…' : 'Войти в кабинет'} ${icon('arrow')}</button></form>
        <div class="demo-box"><div class="demo-box-title">${icon('spark','icon-sm')} Посмотреть демоверсию</div><div class="demo-users"><button class="demo-user" data-demo="student"><strong>Студент</strong><span>Учёба и группа</span></button><button class="demo-user" data-demo="teacher"><strong>Преподаватель</strong><span>Пары и журнал</span></button><button class="demo-user" data-demo="admin"><strong>Администрация</strong><span>Сервисы вуза</span></button></div></div>
        <div class="login-foot">Конкурсный концепт. Не официальный сервис вуза. Все данные вымышлены.</div>
      </div></section>
    </main>`;
  }

  const baseNav = [
    ['home', 'Главная', 'home'], ['schedule', 'Расписание', 'calendar'], ['plan','Личный план','check'], ['grades', 'Успеваемость', 'grades'],
    ['requests', 'Заявки', 'file'], ['news', 'Новости', 'news'], ['chats', 'Сообщения', 'chat'],
    ['homework','Домашние задания','grades'],['resources', 'Справочные материалы', 'folder'], ['group', 'Группа и клубы', 'users'], ['services','Деканат и поддержка','users'],['events','Мероприятия','spark'],['consultations','Консультации','clock'],['campus','Кампус','pin'],['staff', 'Рабочее место', 'chart'],['planner','Конструктор расписания','calendar'],['guide','Инструкция','info'],['people','Люди и роли','users'],['archive','Архив','folder'],['settings','Оформление','palette'],
  ];
  const navItems = () => baseNav.filter(([id]) => (id !== 'grades' || isStudent()) && (id !== 'staff' || isStaff()) && (!['planner','guide','people'].includes(id)||state.user?.role==='admin') && (id!=='archive'||isStaff()||communityClubs().some(club=>club.canPublish)));
  const viewTitle = () => ({home:'Главная',plan:'Личный план',events:'Мероприятия',consultations:'Консультации',campus:'Кампус',subject:'Мой предмет',schedule:'Расписание',grades:'Успеваемость',requests:'Заявки',news:'Новости',chats:'Сообщения',resources:'Материалы',group:'Группа и клубы',staff:'Рабочее место',profile:'Профиль',settings:'Оформление',homework:'Домашние задания',services:'Деканат и поддержка',planner:'Конструктор расписания',guide:'Инструкция',club:'Сообщество',notifications:'Уведомления',people:'Люди и роли',archive:'Архив'}[state.view] || 'Главная');

  function renderShell() {
    const nav = navItems();
    return `<div class="shell">
      ${state.menu ? '<div class="sidebar-scrim" data-action="menu-close"></div>' : ''}
      <aside class="sidebar ${state.menu ? 'open' : ''}"><a class="brand-link" href="#home" data-view="home">${logo()}</a><button class="icon-btn sidebar-mobile-close" data-action="menu-close" aria-label="Закрыть меню">${icon('close')}</button><div class="side-caption"><span class="desktop-caption">Пространство</span><span class="mobile-caption">Другие разделы</span></div><nav class="side-nav" aria-label="Основная навигация">${nav.map(([id,label,ic]) => `<button class="nav-link ${['home','schedule','grades','staff','chats'].includes(id)?'mobile-duplicate':''} ${state.view === id ? 'active' : ''}" data-view="${id}" ${state.view === id ? 'aria-current="page"' : ''}>${icon(ic)}<span>${label}</span>${id === 'requests' && isStudent() && Number(state.data.dashboard?.pendingRequests) > 0 ? `<span class="nav-badge">${state.data.dashboard.pendingRequests}</span>` : ''}</button>`).join('')}</nav><div class="sidebar-bottom"><div class="sidebar-note"><strong>Всё важное — рядом</strong><p>Ваш день, группа и университет всегда под рукой.</p></div><button class="sidebar-profile" data-account-action="open" aria-label="Мой профиль"><span class="avatar">${esc(userInitials(state.user))}</span><span class="profile-copy"><strong>${esc(state.user.name)}</strong><span>${esc(roleName(state.user.role))}${state.user.group ? ` · ${esc(state.user.group)}` : ''}</span></span>${icon('chevron','icon-sm')}</button></div></aside>
      <div class="main-area"><header class="topbar"><div class="topbar-left"><button class="icon-btn menu-toggle" data-action="menu-toggle" aria-label="Открыть меню">${icon('menu')}</button><div class="topbar-breadcrumb">Кампория <span aria-hidden="true">/</span> <strong>${esc(viewTitle())}</strong></div></div><div class="topbar-actions"><div class="topbar-date">${icon('calendar','icon-sm')} ${esc(dateFmt(new Date(), {weekday:'short',day:'numeric',month:'long'}))}</div><button class="icon-btn" data-view="notifications" aria-label="Уведомления">${icon('bell')}<span data-notification-count class="activity-badge" hidden>0</span></button><button class="topbar-avatar" data-view="profile" aria-label="Краткий профиль"><span class="avatar">${esc(userInitials(state.user))}</span></button></div></header>
      <main class="content screen-enter" id="main-content"><p class="concept-notice">${icon('info','icon-sm')}<span>Конкурсный концепт. Не официальный сервис вуза. Все данные вымышлены.</span></p>${renderPage()}</main></div>
      <nav class="mobile-nav" aria-label="Быстрая навигация">${[['home','Главная','home'],['schedule','Расписание','calendar'],[isStudent()?'grades':'staff',isStudent()?'Оценки':'Работа',isStudent()?'grades':'chart'],['chats','Чаты','chat'],['account','Профиль','users']].map(([id,label,ic]) => `<button data-view="${id}" class="${state.view === id ? 'active' : ''}">${icon(ic)}<span>${label}</span></button>`).join('')}</nav>
    </div>`;
  }
  function pageHeader(eyebrow, title, subtitle, actions = '') {
    return `<div class="page-header"><div><span class="eyebrow">${eyebrow}</span><h1>${title}</h1><p>${subtitle}</p></div>${actions ? `<div class="page-header-actions">${actions}</div>` : ''}</div>`;
  }
  function renderPage() {
    const pending=perfRenderPending();if(pending)return pending;
    if(['plan','events','consultations','campus','subject'].includes(state.view))return renderCampusPage();
    return ({home: renderHome, schedule: renderSchedule, grades: renderGrades, requests: renderRequests, news: renderNewsFeed, chats: renderLiveChats,notifications:renderNotifications,people:renderManagement,archive:renderArchive, resources: renderMaterials, group: renderCommunityGroup,club:renderClubPage, staff: renderStaff, settings:renderProfile,homework:renderHomework,services:renderServices,planner:renderPlanner,guide:renderGuide}[state.view] || renderHome)();
  }

  function emptyState(title, detail, ic = 'info') {
    return `<div class="empty-state">${icon(ic)}<strong>${esc(title)}</strong><p>${esc(detail)}</p></div>`;
  }
  function lessonTitle(lesson) { const title=pick(lesson,'subject','title','name')||'Занятие';return campusSubjectButton(title,cycleLessonGroup(lesson)||state.user?.groupId); }

  function lessonSubtitle(lesson) {
    return [esc(lesson?.type||''),personButton(lesson.teacherId||'name:'+lesson.teacher,lesson.teacher,'teacher'),esc(lesson?.group||'')].filter(Boolean).join(' · ');
  }

  function lessonRow(lesson, index = 0, editable = false) {
    const start = pick(lesson, 'startTime', 'time', 'start') || '—';
    const end = pick(lesson, 'endTime', 'end') || '';
    const colors = ['', 'green', 'orange', 'pink'];
    return `<div class="lesson ${calendarUnavailable(lesson)?'calendar-cancelled':''}"><div class="lesson-time"><strong>${esc(start)}</strong><span>${esc(end)}</span></div><div class="lesson-line ${colors[index % 4]}"></div><div class="lesson-info"><strong>${lessonTitle(lesson)}</strong><span>${lessonSubtitle(lesson)}</span>${calendarUnavailable(lesson)?'':lessonHomework(lesson,lesson.originalDate||lesson.date||state.data.dashboard?.displayDate)}${calendarLessonActions(lesson)}${lesson.changed ? `<div class="schedule-change">${icon('alert')} ${esc(lesson.changeNote || 'Есть изменение в расписании')}</div>` : ''}</div><button class="lesson-room campus-room-link" data-campus-place="${esc(lesson.room||'')}" aria-label="Найти аудиторию ${esc(lesson.room||'')}">${esc(lesson.room||'—')}</button></div>`;
  }
  function newsTag(item) {
    return item?.scope === 'all' ? `<span class="tag global">${icon('users','icon-sm')} Для всего вуза</span>` : `<span class="tag">${icon('users','icon-sm')} ${esc(item?.group || 'Для группы')}</span>`;
  }
  function requestLabel(status) {
    return ({submitted:'Отправлена',in_review:'На рассмотрении',ready:'Готово',rejected:'Отклонена',pending:'На рассмотрении',approved:'Готово'}[status] || 'Создана');
  }
  function requestClass(status) {
    return ({submitted:'new',in_review:'pending',ready:'done',rejected:'rejected',pending:'pending',approved:'approved'}[status] || 'new');
  }
  function requestStatus(status) { return `<span class="request-status ${requestClass(status)}"><span class="dot"></span>${requestLabel(status)}</span>`; }
  function gradeValue(value) {
    const number = Number(value);
    return `<span class="grade-pill ${number <= 2 ? 'low' : number === 3 ? 'mid' : ''}">${esc(value ?? '—')}</span>`;
  }

  function renderSchedule() {
    const schedule=state.data.schedule||normalized.schedule();
    const lessons=arr(schedule.lessons),teachers=arr(schedule.teachers);
    const selected=state.scheduleDate||campusToday(),weekStart=schedule.weekStart||mondayOf(selected);
    const dayNames=['Воскресенье','Понедельник','Вторник','Среда','Четверг','Пятница','Суббота'];
    const currentTeacher=teachers.find(item=>String(item.id)===String(state.teacherId));
    const changed=lessons.filter(item=>item.changed);
    const actions=(isStaff()?`<button class="btn btn-light" data-cycle-action="new-occurrence">${icon('plus')} ${state.user.role==='teacher'?'Добавить свою пару':'Добавить занятие по дате'}</button>`:'')+(state.user.role==='admin'?`<button class="btn btn-primary" data-view="planner">${icon('edit')} Конструктор расписания</button>`:'');
    const selectedLessons=lessons.filter(item=>item.date===selected||(!item.date&&Number(item.weekday)===new Date(selected+'T12:00Z').getUTCDay()));
    return `${pageHeader('Учебный план',currentTeacher?`Расписание: ${esc(currentTeacher.name)}`:'Расписание','Выберите день или неделю. Домашние задания доступны из карточки занятия.',actions)}
    ${cycleScheduleBanner(selected)}<div class="schedule-toolbar"><div class="tabs" role="tablist"><button class="tab ${state.scheduleMode==='day'?'active':''}" data-schedule-mode="day">День</button><button class="tab ${state.scheduleMode==='week'?'active':''}" data-schedule-mode="week">Неделя</button></div><div class="schedule-date-controls"><button class="icon-btn" data-action="schedule-prev" aria-label="${state.scheduleMode==='day'?'Предыдущий день':'Предыдущая неделя'}">${icon('arrowLeft')}</button><input type="date" id="schedule-date" aria-label="Дата расписания" value="${esc(selected)}"><button class="icon-btn" data-action="schedule-next" aria-label="${state.scheduleMode==='day'?'Следующий день':'Следующая неделя'}">${icon('arrow')}</button><button class="btn btn-ghost" data-action="schedule-today">Сегодня</button></div></div>
    ${teachers.length&&state.user.role!=='teacher'?`<div class="field" style="max-width:390px"><label for="teacher-filter">Расписание преподавателя</label><select id="teacher-filter" data-filter="teacher"><option value="">${isStudent()?'Моя группа':'Все группы'}</option>${teachers.map(teacher=>`<option value="${esc(teacher.id)}" ${String(teacher.id)===String(state.teacherId)?'selected':''}>${esc(teacher.name)}</option>`).join('')}</select></div>`:''}
    ${changed.length?`<div class="info-banner">${icon('alert')}<span><strong>Есть изменения.</strong> Обновлённые занятия отмечены в расписании.</span></div>`:''}
    ${state.scheduleMode==='day'?`<div class="section-title"><h2>${esc(dateFmt(selected,{weekday:'long',day:'numeric',month:'long'}))}</h2><span class="muted">${quantity(selectedLessons.filter(item=>!calendarUnavailable(item)).length,['занятие','занятия','занятий'])}</span></div><div class="today-list">${selectedLessons.length?selectedLessons.map((lesson,index)=>lessonRow(lesson,index,state.user.role==='admin')).join(''):emptyState('В этот день занятий нет','Перейдите на соседний день или выберите дату в календаре.','calendar')}</div>`:
    `<div class="section-title"><h2>${esc(dateFmt(weekStart))} — ${esc(dateFmt(dateAdd(weekStart,6)))}</h2></div><div class="week-grid">${[0,1,2,3,4,5,6].map(index=>{const date=dateAdd(weekStart,index),day=new Date(date+'T12:00Z').getUTCDay(),entries=lessons.filter(item=>item.date===date||(!item.date&&Number(item.weekday)===day)).sort((a,b)=>a.startTime.localeCompare(b.startTime));return `<section class="card day-card ${date===campusToday()?'today':''}"><div class="day-head"><button type="button" class="person-link" data-open-day="${date}"><strong>${dayNames[day]}</strong><small>${esc(dateFmt(date))}</small></button><span>${entries.filter(item=>!calendarUnavailable(item)).length}</span></div>${entries.length?entries.map(lesson=>`<div class="day-lesson ${calendarUnavailable(lesson)?'calendar-cancelled':''}"><time>${esc(lesson.startTime)}–${esc(lesson.endTime)}</time><strong>${lessonTitle(lesson)}</strong><span>${esc(lesson.type)} · ${esc(lesson.room)}</span><span>${personButton(lesson.teacherId||'name:'+lesson.teacher,lesson.teacher,'teacher')}</span>${lesson.group?`<span>${esc(lesson.group)}</span>`:''}${lesson.changed?`<span class="schedule-change">${icon('alert')} ${esc(lesson.changeNote||'Занятие изменено')}</span>`:''}${calendarUnavailable(lesson)?'':lessonHomework(lesson,lesson.originalDate||date)}${calendarLessonActions(lesson)}</div>`).join(''):'<p class="empty-day">Свободный день</p>'}</section>`;}).join('')}</div>`}`;
  }

  function renderGrades() {
    const grades = state.data.grades || normalized.grades();
    const subjects = arr(grades.subjects);
    const exams = arr(grades.exams);
    const attendance = Number(grades.attendance || 0);
    return `${pageHeader('Учебный прогресс', 'Моя успеваемость', 'Оценки, посещаемость и предстоящая сессия — без лишних поисков.',`<button class="btn btn-light" data-campus-action="forecast">${icon('chart')} Прогноз оценок</button>`)}
      <div class="stat-grid" style="margin-bottom:25px"><div class="card stat-card"><div class="stat-top"><span>Средний балл</span>${icon('award')}</div><strong>${esc(grades.average ?? '—')}</strong><small>По выставленным оценкам</small></div><div class="card stat-card"><div class="stat-top"><span>Посещаемость</span>${icon('chart')}</div><strong>${grades.attendance == null ? '—' : `${attendance}%`}</strong><small>${esc(grades.attended ?? 0)} из ${esc(grades.totalClasses ?? 0)} занятий</small></div><div class="card stat-card"><div class="stat-top"><span>Сессия</span>${icon('calendar')}</div><strong>${exams.length}</strong><small>Экзаменов и зачётов</small></div></div>
      <div class="split-grid"><section><div class="section-title"><h2>Дисциплины и оценки</h2></div>${subjects.length ? `<div class="card list-card">${subjects.map(item => `<div class="row"><span class="row-icon">${icon('grades')}</span><div class="row-main"><strong>${campusSubjectButton(item.subject||item.title,state.user?.groupId)}</strong><span>${esc(item.teacher || 'Преподаватель')} · ${esc(({credit:'Зачёт',exam:'Экзамен',grade:'Оценка'}[item.kind] || 'Оценка'))}</span>${item.note ? `<span>${esc(item.note)}</span>` : ''}</div><div class="row-end">${item.kind === 'credit' ? `<span class="grade-pill">${Number(item.value) >= 3 ? 'Зачтено' : 'Не зачтено'}</span>` : gradeValue(item.value)}<span>${esc(shortDate(item.recordedAt))}</span></div></div>`).join('')}</div>` : emptyState('Оценок пока нет', 'Преподаватели внесут результаты после занятий.', 'grades')}</section>
      <div class="stack"><section class="card card-pad"><div class="section-title"><h2>Посещаемость</h2></div><div class="metric-big">${grades.attendance == null ? '—' : `${attendance}%`}</div><div class="progress-label"><span>Посещено занятий</span><strong>${esc(grades.attended ?? 0)} / ${esc(grades.totalClasses ?? 0)}</strong></div><div class="progress-track"><span style="width:${Math.max(0,Math.min(100,attendance))}%"></span></div><p class="muted" style="font-size:11px;line-height:1.5;margin:16px 0 0">Данные обновляются по мере заполнения журнала преподавателями.</p></section>
      <section><div class="section-title"><h2>Ближайшая сессия</h2></div>${exams.length ? `<div class="card list-card">${exams.map(exam => `<div class="row"><span class="row-icon">${icon('calendar')}</span><div class="row-main"><strong>${esc(exam.subject)}</strong><span>${esc(({credit:'Зачёт',exam:'Экзамен'}[exam.kind] || exam.kind || 'Экзамен'))}${exam.room ? ` · Ауд. ${esc(exam.room)}` : ''}</span></div><div class="row-end"><strong>${esc(shortDate(exam.date))}</strong><span>${esc(exam.status || '')}</span></div></div>`).join('')}</div>` : emptyState('Расписание сессии готовится', 'Как только появятся даты, вы увидите их здесь.', 'calendar')}</section></div></div>`;
  }

  function renderRequests() {
    const requests = arr(state.data.requests);
    const admin = state.user.role === 'admin';
    return `${pageHeader('Сервисы деканата', admin ? 'Заявки студентов' : 'Мои заявки', admin ? 'Заявления студентов и их текущие статусы.' : 'Подавайте заявления онлайн и следите за каждым этапом.', isStudent() ? `<button class="btn btn-primary" data-action="new-request">${icon('plus')} Новая заявка</button>` : '')}
      ${admin ? `<div class="info-banner">${icon('info')}<span>Откройте заявку, чтобы изменить её статус и оставить ответ студенту.</span></div>` : ''}
      ${requests.length ? `<div class="split-grid"><section>${requests.map(item => `<div class="card request-card" ${admin ? `data-edit-request="${esc(item.id)}" role="button" tabindex="0"` : ''}><div class="request-head"><span class="row-icon">${icon('file')}</span><h3>${esc(item.type)}</h3>${requestStatus(item.status)}</div>${item.comment ? `<p>${esc(item.comment)}</p>` : ''}${item.staffReply ? `<div class="info-banner" style="margin:10px 0"><span><strong>Ответ:</strong> ${esc(item.staffReply)}</span></div>` : ''}<small>${admin && item.student ? `${esc(item.student)} · ` : ''}${esc(dateFmt(item.createdAt, {day:'numeric',month:'long',year:'numeric'}))}</small></div>`).join('')}</section><aside class="card card-pad"><div class="section-title"><h2>Как это работает</h2></div><div class="mini-feed"><div class="feed-item"><span class="feed-icon">${icon('plus')}</span><div class="feed-copy"><strong>Подача</strong><p>Заявка сразу попадает в деканат.</p></div></div><div class="feed-item"><span class="feed-icon">${icon('clock')}</span><div class="feed-copy"><strong>Рассмотрение</strong><p>Следите за статусом в этом разделе.</p></div></div><div class="feed-item"><span class="feed-icon">${icon('check')}</span><div class="feed-copy"><strong>Готово</strong><p>Ответ от сотрудников появится в карточке.</p></div></div></div></aside></div>` : emptyState(admin ? 'Заявок пока нет' : 'Вы ещё не подавали заявок', admin ? 'Новые заявления студентов появятся здесь.' : 'Нажмите «Новая заявка», чтобы отправить обращение в деканат.', 'file')}`;
  }

  function renderNews() {
    const news = arr(state.data.news);
    const action = isStaff() ? `<button class="btn btn-primary" data-action="new-news">${icon('plus')} Опубликовать</button>` : '';
    return `${pageHeader('В курсе событий', 'Новости и объявления', 'Информация для вашей группы и всего университета.', action)}
      ${news.length ? `<div class="news-grid">${news.map(item => `<article class="card news-card"><div class="news-card-header">${newsTag(item)}<time>${esc(dateFmt(item.createdAt,{day:'numeric',month:'short',year:'numeric'}))}</time></div><h3>${item.pinned ? `${icon('pin','icon-sm')} ` : ''}${esc(item.title)}</h3><p>${esc(item.body)}</p><div class="news-author"><span class="avatar">${esc(initials(item.author))}</span><span>${personButton(item.authorId,item.author||'Университет',item.authorRole)} · ${esc(roleName(item.authorRole))}</span></div></article>`).join('')}</div>` : emptyState('Публикаций пока нет', 'Объявления преподавателей и администрации появятся здесь.', 'news')}`;
  }

  function renderChats() {
    const chats = arr(state.data.chats?.chats);
    const customFolders = arr(state.data.chats?.folders);
    const folders = [...new Set([...chats.map(chat => chat.folder || 'Основные'), ...customFolders.map(folder => folder.name)])];
    const active = chats.find(chat => String(chat.id) === String(state.selectedChat)) || chats[0];
    if (active) state.selectedChat = active.id;
    const messages = arr(active?.messages);
    return `${pageHeader('Связь с университетом', 'Сообщения', 'Общайтесь в группе, клубах и учебных обсуждениях.', `<button class="btn btn-light" data-action="new-chat-folder">${icon('folder')} Новая папка</button>`)}
      ${chats.length ? `<div class="card chat-layout"><div class="chat-sidebar"><div class="chat-side-head">Все чаты <span class="muted">· ${chats.length}</span><button class="icon-btn" data-action="new-chat-folder" aria-label="Создать папку">${icon('plus','icon-sm')}</button></div><div class="chat-groups">${folders.map(folder => `<div class="chat-group-label">${esc(folder)}</div>${chats.filter(chat => (chat.folder || 'Основные') === folder).map(chat => `<button class="chat-item ${String(chat.id) === String(active?.id) ? 'active' : ''}" data-chat="${esc(chat.id)}"><span class="avatar">${esc(initials(chat.title))}</span><span style="min-width:0"><strong>${esc(chat.title)}</strong><small>${esc(chat.description || arr(chat.messages).at(-1)?.body || 'Чат группы')}</small></span></button>`).join('')}`).join('')}</div></div><div class="chat-window"><div class="chat-head"><div><strong>${esc(active.title)}</strong><small>${esc(active.description || (active.kind === 'group' ? 'Чат вашей группы' : 'Университетский чат'))}</small></div><label class="chat-folder-control">${icon('folder','icon-sm')}<select id="chat-folder-select" aria-label="Переместить чат в папку"><option value="">Исходная папка</option>${options(customFolders, active.folderId)}</select></label></div><div class="chat-messages">${messages.length ? messages.map(message => `<div class="message ${String(message.authorId) === String(state.user.id) ? 'own' : ''}"><strong>${personButton(message.authorId,message.author||'Участник')}</strong><p>${esc(message.body)}</p><time>${esc(dateFmt(message.createdAt,{hour:'2-digit',minute:'2-digit'}))}</time></div>`).join('') : `<div style="margin:auto">${emptyState('Пока нет сообщений', 'Начните обсуждение — ваше сообщение увидят участники чата.', 'chat')}</div>`}</div><form id="chat-form" class="chat-compose"><input name="body" aria-label="Сообщение" maxlength="2000" placeholder="Написать сообщение…" required><button class="btn btn-primary" type="submit" aria-label="Отправить сообщение" ${state.busy ? 'disabled' : ''}>${icon('send')}</button></form></div></div>` : emptyState('Чатов пока нет', 'Когда вас добавят в группу или клуб, общение появится здесь.', 'chat')}`;
  }


  function renderResources() {
    const subjects=arr(state.data.resources);
    const selected=subjects.find(subject=>subject.name===state.resourceSubject)||subjects[0];
    return `${pageHeader('Библиотека знаний','Справочные материалы','Краткие справочники, практические памятки и вопросы для самопроверки по каждому предмету.')}
      <div class="info-banner">${icon('info')}<span>Материалы подготовлены как общие учебные примеры для конкурсного прототипа.</span></div>
      ${subjects.length?`<div class="subject-layout"><nav class="card subject-nav" aria-label="Предметы справочника">${subjects.map(subject=>`<button class="subject-button ${subject===selected?'active':''}" data-resource-subject="${esc(subject.name)}">${icon('grades')}<span>${esc(subject.name)}</span><small>${arr(subject.resources).length}</small></button>`).join('')}</nav><section><div class="section-title"><h2>${esc(selected.name)}</h2><span class="muted">${quantity(arr(selected.resources).length,['материал','материала','материалов'])}</span></div><div class="resource-grid">${arr(selected.resources).map(resource=>`<article class="card resource-card"><span class="resource-icon">${icon('file')}</span><span class="tag">${esc(resource.type||'Справочник')}</span><h3>${esc(resource.title)}</h3><p>${esc(resource.description||'Материал по дисциплине')}</p><button class="text-link" data-resource="${esc(resource.id)}">Читать материал ${icon('arrow')}</button></article>`).join('')}</div></section></div>`:emptyState('Материалы готовятся','Справочники появятся после публикации учебных дисциплин.','folder')}`;
  }

  function renderGroup() {
    const group = state.data.group?.group;
    const clubs = arr(state.data.group?.clubs);
    const members = arr(group?.members);
    return `${pageHeader('Университетское сообщество', 'Группа и клубы', 'Ваши люди, инициативы и проекты внутри вуза.')}
      ${group ? `<div class="card card-pad" style="margin-bottom:25px"><span class="eyebrow">Учебная группа</span><h2 style="font-size:23px;letter-spacing:-.04em;margin:10px 0 7px">${esc(group.name)}</h2><p class="muted" style="margin:0;font-size:12px">${esc(group.direction || group.faculty || group.description || '')}</p><div class="section-title" style="margin-top:25px"><h2>Участники</h2><span class="muted" style="font-size:11px">${members.length} человек</span></div><div class="resource-grid">${members.map(member => `<div class="row" style="padding:9px 0;border:0"><span class="avatar">${esc(member.initials || initials(member.name))}</span><div class="row-main"><strong>${personButton(member.id,member.name,'student')}</strong><span>${esc(member.tag || 'Студент')}</span></div></div>`).join('')}</div></div>` : ''}
      <section><div class="section-title"><h2>Клубы и сообщества</h2></div>${clubs.length ? `<div class="club-grid">${clubs.map(club => `<article class="card club-card"><span class="club-icon">${icon('spark')}</span><h3>${esc(club.name)}</h3><p>${esc(club.description || '')}</p><span class="tag">${club.isMember ? `Вы участвуете${club.role ? ` · ${esc(club.role)}` : ''}` : 'Открытое сообщество'}</span></article>`).join('')}</div>` : emptyState('Клубов пока нет', 'Университетские сообщества появятся здесь.', 'users')}</section>`;
  }

  function renderStaff() {
    const staff = state.data.staff || {};
    if (state.user.role === 'teacher') {
      const roster = arr(staff.roster);
      const groups = arr(staff.groups);
      return `${pageHeader('Преподаватель', 'Рабочее место', 'Ваши учебные группы, журнал и объявления.', `<button class="btn btn-primary" data-action="new-grade">${icon('plus')} Внести оценку</button><button class="btn btn-ghost" data-action="new-news">${icon('news')} Объявление</button>`)}
        <div class="stat-grid" style="margin-bottom:25px"><div class="card stat-card"><div class="stat-top"><span>Групп</span>${icon('users')}</div><strong>${groups.length}</strong><small>В вашем расписании</small></div><div class="card stat-card"><div class="stat-top"><span>Записей журнала</span>${icon('grades')}</div><strong>${roster.length}</strong><small>Студенты и дисциплины</small></div><div class="card stat-card"><div class="stat-top"><span>Пары</span>${icon('calendar')}</div><strong>${arr(staff.schedule).length}</strong><small>В текущем расписании</small></div></div>
        <div class="section-title"><h2>Журнал групп</h2></div>${roster.length ? `<div class="card list-card">${roster.map(row => `<div class="row"><span class="avatar">${esc(row.initials || initials(row.name))}</span><div class="row-main"><strong>${personButton(row.id,row.name,'student')}${row.tag ? ` <span class="tag" style="display:inline-flex;margin-left:5px">${esc(row.tag)}</span>` : ''}</strong><span>${esc(row.group)} · ${esc(row.subject)}</span></div><div class="row-end">${row.value != null ? gradeValue(row.value) : '<span class="muted">—</span>'}</div><button class="icon-btn" data-grade-student="${esc(row.id)}" data-grade-subject="${esc(row.subject)}" data-grade-id="${esc(row.gradeId || '')}" aria-label="Изменить оценку">${icon('edit','icon-sm')}</button></div>`).join('')}</div>` : emptyState('Журнал пока пуст', 'Студенты ваших групп появятся здесь.', 'grades')}`;
    }
    const requests = arr(staff.requests).length ? arr(staff.requests) : arr(state.data.requests);
    const groups = arr(staff.groups);
    return `${pageHeader('Администрация', 'Панель управления', 'Расписание, заявления и объявления университета.', `<button class="btn btn-primary" data-action="new-lesson">${icon('plus')} Добавить занятие</button><button class="btn btn-ghost" data-action="new-news">${icon('news')} Новость</button>`)}
      <div class="stat-grid" style="margin-bottom:25px"><div class="card stat-card"><div class="stat-top"><span>Открытые заявки</span>${icon('file')}</div><strong>${requests.filter(r => ['submitted','in_review'].includes(r.status)).length}</strong><small>Ждут действия</small></div><div class="card stat-card"><div class="stat-top"><span>Групп</span>${icon('users')}</div><strong>${groups.length}</strong><small>В учебной системе</small></div><div class="card stat-card"><div class="stat-top"><span>Новости</span>${icon('news')}</div><strong>${arr(state.data.news).length}</strong><small>Опубликовано</small></div></div>
      <div class="split-grid"><section><div class="section-title"><h2>Заявки на рассмотрении</h2><a href="#requests" class="text-link" data-view="requests">Все →</a></div>${requests.filter(r => ['submitted','in_review'].includes(r.status)).length ? requests.filter(r => ['submitted','in_review'].includes(r.status)).slice(0,5).map(item => `<div class="card request-card" data-edit-request="${esc(item.id)}" role="button" tabindex="0"><div class="request-head"><span class="row-icon">${icon('file')}</span><h3>${esc(item.type)}</h3>${requestStatus(item.status)}</div><p>${esc(item.student || '')}${item.comment ? ` · ${esc(item.comment)}` : ''}</p></div>`).join('') : emptyState('Очередь пуста', 'Новые заявления появятся здесь.', 'check')}</section><aside><div class="section-title"><h2>Учебные группы</h2></div><div class="card list-card">${groups.map(group => `<div class="row"><span class="row-icon">${icon('users')}</span><div class="row-main"><strong>${esc(group.name)}</strong><span>${esc(group.direction || group.faculty || '')}</span></div></div>`).join('')}</div></aside></div>`;
  }

  function renderProfile() {
    return `${pageHeader('Личное пространство','Оформление','Выберите тему и цвет. Настройки сохраняются на этом устройстве.')}
      <div class="settings-only"><section class="card setting-card"><h2>Внешний вид</h2><p>Тема и акцентный цвет изменятся во всём интерфейсе.</p><div class="setting-label">Тема</div><div class="theme-buttons"><button class="theme-button ${state.theme === 'light' ? 'active' : ''}" data-theme="light">${icon('sun')} Светлая</button><button class="theme-button ${state.theme === 'dark' ? 'active' : ''}" data-theme="dark">${icon('moon')} Тёмная</button></div><div class="setting-label">Акцентный цвет</div><div class="swatches">${palette.map(color => `<button class="swatch ${state.accent.toLowerCase() === color ? 'active' : ''}" style="--swatch:${color}" data-accent="${color}" aria-label="Выбрать цвет ${color}">${state.accent.toLowerCase() === color ? icon('check') : ''}</button>`).join('')}<label class="custom-color" title="Свой цвет">${icon('plus','icon-sm')}<input type="color" id="custom-accent" value="${esc(state.accent)}" aria-label="Выбрать свой цвет"></label></div><div class="settings-note">${icon('info')}<span>Оформление сохранится в этом браузере и не повлияет на настройки других пользователей.</span></div></section></div>`;
  }

  function options(items, selected, label = item => item.name, value = item => item.id) {
    return arr(items).map(item => `<option value="${esc(value(item))}" ${String(value(item)) === String(selected) ? 'selected' : ''}>${esc(label(item))}</option>`).join('');
  }
  function renderModal() {
    const modal = state.modal || {};
    const composed=renderCyclesModal(modal)||renderMessagingModal(modal)||renderCampusModal(modal)||renderCalendarModal(modal)||renderManagementModal(modal)||renderAccountModal(modal)||renderContentModal(modal)||renderCommunityModal(modal);if(composed)return composed;
    const extended=renderExtensionModal(modal); if(extended)return extended;
    const groups = arr(state.data.staff?.groups);
    const teachers = arr(state.data.schedule?.teachers);
    const close = `<button class="icon-btn" data-action="modal-close" aria-label="Закрыть">${icon('close')}</button>`;
    const shell = (eyebrow, title, description, body) => `<div class="modal-backdrop" data-action="backdrop"><div class="modal" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="modal-head"><div><span class="eyebrow">${eyebrow}</span><h2>${title}</h2><p>${description}</p></div>${close}</div>${body}</div></div>`;

    if(modal.type==='person') {
      const person=modal.profile||{},own=String(person.id)===String(state.user.id);
      return shell('Карточка участника',esc(person.name||'Профиль'),modal.loading?'Загружаем краткую информацию…':esc(person.position||roleName(person.role)),`<div class="compact-person"><span class="avatar avatar-lg">${esc(person.initials||initials(person.name))}</span><div><span class="tag">${esc(displayRoleTag(person.tag)||roleName(person.role))}</span>${person.group?`<p><strong>Группа</strong> ${esc(person.group)}</p>`:''}${person.faculty?`<p>${esc(person.faculty)}</p>`:''}${person.description?`<p class="muted">${esc(person.description)}</p>`:''}</div></div><div class="modal-actions">${isStudent()&&!own&&['teacher','admin'].includes(person.role)&&person.id&&!String(person.id).startsWith('contact:')&&!String(person.id).startsWith('name:')?`<button class="btn btn-light" data-campus-consult-staff="${esc(person.id)}">${icon('clock')} Записаться на консультацию</button>`:''}${person.canMessage&&!own?`<button class="btn btn-light" data-direct-user="${esc(person.id)}">${icon('chat')} Написать сообщение</button>`:''}${modal.scheduleTeacherId?`<button class="btn btn-primary" data-person-schedule="${esc(modal.scheduleTeacherId)}">${icon('calendar')} Расписание преподавателя</button>`:''}<button class="btn btn-primary" data-action="modal-close">Закрыть</button></div>`);
    }
    const actions = label => `<div class="modal-actions"><button class="btn btn-ghost" type="button" data-action="modal-close">Отмена</button><button class="btn btn-primary" type="submit">${label} ${icon('arrow')}</button></div>`;
    if (modal.type === 'chat-folder') return shell('Личное пространство', 'Новая папка чатов', 'Папка и распределение чатов будут видны только вам и сохранятся в аккаунте.', `<form id="chat-folder-form"><div class="field"><label for="chat-folder-name">Название папки</label><input id="chat-folder-name" name="name" maxlength="40" required placeholder="Например, Проекты"></div>${actions('Создать папку')}</form>`);
    if (modal.type === 'request') return shell('Сервис деканата', 'Новая заявка', 'Опишите обращение, и сотрудники увидят его в системе.', `<form id="request-form"><div class="field"><label for="request-type">Тип заявки</label><select id="request-type" name="type" required><option value="Справка об обучении">Справка об обучении</option><option value="Академическая справка">Академическая справка</option><option value="Заявление в деканат">Заявление в деканат</option><option value="Другой вопрос">Другой вопрос</option></select></div><div class="field"><label for="request-comment">Комментарий</label><textarea id="request-comment" name="comment" maxlength="1000" placeholder="Расскажите, что вам нужно"></textarea></div>${actions('Отправить заявку')}</form>`);
    if (modal.type === 'news') return renderNewsComposer();
    if (modal.type === 'lesson') {
      const lesson = modal.lesson || {};
      const title = lesson.id ? 'Изменить занятие' : 'Добавить занятие';
      return shell('Расписание', title, 'Изменение будет видно студентам и преподавателям.', `<form id="lesson-form">${cycleGroupPicker(groups,cycleGroupIds(lesson),'lesson')}${cyclePatternField(lesson)}<div class="field"><label for="lesson-day">День недели</label><select id="lesson-day" name="weekday">${[['1','Понедельник'],['2','Вторник'],['3','Среда'],['4','Четверг'],['5','Пятница'],['6','Суббота'],['0','Воскресенье']].map(([num,name]) => `<option value="${num}" ${Number(lesson.weekday ?? 1) === Number(num) ? 'selected' : ''}>${name}</option>`).join('')}</select></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:10px"><div class="field"><label for="lesson-start">Начало</label><input id="lesson-start" name="startTime" type="time" value="${esc(lesson.startTime || '09:00')}" required></div><div class="field"><label for="lesson-end">Конец</label><input id="lesson-end" name="endTime" type="time" value="${esc(lesson.endTime || '10:30')}" required></div></div><div class="field"><label for="lesson-subject">Дисциплина</label><input id="lesson-subject" name="subject" maxlength="120" value="${esc(lesson.subject || '')}" required></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:10px"><div class="field"><label for="lesson-type">Тип</label><select id="lesson-type" name="type">${['Лекция','Практика','Семинар','Лабораторная','Консультация'].map(type => `<option ${lesson.type === type ? 'selected' : ''}>${type}</option>`).join('')}</select></div><div class="field"><label for="lesson-room">Аудитория</label><input id="lesson-room" name="room" maxlength="80" value="${esc(lesson.room || '')}" required></div></div><div class="field"><label for="lesson-teacher">Преподаватель</label><select id="lesson-teacher" name="teacherId"><option value="">Другой преподаватель — указать имя</option>${options(teachers, lesson.teacherId, item => item.name)}</select></div><div class="field"><label for="lesson-teacher-name">Имя преподавателя</label><input id="lesson-teacher-name" name="teacher" maxlength="120" value="${esc(lesson.teacher || '')}" ${lesson.teacherId?'readonly':''} required></div><div class="field"><label for="lesson-note">Примечание к изменению</label><input id="lesson-note" name="changeNote" maxlength="300" value="${esc(lesson.changeNote || '')}" placeholder="Например, новая аудитория"></div>${extTimePresets()}${actions(lesson.id ? 'Сохранить' : 'Добавить')}</form>`);
    }
    if (modal.type === 'grade') {
      const roster = arr(state.data.staff?.roster);
      const current = roster.find(row => String(row.id) === String(modal.studentId) && row.subject === modal.subject && String(row.gradeId || '') === String(modal.gradeId || '')) || roster[0];
      return shell('Электронный журнал', 'Внести оценку', 'Оценка и посещаемость сразу появятся в кабинете студента.', `<form id="grade-form"><div class="field"><label for="grade-roster">Студент и дисциплина</label><select id="grade-roster" name="rosterIndex" required>${roster.map((row,index) => `<option value="${index}" ${row === current ? 'selected' : ''}>${esc(row.name)} · ${esc(row.subject)} (${esc(row.group)})</option>`).join('')}</select></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:10px"><div class="field"><label for="grade-kind">Тип записи</label><select id="grade-kind" name="kind"><option value="grade" ${current?.kind === 'grade' ? 'selected' : ''}>Оценка</option><option value="credit" ${current?.kind === 'credit' ? 'selected' : ''}>Зачёт</option><option value="exam" ${current?.kind === 'exam' ? 'selected' : ''}>Экзамен</option></select></div><div class="field"><label for="grade-value">Баллы</label><select id="grade-value" name="value">${[5,4,3,2].map(n => `<option value="${n}" ${Number(current?.value || 5) === n ? 'selected' : ''}>${n}</option>`).join('')}</select></div></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:10px"><div class="field"><label for="grade-attended">Посещено</label><input id="grade-attended" type="number" min="0" max="1000" name="attended" value="${esc(current?.attended ?? 0)}" required></div><div class="field"><label for="grade-total">Всего занятий</label><input id="grade-total" type="number" min="0" max="1000" name="totalClasses" value="${esc(current?.totalClasses ?? 0)}" required></div></div><div class="field"><label for="grade-note">Комментарий</label><input id="grade-note" name="note" maxlength="300" value="${esc(current?.note || '')}" placeholder="Необязательно"></div>${actions('Сохранить')}</form>`);
    }
    if (modal.type === 'request-status') {
      const item = arr(state.data.requests).find(row => String(row.id) === String(modal.id));
      if (!item) return '';
      return shell('Заявка студента', esc(item.type), `${esc(item.student || '')} · ${esc(shortDate(item.createdAt))}`, `<p class="muted" style="line-height:1.55">${esc(item.comment || 'Комментарий не указан')}</p><form id="request-status-form"><div class="field"><label for="status">Статус</label><select id="status" name="status">${[['submitted','Отправлена'],['in_review','На рассмотрении'],['ready','Готово'],['rejected','Отклонена']].map(([value,title]) => `<option value="${value}" ${item.status === value ? 'selected' : ''}>${title}</option>`).join('')}</select></div><div class="field"><label for="staff-reply">Ответ студенту</label><textarea id="staff-reply" name="staffReply" maxlength="1000" placeholder="Напишите, что дальше делать студенту">${esc(item.staffReply || '')}</textarea></div>${actions('Обновить статус')}</form>`);
    }
    if (modal.type === 'resource') {
      const resource = arr(state.data.resources).flatMap(subject => arr(subject.resources)).find(item => String(item.id) === String(modal.id));
      if (!resource) return '';
      return shell('Учебный материал', esc(resource.title), esc(resource.author || ''), `<div class="resource-reader-meta"><span class="tag">${esc(resource.type)}</span><span class="muted">${resource.kind==='teacher'?'Материал преподавателя · '+esc(resource.author):'Общее пособие по предмету'}</span></div><div class="resource-reader-body">${esc(resource.body || resource.description || 'Описание пока не добавлено.')}</div><div class="modal-actions"><button class="btn btn-primary" data-action="modal-close">Понятно ${icon('check')}</button></div>`);
    }
    return '';
  }

  root.addEventListener('click', async event => {
    try{if(await cyclesClick(event))return;}catch(error){toast(error.message,true);return;}
    if(await messagingClick(event))return;
    if(await campusClick(event))return;
    const person=event.target.closest('[data-person-id],[data-person-name]');
    if(person){event.preventDefault();await openPerson(person.dataset.personId,person.dataset.personName,person.dataset.personRole);return;}
    const teacherSchedule=event.target.closest('[data-person-schedule]');
    if(teacherSchedule){state.teacherId=teacherSchedule.dataset.personSchedule;await navigateView('schedule');return;}
    const subject=event.target.closest('[data-resource-subject]');
    if(subject){state.resourceSubject=subject.dataset.resourceSubject;render();return;}
    const day=event.target.closest('[data-open-day]');
    if(day){state.scheduleMode='day';await selectScheduleDate(day.dataset.openDay);return;}
    const deadlineButton=event.target.closest('[data-deadline-id]');
    if(deadlineButton){const item=arr(state.data.dashboard?.deadlines).find(value=>value.id===deadlineButton.dataset.deadlineId);if(item){if(item.kind==='homework'){state.homeworkDate=item.lessonDate;state.homeworkSubject=item.subject;state.homeworkGroup=item.groupId;await extLoadHomework();state.view='homework';}else{state.view=item.kind==='exam'?'grades':'news';await loadData([state.view]);}state.modal=null;render();}return;}
    const navigation=event.target.closest('[data-view]');
    if(navigation&&!['profile','account'].includes(navigation.dataset.view)){event.preventDefault();await navigateView(navigation.dataset.view);return;}
    if(event.target.closest('[data-perf-retry]')){await navigateView(currentRoute(),{force:true});return;}
    if(await activityClick(event))return;
    if(await calendarClick(event))return;
    if(await managementClick(event))return;
    if(accountClick(event))return;
    if(await contentClick(event))return;
    if(await communityClick(event))return;
    if(await extensionClick(event))return;
    const demo = event.target.closest('[data-demo]');
    if (demo) {
      const login = {student:'student.1',teacher:'teacher',admin:'admin'}[demo.dataset.demo];
      if (login) { root.querySelector('#login').value = login; root.querySelector('#password').focus(); }
      return;
    }
    const view = event.target.closest('[data-view]');
    if (view) { event.preventDefault(); if(view.dataset.view==='profile'){await openPerson(state.user.id);return;} if(['planner','guide'].includes(view.dataset.view)&&state.user.role!=='admin'){toast('Раздел доступен администрации.',true);return;} state.view = view.dataset.view; state.menu = false; state.modal = null; const refresh=viewDataKeys(state.view);if(refresh)await loadData(refresh); render(); window.scrollTo({top:0,behavior:'smooth'}); return; }
    const chat = event.target.closest('[data-chat]');
    if (chat) { state.selectedChat = chat.dataset.chat; render(); return; }
    const resource = event.target.closest('[data-resource]');
    if (resource) { event.preventDefault(); state.modal = {type:'resource', id:resource.dataset.resource}; render(); return; }
    const editLesson = event.target.closest('[data-edit-lesson]');
    if (editLesson && state.user?.role === 'admin') { state.modal = {type:'lesson', lesson:[...arr(state.data.schedule?.lessons),...arr(state.data.dashboard?.today),...extPlannerLessons()].find(item => String(item.id) === String(editLesson.dataset.editLesson))}; render(); return; }
    const editRequest = event.target.closest('[data-edit-request]');
    if (editRequest && state.user?.role === 'admin') { state.modal = {type:'request-status', id:editRequest.dataset.editRequest}; render(); return; }
    const editGrade = event.target.closest('[data-grade-student]');
    if (editGrade && state.user?.role === 'teacher') { state.modal = {type:'grade', studentId:editGrade.dataset.gradeStudent, subject:editGrade.dataset.gradeSubject, gradeId:editGrade.dataset.gradeId}; render(); return; }
    const mode = event.target.closest('[data-schedule-mode]');
    if (mode) { state.scheduleMode = mode.dataset.scheduleMode; render(); return; }
    const theme = event.target.closest('button[data-theme]');
    if (theme) { state.theme = theme.dataset.theme; localStorage.setItem('atlas-theme',state.theme); applyAppearance(); render(); return; }
    const accent = event.target.closest('button[data-accent]');
    if (accent) { state.accent = accent.dataset.accent; localStorage.setItem('atlas-accent',state.accent); applyAppearance(); render(); return; }
    const action = event.target.closest('[data-action]');
    if (!action) return;
    if (action.dataset.action === 'backdrop' && event.target !== action) return;
    switch (action.dataset.action) {
      case 'menu-toggle': state.menu = !state.menu; render(); break;
      case 'menu-close': state.menu = false; render(); break;
      case 'modal-close': case 'backdrop': state.modal = null; render(); break;
      case 'new-request': state.modal = {type:'request'}; render(); break;
      case 'new-news': state.modal = {type:'news'}; render(); break;
      case 'new-lesson': state.modal = {type:'lesson'}; render(); break;
      case 'new-grade': state.modal = {type:'grade'}; render(); break;
      case 'new-chat-folder': state.modal = {type:'chat-folder'}; render(); break;
      case 'schedule-prev': case 'schedule-next': {
        const step=(state.scheduleMode==='day'?1:7)*(action.dataset.action==='schedule-prev'?-1:1);
        await selectScheduleDate(dateAdd(state.scheduleDate,step));break;
      }
      case 'schedule-today': await selectScheduleDate(campusToday());break;
      case 'logout':
        try { await api('/api/logout','POST',{}); } catch { /* Local session view still closes. */ }
        history.replaceState(null,'','#home');state.user = null; state.data = {}; state.view = 'home'; state.modal = null; state.teacherId='';state.scheduleDate=campusToday();state.weekOffset=0;state.homeworkDate=campusToday();state.homeworkSubject='';state.homeworkGroup='';state.homeworkMode='day';state.homeworkRange=null;state.plannerDay=1;state.guideSection='start';state.plannerGroup='';state.resourceSubject='';state.notificationFilter='all';state.managementSearch='';state.resourceKind='all';state.resourceAuthor='';state.clubId='';state.clubSearch='';state.clubFilter='all';render(); break;
    }
  });

  root.addEventListener('change', async event => {
    if(await cyclesChange(event))return;
    if(await campusChange(event))return;
    if(event.target.id==='lesson-teacher'){const teacher=arr(state.data.schedule?.teachers).find(item=>item.id===event.target.value);const field=root.querySelector('#lesson-teacher-name');if(field){field.readOnly=Boolean(teacher);if(teacher)field.value=teacher.name;else field.value='';}return;}
    if(event.target.id==='schedule-date'){await selectScheduleDate(event.target.value);return;}
    if(await calendarChange(event))return;
    if(await managementChange(event))return;
    if(await activityChange(event))return;
    if(await contentChange(event))return;
    if(await communityChange(event))return;
    if(await extensionChange(event))return;
    if (event.target.id === 'chat-folder-select') {
      const select = event.target;
      select.disabled = true;
      try {
        await api(`/api/chats/${encodeURIComponent(state.selectedChat)}/folder`, 'PATCH', {folderId: select.value || null});
        await loadData(['chats']);
        render();
        toast('Чат перемещён. Папки видны только вам.');
      } catch (error) {
        toast(error.message || 'Не удалось переместить чат.', true);
        render();
      }
      return;
    }
    if (event.target.id === 'custom-accent') {
      const color = event.target.value;
      if (/^#[0-9a-f]{6}$/i.test(color)) { state.accent = color; localStorage.setItem('atlas-accent',color); applyAppearance(); render(); }
    }
    if (event.target.dataset.filter === 'teacher') {
      state.teacherId = event.target.value;
      await loadData(['schedule','homework']); render();
    }
    if (event.target.id === 'news-scope') {
      const field = root.querySelector('#news-group-field');
      if (field) field.hidden = event.target.value !== 'group';
    }
    if (event.target.id === 'grade-roster') {
      const row = arr(state.data.staff?.roster)[Number(event.target.value)];
      const form = root.querySelector('#grade-form');
      if (row && form) {
        form.elements.kind.value = row.kind || 'grade';
        form.elements.value.value = row.value || 5;
        form.elements.attended.value = row.attended ?? 0;
        form.elements.totalClasses.value = row.totalClasses ?? 0;
        form.elements.note.value = row.note || '';
      }
    }
  });

  root.addEventListener('keydown', event => {
    if(event.key==='Tab'&&state.modal){const items=[...root.querySelectorAll('.modal button:not([disabled]),.modal input:not([disabled]),.modal select:not([disabled]),.modal textarea:not([disabled]),.modal a[href]')].filter(item=>item.getClientRects().length);if(items.length){const first=items[0],last=items.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}}
    if (event.key === 'Escape' && state.modal) { state.modal = null; render(); }
    if ((event.key === 'Enter' || event.key === ' ') && event.target.matches('[data-edit-lesson],[data-edit-request]')) { event.preventDefault(); event.target.click(); }
  });

  root.addEventListener('submit', async event => {
    event.preventDefault();
    if (state.busy) return;
    const form = event.target;
    if(form.id==='account-form'){await accountSubmit(form);return;}
    if(state.modal?.uploading){toast('Дождитесь загрузки вложений.',true);return;}
    const values = Object.fromEntries(new FormData(form));
    state.busy = true;
    updateAttachmentDrafts();
    const submitButton = form.querySelector('[type="submit"]');
    if (submitButton) submitButton.disabled = true;
    try {
      if(await cyclesSubmit(form,values)||await campusSubmit(form,values)||await calendarSubmit(form,values)||await activitySubmit(form,values)||await managementSubmit(form,values)||await communitySubmit(form,values)||await contentSubmit(form,values)){state.busy=false;state.modal=null;render();return;}
      if(await extensionSubmit(form,values)){state.busy=false;state.modal=null;render();return;}
      if (form.id === 'login-form') {
        state.loginError = '';
        await api('/api/login','POST',{login:String(values.login).trim(),password:values.password});
        state.bootError = '';
        state.busy = false;
        await boot();
        return;
      }
      if (form.id === 'request-form') {
        await api('/api/requests','POST',{type:values.type,comment:values.comment || ''});
        await loadData(['requests','dashboard']); toast('Заявка отправлена в деканат.');
      }
      if (form.id === 'news-form') {
        await api('/api/news','POST',{title:values.title,body:values.body,scope:values.scope,groupId:values.scope === 'group' ? values.groupId : undefined,attachmentIds:attachmentList().map(file=>file.id),deadline:values.deadline||null});
        if(state.modal)state.modal.published=true;
        await loadData(['news','dashboard','staff']); toast('Объявление опубликовано.');
      }
      if (form.id === 'chat-form') {
        await api('/api/chat-messages','POST',{chatId:state.selectedChat,body:values.body});
        await loadData(['chats']); toast('Сообщение отправлено.');
      }
      if (form.id === 'chat-folder-form') {
        await api('/api/chat-folders','POST',{name:String(values.name || '').trim()});
        await loadData(['chats']); toast('Папка создана. Выберите её в меню открытого чата.');
      }
      if (form.id === 'lesson-form') {
        const teacher = arr(state.data.schedule?.teachers).find(item => String(item.id) === String(values.teacherId));
        const body = {id:state.modal?.lesson?.id,groupId:values.groupId,weekday:Number(values.weekday),startTime:values.startTime,endTime:values.endTime,subject:values.subject,type:values.type,room:values.room,teacherId:values.teacherId || null,teacher:teacher?.name || values.teacher || '',changed:Boolean(state.modal?.lesson?.id),changeNote:values.changeNote || ''};
        await api('/api/schedule','POST',body);
        await loadData(['schedule','dashboard','staff','homework']); if(state.view==='planner')await extRefreshPlanner(); toast('Расписание обновлено.');
      }
      if (form.id === 'grade-form') {
        const row = arr(state.data.staff?.roster)[Number(values.rosterIndex)];
        if (!row) throw new Error('Выберите студента.');
        await api('/api/grades','POST',{studentId:row.id,subject:row.subject,gradeId:row.gradeId || undefined,value:Number(values.value),kind:values.kind,note:values.note || '',attended:Number(values.attended),totalClasses:Number(values.totalClasses)});
        await loadData(['staff']); toast('Запись журнала сохранена.');
      }
      if (form.id === 'request-status-form') {
        await api(`/api/requests/${encodeURIComponent(state.modal.id)}`,'PATCH',{status:values.status,staffReply:values.staffReply || ''});
        await loadData(['requests','staff','dashboard']); toast('Статус заявки обновлён.');
      }
      state.busy = false;
      state.modal = null;
      render();
    } catch (error) {
      state.busy = false;
      if (form.id === 'login-form') { state.loginError = error.message || 'Не удалось войти.'; render(); }
      else toast(error.message || 'Не удалось сохранить данные.', true);
    } finally {
      state.busy = false;
      if (submitButton && submitButton.isConnected) submitButton.disabled = false;
      updateAttachmentDrafts();
    }
  });

  // EXTENSIONS_SLOT

  boot();
})();

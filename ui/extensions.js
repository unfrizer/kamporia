// Injected into the application closure by scripts/build.mjs.
function extToday() {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Moscow', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const value = type => parts.find(part => part.type === type)?.value;
  return `${value('year')}-${value('month')}-${value('day')}`;
}
function extAddDays(value, days) {
  const date = new Date(`${value || extToday()}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
function extMonday(value) {
  const date = new Date(`${value || extToday()}T12:00:00Z`);
  return extAddDays(value || extToday(), -((date.getUTCDay() + 6) % 7));
}
function extHomework() {
  const data = state.data.homework || {};
  return { assignments: arr(data.assignments), groups: arr(data.groups), subjects: arr(data.subjects), options: arr(data.options), canCreate: Boolean(data.canCreate) };
}
async function extLoadHomework(value = state.homeworkDate || extToday()) {
  const from = extMonday(value);
  const to = extAddDays(from, 6);
  state.data.homework = await api(`/api/homework?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,'GET',undefined,{cacheMs:15000});
  state.homeworkRange = { from, to };
}
async function extRefreshPlanner() {
  if (state.user?.role !== 'admin') return;
  state.data.plannerSchedule = await api('/api/schedule?week=0&template=1');
}
function extRole(value) {
  return ({ starosta: 'Староста', headman: 'Староста', student: 'Студент', teacher: 'Преподаватель', admin: 'Администрация' }[value] || value || 'Участник');
}
function extParagraphs(value) { return esc(value).replace(/\n/g, '<br>'); }
function extPersonAttrs(person) {
  const id = person.profileId || person.authorId || person.id || '';
  return `${id ? `data-person-id="${esc(id)}"` : ''} data-person-name="${esc(person.name || person.author || '')}" data-person-role="${esc(person.role || person.authorRole || '')}" data-person-position="${esc(person.position || '')}"`;
}
function extHomeworkDate() { return state.homeworkDate || (state.homeworkDate = extToday()); }
function renderHomework() {
  const data = extHomework();
  const date = extHomeworkDate();
  const mode = state.homeworkMode || 'day';
  const selected = state.homeworkSubject || '';
  const groupId = state.homeworkGroup || '';
  const items = data.assignments.filter(item => (mode === 'week' || item.date === date) && (!selected || item.subject === selected) && (!groupId || item.groupId === groupId));
  const subjects = [...new Set(data.subjects.map(item => typeof item === 'string' ? item : item.subject || item.name).filter(Boolean).concat(data.assignments.map(item => item.subject)))];
  const bySubject = [...new Set(items.map(item => item.subject))];
  const from = extMonday(date);
  const create = data.canCreate ? `<button class="btn btn-primary" data-ext-action="new-homework">${icon('plus')} Добавить задание</button>` : '';
  return `${pageHeader('Учёба по дням', 'Домашние задания', 'Что подготовить к занятиям, когда сдать и кто оставил задание.', create)}
    <div class="card ext-toolbar"><div class="ext-filter-row"><div class="tabs" aria-label="Период заданий"><button class="tab ${mode === 'day' ? 'active' : ''}" data-ext-homework-mode="day">На день</button><button class="tab ${mode === 'week' ? 'active' : ''}" data-ext-homework-mode="week">На неделю</button></div><div class="ext-date-controls"><button class="icon-btn" data-ext-action="homework-prev" aria-label="Предыдущий ${mode === 'week' ? 'период' : 'день'} заданий">${icon('arrowLeft')}</button><label class="ext-date-label"><span class="sr-only">Дата домашних заданий</span><input type="date" id="ext-homework-date" value="${esc(date)}" aria-label="Дата домашних заданий"></label><button class="icon-btn" data-ext-action="homework-next" aria-label="Следующий ${mode === 'week' ? 'период' : 'день'} заданий">${icon('arrow')}</button><button class="btn btn-ghost" data-ext-action="homework-today">Сегодня</button></div></div><div class="ext-filter-row"><div class="field"><label for="ext-homework-subject">Дисциплина</label><select id="ext-homework-subject"><option value="">Все предметы</option>${subjects.map(subject => `<option value="${esc(subject)}" ${selected === subject ? 'selected' : ''}>${esc(subject)}</option>`).join('')}</select></div>${data.groups.length > 1 ? `<div class="field"><label for="ext-homework-group">Учебная группа</label><select id="ext-homework-group"><option value="">Все доступные группы</option>${data.groups.map(group => `<option value="${esc(group.id)}" ${groupId === group.id ? 'selected' : ''}>${esc(group.name)}</option>`).join('')}</select></div>` : ''}</div></div>
    <div class="ext-plan-summary"><span>${icon('calendar','icon-sm')} ${mode === 'week' ? `${esc(dateFmt(from))} — ${esc(dateFmt(extAddDays(from, 6)))}` : esc(dateFmt(date, { weekday: 'long', day: 'numeric', month: 'long' }))}</span><strong>${items.length} ${items.length === 1 ? 'задание' : items.length > 1 && items.length < 5 ? 'задания' : 'заданий'}</strong></div>
    ${data.canCreate ? `<div class="info-banner">${icon('info')}<span>Вы можете добавлять задания в пределах своей роли. В каждой записи видны автор и срок выполнения.</span></div>` : ''}
    ${items.length ? bySubject.map(subject => `<section class="ext-homework-section"><div class="section-title"><h2>${esc(subject)}</h2><span class="muted">${items.filter(item => item.subject === subject).length}</span></div><div class="ext-task-grid">${items.filter(item => item.subject === subject).sort((a,b) => `${a.date}${a.dueDate}`.localeCompare(`${b.date}${b.dueDate}`)).map(item => extTaskCard(item)).join('')}</div></section>`).join('') : `<div class="card card-pad">${emptyState('На выбранный период заданий нет', 'Попробуйте другой день, предмет или режим недели. Новое задание появится здесь после сохранения.', 'grades')}</div>`}`;
}
function extTaskCard(item) {
  const overdue = item.dueDate && item.dueDate < extToday();
  return `<article class="card ext-task-card"><div class="ext-task-meta"><span class="tag">${icon('users','icon-sm')} ${esc(item.group || item.groupId || 'Моя группа')}</span><span>${esc(dateFmt(item.date, { weekday:'short',day:'numeric',month:'short' }))}</span></div><h3>${esc(item.title || item.subject)}</h3><div class="ext-task-body">${extParagraphs(item.body)}</div><div class="ext-task-status ${overdue ? 'is-overdue' : ''}">${icon('clock','icon-sm')}<span>Срок: <strong>${esc(dateFmt(item.dueDate || item.date))}</strong>${overdue ? ' · срок прошёл' : ''}</span></div><div class="ext-task-meta ext-task-author"><button class="text-link" ${extPersonAttrs({id:item.authorId,name:item.author,role:item.authorRole})}>${esc(item.author || 'Участник')}</button><span>${esc(item.authorTag || extRole(item.authorRole))}</span></div>${item.canEdit ? `<div class="ext-task-actions"><button class="btn btn-ghost" data-ext-action="edit-homework" data-id="${esc(item.id)}">${icon('edit','icon-sm')} Изменить</button><button class="btn btn-ghost ext-danger" data-ext-action="delete-homework" data-id="${esc(item.id)}">Удалить</button></div>` : ''}</article>`;
}

function renderServices() {
  const data = state.data.services || {};
  const leadership = [...arr(data.leadership),...arr(data.services).filter(person=>person.kind==='curator')];
  const contacts = arr(data.contacts).filter(person => !leadership.some(item => item.id && item.id === person.id));
  const services = arr(data.services).filter(person=>person.kind!=='curator');
  return `${pageHeader('Люди рядом', 'Деканат и поддержка', 'К кому обратиться по учёбе, где найти старосту и как получить помощь.')}
    <div class="info-banner">${icon('info')}<span>Это конкурсный концепт: люди, кабинеты, часы работы и контакты здесь вымышлены. Адреса example.invalid приведены для примера.</span></div>
    <section class="ext-contacts-section"><div class="section-title"><h2>Ваша учебная команда</h2><span class="muted">Староста и кураторы</span></div><div class="ext-contact-grid">${leadership.length ? leadership.map(extContactCard).join('') : emptyState('Команда группы уточняется', 'Контакты старосты и куратора появятся после назначения.', 'users')}</div></section>
    <section class="ext-contacts-section"><div class="section-title"><h2>Учебный офис и деканат</h2><span class="muted">Вопросы учёбы и документов</span></div><div class="ext-contact-grid">${contacts.length ? contacts.map(extContactCard).join('') : emptyState('Контакты готовятся', 'Сотрудники опубликуют справочную информацию.', 'users')}</div></section>
    <section class="ext-contacts-section"><div class="section-title"><h2>Сервисы поддержки студентов</h2></div><div class="ext-service-grid">${services.map(service => `<article class="card ext-service-card"><span class="row-icon">${icon(service.kind === 'technical' ? 'settings' : service.kind === 'documents' ? 'file' : 'users')}</span><h3>${esc(service.title || service.position || service.name)}</h3>${service.profileId ? `<button class="text-link" ${extPersonAttrs(service)}>${esc(service.name)}</button>` : ''}<p>${esc(service.description || service.body || '')}</p>${service.hours ? `<small>${icon('clock','icon-sm')} ${esc(service.hours)}</small>` : ''}<button class="text-link" data-ext-action="service-details" data-id="${esc(service.id)}">Как обратиться ${icon('arrow','icon-sm')}</button></article>`).join('')}</div></section>`;
}
function extContactCard(person) {
  const name = person.name || person.title || 'Учебный офис';
  const letters = person.initials || name.split(/\s+/).slice(0,2).map(part=>part[0]).join('');
  return `<article class="card ext-contact-card"><div class="ext-contact-heading"><button class="ext-contact-avatar" ${extPersonAttrs({...person,name})} aria-label="Открыть профиль: ${esc(name)}">${esc(letters)}</button><div><button class="ext-contact-name" ${extPersonAttrs({...person,name})}>${esc(name)}</button><span class="ext-contact-position">${esc(person.position || person.tag || extRole(person.role))}</span></div></div>${person.description ? `<p>${esc(person.description)}</p>` : ''}<dl class="ext-contact-meta">${person.office ? `<div><dt>Где найти</dt><dd>${esc(person.office)}</dd></div>` : ''}${person.hours ? `<div><dt>Часы работы</dt><dd>${esc(person.hours)}</dd></div>` : ''}${person.email ? `<div><dt>Пример контакта</dt><dd>${esc(person.email)}</dd></div>` : ''}${person.group ? `<div><dt>Группа</dt><dd>${esc(person.group)}</dd></div>` : ''}</dl></article>`;
}

const extDays = ['Воскресенье','Понедельник','Вторник','Среда','Четверг','Пятница','Суббота'];
const extSlots = [['09:00','10:30'],['10:45','12:15'],['12:30','14:00'],['14:15','15:45'],['16:00','17:30'],['17:45','19:15']];
function extTimePresets() {
  return `<div class="ext-time-presets"><span class="muted">Готовые интервалы</span><div>${extSlots.map(([start,end],index)=>`<button type="button" class="btn btn-ghost" data-ext-action="time-preset" data-start="${start}" data-end="${end}">${index+1} пара · ${start}</button>`).join('')}</div></div>`;
}
function extPlannerLessons() { return arr(state.data.plannerSchedule?.lessons || state.data.schedule?.lessons); }
function extPlannerGroups() { return arr(state.data.staff?.groups); }
function renderPlanner() {
  if (state.user?.role !== 'admin') return emptyState('Раздел доступен администрации', 'Для составления расписания нужен аккаунт администрации.', 'calendar');
  const groups = extPlannerGroups();
  if (!groups.some(group => group.id === state.plannerGroup)) state.plannerGroup = groups[0]?.id || '';
  const group = groups.find(item => item.id === state.plannerGroup);
  const day = Number.isInteger(Number(state.plannerDay)) ? Number(state.plannerDay) : 1;
  const lessons = extPlannerLessons().filter(item=>cycleHasGroup(item,state.plannerGroup)&&(!state.plannerCycle||state.plannerCycle==='all'||item.weekPattern==='all'||item.weekPattern===state.plannerCycle));
  const entries = lessons.filter(item => Number(item.weekday) === day).sort((a,b) => a.startTime.localeCompare(b.startTime));
  return `${pageHeader('Учебное планирование', 'Конструктор расписания', 'Собирайте недельный шаблон группы и проверяйте каждый учебный день.', `<button class="btn btn-ghost" data-ext-action="open-guide">${icon('file')} Инструкция</button><button class="btn btn-primary" data-ext-action="planner-add">${icon('plus')} Добавить занятие</button>`)}
    ${cyclePlannerControls()}<div class="ext-template-note">${icon('info')}<div><strong>Повторяющийся недельный шаблон</strong><p>Пара повторяется каждую неделю либо только в выбранный тип недели. Общая запись действует для всех отмеченных групп. После сохранения студенты сразу увидят новые данные. Для изменения одной даты откройте обычное «Расписание», выберите дату и «Только эта пара».</p></div></div>
    <div class="ext-planner-layout"><aside class="card ext-planner-sidebar"><div class="field"><label for="ext-planner-group">Учебная группа</label><select id="ext-planner-group">${groups.map(item => `<option value="${esc(item.id)}" ${state.plannerGroup === item.id ? 'selected' : ''}>${esc(item.name)}</option>`).join('')}</select></div><div class="ext-plan-summary"><span>Недельная нагрузка</span><strong>${lessons.length} занятий</strong></div><div class="ext-day-buttons">${[1,2,3,4,5,6,0].map(value => `<button class="ext-day-button ${value === day ? 'active' : ''}" data-ext-planner-day="${value}" ${value === day ? 'aria-current="true"' : ''}><span>${extDays[value]}</span><strong>${lessons.filter(item=>Number(item.weekday)===value).length}</strong></button>`).join('')}</div></aside>
    <section class="ext-planner-main"><div class="card ext-planner-day"><div class="section-title"><div><span class="eyebrow">${esc(group?.name || 'Группа')}</span><h2>${extDays[day]}</h2></div><button class="btn btn-ghost" data-ext-action="planner-add">${icon('plus','icon-sm')} Занятие</button></div>${entries.length ? entries.map((lesson,index)=>`<article class="ext-plan-row"><div class="ext-plan-time"><small>${index+1} занятие</small><strong>${esc(lesson.startTime)}</strong><span>${esc(lesson.endTime)}</span></div><div class="ext-plan-copy"><h3>${esc(lesson.subject)}</h3><small class="cycle-template-tag">${esc(cyclePatternLabel(lesson.weekPattern))}</small><span>${esc(lesson.type)} · ${esc(lesson.room)}</span><button class="text-link" ${extPersonAttrs({id:lesson.teacherId || `name:${lesson.teacher}`,name:lesson.teacher,role:'teacher'})}>${esc(lesson.teacher)}</button>${lesson.changed ? `<p class="schedule-change">${icon('alert','icon-sm')} ${esc(lesson.changeNote || 'Занятие изменено')}</p>` : ''}</div><div class="ext-plan-actions"><button class="icon-btn" data-ext-action="planner-edit" data-id="${esc(lesson.id)}" aria-label="Изменить занятие ${esc(lesson.subject)}">${icon('edit')}</button><button class="btn btn-ghost ext-danger" data-ext-action="planner-delete" data-id="${esc(lesson.id)}">Удалить</button></div></article>`).join('') : emptyState('В этот день занятий нет', 'Добавьте первую пару или выберите другой день недели.', 'calendar')}<button class="ext-add-lesson" data-ext-action="planner-add">${icon('plus')} Добавить занятие в этот день</button></div>
    <div class="card ext-week-preview"><div class="section-title"><h2>Неделя целиком</h2><span class="muted">${esc(group?.name || '')}</span></div><div class="ext-week-strip">${[1,2,3,4,5,6,0].map(value=>{const list=lessons.filter(item=>Number(item.weekday)===value).sort((a,b)=>a.startTime.localeCompare(b.startTime));return `<button class="ext-week-day ${value===day?'active':''}" data-ext-planner-day="${value}"><strong>${extDays[value].slice(0,2)}</strong><span>${list.length ? list.map(item=>`<i title="${esc(item.subject)}">${esc(item.startTime)}</i>`).join('') : 'Нет пар'}</span></button>`}).join('')}</div></div>
    <div class="ext-template-note ext-template-note-quiet">${icon('check')}<div><strong>Перед сохранением</strong><p>Проверьте группу, преподавателя, кабинет и время. Система остановит пересечение, но длительность перемен и переходы между корпусами нужно учесть самостоятельно.</p></div></div></section></div>`;
}

const extGuideSections = [
  {id:'start',name:'Быстрый старт',title:'Соберите день и проверьте результат',intro:'Сохранение сразу меняет данные в системе. Отдельного скрытого этапа публикации нет.',steps:[['Выберите группу и день','Откройте конструктор. Проверьте название группы, затем выберите день недели в левой колонке.'],['Заполните занятия по порядку','Укажите время, дисциплину, тип, преподавателя и аудиторию. Готовые интервалы помогают быстрее заполнить обычную пару.'],['Проверьте неделю','Посмотрите день целиком и обзор недели. Убедитесь, что пары не продублированы и учтены перемены.'],['Посмотрите глазами студента','После сохранения откройте обычное расписание. В карточке должны быть видны время, аудитория, преподаватель и понятное изменение.']]},
  {id:'template',name:'Недельный шаблон',title:'Что именно меняет конструктор',intro:'Расписание — повторяющийся недельный шаблон. Изменение понедельника действует в понедельниках всех просматриваемых недель.',steps:[['Шаблон и календарная дата','Конструктор меняет повторяющуюся неделю. Разовая отмена или перенос создаются в обычном расписании кнопкой «Только эта пара».'],['День и неделя листаются по-разному','В режиме «День» стрелка переходит на один календарный день, в режиме «Неделя» — на семь. «Сегодня» возвращает к текущей дате.'],['Пустой выходной — нормальное состояние','Если занятий нет, проверьте выбранную дату и фильтр преподавателя. Не добавляйте фиктивную пару, чтобы заполнить пустой экран.']]},
  {id:'add',name:'Добавить занятие',title:'Одна карточка — одна учебная пара',intro:'Заполняйте день по времени. Если результат первой попытки неясен, сначала проверьте список, затем отправляйте форму повторно.',steps:[['Проверьте группу и день','Нажмите «Добавить занятие» в выбранном дне. Группа и день подставятся автоматически.'],['Укажите начало и конец','Выберите готовый интервал или заполните время вручную. Конец должен быть позже начала. Учитывайте время перемены.'],['Назовите дисциплину и тип','Используйте полное, узнаваемое название. Выберите лекцию, практику, семинар, лабораторную или консультацию.'],['Назначьте преподавателя и аудиторию','Выберите человека из списка либо укажите имя. Пишите кабинет вместе с корпусом: «Корпус А · 304».'],['Сохраните и проверьте карточку','После успешного сохранения запись появится в дне. Проверьте её место в недельном обзоре.']]},
  {id:'edit',name:'Изменить или удалить',title:'Исправляйте существующую пару',intro:'Если нужно перенести занятие, измените его карточку. Создание новой без удаления старой оставит в расписании обе пары.',steps:[['Найдите точную запись','Сверьте группу, дисциплину, день и время, затем нажмите значок редактирования.'],['Меняйте только нужные поля','При замене кабинета убедитесь, что преподаватель и время остались прежними. Для переноса измените день или время этой же записи.'],['Объясните изменение','Напишите «Аудитория 305 вместо 302» или «Начало перенесено на 10:45». Пометка появится у студентов.'],['Удаляйте после проверки','Нажмите «Удалить», сверьте данные в подтверждении и подтвердите действие. Корзины нет: ошибочно удалённое занятие потребуется создать заново.']]},
  {id:'conflicts',name:'Пересечения и ошибки',title:'Одна группа, преподаватель и кабинет — в одном месте',intro:'Система проверяет пересечение времени для группы, преподавателя и аудитории. Проверка помогает найти ошибки, но не рассчитывает педагогическую нагрузку или переходы между корпусами.',steps:[['Прочитайте причину отказа','Сообщение указывает, что мешает сохранению. Проверьте соответствующий день и существующую запись.'],['Выберите свободный вариант','Измените время, кабинет или преподавателя, если такая замена согласована. Не меняйте написание кабинета ради обхода проверки.'],['Сохраните повторно','Занятие 09:00–10:30 пересекается с 10:00–11:30. Начало в 10:30 не перекрывает первую пару, но нужную перемену нужно учесть отдельно.']]},
  {id:'homework',name:'Домашние задания',title:'Задание относится к конкретной дате',intro:'Домашняя работа не повторяется автоматически каждую неделю. Дата задания определяет учебный день, срок — когда работа должна быть готова.',steps:[['Выберите группу и дисциплину','Откройте «Домашние задания» или кнопку у занятия. Проверьте предмет и учебную группу.'],['Укажите две даты','Поставьте дату отображения задания и срок выполнения. Не подменяйте одно другим.'],['Опишите проверяемый результат','Дайте короткий заголовок. В тексте напишите, что сделать, в каком объёме и что принести или показать.'],['Сохраните и посмотрите карточку','Студент увидит автора, его роль, дату и срок. Если требование изменилось, исправьте прежнюю запись вместо создания противоречащей копии.']],permissions:true},
  {id:'communication',name:'Новости и заявки',title:'Объявление и ответ должны помогать действовать',intro:'Сообщайте, что произошло, кого касается, когда действует и что нужно сделать.',steps:[['Выберите аудиторию объявления','Администрация публикует всему университету или группе; преподаватель — своим группам. Изменение одной группы не нужно отправлять всему вузу.'],['Откройте заявку в рабочем месте','Прочитайте тип и комментарий, выберите статус и напишите понятный ответ.'],['Смысл статуса должен быть точным','«На рассмотрении» — взято в работу. «Готово» — результат готов, а в ответе указано, где и когда его получить. При отказе объясните причину и следующий шаг.'],['Проверьте результат','Сохраните изменение. Студент увидит статус и ответ в своей карточке.']]},
  {id:'people',name:'Люди и поддержка',title:'Помогите студенту найти нужного человека',intro:'Справочная информация не должна требовать поиска по личным чатам.',steps:[['Справочные материалы','Выберите дисциплину и откройте памятку. В прототипе это общие учебные примеры, а не утверждённые материалы конкретного вуза.'],['Деканат и поддержка','Здесь собраны учебный офис, староста, кураторы и сервисы помощи. Контакты example.invalid и часы работы — демонстрационные.'],['Компактные карточки людей','Нажатие на имя или аватар открывает справочный профиль поверх экрана. Чужие оценки, заявки и данные входа в него не входят.'],['Расписание преподавателя','Из карточки или фильтра расписания можно посмотреть занятия выбранного преподавателя.']]},
  {id:'calendar',name:'Одна дата',title:'Изменить только одну пару',intro:'Обычное расписание учитывает недельный шаблон и отдельные календарные исключения.',steps:[['Откройте нужный день','В разделе «Расписание» выберите календарную дату, найдите занятие и нажмите «Только эта пара». Проверьте группу и исходную дату.'],['Выберите действие','Можно отменить пару либо изменить её дату, время, кабинет и преподавателя. Добавьте понятное объяснение. Сохранение сразу видно группе и попадает в уведомления.'],['Проверьте результат','При переносе исходная карточка показывает новую дату и кнопку перехода. В новой дате появляется пара с пометкой переноса. Отмена не учитывается как проведённая пара. Домашнее задание остаётся связано с исходной учебной датой.'],['Восстановите при необходимости','Откройте изменение пары и выберите восстановление исходного расписания. Сервер проверит пересечения. При конфликте сначала освободите исходный интервал. Недельный шаблон с действующим исключением нельзя удалить или перенести в другой день.']]},
  {id:'activity',name:'Уведомления и чаты',title:'Держите участников в курсе',intro:'События доступны через колокольчик в верхней панели.',steps:[['Проверьте адресата','Изменения пары и задания видит нужная группа. Ответ на заявку видит её автор. Новость соответствует выбранной аудитории.'],['Прочтение сохраняется','Откройте событие или отметьте его прочитанным. Есть фильтр непрочитанных и команда «Прочитать все». Центр показывает последние 30 дней.'],['Сообщения обновляются автоматически','Открытый чат проверяет поступление сообщений каждые 5 секунд. Черновик сохраняется, при чтении истории новые сообщения не сбрасывают положение прокрутки. При скрытии вкладки опрос останавливается.']]},
  {id:'management',name:'Публикации и роли',title:'Поддерживайте порядок в данных',intro:'Для этих действий используйте аккаунт администрации; автор также управляет собственными публикациями в пределах своих прав.',steps:[['Исправьте публикацию','У новости, материала или клубной записи нажмите «Изменить». Вложения сохраняются в текущем наборе. Для нового набора создайте новую публикацию.'],['Скройте через архив','Архивирование убирает запись из обычной ленты. В разделе «Архив» можно восстановить её вместе с вложениями. Это обратимое действие.'],['Назначьте группу и старосту','В «Люди и роли» откройте студента, выберите группу и статус. В группе один староста: при назначении нового прежний становится студентом. Учебные данные и доступ к чату обновляются автоматически.'],['Управляйте клубами','Откройте «Участие в клубах», добавьте участника и роль или удалите его из состава. Доступ к клубному чату зависит от членства, право публикации — от роли. Логины и системные роли здесь не изменяются.']]},
  {id:'checklist',name:'Контрольный список',title:'Перед тем как считать неделю готовой',intro:'Проверьте не только наличие карточек, но и то, насколько понятно студенту, что делать дальше.',checklist:['Выбрана правильная группа и заполнены нужные дни.','У каждой пары есть время, предмет, тип, преподаватель и аудитория.','Нет дубликатов, пересечений и забытых перемен.','У изменённых пар есть понятное примечание.','Домашние задания привязаны к датам и имеют ясный срок.','Объявления адресованы нужной аудитории.','После сохранения данные проверены в обычном расписании и на телефоне.']},
];
function renderGuide() {
  if (state.user?.role !== 'admin') return emptyState('Инструкция доступна администрации', 'Этот раздел описывает рабочие инструменты сотрудников.', 'file');
  const current = extGuideSections.find(item=>item.id===state.guideSection) || extGuideSections[0];
  const index = extGuideSections.indexOf(current);
  return `${pageHeader('Помощь в работе', 'Инструкция администратора', 'Пошаговые действия, примеры и проверка результата.', `<button class="btn btn-primary" data-ext-action="open-planner">${icon('calendar')} Открыть конструктор</button>`)}
    <div class="ext-guide-layout"><aside class="card ext-guide-nav"><span class="eyebrow">Содержание</span>${extGuideSections.map((item,i)=>`<button class="${item.id===current.id?'active':''}" data-ext-guide-section="${item.id}" ${item.id===current.id?'aria-current="step"':''}><span>${String(i+1).padStart(2,'0')}</span>${item.name}</button>`).join('')}</aside><article class="card ext-guide-content"><span class="eyebrow">Шаг ${index+1} из ${extGuideSections.length}</span><h2>${current.title}</h2><p class="ext-guide-intro">${current.intro}</p>${arr(current.steps).map(([title,body],i)=>`<section class="ext-guide-step"><span>${i+1}</span><div><h3>${title}</h3><p>${body}</p></div></section>`).join('')}${current.permissions?`<div class="ext-guide-table"><table><thead><tr><th>Роль</th><th>Права на задания</th></tr></thead><tbody><tr><td>Студент</td><td>Читает задания своей группы.</td></tr><tr><td>Староста</td><td>Добавляет задания своей группы, меняет и удаляет свои записи.</td></tr><tr><td>Преподаватель</td><td>Добавляет по своим дисциплинам и группам, меняет собственные записи в пределах этих прав.</td></tr><tr><td>Администрация</td><td>Добавляет, исправляет и удаляет задания учебных групп.</td></tr></tbody></table></div>`:''}${current.checklist?`<ul class="ext-checklist">${current.checklist.map(text=>`<li>${icon('check')}<span>${text}</span></li>`).join('')}</ul>`:''}<div class="ext-guide-callout">${icon('info')}<p>Памятка относится к конкурсному прототипу. Разовый перенос делайте в обычном расписании, повторяющееся изменение — в конструкторе. Импорт Excel и автоматическая оптимизация расписания не предусмотрены.</p></div><div class="ext-guide-pagination">${index>0?`<button class="btn btn-ghost" data-ext-guide-section="${extGuideSections[index-1].id}">${icon('arrowLeft')} Назад</button>`:'<span></span>'}${index<extGuideSections.length-1?`<button class="btn btn-primary" data-ext-guide-section="${extGuideSections[index+1].id}">Далее ${icon('arrow')}</button>`:`<button class="btn btn-primary" data-ext-action="open-planner">Перейти к расписанию ${icon('arrow')}</button>`}</div></article></div>`;
}

function extModalShell(title, description, content, eyebrow='Учебный день') {
  return `<div class="modal-backdrop" data-action="backdrop"><div class="modal ext-modal" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="modal-head"><div><span class="eyebrow">${esc(eyebrow)}</span><h2>${esc(title)}</h2><p>${esc(description)}</p></div><button class="icon-btn" data-action="modal-close" aria-label="Закрыть">${icon('close')}</button></div>${content}</div></div>`;
}
function extModalActions(label, danger=false) { return `<div class="modal-actions"><button class="btn btn-ghost" type="button" data-action="modal-close">Отмена</button><button class="btn ${danger?'ext-btn-danger':'btn-primary'}" type="submit">${label} ${icon(danger?'check':'arrow')}</button></div>`; }
function renderExtensionModal(modal) {
  if (modal.type === 'homework') {
    const data = extHomework();
    const item = modal.assignment || {};
    const groups = data.groups;
    const selectedGroup = item.groupId || modal.groupId || state.homeworkGroup || state.user.groupId || groups[0]?.id;
    const allowedSubjects = data.options.filter(option=>option.groupId===selectedGroup).map(option=>option.subject);
    const subjects = [...new Set((allowedSubjects.length ? allowedSubjects : data.subjects.map(value=>typeof value==='string'?value:value.subject||value.name).filter(Boolean)).concat(item.subject || modal.subject || []))];
    const subject = item.subject || modal.subject || state.homeworkSubject || subjects[0] || '';
    const date = item.date || modal.date || extHomeworkDate();
    return extModalShell(item.id?'Изменить домашнее задание':'Новое домашнее задание','Укажите учебный день, срок и понятный результат работы.',`<form id="ext-homework-form"><div class="field"><label for="ext-hw-group">Группа</label><select id="ext-hw-group" name="groupId" required>${groups.map(group=>`<option value="${esc(group.id)}" ${selectedGroup===group.id?'selected':''}>${esc(group.name)}</option>`).join('')}</select></div><div class="field"><label for="ext-hw-subject">Дисциплина</label><select id="ext-hw-subject" name="subject" required>${subjects.map(value=>`<option value="${esc(value)}" ${subject===value?'selected':''}>${esc(value)}</option>`).join('')}</select></div><div class="ext-form-grid"><div class="field"><label for="ext-hw-date">Дата задания</label><input id="ext-hw-date" name="date" type="date" value="${esc(date)}" required></div><div class="field"><label for="ext-hw-due">Срок выполнения</label><input id="ext-hw-due" name="dueDate" type="date" value="${esc(item.dueDate || date)}" required></div></div><div class="field"><label for="ext-hw-title">Короткий заголовок</label><input id="ext-hw-title" name="title" value="${esc(item.title || '')}" maxlength="140" required placeholder="Например, подготовить практический проект"></div><div class="field"><label for="ext-hw-body">Что нужно сделать</label><textarea id="ext-hw-body" name="body" maxlength="4000" required placeholder="Опишите результат, объём и что показать на занятии">${esc(item.body || '')}</textarea></div>${extModalActions(item.id?'Сохранить изменения':'Добавить задание')}</form>`,'Домашнее задание');
  }
  if (modal.type === 'delete-homework') {
    const item = extHomework().assignments.find(value=>value.id===modal.id);
    return extModalShell('Удалить задание?', 'Проверьте запись перед удалением.', `<form id="ext-homework-delete"><div class="ext-confirm"><strong>${esc(item?.title || 'Домашнее задание')}</strong><p>${esc(item?.subject)} · ${esc(dateFmt(item?.date))}</p><small>Запись исчезнет у группы. Автоматической отмены удаления нет.</small></div>${extModalActions('Удалить задание',true)}</form>`,'Подтверждение');
  }
  if (modal.type === 'delete-lesson') {
    const item = extPlannerLessons().find(value=>value.id===modal.id);
    return extModalShell('Удалить занятие?', 'Удаление меняет повторяющийся недельный шаблон.', `<form id="ext-lesson-delete"><div class="ext-confirm"><strong>${esc(item?.subject || 'Занятие')}</strong><p>${esc(item?.group || state.plannerGroup)} · ${extDays[Number(item?.weekday)] || ''}</p><p>${esc(item?.startTime)}–${esc(item?.endTime)} · ${esc(item?.room)}</p><small>Занятие исчезнет из шаблона. При ошибке его потребуется создать заново.</small></div>${extModalActions('Удалить занятие',true)}</form>`,'Подтверждение');
  }
  if (modal.type === 'service-details') {
    const service = arr(state.data.services?.services).find(item=>item.id===modal.id) || {};
    return extModalShell(service.title || service.position || service.name || 'Сервис поддержки','Справочная информация для студента.',`<div class="ext-service-detail"><p>${extParagraphs(service.body || service.description || '')}</p>${service.steps?`<ol>${arr(service.steps).map(step=>`<li>${esc(step)}</li>`).join('')}</ol>`:''}<dl class="ext-contact-meta">${['office','hours','email','contact'].filter(key=>service[key]).map(key=>`<div><dt>${({office:'Где найти',hours:'Когда обратиться',email:'Пример контакта',contact:'К кому обратиться'}[key])}</dt><dd>${esc(service[key])}</dd></div>`).join('')}</dl><div class="settings-note">${icon('info')}<span>Контакты демонстрационные. Не отправляйте реальные данные по адресам example.invalid.</span></div></div>`,'Поддержка');
  }
  return '';
}

async function extensionClick(event) {
  const view = event.target.closest('[data-view]');
  if (view && ['homework','services','planner','guide'].includes(view.dataset.view)) {
    event.preventDefault();
    const target = view.dataset.view;
    try {
      if (['planner','guide'].includes(target) && state.user?.role !== 'admin') throw new Error('Раздел доступен администрации.');
      if (target === 'homework') await extLoadHomework();
      if (target === 'services') state.data.services = await api('/api/student-services');
      if (target === 'planner') await extRefreshPlanner();
      state.view = target; state.menu = false; state.modal = null; render(); window.scrollTo({top:0,behavior:'smooth'});
    } catch (error) { toast(error.message || 'Не удалось открыть раздел.',true); }
    return true;
  }
  const guide = event.target.closest('[data-ext-guide-section]');
  if (guide) { state.guideSection=guide.dataset.extGuideSection; render(); window.scrollTo({top:0,behavior:'smooth'}); return true; }
  const day = event.target.closest('[data-ext-planner-day]');
  if (day) { state.plannerDay=Number(day.dataset.extPlannerDay); render(); return true; }
  const mode = event.target.closest('[data-ext-homework-mode]');
  if (mode) { state.homeworkMode=mode.dataset.extHomeworkMode; render(); return true; }
  const action = event.target.closest('[data-ext-action]');
  if (!action) return false;
  const name=action.dataset.extAction;
  try {
    if (['homework-prev','homework-next','homework-today'].includes(name)) {
      const step=(state.homeworkMode==='week'?7:1)*(name==='homework-prev'?-1:1);
      state.homeworkDate=name==='homework-today'?extToday():extAddDays(extHomeworkDate(),step);
      await extLoadHomework(); render(); return true;
    }
    if (name==='homework-lesson') {
      state.homeworkDate=action.dataset.date || extToday(); state.homeworkSubject=action.dataset.subject || ''; state.homeworkGroup=action.dataset.groupId || ''; state.homeworkMode='day';
      await extLoadHomework();
      if(state.homeworkGroup && !extHomework().groups.some(group=>group.id===state.homeworkGroup)) { state.homeworkGroup='';throw new Error('Домашние задания доступны только для ваших учебных групп.'); }
      state.view='homework';state.menu=false;render();window.scrollTo({top:0,behavior:'smooth'});return true;
    }
    if (name==='new-homework') {
      if(!extHomework().canCreate) throw new Error('Добавление заданий недоступно для вашей роли.');
      state.modal={type:'homework',date:extHomeworkDate(),subject:state.homeworkSubject,groupId:state.homeworkGroup};render();return true;
    }
    if (name==='edit-homework' || name==='delete-homework') {
      const assignment=extHomework().assignments.find(item=>item.id===action.dataset.id);
      if(!assignment?.canEdit) throw new Error('Эту запись может изменить её автор или администрация.');
      state.modal=name==='edit-homework'?{type:'homework',assignment}:{type:'delete-homework',id:assignment.id};render();return true;
    }
    if (name==='open-guide') { if(state.user?.role!=='admin')throw new Error('Раздел доступен администрации.');state.view='guide';state.guideSection='start';render();window.scrollTo({top:0,behavior:'smooth'});return true; }
    if (name==='open-planner') {if(state.user?.role!=='admin')throw new Error('Раздел доступен администрации.');await navigateView('planner');return true;}
    if (name==='planner-add') {
      if(state.user?.role!=='admin')throw new Error('Изменение расписания доступно администрации.');
      const entries=extPlannerLessons().filter(item=>cycleHasGroup(item,state.plannerGroup)&&(!state.plannerCycle||state.plannerCycle==='all'||item.weekPattern==='all'||item.weekPattern===state.plannerCycle)&&Number(item.weekday)===Number(state.plannerDay));
      const slot=extSlots.find(([start])=>!entries.some(item=>item.startTime===start)) || extSlots[0];
      state.modal={type:'lesson',lesson:{groupId:state.plannerGroup,weekday:Number(state.plannerDay ?? 1),startTime:slot[0],endTime:slot[1]}};render();return true;
    }
    if (name==='planner-edit' || name==='planner-delete') {
      if(state.user?.role!=='admin')throw new Error('Изменение расписания доступно администрации.');
      const lesson=extPlannerLessons().find(item=>item.id===action.dataset.id);
      if(!lesson)throw new Error('Занятие не найдено. Обновите список.');
      state.modal=name==='planner-edit'?{type:'lesson',lesson}:{type:'delete-lesson',id:lesson.id};render();return true;
    }
    if (name==='time-preset') {
      const form=root.querySelector('#lesson-form');
      if(form){form.elements.startTime.value=action.dataset.start;form.elements.endTime.value=action.dataset.end;}
      return true;
    }
    if (name==='service-details') {state.modal={type:'service-details',id:action.dataset.id};render();return true;}
  } catch(error) {toast(error.message || 'Не удалось выполнить действие.',true);return true;}
  return false;
}
async function extensionChange(event) {
  const input=event.target;
  try {
    if(input.id==='ext-hw-group') {
      const select=root.querySelector('#ext-hw-subject');
      const allowed=[...new Set(extHomework().options.filter(option=>option.groupId===input.value).map(option=>option.subject))];
      if(select && allowed.length) { const previous=select.value; select.innerHTML=allowed.map(subject=>`<option value="${esc(subject)}" ${subject===previous?'selected':''}>${esc(subject)}</option>`).join(''); }
      return true;
    }
    if(input.id==='ext-homework-date'){state.homeworkDate=input.value || extToday();await extLoadHomework();render();return true;}
    if(input.id==='ext-homework-subject'){state.homeworkSubject=input.value;render();return true;}
    if(input.id==='ext-homework-group'){state.homeworkGroup=input.value;render();return true;}
    if(input.id==='ext-planner-group'){state.plannerGroup=input.value;render();return true;}
  }catch(error){toast(error.message || 'Не удалось обновить данные.',true);return true;}
  return false;
}
async function extensionSubmit(form,values) {
  if(form.id==='ext-homework-form') {
    const assignment=state.modal?.assignment;
    const data={groupId:values.groupId,subject:values.subject,date:values.date,dueDate:values.dueDate,title:values.title,body:values.body};
    await api(assignment?.id?`/api/homework/${encodeURIComponent(assignment.id)}`:'/api/homework',assignment?.id?'PATCH':'POST',data);
    state.homeworkDate=values.date; state.homeworkSubject=values.subject; state.homeworkGroup=values.groupId; await extLoadHomework(); toast(assignment?.id?'Домашнее задание обновлено.':'Домашнее задание добавлено.');return true;
  }
  if(form.id==='ext-homework-delete') {await api(`/api/homework/${encodeURIComponent(state.modal.id)}`,'DELETE',{});await extLoadHomework();toast('Домашнее задание удалено.');return true;}
  if(form.id==='ext-lesson-delete') {if(state.user?.role!=='admin')throw new Error('Недостаточно прав.');await api(`/api/schedule/${encodeURIComponent(state.modal.id)}`,'DELETE',{});await extRefreshPlanner();await loadData(['schedule','dashboard','staff']);toast('Занятие удалено из недельного шаблона.');return true;}
  return false;
}

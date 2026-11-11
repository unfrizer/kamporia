// One-off calendar changes. The weekly template remains a separate administrator tool.
function calendarUnavailable(lesson) { return ['cancelled','moved-away'].includes(lesson?.status); }
function calendarMayEdit(lesson){return state.user?.role==='admin'||state.user?.role==='teacher'&&lesson?.teacherId===state.user.id&&lesson?.baseTeacherId===state.user.id;}
function calendarLessonActions(lesson) {
  if(!lesson?.date)return '';
  const status=lesson.status||'scheduled';
  const label={added:'Добавлено разово',cancelled:'Отменено только на эту дату','moved-away':'Перенесено на '+dateFmt(lesson.targetDate),moved:'Перенос с '+dateFmt(lesson.originalDate),changed:'Изменение на '+dateFmt(lesson.date)}[status];
  return `<div class="calendar-lesson-extra">${label?`<span class="calendar-status ${calendarUnavailable(lesson)?'calendar-status-muted':''}">${icon(calendarUnavailable(lesson)?'alert':'calendar','icon-sm')}${esc(label)}</span>`:''}${status==='moved-away'?`<button type="button" class="calendar-date-link" data-calendar-go="${esc(lesson.targetDate)}">Перейти к новой дате ${icon('arrow','icon-sm')}</button>`:''}${calendarMayEdit(lesson)?`<button type="button" class="btn btn-ghost btn-small" data-calendar-edit="${esc(lesson.baseLessonId||lesson.id)}" data-calendar-original="${esc(lesson.originalDate||lesson.date)}" data-calendar-date="${esc(lesson.date)}">${icon('edit','icon-sm')} ${lesson.singleDate?'Изменить разовую пару':lesson.exceptionId?'Изменить эту пару':'Только эта пара'}</button>`:''}</div>`;
}
function calendarVisibleLesson(id,originalDate,date) {
  const rows=[...arr(state.data.schedule?.lessons),...arr(state.data.dashboard?.today),...arr(state.data.campusHub?.lessons)];
  return rows.find(item=>String(item.baseLessonId||item.id)===String(id)&&(item.originalDate||item.date)===originalDate&&item.date===date)||rows.find(item=>String(item.baseLessonId||item.id)===String(id)&&(item.originalDate||item.date)===originalDate);
}
function renderCalendarModal(modal) {
  if(modal.type==='calendar-restore') {
    const lesson=modal.lesson,e=lesson.exception||{};
    return extModalShell('Восстановить исходную пару?','Это действие относится только к выбранной календарной дате.',`<form id="calendar-restore-form"><div class="calendar-summary"><strong>${esc(lesson.subject)}</strong><span>${esc(lesson.group||lesson.groupId)} · ${esc(dateFmt(e.originalDate||lesson.originalDate))}</span><p>Отмена или перенос будут сняты. На эту дату снова будет действовать недельный шаблон. Если слот занят, система остановит восстановление.</p></div>${extModalActions('Восстановить пару')}</form>`,'Расписание по датам');
  }
  if(modal.type!=='calendar-exception')return '';
  const lesson=modal.lesson,e=lesson.exception||{},action=e.action||'change',teachers=arr(state.data.schedule?.teachers);
  const original=e.originalDate||lesson.originalDate||lesson.date;
  const teacherId=e.teacherId||lesson.teacherId||'',teacher=e.teacher||lesson.teacher||'';
  return extModalShell('Изменить одну пару','Остальные недели и недельный шаблон останутся прежними.',`<form id="calendar-exception-form"><div class="calendar-summary"><strong>${esc(lesson.subject)}</strong><span>${esc(lesson.group||lesson.groupId)} · исходная дата ${esc(dateFmt(original,{weekday:'long',day:'numeric',month:'long'}))}</span></div><div class="field"><label for="calendar-action">Что изменить</label><select id="calendar-action" name="action"><option value="change" ${action==='change'?'selected':''}>${state.user.role==='teacher'?'Время, аудиторию или дату':'Время, аудиторию, преподавателя или дату'}</option><option value="cancel" ${action==='cancel'?'selected':''}>Отменить эту пару</option></select></div><div class="calendar-change-fields" ${action==='cancel'?'hidden':''}><div class="field"><label for="calendar-target-date">Дата занятия</label><input id="calendar-target-date" name="targetDate" type="date" value="${esc(e.targetDate||original)}" required ${action==='cancel'?'disabled':''}></div><div class="ext-form-grid"><div class="field"><label for="calendar-start">Начало</label><input id="calendar-start" name="startTime" type="time" value="${esc(e.startTime||lesson.startTime)}" required ${action==='cancel'?'disabled':''}></div><div class="field"><label for="calendar-end">Конец</label><input id="calendar-end" name="endTime" type="time" value="${esc(e.endTime||lesson.endTime)}" required ${action==='cancel'?'disabled':''}></div></div><div class="field"><label for="calendar-room">Аудитория</label><input id="calendar-room" name="room" value="${esc(e.room||lesson.room)}" maxlength="80" required ${action==='cancel'?'disabled':''}></div><div class="field"><label for="calendar-teacher">Преподаватель</label><select id="calendar-teacher" name="teacherId" ${state.user.role==='teacher'?'disabled':''} ${action==='cancel'?'disabled':''}><option value="">Другой преподаватель — указать имя</option>${teachers.map(item=>`<option value="${esc(item.id)}" ${String(item.id)===String(teacherId)?'selected':''}>${esc(item.name)}</option>`).join('')}</select></div><div class="field"><label for="calendar-teacher-name">Имя преподавателя</label><input id="calendar-teacher-name" name="teacher" value="${esc(teacher)}" maxlength="120" ${teacherId?'readonly':''} required ${action==='cancel'?'disabled':''}></div></div><div class="field"><label for="calendar-note">Комментарий для студентов</label><input id="calendar-note" name="note" maxlength="300" value="${esc(e.note||'')}" placeholder="Например, консультация в другой аудитории"></div><div class="calendar-date-note">${icon('info','icon-sm')}<span>Изменение сохранится только для исходной даты ${esc(dateFmt(original))}. Для переноса укажите новую календарную дату.</span></div><div class="modal-actions">${e.id?`<button type="button" class="btn btn-ghost" data-calendar-restore>Восстановить исходную пару</button>`:'<button type="button" class="btn btn-ghost" data-action="modal-close">Отмена</button>'}<button type="submit" class="btn btn-primary">Сохранить эту пару ${icon('check','icon-sm')}</button></div></form>`,'Расписание по датам');
}
async function calendarClick(event) {
  const go=event.target.closest('[data-calendar-go]');
  if(go){event.preventDefault();state.view='schedule';state.scheduleMode='day';state.modal=null;await selectScheduleDate(go.dataset.calendarGo);return true;}
  const edit=event.target.closest('[data-calendar-edit]');
  if(edit){event.preventDefault();if(!['admin','teacher'].includes(state.user?.role)){toast('Недостаточно прав для изменения расписания.',true);return true;}const lesson=calendarVisibleLesson(edit.dataset.calendarEdit,edit.dataset.calendarOriginal,edit.dataset.calendarDate);if(!lesson){toast('Обновите расписание и попробуйте ещё раз.',true);return true;}if(!arr(state.data.schedule?.teachers).length)await loadData(['schedule']);state.modal={type:'calendar-exception',lesson};render();return true;}
  const restore=event.target.closest('[data-calendar-restore]');
  if(restore){event.preventDefault();if(['admin','teacher'].includes(state.user?.role)&&state.modal?.lesson?.exceptionId){state.modal={type:'calendar-restore',lesson:state.modal.lesson};render();}return true;}
  return false;
}
async function calendarChange(event) {
  if(event.target.id==='calendar-action') {
    const fields=root.querySelector('.calendar-change-fields'),cancel=event.target.value==='cancel';
    if(fields){fields.hidden=cancel;fields.querySelectorAll('input,select').forEach(input=>input.disabled=cancel);}
    return true;
  }
  if(event.target.id==='calendar-teacher') {
    const teacher=arr(state.data.schedule?.teachers).find(item=>item.id===event.target.value),input=root.querySelector('#calendar-teacher-name');
    if(input){input.readOnly=Boolean(teacher);input.value=teacher?.name||'';}return true;
  }
  return false;
}
async function calendarSubmit(form,values) {
  if(!['calendar-exception-form','calendar-restore-form'].includes(form.id))return false;
  if(!['admin','teacher'].includes(state.user?.role))throw new Error('Недостаточно прав для изменения расписания.');
  const lesson=state.modal?.lesson,e=lesson?.exception;
  if(!lesson)throw new Error('Занятие не найдено.');
  if(form.id==='calendar-restore-form') {
    await api('/api/schedule-exceptions/'+encodeURIComponent(lesson.exceptionId),'DELETE',{});
    toast('Исходная пара восстановлена только на эту дату.');
  } else {
    const data={...values,lessonId:lesson.baseLessonId||lesson.id,originalDate:e?.originalDate||lesson.originalDate||lesson.date};
    if(state.user.role==='teacher')data.teacherId=state.user.id;
    await api(e?.id?'/api/schedule-exceptions/'+encodeURIComponent(e.id):'/api/schedule-exceptions',e?.id?'PATCH':'POST',data);
    toast(values.action==='cancel'?'Пара отменена только на эту дату.':'Сохранено изменение одной пары.');
  }
  await loadData(['schedule','dashboard']);
  return true;
}

// Publications and the subject library, injected into the application closure.
let activePublicationDraft=null;
function discardDraftFile(id) {
  return fetch('/api/uploads/'+encodeURIComponent(id),{method:'DELETE',credentials:'same-origin',keepalive:true}).catch(()=>{});
}
function syncPublicationDraft() {
  const current=['news','club-post'].includes(state.modal?.type)?state.modal:null;
  if(activePublicationDraft&&activePublicationDraft!==current&&!activePublicationDraft.published) {
    for(const file of arr(activePublicationDraft.attachments)) void discardDraftFile(file.id);
  }
  activePublicationDraft=current;
}
function fileSize(size) {
  return Number(size) >= 1048576 ? `${(Number(size)/1048576).toFixed(1)} МБ` : `${Math.max(1,Math.round(Number(size)/1024))} КБ`;
}
function attachmentList() { return arr(state.modal?.attachments); }
function renderAttachmentComposer() {
  if (state.modal && !state.modal.attachments) state.modal.attachments = [];
  return `<section class="publication-uploads"><div class="publication-uploads-head"><strong>Изображения и документы</strong><span>До 4 файлов · до 5 МБ каждый</span></div><label class="btn btn-ghost publication-upload-button">${icon('plus','icon-sm')} Прикрепить файлы<input class="sr-only" type="file" id="publication-file" data-publication-files multiple accept=".png,.jpg,.jpeg,.webp,.pdf,.txt,.docx,.xlsx,.pptx" aria-label="Прикрепить файлы"></label><div id="publication-attachments" aria-live="polite">${renderAttachmentDrafts()}</div><p class="publication-upload-hint">Фото: PNG, JPG, WebP. Документы: PDF, TXT, Word, Excel и PowerPoint.</p></section>`;
}
function renderAttachmentDrafts() {
  return `${state.modal?.uploading ? `<div class="publication-upload-progress">${icon('clock','icon-sm')} Обрабатываем вложения…</div>` : ''}${attachmentList().map(file=>`<div class="publication-draft-file">${file.kind==='image'?`<img src="${esc(file.url)}" alt="" loading="lazy">`:`<span class="publication-file-icon">${icon('file')}</span>`}<span><strong>${esc(file.name)}</strong><small>${esc(fileSize(file.size))}</small></span><button class="icon-btn" type="button" data-remove-attachment="${esc(file.id)}" aria-label="Убрать файл ${esc(file.name)}">${icon('close','icon-sm')}</button></div>`).join('')}`;
}
function updateAttachmentDrafts() {
  const container=root.querySelector('#publication-attachments');
  if (container) container.innerHTML=renderAttachmentDrafts();
  const input=root.querySelector('[data-publication-files]');
  if(input) input.disabled=Boolean(state.modal?.uploading)||state.busy||attachmentList().length>=4;
  root.querySelectorAll('.modal button[type="submit"]').forEach(button=>button.disabled=Boolean(state.modal?.uploading)||state.busy);
}
function renderAttachmentMedia(files) {
  const images=arr(files).filter(file=>file.kind==='image');
  const documents=arr(files).filter(file=>file.kind!=='image');
  return `${images.length?`<div class="publication-images publication-images-${images.length}">${images.map(file=>`<button type="button" data-attachment-preview="${esc(file.id)}" aria-label="Открыть изображение ${esc(file.name)}"><img src="${esc(file.url)}" alt="${esc(file.name)}" loading="lazy"></button>`).join('')}</div>`:''}${documents.length?`<div class="publication-documents">${documents.map(file=>`<a class="publication-document" href="${esc(file.url)}" download="${esc(file.name)}"><span class="publication-file-icon">${icon('file')}</span><span><strong>${esc(file.name)}</strong><small>${esc(fileSize(file.size))} · Скачать</small></span>${icon('down','icon-sm')}</a>`).join('')}</div>`:''}`;
}
function allVisibleAttachments() {
  return [...arr(state.data.news).flatMap(item=>arr(item.attachments)),...arr(state.data.clubDetail?.posts).flatMap(item=>arr(item.attachments)),...attachmentList()];
}
function renderNewsFeed() {
  const news=arr(state.data.news);
  return `${pageHeader('В курсе событий','Новости и объявления','Информация для вашей группы и всего университета.',isStaff()?`<button class="btn btn-primary" data-action="new-news">${icon('plus')} Опубликовать</button>`:'')}${news.length?`<div class="publication-feed">${news.map(item=>`<article class="card publication-card"><div class="news-card-header">${newsTag(item)}<time>${esc(dateFmt(item.createdAt,{day:'numeric',month:'short',year:'numeric'}))}</time></div><h2>${item.pinned?icon('pin','icon-sm'):''}${esc(item.title)}</h2><p class="publication-body">${esc(item.body)}</p>${renderAttachmentMedia(item.attachments)}${publicationManageActions(item,'news')}<div class="publication-author"><span class="avatar">${esc(initials(item.author))}</span><span>${personButton(item.authorId,item.author||'Университет',item.authorRole)}<small>${esc(roleName(item.authorRole))}</small></span></div></article>`).join('')}</div>`:emptyState('Публикаций пока нет','Объявления преподавателей и администрации появятся здесь.','news')}`;
}
function renderNewsComposer() {
  const groups=arr(state.data.staff?.groups);
  return extModalShell('Новое объявление','Выберите аудиторию и добавьте полезные подробности.',`<form id="news-form"><div class="field"><label for="news-title">Заголовок</label><input id="news-title" name="title" maxlength="140" required placeholder="Например, консультация по проектам"></div><div class="field"><label for="news-body">Текст объявления</label><textarea id="news-body" name="body" maxlength="4000" required placeholder="Что произойдёт, когда и что нужно сделать"></textarea></div><div class="ext-form-grid"><div class="field"><label for="news-scope">Кому показать</label><select id="news-scope" name="scope">${state.user.role==='admin'?'<option value="all">Всем в университете</option>':''}<option value="group">Конкретной группе</option></select></div><div class="field" id="news-group-field" ${state.user.role==='admin'?'hidden':''}><label for="news-group">Учебная группа</label><select id="news-group" name="groupId">${options(groups,null,item=>item.name)}</select></div></div><div class="field"><label for="news-deadline">Важная дата (необязательно)</label><input id="news-deadline" name="deadline" type="date"><small class="muted">Появится в ближайших датах и напоминаниях.</small></div>${renderAttachmentComposer()}${extModalActions('Опубликовать')}</form>`,'Публикация');
}
function renderMaterials() {
  const subjects=arr(state.data.resources);
  const selected=subjects.find(item=>item.name===state.resourceSubject)||subjects[0];
  const selectedKind=state.resourceKind||'all';
  const selectedAuthor=state.resourceAuthor||'';
  const all=arr(selected?.resources);
  const authors=[...new Map(all.filter(item=>item.kind==='teacher'&&item.authorId).map(item=>[item.authorId,{id:item.authorId,name:item.author}])).values()];
  const materials=all.filter(item=>(selectedKind==='all'||item.kind===selectedKind)&&(!selectedAuthor||item.authorId===selectedAuthor));
  const publish=state.data.resourceMeta?.canPublish?`<button class="btn btn-primary" data-content-action="new-resource">${icon('plus')} Добавить материал</button>`:'';
  return `${pageHeader('Библиотека знаний','Справочные материалы','Общие пособия и материалы ваших преподавателей — отдельно по каждому предмету.',publish)}${subjects.length?`<div class="material-layout"><nav class="card material-subjects" aria-label="Предметы справочника"><div class="material-nav-caption">Предметы <span>${subjects.length}</span></div>${subjects.map(subject=>`<button class="material-subject ${subject===selected?'active':''}" data-material-subject="${esc(subject.name)}" ${subject===selected?'aria-current="true"':''}><span class="material-subject-icon">${icon('grades')}</span><span>${esc(subject.name)}</span><small>${arr(subject.resources).length}</small></button>`).join('')}</nav><section class="material-main"><div class="material-subject-header"><span class="material-heading-icon">${icon('grades','icon-lg')}</span><div><h2>${esc(selected.name)}</h2><p>${quantity(all.length,['материал','материала','материалов'])} для самостоятельной работы</p></div></div><div class="card material-filters"><div class="tabs" aria-label="Источник материалов">${[['all','Все материалы'],['general','Общие пособия'],['teacher','От преподавателей']].map(([key,label])=>`<button class="tab ${selectedKind===key?'active':''}" data-material-kind="${key}">${label}</button>`).join('')}</div>${authors.length&&selectedKind!=='general'?`<div class="field"><label for="material-author">Преподаватель</label><select id="material-author"><option value="">Все преподаватели</option>${authors.map(author=>`<option value="${esc(author.id)}" ${author.id===selectedAuthor?'selected':''}>${esc(author.name)}</option>`).join('')}</select></div>`:''}</div>${materials.length?`<div class="material-grid">${materials.map(resource=>`<article class="card material-card"><div class="material-card-top"><span class="resource-icon">${icon(resource.kind==='teacher'?'grades':'file')}</span><span class="tag">${esc(resource.type||'Пособие')}</span></div><span class="material-source-label">${resource.kind==='teacher'?'Материал преподавателя':'Общее пособие'}</span><h3>${esc(resource.title)}</h3><p>${esc(resource.description||'Материал для самостоятельной работы по предмету.')}</p><div class="material-byline">${resource.kind==='teacher'?`${personButton(resource.authorId,resource.author||'Преподаватель','teacher')}<small>Публикация преподавателя</small>`:`<span>${icon('grades','icon-sm')} Учебный справочник</span><small>Для изучения предмета</small>`}</div><button class="btn btn-light material-open" data-resource="${esc(resource.id)}">Открыть материал ${icon('arrow','icon-sm')}</button>${publicationManageActions(resource,'resource')}</article>`).join('')}</div>`:`<div class="card card-pad">${emptyState('В этом разделе пока нет материалов','Выберите другой источник или преподавателя.','folder')}<button class="btn btn-ghost" data-content-action="reset-materials">Сбросить фильтры</button></div>`}</section></div>`:emptyState('Материалы готовятся','Пособия появятся после публикации.','folder')}`;
}
function resourceFormSubjects(groupId) {
  const meta=state.data.resourceMeta||{};
  return [...new Set(arr(meta.options).filter(item=>!groupId||item.groupId===groupId).map(item=>item.subject))];
}
function renderResourceComposer() {
  const meta=state.data.resourceMeta||{};
  const groups=arr(meta.groups);
  const admin=state.user.role==='admin';
  const selectedGroup=admin?'':groups[0]?.id||arr(meta.options)[0]?.groupId||'';
  const subjects=resourceFormSubjects(selectedGroup);
  return extModalShell('Новый учебный материал','Общее пособие или авторская публикация по вашему предмету.',`<form id="material-form"><div class="ext-form-grid"><div class="field"><label for="material-group">Для группы</label><select id="material-group" name="groupId">${admin?'<option value="">Все подходящие группы</option>':''}${groups.map(group=>`<option value="${esc(group.id)}" ${group.id===selectedGroup?'selected':''}>${esc(group.name)}</option>`).join('')}</select></div><div class="field"><label for="material-subject">Предмет</label><select id="material-subject" name="subject" required>${subjects.map(subject=>`<option ${subject===state.resourceSubject?'selected':''}>${esc(subject)}</option>`).join('')}</select></div></div><div class="ext-form-grid"><div class="field"><label for="material-kind">Источник</label><select id="material-kind" name="kind"><option value="${admin?'general':'teacher'}">${admin?'Общее пособие по предмету':'Материал преподавателя'}</option></select></div><div class="field"><label for="material-type">Формат</label><select id="material-type" name="type"><option>Конспект</option><option>Пособие</option><option>Практикум</option><option>Справочник</option></select></div></div><div class="field"><label for="material-title">Название материала</label><input id="material-title" name="title" maxlength="140" required></div><div class="field"><label for="material-description">Краткое описание</label><input id="material-description" name="description" maxlength="400" required placeholder="Чем поможет материал"></div><div class="field"><label for="material-body">Содержание</label><textarea id="material-body" name="body" maxlength="8000" required placeholder="Конспект, инструкция или справочная информация"></textarea></div><div class="settings-note">${icon('info')}<span>${admin?'Общее пособие будет показано отдельно от авторских материалов преподавателей.':'Ваше имя появится на карточке. Материал увидит выбранная учебная группа.'}</span></div>${extModalActions('Опубликовать материал')}</form>`,'Справочные материалы');
}
function renderContentModal(modal) {
  if(modal.type==='material-new')return renderResourceComposer();
  if(modal.type==='attachment-image') {
    const file=modal.file;
    return extModalShell(file.name,'Изображение из публикации.',`<figure class="publication-image-view"><img src="${esc(file.url)}" alt="${esc(file.name)}"></figure><div class="modal-actions"><a class="btn btn-light" href="${esc(file.url)}" download="${esc(file.name)}">${icon('down')} Скачать</a><button class="btn btn-primary" data-action="modal-close">Закрыть</button></div>`,'Вложение');
  }
  return '';
}
async function contentClick(event) {
  const preview=event.target.closest('[data-attachment-preview]');
  if(preview){const file=allVisibleAttachments().find(item=>item.id===preview.dataset.attachmentPreview);if(file){state.modal={type:'attachment-image',file};render();}return true;}
  const remove=event.target.closest('[data-remove-attachment]');
  if(remove){if(state.busy||state.modal?.uploading)return true;const id=remove.dataset.removeAttachment,modal=state.modal;modal.uploading=true;updateAttachmentDrafts();try{await api('/api/uploads/'+encodeURIComponent(id),'DELETE');if(state.modal===modal)modal.attachments=attachmentList().filter(file=>file.id!==id);}catch(error){toast(error.message,true);}finally{modal.uploading=false;if(state.modal===modal)updateAttachmentDrafts();}return true;}
  const subject=event.target.closest('[data-material-subject]');
  if(subject){state.resourceSubject=subject.dataset.materialSubject;state.resourceAuthor='';render();return true;}
  const kind=event.target.closest('[data-material-kind]');
  if(kind){state.resourceKind=kind.dataset.materialKind;state.resourceAuthor='';render();return true;}
  const action=event.target.closest('[data-content-action]');
  if(!action)return false;
  if(action.dataset.contentAction==='new-resource'){state.modal={type:'material-new'};render();return true;}
  if(action.dataset.contentAction==='reset-materials'){state.resourceAuthor='';state.resourceKind='all';render();return true;}
  return false;
}
async function contentChange(event) {
  if(event.target.matches('[data-publication-files]')) {
    const modal=state.modal;
    if(!modal||modal.uploading||state.busy)return true;
    const files=Array.from(event.target.files||[]);
    if(files.length+attachmentList().length>4){toast('В публикации может быть не больше четырёх файлов.',true);event.target.value='';return true;}
    modal.uploading=true;updateAttachmentDrafts();
    try {
      for(const file of files){
        if(file.size>5*1024*1024)throw new Error('Файл «'+file.name+'» превышает 5 МБ.');
        if(attachmentList().reduce((sum,item)=>sum+item.size,0)+file.size>12*1024*1024)throw new Error('Общий размер вложений не должен превышать 12 МБ.');
        const body=new FormData();body.append('file',file);
        const response=await fetch('/api/uploads',{method:'POST',credentials:'same-origin',body});
        const result=await response.json().catch(()=>({}));
        if(!response.ok)throw new Error(result.error||'Не удалось загрузить файл.');
        if(state.modal!==modal){void discardDraftFile(result.file.id);break;}
        modal.attachments.push(result.file);updateAttachmentDrafts();
      }
    }catch(error){toast(error.message,true);}finally{modal.uploading=false;if(state.modal===modal){event.target.value='';updateAttachmentDrafts();}}
    return true;
  }
  if(event.target.id==='material-author'){state.resourceAuthor=event.target.value;render();return true;}
  if(event.target.id==='material-group'){
    const select=root.querySelector('#material-subject'),value=select?.value;
    if(select)select.innerHTML=resourceFormSubjects(event.target.value).map(subject=>`<option ${subject===value?'selected':''}>${esc(subject)}</option>`).join('');
    return true;
  }
  return false;
}
async function contentSubmit(form,values) {
  if(form.id!=='material-form')return false;
  await api('/api/resources','POST',{...values,groupId:values.groupId||null});
  state.resourceSubject=values.subject;state.resourceKind=values.kind;state.resourceAuthor='';
  await loadData(['resources']);state.view='resources';state.modal=null;render();toast('Учебный материал опубликован.');return true;
}

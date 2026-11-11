// Short-lived memory cache. Personal responses are never written to browser storage.
const perfResponses=new Map(),perfInFlight=new Map(),perfDataSlots=new Map(),perfLoadSequence=new Map();
let perfContextVersion=0,perfNavigationSequence=0,perfCacheRevision=0;
function perfScope(){return state.user?[state.user.id,state.user.role,state.user.groupId,state.user.tag].join('|'):'';}
function perfResetContext(){perfContextVersion++;perfNavigationSequence++;perfResponses.clear();perfInFlight.clear();perfDataSlots.clear();perfLoadSequence.clear();}
function perfDataUrls(){return{
  dashboard:'/api/dashboard',schedule:`/api/schedule?week=${state.weekOffset}${state.teacherId?'&teacherId='+encodeURIComponent(state.teacherId):''}`,
  plannerSchedule:'/api/schedule?week=0&template=1',grades:'/api/grades',requests:'/api/requests',news:'/api/news',chats:'/api/chats',resources:'/api/resources',
  notifications:'/api/notifications',management:'/api/admin/people',archive:'/api/publication-archive',clubs:'/api/clubs',group:'/api/group',staff:'/api/staff',
  campusOverview:'/api/campus/overview',campusPlan:'/api/campus/plan',campusEvents:'/api/campus/events',campusConsultations:'/api/campus/consultations',campusMap:'/api/campus/map',campusHub:'/api/campus/subject?subject='+encodeURIComponent(state.campusSubject||'')+'&groupId='+encodeURIComponent(state.campusGroup||''),
  homework:'/api/homework?'+homeworkRange(),services:'/api/student-services',clubDetail:'/api/clubs/'+encodeURIComponent(state.clubId||''),
};}
async function perfRequest(path,method='GET',body,{cacheMs=0}={}){
  const context=perfContextVersion,scope=perfScope(),revision=perfCacheRevision,key=context+'|'+scope+'|'+path;
  const cacheAllowed=!path.startsWith('/api/campus/')&&!/^\/api\/(?:chats|notifications)(?:\?|$)/.test(path);
  if(method==='GET'){
    const cached=perfResponses.get(key);if(cacheAllowed&&cacheMs&&cached&&Date.now()-cached.time<cacheMs)return structuredClone(cached.value);
    if(perfInFlight.has(key))return structuredClone(await perfInFlight.get(key));
  }else if(!/\/read(?:-all)?$/.test(path)){perfCacheRevision++;perfResponses.clear();perfInFlight.clear();}
  const operation=(async()=>{
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
    try{
      const response=await fetch(path,{method,credentials:'same-origin',signal:controller.signal,headers:body===undefined?{}:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
      const result=await response.json().catch(()=>({}));
      if(!response.ok){const error=new Error(result.error||result.message||`Ошибка ${response.status}`);error.status=response.status;throw error;}
      if(context!==perfContextVersion||scope!==perfScope()){const error=new Error('Аккаунт изменился. Ответ предыдущего запроса пропущен.');error.contextChanged=true;throw error;}
      if(cacheAllowed&&method==='GET'&&context===perfContextVersion&&scope===perfScope()&&revision===perfCacheRevision)perfResponses.set(key,{value:result,time:Date.now()});
      return result;
    }catch(error){if(error.name==='AbortError')throw new Error('Сервер отвечает дольше обычного. Повторите загрузку.');throw error;}
    finally{clearTimeout(timer);}
  })();
  if(method==='GET')perfInFlight.set(key,operation);
  try{return structuredClone(await operation);}finally{if(perfInFlight.get(key)===operation)perfInFlight.delete(key);}
}
function perfHasViewData(view){const urls=perfDataUrls();return viewDataKeys(view).every(key=>Object.hasOwn(state.data,key)&&(!perfDataSlots.has(key)||perfDataSlots.get(key)===urls[key]));}
async function navigateView(value,{scroll=true,force=false}={}){
  if(!state.user)return;
  const target=routeView(value);state.view=target;state.menu=false;state.modal=null;state.routeError='';
  const route=currentRoute(),sequence=++perfNavigationSequence,context=perfContextVersion;
  state.routeLoading=perfHasViewData(target)?null:route;render();if(scroll)window.scrollTo({top:0});
  const keys=viewDataKeys(target);if(!keys.length)return;
  await loadData(keys,{cache:!force});
  if(context!==perfContextVersion||sequence!==perfNavigationSequence||currentRoute()!==route)return;
  state.routeLoading=null;
  const failures=keys.filter(key=>state.dataErrors?.[key]);if(failures.length)state.routeError=state.dataErrors[failures[0]];
  render();
}
function perfRenderPending(){
  if(state.routeLoading===currentRoute())return `${pageHeader('Ваше пространство',esc(viewTitle()),'Загружаем актуальные данные…')}<div class="card perf-loading" role="status"><span class="perf-spinner" aria-hidden="true"></span><strong>Открываем раздел</strong><p>Можно продолжать пользоваться меню.</p></div>`;
  if(state.routeError&&!perfHasViewData(state.view))return `${pageHeader('Ваше пространство',esc(viewTitle()),'Не удалось получить данные.')}<div class="card perf-loading" role="alert"><p>${esc(state.routeError)}</p><button class="btn btn-primary" data-perf-retry>Повторить загрузку</button></div>`;
  return '';
}

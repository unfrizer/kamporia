import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';
const source=readFileSync('ui/performance.js','utf8'),app=readFileSync('ui/app.js','utf8');
let calls=0,resolvers=[],mode='normal',renders=0,checks=0;
const state={user:{id:'u1',role:'student',groupId:'g1',tag:'Староста'},view:'home',data:{},weekOffset:0,teacherId:'',clubId:''};
const context=vm.createContext({state,Map,Set,Promise,structuredClone,AbortController,setTimeout,clearTimeout,Date,Object,encodeURIComponent,
  fetch:async(path,options)=>{calls++;if(mode==='delay')return new Promise(resolve=>resolvers.push(resolve));return{ok:true,json:async()=>({path,method:options.method,owner:state.user?.id,news:[{title:'Saved'}]})};},
  normalized:{news:x=>x.news},window:{scrollTo(){}},homeworkRange:()=>'',render:()=>{renders++;},routeView:x=>x,currentRoute:()=>state.view,
  viewDataKeys:x=>x==='news'?['news']:[],viewTitle:()=>state.view,esc:x=>String(x),pageHeader:()=>'',
});
const loader=app.slice(app.indexOf('  async function api('),app.indexOf('  function currentRoute()'));
vm.runInContext(source+'\n'+loader+'\nthis.t={perfRequest,perfResetContext,perfResponses,perfInFlight,navigateView,loadData,perfRenderPending};',context);const t=context.t;
const ok=(value,label)=>{assert.ok(value,label);checks++;};
const value=await t.perfRequest('/api/news','GET',undefined,{cacheMs:15000});value.news[0].title='Local mutation';
const cached=await t.perfRequest('/api/news','GET',undefined,{cacheMs:15000});ok(calls===1,'fresh cache avoids duplicate network request');ok(cached.news[0].title==='Saved','cache values do not share mutable view objects');
await t.perfRequest('/api/news','PATCH',{title:'changed'});await t.perfRequest('/api/news','GET',undefined,{cacheMs:15000});ok(calls===3,'mutation invalidates read cache');
mode='delay';t.perfResetContext();let a=t.perfRequest('/api/news'),b=t.perfRequest('/api/news');ok(resolvers.length===1,'concurrent identical reads share one request');resolvers.shift()({ok:true,json:async()=>({news:[]})});await Promise.all([a,b]);
mode='normal';t.perfResetContext();state.data={};state.dataErrors={};let n=calls;await t.navigateView('news');ok(state.view==='news'&&state.data.news[0].title==='Saved','first section visit loads its data');await t.navigateView('home');await t.navigateView('news');ok(calls===n+1,'repeat navigation uses fresh memory cache');
mode='delay';t.perfResetContext();state.data={};const first=t.navigateView('news');ok(state.view==='news'&&state.routeLoading==='news'&&t.perfRenderPending().includes('Открываем раздел'),'section changes before slow data arrives');await t.navigateView('home');resolvers.shift()({ok:true,json:async()=>({news:[{title:'late news'}]})});await first;ok(state.view==='home','late navigation cannot change current section');
t.perfResetContext();state.data={};const old=t.loadData(['news']);state.user={id:'u2',role:'student',groupId:'g2',tag:'Студент'};t.perfResetContext();state.data={};resolvers.shift()({ok:true,json:async()=>({news:[{title:'u1 private'}]})});await old;ok(!state.data.news&&t.perfResponses.size===0,'response from previous account is not displayed or cached');
mode='normal';await t.loadData(['news'],{cache:true});ok(state.data.news[0].title==='Saved','new account loads its own data');
mode='delay';t.perfResetContext();state.data={};state.dataErrors={};const bad=t.navigateView('news');resolvers.shift()({ok:false,status:503,json:async()=>({error:'Temporarily unavailable'})});await bad;ok(t.perfRenderPending().includes('Повторить загрузку'),'failed uncached section offers retry instead of false empty content');
mode='normal';await t.navigateView('news',{force:true});ok(state.data.news[0].title==='Saved'&&!state.routeError,'retry recovers section');
console.log('PASS: '+checks+' client cache/navigation checks');

for(const path of ['/api/chats','/api/notifications']){const before=calls;await t.perfRequest(path,'GET',undefined,{cacheMs:15000});await t.perfRequest(path,'GET',undefined,{cacheMs:15000});ok(calls===before+2,'live chat and read state never restore stale cached snapshots');}
console.log('PASS: '+checks+' total performance checks, including live-state exclusions');
mode='delay';t.perfResetContext();const direct=t.perfRequest('/api/homework');state.user={id:'u3',role:'student',groupId:'g3',tag:'Студент'};t.perfResetContext();resolvers.shift()({ok:true,json:async()=>({assignments:[{body:'previous account'}]})});await assert.rejects(direct,error=>error.contextChanged===true);checks++;console.log('PASS: '+checks+' total performance and account-context checks');

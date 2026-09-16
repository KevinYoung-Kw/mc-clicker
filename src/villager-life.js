import {advanceMenu,menuEffects,restoreMenu,menuBudget,menuState,recipeCost} from './life-menu.js';
import {advanceContract,welfarePerMinute,serviceQuote,restoreContract} from './service-economy.js';
import {advanceFood,takeMeal,foodParts,restoreFood,foodSnapshot,foodCapacity} from './food-service.js';
import {civicObjects} from './civic-data.js';
import {activeLevel as level} from './facility-storage.js';

// Simulation state, not a UI timer. Daily rest never uses legacy reserve slots.
export const LIFE_SERVICES = {
  V21: {name:'街心小园', action:'坐一会儿', slots:2, kind:'leisure', comfort:4, icon:'leaf'},
  V22: {name:'村庄酒馆', action:'和邻居聊聊天', slots:2, kind:'leisure', comfort:6, icon:'home'},
  V23: {name:'活动馆', action:'玩一局棋', slots:4, kind:'leisure', comfort:8, icon:'cube'},
  V25: {name:'村庄食堂', action:'吃口热饭', slots:3, kind:'food', comfort:6, icon:'bowl'},
};
export const serviceCapacity=(s,id)=>Math.min(6,(LIFE_SERVICES[id]?.slots||0)*level(s,id));
export const serviceRange=(s,id)=>2+Math.min(3,level(s,id));
export const WELFARE = {
  off: {name:'基础服务', perMinute:0, happiness:0},
  simple: {name:'茶点', perMinute:1, happiness:5},
  generous: {name:'茶点与活动', perMinute:2.5, happiness:10},
};
export function freshLife(){return {version:3,serviceMode:'current',sites:[],siteSerial:0,residents:{},welfare:'off',spent:0,lastExpense:0,rests:0,returns:0,visits:0,lastPerformance:null,revision:0};}
const finite=(v,max=1e100)=>Number.isFinite(v)?Math.max(0,Math.min(max,v)):0;
const hash=id=>{let n=[...String(id)].reduce((n,c)=>Math.imul(n^c.charCodeAt(0),16777619)>>>0,2166136261);n=Math.imul(n^(n>>>16),2246822507);return (n^(n>>>13))>>>0;};
export function residentLife(s,r){
  if(!s.life)return null;
  return s.life.residents[r.id] ||= {phase:'work',worked:hash(r.id)%(restCycle(s,r)-60),remaining:0,trip:0,breaks:0,service:null,visited:{},visitLevels:{},happiness:50};
}
export const isResting=(s,r)=>!!s.life?.residents?.[r.id]&&s.life.residents[r.id].phase!=='work';
export function restCycle(s,r){return 180+hash(r.id)%31;}
export const serviceNodes=s=>[
 ...Object.keys(LIFE_SERVICES).filter(id=>level(s,id)&&s.placements?.[id]).map(id=>({id,type:id,...s.placements[id]})),
 ...civicObjects(s).filter(p=>LIFE_SERVICES[p.type]&&level(s,p.type)),
];
export const serviceNode=(s,id)=>serviceNodes(s).find(p=>p.id===id);
export const serviceType=(s,id)=>LIFE_SERVICES[id]?id:serviceNode(s,id)?.type;
export const happinessLabel=n=>n>=85?'心情很好':n>=65?'过得舒心':n>=50?'安稳生活':'需要照顾';
export function happinessParts(s,r){
 const a=s.life?.residents?.[r.id],parts={base:50,housing:s.housing?.assignments?.[r.id]?10:0,rest:0,food:0,leisure:0,welfare:WELFARE[s.life?.welfare]?.happiness||0};
 if(a){
  parts.rest=Math.max(0,15*(1-a.worked/restCycle(s,r)));
  for(const [id,at]of Object.entries(a.visited||{})){
   if(id==='V25'&&s.life.serviceMode!=='legacy')continue;
   if(!(level(s,id)>0||id==='L1'))continue;
   const freshness=Math.max(0,Math.min(1,(360-(s.play-at))/180));
   const spec=LIFE_SERVICES[id],comfort=(spec?.comfort||5)+2*Math.max(0,Math.min(3,a.visitLevels?.[id]||1)-1);
   if(spec?.kind==='food')parts.food+=comfort*freshness;
   else if(s.life.serviceMode==='legacy')parts.leisure+=comfort*freshness;
   else parts.leisure=Math.max(parts.leisure,comfort*freshness);
  }
 }
 // Idle villagers have leisure time already; they need no artificial work/rest cycle.
 if(r.job==='idle')parts.leisure=Math.max(parts.leisure,...serviceNodes(s).filter(p=>LIFE_SERVICES[p.type]?.kind==='leisure').map(p=>LIFE_SERVICES[p.type].comfort+2*Math.max(0,Math.min(3,level(s,p.type))-1)));
 const meal=foodParts(s,r);if(s.life?.serviceMode!=='legacy')parts.food=meal.food;parts.hunger=meal.hunger;
 parts.food=Math.min(10,parts.food);parts.leisure=Math.min(15,parts.leisure);
 parts.welfare=Math.min(12,parts.welfare+menuEffects(s,r).happiness);
 parts.total=Math.min(100,Object.values(parts).reduce((n,v)=>n+v,0));
 parts.factor=(1+Math.max(0,Math.min(100,parts.total-parts.hunger)-50)/50*(s.life?.serviceMode==='legacy'?.15:.25))*meal.work*menuEffects(s,r).work;
 return parts;
}
export const lifeHappiness=(s,r)=>happinessParts(s,r).total;
export const lifeWorkFactor=(s,r)=>happinessParts(s,r).factor;
export function cartFactor(s,r){
  if(r.job!=='hauler'||!level(s,'V24'))return 1;
  // Shared equipment slots; upgrades never recompute cargo already on its way.
  const workers=(s.community?.residents||[]).filter(p=>p.job==='hauler'&&!p.reserve).sort((a,b)=>String(a.id).localeCompare(String(b.id)));
  return workers.slice(0,Math.min(3,level(s,'V24')+1)).some(p=>p.id===r.id)?1.5:1;
}
export function setWelfare(s,id){
  if(!WELFARE[id])return {ok:false,reason:'请选择一种福利'};
  if(id!=='off'&&!level(s,'V22')&&!level(s,'V25'))return {ok:false,reason:'先建村庄食堂或酒馆'};
  if(id==='generous'&&!level(s,'V23'))return {ok:false,reason:'先建活动馆'};
  const bill=welfarePerMinute(s,id);
  if(id!=='off'&&s.money<bill)return {ok:false,reason:'至少留够一分钟的福利费用'};
  s.life.welfare=id;s.life.revision++;
  return {ok:true,text:id==='off'?'已暂停福利开支':'已开启'+WELFARE[id].name};
}
export function advanceLifeBudget(s,dt){
  if(!s.life||!(dt>0))return null;
  const spentBefore=s.life.spent;
  advanceContract(s,dt);
  if(s.life.serviceMode!=='legacy'){advanceMenu(s,dt);advanceFood(s,dt);}
  s.life.lastExpense=(s.life.spent-spentBefore)/dt;
  if(s.life.welfare!=='off'&&((!level(s,'V22')&&!level(s,'V25'))||(s.life.welfare==='generous'&&!level(s,'V23')))){s.life.welfare='off';s.life.revision++;return '福利设施已收起，暂停供给';}
  const cost=welfarePerMinute(s)*dt/60;
  if(!cost)return null;
  if(s.money+1e-9<cost){s.life.welfare='off';s.life.revision++;return '福利余额不足，已恢复基础服务';}
  s.money=Math.max(0,s.money-cost);s.life.spent+=cost;s.life.lastExpense=(s.life.spent-spentBefore)/dt;
  return null;
}
function serviceFor(s,r,a){
  if(r.room==='studio')return null;
  return serviceNodes(s).filter(p=>p.type!=='V25'||s.life.serviceMode==='legacy').filter(p=>
    Math.hypot(p.x-r.x,p.z-r.z)<=serviceRange(s,p.type)&&
    Object.values(s.life.residents).filter(a=>a.phase!=='work'&&a.service===p.id).length<serviceCapacity(s,p.type))
    .sort((x,y)=>(a.visited[x.type]??-1)-(a.visited[y.type]??-1)||Math.hypot(x.x-r.x,x.z-r.z)-Math.hypot(y.x-r.x,y.z-r.z))[0]?.id||null;
}
function occupiedTask(s,r){
  return Object.values(s.community?.tasks||{}).some(t=>t.work>0&&t.owners?.[r.id]>0);
}
// move(r, serviceId, dt, first) uses the existing collision-aware world routes.
// false means no reachable destination, null means en route, true means arrived.
export function advanceResidentLife(s,r,dt,{move=()=>false}={}){
  const a=residentLife(s,r);if(!a||r.reserve)return false;
  a.happiness=lifeHappiness(s,r);
  if(a.phase==='work'){
    if(r.job==='idle'){a.worked=Math.max(0,a.worked-dt*4);return false;}
    a.worked=Math.min(restCycle(s,r),a.worked+dt);
    if(a.worked<restCycle(s,r)||r.cargo||occupiedTask(s,r)||r.handover>0)return false;
    const staff=(s.community?.residents||[]).filter(p=>!p.reserve&&p.job!=='idle');
    const resting=staff.filter(p=>isResting(s,p));
    if(resting.length>=Math.max(1,Math.ceil(staff.length/4)))return false;
    const peers=staff.filter(p=>p.job===r.job);
    if(peers.length>1&&peers.filter(p=>!isResting(s,p)).length<=1)return false;
    // Keep partial production and the assigned job. Only the movement target changes.
    takeMeal(s,r);
    a.phase='going-rest';a.remaining=(foodParts(s,r).food>0?12:20)+menuEffects(s,r).rest;a.trip=0;a.service=serviceFor(s,r,a);
    a.breaks++;s.life.rests++;s.life.revision++;
    r.destination=null;r.path=[];r.workSpot=null;r.workTour=false;
    const reached=move(r,a.service,0,true);
    if(reached!==null){a.phase='rest';if(reached===false)a.service=null;}
  }
  a.remaining=Math.max(0,a.remaining-dt);
  if(a.phase==='going-rest'){
    a.trip+=dt;
    const reached=move(r,a.service,dt,false);
    if(reached!==null||a.trip>=6){if(reached!==true)a.service=null;a.phase='rest';r.destination=null;r.path=[];r.workSpot=null;}
  }
  r.activity=a.phase==='going-rest'?'travel':'rest';
  r.status=a.phase==='going-rest'?(a.service?'去'+(LIFE_SERVICES[serviceType(s,a.service)]?.name||'休息处'):'回家休息'):
    a.service?LIFE_SERVICES[serviceType(s,a.service)]?.action||'休息一会儿':r.room==='studio'?'在后台休息':'休息一会儿';
  if(a.remaining<=0){
    // Public recreation is village-wide. Attendance animation is optional,
    // so a distant home or a full set of seats never removes access.
    const leisure=serviceNodes(s).filter(p=>LIFE_SERVICES[p.type]?.kind==='leisure')
      .sort((x,y)=>(LIFE_SERVICES[y.type].comfort+2*(level(s,y.type)-1))-(LIFE_SERVICES[x.type].comfort+2*(level(s,x.type)-1)))[0];
    if(leisure){a.visited[leisure.type]=s.play;(a.visitLevels||={})[leisure.type]=level(s,leisure.type);s.life.visits++;}
    if(a.service&&a.phase==='rest'){const type=serviceType(s,a.service);if(type){a.visited[type]=s.play;(a.visitLevels||={})[type]=level(s,type);s.life.visits++;}}
    // A completed real performance supplies entertainment, independent of audio preferences.
    if(level(s,'L1')&&Number.isFinite(s.life.lastPerformance)&&s.play-s.life.lastPerformance<180)a.visited.L1=s.life.lastPerformance;
    a.phase='work';a.worked=0;a.service=null;a.trip=0;s.life.returns++;s.life.revision++;
    r.path=[];r.destination=null;r.workSpot=null;r.workTour=false;r.status='休息好了，回去上班';r.activity='travel';
  }
  return true;
}
export function lifeSnapshot(s){
  const people=(s.community?.residents||[]).filter(r=>!r.reserve);
  const resting=people.filter(r=>isResting(s,r)).length;
  const parts=people.map(r=>happinessParts(s,r)),sources=Object.fromEntries(['base','housing','rest','food','leisure','welfare','hunger'].map(k=>[k,people.length?parts.reduce((v,p)=>v+p[k],0)/people.length:k==='base'?50:0]));
  const bonuses=parts.map(p=>(p.factor-1)*100);
  return {sources,bonus:people.length?bonuses.reduce((a,b)=>a+b,0)/people.length:0,foodPeople:parts.filter(p=>p.food>0).length,leisurePeople:parts.filter(p=>p.leisure>0).length,housed:parts.filter(p=>p.housing>0).length,people:people.length,resting,working:people.filter(r=>r.job!=='idle'&&!isResting(s,r)).length,
    happiness:people.length?Math.round(people.reduce((v,r)=>v+lifeHappiness(s,r),0)/people.length):50,
    serviceContract:serviceQuote(s),food:foodSnapshot(s),perMinute:welfarePerMinute(s)+(s.life?.serviceMode==='legacy'?0:['drink','activity'].reduce((sum,kind)=>sum+menuBudget(s,kind,menuState(s).selected[kind]),0)+foodCapacity(s)*serviceQuote(s).food*recipeCost(s)),expense:s.life?.lastExpense||0,spent:s.life?.spent||0};
}
export function restoreLife(s,raw){
  s.life=freshLife();const old=raw?.life;
  if(old?.serviceMode==='legacy'||(!old?.serviceMode&&raw?.version>=2&&raw.version<=9))s.life.serviceMode='legacy';
  if(![1,2,3].includes(old?.version))return;
  restoreFood(s,raw);
  restoreContract(s,raw);
  if(Number.isFinite(old.lastPerformance))s.life.lastPerformance=Math.min(s.play,finite(old.lastPerformance));
  if(WELFARE[old.welfare])s.life.welfare=old.welfare;
  for(const key of ['spent','rests','returns','visits'])s.life[key]=finite(old[key]);
  for(const r of s.community?.residents||[]){
    const p=old.residents?.[r.id];if(!p||typeof p!=='object')continue;
    const a=residentLife(s,r);
    a.worked=finite(p.worked,restCycle(s,r));a.breaks=finite(p.breaks,1e9);
    a.phase=['rest','going-rest'].includes(p.phase)&&!r.reserve?'rest':'work';
    a.remaining=a.phase==='rest'?finite(p.remaining,20):0;
    a.service=p.phase==='rest'&&LIFE_SERVICES[p.service]&&level(s,p.service)?p.service:null;
    for(const id of [...Object.keys(LIFE_SERVICES),'L1'])if(Number.isFinite(p.visited?.[id])){a.visited[id]=Math.min(s.play,finite(p.visited[id]));a.visitLevels[id]=Math.max(1,Math.floor(finite(p.visitLevels?.[id]||1,3)));}
  }
  restoreMenu(s,raw);
}

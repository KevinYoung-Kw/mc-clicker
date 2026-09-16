// Mutually exclusive village services; charged from the foreground simulation.
import {activeLevel} from './facility-storage.js';
import {serviceQuote} from './service-economy.js';
export const LIFE_MENU = {
 meal: [
  {id:'home',name:'田园家常菜',owner:'V25',level:1,cost:1,comfort:8,work:1,rest:0,quality:0},
  {id:'mushroom',name:'菌菇炖汤',owner:'V25',level:2,cost:1.2,comfort:10,work:1,rest:1,quality:.03},
  {id:'roast',name:'麦香烤肉',owner:'V25',level:2,cost:1.45,comfort:8,work:1.04,rest:0,quality:0},
 ],
 drink: [
  {id:'water',name:'清水',cost:0,happiness:0,work:1,rest:0,quality:0},
  {id:'berry',name:'浆果饮',owner:'V22',level:1,cost:.5,happiness:3,work:1,rest:0,quality:0},
  {id:'ale',name:'麦芽酒',owner:'V22',level:2,cost:.8,happiness:7,work:.97,rest:0,quality:0},
 ],
 activity: [
  {id:'free',name:'自由休闲',cost:0,happiness:0,work:1,rest:0,quality:0},
  {id:'chess',name:'邻里棋局',owner:'V23',level:1,cost:.6,happiness:4,work:1,rest:2,quality:.02},
  {id:'dance',name:'广场舞会',owner:'V23',level:2,cost:.85,happiness:5,work:1.05,rest:3,quality:0},
 ],
};
export function enableLifeServices(s){
 if(s.life.serviceMode==='legacy'){s.life.serviceMode='current';s.life.welfare='off';if(s.life.food)s.life.food.graceUntil=s.life.food.clock+420;s.life.revision++;}
 return {ok:true,text:'已启用村庄供餐与活动'};
}
const defaults={meal:'home',drink:'water',activity:'free'};
const row=(kind,id)=>LIFE_MENU[kind]?.find(o=>o.id===id);
const finite=x=>Number.isFinite(x)?Math.max(0,x):0;
const people=s=>(s.community?.residents||[]).filter(r=>!r.reserve);
const allowed=(s,o)=>!o.owner||activeLevel(s,o.owner)>=o.level;
export function menuState(s){return s.life.menuState ||= {version:1,selected:{...defaults},paid:{},bins:s.life.food?.stock?[{id:'home',qty:s.life.food.stock}]:[],people:{},spent:0};}
export function menuChoices(s,kind){return (LIFE_MENU[kind]||[]).map(o=>({...o,available:allowed(s,o),reason:allowed(s,o)?'':`需要 ${o.owner==='V25'?'食堂':o.owner==='V22'?'酒馆':'活动馆'} Lv.${o.level}`}));}
export function menuBudget(s,kind,id){const o=row(kind,id);return !o||!allowed(s,o)?0:people(s).length*(kind==='meal'?serviceQuote(s).food:serviceQuote(s).simple)*o.cost;}
export function setLifeMenu(s,kind,id){
 const o=row(kind,id);if(!o)return {ok:false,reason:'未知生活选项'};
 if(!allowed(s,o))return {ok:false,reason:menuChoices(s,kind).find(x=>x.id===id).reason};
 if(id!==defaults[kind]&&s.money<menuBudget(s,kind,id))return {ok:false,reason:'至少留够一分钟的服务费用'};
 enableLifeServices(s);
 const m=menuState(s);m.selected[kind]=id;delete m.paid[kind];
 // This is a replacement for the old tea policy, not a second stack of perks.
 s.life.welfare='off';s.life.revision++;
 return {ok:true,text:'已选择'+o.name};
}
export function advanceMenu(s,dt){
 const m=menuState(s);m.paid={};if(!(dt>0))return;
 for(const kind of Object.keys(defaults)){
  const o=row(kind,m.selected[kind]);if(!o||!allowed(s,o)){m.selected[kind]=defaults[kind];continue;}
  if(kind==='meal')continue;
  const cost=menuBudget(s,kind,o.id)*dt/60;
  if(s.money+1e-9<cost){m.selected[kind]=defaults[kind];s.life.revision++;continue;}
  s.money=Math.max(0,s.money-cost);s.life.spent+=cost;m.spent+=cost;m.paid[kind]=o.id;
 }
}
export const recipeCost=s=>row('meal',menuState(s).selected.meal)?.cost||1;
export function recordCooking(s,amount){
 if(!(amount>0))return;const m=menuState(s),id=m.selected.meal,last=m.bins.at(-1);
 if(last?.id===id)last.qty+=amount;else m.bins.push({id,qty:amount});
}
function drain(s,amount){
 const m=menuState(s),taken=[];let left=amount;
 while(left>1e-9&&m.bins.length){const b=m.bins[0],qty=Math.min(left,b.qty);taken.push({id:b.id,qty});b.qty-=qty;left-=qty;if(b.qty<1e-9)m.bins.shift();}
 if(left>1e-7)taken.push({id:'home',qty:left});
 return taken;
}
export function recordMeal(s,r){menuState(s).people[r.id]={at:s.life.food.clock,serving:drain(s,1)};}
export function recordDiscard(s,qty){drain(s,qty);}
function serving(s,r){const m=s.life?.menuState?.people?.[r.id];return m&&s.life.food.clock-m.at<420?m.serving:[];}
export function mealComfort(s,r,fallback=8){const meal=serving(s,r);return meal.length?meal.reduce((n,b)=>n+(row('meal',b.id)?.comfort||8)*b.qty,0):fallback;}
export function menuEffects(s,r){
 const m=s.life?.menuState,e={happiness:0,work:1,rest:0,quality:0};if(!m||s.life.serviceMode==='legacy')return e;
 for(const b of serving(s,r)){const o=row('meal',b.id);if(o){e.work+=(o.work-1)*b.qty;e.rest+=o.rest*b.qty;e.quality+=o.quality*b.qty;}}
 for(const kind of ['drink','activity']){const o=row(kind,m.paid[kind]);if(!o||!allowed(s,o))continue;e.happiness+=o.happiness;e.work*=o.work;e.rest+=o.rest;e.quality+=o.quality;}
 e.rest=Math.min(8,e.rest);e.quality=Math.min(.04,e.quality);return e;
}
export function restoreMenu(s,raw){
 const old=raw?.life?.menuState,m=menuState(s);if(old?.version!==1)return;
 for(const kind of Object.keys(defaults))if(row(kind,old.selected?.[kind]))m.selected[kind]=old.selected[kind];
 m.paid={};for(const kind of ['drink','activity']){const o=row(kind,old.paid?.[kind]);if(o&&o.id===m.selected[kind]&&allowed(s,o))m.paid[kind]=o.id;}
 m.spent=finite(old.spent);m.bins=[];let remain=s.life.food?.stock||0;
 for(const b of (Array.isArray(old.bins)?old.bins:[])){const qty=Math.min(remain,finite(b.qty));if(qty&&row('meal',b.id)){m.bins.push({id:b.id,qty});remain-=qty;}}
 if(remain>1e-9)m.bins.push({id:'home',qty:remain});
 for(const r of people(s)){
  const saved=old.people?.[r.id];if(!saved||!Array.isArray(saved.serving))continue;
  let rest=1;const servings=[];for(const b of saved.serving){if(!row('meal',b.id))continue;const qty=Math.min(rest,finite(b.qty));if(qty){servings.push({id:b.id,qty});rest-=qty;}}
  m.people[r.id]={at:Math.min(s.life.food?.clock||0,finite(saved.at)),serving:servings};
 }
 for(const r of people(s)){const a=s.life.residents?.[r.id],oldA=raw.life.residents?.[r.id];if(a?.phase==='rest'&&oldA)a.remaining=Math.min(28,finite(oldA.remaining));}
}

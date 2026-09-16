import {recipeCost,recordCooking,recordMeal,recordDiscard,mealComfort} from './life-menu.js';
import {mealUnitCost} from './service-economy.js';
// Shared village food ledger.
// Ingredients are purchased with the real wallet; no farm batch is also sold.
import {activeLevel} from './facility-storage.js';
import {civicObjects} from './civic-data.js';
import {FOOD_CONFIG as C} from './food-config.js';

const hash=id=>[...String(id)].reduce((h,c)=>Math.imul(h^c.charCodeAt(0),16777619)>>>0,2166136261);
export function foodState(s) {
  return s.life.food ||= {version:1, stock:0, cooked:0, eaten:0, discarded:0, spent:0,
    shortages:0, clock:0, graceUntil:null, people:{}};
}
export function foodCapacity(s) {
  const level=activeLevel(s,'V25');
  if(!level||!s.placements?.V25)return 0;
  return (1+civicObjects(s).filter(p=>p.type==='V25').length)*C.capacity[Math.min(level,3)-1];
}
function need(s,r) {
  const f=foodState(s);
  return f.people[r.id] ||= {next:f.clock+hash(r.id)%C.cycle, missed:0,lastMeal:null};
}
export function advanceFood(s,dt) {
  if(!(dt>0)||!s.life||s.life.serviceMode==='legacy')return;
  const f=foodState(s); f.clock+=dt;
  const people=(s.community?.residents||[]).filter(r=>!r.reserve);
  // Ordinary early play is protected. Timing is elapsed foreground simulation,
  // not wall-clock time; reloading never creates another grace period.
  if(f.graceUntil===null && people.length>=6 && activeLevel(s,'V11'))
    f.graceUntil=f.clock+C.grace;
  const capacity=foodCapacity(s), limit=capacity;
  if(f.stock>limit){recordDiscard(s,f.stock-limit);f.discarded+=f.stock-limit;f.stock=limit;}
  const unitCost=mealUnitCost(s,C.cycle)*recipeCost(s);
  const amount=Math.max(0,Math.min(limit-f.stock,capacity/C.cycle*dt,
    unitCost>0?s.money/unitCost:Infinity));
  const cost=amount*unitCost;
  s.money=Math.max(0,s.money-cost);s.life.spent+=cost;f.spent+=cost;
  recordCooking(s,amount);
  f.cooked+=amount;f.stock+=amount;
  for(const r of people) {
    const p=need(s,r);
    // A village meal allocation, including idle residents and busy couriers.
    // Deliveries do not clear anyone's cargo or interrupt work. Dining motion
    // can be shown at the next natural break; it does not award another meal.
    if(f.clock>=p.next) takeMeal(s,r);
  }
}
export function takeMeal(s,r) {
  if(s.life?.serviceMode==='legacy')return false;
  const f=foodState(s),p=need(s,r);
  if(f.clock<p.next)return false;
  p.next=f.clock+C.cycle;
  if(f.stock+1e-9>=1) {
    recordMeal(s,r);
    f.stock=Math.max(0,f.stock-1);f.eaten++;p.missed=0;p.lastMeal=f.clock;
    return true;
  }
  if(f.graceUntil!==null&&f.clock>=f.graceUntil) {p.missed=Math.min(2,p.missed+1);f.shortages++;}
  return false;
}
export function foodParts(s,r) {
  if(s.life?.serviceMode==='legacy')return {food:0,hunger:0,work:1};
  const f=s.life?.food,p=f?.people[r.id];
  const fresh=p?.lastMeal!==null&&p?.lastMeal!==undefined&&f.clock-p.lastMeal<C.cycle*2;
  const hungry=C.penalty>0&&(p?.missed||0)>=2;
  return {food:fresh?mealComfort(s,r,C.comfort):0,hunger:hungry?-C.unhappy:0,work:hungry?1-C.penalty:1};
}
export function foodSnapshot(s) {
  const f=foodState(s),people=(s.community?.residents||[]).filter(r=>!r.reserve);
  return {...f,capacity:foodCapacity(s),people:people.length,
    fed:people.filter(r=>foodParts(s,r).food>0).length,
    hungry:people.filter(r=>foodParts(s,r).work<1).length};
}
export function restoreFood(s,raw) {
  const old=raw?.life?.food;
  if(old?.version!==1)return;
  const f=foodState(s),valid=v=>Number.isFinite(v)&&v>=0;
  for(const key of ['stock','cooked','eaten','discarded','spent','shortages','clock'])
    if(valid(old[key]))f[key]=old[key];
  f.graceUntil=valid(old.graceUntil)?old.graceUntil:null;
  for(const r of s.community?.residents||[]) {
    const p=old.people?.[r.id];
    if(p&&valid(p.next))f.people[r.id]={next:p.next,missed:Math.min(2,Math.max(0,p.missed||0)),lastMeal:valid(p.lastMeal)?Math.min(f.clock,p.lastMeal):null};
  }
}

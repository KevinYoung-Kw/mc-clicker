// Earned six-person checkpoint; paired real operations with/without a canteen.
import assert from 'node:assert/strict';import fs from 'node:fs';
import {restore,advance,buy,sites,frontier} from '../src/game.js';import {startResearch} from '../src/research.js';import {lifeSnapshot,happinessParts} from '../src/villager-life.js';
const input=JSON.parse(fs.readFileSync(new URL('../docs/v2.0.0/simulation/research-fork-checkpoint.json',import.meta.url))),rows=[];
for(const phase of [0,91]){
 const base=restore(input);assert.ok(startResearch(base,'community-life').ok);advance(base,20);for(let t=0;t<phase;t++)advance(base,1);
 if(!sites(base,'overworld',null,'V25').length)assert.ok(buy(base,'V1',frontier(base)[0]).ok);
 const positions=sites(base,'overworld',null,'V25'),workers=base.community.residents.filter(r=>r.job!=='idle');positions.sort((a,b)=>workers.reduce((v,r)=>v+Math.hypot(a.x-r.x,a.z-r.z)-Math.hypot(b.x-r.x,b.z-r.z),0));
 for(const built of [false,true]){
  const s=structuredClone(base),initial={money:s.money,total:s.total,spent:s.life.spent,shipped:s.community.shipped,visits:s.life.visits,jobs:s.community.jobIncome};
  if(built)assert.ok(buy(s,'V25',positions[0]).ok);
  let happy=0,food=0,maxRest=0;for(let t=0;t<900;t++){advance(s,1);const a=lifeSnapshot(s);happy+=a.happiness;food+=a.foodPeople;maxRest=Math.max(maxRest,a.resting);assert.ok(a.bonus<=15);}
  rows.push({phase,built,cost:built?2600:0,position:built?positions[0]:null,seconds:900,income:s.total-initial.total,walletChange:s.money-initial.money,jobIncome:s.community.jobIncome-initial.jobs,welfareCost:s.life.spent-initial.spent,shipped:s.community.shipped-initial.shipped,visits:s.life.visits-initial.visits,meanHappiness:happy/900,meanFoodPeople:food/900,maxRest,foodVisits:Object.values(s.life.residents).filter(a=>a.visited.V25!==undefined).length});
 }
}
fs.writeFileSync(new URL('../docs/v2.0.0/simulation/alpha2-canteen.json',import.meta.url),JSON.stringify({method:'Current source, earned research checkpoint, common 800-cost research/20s, real geometry and optional common land, no cash injection, 15min no-click actual production. Canteen capital included in wallet change. Two stagger phases; welfare off. Visits must use real navigation. This is a narrow investment observation, not a guaranteed income multiplier or a human playtest.',rows},null,2)+'\n');console.log(JSON.stringify(rows));

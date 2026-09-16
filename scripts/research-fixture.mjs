// Test-only helper: granted wallet, real purchases, housing, delivery and research.
import {connectAll,setAutoConnect} from '../src/power.js';
import {buy,sites,frontier,advance,action} from '../src/game.js';
import {ITEMS} from '../src/catalog.js';
import {assignJob} from '../src/residents.js';
import {prepareRecruitHousing} from './housing-fixture.mjs';
import {RESEARCH_BY_ID,researchForItem,startResearch,researchStatus} from '../src/research.js';
export function prepareResearchFor(s,item){
  function expand(realm='overworld'){
    const site=frontier(s,realm).sort((a,b)=>Math.hypot(a.x,a.z)-Math.hypot(b.x,b.z))[0];
    const r=buy(s,'V1',{...site,realm});if(!r.ok)throw Error(r.reason);
  }
  function ensure(id,target=1){
    if((s.counts[id]||0)>=target)return;
    const row=ITEMS[id];for(const dep of row.deps)ensure(dep);
    if(row.gate?.id)ensure(row.gate.id,row.gate.level);
    while((s.counts[id]||0)<target){
      if(id==='V2')prepareRecruitHousing(s);
      for(const key of researchForItem(s,id))research(key);
      const next=(s.counts[id]||0)+1;
      if(id==='V12')for(const [at,dep] of [[4,'N4'],[5,'N11'],[6,'E8']])if(next>=at)ensure(dep);
      if(id==='V13')ensure(['N11','E8','E9','Z2'][Math.min(3,next-1)]);
      if(row.place&&!s.counts[id])while(!sites(s,row.realm,null,id).length)expand(row.realm);
      const result=buy(s,id);if(!result.ok){if(id==='V2'&&result.reason.includes('村')){expand();continue;}throw Error(`research fixture ${id}: ${result.reason}`);}
    }
  }
  function research(id){
    if(s.research.completed[id])return;
    const row=RESEARCH_BY_ID[id];for(const dep of row.requires)research(dep);
    for(const [dep,lv] of row.items)ensure(dep,lv);
    if(row.residents){ensure('V6');ensure('V2',row.residents);prepareRecruitHousing(s,row.beds);}
    if(row.villageSale&&!s.research.milestones.villageSale){
      const courier=s.community.residents.find(r=>!r.reserve&&!r.cargo);
      const prior=courier.job;assignJob(s,courier.id,'hauler');
      for(let i=0;i<180&&!s.research.milestones.villageSale;i++){action(s,'farm');advance(s,1);}
      if(!courier.cargo)assignJob(s,courier.id,prior);
      if(!s.research.milestones.villageSale)throw Error('Research fixture: no real village delivery');
    }
    if(row.industrialSale&&!s.research.milestones.industrialSale){
      ensure('M5');ensure('M6',2);ensure('M7',2);ensure('M4');
      const automatic=s.grid.autoConnect;setAutoConnect(s,true);connectAll(s);
      for(let i=0;i<600&&!s.research.milestones.industrialSale;i++)advance(s,1);
      setAutoConnect(s,automatic);
      if(!s.research.milestones.industrialSale)throw Error('Research fixture: no real industrial sale');
    }
    const result=startResearch(s,id);if(!result.ok)throw Error(result.reason);
    advance(s,researchStatus(s,id).remaining);
    if(!s.research.completed[id])throw Error('Research failed to complete');
  }
  for(const id of researchForItem(s,item))research(id);
  if(item==='V13')ensure(['N11','E8','E9','Z2'][Math.min(3,s.counts.V13||0)]);
  if(item==='V12')for(const [at,dep] of [[3,'N4'],[4,'N11'],[5,'E8']])if(s.counts.V12>=at)ensure(dep);
}

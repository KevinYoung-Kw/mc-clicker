import { UPGRADE_ART, upgradeArt } from '../src/upgrade-art.js';
import { ownedGroups } from '../src/facility-shops.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { fresh, restore, rates } from '../src/game.js';
import { ITEMS } from '../src/catalog.js';
import { UPGRADE_CATALOG, buyUpgrade, upgradeRequirements, upgradeStatus, upgradeMultiplier } from '../src/upgrades.js';
import { upgradeComparison } from '../src/upgrade-comparison.js';
import { UPGRADE_COPY, UPGRADE_PURPOSE } from '../src/upgrade-copy.js';
import { nextFacilityUnlock, facilityLevelLabel } from '../src/facility-growth.js';
import { createUpgradesUI } from '../src/upgrades-ui.js';
import { createPanelMemory } from '../src/panel-memory.js';

function full() {
 const s=fresh();s.money=1e15;
 for(const i of Object.values(ITEMS))s.counts[i.id]=Number.isFinite(i.max)?i.max:32;
 for(const r of UPGRADE_CATALOG)s.upgrades.levels[r.id]=r.maxLevel;
 s.upgrades.revision=76;s.research.completed={industrial:true,modern:true};
 return s;
}
test('every purchase rank enforces its base level and technology gates without charging on failure',()=>{
 for(const r of UPGRADE_CATALOG){
  assert.ok(UPGRADE_COPY[r.id]?.length>10,r.id);
  assert.ok(UPGRADE_PURPOSE[r.id]?.length>3,r.id);
  assert.ok(UPGRADE_ART[r.id],r.id);assert.ok(upgradeArt(r).includes("<svg"));
  if(r.ownerLevels)assert.equal(r.ownerLevels.length,r.maxLevel);
  for(let rank=0;rank<r.maxLevel;rank++){
   const s=full();s.upgrades.levels[r.id]=rank;
   const required=r.ownerLevels?.[rank]||1;
   assert.ok(required<=ITEMS[r.owner].max,r.id);
   s.counts[r.owner]=required;
   assert.equal(upgradeStatus(s,r.id).kind,'ready',`${r.id} rank ${rank}`);
   const money=s.money;
   s.counts[r.owner]=required-1;
   assert.equal(buyUpgrade(s,r.id).ok,false,r.id);
   assert.equal(s.money,money);
   s.counts[r.owner]=required;
   for(const dep of r.stageRequires?.[rank]||[]){
    const old=s.counts[dep];delete s.counts[dep];
    assert.ok(upgradeRequirements(s,r.id).some(x=>x.id===dep));s.counts[dep]=old;
   }
   assert.ok(buyUpgrade(s,r.id).ok,r.id);
   assert.equal(s.upgrades.levels[r.id],rank+1);
  }
 }
});
test('legacy paid ranks retain effects and partial purchases enforce only the next gate',()=>{
 const s=fresh();s.counts={M7:1,M9:1};s.money=1e10;
 s.upgrades={revision:4,levels:{'wind-blades':2,'drill-diamond':1,'drill-steel':1}};
 const saved=restore(s);
 assert.equal(upgradeMultiplier(saved,'M7','generation'),1.35**2);
 assert.equal(upgradeMultiplier(saved,'M9','raw'),1.25*1.45);
 assert.equal(upgradeStatus(saved,'drill-diamond').kind,'complete');
 assert.equal(upgradeStatus(saved,'wind-blades').missing[0].level,3);
 assert.equal(buyUpgrade(saved,'wind-blades').ok,false);
});
test('creatures and one-time owners do not gain artificial level requirements',()=>{
 for(const id of ['N3','N5','E3','E5','V11','N6','N12','N11','E7','E10','E9']){
  for(const row of UPGRADE_CATALOG.filter(x=>x.owner===id))assert.equal(row.ownerLevels,undefined);
 }
 const s=fresh();s.counts={M9:1,E3:2,V11:1};
 assert.match(nextFacilityUnlock(s,'M9'),/Lv.2/);
 assert.equal(facilityLevelLabel(s,'E3'),'2 只');
 assert.equal(facilityLevelLabel(s,'V11'),'已建成');
});
test('comparisons are pure, reflect current levels and respect actual inlet/outlet capacity limits',()=>{
 const s=fresh();s.counts={M7:1,M9:5,M2:3,M4:1,V4:1};
 let c=upgradeComparison(s,'wind-blades');assert.equal(c.rows[0].before,32);assert.equal(c.rows[0].after,43.2);
 s.counts.M7=2;c=upgradeComparison(s,'wind-blades');assert.equal(c.rows[0].after,86.4);
 s.upgrades={revision:4,levels:{'drill-steel':1,'drill-diamond':1,'drill-netherite':1,'drill-twin':1}};
 c=upgradeComparison(s,'drill-cooling');assert.ok(c.capped);assert.equal(c.rows[0].before,c.rows[0].after);
 assert.equal(c.rows[0].before,5*1.25*14*2);
 c=upgradeComparison(s,'drill-buffer');assert.equal(c.rows[0].after,c.rows[0].before*2);assert.match(c.rows[0].label,/主世界原料/);
 const before=structuredClone(s);
 for(const row of UPGRADE_CATALOG){const values=upgradeComparison(s,row.id);for(const v of values.rows)assert.ok(typeof v.before==='string'||Number.isFinite(v.before),row.id);}
 assert.deepEqual(s,before);
});
test('new UI counts distinct installed parts, avoids duplicate cards and removes appearance disclosure',()=>{
 const s=full();s.upgrades.levels['drill-buffer']=2;s.counts.M9=1;
 const html=createUpgradesUI({state:()=>s}).render('M9');
 assert.match(html,/7 \/ 7 已安装/);
 assert.equal((html.match(/data-mod-card="drill-buffer"/g)||[]).length,1);
 assert.ok(!html.includes('外观会怎样变化'));
 assert.match(html,/本体 Lv.3/);
 assert.match(html,/主世界原料容量/);
});
test('fold preferences preserve explicit close, survive reload and stay separate by device',()=>{
 let saved=null,device='mobile';const storage=()=>({getItem:()=>saved,setItem:(k,v)=>saved=v});
 const create=()=>createPanelMemory({storage,device:()=>device});
 const m=create();assert.equal(m.open('power',true),true);m.set('power',false);
 assert.equal(create().open('power',true),false);
 device='desktop';assert.equal(create().open('power',true),true);m.set('power',true);
 device='mobile';assert.equal(create().open('power',true),false);
 saved='invalid';assert.equal(create().open('power',true),true);
 const unavailable=createPanelMemory({storage:()=>{throw Error('blocked')},device:()=>device});
 unavailable.set('power',true);assert.ok(unavailable.open('power'));
});

test('base max does not hide an unfinished modification inside the completed group',()=>{
 const s=full();delete s.upgrades.levels['wind-gears'];const groups=ownedGroups(s,[ITEMS.M7,ITEMS.M9]);
 assert.deepEqual(groups.upgradable.map(x=>x.id),['M7']);assert.deepEqual(groups.complete.map(x=>x.id),['M9']);
});

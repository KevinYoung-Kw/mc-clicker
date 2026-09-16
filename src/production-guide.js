import { ITEMS } from './catalog.js';
import { purchaseStatus } from './purchase-feedback.js';
import { facilityUpgrades, upgradeStatus } from './upgrades.js';
import { facilityStored } from './facility-storage.js';

export const PRODUCTION_STAGES = [['raw','采集'],['haul','运输'],['process','加工'],['trade','交易']];
export const GUIDE_LABELS = {raw:'采集',haul:'运输',process:'加工',trade:'交易',power:'供电',rawStorage:'原料仓储',storage:'成品仓储'};
export const GUIDE_NOTES = {
 raw:'增加进入产线的原料。农牧的手动收获和岗位产出仍在村庄管理。',
 haul:'提高原料送入加工环节的速度。村民取货和傀儡巡收在下方调整。',
 process:'把原料加工成可出售的成品。',trade:'加快成品出售，货物卖出后才会入账。',
 power:'增加持续供能；储电容量不会提高发电速度。',
 rawStorage:'扩大原料缓冲空间。持续积压还要改善运输或加工。',
 storage:'扩大成品存放空间。持续积压还要改善交易。',
};
// Only include capabilities actually consumed by game.rates. For example, a
// villager's handcart improves community pickups, not the regional haul value.
const OWNERS = {
 overworld:{raw:['M1','M9','M18','M3','V8','V9','V10','V6'],haul:['M8','M16','V16'],process:['M2','T9'],trade:['V3','V17']},
 nether:{raw:['N3','N7','N8','N9'],haul:['N2','N12','M16'],process:['N4','N3','T9'],trade:['N2','N12']},
 end:{raw:['E4','E11'],haul:['E5','E7'],process:['E8','E11','E10','T9'],trade:['E5','E7']},
};
const EFFECTS = {
 raw:{M9:['raw','outlet'],E11:['raw']},haul:{M16:['cargo','interval','loading'],M4:['outlet'],E6:['cargo']},
 process:{M2:['process','inlet'],N4:['process']},trade:{V3:['trade'],N2:['trade']},
 power:{M6:['generation'],M7:['generation']},rawStorage:{M9:['buffer'],M4:['buffer'],E6:['buffer']},storage:{M4:['buffer'],E6:['buffer']},
};
export function productionOffers(s,realm,key) {
 if(!OWNERS[realm] || !GUIDE_LABELS[key])return [];
 const ids = key==='power'?['M6','M7','M15',...(realm==='end'?['E8']:[])]:key==='rawStorage'||key==='storage'?['M4','E6']:OWNERS[realm][key];
 const rows=[];
 for(const id of ids){
  const item=ITEMS[id],status=purchaseStatus(s,item);
  if(status.kind!=='complete')rows.push({key:id,id,kind:'item',name:item.name,status,owned:!!s.counts[id]});
 }
 for(const [owner,effects] of Object.entries(EFFECTS[key]||{})){
  if(!s.counts[owner]||facilityStored(s,owner))continue;
  // Industrial modifications from a different world are not cross-realm gains.
  if(owner==='M16'&&realm!=='overworld')continue;
  if(owner==='M9'&&key==='rawStorage'&&realm!=='overworld')continue;
  if(!(owner==='M9'&&key==='rawStorage')&&!['M4','E6','M6','M7'].includes(owner)&&!OWNERS[realm]?.[key]?.includes(owner))continue;
  for(const mod of facilityUpgrades(owner)){
   if(!effects.some(effect=>mod.effects[effect]!==undefined))continue;
   const status=upgradeStatus(s,mod.id);if(status.kind==='complete')continue;
   rows.push({key:mod.id,id:owner,mod:mod.id,kind:'mod',name:mod.name,status,owned:true});
  }
 }
 // Shared loading/cargo devices also raise the regional haul capacity.
 if(key==='haul')for(const id of ['M17','E6']){
  const status=purchaseStatus(s,ITEMS[id]);if(status.kind!=='complete')rows.push({key:id,id,kind:'item',name:ITEMS[id].name,status,owned:!!s.counts[id]});
 }
 return rows.sort((a,b)=>Number(a.status.kind==='locked')-Number(b.status.kind==='locked')||a.status.cost-b.status.cost||a.key.localeCompare(b.key));
}

export function productionSignals(region,actual) {
 const values=PRODUCTION_STAGES.map(([key])=>region[key]);
 const low=Math.min(...values),high=Math.max(...values);
 // Equal capacities or an empty chain do not need four simultaneous warnings.
 const weak=high>0&&high>low*1.15?PRODUCTION_STAGES[values.indexOf(low)][0]:null;
 const signals=Object.fromEntries(PRODUCTION_STAGES.map(([key])=>[key,key===weak?'warning':'normal']));
 if(actual.stage)signals[actual.stage]=actual.tone==='blocked'?'blocked':actual.tone==='idle'?'idle':signals[actual.stage];
 return {signals,weak,focus:actual.stage||weak||'raw',
  helpKey:actual.issue==='no-power'?'power':actual.stage||weak||'raw'};
}

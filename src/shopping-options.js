import { CATALOG } from './catalog.js';
import { discoveryStock } from './development.js';
import { inConstruction } from './facility-shops.js';
import { facilityStored } from './facility-storage.js';
import { purchaseStatus } from './purchase-feedback.js';
import { facilityUpgrades, upgradeStatus } from './upgrades.js';
import { postalUpgradeCost } from './mail.js';
const byPrice=(a,b)=>a.cost-b.cost||a.id.localeCompare(b.id);
// One actionable improvement per facility, including mods before max body level.
export function shoppingUpgrades(s, family='all', {all=false}={}) {
 return CATALOG.filter(i=>(all||inConstruction(i))&&s.counts[i.id]&&!['V1','V2','Z2'].includes(i.id)&&
  !facilityStored(s,i.id)&&(all||!(i.id==='L1'&&s.counts.L2))&&(family==='all'||i.family===family))
 .flatMap(item=>{
  const offers=[];
  if(item.id==='V18'){
   const cost=postalUpgradeCost(s);if(cost!==null)offers.push({kind:'postal',cost});
  }else if(s.counts[item.id]<item.max){
   const status=purchaseStatus(s,item);
   if(!['locked','complete'].includes(status.kind))offers.push({kind:'level',cost:status.cost});
  }
  for(const mod of facilityUpgrades(item.id)){
   const status=upgradeStatus(s,mod.id);
   if(!['locked','complete'].includes(status.kind))offers.push({kind:'mod',mod:mod.id,name:mod.name,cost:status.cost});
  }
  const ordered=offers.sort((a,b)=>a.cost-b.cost);
  return (all?ordered:ordered.slice(0,1)).map(offer=>({...offer,id:item.id,item,key:all?`upgrade:${item.id}:${offer.mod||offer.kind}`:`upgrade:${item.id}`}));
 }).sort(byPrice);
}
export function shoppingOptions(s,family='all',report=null,step=null,order='progress'){
 const stock=discoveryStock(s,family,report,step);
 const purchases=stock.available.map(item=>({kind:'purchase',id:item.id,item,key:`buy:${item.id}`,cost:purchaseStatus(s,item).cost}));
 if(order==='price')return {available:purchases.sort(byPrice),soon:stock.soon};
 // Discovery contains only new purchases. Existing levels, postal upgrades and
 // modifications belong to owned facilities, even when a milestone needs one.
 const primary=purchases.find(r=>r.id===step?.id);
 const remaining=purchases.filter(r=>r!==primary).sort(byPrice);
 const available=primary?[primary,...remaining]:remaining;
 return {available,soon:stock.soon};
}

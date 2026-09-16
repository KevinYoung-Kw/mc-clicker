import {isResting,lifeWorkFactor} from './villager-life.js';
import { skillFactor } from './residents.js';
// A hired resident must actually reach the market. No anonymous shopkeeper,
// second wallet or per-frame payment; commissions attribute existing sales.
export function marketStaff(s) {
  if (!s.counts.V3 || !s.placements.V3) return [];
  return (s.community?.residents || []).filter(r => r.job === 'merchant' && !r.reserve && !isResting(s,r) && !r.handover && !r.room && !r.studioExit && !r.cargo && !r.path?.length && r.workplaceId === 'V3' && Math.abs(r.x-s.placements.V3.x)<2.1 && Math.abs(r.z-s.placements.V3.z)<1.9);
}
export function marketService(s) {
  const workers=marketStaff(s), weights=workers.map(r=>.2*skillFactor(r,'hauling')*lifeWorkFactor(s,r));
  const bonus=weights.reduce((a,b)=>a+b,0);
  return {workers,weights,factor:1+bonus,share:bonus/(1+bonus)};
}
export function creditMarketSale(s, value) {
  const service=marketService(s);
  if (!(value>0) || !service.workers.length) return 0;
  service.workers.forEach((r,i)=>{
    r.jobEarned += value*service.weights[i]/service.factor;
  });
  return service.share;
}

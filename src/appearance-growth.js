import { WEB_ITEMS } from './web-catalog.js';
const split={title:[4,8],icon:[3,6],cursor:[2,4],theme:[0,2],share:[2,4],notice:[1,3]};
const counts={};
export const APPEARANCE_TIERS=Object.fromEntries(WEB_ITEMS.map(item=>{
 const index=counts[item.category]||0;counts[item.category]=index+1;
 const [first,second]=split[item.category];
 return [item.id,item.tier || (index<first?1:index<second?2:3)];
}));
export const stallLevel=s=>Math.max(0,Math.min(3,s.counts.X2||0));
export const catalogLevel=s=>Math.max(stallLevel(s),s.webAppearance?.catalogTier||0);
export const appearanceAvailable=(s,item)=>!!s.webAppearance?.owned[item.id] || (catalogLevel(s)>=(APPEARANCE_TIERS[item.id]||1) && stallLevel(s)>=(item.requiredStallLevel||1));
export const appearanceRequirement=(s,item)=>appearanceAvailable(s,item)?'':`装扮摊 Lv.${APPEARANCE_TIERS[item.id]} 解锁`;
export const tierContents=level=>WEB_ITEMS.filter(i=>APPEARANCE_TIERS[i.id]<=level);
export const STALL_NAMES=['未建造','小小画摊','装扮工坊','方块精品店'];

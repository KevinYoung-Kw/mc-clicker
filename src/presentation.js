import { appearanceRequirement } from './appearance-growth.js';
import { WEB_ITEMS, WEB_BY_ID, WEB_SLOTS } from './web-catalog.js';
import { LEGACY_APPEARANCE } from './presentation-migration-map.js';
import { freshEnvironment, restoreEnvironment, ENV_LEGACY } from './environment.js';
export const freshWebAppearance=()=>({version:2,catalogTier:0,owned:{},equipped:{},legacyAliases:{}});
export const freshScenery=()=>({version:1,owned:{},equipped:{},disabled:{}});
export function equipWeb(s,id) {const i=WEB_BY_ID[id];if(!i||!s.webAppearance.owned[id])return false;s.webAppearance.equipped[i.slot]=id;return true;}
export function resetWeb(s,slot=null) {if(slot&&!WEB_SLOTS.includes(slot))return false;if(slot)delete s.webAppearance.equipped[slot];else s.webAppearance.equipped={};return true;}
export function buyWeb(s,id) {const i=WEB_BY_ID[id];if(!i)return {ok:false,reason:'未知装扮'};if(!s.counts.X2)return {ok:false,reason:'需要先建造装扮摊'};if(s.webAppearance.owned[id])return {ok:false,reason:'已收藏'};const requirement=appearanceRequirement(s,i);if(requirement)return {ok:false,reason:requirement};if(s.money<i.cost)return {ok:false,reason:`还差 ${Math.ceil(i.cost-s.money)} 绿宝石`};s.money-=i.cost;s.webAppearance.owned[id]=true;equipWeb(s,id);return {ok:true,cost:i.cost};}
export const collectionCount=s=>s.webAppearance?Object.keys(s.webAppearance.owned).length+Object.keys(s.scenery?.owned||{}).length:Object.keys(s.collection?.owned||{}).length;
const aliases=['橡木小镇','红石工厂正在开播','末地探险日志'];
export function restorePresentation(s,raw) {
  s.webAppearance=freshWebAppearance();s.scenery=freshScenery();
  if([1,2].includes(raw.webAppearance?.version)) {
    for(const i of WEB_ITEMS)if(raw.webAppearance.owned?.[i.id]===true)s.webAppearance.owned[i.id]=true;
    for(const slot of WEB_SLOTS){const id=raw.webAppearance.equipped?.[slot];if(WEB_BY_ID[id]?.slot===slot&&s.webAppearance.owned[id])s.webAppearance.equipped[slot]=id;}
    for(const [id,v] of Object.entries(raw.webAppearance.legacyAliases||{}))if(WEB_BY_ID[id]?.slot==='title'&&aliases.includes(v))s.webAppearance.legacyAliases[id]=v;
    s.environment=restoreEnvironment(raw.environment);
    for(const row of LEGACY_APPEARANCE.filter(r=>r.domain==='scenery')) {
      const id=row.old;if(raw.scenery?.owned?.[id]===true)s.scenery.owned[id]=true;
      if(raw.scenery?.equipped?.[row.activeMapping]===id&&s.scenery.owned[id])s.scenery.equipped[row.activeMapping]=id;
      if(raw.scenery?.disabled?.[id]===true)s.scenery.disabled[id]=true;
    }
    s.legacyCollection=structuredClone(raw.legacyCollection||{});
  } else {
    // restoreCollection has already expanded old whole-package entitlements.
    const old=s.collection,a=s.atmosphere;
    s.legacyCollection=structuredClone(raw.collection||old);s.environment=freshEnvironment();
    const e=s.environment;
    for(const row of LEGACY_APPEARANCE) {
      const owned=old.owned[row.old] || row.old==='garden'&&s.counts.X7;
      if(!owned)continue;
      if(row.domain==='web') {
        for(const id of row.grant)s.webAppearance.owned[id]=true;
        if(Object.values(old.equipped).includes(row.old))s.webAppearance.equipped[row.activeMapping]=row.grant[0];
        if(row.old.startsWith('title-'))s.webAppearance.legacyAliases[row.grant[0]]=aliases[+row.old.slice(-1)];
      } else if(row.domain==='scenery') {
        s.scenery.owned[row.old]=true;
        if(old.equipped[row.activeMapping]===row.old)s.scenery.equipped[row.activeMapping]=row.old;
        if(old.disabled[row.old])s.scenery.disabled[row.old]=true;
      } else if(row.domain==='environment') {
        e.access={legacy:true,pending:!s.counts.V19};
        if(row.old.startsWith('sky-')) {e.palettes.push(row.grant[0]);if(old.equipped.sky===row.old)e.palette=row.grant[0];}
        else {const id=row.grant[0];e.modules[id]=true;e.enabled[id]||=old.disabled[row.old]!==true;
          if(row.old==='world-fireflies')e.enabled.fireflies=old.disabled[row.old]!==true;
          if(row.old==='world-meteor')e.enabled.meteor=old.disabled[row.old]!==true;
        }
      }
    }
    for(const id of ['env-rain','env-snow'])if(e.modules[id]&&!e.modules['env-weather']){e.modules['env-weather']=true;e.enabled['env-weather']=false;}
    if(e.modules['env-stars']) {if(!e.modules['env-sundial']){e.modules['env-sundial']=true;e.enabled['env-sundial']=false;}e.enabled.stars=e.enabled['env-stars'];}
    const oldPhase=old.owned['world-day']&&old.disabled['world-day']!==true?(a.cycle?(a.clock/480+.3)%1:a.phase):.3;
    // Old sine daylight had dawn near 0 and sunset near .5; shift to wall-clock hours.
    e.phase=(oldPhase+.25)%1;e.clock=a.clock;e.cycle=a.cycle;e.auto=a.auto;e.weather=a.weather;
    e.weatherEpoch=Math.floor(e.clock/180);e.meteorAt=e.clock;
    const records={'雨中村庄':'rain','第一场雪':'snow','萤火之夜':'fireflies','流星时刻':'meteor'};
    e.seen=a.seen.map(v=>records[v]).filter(Boolean);
  }
  // Existing shops retain their whole catalogue; new shops earn stock by upgrading.
  s.webAppearance.catalogTier = raw.webAppearance?.version===2 ? (raw.webAppearance.catalogTier===3?3:0) : s.counts.X2?3:0;
  if(s.counts.V19)s.environment.access.pending=false;
}
// A detached legacy victory can be displayed using modern renderers without
// changing the stored first-victory snapshot or granting any buildings in it.
export function presentationForSnapshot(snapshot) {
  if(snapshot.webAppearance)return snapshot;
  const copy=structuredClone(snapshot);
  copy.collection||={owned:{},equipped:{},disabled:{}};
  copy.collection.disabled||={};copy.atmosphere||={clock:0,cycle:true,phase:.3,weather:'clear',auto:false,seen:[]};
  restorePresentation(copy,snapshot);return copy;
}

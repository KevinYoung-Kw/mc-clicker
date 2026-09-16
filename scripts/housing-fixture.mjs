// Fixtures pay for real housing and expand only when there is no valid site.
import {buy,frontier} from '../src/game.js';
import {housingCapacity,HOME_BY_ID} from '../src/housing-data.js';
import {claimStarterHome,starterHomeAvailable,housingSites,housingPlacementReason,buildHome} from '../src/housing.js';
export function prepareRecruitHousing(s,required=(s.counts.V2||0)+1){
 if(!s.counts.V2&&required===1)return;
 if(starterHomeAvailable(s))claimStarterHome(s);
 for(let attempts=0;housingCapacity(s)<required&&attempts<60;attempts++){
  const type=s.housing.stored.oak>0?'oak':s.counts.V14&&s.counts.V3>=3?'corner':s.counts.V14?'tower':s.counts.V3>=2?'duplex':'oak';
  let site;for(let rotation=0;rotation<4&&!site;rotation++)site=housingSites(s,type,rotation).find(p=>!housingPlacementReason(s,type,p));
  if(site){const result=buildHome(s,type,site);if(!result.ok)throw Error(result.reason);}
  else{const edge=frontier(s,'overworld').sort((a,b)=>Math.hypot(a.x,a.z)-Math.hypot(b.x,b.z))[0],result=buy(s,'V1',{...edge,realm:'overworld'});if(!result.ok)throw Error('Housing land: '+result.reason);}
 }
 if(housingCapacity(s)<required)throw Error('No housing site for '+required+' residents');
}

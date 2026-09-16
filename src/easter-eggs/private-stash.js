import { Navigation } from '../navigation.js';
import { buildSites, canPlace, worldScenery, sceneryVisible, buildingObstacles } from '../layout.js';
import { NARRATOR_COPY } from '../narrator-copy.js';
// A single authored event. Registry/runner code has no knowledge of this reward.
export const privateStash = {
  id:'private-stash', version:1, kind:'scenery', title:'私房钱', reward:30,
  boxes:[
    ['#65513c',0,.1,0,.36,.2,.28],['#ac8750',0,.225,0,.4,.05,.32],
    ['#dac074',0,.16,.15,.09,.12,.03],['#76994f',-.06,.28,0,.12,.06,.09],['#abc978',.05,.31,0,.08,.1,.07],
  ],
  eligible:s=>s.play>=18*60 && s.counts.V18>0 && s.counts.V2>0 && s.counts.M5>0,
  prepare(s,random) {
    const decor=worldScenery(s).filter(p=>sceneryVisible(s,p));
    const obstacles=[{minX:-.72,maxX:.72,minZ:-.72,maxZ:.72},...Object.entries(s.placements).filter(([,p])=>p.realm==='overworld').flatMap(([id,p])=>buildingObstacles(id,p)),...decor.map(p=>{const r=p.kind==='tree'?.22:.58;return {minX:p.x-r,maxX:p.x+r,minZ:p.z-r,maxZ:p.z+r};})];
    const nav=new Navigation(s.chunks.overworld,obstacles,.5),start=nav.nearest({x:1.4,z:1.4},.16);
    if(!start)return null;
    const candidates=buildSites(s,'overworld','V18').filter(p=>!decor.some(d=>Math.hypot(d.x-p.x,d.z-p.z)<(d.kind==='tree'?.6:1.1)));
    const reachable=candidates.filter(p=>{const target=nav.nearest(p,.16,start.component);return target && Math.hypot(target.x-p.x,target.z-p.z)<.3;});
    if(!reachable.length)return null;
    return {point:reachable[Math.min(reachable.length-1,Math.floor(random()*reachable.length))],reward:30};
  },
  valid(s,p) {return p && p.realm==='overworld' && canPlace(s,'V18',p) && !worldScenery(s).filter(d=>sceneryVisible(s,d)).some(d=>Math.hypot(d.x-p.x,d.z-p.z)<(d.kind==='tree'?.6:1.1));},
  offer:NARRATOR_COPY['stash-offer'].lines,
  found:NARRATOR_COPY['egg:private-stash'].lines,
};

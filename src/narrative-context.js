import { powerSnapshot } from './power.js';
import { earlyTarget } from './first-steps.js';
import { ITEMS } from './catalog.js';
import { priorityInterface } from './guidance.js';
import { price, requirements } from './game.js';
// Presentation guards read rendered objects/audio, never inferred purchase counts.
export function narrativeContext({world,audio,surface=()=> 'world'}){
 const visible=o=>{
  const w=world();if(!o||!w?.camera||!o.visible)return false;
  const p=o.getWorldPosition(o.position.clone()).project(w.camera);
  return p.z>=-1&&p.z<=1&&Math.abs(p.x)<.95&&Math.abs(p.y)<.95;
 };
 return {
  visible:id=>visible(world()?.roots?.[id]),
  surface,
  affordableTarget:s=>{
   const feature=priorityInterface(s);
   if(feature)return s.money>=feature.cost?{id:`feature:${feature.id}`,name:feature.name}:null;
   if(!s.guidance.goals && !s.counts.V2 && s.money>=20)return {id:'feature:goals',name:'目标追踪'};
   const id=earlyTarget(s),item=ITEMS[id];
   return item && !requirements(s,item).length && s.money>=price(s,item) ? {id,name:item.name} : null;
  },
  realm:()=>world()?.interior?'studio':world()?.view,
  musicPlaying:()=>{const a=audio();return a.canPlay()&&a.state().audio.musicVolume>0&&a.ctx?.state==='running'&&a.snapshot().playing;},
  workingVisible:()=>world()?.walkers?.some(w=>w.person?.job&&w.person.job!=='idle'&&!w.person.reserve&&visible(w.root)),
  railRunning:()=>world()?.graph?.children.some(o=>o.userData.railCar&&visible(o)),
  runningMachine:()=>{const w=world();return w?.state&&powerSnapshot(w.state).loads.some(l=>l.actual>0&&['M3','M9','N4'].includes(l.id)&&visible(w.roots?.[l.id]));},
 };
}

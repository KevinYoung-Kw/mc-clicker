import {activeLevel} from './facility-storage.js';
import {REALM_PROJECT_TARGET} from './project.js';
const realms=s=>['overworld',...(s.counts.N1?['nether']:[]),...(s.counts.E2&&s.endEyes===12?['end']:[])];
export const commandAuto=s=>!!activeLevel(s,'Z1')&&s.dispatch==='auto';
export const dispatchMode=s=>commandAuto(s)?s.commandPlan?.mode||'off':s.dispatch;
export const beaconTarget=s=>commandAuto(s)&&s.commandPlan?s.commandPlan.realm:s.beaconRealm;
export const beaconMode=s=>commandAuto(s)&&s.commandPlan?s.commandPlan.beacon:s.beacon;
// One shared simulation decision every eight seconds. Display never advances it.
// Use actual buffers and capacities; no goods, money or progress are created here.
export function advanceCommand(s,dt,capacities){
 if(!commandAuto(s))return;
 if(s.commandPlan && (s.commandPlan.remaining=Math.max(0,s.commandPlan.remaining-dt))>0)return;
 const caps=capacities(),available=realms(s);
 const unfinished=s.counts.Z2?available.filter(r=>(s.projectByRealm[r]||0)<REALM_PROJECT_TARGET):[];
 const pressure=r=>{const b=s.buffers[r],c=caps[r];return b.goods/Math.max(1,c.trade)+b.raw/Math.max(1,c.haul)};
 const realm=unfinished.length?unfinished.sort((a,b)=>(s.projectByRealm[a]||0)-(s.projectByRealm[b]||0)||pressure(b)-pressure(a))[0]:available.sort((a,b)=>pressure(b)-pressure(a))[0];
 const b=s.buffers[realm],c=caps[realm];
 const mode=b.goods>Math.max(1,c.trade)*8?'orders':b.raw>Math.max(1,c.haul)*8&&c.haul<c.process?'clear':'supply';
 s.commandPlan={realm,mode,beacon:c.haul<Math.min(c.raw,c.process)?'logistics':'production',remaining:8,reason:unfinished.length?'追赶工程交付':mode==='orders'?'成品等待成交':mode==='clear'?'原料等待运输':'保障生产'};
}
// Evaluate bottlenecks before our own transport/trade/beacon multipliers.
// Otherwise a successful boost can make the controller undo itself next time.
export function commandCapacities(s,report){
 return Object.fromEntries(Object.entries(report.regions).map(([realm,region])=>{
  const c={...region},mode=dispatchMode(s);
  if(s.counts.Z1&&mode==='clear')c.haul/=1.4;
  if(s.counts.Z1&&mode==='orders')c.trade/=1.4;
  if(s.counts.N10&&realm===beaconTarget(s)){
   const powered=report.electricity.perDevice.N10||0;
   if(beaconMode(s)==='logistics')c.haul/=1+s.counts.N10*.8*powered;
   else{const factor=1+s.counts.N10*.5*powered;c.raw/=factor;c.process/=factor;}
  }
  return [realm,c];
 }));
}

// A village service contract follows guaranteed resident
// income, NOT wallet balance, manual taps, windfalls, or other-world sales.
import {residentBase} from './residents.js';
import {SERVICE_CONFIG as C} from './service-config.js';
const finite=n=>Number.isFinite(n)?Math.max(0,n):0;
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
export function serviceEra(s) {
  if((s.counts?.E2||0)>0)return 'end';
  if((s.counts?.N1||0)>0)return 'nether';
  return s.research?.completed?.modern?'modern':s.research?.completed?.industrial?'industrial':'village';
}
export function proposedContract(s) {
  const people=(s.community?.residents||[]).filter(r=>!r.reserve);
  const basis=people.length?people.reduce((n,r)=>n+residentBase(s,r)*60,0)/people.length:0;
  const era=serviceEra(s),[floor,ceiling]=C.bounds[era];
  const food=clamp(basis*C.foodShare,floor,ceiling);
  const simple=clamp(basis*C.simpleShare,floor*.5,ceiling*.6);
  const generous=clamp(basis*C.generousShare,floor,ceiling*1.4);
  return {era,basis,food,simple,generous,floor,ceiling};
}
export function serviceQuote(s) {
  return s.life?.serviceContract?.quote||proposedContract(s);
}
export function advanceContract(s,dt) {
  if(!s.life||!(dt>0))return;
  const c=s.life.serviceContract ||= {version:1,clock:0,quote:proposedContract(s)};
  c.clock+=dt;
  if(c.clock>=60){c.clock%=60;c.quote=proposedContract(s);}
}
export function welfarePerMinute(s,id=s.life?.welfare) {
  if(s.life?.serviceMode==='legacy')return (s.community?.residents||[]).filter(r=>!r.reserve).length*(id==='simple'?1:id==='generous'?2.5:0);
  return (s.community?.residents||[]).filter(r=>!r.reserve).length*(id==='simple'?serviceQuote(s).simple:id==='generous'?serviceQuote(s).generous:0);
}
export const mealUnitCost=(s,cycle)=>serviceQuote(s).food*cycle/60;
export function restoreContract(s,raw) {
  const old=raw?.life?.serviceContract;
  if(old?.version!==1||!C.bounds[old.quote?.era])return;
  const [floor,ceiling]=C.bounds[old.quote.era];
  s.life.serviceContract={version:1,clock:clamp(finite(old.clock),0,59.999),quote:{
    era:old.quote.era,basis:finite(old.quote.basis),floor,ceiling,
    food:clamp(finite(old.quote.food),floor,ceiling),
    simple:clamp(finite(old.quote.simple),floor*.5,ceiling*.6),
    generous:clamp(finite(old.quote.generous),floor,ceiling*1.4),
  }};
}

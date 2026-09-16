import {menuEffects} from './life-menu.js';
// Candidate value is stamped once when goods are made. Faster work alone can
// fill the same congested queue without improving a sale; quality is separate.
import {happinessParts} from './villager-life.js';
export function workQuality(s,owners) {
  let weighted=0,total=0;
  for(const [id,value]of Object.entries(owners||{})) {
    const weight=Number.isFinite(value)?Math.max(0,value):0;
    total+=weight;
    const r=s.community?.residents.find(r=>r.id===id&&!r.reserve);
    if(!r)continue;
    const h=happinessParts(s,r);
    weighted+=weight*((h.food>0?.12:0)+Math.max(0,Math.min(1,(h.total-50)/50))*.12+menuEffects(s,r).quality);
  }
  return 1+Math.min(.28,weighted/Math.max(1,total));
}

import { observeNarrativeTrace } from '../src/narrative-trace.js';
import { advanceNarrative, notePurchaseConfirmation, NARRATION, IDLE_LINES } from '../src/narrative.js';
import { ITEMS } from '../src/catalog.js';
import { earlyTarget } from '../src/first-steps.js';
import { chooseOpening } from '../src/opening-guide.js';

// Display-behavior probes layered on a real full-run economy. They model
// attention/menus, not actual browser visibility or measured human reading.
export function narrativeSession(profile='normal', {opening='first'}={}) {
  const events=[]; let previousPurchases=0, lastPurchase=-100, subscribed=false;
  function tick(s,time,{purchases=[]}={}) {
    chooseOpening(s,opening);
    if(!subscribed){observeNarrativeTrace(s,event=>events.push(event));subscribed=true;}
    for(const row of purchases.slice(previousPurchases)){
      notePurchaseConfirmation(s,{manual:true,paid:row.cost});
      events.push({at:s.play,phase:'purchase',id:row.id,level:row.level,cost:row.cost});lastPurchase=time;
    }
    previousPurchases=purchases.length;
    const worlds=['overworld',...(s.counts.N1?['nether']:[]),...(s.endEyes===12?['end']:[])];
    const view=worlds[Math.floor(time/180)%worlds.length];
    const surface=profile==='scenic'?'world':profile==='interrupted'&&time%180<65?'network':time-lastPurchase<8?'shop':'world';
    const receipt=time-lastPurchase<(profile==='rush'?1:2);
    const options={
      available:!receipt,
      canPresent:r=>surface==='world'||r?.shop&&surface==='shop'||r?.surfaces?.includes(surface),
      context:{realm:()=>view,surface:()=>surface,
        visible:id=>!!s.counts[id]&&(ITEMS[id]?.realm||'overworld')===view,
        workingVisible:()=>s.community.residents.some(r=>r.job!=='idle'),
        railRunning:()=>s.counts.M16>0&&(s.transport?.realms?.[view]?.delivery||0)>0,
        runningMachine:()=>s.grid.last?.loads.some(l=>l.realm===view&&l.actual>0),
        musicPlaying:()=>!!s.counts.L1&&s.sound,
        affordableTarget:()=>{const id=earlyTarget(s);return ITEMS[id]?{id,name:ITEMS[id].name}:null;},
      },
    };
    advanceNarrative(s,profile==='slow-read'?.65:1,options);
  }
  function finish(s,purchases){
    // Let the final sentence finish after the win; no extra economic ticks.
    for(let i=0;i<35;i++){s.play++;tick(s,s.play,{purchases});}
    const spoken=new Set(events.filter(e=>e.phase==='spoken').map(e=>e.id));
    return {profile,method:'真实购买模拟 + 模拟可见场景/菜单/回执；慢读使用 0.65 倍阅读时钟；不等同真人体验。',
      events,spoken:[...spoken],completed:s.completed,
      pending:[...NARRATION,...IDLE_LINES].filter(r=>s.narrative.eligibleAt[r.id]!==undefined&&!s.narrative.seen.includes(r.id)).map(r=>r.id),
      phases:events.reduce((tot,e)=>(tot[e.phase]=(tot[e.phase]||0)+1,tot),{})};
  }
  return {tick,finish};
}

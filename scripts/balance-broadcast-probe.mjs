// Paired investment from an organically earned checkpoint; no injected money.
import {writeFileSync,mkdirSync} from 'node:fs';
import {simulate,ROUTES} from './balance-v2-joint-readable.mjs';
const engine=process.env.V2_ENGINE;
const {game,catalog,power,residents,research}=await import(`../docs/v2.0.0/simulation/${engine}.mjs`);
const out=`docs/v2.0.0/simulation/broadcast-stages/${engine}-probe`;mkdirSync(out,{recursive:true});
let checkpoint=null;const stages=[];let last='';
const result=simulate(ROUTES.find(r=>r.id==='livestream-first'),{stopAtNether:true,limit:5400,afterIncome(s,t){
 const c=s.research.completed,stage=!s.counts.L2?'none':c.modern&&c.streaming?'modern':c.streaming?'streaming':c.television?'television':'radio';
 if(stage!==last){stages.push({at:t,stage,viewers:s.live.viewers,liveRate:game.rates(s).live,money:s.money});last=stage;writeFileSync(`${out}/${stage}.json`,JSON.stringify(s));}
 if(!checkpoint&&!s.counts.L2&&c.broadcasting&&s.money>=game.price(s,catalog.ITEMS.L2)&&game.unlocked(s,catalog.ITEMS.L2)&&game.sites(s,'overworld',null,'L2').length)checkpoint=structuredClone(s);
}});
if(!checkpoint)throw Error('No naturally affordable broadcast checkpoint');
function run(withRadio){
 const s=structuredClone(checkpoint),money=s.money,start=s.total,live=s.liveIncome,production=s.productionIncome,initialPower=power.powerSnapshot(s);
 let paid=0;if(withRadio){const r=game.buy(s,'L2');if(!r.ok)throw Error(r.reason);paid=r.cost;power.connectAll(s);}
 let recoup=null;const history=[];for(let t=1;t<=900;t++){game.advance(s,1);if(t%2===0)game.mine(s,()=>1);if(t%15===0){power.connectAll(s);for(const key of ['farm','wool','treasure'])if(s.harvest[key]>=1)game.action(s,key);}if(t%60===0)history.push({seconds:t,wallet:s.money-money,gross:s.total-start,live:s.liveIncome-live,production:s.productionIncome-production,rate:game.rates(s).live,viewers:s.live.viewers,supply:power.powerSnapshot(s).supply,demand:power.powerSnapshot(s).demand});}
 return {paid,initialPower:{supply:initialPower.supply,demand:initialPower.demand},history};
}
const control=run(false),radio=run(true),paired=radio.history.map((r,i)=>({...r,netOverControl:r.wallet-control.history[i].wallet,extraEarned:r.gross-control.history[i].gross}));
const {state,...report}=result;writeFileSync(`${out}/route.json`,JSON.stringify(report,null,2));writeFileSync(`${out}/investment.json`,JSON.stringify({engine,method:'Same naturally earned pre-studio state, buy L2 or retain money; 15 foreground minutes with identical tapping/harvest/power connection, no later purchases or invented host. Return is marginal versus keeping funds; not a whole-route ROI.',checkpointPlay:checkpoint.play,stages,paid:radio.paid,control,paired,recoupAt:paired.find(r=>r.netOverControl>=0)?.seconds??null},null,2));console.log(JSON.stringify({engine,seconds:result.seconds,stages,paid:radio.paid,net15:paired.at(-1).netOverControl,recoupAt:paired.find(r=>r.netOverControl>=0)?.seconds??null}));

import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
const {game:G,power:P,upgrades:U,catalog:C}=await import('../docs/v2.0.0/simulation/power-staged-60-linear.mjs');
const raw=JSON.parse(readFileSync('docs/v2.0.0/simulation/power-p3-linear/no-livestream-save.json'));
const base=()=>G.restore(raw,0), results=[];
function record(name,s,expected){const p=P.powerSnapshot(s);expected(p);results.push({name,supply:p.supply,demand:p.demand,actual:p.consumption,stored:p.stored,loss:p.lineLoss,loads:p.loads.map(l=>({id:l.id,state:l.state,rated:l.rated,actual:l.actual})),pass:true});}
{
 const s=base();s.buffers.overworld.raw=U.storageCapacity(s,'overworld','raw');s.buffers.overworld.goods=U.storageCapacity(s);
 record('满仓：正常待机，不制造额外耗电',s,p=>{assert.equal(p.loads.find(x=>x.id==='M9').rated,0);assert.equal(p.loads.find(x=>x.id==='M2').rated,0);});
}
{
 const s=base();s.buffers.overworld.raw=0;s.buffers.overworld.goods=0;s.facilityStorage.M1=s.facilityStorage.M9=true;
 record('缺料：熔炉不空耗',s,p=>assert.equal(p.loads.find(x=>x.id==='M2').rated,0));
}
for(const mode of['off','disconnect']){
 const s=base();assert.ok((mode==='off'?P.toggleDevice(s,'M2'):P.disconnectGrid(s,'M2')).ok);
 record(mode==='off'?'设备暂停':'未接入',s,p=>{const l=p.loads.find(x=>x.id==='M2');assert.equal(l.actual,0);assert.equal(l.state,mode==='off'?'off':'not-connected');});
}
{
 const s=base(),ids=P.powerSnapshot(s).sources.map(x=>x.id);for(const id of ids)P.toggleDevice(s,id);s.energy=0;s.grid.crank=0;
 record('电池耗尽且供能不足',s,p=>{assert.equal(p.supply,0);assert.equal(p.consumption,0);assert.ok(p.loads.some(l=>l.state==='no-power'));});
 G.advance(s,60);for(const id of ids)P.toggleDevice(s,id);
 record('重新供电：即时恢复，储能开始回升',s,p=>{assert.ok(p.supply>0);assert.ok(p.consumption>0);assert.ok(p.stored>0);});
}
{
 const s=base(),before=P.powerSnapshot(s);const ids=['M2','M9'];let waited=0,spent=0;
 const budget=()=>ids.reduce((sum,id)=>sum+G.price(s,C.ITEMS[id]),0);
 while(s.money<budget()&&waited<1800){G.advance(s,1);waited++;}
 for(const id of ids){const cost=G.price(s,C.ITEMS[id]),r=G.buy(s,id);assert.ok(r.ok,r.reason);spent+=cost;}
 const after=P.powerSnapshot(s);assert.ok(after.demand>before.demand);results.push({name:'集中扩建：真实购买两项工业升级',waited,spent,beforeDemand:before.demand,afterDemand:after.demand,supply:after.supply,pass:true});
}
{
 const s=base(),before=JSON.stringify(s);assert.equal(G.advance(s,120,{offline:true}),0);assert.equal(JSON.stringify(s),before);results.push({name:'后台不推进生产及电池',pass:true});
}
{
 const s=base(),startMoney=s.money,startTotal=s.total,purchases=[];
 for(let t=0;t<900;t++){
   G.advance(s,1);
   if(t%15)continue;
   const item=['M6','M7','M15'].map(id=>C.ITEMS[id]).filter(i=>G.unlocked(s,i)&&G.n(s,i.id)<i.max&&s.money>=G.price(s,i)).sort((a,b)=>G.price(s,a)-G.price(s,b))[0];
   if(item){const cost=G.price(s,item);if(G.buy(s,item.id).ok){P.connectAll(s);purchases.push({at:t,id:item.id,cost});}}
 }
 const spent=purchases.reduce((sum,x)=>sum+x.cost,0),p=P.powerSnapshot(s);
 assert.ok(Math.abs(s.money-startMoney-(s.total-startTotal-spent))<1e-5);
 assert.ok(p.supply>p.demand*2);
 results.push({name:'主动大量建设电站：允许过剩，费用真实扣除',intentionalOverbuild:true,purchases,spent,supply:p.supply,demand:p.demand,spilled:s.grid.spilled-raw.grid.spilled,pass:true});
}
writeFileSync('docs/v2.0.0/simulation/POWER-SCENARIOS.json',JSON.stringify({method:'Scenario fixtures cloned from a genuinely earned candidate save. Full/empty buffers and disabled devices are explicit stress setup, never counted in normal-route income. Purchases spend earned money via the actual buy API; foreground ticks handle all generation and settlement.',results},null,2)+'\n');
console.log(results.map(x=>({name:x.name,pass:x.pass,supply:x.supply,demand:x.demand})));

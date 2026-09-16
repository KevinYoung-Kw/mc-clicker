import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { restore, mine, advance, rates, buy } from '../src/game.js';
import { fresh } from './helpers/first-time-game.js';
import { miningCombo, canHoldMine, decayMiningCombo } from '../src/mining-combo.js';
import { WEB_ITEMS } from '../src/web-catalog.js';
import { buyWeb, equipWeb, resetWeb } from '../src/presentation.js';
import { catalogLevel, tierContents, appearanceAvailable } from '../src/appearance-growth.js';
import { ensureCommunity, assignJob } from '../src/residents.js';
import { marketService, creditMarketSale } from '../src/market-work.js';
import { mineSite } from '../src/mine-model.js';
import { decorationStall } from '../src/decoration-stall-model.js';
import { currentNarration, advanceNarrative } from '../src/narrative.js';

test('tap combo and displayed multiplier use the paid hit; release decays smoothly to base',()=>{
 const s=fresh();s.play=1;mine(s,()=>1);
 for(let k=0;k<15;k++){s.play+=.2;const before=s.money;const hit=mine(s,()=>1);assert.equal(hit.value,miningCombo(s).multiplier);assert.ok(Math.abs(s.money-before-hit.value)<1e-8);}
 assert.equal(miningCombo(s).multiplier,1.6);
 s.play+=.75;decayMiningCombo(s,.75);const partial=miningCombo(s).multiplier;
 assert.ok(partial>1&&partial<1.6);
 s.play+=3;decayMiningCombo(s,3);assert.equal(rates(s).click,1);
 const a=fresh(),b=fresh();for(const x of[a,b]){x.combo=15;x.play=1;x.lastClick=1;}
 a.play+=1.6;decayMiningCombo(a,1.6);for(let k=0;k<16;k++){b.play+=.1;decayMiningCombo(b,.1);}
 assert.ok(Math.abs(a.combo-b.combo)<1e-8);
 assert.equal(canHoldMine(s),false);s.counts.T2=1;assert.equal(canHoldMine(s),false);s.counts.T3=1;assert.equal(canHoldMine(s),true);
});
test('three stall levels sell 13,31,46 goods, upgrade in place and preserve legacy stock',()=>{
 const s=fresh();Object.assign(s.counts,{V1:1,T1:1,V2:1,V3:1,X2:1});s.money=1e8;s.placements.X2={realm:'overworld',x:2,z:2};
 assert.deepEqual([1,2,3].map(x=>tierContents(x).length),[13,31,46]);
 assert.equal(buyWeb(s,'web-theme-end').ok,false);assert.equal(buyWeb(s,'web-icon-grass').ok,true);
 const location={...s.placements.X2},before=s.money;
 assert.ok(buy(s,'X2').ok);assert.deepEqual(s.placements.X2,location);assert.equal(before-s.money,3000);
 assert.ok(buyWeb(s,'web-theme-backpack').ok);assert.equal(buyWeb(s,'web-theme-end').ok,false);
 assert.ok(buy(s,'X2').ok);assert.ok(buyWeb(s,'web-theme-end').ok);assert.equal(buy(s,'X2').ok,false);
 const r=restore(s);assert.equal(catalogLevel(r),3);assert.ok(equipWeb(r,'web-theme-end'));resetWeb(r);assert.ok(r.webAppearance.owned['web-theme-end']);
 const old=fresh();old.counts.X2=1;old.webAppearance.version=1;old.money=1e6;
 const migrated=restore(old);assert.equal(catalogLevel(migrated),3);assert.ok(WEB_ITEMS.filter(i=>!i.requiredStallLevel).every(i=>appearanceAvailable(migrated,i)));assert.equal(catalogLevel(restore(migrated)),3);
 const current=fresh();current.counts.X2=1;assert.equal(catalogLevel(restore(current)),1);
});
test('merchant arrives through real navigation, affects trade, retains B and earns only actual sales',()=>{
 const s=fresh();Object.assign(s.counts,{T1:1,V1:1,V2:1,V3:1,T7:1});s.placements.V3={x:1.8,z:1.8,realm:'overworld'};
 s.chunks.overworld=[{x:0,z:0},{x:1,z:0},{x:0,z:1},{x:1,z:1}];ensureCommunity(s);
 const r=s.community.residents[0],base=rates(s).base,trade=rates(s).regions.overworld.trade;
 assert.ok(assignJob(s,r.id,'merchant').ok);assert.equal(marketService(s).factor,1);assert.equal(rates(s).base,base);
 for(let t=0;t<100&&marketService(s).factor===1;t++)advance(s,.2);
 assert.ok(marketService(s).factor>1,JSON.stringify({pos:[r.x,r.z],path:r.path,status:r.status}));assert.ok(rates(s).regions.overworld.trade>trade);
 const before=s.money,job=r.jobEarned;
 const share=creditMarketSale(s,120);assert.ok(Math.abs((r.jobEarned-job)-120*share)<1e-8);assert.equal(s.money,before,'credit does not mint money twice');
 assert.equal(creditMarketSale(s,0),0);
 assert.ok(assignJob(s,r.id,'idle').ok);assert.equal(marketService(s).factor,1);assert.equal(rates(s).base,base);
 assert.ok(assignJob(s,r.id,'merchant').ok);assert.equal(restore(s).community.residents[0].job,'merchant');
});
test('quarry rock cells never overlap and stall tiers visibly add fixed-size structures',()=>{
 const root=new T.Group(),animations=[];mineSite(root,fresh(),animations);root.updateMatrixWorld(true);const cells=[];
 root.traverse(m=>{if(m.userData.facilityPart==='quarry-cell')cells.push(new T.Box3().setFromObject(m));});
 for(let i=0;i<cells.length;i++)for(let j=i+1;j<cells.length;j++)assert.ok(['x','y','z'].some(d=>Math.min(cells[i].max[d],cells[j].max[d])-Math.max(cells[i].min[d],cells[j].min[d])<1e-7),'rock cells overlap');
 const counts=[];for(const level of [1,2,3]){const g=decorationStall(new T.Group(),level);counts.push(g.children.length);const box=new T.Box3().setFromObject(g);assert.ok(box.max.y<1.7);assert.ok(box.max.x-box.min.x<1.4);}
 assert.ok(counts[0]<counts[1]&&counts[1]<counts[2]);
});
test('postal upgrades and iron hold guidance retire when obsolete and do not flood legacy saves',()=>{
 const s=fresh();s.guidance.info=true;s.narrative.companionsShown=true;s.narrative.seen=['rescued','companions','friend','mail-income'];s.counts.V18=1;s.postalIncome=5;s.play=120;
 advanceNarrative(s,.2);assert.equal(currentNarration(s)?.id,'facility-upgrade');
 s.mail.postalLevel=2;advanceNarrative(s,.2);assert.notEqual(currentNarration(s)?.id,'facility-upgrade');
 const old=fresh();old.narrative.cadenceVersion=3;Object.assign(old.counts,{T3:1,V18:1,V3:1,V1:1});old.postalIncome=1;
 const r=restore(old);for(const id of ['camera-controls','iron-hold','facility-upgrade','market-work'])assert.ok(r.narrative.seen.includes(id),id);
});

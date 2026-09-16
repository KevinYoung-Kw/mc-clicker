import test from 'node:test';
import assert from 'node:assert/strict';
import {fresh,restore,buy,advance,emit,rates,collectGift,settleOffline} from '../src/game.js';
import {broadcastStage,broadcastAudienceLimit} from '../src/broadcasting.js';
import {researchRequirements,researchStatus,startResearch} from '../src/research.js';
import {connectAll,setAutoConnect,toggleDevice} from '../src/power.js';
import {encodePersistentSave,decodeSave} from '../src/save-code.js';
import {persistentSave} from '../src/save-persistent.js';
import {broadcastShopItems,broadcastStageMarkup} from '../src/broadcasting-ui.js';
import {CATALOG} from '../src/catalog.js';
import {narrationLines} from '../src/narrative.js';
function village(){
 const raw=fresh(0);raw.money=2e6;
 raw.counts={T1:1,V1:9,V3:2,V11:1,L1:1,M5:1,M6:1,M7:3,M2:2,M9:2,M8:1};
 raw.chunks.overworld=Array.from({length:9},(_,i)=>({x:i%3-1,z:Math.floor(i/3)-1}));
 raw.research.completed={'basic-power':true,industrial:true};raw.research.milestones.industrialSale=true;
 const s=restore(raw,0);setAutoConnect(s,true);connectAll(s);return s;
}
function radio(){const s=village();assert.equal(startResearch(s,'broadcasting').ok,true);assert.equal(buy(s,'L2').ok,true);connectAll(s);return s;}
function television(s){assert.equal(startResearch(s,'television').ok,true);assert.equal(buy(s,'L3').ok,true);}
function streaming(s){television(s);assert.equal(startResearch(s,'automation').ok,true);assert.equal(startResearch(s,'streaming').ok,true);}
test('industrial broadcasting is affordable without modern; starting radio pays once and opens a real room',()=>{
 const s=village(),money=s.money;assert.equal(s.research.completed.modern,undefined);
 assert.deepEqual(researchRequirements(s,'L2'),['完成广播技术']);assert.equal(buy(s,'L2').ok,false);
 assert.equal(startResearch(s,'broadcasting').cost,8000);assert.equal(buy(s,'L2').cost,24000);assert.equal(s.money,money-32000);
 assert.ok(s.placements.L2);assert.ok(s.studio);assert.equal(broadcastStage(s).id,'radio');
 assert.equal(buy(s,'L4').cost,6400);assert.equal(buy(s,'L3').ok,false);assert.deepEqual(researchRequirements(s,'L2'),['完成电视技术']);
});
test('television and streaming follow industrial progress; modern remains independent of broadcasting',()=>{
 const s=radio();delete s.research.milestones.industrialSale;assert.equal(startResearch(s,'television').ok,false);s.research.milestones.industrialSale=true;
 television(s);assert.equal(broadcastStage(s).id,'television');assert.equal(buy(s,'L2').cost,192000);assert.equal(buy(s,'L5').ok,false);
 assert.equal(startResearch(s,'streaming').ok,false);assert.equal(startResearch(s,'automation').ok,true);assert.equal(startResearch(s,'streaming').ok,true);
 assert.equal(broadcastStage(s).id,'streaming');assert.equal(buy(s,'L5').ok,true);assert.equal(buy(s,'L6').ok,true);assert.equal(buy(s,'L8').ok,false);
 s.counts.M2=3;assert.equal(startResearch(s,'modern').ok,true);assert.equal(broadcastStage(s).id,'modern');assert.deepEqual(researchRequirements(s,'L8'),[]);
 const independent=village();independent.counts.M2=3;startResearch(independent,'automation');assert.equal(researchStatus(independent,'modern').kind,'ready');startResearch(independent,'modern');assert.deepEqual(researchRequirements(independent,'N1'),[]);assert.equal(independent.counts.L2||0,0);
});
test('audience growth, event spikes and payments respect stage caps, while research increases real income',()=>{
 const s=radio();s.live.viewers=180;const before=rates(s).live;
 for(let i=0;i<30;i++)emit(s,'harvest','丰收');assert.equal(s.live.viewers,180);advance(s,1);assert.equal(s.live.viewers,180);assert.ok(s.liveIncome>0);
 television(s);assert.ok(rates(s).live>before);s.live.viewers=450;emit(s,'harvest','丰收');assert.equal(s.live.viewers,450);
 startResearch(s,'automation');startResearch(s,'streaming');s.live.viewers=1000;emit(s,'harvest','丰收');assert.equal(s.live.viewers,1000);assert.ok(broadcastAudienceLimit(s)<=1000);
 toggleDevice(s,'L2',false);const income=s.liveIncome;advance(s,5);assert.equal(rates(s).live,0);assert.equal(s.liveIncome,income);
 const money=s.money;settleOffline(s);assert.equal(s.money,money);
});
test('gift cash is stage-adjusted, paid exactly once, and survives export',()=>{
 const s=radio();streaming(s);buy(s,'L6');connectAll(s);s.live.giftClock=25;advance(s,1);assert.ok(s.live.gifts.length);
 const expected=restore(persistentSave(s),0),actual=restore(decodeSave(encodePersistentSave(s,'broadcast-test',1)).save,0);
 const gift=actual.live.gifts[0];assert.deepEqual(actual.live.gifts,expected.live.gifts);const money=actual.money;assert.equal(collectGift(actual,gift.id),gift.value);assert.equal(actual.money,money+gift.value);assert.equal(collectGift(actual,gift.id),0);
});
test('all broadcast stages persist through JSON and portable save without becoming legacy studios',()=>{
 const s=radio();for(const stage of ['radio','television','streaming','modern']){
  if(stage==='television')television(s);if(stage==='streaming'){startResearch(s,'automation');startResearch(s,'streaming');}if(stage==='modern'){s.counts.M2=3;startResearch(s,'modern');}
  for(const raw of [JSON.parse(JSON.stringify(s)),decodeSave(encodePersistentSave(s,'broadcast-test',1)).save]){const r=restore(raw,0);assert.equal(broadcastStage(r).id,stage);assert.equal(r.live.legacyBroadcast,false);assert.equal(r.money,s.money);assert.deepEqual(r.research.completed,s.research.completed);}
 }
});
test('pre-stage studios and already-paid broadcast research keep original earnings and equipment eligibility on repeated import',()=>{
 for(const purchased of [true,false]){const raw=radio();if(!purchased)delete raw.counts.L2;delete raw.live.broadcastVersion;delete raw.live.legacyBroadcast;raw.live.viewers=2500;
  let s=restore(raw,0);assert.equal(s.live.legacyBroadcast,true);assert.equal(broadcastStage(s).id,'modern');assert.equal(researchStatus(s,'television').kind,'complete');assert.equal(startResearch(s,'television').ok,false);for(const id of ['L3','L5','L8','L9','L10','L12'])assert.deepEqual(researchRequirements(s,id),[]);
  if(purchased){connectAll(s);const expected=2500**.72*3*rates(s).electricity.perDevice.L2*(1+s.live.heat/50);assert.ok(Math.abs(rates(s).live-expected)<1e-8);}
  const money=s.money;s=restore(decodeSave(encodePersistentSave(s,'broadcast-test',1)).save,0);assert.equal(s.live.legacyBroadcast,true);assert.equal(s.money,money);assert.equal(s.live.viewers,2500);
 }
 const raw=village();delete raw.live.broadcastVersion;assert.equal(restore(raw,0).live.legacyBroadcast,false);
});
test('the room only shows current/next-stage equipment, with an accessible research destination',()=>{
 const s=radio(),items=CATALOG.filter(i=>/^L/.test(i.id)&&!['L1','L2'].includes(i.id));
 assert.deepEqual(broadcastShopItems(s,items).map(i=>i.id),['L3','L4']);assert.match(broadcastStageMarkup(s),/data-broadcast-research="television"/);assert.match(broadcastStageMarkup(s),/180 位听众/);
 s.counts.L9=1;assert.ok(broadcastShopItems(s,items).some(i=>i.id==='L9'),'never hide already purchased assets');
});
test('a real encoded save image carries streaming research and legacy entitlement without changing the frozen format',async()=>{
 const {archiveFromCode,codeFromArchive,embedSaveImage,extractSaveImage}=await import('../src/save-image-codec.js');
 const {makeSaveTexture}=await import('../src/save-image-art.js');const s=radio();streaming(s);
 for(const legacy of [false,true]){s.live.legacyBroadcast=legacy;const code=encodePersistentSave(s,'broadcast-test',1),pixels=await embedSaveImage(makeSaveTexture(42),archiveFromCode(code));const r=restore(decodeSave(codeFromArchive(await extractSaveImage(pixels))).save,0);assert.equal(r.live.legacyBroadcast,legacy);assert.equal(r.research.completed.streaming,true);assert.equal(r.money,s.money);}
});

test('a paid historical broadcast project retains progress and does not grant its unfinished unlock',()=>{
 const raw=village();delete raw.live.broadcastVersion;delete raw.live.legacyBroadcast;
 raw.research.projects.broadcasting={paidCost:64000,progress:8,duration:20};raw.research.active='broadcasting';
 const s=restore(raw,0);assert.equal(s.live.legacyBroadcast,true);assert.equal(buy(s,'L2').ok,false);const money=s.money;
 assert.equal(startResearch(s,'broadcasting').cost,0);assert.equal(s.money,money);advance(s,12);assert.equal(s.research.completed.broadcasting,true);assert.equal(buy(s,'L2').ok,true);
});
test('radio narration adapts to already purchased seats and already assigned hosts',()=>{
 const s=radio();assert.match(narrationLines(s,'live')[0],/添张主持席/);s.counts.L4=1;assert.doesNotMatch(narrationLines(s,'live')[0],/添张/);
 s.community.residents.push({id:'speaker',job:'host',reserve:false});assert.doesNotMatch(narrationLines(s,'live')[0],/去村庄安排/);
});

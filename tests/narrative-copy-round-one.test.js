import test from 'node:test';
import assert from 'node:assert/strict';
import { buy, restore } from '../src/game.js';
import { fresh } from './helpers/first-time-game.js';
import {assignJob, newResident} from '../src/residents.js';
import {NARRATION, IDLE_LINES, advanceNarrative, currentNarration, reconcileNarrative} from '../src/narrative.js';

const ids=[...NARRATION,...IDLE_LINES].map(r=>r.id);
function state(keep=[]){
 const s=fresh();s.guidance.info=true;s.narrative.companionsShown=true;
 s.narrative.seen=ids.filter(id=>!keep.includes(id));return s;
}
function step(s,seconds,options={}){
 const lines=[];let last='';
 for(let i=0;i<seconds*5;i++){
  s.play+=.2;advanceNarrative(s,.2,options);
  const c=currentNarration(s),key=c?`${c.id}:${c.index}`:'';
  if(c&&last!==key)lines.push({...c,at:s.play});last=key;
 }
 return lines;
}
function resident(s){s.counts.V2=1;s.community.residents=[newResident(0)];}

test('rescue thanks and friends arrive promptly; price joke no longer interrupts opening',()=>{
 const s=fresh();s.money=10;
 assert.match(step(s,1)[0].text,/救命，商城来抓我了/);
 assert.ok(step(s,12).some(x=>x.text==='我不想待在货架里，快救救我！'));
 s.guidance.info=true;s.money=0;
 step(s,3.6,{available:false});
 const lines=step(s,24,{canPresent:r=>r?.shop===true});
 assert.deepEqual(lines.map(x=>x.text),[
  '哈哈，重见天日了。','谢谢你救我，介绍两个朋友：设置管声音和操作习惯，分享能发游戏链接、做世界纪念卡。',
  '我还有一个朋友也被商城关住了，叫「目标追踪」。','「目标追踪」会推荐下一件值得买的东西。要不去商城看看？它话比我少。',
 ]);
 assert.ok(s.narrative.companionsShown);
 assert.ok(!lines.some(x=>x.id==='rescue-price'));
 assert.ok(step(s,120).some(x=>x.id==='rescue-price'&&x.at>=120));
});

test('target tracker mentions wooden pick only while it is still unpurchased, including reload',()=>{
 const s=state(['goals']);s.guidance.goals=true;s.money=10;
 s.guidance.counter=true;s.guidance.nameplate=true;
 assert.match(step(s,1)[0].text,/下一个买木镐/);
 assert.ok(buy(s,'T1').ok);
 const loaded=restore(s);reconcileNarrative(loaded);
 assert.ok(loaded.narrative.seen.includes('goals'));
 assert.ok(step(loaded,30).every(x=>x.id!=='goals'));
});

test('tracker narration follows the current recommendation without pushing interface purchases early',()=>{
 for(const [counter,nameplate,laterName] of [[false,false,'绿宝石计数器'],[true,false,'世界铭牌'],[false,true,'绿宝石计数器']]){
  const early=state(['goals']);Object.assign(early.guidance,{goals:true,counter,nameplate});
  assert.ok(step(early,1)[0].text.includes('下一个买木镐'));
  const later=state(['goals']);Object.assign(later.guidance,{goals:true,counter,nameplate});later.counts.V2=1;
  assert.ok(step(later,1)[0].text.includes(`下一个买${laterName}`));
 }
 const land=state(['goals']);land.guidance.goals=true;land.counts.T1=1;
 assert.ok(NARRATION.find(r=>r.id==='goals').lines(land)[0].includes('下一个买开垦'));
});

test('mailbox teaches income and upgrading immediately after construction, even in its full screen panel',()=>{
 const s=state(['facility-upgrade','mail-income','mail']);s.money=1000;
 for(const id of ['T1','V1','V18'])assert.ok(buy(s,id).ok);
 assert.equal(s.postalIncome,0);
 step(s,3.6,{available:false});
 const lines=step(s,18,{canPresent:r=>r?.surfaces?.includes('mail')});
 assert.equal(lines[0].id,'facility-upgrade');assert.ok(lines[0].at<5);
 assert.match(lines[0].text,/邮政会自动赚绿宝石.*升级「邮政」/);
 assert.ok(lines.some(x=>x.text.includes('点开建筑看看有没有升级')));
 assert.ok(lines.every(x=>x.id!=='mail-income'));
 const learned=state(['facility-upgrade']);learned.counts.V18=1;learned.mail.postalLevel=2;
 assert.deepEqual(step(learned,20),[]);
});

test('one resident introduction adapts to existing jobs; buying the music equipment cancels the obsolete pitch',()=>{
 const s=state(['resident']);resident(s);
 const lines=step(s,25,{canPresent:r=>r?.surfaces?.includes('village')});
 assert.equal(lines[0].text,'看，来了个街溜子。');
 assert.ok(lines.some(x=>x.text.includes('300 颗绿宝石')));
 assert.ok(lines.some(x=>x.text.includes('有了唱片机，就能让闲着的村民当乐师')));
 const farm=state(['resident']);resident(farm);farm.counts.V4=1;
 const farmerLines=step(farm,15);
 assert.ok(farmerLines.some(x=>x.text.includes('农民空位')));
 assert.ok(farmerLines.every(x=>!x.text.includes('没什么岗位')&&!x.text.includes('300')));
 const buying=state(['resident']);resident(buying);step(buying,1);buying.counts.L1=1;
 assert.ok(step(restore(buying),20).every(x=>x.id!=='resident'));
});

test('buying villagers joke is a later quiet conversation, independent of assigning work',()=>{
 const s=state(['work']);resident(s);
 assert.deepEqual(step(s,239),[]);
 const lines=step(s,12);assert.equal(lines[0].id,'work');assert.ok(lines[0].at>=240);
 assert.equal(s.community.residents[0].job,'idle');
 assert.match(lines[0].text,/细思极恐/);
 const busy=state(['work']);resident(busy);busy.play=200;step(busy,70,{available:false});
 assert.deepEqual(step(busy,30),[]);
 assert.equal(step(busy,10)[0]?.id,'work');
});

test('vacancy teaching starts after three minutes, names the actual facility and stops when filled',()=>{
 const s=state(['vacancy:farmer']);resident(s);s.counts.V4=1;s.play=170;
 assert.deepEqual(step(s,15),[]);
 const lines=step(s,15);assert.equal(lines[0].id,'vacancy:farmer');
 assert.match(lines[0].text,/麦田.*农民/);
 assert.ok(lines.some(x=>x.text.includes('按工作地点')),'cooldown must not cancel its own second sentence');
 assert.ok(assignJob(s,s.community.residents[0].id,'farmer').ok);
 assert.ok(step(s,150).every(x=>x.id!=='vacancy:farmer'));
 const full=state(['vacancy:farmer']);resident(full);full.counts.V4=1;full.play=300;
 assignJob(full,full.community.residents[0].id,'farmer');
 assert.deepEqual(step(full,120),[]);
});

test('vacancy announcement cancels mid-sentence on assignment; unrelated jobs share the cooldown',()=>{
 const s=state(['vacancy:farmer','vacancy:musician']);resident(s);s.counts.V4=1;s.play=200;
 step(s,9);assert.equal(currentNarration(s)?.id,'vacancy:farmer');
 assignJob(s,s.community.residents[0].id,'farmer');
 step(s,1);assert.notEqual(currentNarration(s)?.id,'vacancy:farmer');
 s.counts.L1=1;
 assert.deepEqual(step(s,120).filter(x=>x.id==='vacancy:musician'),[],'expired advice is not played late after the shared cooldown');
 const loaded=restore(s);assert.equal(loaded.narrative.lastVacancyAt,s.narrative.lastVacancyAt);
 assert.ok(loaded.narrative.seen.includes('vacancy:musician'));
});

test('old saves do not reintroduce existing workplaces; new workplaces can still be explained',()=>{
 const s=state([]);resident(s);s.money=12345;s.play=500;s.counts.V4=1;s.narrative.cadenceVersion=5;
 s.narrative.seen=s.narrative.seen.filter(id=>!id.startsWith('vacancy:'));
 const loaded=restore(s);
 assert.equal(loaded.money,s.money);assert.deepEqual(loaded.community.residents.map(x=>[x.id,x.job]),s.community.residents.map(x=>[x.id,x.job]));
 assert.ok(loaded.narrative.seen.includes('vacancy:farmer'));
 assert.ok(!loaded.narrative.seen.includes('vacancy:musician'));
 assert.deepEqual(restore(loaded).narrative,loaded.narrative);
 loaded.counts.L1=1;
 assert.ok(step(loaded,30).some(x=>x.id==='vacancy:musician'));
});

test('vacancy board directions are taught once across professions and save reloads',()=>{
 const s=state(['vacancy:farmer','vacancy:musician']);resident(s);s.counts.V4=1;s.play=200;
 const first=step(s,30);assert.equal(first.filter(x=>x.text.includes('按工作地点')).length,1);
 assert.equal(s.narrative.vacancyGuideShown,true);
 const loaded=restore(JSON.parse(JSON.stringify(s)));loaded.play+=130;loaded.counts.L1=1;
 const later=step(loaded,30);assert.ok(later.some(x=>x.id==='vacancy:musician'));
 assert.ok(later.every(x=>!x.text.includes('按工作地点')));
 assert.equal(later.filter(x=>x.id==='vacancy:musician').length,1);
 // The history only keeps 32 entries; teaching memory must outlive that window.
 loaded.narrative.history=[];
 assert.equal(restore(JSON.parse(JSON.stringify(loaded))).narrative.vacancyGuideShown,true);
});

test('legacy completed vacancy teaching is remembered, skipped candidates are not counted as heard',()=>{
 const s=state(['vacancy:farmer']);resident(s);s.counts.V4=1;s.play=200;step(s,30);
 delete s.narrative.vacancyGuideShown;
 assert.equal(restore(JSON.parse(JSON.stringify(s))).narrative.vacancyGuideShown,true);
 s.narrative.history=[];
 assert.equal(restore(JSON.parse(JSON.stringify(s))).narrative.vacancyGuideShown,false);
});

test('interrupted vacancy teaching does not erase the tutorial for the next new job',()=>{
 const s=state(['vacancy:farmer','vacancy:musician']);resident(s);s.counts.V4=1;s.play=200;
 step(s,9);assert.equal(currentNarration(s)?.id,'vacancy:farmer');
 assignJob(s,s.community.residents[0].id,'farmer');step(s,1);
 assert.equal(s.narrative.vacancyGuideShown,false);
 s.play+=130;s.counts.L1=1;
 assert.equal(step(s,30).filter(x=>x.text.includes('按工作地点')).length,1);
});

test('reloading between vacancy sentences preserves both progress and once-only memory',()=>{
 const s=state(['vacancy:farmer']);resident(s);s.counts.V4=1;s.play=200;
 for(let i=0;i<100&&currentNarration(s)?.index!==1;i++)step(s,.2);
 assert.equal(currentNarration(s)?.index,1);
 const loaded=restore(JSON.parse(JSON.stringify(s)));
 assert.equal(currentNarration(loaded)?.index,1);
 step(loaded,10);assert.equal(loaded.narrative.vacancyGuideShown,true);
});

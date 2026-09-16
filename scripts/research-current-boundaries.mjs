// Observational research fixtures. They do not specify the desired future rules.
import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {fresh, buy, advance, earn, emit} from '../src/game.js';
import {ForegroundClock} from '../src/foreground.js';
import {requestTask, advanceOperations, taskState, taskStatus} from '../src/operations.js';
import {terminalTransfers} from '../src/dimensional.js';
import {storageCapacity, upgradeWork, buyUpgrade} from '../src/upgrades.js';
import {drillCapacity, furnaceCapacity} from '../src/facility-capacity.js';
import {upgradeComparison} from '../src/upgrade-comparison.js';

const root = new URL('../', import.meta.url);
const args=process.argv.slice(2), outIndex=args.indexOf('--out');
if(args.includes('--help')){console.log('node scripts/research-current-boundaries.mjs [--out report.json]\nPrints current results; writes only to an explicit output path. Historical reports are never overwritten by default.');process.exit(0);}
if(outIndex>=0&&!args[outIndex+1])throw Error('--out requires a path');
const out = outIndex>=0?pathToFileURL(resolve(args[outIndex+1])):null;
const files = ['src/game.js','src/foreground.js','src/operations.js','src/dimensional.js','src/upgrades.js','src/upgrade-catalog.js','src/facility-capacity.js','src/upgrade-comparison.js'];
const hash = path => crypto.createHash('sha256').update(fs.readFileSync(new URL(path,root))).digest('hex');
const round = n => Math.round(n*1e6)/1e6;
function clockCase(fps, active=true) {
  const s=fresh(); s.money=1000;
  for(const id of ['T1','V1','V18']) assert.equal(buy(s,id).ok,true,id);
  const money=s.money, clock=new ForegroundClock(0,active);
  let simulated=0;
  for(let i=1;i<=10*fps;i++){const dt=clock.step(i*1000/fps);simulated+=dt;advance(s,dt);}
  return {fps,active,wallSeconds:10,simulatedSeconds:round(simulated),postalEmeralds:round(s.money-money)};
}
function chorusCase(roots) {
  const s=fresh();s.counts.E4=4;s.counts.M4=1;
  if(roots){s.upgrades.levels['chorus-roots']=1;s.upgrades.revision=1;}
  s.harvest.chorus=1;
  const start=requestTask(s,'chorus');
  for(let i=0;i<40;i++){s.play+=.25;advanceOperations(s,.25,{earn,emit},{perDevice:{},automation:{}});}
  const t=taskState(s,'chorus');
  return {fixture:'isolated mature E4 Lv.4, M4 Lv.1, empty end raw storage; no other producers',roots,start,capacity:storageCapacity(s,'end','raw'),batchSize:20*4*(roots?1.5*3:1),elapsed:10,raw:s.buffers.end.raw,pendingHarvest:t.pendingHarvest||0,work:t.work,manual:t.manual,cycle:t.cycle,mature:s.harvest.chorus,status:taskStatus(s,'chorus')};
}
function chestCase(sources,disabled=false) {
  const s=fresh();Object.assign(s.counts,{E7:1,E2:1});s.endEyes=12;s.transfer='end';
  s.buffers.overworld.raw=100;if(sources===2)s.buffers.nether.raw=100;
  if(disabled)s.grid.disabled.push('E7');
  const sum=()=>Object.values(s.buffers).reduce((t,b)=>t+b.raw+b.goods,0),before=sum();
  const moved=terminalTransfers(s,1,{perDevice:{E7:1}});
  assert.equal(sum(),before,'Transfers must conserve inventory in the fixture');
  return {sources,disabled,seconds:1,moved,received:s.buffers.end.raw,totalBefore:before,totalAfter:sum()};
}
function upgradeCase(kind) {
  const s=fresh();s.money=1e10;
  const drill=kind==='drill';
  Object.assign(s.counts,drill?{M9:5,N11:1}:{M2:3,T3:1});
  Object.assign(s.upgrades.levels,drill?{'drill-steel':1,'drill-diamond':1,'drill-twin':1,'drill-cooling':1,'drill-outlet':1}:{'furnace-core':2,'furnace-lining':1,'furnace-blower':1,'furnace-feed':1});
  s.upgrades.revision=1;
  const id=drill?'drill-netherite':'furnace-core',owner=drill?'M9':'M2',capacity=drill?drillCapacity:furnaceCapacity;
  const before={capacity:capacity(s),workFactor:upgradeWork(s,owner)},comparison=upgradeComparison(s,id),purchase=buyUpgrade(s,id);
  assert.equal(purchase.ok,true);
  return {id,fixture:'isolated combination of installed upgrades; not a playthrough or ROI measurement',purchase,before,after:{capacity:capacity(s),workFactor:upgradeWork(s,owner)},comparison};
}
const report={date:new Date().toISOString(),version:JSON.parse(fs.readFileSync(new URL('package.json',root))).version,method:'Direct calls to current game functions with isolated states. Clock tests use real postal purchases; other states are injected boundary fixtures, not normal-play frequency estimates. No live/player save is loaded.',sourceHashes:Object.fromEntries(files.map(p=>[p,hash(p)])),foreground:[60,10,4,2,1].map(f=>clockCase(f)).concat(clockCase(60,false)),chorus:[chorusCase(false),chorusCase(true)],sharedTransfer:[chestCase(1),chestCase(2),chestCase(2,true)],upgrades:[upgradeCase('drill'),upgradeCase('furnace')]};
if(out){fs.mkdirSync(new URL('./',out),{recursive:true});fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');}console.log(JSON.stringify(report,null,2));

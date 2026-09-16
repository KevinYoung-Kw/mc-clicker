import test from 'node:test';
import assert from 'node:assert/strict';
import { freshResearch, restoreResearch, researchStatus, startResearch, pauseResearch, advanceResearch, researchRequirements, researchForItem, researchSpeed, RESEARCH_BY_ID } from '../src/research.js';

function village() {
  return { money: 500000, counts: { V11: 1, V4: 3, V3:2, M4: 1 }, research: {...freshResearch(),completed:{"basic-power":true}},
    housing: { homes: Array.from({ length: 6 }, (_, i) => ({ id: `home:${i}`, type: 'oak' })) },
    community: { residents: Array.from({ length: 6 }, (_, i) => ({ id: `resident-${i}`, job: 'idle', reserve: false })) },
    marketLedger: { receipts: [{ source: 'community:V4:wheat', realm: 'overworld', quantity: 4, money: 16 }] } };
}
test('industrial prerequisites require an established farming village, not just a wallet', () => {
  const s = village();
  assert.equal(researchStatus(s, 'industrial').kind, 'ready');
  s.counts.V4 = 1; s.housing.homes.pop(); s.community.residents[0].reserve = true; s.marketLedger.receipts = [];
  const status = researchStatus(s, 'industrial');
  assert.equal(status.kind, 'locked');
  assert.equal(status.requirements.length, 4);
  const before = s.money;
  assert.equal(startResearch(s, 'industrial').ok, false);
  assert.equal(s.money, before);
});
test('actual village receipts become a persistent prerequisite; raw production and zero-money receipts do not', () => {
  const s = village();
  s.marketLedger.receipts[0].source = 'production:M1';
  assert.ok(researchStatus(s, 'industrial').requirements.some(x => x.includes('成交')));
  s.marketLedger.receipts[0].source = 'community:V4:wheat'; s.marketLedger.receipts[0].money = 0;
  assert.ok(researchStatus(s, 'industrial').requirements.some(x => x.includes('成交')));
  s.marketLedger.receipts[0].money = 16; advanceResearch(s, 1); s.marketLedger.receipts = [];
  assert.equal(researchStatus(s, 'industrial').kind, 'ready');
  restoreResearch(s, JSON.parse(JSON.stringify(s)));
  assert.equal(researchStatus(s, 'industrial').kind, 'ready');
});
test('research progresses without a researcher and completes automatically with no extra click or payment', () => {
  const s = village(), cost = RESEARCH_BY_ID['cargo-tools'].cost, duration = RESEARCH_BY_ID['cargo-tools'].duration;
  assert.equal(startResearch(s, 'cargo-tools').cost, cost);
  assert.equal(s.money, 500000 - cost);
  advanceResearch(s, duration - 1);
  assert.equal(s.research.completed['cargo-tools'], undefined);
  assert.equal(advanceResearch(s, 1).completed, 'cargo-tools');
  assert.equal(s.research.active, null);
  assert.equal(researchStatus(s, 'cargo-tools').kind, 'complete');
  assert.equal(startResearch(s, 'cargo-tools').ok, false);
  assert.equal(s.money, 500000 - cost);
});
test('pause, resume, save and repeated start preserve payment and progress', () => {
  const s = village(); startResearch(s, 'cargo-tools'); advanceResearch(s, 5);
  const paidWallet = s.money;
  assert.equal(startResearch(s, 'cargo-tools').cost, 0);
  pauseResearch(s); advanceResearch(s, 40);
  assert.equal(s.research.projects['cargo-tools'].progress, 5);
  restoreResearch(s, JSON.parse(JSON.stringify(s)));
  assert.equal(s.research.active, null);
  assert.equal(startResearch(s, 'cargo-tools').cost, 0);
  assert.equal(s.research.projects['cargo-tools'].progress, 5);
  assert.equal(s.money, paidWallet);
});
test('modern depends on industrial and a drill, never on livestream ownership or viewers', () => {
  const s = village(); s.counts.M9 = 2;s.counts.M2=3;s.counts.M8=1;s.counts.L1=1;s.research.completed.automation=true;s.research.milestones.industrialSale=true;
  assert.equal(startResearch(s, 'modern').ok, false);
  startResearch(s, 'industrial'); advanceResearch(s, 100);
  assert.equal(researchStatus(s, 'modern').kind, 'ready');
  assert.equal(s.counts.L2, undefined);
  startResearch(s, 'modern'); advanceResearch(s, 100);
  assert.deepEqual(researchRequirements(s, 'N1'), []);
  assert.deepEqual(researchRequirements(s, 'L2'), ['完成广播技术']);startResearch(s,'broadcasting');assert.deepEqual(researchRequirements(s,'L2'),[]);
  assert.deepEqual(researchRequirements(s, 'V23'), []);
});
test('one optional researcher accelerates; multiple assigned researchers do not stack', () => {
  const s = village(); startResearch(s, 'cargo-tools');
  Object.assign(s.community.residents[0], {job: 'researcher', activity: 'working'}); Object.assign(s.community.residents[1], {job: 'researcher', activity: 'working'});
  assert.equal(researchSpeed(s).multiplier, 1.25);
  advanceResearch(s, 4);
  assert.equal(s.research.projects['cargo-tools'].progress, 5);
  s.community.residents.forEach(r => r.reserve = true);
  assert.equal(researchSpeed(s).multiplier, 1);
});
test('only work or an absent life phase grants researcher speed, including during rest travel', () => {
  const s = village(); Object.assign(s.community.residents[0], {job: 'researcher', activity: 'working'});
  s.life = { residents: { 'resident-0': { phase: 'work' } } };
  assert.equal(researchSpeed(s).multiplier, 1.25);
  for (const phase of ['rest', 'going-rest', 'returning', 'unknown', null]) {
    s.life.residents['resident-0'].phase = phase;
    assert.equal(researchSpeed(s).multiplier, 1);
  }
  delete s.life.residents['resident-0'].phase;
  assert.equal(researchSpeed(s).multiplier, 1.25);
});
test('only next book levels are gated; current paid books and basic logistics remain usable', () => {
  const s = village();
  assert.deepEqual(researchRequirements(s, 'V12'), []);
  s.counts.V12 = 1;
  assert.deepEqual(researchForItem(s, 'V12'), ['industrial']);
  s.research.completed.industrial = true; s.counts.V12 = 2;
  assert.deepEqual(researchRequirements(s, 'V12'), ['完成现代技术']);
  s.research.completed.modern = true; s.counts.V12 = 3;
  assert.ok(researchRequirements(s, 'V12').some(x => x.includes('烈焰')));
  s.counts.N4 = 1; assert.deepEqual(researchRequirements(s, 'V12'), []);
  for (const id of ['M1', 'M2', 'M4', 'M5', 'M6', 'V21']) assert.deepEqual(researchRequirements(village(), id), []);
});
test('master books open across real dimension milestones rather than all at the first master book', () => {
  const s = village(); s.research.completed = { industrial: true, modern: true }; s.counts.N11 = 1;
  assert.deepEqual(researchRequirements(s, 'V13'), []);
  for (const [level, prerequisite] of [[1, 'E8'], [2, 'E9'], [3, 'Z2']]) {
    s.counts.V13 = level;
    assert.equal(researchRequirements(s, 'V13').length, 1);
    s.counts[prerequisite] = 1;
    assert.deepEqual(researchRequirements(s, 'V13'), []);
  }
});
test('old saves preserve purchased facility eligibility but do not grant research to new worlds', () => {
  const s = village(); s.counts.M9 = 3; s.counts.V12 = 5;
  restoreResearch(s, { counts: s.counts });
  assert.deepEqual(s.research.completed, {});
  assert.deepEqual(researchRequirements(s, 'M9'), []);
  assert.equal(s.counts.V12, 5);
  assert.ok(researchRequirements(s, 'V12').length);
  const newWorld = { counts: {}, community: { residents: [] } };
  restoreResearch(newWorld, {});
  assert.deepEqual(newWorld.research.completed, {});
  assert.deepEqual(researchRequirements(newWorld, 'N1'), ['完成现代技术']);
});
test('pre-research schemas migrate only technologies justified by owned assets', () => {
  for (const version of [2, 5, 7]) {
    for (const [counts, expected] of [
      [{ V11: 1, V12: 1, M8: 1 }, {}],
      [{ M9: 1 }, { industrial: true }],
      [{ V12: 2 }, { industrial: true }],
      [{ V12: 3 }, { industrial: true, modern: true }],
      [{ V13: 1 }, { industrial: true, modern: true }],
      [{ L2: 1 }, { industrial: true, modern: true }],
      [{ M15: 1 }, { industrial: true, modern: true }],
      [{ N1: 1 }, { industrial: true, modern: true }],
      [{ E8: 1 }, { industrial: true, modern: true }],
    ]) {
      const s = village(); s.counts = counts;
      restoreResearch(s, { version, counts, money: 1e30 });
      assert.deepEqual(s.research.completed, {...expected,...(expected.industrial?{"basic-power":true,railway:true,automation:true}:{}),...(expected.modern?{broadcasting:true}:{})});
      assert.ok(researchRequirements(s, 'V24').includes('完成搬运工具'));
      assert.ok(researchRequirements(s, 'V22').includes('完成公共生活'));
    }
  }
  for (const raw of [{ version: 8, counts: { N1: 1 } }, { version: 7, counts: { N1: 1 }, research: freshResearch() }]) {
    const s = village(); restoreResearch(s, raw); assert.deepEqual(s.research.completed, {});
  }
});
test('restore retains an active paid quote and clamps progress without charging again', () => {
  const s = village();
  restoreResearch(s, { research: { version: 1, completed: {}, active: 'industrial', projects: { industrial: { paidCost: 2400, progress: 8, duration: 60 } } } });
  assert.equal(researchStatus(s, 'industrial').remaining, 52);
  const before = s.money; startResearch(s, 'industrial');
  assert.equal(s.money, before);
  advanceResearch(s, 52);
  assert.equal(researchStatus(s, 'industrial').kind, 'complete');
});
test('invalid projects, unknown technologies and invalid time cannot create free progress or corrupt money', () => {
  const s = village();
  restoreResearch(s, { research: { version: 1, completed: { cheat: true }, active: 'industrial', projects: { industrial: { paidCost: -1, progress: 999, duration: 20 }, cheat: { paidCost: 0, progress: 0, duration: 0 } } } });
  assert.deepEqual(s.research.projects, {}); assert.equal(s.research.active, null);
  const before = s.money;
  assert.equal(startResearch(s, 'cheat').ok, false);
  s.money = 1; assert.equal(startResearch(s, 'industrial').ok, false); s.money = before;
  startResearch(s, 'cargo-tools');
  for (const dt of [0, -1, NaN, Infinity]) assert.equal(advanceResearch(s, dt).advanced, 0);
  assert.equal(s.research.projects['cargo-tools'].progress, 0);
});
test('independent optional projects can be switched, resumed and restored without paying twice', () => {
  const s = village(); s.counts.M4 = 1; s.counts.V6 = 1;
  startResearch(s, 'cargo-tools'); advanceResearch(s, 5);
  assert.equal(startResearch(s, 'community-life').cost, 800); advanceResearch(s, 3);
  assert.equal(s.research.projects['cargo-tools'].progress, 5);
  const wallet = s.money;
  restoreResearch(s, JSON.parse(JSON.stringify(s)));
  assert.equal(s.research.active, 'community-life');
  assert.equal(startResearch(s, 'cargo-tools').cost, 0); advanceResearch(s, 15);
  assert.deepEqual(researchRequirements(s, 'V24'), []);
  assert.equal(startResearch(s, 'community-life').cost, 0); advanceResearch(s, 17);
  assert.deepEqual(researchRequirements(s, 'V22'), []);
  assert.equal(s.money, wallet);
  assert.equal(s.research.completed.industrial, undefined);
});
test('researcher must actually be working after travel and handover', () => {
  const s = village(), person = s.community.residents[0]; person.job = 'researcher';
  assert.equal(researchSpeed(s).multiplier, 1);
  person.activity = 'working'; person.path = [{x:1,z:1}];
  assert.equal(researchSpeed(s).multiplier, 1);
  person.path = []; person.handover = 1;
  assert.equal(researchSpeed(s).multiplier, 1);
  person.handover = 0;
  assert.equal(researchSpeed(s).multiplier, 1.25);
});

test('mainline permits complete immediately after one payment while optional branches retain short projects', () => {
  const s=village();
  assert.equal(RESEARCH_BY_ID.industrial.duration,0);assert.equal(RESEARCH_BY_ID.modern.duration,0);
  assert.equal(RESEARCH_BY_ID['cargo-tools'].duration,20);assert.equal(RESEARCH_BY_ID['community-life'].duration,20);
  assert.equal(startResearch(s,'industrial').cost,12000);assert.equal(s.research.completed.industrial,true);assert.equal(s.research.active,null);
  s.counts.M9=2;s.counts.M2=3;s.counts.M8=1;s.research.completed.automation=true;s.research.milestones.industrialSale=true;assert.equal(startResearch(s,'modern').cost,120000);assert.equal(s.research.completed.modern,true);
  assert.equal(s.money,500000-132000);assert.equal(startResearch(s,'modern').ok,false);
});
test('instant mainline permits do not silently pause an already paid optional project', () => {
  const s=village();startResearch(s,'cargo-tools');advanceResearch(s,5);
  assert.equal(startResearch(s,'industrial').ok,true);
  assert.equal(s.research.active,'cargo-tools');
  assert.equal(s.research.projects['cargo-tools'].progress,5);
  advanceResearch(s,15);
  assert.equal(s.research.completed['cargo-tools'],true);
});

test('基础动力在图书馆研究一次，开放手摇、红石火把、风车，不提前开放工业机器',()=>{
 const s=village();s.research=freshResearch();
 for(const id of ['M5','M6','M7'])assert.deepEqual(researchRequirements(s,id),['完成基础动力']);
 assert.equal(researchStatus(s,'basic-power').kind,'ready');const money=s.money;
 assert.equal(startResearch(s,'basic-power').cost,480);assert.equal(s.money,money-480);assert.equal(s.research.active,null);
 for(const id of ['M5','M6','M7'])assert.deepEqual(researchRequirements(s,id),[]);
 assert.deepEqual(researchRequirements(s,'M9'),['完成工业技术']);assert.equal(startResearch(s,'basic-power').ok,false);
 const saved=JSON.parse(JSON.stringify(s));restoreResearch(s,saved);assert.equal(s.money,money-480);assert.equal(s.research.completed['basic-power'],true);
});
test('旧档已购基础电源及已付款工业研发保留资格，新档不会自动领取',()=>{
 for(const id of ['M5','M6','M7']){const s=village();s.counts={[id]:2};restoreResearch(s,{counts:s.counts,research:freshResearch()});assert.equal(s.research.completed['basic-power'],true);assert.equal(s.counts[id],2);assert.deepEqual(researchRequirements(s,id),[]);}
 const s=village();restoreResearch(s,{counts:{},research:freshResearch()});assert.equal(s.research.completed['basic-power'],undefined);
 restoreResearch(s,{research:{version:1,active:'industrial',projects:{industrial:{paidCost:2400,progress:8,duration:60}}}});assert.equal(s.research.completed['basic-power'],true);assert.equal(s.research.projects.industrial.progress,8);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { restore } from '../src/game.js';
import { fresh } from './helpers/first-time-game.js';
import { NARRATION, IDLE_LINES, advanceNarrative } from '../src/narrative.js';
import { observeNarrativeTrace } from '../src/narrative-trace.js';

function scene() {
 const s=fresh(0);s.play=2000;s.guidance.info=true;s.guidance.notices=true;s.narrative.companionsShown=true;
 s.counts.N1=1;s.narrative.seen=[...NARRATION,...IDLE_LINES].filter(r=>r.id!=='nether').map(r=>r.id);return s;
}
test('first visit narration remains eligible behind a long menu and can resume on a later visit',()=>{
 const s=scene(),trace=[];observeNarrativeTrace(s,row=>trace.push(row));
 for(let i=0;i<70;i++){s.play++;advanceNarrative(s,1,{context:{realm:()=> 'nether'},canPresent:()=>false});}
 assert.equal(s.narrative.seen.includes('nether'),false);
 advanceNarrative(s,1,{context:{realm:()=> 'nether'}});assert.equal(s.narrative.current?.id,'nether');
 s.play++;advanceNarrative(s,1,{context:{realm:()=> 'overworld'}});assert.equal(s.narrative.seen.includes('nether'),false);
 const loaded=restore(JSON.parse(JSON.stringify(s)));observeNarrativeTrace(loaded,row=>trace.push(row));
 for(let i=0;i<25;i++){loaded.play++;advanceNarrative(loaded,1,{context:{realm:()=> 'nether'}});}
 assert.ok(loaded.narrative.history.some(h=>h.id==='nether'));
 assert.ok(trace.some(r=>r.id==='nether'&&r.reason==='panel-hidden'));
 assert.ok(trace.some(r=>r.phase==='completed'&&r.id==='nether'));
});
test('opt-in trace has no save or economy side effects and distinguishes obsolete recommendations',()=>{
 const s=fresh(0),baseline=structuredClone(s),trace=[];
 const stop=observeNarrativeTrace(s,row=>trace.push(row));
 s.counts.T1=baseline.counts.T1=1;s.counts.V1=baseline.counts.V1=1;
 for(let i=0;i<5;i++){s.play++;baseline.play++;advanceNarrative(s,1);advanceNarrative(baseline,1);}
 assert.deepEqual(s,baseline);assert.ok(trace.some(r=>r.id==='pick-use'&&r.reason==='condition-obsolete'));
 stop();const count=trace.length;advanceNarrative(s,1);assert.equal(trace.length,count);
});

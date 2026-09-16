import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { NARRATOR_MOODS, narratorDelivery } from '../src/narrator-prosody.js';
import { narratorScore, narratorSyllable, narratorSound, narratorPhrases, narratorReadingTime, NARRATOR_SYLLABLE_DURATION } from '../src/narrator-voice.js';
import { NARRATOR_COPY } from '../src/narrator-copy.js';
import { currentNarration } from '../src/narrative.js';
import { fresh } from './helpers/first-time-game.js';

test('shipping voice exactly matches the user-approved emotion-2 score',()=>{
  const approved=JSON.parse(readFileSync(new URL('../docs/v1.7/qa/narrator-prosody/emotion-2/audio-report.json',import.meta.url),'utf8'));
  for(const e of approved.examples){
    assert.equal(NARRATOR_COPY[e.id].lines[0],e.text);
    assert.deepEqual(narratorDelivery({id:e.id,index:0}),e.delivery);
    // The archived JSON represents -0 as 0; compare in its serialized domain.
    assert.deepEqual(JSON.parse(JSON.stringify(narratorScore(e.text,e.delivery))),e.notes,e.id);
    assert.deepEqual(narratorPhrases(e.text),e.phrases);
  }
});

test('emotions change intonation while preserving phrase timing and subtitle time',()=>{
  const text='这样，我还有两个朋友给你介绍一下。你要不要看看？';
  const basic=narratorScore(text),pitches=[];
  for(const mood of NARRATOR_MOODS){
    const notes=narratorScore(text,{mood});
    assert.deepEqual(notes.map(({at,tone})=>({at,tone})),basic.map(({at,tone})=>({at,tone})));
    assert.deepEqual(notes,narratorScore(text,{mood}),'repeatable, not random chatter');
    assert.ok(notes.every(n=>Number.isFinite(n.pitch)&&Math.abs(n.pitch)<=7&&Number.isInteger(n.pitch*2)));
    assert.ok(notes.at(-1).at+notes.at(-1).duration<narratorReadingTime(text));
    pitches.push(JSON.stringify(notes.map(n=>n.pitch)));
  }
  assert.equal(new Set(pitches).size,NARRATOR_MOODS.length);
  assert.deepEqual(narratorScore(text,{mood:'unknown'}),narratorScore(text,{mood:'plain'}));
});

test('the requested manual copy lowers only its family-secret phrase',()=>{
  const text=NARRATOR_COPY.manual.lines[0];
  assert.equal(text,'如果你还想知道更多内容，我这里还有一本操作指南，这可是家传秘诀。你要想看的话，可以去那里了解一下。');
  const notes=narratorScore(text,narratorDelivery({id:'manual'})),plain=narratorScore(text,{mood:'plain'});
  const secret=narratorPhrases(text).find(p=>p.text.includes('家传秘诀'));
  let changed=0;
  for(let i=0;i<notes.length;i++){
    const n=notes[i];
    if(n.at>=secret.at&&n.at<secret.end){assert.ok(n.pitch<plain[i].pitch);changed++;}
    else assert.deepEqual(n,plain[i]);
  }
  assert.ok(changed>2);
});

test('actual resident variants and per-line directions survive the narration data flow',()=>{
  const s=fresh();s.counts.V2=1;
  s.narrative.current={id:'resident',variant:'resident-no-music',index:0,elapsed:0,startedAt:0};
  assert.equal(narratorDelivery(currentNarration(s)).mood,'wry');
  s.narrative.current.index=1;
  assert.equal(narratorDelivery(currentNarration(s)).mood,'plain');
  s.narrative.current.index=2;
  assert.equal(narratorDelivery(currentNarration(s)).mood,'wry');
  assert.equal(narratorDelivery({id:'rescued',expression:'smirk'}).mood,'bright','line direction can differ from its static face');
  assert.equal(narratorDelivery({id:'event',expression:'thinking'}).mood,'thoughtful');
  assert.equal(narratorDelivery({id:'event',expression:'notice'}).mood,'urgent');
});

test('all copy has a bounded score; punctuation and long lines keep existing timing',()=>{
  for(const [id,entry] of Object.entries(NARRATOR_COPY))for(const [index,text] of (entry.lines||[]).entries()){
    const notes=narratorScore(text,narratorDelivery({id,index}));
    assert.ok(notes.every((n,i)=>Number.isFinite(n.pitch)&&n.duration>=.06&&n.duration<=.4&&(!i||n.at>=notes[i-1].at+notes[i-1].duration+.024)),id);
    for(const phrase of narratorPhrases(text))for(const note of notes.filter(n=>n.at>=phrase.at&&n.at<phrase.end))assert.ok(note.at+note.duration<=phrase.end+.001,'no join across punctuation: '+id);
    assert.ok(!notes.length||notes.at(-1).at+notes.at(-1).duration<narratorReadingTime(text),id);
  }
});

test('transposition moves the audible fundamental without changing the accepted C timbre duration or level',()=>{
  // Autocorrelation measures the rendered wave, independently of the score.
  const sr=24000;
  function fundamental(data){
    const correlations=[];
    for(let d=65;d<=165;d++){
      let sum=0,a=0,b=0;
      for(let i=600;i<1800;i++){sum+=data[i]*data[i+d];a+=data[i]**2;b+=data[i+d]**2;}
      correlations.push({lag:d,value:sum/Math.sqrt(a*b)});
    }
    // The first strong local peak is one period; a later double-period peak can
    // be marginally higher because lag is quantised to integer samples.
    const peak=correlations.find((p,i)=>i>0&&i<correlations.length-1&&p.value>.95&&p.value>correlations[i-1].value&&p.value>=correlations[i+1].value);
    assert.ok(peak,'rendered sound has a measurable fundamental');return sr/peak.lag;
  }
  const base=fundamental(narratorSyllable(sr,0));
  for(const rate of [24000,44100,48000])for(const pitch of [-7,-4,-2,0,2,4,7]){
    const data=narratorSyllable(rate,0,'reed',pitch);
    assert.equal(data.length,Math.ceil(rate*NARRATOR_SYLLABLE_DURATION));
    assert.equal(data[0],0);assert.ok(Math.abs(data.at(-1))<.0001);
    const rms=Math.sqrt(data.reduce((sum,x)=>sum+x*x,0)/data.length);
    assert.ok(Math.abs(rms-.245)<.001);assert.ok(Math.max(...data.map(Math.abs))<=.7);
    if(rate===sr)assert.ok(Math.abs(fundamental(data)/base-2**(pitch/12))<.025);
  }
});

test('connected speech has continuous sound at the join, soft passing sounds and stronger beats',()=>{
  const text=NARRATOR_COPY.manual.lines[0],score=narratorScore(text,narratorDelivery({id:'manual'}));
  const light=score.find(n=>n.kind==='light'),accent=score.find(n=>n.kind==='accent'),joined=score.find(n=>n.kind==='joined');
  assert.ok(light&&accent&&joined);
  assert.ok(light.duration<.09&&joined.duration>.2&&accent.duration>light.duration);
  const rms=data=>Math.sqrt(data.reduce((sum,x)=>sum+x*x,0)/data.length);
  for(const rate of [24000,44100,48000]){
    assert.ok(rms(narratorSound(rate,light))<rms(narratorSound(rate,accent))*.6);
    const wave=narratorSound(rate,joined),join=Math.round(joined.joinAt*rate);
    assert.ok(rms(wave.slice(join-50,join+50))>.04,'connected sounds have no silent restart');
    assert.equal(wave[0],0);assert.ok(Math.abs(wave.at(-1))<.0001);
    assert.ok(wave.every(Number.isFinite));assert.ok(Math.max(...wave.map(Math.abs))<.71);
    const maxJump=wave.reduce((max,x,i)=>i?Math.max(max,Math.abs(x-wave[i-1])):max,0);
    assert.ok(Math.abs(wave[join]-wave[join-1])<maxJump,'no special discontinuity at the linked syllable');
  }
});

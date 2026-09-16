import test from 'node:test';
import assert from 'node:assert/strict';
import { restore, advance, rates } from '../src/game.js';
import { fresh } from './helpers/first-time-game.js';
import { GameAudio } from '../src/game-audio.js';
import { setNarratorVoice } from '../src/records.js';
import { advanceNarrative, currentNarration, setNarrationEnabled, NARRATION, IDLE_LINES } from '../src/narrative.js';
import { narratorPresentation } from '../src/narrator-activity-ui.js';
import { narratorScore, narratorSyllable, narratorSound, narratorReadingTime, narratorPhrases, NARRATOR_VOICE_STYLES, NARRATOR_SYLLABLE_DURATION, NARRATOR_VOICE_GAIN } from '../src/narrator-voice.js';
import { NARRATOR_COPY } from '../src/narrator-copy.js';
import { narratorDelivery } from '../src/narrator-prosody.js';

const sentence='储物箱能多存些货，可存着不等于卖掉。我在商城待过，深有体会。';
function rig() {
  let s=fresh(42);s.counts.L1=1;s.guidance.info=true;s.records.playing=false;
  const node=()=>({connect(){},disconnect(){this.disconnected=true;},gain:{value:0}});
  const ctx={state:'running',sampleRate:48000,currentTime:0,destination:{},sources:[],
    createGain:node,createBuffer:(c,n)=>{const data=new Float32Array(n);return {getChannelData:()=>data};},
    createBufferSource(){const source={...node(),start(){this.started=true;},stop(){this.stopped=true;this.onended?.();}};this.sources.push(source);return source;},
    suspend(){this.state='suspended';return Promise.resolve();},resume(){this.state='running';return Promise.resolve();}};
  let created=0;
  const audio=new GameAudio({state:()=>s,context:()=>{created++;return ctx;}});
  const cue=elapsed=>({id:'haul-use',startedAt:0,index:0,text:sentence,elapsed,speaking:true});
  return {get s(){return s;},replace:next=>{s=next;},ctx,audio,cue,created:()=>created};
}
test('voice sketches have soft endpoints, matched RMS and mixing headroom',()=>{
  for(const style of NARRATOR_VOICE_STYLES)for(const sampleRate of [24000,44100,48000])for(let tone=0;tone<9;tone++){
    const data=narratorSyllable(sampleRate,tone,style);
    assert.equal(data[0],0);assert.ok(Math.abs(data.at(-1))<.0001);
    assert.ok(data.every(Number.isFinite));assert.ok(Math.max(...data.map(Math.abs))<.71);
    const rms=Math.sqrt(data.reduce((a,b)=>a+b*b,0)/data.length);
    assert.ok(Math.abs(rms-.245)<.001,'same RMS across all sketches and inflections');
    assert.ok(rms*.45*NARRATOR_VOICE_GAIN>.04);
    assert.ok(Math.max(...data.map(Math.abs))*NARRATOR_VOICE_GAIN<.35);
  }
  assert.notDeepEqual(narratorSyllable(24000,0,'murmur'),narratorSyllable(24000,0,'pixel'),'different spectra, not just different cadence');
});
test('Chinese controls phrase timing, with no one-character-to-one-sound mapping',()=>{
  const text='再攒够一块地的钱，就能往外盖东西了。这块草皮我已经看腻了。';
  const notes=narratorScore(text),phrases=narratorPhrases(text);
  assert.ok(notes.length<[...text].filter(c=>/\p{Script=Han}/u.test(c)).length);
  assert.ok(phrases.some(p=>p.text.includes('草皮')),'Chinese words stay together');
  assert.notEqual(narratorScore('你来看看。').at(-1).tone,narratorScore('你来看看？').at(-1).tone);
  const comma=narratorPhrases('甲乙，丙丁'),period=narratorPhrases('甲乙。丙丁');
  assert.ok(Math.abs(comma[1].at-comma[0].end-.26)<.001);
  assert.ok(Math.abs(period[1].at-period[0].end-.5)<.001);
  assert.deepEqual(narratorScore('甲乙……丙丁'),narratorScore('甲乙。丙丁'),'repeated punctuation does not stack long pauses');
  assert.equal(narratorScore('…… ↗ ◆').length,0,'symbols do not speak');
  assert.ok(narratorScore('MC Clicker').length<9,'English is not letter beeps');
});
test('all real copy fits its reading window without stacked sounds or accelerated long lines',()=>{
  for(const text of [...Object.values(NARRATOR_COPY).flatMap(x=>x.lines||[]),sentence.repeat(5),'短句。']){
    const notes=narratorScore(text);
    assert.ok(!notes.length||notes.at(-1).at+NARRATOR_SYLLABLE_DURATION<narratorReadingTime(text));
    assert.ok(notes.every((n,i)=>!i||n.at-notes[i-1].at>=NARRATOR_SYLLABLE_DURATION+.025));
  }
  const short=narratorScore(sentence),long=narratorScore(sentence.repeat(3));
  assert.deepEqual(short.map(n=>n.at),long.slice(0,short.length).map(n=>n.at));
});
test('narrator audio needs a purchased jukebox, a gesture and visible active subtitles',()=>{
  const r=rig();r.s.counts.L1=0;r.audio.unlock();
  assert.equal(r.audio.narrate(r.cue(.13)),false);assert.equal(r.created(),0);
  r.s.counts.L1=1;assert.equal(r.audio.narrate(r.cue(.4)),false);
  r.audio.unlock();r.audio.narrate(r.cue(.65));assert.equal(r.created(),1);
  const note=narratorScore(sentence)[3].at;
  assert.equal(r.audio.narrate(r.cue(note+.01)),true);const source=r.audio.narratorSource;
  r.audio.narrate(null);assert.ok(source.stopped&&source.disconnected);
  assert.equal(r.audio.narrate(r.cue(note+.01)),false,'same visible subtitle does not restart');
  r.audio.narrate({...r.cue(note+.3),speaking:false});assert.equal(r.audio.snapshot().narratorVoices,0);
});
test('mute and voice volume are independent of music, effects and text; first mute reacts once per save',()=>{
  const r=rig();r.audio.unlock();r.audio.narrate(r.cue(.13));
  const before=structuredClone(r.s);assert.equal(setNarratorVoice(r.s,false),true);r.audio.tick();
  assert.equal(r.audio.snapshot().narratorVoices,0);assert.equal(r.s.guidance.notices,true);
  assert.equal(r.s.audio.musicVolume,before.audio.musicVolume);assert.equal(r.s.audio.sfxVolume,before.audio.sfxVolume);
  assert.equal(r.audio.narrate(r.cue(.4)),false);
  const loaded=restore(r.s);assert.equal(loaded.audio.narratorVoice,false);assert.equal(loaded.narrative.voiceMuteReactionSeen,true);
  assert.equal(setNarratorVoice(loaded,true),false);assert.equal(setNarratorVoice(loaded,false),false);
  loaded.audio.narratorVolume=0;setNarratorVoice(loaded,true);assert.equal(loaded.audio.narratorVolume,.45);
  setNarratorVoice(r.s,true);r.s.audio.musicVolume=0;r.s.audio.sfxVolume=0;
  const nextNote=narratorScore(sentence).find(note=>note.at>.4);
  assert.equal(r.audio.narrate(r.cue(nextNote.at+.01)),true,'voice has its own bus');
  r.s.sound=false;r.audio.tick();assert.equal(r.audio.snapshot().narratorVoices,0);
});
test('background, import, long frames and repeated rendering never queue or stack syllables',()=>{
  const r=rig();r.audio.unlock();r.audio.narrate(r.cue(.13));
  r.audio.setActive(false);assert.equal(r.audio.snapshot().narratorVoices,0);
  r.audio.setActive(true);const count=r.ctx.sources.length;
  for(let i=0;i<30;i++)r.audio.narrate(r.cue(.13));assert.equal(r.ctx.sources.length,count);
  r.audio.narrate(r.cue(100));assert.equal(r.ctx.sources.length,count);
  r.audio.narrate({...r.cue(.13),startedAt:100});assert.equal(r.audio.snapshot().narratorVoices,1);
  r.replace(fresh());r.audio.tick();assert.equal(r.audio.snapshot().narratorVoices,0);
  assert.ok(r.ctx.sources.every(source=>source.stopped));
});
test('old preferences gain a voice default without unmuting existing sound or narration',()=>{
  const s=fresh();s.sound=false;s.guidance.notices=false;delete s.audio.narratorVolume;delete s.audio.narratorVoice;delete s.narrative.voiceMuteReactionSeen;
  const loaded=restore(s);assert.equal(loaded.sound,false);assert.equal(loaded.guidance.notices,false);
  assert.equal(loaded.audio.narratorVolume,.45);assert.equal(loaded.audio.narratorVoice,true);assert.equal(loaded.narrative.voiceMuteReactionSeen,false);
});
test('pausing narration and muting voice remain distinct through every combination and reload',()=>{
  const silent=fresh();silent.guidance.info=true;setNarrationEnabled(silent,false);
  assert.equal(setNarratorVoice(silent,false),false,'a paused narrator does not say it will keep writing');
  assert.equal(silent.narrative.voiceMuteReactionSeen,false);
  const r=rig();r.audio.unlock();setNarratorVoice(r.s,false);
  assert.equal(narratorPresentation(r.s).label,'只看字幕');
  assert.notEqual(narratorPresentation(r.s).expression,'muffled');
  setNarrationEnabled(r.s,false);r.audio.tick();
  assert.equal(narratorPresentation(r.s).label,'旁白已暂停');
  assert.equal(narratorPresentation(r.s).expression,'muffled');
  const loaded=restore(r.s);setNarrationEnabled(loaded,true);
  assert.equal(loaded.audio.narratorVoice,false,'resuming subtitles does not unmute voice');
  assert.equal(narratorPresentation(loaded).label,'只看字幕');
  setNarratorVoice(r.s,true);
  assert.equal(r.s.guidance.notices,false,'enabling voice does not resume paused narration');
  assert.equal(r.audio.narrate(r.cue(.13)),false);
  setNarrationEnabled(r.s,true);
  assert.equal(narratorPresentation(r.s).label,'正在值班');
  const nextNote=narratorScore(sentence).find(note=>note.at>.4);
  assert.equal(r.audio.narrate(r.cue(nextNote.at+.01)),true);
});
test('each sentence has a silent 1.5-second beat that survives reload, without hiding the subtitle',()=>{
  const s=fresh();s.guidance.info=true;s.counts.M5=1;
  s.narrative.seen=[...NARRATION,...IDLE_LINES].filter(r=>r.id!=='power-use').map(r=>r.id);
  advanceNarrative(s,.1);const first=currentNarration(s),duration=narratorReadingTime(first.text);
  s.narrative.current.elapsed=duration+.1;const loaded=restore(s),n=currentNarration(loaded);
  assert.equal(n.index,0);assert.equal(n.speaking,false);assert.equal(n.text,first.text);
  advanceNarrative(loaded,1);assert.equal(currentNarration(loaded).index,0);
  advanceNarrative(loaded,.3);assert.equal(currentNarration(loaded).index,0);
  advanceNarrative(loaded,.2);assert.equal(currentNarration(loaded).index,1);
  const paused=loaded.narrative.current.elapsed;advanceNarrative(loaded,1,{available:false});assert.equal(loaded.narrative.current.elapsed,paused);
});
test('voice and its one-time reaction never change income, jobs or purchases',()=>{
  const a=fresh(42);Object.assign(a.counts,{L1:1,V2:1,M5:1});const b=structuredClone(a);
  b.guidance.info=true;setNarratorVoice(b,false);b.audio.narratorVolume=.2;
  assert.deepEqual(rates(a),rates(b));advance(a,10);advance(b,10);
  assert.equal(a.money,b.money);assert.deepEqual(a.community.tasks,b.community.tasks);
});
test('the live player renders emotional scores, reuses bounded buffers and stops the previous syllable',()=>{
  const r=rig();r.audio.unlock();
  const line={id:'manual',text:NARRATOR_COPY.manual.lines[0],startedAt:1,index:0,speaking:true};
  for(const note of narratorScore(line.text,narratorDelivery(line))){
    assert.equal(r.audio.narrate({...line,elapsed:note.at+.01}),true);
    assert.deepEqual(r.audio.narratorSource.buffer.getChannelData(0),narratorSound(48000,note));
    assert.equal(r.ctx.sources.filter(s=>s.started&&!s.stopped).length,1);
  }
  const before=r.audio.narratorBuffers.size;
  for(const note of narratorScore(line.text,narratorDelivery(line)))r.audio.narrate({...line,startedAt:2,elapsed:note.at+.01});
  assert.equal(r.audio.narratorBuffers.size,before,'a repeated line reuses its sound buffers');
  for(let i=0;i<36;i++){
    const entry={id:'sample-'+i,text:sentence+i+'？',expression:['plain','smile','smirk','thinking','notice'][i%5],startedAt:3+i,index:0,speaking:true};
    for(const note of narratorScore(entry.text))r.audio.narrate({...entry,elapsed:note.at+.01});
  }
  assert.ok(r.audio.narratorBuffers.size<=64,'memory remains bounded across many different lines');
  assert.ok(r.audio.narratorBuffers.size>before,'different emotions did reach the cache');
  r.audio.setActive(false);assert.equal(r.ctx.sources.filter(s=>s.started&&!s.stopped).length,0);
});

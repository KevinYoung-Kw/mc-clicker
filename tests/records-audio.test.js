import test from "node:test";
import assert from "node:assert/strict";
import { fresh, restore, rates, advance, buy } from "../src/game.js";
import { RECORDS, ensureRecords, restoreRecords, buyRecord, selectRecord, setRecordMode } from "../src/records.js";
import { GameAudio } from "../src/game-audio.js";
import { readFileSync, existsSync } from "node:fs";

test("old saves keep total mute and receive exactly one free record with L1", () => {
  for (const version of [2,3,4,5,6]) {
    const old = fresh(); old.version=version; old.counts.L1=1; old.sound=false;
    delete old.records; delete old.audio;
    const s=restore(old); ensureRecords(s); ensureRecords(s);
    assert.deepEqual(s.records.owned,["meadow"]);
    assert.equal(s.sound,false); assert.equal(s.audio.musicVolume,.55);
  }
  const s=fresh();s.counts.V2=1;s.money=1000;
  assert.equal(buy(s,"L1").ok,true);
  assert.deepEqual(s.records.owned,["meadow"]);
});
test("records use fixed prices, reject duplicate and unaffordable purchases, and survive refresh", () => {
  const s=fresh();s.money=20000;
  assert.equal(buyRecord(s,"cavern").ok,false);
  s.counts.L1=1;ensureRecords(s);
  assert.equal(buyRecord(s,"cavern").cost,600);
  assert.equal(buyRecord(s,"cavern").ok,false);
  assert.equal(s.money,19400);
  s.money=2;assert.equal(buyRecord(s,"end").ok,false);assert.equal(s.money,2);
  assert.equal(selectRecord(s,"end"),false);
  assert.equal(selectRecord(s,"cavern"),true);
  s.records.playing=false;setRecordMode(s,"once");s.audio={musicVolume:.23,sfxVolume:.76};
  const saved=restore(JSON.parse(JSON.stringify(s)));
  assert.deepEqual(saved.records,s.records);assert.deepEqual(saved.audio,{...s.audio,narratorVolume:.45,narratorVoice:true});
});
test("the first successful jukebox purchase enables sound and playback, but never overwrites volume or later mute", () => {
  const s = fresh();
  s.sound = false; s.records.playing = false;
  s.audio = { musicVolume: .23, sfxVolume: .76 };
  s.counts.V2 = 1; s.money = 0;
  assert.equal(buy(s, "L1").ok, false);
  assert.equal(s.sound, false); assert.equal(s.records.playing, false);
  s.money = 10000;
  const result = buy(s, "L1");
  assert.equal(result.ok, true); assert.equal(result.first, true);
  assert.equal(s.sound, true); assert.equal(s.records.playing, true);
  assert.deepEqual(s.records.owned, ["meadow"]);
  assert.deepEqual(s.audio, { musicVolume: .23, sfxVolume: .76 });
  s.sound = false; s.records.playing = false;
  buy(s, "L1");
  assert.equal(s.sound, false); assert.equal(s.records.playing, false);
  const saved = restore(structuredClone(s));
  assert.equal(saved.sound, false); assert.equal(saved.records.playing, false);
});
test("bad audio fields are sanitized without resetting the world", () => {
  const s=fresh();s.counts.L1=1;
  restoreRecords(s,{records:{owned:["fake","rain","rain"],selected:"fake"},audio:{musicVolume:Infinity,sfxVolume:-4}});
  assert.deepEqual(s.records.owned,["meadow","rain"]);assert.equal(s.records.selected,"meadow");
  assert.equal(s.audio.musicVolume,.55);assert.equal(s.audio.sfxVolume,0);
});
test("music transport, collection and mute have no effect on rates or completed jobs", () => {
  const left=fresh();Object.assign(left.counts,{L1:1,V2:1,M5:1,M6:1,M10:1});ensureRecords(left);
  const right=structuredClone(left);right.sound=false;right.records={owned:RECORDS.map(r=>r.id),selected:"end",playing:false,loop:false};
  assert.deepEqual(rates(left),rates(right));
  left.community.tasks.music={work:0,cooldown:8,manual:false,cycle:0,owners:{},tenders:{}};
  right.community.tasks=structuredClone(left.community.tasks);
  advance(left,8);advance(right,8);
  assert.equal(left.total,right.total);assert.equal(left.community.tasks.music.cooldown,right.community.tasks.music.cooldown);
});
test("six independently arranged original tracks have local audio and reproducible attribution", () => {
  assert.equal(RECORDS.length,6);
  assert.equal(new Set(RECORDS.map(r=>r.style)).size,6);
  for(const r of RECORDS) {
    const path=new URL(`../public/audio/records/${r.id}.mp3`,import.meta.url);
    assert.ok(existsSync(path));assert.ok(readFileSync(path).length>500000);
    assert.ok(r.bars*r.meter*60/r.bpm>=60);
  }
  assert.match(readFileSync(new URL('../public/audio/records/CREDITS.txt',import.meta.url),'utf8'),/CC0/);
});

class Media {
  paused=true;currentTime=0;volume=0;src="";loop=false;
  play(){this.paused=false;return Promise.resolve();}
  pause(){this.paused=true;}
  removeAttribute(){this.src="";}
  load(){}
}
function rig(){
  const s=fresh();s.counts.L1=1;ensureRecords(s);s.records.owned=RECORDS.map(r=>r.id);
  let time=0;
  const audio=new GameAudio({state:()=>s,media:()=>new Media(),context:()=>{throw Error('no context');},now:()=>time});
  return {s,audio,step:n=>{time+=n;audio.tick();}};
}
const settle=()=>new Promise(resolve=>setImmediate(resolve));
test('old loop preferences migrate; new collections and all four modes survive refresh',()=>{
  assert.equal(fresh().records.mode,'collection');
  for(const loop of [false,true]){
    const s=fresh();s.counts.L1=1;delete s.records.mode;s.records.loop=loop;
    assert.equal(restore(s).records.mode,loop?'single':'once');
  }
  for(const mode of ['collection','shuffle','single','once']){
    const s=fresh();s.counts.L1=1;setRecordMode(s,mode);
    assert.equal(restore(s).records.mode,mode);
  }
});
test('collection fades out, leaves three seconds of silence, then fades in the next owned record',async()=>{
  const {s,audio,step}=rig();s.records.owned=['meadow','copper'];audio.unlock();await settle();step(1000);
  const old=audio.deck;old.media.duration=80;old.media.currentTime=79.55;step(1);
  assert.ok(Math.abs(old.gain-.5)<.001);
  old.media.onended();assert.equal(old.dead,true);assert.equal(audio.snapshot().decks,0);
  step(2999);assert.equal(s.records.selected,'meadow');assert.equal(audio.snapshot().decks,0);
  step(1);await settle();assert.equal(s.records.selected,'copper');assert.equal(audio.deck.media.currentTime,0);
  step(450);assert.equal(audio.deck.gain,.5);step(450);assert.equal(audio.deck.gain,1);
  audio.deck.media.onended();step(3000);await settle();assert.equal(s.records.selected,'meadow');
});
test('shuffle visits each other owned track before refilling, avoids immediate repeats, and includes new purchases',async()=>{
  const {s,audio,step}=rig();s.records.owned=['meadow','cavern','copper'];setRecordMode(s,'shuffle');audio.random=()=>.3;
  audio.unlock();await settle();const visited=[];
  for(let i=0;i<2;i++){audio.deck.media.onended();step(3000);await settle();visited.push(s.records.selected);}
  assert.deepEqual(new Set(visited),new Set(['cavern','copper']));
  s.money=10000;buyRecord(s,'rain');const next=[];
  for(let i=0;i<12;i++){const old=s.records.selected;audio.next();await settle();step(300);next.push(s.records.selected);assert.notEqual(old,s.records.selected);assert.ok(s.records.owned.includes(s.records.selected));assert.equal(audio.snapshot().decks,1);}
  assert.ok(next.includes('rain'));
});
test('gap freezes while paused, muted or backgrounded; manual selection skips it without stacked players',async()=>{
  const {s,audio,step}=rig();audio.unlock();await settle();audio.deck.media.onended();step(1000);
  s.records.playing=false;audio.command();step(50000);assert.equal(audio.snapshot().interlude,2000);
  s.records.playing=true;audio.command();s.sound=false;step(50000);assert.equal(audio.snapshot().interlude,2000);
  s.sound=true;audio.command();audio.setActive(false);step(50000);audio.setActive(true);
  assert.equal(audio.snapshot().interlude,2000);step(1000);assert.equal(audio.snapshot().decks,0);
  selectRecord(s,'rain');audio.command({skipGap:true});await settle();step(300);
  assert.equal(audio.snapshot().selected,'rain');assert.equal(audio.snapshot().decks,1);assert.equal(audio.snapshot().interlude,0);
});
test('single loops without interlude; next works with one record; pause/once during a gap does not restart',async()=>{
  const {s,audio,step}=rig();s.records.owned=['meadow'];setRecordMode(s,'single');audio.unlock();await settle();
  assert.equal(audio.deck.media.loop,true);audio.deck.media.currentTime=40;audio.next();await settle();step(300);
  assert.equal(audio.deck.media.currentTime,0);assert.equal(audio.snapshot().decks,1);
  setRecordMode(s,'collection');audio.tick();assert.equal(audio.deck.media.loop,false);
  audio.deck.media.onended();setRecordMode(s,'once');step(4000);
  assert.equal(s.records.playing,false);assert.equal(audio.snapshot().decks,0);
});
test("music gain controls fade and volume independently of mobile element volume",async()=>{
  const {s,audio,step}=rig();
  const node=()=>({gain:{value:0,setTargetAtTime(v){this.value=v;}},disconnected:false,connect(){},disconnect(){this.disconnected=true;}});
  audio.context=()=>({state:'running',currentTime:0,createMediaElementSource:node,createGain:node});
  audio.unlock();await settle();step(300);
  assert.equal(audio.deck.media.volume,1);assert.equal(audio.deck.volume.gain.value,.55);
  s.audio.musicVolume=.2;audio.tick();assert.equal(audio.deck.volume.gain.value,.2);
  const old=audio.deck;selectRecord(s,'rain');audio.command();await settle();step(140);
  assert.ok(old.volume.gain.value>0&&old.volume.gain.value<.2);
  step(150);assert.equal(old.source.disconnected,true);assert.equal(old.volume.disconnected,true);
});
test("only owned records play; pause and switching preserve playback position",async()=>{
  const {s,audio,step}=rig();s.records.owned=["meadow"];audio.unlock();await settle();step(300);
  audio.deck.media.currentTime=17;audio.tick();
  assert.equal(selectRecord(s,"rain"),false);assert.equal(audio.snapshot().selected,"meadow");
  s.records.playing=false;audio.command();step(300);assert.equal(audio.snapshot().decks,0);
  s.records.playing=true;audio.command();await settle();step(300);assert.equal(audio.deck.media.currentTime,17);
  assert.ok(buyRecord(s,"rain").ok===false);s.money=10000;assert.ok(buyRecord(s,"rain").ok);
  selectRecord(s,"rain");audio.command();await settle();step(300);assert.equal(audio.snapshot().selected,"rain");
  selectRecord(s,"meadow");audio.command();await settle();step(300);assert.equal(audio.deck.media.currentTime,17);
});
test("rapid switches cap the player at two decks and never restart for scene changes",async()=>{
  const {s,audio,step}=rig();audio.unlock();await settle();step(300);
  for(const record of RECORDS){selectRecord(s,record.id);audio.command();assert.ok(audio.snapshot().decks<=2);}
  await settle();step(300);const plays=audio.playCount;
  s.realm="end";for(let i=0;i<50;i++)step(16);
  assert.equal(audio.playCount,plays);assert.equal(audio.snapshot().decks,1);
  s.sound=false;audio.tick();step(100);assert.equal(audio.snapshot().decks,1,'fade-out retains the retiring deck');
  step(200);assert.equal(audio.snapshot().decks,0);
});
test("background suspends position and voices; resume launches once, without catch-up",async()=>{
  const {audio,step}=rig();audio.unlock();await settle();step(300);audio.deck.media.currentTime=25;audio.tick();
  audio.setActive(false);const plays=audio.playCount;step(3600000);
  assert.equal(audio.deck.media.paused,true);assert.equal(audio.deck.media.currentTime,25);
  audio.setActive(true);audio.setActive(true);await settle();step(300);
  assert.equal(audio.playCount,plays+1);assert.equal(audio.deck.media.currentTime,25);
});
test("nonloop endings pause without replay; state replacement cannot retain an old player",async()=>{
  const {s,audio,step}=rig();setRecordMode(s,"once");audio.unlock();await settle();step(300);
  audio.deck.media.onended();step(400);assert.equal(s.records.playing,false);
  selectRecord(s,"cavern");audio.command();await settle();step(300);
  const replacement=fresh();audio.state=()=>replacement;audio.tick();
  assert.equal(audio.snapshot().decks,0);assert.equal(audio.snapshot().selected,null);
});
test("sfx have per-action, global, automatic visibility and polyphony limits",()=>{
  const {s,audio,step}=rig();s.records.playing=false;
  const source=()=>({connect(){},disconnect(){},start(){},stop(){this.onended?.();}});
  audio.context=()=>({state:'running',sampleRate:1000,createBuffer:(c,n)=>({getChannelData:()=>new Float32Array(n)}),createBufferSource:source,createGain:()=>({gain:{value:0},connect(){},disconnect(){}})});
  audio.unlock();
  assert.equal(audio.sfx('mine'),true);assert.equal(audio.sfx('mine'),false);
  step(90);assert.equal(audio.sfx('mine'),true);
  step(100);assert.equal(audio.sfx('event',{automatic:true,visible:false}),false);
  assert.equal(audio.sfx('event',{automatic:true}),true);
  step(100);assert.equal(audio.sfx('harvest',{automatic:true}),false);
  for(let i=0;i<10;i++){step(200);audio.sfx('mine');}
  assert.equal(audio.snapshot().voices,6);
});

test('rain ambience reuses one loop, attenuates indoors, respects mute and background suspension',()=>{
 const {s,audio}=rig();s.records.playing=false;let starts=0;
 const param=()=>({value:0,setTargetAtTime(v){this.value=v}}),node=()=>({gain:param(),frequency:param(),connect(){},disconnect(){}});
 const ctx={state:'running',currentTime:0,sampleRate:1000,destination:{},createBuffer:(c,n)=>({getChannelData:()=>new Float32Array(n)}),createGain:node,createBiquadFilter:node,createBufferSource:()=>({...node(),start(){starts++},stop(){}}),suspend(){this.state='suspended';return Promise.resolve()},resume(){this.state='running';return Promise.resolve()}};
 audio.context=()=>ctx;audio.unlock();audio.ambient({rain:1});audio.tick();assert.equal(starts,1);const outdoor=audio.rainLoop.gain.gain.value;
 for(let i=0;i<20;i++){audio.ambient({rain:i%2,indoor:!!(i%2)});audio.tick()}assert.equal(starts,1);
 audio.ambient({rain:1,indoor:true});audio.tick();assert.ok(audio.rainLoop.gain.gain.value<outdoor);
 s.sound=false;audio.tick();assert.equal(audio.rainLoop.gain.gain.value,0);s.sound=true;audio.tick();audio.setActive(false);assert.equal(ctx.state,'suspended');audio.setActive(true);assert.equal(starts,1);
});

function soundContext() {
  const param = () => ({ value: 0, setTargetAtTime(v) { this.value = v; } });
  const node = () => ({ gain: param(), frequency: param(), connect() {}, disconnect() { this.disconnected = true; } });
  const ctx = {
    state: 'running', currentTime: 0, sampleRate: 1000, destination: {}, sources: [],
    createBuffer: (c, n) => ({ getChannelData: () => new Float32Array(n) }),
    createGain: node, createBiquadFilter: node, createMediaElementSource: node,
    createBufferSource() {
      const source = { ...node(), start() { this.started = true; }, stop() { this.stopped = true; this.onended?.(); } };
      this.sources.push(source); return source;
    },
    suspend() { this.state = 'suspended'; return Promise.resolve(); },
    resume() { this.state = 'running'; return Promise.resolve(); },
  };
  return ctx;
}

test('before the jukebox, gestures, all effects, weather and foreground return create no audio', async () => {
  const s = fresh(), ctx = soundContext(); let contexts = 0, media = 0;
  // Imported preferences cannot bypass the world-owned sound feature.
  s.records.owned = ['meadow']; s.records.playing = true;
  const audio = new GameAudio({ state: () => s, context: () => { contexts++; return ctx; }, media: () => { media++; return new Media(); } });
  audio.ambient({ rain: 1 });
  for (const type of ['tap', 'back', 'switch', 'blocked', 'buy', 'land', 'place', 'build', 'mine', 'harvest', 'pickup', 'start', 'event', 'enter']) {
    audio.unlock(); audio.command(); audio.tick();
    assert.equal(audio.sfx(type), false);
  }
  audio.setActive(false); audio.setActive(true);
  assert.equal(contexts, 0); assert.equal(media, 0); assert.equal(ctx.sources.length, 0);
  s.counts.V2 = 1; s.money = 1000;
  assert.equal(buy(s, 'L1').ok, true);
  audio.command(); await settle();
  assert.equal(contexts, 1); assert.equal(media, 1);
  assert.equal(audio.snapshot().playing, true);
  assert.equal(audio.sfx('mine'), true); assert.ok(audio.rainLoop);
});

test('reset or loss of jukebox ownership stops music, active effects and rain without replay', async () => {
  for (const replace of [false, true]) {
    let s = fresh(); s.counts.L1 = 1; ensureRecords(s);
    const ctx = soundContext(), audio = new GameAudio({ state: () => s, context: () => ctx, media: () => new Media() });
    audio.ambient({ rain: 1 }); audio.unlock(); await settle();
    audio.sfx('mine'); const deck = audio.deck;
    assert.equal(ctx.sources.length, 2);
    if (replace) s = fresh(); else s.counts.L1 = 0;
    audio.tick();
    assert.equal(deck.media.paused, true); assert.equal(deck.media.src, '');
    assert.ok(ctx.sources.every(source => source.stopped && source.disconnected));
    assert.equal(audio.snapshot().voices, 0); assert.equal(audio.snapshot().decks, 0);
    assert.equal(audio.rainLoop, null); assert.equal(audio.sfx('mine'), false);
    audio.setActive(false); audio.setActive(true); audio.unlock(); audio.tick();
    assert.equal(ctx.state, 'suspended'); assert.equal(audio.snapshot().decks, 0);
  }
});

test('an outstanding play request cannot finish audibly after loading a world without a jukebox', async () => {
  let s = fresh(), finish; s.counts.L1 = 1; ensureRecords(s);
  const media = new Media(); media.play = () => new Promise(resolve => { finish = () => { media.paused = false; resolve(); }; });
  const audio = new GameAudio({ state: () => s, context: () => soundContext(), media: () => media });
  audio.unlock(); assert.ok(audio.deck.pending);
  s = fresh(); audio.tick(); finish(); await settle();
  assert.equal(media.paused, true); assert.equal(audio.snapshot().decks, 0);
});

test('storing the jukebox or its studio pauses music and resumes the same position',async()=>{
 const {s,audio,step}=rig();audio.unlocked=true;audio.tick();await Promise.resolve();assert.ok(audio.deck);audio.deck.media.currentTime=17;
 s.facilityStorage.L2=true;step(50);assert.equal(audio.deck,null);assert.equal(audio.positions.get(s.records.selected),17);assert.equal(s.records.playing,true);
 delete s.facilityStorage.L2;step(50);await Promise.resolve();assert.ok(audio.deck);assert.equal(audio.deck.media.currentTime,17);
 s.facilityStorage.L1=true;step(50);assert.equal(audio.deck,null);assert.equal(audio.canPlay(),true);
});

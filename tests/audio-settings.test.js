import test from 'node:test';
import assert from 'node:assert/strict';
import {fresh} from '../src/game.js';
import {audioMasterMarkup,audioSettingsMarkup,audioUnlocked} from '../src/records-ui.js';
import {GameAudio} from '../src/game-audio.js';

test('visible locked audio controls explain the actual jukebox gate and preserve preferences',()=>{
 const s=fresh(0);s.guidance.info=true;s.audio.musicVolume=.31;s.audio.sfxVolume=.72;s.audio.narratorVoice=false;
 const before=JSON.stringify({audio:s.audio,sound:s.sound,money:s.money,counts:s.counts});
 const master=audioMasterMarkup(s),volumes=audioSettingsMarkup(s);
 assert.equal(audioUnlocked(s),false);assert.match(master,/disabled/);assert.match(master,/购买唱片机（音乐盒）/);
 assert.doesNotMatch(master,/checked/);assert.equal((volumes.match(/disabled/g)||[]).length,4);
 assert.equal(JSON.stringify({audio:s.audio,sound:s.sound,money:s.money,counts:s.counts}),before);
});
test('owning the jukebox enables the same controls indoors, preserving an intentional mute',()=>{
 const s=fresh(0);s.counts.L1=1;s.counts.L2=1;s.sound=false;
 assert.equal(audioUnlocked(s),true);assert.doesNotMatch(audioMasterMarkup(s),/disabled|checked|购买唱片机/);
 assert.doesNotMatch(audioSettingsMarkup(s),/disabled/);
 s.sound=true;assert.match(audioMasterMarkup(s),/checked/);
});
test('settings availability agrees with the audio engine purchase requirement',()=>{
 const s=fresh(0);s.sound=true;const a=new GameAudio({state:()=>s,context:()=>{throw Error('must not create audio');}});a.unlocked=true;
 for(const count of [0,1,2]){s.counts.L1=count;assert.equal(a.canPlay(),audioUnlocked(s));}
});

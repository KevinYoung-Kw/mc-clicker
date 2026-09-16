import { mkdirSync, writeFileSync, readFileSync, copyFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { NARRATOR_COPY } from '../src/narrator-copy.js';
import { narratorDelivery } from '../src/narrator-prosody.js';
import { noticeFace } from '../src/notice-face.js';
import { narratorScore, narratorSound, narratorPhrases, narratorReadingTime, NARRATOR_LINE_REST, NARRATOR_VOICE_GAIN } from '../src/narrator-voice.js';

const dir=new URL('../docs/v1.7/qa/narrator-prosody/',import.meta.url),rate=48000,volume=.45*NARRATOR_VOICE_GAIN;
mkdirSync(dir,{recursive:true});
const previous=JSON.parse(readFileSync(new URL('emotion-1/audio-report.json',dir),'utf8'));
const examples=[
  ['manual','家传秘诀','前半句连着说，秘诀放低了讲'],
  ['rescued','高兴','重音抬起来，末尾稍微拖一下'],
  ['rescue-price','吐槽','有轻有重，最后落下来'],
  ['work','琢磨','中间带过去，问句尾部上扬'],
  ['rescue','着急','一口气带过去，句尾着重喊出来'],
].map(([id,label,note])=>{
  const entry=NARRATOR_COPY[id],text=entry.lines[0],delivery=narratorDelivery({id,index:0});
  return {id,label,note,text,delivery,face:noticeFace(entry.expression),phrases:narratorPhrases(text),notes:narratorScore(text,delivery),duration:narratorReadingTime(text)+NARRATOR_LINE_REST};
});
function pcm(samples){
  const file=Buffer.alloc(44+samples.length*2);
  file.write('RIFF');file.writeUInt32LE(file.length-8,4);file.write('WAVEfmt ',8);file.writeUInt32LE(16,16);file.writeUInt16LE(1,20);file.writeUInt16LE(1,22);
  file.writeUInt32LE(rate,24);file.writeUInt32LE(rate*2,28);file.writeUInt16LE(2,32);file.writeUInt16LE(16,34);file.write('data',36);file.writeUInt32LE(samples.length*2,40);
  samples.forEach((v,i)=>file.writeInt16LE(Math.round(Math.max(-1,Math.min(1,v))*32767),44+i*2));return file;
}
function exportAudio(samples,name){
  execFileSync('ffmpeg',['-y','-hide_banner','-loglevel','error','-f','wav','-i','pipe:0','-codec:a','libmp3lame','-b:a','96k',fileURLToPath(new URL(name,dir))],{input:pcm(samples),maxBuffer:16*1024*1024});
  let peak=0,energy=0;for(const v of samples){peak=Math.max(peak,Math.abs(v));energy+=v*v;}
  if(peak>=1)throw new Error('Clipping in '+name);
  return {file:name,duration:samples.length/rate,peak,rms:Math.sqrt(energy/samples.length)};
}
const sequence=[];
for(const e of examples){
  e.audio={};
  for(const mode of ['old','new']){
    if(mode==='old'){
      const original=previous.examples.find(p=>p.id===e.id);
      if(original?.text!==e.text)throw new Error('The comparison needs matching copy: '+e.id);
      const file=`${e.id}-old.mp3`;
      copyFileSync(new URL('emotion-1/'+original.audio.new.file,dir),new URL(file,dir));
      e.audio.old={...original.audio.new,file};continue;
    }
    const samples=new Float32Array(Math.ceil(e.duration*rate));
    for(const n of e.notes){
      const sound=narratorSound(rate,n),at=Math.round(n.at*rate);
      for(let i=0;i<sound.length&&at+i<samples.length;i++)samples[at+i]+=sound[i]*volume;
    }
    e.audio[mode]=exportAudio(samples,`${e.id}-${mode}.mp3`);
    if(mode==='new')sequence.push(samples);
  }
}
const all=new Float32Array(sequence.reduce((sum,a)=>sum+a.length,0));let at=0;
for(const s of sequence){all.set(s,at);at+=s.length;}
const report={revision:'emotion-2',comparison:'Previous emotion-1 versus connected / accented delivery; identical copy and phrase windows.',sampleRate:rate,voice:'C / reed',pulseRate:1.45,volume,original:true,examples,sequence:exportAudio(all,'sequence-emotion-2.mp3')};
writeFileSync(new URL('audio-report.json',dir),JSON.stringify(report,null,2)+'\n');
const page=new URL('index.html',dir);
writeFileSync(page,readFileSync(page,'utf8').replace(/(<script id="voice-data" type="application\/json">)[\s\S]*?(<\/script>)/,(_,open,close)=>open+JSON.stringify(report).replace(/</g,'\\u003c')+close));
console.log(JSON.stringify({examples:examples.map(e=>({id:e.id,seconds:e.duration,audio:e.audio})),sequence:report.sequence},null,2));

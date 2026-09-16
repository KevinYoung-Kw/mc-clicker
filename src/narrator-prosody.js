import { NARRATOR_COPY } from './narrator-copy.js';

// Semitones around the same character voice. Phrase boundaries stay intact.
const MOODS = {
  plain: {base:0,curve:[-.5,1,2,-2],steps:[0,.5,-1,.5,0]},
  bright: {base:1,curve:[0,2,3,.5],steps:[-.5,1,0,1.5,-.5,1]},
  wry: {base:-.5,curve:[.5,1.5,3.5,-3.5],steps:[0,.5,-.5,1]},
  thoughtful: {base:-1,curve:[-1,-.5,1.5,-1.5],steps:[-.5,0,1,0]},
  secret: {base:-3.5,curve:[-.5,0,.5,-2],steps:[.5,0,-.5,0]},
  urgent: {base:1.5,curve:[0,2,3.5,1],steps:[0,-1,1.5,0,-.5]},
};
export const NARRATOR_MOODS=Object.freeze(Object.keys(MOODS));
const expressions={plain:'plain',smile:'bright',smirk:'wry',thinking:'thoughtful',notice:'urgent'};
const mood=value=>Object.hasOwn(MOODS,value)?value:'plain';

// Most dialogue follows its existing expression. A writer can override a line
// or a named phrase, without changing the face or maintaining another copy list.
export function narratorDelivery(line={}) {
  const entry=NARRATOR_COPY[line.voiceId||line.expressionId||line.id];
  const voice=Array.isArray(entry?.voice)?entry.voice[line.index||0]:entry?.voice;
  const fallback=expressions[line.expression||entry?.expression]||'plain';
  if(typeof voice==='string')return {mood:mood(voice)};
  return {mood:mood(voice?.mood||fallback),phrases:voice?.phrases||[]};
}
const seed=text=>[...text.replace(/[^\p{L}\p{N}]/gu,'')].reduce((h,c)=>(Math.imul(h,31)+c.codePointAt(0))>>>0,7);
const pitchStep=value=>Math.round(Math.max(-7,Math.min(7,value))*2)/2;
const milliseconds=value=>Math.round(value*1000)/1000;
export function shapeNarratorScore(notes,phrases,delivery={}) {
  const shaped=[];let index=0;
  for(const phrase of phrases){
    const first=index;
    while(index<notes.length&&notes[index].at<phrase.end)index++;
    const override=delivery.phrases?.find(p=>typeof p.match==='string'&&p.match&&phrase.text.includes(p.match));
    const profile=MOODS[mood(override?.mood||delivery.mood)],hash=seed(phrase.text);
    const offset=(hash%3-1)*.5,question=/[？?]$/.test(phrase.text),voiced=[];
    for(let i=first;i<index;i++){
      const progress=index-first===1?1:(i-first)/(index-first-1);
      const section=Math.min(2,Math.floor(progress*3)),fraction=progress*3-section;
      const curve=profile.curve[section]+(profile.curve[section+1]-profile.curve[section])*fraction;
      const lift=question?Math.max(0,progress-.5)*5:0;
      const pitch=profile.base+curve+profile.steps[(i-first+hash)%profile.steps.length]+offset+lift;
      voiced.push({...notes[i],pitch:pitchStep(pitch)});
    }
    // Merge some adjacent sounds into one continuous breath. Soften transitional
    // sounds; keep the stressed beat and punctuation audible. Not letter/phoneme TTS.
    const stress=Math.min(voiced.length-1,Math.floor(voiced.length*.6));
    for(let j=0;j<voiced.length;j++){
      const n=voiced[j],next=voiced[j+1],last=j===voiced.length-1;
      const join=next&&j<voiced.length-2&&j!==stress&&j+1!==stress&&(j+hash)%3===0;
      if(join){
        const joinAt=milliseconds(next.at-n.at),limit=(voiced[j+2]?.at??phrase.end)-n.at-.025;
        shaped.push({...n,kind:'joined',duration:milliseconds(Math.min(joinAt+.128,limit)),joinAt,pitchEnd:next.pitch,level:.94});
        j++;continue;
      }
      const weak=j>0&&!last&&j!==stress&&(j+hash)%2===0;
      const kind=weak?'light':j===stress||last?'accent':'plain';
      const duration=milliseconds(Math.min(weak?.072:kind==='accent'?.16:.128,(next?.at??phrase.end)-n.at-.025));
      shaped.push({...n,kind,duration,pitchEnd:pitchStep(n.pitch+(last?(question?1.5:-1):weak?-.5:.5)),level:weak?.55:kind==='accent'?1.06:1});
    }
  }
  return shaped;
}

import { advanceNarrative, currentNarration, reconcileNarrative, setNarrationEnabled, narratorOffer, chooseNarratorOffer } from './narrative.js';
import { advanceEasterEggs, offeredEgg, narratorAway, eggById, startEgg } from './easter-eggs.js';
import { createNarratorActivities } from './narrator-activity-ui.js';
import { createCompanionFlight } from './narrator-companions.js';
import { captiveNotice, narrationExpression } from './notice-face.js';
import { setNarratorVoice } from './records.js';
import { narratorReadingTime, NARRATOR_LINE_REST } from './narrator-voice.js';
import { openingChoicePending, chooseOpening } from './opening-guide.js';
import { createManualCue } from './manual-cue.js';
export function createNarratorUI(api) {
  const node=document.createElement('section');node.id='narrator';node.hidden=true;node.setAttribute('aria-label','旁白');
  node.innerHTML=`<div class="narrator-body"><p role="status" aria-live="polite" aria-atomic="true"></p><div class="narrator-actions" hidden></div></div>`;
  api.notices.mountNarrator(node);
  const text=node.querySelector('p'),buttons=node.querySelector('.narrator-actions');let key='',previousState=null;
  let eggRevision=-1;
  const flight=createCompanionFlight(api);
  const activities=createNarratorActivities({...api,bindActivities});
  const manualCue=createManualCue(api);
  function show(line,actions=[],expression='plain',cue=null) {
    const next=JSON.stringify([line,actions.map(a=>a.label)]);
    if(next!==key){key=next;text.textContent=line||'';buttons.replaceChildren();buttons.hidden=!actions.length;
      for(const a of actions){const b=document.createElement('button');b.textContent=a.label;b.classList.toggle('primary',!!a.primary);b.onclick=a.run;buttons.append(b);}
      if(line&&!api.state().reducedMotion)text.animate([{opacity:0},{opacity:1}],{duration:200});
    }
    api.notices.narrate(!!line,expression);
    api.audio?.narrate(line&&cue ? {...cue,expression} : null);
  }
  function changed(){api.save();api.paint();}
  function chooseOffer(id,accept){
    if(api.foreground?.()===false||!api.available()||!api.activitiesAvailable())return;
    const result=chooseNarratorOffer(api.state(),id,accept);if(!result.ok)return;
    show(null);changed();
    if(result.purchase)api.offerPurchase(result.purchase);
  }
  function begin(id){if(startEgg(api.state(),id)){show(null);api.state().narrative.quiet=0;api.state().narrative.gap=90;changed();}}
  function later(id){const s=api.state(),e=s.easterEggs.entries[id];e.announced=true;s.narrative.quiet=0;s.narrative.gap=90;show(null);api.save();}
  function hint(id){const e=api.state().easterEggs.entries[id];if(!e || e.status==='claimed')return;
    startEgg(api.state(),id);e.hinted=true;api.closeModal();api.find(e.point);changed();
  }
  let capture=null;
  function stopCapture(){if(!capture)return;const old=capture;capture=null;old.animation?.cancel();old.node.remove();delete api.shop.dataset.noticeCapturing;}
  async function absorb(rect) {
    stopCapture();
    if(api.state().reducedMotion || matchMedia('(prefers-reduced-motion: reduce)').matches || !rect?.width)return;
    const start={x:rect.left+rect.width/2,y:rect.top+rect.height/2};
    const chip=document.createElement('div');chip.className='narrator-capture';chip.setAttribute('popover','manual');chip.innerHTML=captiveNotice();
    document.body.append(chip);chip.style.left=`${start.x-36}px`;chip.style.top=`${start.y-36}px`;chip.showPopover?.();
    const effect={node:chip,animation:null};capture=effect;api.shop.dataset.noticeCapturing='true';
    try {
      effect.animation=chip.animate([{transform:'scale(.72) rotate(0deg)'},{transform:'translate(-7px,-4px) rotate(-9deg)',offset:.3},{transform:'translate(5px,-6px) rotate(7deg)',offset:.65},{transform:'translate(0,-8px) rotate(-4deg)'}],{duration:360,easing:'steps(4,end)',fill:'forwards'});
      await effect.animation.finished;
      // The shop may have moved while its panel opened. Measure after that
      // transition, instead of flying to an obsolete pre-menu coordinate.
      const target=api.shop.getBoundingClientRect(),dx=target.left+target.width/2-start.x,dy=target.top+target.height/2-start.y;
      effect.animation=chip.animate([{transform:'translate(0,-8px) rotate(-4deg)',opacity:1},{transform:`translate(${dx*.25}px,${dy*.25-32}px) rotate(12deg) scale(.9)`,offset:.4,opacity:1},{transform:`translate(${dx}px,${dy}px) rotate(0deg) scale(.25)`,opacity:0}],{duration:720,easing:'cubic-bezier(.5,0,.8,.4)',fill:'forwards'});
      await effect.animation.finished;
      if(capture===effect && !api.state().guidance.info)api.shop.animate([{translate:'0 -4px'},{translate:'0 2px'},{translate:'0 0'}],{duration:220,easing:'steps(3,end)'});
    } catch { /* Cancellation on purchase/background is intentional. */ }
    finally {if(capture===effect)stopCapture();}
  }
  function tick(dt) {
    const s=api.state();if(s!==previousState){stopCapture();flight.cancel();previousState=s;eggRevision=-1;key='';show(null);}
    activities.refresh();
    manualCue.update();
    if(document.hidden || api.foreground?.()===false || s.reducedMotion)flight.cancel();
    if(eggRevision!==s.easterEggs.revision){eggRevision=s.easterEggs.revision;api.save();}
    if(capture && (s.guidance.info || document.hidden || api.foreground?.()===false || s.reducedMotion))stopCapture();
    if(reconcileNarrative(s,api.context))api.save();
    if(!api.available()||api.notices.busy||narratorAway(s)){
      const paused=advanceNarrative(s,dt,{available:false,context:api.context,canPresent:api.canPresent,reconcile:false});
      if(paused.changed)api.save();show(null);return;
    }
    if(openingChoicePending(s)){
      const select=choice=>{if(api.foreground?.()!==false&&api.available()&&chooseOpening(api.state(),choice)){show(null);changed();}};
      show('第一次玩这个游戏吗？',[
        {label:'第一次玩',primary:true,run:()=>select('first')},
        {label:'之前玩过',run:()=>select('returning')},
      ],'thinking');
      return;
    }
    const active=offeredEgg(s),entry=active?s.easterEggs.entries[active]:null;
    const offer=api.activitiesAvailable() && entry?.status==='offered'&&!entry.announced&&s.guidance.notices&&!s.narrative.current&&s.narrative.quiet>=45;
    if(offer){
      const spec=eggById(active),lines=spec.offer;entry.offerElapsed=(entry.offerElapsed||0)+Math.min(1,dt);
      const actions=spec.kind==='dialogue'?[{label:`给 ${spec.cost} ◆`,run:()=>activities.depart(active)},{label:'改天再说',run:()=>later(active)}]:[{label:'找找看',run:()=>begin(active)},{label:'改天再找',run:()=>later(active)}];
      const first=narratorReadingTime(lines[0]),index=entry.offerElapsed<first+NARRATOR_LINE_REST?0:1;
      const elapsed=index?entry.offerElapsed-first-NARRATOR_LINE_REST:entry.offerElapsed;
      show(lines[index],actions,'smirk',{id:`offer:${active}`,startedAt:entry.offeredAt||0,index,text:lines[index],elapsed,speaking:elapsed<narratorReadingTime(lines[index])});
      if(entry.offerElapsed>=Math.max(18,first+NARRATOR_LINE_REST+narratorReadingTime(lines[1])+3))later(active);return;
    }
    const result=advanceNarrative(s,dt,{context:api.context,canPresent:api.canPresent,reconcile:false});
    // Read geometry only for an actual flight, before show() changes the shell.
    if(result.captured||result.companions){
      const rect=api.notices.avatarRect();
      if(result.captured)absorb(rect);
      if(result.companions)flight.play(rect);
    }
    const c=currentNarration(s),proposal=c&&narratorOffer(s,c.id);
    const actions=c?.id==='manual'?[{label:'打开操作指南',primary:true,run:()=>api.openManual()}]:proposal&&api.activitiesAvailable()?[{label:`${proposal.verb} · ${proposal.cost.toLocaleString('en-US')} ◆`,primary:true,run:()=>chooseOffer(c.id,true)},{label:proposal.decline,run:()=>chooseOffer(c.id,false)}]:[];
    show(api.canPresent?.(c)===false?null:c?.text,actions,narrationExpression(c?.expressionId||c?.id),c);
    const eggsChanged=advanceEasterEggs(s,dt,{quiet:api.activitiesAvailable()&&!c&&s.narrative.quiet>=45});
    if(result.changed || eggsChanged)api.save();
  }
  function bindActivities(root){
    activities.bind(root);
    root.querySelectorAll('[data-egg-start]').forEach(b=>b.onclick=()=>{begin(b.dataset.eggStart);api.closeModal();});
    root.querySelectorAll('[data-egg-hint]').forEach(b=>b.onclick=()=>hint(b.dataset.eggHint));
  }
  window.addEventListener('resize',stopCapture);
  return {tick, suspend:()=>{show(null);manualCue.hide();if(api.foreground?.()===false){stopCapture();flight.cancel();}},
    setVoiceEnabled(value){
      const react=setNarratorVoice(api.state(),value);
      api.audio?.tick();
      if(react)api.notices.show('行，那我写下来。',{kind:'action',expression:'thinking',detail:'旁白声音已关闭 · 字幕保留',duration:2800});
      activities.refresh();changed();
    },
    setEnabled(value){
      const react=setNarrationEnabled(api.state(),value);show(null);flight.cancel();
      if(react)api.notices.show('呜——！',{kind:'action',expression:'muffled',detail:'旁白已暂停',duration:1800});
      activities.refresh();changed();
    },
    captureForShop(){const s=api.state();if(!s.guidance.info&&s.narrative.intro==='calling'){const rect=api.notices.avatarRect();s.narrative.intro='captured';s.narrative.current=null;show(null);absorb(rect);api.save();}},
    activityMarkup:activities.markup,bindActivities,openStatus:activities.openStatus,
  };
}

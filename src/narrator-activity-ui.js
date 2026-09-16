import { eggById, beginDialogueEgg, narratorAway, returnRemaining, equipNarrator } from './easter-eggs.js';
import { noticeFace } from './notice-face.js';
import { icon } from './icons.js';
const clock=seconds=>`${Math.floor(seconds/60).toString().padStart(2,'0')}:${(seconds%60).toString().padStart(2,'0')}`;
export function narratorPresentation(s) {
 const paused=!s.guidance.notices,away=!!narratorAway(s),voiceMuted=s.audio?.narratorVoice===false;
 return {paused,away,voiceMuted,expression:paused?'muffled':away?'pause':'smirk',label:away?'外出中':paused?'旁白已暂停':voiceMuted?'只看字幕':'正在值班'};
}
export function createNarratorActivities(api){
 let key='',buttonKey='';
 function depart(id){
  if(api.foreground?.()===false)return;
  const result=beginDialogueEgg(api.state(),id);
  if(!result.ok){api.notices.show(result.reason,{kind:'error'});return;}
  api.closeModal();api.save();api.notices.show(result.text,{kind:'action',amount:`−${result.cost} ◆`});api.paint();refresh();
 }
 function markup(only=null){const s=api.state();return Object.entries(s.easterEggs.entries).map(([id,e])=>{
  const spec=eggById(id);if(!spec||(only&&id!==only))return '';
  if(spec.kind!=='dialogue')return `<div class="narrator-activity"><span>${spec.title}</span>${e.status==='claimed'?'<small>已找到</small>':`<button data-egg-start="${id}">${e.status==='seeking'?'继续寻找':'找找看'}</button><button data-egg-hint="${id}">给个提示</button>`}</div>`;
  if(e.status==='away')return `<section class="narrator-trip" aria-label="通知外出状态"><div class="narrator-coat-hook">${icon('info',32)}<span>出去一趟</span></div><div><h3>通知外出中</h3><p>去见对象了，马上回来。</p><dl><div><dt>距离回来</dt><dd data-narrator-remaining>${clock(returnRemaining(s))}</dd></div></dl></div></section>`;
  if(e.status==='claimed')return `<section class="narrator-trip"><div class="narrator-outfit">${noticeFace('smirk','date-bow')}</div><div><small>彩蛋收藏</small><h3>${spec.accessoryName}</h3><p>给消息通知系上一只红色领结。</p><button data-narrator-outfit aria-pressed="${s.easterEggs.wardrobe.equipped==='date-bow'}">${s.easterEggs.wardrobe.equipped==='date-bow'?'摘下领结':'戴上领结'}</button></div></section>`;
  return `<section class="narrator-trip"><div class="narrator-outfit">${noticeFace('thinking')}</div><div><h3>${spec.title}</h3><p>${spec.offer[0]}</p><button data-dialogue-start="${id}">给 ${spec.cost} ◆</button><p class="narrator-expense-note">外出 1 分钟 · 带回一件配饰</p></div></section>`;
 }).join('');}
 function bind(root){root.querySelectorAll('[data-dialogue-start]').forEach(b=>b.onclick=()=>depart(b.dataset.dialogueStart));root.querySelectorAll('[data-narrator-outfit]').forEach(b=>b.onclick=()=>{const s=api.state();equipNarrator(s,s.easterEggs.wardrobe.equipped?null:'date-bow');api.save();refresh();});}
 function refresh(){
  const s=api.state(),away=!!narratorAway(s),outfit=s.easterEggs.wardrobe.equipped;
  api.notices.setCharacter(away,outfit);
  const k=JSON.stringify([Object.entries(s.easterEggs.entries).map(([id,e])=>[id,e.status]),outfit]);
  if(k!==key){key=k;for(const root of document.querySelectorAll('[data-narrator-activities]')){
   const restoreOutfitFocus=root.contains(document.activeElement)&&document.activeElement.matches('[data-narrator-outfit]');
   root.innerHTML=markup(root.dataset.activityOnly);api.bindActivities(root);
   if(restoreOutfitFocus)root.querySelector('[data-narrator-outfit]')?.focus({preventScroll:true});
  }}
  for(const node of document.querySelectorAll('[data-narrator-remaining]')){const t=clock(returnRemaining(s));if(node.textContent!==t)node.textContent=t;}
  const {paused:muted,voiceMuted,expression,label}=narratorPresentation(s);
  for(const face of document.querySelectorAll('[data-narrator-avatar]')){const fk=`${away}:${outfit}:${muted}`;if(face.dataset.faceKey!==fk){face.dataset.faceKey=fk;face.innerHTML=noticeFace(expression,outfit);}}
  for(const status of document.querySelectorAll('[data-narrator-state]')){if(status.textContent!==label)status.textContent=label;}
  const b=document.querySelector('#info-open'),bk=`${away}:${outfit}:${muted}:${voiceMuted}`;
  if(b&&bk!==buttonKey){buttonKey=bk;b.classList.toggle('narrator-away',away);b.innerHTML=away?`${icon('info',20)}<span>外出中</span>`:muted?noticeFace('muffled',outfit):noticeFace('plain',outfit);b.setAttribute('aria-label',away?'通知外出中，查看归来倒计时':'世界信息');b.title=away?'通知外出中':muted?'世界信息 · 旁白已暂停':voiceMuted?'世界信息 · 只看字幕':'世界信息';}
 }
 function openStatus(){if(!narratorAway(api.state()))return false;api.modal(`<div class="narrator-trip-dialog"><h2>消息通知</h2><div data-narrator-activities data-activity-only="${narratorAway(api.state())}">${markup(narratorAway(api.state()))}</div></div>`);api.bindActivities(document.querySelector('.narrator-trip-dialog'));return true;}
 return {markup,bind,refresh,depart,openStatus};
}

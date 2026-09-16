import {atlasCount} from './atlas-progress.js';
import {CATALOG} from './catalog.js';
import {formatWallet} from './game.js';
import {equipWeb,resetWeb} from './presentation.js';
import {victorySource} from './victory.js';
import {CARD_STYLES} from './share-card-painter.js';
import {SHARE_STORIES,shareStoryData} from './share-stories.js';
import {paintShareStory} from './share-story-painter.js';
import {shareImagePreview} from './share-image.js';
import {icon} from './icons.js';
export const escapeShare=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const stats=s=>[[formatWallet(s.total),'累计创造'],[formatWallet(s.peakRate)+'/秒','最高产出'],[atlasCount(s)+' / '+CATALOG.length,'已解锁项目'],s.counts.L2?[formatWallet(s.live.peak),'最高观众']:[s.ordersCompleted,'完成订单']];
export function createCardPanel(api,platform) {
 let serial=0;
 return {open({ending=false}={}){
  const request=++serial,snapshot=structuredClone(api.state()),source=victorySource(snapshot);
  const choices=CARD_STYLES.filter(c=>!c.id||snapshot.webAppearance.owned[c.id]);
  let kind=ending&&source?'world':'receipt',selected=ending&&source?'victory':'current',style=snapshot.webAppearance.equipped.shareCard||'',content=null,prepared=null,busy=false,data=shareStoryData(snapshot),momentId=data.moments[0].id;
  if(!choices.some(c=>c.id===style))style='';
  api.modal(`<section id="share-panel" class="card-workshop"><header class="share-header"><h2>分享你的小世界</h2><button id="share-close" aria-label="关闭分享">${icon('close',20)}</button></header>
   <nav class="share-story-tabs" aria-label="分享什么">${SHARE_STORIES.map(c=>`<button data-share-story="${c.id}" aria-pressed="${kind===c.id}">${({receipt:'小票',world:'实景',passport:'护照',profile:'名片',moment:'趣事'})[c.id]}</button>`).join('')}</nav>
   <div class="share-story-context"><p id="share-story-hint"></p>${source?'<nav class="share-card-tabs" aria-label="取景范围" hidden><button data-card-mode="current">当前世界</button><button data-card-mode="victory">首次通关</button></nav>':''}<button id="next-share-moment" hidden>${icon('repeat',16)} 换个名场面</button></div>
   <div id="share-card-preview" class="share-card-preview" aria-busy="true"><span class="share-empty">正在整理这局的记录…</span></div>
   ${choices.length>1?`<details class="share-appearance"><summary>卡面装扮 <span id="share-style-name">${choices.find(c=>c.id===style)?.name}</span>${icon('chevron',14)}</summary><div class="card-styles" role="group" aria-label="已拥有的卡面">${choices.map(c=>`<button data-card-style="${c.id}" aria-pressed="${style===c.id}"><span class="card-mini card-mini-${CARD_STYLES.indexOf(c)}" style="--card-paper:${c.paper};--card-accent:${c.color}"><i></i><b></b></span><span>${c.name}</span></button>`).join('')}</div></details>`:''}
   <div class="share-card-actions"><button id="generate-card" aria-label="重新取景" title="重新取景">${icon('repeat',18)}</button><button id="download-card" disabled>${icon('download',18)} ${platform.saveLabel}</button>${platform.actions||''}</div>
   <p id="image-share-note" class="share-note" role="status"></p><span id="image-save-hint" class="share-sr-only">可保存这张图片，也可以使用下方的分享按钮。</span>${platform.extra||''}
   </section>`);
  const panel=document.querySelector('#share-panel'),q=s=>panel.querySelector(s),dialog=panel.closest('dialog');
  const current=()=>serial===request&&panel.isConnected&&dialog.open;
  const note=value=>{if(current())q('#image-share-note').textContent=value;};
  const activeButtons=()=>{
   for(const b of panel.querySelectorAll('[data-card-style]')){b.setAttribute('aria-pressed',String(b.dataset.cardStyle===style));b.disabled=busy;}
   for(const b of panel.querySelectorAll('[data-card-mode]')){b.setAttribute('aria-pressed',String(b.dataset.cardMode===selected));b.disabled=busy;}
   for(const b of panel.querySelectorAll('[data-share-story]')){b.setAttribute('aria-pressed',String(b.dataset.shareStory===kind));b.disabled=busy;}
   q('#share-story-hint').textContent=SHARE_STORIES.find(c=>c.id===kind).name;
   if(q('.share-card-tabs'))q('.share-card-tabs').hidden=kind!=='world';
   q('#next-share-moment').hidden=kind!=='moment'||data.moments.length<2;q('#next-share-moment').disabled=busy;
   q('#generate-card').setAttribute('aria-label',kind==='world'?'重新取景':'更新本局数据');q('#generate-card').title=kind==='world'?'重新取景':'更新本局数据';
   q('#generate-card').disabled=busy;q('#download-card').disabled=busy||!prepared;
   q('#share-card-preview').setAttribute('aria-busy',String(busy));platform.ready?.({panel,prepared,busy});
  };
  let captureRelease=null;
  const release=()=>{captureRelease?.();captureRelease=null;};
  dialog.addEventListener('close',release,{once:true});
  async function generate(retake=false){
   if(busy||!current())return;busy=true;prepared=null;note('');activeButtons();
   try {
    if(retake){content=null;data=shareStoryData(structuredClone(api.state()));if(!data.moments.some(m=>m.id===momentId))momentId=data.moments[0].id;}
    if(kind==='world'&&!content){
     captureRelease=api.beginCapture?.()||(()=>{});
     await new Promise(resolve=>setTimeout(resolve,0));if(!current())return;
     if(selected==='victory'){
      const {captureVictoryCard}=await import('./victory-card.js');if(!current())return;
      content=await captureVictoryCard(victorySource(api.state()),{cancelled:()=>!current(),progress:note});
     }else{
      const s=structuredClone(api.state()),shot=api.capture();if(!shot)throw Error('场景还没准备好，请稍后重试。');
      content={shots:[shot],statistics:stats(s),label:shot.label||api.sceneLabel()};
     }
     release();
    }
    if(!current())return;
    const card=await paintShareStory({kind,data,content,style,momentId});if(!current())return;
    const img=await shareImagePreview(card.blob,card.label+' · '+(choices.find(c=>c.id===style)?.name||'纪念卡'));
    if(!current())return;prepared=card;q('#share-card-preview').replaceChildren(img);note('');
   }catch(e){note(e.message||'图片没有生成成功，请重试。');}
   finally{release();busy=false;if(current())activeButtons();}
  }
  for(const b of panel.querySelectorAll('[data-card-style]'))b.onclick=()=>{
   if(busy||b.dataset.cardStyle===style)return;style=b.dataset.cardStyle;
   if(style)equipWeb(api.state(),style);else resetWeb(api.state(),'shareCard');api.changed?.();generate();
   q('#share-style-name').textContent=choices.find(c=>c.id===style).name;
  };
  for(const b of panel.querySelectorAll('[data-share-story]'))b.onclick=()=>{if(busy||kind===b.dataset.shareStory)return;kind=b.dataset.shareStory;generate();};
  q('#next-share-moment').onclick=()=>{if(busy)return;momentId=data.moments[(data.moments.findIndex(m=>m.id===momentId)+1)%data.moments.length].id;generate();};
  for(const b of panel.querySelectorAll('[data-card-mode]'))b.onclick=()=>{if(busy||selected===b.dataset.cardMode)return;selected=b.dataset.cardMode;generate(true);};
  q('#generate-card').onclick=()=>generate(true);q('#share-close').onclick=()=>dialog.close();
  const perform=async fn=>{
   if(busy||!prepared)return;busy=true;activeButtons();
   try{await fn(prepared,note);}catch(e){note(e.message||'操作未完成，请重试。');}
   finally{busy=false;if(current())activeButtons();}
  };
  q('#download-card').onclick=()=>perform(async card=>{await api.download(card.blob,card.file.name);note(platform.savedLabel);});
  platform.bind?.({panel,q,note,perform,api,current});activeButtons();generate();
 }};
}

import { firstPurchasePending } from './first-steps.js';
import { captiveNotice } from './notice-face.js';
export function takeShopHint(s,cost) {
 if(!firstPurchasePending(s)||s.shopHintSeen||s.money<cost)return false;
 s.shopHintSeen=true;return true;
}
export function createShopOnboarding({button,state,cost,save,open}) {
 const hint=document.createElement('button');hint.id='first-shop-hint';hint.type='button';hint.hidden=true;
 hint.innerHTML=`${captiveNotice()}<span>去商城救它</span>`;
 hint.setAttribute('aria-label','去商城解锁消息通知，10 颗绿宝石');
 // It must not participate in the hotbar flex layout or inherit its button size.
 document.body.append(hint);
 const captive=document.createElement('span');captive.className='shop-captive-token';captive.innerHTML=captiveNotice();button.append(captive);
 let timer,frame;
 function position(){
  frame=null;if(hint.hidden)return;
  const rect=button.getBoundingClientRect();
  const half=hint.offsetWidth/2,center=rect.left+rect.width/2;
  const x=Math.min(innerWidth-half-12,Math.max(half+12,center));
  hint.style.left=`${x}px`;hint.style.top=`${rect.top-hint.offsetHeight-12}px`;
  hint.style.setProperty('--hint-arrow-x',`${center-x+half}px`);
 }
 function schedule(){if(!frame)frame=requestAnimationFrame(position);}
 new ResizeObserver(schedule).observe(button);
 window.addEventListener('resize',schedule);window.visualViewport?.addEventListener('resize',schedule);
 function stop(){clearTimeout(timer);hint.hidden=true;button.classList.remove('first-shop-highlight');}
 hint.onclick=()=>{stop();open();};
 return {update(active){
  const s=state(),captured=firstPurchasePending(s)&&s.narrative?.intro==='captured';
  button.classList.toggle('has-captive-notice',captured);
  if(!captured||!active||s.money<cost||button.dataset.noticeCapturing)return stop();
  hint.hidden=false;position();
  if(takeShopHint(s,cost)){save();button.classList.add('first-shop-highlight');timer=setTimeout(()=>button.classList.remove('first-shop-highlight'),3300);}
 }};
}

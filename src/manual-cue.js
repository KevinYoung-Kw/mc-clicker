import { manualCuePending } from './opening-guide.js';
import { icon } from './icons.js';

// Highlight the real tool (or its mobile menu), without reserving panel space.
export function createManualCue(api) {
  const hint=document.createElement('button');hint.id='manual-entry-hint';hint.type='button';hint.hidden=true;
  hint.innerHTML=`${icon('book',16)}<span>操作指南在这里</span>`;
  hint.setAttribute('aria-label','打开世界信息的操作指南');
  hint.onclick=()=>{if(api.foreground?.()!==false&&api.available())api.openManual();};
  document.body.append(hint);
  let target=null;
  function hide(){if(!hint.hidden)hint.hidden=true;target?.classList.remove('tutorial-entry-highlight');target=null;}
  const visible=node=>node&&!node.hidden&&!node.inert&&node.getBoundingClientRect().width>0&&getComputedStyle(node).visibility!=='hidden';
  function update(){
    const s=api.state();
    if(!manualCuePending(s)||!s.guidance.notices||!api.available()||api.foreground?.()===false||document.querySelector('#modal')?.open)return hide();
    const tool=document.getElementById('info-open'),menu=document.getElementById('hud-more');
    const next=visible(tool)?tool:visible(menu)?menu:null;
    if(!next)return hide();
    if(target!==next){target?.classList.remove('tutorial-entry-highlight');target=next;target.classList.add('tutorial-entry-highlight');}
    // The spoken cue already has a button. Do not add a second bubble beside it.
    hint.hidden=!!s.narrative.current||api.notices.busy||menu?.getAttribute('aria-expanded')==='true';
    if(hint.hidden)return;
    const r=target.getBoundingClientRect(),half=hint.offsetWidth/2;
    const center=r.left+r.width/2,x=Math.max(half+12,Math.min(innerWidth-half-12,center));
    hint.style.left=`${x}px`;hint.style.top=`${r.bottom+10}px`;
    hint.style.setProperty('--hint-arrow-x',`${center-x+half}px`);
  }
  window.addEventListener('resize',update);
  return {update,hide};
}

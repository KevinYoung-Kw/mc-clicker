// Reserve only the space occupied by the current subtitle/receipt burst.
// A brief sentence gap keeps the lane; silence releases it. Never collapse
// underneath a finger or while the player is scrolling the panel.
export function createPanelNoticeLane({game,panel,host,schedule}) {
  const slot=document.createElement('div');
  slot.id='panel-notice-slot';slot.hidden=true;slot.setAttribute('aria-hidden','true');
  const content=panel.querySelector('#panel-content');panel.insertBefore(slot,content);
  let height=0,lastVisible=0,timer=null,scrollUntil=0;
  const pointers=new Set();
  function resize(next) {
    if(next===height)return;
    const before=content.getBoundingClientRect().top,scroll=content.scrollTop;
    height=next;slot.hidden=!next;slot.style.height=`${next}px`;
    // Keep the same list row under the eye when already scrolled into a list.
    if(scroll>0)content.scrollTop=Math.max(0,scroll+content.getBoundingClientRect().top-before);
  }
  panel.addEventListener('pointerdown',e=>pointers.add(e.pointerId),true);
  const release=e=>{pointers.delete(e.pointerId);schedule();};
  window.addEventListener('pointerup',release);window.addEventListener('pointercancel',release);
  window.addEventListener('blur',()=>{pointers.clear();schedule();});
  content.addEventListener('scroll',()=>{scrollUntil=performance.now()+180;schedule();},{passive:true});
  return function position() {
    clearTimeout(timer);timer=null;
    const full=game.classList.contains('sheet-expanded')&&innerWidth<760;
    if(!full || host.dataset.mode==='pause'){resize(0);return;}
    const now=performance.now();
    if(!host.hidden){
      lastVisible=now;
      resize(Math.max(height,Math.ceil(host.getBoundingClientRect().height)+16));
    } else if(height){
      const delay=Math.max(lastVisible+700,scrollUntil)-now;
      if(delay>0)timer=setTimeout(schedule,delay+1);
      else if(!pointers.size)resize(0);
    }
    if(height)host.style.setProperty('--notice-y',`${slot.getBoundingClientRect().top+8}px`);
  };
}

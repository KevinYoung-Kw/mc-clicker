import { icon } from './icons.js';
import { noticeFace } from './notice-face.js';

// Tool access is earned with the narrator. Invisible destination slots are
// reserved only during this short flight, then each arrival reveals its tool.
export function createCompanionFlight(api) {
  const effects=new Set();let generation=0;
  const reduced=()=>api.state().reducedMotion||matchMedia('(prefers-reduced-motion: reduce)').matches;
  function reveal(id){const node=document.getElementById(id);if(node){delete node.dataset.companionArriving;node.inert=false;}}
  function cancel(){generation++;for(const e of effects){e.animation?.cancel();e.node.remove();}effects.clear();for(const node of document.querySelectorAll('[data-companion-arriving]'))reveal(node.id);}
  function reserve(){for(const id of ['settings','quick-help','share-open','info-open','hud-more']){const node=document.getElementById(id);if(node){node.dataset.companionArriving='true';node.inert=true;}}api.paint();}
  function destination(id){
    const tool=document.getElementById(id),rect=tool?.getBoundingClientRect();
    return tool&&!tool.hidden&&rect?.width&&rect.height?tool:document.getElementById('hud-more');
  }
  async function fly(spec,index,start,run){
    const chip=document.createElement('div');chip.className='narrator-companion';chip.setAttribute('popover','manual');chip.setAttribute('aria-hidden','true');
    chip.dataset.companion=spec.id;
    chip.innerHTML=`<span class="companion-token">${spec.id==='info-open'?noticeFace('smile'):icon(spec.icon,24)}</span><span class="companion-name">${spec.name}</span>`;
    chip.style.left=`${start.x-20}px`;chip.style.top=`${start.y-20}px`;document.body.append(chip);chip.showPopover?.();
    const effect={node:chip,animation:null};effects.add(effect);
    try{
      effect.animation=chip.animate([{opacity:0,transform:'scale(.3)'},{opacity:0,transform:'scale(.3)'}],{duration:1+index*170,fill:'forwards'});await effect.animation.finished;
      if(run!==generation)return;
      const target=destination(spec.id),r=target?.getBoundingClientRect();if(!r?.width)return;
      const dx=r.left+r.width/2-start.x,dy=r.top+r.height/2-start.y;
      // A small outward hop, then a smooth arc into the real on-screen tool.
      const side=index===0?-1:1,cx=dx*.32+side*34,cy=Math.min(-58,dy*.45-28);
      const frames=Array.from({length:25},(_,i)=>{
        const t=i/24,x=2*(1-t)*t*cx+t*t*dx,y=2*(1-t)*t*cy+t*t*dy;
        const scale=t<.16?.4+t*4.4:t<.65?1.1:1.1-(t-.65)*2.2;
        return {offset:t,transform:`translate(${x}px,${y}px) scale(${scale}) rotate(${Math.sin(t*Math.PI)*side*12}deg)`,opacity:t<.1?t*10:t>.86?(1-t)/.14:1};
      });
      effect.animation=chip.animate(frames,{duration:800,easing:'cubic-bezier(.3,.15,.45,1)',fill:'forwards'});await effect.animation.finished;
      if(run!==generation)return;
      reveal(spec.id);
      if(spec.id==='settings'){reveal('quick-help');reveal('hud-more');}
      const spark=document.createElement('div');spark.className='companion-arrival';spark.setAttribute('popover','manual');spark.setAttribute('aria-hidden','true');
      const end=target.getBoundingClientRect();spark.style.left=`${end.left+end.width/2-24}px`;spark.style.top=`${end.top+end.height/2-24}px`;
      document.body.append(spark);spark.showPopover?.();const arrival={node:spark,animation:null};effects.add(arrival);
      arrival.animation=spark.animate([{opacity:1,transform:'scale(.5)'},{opacity:1,transform:'scale(1.08)',offset:.5},{opacity:0,transform:'scale(1.25)'}],{duration:300,easing:'steps(5,end)'});
      try{await arrival.animation.finished;}finally{spark.remove();effects.delete(arrival);}
    }catch{/* Menus, resizing and backgrounding can cancel without a replay. */}
    finally{chip.remove();effects.delete(effect);if(run===generation){reveal(spec.id);if(spec.id==='settings'){reveal('quick-help');reveal('hud-more');}}}
  }
  window.addEventListener('resize',cancel);
  document.getElementById('hud-more')?.addEventListener('click',cancel);
  return {cancel,play(rect){
    cancel();if(reduced()||!rect?.width||api.foreground?.()===false)return;
    reserve();
    const start={x:rect.left+rect.width/2,y:rect.top+rect.height/2},run=generation;
    [{id:'settings',icon:'settings',name:'设置'},{id:'share-open',icon:'share',name:'分享'},{id:'info-open',icon:'info',name:'消息通知'}].forEach((spec,index)=>fly(spec,index,start,run));
  }};
}

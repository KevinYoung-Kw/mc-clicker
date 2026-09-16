import {COMMUNITY_SOUVENIRS} from './community-souvenirs-data.js';
import {GARDEN_ITEMS,GARDEN_BY_ID,gardenItemReason,GARDEN_LEVEL_COSTS} from './garden-data.js';
import {gardenObjects,gardenObject} from './garden.js';
import {TERRAIN_TYPES,TERRAIN_RESTORE,TERRAIN_BY_ID,terrainPalette} from './terrain-data.js';
import {icon} from './icons.js';
import {editingUndoAvailable} from './editing.js';
const stages=['','花草与整理','树林与花园','温室与奇景'];
const picture=(type,name)=>`<img src="${import.meta.env.BASE_URL}icons/garden-${type}.png" width="64" height="64" alt="${name}" loading="lazy">`;
const terrainSwatch=id=>{
 const theme={top:'#8faf70',rock:'#6f8f5a',edge:'#5a6e4a'};
 const p=terrainPalette(id,theme)||{ground:theme.top,edge:theme.edge,detail:theme.rock},color=p.ground;
 const detail=p.water?'<path d="M17 21h8m3 5h8" stroke="'+p.detail+'" stroke-width="2"/>':p.style==='district'?'<path d="M16 15l24 14m-22 0l22-14" stroke="'+p.detail+'" stroke-width="1"/>':'<path d="M17 19h5v3h-5zm12-3h4v3h-4zm-1 11h6v3h-6z" fill="'+p.detail+'"/>';
 return '<svg class="terrain-preview" viewBox="0 0 56 50" width="52" height="48" aria-hidden="true"><path d="M4 24l24 14 24-14v8L28 46 4 32z" fill="'+p.edge+'"/><path d="M4 24L28 10l24 14-24 14z" fill="'+color+'"/>'+detail+'</svg>';
};
export function createGardenUI(api){
 let tab='plant',level='terrain',selected=null,undo=null,limit=12,brush=1;
 const itemOf=p=>GARDEN_BY_ID[p?.kind==='tree'?'oak':p?.type];
 function souvenirMarkup(s){
  const rows=COMMUNITY_SOUVENIRS.filter(i=>s.communityStories?.unlocked.includes(i.id));
  return `<div class="garden-stock souvenir-stock">${rows.length?rows.map(i=>{
   const claimed=s.communityStories.claimed.includes(i.id),stored=s.garden.stored[i.id]||0;
   const placed=s.garden.plants.find(p=>p.type===i.id);
   return `<article data-souvenir="${i.id}">${picture(i.id,i.name)}<div class="garden-copy"><strong>${i.name}</strong><p>${i.desc}</p><small>${i.w}×${i.d} 格 · ${!claimed?'可领取':stored?'待摆放':'已摆放'}</small><p class="souvenir-inscription">${i.inscription.replaceAll('\n','<br>')}</p></div>${!claimed?`<button class="primary" data-souvenir-claim="${i.id}">免费领取</button>`:stored?`<button class="primary" data-garden-plant="${i.id}">摆放</button>`:placed?`<button data-souvenir-find="${placed.id}" aria-label="定位${i.name}">${icon('locate',18)}</button>`:'<span>已领取 ✓</span>'}</article>`;
  }).join(''):'<p class="empty-note">还没发现纪念景物。继续建设，偶尔会碰到一些小故事。</p>'}</div>`;
 }
 function terrainMarkup(s){
  const unlocked=!!s.counts.V20;
  const rows=[TERRAIN_RESTORE,...TERRAIN_TYPES];
  const captions={mottle:'恢复扩地时的自然草地',grassLight:'浅绿草坪',grassDark:'深绿草坪',sand:'细沙地面',water:'不可通行，也不能建造',dirt:'泥土庭院',village:'村庄同款地面',industry:'工业同款地面',center:'演出区同款地面'};
  return '<div class="terrain-brushbar"><span>铺设范围</span><div class="segmented-control" role="group" aria-label="笔触大小">'+[1,2,3].map(n=>'<button data-garden-brush="'+n+'" aria-pressed="'+(brush===n)+'" aria-label="铺设 '+n+' 乘 '+n+' 格">'+n+' × '+n+'</button>').join('')+'</div></div><div class="terrain-list">'+rows.map(i=>{
   const reason=!unlocked?'先建造园艺台':'';
   return '<article class="terrain-row" data-terrain-product="'+i.id+'">'+terrainSwatch(i.id)+'<div><strong>'+i.name+'</strong><small>'+captions[i.id]+'</small></div><button class="quiet-button" data-garden-terrain="'+i.id+'" '+(reason?'disabled':'')+' aria-label="选择'+i.name+'">'+(i.cost?api.format(i.cost)+' ◆<small>/ 格</small>':icon('undo',16)+' 恢复')+icon('arrow',14)+'</button><span class="purchase-reason" data-terrain-reason '+(reason?'':'hidden')+'>'+reason+'</span></article>';
  }).join('')+'</div>';

 }
 function plantMarkup(s){
  if(level==='terrain')return terrainMarkup(s);
  return `<div class="garden-stock">${GARDEN_ITEMS.filter(i=>i.group===level).map(i=>`<article data-garden-product="${i.id}">${picture(i.id,i.name)}<div class="garden-copy"><strong>${i.name}</strong><p>${i.desc}</p><small>${i.w}×${i.d} 格</small><small class="garden-reason" data-garden-reason></small></div><button class="primary" data-garden-plant="${i.id}" aria-label="${i.group==='ground'?'铺设':'种植'}${i.name}">${api.format(i.cost)} ◆</button></article>`).join('')}</div>`;
 }
 function markup(){
  if(undo&&!editingUndoAvailable(api.state(),{family:'garden',token:undo}))undo=null;
  const s=api.state(),lv=s.counts.V20||0,p=gardenObject(s,selected),i=itemOf(p);
  const painted=Object.keys(s.garden?.terrain||{}).length;
  return `<section class="garden-panel" aria-label="园艺管理"><header class="garden-heading"><img src="${import.meta.env.BASE_URL}icons/V20.png" width="68" height="68" alt="园艺台"><div><strong>园艺台 · Lv.${lv}</strong><p>${stages[lv]}</p></div>${lv<3?`<button class="primary" data-buy="V20">升级 · ${api.format(GARDEN_LEVEL_COSTS[lv])} ◆</button>`:'<span class="garden-complete">已满级 ✓</span>'}</header>${lv<3?`<p class="garden-next">下一级：${lv===1?'更多地表、花草、树木与浅水布景':'藤架、发光蕈与异域植物'}</p>`:''}<nav class="management-tabs" aria-label="园艺操作"><button data-garden-tab="plant" aria-pressed="${tab==='plant'}" class="${tab==='plant'?'active':''}">布置</button><button data-garden-tab="arrange" aria-pressed="${tab==='arrange'}" class="${tab==='arrange'?'active':''}">整理</button><button data-garden-tab="souvenirs" aria-pressed="${tab==='souvenirs'}" class="${tab==='souvenirs'?'active':''}">纪念景物</button></nav>${tab==='arrange'?'<div class="garden-mode-row"><button data-garden-edit class="quiet-button">到世界整理 →</button></div>':''}${tab==='souvenirs'?souvenirMarkup(s):tab==='plant'?`<div class="garden-filterbar"><nav class="garden-filters" aria-label="布景种类">${[['terrain','地貌'],['ground','地表'],['flowers','花草'],['trees','林木'],['odd','奇景']].map(([l,name])=>`<button data-garden-level="${l}" aria-pressed="${level===l}">${name}</button>`).join('')}</nav><button class="garden-repeat" data-garden-continuous aria-pressed="${api.continuous?.()===true}" aria-label="连续布置" title="连续布置：完成后继续摆下一处">${icon('repeat',16)}<span>连续</span></button></div>${plantMarkup(s)}`:`<p class="garden-hint">到世界中连续整理，或从下方列表挑选。自然布景可清除，已购布景可收回。已改地貌 ${painted} 格，可用「扩地原貌」笔刷刷回。</p><div class="garden-selection" aria-live="polite">${p?`${picture(i.id,i.name)}<div><strong>${i.name}</strong><small>${p.native?'自然生长':i.group==='ground'?'已铺设':i.souvenir?'纪念景物':'自己种下'} · ${p.x}, ${p.z}</small></div><div class="garden-tools"><button data-garden-move>${icon('wrench',17)} 搬动</button><button data-garden-clear>${p.native?'清除':'收回'}</button></div>`:'<span>选一处布景，开始整理</span>'}</div>${undo?'<button class="quiet-button" data-garden-undo>↶ 撤销上次清除</button>':''}${Object.values(s.garden.stored||{}).some(n=>n>0)?`<h4>已收纳</h4><div class="garden-stored">${Object.entries(s.garden.stored).filter(([,n])=>n>0).map(([id,n])=>`<button data-garden-plant="${id}">${picture(id,GARDEN_BY_ID[id].name)}<span>${GARDEN_BY_ID[id].name} × ${n}</span><b>摆放</b></button>`).join('')}</div>`:''}<div class="garden-inventory">${gardenObjects(s).slice(0,limit).map(p=>{const i=itemOf(p);return `<button data-garden-object="${p.id}" aria-pressed="${selected===p.id}">${picture(i.id,i.name)}<span><strong>${i.name}</strong><small>${p.native?'自然生长':i.group==='ground'?'已铺设':i.souvenir?'纪念景物':'已种植'} · ${p.x}, ${p.z}</small></span>${icon('locate',18)}</button>`}).join('')||'<p class="empty-note">还没有可整理的布景。</p>'}</div>${gardenObjects(s).length>limit?'<button class="quiet-button" data-garden-more>查看更多布景</button>':''}`}</section>`;
 }
 function render(){api.rerender();api.mode(tab==='arrange'?selected:undefined);}
 function bind(root){const on=(q,fn)=>root.querySelectorAll(q).forEach(b=>b.onclick=()=>fn(b));
 on('[data-souvenir-claim]',b=>{api.claim(b.dataset.souvenirClaim);});
 on('[data-souvenir-find]',b=>{selected=b.dataset.souvenirFind;tab='arrange';render();api.focus(gardenObject(api.state(),selected));});
 on('[data-garden-continuous]',()=>{api.setContinuous(!api.continuous());refresh(root)});
 on('[data-garden-edit]',()=>api.arrange());
 on('[data-garden-tab]',b=>{tab=b.dataset.gardenTab;render()});
 on('[data-garden-level]',b=>{level=b.dataset.gardenLevel;render()});
 on('[data-garden-brush]',b=>{brush=+b.dataset.gardenBrush||1;api.setBrush?.(brush);render()});
 on('[data-garden-terrain]',b=>api.paintTerrain(b.dataset.gardenTerrain,brush));
 on('[data-garden-plant]',b=>api.plant(b.dataset.gardenPlant));
 on('[data-garden-object]',b=>{selected=b.dataset.gardenObject;render();api.focus(gardenObject(api.state(),selected))});
 on('[data-garden-more]',()=>{limit+=12;render()});
 on('[data-garden-move]',()=>{const p=gardenObject(api.state(),selected);if(p)api.plant(itemOf(p).id,p.id)});
 on('[data-garden-clear]',()=>{const result=api.clear(selected);if(result.ok){undo=result.undo;selected=null;render()}});
 on('[data-garden-undo]',()=>{
  const token=undo;if(!token)return;
  const result=api.undo(token);if(result.ok){selected=token.id;undo=null;render()}
 });
 refresh(root);
 }
 function refresh(root){
  const s=api.state(),toggle=root.querySelector('[data-garden-continuous]');
  if(toggle){const active=api.continuous?.()===true;if(toggle.getAttribute('aria-pressed')!==String(active)){toggle.setAttribute('aria-pressed',String(active));}
  }
  root.querySelectorAll('[data-garden-product]').forEach(row=>{
   const i=GARDEN_BY_ID[row.dataset.gardenProduct],reason=gardenItemReason(s,i.id)||(!(s.garden.stored?.[i.id]>0)&&s.money<i.cost?`还差 ${api.format(Math.ceil(i.cost-s.money))} 绿宝石`:'');
   const label=row.querySelector('[data-garden-reason]'),button=row.querySelector('[data-garden-plant]');
   if(label){if(label.textContent!==reason)label.textContent=reason;label.hidden=!reason;}
   if(button){button.disabled=!!reason;const text=s.garden.stored?.[i.id]>0?'摆放 ×'+s.garden.stored[i.id]:api.format(i.cost)+' ◆';if(button.textContent!==text)button.textContent=text;}
  });
  root.querySelectorAll('[data-terrain-product]').forEach(row=>{
   const id=row.dataset.terrainProduct,item=id===TERRAIN_RESTORE.id?TERRAIN_RESTORE:TERRAIN_BY_ID[id];
   const reason=!s.counts.V20?'先建造园艺台':'';
   const label=row.querySelector('[data-terrain-reason]'),button=row.querySelector('[data-garden-terrain]');
   if(label){if(label.textContent!==reason)label.textContent=reason;label.hidden=!reason;}
   if(button)button.disabled=!!reason||!item;
  });
 }
 return {markup,bind,refresh,key:()=>[tab,level,selected,!!undo,limit,brush],select:id=>{tab='arrange';selected=id;render()},editing:()=>tab==='arrange',restoreMode:()=>api.mode(tab==='arrange'?selected:undefined),brush:()=>brush};
}

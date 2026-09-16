import {HOMES,HOME_BY_ID,homeReason,housingCapacity} from './housing-data.js';
import {starterHomeAvailable,homeResidents,homeCost} from './housing.js';
import {escapeHtml as esc} from './residents.js';
import {icon,iconButton} from './icons.js';
const picture=h=>`<img src="${import.meta.env.BASE_URL}icons/home-${h.id==='legacy'?'cottage':h.id}.png" width="80" height="80" alt="${h.name}">`;
export function housingSummary(s){
 const capacity=housingCapacity(s),people=s.community.residents.filter(r=>!r.reserve).length,short=Math.max(0,people-capacity);
 return `<div class="housing-summary"><span>住址 <b>${people} / ${capacity}</b></span><span class="${short?'housing-shortage':''}">${short?`${short} 位待入住`:`${capacity-people} 个空住址`}</span></div>${short?'<p class="housing-note">现有村民照常工作。补齐住房、留出空位后，可以继续招募。</p>':''}`;
}
export function housingInvitation(s){
 if(starterHomeAvailable(s))return `<button class="housing-invitation" data-housing-open>${icon('home',22)}<span><strong>首位村民的安家礼</strong><small>橡木尖顶屋 · 0 绿宝石领取</small></span>${icon('arrow',16)}</button>`;
 if(s.housing.stored.oak>0)return `<button class="housing-invitation" data-housing-open>${icon('home',22)}<span><strong>还有一座住宅待建造</strong><small>到住房页选一个位置</small></span>${icon('arrow',16)}</button>`;
 return '';
}
export function createHousingUI(api){
 let tab='homes',selected=null;
 function markup(){const s=api.state(),gift=starterHomeAvailable(s);
  return `<section class="housing-panel" aria-label="村庄住房">${gift?'':housingSummary(s)}${gift?`<div class="housing-gift">${picture(HOME_BY_ID.oak)}<div><strong>首位村民的安家礼</strong><p>一座橡木尖顶屋，领取后自己选址建造。</p></div><button class="primary" data-home-claim>0 ◆ 领取</button></div>`:''}<nav class="management-tabs" aria-label="住房操作"><button data-home-tab="homes" aria-pressed="${tab==='homes'}" class="${tab==='homes'?'active':''}">已建住宅 · ${s.housing.homes.length}</button><button data-home-tab="build" aria-pressed="${tab==='build'}" class="${tab==='build'?'active':''}">建造住宅</button></nav>${Object.entries(s.housing.stored).filter(([,n])=>n>0).map(([id,n])=>`<div class="housing-stored">${picture(HOME_BY_ID[id])}<div><strong>${HOME_BY_ID[id].name}</strong><small>${n} 座待摆放 · 免费</small></div><button class="primary" data-home-build="${id}">选址建造</button></div>`).join('')}${tab==='build'?`<div class="garden-mode-row"><button data-home-continuous aria-pressed="${api.continuous?.()===true}">${icon('repeat',18)} 连续建造：${api.continuous?.()?'开':'关'}</button></div><div class="housing-catalog">${HOMES.map(h=>`<article data-home-product="${h.id}">${picture(h)}<div class="housing-copy"><h3>${h.name}</h3><p>${h.desc}</p><small>${h.beds} 个独立住址 · ${h.w}×${h.d} 格</small><small class="housing-reason" data-home-reason></small></div><button class="primary" data-home-build="${h.id}">${api.format(homeCost(s,h.id))} ◆</button></article>`).join('')}</div>`:`<div class="housing-list">${s.housing.homes.map(h=>{const spec=HOME_BY_ID[h.type],residents=homeResidents(s,h.id),open=selected===h.id;return `<article class="housing-address" data-selected="${open}"><div class="housing-address-heading">${picture(spec)}<div><h3>${spec.name}</h3><small>${h.id.slice(5)} 号 · 入住 ${residents.length} / ${spec.beds}</small></div><div class="housing-building-tools">${iconButton('locate',`定位${h.id.slice(5)}号住宅`,`data-home-locate="${h.id}"`)}${iconButton('wrench',`搬动${h.id.slice(5)}号住宅`,`data-home-move="${h.id}"`)}${iconButton('box',`收纳${h.id.slice(5)}号住宅`,`data-home-store="${h.id}"`)}</div></div><div class="housing-occupants">${Array.from({length:spec.beds},(_,j)=>{const r=residents.find(r=>r.unit===j+1);return `<span>${h.id.slice(5)}-${j+1} <b>${r?esc(r.name):'空住址'}</b></span>`}).join('')}</div><div class="housing-actions"><button data-home-details="${h.id}" aria-expanded="${open}">${open?'收起':'入住安排'}</button></div>${open?assignments(h):''}</article>`}).join('')||(!gift&&!Object.values(s.housing.stored).some(n=>n>0)?'<p class="empty-note">还没有住宅。到「建造住宅」挑一种房型。</p>':'')}</div>`}</section>`;
 }
 function assignments(home){const s=api.state(),spec=HOME_BY_ID[home.type],used=homeResidents(s,home.id),empty=Array.from({length:spec.beds},(_,i)=>i+1).filter(unit=>!used.some(r=>r.unit===unit));
  if(!empty.length)return '<p class="housing-note">这里住满了。</p>';
  const candidates=s.community.residents.filter(r=>!r.reserve&&!used.some(p=>p.id===r.id));
  return `<div class="housing-assignment"><p>安排到 ${home.id.slice(5)}-${empty[0]} 号住址</p>${candidates.map(r=>{const a=s.housing.assignments[r.id];return `<button data-home-resident="${r.id}" data-home-id="${home.id}" data-home-unit="${empty[0]}"><strong>${esc(r.name)}</strong><span>${a?`从 ${a.homeId.slice(5)}-${a.unit} 号搬来`:'入住'}</span></button>`}).join('')||'<p class="housing-note">其他住址已经安排妥当。招募新村民后会自动入住。</p>'}</div>`;
 }
 function render(){api.rerender();}
 function bind(root){const on=(q,fn)=>root.querySelectorAll(q).forEach(b=>b.onclick=()=>fn(b));
  on('[data-home-continuous]',()=>{api.setContinuous(!api.continuous());render();});
  on('[data-home-tab]',b=>{tab=b.dataset.homeTab;render()});
  on('[data-home-claim]',()=>{const result=api.claim();if(result.ok){tab='homes';render();api.build('oak');}});
  on('[data-home-build]',b=>api.build(b.dataset.homeBuild));
  on('[data-home-move]',b=>{const h=api.state().housing.homes.find(h=>h.id===b.dataset.homeMove);if(h)api.build(h.type,h.id);});
  on('[data-home-store]',b=>api.store(b.dataset.homeStore));
  on('[data-home-locate]',b=>api.focus(api.state().housing.homes.find(h=>h.id===b.dataset.homeLocate)));
  on('[data-home-details]',b=>{selected=selected===b.dataset.homeDetails?null:b.dataset.homeDetails;render();});
  on('[data-home-resident]',b=>{api.assign(b.dataset.homeResident,b.dataset.homeId,+b.dataset.homeUnit);});
  refresh(root);
 }
 function refresh(root){const s=api.state();root.querySelectorAll('[data-home-product]').forEach(row=>{const id=row.dataset.homeProduct,cost=homeCost(s,id),reason=homeReason(s,id)||(s.money<cost?`还差 ${api.format(Math.ceil(cost-s.money))} 绿宝石`:''),label=row.querySelector('[data-home-reason]'),button=row.querySelector('button');if(label.textContent!==reason)label.textContent=reason;button.disabled=!!reason;const text=cost?`${api.format(cost)} ◆ 建造`:'免费摆放住宅';if(button.textContent!==text)button.textContent=text;});}
 return {markup,bind,refresh,key:()=>[tab,selected],select(id){tab='homes';selected=id||null;}};
}

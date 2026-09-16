import { WEB_ITEMS, WEB_BY_ID, WEB_CATEGORIES } from './web-catalog.js';
import { resetWeb, equipWeb } from './presentation.js';
import { cursorArt } from './web-cursors.js';
import { webArt } from './web-art.js';
import { formatWallet, price } from './game.js';
import { ITEMS } from './catalog.js';
import { icon } from './icons.js';
import { stallLevel, catalogLevel, appearanceAvailable, appearanceRequirement, tierContents, STALL_NAMES, APPEARANCE_TIERS } from './appearance-growth.js';
import './appearance-shop.css';
export { collectionArt } from './collection-art.js';
export function createCollectionShop(api) {
 let category='title',selected='web-title-first-block',scroll=0;
 const root=()=>document.querySelector('#collection-shop');
 const q=s=>root()?.querySelector(s);
 function open(cat=category,itemId=null) { if(WEB_CATEGORIES[cat])category=cat;if(WEB_BY_ID[itemId]?.category===category)selected=itemId;render(); }
 function render() {
  const s=api.state(),level=stallLevel(s),ready=level>0;
  const focused=root()?.querySelector(':focus')?.getAttribute('data-web-select');
  if(root())scroll=q('.appearance-grid')?.scrollTop||0;
  const items=WEB_ITEMS.filter(i=>i.category===category);
  if(!items.some(i=>i.id===selected))selected=items.find(i=>s.webAppearance.equipped[i.slot]===i.id)?.id||items[0].id;
  const i=WEB_BY_ID[selected],owned=!!s.webAppearance.owned[i.id],equipped=s.webAppearance.equipped[i.slot]===i.id;
  const unlocked=appearanceAvailable(s,i),next=level+1,newCount=tierContents(next).length-tierContents(level).length;
  api.modal(`<div id="collection-shop" class="appearance-shop"><header class="appearance-heading"><div><span class="eyebrow">THE LITTLE THINGS</span><h2>装扮商店</h2></div><b data-shop-money></b>${s.placements.X2&&api.store?`<button class="quiet-button facility-icon" data-stall-store aria-label="收纳装扮摊" title="收纳装扮摊">${icon("box",18)}</button>`:""}</header>${ready?`
   <section class="appearance-stall" aria-label="装扮摊等级"><div class="stall-badge">${icon('brush',28)}</div><div><h3>${STALL_NAMES[level]} <small>Lv.${level}</small></h3><p>${WEB_ITEMS.filter(x=>appearanceAvailable(s,x)).length} 件可选${level<3&&catalogLevel(s)<3?` · 下级添 ${newCount} 件`:''}</p></div>${level<3?`<button class="primary" data-stall-upgrade aria-label="升级装扮摊">升级 <span>${formatWallet(price(s,ITEMS.X2))} ◆</span></button>`:`<span class="stall-complete">${icon('check',16)} 货架齐了</span>`}</section>
   <nav class="appearance-tabs" role="tablist" aria-label="网页装扮分类">${Object.entries(WEB_CATEGORIES).map(([id,name])=>`<button role="tab" data-collection-tab="${id}" aria-selected="${category===id}">${name}<small>${WEB_ITEMS.filter(x=>x.category===id&&s.webAppearance.owned[x.id]).length}/${WEB_ITEMS.filter(x=>x.category===id).length}</small></button>`).join('')}</nav>
   <div class="appearance-editor"><section class="appearance-grid" aria-label="${WEB_CATEGORIES[category]}">${items.map(x=>`<button class="appearance-tile ${appearanceAvailable(s,x)?'':'stock-locked'}" data-web-select="${x.id}" aria-pressed="${x.id===selected}"><span class="appearance-art" data-art-slot="${x.slot}">${webArt(x)}</span><strong>${x.name}</strong><span>${s.webAppearance.equipped[x.slot]===x.id?'✓ 使用中':s.webAppearance.owned[x.id]?'已收藏':!appearanceAvailable(s,x)?`${icon('lock',12)} Lv.${APPEARANCE_TIERS[x.id]}`:formatWallet(x.cost)+' ◆'}</span></button>`).join('')}</section>
   <aside class="appearance-detail"><div class="appearance-large" data-art-slot="${i.slot}">${webArt(i)}</div><div class="appearance-caption"><small>${WEB_CATEGORIES[i.category]}</small><h3>${i.name}</h3></div><p>${i.effect}</p>${i.slot==='cursor'?`<div class="cursor-specimens" aria-label="指针的实际操作状态">${[['default','浏览'],['pointer','点按'],['grab','抓取'],['grabbing','拖动']].map(([mode,label])=>`<span>${cursorArt(i.id,mode)}<small>${label}</small></span>`).join('')}</div>`:''}${i.slot==='icon'?`<div class="favicon-actual" aria-label="徽记实际尺寸"><span>${webArt(i)} 16px</span><span>${webArt(i)} 32px</span></div>`:''}<div class="appearance-actions">${!unlocked?`<button data-stall-upgrade>${icon('lock',14)} 升级装扮摊 · Lv.${APPEARANCE_TIERS[i.id]} 解锁</button>`:`<button class="primary" ${owned?`data-web-equip="${i.id}"`:`data-extra-buy="${i.id}"`}>${owned?(equipped?'取消装扮':'应用'):`${formatWallet(i.cost)} ◆ · 购买`}</button>`}</div><p class="purchase-reason" data-web-reason></p></aside></div>
   <footer class="appearance-footer"><span>${Object.keys(s.webAppearance.owned).length} / ${WEB_ITEMS.length} 件收藏</span><div><button data-web-default-slot="${i.slot}">还原此部位</button><button data-web-reset>恢复网页默认</button></div></footer>`:'<section class="appearance-closed"><h3>先建造装扮摊</h3><button class="primary" data-stall-buy>建造装扮摊 →</button></section>'}</div>`);
  if(q('.appearance-grid'))q('.appearance-grid').scrollTop=scroll;
  const store=q('[data-stall-store]');if(store)store.onclick=()=>api.store();
  root().querySelectorAll('[data-collection-tab]').forEach(b=>b.onclick=()=>{category=b.dataset.collectionTab;scroll=0;if(q('.appearance-grid'))q('.appearance-grid').scrollTop=0;render()});
  root().querySelectorAll('[data-web-select]').forEach(b=>b.onclick=()=>{selected=b.dataset.webSelect;render();q(`[data-web-select="${selected}"]`)?.focus({preventScroll:true});});
  q('[data-web-reset]')?.addEventListener('click',()=>{resetWeb(s);api.changed();render();api.toast('网页外观已还原')});
  q('[data-web-default-slot]')?.addEventListener('click',()=>{resetWeb(s,i.slot);api.changed();render()});
  root().querySelectorAll('[data-stall-buy],[data-stall-upgrade]').forEach(b=>b.onclick=()=>api.nodeBuy('X2'));
  q('[data-extra-buy]')?.addEventListener('click',()=>api.purchase(i.id));
  q('[data-web-equip]')?.addEventListener('click',()=>{if(equipped)resetWeb(s,i.slot);else equipWeb(s,i.id);api.changed();render()});
  const tabs=q('.appearance-tabs');if(tabs)tabs.onkeydown=e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;const bs=[...tabs.querySelectorAll('button')],n=bs.indexOf(document.activeElement);if(n<0)return;e.preventDefault();const target=bs[e.key==='Home'?0:e.key==='End'?bs.length-1:(n+(e.key==='ArrowRight'?1:-1)+bs.length)%bs.length];const id=target.dataset.collectionTab;target.click();q(`[data-collection-tab="${id}"]`)?.focus()};
  if(focused)q(`[data-web-select="${focused}"]`)?.focus({preventScroll:true});
  refresh();
 }
 function refresh(){
  const panel=root();if(!panel?.closest('dialog').open)return;
  const s=api.state(),text=(el,value)=>{if(el&&el.textContent!==value)el.textContent=value;};
  text(panel.querySelector('[data-shop-money]'),formatWallet(s.money)+' ◆');
  const b=panel.querySelector('[data-extra-buy]'),i=WEB_BY_ID[selected];
  if(b){const requirement=appearanceRequirement(s,i),enough=s.money>=i.cost,status=requirement?'locked':enough?'ready':'short';
   if(b.dataset.purchaseState!==status)b.dataset.purchaseState=status;
   text(panel.querySelector('[data-web-reason]'),requirement||(enough?'':`还差 ${formatWallet(Math.ceil(i.cost-s.money))} 绿宝石`));
  }
 }
 return {open,render,refresh};
}

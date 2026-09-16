import { ITEMS } from './catalog.js';
import { productionSummary } from './production-summary.js';
import { PRODUCTION_STAGES, GUIDE_LABELS, GUIDE_NOTES, productionOffers, productionSignals } from './production-guide.js';
import { UPGRADE_PURPOSE } from './upgrade-copy.js';
import { formatHudNumber as fmt } from './hud-numbers.js';
import { icon } from './icons.js';
import { escapeHtml as esc } from './residents.js';

const stateLabels={normal:'查看',warning:'较低',blocked:'受阻',idle:'待机'};
const purpose={M1:'增加矿区原料',M9:'提高钻机开采能力',M18:'增加自动采集能力',M3:'接入漏斗后增加原料',V8:'增加养殖原料',V9:'增加养殖原料',V10:'增加养殖原料',V6:'改善养殖产出',M8:'增加原料运输能力',M16:'增加铁路运力',V16:'增加区域运输能力',M2:'提高原料加工能力',T9:'提高三个世界的加工能力',V3:'提高成品出售能力',V17:'增加集市成交能力',N3:'补充下界原料与加工',N7:'增加下界原料',N8:'增加下界原料',N9:'增加下界原料',N2:'提高下界运输与交易',N12:'提高下界运输与交易',N4:'提高下界加工能力',E4:'增加末地原料',E11:'增加末地原料与加工',E5:'提高末地运输与交易',E7:'提高末地运输与交易',E8:'增加供能与末地加工',E10:'增加末地加工能力',M6:'增加持续供能',M7:'增加持续供能',M15:'增加持续供能',M4:'扩大各世界的仓储空间',E6:'扩大仓储并增加运力',M17:'提高三个世界的装卸能力'};
export function createProductionGuide(api) {
 let selection=null;
 function shelfMarkup(s,realm,key) {
  const rows=productionOffers(s,realm,key),available=rows.filter(r=>r.status.kind!=='locked'),locked=rows.filter(r=>r.status.kind==='locked');
  const rowMarkup=r=>`<article class="production-offer" data-guide-offer="${r.key}"><button class="guide-offer-name" data-guide-inspect="${r.key}"><strong>${esc(r.name)}</strong><small>${r.kind==='mod'?esc(ITEMS[r.id].name)+' · 改造':r.status.kind==='stored'?'已收纳 · 免费摆回':r.owned?'已有设施 · 升级':'新设施'}</small></button><button class="guide-offer-buy" data-guide-buy="${r.key}"></button><p class="guide-offer-purpose">${esc(r.mod?UPGRADE_PURPOSE[r.mod]||'设施改造':purpose[r.id]||'改善本环节')}</p><p class="guide-offer-reason" data-guide-reason></p></article>`;
  return `<section class="production-solutions" aria-label="${GUIDE_LABELS[key]}改善选项" data-guide-shelf="${realm}" data-guide-key="${key}"><header><h4>${GUIDE_LABELS[key]}改善</h4><button class="facility-icon" data-guide-close aria-label="收起改善选项">${icon('close',18)}</button></header><p class="guide-note">${GUIDE_NOTES[key]}</p><div class="guide-free-action" data-guide-free></div>${available.map(rowMarkup).join('')||'<p class="empty-note">暂时没有可直接购买的改善项目，可检查设备运行或查看下方解锁条件。</p>'}${locked.length?`<details class="guide-locked"><summary>待解锁 · ${locked.length} 项</summary>${locked.map(rowMarkup).join('')}</details>`:''}</section>`;
 }
 function slot(realm){return `<div data-guide-slot="${realm}">${selection?.realm===realm?shelfMarkup(api.state(),realm,selection.key):''}</div>`;}
 function choose(root,realm,key,origin=null){
  const same=selection?.realm===realm&&selection.key===key;
  const top=origin?.getBoundingClientRect().top;
  selection=same?null:{realm,key};
  for(const node of root.querySelectorAll('[data-guide-slot]'))node.innerHTML=selection?.realm===node.dataset.guideSlot?shelfMarkup(api.state(),realm,key):'';
  refresh(root,api.rates());
  if(origin&&Number.isFinite(top))root.scrollTop+=origin.getBoundingClientRect().top-top;
 }
 function bind(root){
  // Delegation survives numeric updates and intentional shelf re-renders.
  if(root._productionGuideBound)return;root._productionGuideBound=true;
  root.addEventListener('click',event=>{
   const b=event.target.closest('button');if(!b)return;
   if(b.hasAttribute('data-guide-stage'))return choose(root,b.dataset.guideRealm,b.dataset.guideStage,b);
   if(b.hasAttribute('data-guide-help'))return choose(root,b.dataset.guideRealm,b.dataset.guideHelp,b);
   if(b.hasAttribute('data-guide-close')){
    const saved=selection;selection=null;root.querySelector(`[data-guide-slot="${saved.realm}"]`).innerHTML='';
    refresh(root,api.rates());(root.querySelector(`[data-guide-realm="${saved.realm}"][data-guide-stage="${saved.key}"]`)||root.querySelector(`[data-guide-help][data-guide-realm="${saved.realm}"]`))?.focus({preventScroll:true});return;
   }
   const shelf=b.closest('[data-guide-shelf]');if(!shelf)return;
   if(b.dataset.guideFree){return b.dataset.guideFree==='power'?api.power():api.openItem(b.dataset.guideFree,true);}
   const row=productionOffers(api.state(),shelf.dataset.guideShelf,shelf.dataset.guideKey).find(r=>r.key===(b.dataset.guideBuy||b.dataset.guideInspect));if(!row)return;
   if(b.hasAttribute('data-guide-inspect')||row.status.kind==='locked')return row.mod?api.openMod(row.mod,row.id):api.openItem(row.id,true);
   if(row.status.kind==='short')return api.toast(row.status.reason);
   if(row.mod)api.upgrade(row.mod);else api.purchase(row.id);
  });
  root.addEventListener('keydown',e=>{
   if(e.key!=='Escape'||!e.target.closest('[data-guide-shelf]'))return;
   e.stopPropagation();e.preventDefault();e.target.closest('[data-guide-shelf]').querySelector('[data-guide-close]').click();
  });
 }
 function refresh(root,report,power=report.electricity){
  const s=api.state();
  for(const region of root.querySelectorAll('[data-region-overview]')){
   const realm=region.dataset.regionOverview,cap=report.regions[realm],actual=productionSummary(s,power,realm),view=productionSignals(cap,actual);
   for(const [key,label]of PRODUCTION_STAGES){
    const button=region.querySelector(`[data-guide-stage="${key}"]`);if(!button)continue;
    const signal=view.signals[key];button.dataset.signal=signal;
    button.setAttribute('aria-expanded',String(selection?.realm===realm&&selection.key===key));
    button.setAttribute('aria-label',`${label}产能 ${fmt(cap[key],true)} 份/秒，${stateLabels[signal]}，查看改善选项`);
    const tag=button.querySelector('[data-guide-signal]');tag.textContent=stateLabels[signal]+' ›';
   }
   const help=region.querySelector('[data-guide-help]');help.dataset.guideHelp=view.helpKey;
   const cause=region.querySelector('.region-cause');cause.dataset.signal=actual.tone==='blocked'?'blocked':actual.tone==='idle'?'idle':view.weak?'warning':'normal';
   region.querySelector('[data-bottleneck]').textContent=actual.tone==='working'?(view.weak?`${GUIDE_LABELS[view.weak]}产能较低 · 点开可改善`:'产线运行中 · 各环节产能接近'):`${ITEMS[actual.target].name} · ${actual.reason}`;
   for(const [kind,stock,capacity]of [['rawStorage',actual.raw,cap.rawCapacity],['storage',actual.goods,cap.capacity]]){
    const b=region.querySelector(`[data-guide-stage="${kind}"]`);if(b)b.dataset.signal=stock>=capacity*.9?'warning':'normal';
   }
   const shelf=region.querySelector('[data-guide-shelf]');if(!shelf)continue;
   const key=shelf.dataset.guideKey;
   let action='',label='',note='';
   if(actual.tone==='blocked'&&(key===actual.stage||key==='power')){
    if(['off','not-connected','out-of-range','route'].includes(actual.issue)){
     action=actual.target;label=actual.issue==='off'?'恢复设备运行':actual.issue==='route'?'检查线路':'检查设备接电';
     note='先处理当前运行状态，再决定是否扩建。';
    }else if(actual.issue==='no-power'){action='power';label='查看电网';note='先检查已购电源是否启用，再补充供能。';}
   }
   const free=shelf.querySelector('[data-guide-free]');const html=action?`<span>${note}</span><button data-guide-free="${action}">${label} ${icon('arrow',14)}</button>`:'';
   if(free.innerHTML!==html)free.innerHTML=html;free.hidden=!action;
   const rows=productionOffers(s,realm,key);
   for(const node of shelf.querySelectorAll('[data-guide-offer]')){
    const row=rows.find(r=>r.key===node.dataset.guideOffer),buy=node.querySelector('[data-guide-buy]'),reason=node.querySelector('[data-guide-reason]');
    const status=row?.status;buy.disabled=!status;buy.dataset.state=status?.kind||'complete';
    const html=!status?icon('check',14)+' 已完成':status.kind==='locked'?icon('lock',14)+' 查看条件':status.kind==='stored'?'免费摆回':`${fmt(status.cost)} <span class="mini-emerald"></span> ${icon('arrow',14)}`;
    if(buy.innerHTML!==html)buy.innerHTML=html;
    buy.setAttribute('aria-label',`${row?.name||'项目'}，${status?.kind==='locked'||status?.kind==='short'?status.reason:!status?'已完成':fmt(status.cost)+' 绿宝石'}`);
    const why=['short','locked'].includes(status?.kind)?status.reason:'';if(reason.textContent!==why)reason.textContent=why;reason.hidden=!why;
   }
  }
 }
 return {slot,bind,refresh};
}

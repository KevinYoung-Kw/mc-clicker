import {FARM_TYPES,farmLocations} from './farm-sites.js';
import {civicCount,civicCost} from './civic-data.js';
import {civicReason} from './civic-sites.js';
import {taskStatus,taskReady,requestTask,taskState} from './operations.js';
import {icon,iconButton} from './icons.js';
import {connectionControls} from './network-ui.js';
import {formatWallet} from './game.js';
const keys=(s,type)=>type==='V4'?['farm']:['milk','wool','treasure'].filter((k,i)=>s.counts[['V8','V9','V10'][i]]);
export function farmSitesMarkup(s,type){
 if(!FARM_TYPES[type]||!s.counts[type])return '';
 const def=FARM_TYPES[type],branches=(s.life?.sites||[]).filter(p=>p.type===type),list=[{id:type,type},...branches],reason=civicReason(s,type);
 return `<section class="farm-sites" data-farm-sites="${type}" aria-label="${def.name}工作地点"><header><h4>${def.name}工作地点</h4><span>${farmLocations(s,type).length} / 3 处</span></header><p class="panel-note">每处独立生长与收获，共享${type==='V4'?'种子':'动物品种'}、本体等级和改造。</p>${connectionControls(s,type)}${list.map((p,i)=>`<div class="farm-site-row" data-farm-site="${p.id}"><div><strong>${def.name} ${i+1}号</strong><small data-farm-worker></small><span data-farm-status></span></div><div class="farm-site-actions">${p.stored?`<button class="quiet-button" data-civic-move="${p.id}">摆回</button>`:i?iconButton('locate','定位'+def.name+(i+1)+'号',`data-civic-locate="${p.id}"`)+iconButton('wrench','移动'+def.name+(i+1)+'号',`data-civic-move="${p.id}"`)+iconButton('box','收起'+def.name+(i+1)+'号',`data-civic-store="${p.id}"`):iconButton('locate','定位'+def.name+'1号',`data-focus-item="${type}"`)}${!p.stored?`<button class="quiet-button" data-farm-harvest="${p.id}" aria-label="收取${def.name}${i+1}号的产物">${icon(type==='V4'?'wheat':'hand',16)} 收获</button>`:''}</div></div>`).join('')}<div class="farm-add-row">${civicCount(s,type)<3?`<button class="quiet-button" data-civic-build="${type}" ${reason?'disabled':''}>${icon('plus',16)} 增建${def.name} <b>${formatWallet(civicCost(s,type))} ◆</b></button><small data-farm-build-reason>${reason||'新建后可以再安排 1 位'+(type==='V4'?'农民':'牧工')}</small>`:'<small>已建齐全部工作地点</small>'}</div><button class="quiet-button" data-farm-staff="${def.job}">${icon('person',16)} 管理岗位 ${icon('arrow',14)}</button></section>`;
}
export function refreshFarmSites(root,s){
 for(const section of root.querySelectorAll('[data-farm-sites]'))for(const row of section.querySelectorAll('[data-farm-site]')){
  const id=row.dataset.farmSite,type=section.dataset.farmSites,site=(s.life?.sites||[]).find(p=>p.id===id),people=(s.community?.residents||[]).filter(r=>!r.reserve&&r.job===FARM_TYPES[type].job&&(r.farmSiteId||type)===id);
  const text=(q,v)=>{const el=row.querySelector(q);if(el&&el.textContent!==v)el.textContent=v;};
  text('[data-farm-worker]',people.length?people.map(r=>r.name).join('、'):'岗位空缺');
  const available=keys(s,type).filter(k=>id!==type||k!=='milk'),active=available.find(k=>taskState(s,k,site?.id).work>0)||available.find(k=>taskReady(s,k,site?.id))||available[0];
  text('[data-farm-status]',site?.stored?'已收起':active?taskStatus(s,active,site?.id):keys(s,type).length?'牛奶自动售出':'先添置牛、羊或猪');
  const b=row.querySelector('[data-farm-harvest]');if(b)b.disabled=!keys(s,type).some(k=>(id.startsWith('civic:')||k!=='milk')&&taskReady(s,k,id));
 }
}
export function requestFarmHarvest(s,id){
 const p=FARM_TYPES[id]&&s.counts[id]?{id,type:id}:(s.life?.sites||[]).find(p=>p.id===id&&!p.stored&&FARM_TYPES[p.type]);if(!p)return {ok:false,reason:'这处工作地点已收起'};
 const ready=keys(s,p.type).filter(k=>(id.startsWith('civic:')||k!=='milk')&&taskReady(s,k,id));if(!ready.length)return {ok:false,reason:'还没有成熟的产物'};
 return ready.map(k=>requestTask(s,k,id)).find(r=>r.ok)||{ok:false,reason:'正在收获'};
}

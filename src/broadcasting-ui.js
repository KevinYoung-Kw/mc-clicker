import {BROADCAST_STAGES,broadcastStage,broadcastAudienceLimit} from './broadcasting.js';
import {icon} from './icons.js';
import {researchForItem} from './research.js';

const symbols=['sound','camera','circuit','spark'];
export function broadcastStageMarkup(s) {
  const stage=broadcastStage(s),index=BROADCAST_STAGES.indexOf(stage);
  return `<section class="broadcast-stage" data-broadcast-stage="${stage.id}" aria-label="频道发展"><ol aria-label="频道阶段">${['广播','电视','流媒体','现代'].map((name,i)=>`<li ${i===index?'aria-current="step"':''} data-complete="${i<index}">${icon(symbols[i],17)}<span>${name}</span></li>`).join('')}</ol><div class="broadcast-heading"><h4>${stage.name}</h4><span>${stage.id==='modern'?'随世界发展扩大受众':`最多 ${broadcastAudienceLimit(s)} 位${stage.audience}`}</span></div><p>${stage.description}</p>${stage.research?`<button class="quiet-button" data-broadcast-research="${stage.research}">下一步 · ${stage.next} ${icon('arrow',15)}</button>`:''}</section>`;
}

// Keep this stage and the next step visible. Purchased equipment is never hidden.
export function broadcastShopItems(s,items) {
  const completed=s.research?.completed||{},next=broadcastStage(s).research;
  return items.filter(item=>s.counts[item.id]||researchForItem(s,item).every(id=>completed[id]||id===next));
}

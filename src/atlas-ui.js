import { achievementsMarkup } from './achievements-ui.js';
import { CATALOG, ITEMS, ancestors } from './catalog.js';
import { n, unlocked } from './game.js';
import { atlasCount, atlasProgress } from './atlas-progress.js';
import { developmentRoute } from './first-steps.js';
import { GUIDANCE_ITEMS, guidanceOwned } from './guidance.js';
import { icon } from './icons.js';

export const ATLAS_TABS = [['buildings', '建设'], ['features', '特性'], ['achievements', '成就']];
// Collections keep their authoritative completion rules. Tabs only partition presentation.
export function atlasMarkup(s, { tab = 'buildings', family = 'all', families = '', features = '', symbols, achievementGroup = 'all', achievementPending = false }) {
  const navigation = `<div class="management-tabs atlas-tabs" role="tablist" aria-label="图鉴内容">${ATLAS_TABS.map(([id, name]) => `<button id="atlas-tab-${id}" data-atlas-tab="${id}" role="tab" aria-selected="${tab === id}" aria-controls="atlas-content" tabindex="${tab === id ? 0 : -1}" class="${tab === id ? 'active' : ''}">${name}</button>`).join('')}</div>`;
  const summary = (value, total, label, note) => `<div class="atlas-summary"><strong>${value}<small>/ ${total}</small></strong><p>${label}<br><span>${note}</span></p></div>`;
  let content;
  if (tab === 'features') {
    content = summary(GUIDANCE_ITEMS.filter(i => guidanceOwned(s, i.id)).length, GUIDANCE_ITEMS.length, '已拥有特性', '给界面添点东西，按需开启。') + features;
  } else if (tab === 'achievements') {
    content = achievementsMarkup(s, {group:achievementGroup, pending:achievementPending});
  } else {
    content = developmentRoute(s) + summary(atlasCount(s), CATALOG.length, '已解锁建设', `主线 ${ancestors('Z3').size} 项 · 合集按收藏计算`) + families + `<div class="atlas-list">${CATALOG.filter(i => family === 'all' || i.family === family).map(i => {
      const progress = atlasProgress(s, i.id);
      const note = progress.group
        ? (progress.complete ? '合集已收集' : `合集 · ${progress.collected} / ${progress.total} 已收藏`) + (i.id === 'X8' ? ' · 观象台' : i.id === 'X6' ? ' · 直播间' : ' · 装扮摊')
        : i.deps.map(id => ITEMS[id].name).join(' ＋ ') || '第一块，就是起点';
      return `<button data-detail="${i.id}" class="atlas-node ${progress.complete ? 'done' : unlocked(s, i) ? 'available' : ''}"><span class="node-icon">${icon(progress.complete ? 'check' : i.id === 'V18' ? 'mail' : symbols[i.family], 17)}</span><span><strong>${i.name}</strong><small>${note}</small></span><b>${progress.complete ? (progress.group ? '✓' : n(s, i.id)) : '→'}</b></button>`;
    }).join('')}</div>`;
  }
  return navigation + `<section id="atlas-content" class="atlas-content" role="tabpanel" aria-labelledby="atlas-tab-${tab}">${content}</section>`;
}

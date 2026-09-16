import { facilityUpgrades, upgradeStatus, upgradeLevel, upgradeEnergyDescription, UPGRADE_BY_ID } from './upgrades.js';
import { icon } from './icons.js';
import { UPGRADE_COPY, UPGRADE_PURPOSE } from './upgrade-copy.js';
import { upgradeArt } from './upgrade-art.js';
import { upgradeComparison } from './upgrade-comparison.js';
import { facilityLevelLabel, nextFacilityUnlock } from './facility-growth.js';
import { foldAttributes, panelMemory } from './panel-memory.js';
import { formatHudNumber } from './hud-numbers.js';

const amount = n => formatHudNumber(Math.ceil(n));
const value = (n, row) => typeof n === 'string' ? n : `${row.prefix}${n.toLocaleString('zh-CN', {maximumFractionDigits: 2})}${row.unit}`;
const stateIcon = status => icon(status.kind === 'complete' ? 'check' : status.kind === 'locked' ? 'lock' : 'arrow', 14);
const choiceKey = (owner, id) => `mods:${owner}:choice:${id}`;
const shortReason = status => status.kind === 'locked' && status.missing.length > 1
  ? `需要${status.missing[0].name}，另有 ${status.missing.length - 1} 项条件`
  : status.reason;
export function upgradeButton(status) {
  return status.kind === 'complete' ? `${stateIcon(status)} 已完成` : status.kind === 'locked' ? `${stateIcon(status)} 条件` : `${amount(status.cost)} <span class="mini-emerald"></span>${stateIcon(status)}`;
}
export function nearUpgrades(s, owner) {
  return facilityUpgrades(owner).filter(row => upgradeStatus(s, row.id).kind !== 'complete')
    .sort((a,b) => Number(!!upgradeStatus(s,a.id).missing.length) - Number(!!upgradeStatus(s,b.id).missing.length) || upgradeStatus(s,a.id).cost-upgradeStatus(s,b.id).cost).slice(0,4);
}
export function createUpgradesUI(api) {
  const choice = owner => facilityUpgrades(owner).find(row => panelMemory.open(choiceKey(owner,row.id)))?.id;
  function rowMarkup(row, s, selected) {
    const status = upgradeStatus(s, row.id), comparison = upgradeComparison(s, row.id), expanded = row.id === selected;
    const rank = row.maxLevel > 1 ? `<span class="mod-rank" aria-label="改造 ${status.level} / ${row.maxLevel} 级">${status.level}/${row.maxLevel}</span>` : '';
    const energy = Object.values(row.energy).some(v => v !== 1 && v !== 0);
    return `<article class="facility-mod" data-mod-card="${row.id}" data-state="${status.kind}" data-expanded="${expanded}">
      <header><button class="mod-choose" data-mod-select="${row.id}" aria-label="查看${row.name}改造详情" aria-expanded="${expanded}" aria-controls="mod-detail-${row.id}"><span class="mod-art-slot">${upgradeArt(row)}</span><span class="mod-row-text"><strong>${row.name}${rank}</strong><span class="mod-purpose">${UPGRADE_PURPOSE[row.id]}</span></span><span class="mod-chevron" aria-hidden="true">${expanded ? '−' : '＋'}</span></button><button data-mod-buy="${row.id}" data-state="${status.kind}" ${status.kind === 'complete' ? 'disabled' : ''}>${upgradeButton(status)}</button></header>
      <p class="mod-reason" data-mod-reason ${['ready','complete'].includes(status.kind) ? 'hidden' : ''}>${shortReason(status)}</p>
      ${comparison.capped ? `<p class="mod-bottleneck">${icon('info',12)} ${row.owner==='M9' ? '出料受限' : '进料受限'}</p>` : ''}
      <div class="mod-detail" id="mod-detail-${row.id}" ${expanded ? '' : 'hidden'}><p>${UPGRADE_COPY[row.id]}</p><dl class="mod-comparison" aria-label="${comparison.complete ? '当前效果' : '本次改造变化'}">${comparison.rows.map(r => `<div><dt>${r.label}${r.prefix ? '（倍率）' : ''}</dt><dd>${comparison.complete ? `<b>${value(r.after, r)}</b>` : `<span>${value(r.before,r)}</span><span aria-hidden="true">→</span><b>${value(r.after,r)}</b>`}</dd></div>`).join('')}</dl>${energy ? `<small class="mod-energy">${comparison.complete ? '安装效果：' : ''}${upgradeEnergyDescription(row.id)}</small>` : ''}${comparison.note ? `<small class="mod-limit" ${comparison.capped ? 'data-limited' : ''}>${comparison.note}</small>` : ''}${status.missing.length ? `<div class="mod-needs">${status.missing.map(dep => `<button data-mod-need="${dep.type === 'research' ? 'V11' : dep.id}">${dep.name} →</button>`).join('')}</div>` : ''}</div>
      </article>`;
  }
  function render(owner) {
    const s = api.state(), all = facilityUpgrades(owner), selected = choice(owner);
    if (!s.counts[owner] || !all.length) return '';
    const available = [], locked = [], installed = [];
    for (const row of all) {
      const status = upgradeStatus(s, row.id);
      // Keep the selected part visible after purchase; panel memory restores
      // the scroll anchor and focus when the updated prices reorder the list.
      (row.id === selected ? available : status.kind === 'complete' ? installed : status.missing.length ? locked : available).push(row);
    }
    available.sort((a,b) => upgradeStatus(s,a.id).cost-upgradeStatus(s,b.id).cost);
    locked.sort((a,b) => upgradeStatus(s,a.id).cost-upgradeStatus(s,b.id).cost);
    const count = all.filter(row => upgradeLevel(s, row.id) > 0).length, next = nextFacilityUnlock(s, owner);
    return `<section class="facility-mods" data-mod-owner="${owner}"><header><h4>设施改造</h4><span>${count} / ${all.length} 已安装</span></header><div class="mod-growth"><strong>${facilityLevelLabel(s, owner)}</strong>${next ? `<p>${next}</p>` : ''}</div>${available.map(row => rowMarkup(row,s,selected)).join('')}${locked.length ? `<details class="mod-tree" data-mod-tree="${owner}" ${foldAttributes(`mods:${owner}:locked`)}><summary>待解锁 · ${locked.length} 项</summary>${locked.map(row => rowMarkup(row,s,selected)).join('')}</details>` : ''}${installed.length ? `<details class="mod-tree mod-installed" ${foldAttributes(`mods:${owner}:installed`)}><summary>已完成 · ${installed.length} 项</summary>${installed.map(row => rowMarkup(row,s,selected)).join('')}</details>` : ''}</section>`;
  }
  function select(root, id, toggle = false) {
    const row = UPGRADE_BY_ID[id], section = root.querySelector(`[data-mod-owner="${row.owner}"]`);
    if (!section) return;
    const selected = toggle && choice(row.owner) === id ? null : id;
    const anchor = section.querySelector(`[data-mod-select="${id}"]`), top = anchor?.getBoundingClientRect().top;
    for (const item of facilityUpgrades(row.owner)) {
      const open = item.id === selected, card = section.querySelector(`[data-mod-card="${item.id}"]`);
      panelMemory.set(choiceKey(row.owner,item.id), open);
      if (!card) continue;
      card.dataset.expanded = String(open);
      card.querySelector('[data-mod-select]').setAttribute('aria-expanded', String(open));
      card.querySelector('.mod-chevron').textContent = open ? '−' : '＋';
      card.querySelector('.mod-detail').hidden = !open;
    }
    // Closing the previous description above this row must not move the target
    // out from under a finger. Keep the same row at the same viewport position.
    if (anchor && Number.isFinite(top)) root.scrollTop += anchor.getBoundingClientRect().top - top;
  }
  function bind(root) {
    root.querySelectorAll('[data-mod-select]').forEach(button => button.onclick = () => select(root,button.dataset.modSelect,true));
    root.querySelectorAll('[data-mod-buy]').forEach(button => button.onclick = () => {
      const id = button.dataset.modBuy, status = upgradeStatus(api.state(), id);
      if (status.kind === 'ready') api.purchase(id);
      else if (status.kind === 'locked') { select(root,id); button.closest('[data-mod-card]').querySelector('.mod-needs')?.scrollIntoView({block:'nearest'}); }
      else api.toast(status.reason);
    });
    root.querySelectorAll('[data-mod-need]').forEach(button => button.onclick = () => {
      const id = button.dataset.modNeed, row = UPGRADE_BY_ID[id];
      if (!row) return api.openItem(id, true);
      for (const item of facilityUpgrades(row.owner)) panelMemory.set(choiceKey(row.owner,item.id),item.id===id);
      api.openItem(row.owner, true);
      const target = document.querySelector(`[data-mod-card="${id}"]`);
      target?.scrollIntoView({block:'center'});
      target?.querySelector('button')?.focus({preventScroll:true});
    });
  }
  function refresh(root) {
    root.querySelectorAll('[data-mod-card]').forEach(card => {
      const id = card.dataset.modCard, status = upgradeStatus(api.state(), id),
        button = card.querySelector('[data-mod-buy]'), reason = card.querySelector('[data-mod-reason]');
      card.dataset.state = button.dataset.state = status.kind;
      const html = upgradeButton(status);
      if (button.innerHTML !== html) button.innerHTML = html;
      button.disabled = status.kind === 'complete';
      button.setAttribute('aria-label', `${UPGRADE_BY_ID[id].name}，${status.kind==='ready' ? amount(status.cost)+' 绿宝石' : status.reason}`);
      const text = shortReason(status);
      if (reason.textContent !== text) reason.textContent = text;
      reason.hidden = ['ready','complete'].includes(status.kind);
    });
  }
  return {render, bind, refresh};
}

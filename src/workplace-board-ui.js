import {farmLocationLabel} from './farm-sites.js';
import { ITEMS } from './catalog.js';
import { JOBS, PROFESSIONS, jobAvailable, assignJob, portrait, skillLevel, escapeHtml as esc } from './residents.js';
import { workplaceAssignment } from './resident-jobs-ui.js';

// The picker is local to a workplace, not a new panel/navigation state.
export function createWorkplaceBoard({ state, changed, toast }) {
  let openJob = null;
  const bound = new WeakSet();
  const text = (el, value) => { if (el.textContent !== value) el.textContent = value; };
  function render() {
    const s = state();
    return Object.entries(JOBS).filter(([id]) => id !== 'idle' && jobAvailable(s, id)).map(([id, job]) =>
      `<article class="workplace-card" data-workplace-card="${id}"><header><strong>${ITEMS[job.target]?.name || job.name} · ${job.name}</strong><span data-workplace-count></span></header><p>${job.desc}</p><div class="workplace-staff" data-workplace-staff aria-label="在岗村民"></div><div class="workplace-entry"><button type="button" data-workplace="${id}" aria-controls="workplace-picker-${id}" aria-expanded="false">安排村民</button><p class="empty-note" data-workplace-empty hidden></p></div><section class="workplace-picker" id="workplace-picker-${id}" data-workplace-picker hidden aria-label="选择${job.name}"><header><strong>${job.name}人选 <span data-candidate-count></span></strong><button type="button" data-workplace="${id}" aria-label="收起${job.name}人选">×</button></header><div class="workplace-candidates" data-workplace-candidates></div><p class="empty-note" data-candidates-empty hidden></p></section></article>`,
    ).join('');
  }
  function syncPeople(container, people, jobId, candidates = false) {
    const attr = candidates ? 'data-job-assign' : 'data-person';
    const existing = new Map([...container.children].map(el => [el.getAttribute(attr), el]));
    const ids = new Set(people.map(r => r.id));
    for (const [id, el] of existing) if (!ids.has(id)) {
      if (el === document.activeElement) container.closest('.workplace-card').querySelector('.workplace-picker header button')?.focus({ preventScroll: true });
      el.remove();
    }
    people.forEach((r, index) => {
      let button = existing.get(r.id);
      if (!button) {
        button = document.createElement('button');
        button.type = 'button';
        button.className = candidates ? 'workplace-candidate' : 'workplace-worker';
        button.setAttribute(attr, r.id);
        if (candidates) button.dataset.job = jobId;
      }
      const level = skillLevel(r, JOBS[jobId].skill);
      const action = r.job === 'idle' ? '安排' : '改派';
      const note = r.job === 'idle' ? '空闲' : `${JOBS[r.job].name} → ${JOBS[jobId].name}`;
      const markup = candidates
        ? `<span class="resident-portrait">${portrait(r)}</span><span class="workplace-candidate-copy"><strong>${esc(r.name)} <small>${PROFESSIONS[JOBS[jobId].skill]} Lv.${level}</small></strong><span>${note}</span></span><span class="workplace-candidate-action">${action} →</span>`
        : `<span class="resident-portrait">${portrait(r)}</span><span>${esc(r.name)} <small>${farmLocationLabel(state(),r)||`Lv.${level}`}</small></span>`;
      if (button._workplaceMarkup !== markup) {
        button.innerHTML = markup;
        button._workplaceMarkup = markup;
        button.setAttribute('aria-label', candidates
          ? `${action}${r.name}担任${JOBS[jobId].name}，${PROFESSIONS[JOBS[jobId].skill]}${level}级${r.job === 'idle' ? '' : `，离开原${JOBS[r.job].name}岗位`}`
          : `查看${r.name}，${JOBS[jobId].name}`);
      }
      if (container.children[index] !== button) container.insertBefore(button, container.children[index] || null);
    });
    container.hidden = people.length === 0;
  }
  function refresh(root) {
    const s = state();
    for (const card of root.querySelectorAll('[data-workplace-card]')) {
      const id = card.dataset.workplaceCard;
      const model = workplaceAssignment(s, id);
      if (model.full && openJob === id) openJob = null;
      text(card.querySelector('[data-workplace-count]'), `${model.staff.length} / ${model.slots}${model.full ? ' · 满员' : ''}`);
      syncPeople(card.querySelector('[data-workplace-staff]'), model.staff, id);
      const button = card.querySelector('.workplace-entry [data-workplace]');
      const expanded = openJob === id;
      button.hidden = model.full || (!expanded && !model.candidates.length);
      button.setAttribute('aria-expanded', String(expanded));
      text(button, expanded ? '收起人选' : '安排村民');
      const empty = card.querySelector('[data-workplace-empty]');
      empty.hidden = model.full || expanded || !!model.candidates.length;
      text(empty, model.emptyReason);
      const picker = card.querySelector('[data-workplace-picker]');
      picker.hidden = !expanded;
      if (expanded) {
        text(picker.querySelector('[data-candidate-count]'), `${model.candidates.length} 位`);
        syncPeople(picker.querySelector('[data-workplace-candidates]'), model.candidates, id, true);
        const note = picker.querySelector('[data-candidates-empty]');
        note.hidden = !!model.candidates.length;
        text(note, model.emptyReason);
      }
    }
  }
  function toggle(root, id) {
    const model = workplaceAssignment(state(), id);
    openJob = openJob === id || model.full || !model.candidates.length ? null : id;
    refresh(root);
    if (!openJob) return;
    const first = root.querySelector(`[data-workplace-card="${id}"] [data-job-assign]`);
    if (first) {
      const bottom = root.getBoundingClientRect().bottom;
      // Scroll only enough to reveal the first choice; never jump to page top.
      root.scrollTop += Math.max(0, first.getBoundingClientRect().bottom - bottom + 12);
    }
  }
  function bind(root) {
    refresh(root);
    if (bound.has(root)) return;
    bound.add(root);
    root.addEventListener('click', event => {
      const entry = event.target.closest('[data-workplace]');
      if (entry) { toggle(root, entry.dataset.workplace); return; }
      const button = event.target.closest('[data-job-assign]');
      if (!button) return;
      const id = button.dataset.job;
      const before = button.closest('[data-workplace-card]').getBoundingClientRect().top;
      // Eligibility can change while the list is open. The production API gets
      // the final say; a stale click never takes a full slot or abandons cargo.
      const result = assignJob(state(), button.dataset.jobAssign, id);
      if (!result.ok) { toast(result.reason); refresh(root); return; }
      openJob = null;
      changed();
      const card = root.querySelector(`[data-workplace-card="${id}"]`);
      if (card) {
        root.scrollTop += card.getBoundingClientRect().top - before;
        card.querySelector(`[data-person="${button.dataset.jobAssign}"]`)?.focus({ preventScroll: true });
      }
      if (result.text) toast(result.text);
    });
    root.addEventListener('keydown', event => {
      if (event.key !== 'Escape' || !openJob || !root.querySelector('[data-workplace-card]')) return;
      event.preventDefault();
      event.stopPropagation();
      const id = openJob;
      openJob = null;
      refresh(root);
      const card = root.querySelector(`[data-workplace-card="${id}"]`);
      const target = card?.querySelector('.workplace-entry button:not([hidden])') || card?.querySelector('[data-person]');
      target?.focus({ preventScroll: true });
    });
  }
  function open(root, id) {
    openJob = null;
    toggle(root, id);
    const card = root.querySelector(`[data-workplace-card="${id}"]`);
    card?.scrollIntoView({ block: 'nearest' });
    (card?.querySelector('[data-job-assign]') || card?.querySelector('[data-person]'))?.focus({ preventScroll: true });
  }
  return { render, bind, refresh, open, close() { openJob = null; } };
}

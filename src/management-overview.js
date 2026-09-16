import { JOBS, jobAvailable, jobSlots, escapeHtml as esc } from './residents.js';
import { isResting } from './villager-life.js';
import { ITEMS } from './catalog.js';
import { formatHudNumber as fmt } from './hud-numbers.js';
import { icon } from './icons.js';

// One batch can be partly delivered and partly on a helper's back. These are
// disjoint quantities, not three copies of localStock (which includes all three).
export function cargoSnapshot(s, source = null) {
  const actors = [...(s.community?.residents || []), ...(s.community?.golems || [])];
  const cargo = new Map(actors.filter(a => a.cargo).map(a => [a.id, a.cargo]));
  const result = { waiting: 0, moving: 0, trading: 0 };
  for (const b of s.community?.batches || []) {
    if (source && b.source !== source) continue;
    const qty = Math.max(0, b.qty || 0), delivered = Math.min(qty, Math.max(0, b.delivered || 0));
    const held = cargo.get(b.claimed);
    const moving = held?.id === b.id ? Math.min(qty - delivered, Math.max(0, held.qty || 0)) : 0;
    result.waiting += qty - delivered - moving;
    result.moving += moving;
    result.trading += delivered;
  }
  return result;
}

export function villageOverview(s) {
  const people = (s.community?.residents || []).filter(r => !r.reserve);
  const jobs = ['farmer','rancher','hauler','merchant','miner','crafter','musician','host','engineer','stagehand','researcher'].filter(id=>jobAvailable(s,id)).map(id=>[id,JOBS[id]]);
  const vacancies = jobs.map(([id, job]) => ({ id, job, count: Math.max(0,
    jobSlots(s, id) - people.filter(r => r.job === id).length) })).filter(r => r.count > 0);
  const receipts = (s.marketLedger?.receipts || []).filter(r => r.source.startsWith('community:'));
  const last = receipts.reduce((latest, r) => !latest || r.at > latest.at || r.at === latest.at && r.id > latest.id ? r : latest, null);
  return { ...cargoSnapshot(s), people: people.length,
    working: people.filter(r => r.job !== 'idle' && !isResting(s, r)).length,
    resting: people.filter(r => isResting(s, r)).length,
    idle: people.filter(r => r.job === 'idle' && !isResting(s,r)).length, vacancies, last };
}

export function villageOverviewMarkup() {
  return `<section class="village-overview" aria-label="村庄经营概况"><header class="operations-heading"><h3>村庄经营</h3><button class="quiet-button" data-overview-jobs>${icon('person',16)} 安排工作</button></header>
    <div class="village-people-summary"><span>工作 <b data-village-value="working">0</b></span><span>休息 <b data-village-value="resting">0</b></span><span>自由活动 <b data-village-value="idle">0</b></span></div>
    <div class="village-cargo-flow">${[['waiting','box','等待取货'],['moving','circuit','正在运送'],['trading','bag','等待出售']].map(([key,symbol,label])=>`<button data-overview-cargo="${key}"><span>${icon(symbol,17)} ${label}</span><strong data-village-value="${key}">0</strong><small>份 ${icon('arrow',12)}</small></button>`).join('')}</div>
    <div class="village-sale"><span>最近一笔货物成交<small>普通出售 · 同类货物按 10 秒合并</small></span><strong data-village-sale>尚无成交</strong></div>
    <div class="village-attention"><span data-village-cause></span><button class="quiet-button" data-overview-action>查看</button></div>
    <div class="village-vacancies" data-village-vacancies aria-label="空缺岗位"></div>
    <div class="overview-links"><button data-village-tab="production">${icon('wheat',16)} 农牧收获 ${icon('arrow',14)}</button><button data-village-tab="residents">${icon('person',16)} 居民与培训 ${icon('arrow',14)}</button></div></section>`;
}

export function refreshVillageOverview(root, s) {
  const section = root.querySelector('.village-overview'); if (!section) return;
  const data = villageOverview(s);
  const text = (el, value) => { if (el.textContent !== value) el.textContent = value; };
  for (const el of section.querySelectorAll('[data-village-value]')) text(el, fmt(data[el.dataset.villageValue]));
  const sale = section.querySelector('[data-village-sale]');
  text(sale, data.last ? `+${fmt(data.last.money)} ◆` : '尚无成交');
  sale.title = data.last ? `${data.last.label} · 售出 ${fmt(data.last.quantity)} 份` : '货物实际售出后记录；不包含居民基础收入或演出收入';
  let cause = '工作、搬运和成交分别进行，货物卖出后才会入账。', action = 'market', label = '查看成交';
  if (data.trading > 0) { cause = '货已送到，正在等结款。想卖得更快，可以看看集市。'; }
  else if (data.waiting > 0) { cause = '有货还没运走，可以调整搬运人手或巡收范围。'; action = 'logistics'; label = '查看搬运'; }
  else if (data.idle && data.vacancies.length) { cause = `${data.idle} 位村民还没安排工作，有岗位可以加入。`; action = 'jobs'; label = '安排工作'; }
  else if (!data.people) { cause = '先邀请一位村民，再安排他到工作地点。'; action = 'residents'; label = '添加村民'; }
  else if (data.moving > 0) { cause = '货物正在路上。送达后，还要经过出售才会入账。'; }
  text(section.querySelector('[data-village-cause]'), cause);
  const button = section.querySelector('[data-overview-action]'); button.dataset.overviewAction = action; text(button,label);
  const list = section.querySelector('[data-village-vacancies]');
  const markup = data.vacancies.slice(0,3).map(({id,job,count})=>`<button type="button" data-overview-job="${id}"><span>${esc(job.name)}<small>${esc(ITEMS[job.target]?.name || '交货点')}</small></span><span>缺 ${count} 人 ${icon('arrow',12)}</span></button>`).join('');
  if (list._markup !== markup) { list.innerHTML = markup; list._markup = markup; }
  list.hidden = !data.vacancies.length;
  const jobsButton=section.querySelector('[data-overview-jobs]');
  text(jobsButton,'岗位看板 →');
}

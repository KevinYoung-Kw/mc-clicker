import { rates } from './game.js';
import { REALMS, ITEMS } from './catalog.js';
import { transportAccess } from './transport.js';
import { powerSnapshot } from './power.js';
import { formatHudNumber } from './hud-numbers.js';
import { icon } from './icons.js';
import { upgradeCapability } from './upgrades.js';

const facilities = {
  overworld: { source: ['M9', 'M1'], process: ['M2', 'T7'], delivery: ['M16', 'M8', 'M4'], trade: ['V3'] },
  nether: { source: ['N3', 'N7'], process: ['N4', 'N3'], delivery: ['N12'], trade: ['N2'] },
  end: { source: ['E11', 'E4'], process: ['E8', 'E11'], delivery: ['E7', 'E5'], trade: ['E5'] },
};
export function productionSummary(s, power = powerSnapshot(s), selectedRealm = s.realm) {
  const realm = REALMS[selectedRealm] ? selectedRealm : 'overworld', b = s.buffers[realm];
  const r = rates(s, power).regions[realm], access = transportAccess(s, realm);
  const ids = facilities[realm], all = Object.values(ids).flat();
  const choose = key => ids[key].find(id => s.counts[id]) || ids[key][0];
  let reason = '产线运行中', target = choose('source'), tone = 'working', issue = null, stage = null;
  const stageOf = id => ({source:'raw',delivery:'haul',process:'process',trade:'trade'})[Object.keys(ids).find(key=>ids[key].includes(id))] || 'raw';
  const blocked = power.loads.find(l => all.includes(l.id) && l.rated > 0 && l.state !== 'working' && l.state !== 'idle');
  const short = power.loads.find(l => all.includes(l.id) && l.enabled && l.rated > 0 && l.fraction < .95);
  if (blocked) {
    reason = ({ off: '设备已暂停', 'out-of-range': '线路未接通', 'not-connected': '未接入电网', 'no-power': '等待供电' })[blocked.state] || '设备未运行';
    target = blocked.id; tone = 'blocked'; issue = blocked.state; stage = stageOf(blocked.id);
  } else if (!access.raw || !access.processed || !access.delivery) {
    reason = !access.raw ? '采集线路未接通' : !access.processed ? '加工线路未接通' : '交货线路未接通';
    target = choose(!access.raw ? 'source' : !access.processed ? 'process' : 'delivery'); tone = 'blocked'; issue = 'route'; stage = !access.raw ? 'raw' : !access.processed ? 'process' : 'trade';
  } else if (short) {
    reason = '供电不足'; target = short.id; tone = 'blocked'; issue = 'no-power'; stage = stageOf(short.id);
  } else if (b.goods >= r.capacity * .9) {
    reason = '成品积压 · 交易较慢'; target = choose('trade'); tone = 'blocked'; issue = 'goods-full'; stage = 'trade';
  } else if (b.raw >= r.rawCapacity * .9) {
    const transport = r.haul < r.process;
    reason = transport ? '原料积压 · 运输较慢' : '原料积压 · 加工较慢';
    target = choose(transport ? 'delivery' : 'process'); tone = 'blocked'; issue = 'raw-full'; stage = transport ? 'haul' : 'process';
  } else if (b.raw < .01 && r.raw <= 0) {
    reason = '等待原料'; target = choose('source'); tone = 'idle'; issue = 'no-input'; stage = 'raw';
  }
  const flow = s.transport?.realms?.[realm];
  const perSecond = key => flow?.dt > 0 && s.play - flow.at < 2 ? (flow[key] || 0) / flow.dt : 0;
  return { realm, reason, target, tone, issue, stage, raw: b.raw, goods: b.goods,
    processed: perSecond('processed'), sold: perSecond('sold'), orders: perSecond('orders'), project: perSecond('project') };
}
export function productionSummaryMarkup(s) {
  const orders = ['V17','L9','L13'].some(id=>s.counts[id]) ||
    upgradeCapability(s, 'V3', 'cropOrders') || upgradeCapability(s, 'N2', 'piglinOrders');
  return `<section class="production-summary" aria-label="当前世界产线"><header><strong data-production-realm></strong><span>实际产线</span></header><dl>${[
    ['raw','原料库存','份'], ['goods','成品待售','份'], ['processed','加工入库','份/秒'], ['sold','普通出售','份/秒'],
    ['orders','订单交付','份/秒'], ['project','工程交付','份/秒'],
  ].filter(([key])=>key==='orders'?orders:key==='project'?s.counts.Z2:true).map(([key,label,unit])=>`<div><dt>${label}</dt><dd><b data-production-value="${key}">0</b><small>${unit}</small></dd></div>`).join('')}</dl><div class="production-cause"><span data-production-cause></span><button class="icon-button" data-production-target aria-label="查看相关设施">${icon('locate')}</button></div></section>`;
}
export function refreshProductionSummary(root, s, power) {
  const section = root.querySelector('.production-summary'); if (!section) return;
  const data = productionSummary(s, power);
  const set = (el,value) => { if (el.textContent !== value) el.textContent = value; };
  set(section.querySelector('[data-production-realm]'), REALMS[data.realm].name);
  for (const el of section.querySelectorAll('[data-production-value]')) set(el,formatHudNumber(data[el.dataset.productionValue], true));
  set(section.querySelector('[data-production-cause]'),data.tone==='blocked'?`${ITEMS[data.target].name} · ${data.reason}`:data.reason);
  section.querySelector('[data-production-target]').dataset.target = data.target;
  section.dataset.tone = data.tone;
}

import { UPGRADE_BY_ID, upgradeLevel, upgradeMultiplier, storageCapacity, upgradeStorage, upgradeCapability } from './upgrades.js';
import { scaledCount, drillCapacity, furnaceCapacity, generationCapacity } from './facility-capacity.js';
import { heatCapacity, freightSpec } from './dimensional.js';
import { harvestPeriod } from './operations.js';

const labels = {
  raw: '开采能力', process: '加工能力', outlet: '出货能力', inlet: '进料能力',
  cargo: '载货能力', interval: '发车间隔', loading: '装卸能力', harvest: '每次收获量',
  jobWork: '岗位工作速度', trade: '售货能力', heatDelivery: '热能补充速度',
  heatRecovery: '加工时余热发电', batch: '每批压制量', transfer: '跨维度转运能力',
  goodsValue: '合金成品价值', brewPeriod: '酿造周期', boostDuration: '强化持续时间',
  brewSynergy: '龙息期间额外产出', localValue: '本设施产物价值',
};
export function upgradeComparison(s, id) {
  const row = UPGRADE_BY_ID[id];
  if (!row) return { rows: [], note: '' };
  const complete = upgradeLevel(s, id) >= row.maxLevel;
  // These readers never mutate state. A separate level map prevents a displayed
  // comparison from purchasing, advancing production, or touching the save.
  const after = { ...s, upgrades: { ...s.upgrades, revision: (s.upgrades?.revision || 0) + 1,
    levels: { ...s.upgrades?.levels, [id]: upgradeLevel(s, id) + (complete ? 0 : 1) } } };
  const rows = [];
  const add = (label, read, unit = '', prefix = '') => rows.push({ label, before: read(s), after: read(after), unit, prefix });
  let capped = false;
  for (const [key, value] of Object.entries(row.effects)) {
    const owner = row.owner;
    if (typeof value === 'boolean') {
      add(key === 'cropOrders' ? '农牧订单' : '猪灵订单', t => upgradeCapability(t, owner, key) ? '可接取' : '未开放');
    } else if (owner === 'M9' && ['raw', 'outlet'].includes(key)) {
      if (key === 'outlet') add('出料上限', t => scaledCount(t, owner) * 14 * 2 * upgradeMultiplier(t, owner, key), ' 份/秒');
      add('基础开采能力', drillCapacity, ' 份/秒');
      capped = upgradeMultiplier(after, owner, 'raw') > 2 * upgradeMultiplier(after, owner, 'outlet');
    } else if (owner === 'M2' && ['process', 'inlet'].includes(key)) {
      if (key === 'inlet') add('进料上限', t => scaledCount(t, owner) * 5 * 2 * upgradeMultiplier(t, owner, key), ' 份/秒');
      add('基础加工能力', furnaceCapacity, ' 份/秒');
      capped = upgradeMultiplier(after, owner, 'process') > 2 * upgradeMultiplier(after, owner, 'inlet');
    } else if (key === 'generation') add('基础发电量', t => generationCapacity(t, owner), ' E/秒');
    else if (key === 'storage') add('改造新增储电量', upgradeStorage, ' E');
    else if (key === 'buffer') {
      if (owner === 'M9') add('主世界原料容量', t => storageCapacity(t, 'overworld', 'raw'), ' 份');
      else if (owner === 'V4') add('田边待运容量', t => storageCapacity(t) * upgradeMultiplier(t, owner, key), ' 份');
      else add('各维度成品容量', t => storageCapacity(t), ' 份');
    } else if (key === 'heat') add('热能容量', heatCapacity);
    else if (owner === 'V4' && key === 'growthPeriod') add('当前作物生长周期', t => harvestPeriod(t, 'farm'), ' 秒');
    else if (['N6','E3','E9'].includes(owner) && ['cargo','interval'].includes(key))
      add(key === 'cargo' ? '每趟载货上限' : '运输周期', t => freightSpec(t, owner)[key === 'cargo' ? 'capacity' : 'period'], key === 'cargo' ? ' 份' : ' 秒');
    else if (key === 'chain') add('连续采收', t => upgradeCapability(t, owner, key, 1), ' 批');
    else add(labels[key] || key, t => upgradeMultiplier(t, owner, key), '', '×');
  }
  const noCurrentGain = ['drill-outlet', 'furnace-feed'].includes(id) && rows.at(-1).before === rows.at(-1).after;
  const note = capped ? `受${row.owner === 'M9' ? '出料' : '进料'}限制，部分提升暂时无法发挥。` :
    noCurrentGain && !complete ? `当前${row.owner === 'M9' ? '钻头' : '炉芯'}尚未用满${row.owner === 'M9' ? '出料' : '进料'}能力，升级后可发挥更大作用。` : '';
  return { rows, complete, capped, note };
}

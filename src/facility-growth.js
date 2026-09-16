import { ITEMS, CATALOG } from './catalog.js';
import { facilityUpgrades, upgradeLevel } from './upgrades.js';
const groups = new Set(['N3', 'N5', 'E3', 'E5']);
export const isCreatureOwner = owner => groups.has(owner) || ['N6', 'E9'].includes(owner);
export function facilityLevelLabel(s, owner) {
  const count = s.counts[owner] || 0;
  if (!count) return '';
  if (groups.has(owner)) return `${count} 只`;
  if (isCreatureOwner(owner)) return '已加入';
  return ITEMS[owner]?.max === 1 ? '已建成' : `本体 Lv.${count}`;
}
export function nextFacilityUnlock(s, owner) {
  const count = s.counts[owner] || 0;
  const pending = facilityUpgrades(owner).filter(row => upgradeLevel(s, row.id) < row.maxLevel)
    .map(row => ({ row, level: row.ownerLevels?.[upgradeLevel(s, row.id)] || 1 })).filter(x => x.level > count);
  for(const item of CATALOG)if(item.gate?.id===owner && !s.counts[item.id] && item.gate.level>count)
    pending.unshift({row:item,level:item.gate.level});
  if(owner==='M4'&&count<3)pending.push({row:{name:'第 3 个搬运岗位'},level:3});
  if (!pending.length) return '';
  const next = Math.min(...pending.map(x => x.level)), rows = pending.filter(x => x.level === next);
  return `本体 Lv.${next} 开放：${rows.slice(0, 2).map(x => x.row.name + (upgradeLevel(s, x.row.id) ? ` ${upgradeLevel(s, x.row.id) + 1} 级` : '')).join('、')}${rows.length > 2 ? `等 ${rows.length} 项` : ''}`;
}

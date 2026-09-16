import { housingCapacity } from './housing-data.js';

export const RESEARCH_VERSION = 1;
export const RESEARCHER_MULTIPLIER = 1.25;
// Durations are foreground work seconds. Paid projects retain their quoted duration.
export const RESEARCH_CATALOG = Object.freeze([
  {id:'basic-power',name:'基础动力',cost:480,duration:0,requires:[],items:[['V11',1,'图书馆']],description:'学会手摇发电，再用红石火把和风车为设备持续供电。'},
  {
    "id": "industrial",
    "name": "工业技术",
    "cost": 12000,
    "duration": 0,
    "requires": ["basic-power"],
    "items": [
      [
        "V11",
        1,
        "图书馆"
      ],
      [
        "V4",
        3,
        "麦田"
      ],
      [
        "V3",
        2,
        "集市"
      ]
    ],
    "residents": 6,
    "beds": 6,
    "villageSale": true,
    "description": "引入钻机、漏斗和傀儡，再按需要发展运输与自动控制。"
  },
  {
    "id": "modern",
    "name": "现代技术",
    "cost": 120000,
    "duration": 0,
    "requires": [
      "industrial",
      "automation"
    ],
    "items": [
      [
        "M9",
        2,
        "红石钻机"
      ],
      [
        "M2",
        3,
        "熔炉"
      ],
      [
        "M8",
        1,
        "漏斗"
      ]
    ],
    "description": "建设发电机组和活动馆，完善演播室经营，准备前往下界。",
    "industrialSale": true
  },
  {
    "id": "cargo-tools",
    "name": "搬运工具",
    "cost": 600,
    "duration": 20,
    "requires": [],
    "items": [
      [
        "V11",
        1,
        "图书馆"
      ],
      [
        "M4",
        1,
        "储物箱"
      ]
    ],
    "optional": true,
    "description": "为村民准备手推车搬运装备。"
  },
  {
    "id": "community-life",
    "name": "公共生活",
    "cost": 800,
    "duration": 20,
    "requires": [],
    "items": [
      [
        "V11",
        1,
        "图书馆"
      ],
      [
        "V6",
        1,
        "水井"
      ]
    ],
    "optional": true,
    "description": "在村庄开办共享的休闲场所。",
    "residents": 6,
    "beds": 6
  },
  {
    "id": "railway",
    "name": "动力运输",
    "cost": 14000,
    "duration": 0,
    "requires": [
      "industrial"
    ],
    "items": [
      [
        "M9",
        1,
        "红石钻机"
      ],
      [
        "M4",
        1,
        "储物箱"
      ]
    ],
    "optional": true,
    "description": "开放铁路与装卸设施。"
  },
  {
    "id": "automation",
    "name": "自动控制",
    "cost": 40000,
    "duration": 0,
    "requires": [
      "industrial"
    ],
    "items": [
      [
        "M9",
        2,
        "红石钻机"
      ],
      [
        "M2",
        2,
        "熔炉"
      ]
    ],
    "optional": true,
    "description": "开放节拍与执行器。"
  },
  {
    "id": "broadcasting",
    "name": "广播技术",
    "cost": 8000,
    "duration": 0,
    "requires": [
      "industrial"
    ],
    "items": [
      [
        "L1",
        1,
        "唱片机"
      ]
    ],
    "optional": true,
    "description": "开办广播电台，让主持人讲故事、经营听众；之后可扩展为电视和直播。"
  }
,
  {id:'television',name:'电视技术',cost:16000,duration:0,requires:['broadcasting'],items:[['L2',1,'广播电台'],['M9',2,'红石钻机'],['M2',2,'熔炉']],industrialSale:true,optional:true,description:'为电台添置机位，把声音节目变成电视节目。'},
  {id:'streaming',name:'流媒体技术',cost:32000,duration:0,requires:['television','automation'],items:[['L3',1,'机位组']],optional:true,description:'开放弹幕和礼物互动，提高频道可以容纳的观众人数。'}
].map(Object.freeze));
export const RESEARCH_BY_ID = Object.freeze(Object.fromEntries(RESEARCH_CATALOG.map(row => [row.id, row])));
export const RESEARCH_ITEM_GATES=Object.freeze({"M5":["basic-power"],"M6":["basic-power"],"M7":["basic-power"],"M16":["railway"],"M17":["railway"],"M10":["automation"],"M12":["automation"],"M13":["automation"],"M14":["automation"],"M20":["automation"],"L2":["broadcasting"],"L4":["broadcasting"],"L3":["television"],"L5":["streaming"],"L6":["streaming"],"L7":["streaming"],"L13":["streaming"],"L8":["streaming","modern"],"L9":["streaming","modern"],"L10":["streaming","modern"],"L11":["streaming","modern"],"L12":["streaming","modern"],"L14":["streaming","modern"],"T4":["industrial"],"T5":["modern"],"T8":["modern"],"T9":["modern"],"T10":["modern"],"T11":["modern"],"M3":["industrial"],"M8":["industrial"],"V15":["industrial"],"V16":["industrial"]});
export const RESEARCH_UNLOCKS=Object.freeze({"basic-power":["M5","M6","M7"],industrial:['M9','M3','M8','V15','V16','T4'],modern:['M15','N1','V23','T5','L8','L9','L10','L12'],railway:['M16','M17'],automation:['M10','M12','M13','M14','M20'],broadcasting:['L2','L4'],television:['L3'],streaming:['L5','L6','L7','L13'], 'cargo-tools':['V24'],'community-life':['V22','V25']});
const INDUSTRIAL_ITEMS = new Set(['M9', 'M10', 'M11', 'M12', 'M13', 'M14', 'M16']);
const MODERN_ITEMS = new Set(['M15', 'N1', 'L2', 'V23']);
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const nonnegative = value => Number.isFinite(value) && value >= 0;
const count = (s, id) => Math.max(0, Math.floor(s.counts?.[id] || 0));

export function freshResearch() {
  return { version: RESEARCH_VERSION, completed: {}, projects: {}, active: null, milestones: { villageSale: false, industrialSale:false } };
}
function state(s) { return s.research ||= freshResearch(); }
function hasVillageSale(s) {
  return state(s).milestones?.villageSale === true || (s.marketLedger?.receipts || []).some(row =>
    row?.realm === 'overworld' && row.source?.startsWith('community:') && row.quantity > 0 && row.money > 0);
}
function observe(s) {
  const r = state(s);
  r.milestones ||= { villageSale: false };
  if (count(s,'M9') && (s.marketLedger?.receipts||[]).some(row=>row.source==='production:overworld'&&row.money>0&&row.quantity>0)) r.milestones.industrialSale=true;
  if (hasVillageSale(s)) r.milestones.villageSale = true;
}
export function researchPrerequisiteItems(s, id) {
  const row = RESEARCH_BY_ID[id];
  if (!row) return [];
  return row.items.filter(([itemId, level]) => count(s, itemId) < level).map(([itemId, level]) => ({ id: itemId, level }));
}
export function researchPrerequisites(s, id) {
  const row = RESEARCH_BY_ID[id];
  if (!row) return ['没有这项研究'];
  const r = state(s), missing = [];
  for (const required of row.requires) if (!r.completed[required]) missing.push(`完成${RESEARCH_BY_ID[required].name}`);
  for (const [itemId, level, name] of row.items) if (count(s, itemId) < level) missing.push(`${name}${level > 1 ? `达到 Lv.${level}` : '已建成'}`);
  if (row.residents && (s.community?.residents || []).filter(person => !person.reserve).length < row.residents) missing.push(`${row.residents} 位驻村村民`);
  if (row.beds && housingCapacity(s) < row.beds) missing.push(`已摆放住宅提供 ${row.beds} 个住址`);
  if (row.villageSale && !hasVillageSale(s)) missing.push('完成一次村庄工作货物成交');
  if (row.industrialSale && !r.milestones?.industrialSale) missing.push("完成一次工业成品成交");
  return missing;
}
export function researchSpeed(s) {
  const researcher = (s.community?.residents || []).find(person => {
    const phase = s.life?.residents?.[person.id]?.phase;
    return person.job === 'researcher' && !person.reserve && person.activity === 'working' && !person.path?.length && !person.handover && (phase === undefined || phase === 'work');
  });
  return { multiplier: researcher ? RESEARCHER_MULTIPLIER : 1, researcherId: researcher?.id || null };
}
export function researchStatus(s, id) {
  const row = RESEARCH_BY_ID[id];
  if (!row) return { id, kind: 'unknown', requirements: ['没有这项研究'] };
  const r = state(s), project = r.projects[id], completed = r.completed[id] === true || (s.live?.legacyBroadcast && ['television','streaming'].includes(id));
  const requirements = completed || project ? [] : researchPrerequisites(s, id);
  const duration = project?.duration ?? row.duration, progress = completed ? duration : project?.progress || 0;
  const kind = completed ? 'complete' : r.active === id ? 'active' : project ? 'paused' : requirements.length ? 'locked' : 'ready';
  const speed = researchSpeed(s);
  return { ...row, kind, requirements, cost: project || completed ? 0 : row.cost, paidCost: project?.paidCost || 0,
    duration, progress, remaining: Math.max(0, duration - progress), eta: Math.max(0, duration - progress) / speed.multiplier,
    affordable: !!project || completed || (Number.isFinite(s.money) && s.money >= row.cost), ...speed };
}
export function startResearch(s, id) {
  const status = researchStatus(s, id);
  if (status.kind === 'unknown') return { ok: false, reason: status.requirements[0] };
  if (status.kind === 'complete') return { ok: false, reason: '这项研究已经完成' };
  if (status.requirements.length) return { ok: false, reason: status.requirements.join('；') };
  if (!status.affordable) return { ok: false, reason: '绿宝石还不够' };
  const r = state(s), newlyPaid = !r.projects[id];
  if (newlyPaid) {
    s.money -= status.cost;
    r.projects[id] = { paidCost: status.cost, progress: 0, duration: status.duration };
  }
  observe(s);
  // An instant permit has no timed work to replace an optional active project.
  if (r.projects[id].duration === 0) finish(s, id);
  else r.active = id;
  return { ok: true, id, cost: newlyPaid ? status.cost : 0, resumed: !newlyPaid };
}
export function pauseResearch(s) {
  const r = state(s), id = r.active;
  r.active = null;
  return { ok: true, id };
}
function finish(s, id) {
  const r = state(s), project = r.projects[id];
  project.progress = project.duration;
  r.completed[id] = true;
  if (r.active === id) r.active = null;
}
export function advanceResearch(s, dt) {
  if (!Number.isFinite(dt) || dt <= 0) return { completed: null, advanced: 0 };
  observe(s);
  const r = state(s), id = r.active, project = r.projects[id];
  if (!project || r.completed[id]) return { completed: null, advanced: 0 };
  const advanced = Math.min(Math.max(0, project.duration - project.progress), dt * researchSpeed(s).multiplier);
  project.progress += advanced;
  if (project.progress >= project.duration - 1e-8) {
    finish(s, id);
    return { completed: id, advanced };
  }
  return { completed: null, advanced };
}

// Ordinary purchases retain their existing eligibility. Books inspect the NEXT
// level: attaching a first-purchase-only gate would leave all later levels open.
export function researchForItem(s, item) {
  const id = typeof item === 'string' ? item : item?.id;
  if (id?.startsWith('L') && id !== 'L1' && s.live?.legacyBroadcast) return id==='L2'&&!count(s,id)?['broadcasting']:[];
  if (id === 'L2' && count(s,id)) return count(s,id)>=2 ? ['streaming','modern'] : ['television'];
  if (id === 'V12') return count(s, id) >= 2 ? ['industrial', 'modern'] : count(s, id) >= 1 ? ['industrial'] : [];
  if (id === 'V13') return ['industrial', 'modern'];
  if (count(s, id)) return [];
  if(RESEARCH_ITEM_GATES[id])return RESEARCH_ITEM_GATES[id];
  if (id === 'V24') return ['cargo-tools'];
  if (id === 'V22' || id === 'V25') return ['community-life'];
  if (MODERN_ITEMS.has(id)) return ['modern'];
  return INDUSTRIAL_ITEMS.has(id) ? ['industrial'] : [];
}
export function researchRequirements(s, item) {
  const id = typeof item === 'string' ? item : item?.id;
  const r = state(s), missing = researchForItem(s, id).filter(key => !r.completed[key]).map(key => `完成${RESEARCH_BY_ID[key].name}`);
  const next = count(s, id) + 1;
  if (id === 'V12' && next >= 4 && !count(s, 'N4')) missing.push('建成烈焰熔炉');
  if (id === 'V12' && next >= 5 && !count(s, 'N11')) missing.push('建成下界合金锻台');
  if (id === 'V12' && next >= 6 && !count(s, 'E8')) missing.push('建成末地水晶');
  if (id === 'V13') {
    const gates = [['N11', '建成下界合金锻台'], ['E8', '建成末地水晶'], ['E9', '建成末影龙'], ['Z2', '启动世界工程']];
    const gate = gates[Math.min(next - 1, gates.length - 1)];
    if (!count(s, gate[0])) missing.push(gate[1]);
  }
  return [...new Set(missing)];
}
export function restoreResearch(s, raw) {
  const saved = raw?.research ?? raw, restored = freshResearch();
  if (object(saved) && saved.version === RESEARCH_VERSION) {
    for (const row of RESEARCH_CATALOG) {
      if (saved.completed?.[row.id] === true) restored.completed[row.id] = true;
      const p = saved.projects?.[row.id];
      if (!object(p) || !nonnegative(p.paidCost) || p.paidCost === 0 || !nonnegative(p.progress) || !nonnegative(p.duration) || p.duration > 3600) continue;
      restored.projects[row.id] = { paidCost: p.paidCost, duration: p.duration, progress: Math.min(p.duration, p.progress) };
      if (p.progress >= p.duration) restored.completed[row.id] = true;
    }
    if (RESEARCH_BY_ID[saved.active] && restored.projects[saved.active] && !restored.completed[saved.active]) restored.active = saved.active;
    restored.milestones.villageSale = saved.milestones?.villageSale === true;
    restored.milestones.industrialSale = saved.milestones?.industrialSale === true;
  }
  // Only pre-research save schemas infer the minimum technology needed for
  // already-owned assets. A schema-8 state missing research is not a legacy save.
  if (Number.isInteger(raw?.version) && raw.version >= 2 && raw.version <= 7 && !Object.hasOwn(raw, 'research')) {
    const owns = id => (raw.counts?.[id] || 0) > 0;
    const laterRealm = Object.entries(raw.counts || {}).some(([id, level]) => level > 0 && /^[NEZ]/.test(id));
    const modern = [...MODERN_ITEMS].some(owns) || laterRealm || (raw.counts?.V12 || 0) >= 3 || owns('V13');
    if (modern || [...INDUSTRIAL_ITEMS].some(owns) || (raw.counts?.V12 || 0) >= 2) restored.completed.industrial = true;
    if (modern) restored.completed.modern = true;
  }
  if(raw?.version>=2&&raw.version<=9){
    // These technologies were included in the Alpha.2 era permissions.
    if(restored.completed.industrial){restored.completed.railway=true;restored.completed.automation=true;}
    if(restored.completed.modern)restored.completed.broadcasting=true;
  }
  // This permission did not exist in Alpha.3. Already-built power and paid
  // later-era research retain their eligibility without a second entrance fee.
  if (['M5','M6','M7'].some(id=>count(s,id)) || restored.completed.industrial || restored.projects.industrial)
    restored.completed['basic-power'] = true;
  // Never infer from money, library ownership or a new world's defaults.
  s.research = restored;
  observe(s);
  return restored;
}

import { NARRATOR_COPY } from './narrator-copy.js';

const has = (s, id) => (s.counts[id] || 0) > 0;
const worker = (s, job) => s.community?.residents?.some(r => !r.reserve && r.job === job);
const assigned = s => ['farm', 'wool', 'mine'].some(key => s.grid?.automation?.[key] > 0 || s.grid?.last?.automation?.[key] > 0);
const explain = (id, when, options = {}) => ({
  id, when, lines: NARRATOR_COPY[id].lines, kind: 'explain', priority: 25,
  ttl: 150, minPlay: 0, settle: 6, shop: true, surfaces: ['network'], ...options,
});

// Read completed work and current simulation snapshots. No production, timers
// or money are advanced here; settle is only a debounce for spoken observations.
export const MIDGAME_NARRATION = [
  explain('drill-chain', s => has(s, 'M9') && s.grid?.last?.perDevice?.M9 > 0 && s.buffers.overworld.raw > 0,
    { stable: true, learned: s => has(s, 'M9') }),
  explain('rail-cargo', s => has(s, 'M16') && s.grid?.last?.perDevice?.M16 > 0 && s.transport?.realms?.overworld?.delivery > 0,
    { stable: true, learned: s => has(s, 'M16') }),
  explain('actuator-job', s => has(s, 'M10') && has(s, 'M14') && !has(s, 'M13') && ['V4', 'V9', 'M1'].some(id => has(s, id)) && !assigned(s),
    { settle: 12, priority: 35, catchUp: true }),
  explain('farm-team', s => has(s, 'V4') && worker(s, 'farmer') && s.grid?.last?.loads?.some(l => l.id === 'auto-farm' && l.actual > 0),
    { stable: true, settle: 0, surfaces: ['village', 'network'], learned: s => worker(s, 'farmer') && s.grid?.automation?.farm > 0 }),
  explain('power-shortage', s => has(s, 'M5') && s.grid?.learnedConnection && s.grid?.last?.loads?.some(l => l.enabled && l.rated > 0 && l.fraction < .8),
    { settle: 12, priority: 40, catchUp: true }),
  explain('golem-delivery', s => has(s, 'V15') && s.community?.golems?.some(g => g.delivered > 0),
    { surfaces: ['village', 'network'] }),
  explain('studio-vacancy', s => has(s, 'L2') && has(s, 'L4') && has(s, 'V2') && !worker(s, 'host'),
    { settle: 15, priority: 35, surfaces: ['village', 'live'], catchUp: true }),
  explain('nether-work', s => has(s, 'N1') && has(s, 'N2') && s.dimensions?.heatMade > 0,
    { guard: (s, c) => c.realm?.() === 'nether', shop: false, surfaces: [] }),
  explain('heat-recovery', s => has(s, 'N4') && s.dimensions?.recovered > 0),
  explain('project-delivery', s => has(s, 'Z2') && s.project > 0 && !s.completed,
    { settle: 18, catchUp: true }),
];

const idle = (id, when, minPlay, guard) => ({
  id, when, lines: NARRATOR_COPY[id].lines, minPlay, guard,
  kind: 'idle', priority: 0, ttl: Infinity,
});
export const MIDGAME_IDLE = [
  idle('idle-factory', s => has(s, 'M9'), 900, (s, c) => !!c.runningMachine?.()),
  idle('idle-neighborhood', s => (s.counts.V2 || 0) >= 4, 1080, (s, c) => !!c.workingVisible?.()),
  idle('idle-nether', s => has(s, 'N2'), 1500, (s, c) => c.realm?.() === 'nether'),
];

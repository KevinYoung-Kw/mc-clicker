import { JOBS, jobAvailable, jobSlots, fullJobReason, activeResidents, skillLevel } from './residents.js';

const workplaces = {
  researcher: '图书馆', idle: '村庄', merchant: '集市', farmer: '农田', rancher: '畜栏', hauler: '储物箱与生产点',
  miner: '矿区', crafter: '熔炉', musician: '唱片机', host: '直播间',
  engineer: '音符方块', stagehand: '直播间入口',
};

// A workplace offers the inverse of the person's job menu. Reuse its actual
// restrictions; current staff and legacy reserves are never assignment choices.
export function workplaceAssignment(s, jobId) {
  const people = activeResidents(s);
  const staff = people.filter(r => r.job === jobId);
  const slots = jobSlots(s, jobId);
  const full = staff.length >= slots;
  const candidates = full || !jobAvailable(s, jobId) ? [] : people.filter(r =>
    r.job !== jobId && residentJobChoices(s, r).some(j => j.id === jobId && !j.disabled),
  ).sort((a, b) => Number(b.job === 'idle') - Number(a.job === 'idle') ||
    skillLevel(b, JOBS[jobId]?.skill) - skillLevel(a, JOBS[jobId]?.skill));
  const waiting = people.some(r => r.job !== jobId && r.cargo);
  return { staff, slots, full, candidates, emptyReason: full ? '' : candidates.length ? '' :
    waiting ? '其他村民正在交货，完成后可安排。' : '还没有可安排的村民，可以先招募。' };
}

// These are the same slots/availability rules used by assignJob, not UI-only limits.
export function residentJobChoices(s, resident) {
  return Object.entries(JOBS).filter(([id]) => jobAvailable(s, id)).map(([id, job]) => {
    const current = resident.job === id;
    const occupied = s.community.residents.filter(r => !r.reserve && r.job === id).length;
    const slots = jobSlots(s, id);
    const full = id !== 'idle' && !current && occupied >= slots;
    const delivering = !!resident.cargo && !current;
    const place = id === 'musician' && s.counts.L2 ? '直播间 · 唱片机'
      : id === 'hauler' && !s.counts.M4 ? '集市与生产点' : workplaces[id];
    const capacity = id === 'idle' ? '' : `在岗 ${occupied}/${slots} 人`;
    const reason = delivering ? '正在送货，交付后可换岗' : full
      ? fullJobReason(s, id)
      : current ? '当前岗位' : '';
    return { id, name: job.name, place, description: job.desc,
      meta: [capacity, reason].filter(Boolean).join(' · '),
      disabled: full || delivering, selected: current,
      icon: id === 'idle' ? 'V2' : id === 'hauler' && !s.counts.M4 ? 'V3' : job.target };
  });
}

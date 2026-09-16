// Short-lived observations, not permanent player classes. Only completed actions
// enter these windows; rendering, failed purchases and save imports do not.
export const freshNarrativeBehavior = () => ({ version:2, purchases: [], inspections: [], assignments: [], purchaseSerial:0, rushUntil: 0, rushAt: null, rushReason:null, lastNarrationAt:null, lastPurchaseAt: 0, purchaseClicks: 0, lastClickAt: null, clicks: 0 });
const starter = new Set(['T1','V1','V18','V2','T7']);
// Below even the continuous-hold simulation, not a player label.
// See docs/v1.5.1/NARRATION-TIMING.md. A fast milestone also needs real work.
export const FAST_MILESTONES = { M5:25, M8:75, M16:180, N1:300 };
const recent = (rows, now, seconds) => rows.filter(r => r.at <= now && now - r.at <= seconds);
export function restoreNarrativeBehavior(raw, s) {
  const b = freshNarrativeBehavior();
  if (!raw) return { ...b, lastPurchaseAt: s.play, purchaseClicks: s.clicks, clicks: s.clicks };
  for (const key of ['purchases', 'inspections', 'assignments'])
    b[key] = recent((Array.isArray(raw[key]) ? raw[key] : []).filter(r => typeof r?.id === 'string' && Number.isFinite(r.at)).slice(-12).map(r => ({ id:r.id.slice(0,64), at:r.at, first:raw.version===2&&r.first===true, talking:raw.version===2&&r.talking===true, ...(typeof r.job==='string'?{job:r.job.slice(0,32)}:{}) })), s.play, 60);
  b.rushUntil = raw.version===2 && Number.isFinite(raw.rushUntil) ? Math.min(s.play + 40, Math.max(0, raw.rushUntil)) : 0;
  b.rushReason=raw.version===2&&['burst','milestone'].includes(raw.rushReason)?raw.rushReason:null;
  for (const key of ['lastPurchaseAt', 'lastClickAt', 'rushAt']) if (Number.isFinite(raw[key])) b[key] = Math.max(0, Math.min(s.play, raw[key]));
  b.purchaseClicks = Number.isFinite(raw.purchaseClicks) ? Math.max(0, Math.min(s.clicks, raw.purchaseClicks)) : s.clicks;
  b.clicks = s.clicks;
  b.purchaseSerial = Number.isFinite(raw.purchaseSerial)?Math.max(0,Math.floor(raw.purchaseSerial)):0;
  return b;
}
export function observeNarrativeBehavior(s) {
  const b = s.narrative.behavior ||= freshNarrativeBehavior();
  if (s.clicks > b.clicks) b.lastClickAt = s.play;
  b.clicks = s.clicks;
}
export function recordNarrativeAction(s, type, {id, job} = {}) {
  if (!s.narrative || !id) return;
  const b = s.narrative.behavior ||= freshNarrativeBehavior(), at = s.play;
  if (type === 'purchase') {
    b.purchaseSerial++;
    const first = /^[TVMLNEZX]\d+$/.test(id) && s.counts[id]===1 && !b.purchases.some(r=>r.id===id);
    // A short confirmation can interrupt a sentence without making the player
    // stop being a listener. Hidden/pending lines alone are not evidence.
    const talking = !!s.narrative.current && b.lastNarrationAt!==null && at-b.lastNarrationAt<=8;
    b.purchases = [...recent(b.purchases, at, 45), {id, at, first, talking}].slice(-12);
    b.lastPurchaseAt = at; b.purchaseClicks = s.clicks; b.inspections = [];
    const burst = recent(b.purchases, at, 35).filter(r=>r.first);
    const continuing = burst.length>=6 && burst.filter(r=>!starter.has(r.id)).length>=3 && burst.filter(r=>r.talking).length>=3;
    const knowsWork = s.grid?.learnedConnection || b.assignments.length>0;
    const fastMilestone = first && FAST_MILESTONES[id] && at<=FAST_MILESTONES[id] &&
      Object.keys(s.counts).filter(key=>s.counts[key]>0).length>=5 && knowsWork;
    if (continuing || fastMilestone) { b.rushUntil = at + 40; b.rushAt = at; b.rushReason=continuing?'burst':'milestone'; }
  } else if (type === 'inspect') {
    b.inspections = [...recent(b.inspections, at, 35).filter(r=>r.id!==id), {id,at}].slice(-12);
  } else if (type === 'assignment') {
    b.assignments = [...recent(b.assignments,at,60), {id,job,at}].slice(-12);
  }
}
export const rushing = s => (s.narrative.behavior?.rushUntil || 0) > s.play;
export function browsing(s) {
  const b = s.narrative.behavior;
  return !!b && new Set(recent(b.inspections,s.play,35).map(r=>r.id)).size >= 3 && s.play - b.inspections.at(-1).at < 15;
}
export function grinding(s) {
  const b = s.narrative.behavior;
  return !!b && s.clicks - b.purchaseClicks >= 40 && s.play - b.lastPurchaseAt >= 35 && b.lastClickAt !== null && s.play - b.lastClickAt < 8;
}
export function rearranging(s) {
  const rows = recent(s.narrative.behavior?.assignments || [], s.play, 60);
  if (!rows.length || s.play - rows.at(-1).at > 15) return false;
  return rows.some(r => rows.filter(other=>other.id===r.id).length >= 3);
}

// Fixed-price, cosmetic audio collection. Never imported by production/rate formulas.
export const RECORDS = [
  { id: "meadow", name: "田埂来风", style: "木琴配拨弦，轻快的田园曲。", cost: 0, bpm: 92, meter: 4, bars: 32, color: "#92aa65" },
  { id: "cavern", name: "深岩回声", style: "低沉的石钟声，带着矿洞里的回响。", cost: 600, bpm: 66, meter: 3, bars: 32, color: "#839da2" },
  { id: "copper", name: "铜线节拍", style: "金属拨片配木鼓，节奏轻快、错落。", cost: 1600, bpm: 114, meter: 4, bars: 32, color: "#c88455" },
  { id: "rain", name: "窗边夜雨", style: "柔和的琴键声和长笛，适合雨夜。", cost: 3600, bpm: 72, meter: 4, bars: 24, color: "#778ba4" },
  { id: "nether", name: "熔火慢行", style: "低鼓配暗沉弦音，像在下界慢慢走。", cost: 9000, bpm: 96, meter: 4, bars: 32, color: "#b56c56" },
  { id: "end", name: "群星以外", style: "晶体钟声和绵长和弦，空旷、轻缓。", cost: 18000, bpm: 60, meter: 5, bars: 20, color: "#a79cbc" },
];
export const RECORD_BY_ID = Object.fromEntries(RECORDS.map(r => [r.id, r]));
export const RECORD_MODES = { collection: '列表循环', shuffle: '随机播放', single: '单曲循环', once: '播完停止' };
const savedMode = saved => RECORD_MODES[saved.mode] ? saved.mode : saved.loop === false ? 'once' : 'single';
export const freshRecords = () => ({ owned: [], selected: "meadow", playing: true, mode: 'collection', loop: true });
export function setRecordMode(s, mode) {
  if (!RECORD_MODES[mode]) return false;
  const r = ensureRecords(s);
  r.mode = mode;
  r.loop = mode !== 'once'; // Retain the old save field for older readers.
  return true;
}
export const freshAudio = () => ({ musicVolume: 0.55, sfxVolume: 0.6, narratorVolume: 0.45, narratorVoice: true });
export function setNarratorVoice(s, enabled) {
  s.audio ||= freshAudio();
  const react = !!s.guidance?.info && s.guidance.notices && s.audio.narratorVoice !== false && !enabled && !s.narrative.voiceMuteReactionSeen;
  s.audio.narratorVoice = !!enabled;
  if (enabled && s.audio.narratorVolume === 0) s.audio.narratorVolume = .45;
  if (react) s.narrative.voiceMuteReactionSeen = true;
  return react;
}
export function ensureRecords(s) {
  s.records ||= freshRecords();
  s.records.mode = savedMode(s.records);
  s.audio ||= freshAudio();
  if (s.counts.L1 && !s.records.owned.includes("meadow")) s.records.owned.unshift("meadow");
  return s.records;
}
export function restoreRecords(s, raw) {
  const saved = raw.records || {}, defaults = freshAudio();
  s.records = {
    owned: Array.isArray(saved.owned) ? [...new Set(saved.owned.filter(id => RECORD_BY_ID[id]))] : [],
    selected: RECORD_BY_ID[saved.selected] ? saved.selected : "meadow",
    playing: saved.playing !== false,
    loop: saved.loop !== false,
    mode: raw.records ? savedMode(saved) : 'collection',
  };
  const r = ensureRecords(s);
  if (!r.owned.includes(r.selected)) r.selected = "meadow";
  s.audio = Object.fromEntries(Object.entries(defaults).map(([key, fallback]) => [key,
    typeof fallback === 'boolean' ? (typeof raw.audio?.[key] === 'boolean' ? raw.audio[key] : fallback) :
    Number.isFinite(raw.audio?.[key]) ? Math.max(0, Math.min(1, raw.audio[key])) : fallback]));
}
export function recordStatus(s, id) {
  const record = RECORD_BY_ID[id], r = ensureRecords(s);
  if (!record || !s.counts.L1) return { kind: "locked", reason: "需要先购买唱片机" };
  if (r.owned.includes(id)) return { kind: "owned", reason: "已收藏" };
  return s.money < record.cost
    ? { kind: "short", reason: `还差 ${Math.ceil(record.cost - s.money).toLocaleString("zh-CN")} 绿宝石` }
    : { kind: "ready", reason: "" };
}
export function buyRecord(s, id) {
  const status = recordStatus(s, id), record = RECORD_BY_ID[id];
  if (status.kind !== "ready") return { ok: false, reason: status.reason };
  s.money -= record.cost;
  s.records.owned.push(id);
  return { ok: true, cost: record.cost, text: `已收藏《${record.name}》` };
}
export function selectRecord(s, id) {
  if (!s.counts.L1 || !ensureRecords(s).owned.includes(id)) return false;
  s.records.selected = id;
  s.records.playing = true;
  return true;
}

// One room grows from a radio station into a modern studio. Historical studios
// retain their original audience and settlement rules through a saved entitlement.
export const BROADCAST_VERSION = 1;
export const BROADCAST_STAGES = Object.freeze([
  {id:'radio',name:'广播电台',audience:'听众',limit:180,revenue:0.35,growth:0.6,next:'电视技术',research:'television',description:'安排主持人开麦，先把村里的故事讲给听众。'},
  {id:'television',name:'电视节目',audience:'观众',limit:450,revenue:0.6,growth:0.8,next:'流媒体技术',research:'streaming',description:'添置机位，把麦田和工厂拍进节目。'},
  {id:'streaming',name:'流媒体直播',audience:'观众',limit:1000,revenue:0.75,growth:1,next:'现代技术',research:'modern',description:'回应弹幕、收取礼物，和观众一起做节目。'},
  {id:'modern',name:'现代演播室',audience:'观众',limit:Infinity,revenue:1,growth:1,next:null,research:null,description:'经营订阅、联动节目与自动导播。'},
].map(Object.freeze));
export function broadcastStage(s) {
  const completed=s.research?.completed||{};
  if(s.live?.legacyBroadcast || (completed.modern && completed.streaming))return BROADCAST_STAGES[3];
  if(completed.streaming)return BROADCAST_STAGES[2];
  if(completed.television)return BROADCAST_STAGES[1];
  return BROADCAST_STAGES[0];
}
export function broadcastAudienceLimit(s) {
  const subjects=Object.keys(s.counts||{}).filter(id=>s.counts[id]>0&&!['T','X'].includes(id[0])).length;
  return Math.min(broadcastStage(s).limit,80+subjects*65+(s.counts?.L11?5000:0));
}
export function broadcastAudience(s) {
  // Preserve the old instantaneous event/host audience behaviour for old studios.
  return Math.max(0,Math.min(s.live?.viewers||0,broadcastStage(s).limit));
}
export function restoreBroadcast(s,raw) {
  s.live.broadcastVersion=BROADCAST_VERSION;
  s.live.legacyBroadcast=raw.live?.legacyBroadcast===true ||
    (raw.live?.broadcastVersion!==BROADCAST_VERSION && ((raw.counts?.L2||0)>0 || raw.research?.completed?.broadcasting===true || (raw.research?.projects?.broadcasting?.paidCost||0)>0));
}

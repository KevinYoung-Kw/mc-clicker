import {COMMUNITY_COPY} from './community-souvenirs-data.js';
import {communityStoryReady,communityReward,villageBesidePortal} from './community-stories.js';
// A shared five-minute spacing prevents a mature imported world from dumping
// all of its stories at once. Ordinary teaching and receipts retain priority.
export const COMMUNITY_NARRATION=Object.entries(COMMUNITY_COPY).map(([id,lines])=>({
 id,community:true,kind:'aside',minPlay:900,priority:-25,ttl:Infinity,quietFor:25,settle:3,
 when:s=>communityStoryReady(s,id),
 guard:(s,c)=>id!=='community-stage'||(villageBesidePortal(s)&&c.realm?.()==='overworld'),
 lines:s=>{const reward=communityReward(id);return reward&&!s.communityStories.claimed.includes(reward.id)?[...lines,`「${reward.name}」已解锁，到园艺台的「纪念景物」领取。`]:lines;},
}));

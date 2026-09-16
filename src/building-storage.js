import {ITEMS} from './catalog.js';
import {STORABLE_FACILITIES,facilityStored,facilityMembers} from './facility-storage.js';
import {JOBS} from './residents.js';
import {TASKS} from './operations.js';
import {storageCapacity} from './upgrades.js';
import {canPlace} from './layout.js';
import {gridCapacity} from './power.js';
import {heatCapacity} from './dimensional.js';
export function facilityStorageReason(s,id){
 if(s.life?.sites?.some(p=>p.type===id&&!p.stored))return "先到设施详情或全村生活收起同类分点";
 if(!STORABLE_FACILITIES.has(id))return '这项设施暂不收纳，可以搬动整理';
 if(facilityStored(s,id)||!s.placements[id])return '设施已收纳或不在户外';
 const workers=s.community?.residents||[];
 const members=facilityMembers(id);
 if(workers.some(r=>members.includes(JOBS[r.job]?.target)))return '还有村民在这里工作，请先到居民页换岗';
 if(workers.some(r=>members.includes(r.prioritySource)))return '还有优先搬运安排，请先在物流调度中取消';
 if(s.community?.golems?.some(g=>g.stops.some(key=>members.includes(key))))return '铜傀儡还在巡收这里，请先移出巡收站点';
 if(s.community?.batches?.some(b=>members.includes(b.source)&&b.qty>0)||workers.some(r=>members.includes(r.cargo?.source))||s.community?.golems?.some(g=>members.includes(g.cargo?.source)))return '还有待运或在途货物，交付完成后再收纳';
 const allocations=id==='V7'?['wool']:id==='L2'?['music']:id==='M14'?['farm','wool','mine']:[{V4:'farm',M1:'mine',L1:'music',M20:'note'}[id]];
 if(allocations.some(k=>s.grid.automation[k]>0))return '还有自动化分配，请先在工业面板撤回执行器';
 if(Object.entries(TASKS).some(([key,t])=>members.includes(t.id)&&((s.community?.tasks?.[key]?.work||0)>0||(s.community?.tasks?.[key]?.pendingHarvest||0)>0)))return '本次工作尚未完成，请完成并交付后再收纳';
 if(id==='M3'&&s.harvest.piston>0)return '活塞里还有原料，请先收取';
 if(id==='L2'&&s.live.gifts.length)return '直播间还有礼物，请先领取';
 const cargo=(s.community?.batches||[]).some(b=>b.qty>0)||workers.some(r=>r.cargo?.qty>0)||(s.community?.golems||[]).some(g=>g.cargo?.qty>0);
 if(['M4','V3'].includes(id)&&cargo)return '还有货物准备送到交货点，交付完成后再收纳';
 const trips=Object.entries(s.dimensions?.trips||{}).filter(([,t])=>t.cargo>0);
 if(trips.some(([source])=>source===id)||(['N1','E2','N12','E7','E6'].includes(id)&&trips.length))return '还有跨界货物在途中，卸货后再收纳';
 if(['E2','E7'].includes(id)&&Object.values(s.dimensions?.awaiting||{}).some(q=>q>0))return '末地交接处还有待收货物，请先完成搬运';
 if(['N1','E2'].includes(id)){
  const realm=id==='N1'?'nether':'end';
  if(Object.entries(s.placements).some(([key,p])=>key!==id&&p.realm===realm))return '请先收纳这个世界里的设施，再收纳传送门';
  if(s.buffers[realm].raw>0||s.buffers[realm].goods>0)return '这个世界还有库存，请先运走货物';
 }
 const after={...s,facilityStorage:{...s.facilityStorage,[id]:true}};
 if(Object.entries(s.buffers).some(([realm,b])=>b.raw>storageCapacity(after,realm,'raw')||b.goods>storageCapacity(after,realm,'goods')))return '收纳会降低仓储容量，请先运走多余货物';
 if(s.energy>gridCapacity(after))return `收纳后储电容量降为 ${Math.floor(gridCapacity(after)).toLocaleString('en-US')} E，当前还有 ${Math.ceil(s.energy).toLocaleString('en-US')} E 电量。为保留这些电量，暂时不能收纳；只想换位置，可以直接搬动。`;
 if((s.dimensions?.heat||0)>heatCapacity(after))return '收纳后的储热空间不足以保留当前热量。暂时不能收纳；只想换位置，可以直接搬动。';
 return '';
}
export function storeFacility(s,id){
 const reason=facilityStorageReason(s,id);if(reason)return {ok:false,reason};
 s.facilityStorage||={};s.facilityStorage[id]=true;delete s.placements[id];s.layoutRevision++;
 s.grid.revision++;return {ok:true,name:ITEMS[id].name,cost:0};
}
export function replaceFacility(s,id,p){
 if(!facilityStored(s,id))return {ok:false,reason:'这座设施已经摆回'};
 if(!p||p.realm!==ITEMS[id].realm||!canPlace(s,id,p))return {ok:false,reason:'这里不能摆放，请重新选址'};
 s.placements[id]={x:p.x,z:p.z,realm:p.realm,rotation:((p.rotation||0)%4+4)%4};delete s.facilityStorage[id];
 s.layoutRevision++;s.grid.revision++;return {ok:true,name:ITEMS[id].name,cost:0};
}

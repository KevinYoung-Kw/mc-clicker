// Purchasable interface features never gate construction or action-error feedback.
export const GUIDANCE_ITEMS = Object.freeze([
  {id:'info',name:'消息通知',icon:'info',cost:10,deps:[],desc:'被商城抓来的消息通知。买下它，就会有人提醒你新东西怎么用，偶尔也说两句闲话。'},
  {id:'counter',name:'绿宝石计数器',icon:'album',cost:15,deps:['info'],desc:'在顶部显示余额和每秒收入。点数字可以查看收入来源。'},
  {id:'nameplate',name:'世界铭牌',icon:'cube',cost:30,deps:['info'],desc:'显示世界名称、土地和建筑数量，以及 kw-aigc 标志。'},
  {id:'goals',name:'目标追踪',icon:'goal',cost:20,deps:[],desc:'推荐下一件值得买的东西。点世界旁的小旗直达商品，不想看时可以收起。'},
].map(i=>Object.freeze({...i,deps:Object.freeze(i.deps)})));
const NAMES={T1:'木镐',V1:'开垦',V18:'邮箱',goals:'目标追踪',info:'消息通知'};
const itemFor=id=>GUIDANCE_ITEMS.find(i=>i.id===id);
export const guidanceDescription=(s,id)=>id==='info'&&['pending','returning'].includes(s.narrative?.openingChoice)
  ?'会对村里的新鲜事插几句话。世界信息里还可以查看操作指南和版本日志。':itemFor(id)?.desc||'';
export function freshGuidance(){return {version:2,info:false,goals:false,counter:false,nameplate:false,collapsed:false,notices:true};}
export function restoreGuidance(raw,s){
  const result=freshGuidance();
  if(raw==null){result.goals=(s?.counts?.V1||0)>0;result.info=(s?.counts?.V2||0)>0||(s?.counts?.T7||0)>0;}
  else {result.goals=raw.goals===true;result.info=raw.info===true;result.collapsed=raw.collapsed===true;result.notices=raw.notices!==false;}
  // Legacy players keep the interface that was already on their screen.
  result.counter=raw?.version!==2 || raw.counter===true;
  result.nameplate=raw?.version!==2 || raw.nameplate===true;
  return result;
}
export const guidanceOwned=(s,id)=>!!itemFor(id)&&s?.guidance?.[id]===true;
export const guidanceMissing = (s,id) => itemFor(id)?.deps.filter(d=>itemFor(d)?!guidanceOwned(s,d):!(s?.counts?.[d]>0))||[];
export function guidanceRequirements(s,id){return !itemFor(id)?['未知特性']:guidanceMissing(s,id).map(d=>NAMES[d]);}
// One shared priority for the shop, goal tracker and contextual purchase hints.
export function priorityInterface(s) {
  // Free choice stays intact; only the recommendation waits for the first resident.
  const ids=guidanceOwned(s,'info')&&!guidanceOwned(s,'goals')?['goals']:
    guidanceOwned(s,'goals')&&(s.counts?.V2||0)>0?['counter','nameplate']:[];
  return GUIDANCE_ITEMS.find(i=>ids.includes(i.id)&&!guidanceOwned(s,i.id)&&!guidanceRequirements(s,i.id).length)||null;
}
export function buyGuidance(s,id){
  const i=itemFor(id);if(!i)return {ok:false,reason:'未知特性'};
  if(guidanceOwned(s,id))return {ok:false,reason:'已解锁'};
  const missing=guidanceRequirements(s,id);if(missing.length)return {ok:false,reason:`需要先${missing.join('、')}`};
  if(!Number.isFinite(s.money)||s.money<i.cost)return {ok:false,reason:'绿宝石还不够'};
  s.guidance={...restoreGuidance(s.guidance,s),[id]:true};s.money-=i.cost;return {ok:true,cost:i.cost};
}

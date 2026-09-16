// Receipts from the existing earn() path, not another production estimate.
const ledgers = new WeakMap();
const names = {easterEgg:'彩蛋奖励',postal:'邮政',base:'村民基础收入',jobs:'岗位与演出',production:'生产交货',live:'直播经营',gift:'礼物奖励',order:'订单奖励',mail:'邮件奖励',manual:'手动采集'};
const bonuses = new Set(['gift','order','mail','easterEgg']);
function ledger(s) { if(!ledgers.has(s))ledgers.set(s,{current:null,last:{total:0,rows:[]},recent:[]});return ledgers.get(s); }
export function beginIncome(s) { ledger(s).current={}; }
export function recordIncome(s,amount,source) {
  const l=ledger(s),key=names[source]?source:'production';
  if(l.current)l.current[key]=(l.current[key]||0)+amount;
  if(bonuses.has(key))l.recent=[{key,name:names[key],amount,at:s.play},...l.recent].slice(0,4);
}
export function finishIncome(s,seconds,total) {
  const l=ledger(s), receipts=Object.entries(l.current||{}),sum=receipts.reduce((v,[,a])=>v+a,0);
  l.last={total,rows:receipts.filter(([,a])=>a>0).map(([key,amount])=>({key,name:names[key],rate:sum?amount/sum*total:0,bonus:bonuses.has(key)}))};l.current=null;
}
export function incomeSnapshot(s) { const l=ledger(s);return {...l.last,recent:l.recent}; }

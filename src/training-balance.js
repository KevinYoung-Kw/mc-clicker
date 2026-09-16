// Frozen pre-alpha.3 training entitlements. New levels use the new curve;
// restoring again never recalculates or adds another legacy credit.
const level=(s,id,max)=>Math.max(0,Math.min(max,Math.floor(s.counts?.[id]||0)));
export const freshTrainingBalance=()=>({version:1,base:0,goods:0,music:0,trade:0});
export function trainingFactor(s){
 return (1+.10*level(s,'V12',6))*(1+.08*level(s,'V13',4))+(s.trainingBalance?.base||0);
}
export const legacyGoodsFactor=s=>1+(s.trainingBalance?.goods||0);
export const legacyMusicFactor=s=>1+(s.trainingBalance?.music||0);
export const legacyTradeFactor=s=>1+(s.trainingBalance?.trade||0);
export function restoreTrainingBalance(s,raw){
 const result=freshTrainingBalance(),old=raw.trainingBalance;
 const a=level(s,'V12',6),b=level(s,'V13',4),base=1.55**a*2**b;
 const caps={base:Math.max(0,base-(1+.1*a)*(1+.08*b)),goods:.3*a,music:.25*a,trade:Math.max(0,base**.45-1)};
 if(old?.version===1){for(const k of Object.keys(caps))if(Number.isFinite(old[k]))result[k]=Math.max(0,Math.min(caps[k],old[k]));}
 else if(Number.isInteger(raw.version)&&raw.version>=2&&raw.version<=9)Object.assign(result,caps);
 s.trainingBalance=result;
 return result;
}

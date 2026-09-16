// Extra facility locations share the original facility's upgrade level.
// This small read-only module is safe for layout, navigation and life consumers.
export const CIVIC_TYPES = Object.freeze({V4:{name:'麦田',w:2,d:2,cost:1388,costs:[1388,6816]},V7:{name:'畜栏',w:2,d:2,cost:4320,costs:[4320,13997]},V21:{name:'街心小园',w:1.5,d:1.5,cost:900},V25:{name:'村庄食堂',w:2,d:1.5,cost:3900}});
export const civicFootprint=p=>{const f=CIVIC_TYPES[p.type];return (p.rotation||0)%2?{w:f.d,d:f.w}:{w:f.w,d:f.d};};
export const civicObjects=s=>(s.life?.sites||[]).filter(p=>!p.stored&&CIVIC_TYPES[p.type]).map(p=>({...p,realm:'overworld',kind:'civic',...civicFootprint(p)}));
export const civicCount=(s,type)=>Number((s.counts?.[type]||0)>0)+(s.life?.sites||[]).filter(p=>p.type===type).length;
export const civicCost=(s,type)=>CIVIC_TYPES[type]?(CIVIC_TYPES[type].costs?.[Math.max(0,civicCount(s,type)-1)]??Math.ceil(CIVIC_TYPES[type].cost*1.5**Math.max(0,civicCount(s,type)-1))):Infinity;

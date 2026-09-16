// A short, optional dialogue event. No scenery, routes or production modifiers.
export const afterHours={
 id:'after-hours',version:1,kind:'dialogue',title:'出去一趟',cost:520,duration:60,
 accessory:'date-bow',accessoryName:'约会领结',
 eligible:s=>s.play>=28*60&&s.counts.M5>0&&(s.counts.M16>0||s.counts.N1>0),
 prepare:()=>({}),
 offer:['商量个事。给我五百二十颗，我想去见一下对象。','总不能还穿着商城给我装的这层纸吧。'],
 depart:'我出去一趟。一分钟，替我盯着点商城。',
 found:['回来了。她说领结挺好看。','对象的事先不说，这个领结以后就归咱们了。'],
};

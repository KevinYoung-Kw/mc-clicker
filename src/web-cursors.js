// Original 32 px operation assets. The hotspot belongs to the tool, never its shop picture.
const rect=(x,y,w,h,c)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c}"/>`;
const path=(d,c)=>`<path d="${d}" fill="${c}"/>`;
export const CURSOR_COLORS={stone:['#819184','#e5e9de','#303b34'],oak:['#b88b4d','#f7dda1','#493423'],copper:['#bf754f','#f7d7b2','#46352d'],diamond:['#48b4bb','#e3fff9','#214a51'],amethyst:['#9e76c8','#f2e5ff','#46305a'],obsidian:['#362e47','#c6b3e5','#1b1724'],classic:['#fffdf4','#ffffff','#181818'],glove:['#f1e5cb','#ffffff','#40372b'],quill:['#dbd7c3','#fffef1','#3d4b3d'],pickaxe:['#66bab8','#e3faf1','#324849']};
const shapes={
 stone:'M0 0v25h3v-3h3v-3h3v5h3v5h5v-4h-3v-7h9v-3h-3v-3h-4V9h-4V6H8V3H4V0Z',
 oak:'M0 0v27l7-8 7 12 4-3-7-12h12Z',
 copper:'M0 0v24h4v-4h4v4h3v7h7v-7h-3v-6h12v-4h-5v-4h-6V6h-6V2H4V0Z',
 diamond:'M0 0v29l8-10 6 10 4-3-6-10h15Z',
 amethyst:'M0 0v28l7-6 3 8 5-2-2-9 13-1Z',
 obsidian:'M0 0v27l8-7 4 10 8-3-5-9h15l-7-5-7-4-7-5Z',
 classic:'M0 0v25l7-7 6 12 5-3-6-11h12Z',
 pickaxe:'M0 0h12v3h5v3h4v4h4v10h-4v-7h-4v3h-3v4h-3v4H8v4H4v-5h3v-4h3v-4h3v-4h-3V8H6V5H0Z',
 quill:'M0 0l5 13 3-3 5 6h6v-4h6V8h6V2H18l-6 3-7-3Z',
};
const stateName=s=>s===true?'pointer':s===false?'default':s||'default';
export function cursorHotspot(id,state='default') {
 state=stateName(state);
 return state==='pointer'||(id==='web-cursor-glove'&&state==='default')?[9,0]:state==='grab'||state==='grabbing'?[15,14]:[0,0];
}
const outline=(d,fill)=>`<path d="${d}" fill="${fill}" stroke="#fffef5" stroke-width="2" stroke-linejoin="miter"/><path d="${d}" fill="${fill}" stroke="#202720" stroke-width="1" stroke-linejoin="miter"/>`;
export function cursorArt(id,state='default') {
 const key=id.replace('web-cursor-',''),[color,light,dark]=CURSOR_COLORS[key]||CURSOR_COLORS.stone;
 state=stateName(state);let body='';
 if(state==='pointer'||key==='glove'&&state==='default'){
  body=outline(state==='default'?'M8 0h3v14h4v-2h4v2h4v3h3v8h-3v6H11v-4H8v-4H5v-4H3v-6h3l2 5Z':'M8 0h3v13h3V9h4v3h4v2h4v11h-3v6H11v-4H8v-4H5v-4H2v-4h4l2 3Z',light)
   +path('M11 14h2v8h-2ZM16 14h2v8h-2ZM21 16h2v6h-2Z',dark)+rect(11,27,12,3,color)+rect(12,28,3,1,light);
 }else if(state==='grab'){
  body=outline('M5 6h4v7h2V2h4v11h2V1h4v13h2V5h4v17h-3v7H11v-5H7v-5H3v-6h2Z',light)+rect(12,25,12,3,color)+rect(14,14,1,7,dark)+rect(19,14,1,7,dark);
 }else if(state==='grabbing'){
  body=outline('M7 11h4V8h5v1h5v2h5v13h-3v5H11v-5H7v-4H4v-7h3Z',light)+path('M11 12h2v7h-2ZM16 12h2v7h-2ZM21 14h2v6h-2Z',dark)+rect(12,25,11,3,color);
 }else{
  body=outline(shapes[key]||shapes.stone,color);
  const detail={
   stone:path('M2 3v16l5-5h10Z',light)+rect(11,21,2,4,dark),
   oak:path('M2 4v16l5-6h8Z',light)+path('M7 11l7 16 2-1-7-15Z',dark),
   copper:path('M2 3v15h3v-4h14Z',light)+rect(11,24,5,5,'#648a76')+rect(13,25,1,2,light)+rect(19,14,5,2,dark),
   diamond:path('M2 3v19l6-7Z',light)+path('M3 4l18 10H9Z','#84d7d6')+path('M9 16l6 11 1-1-6-10Z',light),
   amethyst:path('M2 3v20l5-6Z',light)+path('M3 4l16 11-9 1Z','#bd9edd')+rect(10,23,2,4,light),
   obsidian:path('M2 4v18l6-6 7 1Z',light)+path('M9 8l14 8h-8Z','#69567e')+rect(12,24,4,2,'#a390c3'),
   classic:path('M2 4v17l5-6h10Z',light)+path('M9 17l5 10 2-1-5-9Z',light),
   pickaxe:path('M1 1h10v3h5v3h4v4h-3V9h-5V6H7V4H1Z',light)+path('M15 13h2v2h-3v4h-3v4H8v3H6v-2h3v-4h3v-4h3Z','#ac7b47'),
   quill:path('M2 2l4 7 4-2 7 5h5V8h5V4H18l-6 3Z',light)+path('M5 6l18-3v2L8 8Z',dark)+rect(18,7,2,3,color),
  };
  body+=detail[key]||detail.stone;
 }
 return `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32" shape-rendering="crispEdges">${body}</svg>`;
}

// Center the actual drawing on a product tile without moving its operational hotspot.
export function cursorProductArt(id){
 const body=cursorArt(id).replace(/^<svg[^>]*>/,'').replace(/<\/svg>$/,'');
 return `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64" shape-rendering="crispEdges"><g transform="translate(17 16)">${body}</g></svg>`;
}

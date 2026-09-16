// Original pixel artwork. Operation cursors have their own 32×32 drawings;
// product illustrations never determine the click hotspot.
const rect=(x,y,w,h,c)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c}"/>`;
const path=(d,c)=>`<path d="${d}" fill="${c}"/>`;
const svg=(body,w=96,h=64)=>`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" shape-rendering="crispEdges">${body}</svg>`;
import { cursorArt, cursorProductArt, CURSOR_COLORS } from './web-cursors.js';
export { cursorArt } from './web-cursors.js';
export const ART_COLORS=CURSOR_COLORS;
export function badgeArt(id) {
 const key=id.replace('web-icon-','');let p='';
 if(key==='emerald')p=path('M10 2h12v4h4v22h-4v4H10v-4H6V6h4Z','#446e49')+rect(10,5,11,23,'#87b669')+rect(10,5,3,20,'#d2e99d')+rect(20,8,3,20,'#648d50');
 if(key==='grass')p=path('M2 9 16 2 30 9v15l-14 8L2 24Z','#7b5d3e')+path('M2 9 16 2 30 9 16 17Z','#a0c36f')+path('M2 9v5l14 8v-5Z','#659652')+path('M16 17 30 9v6l-14 7Z','#547d42')+rect(5,18,3,4,'#b8925f');
 if(key==='workbench')p=rect(2,7,28,9,'#4d382b')+rect(4,5,24,9,'#bd8b50')+rect(14,5,3,9,'#755439')+rect(4,9,24,2,'#755439')+rect(4,15,6,15,'#97663a')+rect(22,15,6,15,'#97663a')+rect(9,17,15,6,'#c6985e');
 if(key==='minecart')p=path('M1 8h30v13h-4v5H5v-5H1Z','#4c5e55')+rect(4,5,24,7,'#afbbae')+rect(6,7,20,4,'#253c33')+rect(5,13,22,8,'#899b8f')+rect(5,25,5,5,'#2f3d39')+rect(23,25,5,5,'#2f3d39');
 if(key==='torch')p=rect(13,11,6,20,'#694733')+rect(14,12,2,17,'#bb8652')+path('M10 3h12v3h3v9H7V6h3Z','#962f2b')+rect(10,2,11,10,'#e66949')+rect(12,3,5,5,'#ffe8a3');
 if(key==='wheat')p=path('M7 30h3v-6h4v-5h4v-6h4V7h3V2h-3v4h-4v6h-4v6h-4v6H7Z','#796440')+rect(5,16,6,5,'#d6ae53')+rect(12,22,6,5,'#e8c765')+rect(10,8,6,5,'#e8c765')+rect(20,14,6,5,'#d6ae53')+rect(17,1,5,5,'#f5dc8b');
 if(key==='eye')p=path('M1 12h4V8h6V5h10v3h6v4h4v9h-4v4h-6v3H11v-3H5v-4H1Z','#395c50')+path('M5 13h6V9h10v4h6v7h-6v4H11v-4H5Z','#b6c8a1')+rect(13,9,7,15,'#5f9d7e')+rect(15,9,3,16,'#202e34');
 if(key==='dragon')p=path('M0 2h3v4h3v4h4v3h5V9h3v4h5v-3h3V6h3V2h3v17h-5v-4h-4v6h-6v9h-3v-9H9v-6H5v4H0Z','#514663')+rect(3,10,3,3,'#a28ac1')+rect(25,10,3,3,'#a28ac1')+rect(14,15,4,5,'#ac97cd');
 return svg(p,32,32);
}
export const titleInk=id=>['redstone','rail','diamond','amethyst','obsidian'].includes(id.replace('web-title-',''))?'#f8f1df':'#393a2b';
export function titleArt(id) {
 const k=id.replace('web-title-','');let c='#b48b59',ink='#443722',p='';
 const palette={birch:['#e7dcc0','#454d39'],stone:['#a2aba0','#34483e'],harvest:['#d2bd7a','#605131'],copper:['#bf8c68','#483c2a'],redstone:['#485348','#f0e4bd'],lapis:['#526e93','#edf1dd'],rail:['#303c35','#e2d6a3'],diamond:['#455f60','#d3f1e0'],amethyst:['#6a597c','#f1e3fe'],obsidian:['#3b3448','#e0d6ed'],'first-block':['#b1955e','#344c30']};
 [c,ink]=palette[k]||[c,ink];
 p=path('M4 4h146v4h6v23h-6v5H4v-4H0V8h4Z',ink)+rect(4,7,147,26,c);
 if(k==='oak')p+=rect(6,11,143,2,'#8a623e')+rect(6,25,143,2,'#8a623e')+rect(2,14,8,12,'#d6b578')+rect(146,14,8,12,'#d6b578');
 if(k==='first-block')p+=path('M0 3h145v6H20v6h-8V9H5v7H0Z','#7a9e55');
 if(k==='birch')p+=rect(3,8,3,7,'#4c5546')+rect(145,20,5,6,'#4c5546')+path('M143 26h8v7h-8Z','#f8f3df');
 if(k==='stone')p+=rect(10,9,126,2,'#718478')+rect(9,29,129,2,'#d5dbcd')+rect(22,31,7,5,ink);
 if(k==='harvest')for(let x=10;x<150;x+=10)p+=rect(x,4,5,3,'#efdaa0')+rect(x+4,32,5,3,'#9a8346');
 if(k==='copper')p+=rect(6,11,4,4,'#edc795')+rect(6,25,4,4,'#edc795')+rect(140,7,3,26,'#628c76');
 if(k==='redstone')p+=path('M127 30v-7h7v-8h16v3h-12v8h-7v4Z','#ee825d')+rect(4,28,18,3,'#dfba70');
 if(k==='lapis')p+=rect(12,11,131,20,'#e9e5cc')+rect(7,7,7,29,'#304c76');
 if(k==='rail')for(let x=20;x<150;x+=15)p+=rect(x,9,1,20,'#61705b');
 if(k==='diamond')p+=path('M3 9h4V5h14v3H9v22H5v-4H3Z','#8cd6ce')+rect(146,11,4,18,'#97ded2');
 if(k==='amethyst')p+=rect(3,10,5,17,'#bea4df')+rect(10,6,4,10,'#9778b9')+rect(142,27,9,3,'#c5b5d3');
 if(k==='obsidian')p+=rect(12,5,31,3,'#a78abc')+rect(121,31,29,3,'#786191');
 return svg(p,156,40);
}
export function themeArt(id) {
 const k=id.replace('web-theme-','');let p='';
 if(k==='backpack'){
  p=rect(9,4,78,56,'#535c4c')+rect(11,6,74,52,'#cecec2')+rect(15,10,66,6,'#eeeee2');
  for(let y=0;y<2;y++)for(let x=0;x<5;x++)p+=rect(15+x*13,21+y*14,11,11,'#7c8571')+rect(16+x*13,22+y*14,9,9,'#aeb8a1');
  p+=rect(18,24,5,5,'#60904a')+rect(44,38,5,5,'#a47b48')+rect(62,51,19,4,'#526c41');
 }else if(k==='oak'){
  p=rect(8,9,80,49,'#7a5737')+rect(11,6,35,47,'#eee1bc')+rect(48,6,35,47,'#faf2d8')+rect(45,9,3,44,'#b4986b')+rect(68,4,6,15,'#627942');
  for(let y=0;y<4;y++)p+=rect(16,15+y*8,23,2,'#a88c63')+rect(53,15+y*8,22,2,'#c0ad87');
  p+=rect(62,40,14,8,'#627942');
 }else if(k==='redstone'){
  p=rect(5,6,86,53,'#93b39d')+rect(7,8,82,49,'#263a31')+rect(11,12,73,8,'#141f1b')+rect(14,14,4,4,'#dc8b61')+rect(22,14,21,3,'#b4d1b0');
  p+=path('M23 29h43v2H49v13H23v-2h24V31H23Z','#779782');
  for(const [x,y] of [[12,25],[64,25],[12,38],[64,38]])p+=rect(x,y,19,11,'#6b8b77')+rect(x+2,y+2,15,7,'#1c2c24');
  p+=rect(75,52,9,2,'#dc8b61');
 }else if(k==='end'){
  p=path('M12 5h68v6h7v42h-7v6H12v-6H5V11h7Z','#594568')+rect(10,10,71,43,'#221c30')+rect(15,16,4,30,'#b798d4')+rect(24,15,51,7,'#443451');
  p+=path('M30 29h30v4h7v11h-7v4H30v-4h-7V33h7Z','#816798')+rect(31,34,26,2,'#d3bce7')+rect(31,40,17,2,'#b3a0ca')+rect(73,7,7,3,'#d7bee8');
 }else if(k==='desktop95'){
  p=rect(3,4,89,56,'#365f63')+rect(10,9,76,47,'#272a29')+rect(11,10,74,45,'#c2c2ba')+rect(13,12,70,9,'#253675')+rect(74,14,6,5,'#dddcd2')+rect(16,14,23,3,'#fff');
  p+=rect(16,26,46,21,'#777b73')+rect(17,27,45,20,'#fffdf3')+rect(66,26,14,8,'#efeee2')+rect(66,39,14,8,'#92978b')+rect(12,50,70,3,'#8a8e84');
 }else if(k==='macintosh'){
  p=rect(4,4,88,56,'#a7a79b');for(let y=5;y<60;y+=3)for(let x=5;x<92;x+=3)p+=rect(x,y,1,1,'#efeee2');
  p+=rect(10,8,75,48,'#181a17')+rect(11,9,73,46,'#fffef2');for(let y=11;y<19;y+=2)p+=rect(14,y,66,1,'#20221d');
  p+=rect(17,11,7,7,'#fffef2')+rect(18,12,5,5,'#20221d')+rect(34,10,30,9,'#fffef2')+rect(39,14,21,2,'#20221d')+rect(11,21,73,1,'#20221d');
  p+=path('M20 28h14v17H20Z','#20221d')+rect(21,29,12,15,'#fffef2')+rect(24,34,2,2,'#20221d')+rect(29,34,2,2,'#20221d')+rect(25,39,5,1,'#20221d')+rect(42,29,30,3,'#20221d')+rect(42,37,24,2,'#76796c')+rect(42,44,29,2,'#76796c');
 }
 return svg(p);
}
export function webArt(i) {
 if(i.slot==='cursor')return cursorProductArt(i.id);
 if(i.slot==='icon')return badgeArt(i.id);
 if(i.slot==='title')return titleArt(i.id).replace('</svg>', '<text x="78" y="25" text-anchor="middle" font-family="sans-serif" font-weight="700" font-size="11" fill="'+titleInk(i.id)+'">'+i.titleText+'</text></svg>');
 if(i.slot==='theme')return themeArt(i.id);
 if(i.slot==='shareCard') {
   const key=i.id.replace('web-card-',''),bg=key==='end'?'#30283e':key==='redstone'?'#3c4941':key==='oak'?'#dbbf87':'#c7cebf';
   return svg(rect(24,3,49,59,bg)+rect(29,9,38,6,'#f0e9cf')+rect(29,20,38,22,'#91ad75')+path('M35 35 48 27 61 34 49 40Z','#b7d18b')+rect(29,46,22,3,'#f0e9cf')+rect(29,52,22,3,'#a3b28a')+rect(56,47,11,11,'#f8f4e6')+rect(58,49,3,3,'#405043')+rect(63,54,2,2,'#405043'));
 }
 if(i.slot==='shareFx')return svg(i.id.endsWith('stamp')?rect(28,10,40,42,'#678858')+rect(32,14,32,34,'#e3e8c9')+path('M37 31h5v5h5V25h5v-6h5v18h-5v5H42v-5h-5Z','#678858'):path('M20 18h34v4H24v25h40V31h4v20H20Z','#8d79a6')+path('M54 10h22v23H54Z','#c5b5d9')+rect(59,15,12,13,'#f2e5f7')+rect(13,12,4,4,'#8d79a6')+rect(72,44,5,5,'#8d79a6'));
 let p='';
 if(i.id.endsWith('paper'))p=path('M8 13h72v9h9v31H8Z','#8d704b')+path('M10 15h68v10h9v26H10Z','#faf0d7')+path('M78 15v10h9Z','#d1b987')+rect(16,24,13,16,'#d6c499');
 if(i.id.endsWith('stone'))p=path('M11 13h72v5h5v30h-5v5H11v-5H6V18h5Z','#72806b')+rect(11,18,72,29,'#d6ddcc')+rect(11,18,72,2,'#f5f5e7')+rect(12,46,70,3,'#9eaa91')+rect(16,24,13,16,'#afbaa0');
 if(i.id.endsWith('signal'))p=rect(7,14,82,37,'#92ab96')+rect(9,16,78,33,'#263c31')+rect(13,20,65,2,'#5b7963')+rect(16,26,13,15,'#43664f')+rect(78,39,4,4,'#a0cf85');
 if(i.id.endsWith('crystal'))p=path('M12 13h67v5h8v28h-8v5H12v-5H6V18h6Z','#ae95c1')+rect(11,18,70,28,'#eee4f5')+rect(16,24,13,16,'#d0bddf')+rect(7,19,3,18,'#745489')+rect(74,46,6,3,'#745489');
 const ink=i.id.endsWith('signal')?'#e7f2de':'#3e4336';
 p+=rect(19,28,2,2,ink)+rect(25,28,2,2,ink)+rect(21,34,4,1,ink)+rect(35,27,37,3,ink)+rect(35,35,27,2,ink);
 return svg(p);
}
const dataCache=new Map();
export function artURL(value) {if(!dataCache.has(value))dataCache.set(value,'data:image/svg+xml,'+encodeURIComponent(value));return dataCache.get(value);}

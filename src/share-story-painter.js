import {CARD_STYLES,paintMemento} from './share-card-painter.js';
import {RELEASE_NAME} from './release.js';
import {noticeFace} from './notice-face.js';

const FONT='"PingFang SC", "Microsoft YaHei", sans-serif';
function label(c,v,x,y,size,color,width=940,weight=600){c.fillStyle=color;c.font=`${weight} ${size}px ${FONT}`;const text=String(v);if(c.measureText(text).width>width)c.font=`${weight} ${size*width/c.measureText(text).width}px ${FONT}`;c.fillText(text,x,y);}
function rule(c,x,y,w,color,dashed=false){c.strokeStyle=color;c.lineWidth=2;c.setLineDash(dashed?[8,9]:[]);c.beginPath();c.moveTo(x,y);c.lineTo(x+w,y);c.stroke();c.setLineDash([]);}
function wrapped(c,v,x,y,w,size,color){c.font=`500 ${size}px ${FONT}`;let row='',line=y;for(const char of v){if(c.measureText(row+char).width>w){label(c,row,x,line,size,color,w,500);row='';line+=size*1.55;}row+=char;}if(row)label(c,row,x,line,size,color,w,500);return line+size*1.55;}
function emerald(c,x,y,s,color){c.fillStyle=color;for(const [dx,dy,w,h]of[[2,0,4,1],[1,1,6,1],[0,2,8,4],[1,6,6,1],[2,7,4,1]])c.fillRect(x+dx*s,y+dy*s,w*s,h*s);c.fillStyle='#ffffff55';c.fillRect(x+2*s,y+s,s,4*s);}
async function face(c,expression,x,y,size,color,bow=false){const img=new Image();const loaded=new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(Error('表情图片未能读取'));});img.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(noticeFace(expression,bow?'date-bow':null).replace('<svg ','<svg xmlns="http://www.w3.org/2000/svg" style="color:'+color+'" '));await loaded;c.imageSmoothingEnabled=false;c.drawImage(img,x,y,size,size*(bow?1.25:1));c.imageSmoothingEnabled=true;}
const defaults={receipt:{paper:'#dedfc8',ink:'#304538',color:'#687f45',muted:'#727966'},passport:{paper:'#354f43',ink:'#f3edcf',color:'#dfbc70',muted:'#bac9aa'},profile:{paper:'#f0cf72',ink:'#293f39',color:'#305d49',muted:'#686347'},moment:{paper:'#b9cbaa',ink:'#294939',color:'#406748',muted:'#637a59'}};
export async function paintShareStory({kind='receipt',data,content,style='',momentId}){
 if(kind==='world')return paintMemento({...content,style});
 if(!defaults[kind])throw Error('没有这种分享卡');
 const t=style?(CARD_STYLES.find(t=>t.id===style)||defaults[kind]):defaults[kind];
 const canvas=document.createElement('canvas');canvas.width=1440;canvas.height=1920;const c=canvas.getContext('2d');if(!c)throw Error('当前设备暂时无法生成图片。');c.scale(4/3,4/3);c.fillStyle=t.paper;c.fillRect(0,0,1080,1440);
 let title;
 if(kind==='receipt'){
  title='这局没白点';
  // A perforated receipt, not another screenshot with four counters below it.
  c.fillStyle=t.ink;c.fillRect(100,55,880,27);c.fillStyle=style?t.paper:'#faf8ed';c.fillRect(124,75,832,1230);
  c.beginPath();c.moveTo(124,1305);for(let x=124;x<956;x+=26){c.lineTo(x+13,1320);c.lineTo(x+26,1305);}c.lineTo(956,1270);c.lineTo(124,1270);c.fill();
  label(c,'草方块 · 营业小票',174,153,24,t.muted,750);label(c,title,174,243,66,t.ink,710,850);label(c,'本来只想点两下。',178,294,25,t.muted);
  rule(c,174,331,732,t.muted,true);label(c,'本局累计进账',174,385,23,t.muted);emerald(c,178,415,6,t.color);label(c,data.total,248,485,73,t.ink,654,800);label(c,'绿宝石',178,529,20,t.muted);
  const rows=[['前台游玩',data.play],['采集次数',data.clicks+' 次'],['已解锁项目',data.unlocked+' / '+data.catalog],['居民 / 住宅',data.residents+' 位 / '+data.homes+' 座'],['设施改造',data.modifications+' 次'],['完成订单',data.orders+' 单']];
  rows.forEach(([k,v],i)=>{const y=611+i*68;label(c,k,178,y,25,t.muted,325,500);c.textAlign='right';label(c,v,900,y,27,t.ink,400,750);c.textAlign='left';});
  rule(c,174,995,732,t.muted,true);label(c,'当前余额',178,1050,24,t.muted);c.textAlign='right';label(c,data.wallet+' ◆',900,1050,36,t.ink,520,800);c.textAlign='left';
  label(c,'以上均为本局记录 · 累计进账不扣除花费',178,1102,18,t.muted,730,500);
  for(let i=0;i<72;i++){c.fillStyle=t.ink;c.fillRect(196+i*9.5,1143,i%3===0?5:2,i%7===0?52:45);}label(c,'世界还在营业。',375,1247,26,t.ink,500);
 }else if(kind==='passport'){
  title='冒险护照';
  label(c,'MC CLICKER / 我的旅程',64,87,21,t.muted,720);label(c,title,62,192,88,t.ink,720,850);
  label(c,'世界很大，慢慢盖。',66,252,27,t.muted,720,500);
  c.textAlign='right';label(c,data.worlds.filter(r=>r.reached).length+' / 3',1011,178,74,t.color,280,800);label(c,'世界已开启',1008,222,19,t.muted,280,500);c.textAlign='left';
  // Open, stitched travel book. The three game landmarks are the illustration.
  c.fillStyle='#182f2c55';c.fillRect(60,337,978,855);c.fillStyle='#e1d9bd';c.fillRect(46,318,988,848);
  c.fillStyle='#faf5e6';c.fillRect(54,308,480,844);c.fillStyle='#f2ecd8';c.fillRect(546,308,480,844);
  c.fillStyle='#cec4a255';c.fillRect(518,308,16,844);c.fillRect(546,308,13,844);
  for(let y=335;y<1130;y+=25){c.fillStyle='#6d785d';c.fillRect(538,y,4,10);}
  const ink='#394d40',muted='#848671';label(c,'01 / 第一块草皮',90,369,18,muted,415);label(c,'02 / 远方的世界',588,369,18,muted,400);
  const spots=[{x:94,y:415,w:290,h:213,cx:345,cy:621,angle:-.12,id:'V1',ink:'#4b7052'},{x:88,y:806,w:298,h:209,cx:354,cy:1006,angle:.09,id:'N1',ink:'#a2634c'},{x:621,y:523,w:320,h:285,cx:790,cy:871,angle:-.08,id:'E2',ink:'#786287'}];
  for(let i=0;i<spots.length;i++){
   const p=spots[i],r=data.worlds[i];const img=new Image();const loaded=new Promise((res,rej)=>{img.onload=res;img.onerror=()=>rej(Error('旅行图案未能读取'));});img.src=import.meta.env.BASE_URL+'icons/'+p.id+'.png';await loaded;
   c.save();c.globalAlpha=r.reached?1:.3;const scale=Math.min(p.w/img.width,p.h/img.height);c.drawImage(img,p.x+(p.w-img.width*scale)/2,p.y+(p.h-img.height*scale)/2,img.width*scale,img.height*scale);c.restore();
   c.save();c.translate(p.cx,p.cy);c.rotate(p.angle);c.strokeStyle=r.reached?p.ink:'#b4ad95';c.lineWidth=3;c.setLineDash(r.reached?[]:[6,7]);c.strokeRect(-117,-64,234,128);c.setLineDash([]);if(r.reached){c.lineWidth=1;c.strokeRect(-109,-56,218,112);}c.textAlign='center';label(c,r.name,0,-12,34,r.reached?p.ink:muted,215,800);label(c,r.reached?'已开启 ✓':'待出发',0,35,23,r.reached?p.ink:muted,215,600);c.textAlign='left';c.restore();
   if(i<2){label(c,r.reached?r.lands+' 片土地':'尚未开启',105,i===0?711:1113,21,muted,400,500);}else{label(c,r.reached?r.lands+' 片土地':'给下一次出发，留一页空白。',598,1021,21,muted,390,500);}
  }
  rule(c,90,756,412,'#d8d0b7',true);label(c,'再走远一点。',604,437,27,ink,382,650);
  label(c,'已经走了 '+data.play,65,1252,27,t.ink,950,650);label(c,'按本局已开启的世界盖章',65,1301,19,t.muted,950,500);
 }else if(kind==='profile'){
  title=data.profile.title;label(c,'本局经营名片',62,86,25,t.muted);label(c,'你是哪种村长？',62,167,62,t.ink,960,850);
  c.fillStyle=t.ink;c.fillRect(58,221,964,492);label(c,title,96,319,66,t.paper,850,850);await face(c,'smirk',110,366,226,t.paper);label(c,'MC',757,463,105,t.paper,210,900);label(c,'CLICKER',696,513,31,t.paper,260,850);label(c,data.profile.quip,96,664,28,t.paper,875,600);
  label(c,'钱是怎么来的',62,778,30,t.ink,960,800);label(c,'本局累计进账构成',745,778,19,t.muted,280,500);
  const colors=[t.ink,t.color,'#b86742','#8c714f','#918989'];
  data.income.forEach((r,i)=>{const y=837+i*70;label(c,r.name,64,y,23,t.ink,215);c.fillStyle=t.muted+'25';c.fillRect(294,y-20,555,18);c.fillStyle=colors[i];c.fillRect(294,y-20,555*r.fraction,18);label(c,`${Math.round(r.fraction*100)}%`,882,y,25,t.ink,160,750);});
  label(c,data.profile.basis,64,1235,23,t.ink,950);label(c,'仅按这局的收入记录侧写，换个玩法就可能换个称号。',64,1284,18,t.muted,950,500);
 }else{
  const moment=data.moments.find(m=>m.id===momentId)||data.moments[0];title=moment.title;
  label(c,'本局名场面',64,90,26,t.ink,800,750);label(c,'通知出品 / 仅此一局',64,133,18,t.muted);
  // Original in-game paper narrator, enlarged into an illustrated dialogue card.
  await face(c,moment.face==='bow'?'smirk':moment.face,365,193,350,t.ink,moment.face==='bow');
  c.fillStyle=t.ink;c.fillRect(62,675,956,475);c.beginPath();c.moveTo(465,675);c.lineTo(501,637);c.lineTo(501,675);c.fill();
  label(c,title,98,755,46,t.paper,880,850);let y=837;for(const text of moment.lines)y=wrapped(c,text,100,y,872,32,t.paper)+23;
  label(c,moment.evidence,64,1222,26,t.ink,955,650);label(c,'这段插曲，留个纪念。',64,1272,23,t.muted,950,500);
 }
 rule(c,64,1351,952,t.muted);label(c,'MC Clicker',64,1402,28,t.ink,510,850);c.textAlign='right';label(c,RELEASE_NAME,1016,1402,16,t.muted,475,500);c.textAlign='left';
 const blob=await new Promise(r=>canvas.toBlob(r,'image/png'));if(!blob)throw Error('图片未能生成');
 return {canvas,blob,file:new File([blob],`MC-Clicker-${kind}.png`,{type:'image/png'}),label:title,style,kind};
}

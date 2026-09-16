import {group,cube,blockBox} from './models.js';
export function observatory(parent,state) {
 const g=group(parent);g.userData.facility='observatory';
 const stone=(x,y,z,w,h,d)=>blockBox(g,'stone','#a3ad99',x,y,z,w,h,d);
 const metal=(x,y,z,w,h,d)=>blockBox(g,'iron','#b58258',x,y,z,w,h,d);
 stone(0,.06,0,1.24,.12,1.24);stone(0,.14,0,1.04,.04,1.04);
 metal(-.1,.39,.05,.12,.46,.12);metal(-.1,.6,.05,.42,.09,.28);
 const telescope=group(g,-.08,.77,.05);telescope.rotation.z=-.48;
 blockBox(telescope,'iron','#556e62',0,0,0,.62,.22,.22);
 cube(telescope,'#98bbaf',.32,0,0,.045,.18,.18);cube(telescope,'#273e3a',-.35,0,0,.09,.14,.14);
 const m=state.environment?.modules||{};
 if(m['env-sundial']) {metal(-.34,.19,.37,.3,.05,.3);for(let i=0;i<4;i++)cube(g,'#584c36',-.41+i*.055,.225,.37,.02,.015,.16);cube(g,'#e3ca87',-.35,.28,.4,.04,.12,.04);}
 if(m['env-weather']) {metal(.45,.54,.28,.045,.75,.045);metal(.42,.93,.28,.3,.05,.055);cube(g,'#d2d3aa',.35,.97,.28,.09,.1,.055);}
 if(m['env-rain']) {metal(-.44,.31,-.25,.16,.28,.16);cube(g,'#435f5e',-.44,.46,-.25,.2,.04,.2);cube(g,'#7baec1',-.44,.325,-.159,.07,.22,.015);}
 if(m['env-snow']) {stone(.31,.31,-.36,.27,.3,.24);cube(g,'#b8d7d9',.31,.477,-.36,.3,.04,.26);cube(g,'#6fabb3',.31,.32,-.23,.1,.12,.015);}
 if(m['env-stars']) {cube(telescope,'#b79acb',-.38,0,0,.04,.2,.2);metal(.16,.18,.35,.21,.04,.27);cube(g,'#eee2b7',.16,.208,.35,.18,.016,.24);cube(g,'#937cba',.14,.22,.36,.04,.012,.08);}
 return g;
}

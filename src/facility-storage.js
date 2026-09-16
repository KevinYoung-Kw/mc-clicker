// Ownership stays intact. Only simulation reads the inactive facility mask.
// Never store runtime proxies in a save or change counts to pretend an item was sold.
import {CATALOG} from './catalog.js';
export const STORABLE_FACILITIES = new Set(CATALOG.filter(i=>i.place&&i.id!=='V1').map(i=>i.id));
const originals=new WeakMap();
export const ownershipState=s=>originals.get(s)||s;
export function facilityMembers(id){
 return id==='V7'?['V7','V8','V9','V10']:id==='L2'?Array.from({length:14},(_,i)=>`L${i+1}`):[id];
}
export const facilityStored=(s,id)=>STORABLE_FACILITIES.has(id)&&s.facilityStorage?.[id]===true;
export const facilityInactive=(s,id)=>facilityStored(s,id)||(['V8','V9','V10'].includes(id)&&facilityStored(s,'V7'))||(/^L(?:[1-9]|1[0-4])$/.test(id)&&facilityStored(s,'L2'));
export const activeLevel=(state,id)=>{const s=ownershipState(state);return facilityInactive(s,id)?0:s.counts?.[id]||0;};
const views=new WeakMap();
export function operatingState(s){
 if(!s.facilityStorage||!Object.values(s.facilityStorage).some(Boolean))return s;
 if(views.has(s))return views.get(s);
 const counts=new Proxy({}, {get:(_,key)=>activeLevel(s,key),ownKeys:()=>Reflect.ownKeys(s.counts),getOwnPropertyDescriptor:()=>({enumerable:true,configurable:true})});
 const view=new Proxy(s,{get:(target,key)=>key==='counts'?counts:Reflect.get(target,key)});
 views.set(s,view);views.set(view,view);originals.set(view,s);return view;
}
export function restoreFacilityStorage(s,raw){
 s.facilityStorage={};
 for(const id of STORABLE_FACILITIES)if(raw?.[id]===true&&s.counts[id])s.facilityStorage[id]=true;
}

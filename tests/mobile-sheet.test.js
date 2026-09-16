import test from "node:test";
import assert from "node:assert/strict";
import { sheetSwipe, bindMobileSheet } from "../src/mobile-sheet.js";

test("sheet gestures require deliberate vertical movement, never a tap or sideways drag", () => {
  const start = { x: 150, y: 310 };
  assert.equal(sheetSwipe(start, { x: 156, y: 245 }), true);
  assert.equal(sheetSwipe(start, { x: 153, y: 390 }), false);
  assert.equal(sheetSwipe(start, { x: 154, y: 300 }), null);
  assert.equal(sheetSwipe(start, { x: 250, y: 265 }), null);
  assert.equal(sheetSwipe(start, start), null);
});

test('sheet binding closes one step at a time, ignores click after drag, and protects placement/multitouch',()=>{
 class Node {
  constructor(){this.attrs={};this.dataset={};this.listeners={};this.classes=new Set();this.classList={contains:k=>this.classes.has(k),toggle:(k,v)=>v?this.classes.add(k):this.classes.delete(k)};}
  addEventListener(k,fn){(this.listeners[k]||=[]).push(fn)}
  emit(type,props={}){for(const fn of this.listeners[type]||[])fn({target:this,currentTarget:this,button:0,isPrimary:true,pointerId:1,clientX:100,clientY:200,...props});}
  setAttribute(k,v){this.attrs[k]=v}getAttribute(k){return this.attrs[k]}
  setPointerCapture(id){this.capture=id}hasPointerCapture(id){return this.capture===id}releasePointerCapture(){this.capture=null}
  getBoundingClientRect(){return {y:0}}closest(){return null}
 }
 const game=new Node(),panel=new Node(),grip=new Node(),toggle=new Node(),header=new Node(),stage=new Node(),media=new Node();media.matches=true;
 panel.querySelector=q=>({'.drawer-handle':grip,'#panel-expand':toggle,'.panel-header':header}[q]);game.querySelector=()=>stage;
 const oldMedia=globalThis.matchMedia,oldHeight=globalThis.innerHeight;
 globalThis.matchMedia=()=>media;globalThis.innerHeight=844;
 try {
  let closed=0;const sheet=bindMobileSheet({game,panel,onClose:()=>{closed++;sheet.sync(null)}});
  const drag=(dy,dx=0)=>{grip.emit('pointerdown');grip.emit('pointerup',{clientX:100+dx,clientY:200+dy});};
  sheet.sync('village');drag(-70);assert.equal(stage.inert,true);
  grip.emit('click');assert.equal(stage.inert,true,'synthetic click must not undo swipe');
  drag(70);assert.equal(stage.inert,false);assert.equal(closed,0);
  drag(70);assert.equal(closed,1);assert.equal(stage.inert,false);grip.emit('click');assert.equal(closed,1);
  sheet.sync('build');drag(8,90);grip.emit('click');assert.equal(closed,1);assert.equal(stage.inert,false,'sideways drag must not become a click');
  game.classes.add('choosing-site');drag(70);drag(-70);assert.equal(closed,1);assert.equal(stage.inert,false);
  game.classes.delete('choosing-site');grip.emit('pointerdown');panel.emit('pointerdown',{isPrimary:false,pointerId:2});grip.emit('pointerup',{clientY:300});assert.equal(closed,1);
  grip.emit('pointerdown');grip.emit('pointercancel');grip.emit('pointerup',{clientY:300});assert.equal(closed,1);
  grip.emit('pointerdown');sheet.sync('network');grip.emit('pointerup',{clientY:300});assert.equal(stage.inert,true,'old gesture cannot collapse the new panel');
  media.matches=false;media.emit('change');assert.equal(stage.inert,false);
 }finally{if(oldMedia)globalThis.matchMedia=oldMedia;else delete globalThis.matchMedia;if(oldHeight)globalThis.innerHeight=oldHeight;else delete globalThis.innerHeight;}
});

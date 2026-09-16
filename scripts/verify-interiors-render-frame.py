"""Re-run the real interior flow and record native canvas resize/draw timing.

This probe runs only in an isolated test browser; it never changes shipped game
code or a player's save. Historical screenshots/reports are preserved verbatim.
"""
import argparse
import importlib.util
import json
from pathlib import Path
import sys
from playwright.sync_api import Browser, Page

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'docs/qa'
parser=argparse.ArgumentParser()
parser.add_argument('--url',required=True)
args=parser.parse_args()
prefix='facility-style-public-render-frame'
probe={"url":args.url,"frames":[],"notes":[]}

PROBE_JS=r'''(()=>{
 const stamp=(canvas,event)=>{
  const p=canvas.__frameProbe||(canvas.__frameProbe={resizes:0,draws:0,lastResize:0,lastDraw:0,lastClear:0,history:[]});
  const t=performance.now();
  if(event==='resize'){p.resizes++;p.lastResize=t;}
  if(event==='draw'){p.draws++;if(p.lastDraw>=p.lastResize){p.lastDraw=t;return;}p.lastDraw=t;}
  if(event==='clear'){p.lastClear=t;return;}
  p.history.push({event,t,width:canvas.width,height:canvas.height,visible:document.visibilityState,focused:document.hasFocus()});
  if(p.history.length>35)p.history.shift();
 };
 for(const name of ['width','height']){
  const descriptor=Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype,name);
  Object.defineProperty(HTMLCanvasElement.prototype,name,{...descriptor,set(value){descriptor.set.call(this,value);stamp(this,'resize');}});
 }
 for(const Proto of [window.WebGLRenderingContext?.prototype,window.WebGL2RenderingContext?.prototype].filter(Boolean)){
  const bind=Proto.bindFramebuffer;
  Proto.bindFramebuffer=function(target,buffer){if(target===this.FRAMEBUFFER||target===this.DRAW_FRAMEBUFFER)this.__frameProbeTarget=buffer;return bind.apply(this,arguments);};
  for(const name of ['drawArrays','drawElements','drawArraysInstanced','drawElementsInstanced']){
   const draw=Proto[name];if(!draw)continue;
   Proto[name]=function(){const result=draw.apply(this,arguments);if(!this.__frameProbeTarget)stamp(this.canvas,'draw');return result;};
  }
  const clear=Proto.clear;
  Proto.clear=function(){const result=clear.apply(this,arguments);if(!this.__frameProbeTarget)stamp(this.canvas,'clear');return result;};
 }
 window.__focusProbe=[];
 for(const event of ['focus','blur','visibilitychange'])window.addEventListener(event,()=>window.__focusProbe.push({event,t:performance.now(),visibility:document.visibilityState,focused:document.hasFocus()}));
 window.readFrameProbe=()=>{
  const c=document.querySelector('#world canvas'),p=c?.__frameProbe;
  return {now:performance.now(),visibility:document.visibilityState,focused:document.hasFocus(),paused:!document.querySelector('#foreground-status')?.hidden,canvas:c?{width:c.width,height:c.height,css:c.getBoundingClientRect().toJSON(),...p}:null,events:window.__focusProbe};
 };
})();'''

context_original=Browser.new_context
screenshot_original=Page.screenshot

def context_with_probe(self,*a,**kw):
    context=context_original(self,*a,**kw)
    context.add_init_script(PROBE_JS)
    return context

def screenshot_after_draw(self,*a,**kw):
    name=Path(kw.get('path','screen.png')).name
    entry={"name":name,"before":self.evaluate('readFrameProbe()')}
    if 'decorated' in name:
        raw=dict(kw);raw['path']=str(OUT/f'{prefix}-decorated-immediate.png')
        screenshot_original(self,*a,**raw)
        entry['afterImmediateScreenshot']=self.evaluate('readFrameProbe()')
    self.wait_for_function('''()=>{
      const c=document.querySelector('#world canvas'),p=c?.__frameProbe;
      return document.visibilityState==='visible' && document.hasFocus() && p && p.lastDraw>p.lastResize && performance.now()-p.lastResize>50;
    }''',timeout=8000)
    # Capture after a paint opportunity following the observed native draw.
    self.evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))')
    entry['ready']=self.evaluate('readFrameProbe()')
    copy=dict(kw);copy['path']=str(OUT/f'{prefix}-{name}')
    result=screenshot_original(self,*a,**copy)
    entry['afterScreenshot']=self.evaluate('readFrameProbe()')
    probe['frames'].append(entry)
    return result

Browser.new_context=context_with_probe
Page.screenshot=screenshot_after_draw
snapshot={p:p.read_bytes() for p in OUT.glob('interiors-release-*') if p.is_file()}
spec=importlib.util.spec_from_file_location('interiors_release',ROOT/'scripts/verify-interiors-release.py')
module=importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
try:
    sys.argv=[str(ROOT/'scripts/verify-interiors-release.py'),'--url',args.url]
    module.main()
    original=OUT/'interiors-release-observations.json'
    probe['regression']=json.loads(original.read_text())
    probe['passed']=probe['regression']['passed']
finally:
    for p,data in snapshot.items():p.write_bytes(data)
    (OUT/f'{prefix}-observations.json').write_text(json.dumps(probe,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({"passed":probe.get('passed'),"frames":[{"name":f['name'],"before":{k:f['before'][k] for k in ['focused','visibility','paused']},"drawAfterResizeBefore":f['before']['canvas']['lastDraw']>f['before']['canvas']['lastResize'],"drawAfterResizeReady":f['ready']['canvas']['lastDraw']>f['ready']['canvas']['lastResize']}for f in probe['frames']]},ensure_ascii=False,indent=2))

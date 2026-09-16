"""Probe mailbox state-to-instance updates in an isolated development browser.

The actual object dispatcher, World animation loop and GPU uploads are exercised
with reduced motion enabled. Mail changes use real UI; only renderer inspection
uses mcDebug and a test-only WebGL buffer-upload observer.
"""
import argparse
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import traceback
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'docs/qa'
spec = importlib.util.spec_from_file_location('mail_qa', ROOT / 'scripts/verify-mail-release.py')
mail_qa = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mail_qa)

PROBE = r'''() => {
 const w=mcDebug.world, arrays=new Set(w.batch.map(b=>b.mesh.instanceMatrix.array));
 const gl=w.renderer.getContext(), original=gl.bufferSubData;
 const p=window.mailModelQA={uploads:0,values:0,gpuMismatches:0};
 gl.bufferSubData=function(target,offset,data,from=0,length){
  const result=original.apply(this,arguments);
  if(target===gl.ARRAY_BUFFER&&arrays.has(data)){
   const n=length??data.length-from, actual=new Float32Array(n);
   gl.getBufferSubData(target,offset,actual);p.uploads++;p.values+=n;
   for(let i=0;i<n;i++)if(actual[i]!==data[from+i])p.gpuMismatches++;
  }
  return result;
 };
 window.mailModelSnapshot=()=>{
  const w=mcDebug.world,anchor=w.roots.V18;let model;
  anchor.traverse(o=>{if(o.userData.facility==='mailbox')model=o;});
  const sources=new Set();model.traverse(o=>{if(o.isMesh)sources.add(o)});
  let cpuMismatches=0,instanceCount=0,dynamicCount=0,hiddenCount=0;
  for(const b of w.batch)for(let i=0;i<b.objects.length;i++){
   const o=b.objects[i];if(!sources.has(o))continue;instanceCount++;
   if(b.dynamicObjects.some(e=>e.o===o))dynamicCount++;
   let visible=true;for(let n=o;n;n=n.parent)visible&&=n.visible;
   if(!visible)hiddenCount++;
   const expected=visible?o.matrixWorld.elements:w.zeroMatrix.elements;
   for(let k=0;k<16;k++)if(b.mesh.instanceMatrix.array[i*16+k]!==Math.fround(expected[k]))cpuMismatches++;
  }
  const d=model.userData;
  return {graph:w.graph.uuid,model:model.uuid,reducedMotion:mcDebug.state.reducedMotion,
   state:{...d.mailboxState},flagAngle:d.mailboxFlag.rotation.x,
   letters:d.mailboxLetters.filter(o=>o.visible).length,
   bands:d.mailboxLevelBands.filter(o=>o.visible).length,seal:d.mailboxRewardSeal.visible,
   instanceCount,dynamicCount,hiddenCount,cpuMismatches,
   resources:{batches:w.batch.length,geometries:w.renderer.info.memory.geometries,
    textures:w.renderer.info.memory.textures,programs:w.renderer.info.programs.length},
   probe:{...p},glError:gl.getError()};
 };
}'''


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--url',default='http://127.0.0.1:8890/')
    args=parser.parse_args()
    seed=mail_qa.fixture()['state']
    code="""
      import {buy} from './src/game.js';
      const s=JSON.parse(process.argv[1]);const result=buy(s,'V18');
      if(!result.ok)throw Error(result.reason);console.log(JSON.stringify(s));
    """
    state=json.loads(subprocess.run(['node','--input-type=module','--eval',code,json.dumps(seed)],cwd=ROOT,capture_output=True,text=True,check=True).stdout)
    report={'url':args.url,'checks':{},'stages':{},'errors':[],
        'inspection':'Development-only renderer inspection; actual mailbox UI and World animation loop; reduced motion enabled',
        'passed':False}
    OUT.mkdir(parents=True,exist_ok=True)
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True,args=['--use-angle=metal'] if sys.platform=='darwin' else [])
        context=browser.new_context(viewport={'width':1440,'height':1000},accept_downloads=True)
        context.add_init_script(f"localStorage.setItem({json.dumps(mail_qa.SAVE_KEY)},{json.dumps(json.dumps(state))});")
        page=context.new_page();page.set_default_timeout(15000)
        page.on('pageerror',lambda error:report['errors'].append(str(error)))
        try:
            page.goto(args.url,wait_until='networkidle')
            page.wait_for_function('window.mcDebug?.world?.roots.V18')
            page.wait_for_timeout(500)
            page.evaluate(PROBE)
            def record(name,unread,ready,level):
                page.wait_for_function('''([unread,ready,level])=>{
                 const s=mailModelSnapshot();return s.state.unread===unread&&s.state.ready===ready&&s.state.level===level&&s.cpuMismatches===0;
                }''',arg=[unread,ready,level])
                snap=page.evaluate('mailModelSnapshot()')
                assert snap['reducedMotion'] is True
                assert snap['instanceCount']==29 and snap['dynamicCount']==29
                assert snap['letters']==min(3,unread)
                assert snap['seal'] is ready
                assert snap['bands']==level-1
                assert snap['flagAngle']==(0 if unread else 3.141592653589793/2)
                assert snap['cpuMismatches']==0 and snap['probe']['gpuMismatches']==0
                assert snap['glError']==0
                report['stages'][name]=snap
                return snap
            initial=record('initialUnread',2,False,1)
            mail_qa.open_mail(page,False)
            mail_qa.click(page,'[data-mail-open="welcome-wechat"]',False)
            record('firstRead',1,True,1)
            mail_qa.click(page,'[data-mail-back]',False)
            mail_qa.click(page,'[data-mail-open="welcome-xiaohongshu"]',False)
            record('bothRead',0,True,1)
            mail_qa.click(page,'[data-mail-back]',False)
            mail_qa.mail_tab(page,'postal',False)
            mail_qa.click(page,'[data-mail-upgrade]',False)
            record('postalUpgrade',0,True,2)
            mail_qa.mail_tab(page,'letters',False)
            for letter in mail_qa.LETTERS:
                mail_qa.click(page,f'[data-mail-open="{letter}"]',False)
                mail_qa.click(page,f'[data-mail-claim="{letter}"]',False)
                mail_qa.click(page,'[data-mail-back]',False)
            final=record('allClaimed',0,False,2)
            for stage in report['stages'].values():
                assert stage['graph']==initial['graph']
                assert stage['model']==initial['model']
                assert stage['resources']==initial['resources']
            assert final['probe']['uploads']>0 and final['probe']['values']>0
            report['checks']['realDispatcherCreates29DynamicMailboxInstances']=True
            report['checks']['unreadFlagLettersAndPendingSealFollowRealUiReadsAndClaims']=True
            report['checks']['postalUpgradeChangesExistingBandsWithReducedMotion']=True
            report['checks']['sourceTransformsAndVisibilityMatchInstanceMatrices']=True
            report['checks']['gpuUploadReadbacksMatchCpuInstanceArrays']=True
            report['checks']['allStagesKeepSameGraphModelAndGpuResourceCounts']=True
            page.screenshot(path=OUT/'mailbox-model-ui-state.png')
            assert not report['errors'],report['errors']
            report['passed']=True
        except Exception as error:
            report['failure']=str(error);report['traceback']=traceback.format_exc()
            page.screenshot(path=OUT/'mailbox-model-failure.png')
            raise
        finally:
            (OUT/'mailbox-model-observations.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
            context.close();browser.close()
    print(json.dumps({'passed':report['passed'],'checks':len(report['checks']),'gpu':report['stages']['allClaimed']['probe']}))


if __name__=='__main__':main()

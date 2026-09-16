"""Canvas layouts, unlocked moments, old no-content saves, victory cleanup and realm isolation."""
import json,base64
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1];out=root/'docs/v2.0.0/qa/alpha5-content';out.mkdir(parents=True,exist_ok=True)
seed=json.loads((root/'docs/v2.0.0/qa/alpha3/seed41/industrial-first-save.json').read_text());results=[]
with sync_playwright() as pw:
 b=pw.chromium.launch(headless=True,args=['--use-angle=metal']);p=b.new_page(viewport={'width':1080,'height':900});errors=[];p.on('pageerror',lambda e:errors.append(str(e)));p.goto('http://127.0.0.1:8975/scripts/qa-alpha5/probe.html',wait_until='networkidle')
 p.evaluate('''async s=>{const game=await import('/src/game.js');window.s=game.restore(s);window.fresh=game.fresh;window.data=(await import('/src/share-stories.js')).shareStoryData;window.paint=(await import('/src/share-story-painter.js')).paintShareStory;window.styles=(await import('/src/share-card-painter.js')).CARD_STYLES;window.victory=(await import('/src/victory-card.js')).captureVictoryCard;await probe.setup(s);window.content={shots:[probe.world.captureCurrentScene()],label:'主世界',statistics:[]};}''',seed)
 for kind in ['receipt','world','passport','profile','moment']:
  for style in ['','web-card-worklog','web-card-oak','web-card-redstone','web-card-end']:
   r=p.evaluate('''async o=>{const before=JSON.stringify(s);const card=await paint({...o,data:data(s),content});return {width:card.canvas.width,height:card.canvas.height,unchanged:JSON.stringify(s)===before,size:card.blob.size};}''',{'kind':kind,'style':style});assert r['width']==1440 and r['height']==1920 and r['unchanged'];results.append({'kind':kind,'style':style,**r})
 for key in ['community-cash','community-hold','community-tree','community-mansion','community-overtime','community-pond','community-stage']:
  url=p.evaluate('''async id=>{const copy=structuredClone(s);copy.narrative.seen.push(id);return (await paint({kind:'moment',data:data(copy),momentId:id})).canvas.toDataURL();}''',key);(out/(key+'.png')).write_bytes(base64.b64decode(url.split(',')[1]))
 p.evaluate('''async()=>{for(const kind of ['receipt','passport','profile','moment'])await paint({kind,data:data(fresh())});}''')
 # Real capture helper, isolated supplied world snapshot. This is layout QA, not a claimed gameplay completion.
 p.evaluate('''async()=>{window.v=await victory({snapshot:s,historical:false,label:'三世界排版验证'});if(document.querySelector('[data-victory-renderer]'))throw Error('renderer leaked');}''')
 for style in ['','web-card-worklog','web-card-oak','web-card-redstone','web-card-end']:
  url=p.evaluate('async style=>(await paint({kind:"world",content:v,style})).canvas.toDataURL()',style);(out/('victory-'+(style or 'default')+'.png')).write_bytes(base64.b64decode(url.split(',')[1]))
 p.evaluate('''async()=>{let calls=0;try{await victory({snapshot:s,label:'cancel'},{cancelled:()=>++calls>2});throw Error('not cancelled');}catch(e){if(e.name!=='AbortError')throw e;}if(document.querySelector('[data-victory-renderer]'))throw Error('renderer leaked on cancellation');}''')
 # A painted main-world cell must never tint the other realms, including after a view switch.
 for realm in ['nether','end']:
  equal=p.evaluate('''realm=>{const w=probe.world;w.setStudio(false);w.setView(realm);w.setMode(null);w.state.garden.terrain={};w.signature='';w.sync(w.state);const a=probe.shot();w.state.garden.terrain={'0,0':'water','1,0':'water','0,1':'water'};w.state.layoutRevision++;w.signature='';w.sync(w.state);const b=probe.shot();return a===b;}''',realm);assert equal,realm
 assert not errors,errors;(out/'report.json').write_text(json.dumps({'matrix':results,'earlyCards':True,'unlockedMoments':7,'threeWorldVictoryStyles':5,'cancelDisposesRenderer':True,'waterRealmIsolation':True,'errors':errors},ensure_ascii=False,indent=2));b.close();print('25 content/skin combinations, early cards, 7 moments, victory and water isolation passed')

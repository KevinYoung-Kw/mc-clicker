import json
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=['--use-angle=metal'] if sys.platform == 'darwin' else [])
    page = browser.new_page(viewport={'width': 1440, 'height': 960})
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto('http://127.0.0.1:8890/')
    page.wait_for_load_state('networkidle')
    page.evaluate("async()=>{const {completeFixture}=await import('/scripts/fixtures.mjs');mcDebug.setState(completeFixture());}")
    page.locator('[data-nav=world]').click()
    floors = {}
    for realm in ['overworld', 'nether', 'end']:
        page.locator('[data-realm=' + realm + ']').click()
        page.wait_for_timeout(300)
        floors[realm] = page.evaluate("""async()=>{
          const T=await import('/node_modules/three/build/three.module.js');
          const {ITEMS}=await import('/src/catalog.js');
          // Flying, floating and jumping creatures deliberately animate above the ground.
          const creatures=new Set(['actor','blaze','magma','ghast','skeleton','wither','enderman','shulker','dragon']);
          return Object.fromEntries(Object.entries(mcDebug.world.roots).filter(([id])=>!creatures.has(ITEMS[id].model)).map(([id,o])=>[id,new T.Box3().setFromObject(o).min.y]));
        }""")
        assert all(abs(y - .16) < .03 for y in floors[realm].values()), floors[realm]
    page.locator('[data-realm=overworld]').click()
    project = page.evaluate("""async()=>{
      const T=await import('/node_modules/three/build/three.module.js'),w=mcDebug.world;
      return [0,90000,180000].map(progress=>{mcDebug.state.project=progress;w.update(true);return {progress,floor:new T.Box3().setFromObject(w.roots.Z2).min.y};});
    }""")
    assert all(abs(item['floor'] - .16) < .001 for item in project), project
    assert not errors, errors
    result = {'floors': floors, 'projectGrowth': project, 'errors': errors}
    Path('docs/qa/grounding-observations.json').write_text(json.dumps(result, indent=2))
    print(json.dumps({'models': sum(len(v) for v in floors.values()), 'grounded': True, 'projectGrowthGrounded': True}))
    browser.close()

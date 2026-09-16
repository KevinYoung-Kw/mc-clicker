from pathlib import Path
import base64
import json
import sys
import argparse
from playwright.sync_api import sync_playwright

parser = argparse.ArgumentParser(description='Render catalogue model icons; omit --ids for the full set.')
parser.add_argument('--ids', nargs='+')
args = parser.parse_args()
ROOT = Path(__file__).resolve().parents[1]
out = ROOT / 'public/icons'
out.mkdir(parents=True, exist_ok=True)
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=['--use-angle=metal'] if sys.platform == 'darwin' else [])
    try:
        page = browser.new_page()
        page.goto('http://127.0.0.1:8890/scripts/icon-studio.html', wait_until='networkidle')
        page.wait_for_function('window.renderIcon && window.iconIds')
        ids = page.evaluate('window.iconIds')
        selected = args.ids or ids
        if any(item not in ids for item in selected):
            raise ValueError('Unknown model icon ID')
        for item in selected:
            data = page.evaluate('(id)=>renderIcon(id)', item)
            (out / f'{item}.png').write_bytes(base64.b64decode(data.split(',')[1]))
        (out / 'manifest.json').write_text(json.dumps({
            'source': 'Original MC Clicker 3D models', 'ids': ids, 'size': 192,
            'revision': 'network-v14',
        }, indent=2) + '\n')
    finally:
        browser.close()
print(f'Rendered {len(selected)} model icons; catalogue contains {len(ids)}')

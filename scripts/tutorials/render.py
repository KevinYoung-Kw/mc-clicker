"""Assemble real screenshots with one crop/scale/callout system for every lesson.
Run: uv run --with playwright --with pillow scripts/tutorials/render.py
"""
import json
from pathlib import Path
from playwright.sync_api import sync_playwright
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
qa = ROOT / 'docs/v1.7/qa/tutorials'
assets = ROOT / 'src/assets/tutorials'
m = json.loads((qa / 'source/manifest.json').read_text())
W, H = 640, 416
UI_SCALE = 1.4  # A 44px game button is always 61.6px in the teaching canvas.


def shot(name, x, y, crop=None, scale=UI_SCALE, mark=False):
    d = m[name]
    cx, cy, w, h = crop or (0, 0, d['width'], d['height'])
    assert cx >= 0 and cy >= 0 and cx+w <= d['width']+.1 and cy+h <= d['height']+.1, (name, crop)
    t = d.get('target')
    ring = ''
    if mark:
        t = t or {'x': cx, 'y': cy, 'width': w, 'height': h}
        assert cx <= t['x']+.01 and cy <= t['y']+.01 and t['x']+t['width'] <= cx+w+.1 and t['y']+t['height'] <= cy+h+.1, (name, 'clipped target')
        ring = f'<span class="ring" style="left:{(t["x"]-cx)*scale}px;top:{(t["y"]-cy)*scale}px;width:{t["width"]*scale}px;height:{t["height"]*scale}px"></span>'
    return f'<div class="shot" data-source="{name}" style="left:{x}px;top:{y}px;width:{w*scale}px;height:{h*scale}px;background-image:url(source/{name}.png);background-size:{d["width"]*scale}px {d["height"]*scale}px;background-position:{-cx*scale}px {-cy*scale}px">{ring}</div>'


def scene(name, x, y, width, height, cx, cy, crop_width):
    scale = width/crop_width
    crop_height = height/scale
    return shot(name, x, y, (cx-crop_width/2, cy-crop_height/2, crop_width, crop_height), scale)


def step(n, text, y):
    return f'<div class="step" style="top:{y}px"><b>{n}</b><span>{text}</span></div>'


def label(text, x, y, small=False):
    return f'<span class="label {"small" if small else ""}" style="left:{x}px;top:{y}px">{text}</span>'


def art(id, x, y, size=100):
    return f'<img class="art" src="../../../../public/icons/{id}.png" style="left:{x}px;top:{y}px;width:{size}px;height:{size}px" alt="">'


def arrow(x, y, down=False):
    return f'<svg class="arrow" style="left:{x}px;top:{y}px;transform:rotate({90 if down else 0}deg)" width="32" height="24" viewBox="0 0 32 24"><path d="M2 12H28M20 4L28 12 20 20" fill="none" stroke="currentColor" stroke-width="2"/></svg>'


def line(y):
    return f'<i class="divider" style="top:{y}px"></i>'


def controls(touch):
    gestures = [('单指拖动', '平移'), ('双指捏合', '缩放'), ('双指左右滑', '旋转')] if touch else [('左键拖动', '平移'), ('滚轮', '缩放'), ('右键 / Shift', '旋转')]
    paths = ['M3 16H29M9 10L3 16 9 22M23 10L29 16 23 22', 'M16 3V29M10 9L16 3 22 9M10 23L16 29 22 23', 'M6 12A11 11 0 1 1 6 24M6 4V12H14']
    html = scene('world', 16, 16, 376, 284, 545, 405, 470)
    html += '<div class="gesture-column">' + ''.join(f'<div><svg viewBox="0 0 32 32"><path d="{path}"/></svg><span>{short}<b>{action}</b></span></div>' for path, (short, action) in zip(paths, gestures)) + '</div>'
    return html + line(312) + step(1, '采集按钮', 344) + shot('harvest', 280, 331)


focus = m['placement']['focus']
figures = {
    'controls-mouse': controls(False),
    'controls-touch': controls(True),
    'building': step(1, '点击购买', 34) + art('V5', 182, 14, 68) + label('堆肥箱', 260, 34) + shot('buy-button', 468, 22, mark=True)
        + line(100) + step(2, '选个位置', 177) + scene('placement', 176, 112, 440, 200, focus['x'], focus['y']+18, 400)
        + line(324) + step(3, '确认建造', 357) + shot('confirm', 176, 337, (14, 58, 302, 51), mark=True),
    'foreground': step(1, '前台运行', 65) + shot('income', 194, 60) + label('采集、工作照常进行', 194, 146, True)
        + line(209) + step(2, '离开游戏', 275) + shot('paused', 182, 257) + label('回到前台，继续赚钱', 194, 353, True),
    'moving': step(1, '点击扳手', 72) + label('设施详情', 190, 26, True) + shot('facility-tools', 190, 66, mark=True)
        + line(180) + step(2, '调整朝向', 253) + shot('rotation', 176, 207, (14, 58, 302, 51), mark=True) + label('每次旋转 90°，确认后生效', 190, 326, True),
    'jobs': step(1, '选择岗位', 72) + shot('workplace', 190, 28, mark=True)
        + line(276) + step(2, '选择村民', 333) + shot('person', 190, 306, mark=True),
    'delivery': step(1, '货物去向', 92) + art('V4', 176, 32, 128) + arrow(306, 87) + art('V2', 332, 32, 128) + arrow(462, 87) + art('V3', 488, 32, 128)
        + label('产货', 219, 171) + label('搬运', 375, 171) + label('成交', 531, 171) + line(231)
        + step(2, '安排搬运', 288) + label('搬运工', 190, 288) + shot('hauler', 502, 274, (0, 105, 70, 49), mark=True)
        + label('村庄 → 居民 → 按工作地点', 190, 364, True),
    'power': step(1, '接入设备', 83) + shot('connect', 190, 15, (0, 0, 297, 144), mark=True)
        + line(222) + step(2, '查看供电', 297) + shot('power-meters', 190, 237, (14, 24, 268, 130)),
    'studio': step(1, '进入室内', 49) + art('L2', 25, 108, 120) + arrow(141, 166) + scene('studio', 176, 16, 440, 280, 535, 325, 900)
        + line(308) + step(2, '添置设备', 350) + shot('studio-menu', 190, 321, mark=True),
    'upgrades': step(1, '选择改造', 53) + shot('upgrade', 190, 22, (0, 0, 297, 201), mark=True) + step(2, '查看变化', 237)
        + line(341) + label('升级原设施，不用重新选址', 190, 370, True),
}
css = '''*{box-sizing:border-box}body{margin:0;background:#dce3d0;color:#304c3d;font-family:"PingFang SC","Microsoft YaHei",sans-serif}.figure{position:relative;width:640px;height:416px;background:#f1f0e5;overflow:hidden}.shot{position:absolute;background-repeat:no-repeat}.ring{position:absolute;border:2px solid #96713d;box-shadow:0 0 0 2px #fff9;pointer-events:none}.step{position:absolute;left:20px;display:flex;align-items:center;gap:9px;font-size:18px;line-height:26px;font-weight:600}.step b{display:grid;place-items:center;width:24px;height:24px;background:#54734a;color:#fff;font-size:15px;font-weight:600}.label{position:absolute;font-size:19px;line-height:26px;font-weight:500}.label.small{font-size:17px;color:#66785c;font-weight:400}.art,.arrow{position:absolute}.art{object-fit:contain;image-rendering:pixelated}.arrow{color:#7c8e6d}.divider{position:absolute;left:20px;right:24px;height:1px;background:#d3dac6}.gesture-column{position:absolute;left:411px;top:25px;right:20px;display:grid;gap:12px}.gesture-column>div{display:flex;align-items:center;gap:16px;padding:9px 0 15px;border-bottom:1px solid #d3dac6}.gesture-column svg{width:30px;height:30px;fill:none;stroke:#758a63;stroke-width:2;flex:none}.gesture-column span{font-size:17px;line-height:24px;color:#64775b}.gesture-column b{display:block;font-size:22px;line-height:30px;font-weight:600;color:#304c3d}'''
body = ''.join(f'<article class="figure" id="{k}">{v}</article>' for k, v in figures.items())
(qa/'art-source.html').write_text('<!doctype html><meta charset="utf-8"><style>'+css+'</style>'+body)
result = {}
with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={'width': 680, 'height': 900}, device_scale_factor=2)
    page.goto((qa/'art-source.html').as_uri(), wait_until='networkidle')
    page.evaluate('Promise.all([...document.images].map(i=>i.decode()))')
    for key in figures:
        png = qa/(key+'.png')
        page.locator('#'+key).screenshot(path=str(png))
        with Image.open(png) as im:
            im.save(assets/(key+'.webp'), 'WEBP', lossless=True, method=6)
            result[key] = {'width': im.width, 'height': im.height, 'bytes': (assets/(key+'.webp')).stat().st_size}
    browser.close()
(assets/'dimensions.json').write_text(json.dumps({k: {'width': v['width'], 'height': v['height']} for k, v in result.items()}, indent=2)+'\n')
(qa/'assets.json').write_text(json.dumps(result, indent=2)+'\n')
print('10 screenshot diagrams:', sum(d['bytes'] for d in result.values()), 'bytes')

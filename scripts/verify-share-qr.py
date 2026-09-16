"""Decode the actual browser screenshot / exported PNG, independently of generation.
Run: uv run --with opencv-python-headless --python 3.11 scripts/verify-share-qr.py
"""
from pathlib import Path
import argparse
import json
import re
import cv2

root=Path(__file__).resolve().parents[1]
ap=argparse.ArgumentParser()
ap.add_argument('--label',default='dev')
args=ap.parse_args()
folder=root/'docs/qa'/f'hud-{args.label}'
expected=re.search(r'GAME_SHARE_URL = "([^"]+)"',(root/'src/share-platform.js').read_text()).group(1)
detector=cv2.QRCodeDetector()
checks=[]
for name in ['desktop-qr.png','phone-qr.png','small-qr.png','desktop-card.png','phone-card.png']:
    image=cv2.imread(str(folder/name))
    assert image is not None,name
    actual,points,_=detector.detectAndDecode(image)
    assert actual==expected,(name,actual)
    checks.append({'image':name,'decoded':actual,'corners':points.tolist()})
(folder/'qr-decoding.json').write_text(json.dumps({'passed':True,'checks':checks},ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'passed':True,'decodedImages':len(checks)}))

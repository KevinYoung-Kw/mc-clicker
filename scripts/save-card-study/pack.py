"""Build QR matrices for synthetic design-study saves; no player data."""
import hashlib,json,math
from pathlib import Path
import qrcode
src=Path('/tmp/mcc-save-card-design')
out=Path(__file__).resolve().parents[2]/'docs/v1.7/qa/save-card-design'
for name in ['village','advanced']:
    archive=(src/f'{name}.archive').read_bytes()
    digest=hashlib.sha256(archive).digest()
    # Version 40 Q holds 1663 bytes; the packet header is 22 bytes.
    chunk=1640
    count=math.ceil(len(archive)/chunk)
    matrices=[]
    for i in range(count):
        packet=b'MCIq'+digest[:16]+bytes([i,count])+archive[i*chunk:(i+1)*chunk]
        qr=qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_Q,border=4)
        qr.add_data(qrcode.util.QRData(packet,mode=qrcode.util.MODE_8BIT_BYTE),optimize=0)
        qr.make(fit=True)
        matrices.append([''.join('1' if v else '0' for v in row) for row in qr.get_matrix()])
    meta=json.loads((src/f'{name}.meta.json').read_text())
    packet=b'MCIs'+len(archive).to_bytes(4,'big')+digest+archive
    nibbles=[v for byte in packet for v in (byte >> 4, byte & 15)]
    rows=[nibbles[i:i+432] for i in range(0,len(nibbles),432)]
    meta.update(matrices=matrices,pixelRows=rows,archiveBytes=len(archive),digest=digest.hex())
    (out/f'{name}.data.json').write_text(json.dumps(meta,ensure_ascii=False))
    print(name, len(archive), count, [len(m) for m in matrices])

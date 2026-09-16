"""Verify designed card pixels, including lossy transport; no PNG metadata is read."""
import hashlib,io,json,time
from pathlib import Path
from PIL import Image
import zxingcpp
root=Path(__file__).resolve().parents[2]
out=root/'docs/v1.7/qa/save-card-design'
report=[]
for name in ['village','advanced']:
    original=Image.open(out/f'{name}.png').convert('RGB')
    archive=Path(f'/tmp/mcc-save-card-design/{name}.archive').read_bytes()
    digest=hashlib.sha256(archive).digest()
    variants=[('original',original,{}),('jpeg-85',original,{'quality':85}),('jpeg-60',original,{'quality':60})]
    for width in [1080,720,390]:
        resized=original.resize((width,round(original.height*width/original.width)),Image.Resampling.LANCZOS)
        variants.append((f'width-{width}-jpeg-85',resized,{'quality':85}))
    variants.extend([('rotated-90',original.transpose(Image.Transpose.ROTATE_90),{}),('cropped-half',original.crop((0,0,original.width//2,original.height)),{})])
    for label,image,options in variants:
        buf=io.BytesIO();image.save(buf,format='JPEG' if options else 'PNG',**options);buf.seek(0);image=Image.open(buf)
        start=time.perf_counter();parts={};count=0
        for result in zxingcpp.read_barcodes(image,formats=zxingcpp.BarcodeFormat.QRCode):
            b=result.bytes
            if len(b)<22 or b[:4]!=b'MCIq' or b[4:20]!=digest[:16]:continue
            index,total=b[20:22]
            if total==0 or index>=total:continue
            if count and count!=total:raise ValueError('Inconsistent archive')
            count=total;parts[index]=b[22:]
        restored=b''.join(parts.get(i,b'') for i in range(count))
        valid=bool(count) and len(parts)==count and hashlib.sha256(restored).digest()==digest
        exact=valid and restored==archive
        if label=='original':
            assert exact, f'{name} original unreadable'
            Path(f'/tmp/mcc-save-card-design/{name}.restored.archive').write_bytes(restored)
        if label=='cropped-half':assert not valid
        row={'sample':name,'case':label,'width':image.width,'height':image.height,'parts':len(parts),'total':count,'exact':exact,'decodeMs':round((time.perf_counter()-start)*1000)}
        report.append(row);print(row,flush=True)
(out/'verification.json').write_text(json.dumps(report,indent=2)+'\n')

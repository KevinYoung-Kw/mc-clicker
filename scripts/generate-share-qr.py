"""Generate the invitation asset locally: uv run --with qrcode --python 3.11 ..."""
from pathlib import Path
import re
import qrcode

root = Path(__file__).resolve().parents[1]
url = re.search(r'GAME_SHARE_URL = "([^"]+)"', (root / 'src/share-platform.js').read_text()).group(1)
qr = qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_M, border=4)
qr.add_data(url)
qr.make(fit=True)
matrix = qr.get_matrix()
size = len(matrix)
modules = ''.join(f'M{x} {y}h1v1h-1z' for y, row in enumerate(matrix) for x, dark in enumerate(row) if dark)
out = root / 'public/share/world-invite.svg'
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(f'<svg xmlns="http://www.w3.org/2000/svg" width="{size*6}" height="{size*6}" viewBox="0 0 {size} {size}" shape-rendering="crispEdges"><title>MC Clicker 2.0</title><path fill="#f2f0e4" d="M0 0h{size}v{size}H0z"/><path fill="#334a37" d="{modules}"/></svg>\n')
print(f'{url}: {size} × {size} modules including 4-module quiet zone')

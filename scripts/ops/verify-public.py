import json, hashlib, gzip, urllib.request, concurrent.futures, time
from pathlib import Path
import argparse

p = argparse.ArgumentParser(
    description="Verify ordinary public MC2 URLs against a staged build manifest; read only."
)
p.add_argument("--manifest", type=Path, required=True)
p.add_argument("--out", type=Path, required=True)
a = p.parse_args()
m = json.loads(a.manifest.read_text())
out = a.out
out.mkdir(parents=True, exist_ok=True)


def check(job):
    url, expected, encoding = job
    for attempt in range(3):
        try:
            req = urllib.request.Request(
                url,
                headers={
                    "Accept-Encoding": encoding,
                    "User-Agent": "MCClicker-Release-Verification/1.8",
                },
            )
            with urllib.request.urlopen(req, timeout=30) as r:
                data = r.read()
                headers = dict(r.headers)
                if r.headers.get("Content-Encoding") == "gzip":
                    data = gzip.decompress(data)
                actual = hashlib.sha256(data).hexdigest()
                return {
                    "url": url,
                    "encoding": encoding,
                    "status": r.status,
                    "matched": actual == expected,
                    "sha256": actual,
                    "cacheControl": headers.get("Cache-Control"),
                }
        except Exception as e:
            if attempt == 2:
                return {"url": url, "error": str(e), "matched": False}


entries = [
    (
        f"https://{host}/projects/mc-clicker-2/{tail}",
        m["files"]["build/index.html"],
        enc,
    )
    for host in ["www.kw-aigc.cn", "kw-aigc.cn"]
    for tail in ["", "index.html"]
    for enc in ["identity", "gzip"]
]
assets = [
    ("https://www.kw-aigc.cn/projects/mc-clicker-2/" + n[6:], h, "identity")
    for n, h in m["files"].items()
    if n.startswith("build/")
]
with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
    rows = list(pool.map(check, entries + assets))
report = {
    "version": m["version"],
    "revision": m["revision"],
    "entries": rows[:8],
    "assets": rows[8:],
    "allMatched": all(r["matched"] for r in rows),
}
(out / "public.json").write_text(json.dumps(report, ensure_ascii=False, indent=2))
print(
    json.dumps(
        {
            "allMatched": report["allMatched"],
            "entries": 8,
            "assets": len(assets),
            "failures": [r for r in rows if not r["matched"]],
        }
    )
)
assert report["allMatched"]

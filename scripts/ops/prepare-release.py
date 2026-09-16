"""Package an already-built clean MC2 checkout; no SSH and no deployment."""

import argparse, hashlib, json, shutil, subprocess, io, tarfile
from pathlib import Path

p = argparse.ArgumentParser(description=__doc__)
p.add_argument("--source", type=Path, required=True)
p.add_argument("--repository", type=Path, required=True)
p.add_argument("--baseline", type=Path, required=True)
p.add_argument("--out", type=Path, required=True)
p.add_argument("--revision", required=True)
a = p.parse_args()
src = a.source.resolve()
out = a.out.resolve()
assert not out.exists(), "Choose a new staging directory"
assert (src / "dist/index.html").is_file(), "Build the clean checkout first"
old = json.loads(a.baseline.read_text())
version = json.loads((src / "package.json").read_text())["version"]
revision = a.revision
# Compare the entire runtime source set to a committed tree before copying.
repo = a.repository.resolve()
resolved = subprocess.check_output(
    ["git", "rev-parse", a.revision + "^{commit}"], cwd=repo, text=True
).strip()
if resolved != a.revision:
    raise ValueError("Use a full commit hash, not a moving ref")
runtime = [
    "src",
    "public",
    "index.html",
    "vite.config.js",
    "package.json",
    "package-lock.json",
    "cover.png",
]
archive = subprocess.check_output(
    ["git", "archive", "--format=tar", resolved, *runtime],
    cwd=repo,
)
expected = {}
with tarfile.open(fileobj=io.BytesIO(archive)) as tar:
    for member in tar.getmembers():
        if not member.isfile():
            continue
        rel = Path(member.name)
        if rel.parts[0] in ["src", "public"] or rel.as_posix() in runtime:
            expected[rel.as_posix()] = hashlib.sha256(
                tar.extractfile(member).read()
            ).hexdigest()
actual = {}
for folder in ["src", "public"]:
    for file in (src / folder).rglob("*"):
        if file.is_file():
            actual[file.relative_to(src).as_posix()] = hashlib.sha256(
                file.read_bytes()
            ).hexdigest()
for name in [
    "index.html",
    "vite.config.js",
    "package.json",
    "package-lock.json",
    "cover.png",
]:
    if (src / name).is_file():
        actual[name] = hashlib.sha256((src / name).read_bytes()).hexdigest()
if actual != expected:
    raise ValueError("Runtime source differs from the specified committed tree")
files = {}


def copy(f, group, rel):
    assert f.is_file() and not f.is_symlink(), f
    dest = out / group / rel
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(f, dest)
    files[group + "/" + rel.as_posix()] = hashlib.sha256(f.read_bytes()).hexdigest()


for name in [
    "index.html",
    "vite.config.js",
    "package.json",
    "package-lock.json",
    "cover.png",
]:
    if (src / name).exists():
        copy(src / name, "source", Path(name))
for folder in ["src", "public"]:
    for f in sorted((src / folder).rglob("*")):
        if f.is_file():
            copy(f, "source", f.relative_to(src))
for f in sorted((src / "dist").rglob("*")):
    if f.is_file():
        copy(f, "build", f.relative_to(src / "dist"))
manifest = {
    "version": version,
    "revision": revision,
    "files": files,
    "baseline": {n: h for n, h in old["files"].items() if n in files},
}
(out / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
print(json.dumps({"version": version, "files": len(files), "out": str(out)}))

import json, hashlib, gzip, shutil, os, sys
from pathlib import Path
import argparse

parser = argparse.ArgumentParser(
    description="Verify a staged MC2 release; only --apply writes server files."
)
parser.add_argument("--stage", type=Path, required=True)
parser.add_argument("--backup", type=Path, required=True)
parser.add_argument("--apply", action="store_true")
args = parser.parse_args()
stage = args.stage.resolve()
m = json.loads((stage / "manifest.json").read_text())
# Website only hosts the built game. Source lives in the standalone mc-clicker repo.
roots = {
    "build": [
        Path("/www/wwwroot/my-profile/public/projects/mc-clicker-2"),
        Path("/www/wwwroot/my-profile/dist/projects/mc-clicker-2"),
    ],
}
backup = args.backup.resolve()
if backup.parent != Path("/www/backups"):
    raise ValueError("Backup must be directly under /www/backups")
protected = [
    Path("/www/wwwroot/my-profile/dist/index.html"),
    Path("/www/wwwroot/my-profile/dist/demos/mc-clicker/index.html"),
    Path("/www/server/nginx/vhost/nginx/node_my_profile.conf"),
]


def digest(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()


def destinations(name):
    group, rel = name.split("/", 1)
    if group != "build":
        return []
    if ".." in Path(rel).parts or Path(rel).is_absolute():
        raise ValueError(name)
    result = [root / rel for root in roots[group]]
    for dest in result:
        if any(parent.is_symlink() for parent in [dest, *dest.parents]):
            raise ValueError("Symlink destination " + str(dest))
    return result


errors = []
checked = 0
new = 0
for name, h in m["files"].items():
    if digest(stage / name) != h:
        errors.append("bad staged " + name)
    for dest in destinations(name):
        if dest.is_symlink():
            errors.append("symlink " + str(dest))
        if name in m["baseline"]:
            if not dest.is_file() or digest(dest) != m["baseline"][name]:
                errors.append("baseline mismatch " + str(dest))
            checked += 1
        else:
            if dest.exists() and digest(dest) != h:
                errors.append("new path occupied " + str(dest))
            new += 1
print(json.dumps({"checked": checked, "new": new, "errors": errors}), flush=True)
if errors:
    raise SystemExit(1)
if not args.apply:
    raise SystemExit(0)
if backup.exists():
    raise SystemExit("Backup exists; inspect before rerunning")
backup.mkdir(parents=True)
before = {str(p): digest(p) for p in protected}
(backup / "manifest.json").write_text(json.dumps(m, indent=2))
(backup / "protected.json").write_text(json.dumps(before))
for name in m["files"]:
    for dest in destinations(name):
        if dest.exists():
            b = backup / "before" / dest.relative_to("/www/wwwroot/my-profile")
            b.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(dest, b)
for root in roots["build"]:
    old = root / "index.html.gz"
    if old.exists():
        b = backup / "before" / old.relative_to("/www/wwwroot/my-profile")
        b.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(old, b)


def put(data, dest):
    dest.parent.mkdir(parents=True, exist_ok=True)
    tmp = dest.with_name(dest.name + ".mc-release-tmp")
    tmp.write_bytes(data)
    os.chmod(tmp, 0o644)
    os.replace(tmp, dest)


# All assets arrive before either entry document is replaced. Keep old hashed assets.
for name, h in m["files"].items():
    if name == "build/index.html":
        continue
    for dest in destinations(name):
        put((stage / name).read_bytes(), dest)
for name, h in m["files"].items():
    if name == "build/index.html":
        continue
    for dest in destinations(name):
        assert digest(dest) == h, str(dest)
html = (stage / "build/index.html").read_bytes()
for root in roots["build"]:
    put(gzip.compress(html, mtime=0), root / "index.html.gz")
    put(html, root / "index.html")
for name, h in m["files"].items():
    for dest in destinations(name):
        assert digest(dest) == h, str(dest)
assert before == {str(p): digest(p) for p in protected}
report = {
    "revision": m["revision"],
    "version": m["version"],
    "backup": str(backup),
    "baselineRuntimeFilesVerified": checked,
    "newRuntimePathsChecked": new,
    "runtimeFilesVerified": sum(n.startswith("source/") for n in m["files"]),
    "serverBuildFilesVerified": sum(n.startswith("build/") for n in m["files"]),
    "protectedFilesUnchanged": list(before),
    "htmlSHA256": m["files"]["build/index.html"],
    "gzipEntriesRefreshed": True,
}
(backup / "result.json").write_text(json.dumps(report, indent=2))
print(json.dumps(report), flush=True)

"""GitHub build transfer only. No server access, deployment or save access."""

import argparse
import gzip
import hashlib
import json
from pathlib import Path, PurePosixPath
import re
import shutil

REPOSITORY = "KevinYoung-Kw/mc-clicker"
TARGET = "public/projects/mc-clicker-2"
RECORDS = "docs/mc-clicker-sync"


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def require(condition, message):
    if not condition:
        raise ValueError(message)


def safe_path(root, name):
    rel = PurePosixPath(name)
    require(name and not rel.is_absolute() and ".." not in rel.parts
            and "\\" not in name and str(rel) == name, "Unsafe path: " + name)
    path = root / name
    require(not any(p.is_symlink() for p in [path, *path.parents]),
            "Symlink path: " + str(path))
    return path


def inventory(root):
    require(root.is_dir() and not root.is_symlink(), "Missing build directory")
    result = {}
    for path in sorted(root.rglob("*")):
        require(not path.is_symlink(), "Symlink in build")
        if path.is_file():
            name = path.relative_to(root).as_posix()
            safe_path(root, name)
            result[name] = digest(path)
    require("index.html" in result, "Missing index.html")
    return result


def pack(game, revision, out):
    require(not out.exists(), "Artifact output already exists")
    version = json.loads((game / "package.json").read_text())["version"]
    files = inventory(game / "dist")
    require("V" + version in (game / "dist/index.html").read_text(),
            "Build version does not match package.json")
    manifest = {"repository": REPOSITORY, "revision": revision,
                "version": version, "status": "synchronized-not-deployed",
                "files": files}
    out.mkdir(parents=True)
    shutil.copytree(game / "dist", out / "build")
    (out / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")


def sync(artifact, website, revision):
    manifest = json.loads((artifact / "manifest.json").read_text())
    require(manifest["repository"] == REPOSITORY, "Wrong source repository")
    require(manifest["revision"] == revision, "Wrong source commit")
    require(manifest["status"] == "synchronized-not-deployed", "Wrong build status")
    require(inventory(artifact / "build") == manifest["files"],
            "Artifact file list or hashes differ from manifest")
    # Validate every destination before any write. Retain old hashed resources.
    destinations = {name: safe_path(website, TARGET + "/" + name)
                    for name in manifest["files"]}
    gz = safe_path(website, TARGET + "/index.html.gz")
    record = safe_path(website, RECORDS + "/" + revision + ".json")
    encoded = json.dumps(manifest, indent=2) + "\n"
    if record.exists():
        require(record.read_text() == encoded,
                "This source commit already has a different recorded build")
    for name, dest in destinations.items():
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(artifact / "build" / name, dest)
    # A stale precompressed HTML would otherwise serve the previous game.
    gz.write_bytes(gzip.compress((artifact / "build/index.html").read_bytes(), mtime=0))
    record.parent.mkdir(parents=True, exist_ok=True)
    record.write_text(encoded)
    print(f"Synchronized {manifest['version']} ({revision}); cloud unchanged.")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    build = sub.add_parser("pack")
    build.add_argument("--game", type=Path, required=True)
    build.add_argument("--out", type=Path, required=True)
    copy = sub.add_parser("sync")
    copy.add_argument("--artifact", type=Path, required=True)
    copy.add_argument("--website", type=Path, required=True)
    for command in [build, copy]:
        command.add_argument("--revision", required=True)
    args = parser.parse_args()
    require(re.fullmatch(r"[0-9a-f]{40}", args.revision), "Use a full commit SHA")
    if args.command == "pack":
        pack(args.game, args.revision, args.out)
    else:
        sync(args.artifact, args.website, args.revision)


if __name__ == "__main__":
    main()

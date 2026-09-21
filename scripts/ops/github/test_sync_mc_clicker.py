"""Isolated transfer tests; never touches either real repository or the cloud."""

import gzip
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location(
    "sync_build", Path(__file__).with_name("sync-mc-clicker.py"))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
REV = "a" * 40


class TransferTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name).resolve()
        self.game = self.root / "game"
        self.website = self.root / "website"
        self.artifact = self.root / "artifact"
        self.target = self.website / module.TARGET
        (self.game / "dist/assets").mkdir(parents=True)
        (self.game / "package.json").write_text('{"version":"2.0.0-alpha.8"}')
        (self.game / "dist/index.html").write_text("V2.0.0-alpha.8")
        (self.game / "dist/assets/new.js").write_text("new build")
        self.target.mkdir(parents=True)
        (self.target / "old.js").write_text("keep old build")
        (self.target / "index.html.gz").write_bytes(b"stale compressed HTML")
        (self.website / "index.html").write_text("main website")
        module.pack(self.game, REV, self.artifact)

    def sync(self):
        module.sync(self.artifact, self.website, REV)

    def test_transfer_preserves_old_resources_and_website_and_is_idempotent(self):
        self.sync()
        self.assertEqual((self.target / "old.js").read_text(), "keep old build")
        self.assertEqual((self.website / "index.html").read_text(), "main website")
        self.assertEqual(gzip.decompress((self.target / "index.html.gz").read_bytes()),
                         (self.target / "index.html").read_bytes())
        snapshot = {p: p.read_bytes() for p in self.website.rglob("*") if p.is_file()}
        self.sync()
        self.assertEqual(snapshot, {p: p.read_bytes() for p in self.website.rglob("*") if p.is_file()})

    def test_tampered_artifact_rejected_before_writing(self):
        (self.artifact / "build/assets/new.js").write_text("tampered")
        with self.assertRaisesRegex(ValueError, "hashes"):
            self.sync()
        self.assertFalse((self.target / "index.html").exists())

    def test_wrong_revision_rejected(self):
        with self.assertRaisesRegex(ValueError, "commit"):
            module.sync(self.artifact, self.website, "b" * 40)

    def test_symlink_destination_rejected_before_writing(self):
        outside = self.root / "outside"
        outside.mkdir()
        (self.target / "assets").symlink_to(outside, target_is_directory=True)
        with self.assertRaisesRegex(ValueError, "Symlink"):
            self.sync()
        self.assertFalse((self.target / "index.html").exists())
        self.assertEqual(list(outside.iterdir()), [])

    def test_changed_build_cannot_overwrite_record_for_same_commit(self):
        self.sync()
        manifest = self.artifact / "manifest.json"
        data = json.loads(manifest.read_text())
        (self.artifact / "build/assets/new.js").write_text("changed")
        data["files"]["assets/new.js"] = module.digest(self.artifact / "build/assets/new.js")
        manifest.write_text(json.dumps(data))
        with self.assertRaisesRegex(ValueError, "different recorded build"):
            self.sync()
        self.assertEqual((self.target / "assets/new.js").read_text(), "new build")

    def test_path_escape_rejected(self):
        for name in ["../outside", "/outside", "assets/../../outside", "a\\b"]:
            with self.subTest(name=name), self.assertRaises(ValueError):
                module.safe_path(self.website, name)


if __name__ == "__main__":
    unittest.main()

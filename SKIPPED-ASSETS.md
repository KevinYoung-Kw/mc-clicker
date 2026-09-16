# Assets skipped in this MCP copy

GitHub `get_file_contents` returns text. These binaries/oversize blobs were not copied; they still live in `KevinYoung-Kw/my-profile` under `projects/mc-clicker-2/`. Restore them with a local `git subtree split` if you need a complete tree.

## Audio (too large)

- `public/audio/records/cavern.mp3` (1,250,787)
- `public/audio/records/copper.mp3` (972,113)
- `public/audio/records/end.mp3` (1,428,890)
- `public/audio/records/meadow.mp3` (1,197,758)
- `public/audio/records/nether.mp3` (1,149,118)
- `public/audio/records/rain.mp3` (1,149,118)

`public/audio/records/CREDITS.txt` is included.

## Images (API UTF-8-corrupts PNG/WebP)

- `cover.png` (513,002)
- `public/icons/*.png` (catalog / garden / housing icons, ~140 files)
- `public/mail/mc-clicker-group-20260907.png`
- `public/mail/wechat-channel-qr.webp`
- `public/mail/xiaohongshu-qr.webp`
- `src/assets/tutorials/*.webp` (10 files)

## Oversize JSON (decode failed)

- `docs/maintenance/repository-inventory.json` (1,108,106)
- `docs/v2.0.0/simulation/research-routes.json` (2,592,224)

The game JS/CSS, tests, scripts, and most docs are in this repo. Icons and record MP3s are missing until restored from the source tree.

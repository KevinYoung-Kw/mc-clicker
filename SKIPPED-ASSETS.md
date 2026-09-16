# Assets not fully copied

Most of the web game tree is in this repo, including `cover.png`, `public/icons/*.png`, `public/mail/*`, `src/assets/tutorials/*.webp`, and `public/audio/records/*.mp3` (GitHub blob sizes match the source).

Still missing or truncated versus `KevinYoung-Kw/my-profile` `projects/mc-clicker-2` because GitHub MCP `push_files` / `get_file_contents` rejected the payload:

## Oversize / decode failed

- `docs/maintenance/repository-inventory.json` (1,108,106)
- `docs/v2.0.0/simulation/research-routes.json` (2,592,224)
- most `docs/v2.0.0/simulation/*.mjs` above ~400 KB

## Docs not landed or truncated

- `docs/purchase-catalog.json` (107,656)
- `docs/balance-results.json` (dest truncated vs 46,121)
- `docs/v1.5/copy-review/` (large json/csv)
- `docs/v1.5.5/` narrator review JSON/md
- `docs/v1.5.6/` narrator review JSON/md
- `docs/v1.8/narrator-review/`
- `docs/v1.5.1/NARRATION-TIMING.md` (truncated)

Restore those from the source tree with a local `git subtree split` if you need a byte-identical archive. The playable game (`src/`, `index.html`, `public/` media, `tests/`, `scripts/`) is here.

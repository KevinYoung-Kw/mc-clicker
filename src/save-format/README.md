# Frozen MCC2 structure v1

These JSON files are protocol data. **Never regenerate or edit v1 in place.**
For changed templates/algorithms, allocate a new payload-kind ID and retain this decoder.
`tests/save-compact.test.js` pins both dictionary hashes and a golden binary record.

- `defaults-v1.json`: deterministic `fresh(0)` from alpha.11. Contains game defaults, not a player's progress.
- `records-v1.json`: ordered field sets seen at least three times in 25 older repository simulation fixtures (baseline, calibrated, complete-mechanisms-candidate, final-candidate, network-slice). Each value is only the most frequent `null`, boolean, `0`, empty string/array/object, otherwise `null`. No player money, coordinates, names, event text or whole saved worlds are embedded.

Initialization visits defaults and records in order, registers unique strings and ordered field sets, then post-order unique objects with JSON length ≥64. Indices are frozen by these files and initialization rules. Unknown fields and values are encoded inline.

Tags: 0 null; 1 false; 2 true; 3 unsigned safe integer; 4 negative safe integer; 5 little-endian Float64; 6 string; 7 array; 8 object; 9 object difference; 10 prior object reference; 11 exact half-grid number. All counts/indices use base-128 varuint; no bitwise truncation of large integers. Half-grid encoding is used only if multiplication by two is exactly a safe integer.

Strings and object shapes have dictionary references; new strings are UTF-8 JSON-quoted to preserve lone UTF-16 surrogates. Object differences reference a prior object with the same ordered keys, then store an LSB-first change bitmap and changed values. Unchanged subtrees are cloned, never aliased. Limits cover input size, nesting, node count and expanded reference/difference size before copying.

The MCC2 gzip payload starts with 0 for complete JSON or 1 for this structure. Encoding compares both compressed lengths and chooses the smaller. Text uses 14 bits per assigned CJK BMP character, plus one character carrying the last group's valid bit count; canonical re-encoding rejects nonzero padding/truncation. CRC32 covers compressed bytes. CRC detects copying errors, not forgery or cheating.

MCC1 gzip/Base64URL and versions 2–7 JSON saves remain readable. All new encoding remains in a Worker; there is no API, upload, account or per-player backend state.

## MCC3 / frozen structure v2

MCC3 uses the same CJK/CRC envelope and gzip limits. Payload kinds 0 (JSON) and 1 (structure v1) retain their meanings; kind 2 is `save-packed-v2.js`. Never reinterpret an old kind or mutate a frozen JSON table.

V2 seeds the original v1 defaults/records, then `persistent-defaults-v1.json`, then each string in `words-v2.json`. The extra defaults are the frozen schema-7 persistent projection. They are a static file, not recalculated from the changing game loader.

`words-v2.json` contains 927 static string literals/template fragments (2–240 UTF-16 units) from these alpha.13 source modules, in source traversal order: catalog, upgrade-catalog, web-catalog, housing-data, garden-data, narrator-copy, game, operations, residents, dimensional, mail, records, environment, easter-eggs, orders, market-ledger. Relative imports, newlines and hex colors were excluded. They were extracted once using the existing Acorn parser, not from player/test saves. No parser or extra dependency ships at runtime. Literal matches preserve old text exactly; other text is encoded inline.

V2 retains scalar, array, object and exact-reference tags from v1. Tag 9 is not used. Tag 12: base-object index, ordinary ordered shape, change bitmap, changed values. Unchanged keys must exist in the base; removed keys are absent from the new shape. Tag 13: fragment count and ordinary dictionary/literal texts, concatenated exactly and then registered as a new whole string. Bounds apply before cloning references or joining strings. Encoding groups object candidates by the first two ordered keys, with at most 24 candidates; this is an encoder heuristic, not a decoding dependency.

Production compares complete JSON, original structure and new structure, for both full and persistent state, and chooses the shortest compressed archive. Persistent projection removes only known fields already rebuilt by schema-7 `restore()`, retaining unknowns and the full immutable first-victory snapshot. Old schemas are not projected. This preserves game state rather than byte-identical transient caches; see [persistence contract and measurements](../../docs/v1.7/PERSISTENT-SAVE-CODE.md).

## MCC4 / alpha.14

MCC4 uses the same frozen structural frames as MCC3 with a Brotli outer stream.
`save-brotli.js` contains the portable async entry points; `save-code.js` retains
synchronous MCC1–3 compatibility. No dictionaries or old tag definitions change.

The encoder computes the existing complete MCC3 candidate, then tests Brotli
quality 11 on that structural frame; it uses MCC4 only if the actual full code is
shorter. This is not an exhaustive search over every possible representation.
A failed encoder module falls back to MCC3. The decoder loads the module only for
MCC4 and uses bounded streaming output before the shared structural validator.
CRC32 still detects copy damage; it is not encryption/authentication.

The Brotli module is pinned to brotli-wasm 3.0.1 (Apache-2.0), served as a static
asset from the site, and loaded only by the temporary save worker. No player data
is sent to a server. Its license ships at `licenses/brotli-wasm.txt`.

## MCC5 / local alpha.15 candidate

MCC5 adds frame kind 3 (`save-packed-v3.js`), retaining structure 2 tags while
seeding the frozen `transcripts-v1.json` after words-v2. Its 151 source-authored
records contain complete/partial narration and public job variants, never player
data. Unknown and historical text stays literal. SHA-256:
`649cb2c222b1f19913423c04ee4a74a88f169671765f4ec2415ebcf137b21427`.

Do not regenerate the table in place. Current narration is not an archival
decoder dependency. `build-save-transcript-table.mjs` refuses to overwrite a
table. The async encoder compares actual complete MCC3, MCC4 and MCC5 strings;
old decoders/table definitions remain unchanged. MCC5 accepts kind 3 only; MCC4
does not reinterpret that kind. Validation and bounded Brotli expansion remain.

The later numeric, column, path and report-reconstruction experiments under
`scripts/save-reconstruction` are research tools. They are not an enabled MCC
format and must not be imported into the player-pasted-input path as-is. See
[local divide-and-conquer study](../../docs/v1.7/SAVE-DIVIDE-AND-CONQUER.md).

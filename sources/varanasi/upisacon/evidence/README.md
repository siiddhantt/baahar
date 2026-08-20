# UPISACON live evidence

Reviewed locally on 19 August 2026. One Bright Data collector exists, but its
generated template was rejected and remains unapproved. Two reviewed
development attempts failed closed before collection. No production save,
approval, production run, or batch exists for this source.

This slice is now closed as optional evidence. It will not be previewed or run
again for the current milestone; broader official BHU coverage supersedes it.

## Raw HTTP proof

- URL: `https://upisaconvaranasi2026.com/workshops`
- Status: HTTP 200
- Wire bytes: 1,813
- Raw SHA-256:
  `550fab00fcc63832f32221cde8ff620802de4b5cd2d1a534159930a31cde1612`
- Content: empty React root and one module script
- Source fact markers in raw body: 0 of 9
- Code-worker eligibility: rejected

## Rendered browser proof

- Browser: Playwright with installed Microsoft Edge
- Final URL: exact canonical URL
- Document navigations: 1
- Browser actions: 0
- Fan-out: 0
- Total physical network requests: 12
- Rendered workshop rows: 7
- Unique fallback identities: 7
- Partial or inferred rows: 0
- Parsed semantic-view SHA-256:
  `84d5a2e4439b2ab601b8969cd3840dd0a10236b389b7a774af50da16dd5d52dd`
- Canonical seven-row SHA-256:
  `11dee1fcb5929f5f0f4731300082370e0d4eeca3c4f2af7b950902ed93d23ae5`

The tracked evidence is a fact ledger, not a substituted dataset. Raw HTTP and
rendered HTML are fetched live by the focused harness and are not committed.
The raw hash identifies this local proof, not a frozen production fixture. Full
rendered HTML is intentionally not treated as an artifact: browser-injected
markup can change without changing the reviewed facts. The harness instead
hashes the parsed semantic view and exact seven-row validation view. A later
Bright proof must record its own immutable transport artifact hash.

## Bright Data gate

Exactly one no-retry create was issued with official CLI v0.3.5:

- Collector ID: `c_mszryghfxuyinkfe6`
- Name: `baahar-upisacon-workshops`
- Terminal status: `done` after 90 generation polls
- Created: `2026-08-19T07:33:08.979Z`
- View: `https://brightdata.com/cp/scrapers/c_mszryghfxuyinkfe6`
- Private create-envelope bytes: 390
- Private create-envelope SHA-256:
  `5ab6da1e16612e66ec9dc64aefa6d644a38c8f2406b12373deef51e8d392cb24`
- Create-envelope error: absent

Root's read-only inspection rejected the generated template. It has two stages
instead of the reviewed one-stage contract. The first generated stage calls
`navigate(url)` and then `next_stage(...)`; the second Browser stage adds an
explicit `wait(...)` and relies on brittle Tailwind selectors. Those behaviors
violate the one-navigation, zero-explicit-wait, stable-source-boundary design.
Generated code and schema were not accepted or substituted for the tracked
artifacts.

## Reviewed development-preview failures

Root installed the reviewed one-stage Browser worker and issued one explicit
development preview:

- Preview ID: `preview_mszuhlok2afpflntl2`
- Navigation: one call to the exact canonical workshop URL
- Observed network requests: 13
- Collection calls: 0
- Terminal error: `UPISACON workshop order or title drifted`

The validation failed atomically after parsing and before the first `collect()`.
A subsequent save probe, `preview_mszun8sgytxezvbz4`, failed at the same
order/title gate. It did not save or promote the template. No production batch
was triggered. The focused local harness remained green at 6 of 6 tests against
the live rendered page.

The failed preview IDs are diagnostic evidence, not source approval. No
collection ID, raw transport bytes, transport hash, or production validation
exists. The source keeps `publication_state: preview` and
`collection_state: local_verified`; it is not active until a separately
authorized reviewed preview, immutable live batch proof, and backend
publication all pass.

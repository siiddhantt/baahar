# Atta Galatta evidence

## Local qualification — 20 August 2026

The public official endpoint returned one 1,270,008-byte JSON response with
2,123 rows and no pagination. The current 90-day boundary contained 42 unique
future occurrences from 21 August through 4 October 2026. Three official
29 August rows (`EVT2094` through `EVT2096`) appeared after the previous day's
39-row qualification; neither value is a hardcoded baseline.

The focused live harness proves the one-request/page budget, complete transport
shape, current count, native identity safety, date/time cross-checks, official
detail/image hosts, exact 27-field schema, no description copying, and atomic
input/shape/host/date/duplicate/count failures.

The accepted local run made one HTTP request and observed:

- response: 1,270,008 bytes, SHA-256
  `9d24f2cffbafa61513148a7cf26ebe83699f9001ef0cb52f960fdb88b792ccc2`;
- archive/current/repeated-native-ID groups: 2,123 / 42 / 50;
- canonical output: 42 records, SHA-256
  `578961ee817e2b9f974178a6738ca024abde530d85f187ceae43d836a764ca41`;
- focused tests: 6 passed, 0 failed;
- authoritative Go event-schema validation: passed for all 42 records;
- strict source-manifest validation and source formatting: passed.

These hashes are dated observations, not permanent content baselines. A new
official listing can legitimately change both the response and canonical hash;
that change requires a fresh reviewed qualification before Bright creation.

## Bright Data create gate — 19 August 2026

Exactly one authenticated create was issued with official `@brightdata/cli`
0.3.5 and `--no-retry` from the tracked `../collector/create-prompt.txt`:

- collector ID: `c_mt006uf51wdkssg1lh`;
- name: `baahar-atta-galatta`;
- terminal status: `done` after 678 polls;
- created: `2026-08-19T11:23:37.217Z`;
- view: `https://brightdata.com/cp/scrapers/c_mt006uf51wdkssg1lh`;
- private immutable create envelope: 386 bytes;
- envelope SHA-256:
  `faa77964eca71482e35b0de90613003ca72db1fd99e2b5fd97a8f16a0de5e584`.

The generated two-stage template was inspected and rejected: it used an
unnecessary Browser listing stage plus a generated parser before a Code stage.
No output from that draft was accepted.

## Reviewed production proof — 20 August 2026

The same Collector ID was reduced to one tracked Code stage with the canonical
27-field presentation schema. Development preview
`preview_mt16jy6r2mknjgiezz` returned exactly 42 rows. The reviewed template was
saved as Version 2; its Changelog entry then showed Version 2 as the Production
version while Version 1 remained the older generated draft.

Exactly one asynchronous production trigger was issued with one canonical
input. It was never retried:

- collection ID: `j_mt16pm6j4ksns94ig`;
- trigger: HTTP 200, 78 bytes, SHA-256
  `7031922d1df8ffd1950da241df070219a8bcafa0dd4b897bd684274482729269`;
- dataset: ready on poll 1 with HTTP 200;
- immutable raw dataset: 41,959 bytes, SHA-256
  `074370c25d11998647404c8b5e28ffeb4818241e6233036d46182023dd53ec51`;
- output: 42 rows and 42 unique reviewed `EVT` native IDs;
- transport: one uniform 28-key shape containing the exact 27 canonical fields
  plus Bright's `input` metadata;
- every `input` object contained only the exact manifest URL;
- the derived 27-field view passed the authoritative Go schema and source
  semantic gates for all 42 rows;
- every row remained `bengaluru`, `other`, `scheduled`, `timed`,
  `Asia/Kolkata`, and first-party for detail/image hosts;
- unsupported venue, end, price, free, registration, language, age, and
  accessibility facts remained null or empty;
- `observed_at` was uniformly `2026-08-20T07:13:56.942Z`; starts ranged from
  21 August through 4 October.

The exact trigger, first poll, and raw dataset bytes are ignored under
`../private/production-batch-20260820/`. The raw transport is not rewritten into
a tracked fixture. No heal, duplicate collector, or second trigger occurred.
The manifest now records the reviewed desired configuration as `active` and
`verified`.

## Baahar activation — 20 August 2026

Migration 8 registered stable source ID
`854afb9d-c219-5f8f-b8a5-f0b8b24ae799` without changing BIC, Jagriti, or BHU.
The protected operator route accepted one fixed-key collection job. All other
sources were frozen from scheduling for the run and restored by exact full-row
comparison afterward.

- application run: `01a01e13-16ba-7cd9-8c8e-61b80f75eb86`;
- Bright collection: `j_mt17a8cg100t32dmt0`;
- immutable MinIO object: 41,959 bytes, SHA-256
  `08d589fd8a80705c081611e3a3dfd189f50d2b106e13b90123e75d4543caa99b`;
- publication: 42 received / 42 accepted / 0 quarantined;
- database: 42 visible occurrences, 42 distinct identities, 42 versions, and
  zero invented changes;
- public API: Upcoming returned 42 Atta Galatta events from one source; detail,
  ICS, and source-summary routes returned successfully;
- fixed collection-key reconciliation returned the original run without a
  second Bright collection;
- immutable replay `01a01e16-772d-774e-91ba-f02ba90802b5` reused the original
  object with no external collection and preserved every occurrence, version,
  change, and quarantine cardinality.

The source is active and fresh. Its public image-card, detail, save, Back, and
responsive browser acceptance passes; BIEC may enter the next local review.

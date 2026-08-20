# BIEC evidence

This ledger contains source-local facts only. Raw live HTML is not tracked.

## Local qualification — 20 August 2026

- exact input: `https://www.biec.in/events`;
- final focused gate response: HTTP 200 server-rendered HTML, 336,607 bytes,
  SHA-256 `2451d480af84b836783600541398a64ea95656c3fa2b2e36a168ef4a62236134`;
- one physical request and one page; no pagination, load-more, RSS, API, or
  detail dependency;
- diagnostic page observation: 243 public-DOM archive boxes and 128 modern title
  links; these archive totals are not publication gates;
- the observed 90-day horizon intersects only 2026, whose required container has
  45/45 cards with the date/time contract; 2027 is outside the horizon;
- exact eligible output: nine rows from 22 August through 26 October 2026;
- all eligible detail paths and fallback identities are unique;
- full source/host/location/image/detail validation applies to the nine relevant
  rows; irrelevant historical fields, ended 2026 fields, and HTML comments do
  not freeze publication;
- a mid-event proof retains Franchise India with nine rows, and a post-exact-end
  proof removes it with eight rows;
- deterministic nine-record view SHA-256:
  `a86c9104fd86bc42e45edafe84b8510227d6ea7b642b01b597dc5d7cdb2285f2`;
- focused live/sandbox/mutation/schema tests: 6/6 passed;
- authoritative 27-field Go schema validation: passed for all nine rows;
- strict source-manifest validation and source formatting: passed.

Cloudflare injects per-response telemetry into the HTML, so the raw response
hash is immutable evidence for that observation, not a future equality gate.
Card structure, cardinality, canonical records, hosts, and identities are the
deterministic gates.

Robots returned 200 and allows `/` for `User-agent: *` with reference use while
reserving AI training. Conventional terms/privacy paths returned 404. Baahar's
gate is facts-only, attributed, one-page, low cadence, and no LLM use.

## Publication boundary

Exactly one authenticated create used official `@brightdata/cli` 0.3.5 with
`--no-retry`, the exact canonical input, and the tracked 500-character prompt.
The API token was mapped into the CLI process only.

- collector ID: `c_mt199f5m1k5i18ud1i`;
- name: `baahar-biec`;
- terminal status: `done` after 127 polls;
- created: `2026-08-20T08:25:20.122Z`;
- view: `https://brightdata.com/cp/scrapers/c_mt199f5m1k5i18ud1i`;
- private immutable create envelope: 378 bytes;
- envelope SHA-256:
  `84584569f39fd6eb89f6eb4019d7d6b9512fa687488ec8129be332a3e65ca22e`.

The private envelope is ignored under `../private/create-envelope.json`. The
CLI envelope exposes status and completed generation steps, not the generated
stage/code shape. No retry, duplicate create, heal, or approval occurred during
this creation gate.

## Studio development proof — 20 August 2026

The generated fan-out stage was removed after explicit approval. Development
now has one Code stage containing the tracked worker, an empty parser,
screenshots off, the exact canonical input, and the shared 27-field presentation
schema. The schema remained canonical after Studio's incompatible-schema
confirmation.

Studio's explicit preview and automatic save probe did not consistently provide
`job.created`: the observed values included an internal Date object and missing,
null, or empty values. The tracked worker captures one stage-clock instant for
those shapes, while invalid strings, numbers, and plain objects still fail before
transport. A supplied valid timestamp remains authoritative.

Explicit successful preview `i-preview_mt1chvar71w2vcw1l` completed with one
page load, nine output rows, and no source or transport error. The private full
export `lines (3).json` is untracked:

- 7,193 exact bytes;
- SHA-256:
  `d8603a1a6a321b61e7a08ada608d96b0e9d78f19361686f6b0c9a2b800640a8e`;
- nine records with exactly 27 keys each and no transport metadata;
- nine unique official detail URLs and fallback identities;
- one uniform `observed_at`: `2026-08-20T09:57:07.991Z`;
- authoritative Go schema validation: passed for all nine records;
- replacing only the dynamic `observed_at` with the fixed local observation
  reproduces canonical record SHA-256
  `a86c9104fd86bc42e45edafe84b8510227d6ea7b642b01b597dc5d7cdb2285f2`;
- tracked worker SHA-256:
  `e595ba1ea564bdf7c60d9ef27ad5bfe8d8640c2647d6fb1ea04bf9deef025998`;
- focused test SHA-256:
  `4240959738902f89d161082927752e41ca9e3ae0dd66f7006fd55a0920bb941b`;
- fresh focused live/sandbox/mutation/schema tests: 6/6 passed.

The canonical presentation schema was then persisted after the incompatible-
schema confirmation. The final Save to development reran successfully with nine
outputs, `Total page loads: 1`, no Last errors, a reviewed changelog, and the
green `Saved template and its linked collector` confirmation. Studio redirected
and did not retain or expose that final save-preview ID. Reloading the saved Code
page shows the one tracked stage, empty parser, and `No errors found`. Earlier
failed previews were limited to the now-reviewed `job.created` presentation
shapes; they were not source or transport failures.

## Controlled repair review — 20 August 2026

A controlled development-only selector drift changed the single reviewed
`event-tit` selector to `event-title`. Production and Baahar's last-known-good
publication remained untouched. Development preview
`preview_mt1mwg2b17sl30ku7a` performed one request, collected zero rows, and
failed atomically with `BIEC eligible box left the modern card contract`.

Official CLI 0.3.5 then ran one same-Collector-ID repair with `--no-retry` and
without auto-approval. It reached `awaiting_approval` after 458 polls. The
private 2,889-byte envelope has SHA-256
`7108342753f1197b6e4c02a4605eb44587f351e6e54caf3c6e25ad42f8f4a59c`.
The account login created the CLI's standard `cli_unlocker` and `cli_browser`
zones; no credential was printed or committed.

Human review rejected the proposal. Its one-stage candidate was not an exact
repair: it added both `event-title` and `event-tit` selectors plus explanatory
code instead of restoring the single reviewed selector, changed template
metadata, and exposed only two preview samples. The proposed worker was 22,585
bytes with SHA-256
`26459baeb5663667128ea684ea5e643c569f3c45c0aef0ef91b87748fd23ccbb`,
while the healthy tracked worker remained byte-identical at SHA-256
`e595ba1ea564bdf7c60d9ef27ad5bfe8d8640c2647d6fb1ea04bf9deef025998`.
The private 532-byte rejection envelope has SHA-256
`89999b98c219670dcd9db8eb7f0d996e776005732e8c43258754031e0abe507`.

One post-rejection Development verification returned the complete healthy nine
rows. Its private output is 7,598 bytes with SHA-256
`56b9eca4839572a9f13bf460e02db80b1f38a91182a7e3676d4d6bc163bfe8d1`:
each row has the exact 27 canonical fields plus the reviewed `input` transport
member, all nine pass the authoritative Go schema and BIEC semantic gates, and
the uniform observation is `2026-08-20T15:09:10.862Z`. The focused live,
mutation, and schema suite also remains 6/6 green.

This is evidence that the human approval boundary works; it is not claimed as a
successful repair. No proposed change was approved, saved to Production, run
through the application worker, or published.

## Immutable production batch — 20 August 2026

The same reviewed one-stage Code template was promoted to Production before the
authorized batch. Exactly one asynchronous API trigger was issued with the one
canonical input and was never retried:

- collection ID: `j_mt1d7c531xivuenyfs`;
- trigger request: 38 bytes, SHA-256
  `aac6e4d9dfecb82b4f07c919a4123e6d6a867b99d272419e31e540c6d62c41b7`;
- trigger response: HTTP 200, 79 bytes, SHA-256
  `7d212fd8a5e03d374b8f217d898aa41c0f801d045c81d346321f6bda6c2ff67c`;
- dataset polls: HTTP 202, 202, then 200;
- each pending response: 55 bytes, SHA-256
  `ff2f8ff073c6aaf37e2601dde6c32c5add156123847cb54ac04ad7a5791d2210`;
- immutable terminal dataset: 9,282 bytes, SHA-256
  `c464b808bf76458f0691b76e775bb5435fe276becb40808afb53653dcded9d0d`;
- exact output: nine chronologically ordered records and nine unique fallback
  identities;
- uniform observation: `2026-08-20T10:15:46.668Z`.

Every raw row has exactly the shared 27 canonical fields plus Bright Data's
`input` transport member. Every `input` is exactly the reviewed one-member
manifest object. Removing only that verified member in memory produced records
that all passed the authoritative global Go collector schema and the complete
BIEC semantic gate: exact reviewed facts, official detail and image hosts,
matching local dates and timed boundaries, scheduled status, BIEC venue,
`Asia/Kolkata`, and no invented registration, price, language, audience, or
accessibility facts.

The exact request, response, every poll, terminal dataset, and validation
summary are ignored under `../private/production-batch-20260820/`. No raw
transport was rewritten into a tracked fixture. There was no retry, heal,
duplicate collector, editor action, backend invocation, or second Bright
collection in this gate.

The collector became `verified` at this boundary. Application activation was
then completed as the separate reviewed gate below.

## Application activation and immutable replay — 20 August 2026

Migration `000009_biec` registered the exact manifest projection under stable
URL UUIDv5 `520e6232-ab55-5c71-8918-bb68a659ae61`. Before migration, the four
existing source rows were frozen with their due timestamps untouched. Their
full row-state fingerprint was identical before and after restoration:
`2ccf9f374495e941b24d2abf7388c948`.

The protected operator API queued one activation and the sole runnable job was
processed by one worker while every source remained scheduler-frozen:

- application run: `01a01eb8-5dfc-7820-9949-c9303bf6adad`;
- job: `01a01eb8-5dfd-7097-8067-0a218b4e328c`, completed on attempt one;
- Bright collection: `j_mt1dptco2jzl79lcsu`;
- immutable object:
  `sources/520e6232-ab55-5c71-8918-bb68a659ae61/runs/01a01eb8-5dfc-7820-9949-c9303bf6adad.json`;
- exact object: 9,282 bytes, SHA-256
  `216fdb936b13615afb7404594832fd734e9c96910bab01b1655bf96d98340a93`;
- terminal publication: 9 received, 9 accepted, zero quarantined;
- uniform source observation: `2026-08-20T10:30:03.562Z`.

An independent MinIO stream read reproduced the exact byte count and SHA. The
nine stored rows retain the reviewed titles, official URLs, local dates, exact
09:00–18:00 timed boundaries, BIEC venue, first-party images, null native IDs,
and nine unique fallback identities.

The protected replay used the same immutable object without a Bright call:

- replay run: `01a01eba-763e-729a-93b7-8675c3112f56`;
- replay job: `01a01eba-763e-7a91-b656-444e6212cbaa`, attempt one;
- `external_collection_id`: null;
- same raw key, 9,282 bytes, and SHA-256;
- terminal replay: 9 accepted, zero quarantined.

Occurrence/version/change/outbox cardinalities remained exactly `89/93/0/93`
across replay. The API returned 77 chronologically ordered Bengaluru events
from four sources over unique 60+17 cursor pages, including all nine BIEC rows;
one BIEC detail, valid ICS, and fresh source summary returned 200. The final
queue has ten completed jobs, zero ready or leased jobs, no nonterminal run, and
no open incident. All five source rows are active; temporary API and worker
processes were stopped after verification.

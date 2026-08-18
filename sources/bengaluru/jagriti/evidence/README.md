# Jagriti Theatre live evidence

Reviewed on 18 August 2026. Exact service responses and the derived validation
view are private and ignored by Git. This ledger records non-secret IDs, hashes,
counts, and validation facts.

## Collector

- Collector: `c_msywx7up19xi1xi8v`
- Name: `baahar-jagriti-events-v1`
- Input: the exact bare official What's On URL in `source.yaml`
- Worker: the reviewed Code worker in `../collector/worker.js`
- Output: the exact 27-field `event-occurrence/v1` schema

The one permitted CLI create finished with status `done` after 150 status
polls. There was no create retry, second collector, heal, or generated repair.
Its private 389-byte envelope has SHA-256
`df95c4d8b336acc1a64b44844395c5edecdd66e0cf0d5e938541a25faf2aedd4`.

The signed-in editor was manually reduced to one Code stage with the exact
tracked interaction code, an empty parser, one canonical project input, and the
27 canonical output fields. Its explicit preview made seven page loads and
emitted eleven records. The separate save probe passed, and the reviewed draft
was saved to Production.

## Production batch

- Collection: `j_msyxv7fo2e50rbybif`
- Trigger response: HTTP 200
- Trigger bytes: 79
- Trigger SHA-256:
  `d075412af9a50889aa7cc3c3fd84df49be5f3db544e644f794c747dd38dcbed6`
- Trigger start ETA: `2026-08-18T17:30:49.274Z`
- Dataset polls: HTTP 202 three times, then HTTP 200
- Records: 11
- Raw bytes: 13,875
- Raw SHA-256:
  `bffca8bff8981e8721203c41744efe46f8c7dd7d44e72c0e3ad97f1872308cba`
- Unique fallback identities: 11

Every raw row has one uniform 28-key transport shape: the 27 canonical fields
plus Bright Data's `input` member. Every `input` is exactly the one-member
manifest object and exact official URL. The three reviewed unsupported fields
(`source_event_id`, `registration_state`, and `accessibility_note`) are present
with JSON null values; no canonical null field was dropped.

Removing only the verified `input` transport member in memory produces one
uniform 27-key view. All eleven records pass the authoritative Draft 2020-12
schema with zero errors and pass the source semantic gates: exact hosts and URL
paths, timed and ordered starts/ends, matching local dates, paid INR mapping,
non-empty language and age guidance, official thumbnail and booking URLs,
source constants, and eleven unique fallback identities.

The private derived validation view is 10,849 bytes with SHA-256
`ccd0f0156083dd78959916483a28bacc29b31948401df465ebc832bc64a1ea13`.
It is not the raw response: the immutable 13,875-byte Bright Data artifact is
stored separately and was not rewritten. No backend worker was invoked as part
of this source proof.

## Backend publication

Migration `000003_jagriti_source` registered the reviewed collector as an
active Bengaluru source. The protected operator endpoint used idempotency key
`jagriti-live-proof-20260818-v1`; two identical requests returned the same run
and created one collection job.

- Run: `01a015f3-317e-7c5f-8347-2e02b5a01ed8`
- Bright collection: `j_msyy3wx41ejhhxe9v5`
- Raw object:
  `sources/de7c8acb-0185-5994-b1b4-290029c3ed5f/runs/01a015f3-317e-7c5f-8347-2e02b5a01ed8.json`
- Raw bytes: 13,875
- Raw SHA-256:
  `3606173cea40b8f1d77ea315b98b6040e8e05b3c154791202f1d6ac10c85c0ba`
- Received / accepted / quarantined: 11 / 11 / 0
- Published occurrences / versions / material changes: 11 / 11 / 0

MinIO metadata, a fresh object read, the collection run, and the PostgreSQL
publication all report the same byte count and SHA-256. The different hash from
the earlier explicit batch is expected: both are immutable source snapshots
from separate collection times.

The public weekend feed exposed four current performances with exact price,
language, age guidance, official registration URL, and source attribution.
Detail, empty first-version change history, iCalendar, and the fresh Jagriti
source summary returned their contracted responses.

Replay idempotency key `jagriti-live-replay-20260818-v1` produced one replay
run, `01a015f5-8d14-7eaa-a153-84eb683b8c9c`. It reused the exact raw object,
byte count, and SHA-256 without a Bright collection ID or second external
collection. It accepted the same eleven rows while occurrence, version, and
change counts remained 11 / 11 / 0.

# BIC live evidence

Reviewed on 18 August 2026. Raw responses are private and ignored by Git. This
file records only non-secret identifiers, hashes, counts, and validation facts.

## Collector

- Collector: `c_msyr5ts21rq3nfjxrz`
- Name: `baahar-bic-events-v1`
- Input: the bare official BIC Tribe Events endpoint in `source.yaml`
- Worker: the reviewed Code worker in `../collector/worker.js`
- Production preview: 17 records from the complete declared source result

The production editor was saved only after the bare-input preview returned all
17 source events. The editor's project specification and manual initiation form
both showed the bare endpoint.

## Rejected runs

The first generated worker returned an empty JSON array. Its exact private
artifact is 2 bytes with SHA-256
`4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945`.
It was rejected as empty output. Two later AI-heal previews were also rejected:
one emitted invalid contract values and only two rows, and the other emitted a
raw wrapper instead of occurrence records. Neither proposal was approved.

## Production batch before explicit null defaults

- Collection: `j_msytoj21q6quhql1u`
- Trigger response: HTTP 200
- Start ETA: `2026-08-18T15:33:40.963Z`
- Dataset response: HTTP 200
- Records: 17
- Bytes: 16,998
- SHA-256: `c5eb867a68a4ddb096db246c8723ac4419af258b4f1f23c58d58aac8f7142081`
- Unique native event IDs: 17
- Declared source total: 17

This raw delivery is quarantined. Bright Data adds an `input` transport member
to every row and its output-schema serialization omits eight fields whose value
is null in every BIC record. The raw rows therefore do not satisfy
`collector-output.schema.json` directly and must not be published as canonical
occurrences.

A non-mutating boundary check verified that every transport `input` is exactly
the reviewed manifest URL. After removing only that member and restoring only
the eight reviewed unknown fields as null, all 17 records have the exact 27-key
shape, pass the Draft 2020-12 contract with zero errors, retain 17 unique IDs,
use only the canonical source/event/image host, and have ordered timestamps.
This check demonstrates a possible deterministic transport normalization; it
is not publication approval. The raw bytes remain unchanged.

No sanitized public fixture exists until the transport boundary is approved
and the resulting canonical records pass the complete publication gate.

## Production batch with the reviewed 27-field output schema

After the Output Schema editor was reduced to the 27 canonical fields and the
eight reviewed unknown fields received explicit null defaults, a new 17-record
preview passed and the same collector was saved to production again.

- Collection: `j_msyu2o7z68pe5hlgs`
- Trigger response: HTTP 200
- Trigger start ETA: `2026-08-18T15:44:38.792Z`
- Dataset polls: HTTP 202, 202, 202, then 200
- Records: 17
- Bytes: 20,687
- SHA-256: `7e65fd62acf239bf146762cae5883be764f3b92fd14eae456f92dcd9199cb566`
- Unique native event IDs: 17

All 17 rows have one uniform 28-key delivery shape. Each of the eight reviewed
unknown fields is present with a JSON null value. Bright Data still adds the
documented `input` transport member, and every instance exactly equals the bare
manifest input object. Direct raw-schema validation therefore returns exactly
17 `additionalProperties` failures and no approval.

Removing only the verified `input` transport member in memory produces a
uniform 27-key shape: all 17 records pass the authoritative schema with zero
errors, have unique IDs, and have ordered timestamps. The exact raw artifact is
unchanged in private evidence. A `brightdata budget balance --json` check was
also attempted with the same configured token, but the account API returned
HTTP 403 because that token lacks account-balance permission; no credit value is
estimated or recorded.

## Platform references

- [Receive batch data](https://docs.brightdata.com/api-reference/scraper-studio-api/Receive_batch_data)
  documents the custom collector trigger/dataset flow and shows Bright Data's
  per-record `input` transport metadata.
- [Initiate collection and delivery](https://docs.brightdata.com/datasets/scraper-studio/initiate-collection-and-delivery-options)
  documents schema fields, types, and default-value controls.

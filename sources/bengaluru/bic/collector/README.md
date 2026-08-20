# BIC Scraper Studio worker

`worker.js` is the reviewed interaction code for the existing Code worker
`c_msyr5ts21rq3nfjxrz`. It accepts only the bare official BIC events endpoint,
derives a 31-day IST window from `job.created`, and collects every event from
at most two declared pages as `event-occurrence/v1`.

## Before editing Scraper Studio

Run the source contract test from `baahar/`:

```text
node --check sources/bengaluru/bic/collector/worker.js
node --test tests/live/bic-worker.test.mjs
```

The live test must report the same number of canonical records as source events
and verify every outbound page URL. A direct-source pass does not replace the
Scraper Studio proof below.

Use `contracts/scraper-studio-output-schema.json` for the shared 27-field Studio
presentation schema. `contracts/collector-output.schema.json` remains the
authoritative validation contract.

The current tracked worker adds the shared Workshops taxonomy and makes
source-explicit Dance outrank generic Performing Arts. This revision must pass
the procedure below before it is considered deployed.

## Reviewed dashboard procedure

1. Open `https://brightdata.com/cp/scrapers/c_msyr5ts21rq3nfjxrz` and choose
   **Code**. Keep the same Collector ID and select **Code worker**.
2. Keep one collection stage. Replace its interaction code with the complete
   contents of `worker.js`; remove any rejected two-stage wrapper or raw
   `events` output.
3. Keep the input schema to one string field, `url`. Preview with exactly:
   `https://bangaloreinternationalcentre.org/wp-json/tribe/events/v1/events`.
4. Inspect both Raw output and Formatted output. The collector payload must have
   exactly the 27 canonical keys, and `schema_version`, `time_precision`,
   categories, nulls, URLs and timestamps must match the repository contract.
5. Compare the preview count with the complete `events` arrays returned by the
   generated bounded page requests. A preview subset is not production proof.
6. Save to production only after the preview passes. Do not approve either
   rejected AI-heal proposal.
7. Trigger an explicit async batch using the same bare URL. Preserve the real
   `collection_id`, exact private response, byte count and SHA-256; require a
   1..100 count, source-count equality, unique Tribe IDs, official hosts, valid
   dates and schema validation for every canonical row.

Raw responses and tokens stay under `evidence/private/`. Only a sanitized,
schema-valid collector result may be committed as the public example.

## Transport bytes and canonical validation

The `GET /dca/dataset` response is immutable transport evidence. Store and hash
those bytes before attempting normalization. Bright Data currently attaches an
`input` object to every delivered row even though `input` is not a collector
field; its official batch-response example documents the same behavior.

The validation view is separate from those raw bytes. It may remove `input`
only after the object exactly equals the reviewed manifest input, must never
modify or overwrite a collector field, and must then satisfy the 27-field
authoritative schema. A mismatch in the transport object or any schema error
quarantines the batch. The source evidence ledger records both the untouched
raw hash and the result of this non-mutating validation view; it never presents
the validation view as the bytes Bright Data returned.

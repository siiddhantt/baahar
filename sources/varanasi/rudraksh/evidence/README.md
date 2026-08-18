# Rudraksh live evidence

Reviewed on 18 August 2026. Raw service responses are private and ignored by
Git. This ledger records only non-secret identifiers and verification facts.

## Collector

- Collector: `c_msyvmnoxwjdg7xe0p`
- Name: `baahar-rudraksh-events-v1`
- Production input: the exact bare official URL in `source.yaml`
- Worker: the reviewed Code worker in `../collector/worker.js`
- Output: the canonical 27-field `event-occurrence/v1` shape

## Rejected setup attempts

The one permitted CLI create made this collector, then its AI generation
terminated as failed after 19 polls in `user_intent_analyzer`. There was no
retry, heal, or second collector. The 302-byte private create envelope records
that terminal state.

The first deterministic dashboard preview failed before collection because the
Code-worker sandbox does not implement `Date.UTC`. Calendar validation was
replaced with reviewed Gregorian arithmetic and a local regression gate.

After an explicit eight-record preview passed, Scraper Studio's separate save
probe omitted `input.url` and correctly failed before save. The worker was then
narrowed so only `undefined` compiles to its single constant reviewed URL.
Null, non-string, and every supplied wrong URL remain rejected, and production
transport must still contain the explicit manifest input.

## Reviewed production save

The dashboard editor's normalized code matched the current reviewed worker.
With exactly one canonical input row, the explicit preview produced eight
records, eight collect calls, one page, and no error. The separate
undefined-input save probe then passed, and Bright Data reported that the
template and linked collector were saved. No generated repair was approved.

## Rejected production batch

The one permitted explicit production trigger returned HTTP 200:

- Collection: `j_msyw70x21kc3wdwft5`
- Start ETA: `2026-08-18T16:44:03.582Z`
- Trigger bytes: 79
- Trigger SHA-256:
  `076ab9c71c5daebdd2e9e8ed71473a33c9888f2664235054c6bbd420bab83ede`
- Dataset polls: HTTP 202 eight times, then HTTP 200
- Dataset bytes: 2
- Dataset SHA-256:
  `4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945`
- Dataset content: an empty JSON array

The batch is rejected as empty output. It cannot prove the transport `input`,
27-field schema, identities, or source count, and no canonical validation view
was written. The exact trigger, all pending-poll bodies, and final dataset are
quarantined privately. There was no second trigger, retry, or repair. The
dashboard preview is valid evidence of the reviewed worker interaction, but it
is not production API proof and must not be represented as one.

The signed-in production crawl inspector showed that Bright Data received one
exact reviewed input, then failed before page load with `Crawler error:
tunneling socket could not be established, statusCode=403` and `error_code:
proxy_config`. The job recorded zero records, one failed crawl, and zero cost.
This distinguishes the empty delivery from code, schema, and input rejection.

Bright's official functions reference documents the Code-worker-compatible
`country(code)` function for routing through a specific country. A reviewed
`country('in')` call was therefore added immediately before the sole request,
without a fallback, worker change, or retry. The documentation does not promise
that this function resolves the internal proxy error, so this is a
medium-confidence compatibility patch. One further reviewed production proof
is the stop boundary: if the same error persists, the source remains preview
and the affected job goes to Bright Data's collection-and-delivery support.

## Blocked routing diagnostic

The development draft logged `country('in')` and then the exact reviewed URL in
the required order. Its explicit preview failed before page load with the same
proxy tunnel HTTP 403. No row was parsed or collected. The stop boundary was
therefore reached: the diagnostic draft was not saved, no second production
batch was triggered, and no further repair is approved.

The collector remains Ready and Active on production v1, which does not contain
the India-route diagnostic. The source manifest stays public-preview only and
marks collection blocked by `bright_data_proxy_config`. Resolving that platform
failure requires Bright Data support, not extraction-code changes.

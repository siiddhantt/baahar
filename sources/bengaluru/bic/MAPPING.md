# BIC source mapping

## Source boundary

The Bangalore International Centre (BIC) is an official venue source. The
first collector reads its public Tribe Events JSON endpoint and emits one
record for each item in the top-level `events` array. Detail-page enrichment is
deferred until the listing slice is published end to end.

- Listing page: `https://bangaloreinternationalcentre.org/events/`
- Public endpoint: `https://bangaloreinternationalcentre.org/wp-json/tribe/events/v1/events`
- Canonical host: `bangaloreinternationalcentre.org`
- City and timezone: Bengaluru, `Asia/Kolkata`
- Source identity: the Tribe event `id`, represented as a string

The native Tribe ID is the stable occurrence identity and does not change when
the occurrence time changes. A time edit therefore creates a new version of the
same Baahar occurrence instead of a duplicate. If BIC later publishes one
parent event containing several performances, each performance must expose a
stable native performance ID or use the contract's reviewed URL/date/venue
fallback. Array position is never identity.

The source returned 17 events for 18 August through 18 September 2026 during
the initial review. That count is an observation, not a permanent threshold.

## Collector output to canonical occurrence

| Collector field | BIC field | Canonical handling |
| --- | --- | --- |
| `source_event_id` | `id` | Decimal string; required |
| `source_url` | `url` | HTTPS URL on the canonical host; required |
| `title` | `title` | Decode HTML entities, preserve Unicode, trim |
| `start_date` | date part of `start_date` | Local ISO date; required |
| `starts_at` | `utc_start_date` | Parse as UTC and serialize as RFC 3339 |
| `end_date` | date part of `end_date` | Local ISO date |
| `ends_at` | `utc_end_date` | Parse as UTC and serialize as RFC 3339 |
| `time_precision` | `all_day` and timestamps | `date` when all-day; otherwise `timed` |
| `timezone` | `timezone` | Must equal `Asia/Kolkata` |
| `venue_name` | `venue.venue` | Preserve official spelling |
| `venue_address` | venue address parts | Join only non-empty source values |
| `image_url` | `image.sizes["8-col-4-3-hard"].url` | Prefer the official 800x600 card rendition; fall back to `image.sizes.large.url`, then `image.url`, then null |
| `status` | `status` | WordPress `publish` means `scheduled`, not proof against a detail-page cancellation |
| `observed_at` | collection job time | RFC 3339 timestamp supplied at collection time |

The source's `cost` and `website` fields were empty for all 17 initial records.
Therefore `is_free`, price fields, `registration_url`, and
`registration_state` remain `null`. Empty cost must never become free entry.

## Deterministic category mapping

BIC may attach several categories to one event. Apply the first matching rule
in this order:

1. `Books`, `Literature`, `Biography`, or `Language` -> `books`.
2. `Music` -> `music`.
3. `Performing Arts` -> `theatre`.
4. `Visual Arts`, `Architecture`, `Design`, `Dance`, `Film`, or `Experience` -> `arts`.
5. `Workshops` -> `community`.
6. `Business`, `Cities`, `Climate Change`, `Defence & security`, `Development`,
   `Environment`, `Governance`, `History`, `Politics`, `Science`, `Society`, or
   `Sustainability` -> `talks`.
7. No match -> `other`.

HTML entities are decoded before matching. The mapping is reviewed source data,
not a runtime classifier.

## Publication and health facts

Hard failures:

- the API does not return HTTP 200 JSON;
- the top-level `events` member is not an array;
- a record lacks ID, title, URL, local start/end, UTC start/end, or timezone;
- an event URL leaves the canonical host;
- a numeric source ID repeats within the run;
- a timed end precedes its start;
- the source timezone is not `Asia/Kolkata`;
- more than 2% of records require quarantine;
- the run exceeds the manifest record or page budget.

Run-level count health uses a rolling median after three healthy runs. Before a
baseline exists, zero records or more than 100 records freezes publication.
Afterwards, a count below 40% or above 250% of the rolling median is suspicious.
One missing observation is never a cancellation; the BIC absence threshold is
two complete healthy observations.

The current source API is the correctness anchor, not Baahar's controlled
self-heal demo. Its canaries verify contract invariants rather than depending on
one event that may naturally expire.

## Access review

Reviewed 18 August 2026. `robots.txt` returned HTTP 200 and disallowed only
`/wp-admin/`, while explicitly allowing `/wp-admin/admin-ajax.php`; the public
events endpoint is outside the disallowed path. Collection remains bounded to
six runs per day and the manifest page limit. This robots observation is an
access signal, not a substitute for ongoing terms and policy review.

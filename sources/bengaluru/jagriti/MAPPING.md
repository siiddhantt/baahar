# Jagriti Theatre source mapping

## Source boundary

The collector reads only the exact official What's On page and the internal
detail URLs discovered inside its visible event rows:

- List: `https://www.jagrititheatre.com/jagriti-events-collections`
- Detail host: `www.jagrititheatre.com`
- Registration host: `in.bookmyshow.com`
- City and timezone: Bengaluru, `Asia/Kolkata`
- Venue: `Jagriti Theatre`
- Native per-performance ID: none

Detail paths are one clean lowercase slug segment. Ports, credentials, query,
fragment, alternate hosts, redirects supplied as data, and external detail URLs
are rejected before request. The worker does not crawl arbitrary links.

## Canonical occurrence

| Canonical field             | Source mapping                                              |
| --------------------------- | ----------------------------------------------------------- |
| `schema_version`            | Constant `event-occurrence/v1`                              |
| `source_event_id`           | Null; BookMyShow ID is shared by several performances       |
| `source_url`                | Exact official production detail URL                        |
| `source_host`               | `www.jagrititheatre.com`                                    |
| `city_slug`                 | `bengaluru`                                                 |
| `title`                     | Exact list title, cross-checked with detail `h1` and span   |
| `category`                  | Reviewed explicit-genre rules below                         |
| `start_date`                | Date component of structured performance start              |
| `starts_at`, `ends_at`      | Structured local values with `+05:30`                       |
| `end_date`                  | Date component of structured performance end                |
| `time_precision`            | `timed`                                                     |
| `timezone`                  | Structured value, required to equal `Asia/Kolkata`          |
| `venue_name`                | Fixed reviewed official name `Jagriti Theatre`              |
| `venue_address`             | Fixed official contact-page address                         |
| `is_free`                   | False for an explicit positive rupee price; true for `Free` |
| price fields and `currency` | Exact ticket rupees converted to minor INR units            |
| `registration_url`          | Exact unique BookMyShow link, cross-checked list to detail  |
| `registration_state`        | Null; a booking link does not prove current availability    |
| `status`                    | `scheduled` for a future structured row on What's On        |
| `language`                  | Explicit detail language value, split only on commas        |
| `age_note`                  | Exact detail age value                                      |
| `accessibility_note`        | Null in this slice                                          |
| `image_url`                 | Official list thumbnail rendition                           |
| `observed_at`               | Collection job creation time                                |

The fixed address is the official contact-page value normalized only for
whitespace: `Jagriti, Ramagondanahalli, Varthur Road, Whitefield, Bengaluru
560066, India`.

Category uses only explicit genre words, in this order:

1. Music, concert, jazz, or vocal -> `music`.
2. Theatre, drama, comedy, psychological, or tragedy -> `theatre`.
3. Dance, Bharatanatyam, or visual art -> `arts`.
4. Talk or lecture -> `talks`.
5. Otherwise -> `other`.

## Identity

`source_event_id` is null because neither Jagriti nor BookMyShow supplies a
per-performance ID. The backend fallback uses normalized title, canonical
detail URL, exact local occurrence time, and normalized venue. Array position
is never identity. Four performances of 12 Angry Men therefore remain distinct
even though they share one detail page and one BookMyShow ID.

A changed slug or timestamp cannot be silently reconciled. It follows the
reviewed alias/migration path; exact duplicate fallback tuples reject the full
run.

## Hard failure gates

- production input is the exact bare list URL; only Scraper Studio's undefined
  save probe may compile to that same constant URL;
- default Code-worker routing, one list request, and 1..25 unique internal
  detail requests in visible list order;
- exactly one reviewed list body with 1..25 visible rows and 1..50 total
  performances;
- one title, detail URL, official thumbnail, explicit price, non-empty genre,
  BookMyShow link, and 1..10 structured performance blocks per list row;
- one detail `h1`, one exact five-label metadata table, one BookMyShow link, and
  1..10 structured performance blocks per detail;
- list/detail title, price, genre, registration URL, and complete occurrence
  signatures agree;
- strict calendar/time parsing, `Asia/Kolkata`, end after start, declared
  duration equal to every interval, including completed intervals;
- after complete validation, emit only performances whose start is at or after
  the job's observed Asia/Kolkata minute; a production may contribute zero
  current rows, but zero future rows across the whole source rejects the run;
- every event and image URL uses the allowlisted HTTPS host/path with no port;
- BookMyShow query is absent or exactly `webview=true`; registration state stays
  null;
- every row has the exact 27 canonical keys, supported facts only, bounded text,
  and a unique fallback identity;
- any page or row failure rejects the complete run before `collect()`.

The source is active after its local live gate, explicit Bright Data production
batch, backend publication, replay, and mixed-source browser checks passed.

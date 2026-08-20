# Atta Galatta mapping

## Source boundary

The collector accepts exactly:

`https://attagalatta.com/events.php`

It issues one Code-worker `request()` and parses the JSON once. Explicit ports,
query strings, fragments, alternate hosts, and paths fail before the request.
Scraper Studio's undefined-input save probe may compile only to the same constant
URL. There is no browser, pagination, detail fan-out, or application request.

The response must be a bounded top-level `{resp, value}` object. The worker
validates the complete array's source shape, sequence number, native ID, and
string transport fields before deriving the current horizon. Official detail and
image URLs are then required for every eligible occurrence. This prevents stale
archive rows with a missing image from suppressing current inventory while still
making any current host or path drift fatal.

## Eligibility and freshness

A row is eligible only when its exact source date is from the observed
Asia/Kolkata calendar date through 90 calendar days later, inclusive. A same-day
row whose source start time already passed is excluded. At least 3 and at most
100 future rows must remain.

Eligible rows must be chronological and their `eventid` values must be unique.
Historical parent IDs are allowed to repeat outside the horizon, but a repeated
eligible ID fails closed because one parent ID cannot identify two occurrences.

## Canonical mapping

| Canonical field                           | Atta Galatta field         | Rule                                                                     |
| ----------------------------------------- | -------------------------- | ------------------------------------------------------------------------ |
| `source_event_id`                         | `eventid`                  | Exact `EVT` identifier; allowed only when unique in the eligible horizon |
| `source_url`                              | `link`                     | Exact first-party `event_page.php?eventid=...` URL                       |
| `source_host`                             | endpoint/detail host       | `attagalatta.com`                                                        |
| `city_slug`                               | reviewed official calendar | `bengaluru`                                                              |
| `title`                                   | `title`                    | Decode supported entities, collapse whitespace, preserve Unicode         |
| `category`                                | empty current `subtitle`   | `other`; no title-keyword inference                                      |
| `start_date`                              | `day`, `month`, `year`     | Strict ISO date cross-checked against `eventday` and `monthname`         |
| `starts_at`                               | date + `eventstarttime`    | Strict 12-hour source time serialized with `+05:30`                      |
| `end_date` / `ends_at`                    | unavailable                | Null; no duration or same-day end is inferred                            |
| `time_precision`                          | exact start time           | `timed`                                                                  |
| `timezone`                                | reviewed city contract     | `Asia/Kolkata`                                                           |
| `venue_name` / `venue_address`            | unavailable per event      | Null; the site footer is not treated as a per-row venue fact             |
| `image_url`                               | `image`                    | Exact first-party `/admin/uploads/events/` JPG, JPEG, or PNG URL         |
| `registration_url` / `registration_state` | unavailable                | Null; the detail page is not a registration URL                          |
| `status`                                  | future dated row           | `scheduled`                                                              |
| `observed_at`                             | `job.created`              | Valid RFC 3339 instant normalized to UTC                                 |

`subtitle`, `host`, and `description` are source fields without matching v1
canonical fields. Current subtitle/host are empty and description is deliberately
not copied. Price, free state, currency, language, age, and accessibility remain
unknown.

## Identity and atomicity

The native `eventid` is stable when one event's time changes. If it occurs more
than once inside the horizon, the run fails instead of misusing a parent ID for
multiple occurrences. `Sno` and array position are forbidden identity inputs.

The worker validates response bounds, all source rows, sequence completeness,
hosts and paths, current dates/times, exact 27-field records, count, chronological
order, and ID uniqueness before the first `collect()`. Any defect emits zero
partial records.

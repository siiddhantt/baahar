# India Habitat Centre mapping

## Source boundary

The collector accepts exactly `https://indiahabitat.org/Events`. Explicit
ports, alternate hosts, paths, query strings, fragments, and credentials fail
before transport. Scraper Studio's undefined-input save probe may compile only
to the same constant.

One Code stage makes one request and one HTML parse. It reads the unique
`#all-events` current-month calendar. Category tabs are presentation duplicates
and are ignored. There is no browser navigation, pagination, PDF request,
detail fan-out, retry, classifier, LLM, or aggregator input.

## Freshness and time

The worker derives Delhi local time from `job.created` and accepts only a page
whose named month/year equals that local month/year. An occurrence is eligible
when its exact local start minute is not earlier than the observed local minute
and its date is inside the inclusive 90-day ceiling.

IHC supplies no end time on the list. `end_date` and `ends_at` remain null. The
worker must not infer a duration, so it cannot safely retain an occurrence as
ongoing after its start minute. This favors removal of possibly started events
over showing a possibly ended event as upcoming.

## Canonical mapping

| Canonical field        | Official list fact                        | Rule                                                   |
| ---------------------- | ----------------------------------------- | ------------------------------------------------------ |
| `source_event_id`      | terminal number in `/Events_details/{id}` | Required decimal string; stable source identity        |
| `source_url`           | matching card action links                | Canonical first-party detail URL                       |
| `source_host`          | reviewed host                             | `indiahabitat.org`                                     |
| `city_slug`            | official IHC location proof               | `delhi`; preview only, with no registered city         |
| `title`                | `h3.event-name`                           | Exact Unicode text with whitespace collapsed           |
| `category`             | source type before <code>&#124;</code>    | Exact mapping below; no title or description inference |
| `start_date`           | current month/year plus day cell          | Strict local ISO date                                  |
| `starts_at`            | date plus `h4.event-time`                 | Exact RFC 3339 timestamp with `+05:30`                 |
| `end_date` / `ends_at` | unavailable                               | Null                                                   |
| `time_precision`       | exact list time                           | `timed`                                                |
| `timezone`             | reviewed city contract                    | `Asia/Kolkata`                                         |
| `venue_name`           | source venue after <code>&#124;</code>    | Exact reviewed room name or `Online`                   |
| `venue_address`        | official location page                    | IHC address for reviewed physical rooms; null online   |
| `image_url`            | `.event-img img`                          | Canonical `/uploads/` image on the first-party host    |
| `status`               | presence in upcoming primary calendar     | `scheduled`; no claim beyond current list evidence     |
| `observed_at`          | collection clock                          | Normalized `job.created` UTC timestamp                 |

`is_free`, price, currency, registration URL/state, language, age, and
accessibility remain null or empty. The detail page is an action/source URL,
not automatically a registration URL.

## Deterministic source-type mapping

| Exact source type | Baahar category |
| ----------------- | --------------- |
| `Music`           | `music`         |
| `Dance`           | `arts`          |
| `Film`            | `arts`          |
| `Film & Talk`     | `talks`         |
| `Film & Theatre`  | `theatre`       |
| `Theatre`         | `theatre`       |
| `Talk`            | `talks`         |
| `Music & Dance`   | `arts`          |
| `Walk`            | `community`     |
| `Workshop`        | `workshops`     |
| `Online`          | `other`         |
| `Other`           | `other`         |

An unlisted type stops the run for mapping review. For example, the source type
`Talk` remains `talks` even when the title says “Book Discussion”.

## Identity, URLs, and atomicity

Every accepted card must repeat one matching detail URL across its image,
title, and More Info links. Its terminal decimal ID is the native identity and
must be unique in the run. Array position is forbidden. If IHC later publishes
the same detail ID for several performances, collection stops until it exposes
a stable performance identity or a reviewed occurrence fallback is approved.

Detail URLs are restricted to `/Events_details/{decimal_id}`. Images are
restricted to first-party `/uploads/{digits}_{source-token}.{jpg|jpeg|png|webp}`
paths. Physical venues are restricted to the four currently proved IHC rooms;
new labels require review.

The worker completes response, page, month, pagination, card, category, venue,
URL, image, schema, order, count, and duplicate validation before the first
`collect()`. Any failure emits no partial feed.

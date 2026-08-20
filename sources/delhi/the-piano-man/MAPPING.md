# The Piano Man Delhi mapping

## Source and traversal boundary

Input is exactly `https://www.thepianoman.in/event/list`; undefined save-probe
input compiles only to the same constant. Explicit ports, alternate hosts,
paths, queries, fragments, credentials, and non-string values fail before
transport.

One Code stage derives local date minus one day and requests exactly 13
first-party `/event/list/YYYY-MM-DD` JSON windows. Each response must contain
only `html` and the exact next seven-day `addSevenDate`. The worker parses each
HTML fragment once. There is no Browser worker, login, cookies, header trick,
POST, detail fan-out, page cursor, retry, healing, or generic crawler.

## Canonical mapping

| Canonical field        | Official card fact                         | Rule                                                       |
| ---------------------- | ------------------------------------------ | ---------------------------------------------------------- |
| `source_event_id`      | number-word suffix in detail slug          | Longest canonical English-number suffix                    |
| `source_url`           | card action                                | Exact first-party `/event/detail/<venue_id>/<slug>` URL    |
| `source_host`          | reviewed host                              | `www.thepianoman.in`                                       |
| `city_slug`            | official IDs 1 and 2 + New Delhi addresses | `delhi`                                                    |
| `title`                | direct card `h3`                           | Decode entities and collapse whitespace                    |
| `category`             | exact source genre                         | Deterministic table below; never inspect title/description |
| `start_date`           | exact `DD.MM.YY` card date                 | Strict local ISO date                                      |
| `starts_at`            | unavailable                                | Null; source publishes seating time, not event start       |
| `end_date` / `ends_at` | unavailable                                | Null                                                       |
| `time_precision`       | source date only                           | `date`                                                     |
| `timezone`             | Delhi contract                             | `Asia/Kolkata`                                             |
| `venue_name`           | exact ID/name pair                         | One of the two reviewed Delhi venues                       |
| `venue_address`        | official embedded venue record             | Exact reviewed venue address                               |
| `is_free`              | positive ticket price                      | `false`                                                    |
| `price_min_minor`      | exact `Rs. N` card value                   | Integer rupees multiplied by 100                           |
| `price_max_minor`      | list cannot prove all ticket tiers         | Null                                                       |
| `currency`             | `Rs.`                                      | `INR`                                                      |
| `registration_url`     | ticketed first-party detail page           | Same canonical URL as `source_url`                         |
| `registration_state`   | list does not prove availability           | Null                                                       |
| `image_url`            | card image                                 | Reviewed first-party event/artist upload path              |
| `status`               | presence in official future board          | `scheduled`                                                |
| `observed_at`          | collection clock                           | Normalized `job.created` UTC instant                       |

Language, age, and accessibility remain empty/null. Descriptions and performer
profiles are not collected.

## Exact genre mapping

The following current source labels map to `music`: `Alternative Rock`,
`Blues`, `Bollywood`, `Classic Rock`, `Ethno Jazz`, `Folk`, `Ghazal`, `Indian
Classical`, `Indian Fusion`, `Instrumental`, `Jazz`, `Jazz Fusion`, `Modern
jazz`, `Pop`, `Pop Rock`, `Psychedelic Rock`, `Qawwali`, `Retro`, `Retro pop`,
`Rock`, `Singer - Songwriter`, `Soft Rock`, `Sufi`, and `World Music`.

| Exact source label | Baahar category | Reason                                           |
| ------------------ | --------------- | ------------------------------------------------ |
| `Film Screening`   | `arts`          | Source-explicit medium                           |
| `Theatre`          | `theatre`       | Source-explicit medium                           |
| `Lunch Sessions`   | `other`         | Label alone does not prove event medium          |
| `Recital`          | `other`         | Could be music, dance, or another performance    |
| `Contemporary`     | `other`         | Source label is not a cross-city Baahar category |

`Private Event` is not mapped. It is accepted only when the same card says
`Venue Closed` and `NON-TICKETED`, then excluded as non-public. Any other
non-ticketed row or new genre stops for review.

## Freshness, identity, and atomicity

The 13 windows cover the inclusive local date range today through day 90.
Events outside that range fail the window contract. Same-day cards whose exact
seating minute is earlier than observation are dropped; the source gives no end
time, so no ongoing inference is allowed.

The decoder accepts the longest canonical number-word suffix from 1 to 9999.
This handles a real current title ending in a number (`Level Six`) without
mistaking that title token for the native ID. It is compared with an independent
venue segment and exact source venue name. Numeric identity, detail URL, and
image URL must be unique where applicable. All 13 responses and all current
cards—including filtered Gurugram and private-closure cards—are validated
before the first `collect()` call.

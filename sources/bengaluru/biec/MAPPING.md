# BIEC mapping

## Source boundary

The collector accepts exactly `https://www.biec.in/events`. It requests and
parses that official server-rendered page once. Explicit ports, alternate hosts,
paths, query strings, and fragments fail before transport. Scraper Studio's
undefined-input save probe may compile only to the same constant URL.

The observed page has 243 archive boxes and 128 modern cards, but those counts
are diagnostics rather than run gates. The worker derives the calendar years
intersecting the observed Asia/Kolkata date through 90 local calendar days later
and requires exactly one labelled tab and one mapped public-DOM container for
each. On 20 August 2026 that is only the 2026 tab, containing 45 cards.

Every card in a required-year container must expose a strict date and time range.
Only cards whose start is not after the horizon and whose exact end is later
than the observed local instant receive full title, organizer, location, image,
detail, host, and identity validation. A public-DOM card outside the mapped
containers whose parsed range overlaps the horizon fails closed. Historical or
already-ended fields and HTML comments are ignored.

There is one page, one request, no pagination, and no detail fan-out.

## Freshness

An occurrence is eligible when its start date is at or before the inclusive
90-day horizon and its exact end instant is later than the observed local minute.
This retains an ongoing multi-day event after it begins and removes it after its
exact end. All eligible rows are sorted by exact start and title before output;
between 3 and 50 must remain.

## Canonical mapping

| Canonical field           | BIEC fact                     | Rule                                                                                           |
| ------------------------- | ----------------------------- | ---------------------------------------------------------------------------------------------- |
| `source_event_id`         | unavailable                   | Null; neither array position nor a derived slug is promoted to a native ID                     |
| `source_url`              | matching title/Read More href | Exact first-party `/Calendar_event/2kYY/*.php` URL whose path year matches the occurrence year |
| `source_host`             | reviewed host                 | `www.biec.in`                                                                                  |
| `city_slug`               | exact card location           | `bengaluru`, only when every modern card says `Bengaluru, Karnataka`                           |
| `title`                   | `a.event-tit`                 | Whitespace-collapsed exact source text                                                         |
| `category`                | unavailable                   | `other`; organizer/title keywords are not categories                                           |
| `start_date` / `end_date` | `.event-date p`               | Strict source calendar range                                                                   |
| `starts_at` / `ends_at`   | date plus `.event-time p`     | Exact daily start/end with `+05:30`                                                            |
| `time_precision`          | exact time range              | `timed`                                                                                        |
| `timezone`                | reviewed city contract        | `Asia/Kolkata`                                                                                 |
| `venue_name`              | official venue calendar       | `Bangalore International Exhibition Centre`                                                    |
| `venue_address`           | unavailable per card          | Null; city text is not expanded into an address                                                |
| `image_url`               | `.box-image`                  | Canonical first-party `/images/events/` image                                                  |
| `status`                  | eligible ongoing/upcoming row | `scheduled`                                                                                    |
| `observed_at`             | collection execution clock    | `job.created` normalized to UTC when supplied; otherwise the Studio stage clock                |

The organizer is checked as source evidence but v1 has no organizer field.
Registration, availability, price, free state, currency, language, age, and
accessibility are unknown and remain null or empty. The detail page is not
mislabelled as a registration URL. Descriptions are not copied.

## Identity and atomicity

The fallback identity is normalized title + canonical detail URL + local start +
normalized venue. Every eligible detail URL and fallback tuple must be unique.
The detail path is a strong source-owned anchor, but the whole fallback can still
change when the source corrects a time; only an explicit reviewed alias may join
those identities. Array position is forbidden.

The worker completes input, response, page, required-year/date/time coverage,
escaped-row checks, relevant location/image/detail-host validation, schema,
order, count, and identity validation before the first `collect()`. Any failure
emits no partial feed.

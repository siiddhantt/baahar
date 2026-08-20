# BHU Academic Events mapping

## Source boundary

The collector accepts exactly one manifest input:

`https://www.bhu.ac.in/Site/EventsList/1_2_16_Main?Upcoming`

It makes exactly one Code-worker POST to the source page's reviewed first-party
`/Homepage/GetAcademicEvents` endpoint. The `content-type` is
`application/json; charset=UTF-8` and the body equals
`{obj:{"Action":4,"UnitId":"2"}}`. There is no navigation, response tag,
cookie/session bootstrap, parser stage, or detail fan-out. A missing or
differently shaped response fails before collection.

The reviewed complete response is bounded to 1,000,000..4,000,000 characters
and 1..1,000 rows. This rejects a partial transport view before mapping.

## Eligibility

A `Table1` row is eligible only when all of these source facts hold:

1. `EventType` is exactly `Upcoming`.
2. The parsed start date is from the observed Asia/Kolkata calendar date
   through 90 calendar days later, inclusive.
3. `OpenTo` is exactly `All`.
4. The decoded, normalized `Location` contains the word `Varanasi`.

Rows outside the city, audience, or time boundary are deliberately excluded.
At least 3 and at most 20 eligible rows must remain. The full eligible set is
validated before the first `collect()` call.

## Canonical mapping

| Canonical field    | BHU field                     | Rule                                                                                                     |
| ------------------ | ----------------------------- | -------------------------------------------------------------------------------------------------------- |
| `source_event_id`  | `AcademicEventsId`            | Positive integer serialized as a decimal string; stable native identity                                  |
| `source_url`       | native detail route + ID      | Deterministic official detail URL                                                                        |
| `source_host`      | page/API host                 | Always `www.bhu.ac.in`                                                                                   |
| `city_slug`        | strict `Location` filter      | Always `varanasi` after the eligibility gate                                                             |
| `title`            | `EventName`                   | Decode HTML entities, collapse whitespace, preserve Unicode                                              |
| `category`         | explicit title tokens         | Workshop or summer school -> `workshops`; seminar, conference, or conclave -> `talks`; otherwise `other` |
| `start_date`       | `EventFromDate`               | Strict source date converted to ISO date                                                                 |
| `end_date`         | `EventToDate`                 | Strict source date converted to ISO date                                                                 |
| `starts_at`        | start date + `EventStartTime` | RFC 3339 with `+05:30`; null only when both time fields are absent                                       |
| `ends_at`          | end date + `EventEndTime`     | RFC 3339 with `+05:30`; null only when both time fields are absent                                       |
| `time_precision`   | source time fields            | `timed` when both are present; otherwise `date`                                                          |
| `timezone`         | reviewed city contract        | `Asia/Kolkata`                                                                                           |
| `venue_name`       | `Location`                    | Decoded source spelling                                                                                  |
| `status`           | `EventType`                   | Exact `Upcoming` becomes `scheduled`                                                                     |
| `registration_url` | `AcademicEventsDetails`       | One exact `forms.gle` URL only when details explicitly label it a registration link; otherwise null      |
| `observed_at`      | `job.created`                 | Valid RFC 3339 job timestamp                                                                             |

Price, currency, registration state, venue address, language, age,
accessibility, and image stay null or empty because the listing response does
not support them consistently. A brochure link is not a registration link.

## Identity and atomicity

`AcademicEventsId` is the occurrence identity. Time or title changes retain the
same identity. IDs must be unique across all source-declared upcoming rows and
across the emitted set. Array position is never used.

The worker validates the fixed request contract, response shape, every eligible
row, record count, IDs, dates, time types/order, hosts, URLs, and the complete
27-field contract before emitting anything. A time field must be source text or
explicitly null/undefined/empty; numbers and objects fail rather than becoming
date-only records. Any failure produces zero partial records.

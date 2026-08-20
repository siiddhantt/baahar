# Prithvi Theatre mapping

## Source boundary

The Code worker accepts only the byte-exact official JSON endpoint:

`https://prithvitheatre.org/api/getPrithviData?cmd=DEGETTHEATERS&cc=PTHV`

It rejects alternate hosts, explicit ports, credentials, reordered or extra
query parameters, fragments, and every other path before transport. Scraper
Studio's undefined save probe may compile only to the same constant URL.

One response supplies the complete schedule. There is one request, one JSON
parse, no HTML parse, browser navigation, detail fan-out, pagination, runtime
discovery, retry loop, or LLM step.

## Join and occurrence model

The worker builds reviewed maps for `aVN`, `aEV`, and `aSI`, then joins each
`aST` timed row using native IDs:

- `aST.SessionId == aSI.SessionId`
- event code, date, venue, and availability agree across the two session rows;
- the event code resolves to exactly one `aEV` production;
- the venue code resolves to exactly one of the three reviewed `aVN` spaces;
- numeric and displayed start times agree;
- end follows start, with next-day rollover supported;
- native session IDs and event/date/time/venue tuples are both unique.

`EventCode` is a production ID and may have several performances. It is never
used as the occurrence identity. `SessionId` is the source-owned native
occurrence ID and is emitted as `source_event_id`; array position is forbidden.

## Canonical field mapping

| Canonical field      | Official fact and rule                                                                                                             |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `source_event_id`    | Exact numeric `aST.SessionId`                                                                                                      |
| `source_url`         | Fixed official booking page `https://prithvitheatre.org/booktickets`                                                               |
| `source_host`        | `prithvitheatre.org`                                                                                                               |
| `city_slug`          | `mumbai`, cross-checked from venue and session region fields                                                                       |
| `title`              | Exact whitespace-normalized `aEV.EventTitle`                                                                                       |
| `category`           | Exact six-value genre map in `source.yaml`; unknown genre fails                                                                    |
| start/end fields     | `aST.ShowDateCode`, `ShowTimeNumeric`, `ShowTimeDisplay`, and `EndShowTimeDisplay` with `+05:30`                                   |
| `venue_name`         | Exact reviewed `aVN.Venue_strName` for `PHTV`, `PRCE`, or `PTHV`                                                                   |
| `venue_address`      | Exact common `aVN.Venue_strAddress`                                                                                                |
| price fields         | Decimal-rupee `aEV.MinPrice` multiplied by 100; zero is free, positive values become minimum INR minor units, maximum remains null |
| `registration_url`   | Exact BookMyShow event/plays URL supplied by `aEV` and ending in the matching EventCode                                            |
| `registration_state` | `aST.SeatsAvail`: `Y -> open`, `N -> sold_out`; unknown value fails                                                                |
| `status`             | `scheduled` only while `aST.SessionStatus` is `Y`; unknown status fails review                                                     |
| `language`           | Explicit `aEV.strLanguage`, split only on `/`                                                                                      |
| `age_note`           | Whitespace-normalized explicit `aEV.Event_strAgeLimit`, otherwise null                                                             |
| `image_url`          | The official client construction `https://in.bmscdn.com/Events/moviecard/{ImageCode}.jpg`                                          |
| `observed_at`        | Studio job clock normalized to UTC                                                                                                 |

No synopsis, producer inference, venue geocoding, price maximum, accessibility
claim, or category guess is added.

## Freshness and atomic failure

A session is retained while its exact end is later than the observed local
minute and its start date is no more than 90 local calendar days ahead. Ongoing
performances survive until their end; ended performances disappear. Between 3
and 100 rows must remain.

The worker validates response size and JSON shape, the complete venue/event/day
and timed-session joins, dates, times, URLs, price, languages, categories,
identity, order, 27-field shape, record count, and source boundaries before the
first `collect()`. Any drift rejects the whole batch with zero partial rows.

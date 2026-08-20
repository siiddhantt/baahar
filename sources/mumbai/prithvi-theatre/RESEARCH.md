# Prithvi Theatre source research

Observed on 20 August 2026.

## Why this source qualifies

Prithvi's official booking page currently advertises 49 exact upcoming
performances across theatre, music, talks, screenings, storytelling, and an
open-mic programme. These are public, actionable Mumbai events at Prithvi's
three co-located spaces. The source has enough recurring inventory to justify a
maintained collector rather than a one-event special case.

The page's own client calls exactly:

`https://prithvitheatre.org/api/getPrithviData?cmd=DEGETTHEATERS&cc=PTHV`

That endpoint returned `200 application/json; charset=utf-8`, 41,892 bytes, and
SHA-256 `fab5ec2efe8e600a705fb9360a19d6d4e8b113386c2b39f6ad8d74cf166fc152`.
The response has one root `BookMyShow` object and four arrays:

| Array | Rows | Role                                                                                               |
| ----- | ---: | -------------------------------------------------------------------------------------------------- |
| `aVN` |    3 | First-party venue names and exact shared address                                                   |
| `aEV` |   28 | Production facts, native event code, price, genre, language, age, image code, and registration URL |
| `aSI` |   49 | Native session/date/venue/region and availability                                                  |
| `aST` |   49 | Native session/date plus exact start/end time                                                      |

Every `aST.SessionId` has exactly one matching `aSI` row; every session joins to
one event and one venue; all 49 native session IDs and all 49
event/date/time/venue occurrence tuples are unique. The response contains no
page, next, cursor, or pagination field. The official client query takes only
`cmd` and venue/company code, so a complete run is one Code-worker request with
no HTML parser, browser, detail request, pagination, or crawler.

## Current result

At the fixed evidence clock `2026-08-20T00:00:00.000Z`, all 49 timed sessions
fall inside the inclusive 90-local-day horizon and end after observation. The
normalized batch SHA-256 is
`8faf79fcba46243715e9b679de69564bb07e8db8a5fd4ca366c4c19d5c980885`.

Category totals are:

- `theatre`: 44 performances (`Drama,Theatre` and `Drama,Storytelling`)
- `music`: 2 performances (`Music Shows`)
- `arts`: 2 performances (`Performances` and `Screening`)
- `talks`: 1 performance (`Talks`)

Four performances have an explicit zero minimum price and map to free. The
other 45 retain only the explicit minimum INR price; no maximum is invented.
`MinPrice` is expressed in decimal rupees: for example, the API's `500.00` for
LOVE & LAVANI agrees with the public BookMyShow price of Rs 500 and maps to
`50000` INR minor units.
All 49 session rows currently say `SessionStatus=Y` and `SeatsAvail=Y`, so their
registration state is `open`.

## Access review

`https://prithvitheatre.org/robots.txt` returned 200. It explains optional
content signals but publishes no `User-agent`, path `Disallow`, or actual
search/AI signal value. The exact public booking page and API path are therefore
not disallowed by that file.

Conventional general terms paths returned 404. The only terms link in the
footer is a BookMyShow-hosted `Workshops@Prithvi T&Cs` PDF and does not govern
the ordinary theatre schedule. Missing general terms are not permission. This
implementation is therefore limited to low-cadence factual metadata, one
request, source attribution, and direct official/registration links. Recheck
robots and site terms before activation.

## Known launch gates

This lane intentionally stops at `local_verified`:

1. Mumbai is accepted by the staging collector contract but is not yet
   provisioned in the backend city registry/database.
2. No Bright Data collector has been created or tested.
3. No immutable Bright batch or backend replay exists.
4. The source is not active and the frontend is unchanged.

Those gates must be completed in order; the local worker must not be presented
as published production coverage.

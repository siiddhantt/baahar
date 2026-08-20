# BHU Academic Events source research

Reviewed live on 19 August 2026.

## Why this source

Banaras Hindu University publishes a first-party academic-events page for its
departments and institutes. It is meaningfully broader than one conference:
workshops, seminars, conferences, summer schools, and conclaves share one
official source with stable native IDs.

The visible page is an Angular template. Event records are not embedded in its
raw HTML; the page makes one first-party POST request to
`/Homepage/GetAcademicEvents`. A fresh direct POST with the exact public request
body returned the same complete response without cookies, anti-forgery tokens,
or a browser session. A one-request Code worker is therefore the narrowest
source boundary. No navigation, parser stage, detail-page fan-out, PDF parsing,
OCR, or runtime classification is required.

## Current inventory and transport shape

Fresh observations:

- page URL: `https://www.bhu.ac.in/Site/EventsList/1_2_16_Main?Upcoming`;
- raw page: HTTP 200, 29,128 UTF-8 bytes;
- API path: `https://www.bhu.ac.in/Homepage/GetAcademicEvents`;
- direct public request: POST with content type
  `application/json; charset=UTF-8` and body
  `{obj:{"Action":4,"UnitId":"2"}}`;
- API response: HTTP 200, 1,778,717 UTF-8 bytes;
- response shape: top-level `Table` and `Table1` arrays;
- source rows: 756 total, 20 marked `Upcoming`;
- rows starting from 19 August through 17 November 2026: 15;
- rows whose own `Location` contains `Varanasi` and whose `OpenTo` equals
  `All`: 10;
- pagination, cursor, load-more, and detail fan-out: none.

The ten strict current IDs were `6386`, `6383`, `6382`, `6389`, `6385`,
`6381`, `6397`, `6396`, `6376`, and `6387`. This is a dated observation, not a
permanent allowlist. The collector filters source records by reviewed facts and
does not hardcode those IDs.

Five in-window rows were conservatively excluded. Their source location either
named Bengaluru or Barkachha, or did not itself contain `Varanasi`. This loses
some likely BHU-main-campus events by design; Baahar does not infer city from a
department name.

## Access and policy

`https://www.bhu.ac.in/robots.txt` returned 404, so no robots directives were
published at the reviewed path. The official terms page states that users
should verify information with the relevant department and contains no
automated-access prohibition. Baahar keeps the run facts-only, links back to
the native event detail, and collects one public response at a six-hour
cadence. A missing robots file is not treated as affirmative permission and
must be re-reviewed if the site publishes one.

The page and API were directly reachable during local review. Bright Data
access remains unproven until one separately authorized Scraper Studio preview
passes; no collector exists for this source yet.

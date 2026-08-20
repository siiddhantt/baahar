# BIEC source research

Observed on 20 August 2026.

## Product value

The official Bangalore International Exhibition Centre calendar adds nine
current trade, professional, medical, space, manufacturing, dental, building,
and furniture events to Bengaluru. These are useful planning records that do not
overlap Atta Galatta's literary/community focus or Jagriti's theatre focus.

The one official page is sufficient. The nine current cards expose exact title,
organizer, start/end dates, daily opening hours, Bengaluru location, first-party
detail link, and first-party image. No description, booking state, audience,
price, or free claim is needed.

## Transport and page boundary

`https://www.biec.in/events` returned `200 text/html` as server-rendered HTML.
The current response contains:

- 243 historical `div.box` elements across year tabs;
- 128 cards using the reviewed modern `a.event-tit` contract, distributed as 30
  in 2024, 52 in 2025, 45 in 2026, and one in 2027;
- 45 cards in the only year tab intersecting the observed 90-day horizon: 2026;
- exactly nine occurrences starting from the observed local date through 90
  Asia/Kolkata calendar days later;
- no `rel=next`, pager, pagination, load-more control, RSS, or source API;
- no list/detail fact dependency.

The archive counts are diagnostics, not publication gates. For each calendar
year intersecting the observed local date through the 90-day horizon, the worker
maps the labelled year tab to its public DOM container and parses every card's
date and time. It fully validates title, location, image, detail link, and
identity only for an ongoing or in-horizon occurrence. Already-ended 2026 cards,
the 2024/2025 history, the out-of-horizon 2027 tab, and HTML comments do not
freeze current publication. A separately placed public-DOM card whose parsed
range overlaps the horizon still fails as an escaped occurrence.

A one-stage Code worker is the narrow justified Scraper Studio shape: one
`request()`, one `load_html()`, no Browser worker, pagination, detail fan-out,
actions, retry, crawler framework, LLM, or copied aggregator data.

## Access review

`https://www.biec.in/robots.txt` returned 200. Its Cloudflare-managed `User-agent:
*` block allows `/` and publishes `search=yes`, `ai-train=no`, and
`use=reference`. Baahar stores only short event facts and official links; it does
not train or run an LLM over the page. `CloudflareBrowserRenderingCrawler` is
disallowed, which independently favors the raw Code worker.

The conventional `/terms`, `/terms-and-conditions`, and `/privacy-policy` paths
returned 404. Missing terms are not permission. The bounded response, facts-only
mapping, low cadence, source attribution, and official click-through are the
reviewed boundary; access must be rechecked if the source publishes new terms.

## Current inventory

| Start  | End         | Time        | Title                                  |
| ------ | ----------- | ----------- | -------------------------------------- |
| 22 Aug | 23 Aug 2026 | 09:00–18:00 | Franchise India                        |
| 5 Sep  | 7 Sep 2026  | 09:00–18:00 | India Med Expo                         |
| 7 Sep  | 9 Sep 2026  | 09:00–18:00 | Bangalore Space Expo                   |
| 16 Sep | 18 Sep 2026 | 09:00–18:00 | Electronica- Productronica             |
| 16 Sep | 18 Sep 2026 | 09:00–18:00 | LWOP                                   |
| 25 Sep | 27 Sep 2026 | 09:00–18:00 | HBLF                                   |
| 25 Sep | 27 Sep 2026 | 09:00–18:00 | Expodent                               |
| 9 Oct  | 11 Oct 2026 | 09:00–18:00 | Acetech                                |
| 24 Oct | 26 Oct 2026 | 09:00–18:00 | Hindustan International Furniture Fair |

The page also lists later November and December 2026 events, but their starts
are outside the reviewed 90-day horizon on 20 August. The January 2027 card is
also outside it. A multi-day occurrence remains while its exact end is later
than the observed local instant, even after its start has passed.

## Risks and stop conditions

- There is no native event ID. The current fallback tuple is collision-free and
  anchored by a unique first-party detail path, but a schedule correction can
  change the fallback identity; it must be repaired by an explicit alias rather
  than pretending the tuple is immutable.
- Organizer text is validated but cannot be represented in the v1 occurrence
  contract. It is not substituted into title, venue, or category.
- Historical source markup contains known anomalies. Only intersecting year tabs
  are required, and only exact date/time parsing is required before relevance is
  known, so irrelevant history and ended rows cannot suppress current facts.
- Zero partial rows are allowed. A required-year selector or date/time failure,
  an escaped in-horizon card, or a relevant host, location, image, detail,
  duplicate-identity, count, or pagination drift stops the complete run before
  `collect()`.
- A local pass is not Bright proof or publication. Collector creation remains
  separately authorized.

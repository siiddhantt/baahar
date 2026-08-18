# Baahar launch source catalog

Research date: 18 August 2026

## 1. Scope and selection method

Baahar targets public, long-tail event surfaces maintained by the venue,
institution, organiser, or public authority. A launch source must:

- publish public event facts without login or paywall;
- provide enough identity/date evidence to avoid inventing a listing;
- add events that are plausibly missed by general ticketing marketplaces;
- permit conservative collection under its public access/robots behaviour;
- have a viable Scraper Studio collector and health contract;
- justify its page cost and operational maintenance.

This catalog is a research inventory, not permission to scrape every candidate.
Before enabling a collector, record robots/terms review, fetch bounds, contact
policy where appropriate, and an example output fixture.

## 2. Launch recommendation

### Bengaluru launch four

| Priority | Source | Why it belongs | Scraper Studio shape | Cadence |
| --- | --- | --- | --- | --- |
| 1 | [Bangalore International Centre](https://bangaloreinternationalcentre.org/events/event-calendar/) | High-volume current talks, performances, workshops; native IDs/modified times in its public events JSON | Code worker: public JSON, optional detail follow | 2–4h |
| 2 | [Jagriti Theatre](https://www.jagrititheatre.com/) | Multi-performance theatre with current dates and booking links | Code worker: list to detail | 2–4h |
| 3 | [Atta Galatta](https://attagalatta.com/calendarpage.php) | Literary, workshop, and community events from a custom long-tail calendar | Code worker: calendar to detail | 2–4h |
| 4 | [Goethe-Institut Bangalore](https://www.goethe.de/ins/in/en/rss/bag/ver.rss) | Official RSS correctness anchor plus detail pages | Code worker: RSS to detail | 6–12h |

Current research examples include BIC's 18 August `Decoding Behavioural
Insights`, Jagriti's 21 August `Confessions from Mental Asylum` and 22–23 August
`12 Angry Men`, and three separate Atta Galatta events on 21 August. Live records
must be rechecked at implementation time; this document is not feed data.

### Varanasi launch four

| Priority | Source | Why it belongs | Scraper Studio shape | Cadence |
| --- | --- | --- | --- | --- |
| 1 | [Rudraksh Centre](https://www.rudrakshcentre.com/upcoming-event) | Clean official venue table with current Aug–Oct inventory | Code worker: static table | 4–6h |
| 2 | [Subah-e-Banaras](https://subahebanaras.net/events/) | Distinct daily cultural programme; direct fetch reliability makes Bright Data useful | Code worker first: cards to detail, unblocking/retries | 2–4h |
| 3 | [Kashi official portal](https://darshan.kashi.gov.in/listing/events) | Government city/event surface with rituals and cultural cards | Code worker against SSR first; Browser worker only if required | 6h |
| 4 | [IIT (BHU)](https://www.iitbhu.ac.in/) and [event archive](https://www.iitbhu.ac.in/events) | Public institutional programmes split between current homepage rail and archive | Code worker: merge homepage/archive, follow detail/PDF | 12h |

Rudraksh currently lists an exhibition on 22–23 August, a satsang on 29–31
August, and later September/October inventory. Kashi recurring rituals must not
be presented as newly announced one-off events. IIT(BHU) eligibility remains
unknown unless the official item explicitly calls the audience public.

### Release floor

Eight is the target, not an excuse for shallow implementation. Release requires
at least three healthy collectors in each city. The fourth collector is enabled
only after the first three pass live schema, identity, change, and health tests.

## 3. Why the two cities

### Bengaluru

Bengaluru has the strongest initial source depth: theatres, museums, bookshops,
cultural institutes, scientific institutions, and public talks on maintainable
official surfaces. It is the best place to prove feed usefulness and data
quality across varied event types.

Bright Data's [About page](https://brightdata.com/about) describes a global team
that includes India, and it offers [Bangalore-targetable proxy
infrastructure](https://brightdata.com/locations/in/bangalore). Its current
[Careers page](https://brightdata.com/careers) does not establish a Bengaluru
office or India team concentration. The project must not claim that the city was
chosen because Bright Data has an office there.

### Varanasi

Varanasi proves the product is not only a metro ticket feed. Valuable official
events are spread across a convention centre, daily cultural programme,
government portal, universities, temple schedules, and seasonal cultural sites.
The inconsistent structures, slow responses, dated pages, multilingual content,
and recurring programmes create a legitimate Scraper Studio and self-healing
challenge.

Coverage is curated and source-backed, never described as exhaustive.

## 4. Scraper Studio mapping

Use Bright Data's current terminology:

- **Code worker** for static HTML, RSS, sitemaps, public JSON, and most list/detail
  navigation. It is the faster/cheaper default.
- **Browser worker** only when an essential field requires JavaScript rendering,
  an interaction, or captured background network traffic.

Official reference: [worker types](https://docs.brightdata.com/datasets/scraper-studio/worker-types).

Do not select Browser worker because a site looks modern. Test the raw response
first. Kashi may expose enough SSR content for Code worker; upgrade only if a
required occurrence fact is absent. The legacy BHU EventsList template is a
browser candidate, but it is not a launch source while the newer activity/home
surfaces are sufficient.

Use multi-stage `next_stage()` fan-out for listing/detail sites and `collect()`
with a validation function for the output. References: [Scraper Studio
functions](https://docs.brightdata.com/datasets/scraper-studio/functions) and
[develop a scraper](https://docs.brightdata.com/datasets/scraper-studio/develop-a-scraper).

## 5. Bengaluru candidate matrix

| # | Source | Feasibility and risk | Status |
| ---: | --- | --- | --- |
| 1 | [BIC calendar](https://bangaloreinternationalcentre.org/events/event-calendar/) | Public Tribe Events JSON exposes IDs, dates, categories, venue and modification time; detail HTML can add registration state. Bright Data is useful for a uniform managed pipeline, not for unblocking here. | Launch |
| 2 | [Jagriti Theatre](https://www.jagrititheatre.com/) | Server-rendered cards and multiple performances; external booking may own sold-out truth. | Launch |
| 3 | [Atta Galatta](https://attagalatta.com/calendarpage.php) | Custom PHP calendar; bound selectors carefully because the response also contains a bookstore catalogue. Detail URL is the stable source identity. | Launch |
| 4 | [Goethe Bangalore RSS](https://www.goethe.de/ins/in/en/rss/bag/ver.rss) | Clean official XML discovery, then detail follow. Low-maintenance correctness anchor, not the self-heal showcase. | Launch |
| 5 | [NGMA Bengaluru](https://ngmaindia.gov.in/ngma_bangaluru_activities.asp) | Very large static ASP activity page; posters and repeated address/hours require strict card boundaries. | Next |
| 6 | [MAP](https://map-india.org/events/) | Rich detail pages and explicit free/closed/accessibility facts; discovery is fragmented across archive/search. Availability closed is not cancellation. | Next |
| 7 | [IISc events](https://www.iisc.ac.in/events/categories/events/) | Good public talks/culture; some midnight end times and campus-only ambiguity require fail-closed audience handling. | Candidate |
| 8 | [NCBS public events](https://www.ncbs.res.in/events/archives%40ncbs-public-opening) | Strong dates/organisers; public eligibility and registration windows require separate fields. | Candidate |
| 9 | [ICTS](https://www.icts.res.in/) | Programmes, talks and outreach; distinguish multi-day research programmes from public events. | Candidate |
| 10 | [Alliance Française](https://bangalore.afindia.org/events/categories/af-events/) | Event category mixes public events and course promotion; use a deterministic category allowlist. | Candidate |
| 11 | [Science Gallery Bengaluru](https://bengaluru.sciencegallery.com/) | Exhibitions/travelling programmes spread across several sections; preserve explicit closed states. | Candidate |
| 12 | [Ranga Shankara](https://rangashankara.org/book-tickets-show-all/) | Official theatre surface with repeated performances and occasional schedule PDFs; needs a collector spike. | Candidate |
| 13 | [BIEC](https://biec.in/) | Current trade/exhibition cards but lower general-consumer relevance and thin details. | Later professional lane |
| 14 | [Indian Music Experience](https://indianmusicexperience.org/mec-events/) | Event-capable archive, but latest indexed inventory appeared stale and access is inconsistent. | Hold |
| 15 | [ICSI Bengaluru](https://www.icsi.edu/bengaluru/events/details/) | Current professional programmes but mixed chapters and member eligibility. | Later professional lane |

Bengaluru's first six sources alone span talks, performance, books, workshops,
museums, and cultural programmes without copying BookMyShow or Instagram.

## 6. Varanasi candidate matrix

| # | Source | Feasibility and risk | Status |
| ---: | --- | --- | --- |
| 1 | [Rudraksh Centre](https://www.rudrakshcentre.com/upcoming-event) | Clean from/to/organiser/name table. Some names are generic and no booking/detail URL exists, so show exactly what is known. | Launch |
| 2 | [Subah-e-Banaras](https://subahebanaras.net/events/) | Daily performer cards, dates embedded in titles, ordering not reliable, direct audit fetch timed out. Strong resilience use case. | Launch |
| 3 | [IIT(BHU)](https://www.iitbhu.ac.in/) | Homepage can be fresher than `/events`; merge both, follow details/PDFs, keep audience unknown when unstated. | Launch |
| 4 | [Kashi portal](https://darshan.kashi.gov.in/listing/events) | Government Angular/SSR surface; recurring rituals and one-offs need different modelling. Several cards lack occurrence dates. | Launch |
| 5 | [BHU activities](https://news.bhu.ac.in/activities) | Official article stream; must reject retrospectives and non-event announcements. Legacy EventsList requires browser execution. | Next |
| 6 | [IGNCA Varanasi](https://ignca.gov.in/regional-centers/varanasi-events/) | Multilingual historical mega-list with infrequent updates; strong freshness gates required. | Candidate |
| 7 | [ICAR-IIVR](https://icariivr.org.in/) | Training calendar and PDFs; timeout observed and homepage widget may be stale, so reconcile with current document. | Candidate |
| 8 | [Vasant Kanya Mahavidyalaya](https://www.vkm.ac.in/) | Cards and cultural-calendar PDF; year/audience can be missing and many entries are student-facing. | Candidate |
| 9 | [Varanasi district/NIC](https://varanasi.nic.in/events/) | Government cards and documents; facility/program records must not become 365-day events. | Candidate |
| 10 | [NSD Varanasi](https://varanasi.nsd.gov.in/news/) | Event-capable news cards but current surface appeared stale and mixes admissions with performances. | Hold |
| 11 | [School of Management Sciences](https://smsvaranasi.com/) | Mostly retrospective news rather than upcoming listings; require future-date and registration evidence. | Hold |
| 12 | [Sampurnanand Sanskrit University](https://ssvv.ac.in/notice-board) | Large Hindi notice board with PDFs and audience ambiguity; a document pipeline, not launch inventory. | Later document lane |
| 13 | [Kashi Vishwanath daily schedule](https://skvtcard.charvns.com/general/dailyschedule) | Stable service/aarti timetable. Model as recurring schedule, never newly announced one-off events. | Next recurring lane |
| 14 | [Sankat Mochan Temple](https://sankatmochanmandirvaranasi.com/) | Important festival source but displayed dates were stale during research. | Seasonal hold |
| 15 | [Banaras Culture Biennale](https://www.ciibanarasculturebiennale.in/) | High-value seasonal programme likely to restructure each edition; version by festival year. | Seasonal candidate |

## 7. Source-specific facts the core must support

The matrix exposes the edge cases that define the real product:

1. one event with multiple performances;
2. a multi-day event versus repeated daily occurrences;
3. a recurring ritual versus a dated one-off programme;
4. explicit free, paid, and unknown price;
5. public, campus/member-only, and unknown audience;
6. registration closed/sold out on an external official booking page;
7. listing/detail/homepage disagreement;
8. date/year embedded in a title, poster, or PDF;
9. stale/retrospective news masquerading as upcoming inventory;
10. duplicate syndication across venue, institution, and government portal;
11. multilingual titles and diacritics;
12. slow/time-out sources and arbitrary HTML/Angular changes;
13. generic labels with too little detail;
14. source images/descriptions with restricted reuse;
15. robots, terms, rate-limit, and page-budget constraints.

Missing or ambiguous year/start date fails closed into quarantine. Images or PDFs
that require OCR are a separate deterministic document pipeline and are not
silently interpreted by an LLM.

## 8. Canonical-source precedence

When the same occurrence appears in multiple places:

1. official venue/organiser detail;
2. official institution detail;
3. official government city portal;
4. other reviewed public authority.

The preferred record supplies the public facts, but all corroborating source URLs
remain attached. Title similarity alone never causes a merge.

## 9. Bright Data justification

Scraper Studio is not included merely because the hackathon requires it. The
source matrix needs:

- one managed contract across JSON, RSS, static HTML, dynamic portals and detail
  fan-out;
- proxy/unblocking and retry behaviour for slow/inconsistent public sites;
- Code and Browser workers selected per source;
- schedules/API triggers with the real Collector IDs;
- structured output consumed by the database pipeline;
- a repair workflow when source structure changes;
- the same Collector ID after an approved self-heal.

Baahar contributes the part Scraper Studio should not own: cross-source identity,
semantic health gates, immutable snapshots, history/diffs, safe publication, and
the public feed.

Official Bright Data references:

- [Scraper Studio introduction](https://docs.brightdata.com/datasets/scraper-studio/introduction)
- [collection and delivery options](https://docs.brightdata.com/datasets/scraper-studio/initiate-collection-and-delivery-options)
- [API quickstart](https://docs.brightdata.com/datasets/scraper-studio/quickstart)
- [self-healing](https://docs.brightdata.com/datasets/scraper-studio/self-healing-tool)
- [Bright Data CLI](https://github.com/brightdata/cli)

## 10. Source onboarding checklist

A source cannot be enabled until all items pass:

- public authority and intended user value documented;
- robots/terms/access review recorded;
- canonical hosts and redirect policy allowlisted;
- Code worker attempted before Browser worker;
- output fixture and schema contract committed;
- timezone, missing year, multi-performance and recurring behaviour resolved;
- category and audience mapping reviewed;
- page/run and cadence budget set;
- normal, empty, malformed, duplicate and stale fixtures tested;
- live collection stored exactly and normalized without manual data edits;
- health baseline/canary defined;
- card/detail browser rendering checked in both themes;
- official-source link and attribution verified.


# Baahar launch source catalog

Research date: 20 August 2026

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

Current release state: BIC, Jagriti, Atta Galatta, and BIEC are active in
Bengaluru. BIEC's exact 9/9 zero-quarantine application publication, immutable
replay, and public API gates pass. BHU Academic Events is active in Varanasi
after its exact production artifact and 10/10 zero-quarantine backend
publication passed the public API gates.
Rudraksh has reviewed local extraction but remains disabled because its real
Scraper Studio production request failed inside Bright Data's proxy tunnel.
EMINDIA subsequently passed a 13-row dashboard preview, but its sole production
crawl failed before page load with Bright Data `proxy_config`/tunnel 403 and
returned exact `[]`. Bright Data ticket `#723252` confirmed that the target is
not allowlisted for this account and requires registered-business Full Access
KYC; it remains blocked and has no database source row.
No Varanasi rows are hardcoded or published as a fallback. BHU's public browser
journey now passes; the next source still proceeds through the same one-at-a-time
qualification and publication gates.

### Bengaluru launch four

| Priority | Source                                                                                            | Why it belongs                                                                                          | Scraper Studio shape                             | Cadence |
| -------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | ------- |
| 1        | [Bangalore International Centre](https://bangaloreinternationalcentre.org/events/event-calendar/) | High-volume current talks, performances, workshops; native IDs/modified times in its public events JSON | Code worker: public JSON, optional detail follow | 2–4h    |
| 2        | [Jagriti Theatre](https://www.jagrititheatre.com/)                                                | Multi-performance theatre with current dates and booking links                                          | Code worker: list to detail                      | 2–4h    |
| 3        | [Atta Galatta](https://attagalatta.com/calendarpage.php)                                          | Literary, workshop, and community events from its complete first-party event archive                    | Code worker: one official JSON request           | 2–4h    |
| 4        | [BIEC](https://www.biec.in/events)                                                                | Nine current professional and trade events on one complete official calendar                            | Code worker: one static HTML request             | 6–12h   |

Current research examples include Jagriti's 22–23 August `12 Angry Men` and 42
Atta Galatta events between 21 August and 4 October. Live records must be
rechecked at collection time; this document is not feed data.

### Varanasi coverage order

| Priority | Source                                                                                            | Why it belongs                                                                                       | Scraper Studio shape                                   | Cadence |
| -------- | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------ | ------- |
| 1        | [BHU Academic Events](https://www.bhu.ac.in/Site/EventsList/1_2_16_Main?Upcoming)                 | Broad official institutional feed; public JSON currently yields ten public Varanasi records with IDs | Code worker: one bounded official JSON POST            | 12h     |
| 2        | [Subah-e-Banaras](https://subahebanaras.net/events/)                                              | Distinct daily cultural programme; viable after current rows and reachability are re-proved          | Code worker first: cards to detail                     | 2–4h    |
| 3        | [IIT (BHU)](https://www.iitbhu.ac.in/) and [event archive](https://www.iitbhu.ac.in/events)       | Useful institutional pillar when the homepage/archive expose current public inventory                | Code worker: merge homepage/archive, follow detail/PDF | 12h     |
| 4        | [Varanasi district/NIC](https://varanasi.nic.in/events/) or another reviewed official city source | Government coverage only for dated, attendable events rather than facilities or missions             | Qualify only after BHU browser acceptance              | 12h     |

BHU is the current broad source pillar. Rudraksh and EMINDIA remain blocked by
Bright account/site-access policy, Kashi's current surface is too stale or
undated to publish safely, and IIT(BHU)'s visible archive is held until it again
contains current public inventory. Recurring rituals must never be presented as
newly announced one-off events.

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
required occurrence fact is absent. BHU Academic Events exposes a public JSON
POST without a browser session, so its reviewed collector is a one-request Code
worker.

Use multi-stage `next_stage()` fan-out for listing/detail sites and `collect()`
with a validation function for the output. References: [Scraper Studio
functions](https://docs.brightdata.com/datasets/scraper-studio/functions) and
[develop a scraper](https://docs.brightdata.com/datasets/scraper-studio/develop-a-scraper).

## 5. Bengaluru candidate matrix

|   # | Source                                                                              | Feasibility and risk                                                                                                                                                                                                                                     | Status                   |
| --: | ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
|   1 | [BIC calendar](https://bangaloreinternationalcentre.org/events/event-calendar/)     | Public Tribe Events JSON exposes IDs, dates, categories, venue and modification time; detail HTML can add registration state. Bright Data is useful for a uniform managed pipeline, not for unblocking here.                                             | Launch                   |
|   2 | [Jagriti Theatre](https://www.jagrititheatre.com/)                                  | Server-rendered cards and multiple performances; external booking may own sold-out truth.                                                                                                                                                                | Launch                   |
|   3 | [Atta Galatta](https://attagalatta.com/events.php)                                  | One official JSON response contains the complete 2,123-row archive and 42 current horizon events. Its one-stage collector, immutable publication, API, replay, and public browser gates pass.                                                            | Active                   |
|   4 | [Goethe Bangalore RSS](https://www.goethe.de/ins/in/en/rss/bag/ver.rss)             | The feed is reachable and structurally clean, but all ten items are past; its newest current observation is 25 July 2026.                                                                                                                                | Hold: zero current       |
|   5 | [NGMA Bengaluru](https://ngmaindia.gov.in/ngma_bangaluru_activities.asp)            | Very large static ASP activity page; the current top item is a job notice rather than a public event, and posters/repeated address/hours require strict card boundaries.                                                                                 | Hold                     |
|   6 | [MAP](https://map-india.org/events/)                                                | Rich official detail pages, but current terms prohibit automated scraping; do not collect without written permission.                                                                                                                                    | Reject without consent   |
|   7 | [IISc events](https://www.iisc.ac.in/events/categories/events/)                     | Good public talks/culture; some midnight end times and campus-only ambiguity require fail-closed audience handling.                                                                                                                                      | Candidate                |
|   8 | [NCBS public events](https://www.ncbs.res.in/events/archives%40ncbs-public-opening) | Nine exact current rows fit one static Code request with no pagination. Honour the ten-second crawl delay and keep specialist eligibility or application state unknown unless the official row says otherwise.                                           | Next Bengaluru candidate |
|   9 | [ICTS](https://www.icts.res.in/)                                                    | Programmes, talks and outreach; distinguish multi-day research programmes from public events.                                                                                                                                                            | Candidate                |
|  10 | [Alliance Française](https://bangalore.afindia.org/events/categories/af-events/)    | Event category mixes public events and course promotion; use a deterministic category allowlist.                                                                                                                                                         | Candidate                |
|  11 | [Science Gallery Bengaluru](https://bengaluru.sciencegallery.com/)                  | QUANTUM is current, but its programme surface is a JavaScript application with no reviewed raw event inventory; it needs a bounded Browser/API qualification before collection.                                                                          | Hold                     |
|  12 | [Ranga Shankara](https://rangashankara.org/book-tickets-show-all/)                  | Official theatre surface with repeated performances and occasional schedule PDFs; needs a collector spike.                                                                                                                                               | Candidate                |
|  13 | [BIEC calendar](https://www.biec.in/events)                                         | One official SSR page has one required 2026 year container with 45 date/time-parseable cards and nine ongoing/in-horizon events; no pagination/load-more/RSS or detail fan-out is needed for exact dates, organisers, times, location, images and links. | Active                   |
|  14 | [Indian Music Experience](https://indianmusicexperience.org/mec-events/)            | Event-capable archive, but latest indexed inventory appeared stale and access is inconsistent.                                                                                                                                                           | Hold                     |
|  15 | [ICSI Bengaluru](https://www.icsi.edu/bengaluru/events/details/)                    | Current professional programmes but mixed chapters and member eligibility.                                                                                                                                                                               | Later professional lane  |

Bengaluru's reviewed sources span talks, performance, books, workshops,
museums, and professional events without copying BookMyShow or Instagram.

## 6. Varanasi candidate matrix

|   # | Source                                                                                | Feasibility and risk                                                                                                                                                                                                                                                                                                                                                                                                                      | Status                |
| --: | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
|   1 | [Rudraksh Centre](https://www.rudrakshcentre.com/upcoming-event)                      | Clean from/to/organiser/name table. Local extraction is reviewed, but the production collector is blocked by an upstream proxy-tunnel error.                                                                                                                                                                                                                                                                                              | Blocked               |
|   2 | [Subah-e-Banaras](https://subahebanaras.net/events/)                                  | The origin is reachable again, but the current page contains retrospective performer posts and zero future rows. Do not synthesize future performers or dates from the recurring programme.                                                                                                                                                                                                                                               | Hold: zero current    |
|   3 | [BHU Academic Events](https://www.bhu.ac.in/Site/EventsList/1_2_16_Main?Upcoming)     | One public JSON POST yields ten published, in-horizon, `OpenTo=All`, Varanasi records with native IDs.                                                                                                                                                                                                                                                                                                                                    | Active                |
|   4 | [IIT(BHU)](https://www.iitbhu.ac.in/)                                                 | Homepage can be fresher than `/events`; current public inventory must be re-proved before work resumes.                                                                                                                                                                                                                                                                                                                                   | Hold                  |
|   5 | [Kashi portal](https://darshan.kashi.gov.in/listing/events)                           | Current surface mixes stale and undated recurring items; retain only as a discovery lead.                                                                                                                                                                                                                                                                                                                                                 | Hold                  |
|   6 | [BHU activities](https://news.bhu.ac.in/activities)                                   | Official activity stream; discovery-only because retrospective news can masquerade as upcoming inventory.                                                                                                                                                                                                                                                                                                                                 | Discovery             |
|   7 | [IGNCA Varanasi](https://ignca.gov.in/regional-centers/varanasi-events/)              | Multilingual historical mega-list with infrequent updates; strong freshness gates required.                                                                                                                                                                                                                                                                                                                                               | Candidate             |
|   8 | [ICAR-IIVR](https://icariivr.org.in/)                                                 | Training calendar and PDFs; timeout observed and homepage widget may be stale, so reconcile with current document.                                                                                                                                                                                                                                                                                                                        | Candidate             |
|   9 | [Vasant Kanya Mahavidyalaya](https://www.vkm.ac.in/)                                  | Cards and cultural-calendar PDF; year/audience can be missing and many entries are student-facing.                                                                                                                                                                                                                                                                                                                                        | Candidate             |
|  10 | [Varanasi district/NIC](https://varanasi.nic.in/events/)                              | Government cards and documents; facility/program records must not become 365-day events.                                                                                                                                                                                                                                                                                                                                                  | Discovery             |
|  11 | [NSD Varanasi](https://varanasi.nsd.gov.in/news/)                                     | Event-capable news cards but current surface appeared stale and mixes admissions with performances.                                                                                                                                                                                                                                                                                                                                       | Hold                  |
|  12 | [School of Management Sciences](https://smsvaranasi.com/)                             | Mostly retrospective news rather than upcoming listings; require future-date and registration evidence.                                                                                                                                                                                                                                                                                                                                   | Hold                  |
|  13 | [Sampurnanand Sanskrit University](https://ssvv.ac.in/notice-board)                   | Large Hindi notice board with PDFs and audience ambiguity; a document pipeline, not launch inventory.                                                                                                                                                                                                                                                                                                                                     | Later document lane   |
|  14 | [Kashi Vishwanath daily schedule](https://skvtcard.charvns.com/general/dailyschedule) | Stable service/aarti timetable. Model as recurring schedule, never newly announced one-off events.                                                                                                                                                                                                                                                                                                                                        | Later recurring lane  |
|  15 | [Sankat Mochan Temple](https://sankatmochanmandirvaranasi.com/)                       | Important festival source but displayed dates were stale during research.                                                                                                                                                                                                                                                                                                                                                                 | Seasonal hold         |
|  16 | [Banaras Culture Biennale](https://www.ciibanarasculturebiennale.in/)                 | High-value seasonal programme likely to restructure each edition; version by festival year.                                                                                                                                                                                                                                                                                                                                               | Seasonal candidate    |
|  17 | [EMINDIA 2026](https://www.galaxyregistration.com/event/skill-school/)                | Exact 13-row preview passed; production was account-policy blocked because the target requires registered-business Full Access KYC.                                                                                                                                                                                                                                                                                                       | Blocked               |
|  18 | [Dhamma Cakka schedule](https://schedule.vridhamma.org/courses/cakka)                 | One-page local contract yields seven dated courses; schema-aligned Studio access was stopped by the account proxy/allowlist boundary.                                                                                                                                                                                                                                                                                                     | Blocked               |
|  19 | [AllEvents Varanasi](https://allevents.in/varanasi/all)                               | Broad discovery pool, but reviewed rows contained date disagreements, duplicates, stale labels and venue ambiguity. Never a publication authority.                                                                                                                                                                                                                                                                                        | Discovery only        |
|  20 | [Kashi Sansad Events 2026–27](https://kashisansadevents.com/)                         | The official hub's rendered view exposes seven ongoing/in-horizon 2026 programmes at the 20 August boundary, and Varanasi District NIC links the programme family. Direct HTTP, HTTPS, and robots retrieval timed out; linked detail sites also contain conflicting dates and stale year copy. Keep the hub authoritative and create no collector until raw origin, robots/terms, complete one-page DOM, and one-request live gates pass. | Blocked qualification |

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

Scraper Studio is not included as decoration. The source matrix needs:

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
- output fixture, shared Studio presentation schema, and authoritative output
  contract committed;
- timezone, missing year, multi-performance and recurring behaviour resolved;
- category and audience mapping reviewed;
- page/run and cadence budget set;
- normal, empty, malformed, duplicate and stale fixtures tested;
- live collection stored exactly and normalized without manual data edits;
- health baseline/canary defined;
- card/detail browser rendering checked in both themes;
- official-source link and attribution verified.

## 11. Delhi and Mumbai qualification snapshot

Research-only recheck: 20 August 2026. The horizon is 20 August through
18 November 2026. Counts below are reproducible first-party records, not claims
that a city has no other events. `0 verified` means that no current, precise,
official inventory cleared the source gate. Search, BookMyShow, AllEvents and
social pages were discovery leads only. Request estimates count source documents
or API calls, not embedded page assets.

### Delhi

Delhi remains disabled and research-only. Government websites remain outside the
current collection policy while account access and reuse terms are unresolved,
so JNU, National Science Centre, Punjabi Academy, IGNCA, and the other public
authorities below are product-later research only. India Habitat Centre is the
first reviewed Delhi candidate and The Piano Man is the strongest second
implementation slice; both local contracts leave the city disabled.

| Rank | Official source and verified horizon inventory                                                                                                                                                                                                  | Reviewed surface and transport                                                                                                      | Authority, identity, request and access boundary                                                                                                                                                                                                                                                                            | Decision                                             |
| ---: | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
|    1 | [India Habitat Centre programme calendar](https://indiahabitat.org/Events): 20 exact current-month rows from 21–31 August                                                                                                                       | One static `#all-events` HTML calendar; category tabs are duplicates; no pagination or detail fan-out                               | First-party non-government venue; native `/Events_details/{numeric_id}` identity; 1 Code request. Robots and conventional terms/privacy paths return 404, so the reviewed boundary is low-cadence facts and official click-through, not a reuse licence.                                                                    | **Reviewed first Delhi candidate; local only**       |
|    2 | [The Piano Man event board](https://www.thepianoman.in/event/list): 69 Delhi rows across two venues; 67 public ticketed rows from 20 August–29 September                                                                                        | Thirteen exact seven-day JSON windows cover today through day 90; no Browser, login, POST, pagination cursor, or detail fan-out     | Private first-party operator; the longest canonical number-word suffix decodes the native numeric event ID, including a real title ending in `Six`. Robots explicitly allows `/`; two exact `Private Event` / `Venue Closed` rows are excluded. Seating time is not mislabeled as event start, so output is date precision. | **Best second Delhi source; local preview verified** |
|    3 | [Oddbird Theatre](https://www.oddbirdtheatre.com/): 2 exact current shows on 21–22 August; one sold out and one ticketable                                                                                                                      | Wix SSR home plus first-party details; current pages are 2.1–2.7 MB, so a bounded raw-state proof must precede a worker             | Private first-party South Delhi venue; stable detail slugs, exact start/end, address, age, ticket price and sold-out state. Robots has no path disallow rule; conventional terms/privacy pages are public.                                                                                                                  | Third source candidate: small but precise            |
|    4 | [National Science Centre](https://nscd.gov.in/forthcoming-events/): 12 dated programme rows, including Space Day, science lectures, World Space Week and November science programmes                                                            | One static HTML table; no pagination or detail fan-out                                                                              | Government science centre; fallback identity is title + start/end + venue; 1 Code request. Robots explicitly allows all. Times, registration and audience are often absent, so preserve unknowns.                                                                                                                           | Product-later only: government source                |
|    5 | [Punjabi Academy](https://punjabiacademy.delhi.gov.in/dccws/calendar-activities-2026-27): 12 dated rows excluding demand-driven placeholders                                                                                                    | One static annual HTML table; no pagination                                                                                         | Govt NCT authority; fallback identity is programme + date + venue; 1 Code request. The page labels dates and venues tentative and its `robots.txt` returns 403, so records cannot be presented as confirmed.                                                                                                                | Product-later only: government source                |
|    6 | [British Council India](https://www.britishcouncil.in/events): 4 listings / 5 dates found for 21–29 August                                                                                                                                      | Official event list to detail; no reviewed pagination                                                                               | First-party organiser and stable detail URLs; 1 list + up to 4 details. Robots sets a 10-second crawl delay, and direct audit fetches hit Akamai denial, so only a bounded Browser proof may advance it.                                                                                                                    | Hold: access                                         |
|    7 | [IGNCA](https://ignca.gov.in/events/): 2 New Delhi horizon rows, Nadi Utsav and the October international conference                                                                                                                            | Current rows are on the first static Events Manager page; the 235-page archive is out of scope                                      | National institution; event slug identity; 1 list, up to 2 details. `robots.txt` returns 403 although the list is public; exclude non-Delhi regional-centre rows.                                                                                                                                                           | Product-later only: government source                |
|    8 | [DAG exhibitions](https://dagworld.com/exhibitions.html): 1 exact-dated Delhi exhibition plus month-only items that must remain unpublished                                                                                                     | One all-city exhibition list plus optional detail slug                                                                              | First-party gallery; detail slug identity; 1–2 Code requests. Robots declares a sitemap and no disallow rule. Exact-day precision remains mandatory.                                                                                                                                                                        | Candidate: art                                       |
|    9 | [Korean Cultural Centre schedule](https://india.korean-culture.org/en/273/schedule/list): 0 publishable future rows; the SAC season says selected Fridays but exposes only the first date in text                                               | Monthly schedule plus [SAC notice](https://india.korean-culture.org/en/1274/board/414/read/146039); remaining dates are image-bound | Government cultural centre; board ID identity; 3 month pages + notice. Robots allows public paths, but direct fetch loops and OCR-only dates fail the contract.                                                                                                                                                             | Product-later only: government source                |
|   10 | [Bikaner House](https://bikanerhouse.rajasthan.gov.in/upcoming-events/2026/08): 0 rows after 20 August; September–November pages are empty                                                                                                      | Exact monthly path `/upcoming-events/YYYY/MM`; no pagination                                                                        | Rajasthan government venue; title/date fallback identity; 3–4 Code requests. No robots file was published. Recheck seasonally.                                                                                                                                                                                              | Product-later: empty government source               |
|   11 | [CCRT](https://ccrtindia.gov.in/events/month/2026-09/): 4 horizon training lines in the official annual plan, none verified as general-public events                                                                                            | Tribe month pages plus one annual-plan PDF                                                                                          | Government training body; course/date identity; 3 month requests or 1 PDF. Eligibility is restricted and PDF extraction is a separate reviewed document lane.                                                                                                                                                               | Product-later: audience/government                   |
|   12 | [India International Centre current programmes](https://iicdelhi.in/programmes/current): 21 raw cards / 20 unique details across exactly two pages; 18 list-safe future rows after excluding already-started exhibitions with unknown end dates | Static Drupal HTML at page 0 and `?page=1`; one exact duplicate at the pager boundary; no detail fan-out in a safe v1               | Private first-party venue with broad arts, books, talks, film and music. Robots allows the programme path, but its Terms prohibit database/display/redistribution while a separate Website Policy permits attributed reproduction. Do not implement without written clarification.                                          | Reject without permission                            |
|   13 | [JNU current events](https://www.jnu.ac.in/jnuevents/): 21 rows, 18 unique Drupal nodes after English/Hindi same-node dedupe                                                                                                                    | One static HTML list; `/events-archive?page=N` is history and is not followed                                                       | First-party university facts; native numeric node ID; 1 Code request for title/dates/detail link. Robots permits the list, but JNU's copyright policy requires permission and government sites are outside the current collection policy.                                                                                   | Product-later only: government source                |
|   14 | [Sangeet Natak Akademi](https://sangeetnatak.gov.in/): 0 horizon rows verified; indexed detail IDs stop before the horizon                                                                                                                      | Individual `/events-programmes/{id}` pages; no complete current list proved                                                         | National academy and native detail IDs, but an unknown fan-out is not acceptable.                                                                                                                                                                                                                                           | Product-later only: government source                |
|   15 | [Sahitya Kala Parishad](https://sahityakalaparishad.delhi.gov.in/sahityakalaparishad/cultural-events-2025-26): 0 horizon rows                                                                                                                   | One static prior-year page                                                                                                          | Govt NCT authority; no current identity set. `robots.txt` returns 403.                                                                                                                                                                                                                                                      | Reject: stale                                        |
|   16 | [NGMA New Delhi](https://www.ngmaindia.gov.in/ngma-news-events.asp): 0 horizon rows; the official page still surfaces 2020 items                                                                                                                | One static ASP page; no pagination                                                                                                  | National museum; fallback identity only; 1 request. No robots file exists, but freshness fails first.                                                                                                                                                                                                                       | Reject: stale                                        |
|   17 | [National Museum](https://nationalmuseumindia.gov.in/): 0 current calendar rows and no bounded official list endpoint verified                                                                                                                  | Notices and PDFs are fragmented                                                                                                     | National authority, but no deterministic inventory, identity or request cap exists.                                                                                                                                                                                                                                         | Reject for now                                       |

### Mumbai

| Rank | Official source and verified horizon inventory                                                                                                                 | Reviewed surface and transport                                                                                                                                                                   | Authority, identity, request and access boundary                                                                                                                                                                                                                                                                                                                                                                                      | Decision                                                                  |
| ---: | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
|    1 | [NCPA calendar](https://www.ncpamumbai.com/event-calendar/): 73 event IDs and **120 exact occurrences** after authoritative time expansion and dedupe          | Four overlapping month JSON calls such as [`?date=2026-09`](https://www.ncpamumbai.com/wp-json/event/v1/getAllevent/?date=2026-09), then one `wp/v2/event?include=...&per_page=100` detail batch | First-party venue. Expand `acf.event_dates_times`, filter the horizon, and dedupe by WP ID + ACF date + normalized start time; this preserves same-day second shows. Current run cost is 5 Code requests, hard cap 6 with two detail chunks. Robots allows all. Terms prohibit redistribution/commercial exploitation without permission, so a public collector must remain factual metadata/link-only and pass owner/legal approval. | **First Mumbai collector after the expansion lock and permission review** |
|    2 | [NMACC calendar](https://www.nmacc.com/calendar/): 49 intersecting records from 72 CMS pages, including 45 finite/upcoming and 4 long-running items            | One first-party CMS call: `/cms-api/nmacc-pages/getnmaccpages?fieldKey=relatedShows&timestamp=0`; no pagination                                                                                  | Native CMS page ID/path, with event ID when supplied; one ~247 KB Code request. The site's robots policy disallows query URLs, so the technically strong contract is not collectible without written clearance or an allowed official surface.                                                                                                                                                                                        | Hold: policy                                                              |
|    3 | [DAG Mumbai](https://dagworld.com/museums-programme): 3 exact current items plus one month-only exhibition held from publication                               | Museums programme plus [exhibition list](https://dagworld.com/exhibitions.html); optional details                                                                                                | First-party organiser/gallery; detail slug identity; 2 Code list requests. Robots supplies a sitemap and no disallow rule; exact-day precision still gates publication.                                                                                                                                                                                                                                                               | Qualify: art                                                              |
|    4 | [CSMVS](https://www.csmvs.in/events.html): 4 current official cards, including long exhibitions and a monthly programme artifact                               | Event page plus monthly PDF; direct audit receives a Cloudflare challenge                                                                                                                        | First-party museum; card/detail URL or title/date identity; 1 Browser page + PDF only after proof. Robots allows generic search/reference use but blocks several named bots and AI training.                                                                                                                                                                                                                                          | Hold: access/document                                                     |
|    5 | [Nehru Science Centre Mumbai](https://nehrusciencecentre.gov.in/english/): 3 upcoming image tiles and 3 drone-workshop variants, but 0 date-complete rows      | Elementor home plus July–September Sci-Mail PDF and booking details                                                                                                                              | Government science centre; booking slug identity. Dates embedded in images/PDF require a reviewed document path; do not infer them.                                                                                                                                                                                                                                                                                                   | Hold: precision                                                           |
|    6 | [Nehru Centre](https://www.nehrucentremumbai.in/whats-on/): 1 current August newsletter artifact, item count not machine-verified                              | Static cards are stale; page to monthly PDF is 2 requests                                                                                                                                        | First-party venue; PDF item identity must include artifact edition + title/date. Robots permits public paths and blocks only admin.                                                                                                                                                                                                                                                                                                   | Hold: PDF                                                                 |
|    7 | [G5A](https://g5afoundation.org/calendar/): 0 current rows; official `/wp-json/mec/v1/events` returns `[]`                                                     | MEC endpoint plus 700-post historic WP archive                                                                                                                                                   | First-party venue; MEC/WP ID; 1 request when inventory returns. Robots permits public paths.                                                                                                                                                                                                                                                                                                                                          | Hold: empty                                                               |
|    8 | [IFBE archive](https://ifbe.space/event-archive/): 0 date-complete future rows verified                                                                        | Custom calendar/archive; direct audit timed out                                                                                                                                                  | First-party venue; detail slug if recovered. Browser access and a bounded list shape are unproved.                                                                                                                                                                                                                                                                                                                                    | Hold: access                                                              |
|    9 | [Royal Opera House](https://www.royaloperahouse.in/upcoming-shows/): 0 horizon rows verified; latest official indexed show was in May                          | One static upcoming page                                                                                                                                                                         | First-party venue; detail slug or title/date identity; 1 Code request when fresh.                                                                                                                                                                                                                                                                                                                                                     | Hold: empty                                                               |
|   10 | [Bhau Daji Lad Museum calendar](https://www.bdlmuseum.org/calendar/index.php): 0 current rows from its own calendar; a current collaboration is covered by DAG | Custom calendar is stale; no pagination                                                                                                                                                          | First-party museum; event URL identity; 1 request. Robots is open, but freshness fails.                                                                                                                                                                                                                                                                                                                                               | Hold: stale                                                               |
|   11 | [NGMA Mumbai](https://www.ngmaindia.gov.in/ngma_mumbai-c-events.asp): 0 horizon rows; official page is old                                                     | One static ASP page                                                                                                                                                                              | National museum; fallback identity; 1 request. No robots file, but freshness fails.                                                                                                                                                                                                                                                                                                                                                   | Reject: stale                                                             |
|   12 | [Goethe-Institut Mumbai](https://www.goethe.de/ins/in/en/sta/mum/ver.cfm): 0 horizon culture rows verified                                                     | Shared Goethe event page currently returns placeholders/system errors                                                                                                                            | First-party cultural institute, but transport, identity and bounded inventory are not proven.                                                                                                                                                                                                                                                                                                                                         | Hold                                                                      |
|   13 | [Alliance Française de Bombay](https://bombay.afindia.org/): 0 exact future rows; recurring Monday screenings lack dated official entries                      | WordPress home/events surface                                                                                                                                                                    | First-party organiser; detail slug if recovered; 1 list + details. Recurrence must not create synthetic dates.                                                                                                                                                                                                                                                                                                                        | Hold                                                                      |
|   14 | [IIT Bombay](https://www.iitb.ac.in/): 1 official September/October programme found in a PDF, public attendance unverified                                     | Homepage/news plus document; no unified event list                                                                                                                                               | University authority; document + programme identity; audience and PDF gates fail.                                                                                                                                                                                                                                                                                                                                                     | Hold: audience                                                            |
|   15 | [TIFR Mumbai](https://main.tifr.res.in/): 0 horizon public rows; the next verified conference begins in December                                               | Homepage/current-events surface                                                                                                                                                                  | First-party institute; native detail if present; 1 request. Recheck later.                                                                                                                                                                                                                                                                                                                                                            | Hold: empty                                                               |
|   16 | [Prithvi Theatre](https://prithvitheatre.org/booktickets): **49 exact current performances** across 28 productions, 21 August–30 September                     | One first-party JSON call to `/api/getPrithviData?cmd=DEGETTHEATERS&cc=PTHV`; 3 venues, 28 events, and matching 49-row day/timed session arrays; no pagination or detail fan-out                 | First-party venue; native per-performance `SessionId`, exact date/start/end, venue/address, genre, price, language, age, image code, and BookMyShow action. Same-ID Studio collector `c_mt1qtstu9kmw95k4q` is one reviewed Code stage; Development, Production-save, and one Production batch all passed 49-row schema/semantic gates. Mumbai backend, replay, API, and city enablement remain.                                       | **Best clean Mumbai candidate; Production collection verified**           |

The smallest current private-source Delhi set is `India Habitat Centre + The
Piano Man`; Oddbird is the third precision candidate once its large Wix raw
state is bounded. Government sources are product-later only for this hackathon,
and India International Centre requires written reuse clarification. Mumbai's
clean first slice is Prithvi Theatre; NCPA still requires written permission
and NMACC still requires query-policy clearance. These are not P0 commitments.
BIEC is complete end to end.
Kashi Sansad Events is the next Varanasi candidate, but its 20 August local
pre-Bright gate is NO-GO because normal direct HTTP/HTTPS and robots retrieval
timed out and linked detail copy conflicts with the hub. Resume only after raw
origin access recovers; do not build from rendered search evidence. Rudraksh
remains the other viable coverage source once Bright account access is cleared.
Delhi and Mumbai research may continue, but every generated Bright template
remains untrusted until the exact tracked worker and schema are installed and a
development preview passes semantic, identity, count, request, and Go 27-field
gates. NCPA and India International Centre require written permission before
either can enter the Studio-to-publication pipeline.

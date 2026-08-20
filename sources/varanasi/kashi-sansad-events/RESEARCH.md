# Kashi Sansad Events qualification

Research date: 20 August 2026 (Asia/Kolkata)

## Decision

**NO-GO at the local pre-Bright gate.** Do not create a collector, source
manifest, worker, mapping, fixture, Bright resource, or backend row yet.

The official hub is a strong candidate, but the collection runtime could not
retrieve raw authoritative HTML. DNS resolved normally while bounded direct
IPv4 requests to HTTP `/`, HTTPS `/`, and HTTPS `/robots.txt` each timed out
during connection after approximately five seconds (`curl` exit 28). The
robots policy, any site terms, the complete DOM, pagination controls, and an
immutable response hash therefore remain unproved.

Search-index/rendered evidence is useful only for qualification. It must not be
used as a fixture or publication input.

## Authority and current inventory

The [District Varanasi NIC event page](https://varanasi.nic.in/event/kashi-parliament-cultural-festival-2023/)
links `https://kashisansadevents.com/` as “Kashi Sansad Events” and links six
members of the same programme-site family. The page identifies its content as
owned by District Administration and its hosting/development as National
Informatics Centre, Ministry of Electronics & Information Technology. This is
authority evidence, not permission to crawl an unreachable origin.

The official hub's web-rendered view was crawled on 20 August and shows nine
2026 programme cards. With an observed local date of 20 August and the existing
inclusive 90-local-calendar-day horizon ending 18 November, seven belong in
Baahar's ongoing/upcoming window:

| Official hub title                     | Hub date range     | Hub website link                                 | Hub registration link                                     |
| -------------------------------------- | ------------------ | ------------------------------------------------ | --------------------------------------------------------- |
| काशी सांसद स्केचिंग प्रतियोगिता 2026   | 03–20 Aug 2026     | `https://kashisansadsketchingpratiyogita.com/`   | `https://register.kashisansadsketchingpratiyogita.com/`   |
| काशी सांसद पेंटिंग प्रतियोगिता 2026    | 03–20 Aug 2026     | `https://kashisansadpaintingpratiyogita.com/`    | `https://register.kashisansadpaintingpratiyogita.com/`    |
| काशी सांसद फोटोग्राफी प्रतियोगिता 2026 | 03–20 Aug 2026     | `https://kashisansadphotographycompetition.com/` | `https://register.kashisansadphotographycompetition.com/` |
| काशी सांसद ज्ञान प्रतियोगिता 2026      | 25 Aug–03 Sep 2026 | `https://kashisansadgyanpratiyogita.com/`        | `https://register.kashisansadgyanpratiyogita.com/`        |
| काशी सांसद सांस्कृतिक महोत्सव 2026     | 15–24 Sep 2026     | `https://kashisanskritikmahotshav.in/`           | `https://register.kashisanskritikmahotshav.in/`           |
| सांसद खेलकूद प्रतियोगिता काशी-2026     | 05–24 Oct 2026     | `https://kashisansadkhelkud.com/`                | `https://register.kashisansadkhelkud.com/`                |
| काशी सांसद बाल कवि सम्मेलन 2026        | 02–18 Nov 2026     | `https://kashisansadbalkavisammelan.in/`         | `https://register.kashisansadbalkavisammelan.in/`         |

The three 03–20 August date-only programmes remain ongoing until the exclusive
effective end at local midnight on 21 August. Excluding them with a
`start_date > observed_date` shortcut would violate Baahar's established
ongoing semantics. The tourist-guide programme ended in July. The 04–05
December employment fair begins outside this observation's 90-day horizon.

The hub exposes a website and registration link for every programme. That is
useful public actionability evidence, but price, free state, registration state,
venue, exact time, accessibility, and general-public eligibility must remain
unknown unless the hub states them explicitly in the raw response.

## Detail conflict risk

The hub must remain the occurrence authority. A bounded read-only check of
three linked programme sites found material stale or contradictory copy:

- the Gyan site repeats the hub's 25 August–3 September range but lists a final
  on 23 September;
- the Khelkud site says 14/15–24 September while the hub says 5–24 October, and
  the page also contains a stale 2024 schedule block;
- the Bal Kavi site has 2026 dates but labels its description, QR code, rules,
  and call to participate as 2025.

The Sanskritik detail origin timed out during the same read-only check. A future
collector must not copy or reconcile detail-site dates, year labels, venues, or
registration state. If a future contract elects to validate a detail fact, any
contradiction must quarantine the entire small run.

## Provisional collector shape after access recovers

Use a single Scraper Studio **Code** stage only if a fresh raw response proves
the page contract. The provisional budget is one exact request to
`https://kashisansadevents.com/`, one parsed page, zero browser navigation,
zero pagination, zero load-more interaction, zero detail fan-out, zero retry,
and no LLM/OCR/inference. A Browser stage is not justified by the rendered
facts and cannot fix an unreachable origin.

Before horizon filtering, validate the complete hub card collection atomically:
one page identity, exact card boundaries, all titles, explicit 2026 date ranges,
both official links per card, allowed hosts, no duplicate cards, no pagination
or load-more control, and exact canonical ordering. Date-only eligibility uses
the exclusive next-local-midnight effective end. Collect only after every card,
schema field, identity, and count gate passes.

The hub exposes no native ID, and the linked programme roots are not safe
identity anchors while their copy conflicts. Keep `source_event_id: null` and
use the reviewed fallback tuple: normalized exact title + canonical hub URL +
local occurrence date range + normalized venue key. Since no programme venue
is currently proved, the normalized venue key is empty/null by contract; exact
fallback duplicates must fail the run. Array position is never identity.

## Re-entry gate

Resume this source only when all of the following pass in one fresh observation:

1. normal direct HTTPS returns the raw hub HTML without a proxy or bypass;
2. `/robots.txt` and discoverable website-use terms can be reviewed;
3. the raw DOM proves a complete single-page inventory and absence of
   pagination/load-more;
4. a one-request live harness validates the full page before returning the
   exact ongoing/in-horizon records against the shared 27-field schema;
5. source HTML, canonical records, worker, test, and research hashes can be
   recorded from real bytes.

Until then, request/page budget is provisional, record count is discovery
evidence rather than a publication contract, and the terminal state is NO-GO.

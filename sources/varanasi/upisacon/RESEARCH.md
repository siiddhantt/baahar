# UPISACON 2026 source research

Research date: 19 August 2026 (Asia/Kolkata)

## Current consumer value

The official UPISACON site is operated for the 48th Annual Conference of ISA UP
by the Department of Anaesthesiology, IMS BHU and ISA Varanasi City Branch. Its
[workshop page](https://upisaconvaranasi2026.com/workshops) currently publishes
seven pre-conference workshops on 2 October 2026 at the Skill Center, Trauma
Center, IMS BHU, Varanasi. Each workshop has 30 seats, and the page sends a
delegate to the official registration system to select one workshop.

The result is actionable for its professional audience without claiming more
than the source says: Baahar can expose the exact workshop, date, venue, and
registration route while leaving times, per-workshop availability, price, and
eligibility details unknown.

## Raw and rendered shape

The canonical URL returned HTTP 200 and 1,813 raw bytes. The body contained one
empty `<div id="root"></div>`, one module script, and none of the seven titles,
workshop heading, date, or venue. No public JSON or embedded state appeared in
the shell. A Code worker therefore cannot reach the source facts.

An independent Playwright run against installed Edge executed the public React
page and observed:

- one document navigation and no click, scroll, input, or fan-out;
- 12 total browser network requests;
- one exact workshop heading and date/venue subtitle;
- one seven-card A-G grid;
- all three attendance/registration rules exactly once;
- two external registration links with the same official delegate-login URL.

The worker parses only the rendered DOM. It does not read the current 624 KB
hashed JavaScript bundle, capture background traffic, or copy a private API.
Asset-version changes therefore do not become a source contract.

## Access and legal review

The official `robots.txt` returned HTTP 200 and explicitly allows `/` for
`User-agent: *`. The rendered terms govern registration, payment, refunds,
event changes, user responsibility, and jurisdiction; they contain no
`scrap`, `crawler`, `automated`, or `bot` language. This is not a grant of broad
reuse. Baahar makes one bounded public-page navigation, republishes factual
schedule fields only, omits descriptions and media, attributes the source, and
links users back to official registration.

## Worker and cost choice

Bright Data's worker guidance requires a Browser worker when facts are absent
from raw HTML and rendered by JavaScript. The official billing documentation
counts `navigate()` as one page load and treats the initially rendered page as
one result. This collector uses exactly one navigation and no other billable
interaction function.

Browser startup and React rendering are slower and less reliable than a raw
Code request. The local gate therefore caps navigation at 30 seconds and the
current physical network footprint at 12 requests. A timeout, proxy error,
extra request, or incomplete DOM stops the run; there is no Code-worker,
bundle, API, cached, or retry fallback.

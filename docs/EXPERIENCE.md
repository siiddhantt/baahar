# Baahar experience direction

## 1. Experience promise

Baahar should feel like opening a beautifully assembled city noticeboard, not
walking into a scraper dashboard or a ticket marketplace.

The first viewport already answers the product question with current events. A
short identity line frames the feed; it does not delay it.

```text
BAAHAR                         Bengaluru ▾       Saved

Find something worth stepping out for.
Fresh plans from the city pages most people forget to check.

[ Upcoming ] [ Today ] [ Tomorrow ] [ This weekend ] [ Explicitly free ]

Coming up in Bengaluru                                18 plans
┌────────────────┐ ┌──────────┐ ┌─────────────────────┐
│ event poster   │ │ event    │ │ event poster        │
│ time + title   │ │ card     │ │ time + title        │
└────────────────┘ └──────────┘ └─────────────────────┘
```

Recommended brand system:

- name: **Baahar**;
- promise: **Find something worth stepping out for**;
- short campaign line: **Less scrolling. More going.**;
- contextual CTA: **Baahar chalo**.

Do not force the Hindi phrase into every button. Product actions remain plain:
`See what is on`, `Official page`, `Save`, and `Add to calendar`.

## 2. Reference synthesis

The direction borrows behaviours, not appearances:

- [Pinterest discovery](https://help.pinterest.com/en/article/discover-ideas-on-pinterest):
  scan quickly, save instantly, refine without losing place;
- [Luma event discovery](https://help.luma.com/p/searching-for-events): calm
  time/place hierarchy and shareable event routes;
- [Partiful](https://partiful.com/about): gathering can have personality without
  becoming administrative;
- [DICE](https://dicefm.zendesk.com/hc/en-gb/articles/19741652701585-Find-events-and-buy-tickets):
  image-first cards that do not compromise date, place, and price clarity;
- [Cosmos](https://www.cosmos.so/): quiet editorial polish and contextual source
  attribution;
- [Airbnb search](https://www.airbnb.com/help/article/39): disciplined filters
  and a future list/map relationship.

Baahar must not reproduce the inventory-wall appearance of large ticketing
sites. Its distinctive value is a concise live answer assembled from direct
venue and institution sources.

## 3. Art direction: the living city noticeboard

Imagine handbills, gallery programmes, theatre posters, and community notices
composed by a very good editorial designer. The system is tactile but not messy,
Indian but not ornamental by default, and expressive without sacrificing scan
speed.

### Visual motifs

- Poster crops with two or three deliberate aspect ratios.
- Small registration marks, date stamps, and clipped-corner labels.
- A double `AA` wordmark whose counters suggest two open doorways.
- Subtle paper grain and city-grid line work rendered as tiny static assets or
  CSS, never a large animated background.
- An occasional oversized date numeral behind a section header.
- Procedural SVG cover art, keyed by city and category, for sources without a
  usable image. The SVG is deterministic and carries no fake event imagery.

Avoid glassmorphism, neon-on-black dashboards, generic gradient blobs, tourist
silhouettes, rangoli wallpaper, auto-rickshaw icons, temple stock art, and
always-moving particle fields.

### Colour

Base tokens start here and must be contrast-tested in their actual pairings:

| Token     | Light     | Dark      | Role                         |
| --------- | --------- | --------- | ---------------------------- |
| `canvas`  | `#F5F0E7` | `#10110F` | warm paper / green-black ink |
| `surface` | `#FFFDF7` | `#191B18` | cards and sheets             |
| `ink`     | `#171713` | `#F4F0E8` | primary text                 |
| `muted`   | `#67665E` | `#B7B5AB` | secondary text               |
| `line`    | `#D8D1C4` | `#33362F` | separators                   |
| `focus`   | `#3457D5` | `#9EB3FF` | accessible focus state       |

City accents:

- Bengaluru: rain green, jacaranda violet, a small signal-yellow highlight;
- Delhi: sandstone red, monument blue, and a restrained ochre signal;
- Mumbai: coastal teal, theatre rose, and a warm amber signal;
- Varanasi: marigold, river indigo, and restrained vermilion.

The city palette changes accents and placeholder art, not component meaning.
Status colours are semantic and constant across cities.

### Typography

Use [Anek](https://github.com/EkType/Anek) for the wordmark and display moments.
It is an Indian-designed, OFL-licensed multi-script family with compatible Latin,
Devanagari, and Kannada variants. Use a system sans stack for dense metadata.

- Self-host only required variable/subset files.
- Load Devanagari and Kannada subsets with `unicode-range` or when the content
  requires them.
- Animate Anek's width axis only in the small wordmark and only on deliberate
  interaction; never animate feed typography.
- Body text minimum: 16px. Metadata minimum: 13px with adequate line height.
- Apply fluid type with bounded `clamp()` values; no headline may become gigantic
  merely because the monitor is 2K/4K.

## 4. Information architecture

Public top-level navigation:

- **Explore** — the city feed and filters;
- **Saved** — device-saved occurrences and their latest states.

Search is introduced only if the event count makes it useful; in the first
release it may be an action inside Explore rather than an empty top-level route.

The source explanation is contextual on an event detail:

> Official details from Bangalore International Centre

It can expand to the source URL and last change. There is no `How we verify`,
`Behind Baahar`, `Collectors`, or architecture tab in public navigation. The
operator health surface is a separate protected route.

Routes:

```text
/
/bengaluru
/bengaluru?window=weekend&category=theatre&free=true&venue=Ranga+Shankara
/varanasi?window=today
/events/:occurrenceId/:slug
/saved
/operator/sources             protected, not linked publicly
```

City, non-default date window, category, venue, and free state belong in the URL. An
omitted window means Upcoming. Back navigation restores filters, cursor-loaded
items, and scroll position.

## 5. Page composition

### Landing/Explore

The root route is a concise city chooser, not a marketing site or a fake feed.
It highlights the remembered city without navigating automatically. A city feed's
first viewport contains:

1. wordmark, city switcher, theme action, and Saved;
2. a one-line promise and one supporting sentence;
3. a compact Ask Baahar guide followed by time/free/category/venue choices;
4. at least the top portion of real event cards;
5. a quiet result/source count such as `27 plans from 2 official calendars`.

If a selected window has no events, keep that choice visible and offer one clear
reset to Upcoming. Never silently change the user's active window.

### Event quilt

Use a semantic, source-ordered CSS grid with predetermined row spans. Never use
CSS columns or a visual masonry algorithm that changes DOM order. The quilt may
look Pinterest-like while keyboard/screen-reader order remains chronological.

Card priority:

1. image or procedural cover;
2. category badge and critical status (never a transient `New` badge);
3. date/time stamp;
4. title, two-line visual limit but full accessible name;
5. venue/neighbourhood;
6. a compact free/price treatment when explicit;
7. quiet source and freshness line;
8. save action.

Card variations are assigned deterministically from an event ID and available
image ratio. A filter change never randomly reshuffles shapes.

### Event detail

The detail is a shareable route. On large screens it may animate from the card
into a wide editorial layout; on mobile it is a full page. Do not implement a
non-addressable modal as the canonical detail.

The page contains:

- title, date/time, venue, status and explicit price/registration state;
- a short structured details block, not copied source prose;
- `Official page`, `Save`, provider-aware `Add to calendar`, and native share;
- the official-source disclosure and a stale warning only when action may be needed;
- a material change note when relevant;
- a small `More on this day` group after the primary action.

### Ask Baahar

The cat is a small guide that lives inside Explore, not a floating support
chatbot. Opening it reveals one short request field and a few useful examples.
The result visibly becomes ordinary URL filters and the chronological event
board remains the answer. Its speech can acknowledge the match count but never
invent a venue, reason, event fact, or recommendation. Keyboard operation,
reduced motion, graceful deterministic fallback, and an explicit loading/error
state are required.

### Saved

Saved is useful without an account. It groups upcoming and past events, places
changed/cancelled items first, and makes calendar/offical-link actions available.
An empty state links directly back to the current city feed.

### Operator health

Dense and functional, visually related but not competition UI theatre. The main
table shows freshness, last run, rows, quarantines, budget, and incident state.
Repair instructions link to the exact CLI commands without exposing secrets.

## 6. Component boundaries

Core product components:

- `CitySwitcher`
- `ThemeControl`
- `TimeWindowRail`
- `CategoryRail`
- `FilterSheet`
- `AppliedFilters`
- `EventQuilt`
- `EventCard`
- `EventStatus`
- `SaveButton`
- `EventDetail`
- `SourceDisclosure`
- `ChangeNotice`
- `CalendarAction`
- `EmptyState`
- `EventCardSkeleton`
- `ResultAnnouncement`

Primitive UI:

- button, link, chip, icon button;
- dialog/sheet, tooltip, popover;
- toast, skeleton, focus ring.

Use a tooltip only for supplementary information. A label/action required to
understand the product must be visible without hover.

## 7. Responsive behaviour

The content width is capped around 1680px and remains centred on very large
monitors. Feed density changes gradually:

- below 360px: one compact column;
- 360–639px: two poster columns when card content fits, otherwise one;
- 640–959px: three columns;
- 960–1279px: four columns;
- 1280–1599px: five columns;
- 1600px and above: six columns inside the cap.

Use container queries for card internals. Metadata collapses intentionally; it
does not overflow or create an unexplained page scrollbar. Sheets become bottom
sheets on phones and anchored panels on larger screens. Test 320px, 390px,
768px, 1280px, 1440px, 2560px, 200% text zoom, and landscape mobile.

## 8. Motion language

Motion explains continuity and state. It is not a layer of constant spectacle.

| Class     |  Duration | Use                                           |
| --------- | --------: | --------------------------------------------- |
| Immediate |  80–140ms | press, focus-adjacent response, chip feedback |
| Interface | 180–240ms | filters, sheet, saved state, theme colour     |
| Spatial   | 260–340ms | card-to-detail, city/feed transition          |

Easing:

- standard: `cubic-bezier(.2,.8,.2,1)`;
- enter: `cubic-bezier(.16,1,.3,1)`.

Signature moments:

- a selected time chip gains a sliding paper-tab underline;
- an event poster and date stamp share-transition into the detail route;
- switching cities crossfades the feed and changes only the accent pigments;
- saving folds a small card-corner/glyph once, without confetti;
- the first six visible cards arrive with a 24ms stagger, capped thereafter.

Limits:

- card hover `translateY(-2px)` and image scale no more than `1.015`;
- touch press near `0.985`;
- at most 12 simultaneously animated elements;
- no continuous background animation, parallax, scroll hijack, large blur
  animation, or layout-property tweening.

Use CSS for hover/colour transitions. Load Motion lazily only for presence,
layout, and shared-element sequences. [Motion provides](https://motion.dev/docs/react-accessibility)
global reduced-motion handling; reduced mode replaces spatial transformations
with an instant swap or short opacity change.

## 9. Accessibility definition of done

- WCAG 2.2 AA on all acceptance journeys.
- Source order matches visible reading order.
- All functionality works with keyboard alone.
- Focus is always visible and restored after sheets/details close.
- Interactive targets are designed at 44×44px or larger.
- Text contrast >= 4.5:1; meaningful large text/UI graphics >= 3:1.
- Status is expressed with text/icon as well as colour.
- Filters have names, current state, and a polite result-count announcement.
- Poster images use empty alt when the adjacent title expresses all information;
  unique meaningful imagery receives concise alt.
- `<time datetime>` and correct `lang` spans are used.
- 320px reflow and 200% text zoom do not create two-dimensional scrolling.
- Map, if later added, always has an equivalent list.
- Motion and automatic behaviour respect OS preferences.

## 10. Performance definition of done

- Initial JS target <= 150 KB gzip; hard ceiling 180 KB.
- CSS target <= 35 KB gzip.
- First-viewport images <= 500 KB total on the mobile test profile.
- Responsive AVIF/WebP images with intrinsic dimensions.
- Only the measured LCP image may be eager/high-priority.
- Detail route, advanced filter sheet, and future map are separate chunks.
- Prefetch a detail only after real intent such as pointer dwell/focus, not for
  every card.
- `content-visibility: auto` may skip offscreen card rendering while retaining
  accessible content; virtualization is added only after measurement.
- Production build passes LCP <= 2.5s, INP <= 200ms, CLS <= 0.1 at the 75th
  percentile target defined by [Core Web Vitals](https://web.dev/articles/vitals).
- Measure with a throttled mid-tier Android profile and a 2560px desktop, not only
  the developer's machine.

## 11. Image and content policy

- Prefer official source thumbnails only when the source permits their display.
- Preserve attribution and link to the official page.
- Do not ingest or republish full copyrighted descriptions.
- Do not hotlink an unbounded original image into the first viewport.
- If image caching/derivatives are not clearly permitted, show the deterministic
  Baahar category cover instead.
- All placeholder artwork is local SVG/code-native and included in performance
  budgets.

## 12. Visual release review

Before release, capture and inspect every main route at all target widths in both
themes, plus:

- empty/loading/error/offline states;
- long Hindi/Kannada/English title combinations;
- missing image, price, venue, and end-time;
- sold-out, closed, postponed, cancelled, and changed states;
- one-day and multi-day events;
- keyboard focus, reduced motion, and 200% zoom;
- 0, 1, 2, 24, and 60-card result sets.

The UI is not accepted because it resembles a design mock. It is accepted only
after the live-data states render with the same polish.

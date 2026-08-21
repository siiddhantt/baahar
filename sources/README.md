# Source registry

This directory is Baahar's public source control for Scraper Studio collectors.
Bright Data runs the deployed collector versions; this repository keeps the
reviewed worker, mapping, limits, research, and evidence that explain exactly
what each collector is allowed to publish.

Keeping both matters. A dashboard is the runtime, but Git provides durable code
review, reproducible tests, change history, and a way to compare a repaired
collector with the version the product trusts.

## Production sources

| City      | Source                                                       | Coverage                                                                               |
| --------- | ------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| Bengaluru | [Bangalore International Centre](bengaluru/bic/)             | Talks, workshops, exhibitions, and community programmes from the official calendar.    |
| Bengaluru | [Jagriti Theatre](bengaluru/jagriti/)                        | Performances and theatre programmes from the official list and detail pages.           |
| Bengaluru | [Atta Galatta](bengaluru/atta-galatta/)                      | Books, culture, workshops, and creative events from the venue's first-party JSON feed. |
| Bengaluru | [Bangalore International Exhibition Centre](bengaluru/biec/) | Trade fairs, expos, and professional events from the official event board.             |
| Delhi     | [The Piano Man](delhi/the-piano-man/)                        | Public music sessions across the organiser's Delhi venues.                             |
| Mumbai    | [Prithvi Theatre](mumbai/prithvi-theatre/)                   | Theatre, music, arts, and talk performances from the official booking API.             |
| Varanasi  | [BHU Academic Events](varanasi/bhu-academic-events/)         | Public workshops, conferences, seminars, and academic programmes.                      |

The city feed exposes source counts so this list is never presented as complete
coverage of a city.

## Development and access-limited sources

| City     | Source                                               | State                                                                                        |
| -------- | ---------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Delhi    | [India Habitat Centre](delhi/india-habitat-centre/)  | Development collector created; production publication is not enabled.                        |
| Varanasi | [UPISACON workshops](varanasi/upisacon/)             | Locally verified Browser worker; production publication is not enabled.                      |
| Varanasi | [Dhamma Chakka courses](varanasi/dhamma-cakka/)      | Mapping and worker verified locally; Bright Data account access currently blocks collection. |
| Varanasi | [EMINDIA](varanasi/emindia/)                         | Collector preserved; Bright Data account access currently blocks collection.                 |
| Varanasi | [Rudraksh Convention Centre](varanasi/rudraksh/)     | Collector preserved; Bright Data account access currently blocks collection.                 |
| Varanasi | [Kashi Sansad Events](varanasi/kashi-sansad-events/) | Research only; source reachability and conflicting dates prevent a collector contract.       |

`preview`, `active`, `local_verified`, `verified`, and `blocked` are explicit
manifest states, not informal progress labels. Only `active` + `verified`
sources are published.

## Directory contract

Every implemented source follows the same small layout:

```text
city/source/
├── source.yaml          Machine-readable identity, limits, health policy, and state
├── RESEARCH.md          Authority, access, inventory, and transport facts
├── MAPPING.md           Deterministic source-to-contract mapping and identity rules
├── collector/
│   ├── worker.js        Reviewed Scraper Studio worker
│   ├── create-prompt.txt
│   └── README.md        Studio installation and operating notes
└── evidence/
    └── README.md        Append-only preview, production, collection, and repair proof
```

The shared 27-field presentation schema lives at
[`contracts/scraper-studio-output-schema.json`](../contracts/scraper-studio-output-schema.json).
Private batch payloads, credentials, and dashboard exports stay in ignored
`private/` directories.

See [the source documentation template](SOURCE_TEMPLATE.md) before adding or
changing a source.

## When a source changes

1. Freeze publication and keep serving the last verified records.
2. Preserve the failed run, raw artifact metadata, and deployed version.
3. Repair the same collector ID in Development; never auto-approve a generated
   change.
4. Review the diff and preview against the source mapping, request budget,
   identity rules, and 27-field contract.
5. Copy the exact approved worker and schema back into this repository.
6. Run the focused live harness and application publication/replay gates.
7. Append the external IDs, counts, byte size, SHA-256, and outcome to the
   evidence ledger before unfreezing publication.

This is why the files are public: they make every data claim auditable without
publishing private raw payloads or secrets.

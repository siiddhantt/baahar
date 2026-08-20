# India Habitat Centre evidence

The local proof on 20 August 2026 recorded only non-sensitive diagnostics:

- source: `https://indiahabitat.org/Events`;
- response: `200 text/html; charset=UTF-8`;
- UTF-8 bytes: `65,538`;
- SHA-256: `845747196d2ddcf7dc328a669ca38078d9572bd9ce3cb1e640457b2af2d35fa2`;
- transport/pages/parses: `1/1/1`;
- current official cards: `20`;
- unique numeric detail identities: `20`;
- pagination, Browser actions, and detail fan-out: `0`.

A separate one-time research audit confirmed all 20 public detail pages returned
200 and found no current member-only, invite-only, cancelled, or postponed
notice. That audit is not part of the collector request budget.

## Bright Data development-create gate

Exactly one authenticated create used official `@brightdata/cli` 0.3.5 with
`--no-retry`, the exact official input, and the tracked 497-character prompt.
The existing token was mapped to `BRIGHTDATA_API_KEY` for that process only and
was neither printed nor persisted by the command.

- collector ID: `c_mt1gyvqb8ftcpex5b`;
- name: `baahar-india-habitat-centre`;
- terminal status: `done` after 201 polls;
- created: `2026-08-20T12:01:05.315Z`;
- view: `https://brightdata.com/cp/scrapers/c_mt1gyvqb8ftcpex5b`;
- private immutable create envelope: 392 bytes;
- envelope SHA-256:
  `a43975c6f1a08f5ffd71f81f66e6b4fe473e593e758a2cba240ca7adc400fdd2`;
- create-envelope error: absent.

The terminal progression completed intent analysis, planning, discovery,
schema and code generation, input-schema generation, generated preview running,
and preview selection. The CLI envelope contains collector metadata and nine
completed-step names, but no generated code or schema body.

No second create, retry, heal, generated-template inspection, code/schema
replacement, explicit preview, save, production promotion, collection batch,
backend registration, or Delhi city enablement occurred. The same collector ID
is frozen for the next separately authorized review gate.

The create envelope remains ignored at
`../private/create-envelope.json`. Raw responses, future preview artifacts,
tokens, and account data must stay in private evidence storage. Do not commit
dashboard output as source truth, and do not convert a local or generated
development pass into a production claim.

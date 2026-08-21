# Contributing to Baahar

Thanks for helping Baahar find more of the city beyond the obvious. Useful
contributions include product improvements, accessibility fixes, source
suggestions, collector hardening, tests, and documentation.

## Start with the outcome

- [Suggest an official event source](https://github.com/siiddhantt/baahar/issues/new?template=source-suggestion.yml)
- [Suggest a product improvement](https://github.com/siiddhantt/baahar/issues/new?template=feature-request.yml)
- For a code change, open an issue or describe the user-visible outcome in the
  pull request.

Keep one concern per change. Baahar favours small, complete vertical slices over
new frameworks or speculative abstractions.

## Source contributions

Read the [source registry](sources/README.md) and
[source documentation template](sources/SOURCE_TEMPLATE.md) first.

A proposed source should:

- be an official organiser, venue, institution, or clearly authoritative public
  page;
- contain several current, exact, city-relevant events;
- expose a bounded and respectful collection path;
- have reviewed robots and terms boundaries;
- preserve unknown facts as unknown rather than infer them;
- link every event back to its official page.

Search engines, forums, social posts, and aggregators are useful for discovery,
but they are not publication authority when a first-party source exists.

Never commit API tokens, private batch payloads, dashboard exports, personal
paths, or copied long-form source content.

## Development

Follow the [local development guide](docs/DEVELOPMENT.md). The important
boundaries are:

- `contracts/` owns HTTP and collector payload contracts;
- `internal/` owns product capabilities and effect boundaries;
- `apps/web/` consumes generated API types;
- `sources/` owns reviewed collector code, policy, mapping, and evidence;
- `migrations/` owns production source configuration and schema changes.

Before handoff, run the focused checks for the changed boundary and the standard
quality suite. Real PostgreSQL, object storage, live-source, or Scraper Studio
checks are required when the change crosses those boundaries; otherwise state
that they were not run.

## Change history

- Use Conventional Commit subjects such as `feat:`, `fix:`, `test:`, `docs:`,
  and `chore:`.
- Keep generated files with the change that generated them.
- Do not mix private evidence or unrelated working-tree changes into a commit.
- Update a source evidence ledger whenever its collector is previewed, promoted,
  run, repaired, rolled back, or blocked.
- Describe a source as active only after immutable collection, publication, API,
  and browser gates pass.

Comments should explain an external constraint or non-obvious invariant. Remove
dead code and obsolete commentary instead of preserving it for a future cleanup.

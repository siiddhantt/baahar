# Prithvi Theatre Scraper Studio worker

Use a **Code** worker with one input:

```json
{
  "url": "https://prithvitheatre.org/api/getPrithviData?cmd=DEGETTHEATERS&cc=PTHV"
}
```

Paste `worker.js` into the worker editor and use the repository-wide
`contracts/scraper-studio-output-schema.json` as the output schema. Keep default
routing. Do not add a Browser stage, pagination, detail fan-out, or a second
input.

This is a local-verified preview only. Do not create or promote a Bright
collector until Mumbai's contract/backend city gate is explicitly authorized.

Local proof:

```bash
cd tests/live
npm run test:prithvi-theatre
```

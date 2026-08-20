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

The independently reviewed local worker is not installed in Bright yet. The
single authorized development create completed as collector
`c_mt1qtstu9kmw95k4q`, and that collector is frozen. Its generated template is
not the implementation and has not been inspected or approved. Do not retry,
create a duplicate, inspect or edit generated stages, preview, save, run, heal,
promote, register the backend source, enable Mumbai, or publish anything
without a separate reviewed gate.

Local proof:

```text
node --check sources/mumbai/prithvi-theatre/collector/worker.js
npm --prefix tests/live run test:prithvi-theatre
go test ./internal/collections ./internal/sources
```

# Mac Mini Elimination Benchmark Retro

## Outcome

The benchmark milestone landed a reusable harness and a first run against
`homecenter.local`.

Verdict: keep the Mac mini for the voice compute tier.

Reason: the current Pi deployment cannot run the proposed replacement path
end-to-end. The isolated benchmark run found no openWakeWord runtime, no
`faster-whisper`, and no Ollama/local model service on the Pi.

## What Worked

- The run stayed isolated in `/tmp` on the Pi and did not touch the dirty,
  behind `~/home-center` clone.
- The harness records blocked components as first-class findings instead of
  silently treating missing runtime pieces as skipped latency data.
- The finding is reproducible through `npm run benchmark:mac-mini-elimination`.

## What To Improve

- This result answers the deployability question for the current Pi, not the
  maximum theoretical Pi 5 performance after provisioning.
- If the goal changes from "can the current Pi replace the Mac mini" to "how
  close can a fully provisioned Pi get," the next run should provision a
  disposable benchmark venv plus a named local model and then rerun the same
  harness with real component latencies.

## Follow-Up

Keep the Mac mini in the production voice architecture until a later run shows
all three stages are installed, runnable, and within budget on the Pi.

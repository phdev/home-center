# Wake-Word Synthetic Data

This workflow creates local, ignored audio fixtures for evaluating `Hey Homer`
wake detection across family-like voices without cloning family members.

## Safety Rules

- Use licensed synthetic voices only.
- Do not clone Peter's wife or children without explicit consent.
- Treat any real household recordings as private and keep them under
  `voice-service/wakeword-data/private/`, which is ignored.
- Commit corpus manifests, scripts, and aggregate metrics only. Do not commit
  generated WAV files or private audio.

## Generate Fixtures

```bash
cd ~/home-center
voice-service/.venv/bin/python3 voice-service/synthesize_wakeword_dataset.py \
  --output-dir voice-service/wakeword-data/generated \
  --max-per-bucket 120
```

The corpus covers adult woman, adult man, child-like girl proxies, and older
adult proxies using installed macOS voices where available. Child-like buckets
are synthetic proxy voices, not real child clones.

## Evaluate LiveKit

```bash
cd ~/home-center
LIVEKIT_WAKEWORD_HELPER_PYTHON=voice-service/.venv-livekit/bin/python3 \
voice-service/.venv/bin/python3 voice-service/evaluate_wakeword_dataset.py \
  --manifest voice-service/wakeword-data/generated/manifest.json \
  --model pi/models/hey_homer_synthetic_livekit.onnx \
  --threshold 0.995 \
  --min-consecutive 3
```

The output goes to `voice-service/wakeword-data/eval-results/latest-livekit.json`.

Use `CONFIRM_REQUIRE_WAKE_PHRASE=always` for LiveKit canary services. The model
can still wake on varied voices, but command dispatch is blocked unless STT also
hears a constrained `Hey Homer` phrase.

## Promotion Gates

- Adult woman and child-like proxy recall should be high enough to justify a
  real family validation run.
- False positives on near-miss negatives should be zero before trying passive
  TV/speech validation.
- Final production promotion still requires real validation: 5/5 family voice
  phrases where practical, 30 minutes passive TV/speech with 0 dispatches, and
  no worse command latency than the Vosk path.

# Mac Mini Elimination Benchmark

Generated: 2026-06-04T06:39:58-0700
Target: homecenter.local (`homecenter`)
Verdict: `keep_mac_mini`

## Method

The benchmark profiles the voice path that would have to move from the Mac mini to the Pi:

1. openWakeWord wake-candidate inference on synthetic Home Center commands.
2. local `faster-whisper` transcription of the same commands.
3. small local model classification through Ollama's OpenAI-compatible API.

Pass budget: wake p95 <= 100ms, STT p95 <= 1000ms, local model p95 <= 2000ms, combined p95 <= 3000ms, mean WER <= 0.05.

## Result

- Decision: `keep_mac_mini`
- Reason: Pi benchmark path is not runnable end-to-end yet; blocked components: wake, stt, local_model.

## Component Summary

| Component | Status | P95 | Notes |
| --- | --- | ---: | --- |
| wake | `blocked` | n/a | openWakeWord runtime unavailable: ModuleNotFoundError: No module named 'openwakeword' |
| stt | `blocked` | n/a | faster-whisper unavailable: ModuleNotFoundError: No module named 'faster_whisper' |
| local_model | `blocked` | n/a | Ollama unavailable at http://localhost:11434: URLError: <urlopen error [Errno 111] Connection refused> |

## Target Probe

- Platform: `Linux-6.12.62+rpt-rpi-2712-aarch64-with-glibc2.41`
- CPU count: `4`
- Memory: `8059 MB`

Runtime imports:
- `openwakeword`: `False` ModuleNotFoundError: No module named 'openwakeword'
- `onnxruntime`: `False` ModuleNotFoundError: No module named 'onnxruntime'
- `faster_whisper`: `False` ModuleNotFoundError: No module named 'faster_whisper'
- `numpy`: `True` 2.2.4

## Fixture Results

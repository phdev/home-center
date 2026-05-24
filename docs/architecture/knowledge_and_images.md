# Knowledge Answers and Image Generation

Home Center currently has two question-answering paths.

## Dashboard Ask Path

The small Ask Anything panel in `src/components/SearchPanel.jsx` sends user
messages to one of two clients:

- Worker configured: `askViaWorker()` posts to `/api/ask`.
- No worker but a browser OpenAI key exists: `askWithImage()` calls OpenAI
  directly from `src/services/llm.js`.

Both variants use the same pattern: ask the text model for a concise family
assistant answer, allow the model to append `[IMAGE_PROMPT: ...]`, strip that
marker from the visible answer, and call OpenAI image generation when the marker
is present.

The worker-backed `/api/ask` path keeps OpenAI credentials off the dashboard.
It uses `OPENAI_MODEL` with default `gpt-5.4-mini`, then calls
OpenAI image generation with pinned model `gpt-image-2` if an image prompt is
emitted.

## Knowledge Page Path

Voice/open-ended knowledge questions use the classified knowledge endpoint:
`POST /api/ask-query` in `worker/src/index.js`.

The flow is:

1. `classifyKnowledgeQuery()` asks the knowledge text provider for JSON
   classification: type, title, visual need, space-science flag, entity query,
   and visual search query.
2. The worker normalizes the user-facing question into a search subject and
   rejects classifier fields that drift away from that subject. This protects
   cases like speech text `"is that i-b's"` becoming the subject `ibis` rather
   than an unrelated dashboard or wake-word topic.
3. `retrieveKnowledge()` checks pinned curated assets, the image cache, NASA
   imagery for space-science queries, Wikipedia summary imagery, and Wikimedia
   Commons candidates. Candidate images are scored for source quality, subject
   relevance, dimensions, query-type fit, metadata, and whether they avoid
   logos/icons/flags/maps/poster-like imagery.
4. `buildKnowledgeAnswer()` asks the knowledge text provider for a structured
   JSON answer with summary, sections, optional infographic, visual need, and an
   image prompt fallback.
5. Answer text and Wikipedia results are checked for subject relevance. If the
   answer model drifts, the worker falls back to verified retrieved source text
   or a conservative no-solid-match message.
6. If the answer explicitly uses `imageSourceType: "generated"` with an
   `imagePrompt`, `generateKnowledgeImage()` can generate a raw no-text hero
   asset through OpenAI. Known, diagram, and no-image responses must not use
   imageQuery as a generation prompt.
7. `buildKnowledgeVisual()` normalizes pinned, retrieved, cached, generated, or
   missing image state for the UI.
8. `storeLLMResponse()` writes the latest response and history to the
   `NOTIFICATIONS` KV namespace for the full knowledge/history screens.

For text, the worker prefers `KNOWLEDGE_TEXT_BRIDGE_URL` /
`OPENCLAW_BRIDGE_URL`, appending `/knowledge-json`. The bridge uses OpenAI
`gpt-5.4-mini` first when `OPENAI_API_KEY` is configured, then falls back to
local Gemma and Sonnet. If the bridge fails or is not configured, the worker
falls back to OpenAI chat completions with `OPENAI_MODEL`.

For images, the knowledge page now uses a curated hero asset pipeline:

1. pinned curated asset override, when `CURATED_KNOWLEDGE_ASSETS_JSON` or the
   worker-side manifest provides a manually approved hero image
2. scored retrieved candidate from cache, NASA, Wikipedia, or Wikimedia Commons
3. explicit generated raw hero asset only for generated-mode answers
4. native React/SVG fallback for diagram/concept/no-image cases

After content and image retrieval, the worker also builds a deterministic
`visualPlan` and `heroComposition` package. This is the art-direction layer for
arbitrary queries: it infers a subtype, chooses a reusable composition pattern,
scores the overall visual package, assigns a text-safe zone, focal region, dark
tone, motif strategy, supporting panel style, map style, and retry policy from
the query type, topic, available image, and retrieved candidate diagnostics. The
plan is data, not a generated screenshot, so the dashboard can keep facts, maps,
timelines, process diagrams, cards, and chips as native React/SVG UI.

Current composition patterns:

- `portrait-right-text-left`
- `landscape-right-text-left`
- `centered-subject-soft-vignette`
- `environmental-depth-scene`
- `archival-event-scene`
- `object-or-artifact-focus`
- `abstract-concept-orbital`
- `concept-layered-diagram-like`
- `species-closeup-with-environment`
- `place-scenic-wide`
- `tall-subject-forest-depth`
- `multi-subject-fauna-family`
- `fallback-graphic`

Current subtypes include location islands/countries/cities, historical
scientists/artists/political figures, polar and ocean fauna, trees and flowering
plants, space missions/wars/discoveries, and network/process/abstract-scientific
concepts. Concept pages can intentionally use native abstract motifs without a
retrieved hero image.

The pinned manifest lives in `worker/src/curatedKnowledgeAssets.js`. The
canonical topics are present with crop/tone metadata even when no manually
approved URL is pinned yet. To add an override without code changes, set
`CURATED_KNOWLEDGE_ASSETS_JSON` to an array containing:

```json
{
  "topicKey": "ada-lovelace",
  "title": "Ada Lovelace",
  "type": "person",
  "heroImage": {
    "url": "https://example.com/ada-hero.jpg",
    "source": "Curated Archive",
    "sourceUrl": "https://example.com/source-page",
    "credit": "Archive name",
    "license": "Public domain",
    "width": 1400,
    "height": 820,
    "focalPoint": { "x": 0.72, "y": 0.42 },
    "cropHint": "right-subject"
  }
}
```

To promote a good selected visual into a pinned override, generate a reviewed
manifest entry with:

```bash
npm run knowledge:promote-asset -- --topicKey=ada-lovelace --title="Ada Lovelace" --type=person --url=https://example.com/ada.jpg --sourceUrl=https://example.com/source --focalPoint=0.72,0.42 --cropHint=right-subject
```

Paste the JSON into `CURATED_KNOWLEDGE_ASSETS_JSON` or the curated manifest
after checking source, credit, license, crop, and focal point.

Generated visual prompts are still constrained to raw hero assets: no text, no
labels, no UI, no posters, no infographic panels, and no logos. Displayed
generated knowledge images are pinned to `gpt-image-2`, low quality,
`1536x1024`, JPEG output, and a 120-second timeout. High quality is blocked
unless `IMAGE_GENERATION_ALLOW_HIGH_QUALITY=true`. The second-tier art-directed
fallback gate is `ENABLE_ART_DIRECTED_HERO_GENERATION`; it defaults off and
only uses visual-plan prompts when retrieval has not produced a usable hero.

## UI Consumption

Knowledge responses are stored with both legacy fields (`imageUrl`, `image`) and
the richer `visual`, `curatedAsset`, `visualPlan`, and `heroComposition`
objects. The richer objects identify source, asset mode (`pinned`, `retrieved`,
`generated`, `composited`, or `fallback`), generation status, model, retrieval
metadata, focal point, crop hint, tone, score, composition pattern, overlays,
motif, subject-mask guidance, quality score/reasons, and fallback reason so the
UI can make retrieved images feel art-directed without turning images into the
final UI.

The hero card applies focal-point object positioning, dark navy toning, and a
left-side readability gradient. Facts, maps, timelines, process diagrams,
lifecycle cards, metric cards, and chips remain native React/SVG UI.

The worker tests in `worker/src/index.test.js` cover the important visual
decisions: pinned assets beat retrieval, bad candidates are rejected, source
metadata is preserved, known/diagram/none responses do not reintroduce
`imagePrompt` or `imagePending`, GPT Image 2 fallback metadata is preserved for
generated answers, and no-image responses are explicit.

Run the normal gate with:

```bash
npm run verify
npm run check:knowledge-visual-contract
WORKER_TOKEN=<token> npm run check:knowledge-visual-contract:live
```

## Current Status

- v1: liquid-glass knowledge page design system.
- v1.5: curated hero asset pipeline with pinned manifest support, scored
  retrieval, focal-point crops, dark hero toning, and selected-asset caching.
- v1.6: art-directed visual planning with structured `visualPlan` and
  `heroComposition` data for reusable knowledge-page compositions.
- `npm run verify` protects the local visual contract.
- Generated hero fallback remains gated off by default.
- Live Worker validation remains manual unless `WORKER_TOKEN` is added to CI.

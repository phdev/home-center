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
3. `retrieveKnowledge()` checks the image cache, then retrieves NASA imagery for
   space-science queries, then retrieves Wikipedia summary text and imagery.
4. `buildKnowledgeAnswer()` asks the knowledge text provider for a structured
   JSON answer with summary, sections, optional infographic, visual need, and an
   image prompt fallback.
5. Answer text and Wikipedia results are checked for subject relevance. If the
   answer model drifts, the worker falls back to verified retrieved source text
   or a conservative no-solid-match message.
6. If no retrieved/cached image exists and the answer says a visual is useful or
   required, `generateKnowledgeImage()` generates a fallback image through
   OpenAI.
7. `buildKnowledgeVisual()` normalizes retrieved, cached, generated, or missing
   image state for the UI.
8. `storeLLMResponse()` writes the latest response and history to the
   `NOTIFICATIONS` KV namespace for the full knowledge/history screens.

For text, the worker prefers `KNOWLEDGE_TEXT_BRIDGE_URL` /
`OPENCLAW_BRIDGE_URL`, appending `/knowledge-json`. The bridge uses OpenAI
`gpt-5.4-mini` first when `OPENAI_API_KEY` is configured, then falls back to
local Gemma and Sonnet. If the bridge fails or is not configured, the worker
falls back to OpenAI chat completions with `OPENAI_MODEL`.

For images, GPT Image 2 generation is preferred for every visual knowledge
response:

1. retrieved NASA/Wikipedia/cache context can inform the answer
2. worker generates the displayed visual with `gpt-image-2`
3. generated visuals are cached under `knowledge:image:v2:*`
4. "bad image" feedback purges matching cached image keys, even when there is
   no bridge log row to flag
5. explicit no-image visual object

Displayed knowledge images are pinned to `gpt-image-2`, low quality,
`1536x1024`, JPEG output, and a 120-second timeout. High quality is blocked
unless `IMAGE_GENERATION_ALLOW_HIGH_QUALITY=true`.

## UI Consumption

Knowledge responses are stored with both legacy fields (`imageUrl`, `image`) and
the richer `visual` object. The richer object identifies source, mode,
generation status, model, retrieval metadata, and fallback reason so the UI can
label retrieved imagery differently from generated imagery.

The worker tests in `worker/src/index.test.js` cover the important visual
decisions: cache beats generation, NASA beats generation for space science,
GPT Image 2 fallback metadata is preserved, and no-image responses are explicit.

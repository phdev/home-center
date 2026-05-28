import { curatedKnowledgeAssetsFromEnv, curatedTopicKey } from "./curatedKnowledgeAssets.js";
import { artDirectedHeroPrompt, buildHeroCompositionPackage, buildKnowledgeVisualPlan } from "./knowledgeVisualPlanner.js";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS preflight
    if (request.method === "OPTIONS") {
      return corsResponse(env, new Response(null, { status: 204 }));
    }

    // Auth check — if AUTH_TOKEN is configured, require it on every request
    // (except /api/health which is always open for diagnostics)
    if (env.AUTH_TOKEN && path !== "/api/health") {
      const auth = request.headers.get("Authorization");
      if (!auth) {
        return corsResponse(env, json({
          error: "Unauthorized — no token sent. Set the Auth Token in Settings to match your worker's AUTH_TOKEN secret.",
        }, 401));
      }
      if (auth !== `Bearer ${env.AUTH_TOKEN}`) {
        return corsResponse(env, json({
          error: "Unauthorized — token mismatch. The Auth Token in Settings does not match the AUTH_TOKEN secret on your worker.",
        }, 401));
      }
    }

    try {
      if (path === "/api/ask" && request.method === "POST") {
        return corsResponse(env, await handleAsk(request, env));
      }
      if (path === "/api/calendar") {
        return corsResponse(env, await handleCalendar(env, url));
      }
      if (path === "/api/birthdays") {
        return corsResponse(env, await handleBirthdays(env));
      }
      if (path === "/api/school-updates" && request.method === "POST") {
        return corsResponse(env, await handleSchoolUpdatesPost(request, env));
      }
      if (path === "/api/school-updates" && request.method === "GET") {
        return corsResponse(env, await handleSchoolUpdatesGet(env));
      }
      if (path === "/api/needs-action/done" && request.method === "POST") {
        return corsResponse(env, await handleNeedsActionDone(request, env));
      }
      if (path === "/api/photos") {
        return corsResponse(env, await handlePhotos(env));
      }
      if (path === "/api/notifications" && request.method === "POST") {
        return corsResponse(env, await handleNotificationPost(request, env));
      }
      if (path === "/api/notifications" && request.method === "GET") {
        return corsResponse(env, await handleNotificationGet(env));
      }
      if (path.startsWith("/api/notifications/") && request.method === "DELETE") {
        const id = decodeURIComponent(path.split("/api/notifications/")[1]);
        return corsResponse(env, await handleNotificationDelete(id, env));
      }
      // ── LLM Query (classified knowledge queries) ──
      if (path === "/api/ask-query" && request.method === "POST") {
        return corsResponse(env, await handleAskQuery(request, env, ctx));
      }
      if (path === "/api/llm/record" && request.method === "POST") {
        return corsResponse(env, await handleLLMRecord(request, env));
      }
      if (path === "/api/llm/latest" && request.method === "GET") {
        return corsResponse(env, await handleLLMLatest(env));
      }
      if (path === "/api/llm/history" && request.method === "GET") {
        return corsResponse(env, await handleLLMHistory(env));
      }
      if (path === "/api/llm/dismiss" && request.method === "POST") {
        return corsResponse(env, await handleLLMDismiss(request, env));
      }
      if (path === "/api/knowledge-feedback" && request.method === "POST") {
        return corsResponse(env, await handleKnowledgeFeedback(request, env));
      }
      // ── Navigation (voice-controlled page switching) ──
      if (path === "/api/navigate" && request.method === "POST") {
        return corsResponse(env, await handleNavigatePost(request, env));
      }
      if (path === "/api/navigate" && request.method === "GET") {
        return corsResponse(env, await handleNavigateGet(env));
      }
      if (path === "/api/design-system" && request.method === "POST") {
        return corsResponse(env, await handleDesignSystemPost(request, env));
      }
      if (path === "/api/design-system" && request.method === "GET") {
        return corsResponse(env, await handleDesignSystemGet(env));
      }
      // ── Gesture (HandController fast-poll) ──
      if (path === "/api/gesture" && request.method === "GET") {
        return corsResponse(env, await handleGestureGet(env));
      }
      // ── Wake Word Debug ──
      if (path === "/api/wake-debug" && request.method === "POST") {
        return corsResponse(env, await handleWakeDebugPost(request, env));
      }
      if (path === "/api/wake-debug" && request.method === "GET") {
        return corsResponse(env, await handleWakeDebugGet(env, url));
      }
      // ── Wake Word Config ──
      if (path === "/api/wake-config" && request.method === "GET") {
        return corsResponse(env, await handleWakeConfigGet(env));
      }
      if (path === "/api/wake-config" && request.method === "PUT") {
        return corsResponse(env, await handleWakeConfigPut(request, env));
      }
      // ── Wake Record (voice sample recording for training) ──
      if (path === "/api/wake-record" && request.method === "GET") {
        return corsResponse(env, await handleWakeRecordGet(env));
      }
      if (path === "/api/wake-record" && request.method === "POST") {
        return corsResponse(env, await handleWakeRecordPost(request, env));
      }
      // ── Timers ──
      if (path === "/api/timers" && request.method === "POST") {
        return corsResponse(env, await handleTimerPost(request, env));
      }
      if (path === "/api/timers" && request.method === "GET") {
        return corsResponse(env, await handleTimerGet(env));
      }
      if (path === "/api/timers/dismiss-all" && request.method === "POST") {
        return corsResponse(env, await handleTimerDismissAll(env));
      }
      if (path.startsWith("/api/timers/") && path.endsWith("/dismiss") && request.method === "POST") {
        const id = decodeURIComponent(path.split("/api/timers/")[1].replace("/dismiss", ""));
        return corsResponse(env, await handleTimerDismiss(id, env));
      }
      // ── Agent Tasks (OpenClaw) ──
      if (path === "/api/tasks" && request.method === "GET") {
        return corsResponse(env, await handleTaskGet(env));
      }
      if (path === "/api/tasks" && request.method === "POST") {
        return corsResponse(env, await handleTaskPost(request, env));
      }
      if (path.startsWith("/api/tasks/") && path.endsWith("/complete") && request.method === "POST") {
        const id = decodeURIComponent(path.split("/api/tasks/")[1].replace("/complete", ""));
        return corsResponse(env, await handleTaskComplete(id, request, env));
      }
      if (path.startsWith("/api/tasks/") && request.method === "DELETE") {
        const id = decodeURIComponent(path.split("/api/tasks/")[1]);
        return corsResponse(env, await handleTaskDelete(id, env));
      }
      // ── Takeout (tonight's dinner decision) ──
      if (path === "/api/takeout/today" && request.method === "GET") {
        return corsResponse(env, await handleTakeoutGet(env));
      }
      if (path === "/api/takeout/today" && request.method === "POST") {
        return corsResponse(env, await handleTakeoutPost(request, env));
      }
      if (path === "/api/takeout/suggestions" && request.method === "POST") {
        return corsResponse(env, await handleTakeoutSuggestionsPost(request, env));
      }
      // ── Lunch decisions per date ──
      if (path === "/api/lunch/decisions" && request.method === "GET") {
        return corsResponse(env, await handleLunchGet(env));
      }
      if (path === "/api/lunch/decisions" && request.method === "POST") {
        return corsResponse(env, await handleLunchPost(request, env));
      }
      // ── School lunch menu (read-only; ingestion is a separate task) ──
      if (path === "/api/school-lunch" && request.method === "GET") {
        return corsResponse(env, await handleSchoolLunchGet(env));
      }
      // ── Birthday gift-status overrides ──
      if (path.startsWith("/api/birthdays/") && request.method === "PATCH") {
        const id = decodeURIComponent(path.split("/api/birthdays/")[1]);
        return corsResponse(env, await handleBirthdayPatch(id, request, env));
      }
      // ── OpenClaw enhancement (copy, summaries, suggestions) ──
      if (path === "/api/claw/enhance" && request.method === "POST") {
        return corsResponse(env, await handleClawEnhance(request, env));
      }
      if (path === "/api/health") {
        // Auth status: check if a valid token was provided (but don't block)
        const auth = request.headers.get("Authorization");
        let authStatus = "no AUTH_TOKEN configured (open access)";
        if (env.AUTH_TOKEN) {
          if (!auth) authStatus = "AUTH_TOKEN set but no token sent — requests will fail";
          else if (auth === `Bearer ${env.AUTH_TOKEN}`) authStatus = "ok";
          else authStatus = "token mismatch — requests will fail";
        }
        return corsResponse(env, json({
          ok: true,
          auth: authStatus,
          hasAuthToken: !!env.AUTH_TOKEN,
          hasOpenAI: !!env.OPENAI_API_KEY,
          hasKnowledgeTextBridge: !!knowledgeBridgeUrl(env),
          hasCalDAV: !!(env.ICLOUD_APPLE_ID && env.ICLOUD_APP_PASSWORD),
          hasCalendarUrls: !!(env.CALENDAR_URLS),
          hasPhotos: !!env.PHOTOS_ALBUM_TOKEN,
          hasNotifications: !!env.NOTIFICATIONS,
          openaiModel: openaiModel(env),
          knowledgeTextModel: knowledgeTextModel(env),
          openaiImageModel: openaiImageModel(env),
          imageGenerationProvider: "openai",
          imageGenerationModel: openaiImageModel(env),
          imageGenerationQuality: imageGenerationQuality(env),
          imageGenerationSize: imageGenerationSize(env),
          imageGenerationOutputFormat: imageGenerationOutputFormat(env),
          imageGenerationEnabled: imageGenerationEnabled(env),
          openaiEnhanceModel: openaiEnhanceModel(env),
        }));
      }
      return corsResponse(env, json({ error: "Not found" }, 404));
    } catch (e) {
      return corsResponse(env, json({ error: e.message }, 500));
    }
  },
};

// ── Helpers ──────────────────────────────────────────────────────────

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function corsResponse(env, response) {
  const origin = env.ALLOWED_ORIGIN || "*";
  const headers = new Headers(response.headers);
  headers.set("Access-Control-Allow-Origin", origin);
  headers.set("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-OpenClaw-Bridge-Token");
  return new Response(response.body, {
    status: response.status,
    headers,
  });
}

const DEFAULT_OPENAI_MODEL = "gpt-5.4-mini";
const DEFAULT_OPENAI_IMAGE_MODEL = "gpt-image-2";
const DEFAULT_IMAGE_GENERATION_QUALITY = "low";
const DEFAULT_IMAGE_GENERATION_SIZE = "1536x1024";
const DEFAULT_IMAGE_GENERATION_OUTPUT_FORMAT = "jpeg";
const DEFAULT_IMAGE_GENERATION_TIMEOUT_MS = 120000;
const DEFAULT_KNOWLEDGE_TEXT_PROVIDER = "openclaw-bridge";

function openaiModel(env) {
  return env.OPENAI_MODEL || DEFAULT_OPENAI_MODEL;
}

function openaiCompletionTokenLimit(model, maxTokens) {
  return String(model || "").startsWith("gpt-5")
    ? { max_completion_tokens: maxTokens }
    : { max_tokens: maxTokens };
}

function openaiImageModel(env) {
  return DEFAULT_OPENAI_IMAGE_MODEL;
}

function imageGenerationQuality(env) {
  const quality = env.IMAGE_GENERATION_QUALITY || DEFAULT_IMAGE_GENERATION_QUALITY;
  if (quality === "high" && env.IMAGE_GENERATION_ALLOW_HIGH_QUALITY !== "true") {
    return DEFAULT_IMAGE_GENERATION_QUALITY;
  }
  return quality;
}

function imageGenerationSize(env) {
  return env.IMAGE_GENERATION_SIZE || DEFAULT_IMAGE_GENERATION_SIZE;
}

function imageGenerationOutputFormat(env) {
  return env.IMAGE_GENERATION_OUTPUT_FORMAT || DEFAULT_IMAGE_GENERATION_OUTPUT_FORMAT;
}

function imageGenerationTimeoutMs(env) {
  const configured = Number(env.IMAGE_GENERATION_TIMEOUT_MS);
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_IMAGE_GENERATION_TIMEOUT_MS;
}

function imageGenerationEnabled(env) {
  return env.IMAGE_GENERATION_ENABLED !== "false";
}

function knowledgeBridgeUrl(env) {
  const raw = env.KNOWLEDGE_TEXT_BRIDGE_URL || env.OPENCLAW_BRIDGE_URL || "";
  if (!raw) return "";
  try {
    const url = new URL(raw);
    url.pathname = `${url.pathname.replace(/\/+$/, "")}/knowledge-json`;
    return url.toString();
  } catch {
    return "";
  }
}

function knowledgeBridgeFeedbackUrl(env) {
  const raw = knowledgeBridgeUrl(env);
  if (!raw) return "";
  const url = new URL(raw);
  url.pathname = url.pathname.replace(/\/knowledge-json$/, "/knowledge-feedback");
  return url.toString();
}

function knowledgeTextModel(env) {
  return knowledgeBridgeUrl(env) ? DEFAULT_KNOWLEDGE_TEXT_PROVIDER : openaiModel(env);
}

function openaiEnhanceModel(env) {
  return env.OPENAI_ENHANCE_MODEL || CLAW_ENHANCE_DEFAULT_MODEL;
}

function isGptImageModel(model) {
  return String(model || "").startsWith("gpt-image-");
}

function imageGenerationBody(model, prompt, options = {}) {
  const outputFormat = options.outputFormat || DEFAULT_IMAGE_GENERATION_OUTPUT_FORMAT;
  return {
    model,
    prompt,
    ...(isGptImageModel(model) ? {} : { n: 1 }),
    size: options.size || DEFAULT_IMAGE_GENERATION_SIZE,
    quality: isGptImageModel(model) ? (options.quality || DEFAULT_IMAGE_GENERATION_QUALITY) : "standard",
    ...(isGptImageModel(model) ? { output_format: outputFormat } : {}),
  };
}

function imageResultUrl(data, outputFormat = "png") {
  const item = data?.data?.[0];
  if (!item) return null;
  if (item.url) return item.url;
  if (item.b64_json) return `data:image/${outputFormat};base64,${item.b64_json}`;
  return null;
}

// ── Ask (OpenAI proxy) ─────────────────────────────────────────────

async function handleAsk(request, env) {
  if (!env.OPENAI_API_KEY) {
    return json({ error: "OPENAI_API_KEY not configured" }, 500);
  }

  const body = await request.json();
  const { query, history = [] } = body;
  if (!query) return json({ error: "Missing query" }, 400);

  const model = openaiModel(env);
  const imageModel = openaiImageModel(env);

  const systemMsg = {
    role: "system",
    content:
      "You are a helpful family home assistant. Keep answers concise, friendly, and family-appropriate. " +
      "When it would be helpful, describe a scene or concept visually. " +
      "If the user's question would benefit from an illustration, end your response with a line: " +
      "[IMAGE_PROMPT: <a detailed prompt for generating an illustrative image>]",
  };

  const messages = [
    systemMsg,
    ...history.map((m) => ({
      role: m.r === "u" ? "user" : "assistant",
      content: m.t,
    })),
    { role: "user", content: query },
  ];

  // Chat completion
  const chatRes = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({ model, messages, ...openaiCompletionTokenLimit(model, 512) }),
  });

  if (!chatRes.ok) {
    const err = await chatRes.json().catch(() => ({}));
    return json({ error: err.error?.message || `OpenAI error: ${chatRes.status}` }, 502);
  }

  const chatData = await chatRes.json();
  let text = chatData.choices?.[0]?.message?.content || "No response.";
  let imageUrl = null;

  // Check if LLM wants to generate an image
  const imgMatch = text.match(/\[IMAGE_PROMPT:\s*(.+?)\]/);
  if (imgMatch) {
    text = text.replace(/\[IMAGE_PROMPT:\s*.+?\]/, "").trim();
    try {
      const outputFormat = imageGenerationOutputFormat(env);
      const imgRes = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify(imageGenerationBody(imageModel, imgMatch[1], {
          size: imageGenerationSize(env),
          quality: imageGenerationQuality(env),
          outputFormat,
        })),
      });
      if (imgRes.ok) {
        const imgData = await imgRes.json();
        imageUrl = imageResultUrl(imgData, outputFormat);
      }
    } catch {
      // Image generation failed silently
    }
  }

  return json({ text, imageUrl });
}

// ── LLM Query (classified knowledge) ────────────────────────────────

const LLM_LATEST_KEY = "llm_latest";
const LLM_HISTORY_KEY = "llm_history";
const MAX_LLM_HISTORY = 50;

async function storeLLMResponse(response, env) {
  if (!env.NOTIFICATIONS) {
    return json({ error: "NOTIFICATIONS KV namespace not configured" }, 500);
  }

  await env.NOTIFICATIONS.put(LLM_LATEST_KEY, JSON.stringify(response));

  const history = await env.NOTIFICATIONS.get(LLM_HISTORY_KEY, { type: "json" }) || [];
  const historyItem = {
    id: response.id,
    query: response.query,
    type: response.type,
    title: response.title,
    summary: response.summary,
    imageUrl: response.imageUrl,
    timestamp: response.timestamp,
    source: response.source,
    tier: response.tier,
    model: response.model,
    updatedAt: response.updatedAt || response.timestamp,
    imagePending: response.imagePending === true,
  };
  const existingIndex = history.findIndex((item) => item.id === response.id);
  const nextHistory = existingIndex >= 0
    ? [historyItem, ...history.slice(0, existingIndex), ...history.slice(existingIndex + 1)]
    : [historyItem, ...history];
  await env.NOTIFICATIONS.put(LLM_HISTORY_KEY, JSON.stringify(nextHistory.slice(0, MAX_LLM_HISTORY)));

  return json(response);
}

async function handleAskQuery(request, env, ctx) {
  if (!env.NOTIFICATIONS) {
    return json({ error: "NOTIFICATIONS KV namespace not configured" }, 500);
  }

  const body = await request.json();
  const { query } = body;
  if (!query) return json({ error: "Missing query" }, 400);
  const debugRetrieval = body.debug === true || body.includeRetrievalDiagnostics === true
    || env.KNOWLEDGE_RETRIEVAL_DEBUG === "true";

  const model = knowledgeTextModel(env);
  const subject = normalizeKnowledgeSubject(query);
  const classificationResult = await classifyKnowledgeQuery(query, subject, env, model);
  const classification = sanitizeKnowledgeClassification(query, subject, classificationResult.data);
  let retrieved = await retrieveKnowledge(query, subject, classification, env);
  const answerResult = await buildKnowledgeAnswer(query, subject, classification, retrieved, env, model);
  let parsed = sanitizeKnowledgeAnswer(query, subject, classification, answerResult.data, retrieved);
  const deterministicAnswer = deterministicKnowledgeAnswer(query, subject, classification);
  if (deterministicAnswer) {
    delete deterministicAnswer.forceGeneratedVisual;
    parsed = deterministicAnswer;
  }
  if (parsed.imageSourceType === "known" && !retrieved.image?.url) {
    retrieved = await retrieveKnowledge(query, subject, classification, env, parsed);
  }
  const textModel = answerResult.modelInfo || classificationResult.modelInfo || { provider: "fallback", model };

  const explicitGenerationPrompt = parsed.imagePrompt || "";
  const explicitShouldGenerateImage = parsed.imageSourceType === "generated" && !!explicitGenerationPrompt;
  const retrievedImage = !explicitShouldGenerateImage && parsed.imageSourceType === "known" && retrieved.image?.url
    ? normalizeKnowledgeAsset(retrieved.image, "hero")
    : null;
  const visualPlan = buildKnowledgeVisualPlan({
    query,
    title: parsed.title || classification.title || subject,
    type: parsed.type || classification.type || "concept",
    summary: parsed.summary || "",
    profile: parsed.profile || null,
    image: retrievedImage,
    imageSourceType: parsed.imageSourceType,
    visualNeed: parsed.visualNeed || classification.visualNeed || "useful",
    classification,
    retrieved,
  });
  const artDirectedFallbackGeneration = !retrievedImage
    && parsed.imageSourceType === "known"
    && env.ENABLE_ART_DIRECTED_HERO_GENERATION === "true";
  const generationPrompt = explicitGenerationPrompt || (artDirectedFallbackGeneration
    ? artDirectedHeroPrompt({ title: parsed.title || classification.title || subject, visualPlan })
    : "");
  const shouldGenerateImage = explicitShouldGenerateImage || artDirectedFallbackGeneration;
  const heroComposition = buildHeroCompositionPackage(visualPlan, retrievedImage);
  const startedAt = Date.now();
  const response = {
    id: `knowledge_${startedAt}_${Math.random().toString(36).slice(2, 6)}`,
    kind: "knowledge",
    query,
    type: parsed.type || classification.type || "concept",
    title: parsed.title || classification.title || query,
    summary: parsed.summary || "",
    sections: Array.isArray(parsed.sections) ? parsed.sections : [],
    infographic: parsed.infographic || null,
    infographics: Array.isArray(parsed.infographics) ? parsed.infographics : [],
    profile: parsed.profile || null,
    imageSourceType: parsed.imageSourceType,
    imageQuery: parsed.imageQuery || null,
    imageUrl: retrievedImage?.url || null,
    image: retrievedImage,
    curatedAsset: retrievedImage ? {
      mode: retrievedImage.assetMode || retrievedImage.mode || "retrieved",
      status: "ready",
      assetRole: retrievedImage.assetRole || "hero",
      url: retrievedImage.url,
      originalUrl: retrievedImage.originalUrl || retrievedImage.url,
      source: retrievedImage.source || null,
      sourceUrl: retrievedImage.sourceUrl || null,
      pageTitle: retrievedImage.attribution?.title || retrievedImage.alt || null,
      credit: retrievedImage.credit || retrievedImage.attribution?.author || null,
      license: retrievedImage.license || null,
      width: retrievedImage.width || null,
      height: retrievedImage.height || null,
      focalPoint: retrievedImage.focalPoint || null,
      cropHint: retrievedImage.cropHint || null,
      tone: retrievedImage.tone || null,
      score: retrievedImage.score ?? null,
      reasons: retrievedImage.reasons || [],
    } : {
      mode: parsed.imageSourceType === "diagram" || parsed.visualNeed === "none" ? "fallback" : "fallback",
      status: "missing",
      assetRole: "hero",
      url: null,
      reasons: [parsed.visualNeed === "none"
        ? "visual_not_needed"
        : (parsed.imageSourceType === "diagram" ? "ui_rendered_diagram" : "retrieval_failed")],
    },
    imagePrompt: parsed.imagePrompt || null,
    imagePending: shouldGenerateImage,
    visualPlan,
    heroComposition,
    visual: buildKnowledgeVisual(retrievedImage, {
      need: parsed.visualNeed || classification.visualNeed || "useful",
      strategy: shouldGenerateImage ? "generating" : "none",
      attemptedModel: shouldGenerateImage ? openaiImageModel(env) : null,
      fallbackReason: parsed.visualNeed === "none"
        ? "visual_not_needed"
        : (parsed.imageSourceType === "diagram" ? "ui_rendered_diagram" : (shouldGenerateImage ? "image_generating" : "retrieval_failed")),
      visualPlan,
      heroComposition,
    }),
    retrieval: {
      classification,
      subject,
      source: retrieved.source,
      nasa: retrieved.nasa ? { title: retrieved.nasa.title, sourceUrl: retrieved.nasa.sourceUrl } : null,
      wikipedia: retrieved.wikipedia ? {
        title: retrieved.wikipedia.title,
        sourceUrl: retrieved.wikipedia.sourceUrl,
      } : null,
      cachedImage: retrieved.cachedImage ? { source: retrieved.cachedImage.source, sourceUrl: retrieved.cachedImage.sourceUrl } : null,
      ...(debugRetrieval ? { diagnostics: retrieved.diagnostics } : {}),
    },
    source: "knowledge-pipeline",
    log_row_id: answerResult.modelInfo?.logRowId || null,
    model: textModel.model || textModel.provider || model,
    text: {
      provider: textModel.provider || "unknown",
      tier: textModel.tier || null,
      model: textModel.model || model,
    },
    timestamp: startedAt,
    updatedAt: startedAt,
  };

  if (!shouldGenerateImage) {
    if (retrievedImage?.mode === "retrieved" && retrieved.source !== "cache") {
      const cachePromise = cacheKnowledgeImage(env, query, subject, classification, retrievedImage);
      if (ctx?.waitUntil) ctx.waitUntil(cachePromise);
      else await cachePromise;
    }
    return storeLLMResponse(response, env);
  }

  await storeLLMResponse(response, env);

  const finishImage = async () => {
    let image = null;
    let generatedImage = null;
    let generationFailed = false;
    generatedImage = await generateKnowledgeImage(generationPrompt, query, env, parsed);
    if (generatedImage?.url) {
      image = normalizeKnowledgeAsset(generatedImage, "hero");
      await cacheKnowledgeImage(env, query, subject, classification, image);
    } else {
      generationFailed = true;
    }

    const updatedResponse = {
      ...response,
      imageUrl: image?.url || null,
      image,
      curatedAsset: image ? {
        mode: image.assetMode || image.mode || "generated",
        status: "ready",
        assetRole: image.assetRole || "hero",
        url: image.url,
        originalUrl: image.originalUrl || image.url,
        source: image.source || null,
        sourceUrl: image.sourceUrl || null,
        credit: image.credit || null,
        width: image.width || null,
        height: image.height || null,
        focalPoint: image.focalPoint || null,
        cropHint: image.cropHint || null,
        tone: image.tone || null,
        score: image.score ?? null,
        reasons: image.reasons || [],
      } : response.curatedAsset,
      imagePending: false,
      updatedAt: Date.now(),
      visualPlan: buildKnowledgeVisualPlan({
        query,
        title: parsed.title || classification.title || subject,
        type: parsed.type || classification.type || "concept",
        summary: parsed.summary || "",
        profile: parsed.profile || null,
        image,
        imageSourceType: image ? "generated" : parsed.imageSourceType,
        visualNeed: parsed.visualNeed || classification.visualNeed || "useful",
        classification,
        retrieved,
      }),
      visual: buildKnowledgeVisual(image, {
        need: parsed.visualNeed || classification.visualNeed || "useful",
        strategy: image?.mode || (generationFailed ? "generation_failed" : "none"),
        generatedImage,
        attemptedModel: generationFailed ? openaiImageModel(env) : null,
        fallbackReason: image ? null : (generationFailed ? "generation_failed" : "retrieval_failed"),
      }),
    };
    updatedResponse.heroComposition = buildHeroCompositionPackage(updatedResponse.visualPlan, image);
    updatedResponse.visual = {
      ...updatedResponse.visual,
      plan: updatedResponse.visualPlan,
      heroComposition: updatedResponse.heroComposition,
    };

    await storeLLMResponse(updatedResponse, env);
    return updatedResponse;
  };

  return json(await finishImage());
}

async function openaiJson(env, model, messages, maxTokens = 1024) {
  if (!env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY not configured");
  }
  const chatRes = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      messages,
      ...openaiCompletionTokenLimit(model, maxTokens),
      response_format: { type: "json_object" },
    }),
  });
  if (!chatRes.ok) {
    const err = await chatRes.json().catch(() => ({}));
    throw new Error(err.error?.message || `OpenAI error: ${chatRes.status}`);
  }
  const chatData = await chatRes.json();
  const rawText = chatData.choices?.[0]?.message?.content || "{}";
  return {
    data: JSON.parse(rawText),
    modelInfo: { provider: "openai", tier: "openai", model },
  };
}

async function knowledgeJson(env, model, messages, maxTokens = 1024) {
  const bridgeUrl = knowledgeBridgeUrl(env);
  if (bridgeUrl) {
    try {
      const bridgeRes = await fetch(bridgeUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(env.OPENCLAW_BRIDGE_TOKEN ? { "X-OpenClaw-Bridge-Token": env.OPENCLAW_BRIDGE_TOKEN } : {}),
        },
        body: JSON.stringify({
          messages,
          maxTokens,
          temperature: 0.2,
        }),
      });
      if (!bridgeRes.ok) {
        const text = await bridgeRes.text().catch(() => "");
        throw new Error(`OpenClaw bridge error ${bridgeRes.status}: ${text.slice(0, 200)}`);
      }
      const bridgeData = await bridgeRes.json();
      if (!bridgeData?.json || typeof bridgeData.json !== "object") {
        throw new Error("OpenClaw bridge returned no JSON object");
      }
      return {
        data: bridgeData.json,
        modelInfo: {
          provider: "openclaw-bridge",
          tier: bridgeData.tier || null,
          model: bridgeData.model || DEFAULT_KNOWLEDGE_TEXT_PROVIDER,
          logRowId: bridgeData.log_row_id || null,
        },
      };
    } catch (err) {
      console.warn(`Knowledge bridge failed; falling back to OpenAI: ${err.message}`);
    }
  }

  return openaiJson(env, openaiModel(env), messages, maxTokens);
}

async function classifyKnowledgeQuery(query, subject, env, model) {
  try {
    return await knowledgeJson(env, model, [
      {
        role: "system",
        content:
          "Classify a family TV dashboard knowledge question. Respond with JSON only: " +
          "{\"type\":\"location|person|fauna|flora|event|concept\",\"title\":\"short subject title\"," +
          "\"visualNeed\":\"none|useful|required\",\"spaceScience\":true,\"entityQuery\":\"best Wikipedia/NASA search phrase\"," +
          "\"visualSearchQuery\":\"best image search phrase\"}. " +
          "The title, entityQuery, and visualSearchQuery must describe the user's subject, not the assistant, wake words, or dashboard controls. " +
          "Set spaceScience true for astronomy, NASA, planets, stars, spaceflight, Earth science, or physical science topics.",
      },
      { role: "user", content: JSON.stringify({ query, subject }) },
    ], 512);
  } catch {
    return {
      data: {
        type: "concept",
        title: subject,
        visualNeed: "useful",
        spaceScience: isSpaceScienceQuery(subject),
        entityQuery: subject,
        visualSearchQuery: subject,
      },
      modelInfo: { provider: "fallback", tier: "deterministic", model: "deterministic-classifier" },
    };
  }
}

async function buildKnowledgeAnswer(query, subject, classification, retrieved, env, model) {
  const retrievalContext = {
    nasa: retrieved.nasa ? {
      title: retrieved.nasa.title,
      description: retrieved.nasa.description,
      sourceUrl: retrieved.nasa.sourceUrl,
      credit: retrieved.nasa.credit,
    } : null,
    wikipedia: retrieved.wikipedia ? {
      title: retrieved.wikipedia.title,
      description: retrieved.wikipedia.description,
      extract: retrieved.wikipedia.extract,
      sourceUrl: retrieved.wikipedia.sourceUrl,
    } : null,
  };
  try {
    return await knowledgeJson(env, model, [
      {
        role: "system",
        content: `You are a family knowledge assistant for a TV dashboard. Use the retrieved source context first and answer with valid JSON only.

The answer must be about the user's subject. If retrieved context is missing or unrelated, say what the subject likely is and keep the response grounded in the subject rather than inventing a different topic.

Response format:
{
  "type": "location" | "person" | "fauna" | "flora" | "event" | "concept",
  "title": "Short title",
  "summary": "2-3 sentence direct answer",
  "sections": [
    { "heading": "Section Name", "content": "2-4 concise sentences" }
  ],
  "profile": {
    "facts": [
      { "label": "Required fact label", "value": "Short value", "detail": "Optional one sentence" }
    ],
    "maps": [
      { "scope": "world|continent|country|city", "label": "Map label", "value": "What should be highlighted" }
    ],
    "relatedConcepts": ["Only for concept questions when useful"]
  },
  "infographics": [
    {
      "title": "Short infographic title",
      "kind": "metric|comparison|timeline|map|process",
      "description": "What the generated visual should show",
      "items": [
        { "label": "Readable label", "value": "Short value" }
      ]
    }
  ],
  "infographic": {
    "type": "stats",
    "items": [
      { "label": "Key Stat", "value": "Value" }
    ]
  },
  "visualNeed": "none" | "useful" | "required",
  "imageSourceType": "known" | "generated" | "diagram" | "none",
  "imageQuery": "Search-style terms only when imageSourceType is known or diagram",
  "imagePrompt": "Generation-style prompt only when imageSourceType is generated"
}

Dynamic page requirements:
- location: profile.maps must include world and continent maps when possible, profile.facts must include area size, and infographics must include 1-2 quantifiable facts or comparisons.
- person: profile.facts must include only the strongest compact facts, prioritizing "Born date" and "Known For". The timeline should begin with the born date plus birthplace, use the middle item for expanded contributions, and use "Legacy" instead of a final year when explaining long-term impact. The main section should focus on practical legacy and relevance today, not repeat name and birthplace. Include an "At A Glance" infographic with exactly three major contributed concepts, each with a short text description and an icon hint.
- fauna: profile.facts must include species and years on earth, profile.maps must include a world range/habitat map, and infographics must include 1-2 quantified habitat, size, life-cycle, or behavior facts.
- flora: profile.facts must include species and years on earth, profile.maps must include a world range map, and infographics must include 1-2 quantified range, size, growth, or ecology facts.
- event: profile.maps must include country and city maps when known, profile.facts must include date, and infographics must include 1-2 timeline, scale, participants, or outcome facts.
- concept: profile.facts must include date if invented or discovered when applicable; otherwise say "Not invented" or "Evolved naturally" as appropriate. Include relatedConcepts. For relational concepts such as photosynthesis, infographics must be process/how-it-works diagrams rather than fake quantitative charts.

Image source rules:
- known: a real photograph, archival image, canonical portrait, landmark photo, NASA/Wikipedia/Wikimedia image, or other sourceable image exists. Use imageQuery only.
- diagram: a labeled educational diagram is the right visual, such as anatomy, cycles, mechanisms, or parts. Use imageQuery only.
- generated: the user asks for an imagined scene, hypothetical visual, or symbolic picture and no canonical image exists. Use imagePrompt only.
- none: the answer does not benefit from a visual, the query is sensitive, or the question asks for a definition, meaning, value, feeling, or abstract idea with no concrete visual referent. Omit imageQuery and imagePrompt.

For refusal-shaped responses, still return the JSON schema. Use imageSourceType "none" and omit imageQuery/imagePrompt. Put the refusal and safe redirect or escalation in summary and sections.

Visual referent rule: do not create symbolic images just because a metaphor is possible. Abstract concepts such as justice, freedom, consciousness, loneliness, fairness, or meaning should be imageSourceType none unless the user explicitly asks for a symbolic picture.

Exactly one visual field rule: known/diagram include imageQuery and omit imagePrompt; generated includes imagePrompt and omits imageQuery; none omits both.

Examples: Apollo 11 -> known with imageQuery "Apollo 11 lunar module Eagle moon surface NASA archival photo"; the Sun -> known with imageQuery "NASA Sun image solar disk Earth size comparison"; Ada Lovelace -> known with imageQuery "Ada Lovelace portrait Wikimedia Commons"; Mount Everest -> known with imageQuery "Mount Everest Himalayas photo"; Eiffel Tower -> known, not generated; justice, freedom, consciousness, loneliness, fairness, or meaning definitions -> none; photosynthesis -> diagram with imageQuery "photosynthesis process diagram"; transformer mechanism -> diagram with imageQuery "electrical transformer labeled diagram"; parts of a flower -> diagram with imageQuery "labeled flower anatomy diagram"; ibis, Joshua tree, or Kyoto -> known with imageQuery; draw a picture of democracy -> generated; red wine health -> none; private address -> none.

Keep content family-friendly, concise, and suitable for being read across a room. All infographic labels must be short enough for a TV display.`,
      },
      {
        role: "user",
        content: JSON.stringify({ query, subject, classification, retrievalContext }),
      },
    ], 1400);
  } catch {
    return {
      data: {
        type: classification.type || "concept",
        title: classification.title || subject,
        summary: retrieved.wikipedia?.extract || retrieved.nasa?.description || fallbackKnowledgeSummary(subject),
        sections: [],
        infographic: null,
        infographics: [],
        profile: defaultKnowledgeProfile(classification.type || "concept", subject),
        visualNeed: classification.visualNeed || "useful",
        imageSourceType: classification.visualNeed === "none" ? "none" : "known",
        imageQuery: classification.visualNeed === "none" ? "" : classification.visualSearchQuery || classification.entityQuery || subject,
      },
      modelInfo: { provider: "fallback", tier: "retrieval", model: "retrieval-summary" },
    };
  }
}

async function retrieveKnowledge(query, subject, classification, env, parsed = null) {
  const diagnostics = createRetrievalDiagnostics(query, subject, classification, parsed);
  const terms = knowledgeRetrievalTerms(query, subject, classification, parsed);
  const searchQuery = terms.searchQuery;
  const entityQuery = terms.entityQuery;
  diagnostics.normalizedSubject = terms.normalizedSubject;
  diagnostics.candidateQueries = terms.candidates;
  const spaceScience = classification.spaceScience === true || isSpaceScienceQuery(subject);
  let nasa = null;
  let wikipedia = null;
  let image = null;
  let source = "none";
  let fallbackReason = "";
  const candidateImages = [];
  const pinnedAsset = findPinnedCuratedAsset(env, subject, classification, parsed);
  diagnostics.attempted.push({
    source: "pinned",
    candidateQuery: pinnedAsset?.topicKey || terms.normalizedSubject,
    selectedPageTitle: pinnedAsset?.title || null,
    candidateImageUrlPresent: !!pinnedAsset?.url,
    relevance: pinnedAsset?.url ? "pass" : "missing",
    failureReason: pinnedAsset ? "" : "no_pinned_asset",
  });
  if (pinnedAsset?.url) {
    candidateImages.push(scoreKnowledgeImageCandidate(pinnedAsset, {
      type: classification.type,
      subject: terms.normalizedSubject,
      source: "pinned",
    }));
  }
  const cachedImage = await getCachedKnowledgeImage(env, knowledgeImageCacheCandidates(query, subject, classification));
  diagnostics.attempted.push({ source: "cache", candidateQuery: "knowledge:image:v2", imagePresent: !!cachedImage?.url });
  if (cachedImage?.url) {
    candidateImages.push(scoreKnowledgeImageCandidate(cachedImage, {
      type: classification.type,
      subject: terms.normalizedSubject,
      source: "cache",
    }));
  }

  if (spaceScience) {
    nasa = await fetchNasaImage(searchQuery);
    const scored = scoreKnowledgeImageCandidate(nasa?.image, {
      type: classification.type,
      subject: terms.normalizedSubject,
      source: "nasa",
      pageTitle: nasa?.title,
      preferred: true,
    });
    diagnostics.attempted.push({
      source: "NASA",
      candidateQuery: searchQuery,
      selectedPageTitle: nasa?.title || null,
      candidateImageUrlPresent: !!nasa?.image?.url,
      relevance: scored.accepted ? "pass" : (nasa?.image?.url ? "fail" : "missing"),
      score: scored.score,
      failureReason: scored.accepted ? "" : scored.reasons.join(","),
    });
    if (nasa?.image?.url) candidateImages.push(scored);
  }

  const wikipediaResult = await fetchWikipediaSummary(entityQuery, terms.normalizedSubject, classification.type);
  diagnostics.attempted.push(...(wikipediaResult?.diagnostics || [{
    source: "Wikipedia",
    candidateQuery: entityQuery,
    candidateImageUrlPresent: false,
    relevance: "missing",
  }]));
  wikipedia = wikipediaResult?.title || wikipediaResult?.image ? wikipediaResult : null;
  if (wikipedia?.image?.url) {
    candidateImages.push(scoreKnowledgeImageCandidate(wikipedia.image, {
      type: classification.type,
      subject: terms.normalizedSubject,
      source: "wikipedia",
      pageTitle: wikipedia.title,
    }));
  }
  const commonsResult = await fetchWikimediaCommonsImage(searchQuery, terms.normalizedSubject, classification.type);
  diagnostics.attempted.push(...(commonsResult?.diagnostics || [{
    source: "Wikimedia Commons",
    candidateQuery: searchQuery,
    candidateImageUrlPresent: false,
    relevance: "missing",
  }]));
  const commons = commonsResult?.title || commonsResult?.image ? commonsResult : null;
  if (commons?.image?.url) {
    candidateImages.push(scoreKnowledgeImageCandidate(commons.image, {
      type: classification.type,
      subject: terms.normalizedSubject,
      source: "wikimedia",
      pageTitle: commons.title,
    }));
    if (!wikipedia) wikipedia = commons;
  }

  const selected = selectCuratedCandidate(candidateImages);
  if (selected?.asset) {
    image = decorateCuratedAsset(selected.asset, {
      mode: selected.asset.mode || selected.mode,
      score: selected.score,
      reasons: selected.reasons,
      type: classification.type,
      source: selected.source,
    });
    source = selected.source || image.mode || "retrieved";
  }
  if (!image) {
    fallbackReason = source === "none" ? "no_relevant_retrieved_image" : "retrieval_failed";
  }
  diagnostics.final = {
    selectedSource: source,
    fallbackReason,
    assetMode: image?.mode || (fallbackReason ? "fallback" : null),
    candidates: candidateImages.map((candidate) => ({
      source: candidate.source,
      mode: candidate.mode,
      score: candidate.score,
      accepted: candidate.accepted,
      title: candidate.asset?.attribution?.title || candidate.pageTitle || candidate.asset?.alt || null,
      imageUrlPresent: !!candidate.asset?.url,
      reasons: candidate.reasons,
    })),
    image: image ? {
      source: image.source || source,
      sourceUrl: image.sourceUrl || null,
      imageUrl: image.url || null,
      width: image.width || null,
      height: image.height || null,
      credit: image.credit || null,
      focalPoint: image.focalPoint || null,
      cropHint: image.cropHint || null,
      tone: image.tone || null,
      score: image.score || null,
    } : null,
  };

  return {
    source,
    strategy: image?.mode || source,
    nasa,
    wikipedia,
    cachedImage,
    image,
    diagnostics,
  };
}

function isSpaceScienceQuery(query) {
  return /\b(nasa|space|sun|star|planet|moon|mars|venus|jupiter|saturn|galaxy|universe|asteroid|comet|nebula|eclipse|rocket|astronaut|telescope|earth|orbit|solar|lunar)\b/i.test(query);
}

function findPinnedCuratedAsset(env, subject, classification = {}, parsed = null) {
  const keys = new Set([
    curatedTopicKey(subject),
    curatedTopicKey(classification.title),
    curatedTopicKey(classification.entityQuery),
    curatedTopicKey(parsed?.title),
  ].filter(Boolean));
  const match = curatedKnowledgeAssetsFromEnv(env)
    .find((asset) => keys.has(curatedTopicKey(asset.topicKey || asset.title)));
  if (!match?.heroImage?.url) return match ? { ...match, url: null } : null;
  return decorateCuratedAsset({
    ...match.heroImage,
    topicKey: match.topicKey,
    queryType: match.type || classification.type || parsed?.type || "concept",
    title: match.title || parsed?.title || classification.title || subject,
    url: match.heroImage.url,
    imageUrl: match.heroImage.imageUrl || match.heroImage.url,
    image: match.heroImage.image || match.heroImage.url,
    source: match.heroImage.source || "Curated",
    sourceUrl: match.heroImage.sourceUrl || null,
    credit: match.heroImage.credit || null,
    license: match.heroImage.license || null,
    width: match.heroImage.width || null,
    height: match.heroImage.height || null,
    mode: "pinned",
    assetMode: "pinned",
    assetRole: match.assetRole || "hero",
    focalPoint: match.heroImage.focalPoint || match.focalPoint,
    cropHint: match.heroImage.cropHint || match.cropHint,
    tone: match.heroImage.tone || match.tone,
    attribution: {
      title: match.title || subject,
      author: match.heroImage.credit || match.heroImage.source || "Curated",
      pageUrl: match.heroImage.sourceUrl || null,
    },
  }, {
    mode: "pinned",
    type: match.type || classification.type,
    source: "pinned",
  });
}

function scoreKnowledgeImageCandidate(asset, context = {}) {
  const candidate = {
    asset,
    source: context.source || asset?.source || "retrieved",
    pageTitle: context.pageTitle || asset?.attribution?.title || asset?.alt || "",
    mode: asset?.mode || (context.source === "pinned" ? "pinned" : "retrieved"),
    accepted: false,
    score: 0,
    reasons: [],
  };
  if (!asset?.url) {
    candidate.reasons.push("missing_url");
    return candidate;
  }

  const type = context.type || "concept";
  const haystack = `${asset.url} ${asset.source || ""} ${asset.sourceUrl || ""} ${candidate.pageTitle} ${asset.alt || ""}`.toLowerCase();
  const width = Number(asset.width || 0);
  const height = Number(asset.height || 0);
  const subjectRelevant = isRelevantToSubject(context.subject || "", `${candidate.pageTitle} ${asset.url} ${asset.alt || ""}`);
  let score = 40;
  if (candidate.source === "pinned" || asset.mode === "pinned") {
    score += 60;
    candidate.reasons.push("pinned_override");
  }
  if (/nasa/i.test(asset.source || candidate.source)) score += type === "event" || context.preferred ? 24 : 10;
  if (/wikipedia|wikimedia/i.test(asset.source || candidate.source)) score += 18;
  if (asset.sourceUrl) score += 10;
  if (asset.credit || asset.license || asset.attribution?.author) score += 6;
  if (width >= 900 && height >= 500) score += 14;
  else if (width && height && (width < 360 || height < 220)) {
    score -= 35;
    candidate.reasons.push("too_small");
  }
  if (width && height) {
    const ratio = width / height;
    if (ratio >= 1.25 && ratio <= 2.4) score += 10;
    if (ratio < 0.75) {
      score -= type === "person" ? 2 : 18;
      candidate.reasons.push("portrait_crop");
    }
  }
  if (subjectRelevant) score += 18;
  else {
    score -= 32;
    candidate.reasons.push("weak_subject_overlap");
  }
  if (/\b(svg|icon|logo|symbol|emblem|seal|coat[_ -]?of[_ -]?arms|flag)\b/.test(haystack)) {
    score -= 60;
    candidate.reasons.push("logo_icon_flag");
  }
  if (["person", "fauna", "flora"].includes(type) && /\b(map|range[_ -]?map|distribution[_ -]?map)\b/.test(haystack)) {
    score -= 50;
    candidate.reasons.push("map_for_living_subject");
  }
  if (type === "location" && /\b(bird|animal|penguin|lemur|ibis|whale|shark|seal|frog|lizard|snake|insect|wildlife|closeup|close-up)\b/.test(haystack)) {
    score -= 70;
    candidate.reasons.push("fauna_image_for_location");
  }
  if (type === "location" && /\b(landscape|scenic|coast|coastline|island|aerial|city|skyline|mountain|valley|forest|baobab|beach|bay|river)\b/.test(haystack)) {
    score += 22;
    candidate.reasons.push("location_scenic_subject");
  }
  if (/\b(infographic|poster|diagram|chart|graph|labeled|labelled|text)\b/.test(haystack)) {
    score -= 28;
    candidate.reasons.push("poster_or_diagram_like");
  }

  candidate.score = score;
  candidate.accepted = score >= 45
    && !candidate.reasons.includes("logo_icon_flag")
    && !(type === "location" && candidate.reasons.includes("fauna_image_for_location"));
  if (candidate.accepted) candidate.reasons.push("selected_candidate");
  return candidate;
}

function selectCuratedCandidate(candidates = []) {
  return candidates
    .filter((candidate) => candidate?.accepted && candidate.asset?.url)
    .sort((a, b) => b.score - a.score)[0] || null;
}

function decorateCuratedAsset(asset, context = {}) {
  if (!asset?.url) return null;
  const queryType = context.type || asset.queryType || "concept";
  const cropDefaults = defaultCropForKnowledgeType(queryType);
  const mode = context.mode || asset.assetMode || asset.mode || "retrieved";
  return {
    ...asset,
    url: asset.url,
    imageUrl: asset.imageUrl || asset.url,
    image: asset.image || asset.url,
    mode,
    assetMode: mode,
    assetRole: asset.assetRole || "hero",
    queryType,
    focalPoint: normalizeFocalPoint(asset.focalPoint) || cropDefaults.focalPoint,
    cropHint: asset.cropHint || cropDefaults.cropHint,
    tone: asset.tone || "home-center-dark",
    score: context.score ?? asset.score ?? null,
    reasons: context.reasons || asset.reasons || [],
    originalUrl: asset.originalUrl || asset.url,
  };
}

function normalizeFocalPoint(point) {
  if (!point || !Number.isFinite(Number(point.x)) || !Number.isFinite(Number(point.y))) return null;
  return {
    x: Math.max(0, Math.min(1, Number(point.x))),
    y: Math.max(0, Math.min(1, Number(point.y))),
  };
}

function defaultCropForKnowledgeType(type) {
  if (type === "person" || type === "fauna") {
    return { cropHint: "right-subject", focalPoint: { x: 0.66, y: 0.46 } };
  }
  if (type === "event") {
    return { cropHint: "center-subject", focalPoint: { x: 0.58, y: 0.5 } };
  }
  if (type === "concept") {
    return { cropHint: "left-text-safe", focalPoint: { x: 0.62, y: 0.5 } };
  }
  return { cropHint: "wide-landscape", focalPoint: { x: 0.58, y: 0.5 } };
}

function createRetrievalDiagnostics(query, subject, classification = {}, parsed = null) {
  return {
    originalQuery: query,
    normalizedSubject: subject,
    parsedTitle: parsed?.title || "",
    imageQuery: parsed?.imageQuery || "",
    entityQuery: classification.entityQuery || parsed?.entityQuery || "",
    visualSearchQuery: classification.visualSearchQuery || parsed?.visualSearchQuery || "",
    type: classification.type || parsed?.type || "concept",
    attempted: [],
    candidateQueries: [],
    final: null,
  };
}

function knowledgeRetrievalTerms(query, subject, classification = {}, parsed = null) {
  const normalizedRaw = normalizeKnowledgeSubject(query);
  const candidates = [
    { source: "parsed.title", value: parsed?.title },
    { source: "parsed.entityQuery", value: parsed?.entityQuery },
    { source: "parsed.visualSearchQuery", value: parsed?.visualSearchQuery },
    { source: "parsed.imageQuery", value: parsed?.imageQuery },
    { source: "classification.title", value: classification.title },
    { source: "classification.entityQuery", value: classification.entityQuery },
    { source: "classification.visualSearchQuery", value: classification.visualSearchQuery },
    { source: "normalizedRaw", value: normalizedRaw || subject },
  ]
    .map((candidate) => ({
      ...candidate,
      value: cleanRetrievalSubject(candidate.value || "", subject),
    }))
    .filter((candidate) => candidate.value && isRelevantToSubject(subject, candidate.value));
  const deduped = [];
  const seen = new Set();
  for (const candidate of candidates) {
    const key = candidate.value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(candidate);
  }
  const canonical = deduped.find((candidate) => isCanonicalRetrievalSubject(candidate.value, subject)) || deduped[0];
  const visual = deduped.find((candidate) => /visualSearchQuery|imageQuery/.test(candidate.source)) || canonical;
  return {
    normalizedSubject: canonical?.value || subject,
    entityQuery: canonical?.value || subject,
    searchQuery: visual?.value || canonical?.value || subject,
    candidates: deduped,
  };
}

function cleanRetrievalSubject(value, fallbackSubject = "") {
  let cleaned = compactText(value, 160)
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/^\s*(hey homer|homer)[, ]+/i, "")
    .replace(/^\s*(?:who\s+(?:was|is|were|are|invented|discovered|created|founded)|what\s+(?:was|is|were|are)|where\s+(?:was|is|were|are)|tell\s+me\s+about|explain|describe|show\s+me|give\s+me\s+information\s+about)\s+/i, "")
    .replace(/^\s*what\s+happened\s+(?:during|at|in|on)\s+/i, "")
    .replace(/\b(?:biography|portrait|photo|photograph|image|picture|wikimedia\s+commons|wikipedia|nasa|archival|archive)\b/ig, " ")
    .replace(/\s+/g, " ")
    .replace(/[?.!]+$/g, "")
    .trim();
  if (!cleaned || !isRelevantToSubject(fallbackSubject, cleaned)) {
    cleaned = normalizeKnowledgeSubject(value);
  }
  return compactText(cleaned, 120);
}

function isCanonicalRetrievalSubject(value, subject) {
  const text = compactText(value, 120);
  if (!text || !isRelevantToSubject(subject, text)) return false;
  if (/[?]/.test(text)) return false;
  if (/^(who|what|where|when|why|how|tell|explain|show|give)\b/i.test(text)) return false;
  return text.split(/\s+/).length <= 8;
}

function isAcceptableKnowledgeImage(imageUrl, title = "", query = "", expectedSubject = "", width = null, height = null, type = "concept") {
  if (!imageUrl) return false;
  const haystack = `${imageUrl} ${title} ${query}`.toLowerCase();
  if (/\b(placeholder|no[_-]?image|blank|icon|logo|symbol|emblem|seal|coat[_ -]?of[_ -]?arms|flag)\b/.test(haystack)) {
    return false;
  }
  if (["person", "fauna", "flora"].includes(type) && /\b(map|range[_ -]?map|distribution[_ -]?map)\b/.test(haystack)) {
    return false;
  }
  if (/\.(svg)(?:$|[?#])/i.test(imageUrl)) return false;
  const subjectTokens = knowledgeTokens(expectedSubject);
  const candidateTokens = new Set(knowledgeTokens(`${title} ${imageUrl}`));
  const relevant = !subjectTokens.length || subjectTokens.some((token) => candidateTokens.has(token));
  if (!relevant) return false;
  if (width && height && (Number(width) < 160 || Number(height) < 120)) return false;
  return true;
}

async function fetchNasaImage(query) {
  try {
    const url = new URL("https://images-api.nasa.gov/search");
    url.searchParams.set("q", query);
    url.searchParams.set("media_type", "image");
    const res = await fetch(url.toString());
    if (!res.ok) return null;
    const data = await res.json();
    const item = data?.collection?.items?.find((entry) => entry?.links?.some((link) => link.href));
    const meta = item?.data?.[0];
    const link = item?.links?.find((candidate) => candidate.href)?.href;
    if (!meta || !link) return null;
    const sourceUrl = meta.nasa_id ? `https://images.nasa.gov/details/${encodeURIComponent(meta.nasa_id)}` : item.href;
    const credit = [meta.center, meta.photographer].filter(Boolean).join(" / ") || "NASA";
    return {
      title: meta.title || query,
      description: compactText(meta.description || meta.description_508 || ""),
      sourceUrl,
      credit,
      image: {
        url: link.replace(/^http:/, "https:"),
        imageUrl: link.replace(/^http:/, "https:"),
        image: link.replace(/^http:/, "https:"),
        source: "NASA",
        sourceUrl,
        attribution: {
          title: meta.title || query,
          author: credit,
          pageUrl: sourceUrl,
        },
        credit,
        alt: meta.title || query,
        mode: "retrieved",
        model: null,
      },
    };
  } catch {
    return null;
  }
}

async function fetchWikipediaSummary(query, expectedSubject = query, type = "concept") {
  try {
    const headers = wikipediaRequestHeaders();
    const diagnostics = [];
    const directResult = await fetchWikipediaSummaryPage(query, query, expectedSubject, type, headers, diagnostics);
    if (directResult?.title || directResult?.image) {
      return directResult;
    }

    const searchUrl = new URL("https://en.wikipedia.org/w/rest.php/v1/search/page");
    searchUrl.searchParams.set("q", query);
    searchUrl.searchParams.set("limit", "5");
    const searchRes = await fetch(searchUrl.toString(), { headers });
    if (!searchRes.ok) {
      diagnostics.push({
        source: "Wikipedia search",
        candidateQuery: query,
        candidateImageUrlPresent: false,
        relevance: "fail",
        failureReason: `http_${searchRes.status}`,
      });
      return { diagnostics };
    }
    const searchData = await searchRes.json();
    const pages = Array.isArray(searchData?.pages) ? searchData.pages.slice(0, 5) : [];
    let fallbackSearchResult = null;
    for (const searchPage of pages) {
      const key = searchPage.key || searchPage.title;
      if (!key) continue;
      const searchTitle = searchPage.title || query;
      const searchImageUrl = normalizeExternalImageUrl(searchPage.thumbnail?.url);
      const fallbackSourceUrl = `https://en.wikipedia.org/wiki/${encodeURIComponent(key)}`;
      const searchContext = [searchTitle, searchPage.description, searchPage.excerpt].join(" ");
      const searchRelevant = isRelevantToSubject(expectedSubject, searchContext);
      const searchImageOk = isAcceptableKnowledgeImage(
        searchImageUrl,
        searchTitle,
        query,
        expectedSubject,
        undefined,
        undefined,
        type,
      );
      diagnostics.push({
        source: "Wikipedia",
        candidateQuery: query,
        selectedPageTitle: searchTitle,
        candidateImageUrlPresent: !!searchImageUrl,
        relevance: searchRelevant && searchImageOk ? "pass" : "fail",
        failureReason: searchRelevant ? (searchImageOk ? "" : "bad_search_thumbnail") : "weak_subject_overlap",
      });
      if (!fallbackSearchResult && searchRelevant) {
        fallbackSearchResult = {
          title: searchTitle,
          description: compactText(searchPage.description || ""),
          extract: compactText(searchPage.excerpt || ""),
          sourceUrl: fallbackSourceUrl,
          image: searchImageUrl && searchImageOk
            ? wikipediaImageAsset(searchImageUrl, fallbackSourceUrl, searchTitle, query)
            : null,
          diagnostics,
        };
      }

      const summaryResult = await fetchWikipediaSummaryPage(key, query, expectedSubject, type, headers, diagnostics, {
        fallbackSourceUrl,
        fallbackTitle: searchTitle,
        fallbackImageUrl: searchImageUrl,
      });
      if (summaryResult?.title || summaryResult?.image) return summaryResult;
    }
    return fallbackSearchResult ? { ...fallbackSearchResult, diagnostics } : { diagnostics };
  } catch {
    return null;
  }
}

async function fetchWikipediaSummaryPage(pageKey, query, expectedSubject, type, headers, diagnostics, fallback = {}) {
  const summaryRes = await fetch(
    `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(pageKey)}`,
    { headers },
  );
  if (!summaryRes.ok) {
    diagnostics.push({
      source: "Wikipedia summary",
      candidateQuery: query,
      selectedPageTitle: fallback.fallbackTitle || pageKey,
      candidateImageUrlPresent: false,
      relevance: "fail",
      failureReason: `http_${summaryRes.status}`,
    });
    return null;
  }
  const summary = await summaryRes.json();
  const summaryRelevant = isRelevantToSubject(expectedSubject, [
    summary.title,
    summary.description,
    summary.extract,
  ].join(" "));
  const imageUrl = normalizeExternalImageUrl(summary.originalimage?.source || summary.thumbnail?.source)
    || fallback.fallbackImageUrl;
  const width = summary.originalimage?.width || summary.thumbnail?.width || null;
  const height = summary.originalimage?.height || summary.thumbnail?.height || null;
  const imageOk = isAcceptableKnowledgeImage(
    imageUrl,
    summary.title || fallback.fallbackTitle || query,
    query,
    expectedSubject,
    width,
    height,
    type,
  );
  diagnostics.push({
    source: "Wikipedia summary",
    candidateQuery: query,
    selectedPageTitle: summary.title || fallback.fallbackTitle || pageKey,
    candidateImageUrlPresent: !!imageUrl,
    relevance: summaryRelevant && imageOk ? "pass" : "fail",
    failureReason: summaryRelevant ? (imageOk ? "" : "bad_summary_image") : "weak_subject_overlap",
  });
  if (!summaryRelevant) return null;
  const sourceUrl = summary.content_urls?.desktop?.page || fallback.fallbackSourceUrl
    || `https://en.wikipedia.org/wiki/${encodeURIComponent(pageKey)}`;
  return {
    title: summary.title || fallback.fallbackTitle || query,
    description: compactText(summary.description || ""),
    extract: compactText(summary.extract || ""),
    sourceUrl,
    image: imageUrl && imageOk
      ? wikipediaImageAsset(imageUrl, sourceUrl, summary.title || fallback.fallbackTitle || query, { width, height })
      : null,
    diagnostics,
  };
}

async function fetchWikimediaCommonsImage(query, expectedSubject = query, type = "concept") {
  try {
    const url = new URL("https://commons.wikimedia.org/w/api.php");
    url.searchParams.set("action", "query");
    url.searchParams.set("generator", "search");
    url.searchParams.set("gsrsearch", query);
    url.searchParams.set("gsrnamespace", "6");
    url.searchParams.set("gsrlimit", "5");
    url.searchParams.set("prop", "imageinfo");
    url.searchParams.set("iiprop", "url|size|extmetadata");
    url.searchParams.set("format", "json");
    url.searchParams.set("origin", "*");
    const res = await fetch(url.toString(), { headers: wikipediaRequestHeaders() });
    if (!res.ok) {
      return {
        diagnostics: [{
          source: "Wikimedia Commons",
          candidateQuery: query,
          candidateImageUrlPresent: false,
          relevance: "fail",
          failureReason: `http_${res.status}`,
        }],
      };
    }
    const data = await res.json();
    const diagnostics = [];
    const pages = Object.values(data?.query?.pages || {}).slice(0, 5);
    for (const page of pages) {
      const imageInfo = page?.imageinfo?.[0];
      const imageUrl = normalizeExternalImageUrl(imageInfo?.url);
      if (!page?.title || !imageUrl) continue;
      const cleanTitle = page.title.replace(/^File:/, "");
      const description = compactText(stripHtml(imageInfo?.extmetadata?.ImageDescription?.value || ""), 300);
      const author = compactText(stripHtml(imageInfo?.extmetadata?.Artist?.value || ""), 120) || "Wikimedia Commons";
      const relevant = isRelevantToSubject(expectedSubject, `${page.title} ${description}`);
      const imageOk = isAcceptableKnowledgeImage(
        imageUrl,
        cleanTitle,
        query,
        expectedSubject,
        imageInfo?.width,
        imageInfo?.height,
        type,
      );
      diagnostics.push({
        source: "Wikimedia Commons",
        candidateQuery: query,
        selectedPageTitle: cleanTitle,
        candidateImageUrlPresent: !!imageUrl,
        relevance: relevant && imageOk ? "pass" : "fail",
        failureReason: relevant ? (imageOk ? "" : "bad_commons_image") : "weak_subject_overlap",
      });
      if (!relevant || !imageOk) continue;
      const sourceUrl = imageInfo?.descriptionurl || `https://commons.wikimedia.org/wiki/${encodeURIComponent(page.title.replace(/^File:/, "File:"))}`;
      return {
        title: cleanTitle,
        description,
        extract: description,
        sourceUrl,
        image: {
          ...wikipediaImageAsset(imageUrl, sourceUrl, cleanTitle || query, query, {
            width: imageInfo?.width,
            height: imageInfo?.height,
          }),
          source: "Wikimedia Commons",
          credit: author,
          attribution: {
            title: cleanTitle || query,
            author,
            pageUrl: sourceUrl,
          },
        },
        diagnostics,
      };
    }
    return { diagnostics };
  } catch {
    return null;
  }
}

function stripHtml(value) {
  return String(value || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function wikipediaRequestHeaders() {
  return {
    "User-Agent": "HomeCenter/1.0 (https://home-center-api.phhowell.workers.dev; family dashboard)",
    "Api-User-Agent": "HomeCenter/1.0 (https://home-center-api.phhowell.workers.dev; family dashboard)",
    "Accept": "application/json",
  };
}

function normalizeExternalImageUrl(url) {
  if (!url) return null;
  const value = String(url);
  if (value.startsWith("//")) return `https:${value}`;
  return value.replace(/^http:/, "https:");
}

function wikipediaImageAsset(imageUrl, sourceUrl, title, query, metadata = {}) {
  return {
    url: imageUrl,
    imageUrl,
    image: imageUrl,
    source: "Wikipedia",
    sourceUrl,
    attribution: {
      title: title || query,
      author: "Wikimedia Commons",
      pageUrl: sourceUrl,
    },
    credit: "Wikimedia Commons",
    alt: title || query,
    mode: "retrieved",
    model: null,
    width: metadata.width || null,
    height: metadata.height || null,
  };
}

function normalizeKnowledgeSubject(query) {
  const compact = compactText(query, 240);
  const override = canonicalKnowledgeSubjectOverride(compact);
  if (override) return override;
  let subject = compact
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\bi[\s-]*b'?s\b/ig, "ibis")
    .replace(/\bib'?s\b/ig, "ibis")
    .replace(/\b(i\s+b\s+i\s+s)\b/ig, "ibis")
    .replace(/^\s*(hey homer|homer)[, ]+/i, "")
    .replace(/^\s*how\s+(?:big|large|small|tall|long|old|far|fast|hot|cold|heavy|deep|wide|many|much)\s+(?:is|are|was|were)\s+/i, "")
    .replace(/^\s*what\s+happened\s+(?:during|at|in|on)\s+/i, "")
    .replace(/^\s*who\s+(?:invented|discovered|created|founded)\s+/i, "")
    .replace(/^\s*(what is|what are|what was|what were|who is|who are|who was|who were|where is|where are|where was|where were|tell me about|give me information about|explain|describe|show me|show us|is that|is this|are those|are these)\s+/i, "")
    .replace(/^\s*(?:the|a|an)\s+/i, "")
    .replace(/[?.!]+$/g, "")
    .trim();
  return subject || compact || String(query || "").trim();
}

function canonicalKnowledgeSubjectOverride(query) {
  const text = String(query || "").toLowerCase();
  if (/\bwhat\s+is\s+the\s+internet\b|\binternet\b/.test(text)) return "The Internet";
  if (/\bwhere\s+is\s+madagascar\b|\bmadagascar\b/.test(text)) return "Madagascar";
  if (/\bada\s+lovelace\b/.test(text)) return "Ada Lovelace";
  if (/\bemperor\s+penguin/.test(text)) return "Emperor Penguin";
  if (/\bcoast\s+redwood/.test(text)) return "Coast Redwood";
  if (/\bapollo\s*11\b|\bapollo\s+eleven\b/.test(text)) return "Apollo 11 Moon Landing";
  if (/\bsmallest\s+country\s+in\s+the\s+world\b/.test(text)) return "Vatican City";
  if (/\bwho\s+invented\s+the\s+world\s+wide\s+web\b|\bworld\s+wide\s+web\s+inventor\b/.test(text)) return "Tim Berners-Lee";
  return "";
}

function knowledgeTokens(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\bi[\s-]*b'?s\b/g, "ibis")
    .replace(/\bib'?s\b/g, "ibis")
    .split(/[^a-z0-9]+/)
    .flatMap((token) => {
      if (token.endsWith("ies") && token.length > 4) return [token, `${token.slice(0, -3)}y`];
      if (token.endsWith("es") && token.length > 4) return [token, token.slice(0, -2)];
      if (token.endsWith("s") && token.length > 3) return [token, token.slice(0, -1)];
      return [token];
    })
    .filter((token) => token.length >= 3 && !KNOWLEDGE_STOP_WORDS.has(token));
}

const KNOWLEDGE_STOP_WORDS = new Set([
  "the", "and", "for", "with", "that", "this", "these", "those", "what", "who",
  "why", "how", "when", "where", "about", "show", "tell", "explain", "describe",
  "homer", "wake", "word", "dashboard", "assistant",
]);

function isRelevantToSubject(subject, candidate) {
  const subjectTokens = knowledgeTokens(subject);
  if (!subjectTokens.length) return true;
  const candidateTokens = new Set(knowledgeTokens(candidate));
  return subjectTokens.some((token) => candidateTokens.has(token));
}

function relevantSearchTerm(subject, value) {
  const term = compactText(value, 120);
  if (!term) return "";
  return isRelevantToSubject(subject, term) ? term : "";
}

function sanitizeKnowledgeClassification(query, subject, raw = {}) {
  const canonicalOverride = canonicalKnowledgeSubjectOverride(query);
  const typeOverride = canonicalOverride === "Vatican City" ? "location"
    : (canonicalOverride === "Tim Berners-Lee" ? "person" : "");
  const type = typeOverride || (["location", "person", "fauna", "flora", "event", "concept"].includes(raw.type)
    ? raw.type
    : "concept");
  const title = canonicalOverride || relevantSearchTerm(subject, raw.title) || subject;
  const entityQuery = relevantSearchTerm(subject, raw.entityQuery) || title || subject;
  const visualSearchQuery = relevantSearchTerm(subject, raw.visualSearchQuery) || entityQuery || subject;
  const visualNeed = canonicalOverride ? "useful" : (["none", "useful", "required"].includes(raw.visualNeed)
    ? raw.visualNeed
    : "useful");
  return {
    type,
    title,
    visualNeed,
    spaceScience: raw.spaceScience === true || isSpaceScienceQuery(subject),
    entityQuery,
    visualSearchQuery,
    original: raw && typeof raw === "object" ? raw : null,
  };
}

function sanitizeKnowledgeAnswer(query, subject, classification, raw = {}, retrieved = {}) {
  const rawSummary = compactText(raw.summary, 1200);
  const relevantSummary = rawSummary && isRelevantToSubject(subject, [
    raw.title,
    rawSummary,
    ...(Array.isArray(raw.sections) ? raw.sections.map((section) => `${section.heading || ""} ${section.content || ""}`) : []),
  ].join(" "));
  const sections = Array.isArray(raw.sections)
    ? raw.sections
        .filter((section) => section && isRelevantToSubject(subject, `${section.heading || ""} ${section.content || ""}`))
        .slice(0, 5)
    : [];
  const forcedImageSourceType = forcedKnowledgeImageSourceType(query, subject, classification);
  const visualNeed = forcedImageSourceType
    ? (forcedImageSourceType === "diagram" ? "required" : "useful")
    : (["none", "useful", "required"].includes(raw.visualNeed)
    ? raw.visualNeed
    : classification.visualNeed);
  const imageFields = sanitizeKnowledgeImageFields(query, subject, classification, raw, visualNeed);
  return {
    type: classification.type || (["location", "person", "fauna", "flora", "event", "concept"].includes(raw.type) ? raw.type : "concept"),
    title: relevantSearchTerm(subject, raw.title) || classification.title || subject,
    summary: relevantSummary ? rawSummary : fallbackKnowledgeSummary(subject, retrieved),
    sections,
    infographic: raw.infographic && typeof raw.infographic === "object" ? raw.infographic : null,
    infographics: sanitizeKnowledgeInfographics(raw.infographics, raw.infographic),
    profile: sanitizeKnowledgeProfile(raw.profile, raw.type || classification.type, subject),
    visualNeed,
    ...imageFields,
  };
}

function sanitizeKnowledgeProfile(rawProfile, type = "concept", subject = "") {
  const profile = rawProfile && typeof rawProfile === "object" ? rawProfile : {};
  const facts = Array.isArray(profile.facts)
    ? profile.facts
        .map((fact) => ({
          label: compactText(fact?.label, 42),
          value: compactText(fact?.value, 80),
          detail: compactText(fact?.detail, 140),
          icon: compactText(fact?.icon, 24),
        }))
        .filter((fact) => fact.label && fact.value)
        .slice(0, 6)
    : [];
  const maps = Array.isArray(profile.maps)
    ? profile.maps
        .map((map) => ({
          scope: ["world", "continent", "country", "city"].includes(map?.scope) ? map.scope : "world",
          label: compactText(map?.label, 48),
          value: compactText(map?.value, 120),
        }))
        .filter((map) => map.label && map.value)
        .slice(0, 3)
    : [];
  const relatedConcepts = Array.isArray(profile.relatedConcepts)
    ? profile.relatedConcepts.map((item) => compactText(item, 48)).filter(Boolean).slice(0, 5)
    : [];
  const fallback = defaultKnowledgeProfile(type, subject);
  return {
    facts: facts.length ? facts : fallback.facts,
    maps: maps.length ? maps : fallback.maps,
    relatedConcepts: relatedConcepts.length ? relatedConcepts : fallback.relatedConcepts,
  };
}

function sanitizeKnowledgeInfographics(rawInfographics, legacyInfographic) {
  const source = Array.isArray(rawInfographics) && rawInfographics.length
    ? rawInfographics
    : (legacyInfographic ? [legacyInfographic] : []);
  return source
    .map((item, index) => ({
      title: compactText(item?.title || (index === 0 ? "Key facts" : `Infographic ${index + 1}`), 64),
      kind: ["metric", "comparison", "timeline", "map", "process", "stats"].includes(item?.kind || item?.type)
        ? (item.kind || item.type)
        : "metric",
      description: compactText(item?.description || "", 220),
      items: Array.isArray(item?.items)
        ? item.items
            .map((entry) => ({
              label: compactText(entry?.label, 44),
              value: compactText(entry?.value, 80),
              detail: compactText(entry?.detail || entry?.sublabel, 80),
              icon: compactText(entry?.icon, 24),
            }))
            .filter((entry) => entry.label && entry.value)
            .slice(0, 6)
        : [],
      visual: item?.visual && typeof item.visual === "object"
        ? {
          url: compactText(item.visual.url, 180),
          alt: compactText(item.visual.alt, 120),
        }
        : null,
    }))
    .filter((item) => item.title || item.items.length)
    .slice(0, 2);
}

function defaultKnowledgeProfile(type = "concept", subject = "") {
  const title = compactText(subject, 80) || "Subject";
  if (type === "location") {
    return {
      facts: [{ label: "Area", value: "Unknown", detail: "Use sourced area size when available." }],
      maps: [
        { scope: "world", label: "World map", value: title },
        { scope: "continent", label: "Continent map", value: title },
      ],
      relatedConcepts: ["geography", "region", "culture"],
    };
  }
  if (type === "person") {
    return {
      facts: [
        { label: "Born", value: "Unknown", detail: "" },
        { label: "Notable for", value: title, detail: "" },
      ],
      maps: [],
      relatedConcepts: ["timeline", "legacy", "field"],
    };
  }
  if (type === "fauna" || type === "flora") {
    return {
      facts: [
        { label: "Species", value: title, detail: "" },
        { label: "Years on Earth", value: "Unknown", detail: "" },
      ],
      maps: [{ scope: "world", label: "World range", value: title }],
      relatedConcepts: type === "fauna"
        ? ["habitat", "adaptations", "conservation"]
        : ["habitat", "growth", "ecosystem"],
    };
  }
  if (type === "event") {
    return {
      facts: [{ label: "Date", value: "Unknown", detail: "" }],
      maps: [
        { scope: "country", label: "Country map", value: title },
        { scope: "city", label: "City map", value: title },
      ],
      relatedConcepts: ["timeline", "causes", "impact"],
    };
  }
  return {
    facts: [{ label: "Date", value: "Not invented", detail: "Use a discovered, invented, or evolved date when relevant." }],
    maps: [],
    relatedConcepts: ["how it works", "examples", "history"],
  };
}

function deterministicKnowledgeAnswer(query, subject, classification = {}) {
  if (/\bemperor\s+penguins?\b/i.test(`${subject} ${query}`)) {
    return {
      type: "fauna",
      title: "Emperor Penguin",
      summary:
        "The emperor penguin is the tallest and heaviest living penguin. Native to Antarctica, it is adapted to extreme cold with dense feathers and a thick layer of fat. It breeds through the year's harshest months.",
      sections: [
        {
          heading: "Adaptation",
          content:
            "Emperor penguins thrive in one of Earth's harshest environments. Dense, waterproof feathers, a thick layer of fat, and huddling behavior help them conserve heat and withstand brutal Antarctic winds and temperatures.",
        },
      ],
      profile: {
        facts: [
          { label: "Species", value: "A. forsteri", icon: "paw" },
          { label: "Range", value: "Antarctica", icon: "globe" },
        ],
        maps: [
          { scope: "world", label: "Antarctica", highlight: "Antarctica", lat: -82, lon: 0 },
        ],
        relatedConcepts: ["Antarctica", "Birds", "Cold adaptation"],
      },
      infographics: [
        {
          title: "At a Glance",
          kind: "metrics",
          items: [
            { label: "Height", value: "100-130 cm", sublabel: "39-51 in", icon: "ruler" },
            { label: "Weight", value: "22-45 kg", sublabel: "49-99 lb", icon: "weight" },
            { label: "Penguin lineage", value: "60M+", sublabel: "years", icon: "dna" },
          ],
        },
      ],
      visualNeed: classification.visualNeed === "none" ? "useful" : (classification.visualNeed || "useful"),
      imageSourceType: "known",
      imageQuery: "emperor penguins Antarctica adult chick",
    };
  }

  if (/\binternet\b/i.test(`${subject} ${query}`)) {
    return {
      type: "concept",
      title: "The Internet",
      summary:
        "The Internet is a global network that lets connected devices exchange data using shared protocols.",
      sections: [
        {
          heading: "Key Idea",
          content:
            "No single machine is the Internet. It works because many independent networks agree on shared protocols for addressing, routing, and delivering data.",
        },
      ],
      profile: {
        facts: [
          { label: "Started", value: "1960s-1980s", icon: "calendar" },
          { label: "Core method", value: "Packet switching", icon: "network" },
          { label: "Scale", value: "Global network", icon: "globe" },
        ],
        maps: [],
        relatedConcepts: ["packet switching", "TCP/IP", "World Wide Web"],
      },
      infographics: [
        {
          title: "How It Works",
          kind: "process",
          description: "Data moves through routers as small packets, then servers respond.",
          items: [
            { label: "Devices", value: "Send data", icon: "devices" },
            { label: "Routers", value: "Find path", icon: "router" },
            { label: "Packets", value: "Small pieces", icon: "packets" },
            { label: "Servers", value: "Respond", icon: "servers" },
          ],
        },
        {
          title: "At A Glance",
          kind: "metrics",
          description: "The Internet is bigger than the web.",
          items: [
            { label: "Global network", value: "Billions connected", icon: "globe" },
            { label: "Shared protocols", value: "TCP/IP rules", icon: "shield" },
            { label: "Many services", value: "Web, email, apps", icon: "services" },
          ],
        },
      ],
      visualNeed: "useful",
      imageSourceType: "known",
      imageQuery: "The Internet layered global network hero visual",
    };
  }

  if (/\bmadagascar\b/i.test(`${subject} ${query}`)) {
    return {
      type: "location",
      title: "Madagascar",
      summary:
        "Madagascar is a large island country in the Indian Ocean off the southeastern coast of Africa.",
      sections: [
        {
          heading: "Key Idea",
          content:
            "It sits east of Mozambique across the Mozambique Channel. Its long isolation helped create distinctive landscapes and species found nowhere else.",
        },
      ],
      profile: {
        facts: [
          { label: "Area", value: "587,041 sq km", icon: "map" },
          { label: "Capital", value: "Antananarivo", icon: "city" },
          { label: "Region", value: "Indian Ocean", icon: "globe" },
        ],
        maps: [
          { scope: "world", label: "Madagascar", value: "East of Mozambique" },
        ],
        relatedConcepts: ["Indian Ocean", "Mozambique Channel", "biodiversity"],
      },
      infographics: [
        {
          title: "At A Glance",
          kind: "metrics",
          description: "A world of its own: most wildlife here is found nowhere else on Earth.",
          visual: {
            url: "/home-center/knowledge-assets/madagascar-island-relief.svg",
            alt: "Teal relief map of Madagascar",
          },
          items: [
            { label: "Species", value: "200,000+", icon: "paw" },
            { label: "Endemic", value: "90%+", icon: "flora" },
            { label: "Unique biomes", value: "5", icon: "globe" },
          ],
        },
      ],
      visualNeed: "useful",
      imageSourceType: "known",
      imageQuery: "Madagascar map Indian Ocean off southeastern coast of Africa",
    };
  }

  if (/\bsun\b/i.test(subject) && /\bhow\s+(?:big|large|wide)\b/i.test(query)) {
    return {
      type: "concept",
      title: "The Sun's Size",
      summary:
        "The Sun is about 1.39 million kilometers, or 864,000 miles, across. About 109 Earths could fit side by side across its diameter, and roughly 1.3 million Earths could fit inside its volume.",
      sections: [
        {
          heading: "Diameter",
          content:
            "The Sun's diameter is about 1.39 million kilometers, or about 864,000 miles. That is the distance across the Sun through its center.",
        },
        {
          heading: "Compared with Earth",
          content:
            "Earth is about 12,742 kilometers across, so the Sun is about 109 times wider than Earth. By volume, it could hold about 1.3 million Earths.",
        },
        {
          heading: "Why It Looks Small",
          content:
            "The Sun looks small in the sky because it is about 150 million kilometers, or 93 million miles, away from Earth.",
        },
      ],
      infographic: {
        type: "stats",
        items: [
          { label: "Diameter", value: "1.39 million km" },
          { label: "Across", value: "109 Earths" },
          { label: "Volume", value: "1.3M Earths" },
          { label: "Distance", value: "150M km away" },
        ],
      },
      infographics: [
        {
          title: "Sun scale comparison",
          kind: "comparison",
          description: "Show the Sun beside Earth with diameter and volume comparisons.",
          items: [
            { label: "Diameter", value: "1.39 million km" },
            { label: "Across", value: "109 Earths" },
            { label: "Volume", value: "1.3M Earths" },
          ],
        },
      ],
      profile: {
        facts: [
          { label: "Diameter", value: "1.39 million km", detail: "About 864,000 miles across." },
          { label: "Compared with Earth", value: "109x wider", detail: "Roughly 1.3 million Earths by volume." },
        ],
        maps: [],
        relatedConcepts: ["star", "solar system", "nuclear fusion"],
      },
      visualNeed: classification.visualNeed === "none" ? "useful" : (classification.visualNeed || "useful"),
      imageSourceType: "known",
      imageQuery: "NASA Sun image solar disk Earth size comparison",
    };
  }

  if (/\bmoon\b/i.test(subject) && /\bhow\s+far\b/i.test(query)) {
    return {
      type: "concept",
      title: "Moon Distance",
      summary:
        "The Moon is about 384,400 kilometers, or 238,855 miles, from Earth on average. Its orbit is oval, so the distance changes from about 363,300 km at closest approach to about 405,500 km at farthest.",
      sections: [
        {
          heading: "Average Distance",
          content:
            "The usual number to remember is 384,400 kilometers, or 238,855 miles. That is about 30 Earth diameters away.",
        },
        {
          heading: "It Changes",
          content:
            "The Moon does not orbit in a perfect circle. It is about 363,300 kilometers away at perigee, the closest point, and about 405,500 kilometers away at apogee, the farthest point.",
        },
        {
          heading: "Travel Time",
          content:
            "Apollo astronauts took about three days to reach the Moon. Light from the Moon reaches Earth in about 1.3 seconds.",
        },
      ],
      infographic: {
        type: "stats",
        items: [
          { label: "Average", value: "384,400 km" },
          { label: "Average", value: "238,855 mi" },
          { label: "Closest", value: "363,300 km" },
          { label: "Farthest", value: "405,500 km" },
          { label: "Scale", value: "30 Earths" },
        ],
      },
      infographics: [
        {
          title: "Earth to Moon distance",
          kind: "comparison",
          description: "Show Earth and Moon with a large labeled distance arrow and a 30-Earth scale marker.",
          items: [
            { label: "Average", value: "384,400 km" },
            { label: "Closest", value: "363,300 km" },
            { label: "Farthest", value: "405,500 km" },
          ],
        },
      ],
      profile: {
        facts: [
          { label: "Average distance", value: "384,400 km", detail: "About 238,855 miles." },
          { label: "Scale", value: "30 Earths", detail: "About 30 Earth diameters fit between Earth and Moon." },
        ],
        maps: [],
        relatedConcepts: ["orbit", "perigee", "apogee"],
      },
      visualNeed: "required",
      imageSourceType: "diagram",
      imageQuery:
        "Simple labeled scale diagram: Earth on the left, Moon on the right, arrow between them labeled average distance 384,400 km / 238,855 miles, small note 30 Earth diameters, dark space background, large readable labels",
      forceGeneratedVisual: true,
    };
  }

  return null;
}

const KNOWLEDGE_IMAGE_SOURCE_TYPES = new Set(["known", "generated", "diagram", "none"]);

function sanitizeKnowledgeImageFields(query, subject, classification, raw = {}, visualNeed = "useful") {
  const rawSourceType = typeof raw.imageSourceType === "string" ? raw.imageSourceType : "";
  const forcedSourceType = forcedKnowledgeImageSourceType(query, subject, classification);
  let imageSourceType = KNOWLEDGE_IMAGE_SOURCE_TYPES.has(rawSourceType)
    ? rawSourceType
    : inferKnowledgeImageSourceType(classification, raw, visualNeed);
  if (forcedSourceType) imageSourceType = forcedSourceType;
  if (visualNeed === "none") imageSourceType = "none";

  const rawImageQuery = compactText(raw.imageQuery, 160);
  const rawImagePrompt = compactText(raw.imagePrompt, 500);
  const fallbackQuery = relevantSearchTerm(subject, classification.visualSearchQuery)
    || relevantSearchTerm(subject, classification.entityQuery)
    || relevantSearchTerm(subject, classification.title)
    || subject;
  const relevantImageQuery = relevantSearchTerm(subject, rawImageQuery) || fallbackQuery;

  if (imageSourceType === "known" || imageSourceType === "diagram") {
    return {
      imageSourceType,
      imageQuery: relevantImageQuery,
      imagePrompt: "",
    };
  }

  if (imageSourceType === "generated") {
    const imagePrompt = rawImagePrompt || enrichKnowledgeImagePrompt(query, {
      imagePrompt: relevantImageQuery,
      visualSearchQuery: classification.visualSearchQuery,
      entityQuery: classification.entityQuery,
    });
    return {
      imageSourceType,
      imageQuery: "",
      imagePrompt: rawVisualAssetPrompt(imagePrompt),
    };
  }

  return {
    imageSourceType: "none",
    imageQuery: "",
    imagePrompt: "",
  };
}

function forcedKnowledgeImageSourceType(query, subject, classification = {}) {
  const text = `${query} ${subject} ${classification.title || ""}`.toLowerCase();
  if (/\bphotosynthesis\b/.test(text)) return "diagram";
  if (canonicalKnowledgeSubjectOverride(query)) return "known";
  return "";
}

function inferKnowledgeImageSourceType(classification = {}, raw = {}, visualNeed = "useful") {
  if (visualNeed === "none") return "none";
  if (raw.imageQuery && !raw.imagePrompt) return "known";
  if (raw.imagePrompt && !raw.imageQuery) {
    return ["location", "person", "fauna", "flora", "event"].includes(classification.type)
      ? "known"
      : "generated";
  }
  if (classification.visualNeed === "none") return "none";
  if (classification.spaceScience || ["location", "person", "fauna", "flora", "event"].includes(classification.type)) {
    return "known";
  }
  return "generated";
}

function fallbackKnowledgeSummary(subject, retrieved = {}) {
  const retrievedSummary = compactText(retrieved.wikipedia?.extract || retrieved.nasa?.description || "", 900);
  if (retrievedSummary && isRelevantToSubject(subject, retrievedSummary)) {
    return retrievedSummary;
  }
  return `I could not verify a solid source match for ${subject}, so I am keeping this answer conservative. Try asking with a little more detail if you want a more specific explanation.`;
}

function knowledgeImageCacheCandidates(query, subject, classification = {}) {
  return [
    { kind: "query", value: query },
    { kind: "subject", value: subject },
    { kind: "entity", value: classification.entityQuery || classification.title },
    { kind: "visual", value: classification.visualSearchQuery },
    { kind: "classification", value: knowledgeClassificationHash(classification) },
  ];
}

function knowledgeClassificationHash(classification = {}) {
  const raw = JSON.stringify({
    type: classification.type || "",
    title: classification.title || "",
    visualNeed: classification.visualNeed || "",
    spaceScience: classification.spaceScience === true,
    entityQuery: classification.entityQuery || "",
    visualSearchQuery: classification.visualSearchQuery || "",
  });
  let hash = 0;
  for (let i = 0; i < raw.length; i += 1) {
    hash = ((hash << 5) - hash + raw.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(36);
}

function knowledgeImageCacheKey(kindOrValue, maybeValue) {
  const kind = maybeValue === undefined ? "query" : String(kindOrValue || "query");
  const value = maybeValue === undefined ? kindOrValue : maybeValue;
  const normalized = String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
  return normalized ? `knowledge:image:v2:${kind}:${normalized}` : "";
}

async function getCachedKnowledgeImage(env, values) {
  if (!env.NOTIFICATIONS) return null;
  for (const candidate of values) {
    const key = typeof candidate === "object"
      ? knowledgeImageCacheKey(candidate.kind, candidate.value)
      : knowledgeImageCacheKey(candidate);
    if (!key) continue;
    const cached = await env.NOTIFICATIONS.get(key, { type: "json" }).catch(() => null);
    const cachedUrl = cached?.url || cached?.imageUrl;
    if (cached?.expiresAt && Date.parse(cached.expiresAt) <= Date.now()) {
      continue;
    }
    if (cachedUrl) {
      return {
        ...cached,
        url: cachedUrl,
        imageUrl: cachedUrl,
        image: cached.image || cachedUrl,
        source: "cache",
        originalSource: cached.originalSource || cached.source || "unknown",
        mode: ["generated", "pinned"].includes(cached.mode) ? cached.mode : "retrieved",
        assetMode: ["generated", "pinned"].includes(cached.assetMode || cached.mode)
          ? (cached.assetMode || cached.mode)
          : "retrieved",
      };
    }
  }
  return null;
}

async function cacheKnowledgeImage(env, query, subject, classification, image) {
  if (!env.NOTIFICATIONS || !image?.url || String(image.url).length > 250000) return;
  const createdAt = new Date().toISOString();
  const payload = JSON.stringify({
    ...image,
    imageUrl: image.url,
    image: image.url,
    originalSource: image.originalSource || image.source,
    queryKey: knowledgeImageCacheKey("query", query),
    createdAt,
    cachedAt: Date.now(),
  });
  const values = knowledgeImageCacheCandidates(query, subject, classification);
  await Promise.all(values.map((candidate) => {
    const key = knowledgeImageCacheKey(candidate.kind, candidate.value);
    return key ? env.NOTIFICATIONS.put(key, payload).catch(() => null) : Promise.resolve(null);
  }));
}

async function generateKnowledgeImage(imagePrompt, query, env, knowledgeData = {}) {
  if (!imageGenerationEnabled(env) || !env.OPENAI_API_KEY) {
    return null;
  }
  const prompt = enrichKnowledgeImagePrompt(query, { ...knowledgeData, imagePrompt });
  try {
    const startedAt = Date.now();
    const imageModel = openaiImageModel(env);
    const quality = imageGenerationQuality(env);
    const size = imageGenerationSize(env);
    const outputFormat = imageGenerationOutputFormat(env);
    const timeoutMs = imageGenerationTimeoutMs(env);
    const signal = typeof AbortSignal !== "undefined" && AbortSignal.timeout
      ? AbortSignal.timeout(timeoutMs)
      : undefined;
    const imgRes = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify(imageGenerationBody(imageModel, prompt, { size, quality, outputFormat })),
      signal,
    });
    if (imgRes.ok) {
      const imgData = await imgRes.json();
      const url = imageResultUrl(imgData, outputFormat);
      if (url) {
        return {
          url,
          imageUrl: url,
          image: url,
          source: "GPT Image 2",
          sourceUrl: null,
          credit: "Generated with GPT Image 2",
          alt: query,
          mode: "generated",
          model: imageModel,
          provider: "openai",
          quality,
          size,
          outputFormat,
          generation: {
            prompt,
            quality,
            size,
            latencyMs: Date.now() - startedAt,
            estimatedCostUsd: estimateGptImageCostUsd(size, quality),
          },
          metadata: {
            quality,
            size,
            outputFormat,
            promptSource: "worker-enriched",
            generator: "openai",
            estimatedCostUsd: estimateGptImageCostUsd(size, quality),
            latencyMs: Date.now() - startedAt,
          },
        };
      }
    }
  } catch (err) {
    console.warn(`Knowledge image generation failed: ${err.message}`);
    return null;
  }
  return null;
}

function normalizeKnowledgeAsset(image, assetRole = "hero") {
  if (!image?.url) return null;
  const createdAt = image.createdAt || new Date().toISOString();
  const mode = ["generated", "rendered", "pinned", "fallback"].includes(image.mode)
    ? image.mode
    : "retrieved";
  return {
    ...image,
    url: image.url,
    imageUrl: image.imageUrl || image.url,
    image: image.image || image.url,
    source: image.source || (image.mode === "generated" ? "GPT Image 2" : "unknown"),
    sourceUrl: image.sourceUrl || null,
    mode,
    assetMode: image.assetMode || mode,
    assetRole: image.assetRole || assetRole,
    width: image.width || null,
    height: image.height || null,
    focalPoint: normalizeFocalPoint(image.focalPoint),
    cropHint: image.cropHint || null,
    tone: image.tone || null,
    score: image.score ?? null,
    reasons: Array.isArray(image.reasons) ? image.reasons : [],
    originalUrl: image.originalUrl || image.url,
    createdAt,
    expiresAt: image.expiresAt || null,
  };
}

function estimateGptImageCostUsd(size, quality) {
  const costs = {
    "1024x1024": { low: 0.006, medium: 0.053, high: 0.211 },
    "1024x1536": { low: 0.005, medium: 0.041, high: 0.165 },
    "1536x1024": { low: 0.005, medium: 0.041, high: 0.165 },
  };
  return costs[size]?.[quality] || null;
}

function buildKnowledgeVisual(image, options = {}) {
  if (image?.url) {
    const asset = normalizeKnowledgeAsset(image, image.assetRole || "hero");
    const metadata = {
      title: asset.attribution?.title || asset.alt || null,
      pageUrl: asset.attribution?.pageUrl || asset.sourceUrl || null,
      attribution: asset.attribution || null,
      retrievalSource: ["retrieved", "pinned"].includes(asset.mode) ? (asset.originalSource || asset.source || null) : null,
      assetRole: asset.assetRole,
      width: asset.width,
      height: asset.height,
      focalPoint: asset.focalPoint || null,
      cropHint: asset.cropHint || null,
      tone: asset.tone || null,
      score: asset.score ?? null,
      reasons: asset.reasons || [],
      createdAt: asset.createdAt,
      expiresAt: asset.expiresAt,
      ...(asset.metadata || {}),
    };
    return {
      imageUrl: asset.url,
      image: asset.url,
      source: asset.source || "cache",
      sourceUrl: asset.sourceUrl || null,
      mode: asset.mode || "retrieved",
      assetMode: asset.assetMode || asset.mode || "retrieved",
      assetRole: asset.assetRole,
      model: asset.model || null,
      metadata,
      need: options.need || "useful",
      strategy: options.strategy || asset.mode || "retrieved",
      generated: asset.mode === "generated",
      plan: options.visualPlan || null,
      heroComposition: options.heroComposition || null,
    };
  }

  return {
    imageUrl: null,
    image: null,
    source: "none",
    mode: "none",
    model: null,
    metadata: {
      reason: options.fallbackReason || "retrieval_failed",
      ...(options.attemptedModel ? { attemptedModel: options.attemptedModel } : {}),
    },
    need: options.need || "none",
    strategy: options.strategy || "none",
    generated: false,
    plan: options.visualPlan || null,
    heroComposition: options.heroComposition || null,
  };
}

function enrichKnowledgeImagePrompt(query, data = {}) {
  const seed = rawVisualAssetPrompt(data.imagePrompt || data.visualSearchQuery || data.entityQuery || query);
  return [
    "Create one raw visual asset for the Home Center family TV dashboard.",
    `Topic: ${query}.`,
    seed,
    "No text. No labels. No UI. No poster. No infographic panels. No logos.",
    "Leave negative space for Home Center UI text.",
    "Use dark navy cinematic lighting.",
    "Use calm premium editorial composition.",
    "Use a wide crop suitable for placement inside a glass card.",
  ].filter(Boolean).join("\n\n");
}

function rawVisualAssetPrompt(prompt) {
  const seed = compactText(prompt, 500);
  const policy = "No text. No labels. No UI. No poster. No infographic panels. No logos. Leave negative space for Home Center UI text. Use dark navy cinematic lighting. Use calm premium editorial composition. Use a wide crop suitable for placement inside a glass card.";
  return seed && seed.toLowerCase().includes("no text") ? seed : [seed, policy].filter(Boolean).join(" ");
}

function compactText(value, maxLength = 1200) {
  return String(value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

async function handleLLMRecord(request, env) {
  const body = await request.json();
  const response = body?.response;
  if (!response || typeof response !== "object") {
    return json({ error: "Missing response object" }, 400);
  }
  if (!response.id || !response.query) {
    return json({ error: "Response requires id and query" }, 400);
  }
  return storeLLMResponse({
    type: "concept",
    summary: "",
    sections: [],
    infographic: null,
    imageUrl: null,
    timestamp: Date.now(),
    ...response,
  }, env);
}

async function handleLLMLatest(env) {
  if (!env.NOTIFICATIONS) return json({ response: null });
  const raw = await env.NOTIFICATIONS.get(LLM_LATEST_KEY);
  if (!raw) return json({ response: null });
  return json({ response: JSON.parse(raw) });
}

async function handleLLMHistory(env) {
  if (!env.NOTIFICATIONS) return json({ history: [] });
  const history = await env.NOTIFICATIONS.get(LLM_HISTORY_KEY, { type: "json" }) || [];
  return json({ history });
}

async function handleLLMDismiss(request, env) {
  if (!env.NOTIFICATIONS) return json({ ok: false });
  await env.NOTIFICATIONS.delete(LLM_LATEST_KEY);
  return json({ ok: true });
}

async function handleKnowledgeFeedback(request, env) {
  const body = await request.json().catch(() => ({}));
  const now = Date.now();
  const latest = body?.target_log_row_id ? null : await latestKnowledgeResponse(env);
  const feedbackType = body?.feedback_type === "image" || body?.flag_type === "user_negative_image"
    ? "image"
    : "knowledge";
  const target = body?.target_log_row_id
    ? body
    : (feedbackType === "image" ? imageTargetFromKnowledgeResponse(latest) : latest);
  const targetLogRowId = body?.target_log_row_id || target?.log_row_id;

  if (!targetLogRowId) {
    if (feedbackType === "image" && target?.image_ref) {
      await purgeKnowledgeImageCacheForResponse(env, latest);
      return json({
        ok: true,
        flagged: true,
        reason: "local_image_feedback_recorded",
      });
    }
    return json({
      ok: true,
      flagged: false,
      reason: feedbackType === "image" ? "no_recent_knowledge_image" : "no_recent_knowledge_response",
    });
  }

  const timestamp = Number(target.timestamp || now);
  if (!Number.isFinite(timestamp) || now - timestamp > 10 * 60 * 1000) {
    return json({ ok: true, flagged: false, reason: "stale_knowledge_response" });
  }

  const bridgeUrl = knowledgeBridgeFeedbackUrl(env);
  if (!bridgeUrl) {
    return json({ ok: false, flagged: false, reason: "knowledge_bridge_unavailable" }, 503);
  }

  const flaggedAt = new Date(now).toISOString();
  const payload = {
    flag_type: feedbackType === "image" ? "user_negative_image" : "user_negative",
    target_log_row_id: targetLogRowId,
    flagged_at: flaggedAt,
    query_text: String(target.query || body?.query_text || ""),
  };
  if (feedbackType === "image") {
    const imageSourceType = body?.image_source_type || target?.image_source_type;
    const imageRef = body?.image_ref || target?.image_ref;
    if (!imageSourceType || !imageRef) {
      return json({ ok: true, flagged: false, reason: "no_recent_knowledge_image" });
    }
    payload.image_source_type = imageSourceType;
    payload.image_ref = imageRef;
  }
  const bridgeRes = await fetch(bridgeUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(env.OPENCLAW_BRIDGE_TOKEN ? { "X-OpenClaw-Bridge-Token": env.OPENCLAW_BRIDGE_TOKEN } : {}),
    },
    body: JSON.stringify(payload),
  });
  if (!bridgeRes.ok) {
    const text = await bridgeRes.text().catch(() => "");
    return json({ ok: false, flagged: false, reason: "knowledge_bridge_rejected", detail: text.slice(0, 200) }, 502);
  }

  return json({ ok: true, flagged: true, record: payload });
}

async function latestKnowledgeResponse(env) {
  if (!env.NOTIFICATIONS) return null;
  const raw = await env.NOTIFICATIONS.get(LLM_LATEST_KEY);
  if (!raw) return null;
  const response = JSON.parse(raw);
  return response?.kind === "knowledge" ? response : null;
}

function imageTargetFromKnowledgeResponse(response) {
  if (!response || response.imageSourceType === "none") return null;
  const imageRef =
    response.imageUrl ||
    response.image?.url ||
    response.visual?.imageUrl ||
    response.visual?.image ||
    response.image?.sourceUrl ||
    "";
  if (!imageRef) return null;
  return {
    query: response.query || "",
    log_row_id: response.log_row_id || null,
    timestamp: response.timestamp,
    image_source_type: response.imageSourceType || "unknown",
    image_ref: imageRef,
  };
}

async function purgeKnowledgeImageCacheForResponse(env, response) {
  if (!env.NOTIFICATIONS || !response) return;
  const classification = response.retrieval?.classification || {};
  const subject = response.retrieval?.subject || response.query || "";
  const candidates = knowledgeImageCacheCandidates(response.query || "", subject, classification);
  await Promise.all(candidates.map((candidate) => {
    const key = knowledgeImageCacheKey(candidate.kind, candidate.value);
    return key ? env.NOTIFICATIONS.delete(key).catch(() => null) : Promise.resolve(null);
  }));
}

// ── Calendar ────────────────────────────────────────────────────────

async function handleCalendar(env, url) {
  const debug = url?.searchParams?.get("debug") === "true";
  const hasCalDAV = !!(env.ICLOUD_APPLE_ID && env.ICLOUD_APP_PASSWORD);
  const hasUrls = !!(env.CALENDAR_URLS);
  if (!hasCalDAV && !hasUrls) {
    return json({
      error: "No calendar sources configured. Set ICLOUD_APPLE_ID + ICLOUD_APP_PASSWORD for CalDAV, or CALENDAR_URLS for iCal feeds (wrangler secret put).",
    }, 500);
  }

  const events = [];
  const errors = [];
  let debugInfo = null;
  const calendarTimeZone = env.CALENDAR_TIME_ZONE || env.TZ || "America/Los_Angeles";

  // Try CalDAV (private iCloud calendars) first
  if (env.ICLOUD_APPLE_ID && env.ICLOUD_APP_PASSWORD) {
    try {
      const result = await fetchCalDAV(env.ICLOUD_APPLE_ID, env.ICLOUD_APP_PASSWORD, debug, {
        calendarNames: env.CALENDAR_NAMES || env.CALDAV_CALENDAR_NAMES || "Howell Family",
        timeZone: calendarTimeZone,
      });
      events.push(...result.events);
      if (debug) debugInfo = result.diag;
    } catch (e) {
      console.error("CalDAV error:", e);
      errors.push(`CalDAV: ${e.message}`);
    }
  }

  // Also fetch any configured iCal URLs
  const icalNow = new Date();
  const icalStart = new Date(icalNow.getFullYear(), icalNow.getMonth(), icalNow.getDate());
  const icalEnd = new Date(icalStart.getTime() + 14 * 86400000);
  if (env.CALENDAR_URLS) {
    const urls = env.CALENDAR_URLS.split(",").map((u) => u.trim()).filter(Boolean);
    for (const url of urls) {
      try {
        const icsUrl = url.replace("webcal://", "https://");
        const res = await fetch(icsUrl);
        if (res.ok) {
          const text = await res.text();
          events.push(...parseIcalEvents(text, icalStart, icalEnd, { timeZone: calendarTimeZone }));
        }
      } catch (e) {
        console.error("iCal fetch error:", url, e);
      }
    }
  }

  // Sort by start time
  events.sort((a, b) => (a.startDate || 0) - (b.startDate || 0));

  return json({
    events: events.map(({ startDate, ...rest }) => ({ ...rest, start: startDate })),
    ...(errors.length > 0 && { errors }),
    ...(debug && debugInfo && { debug: debugInfo }),
  });
}

async function fetchCalDAV(appleId, appPassword, debug = false, options = {}) {
  const auth = btoa(`${appleId}:${appPassword}`);
  const headers = {
    Authorization: `Basic ${auth}`,
    "Content-Type": "application/xml; charset=utf-8",
    Depth: "0",
  };
  const diag = {};

  // Step 1: Find principal URL
  const principalRes = await fetch("https://caldav.icloud.com/", {
    method: "PROPFIND",
    headers,
    body: `<?xml version="1.0" encoding="utf-8"?>
<d:propfind xmlns:d="DAV:">
  <d:prop><d:current-user-principal/></d:prop>
</d:propfind>`,
  });

  if (!principalRes.ok) {
    throw new Error(`CalDAV auth failed: ${principalRes.status}`);
  }

  const principalXml = await principalRes.text();
  const principalHref = extractHref(principalXml, "current-user-principal");
  if (!principalHref) throw new Error("Could not find principal URL");
  if (debug) diag.principalHref = principalHref;

  // Step 2: Find calendar home set
  // iCloud may redirect to a partition-specific host
  const homeUrl = principalHref.startsWith("http")
    ? principalHref
    : `https://caldav.icloud.com${principalHref}`;
  const homeRes = await fetch(homeUrl, {
    method: "PROPFIND",
    headers,
    body: `<?xml version="1.0" encoding="utf-8"?>
<d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
  <d:prop><c:calendar-home-set/></d:prop>
</d:propfind>`,
  });

  const homeXml = await homeRes.text();
  const homeHref = extractHref(homeXml, "calendar-home-set");
  if (!homeHref) throw new Error("Could not find calendar home");
  if (debug) diag.homeHref = homeHref;

  // Step 3: List calendars
  // The home-set URL from iCloud is usually a full URL with the correct host
  const listUrl = homeHref.startsWith("http")
    ? homeHref
    : `https://caldav.icloud.com${homeHref}`;
  const listRes = await fetch(listUrl, {
    method: "PROPFIND",
    headers: { ...headers, Depth: "1" },
    body: `<?xml version="1.0" encoding="utf-8"?>
<d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav" xmlns:cs="http://calendarserver.org/ns/">
  <d:prop>
    <d:displayname/>
    <d:resourcetype/>
    <cs:getctag/>
  </d:prop>
</d:propfind>`,
  });

  const listXml = await listRes.text();
  if (debug) diag.listStatus = listRes.status;
  const allCalendars = extractCalendarHrefs(listXml, homeHref);
  if (debug) diag.allCalendars = allCalendars;

  const requestedNames = String(options.calendarNames || "")
    .split(",")
    .map((name) => name.trim().toLowerCase())
    .filter(Boolean);
  const realCalendars = allCalendars.filter((c) => !/(inbox|outbox|notification)/i.test(c.href));
  const matchingCalendars = requestedNames.length
    ? realCalendars.filter((c) => calendarNameMatches(c.name, requestedNames))
    : realCalendars;
  const activeCals = requestedNames.length ? matchingCalendars : realCalendars;
  if (debug) {
    diag.requestedCalendarNames = requestedNames;
    diag.activeCalendars = activeCals;
    if (requestedNames.length && !activeCals.length) {
      diag.calendarNameMatchError = "No calendars matched the requested calendar names.";
    }
    diag.timeZone = options.timeZone || "America/Los_Angeles";
  }

  // Step 4: Fetch events for the next 14 days from each calendar
  const today = new Date();
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const endOfWeek = new Date(startOfDay.getTime() + 14 * 86400000);
  const dtStart = toIcalDate(startOfDay);
  const dtEnd = toIcalDate(endOfWeek);
  if (debug) diag.dateRange = { dtStart, dtEnd, todayISO: today.toISOString() };

  const allEvents = [];

  for (const cal of activeCals) {
    try {
      const reportUrl = cal.href.startsWith("http")
        ? cal.href
        : `https://caldav.icloud.com${cal.href}`;
      const reportRes = await fetch(reportUrl, {
        method: "REPORT",
        headers: {
          ...headers,
          Depth: "1",
        },
        body: `<?xml version="1.0" encoding="utf-8"?>
<c:calendar-query xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
  <d:prop>
    <d:getetag/>
    <c:calendar-data/>
  </d:prop>
  <c:filter>
    <c:comp-filter name="VCALENDAR">
      <c:comp-filter name="VEVENT">
        <c:time-range start="${dtStart}" end="${dtEnd}"/>
      </c:comp-filter>
    </c:comp-filter>
  </c:filter>
</c:calendar-query>`,
      });

      if (debug) {
        diag[`report_${cal.name || cal.href.split("/").pop()}`] = {
          status: reportRes.status,
        };
      }

      if (reportRes.ok) {
        const reportXml = await reportRes.text();
        const icsBlocks = extractCalendarData(reportXml);
        if (debug) {
          diag[`report_${cal.name || cal.href.split("/").pop()}`].icsBlockCount = icsBlocks.length;
        }
        for (const ics of icsBlocks) {
          allEvents.push(...parseIcalEvents(ics, startOfDay, endOfWeek, {
            calendar: calendarOwnerFromName(cal.name),
            calendarName: cal.name,
            timeZone: options.timeZone || "America/Los_Angeles",
          }));
        }
      }
    } catch (e) {
      if (debug) diag[`error_${cal.href}`] = e.message;
    }
  }

  if (debug) diag.totalEvents = allEvents.length;
  return { events: allEvents, diag };
}

// ── Birthdays ────────────────────────────────────────────────────────

const BIRTHDAY_GIFTS_KEY = "hc:birthday:gifts";
const VALID_GIFT_STATUS = new Set(["ready", "ordered", "needed", "unknown"]);

async function handleBirthdays(env) {
  if (!env.ICLOUD_APPLE_ID || !env.ICLOUD_APP_PASSWORD) {
    return json({ error: "CalDAV not configured. Set ICLOUD_APPLE_ID + ICLOUD_APP_PASSWORD." }, 500);
  }

  try {
    const birthdays = await fetchBirthdays(env.ICLOUD_APPLE_ID, env.ICLOUD_APP_PASSWORD);
    const overrides = env.NOTIFICATIONS
      ? (await env.NOTIFICATIONS.get(BIRTHDAY_GIFTS_KEY, { type: "json" })) ?? {}
      : {};
    const merged = birthdays.map((b) => {
      const o = overrides[b.id ?? b.uid ?? b.name];
      if (!o) return b;
      return { ...b, giftStatus: o.giftStatus, giftNotes: o.giftNotes };
    });
    return json({ birthdays: merged });
  } catch (e) {
    return json({ error: `Birthdays: ${e.message}`, birthdays: [] }, 500);
  }
}

async function handleBirthdayPatch(id, request, env) {
  if (!env.NOTIFICATIONS) return json({ error: "KV not configured" }, 500);
  if (!id) return json({ error: "id required" }, 400);
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }
  const { giftStatus, giftNotes } = body ?? {};
  if (!VALID_GIFT_STATUS.has(giftStatus)) {
    return json({ error: `giftStatus must be one of ${[...VALID_GIFT_STATUS].join(", ")}` }, 400);
  }
  if (giftNotes != null && typeof giftNotes !== "string") {
    return json({ error: "giftNotes must be a string" }, 400);
  }
  const overrides =
    (await env.NOTIFICATIONS.get(BIRTHDAY_GIFTS_KEY, { type: "json" })) ?? {};
  overrides[id] = {
    giftStatus,
    giftNotes: giftNotes ?? overrides[id]?.giftNotes ?? null,
    updatedAt: new Date().toISOString(),
  };
  await env.NOTIFICATIONS.put(BIRTHDAY_GIFTS_KEY, JSON.stringify(overrides));
  return json({ ok: true, id, override: overrides[id] });
}

// ── OpenClaw enhancement (copy, summaries, suggestions) ────────────
//
// Contract (see docs/home_center_decisions_log.md):
//   - OpenClaw enhances, it does not decide. The client must render
//     correctly with fields === {}.
//   - Every call is cached per (feature, stateHash) for 1 h to bound cost.
//   - Model ID is read from env.OPENAI_ENHANCE_MODEL with the safe default
//     below — never inlined elsewhere (see "model IDs never hardcoded"
//     decision, 2026-04-19).
//   - Failure modes (no OpenAI key, non-2xx, malformed JSON, unknown
//     feature) all return {fields: {}, error: "..."} and 200 OK. Client
//     treats any response with empty fields as "use deterministic fallback".

const CLAW_ENHANCE_CACHE_TTL = 3600;              // 1 h
const CLAW_ENHANCE_DEFAULT_MODEL = "gpt-5.5";

async function handleClawEnhance(request, env) {
  if (!env.OPENAI_API_KEY) {
    return json({ fields: {}, source: "fallback", error: "openai-not-configured" });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const { feature, state } = body ?? {};
  const builder = CLAW_ENHANCERS[feature];
  if (!builder) {
    return json({ fields: {}, source: "fallback", error: `unknown-feature:${feature}` });
  }

  const cacheKey = await clawCacheKey(feature, state);

  // Cache hit
  if (env.NOTIFICATIONS) {
    const cached = await env.NOTIFICATIONS.get(cacheKey, { type: "json" });
    if (cached) {
      return json({ fields: cached, source: "cache" });
    }
  }

  const spec = builder(state ?? {});
  if (!spec) {
    return json({ fields: {}, source: "fallback", error: "empty-state" });
  }

  const model = openaiEnhanceModel(env);

  let raw;
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: spec.system },
          { role: "user", content: spec.user },
        ],
        response_format: { type: "json_object" },
        // GPT-5.x rejected `max_tokens`; use `max_completion_tokens`.
        // Temperature left at server default — newer reasoning-family
        // models reject non-default values.
        max_completion_tokens: 400,
      }),
    });
    if (!res.ok) {
      const detail = (await res.text()).slice(0, 300);
      return json({
        fields: {},
        source: "fallback",
        error: `openai-${res.status}`,
        detail,
      });
    }
    const data = await res.json();
    raw = data.choices?.[0]?.message?.content;
  } catch (e) {
    return json({ fields: {}, source: "fallback", error: `openai-threw:${e.message}` });
  }

  if (!raw) {
    return json({ fields: {}, source: "fallback", error: "no-content" });
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return json({ fields: {}, source: "fallback", error: "bad-json-from-model" });
  }

  const validated = spec.validate(parsed);

  if (env.NOTIFICATIONS) {
    await env.NOTIFICATIONS.put(cacheKey, JSON.stringify(validated), {
      expirationTtl: CLAW_ENHANCE_CACHE_TTL,
    });
  }

  return json({ fields: validated, source: "openclaw", model });
}

async function clawCacheKey(feature, state) {
  const buf = new TextEncoder().encode(
    `${feature}:${safeStringify(state)}`,
  );
  const hash = await crypto.subtle.digest("SHA-256", buf);
  const hex = Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 16);
  return `hc:claw:enhance:${feature}:${hex}`;
}

function safeStringify(v) {
  try {
    return JSON.stringify(v ?? null);
  } catch {
    return String(v);
  }
}

// Utilities used by enhancers
function clampStr(s, max) {
  if (typeof s !== "string") return "";
  return s.trim().slice(0, max);
}
function asStringArray(v, maxLen, maxItems) {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => clampStr(String(x), maxLen))
    .filter((x) => x.length > 0)
    .slice(0, maxItems);
}

// ── Per-feature prompt builders ────────────────────────────────────

const CLAW_ENHANCERS = {
  // Morning checklist intro
  // state:  { variant: {highTempF, needsJacket, hotDay, rain}, items: [...] }
  // output: { intro: string (≤100 chars) }
  morningChecklist(state) {
    const v = state?.variant ?? {};
    return {
      system:
        'You write ONE short, warm, slightly varied line of copy for a family TV dashboard checklist shown to kids heading to school. Max 100 characters. Casual tone, not robotic. Never scold. Respond with strict JSON: {"intro": "..."}.',
      user: `Today's weather: highTempF=${v.highTempF ?? "?"}, needsJacket=${!!v.needsJacket}, hotDay=${!!v.hotDay}, rain=${!!v.rain}. Write a single "before you head out" opener for the checklist.`,
      validate: (fields) => ({ intro: clampStr(fields?.intro, 140) }),
    };
  },

  // Bedtime toast softener
  // state:  { bedtimeAt, minutesUntil, kidsInRange: [{childId, childName}] }
  // output: { copy: string (≤160 chars) }
  bedtime(state) {
    const kids = (state?.kidsInRange ?? []).map((k) => k.childName).filter(Boolean).join(" & ");
    const mins = state?.minutesUntil ?? 30;
    return {
      system:
        'You write ONE gentle bedtime-approaching reminder for a family TV dashboard. Max 160 characters. Soft, contextual, never scolding. No emojis. Respond with strict JSON: {"copy": "..."}.',
      user: `Bedtime for ${kids || "the kids"} is in ${mins} minutes. Write a single line that nudges them to start winding down.`,
      validate: (fields) => ({ copy: clampStr(fields?.copy, 200) }),
    };
  },

  // Takeout decision suggestions
  // state:  { decision, vendor?, suggestedVendors: string[] }
  // output: { intro: string, topPicks: [{name, reason}] (≤2) }
  takeout(state) {
    const vendors = Array.isArray(state?.suggestedVendors) ? state.suggestedVendors : [];
    return {
      system:
        'You help a family decide on dinner takeout. Pick TWO vendors from the provided list and give each a one-phrase reason. Write one short intro line (≤120 chars). No emojis. Respond with strict JSON: {"intro":"...","topPicks":[{"name":"...","reason":"..."},{"name":"...","reason":"..."}]}. The "name" field must be exactly as provided in the input list.',
      user: `It's past 4:30 PM and no dinner decision has been made. Rotation suggests: ${vendors.join(", ")}. Pick the two you'd lean toward and explain briefly.`,
      validate: (fields) => {
        const validNames = new Set(vendors);
        const picks = Array.isArray(fields?.topPicks) ? fields.topPicks : [];
        return {
          intro: clampStr(fields?.intro, 140),
          topPicks: picks
            .filter((p) => p && validNames.has(p.name))
            .slice(0, 2)
            .map((p) => ({ name: p.name, reason: clampStr(p.reason, 80) })),
        };
      },
    };
  },

  // Lunch hint
  // state:  { dateLabel, dateISO, isSchoolDay, menu: string[] }
  // output: { kidPreferenceHint: string (≤160 chars) }
  lunch(state) {
    const menu = Array.isArray(state?.menu) ? state.menu.slice(0, 5) : [];
    return {
      system:
        'You write ONE short helpful hint about tomorrow\'s school lunch for a family deciding school-vs-home lunch. Max 160 chars. Do not invent kid names or preferences — if the menu is empty, say so briefly. No emojis. Respond with strict JSON: {"kidPreferenceHint":"..."}.',
      user: `Tomorrow is ${state?.dateLabel ?? "a school day"}. School menu: ${menu.length ? menu.join(", ") : "(not loaded)"}. Write one line noting whether school lunch looks appealing.`,
      validate: (fields) => ({
        kidPreferenceHint: clampStr(fields?.kidPreferenceHint, 200),
      }),
    };
  },

  // Calendar conflict summary
  // state:  { conflicts: [{a:{title,start}, b:{title,start}, at}], peter0800_0900Risk }
  // output: { summary, suggestion }
  calendarConflict(state) {
    const c = Array.isArray(state?.conflicts) ? state.conflicts[0] : null;
    return {
      system:
        'You summarize a single calendar conflict in friendly everyday language for a family TV dashboard. Exactly two fields: summary (≤120 chars), suggestion (≤140 chars). No emojis. Respond with strict JSON: {"summary":"...","suggestion":"..."}.',
      user: c
        ? `Two things overlap at ${c.at}: "${c.a?.title}" and "${c.b?.title}". Peter has a work block risk 8–9 AM: ${!!state?.peter0800_0900Risk}. Summarize the clash and suggest one small way to handle it.`
        : "There is a morning overlap today but no details. Write a generic heads-up.",
      validate: (fields) => ({
        summary: clampStr(fields?.summary, 160),
        suggestion: clampStr(fields?.suggestion, 180),
      }),
    };
  },

  // Claw suggestions re-phrasing (never re-ranks across tiers; only polishes copy)
  // state:  [{id, tier, title}]
  // output: { items: [{id, title, detail}] }
  clawSuggestions(state) {
    const rows = Array.isArray(state) ? state.slice(0, 6) : [];
    return {
      system:
        'You polish short suggestion titles for a family TV dashboard. Keep each title ≤40 chars and each detail ≤80 chars. Do NOT change the order and do NOT invent new ids. For every input id you must emit a matching output object. No emojis. Respond with strict JSON: {"items":[{"id":"...","title":"...","detail":"..."}]}.',
      user: `Rewrite these suggestions so the titles feel less robotic and the details feel specific:\n${rows.map((r, i) => `${i + 1}. id=${r.id} tier=${r.tier} title=${r.title}`).join("\n")}`,
      validate: (fields) => {
        const validIds = new Set(rows.map((r) => r.id));
        const items = Array.isArray(fields?.items) ? fields.items : [];
        return {
          items: items
            .filter((it) => it && validIds.has(it.id))
            .map((it) => ({
              id: it.id,
              title: clampStr(it.title, 60),
              detail: clampStr(it.detail, 120),
            }))
            .slice(0, rows.length),
        };
      },
    };
  },

  // Birthday gift ideas
  // state:  { name, relation?, daysUntil, constraints?: string[] }
  // output: { ideas: [{idea, priceEstimate, rationale}] (3–5) }
  birthdayGiftIdeas(state) {
    const constraints = asStringArray(state?.constraints, 80, 5);
    return {
      system:
        'You generate 3 to 5 concrete birthday gift ideas for a family member or friend. Each idea: 3–8 word name, rough USD price estimate (e.g. "$25–$40"), and a one-sentence rationale. No generic filler. No emojis. Respond with strict JSON: {"ideas":[{"idea":"...","priceEstimate":"...","rationale":"..."}]}.',
      user: `Recipient: ${state?.name ?? "(unknown)"}${state?.relation ? ` (${state.relation})` : ""}. Birthday in ${state?.daysUntil ?? "?"} days.${constraints.length ? ` Constraints: ${constraints.join("; ")}.` : ""} Generate 3–5 specific gift ideas.`,
      validate: (fields) => {
        const ideas = Array.isArray(fields?.ideas) ? fields.ideas : [];
        return {
          ideas: ideas
            .slice(0, 5)
            .map((it) => ({
              idea: clampStr(it?.idea, 80),
              priceEstimate: clampStr(it?.priceEstimate, 40),
              rationale: clampStr(it?.rationale, 200),
            }))
            .filter((it) => it.idea.length > 0),
        };
      },
    };
  },

  // School-email relevance + structured extraction.
  // state:  { subject, from, snippet, receivedAt }
  // output: {
  //   isRelevant, kind, title, summary, dueDate?, eventDate?,
  //   child?, class?, teacher?, location?, urgency, suggestedAction?,
  //   requiredActionType?
  // }
  //
  // Policy (matches the family's explicit ask: "only flag actionable"):
  //   - Default is isRelevant=false. The model must justify surfacing.
  //   - Relevance requires EITHER a concrete action the family can take
  //     (sign, return, RSVP, pay, bring, volunteer) OR a dated event
  //     that affects the family's schedule.
  //   - Pure informational school content (newsletters w/ no date/action,
  //     fundraising blurbs, general "here's what's happening" updates)
  //     returns isRelevant=false.
  schoolUpdates(state) {
    return {
      system:
        'You classify a single email for a family dashboard showing school items. Return strict JSON: ' +
        '{"isRelevant": bool, "kind": "action"|"event"|"reminder"|"info", "title": str, ' +
        '"summary": str, "dueDate": "YYYY-MM-DD"|null, "eventDate": "YYYY-MM-DD"|null, ' +
        '"child": str|null, "class": str|null, "teacher": str|null, "location": str|null, ' +
        '"urgency": 0..1, "suggestedAction": str|null, ' +
        '"requiredActionType": "sign"|"bring"|"rsvp"|"pay"|"volunteer"|"other"|null}. ' +
        'Only return isRelevant=true if the email contains: (a) a concrete action the family must take ' +
        '(sign/return/RSVP/pay/bring/volunteer) OR (b) a dated school event affecting the family schedule. ' +
        'Newsletters, fundraising, and informational blurbs without dates or actions → isRelevant=false. ' +
        'Non-school emails (retail, shipping, etc.) → isRelevant=false. ' +
        'Keep title ≤60 chars; summary ≤160 chars; suggestedAction ≤100 chars. No emojis.',
      user: [
        `From: ${state?.from ?? "(unknown)"}`,
        `Subject: ${state?.subject ?? ""}`,
        `Received: ${state?.receivedAt ?? ""}`,
        "",
        "Body snippet:",
        String(state?.snippet ?? "").slice(0, 1500),
      ].join("\n"),
      validate: (fields) => {
        const isRelevant = fields?.isRelevant === true;
        if (!isRelevant) {
          return { isRelevant: false };
        }
        const kind = ["action", "event", "reminder", "info"].includes(fields?.kind)
          ? fields.kind
          : "info";
        const urgency = (() => {
          const n = Number(fields?.urgency);
          if (!Number.isFinite(n)) return 0.5;
          return Math.max(0, Math.min(1, n));
        })();
        const dateRe = /^\d{4}-\d{2}-\d{2}$/;
        const requiredActionType = ["sign", "bring", "rsvp", "pay", "volunteer", "other"].includes(fields?.requiredActionType)
          ? fields.requiredActionType
          : null;
        return {
          isRelevant: true,
          kind,
          title: clampStr(fields?.title, 60),
          summary: clampStr(fields?.summary, 160),
          dueDate: dateRe.test(fields?.dueDate ?? "") ? fields.dueDate : null,
          eventDate: dateRe.test(fields?.eventDate ?? "") ? fields.eventDate : null,
          child: clampStr(fields?.child, 60) || null,
          class: clampStr(fields?.class, 80) || null,
          teacher: clampStr(fields?.teacher, 80) || null,
          location: clampStr(fields?.location, 80) || null,
          urgency,
          suggestedAction: clampStr(fields?.suggestedAction, 100) || null,
          requiredActionType,
        };
      },
    };
  },
};

async function fetchBirthdays(appleId, appPassword) {
  const auth = btoa(`${appleId}:${appPassword}`);
  const headers = {
    Authorization: `Basic ${auth}`,
    "Content-Type": "application/xml; charset=utf-8",
    Depth: "0",
  };

  // Reuse CalDAV discovery: principal → home → list calendars
  const principalRes = await fetch("https://caldav.icloud.com/", {
    method: "PROPFIND",
    headers,
    body: `<?xml version="1.0" encoding="utf-8"?>
<d:propfind xmlns:d="DAV:">
  <d:prop><d:current-user-principal/></d:prop>
</d:propfind>`,
  });
  if (!principalRes.ok) throw new Error(`CalDAV auth failed: ${principalRes.status}`);

  const principalXml = await principalRes.text();
  const principalHref = extractHref(principalXml, "current-user-principal");
  if (!principalHref) throw new Error("Could not find principal URL");

  const homeUrl = principalHref.startsWith("http")
    ? principalHref
    : `https://caldav.icloud.com${principalHref}`;
  const homeRes = await fetch(homeUrl, {
    method: "PROPFIND",
    headers,
    body: `<?xml version="1.0" encoding="utf-8"?>
<d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
  <d:prop><c:calendar-home-set/></d:prop>
</d:propfind>`,
  });

  const homeXml = await homeRes.text();
  const homeHref = extractHref(homeXml, "calendar-home-set");
  if (!homeHref) throw new Error("Could not find calendar home");

  const listUrl = homeHref.startsWith("http")
    ? homeHref
    : `https://caldav.icloud.com${homeHref}`;
  const listRes = await fetch(listUrl, {
    method: "PROPFIND",
    headers: { ...headers, Depth: "1" },
    body: `<?xml version="1.0" encoding="utf-8"?>
<d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav" xmlns:cs="http://calendarserver.org/ns/">
  <d:prop>
    <d:displayname/>
    <d:resourcetype/>
    <cs:getctag/>
  </d:prop>
</d:propfind>`,
  });

  const listXml = await listRes.text();
  const calendarHrefs = extractCalendarHrefs(listXml, homeHref);

  // Query all calendars for events in the next 90 days that look like birthdays
  const today = new Date();
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const endRange = new Date(startOfDay.getTime() + 90 * 86400000);
  const dtStart = toIcalDate(startOfDay);
  const dtEnd = toIcalDate(endRange);

  const allBirthdays = [];

  for (const cal of calendarHrefs) {
    try {
      const reportUrl = cal.href.startsWith("http")
        ? cal.href
        : `https://caldav.icloud.com${cal.href}`;
      const reportRes = await fetch(reportUrl, {
        method: "REPORT",
        headers: { ...headers, Depth: "1" },
        body: `<?xml version="1.0" encoding="utf-8"?>
<c:calendar-query xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
  <d:prop>
    <d:getetag/>
    <c:calendar-data/>
  </d:prop>
  <c:filter>
    <c:comp-filter name="VCALENDAR">
      <c:comp-filter name="VEVENT">
        <c:time-range start="${dtStart}" end="${dtEnd}"/>
      </c:comp-filter>
    </c:comp-filter>
  </c:filter>
</c:calendar-query>`,
      });

      if (reportRes.ok) {
        const reportXml = await reportRes.text();
        const icsBlocks = extractCalendarData(reportXml);
        // Check if this is the Birthdays calendar (iCloud names it "Birthdays")
        const isBirthdayCal = /birthdays?/i.test(cal.name) || /birthdays?/i.test(cal.href);
        for (const ics of icsBlocks) {
          const events = parseBirthdayEvents(ics, today, isBirthdayCal);
          allBirthdays.push(...events);
        }
      }
    } catch {
      // Skip individual calendar errors
    }
  }

  // Deduplicate by name + date
  const seen = new Set();
  const unique = allBirthdays.filter((b) => {
    const key = `${b.name.toLowerCase()}|${b.date}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Sort by days until
  unique.sort((a, b) => a.daysUntil - b.daysUntil);

  return unique;
}

function extractBirthdayCalId(listXml) {
  // Try to find the calendar ID associated with "Birthdays" display name
  const responses = listXml.split(/<(?:[a-zA-Z0-9]+:)?response[\s>]/i);
  for (const resp of responses) {
    if (/<(?:[a-zA-Z0-9]+:)?displayname[^>]*>\s*Birthdays?\s*</i.test(resp)) {
      const hrefMatch = resp.match(/<(?:[a-zA-Z0-9]+:)?href[^>]*>([^<]+)/i);
      if (hrefMatch) return hrefMatch[1].trim();
    }
  }
  return "";
}

function parseBirthdayEvents(icsText, today, isBirthdayCal) {
  const unfolded = icsText.replace(/\r\n[ \t]/g, "").replace(/\n[ \t]/g, "");
  const lines = unfolded.split(/\r?\n/);
  const events = [];
  let inEvent = false;
  let current = {};

  const EMOJIS = ["🎂", "🎉", "🎈", "🎁", "🥳", "✨"];

  for (const line of lines) {
    if (line === "BEGIN:VEVENT") {
      inEvent = true;
      current = {};
      continue;
    }
    if (line === "END:VEVENT") {
      inEvent = false;
      if (current.summary && current.dtstart) {
        // Check if this event is a birthday
        const summary = unescapeIcal(current.summary);
        const isBirthday = isBirthdayCal ||
          /birthday/i.test(summary) ||
          /\bbday\b/i.test(summary) ||
          /\bb-?day\b/i.test(summary) ||
          /born/i.test(summary) ||
          (current.categories && /birthday/i.test(current.categories));

        if (isBirthday) {
          const start = parseIcalDate(current.dtstart);
          if (start) {
            // Calculate days until from today
            const eventDate = new Date(today.getFullYear(), start.getMonth(), start.getDate());
            // If the date already passed this year, look at next year
            if (eventDate < today) {
              eventDate.setFullYear(eventDate.getFullYear() + 1);
            }
            const diffMs = eventDate.getTime() - new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
            const daysUntil = Math.round(diffMs / 86400000);

            // Clean up the name: remove "Birthday", "'s Birthday", etc.
            // Handle both straight and smart apostrophes
            let name = summary;
            // Handle reminder-style: "Wish X a happy birthday" → "X"
            const wishMatch = name.match(/^(?:wish|remind|remember|tell|text|call)\s+(.+?)\s+(?:a\s+)?happy\s*(?:birthday|bday|b-day)/i);
            if (wishMatch) {
              name = wishMatch[1].trim();
            } else {
              name = name
                .replace(/['\u2019]s\s+(?:birthday|bday|b-day)\s*(party)?/i, "")
                .replace(/\s*(?:birthday|bday|b-day)\s*(party)?/i, "")
                .trim();
            }
            // If cleaning left nothing useful, use original
            if (!name || name.length < 2) name = summary.trim();
            // Remove trailing possessive that got orphaned
            name = name.replace(/['\u2019]s\s*$/, "").trim();

            const monthDay = start.toLocaleDateString("en-US", { month: "short", day: "numeric" });

            events.push({
              name,
              date: monthDay,
              daysUntil,
              avatar: EMOJIS[events.length % EMOJIS.length],
            });
          }
        }
      }
      continue;
    }
    if (!inEvent) continue;

    const colonIdx = line.indexOf(":");
    if (colonIdx < 0) continue;
    const key = line.substring(0, colonIdx).split(";")[0].toUpperCase();
    const value = line.substring(colonIdx + 1);

    if (key === "SUMMARY") current.summary = value;
    if (key === "DTSTART") current.dtstart = line;
    if (key === "CATEGORIES") current.categories = value;
  }

  return events;
}

// ── School Updates (KV-backed) ───────────────────────────────────────

const SCHOOL_UPDATES_KEY = "school_updates";

async function handleSchoolUpdatesPost(request, env) {
  if (!env.NOTIFICATIONS) {
    return json({ error: "NOTIFICATIONS KV namespace not configured" }, 500);
  }

  const body = await request.json();
  const updates = body.updates;
  if (!Array.isArray(updates)) {
    return json({ error: "Request body must have an 'updates' array" }, 400);
  }

  // Store with timestamp
  const data = {
    updates: updates.slice(0, 10), // Cap at 10 items
    updatedAt: Date.now(),
  };
  await env.NOTIFICATIONS.put(SCHOOL_UPDATES_KEY, JSON.stringify(data));

  return json({ ok: true, count: data.updates.length });
}

async function handleSchoolUpdatesGet(env) {
  if (!env.NOTIFICATIONS) {
    return json({ updates: [], updatedAt: null });
  }

  const data = await env.NOTIFICATIONS.get(SCHOOL_UPDATES_KEY, { type: "json" });
  if (!data) {
    return json({ updates: [], updatedAt: null });
  }

  return json(data);
}

async function dismissSchoolUpdate(env, id, dismissedAt = new Date().toISOString()) {
  if (!env.NOTIFICATIONS) return { ok: false, reason: "kv_not_configured" };
  const data =
    (await env.NOTIFICATIONS.get(SCHOOL_UPDATES_KEY, { type: "json" })) ??
    { updates: [], updatedAt: null };
  const updates = Array.isArray(data.updates) ? data.updates : [];
  let found = false;
  const nextUpdates = updates.map((item) => {
    const itemId = item?.id ?? item?.sourceEmailId;
    if (String(itemId) !== String(id)) return item;
    found = true;
    return { ...item, dismissedAt };
  });
  if (!found) return { ok: false, reason: "not_found", id };
  const next = { ...data, updates: nextUpdates, updatedAt: Date.now() };
  await env.NOTIFICATIONS.put(SCHOOL_UPDATES_KEY, JSON.stringify(next));
  return { ok: true, id, dismissedAt };
}

async function handleNeedsActionDone(request, env) {
  if (!env.NOTIFICATIONS) return json({ error: "KV not configured" }, 500);
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }
  const hasName = typeof body?.name === "string" && body.name.trim();
  const index = Number(body?.index);
  if (!hasName && (!Number.isInteger(index) || index < 1)) {
    return json({ error: "index must be a 1-based integer or name must be a non-empty string" }, 400);
  }

  const now = new Date();
  const actions = await buildCurrentNeedsActions(env, now);
  const match = hasName
    ? findNeedsActionByName(actions, body.name)
    : { action: actions[index - 1], index };
  if (match.reason === "ambiguous_name") {
    return json({ ok: false, reason: "ambiguous_name", name: body.name, matches: match.matches }, 409);
  }
  const action = match.action;
  if (!action) {
    return json(hasName
      ? { ok: false, reason: "name_not_found", name: body.name, count: actions.length }
      : { ok: false, reason: "index_out_of_range", index, count: actions.length }, 404);
  }
  const matchedIndex = match.index;

  if (action.type === "school") {
    const result = await dismissSchoolUpdate(env, action.sourceId, now.toISOString());
    if (!result.ok) return json({ ok: false, action, ...result }, 404);
    return json({ ok: true, index: matchedIndex, action, result });
  }

  if (action.type === "birthday_gift") {
    const response = await handleBirthdayPatch(
      action.sourceId,
      new Request("https://worker.internal/api/birthdays", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          giftStatus: "ordered",
          giftNotes: "Marked ordered by voice command.",
        }),
      }),
      env,
    );
    const payload = await response.json();
    if (!response.ok) return json({ ok: false, action, result: payload }, response.status);
    return json({ ok: true, index: matchedIndex, action, result: payload });
  }

  if (action.type === "takeout") {
    const date = localDateKey(now);
    const record = {
      date,
      decision: "home",
      decidedAt: now.toISOString(),
      decidedBy: "voice",
    };
    await env.NOTIFICATIONS.put(takeoutKeyForDate(date), JSON.stringify(record), {
      expirationTtl: 60 * 60 * 24 * 3,
    });
    return json({ ok: true, index: matchedIndex, action, result: { ok: true, record } });
  }

  return json({
    ok: false,
    reason: "unsupported_action_type",
    index: matchedIndex,
    action,
  }, 409);
}

function normalizeNeedsActionName(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function findNeedsActionByName(actions, rawName) {
  const query = normalizeNeedsActionName(rawName);
  if (!query) return { action: null, index: null };
  const candidates = actions.map((action, offset) => ({
    action,
    index: offset + 1,
    names: [action.title, action.kind, action.id, ...(Array.isArray(action.aliases) ? action.aliases : [])]
      .map(normalizeNeedsActionName)
      .filter(Boolean),
  }));
  const exact = candidates.filter((candidate) => candidate.names.includes(query));
  if (exact.length === 1) return exact[0];
  if (exact.length > 1) {
    return { reason: "ambiguous_name", matches: exact.map(({ action, index }) => ({ index, title: action.title })) };
  }
  const partial = candidates.filter((candidate) =>
    candidate.names.some((name) => name.includes(query) || query.includes(name))
  );
  if (partial.length === 1) return partial[0];
  if (partial.length > 1) {
    return { reason: "ambiguous_name", matches: partial.map(({ action, index }) => ({ index, title: action.title })) };
  }
  return { action: null, index: null };
}

async function buildCurrentNeedsActions(env, now = new Date()) {
  const actions = [];
  const calendarEvents = await currentCalendarEvents(env, now);
  const schoolData = env.NOTIFICATIONS
    ? (await env.NOTIFICATIONS.get(SCHOOL_UPDATES_KEY, { type: "json" })) ?? {}
    : {};
  const schoolItems = Array.isArray(schoolData.updates)
    ? schoolData.updates.filter((item) => !item?.dismissedAt && !workerCalendarEventAlreadyCoversSchoolItem(item, calendarEvents))
    : [];
  const rankedSchool = rankNeedsActionSchoolItems(schoolItems, now);
  for (const item of rankedSchool) {
    const tiebreaker = item.dueDate
      ? dateTiebreaker(item.dueDate)
      : item.eventDate
        ? dateTiebreaker(item.eventDate)
        : -Number.MAX_SAFE_INTEGER;
    actions.push({
      id: `school-${item.id}`,
      type: "school",
      sourceId: item.id ?? item.sourceEmailId,
      title: item.title,
      aliases: [item.suggestedAction, item.summary].filter(Boolean),
      urgencyScore: clamp01(item.urgency),
      tiebreaker,
    });
  }

  const birthday = await firstNeedsActionBirthday(env, now);
  if (birthday) {
    const daysUntil = Math.max(0, Number(birthday.daysUntil) || 0);
    actions.push({
      id: `gift-${birthday.id}`,
      type: "birthday_gift",
      sourceId: birthday.id,
      title: `Order ${birthday.name}'s gift`,
      aliases: [`Suggest gift ideas for ${birthday.name}`, "Suggest gift ideas"],
      urgencyScore: Math.max(0, Math.min(1, 1 - daysUntil / 14)),
      tiebreaker: -daysUntil,
    });
  }

  const minutesSinceMidnight = localMinutesSinceMidnight(now);
  const takeout = await currentTakeoutState(env, now);
  if ((takeout?.decision ?? null) === null && minutesSinceMidnight >= 16.5 * 60 && minutesSinceMidnight < 20 * 60) {
    const minutesToCutoff = 16.5 * 60 - minutesSinceMidnight;
    actions.push({
      id: "takeout",
      type: "takeout",
      title: "Lock in dinner",
      aliases: ["Lock In Dinner"],
      urgencyScore: cutoffScore(minutesToCutoff),
      tiebreaker: -minutesToCutoff,
    });
  }

  return actions
    .sort((a, b) => b.urgencyScore - a.urgencyScore || b.tiebreaker - a.tiebreaker)
    .map(({ urgencyScore, tiebreaker, ...action }) => action);
}

async function currentCalendarEvents(env, now = new Date()) {
  const events = [];
  const calendarTimeZone = env.CALENDAR_TIME_ZONE || env.TZ || "America/Los_Angeles";
  if (env.ICLOUD_APPLE_ID && env.ICLOUD_APP_PASSWORD) {
    try {
      const result = await fetchCalDAV(env.ICLOUD_APPLE_ID, env.ICLOUD_APP_PASSWORD, false, {
        calendarNames: env.CALENDAR_NAMES || env.CALDAV_CALENDAR_NAMES || "Howell Family",
        timeZone: calendarTimeZone,
      });
      events.push(...result.events.map(({ startDate, ...rest }) => ({ ...rest, start: startDate })));
    } catch {
      // Needs Action completion should still work if calendar fetch is briefly unavailable.
    }
  }
  if (env.CALENDAR_URLS) {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const end = new Date(start.getTime() + 14 * 86_400_000);
    for (const feedUrl of env.CALENDAR_URLS.split(",").map((u) => u.trim()).filter(Boolean)) {
      try {
        const res = await fetch(feedUrl.replace("webcal://", "https://"));
        if (!res.ok) continue;
        events.push(...parseIcalEvents(await res.text(), start, end, { timeZone: calendarTimeZone })
          .map(({ startDate, ...rest }) => ({ ...rest, start: startDate })));
      } catch {
        // Ignore secondary calendar feed failures for this best-effort filter.
      }
    }
  }
  return events;
}

function clamp01(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function dateTiebreaker(value) {
  if (!value) return -Number.MAX_SAFE_INTEGER;
  const ts = new Date(value).getTime();
  return Number.isFinite(ts) ? -ts : -Number.MAX_SAFE_INTEGER;
}

function isUrgentNeedsActionSchoolItem(item, now) {
  return (
    (item.dueDate && (new Date(item.dueDate).getTime() - now.getTime()) / 3_600_000 <= 24) ||
    Number(item.urgency ?? 0) >= 0.7
  );
}

function rankNeedsActionSchoolItems(items, now) {
  const tierOf = (item) => {
    if (isUrgentNeedsActionSchoolItem(item, now)) return 0;
    if (item.kind === "action") return 1;
    if (item.kind === "event") return 2;
    if (item.kind === "reminder") return 3;
    return 4;
  };
  return [...items].sort((a, b) => {
    const ta = tierOf(a);
    const tb = tierOf(b);
    if (ta !== tb) return ta - tb;
    const da = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
    const db = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
    return da - db;
  });
}

function workerCalendarEventAlreadyCoversSchoolItem(item, calendarEvents = []) {
  if (item.kind !== "event") return false;
  const schoolDate = parseWorkerSchoolItemDate(item.eventDate ?? item.dueDate);
  if (!Number.isFinite(schoolDate.getTime())) return false;
  const itemTokens = workerSignificantTitleTokens(`${item.title ?? ""} ${item.summary ?? ""} ${item.location ?? ""}`);
  if (itemTokens.length === 0) return false;

  return calendarEvents.some((event) => {
    if (event.status === "declined") return false;
    const eventStart = new Date(event.start ?? event.startDate ?? "");
    if (!Number.isFinite(eventStart.getTime()) || localDateKey(eventStart) !== localDateKey(schoolDate)) return false;
    const eventTokens = workerSignificantTitleTokens(`${event.title ?? ""} ${event.summary ?? ""} ${event.location ?? ""}`);
    return workerLooseTokenMatch(itemTokens, eventTokens);
  });
}

function parseWorkerSchoolItemDate(value) {
  if (!value) return new Date("");
  const ymd = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (ymd) return new Date(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]));
  return new Date(value);
}

function workerSignificantTitleTokens(value) {
  const stop = new Set([
    "a", "an", "and", "at", "by", "due", "event", "for", "form",
    "in", "is", "of", "on", "school", "the", "to", "walking",
  ]);
  return Array.from(new Set(
    String(value).toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .split(/\s+/)
      .filter((token) => token.length >= 3 && !stop.has(token)),
  ));
}

function workerLooseTokenMatch(itemTokens, eventTokens) {
  if (!itemTokens.length || !eventTokens.length) return false;
  const eventSet = new Set(eventTokens);
  const overlap = itemTokens.filter((token) => eventSet.has(token));
  if (overlap.length >= 2) return true;
  const shortest = Math.min(itemTokens.length, eventTokens.length);
  return shortest <= 2 && overlap.length >= 1;
}

async function firstNeedsActionBirthday(env, now) {
  if (!env.ICLOUD_APPLE_ID || !env.ICLOUD_APP_PASSWORD) return null;
  try {
    const birthdays = await fetchBirthdays(env.ICLOUD_APPLE_ID, env.ICLOUD_APP_PASSWORD);
    const overrides = env.NOTIFICATIONS
      ? (await env.NOTIFICATIONS.get(BIRTHDAY_GIFTS_KEY, { type: "json" })) ?? {}
      : {};
    const ranked = birthdays
      .map((b) => {
        const id = b.id ?? b.uid ?? b.name;
        const override = overrides[id];
        const giftStatus = override?.giftStatus ?? b.giftStatus ?? "unknown";
        const daysUntil = Number.isFinite(Number(b.daysUntil)) ? Number(b.daysUntil) : daysUntilMMDDWorker(b.date, now);
        return { ...b, id, giftStatus, daysUntil };
      })
      .filter((b) => b.daysUntil <= 60)
      .sort((a, b) => a.daysUntil - b.daysUntil);
    return ranked.find((b) => b.daysUntil <= 30 && (b.giftStatus === "needed" || b.giftStatus === "unknown")) ?? null;
  } catch {
    return null;
  }
}

async function currentTakeoutState(env, now) {
  if (!env.NOTIFICATIONS) return null;
  return await env.NOTIFICATIONS.get(takeoutKeyForDate(localDateKey(now)), { type: "json" });
}

function cutoffScore(minutesToCutoff) {
  if (minutesToCutoff <= 0) return 0.95;
  if (minutesToCutoff <= 30) return 0.8;
  if (minutesToCutoff <= 90) return 0.55;
  if (minutesToCutoff <= 240) return 0.3;
  return 0.1;
}

function localDateParts(date, timeZone = "America/Los_Angeles") {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

function localDateKey(date) {
  const p = localDateParts(date);
  return `${p.year}-${p.month}-${p.day}`;
}

function localMinutesSinceMidnight(date) {
  const p = localDateParts(date);
  const hour = Number(p.hour === "24" ? "0" : p.hour);
  return hour * 60 + Number(p.minute);
}

function daysUntilMMDDWorker(mmdd, now) {
  const [month, day] = String(mmdd ?? "").split("-").map(Number);
  if (!month || !day) return Infinity;
  const p = localDateParts(now);
  const start = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day));
  let target = Date.UTC(Number(p.year), month - 1, day);
  if (target < start) target = Date.UTC(Number(p.year) + 1, month - 1, day);
  return Math.round((target - start) / 86_400_000);
}

// ── Takeout (tonight's dinner decision) ─────────────────────────────

const VALID_TAKEOUT_DECISIONS = new Set(["takeout", "home"]);
const TAKEOUT_SUGGESTIONS_KEY = "hc:takeout:suggestions";

function takeoutKeyForDate(date) {
  return `hc:takeout:${date}`;
}

function todayKey() {
  const n = new Date();
  const y = n.getUTCFullYear();
  const m = String(n.getUTCMonth() + 1).padStart(2, "0");
  const d = String(n.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

async function handleTakeoutGet(env) {
  if (!env.NOTIFICATIONS) return json(null);
  const today = todayKey();
  const raw = await env.NOTIFICATIONS.get(takeoutKeyForDate(today), { type: "json" });
  const suggestions = await currentTakeoutSuggestions(env);
  if (!raw) {
    if (!suggestions) return json(null);
    return json({
      date: today,
      decision: null,
      ...suggestions,
    });
  }
  return json({
    ...raw,
    suggestedVendors: raw.suggestedVendors ?? suggestions?.suggestedVendors,
    recentVendors: raw.recentVendors ?? suggestions?.recentVendors,
    suggestionsSource: raw.suggestionsSource ?? suggestions?.suggestionsSource,
    suggestionsUpdatedAt: raw.suggestionsUpdatedAt ?? suggestions?.suggestionsUpdatedAt,
  });
}

async function handleTakeoutPost(request, env) {
  if (!env.NOTIFICATIONS) return json({ error: "KV not configured" }, 500);
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }
  const { date, decision, vendor, decidedBy } = body ?? {};
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return json({ error: "date must be YYYY-MM-DD" }, 400);
  }
  if (decision !== null && !VALID_TAKEOUT_DECISIONS.has(decision)) {
    return json({ error: `decision must be one of ${[...VALID_TAKEOUT_DECISIONS].join(", ")} or null` }, 400);
  }
  const record = {
    date,
    decision,
    vendor: typeof vendor === "string" ? vendor : undefined,
    decidedAt: new Date().toISOString(),
    decidedBy: typeof decidedBy === "string" ? decidedBy : undefined,
  };
  await env.NOTIFICATIONS.put(takeoutKeyForDate(date), JSON.stringify(record), {
    // Keep for ~3 days; cheap insurance against long-running stale keys.
    expirationTtl: 60 * 60 * 24 * 3,
  });
  return json({ ok: true, record });
}

async function currentTakeoutSuggestions(env) {
  if (!env.NOTIFICATIONS) return null;
  const raw = await env.NOTIFICATIONS.get(TAKEOUT_SUGGESTIONS_KEY, { type: "json" });
  if (!raw || !Array.isArray(raw.suggestedVendors) || raw.suggestedVendors.length === 0) return null;
  return {
    suggestedVendors: asStringArray(raw.suggestedVendors, 80, 8),
    recentVendors: Array.isArray(raw.recentVendors)
      ? raw.recentVendors.slice(0, 12).map((item) => ({
        name: clampStr(item?.name, 80),
        lastOrderedDate: clampStr(item?.lastOrderedDate, 20),
        count: Number.isFinite(Number(item?.count)) ? Number(item.count) : undefined,
      })).filter((item) => item.name)
      : [],
    suggestionsSource: clampStr(raw.suggestionsSource, 80) || "gmail",
    suggestionsUpdatedAt: clampStr(raw.suggestionsUpdatedAt, 40),
  };
}

async function handleTakeoutSuggestionsPost(request, env) {
  if (!env.NOTIFICATIONS) return json({ error: "KV not configured" }, 500);
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const suggestedVendors = asStringArray(body?.suggestedVendors, 80, 8);
  if (!suggestedVendors.length) {
    return json({ error: "suggestedVendors must include at least one restaurant name" }, 400);
  }
  const recentVendors = Array.isArray(body?.recentVendors)
    ? body.recentVendors.slice(0, 12).map((item) => ({
      name: clampStr(item?.name, 80),
      lastOrderedDate: clampStr(item?.lastOrderedDate, 20),
      count: Number.isFinite(Number(item?.count)) ? Number(item.count) : undefined,
    })).filter((item) => item.name)
    : [];
  const record = {
    suggestedVendors,
    recentVendors,
    suggestionsSource: clampStr(body?.suggestionsSource, 80) || "gmail",
    suggestionsUpdatedAt: new Date().toISOString(),
  };
  await env.NOTIFICATIONS.put(TAKEOUT_SUGGESTIONS_KEY, JSON.stringify(record), {
    expirationTtl: 60 * 60 * 24 * 7,
  });
  return json({ ok: true, record });
}

// ── Lunch decisions per date ────────────────────────────────────────

const LUNCH_INDEX_KEY = "hc:lunch:index";
function lunchKeyForDate(date) {
  return `hc:lunch:${date}`;
}

async function handleLunchGet(env) {
  if (!env.NOTIFICATIONS) return json({});
  const index = (await env.NOTIFICATIONS.get(LUNCH_INDEX_KEY, { type: "json" })) ?? [];
  const out = {};
  for (const date of index) {
    const rec = await env.NOTIFICATIONS.get(lunchKeyForDate(date), { type: "json" });
    if (rec) out[date] = rec;
  }
  return json(out);
}

async function handleLunchPost(request, env) {
  if (!env.NOTIFICATIONS) return json({ error: "KV not configured" }, 500);
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }
  const { date, child, choice } = body ?? {};
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return json({ error: "date must be YYYY-MM-DD" }, 400);
  }
  if (typeof child !== "string" || !child) {
    return json({ error: "child required" }, 400);
  }
  if (choice !== "school" && choice !== "home" && choice !== null) {
    return json({ error: "choice must be 'school', 'home', or null" }, 400);
  }
  const existing =
    (await env.NOTIFICATIONS.get(lunchKeyForDate(date), { type: "json" })) ?? {
      date,
      perChild: {},
    };
  existing.perChild[child] = choice;
  existing.updatedAt = new Date().toISOString();
  await env.NOTIFICATIONS.put(lunchKeyForDate(date), JSON.stringify(existing), {
    expirationTtl: 60 * 60 * 24 * 14,
  });
  // Update the date index (trim to last 14 dates).
  const index = (await env.NOTIFICATIONS.get(LUNCH_INDEX_KEY, { type: "json" })) ?? [];
  const next = [date, ...index.filter((d) => d !== date)].slice(0, 14);
  await env.NOTIFICATIONS.put(LUNCH_INDEX_KEY, JSON.stringify(next));
  return json({ ok: true, record: existing });
}

// ── School lunch menu (read-only; ingestion is a separate task) ─────

const SCHOOL_LUNCH_KEY = "hc:school-lunch:menu";

async function handleSchoolLunchGet(env) {
  if (!env.NOTIFICATIONS) return json({ days: [] });
  const raw = await env.NOTIFICATIONS.get(SCHOOL_LUNCH_KEY, { type: "json" });
  if (!raw || !Array.isArray(raw.days)) return json({ days: [] });
  return json(raw);
}

/*
 * TODO: school-lunch ingestion (out of scope for this PR).
 *
 * Write a scheduled worker that monthly:
 *   1. Fetches the two district PDFs (see README / docs).
 *   2. Parses menu items per date.
 *   3. Writes the result to KV at SCHOOL_LUNCH_KEY as `{days: [{date, items, noSchool?}]}`.
 *
 * Until that exists, the dashboard's LunchCard renders a
 * "Menu not loaded yet — check with school" fallback and the derived
 * `lunchDecisionNeeded` flag still works.
 */

// ── Photos ──────────────────────────────────────────────────────────

async function handlePhotos(env) {
  const token = env.PHOTOS_ALBUM_TOKEN;
  if (!token) {
    return json({ error: "PHOTOS_ALBUM_TOKEN not configured on worker. Set it via: wrangler secret put PHOTOS_ALBUM_TOKEN" }, 500);
  }

  // Discover the correct partition via iCloud's 330 redirect
  let host = `p25-sharedstreams.icloud.com`;
  let streamData = null;
  let baseUrl = null;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const url = `https://${host}/${token}/sharedstreams/webstream`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify({ streamCtag: null }),
        redirect: "manual",
      });
      if (res.status === 330) {
        // iCloud returns the correct host in the response body or header
        const body = await res.json().catch(() => ({}));
        const redirectHost = body["X-Apple-MMe-Host"] || res.headers.get("X-Apple-MMe-Host");
        if (redirectHost) {
          host = redirectHost;
          continue;
        }
        break;
      }
      if (res.ok) {
        const data = await res.json();
        if (data.photos) {
          streamData = data;
          baseUrl = `https://${host}/${token}/sharedstreams`;
          break;
        }
      }
    } catch {
      break;
    }
  }

  if (!streamData?.photos) {
    return json({ photos: [] });
  }

  const photos = streamData.photos.slice(0, 20);
  const guids = photos.map((p) => p.photoGuid);

  let assetUrls = {};
  try {
    const assetRes = await fetch(`${baseUrl}/webasseturls`, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({ photoGuids: guids }),
    });
    if (assetRes.ok) {
      const assetData = await assetRes.json();
      assetUrls = assetData.items || {};
    }
  } catch {
    return json({ photos: [] });
  }

  const result = [];
  for (const photo of photos) {
    const derivatives = photo.derivatives || {};
    const best = pickBestDerivative(derivatives);
    if (!best?.checksum) continue;
    const asset = assetUrls[best.checksum];
    if (!asset) continue;
    result.push({
      url: `https://${asset.url_location}${asset.url_path}`,
      cap: photo.caption || "",
    });
  }

  return json({ photos: result });
}

function pickBestDerivative(derivatives) {
  let best = null;
  let bestSize = 0;
  for (const key of Object.keys(derivatives)) {
    const d = derivatives[key];
    const size = (d.width || 0) * (d.height || 0);
    if (size > bestSize && size <= 2000 * 2000) {
      best = d;
      bestSize = size;
    }
  }
  return best || Object.values(derivatives)[0];
}

// ── Notifications (KV-backed) ────────────────────────────────────────

const NOTIF_KEY = "notifications";
const MAX_NOTIFICATIONS = 50;

async function handleNotificationPost(request, env) {
  if (!env.NOTIFICATIONS) {
    return json({ error: "NOTIFICATIONS KV namespace not configured" }, 500);
  }

  const notification = await request.json();
  if (!notification.id || !notification.title) {
    return json({ error: "Notification requires id and title" }, 400);
  }

  const existing = await env.NOTIFICATIONS.get(NOTIF_KEY, { type: "json" }) || [];
  // Deduplicate by id
  const filtered = existing.filter((n) => n.id !== notification.id);
  filtered.unshift(notification);
  // Cap at max
  const capped = filtered.slice(0, MAX_NOTIFICATIONS);
  await env.NOTIFICATIONS.put(NOTIF_KEY, JSON.stringify(capped));

  // If this is a gesture from HandController, also update the fast-poll gesture key
  if (notification.type === "gesture" && notification.from === "HandController") {
    const m = notification.title?.match(/(Left|Right|L|R|Both) (?:Hands?): (.+)/);
    if (m) {
      // Normalize gesture name to camelCase (e.g. "Wave Left" -> "waveLeft")
      const raw = m[2].trim();
      const gesture = raw.includes(" ") || raw.includes("-")
        ? raw.replace(/[-\s]+(.)/g, (_, c) => c.toUpperCase()).replace(/^./, c => c.toLowerCase())
        : raw;
      await env.NOTIFICATIONS.put("gesture_latest", JSON.stringify({
        gesture,
        hand: m[1],
        timestamp: notification.timestamp || Date.now(),
        id: notification.id,
      }));
    }
  }

  return json({ ok: true, count: capped.length });
}

async function handleGestureGet(env) {
  if (!env.NOTIFICATIONS) {
    return json({ gesture: null });
  }
  const raw = await env.NOTIFICATIONS.get("gesture_latest");
  if (!raw) return json({ gesture: null });
  return json({ gesture: JSON.parse(raw) });
}

// ── Wake Word Debug ──

const WAKE_DEBUG_KEY = "wake_debug_events";
const MAX_WAKE_DEBUG_EVENTS = 50;

async function handleWakeDebugPost(request, env) {
  if (!env.NOTIFICATIONS) {
    return json({ error: "KV not configured" }, 500);
  }
  const event = await request.json();
  if (!event.type) {
    return json({ error: "Event requires type" }, 400);
  }
  event.id = event.id || `wd_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  event.timestamp = event.timestamp || Date.now();

  const existing = await env.NOTIFICATIONS.get(WAKE_DEBUG_KEY, { type: "json" }) || [];
  existing.push(event);
  const capped = existing.slice(-MAX_WAKE_DEBUG_EVENTS);
  await env.NOTIFICATIONS.put(WAKE_DEBUG_KEY, JSON.stringify(capped));
  return json({ ok: true });
}

async function handleWakeDebugGet(env, url) {
  if (!env.NOTIFICATIONS) {
    return json({ events: [] });
  }
  const events = await env.NOTIFICATIONS.get(WAKE_DEBUG_KEY, { type: "json" }) || [];
  const since = parseInt(url.searchParams.get("since") || "0", 10);
  const filtered = since ? events.filter((e) => e.timestamp > since) : events;
  return json({ events: filtered });
}

const WAKE_CONFIG_KEY = "wake_config";
const WAKE_CONFIG_DEFAULTS = {
  detection_threshold: 0.4,
  min_consecutive: 3,
  min_rms_energy: 200,
  score_smooth_window: 3,
  post_action_mute: 8.0,
  high_confidence_bypass: 0.8,
  cooldown_seconds: 5,
  record_seconds: 3.5,
  verify_buffer_seconds: 2.5,
};

async function handleWakeConfigGet(env) {
  if (!env.NOTIFICATIONS) {
    return json(WAKE_CONFIG_DEFAULTS);
  }
  const stored = await env.NOTIFICATIONS.get(WAKE_CONFIG_KEY, { type: "json" });
  return json({ ...WAKE_CONFIG_DEFAULTS, ...stored });
}

async function handleWakeConfigPut(request, env) {
  if (!env.NOTIFICATIONS) {
    return json({ error: "KV not configured" }, 500);
  }
  const body = await request.json();
  // Only accept known keys with numeric values
  const update = {};
  for (const [key, val] of Object.entries(body)) {
    if (key in WAKE_CONFIG_DEFAULTS && typeof val === "number" && isFinite(val)) {
      update[key] = val;
    }
  }
  const existing = await env.NOTIFICATIONS.get(WAKE_CONFIG_KEY, { type: "json" }) || {};
  const merged = { ...existing, ...update };
  await env.NOTIFICATIONS.put(WAKE_CONFIG_KEY, JSON.stringify(merged));
  return json({ ...WAKE_CONFIG_DEFAULTS, ...merged });
}

// ── Wake Record (voice sample recording control) ───────────────────

const WAKE_RECORD_KEY = "wake_record";

async function handleWakeRecordGet(env) {
  if (!env.NOTIFICATIONS) {
    return json({ active: false, type: "positive", count: 0, totalPositive: 0, totalNegative: 0 });
  }
  // cacheTtl: 0 forces fresh read — KV eventual consistency can otherwise
  // serve stale data for up to 60s, breaking the recording toggle flow.
  const data = await env.NOTIFICATIONS.get(WAKE_RECORD_KEY, { type: "json", cacheTtl: 30 });
  const result = data || { active: false, type: "positive", count: 0, totalPositive: 0, totalNegative: 0 };
  return new Response(JSON.stringify(result), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}

async function handleWakeRecordPost(request, env) {
  if (!env.NOTIFICATIONS) {
    return json({ error: "KV not configured" }, 500);
  }
  const body = await request.json();
  const current = await env.NOTIFICATIONS.get(WAKE_RECORD_KEY, { type: "json", cacheTtl: 30 }) ||
    { active: false, type: "positive", count: 0, totalPositive: 0, totalNegative: 0 };

  // Ensure totals exist (migration for existing state)
  if (current.totalPositive == null) current.totalPositive = 0;
  if (current.totalNegative == null) current.totalNegative = 0;

  const action = body.action || "toggle";

  if (action === "start") {
    // If already active, accumulate previous session's count first
    if (current.active && (current.count || 0) > 0) {
      if (current.type === "positive") {
        current.totalPositive += current.count;
      } else {
        current.totalNegative += current.count;
      }
    }
    current.active = true;
    current.type = body.type || "positive";
    current.count = 0;
    current.startedAt = Date.now();
  } else if (action === "stop") {
    // Add session count to totals
    if (current.active) {
      if (current.type === "positive") {
        current.totalPositive += current.count || 0;
      } else {
        current.totalNegative += current.count || 0;
      }
    }
    current.active = false;
  } else if (action === "toggle") {
    if (!current.active) {
      // Starting — reset session count
      current.active = true;
      current.type = body.type || current.type || "positive";
      current.count = 0;
      current.startedAt = Date.now();
    } else {
      // Stopping — add session count to totals
      if (current.type === "positive") {
        current.totalPositive += current.count || 0;
      } else {
        current.totalNegative += current.count || 0;
      }
      current.active = false;
    }
  } else if (action === "increment") {
    // Only increment if currently active — don't force active=true
    if (!current.active) return json(current);
    current.count = (current.count || 0) + 1;
  } else if (action === "set_type") {
    current.type = body.type || "positive";
  } else if (action === "reset_totals") {
    current.totalPositive = 0;
    current.totalNegative = 0;
  } else if (action === "clear_recordings") {
    // Full reset — zero everything and mark inactive.
    // Pi polls for this flag and deletes saved audio files.
    current.active = false;
    current.count = 0;
    current.totalPositive = 0;
    current.totalNegative = 0;
    current.clearRequested = true;
  } else if (action === "sync") {
    // Pi pushes its authoritative state — overwrite KV directly.
    current.active = !!body.active;
    current.type = body.type || "positive";
    current.count = body.count || 0;
    current.totalPositive = body.totalPositive || 0;
    current.totalNegative = body.totalNegative || 0;
  } else if (action === "clear_ack") {
    delete current.clearRequested;
  } else if (action === "status") {
    // Read-only — return current state without writing.
    // Using POST instead of GET to avoid KV edge caching.
    return json(current);
  }

  await env.NOTIFICATIONS.put(WAKE_RECORD_KEY, JSON.stringify(current));
  return json(current);
}

async function handleNotificationGet(env) {
  if (!env.NOTIFICATIONS) {
    return json({ notifications: [] });
  }

  const notifications = await env.NOTIFICATIONS.get(NOTIF_KEY, { type: "json" }) || [];
  return json({ notifications });
}

async function handleNotificationDelete(id, env) {
  if (!env.NOTIFICATIONS) {
    return json({ error: "NOTIFICATIONS KV namespace not configured" }, 500);
  }

  const existing = await env.NOTIFICATIONS.get(NOTIF_KEY, { type: "json" }) || [];
  const filtered = existing.filter((n) => n.id !== id);
  await env.NOTIFICATIONS.put(NOTIF_KEY, JSON.stringify(filtered));

  return json({ ok: true, removed: existing.length - filtered.length });
}

// ── Timers (KV-backed) ──────────────────────────────────────────────

// ── Navigation ──────────────────────────────────────────────────────

const NAV_KEY = "navigation";
const DESIGN_SYSTEM_KEY = "design_system";

async function handleNavigatePost(request, env) {
  if (!env.NOTIFICATIONS) {
    return json({ error: "KV namespace NOTIFICATIONS not bound" }, 500);
  }
  const body = await request.json();
  const nav = {
    page: body.page || null,
    view: body.view || null,
    timestamp: Date.now(),
  };
  await env.NOTIFICATIONS.put(NAV_KEY, JSON.stringify(nav));
  return json({ ok: true, navigation: nav });
}

async function handleNavigateGet(env) {
  if (!env.NOTIFICATIONS) {
    return json({ error: "KV namespace NOTIFICATIONS not bound" }, 500);
  }
  const raw = await env.NOTIFICATIONS.get(NAV_KEY);
  if (!raw) return json({ navigation: null });
  return json({ navigation: JSON.parse(raw) });
}

async function handleDesignSystemPost(request, env) {
  if (!env.NOTIFICATIONS) {
    return json({ error: "KV namespace NOTIFICATIONS not bound" }, 500);
  }
  const body = await request.json().catch(() => ({}));
  const version = body.version === "v2" ? "v2" : "v1";
  const state = {
    version,
    timestamp: Date.now(),
  };
  await env.NOTIFICATIONS.put(DESIGN_SYSTEM_KEY, JSON.stringify(state));
  return json({ ok: true, designSystem: state });
}

async function handleDesignSystemGet(env) {
  if (!env.NOTIFICATIONS) {
    return json({ error: "KV namespace NOTIFICATIONS not bound" }, 500);
  }
  const raw = await env.NOTIFICATIONS.get(DESIGN_SYSTEM_KEY);
  if (!raw) return json({ designSystem: { version: "v2", timestamp: 0 } });
  return json({ designSystem: JSON.parse(raw) });
}

// ── Timers ──────────────────────────────────────────────────────────

const TIMERS_KEY = "timers";
const TASKS_KEY = "agent_tasks";

async function handleTimerPost(request, env) {
  if (!env.NOTIFICATIONS) {
    return json({ error: "NOTIFICATIONS KV namespace not configured" }, 500);
  }

  const body = await request.json();
  const { name, totalSeconds, source } = body;
  if (!name || !totalSeconds || typeof totalSeconds !== "number" || totalSeconds <= 0) {
    return json({ error: "Requires name (string) and totalSeconds (positive number)" }, 400);
  }

  const timer = {
    id: `timer_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name,
    totalSeconds,
    expiresAt: Date.now() + totalSeconds * 1000,
    dismissed: false,
    source: source || "manual",
  };

  const existing = await env.NOTIFICATIONS.get(TIMERS_KEY, { type: "json" }) || [];
  existing.push(timer);
  await env.NOTIFICATIONS.put(TIMERS_KEY, JSON.stringify(existing));

  return json({ ok: true, timer });
}

async function handleTimerGet(env) {
  if (!env.NOTIFICATIONS) {
    return json({ timers: [], serverTime: Date.now() });
  }

  const timers = await env.NOTIFICATIONS.get(TIMERS_KEY, { type: "json" }) || [];
  // Prune dismissed timers older than 1 minute — only write if something changed
  const cutoff = Date.now() - 60_000;
  const pruned = timers.filter(t => !t.dismissed || t.expiresAt > cutoff);
  if (pruned.length !== timers.length) {
    await env.NOTIFICATIONS.put(TIMERS_KEY, JSON.stringify(pruned));
  }

  return json({ timers: pruned, serverTime: Date.now() });
}

async function handleTimerDismiss(id, env) {
  if (!env.NOTIFICATIONS) {
    return json({ error: "NOTIFICATIONS KV namespace not configured" }, 500);
  }

  const timers = await env.NOTIFICATIONS.get(TIMERS_KEY, { type: "json" }) || [];
  let found = false;
  for (const t of timers) {
    if (t.id === id) {
      t.dismissed = true;
      found = true;
    }
  }
  await env.NOTIFICATIONS.put(TIMERS_KEY, JSON.stringify(timers));

  return json({ ok: true, found });
}

async function handleTimerDismissAll(env) {
  if (!env.NOTIFICATIONS) {
    return json({ error: "NOTIFICATIONS KV namespace not configured" }, 500);
  }

  const timers = await env.NOTIFICATIONS.get(TIMERS_KEY, { type: "json" }) || [];
  let count = 0;
  for (const t of timers) {
    if (!t.dismissed && t.expiresAt <= Date.now()) {
      t.dismissed = true;
      count++;
    }
  }
  await env.NOTIFICATIONS.put(TIMERS_KEY, JSON.stringify(timers));

  return json({ ok: true, dismissed: count });
}

// ── Agent Tasks (OpenClaw) ──────────────────────────────────────────

async function handleTaskPost(request, env) {
  if (!env.NOTIFICATIONS) {
    return json({ error: "NOTIFICATIONS KV namespace not configured" }, 500);
  }

  const body = await request.json();
  const { title, detail, source } = body;
  if (!title) {
    return json({ error: "Requires title (string)" }, 400);
  }

  const task = {
    id: `task_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    title,
    detail: detail || "",
    status: "active",
    source: source || "openclaw",
    createdAt: Date.now(),
    completedAt: null,
  };

  const existing = await env.NOTIFICATIONS.get(TASKS_KEY, { type: "json" }) || [];
  existing.push(task);
  // Keep max 100 tasks
  const capped = existing.slice(-100);
  await env.NOTIFICATIONS.put(TASKS_KEY, JSON.stringify(capped));

  return json({ ok: true, task });
}

async function handleTaskGet(env) {
  if (!env.NOTIFICATIONS) {
    return json({ tasks: [] });
  }

  const tasks = await env.NOTIFICATIONS.get(TASKS_KEY, { type: "json" }) || [];
  return json({ tasks });
}

async function handleTaskComplete(id, request, env) {
  if (!env.NOTIFICATIONS) {
    return json({ error: "NOTIFICATIONS KV namespace not configured" }, 500);
  }

  const tasks = await env.NOTIFICATIONS.get(TASKS_KEY, { type: "json" }) || [];
  let found = false;
  for (const t of tasks) {
    if (t.id === id && t.status !== "done") {
      t.status = "done";
      t.completedAt = Date.now();
      found = true;
    }
  }
  await env.NOTIFICATIONS.put(TASKS_KEY, JSON.stringify(tasks));

  return json({ ok: true, found });
}

async function handleTaskDelete(id, env) {
  if (!env.NOTIFICATIONS) {
    return json({ error: "NOTIFICATIONS KV namespace not configured" }, 500);
  }

  const tasks = await env.NOTIFICATIONS.get(TASKS_KEY, { type: "json" }) || [];
  const filtered = tasks.filter(t => t.id !== id);
  await env.NOTIFICATIONS.put(TASKS_KEY, JSON.stringify(filtered));

  return json({ ok: true, deleted: tasks.length !== filtered.length });
}

// ── iCal Parsing ────────────────────────────────────────────────────

function parseIcalEvents(icsText, rangeStart, rangeEnd, meta = {}) {
  const unfolded = icsText.replace(/\r\n[ \t]/g, "").replace(/\n[ \t]/g, "");
  const lines = unfolded.split(/\r?\n/);
  const events = [];
  let inEvent = false;
  let current = {};
  const today = new Date();
  const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  const COLORS = [
    "#FF6B6B", "#4ECDC4", "#FFE66D", "#6BCB77",
    "#9B59B6", "#FF8A5C", "#3498DB", "#E74C3C",
  ];

  for (const line of lines) {
    if (line === "BEGIN:VEVENT") {
      inEvent = true;
      current = {};
      continue;
    }
    if (line === "END:VEVENT") {
      inEvent = false;
      if (current.summary && current.dtstart) {
        const timeZone = meta.timeZone || "America/Los_Angeles";
        const start = parseIcalDate(current.dtstart, timeZone);
        if (start) {
          const rawEnd = current.dtend ? parseIcalDate(current.dtend, timeZone) : null;
          const allDay = isIcalAllDay(current.dtstart);
          const durationMs = rawEnd && rawEnd > start
            ? rawEnd.getTime() - start.getTime()
            : allDay
              ? 86400000
              : 60 * 60 * 1000;
          const starts = expandEventStarts(start, current.rrule, current.exdates, rangeStart, rangeEnd, timeZone);
          for (const occurrenceStart of starts) {
            const occurrenceEnd = new Date(occurrenceStart.getTime() + durationMs);
            if (!eventOverlapsRange(occurrenceStart, occurrenceEnd, rangeStart, rangeEnd)) continue;
            const isToday = isSameDay(occurrenceStart, today);
            const dayLabel = isToday
              ? "Today"
              : `${DAYS[occurrenceStart.getDay()]}, ${MONTHS[occurrenceStart.getMonth()]} ${occurrenceStart.getDate()}`;
            const uidSuffix = occurrenceStart.getTime() === start.getTime() ? "" : `-${occurrenceStart.getTime()}`;
            events.push({
              id: current.uid ? `${current.uid}${uidSuffix}` : undefined,
              time: allDay ? "All day" : formatTime(occurrenceStart),
              title: unescapeIcal(current.summary),
              who: current.location ? unescapeIcal(current.location) : "",
              c: COLORS[events.length % COLORS.length],
              startDate: occurrenceStart.getTime(),
              end: occurrenceEnd.getTime(),
              allDay,
              status: current.status ? current.status.toLowerCase() : "accepted",
              calendar: meta.calendar,
              calendarName: meta.calendarName,
              day: dayLabel,
            });
          }
        }
      }
      continue;
    }
    if (!inEvent) continue;

    const colonIdx = line.indexOf(":");
    if (colonIdx < 0) continue;
    const key = line.substring(0, colonIdx).split(";")[0].toUpperCase();
    const value = line.substring(colonIdx + 1);

    if (key === "SUMMARY") current.summary = value;
    if (key === "DTSTART") current.dtstart = line;
    if (key === "DTEND") current.dtend = line;
    if (key === "LOCATION") current.location = value;
    if (key === "RRULE") current.rrule = value;
    if (key === "EXDATE") current.exdates = [...(current.exdates || []), line];
    if (key === "UID") current.uid = value;
    if (key === "STATUS") current.status = value;
  }

  return events;
}

function expandEventStarts(start, rruleText, exdateLines = [], rangeStart, rangeEnd, timeZone = "America/Los_Angeles") {
  if (!rruleText) return [start];

  const rule = Object.fromEntries(
    rruleText.split(";").map((part) => {
      const [key, value = ""] = part.split("=");
      return [key.toUpperCase(), value];
    }),
  );
  const freq = rule.FREQ;
  if (!["DAILY", "WEEKLY", "MONTHLY", "YEARLY"].includes(freq)) return [start];

  const interval = Math.max(1, parseInt(rule.INTERVAL || "1", 10) || 1);
  const count = rule.COUNT ? Math.max(1, parseInt(rule.COUNT, 10) || 1) : null;
  const until = rule.UNTIL ? parseIcalDate(`UNTIL:${rule.UNTIL}`, timeZone) : null;
  const byDays = parseByDays(rule.BYDAY);
  const exclusions = new Set(
    exdateLines
      .flatMap((line) => parseExdates(line, timeZone))
      .map((date) => occurrenceKey(date)),
  );
  const starts = [];
  const hardLimit = 2500;
  let generated = 0;

  if (freq === "WEEKLY" && byDays.length) {
    let weekStart = startOfLocalWeek(start);
    while (weekStart < rangeEnd && generated < hardLimit) {
      const weeksSinceStart = Math.floor((weekStart - startOfLocalWeek(start)) / (7 * 86400000));
      if (weeksSinceStart >= 0 && weeksSinceStart % interval === 0) {
        for (const day of byDays) {
          const occurrence = copyTime(new Date(weekStart.getTime() + day * 86400000), start);
          if (occurrence < start) continue;
          generated++;
          if (count && generated > count) break;
          if (until && occurrence > until) break;
          if (occurrence < rangeEnd && occurrence >= rangeStart && !exclusions.has(occurrenceKey(occurrence))) {
            starts.push(occurrence);
          }
        }
      }
      if ((count && generated >= count) || (until && weekStart > until)) break;
      weekStart = new Date(weekStart.getTime() + 7 * 86400000);
    }
    return starts;
  }

  let occurrence = new Date(start);
  while (occurrence < rangeEnd && generated < hardLimit) {
    generated++;
    if ((!count || generated <= count) && (!until || occurrence <= until)) {
      if (occurrence >= rangeStart && !exclusions.has(occurrenceKey(occurrence))) {
        starts.push(new Date(occurrence));
      }
    }
    if ((count && generated >= count) || (until && occurrence > until)) break;
    occurrence = nextOccurrence(occurrence, freq, interval);
  }

  return starts;
}

function nextOccurrence(date, freq, interval) {
  const next = new Date(date);
  if (freq === "DAILY") next.setDate(next.getDate() + interval);
  if (freq === "WEEKLY") next.setDate(next.getDate() + (7 * interval));
  if (freq === "MONTHLY") next.setMonth(next.getMonth() + interval);
  if (freq === "YEARLY") next.setFullYear(next.getFullYear() + interval);
  return next;
}

function parseByDays(value = "") {
  const days = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };
  return value
    .split(",")
    .map((part) => days[part.replace(/^[+-]?\d+/, "")])
    .filter((day) => day != null)
    .sort((a, b) => a - b);
}

function parseExdates(line, timeZone = "America/Los_Angeles") {
  const colonIdx = line.lastIndexOf(":");
  if (colonIdx < 0) return [];
  return line
    .substring(colonIdx + 1)
    .split(",")
    .map((value) => parseIcalDate(`EXDATE:${value}`, timeZone))
    .filter(Boolean);
}

function startOfLocalWeek(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() - d.getDay());
  return d;
}

function copyTime(date, timeSource) {
  const d = new Date(date);
  d.setHours(timeSource.getHours(), timeSource.getMinutes(), timeSource.getSeconds(), timeSource.getMilliseconds());
  return d;
}

function occurrenceKey(date) {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}-${date.getHours()}-${date.getMinutes()}-${date.getSeconds()}`;
}

function eventOverlapsRange(start, end, rangeStart, rangeEnd) {
  return start < rangeEnd && end > rangeStart;
}

function isIcalAllDay(line) {
  return /VALUE=DATE/i.test(line) || /^\w+(?:;[^:]*)?:\d{8}$/.test(line);
}

function calendarOwnerFromName(name = "") {
  const normalized = name.toLowerCase().trim();
  if (!normalized) return undefined;
  if (normalized.includes("howell") && normalized.includes("family")) return "howell-family";
  if (normalized.includes("peter")) return "peter";
  return normalized
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function calendarNameMatches(name = "", requestedNames = []) {
  const normalized = name.toLowerCase().trim();
  const slug = calendarOwnerFromName(name);
  return requestedNames.some((requested) => {
    const requestedSlug = calendarOwnerFromName(requested);
    return normalized === requested || slug === requestedSlug;
  });
}

function parseIcalDate(str, defaultTimeZone = "America/Los_Angeles") {
  if (!str) return null;
  const colonIdx = str.lastIndexOf(":");
  const prefix = colonIdx >= 0 ? str.substring(0, colonIdx) : "";
  const dateStr = colonIdx >= 0 ? str.substring(colonIdx + 1) : str;
  const clean = dateStr.replace(/[^0-9TZ]/g, "");

  if (clean.length === 8) {
    return new Date(Date.UTC(
      parseInt(clean.slice(0, 4)),
      parseInt(clean.slice(4, 6)) - 1,
      parseInt(clean.slice(6, 8)),
    ));
  }
  if (clean.length >= 15) {
    const y = parseInt(clean.slice(0, 4));
    const mo = parseInt(clean.slice(4, 6)) - 1;
    const d = parseInt(clean.slice(6, 8));
    const h = parseInt(clean.slice(9, 11));
    const mi = parseInt(clean.slice(11, 13));
    const s = parseInt(clean.slice(13, 15));
    if (clean.endsWith("Z")) return new Date(Date.UTC(y, mo, d, h, mi, s));
    return zonedTimeToUtc({ y, mo, d, h, mi, s }, extractTZID(prefix) || defaultTimeZone);
  }
  return null;
}

function extractTZID(prefix) {
  const match = prefix.match(/(?:^|;)TZID=([^;:]+)/i);
  return match ? match[1] : null;
}

function zonedTimeToUtc(parts, timeZone) {
  const localAsUtc = Date.UTC(parts.y, parts.mo, parts.d, parts.h, parts.mi, parts.s);
  let utc = localAsUtc;
  for (let i = 0; i < 2; i++) {
    utc = localAsUtc - getTimeZoneOffsetMs(new Date(utc), timeZone);
  }
  return new Date(utc);
}

function getTimeZoneOffsetMs(date, timeZone) {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    });
    const values = Object.fromEntries(
      formatter.formatToParts(date)
        .filter((part) => part.type !== "literal")
        .map((part) => [part.type, part.value]),
    );
    const zonedAsUtc = Date.UTC(
      Number(values.year),
      Number(values.month) - 1,
      Number(values.day),
      Number(values.hour),
      Number(values.minute),
      Number(values.second),
    );
    return zonedAsUtc - date.getTime();
  } catch {
    return 0;
  }
}

function isSameDay(d1, d2) {
  return d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate();
}

function formatTime(date) {
  const h = date.getHours();
  const m = date.getMinutes();
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return m === 0 ? `${h12} ${ampm}` : `${h12}:${m.toString().padStart(2, "0")} ${ampm}`;
}

function unescapeIcal(str) {
  return str.replace(/\\n/g, "\n").replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\\\/g, "\\");
}

function toIcalDate(date) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

// ── XML helpers for CalDAV ──────────────────────────────────────────

function extractHref(xml, tagName) {
  const pattern = new RegExp(`<[^>]*${tagName}[^>]*>[\\s\\S]*?<[^>]*href[^>]*>([^<]+)`, "i");
  const match = xml.match(pattern);
  return match ? match[1].trim() : null;
}

function extractCalendarHrefs(xml, homeHref) {
  const hrefs = [];
  // Split on any <response> tag regardless of namespace prefix
  const responses = xml.split(/<(?:[a-zA-Z0-9]+:)?response[\s>]/i);
  for (const resp of responses) {
    // Check if this response describes a calendar collection
    const isCollection = /<(?:[a-zA-Z0-9]+:)?collection/i.test(resp);
    const isCalendar = /calendar/i.test(resp) || /VCALENDAR/i.test(resp);
    if (isCollection && isCalendar) {
      // Extract href from any namespace
      const hrefMatch = resp.match(/<(?:[a-zA-Z0-9]+:)?href[^>]*>([^<]+)/i);
      if (hrefMatch) {
        const href = hrefMatch[1].trim();
        // Skip the home href itself (it's the parent, not a calendar)
        const normalizedHref = href.replace(/\/$/, "");
        const normalizedHome = (homeHref || "").replace(/\/$/, "");
        if (normalizedHref !== normalizedHome) {
          // Extract display name
          const nameMatch = resp.match(/<(?:[a-zA-Z0-9]+:)?displayname[^>]*>([^<]*)/i);
          const name = nameMatch ? nameMatch[1].trim() : "";
          hrefs.push({ href, name });
        }
      }
    }
  }
  return hrefs;
}

function extractCalendarData(xml) {
  const blocks = [];
  const pattern = /BEGIN:VCALENDAR[\s\S]*?END:VCALENDAR/g;
  let match;
  while ((match = pattern.exec(xml)) !== null) {
    blocks.push(match[0]);
  }
  return blocks;
}

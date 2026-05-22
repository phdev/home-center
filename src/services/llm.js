const IMAGE_MODEL = "gpt-image-2";

export async function chatCompletion(messages, apiKey, model = "gpt-4o-mini") {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: 512,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `API error: ${res.status}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || "No response.";
}

function isGptImageModel(model) {
  return String(model || "").startsWith("gpt-image-");
}

function normalizeImageModel() {
  return IMAGE_MODEL;
}

function imageGenerationBody(model, prompt) {
  const imageModel = normalizeImageModel(model);
  return {
    model: imageModel,
    prompt,
    n: 1,
    size: "1024x1024",
    quality: isGptImageModel(imageModel) ? "medium" : "standard",
  };
}

function imageResultUrl(data) {
  const item = data?.data?.[0];
  if (!item) return null;
  if (item.url) return item.url;
  if (item.b64_json) return `data:image/png;base64,${item.b64_json}`;
  return null;
}

export async function generateImage(prompt, apiKey, model = IMAGE_MODEL) {
  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(imageGenerationBody(model, prompt)),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Image API error: ${res.status}`);
  }

  const data = await res.json();
  return imageResultUrl(data);
}

export async function askWithImage(query, conversationHistory, apiKey, model, imageModel) {
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
    ...conversationHistory.map((m) => ({
      role: m.r === "u" ? "user" : "assistant",
      content: m.t,
    })),
    { role: "user", content: query },
  ];

  const text = await chatCompletion(messages, apiKey, model);

  let responseText = text;
  let imageUrl = null;

  const imgMatch = text.match(/\[IMAGE_PROMPT:\s*(.+?)\]/);
  if (imgMatch) {
    responseText = text.replace(/\[IMAGE_PROMPT:\s*.+?\]/, "").trim();
    try {
      imageUrl = await generateImage(imgMatch[1], apiKey, imageModel);
    } catch (e) {
      console.warn("Image generation failed:", e);
    }
  }

  return { text: responseText, imageUrl };
}

// Worker-proxied version — no keys in browser
export async function askViaWorker(query, conversationHistory, workerUrl, workerToken) {
  const headers = { "Content-Type": "application/json" };
  if (workerToken) headers.Authorization = `Bearer ${workerToken}`;

  const res = await fetch(`${workerUrl}/api/ask`, {
    method: "POST",
    headers,
    body: JSON.stringify({ query, history: conversationHistory }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Worker error: ${res.status}`);
  }

  return await res.json();
}

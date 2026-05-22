// Ollama local tier — OpenAI-compatible HTTP client
// Connects to Ollama at configurable host (default localhost:11434)

import config from '../config.js';

export function available() {
  return config.tiers.local.enabled;
}

export async function checkHealth() {
  if (!config.tiers.local.enabled) return false;
  try {
    const res = await fetch(`${config.tiers.local.host}/api/tags`, {
      signal: AbortSignal.timeout(5000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function complete(query, context = {}) {
  if (!config.tiers.local.enabled) {
    throw new Error('Local tier is disabled');
  }

  const { host, model, timeout } = config.tiers.local;
  const messages = [];

  if (context.systemPrompt) {
    messages.push({ role: 'system', content: context.systemPrompt });
  }
  if (context.history) {
    messages.push(...context.history);
  }
  messages.push({ role: 'user', content: query });

  const res = await fetch(`${host}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages,
      temperature: context.temperature ?? 0.7,
      max_tokens: context.maxTokens ?? 1024,
    }),
    signal: AbortSignal.timeout(timeout),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Ollama error ${res.status}: ${text}`);
  }

  const data = await res.json();
  const choice = data.choices?.[0];

  return {
    response: choice?.message?.content || '',
    model: data.model || model,
    tokens_in: data.usage?.prompt_tokens || 0,
    tokens_out: data.usage?.completion_tokens || 0,
  };
}

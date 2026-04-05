// Anthropic cloud tier — direct fetch to api.anthropic.com
// No SDK, no proxy — just HTTP

import config from '../config.js';

export function available() {
  return config.tiers.anthropic.enabled && !!config.tiers.anthropic.apiKey;
}

export async function complete(query, context = {}, modelKey = 'sonnet') {
  const { apiKey, models, baseUrl } = config.tiers.anthropic;
  if (!apiKey) throw new Error('Anthropic API key not configured');

  const model = models[modelKey] || models.sonnet;
  const messages = [];

  if (context.history) {
    messages.push(...context.history);
  }
  messages.push({ role: 'user', content: query });

  const body = {
    model,
    max_tokens: context.maxTokens ?? 1024,
    messages,
  };
  if (context.systemPrompt) {
    body.system = context.systemPrompt;
  }

  const res = await fetch(`${baseUrl}/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Anthropic error ${res.status}: ${text}`);
  }

  const data = await res.json();
  const content = data.content?.map((b) => b.text).join('') || '';

  return {
    response: content,
    model: data.model || model,
    tokens_in: data.usage?.input_tokens || 0,
    tokens_out: data.usage?.output_tokens || 0,
  };
}

// Groq cloud tier — direct fetch to api.groq.com
// No SDK, no proxy — just HTTP

import config from '../config.js';

export function available() {
  return config.tiers.groq.enabled && !!config.tiers.groq.apiKey;
}

export async function complete(query, context = {}) {
  const { apiKey, model, baseUrl } = config.tiers.groq;
  if (!apiKey) throw new Error('Groq API key not configured');

  const messages = [];
  if (context.systemPrompt) {
    messages.push({ role: 'system', content: context.systemPrompt });
  }
  if (context.history) {
    messages.push(...context.history);
  }
  messages.push({ role: 'user', content: query });

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: context.temperature ?? 0.7,
      max_tokens: context.maxTokens ?? 1024,
    }),
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Groq error ${res.status}: ${text}`);
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

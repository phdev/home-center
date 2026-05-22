import config from '../config.js';

export function available() {
  return config.tiers.openai.enabled && !!config.tiers.openai.apiKey;
}

export async function complete(query, context = {}) {
  const { apiKey, model, baseUrl } = config.tiers.openai;
  if (!apiKey) throw new Error('OpenAI API key not configured');

  const messages = [];
  if (context.systemPrompt) {
    messages.push({ role: 'system', content: context.systemPrompt });
  }
  if (Array.isArray(context.history)) {
    messages.push(...context.history);
  }
  messages.push({ role: 'user', content: query });

  const body = {
    model,
    messages,
    response_format: { type: 'json_object' },
  };
  if (modelSupportsMaxCompletionTokens(model)) {
    body.max_completion_tokens = context.maxTokens ?? 1024;
  } else {
    body.max_tokens = context.maxTokens ?? 1024;
  }
  if (context.temperature !== undefined && !modelUsesDefaultTemperatureOnly(model)) {
    body.temperature = context.temperature;
  }

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(config.tiers.openai.timeout),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`OpenAI error ${res.status}: ${text}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content || '';

  return {
    response: content,
    model: data.model || model,
    tokens_in: data.usage?.prompt_tokens || 0,
    tokens_out: data.usage?.completion_tokens || 0,
  };
}

function modelSupportsMaxCompletionTokens(model) {
  return String(model || '').startsWith('gpt-5');
}

function modelUsesDefaultTemperatureOnly(model) {
  return String(model || '').startsWith('gpt-5');
}

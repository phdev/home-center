import {
  completeKnowledgeJson,
  loadRouterTiers,
  KNOWLEDGE_SYSTEM_PROMPT,
} from '../../knowledge-bridge.js';

export async function available() {
  const { local, anthropic } = await loadRouterTiers();
  return local.available() || anthropic.available();
}

export async function complete(query, context = {}) {
  const result = await completeKnowledgeJson({
    messages: [
      { role: 'system', content: context.systemPrompt || KNOWLEDGE_SYSTEM_PROMPT },
      { role: 'user', content: query },
    ],
    temperature: context.temperature ?? 0,
    maxTokens: context.maxTokens ?? 2048,
  });

  return {
    response: JSON.stringify(result.json),
    model: result.model || null,
    // TODO: The bridge does not expose provider token counts yet.
    tokens_in: 0,
    tokens_out: 0,
    knowledge_tier: result.tier,
    knowledge_model: result.model || null,
  };
}

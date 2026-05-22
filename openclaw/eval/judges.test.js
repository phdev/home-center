import { describe, expect, it } from 'vitest';
import { DETERMINISTIC_JUDGES } from './judges.js';

const validKnowledgeResponse = JSON.stringify({
  type: 'fauna',
  title: 'Ibis',
  summary: 'Ibises are long-legged wading birds found in wetlands around the world.',
  sections: [
    { heading: 'Description', content: 'They have curved bills and slender bodies.' },
  ],
  infographic: {
    type: 'stats',
    items: [{ label: 'Diet', value: 'Insects and small aquatic animals' }],
  },
  imageSourceType: 'known',
  imageQuery: 'ibis bird wetland photograph',
});

const legacyKnowledgeResponse = JSON.stringify({
  type: 'fauna',
  title: 'Ibis',
  summary: 'Ibises are long-legged wading birds found in wetlands around the world.',
  sections: [
    { heading: 'Description', content: 'They have curved bills and slender bodies.' },
  ],
  infographic: null,
  imagePrompt: 'Neutral educational image of an ibis in a wetland.',
});

describe('parseable_knowledge_json judge', () => {
  it('passes a complete knowledge JSON response', () => {
    expect(DETERMINISTIC_JUDGES.parseable_knowledge_json(validKnowledgeResponse)).toBe(true);
  });

  it('passes legacy imagePrompt-only JSON for old result compatibility', () => {
    expect(DETERMINISTIC_JUDGES.parseable_knowledge_json(legacyKnowledgeResponse)).toBe(true);
  });

  it('fails JSON that is missing required keys', () => {
    const missingImagePrompt = JSON.stringify({
      type: 'fauna',
      title: 'Ibis',
      summary: 'A bird.',
      sections: [],
      infographic: null,
    });
    expect(DETERMINISTIC_JUDGES.parseable_knowledge_json(missingImagePrompt)).toBe(false);
  });

  it('fails non-JSON input', () => {
    expect(DETERMINISTIC_JUDGES.parseable_knowledge_json('Ibis are birds, but this is not JSON.')).toBe(false);
  });
});

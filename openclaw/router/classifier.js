// Rule-based router classifier
// Returns: { classification: 'local' | 'escalate', escalation_target: 'sonnet' | 'opus' | null }

const SIMPLE_PATTERNS = [
  /^what\s+time/i,
  /^what's\s+the\s+time/i,
  /^set\s+(a\s+)?timer/i,
  /^(start|stop|cancel|reset)\s+(a\s+)?timer/i,
  /^turn\s+(on|off)/i,
  /^(lights?|lamp)\s+(on|off)/i,
  /^what'?s?\s+the\s+weather/i,
  /^(is\s+it|will\s+it)\s+(going\s+to\s+)?(rain|snow|storm)/i,
  /^how\s+(hot|cold|warm)\s+is\s+it/i,
  /^what'?s?\s+the\s+temperature/i,
  /^good\s+(morning|night|evening)/i,
  /^(hi|hello|hey)\b/i,
  /^thank(s|\s+you)/i,
  /^stop$/i,
  /^go\s+back$/i,
  /^show\s+(calendar|weather|photos)/i,
  /^play\s+music/i,
  /^pause$/i,
  /^next$/i,
  /^volume\s+(up|down)/i,
];

const COMPLEX_SIGNALS = [
  /\bcompare\b/i,
  /\banalyze\b/i,
  /\bschedule\s+around\b/i,
  /\bresolve\b.*\bconflict/i,
  /\bprioritize\b/i,
  /\boptimize\b/i,
  /\bsummarize\s+(this|the)\s+week/i,
  /\bsummarize\b.*\b(all|week|weekly)\b.*\b(school|email|calendar|updates?)\b/i,
  /\bweek('s)?\s+(meal|dinner|lunch)/i,
  /\bmeal\s+plan/i,
  /\bbudget\b/i,
  /\bpros?\s+and\s+cons?\b/i,
  /\breview\s+all\b/i,
  /\bflag\b.*\b(conflicts?|respond|response|anything)\b/i,
  /\bcreate\b.*\bschedule\b/i,
];

const HARD_SIGNALS = [
  /\bsafety\b/i,
  /\bsafe\b/i,
  /\bmedical\b/i,
  /\bmedication\b/i,
  /\bmedicine\b/i,
  /\bemergency\b/i,
  /\blegal\b/i,
  /\blong[\s-]term\s+plan/i,
];

const MULTI_DOMAIN_KEYWORDS = ['calendar', 'email', 'school', 'soccer', 'dinner', 'grocery', 'weather', 'birthday', 'dentist', 'piano', 'schedule'];

function tokenCount(query) {
  return query.trim().split(/\s+/).length;
}

function countDomains(query) {
  const lower = query.toLowerCase();
  return MULTI_DOMAIN_KEYWORDS.filter((kw) => lower.includes(kw)).length;
}

export function classify(query) {
  if (!query || typeof query !== 'string') {
    return { classification: 'local', escalation_target: null };
  }

  const tokens = tokenCount(query);
  const domains = countDomains(query);

  // Opus escalation: safety-critical. Multi-domain planning remains Sonnet.
  if (HARD_SIGNALS.some((p) => p.test(query))) {
    return { classification: 'escalate', escalation_target: 'opus' };
  }

  // Local: short known intents and everyday advice.
  if (tokens <= 15 && SIMPLE_PATTERNS.some((p) => p.test(query))) {
    return { classification: 'local', escalation_target: null };
  }

  // Sonnet escalation: explicit complex signals, multi-domain reasoning, or long prompts.
  if (COMPLEX_SIGNALS.some((p) => p.test(query))) {
    return { classification: 'escalate', escalation_target: 'sonnet' };
  }
  if (domains >= 2) {
    return { classification: 'escalate', escalation_target: 'sonnet' };
  }
  if (tokens > 60) {
    return { classification: 'escalate', escalation_target: 'sonnet' };
  }

  return { classification: 'local', escalation_target: null };
}

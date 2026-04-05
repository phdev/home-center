// Rule-based query complexity classifier
// Returns: 'simple' | 'moderate' | 'complex' | 'hard'

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
  /\bplan\b/i,
  /\bcompare\b/i,
  /\banalyze\b/i,
  /\bschedule\s+around\b/i,
  /\bresolve\b.*\bconflict/i,
  /\bprioritize\b/i,
  /\boptimize\b/i,
  /\bsummarize\s+(this|the)\s+week/i,
  /\bweek('s)?\s+(meal|dinner|lunch)/i,
  /\bmeal\s+plan/i,
  /\bbudget\b/i,
  /\bpros?\s+and\s+cons?\b/i,
];

const HARD_SIGNALS = [
  /\bsafety\b/i,
  /\bmedical\b/i,
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
  if (!query || typeof query !== 'string') return 'simple';

  const tokens = tokenCount(query);
  const domains = countDomains(query);

  // Hard: safety-critical or 3+ domains
  if (HARD_SIGNALS.some((p) => p.test(query))) return 'hard';
  if (domains >= 3) return 'hard';

  // Simple: matches known intent pattern and short
  if (tokens <= 15 && SIMPLE_PATTERNS.some((p) => p.test(query))) return 'simple';

  // Complex: explicit complex signals or multi-domain or long
  if (COMPLEX_SIGNALS.some((p) => p.test(query))) return 'complex';
  if (domains >= 2) return 'complex';
  if (tokens > 60) return 'complex';

  // Moderate: everything else
  if (tokens <= 15) return 'simple';
  return 'moderate';
}

// Model orchestration configuration
// All settings configurable via env vars for portability across machines

const config = {
  tiers: {
    edge: {
      enabled: false,
      host: null,
      model: null,
      description: 'Gemma 4 E2B on room nodes (future)',
    },
    cache: {
      enabled: true,
      dbPath: process.env.CACHE_DB_PATH || './openclaw/cache/semantic.db',
      similarityThreshold: parseFloat(process.env.CACHE_THRESHOLD || '0.92'),
      ttl: {
        weather: 3600,
        calendar: 900,
        timer: 60,
        lights: 300,
        default: 86400,
      },
    },
    local: {
      enabled: process.env.LOCAL_ENABLED !== 'false',
      host: process.env.OLLAMA_HOST || 'http://localhost:11434',
      model: process.env.OLLAMA_MODEL || 'qwen3.5:35b-a3b',
      timeout: parseInt(process.env.OLLAMA_TIMEOUT || '30000', 10),
    },
    groq: {
      enabled: !!process.env.GROQ_API_KEY,
      apiKey: process.env.GROQ_API_KEY || null,
      model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
      baseUrl: 'https://api.groq.com/openai/v1',
    },
    anthropic: {
      enabled: !!process.env.ANTHROPIC_API_KEY,
      apiKey: process.env.ANTHROPIC_API_KEY || null,
      models: {
        sonnet: process.env.ANTHROPIC_SONNET || 'claude-sonnet-4-20250514',
        opus: process.env.ANTHROPIC_OPUS || 'claude-opus-4-20250514',
      },
      baseUrl: 'https://api.anthropic.com',
    },
  },
  logsDir: process.env.LOGS_DIR || './openclaw/logs',
  evalDir: process.env.EVAL_DIR || './openclaw/eval',
  dashboardStatePath: process.env.DASHBOARD_STATE_PATH || './openclaw/logs/dashboard-state.json',
};

export default config;

// Loads eval .env files before router config modules read process.env.

import { existsSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..', '..');
const ENV_FILES = [join(REPO_ROOT, 'openclaw', '.env'), join(REPO_ROOT, '.env')];
const originalEnv = new Set(Object.keys(process.env));

let foundEnvFile = false;

for (const path of ENV_FILES) {
  if (!existsSync(path)) continue;
  foundEnvFile = true;

  try {
    const parsed = dotenv.parse(readFileSync(path));
    for (const [key, value] of Object.entries(parsed)) {
      if (!originalEnv.has(key)) {
        process.env[key] = value;
      }
    }
  } catch (err) {
    console.warn(`Warning: could not parse ${path}: ${err.message}`);
  }
}

if (!foundEnvFile && !process.env.ANTHROPIC_API_KEY) {
  console.warn(
    'No ANTHROPIC_API_KEY found in env or .env files; LLM judge will be unavailable, deterministic judges only.'
  );
}

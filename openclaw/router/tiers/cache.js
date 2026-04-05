// Semantic cache tier using SQLite + cosine similarity
// Requires: better-sqlite3 (for DB), a local embedding approach
// For now, uses simple keyword hashing as embedding stand-in
// TODO: integrate all-MiniLM-L6-v2 via onnxruntime-node when ready

import Database from 'better-sqlite3';
import { existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import config from '../config.js';

let db = null;

function getDb() {
  if (db) return db;
  const dbPath = config.tiers.cache.dbPath;
  const dir = dirname(dbPath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS cache (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      query_norm TEXT NOT NULL,
      query_original TEXT NOT NULL,
      response TEXT NOT NULL,
      category TEXT DEFAULT 'default',
      created_at TEXT NOT NULL,
      ttl_seconds INTEGER NOT NULL
    )
  `);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_cache_norm ON cache(query_norm)`);
  return db;
}

function normalizeQuery(query) {
  return query
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function detectCategory(query) {
  const q = query.toLowerCase();
  if (/weather|rain|temperature|forecast|hot|cold|warm|snow|storm/.test(q)) return 'weather';
  if (/calendar|schedule|appointment|meeting|event/.test(q)) return 'calendar';
  if (/timer|alarm|countdown/.test(q)) return 'timer';
  if (/light|lamp|switch/.test(q)) return 'lights';
  return 'default';
}

// Simple similarity: normalized exact match + keyword overlap
// This is intentionally basic — upgrade to MiniLM embeddings later
function similarity(a, b) {
  if (a === b) return 1.0;
  const wordsA = new Set(a.split(' '));
  const wordsB = new Set(b.split(' '));
  const intersection = [...wordsA].filter((w) => wordsB.has(w)).length;
  const union = new Set([...wordsA, ...wordsB]).size;
  return union > 0 ? intersection / union : 0;
}

export async function lookup(query) {
  if (!config.tiers.cache.enabled) return null;
  const database = getDb();
  const norm = normalizeQuery(query);
  const category = detectCategory(query);
  const ttl = config.tiers.cache.ttl[category] || config.tiers.cache.ttl.default;

  // Check for exact or near-exact match
  const rows = database
    .prepare(
      `SELECT * FROM cache
       WHERE category = ?
       AND datetime(created_at, '+' || ttl_seconds || ' seconds') > datetime('now')
       ORDER BY created_at DESC
       LIMIT 50`
    )
    .all(category);

  for (const row of rows) {
    const sim = similarity(norm, row.query_norm);
    if (sim >= config.tiers.cache.similarityThreshold) {
      return {
        response: row.response,
        cache_hit: true,
        similarity: sim,
        cached_query: row.query_original,
      };
    }
  }
  return null;
}

export async function store(query, response) {
  if (!config.tiers.cache.enabled) return;
  const database = getDb();
  const norm = normalizeQuery(query);
  const category = detectCategory(query);
  const ttl = config.tiers.cache.ttl[category] || config.tiers.cache.ttl.default;

  database
    .prepare(
      `INSERT INTO cache (query_norm, query_original, response, category, created_at, ttl_seconds)
       VALUES (?, ?, ?, ?, datetime('now'), ?)`
    )
    .run(norm, query, typeof response === 'string' ? response : JSON.stringify(response), category, ttl);
}

export function close() {
  if (db) {
    db.close();
    db = null;
  }
}

export function entryCount() {
  if (!config.tiers.cache.enabled) return 0;
  const database = getDb();
  return database.prepare('SELECT COUNT(*) as count FROM cache').get().count;
}

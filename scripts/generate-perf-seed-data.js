#!/usr/bin/env node

// Generates seed performance data (wake word + tasks) for the GitHub Pages dashboard
// Run after generate-seed-data.js
// Output: docs/dashboard/data/wake-metrics.json and docs/dashboard/data/task-metrics.json

import { writeFileSync, mkdirSync, existsSync } from 'fs';

const DATA_DIR = './docs/dashboard/data';
if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Generate 30 days of wake word metrics
const today = new Date('2026-04-05');
const wakeHistory = [];

for (let i = 29; i >= 0; i--) {
  const date = new Date(today);
  date.setDate(date.getDate() - i);
  const dateStr = date.toISOString().slice(0, 10);
  const isWeekend = date.getDay() === 0 || date.getDay() === 6;

  const detections = isWeekend ? randInt(15, 40) : randInt(8, 25);
  const commands = Math.floor(detections * (0.6 + Math.random() * 0.3));
  const falsePositives = randInt(0, 3);
  const avgScore = 0.7 + Math.random() * 0.25;

  const hourly = Array(24).fill(0);
  for (let d = 0; d < detections; d++) {
    const activeHours = isWeekend
      ? [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21]
      : [6, 7, 8, 12, 13, 17, 18, 19, 20, 21];
    hourly[pick(activeHours)]++;
  }

  const commandTypes = {};
  const cmdNames = ['navigate', 'set_timer', 'ask', 'turn_off', 'turn_on', 'stop', 'show'];
  for (let c = 0; c < commands; c++) {
    const cmd = pick(cmdNames);
    commandTypes[cmd] = (commandTypes[cmd] || 0) + 1;
  }

  wakeHistory.push({
    date: dateStr,
    detections,
    commands,
    falsePositives,
    avgDnnScore: Math.round(avgScore * 1000) / 1000,
    highConfidenceRate: Math.round((0.7 + Math.random() * 0.25) * 100),
    avgRmsEnergy: randInt(150, 350),
    hourlyDetections: hourly,
    commandTypes,
  });
}

writeFileSync(`${DATA_DIR}/wake-metrics.json`, JSON.stringify(wakeHistory, null, 2));
console.log('Generated wake-metrics.json');

// Generate task metrics
const taskHistory = [];
const sources = ['openclaw', 'voice', 'dashboard', 'whatsapp', 'homerci'];

for (let i = 29; i >= 0; i--) {
  const date = new Date(today);
  date.setDate(date.getDate() - i);
  const dateStr = date.toISOString().slice(0, 10);

  const created = randInt(2, 10);
  const completed = Math.min(created, randInt(1, created));
  const active = created - completed;

  const srcBreakdown = {};
  for (let s = 0; s < created; s++) {
    const src = pick(sources);
    srcBreakdown[src] = (srcBreakdown[src] || 0) + 1;
  }

  const avgCompletionMin = 5 + Math.random() * 55;

  const timerCount = randInt(3, 15);
  const voiceTimers = Math.floor(timerCount * (0.3 + Math.random() * 0.4));
  const dashTimers = timerCount - voiceTimers;

  const llmQueries = randInt(5, 25);
  const queryTypes = {};
  const types = ['location', 'person', 'concept', 'event', 'general'];
  for (let q = 0; q < llmQueries; q++) {
    const t = pick(types);
    queryTypes[t] = (queryTypes[t] || 0) + 1;
  }

  taskHistory.push({
    date: dateStr,
    ocCreated: created,
    ocCompleted: completed,
    ocActive: active,
    ocSources: srcBreakdown,
    ocAvgCompletionMin: Math.round(avgCompletionMin * 10) / 10,
    timers: timerCount,
    voiceTimers,
    dashTimers,
    llmQueries,
    llmQueryTypes: queryTypes,
  });
}

writeFileSync(`${DATA_DIR}/task-metrics.json`, JSON.stringify(taskHistory, null, 2));
console.log('Generated task-metrics.json');

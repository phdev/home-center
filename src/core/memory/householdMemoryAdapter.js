import { applyMemoryUpdate } from "./applyMemoryUpdate.js";
import { loadHouseholdMemory } from "./loadHouseholdMemory.js";
import { getMemorySource, queryHouseholdMemory } from "./queryHouseholdMemory.js";
import { createMemoryItem } from "./schema.js";

export function parseHouseholdMemoryCommand(input) {
  const text = normalizeInput(input);
  if (!text) return null;

  const remember = text.match(/^(?:howie[:,]?\s*)?(?:please\s+)?remember(?:\s+that)?\s+(.+)$/i);
  if (remember) {
    return { action: "remember", claim: cleanSentence(remember[1]) };
  }

  const forget = text.match(/^(?:howie[:,]?\s*)?(?:please\s+)?forget(?:\s+that)?\s+(.+)$/i);
  if (forget) {
    return { action: "forget", text: cleanSentence(forget[1]) };
  }

  const correct = text.match(
    /^(?:howie[:,]?\s*)?(?:please\s+)?correct(?:\s+that)?\s+(.+?)\s+(?:to|with|=>|->)\s+(.+)$/i,
  );
  if (correct) {
    return {
      action: "correct",
      text: cleanSentence(correct[1]),
      replacementClaim: cleanSentence(correct[2]),
    };
  }

  const recall = text.match(/^(?:howie[:,]?\s*)?(?:please\s+)?what do you remember about\s+(.+?)\??$/i);
  if (recall) {
    return { action: "recall", text: cleanSentence(recall[1]) };
  }

  const source = text.match(/^(?:howie[:,]?\s*)?(?:please\s+)?where did you learn(?:\s+(?:that|this))?(?:\s+about\s+(.+?))?\??$/i);
  if (source) {
    return { action: "source", text: source[1] ? cleanSentence(source[1]) : "" };
  }

  return null;
}

export function handleHouseholdMemoryCommand(input, context = {}, options = {}) {
  const command = typeof input === "string" ? parseHouseholdMemoryCommand(input) : input;
  if (!command) return { handled: false };

  const now = options.now || new Date().toISOString();
  const rootDir = options.rootDir;
  const source = context.source || {
    kind: "user_request",
    ref: context.ref || "household-memory-adapter",
    captured_at: now,
  };

  switch (command.action) {
    case "remember":
      return remember(command, source, { rootDir, now });
    case "correct":
      return correct(command, source, { rootDir, now });
    case "forget":
      return forget(command, source, { rootDir, now });
    case "recall":
      return recall(command, { rootDir });
    case "source":
      return explainSource(command, context, { rootDir });
    default:
      return { handled: false };
  }
}

function remember(command, source, options) {
  if (!command.claim) {
    return { handled: true, action: "remember", status: "needs_clarification", message: "What should I remember?" };
  }

  const category = command.category || guessCategory(command.claim);
  const subject = command.subject || guessSubject(command.claim);
  const type = command.type || defaultTypeForCategory(category);
  const item = createMemoryItem({
    id: command.id || uniqueMemoryId(category, subject, options),
    type,
    subject,
    claim: command.claim,
    source,
    confidence: command.confidence || "user_confirmed",
    created_at: options.now,
    updated_at: options.now,
    valid_from: options.now,
    allowed_uses: command.allowed_uses || ["conversation", "suggestion", "explanation"],
  });

  const result = applyMemoryUpdate({ action: "remember", category, item }, options);
  return {
    handled: true,
    action: "remember",
    status: "ok",
    item: result.item,
    category: result.category,
    message: `Remembered: ${result.item.claim || result.item.subject}`,
  };
}

function correct(command, source, options) {
  const match = findSingleMemoryMatch(command, options);
  if (match.status !== "ok") return { handled: true, action: "correct", ...match };

  const replacementClaim = command.replacementClaim;
  if (!replacementClaim) {
    return { handled: true, action: "correct", status: "needs_clarification", message: "What should replace it?" };
  }

  const replacement = createMemoryItem({
    ...stripRuntimeFields(match.item),
    id: command.replacementId || uniqueMemoryId(match.category, guessSubject(replacementClaim), options),
    subject: command.subject || guessSubject(replacementClaim),
    claim: replacementClaim,
    source,
    confidence: command.confidence || "user_confirmed",
    created_at: options.now,
    updated_at: options.now,
    valid_from: options.now,
    valid_until: null,
    status: "active",
  });

  const result = applyMemoryUpdate(
    {
      action: "correct",
      itemId: match.item.id,
      reason: command.reason || "User corrected household memory.",
      replacement,
    },
    options,
  );

  return {
    handled: true,
    action: "correct",
    status: "ok",
    oldItem: result.oldItem,
    item: result.replacement,
    category: result.category,
    message: `Corrected: ${result.replacement.claim || result.replacement.subject}`,
  };
}

function forget(command, source, options) {
  const match = findSingleMemoryMatch(command, options);
  if (match.status !== "ok") return { handled: true, action: "forget", ...match };

  const result = applyMemoryUpdate(
    {
      action: "forget",
      itemId: match.item.id,
      reason: command.reason || "User asked Howie to forget this.",
      source,
    },
    options,
  );

  return {
    handled: true,
    action: "forget",
    status: "ok",
    item: result.item,
    category: result.category,
    message: `Forgot: ${result.item.claim || result.item.subject}`,
  };
}

function recall(command, options) {
  const memory = loadHouseholdMemory(options);
  const items = queryHouseholdMemory(memory, {
    category: command.category,
    subject: command.subject,
    type: command.type,
    text: command.text,
  });
  return {
    handled: true,
    action: "recall",
    status: "ok",
    items,
    message: items.length
      ? items.map((item) => item.claim || `${item.subject}: ${JSON.stringify(item.value)}`).join("\n")
      : "I do not have household memory matching that yet.",
  };
}

function explainSource(command, context, options) {
  const memory = loadHouseholdMemory(options);
  let itemId = command.itemId || context.lastMemoryItemId;
  let item = null;

  if (!itemId && command.text) {
    const match = findSingleMemoryMatch(command, options);
    if (match.status !== "ok") return { handled: true, action: "source", ...match };
    itemId = match.item.id;
    item = match.item;
  }

  if (!itemId) {
    return {
      handled: true,
      action: "source",
      status: "needs_context",
      message: "Which memory item should I trace?",
    };
  }

  const source = getMemorySource(memory, itemId);
  if (!source) {
    return { handled: true, action: "source", status: "not_found", message: "I could not find a source for that." };
  }
  item ||= queryHouseholdMemory(memory, { includeInactive: true }).find((candidate) => candidate.id === itemId) || null;

  return {
    handled: true,
    action: "source",
    status: "ok",
    item,
    source,
    message: `I learned that from ${source.kind} (${source.ref}) on ${source.captured_at}.`,
  };
}

function findSingleMemoryMatch(command, options) {
  const memory = loadHouseholdMemory(options);
  const matches = command.itemId
    ? queryHouseholdMemory(memory, { includeInactive: command.includeInactive }).filter((item) => item.id === command.itemId)
    : queryHouseholdMemory(memory, {
        category: command.category,
        subject: command.subject,
        type: command.type,
        text: command.text,
        includeInactive: command.includeInactive,
      });

  if (matches.length === 0) {
    return { status: "not_found", message: "I could not find a matching household memory item." };
  }
  if (matches.length > 1) {
    return {
      status: "ambiguous",
      matches,
      message: "I found more than one matching household memory item.",
    };
  }
  return { status: "ok", item: matches[0], category: matches[0].category };
}

function uniqueMemoryId(category, subject, options) {
  const memory = loadHouseholdMemory({ rootDir: options.rootDir });
  const base = `hm_${category}_${slugify(subject || "item")}`;
  const existing = new Set(queryHouseholdMemory(memory, { includeInactive: true }).map((item) => item.id));
  if (!existing.has(base)) return base;
  for (let index = 2; index < 1000; index += 1) {
    const candidate = `${base}_${index}`;
    if (!existing.has(candidate)) return candidate;
  }
  throw new Error(`could not allocate unique household memory id for ${base}`);
}

function guessCategory(claim) {
  const text = claim.toLowerCase();
  if (/\b(likes|dislikes|prefers|favorite|favourite|hates|loves)\b/.test(text)) return "preferences";
  if (/\b(school|teacher|class|grade|pta|parentsquare|jefferson|rbusd|homework|campus)\b/.test(text)) return "school";
  if (/\b(routine|every|usually|bedtime|morning|after school|dinner|pickup|drop[- ]?off)\b/.test(text)) return "routines";
  if (/\b(address|near|at|park|restaurant|store|library|pool|beach)\b/.test(text)) return "places";
  if (/\b(age|birthday|pronouns|allerg|doctor|dentist)\b/.test(text)) return "people";
  return "facts";
}

function defaultTypeForCategory(category) {
  return {
    people: "person",
    routines: "routine",
    preferences: "preference",
    places: "place",
    school: "school",
    facts: "fact",
  }[category] || "fact";
}

function guessSubject(claim) {
  const text = cleanSentence(claim);
  const split = text.match(/^(.+?)\s+(?:is|are|has|have|likes|dislikes|prefers|loves|hates|goes|needs|starts|ends)\b/i);
  if (split?.[1]) return stripLeadingThat(split[1]);
  const firstWords = text.split(/\s+/).slice(0, 4).join(" ");
  return stripLeadingThat(firstWords || "Household");
}

function stripRuntimeFields(item) {
  const { category: _category, ...rest } = item;
  return rest;
}

function cleanSentence(value) {
  return String(value || "")
    .trim()
    .replace(/^["']|["']$/g, "")
    .replace(/\s+/g, " ")
    .replace(/[?.!]+$/g, "");
}

function stripLeadingThat(value) {
  return String(value || "").replace(/^that\s+/i, "").trim() || "Household";
}

function normalizeInput(input) {
  return String(input || "").trim().replace(/\s+/g, " ");
}

function slugify(value) {
  return String(value || "item")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48) || "item";
}

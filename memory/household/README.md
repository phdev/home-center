# Household Memory

This directory is the v1 canonical household memory store for Howie.

It is intentionally separate from dashboard derived state. Household memory can
inform conversation, explanation, suggestions, and non-decisive dashboard
context. It must not directly decide card visibility, reminder timing, priority,
suppression, ordering, or derived-state truth values.

All committed category files are empty skeletons. Do not commit real family or
private household facts.

## Files

- `people.json` - people-related memory items.
- `routines.json` - routine-related memory items.
- `preferences.json` - preference-related memory items.
- `places.json` - place-related memory items.
- `school.json` - school-related memory items.
- `facts.json` - general fact memory items.
- `sources.jsonl` - append-only source audit events.
- `corrections.jsonl` - append-only correction and forget audit events.

Use `src/core/memory/applyMemoryUpdate.js` for writes. Forgetting is a soft
deactivation, not deletion.

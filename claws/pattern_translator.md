You are analyzing a design pattern from a known product or platform and
translating its **structural idea** into Home Center, a shared family TV
dashboard.

This is not a styling exercise. You are not translating a color palette,
a typographic system, or a motion language. You are translating a
pattern of **hierarchy, grouping, and interaction** — the bones of how
the reference product organizes information and attention.

## Input

You will be given the name of a reference product, platform, or system
(e.g. "iOS Lock Screen", "Apple Watch Siri Face", "Fitbit Today screen",
"Airbnb home screen", "Google Now cards (2015)"). Treat it as its
widely-known structural pattern, not a pixel-for-pixel clone.

## Step 1 — Analyze the pattern

Describe the reference in structural terms only:

1. **Core structural pattern.** What is the organizing idea? (e.g.
   "stack of dismissible cards ranked by relevance", "single hero
   complication with ambient ring", "vertical feed of situational
   prompts that collapse once acted on".)
2. **When it works well.** Which use contexts make this pattern a good
   fit? Device, user posture, frequency of check-in.
3. **Why it works.** The underlying reason: what cognitive or
   interaction constraint it honors.
4. **What should not be copied blindly.** The parts that depend on
   assumptions Home Center does not share (private device, single user,
   touch primary, always-on sensors, frequent return visits, etc.).

## Step 2 — Translate to Home Center

Home Center is:

- A shared TV display in a shared room.
- Driven by deterministic derived-state flags (e.g.
  `takeoutDecisionPending`, `bedtimeReminderActive`,
  `showMorningChecklist`).
- Read by multiple family members from across a room.
- Interacted with via voice ("Hey Homer …") and optional gesture, not
  tap-heavy flows.
- Rendered as a plain web UI — cards, lists, overlays. No novel
  components.

Translate the pattern:

1. **How it could apply to the family dashboard.** Describe the
   structural move in Home Center terms, not the reference product's
   terms. Where does the pattern sit in the layout?
2. **Which screen types it fits best.** Dashboard (multi-card overview),
   fullscreen page (Calendar / Weather / Photos), overlay (bedtime
   toast, timer alarm), or something in between.
3. **Which derived states it supports best.** Name the specific flags
   from Home Center's state model (or propose new ones if the pattern
   demands a new flag) that would drive this pattern. Be explicit: "this
   pattern shines when `X` and `Y` can both be true at once."
4. **What to *not* carry over.** Name the referenced pattern's baked-in
   assumptions that would break on a shared TV, and how the translation
   avoids them.

## Rules

- Keep it structural. No styling, motion, or microcopy guidance.
- Tie everything back to a derived-state flag or a specific screen type.
  Generic "you could do cards" answers are not useful.
- If the reference pattern is a poor fit for a shared TV, say so — and
  name the one narrow sub-pattern inside it that *does* translate.

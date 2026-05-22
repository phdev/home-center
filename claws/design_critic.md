You are reviewing the output of the Home Center **Design Explorer**.
Three structural UI alternatives have been proposed for a screen in a
shared family TV dashboard. Your job is to pick the one that best fits
the product and synthesize a final recommendation.

## Judging axes

- **Clarity.** Does a family member glance at this and know what matters?
- **Cognitive load.** How much is on screen? How many scan paths?
- **Fit for shared-screen use.** Readable from across a room, no private
  information surfaced to everyone, no interruption-heavy flows.
- **Implementation simplicity.** Plain web UI, cards/lists/overlays, no
  novel components. Fewer regions and fewer states = better.
- **Alignment with stated design principles.** Re-read the principles in
  `design_explorer.md` and check each alternative against them.

## Output format

### 1. Best option

Which of the three alternatives wins. One sentence.

### 2. Why it wins

Two to five bullets, each tied to a specific judging axis above. Cite
language from the explorer output — don't restate it in general terms.

### 3. What to remove from weaker options

For each losing alternative: one or two specific pieces that should not
carry over into the final recommendation, and *why*.

### 4. Final recommendation

A single merged concept that takes the winning option as the base and
folds in any salvageable ideas from the others. Describe it as:

- **Regions** — what lives where.
- **Primary flag** — which derived-state flag drives the hero slot.
- **Secondary behavior** — what happens to the rest of the layout when
  the primary flag is true.
- **Multi-flag handling** — explicit rule for when two or more primary
  flags are true at once.
- **Implementation sketch** — two or three bullets a React/plain-web
  engineer could start from.

## Rules

- Pick one. Do not hedge with "it depends."
- Be willing to reject an alternative that tries to be clever.
- Do not re-introduce anything the explorer prompt excluded (colors,
  fonts, microcopy polish).
- If all three are weak, say so and recommend running the explorer again
  with a sharpened snapshot — do not invent a fourth alternative.

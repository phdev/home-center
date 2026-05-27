# Knowledge Page Design Principles

The corrected Apollo 11, Emperor Penguin, and Internet pages are the reference
designs for `editorial-knowledge-v1`. New arbitrary knowledge queries should
reuse these principles through visual-plan data and named module variants rather
than inventing one-off layouts.

## Core Contract

- `panelStyle`: `transparent-liquid-glass`
  Supporting panels and hero panels should share the same glass vocabulary:
  restrained background opacity, thin borders, strong blur, and no opaque card
  blocks inside sections.
- `heroTransparency`: `match-supporting-panels`
  Hero containers should not read heavier than the surrounding modules.
- `mapLabelPlacement`: `external-callouts`
  Dense maps should keep geography clear. For the Apollo-style Places module,
  point-of-interest labels sit beside the map, not over the SVG geography.
- `solarMapForSpaceLocations`: `on-the-map-solar-system`
  For place/location queries whose subject is in the solar system, the On The
  Map section should use a solar-system map instead of an Earth geography map.
  Keep it as low-noise teal-green line art with orbital context, a clear
  subject marker, and external callouts so planets, dwarf planets, moons, or
  belts stay legible at kiosk distance.
- `timelineConnectorStyle`: `segmented-between-icons`
  Horizontal timelines use individual connectors between adjacent icons. Lines
  must not run behind or protrude into the circular icon nodes.
- `ornamentStyle`: `topic-specific-line-art`
  Result ornaments can vary by topic, but they should stay in the same line-art,
  low-noise, accent-tinted family as the rest of the dashboard.
- `relatedChipScale`: `compact-secondary-nav`
  Related topic pills are compact secondary navigation, not primary actions.
- `conceptHeroTreatment`: `layered-native-or-pinned-hero`
  Concept pages should feel explanatory, not like generic stock art. Use a
  native layered diagram hero by default, or a pinned/generated hero only when it
  clearly explains the concept and preserves the left-side text safe zone.
- `conceptModuleOrder`: `process-then-glance`
  Concept pages lead supporting content with a How It Works/process module and
  reserve the lower module for compact At A Glance ideas.
- `conceptInsightOrnament`: `accent-line-art-secondary`
  Concept insight art should be a secondary accent that reinforces the idea
  without replacing the hero, crowding copy, or changing the accepted accent.

## Query-Type Composition

Each query type maps into a narrow set of known modules. This keeps arbitrary
queries from producing arbitrary layouts.

| Query type | Hero | Middle module | Lower module |
| --- | --- | --- | --- |
| `event` | `archival-event-scene` | `us-places-map` or `world-map-pin` | `horizontal-mission-timeline` or `icon-metric-columns` |
| `fauna` | `species-closeup-with-environment` | `habitat-range` | `lifecycle-loop` or `icon-metric-columns` |
| `location` | `scenic-location` | `world-map-pin`, `map-geography`, or `solar-system-map` | `island-shape-stats` or `icon-metric-columns` |
| `person` | `portrait-editorial` | `vertical-timeline` | `icon-metric-columns` |
| `flora` | `scenic-location` or `species-closeup-with-environment` | `range-glass` | `height-comparison` or `icon-metric-columns` |
| `concept` | `native-concept-hero` or `fallback-graphic` | `process-flow` | `icon-metric-columns` |

## Concept Pages

The Internet is the Concept-page reference. Concept pages should read as a
working explanation: the hero establishes the abstract system, the middle module
shows the mechanism, and the lower module gives three scannable handles.

- Keep hero copy short. The first hero sentence carries the answer; additional
  explanation belongs in the Key Idea and How It Works sections.
- Use a diagram-like hero treatment for abstract systems. For network concepts,
  prefer layered paths, nodes, and depth cues over decorative orbit art; pin the
  accepted hero locally before treating screenshots or Pi deployment as final.
- The middle module is `How It Works` / `process-flow`. Use concrete steps with
  consistent icons and short verbs so the mechanism is legible at kiosk distance.
- The lower module is `At A Glance` / `icon-metric-columns`. It should summarize
  exactly three conceptual handles, not repeat the process steps.
- Keep icon hue and related chips aligned to the Concept accent. Do not leave
  older cyan/green/purple mismatches between process icons, glance icons, and
  the bottom navigation.
- Key Idea art is supporting line art. It can echo a known symbol for the
  concept, but it must stay accent-tinted, secondary to the text, and visually
  separate from the hero.

## People Pages

Ada Lovelace is the People-page reference. People pages should read as a
biographical profile first, with a recognizable portrait hero anchoring the
page and supporting modules explaining why the person matters.

- Keep the portrait hero. Do not replace the hero with the Legacy illustration,
  manuscript art, or another supporting graphic. The hero should use
  `portrait-editorial` with text on the safe side and the subject image visible
  on the opposite side.
- Use the standalone Legacy panel for modern relevance. Its copy should be
  concise but complete, with no visual truncation or ellipsis in the accepted
  1280x720 kiosk layout.
- Treat Legacy art as an accent, not the subject. The feather/manuscript graphic
  belongs in the Legacy panel, right-weighted and secondary to the text; it must
  not crowd the copy or become the main visual identity of the page.
- Facts should stay biographical and scannable: born date first, then known-for
  or the strongest identity fact. Avoid overfilling the facts card with
  secondary details that belong in the timeline or glance modules.
- The timeline should explain the arc: birth/place, major contribution, then a
  final `Legacy` item describing lasting influence. Do not force a death date
  into the final slot when the better user-facing answer is impact.
- At A Glance should summarize exactly three contribution concepts with icons.
  These are conceptual handles, not trivia or duplicate timeline entries.

## Flora Pages

Coast Redwood is the Flora-page reference. Flora pages should read as living
systems in place: a plant specimen or forest environment anchored by a hero,
then supporting modules that explain range, scale, growth, and ecological role.

- Keep the scenic/species hero. Do not replace the hero with the Ecosystem Role
  ornament, leaf art, or another supporting graphic. For tree-scale subjects,
  prefer `scenic-location` with `tall-subject-forest-depth`; for smaller plants,
  use `species-closeup-with-environment`.
- Treat supporting plant art as secondary line art. Ecosystem ornaments should
  stay in the topic-specific accent family, preserve their source proportions,
  and sit behind or beside text without crowding it.
- Use the Flora accent consistently across non-white UI text, icon art, bottom
  labels, and related chips. Do not leave older green tab accents on Flora pages
  when the accepted design uses the yellow/orange Flora accent.
- Facts should lead with species identity and the strongest scale fact. Range,
  climate niche, and ecology details belong in the map/glance/insight modules
  unless they are the most important scannable fact.
- The middle module should explain range or habitat using `range-glass`; keep map
  labels clear and avoid overloading the hero with map information.
- The lower module should make plant scale and growth legible through
  `height-comparison` or compact icon metrics, not a generic lifecycle diagram
  unless lifecycle is the actual subject of the query.

## Golden References

- Apollo 11 validates the event contract: archival hero, blue Places map with
  external callouts, compact related chips, segmented mission timeline, and a
  line-art globe result ornament.
- Emperor Penguin validates the fauna contract: closeup/environment hero,
  habitat range module, lifecycle-style glance module, and species-specific
  environmental ornamentation.
- Ada Lovelace validates the person contract: key facts prioritize born date
  and known-for, the vertical timeline starts with born date/place, contribution
  detail expands in the middle, the final item is labeled Legacy instead of a
  year, the standalone Legacy section explains practical modern relevance, and
  At A Glance presents three icon-led contribution concepts.
- Coast Redwood validates the flora contract: scenic forest hero stays primary,
  facts emphasize species and exceptional height, the middle range module keeps
  habitat separate from the hero, the Ecosystem Role ornament is accent-tinted
  supporting line art, related chips and bottom label use the Flora accent, and
  accepted remote hero imagery should be pinned locally before screenshots or Pi
  deployment are treated as final.
- The Internet validates the concept contract: concise hero copy, pinned
  layered network hero, How It Works as the middle process module, At A Glance as
  the lower conceptual-summary module, matching Concept accent hue across icons
  and chips, and secondary WWW line art in the Key Idea panel.

## Implementation Hooks

- Worker responses include `visualPlan.designPrinciples` and
  `visualPlan.typeCompositionContract`.
- The frontend normalizer preserves those fields and falls back to the same
  contract when older responses omit them.
- `scripts/check-knowledge-reference-fidelity.mjs` treats Apollo and Emperor
  Penguin as golden references and validates that all supported query types stay
  inside their allowed module contract.

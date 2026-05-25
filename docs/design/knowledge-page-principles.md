# Knowledge Page Design Principles

The corrected Apollo 11 and Emperor Penguin pages are the reference designs for
`editorial-knowledge-v1`. New arbitrary knowledge queries should reuse these
principles through visual-plan data and named module variants rather than
inventing one-off layouts.

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
- `timelineConnectorStyle`: `segmented-between-icons`
  Horizontal timelines use individual connectors between adjacent icons. Lines
  must not run behind or protrude into the circular icon nodes.
- `ornamentStyle`: `topic-specific-line-art`
  Result ornaments can vary by topic, but they should stay in the same line-art,
  low-noise, accent-tinted family as the rest of the dashboard.
- `relatedChipScale`: `compact-secondary-nav`
  Related topic pills are compact secondary navigation, not primary actions.

## Query-Type Composition

Each query type maps into a narrow set of known modules. This keeps arbitrary
queries from producing arbitrary layouts.

| Query type | Hero | Middle module | Lower module |
| --- | --- | --- | --- |
| `event` | `archival-event-scene` | `us-places-map` or `world-map-pin` | `horizontal-mission-timeline` or `icon-metric-columns` |
| `fauna` | `species-closeup-with-environment` | `habitat-range` | `lifecycle-loop` or `icon-metric-columns` |
| `location` | `scenic-location` | `world-map-pin` or `map-geography` | `island-shape-stats` or `icon-metric-columns` |
| `person` | `portrait-editorial` | `vertical-timeline` | `icon-metric-columns` |
| `flora` | `scenic-location` or `species-closeup-with-environment` | `range-glass` | `height-comparison` or `icon-metric-columns` |
| `concept` | `native-concept-hero` or `fallback-graphic` | `process-flow` | `icon-metric-columns` |

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

## Implementation Hooks

- Worker responses include `visualPlan.designPrinciples` and
  `visualPlan.typeCompositionContract`.
- The frontend normalizer preserves those fields and falls back to the same
  contract when older responses omit them.
- `scripts/check-knowledge-reference-fidelity.mjs` treats Apollo and Emperor
  Penguin as golden references and validates that all supported query types stay
  inside their allowed module contract.

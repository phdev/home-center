## Summary



## Gbrain checklist

Home Center's source of truth lives in [`docs/`](../docs/README.md). Please
confirm you've considered each of these — tick what applies, strike through
what doesn't:

- [ ] I read the relevant doc(s) in `docs/` before making this change
- [ ] UI visibility logic lives in `src/state/deriveState.js`, not in
      components (any new flag? add it to `docs/home_center_derived_states.md`)
- [ ] Card visibility reads only from `DerivedState` (any new card?
      add a contract in `docs/home_center_ui_card_contracts.md`)
- [ ] OpenClaw is enhancement-only — cards render without it
- [ ] Worker-vs-localStorage routing stays in `src/data/_storage.js` or an
      adapter wrapper; components are source-agnostic
- [ ] If I changed an invariant, rule, or pattern, I logged it in
      `docs/home_center_decisions_log.md`
- [ ] `npm test` and `npm run build` pass locally

## Test plan

- [ ]

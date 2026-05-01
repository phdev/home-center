# AgentCI Gate Report

Status: PASS
Fixture: agentci/fixtures/school-updates-digest-with-agent.json
Run: school-updates-digest-with-agent-20260501T190000000Z
Scenario: school-updates-digest-with-agent

## Assertions
- PASS derivedState.hasSchoolActionItems remains true
- PASS derivedState.hasUrgentSchoolItem remains true
- PASS derivedState.needsSchoolActionToday remains true
- PASS expected card school-updates exists
- PASS card school-updates priority remains urgent
- PASS card school-updates has reason.triggeredBy
- PASS card school-updates reason.triggeredBy keys exist on derivedState
- PASS card school-updates has reason.suppressedBy
- PASS card school-updates has reason.priorityReason
- PASS replay matches original snapshot
- PASS run matches stored golden snapshot
- PASS AgentRuns include required schema fields
- PASS AgentRun IDs are unique
- PASS AgentRun cardIds match selected cards or are null
- PASS AgentRuns do not affect deterministic decisions
- PASS agent output is optional for deterministic replay
- PASS agent output does not modify derivedState
- PASS agent output does not introduce cards
- PASS agent output does not change priority or visibility

## Forbidden API Calls
None

## Forbidden Source References
None

## Golden Diff
No differences.

## Replay Diff
No differences.

## Gate Diff
{
  "agentChanges": {
    "added": [],
    "byCardId": [],
    "modified": [],
    "removed": []
  },
  "cardChanges": {
    "added": [],
    "modified": [],
    "removed": []
  },
  "stateChanges": []
}


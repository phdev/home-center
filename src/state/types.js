/**
 * Canonical types for Home Center state.
 *
 * Raw data adapters in src/data/* produce these shapes.
 * Derived state (src/state/deriveState.js) consumes them and emits DerivedState.
 * Cards (src/cards/*) consume DerivedState only — never raw.
 *
 * Defined as JSDoc typedefs so the project stays plain JS while editors still
 * surface completion + checks.
 */

// ─── Raw inputs ──────────────────────────────────────────────────────────

/**
 * @typedef {Object} CalendarEvent
 * @property {string} id
 * @property {string} title
 * @property {string} start           ISO string
 * @property {string} end             ISO string
 * @property {boolean} allDay
 * @property {string[]} attendees     email addresses
 * @property {string} [calendarOwner] e.g. "peter@…" | "howell-family"
 * @property {'accepted'|'declined'|'tentative'|'unknown'} [status]
 */

/**
 * @typedef {Object} Birthday
 * @property {string} id
 * @property {string} name
 * @property {string} [relation]
 * @property {string} date          'MM-DD'
 * @property {'ready'|'ordered'|'needed'|'unknown'} giftStatus
 * @property {string} [giftNotes]
 */

/**
 * @typedef {Object} BedtimeSetting
 * @property {string} childId
 * @property {string} childName
 * @property {string} weekday       'HH:mm'
 * @property {string} weekend       'HH:mm'
 * @property {number} reminderLeadMin
 */

/**
 * @typedef {Object} ChecklistItem
 * @property {string} id
 * @property {string} label
 * @property {'always'|'cold'|'hot'|'rain'} condition
 */

/**
 * @typedef {Object} ChecklistConfig
 * @property {ChecklistItem[]} items
 */

/**
 * @typedef {Object} WeatherToday
 * @property {number} highTempF
 * @property {number} lowTempF
 * @property {number} precipProb    0..1
 * @property {string} summary
 */

/**
 * @typedef {Object} TakeoutDecision
 * @property {string} date                          'YYYY-MM-DD'
 * @property {'takeout'|'home'|null} decision
 * @property {string} [vendor]
 * @property {string} [decidedAt]                   ISO
 * @property {string} [decidedBy]
 */

/**
 * @typedef {Object} LunchDecision
 * @property {string} date
 * @property {Object.<string, 'school'|'home'|null>} perChild
 */

/**
 * @typedef {Object} SchoolMenuDay
 * @property {string} date
 * @property {string[]} items
 * @property {boolean} [noSchool]
 */

/**
 * @typedef {Object} SchoolItem
 * @property {string} id
 * @property {'action'|'event'|'reminder'|'info'} kind
 * @property {string} title
 * @property {string} summary
 * @property {string} [dueDate]           ISO date (no time) or ISO date-time
 * @property {string} [eventDate]
 * @property {string} [child]
 * @property {string} [class]
 * @property {string} [teacher]
 * @property {string} [location]
 * @property {number} urgency             0..1
 * @property {'regex'|'openclaw'|'both'} extractionSource
 * @property {string} [rawSnippet]
 * @property {string} [dismissedAt]
 * @property {string} sourceEmailId
 */

/**
 * @typedef {Object} RawState
 * @property {{events: CalendarEvent[]}} calendar
 * @property {{today: WeatherToday}} weather
 * @property {Birthday[]} birthdays
 * @property {BedtimeSetting[]} bedtime
 * @property {ChecklistConfig} checklist
 * @property {{today: TakeoutDecision|null}} takeout
 * @property {Object.<string, LunchDecision>} lunchDecisions   date → decision
 * @property {SchoolMenuDay[]} schoolLunchMenu
 * @property {SchoolItem[]} schoolItems
 * @property {SchoolItem[]} [schoolUpdates]
 * @property {{bedtimeDismissedUntil?: string, forceMorningChecklist?: boolean}} [settings]
 */

// ─── Context ─────────────────────────────────────────────────────────────

/**
 * @typedef {Object} DerivedContext
 * @property {Date} now
 * @property {{ isPeter: boolean, email?: string }} user
 */

// ─── Derived state ───────────────────────────────────────────────────────

/**
 * @typedef {Object} CalendarConflict
 * @property {CalendarEvent} a
 * @property {CalendarEvent} b
 * @property {string} at                ISO
 */

/**
 * @typedef {Object} ChecklistView
 * @property {{id:string,label:string,done:boolean,conditionReason?:string}[]} items
 * @property {{highTempF:number|null, needsJacket:boolean, hotDay:boolean, rain:boolean}} variant
 */

/**
 * @typedef {Object} BirthdayView
 * @property {string} id
 * @property {string} name
 * @property {number} daysUntil
 * @property {'ready'|'ordered'|'needed'|'unknown'} giftStatus
 */

/**
 * @typedef {Object} BedtimeWindow
 * @property {string} bedtimeAt            ISO
 * @property {number} minutesUntil
 * @property {{childId:string, childName:string}[]} kidsInRange
 */

/**
 * @typedef {Object} TakeoutView
 * @property {'takeout'|'home'|null} decision
 * @property {string} [vendor]
 * @property {string[]} suggestedVendors
 */

/**
 * @typedef {Object} LunchContext
 * @property {string} dateLabel
 * @property {string} dateISO
 * @property {boolean} isSchoolDay
 * @property {string[]} menu
 */

/**
 * @typedef {Object} ClawSuggestion
 * @property {string} id
 * @property {1|2|3|4} tier
 * @property {string} iconName            lucide name
 * @property {'red'|'amber'|'blue'|'green'|'neutral'} accent
 * @property {string} title
 * @property {string} detail
 * @property {'openEventDetail'|'orderGift'|'setTakeout'|'setLunch'|'openSchoolItem'|'snoozeBedtime'} actionKind
 * @property {Object} [targetRef]
 */

/**
 * @typedef {Object} DerivedState
 * @property {boolean} hasMorningOverlap
 * @property {boolean} [hasMorningConflict]
 * @property {CalendarConflict[]} conflicts
 * @property {boolean} peter0800_0900Risk
 * @property {boolean} [hasWorkConflictForPeter]
 * @property {boolean} showMorningChecklist
 * @property {ChecklistView} checklist
 * @property {boolean} [needsSchoolActionToday]
 * @property {boolean} hasSchoolActionItems
 * @property {boolean} hasUrgentSchoolItem
 * @property {SchoolItem[]} rankedSchoolItems
 * @property {boolean} [hasSchoolEventUpcoming]
 * @property {SchoolItem[]} [upcomingSchoolEvents]
 * @property {BirthdayView[]} birthdaysRanked
 * @property {boolean} birthdayGiftNeeded
 * @property {boolean} [birthdayNeedsGift]
 * @property {boolean} bedtimeReminderActive
 * @property {BedtimeWindow|null} bedtimeWindow
 * @property {boolean} takeoutDecisionPending
 * @property {boolean} [takeoutUndecided]
 * @property {TakeoutView} takeoutState
 * @property {boolean} [tomorrowNeedsPrep]
 * @property {string[]} [tomorrowPrepReasons]
 * @property {boolean} lunchDecisionNeeded
 * @property {LunchContext|null} lunchContext
 * @property {boolean} showClawSuggestions
 * @property {ClawSuggestion[]} clawSuggestions
 * @property {string|null} nextMeaningfulTransition   ISO, used to schedule recompute
 */

// ─── OpenClaw enhancement payloads ───────────────────────────────────────

/**
 * @typedef {Object} EnhancementRequest
 * @property {string} feature           matches a `src/ai/enhancers/*.js` key
 * @property {any} state                slice of DerivedState relevant to the feature
 * @property {{timeoutMs?:number}} [opts]
 */

/**
 * @typedef {Object} EnhancementResponse
 * @property {Object.<string, any>} fields  feature-specific enhancement fields
 * @property {'openclaw'|'fallback'} source
 * @property {string} [error]
 */

export {};

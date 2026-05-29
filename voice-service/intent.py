"""Deterministic Home Center voice intent parsing."""

from __future__ import annotations

import re

WAKE_PHRASE_RE = re.compile(
    r"\b(?:"
    r"(?:hey|hi|hay|okay|ok|a)[\s,.\-!?:]+"
    r"(?:ho(?:mer|mmer|mar|me[rl]|m'r)|home\s*(?:her|or)|homework|homer(?:ed)?|hummer|number|armor|over)"
    r"|(?:he|hey|hi|hay|a)[\s,.\-!?:]+homer(?:ed)?"
    r"|(?:hey|hi|hay|okay|ok)[\s,.\-!?:]+(?:i'?m\s+)?(?:rob(?:in|yn)|are)"
    r"|(?:hey|hi|hay|okay|ok)[\s,.\-!?:]+howie"
    r")\b[,.\s!?:-]*",
    re.IGNORECASE,
)

HOWIE_WAKE_PHRASE_RE = re.compile(
    r"\b(?:hey|hi|hay|okay|ok)[\s,.\-!?:]+howie\b[,.\s!?:-]*",
    re.IGNORECASE,
)

COMMAND_KEYWORD_RE = re.compile(
    r"\b(open|show|go\s+(to|back|home)|calendar|weather|photos?|pictures?|gallery|"
    r"turn(ed|s)?\s*(it\s+)?(on|off|of|up|down|f)|set\s+(a\s+)?timer|"
    r"remind\s+me|ordered|mark|done|suggest|ideas?|gift|stop|dismiss|cancel|quiet|shut\s+up|like|don't\s+like|"
    r"do\s+not\s+like|what|who|where|when|"
    r"version\s+(one|two)|v[12]|"
    r"why|how|do|does|did|is|are|can|could|should|would|will|tell\s+me|"
    r"explain|describe|monthly|weekly|daily|dashboard|home|howie)\b",
    re.IGNORECASE,
)

ASK_CUE_RE = re.compile(
    r"\b(what|who|where|when|why|how|do|does|did|is|are|am|was|were|"
    r"can|could|should|would|will|tell\s+me|explain|describe)\b",
    re.IGNORECASE,
)

EXPLICIT_ASK_RE = re.compile(
    r"^(?:ask(?:\s+homer)?|tell\s+me|explain|describe)\s+(.+)$",
    re.IGNORECASE,
)

WAKE_KNOWLEDGE_QUESTION_RE = re.compile(
    r"^(?:"
    r"(?:what|who|where|when|why)\s+(?:is|are|was|were|does|do|did|can|could|will|would|should)\b"
    r"|how\s+(?:big|large|small|tall|long|old|far|fast|hot|cold|heavy|deep|wide|many|much|does|do|did|can|could|is|are|was|were)\b"
    r")",
    re.IGNORECASE,
)

DESIGN_FEEDBACK_RE = re.compile(
    r"^"
    r"(?:"
    r"i\s+(?P<like>like|love)\s+"
    r"|i\s+(?P<dislike>don['’]?t\s+like|do\s+not\s+like|dislike|hate)\s+"
    r")"
    r"(?:this|that|the)?"
    r"(?:\s+design|\s+concept|\s+mockup|\s+screen)?"
    r"(?:\s+(?P<notes>.+))?"
    r"$",
    re.IGNORECASE,
)

NEGATIVE_KNOWLEDGE_FEEDBACK_RE = re.compile(
    r"^(?:that\s+(?:was|is|'s)\s+wrong|bad\s+(?:answer|response)|wrong\s+answer)$",
    re.IGNORECASE,
)

NEGATIVE_IMAGE_FEEDBACK_RE = re.compile(
    r"^(?:bad\s+(?:image|picture)|wrong\s+(?:image|picture)|that\s+image\s+(?:is|'s)\s+wrong)$",
    re.IGNORECASE,
)

STOP_COMMAND_RE = re.compile(
    r"^(?:"
    r"(?:stop|dismiss|cancel)"
    r"(?:\s+(?:(?:all|the)\s+)?(?:expired\s+)?(?:timers?|alarms?|alerts?|notifications?))?"
    r"|quiet|silence|shut\s+up"
    r")$",
    re.IGNORECASE,
)

_ALLOWED_NAV_PAGES = {"calendar", "weather", "photos", "dashboard"}
_ALLOWED_NAV_VIEWS = {"monthly", "weekly", "daily"}
_MAX_TIMER_SECONDS = 24 * 60 * 60

_NUMBER_WORDS = {
    "a": 1,
    "an": 1,
    "one": 1,
    "two": 2,
    "three": 3,
    "four": 4,
    "five": 5,
    "six": 6,
    "seven": 7,
    "eight": 8,
    "nine": 9,
    "ten": 10,
    "eleven": 11,
    "twelve": 12,
    "thirteen": 13,
    "fourteen": 14,
    "fifteen": 15,
    "sixteen": 16,
    "seventeen": 17,
    "eighteen": 18,
    "nineteen": 19,
    "twenty": 20,
    "thirty": 30,
    "forty": 40,
    "fifty": 50,
    "sixty": 60,
}

_NUMBER_PATTERN = "|".join(sorted(_NUMBER_WORDS, key=len, reverse=True))


def strip_wake_phrase(text: str) -> str:
    """Remove a wake phrase from the beginning or middle of a transcript."""
    normalized = text.strip()
    match = WAKE_PHRASE_RE.search(normalized)
    if not match:
        return normalized
    return normalized[match.end():].strip(" ,.:;!?-")


def _parse_amount(value: str) -> int:
    value = value.lower().strip()
    if value.isdigit():
        return int(value)
    return _NUMBER_WORDS[value]


def _parse_ask(text: str, allow_bare_ask: bool, allow_wake_knowledge: bool = False) -> dict:
    explicit_match = EXPLICIT_ASK_RE.match(text)
    if explicit_match:
        query = explicit_match.group(1).strip(" ,.:;!?-")
        if len(query.split()) >= 2:
            return {"action": "ask", "query": query}

    if allow_bare_ask and ASK_CUE_RE.search(text) and len(text.split()) >= 2:
        return {"action": "ask", "query": text}

    if allow_wake_knowledge and WAKE_KNOWLEDGE_QUESTION_RE.search(text) and len(text.split()) >= 4:
        return {"action": "ask", "query": text}

    return {"action": "none"}


def _parse_design_feedback(text: str) -> dict:
    match = DESIGN_FEEDBACK_RE.match(text)
    if not match:
        return {"action": "none"}
    sentiment = "like" if match.group("like") else "dislike"
    notes = (match.group("notes") or "").strip(" ,.:;!?-")
    return {"action": "design_feedback", "sentiment": sentiment, "notes": notes}


def _parse_knowledge_feedback(text: str) -> dict:
    if NEGATIVE_IMAGE_FEEDBACK_RE.fullmatch(text):
        return {"action": "knowledge_feedback", "feedback_type": "image"}
    if NEGATIVE_KNOWLEDGE_FEEDBACK_RE.fullmatch(text):
        return {"action": "knowledge_feedback", "feedback_type": "knowledge"}
    return {"action": "none"}


def _parse_howie_message(text: str) -> dict:
    match = HOWIE_WAKE_PHRASE_RE.search(text)
    if match:
        message = text[match.end():].strip(" ,.:;!?-")
    elif text.lower().startswith("howie "):
        message = text[6:].strip(" ,.:;!?-")
    else:
        return {"action": "none"}
    if not message:
        return {"action": "none"}
    return {"action": "howie_message", "message": message}


def _parse_birthday_gift_ordered(text: str) -> dict:
    match = re.search(r"\b(?:i\s+)?(?:just\s+)?ordered\s+(.+?)(?:'?s)?\s+(?:gift|birthday)\b", text)
    if not match:
        match = re.search(r"\bmark\s+(.+?)(?:'?s)?\s+(?:gift|birthday)\s+as\s+ordered\b", text)
    if not match:
        return {"action": "none"}
    name = match.group(1).strip(" .,'\"")
    if not name:
        return {"action": "none"}
    return {"action": "birthday_gift_ordered", "name": name.title()}


def _parse_birthday_gift_ideas(text: str) -> dict:
    match = re.search(
        r"\bsuggest\s+(?:birthday\s+)?gift\s+ideas\s+for\s+(.+?)\s*$",
        text,
    )
    if not match:
        return {"action": "none"}
    name = match.group(1).strip(" .,'\"")
    if not name:
        return {"action": "none"}
    return {"action": "birthday_gift_ideas", "name": name.title()}


def _parse_needs_action_done(text: str) -> dict:
    match = re.search(
        rf"\bmark\s+(?:needs\s+action\s+)?item\s+(\d+|{_NUMBER_PATTERN})\s+(?:as|is)\s+(?:done|complete|completed)\b",
        text,
    )
    if match:
        index = _parse_amount(match.group(1))
        return {"action": "needs_action_done", "index": index}

    match = re.search(
        r"\bmark\s+(?:the\s+)?(.+?)\s+(?:as|is)\s+(?:done|complete|completed)\b",
        text,
    )
    if not match:
        return {"action": "none"}
    name = match.group(1).strip(" .,'\"")
    name = re.sub(r"^(?:needs\s+action\s+)?(?:item\s+)?", "", name).strip(" .,'\"")
    if not name:
        return {"action": "none"}
    return {"action": "needs_action_done", "name": name.title()}


def parse_command(text: str, allow_bare_ask: bool = True, allow_wake_knowledge: bool = False) -> dict:
    """Parse the command body after "Hey Homer" into a stable action dict."""
    original_text = text.strip()
    has_wake_phrase = bool(WAKE_PHRASE_RE.search(original_text))
    howie_command = _parse_howie_message(original_text)
    if howie_command["action"] != "none":
        return howie_command

    text = strip_wake_phrase(original_text).lower().strip()
    text = re.sub(r"^(?:of|have|a|the)\s+(?:a\s+|the\s+)?", "", text).strip()
    if not text:
        return {"action": "none"}

    if STOP_COMMAND_RE.fullmatch(text):
        return {"action": "stop"}

    needs_action_command = _parse_needs_action_done(text)
    if needs_action_command["action"] != "none":
        return needs_action_command

    gift_ideas_command = _parse_birthday_gift_ideas(text)
    if gift_ideas_command["action"] != "none":
        return gift_ideas_command

    gift_command = _parse_birthday_gift_ordered(text)
    if gift_command["action"] != "none":
        return gift_command

    knowledge_feedback_command = _parse_knowledge_feedback(text)
    if knowledge_feedback_command["action"] != "none":
        return knowledge_feedback_command

    feedback_command = _parse_design_feedback(text)
    if feedback_command["action"] != "none":
        return feedback_command

    if re.search(r"\b(show|switch(?:\s+to)?|use)\s+(?:the\s+)?(?:version\s+)?(?:one|1|v1)\b", text):
        return {"action": "design_system", "version": "v1"}
    if re.search(r"\b(show|switch(?:\s+to)?|use)\s+(?:the\s+)?(?:version\s+)?(?:two|to|too|2|v2)\b", text):
        return {"action": "design_system", "version": "v2"}

    if re.search(r"\bturn(ed|s)?\s*(it\s+)?(off|of|up|down|f)\b", text):
        return {"action": "turn_off"}

    timer_match = re.search(
        rf"(?:set\s+(?:a\s+)?timer|remind\s+me|timer)\s+"
        rf"(?:for\s+)?(\d+|{_NUMBER_PATTERN})\s*"
        r"(second|sec|minute|min|hour|hr)s?\b"
        r"(?:\s+(?:for|to|called?|named?|labele?d?)\s+(.+))?",
        text,
    )
    if timer_match:
        amount = _parse_amount(timer_match.group(1))
        unit = timer_match.group(2).lower()
        label = (timer_match.group(3) or "timer").strip().rstrip(".")
        if unit.startswith(("hour", "hr")):
            duration = amount * 3600
        elif unit.startswith("min"):
            duration = amount * 60
        else:
            duration = amount
        return {"action": "set_timer", "label": label, "duration": duration}

    nav_prefix = r"(?:open|show|go\s+to|put\s+on|pull\s+up|switch\s+to|bring\s+up)"
    if re.search(rf"\b{nav_prefix}\s+(?:the\s+)?calendar(?:\s+page)?\b", text) or re.fullmatch(
        r"(?:the\s+)?calendar(?:\s+page)?", text
    ):
        return {"action": "navigate", "page": "calendar"}
    if re.search(rf"\b{nav_prefix}\s+(?:the\s+)?weather(?:\s+page)?\b", text) or re.fullmatch(
        r"(?:the\s+)?weather(?:\s+page)?", text
    ):
        return {"action": "navigate", "page": "weather"}
    if re.search(rf"\b{nav_prefix}\s+(?:the\s+)?(?:family\s+)?(photos?|pictures?|gallery|for\s+us)(?:\s+page)?\b", text) or re.fullmatch(
        r"(?:the\s+)?(?:family\s+)?(photos?|pictures?|gallery|for\s+us)(?:\s+page)?", text
    ):
        return {"action": "navigate", "page": "photos"}

    view_match = re.search(r"\b(monthly|weekly|daily)\s*(view)?\b", text)
    if view_match:
        return {"action": "navigate", "view": view_match.group(1)}

    if re.search(
        r"\b(go\s+(back|home|dashboard)|(?:go|come)\s+(?:bak|bac|beck|bag|pack)|"
        r"back(?:\s+please)?|"
        r"back\s+to\s+(dashboard|home)|home\s+screen|main\s+(screen|dashboard)|"
        r"close\s+(calendar|weather|photos?)|dashboard)\b",
        text,
    ):
        return {"action": "navigate", "page": "dashboard"}

    if re.search(r"\bturn(ed|s)?\s*(it\s+)?on\b", text):
        return {"action": "turn_on"}

    ask_command = _parse_ask(
        text,
        allow_bare_ask,
        allow_wake_knowledge=allow_wake_knowledge or (has_wake_phrase and not allow_bare_ask),
    )
    if ask_command["action"] != "none":
        return ask_command

    return {"action": "none"}


def is_dispatchable_command(command: dict) -> bool:
    """Return True when a parsed command is complete enough to execute."""
    action = command.get("action") if isinstance(command, dict) else None
    if action in {"none", None}:
        return False
    if action in {"stop", "turn_off", "turn_on"}:
        return True
    if action == "design_feedback":
        return command.get("sentiment") in {"like", "dislike"}
    if action == "knowledge_feedback":
        return command.get("feedback_type") in {"knowledge", "image"}
    if action == "howie_message":
        message = str(command.get("message", "")).strip()
        return len(message.split()) >= 1
    if action == "birthday_gift_ordered":
        name = str(command.get("name", "")).strip()
        return len(name.split()) >= 1
    if action == "birthday_gift_ideas":
        name = str(command.get("name", "")).strip()
        return len(name.split()) >= 1
    if action == "needs_action_done":
        index = command.get("index")
        name = str(command.get("name", "")).strip()
        return (isinstance(index, int) and index >= 1) or len(name.split()) >= 1
    if action == "set_timer":
        duration = command.get("duration")
        return isinstance(duration, int) and 1 <= duration <= _MAX_TIMER_SECONDS
    if action == "navigate":
        page = command.get("page")
        view = command.get("view")
        return page in _ALLOWED_NAV_PAGES or view in _ALLOWED_NAV_VIEWS
    if action == "design_system":
        return command.get("version") in {"v1", "v2"}
    if action == "ask":
        query = str(command.get("query", "")).strip()
        return len(query.split()) >= 2 and bool(ASK_CUE_RE.search(query))
    return False

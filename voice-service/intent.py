"""Deterministic Home Center voice intent parsing."""

from __future__ import annotations

import re

WAKE_PHRASE_RE = re.compile(
    r"\b(hey|hi|hay|okay|ok)[\s,.\-!?:]+"
    r"(ho(?:mer|mmer|mar|me[rl]|m'r)|home\s*her|homework|homer)\b[,.\s!?:-]*",
    re.IGNORECASE,
)

COMMAND_KEYWORD_RE = re.compile(
    r"\b(open|show|go\s+(to|back|home)|calendar|weather|photos?|pictures?|gallery|"
    r"turn(ed|s)?\s*(it\s+)?(on|off|of|up|down|f)|set\s+(a\s+)?timer|"
    r"remind\s+me|stop|dismiss|cancel|quiet|shut\s+up|what|who|where|when|"
    r"why|how|do|does|did|is|are|can|could|should|would|will|tell\s+me|"
    r"explain|describe|monthly|weekly|daily|dashboard|home)\b",
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


def _parse_ask(text: str, allow_bare_ask: bool) -> dict:
    explicit_match = EXPLICIT_ASK_RE.match(text)
    if explicit_match:
        query = explicit_match.group(1).strip(" ,.:;!?-")
        if len(query.split()) >= 2:
            return {"action": "ask", "query": query}

    if allow_bare_ask and ASK_CUE_RE.search(text) and len(text.split()) >= 2:
        return {"action": "ask", "query": text}

    return {"action": "none"}


def parse_command(text: str, allow_bare_ask: bool = True) -> dict:
    """Parse the command body after "Hey Homer" into a stable action dict."""
    text = strip_wake_phrase(text).lower().strip()
    if not text:
        return {"action": "none"}

    if STOP_COMMAND_RE.fullmatch(text):
        return {"action": "stop"}

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
    if re.search(rf"\b{nav_prefix}\s+(?:the\s+)?(photos?|pictures?|gallery)(?:\s+page)?\b", text) or re.fullmatch(
        r"(?:the\s+)?(photos?|pictures?|gallery)(?:\s+page)?", text
    ):
        return {"action": "navigate", "page": "photos"}

    view_match = re.search(r"\b(monthly|weekly|daily)\s*(view)?\b", text)
    if view_match:
        return {"action": "navigate", "view": view_match.group(1)}

    if re.search(
        r"\b(go\s+(back|home)|back\s+to\s+(dashboard|home)|"
        r"close\s+(calendar|weather|photos?)|dashboard)\b",
        text,
    ):
        return {"action": "navigate", "page": "dashboard"}

    if re.search(r"\bturn(ed|s)?\s*(it\s+)?on\b", text):
        return {"action": "turn_on"}

    ask_command = _parse_ask(text, allow_bare_ask)
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
    if action == "set_timer":
        duration = command.get("duration")
        return isinstance(duration, int) and 1 <= duration <= _MAX_TIMER_SECONDS
    if action == "navigate":
        page = command.get("page")
        view = command.get("view")
        return page in _ALLOWED_NAV_PAGES or view in _ALLOWED_NAV_VIEWS
    if action == "ask":
        query = str(command.get("query", "")).strip()
        return len(query.split()) >= 2 and bool(ASK_CUE_RE.search(query))
    return False

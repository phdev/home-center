"""Shared helpers for the Home Center Design Claw scripts.

All paths, the OpenAI client wiring, JSON/markdown IO, and the memory
model live here so the individual scripts stay small and readable.
"""

from __future__ import annotations

import json
import os
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable, TypeVar

from openai import OpenAI

T = TypeVar("T")

MODEL = "gpt-5.4-mini"

REPO_ROOT = Path(__file__).resolve().parent.parent
CLAWS = REPO_ROOT / "claws"
DESIGN_INPUTS = REPO_ROOT / "design_inputs"
DESIGN_OUTPUTS = REPO_ROOT / "design_outputs"
DESIGN_OUTPUTS_DAILY = DESIGN_OUTPUTS / "daily"
DESIGN_OUTPUTS_WEEKLY = DESIGN_OUTPUTS / "weekly"
DESIGN_MEMORY = REPO_ROOT / "design_memory"
LAST_DAILY_STATE = DESIGN_OUTPUTS / ".last_daily.json"

MEMORY_FILES: dict[str, str] = {
    "principles": "principles.json",
    "preferences": "preferences.json",
    "accepted_patterns": "accepted_patterns.json",
    "rejected_patterns": "rejected_patterns.json",
    "open_questions": "open_questions.json",
}
ITERATION_LOG = "iteration_log.jsonl"


# --- IO ---------------------------------------------------------------


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def write_text(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")


def ensure_dirs() -> None:
    for d in (
        DESIGN_OUTPUTS,
        DESIGN_OUTPUTS_DAILY,
        DESIGN_OUTPUTS_WEEKLY,
        DESIGN_MEMORY,
    ):
        d.mkdir(parents=True, exist_ok=True)


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def today_str() -> str:
    return datetime.now().strftime("%Y-%m-%d")


# --- env --------------------------------------------------------------


def require_env(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        print(f"error: {name} is not set", file=sys.stderr)
        sys.exit(2)
    return value


# --- OpenAI Responses API --------------------------------------------


def openai_client() -> OpenAI:
    require_env("OPENAI_API_KEY")
    return OpenAI()


def extract_output_text(response: Any) -> str:
    """Robustly pull text out of a Responses API result."""
    text = getattr(response, "output_text", None)
    if text:
        return text.strip()
    chunks: list[str] = []
    for item in getattr(response, "output", []) or []:
        for part in getattr(item, "content", []) or []:
            value = getattr(part, "text", None)
            if isinstance(value, str):
                chunks.append(value)
            elif value is not None:
                nested = getattr(value, "value", None)
                if isinstance(nested, str):
                    chunks.append(nested)
    joined = "\n".join(chunks).strip()
    if joined:
        return joined
    raise RuntimeError("No text content found in Responses API result")


_JSON_FENCE_RE = re.compile(r"```(?:json)?\s*(.+?)```", re.DOTALL)


def extract_json_block(text: str) -> Any:
    """Parse a JSON object from model output that may be fenced or bare."""
    match = _JSON_FENCE_RE.search(text)
    candidate = match.group(1).strip() if match else text.strip()
    try:
        return json.loads(candidate)
    except json.JSONDecodeError:
        start = candidate.find("{")
        end = candidate.rfind("}")
        if start != -1 and end > start:
            return json.loads(candidate[start : end + 1])
        raise


_RETRYABLE_NAMES = {
    "APIConnectionError",
    "APITimeoutError",
    "InternalServerError",
    "RateLimitError",
    "URLError",
    "TimeoutError",
    "ConnectionError",
    "ConnectionResetError",
    "IncompleteRead",
}


def _is_retryable(exc: BaseException) -> bool:
    name = type(exc).__name__
    if name in _RETRYABLE_NAMES:
        return True
    code = getattr(exc, "code", None)
    try:
        if code is not None and 500 <= int(code) < 600:
            return True
    except (TypeError, ValueError):
        pass
    return False


def with_retries(fn: Callable[[], T], attempts: int = 3, backoff: tuple[int, ...] = (2, 6)) -> T:
    """Call fn() with bounded retries on transient network/5xx errors.

    Non-retryable exceptions (e.g. auth errors) are raised immediately.
    """
    last: BaseException | None = None
    for i in range(attempts):
        try:
            return fn()
        except (KeyboardInterrupt, SystemExit):
            raise
        except BaseException as exc:
            last = exc
            if i + 1 >= attempts or not _is_retryable(exc):
                raise
            delay = backoff[i] if i < len(backoff) else backoff[-1]
            print(f"warning: {type(exc).__name__} — retrying in {delay}s", file=sys.stderr)
            time.sleep(delay)
    assert last is not None
    raise last


def call_responses(client: OpenAI, prompt: str, payload_blocks: list[tuple[str, str]]) -> str:
    """Run the Responses API with the prompt + an ordered list of labeled
    input blocks (e.g. the snapshot, memory, topic). Returns raw text."""
    parts = [prompt.strip(), ""]
    for label, content in payload_blocks:
        parts.append(f"## {label}")
        parts.append(content)
        parts.append("")
    input_text = "\n".join(parts)
    response = with_retries(lambda: client.responses.create(model=MODEL, input=input_text))
    return extract_output_text(response)


# --- memory model ----------------------------------------------------


def load_memory() -> dict[str, Any]:
    """Read all memory files into one dict. Missing files → empty shape."""
    memory: dict[str, Any] = {}
    for key, fname in MEMORY_FILES.items():
        path = DESIGN_MEMORY / fname
        if path.exists():
            memory[key] = read_json(path)
        else:
            memory[key] = {"items": []}
    return memory


def memory_summary_for_prompt(memory: dict[str, Any]) -> str:
    """Render the memory as a compact bullet list for the model."""
    lines: list[str] = []
    for key in ("principles", "preferences", "accepted_patterns", "rejected_patterns", "open_questions"):
        entries = (memory.get(key) or {}).get("items") or []
        if not entries:
            continue
        lines.append(f"### {key}")
        for e in entries:
            text = e.get("text") if isinstance(e, dict) else str(e)
            if text:
                lines.append(f"- {text}")
        lines.append("")
    return "\n".join(lines).strip() or "(memory is empty)"


def append_iteration_log(event: str, summary: str, **extra: Any) -> None:
    DESIGN_MEMORY.mkdir(parents=True, exist_ok=True)
    path = DESIGN_MEMORY / ITERATION_LOG
    row = {"ts": now_iso(), "event": event, "summary": summary, **extra}
    with path.open("a", encoding="utf-8") as f:
        f.write(json.dumps(row) + "\n")


def save_last_daily(path: Path, topic: dict[str, Any]) -> None:
    write_json(
        LAST_DAILY_STATE,
        {"path": str(path), "topic": topic, "generated_at": now_iso()},
    )


def load_last_daily() -> dict[str, Any] | None:
    if not LAST_DAILY_STATE.exists():
        return None
    return read_json(LAST_DAILY_STATE)

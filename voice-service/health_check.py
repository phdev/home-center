"""Recurring health check for the Home Center voice command path."""

from __future__ import annotations

import argparse
import json
import os
import platform
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

from intent import parse_command, strip_wake_phrase


REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_STATUS_PATH = Path(__file__).resolve().parent / "logs/voice-health-status.json"
DEFAULT_VOICE_LABEL = "com.homecenter.voice"


class HealthError(Exception):
    pass


def assert_equal(name: str, actual, expected) -> None:
    if actual != expected:
        raise HealthError(f"{name}: expected {expected!r}, got {actual!r}")


def check_parser_regressions() -> list[str]:
    checks = [
        ("turn_on", parse_command("Hey Homer, turn on"), {"action": "turn_on"}),
        ("open_calendar", parse_command("Hey Homer, open calendar"), {"action": "navigate", "page": "calendar"}),
        ("family_photos", parse_command("hey armor open family photos"), {"action": "navigate", "page": "photos"}),
        ("hey_over_photos", parse_command("hey over open photos"), {"action": "navigate", "page": "photos"}),
        ("im_are_photos", parse_command("hey i'm are open for us"), {"action": "navigate", "page": "photos"}),
        ("go_back", parse_command("a hummer go back"), {"action": "navigate", "page": "dashboard"}),
        ("timer", parse_command("Hey Homer, set a timer for ten seconds"), {"action": "set_timer", "label": "timer", "duration": 10}),
        ("bare_wake", parse_command("Hey Homer"), {"action": "none"}),
        ("hammer_guard", strip_wake_phrase("a hammer open calendar"), "a hammer open calendar"),
    ]
    for name, actual, expected in checks:
        assert_equal(f"parser.{name}", actual, expected)
    return [name for name, _, _ in checks]


def run_command(args: list[str], timeout: float = 5.0) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        args,
        check=False,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        timeout=timeout,
    )


def check_launchd(label: str) -> dict:
    if platform.system() != "Darwin":
        return {"skipped": True, "reason": "launchd is only available on macOS"}

    uid = os.getuid()
    result = run_command(["launchctl", "print", f"gui/{uid}/{label}"])
    if result.returncode != 0:
        raise HealthError(f"launchd.{label}: launchctl print failed: {result.stderr.strip() or result.stdout.strip()}")

    output = result.stdout
    if "state = running" not in output:
        raise HealthError(f"launchd.{label}: service is not running")
    if "pid =" not in output:
        raise HealthError(f"launchd.{label}: service has no pid")

    return {"label": label, "state": "running"}


def check_pi_endpoint(pi_base: str, timeout: float) -> dict:
    url = pi_base.rstrip("/") + "/api/navigate"
    get_request = urllib.request.Request(url, headers={"Accept": "application/json"})
    try:
        with urllib.request.urlopen(get_request, timeout=timeout) as response:
            body = response.read(4096)
    except (urllib.error.URLError, TimeoutError) as exc:
        raise HealthError(f"pi.navigate: failed to GET {url}: {exc}") from exc

    try:
        current_payload = json.loads(body.decode("utf-8"))
    except json.JSONDecodeError as exc:
        raise HealthError(f"pi.navigate: invalid JSON from {url}: {body[:200]!r}") from exc
    current = current_payload.get("navigation") or {}

    post_body = json.dumps({
        "page": current.get("page") or "dashboard",
        "view": current.get("view"),
    }).encode("utf-8")
    post_request = urllib.request.Request(
        url,
        data=post_body,
        headers={"Accept": "application/json", "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(post_request, timeout=timeout) as response:
            body = response.read(4096)
    except (urllib.error.URLError, TimeoutError) as exc:
        raise HealthError(f"pi.navigate: failed to POST {url}: {exc}") from exc

    try:
        payload = json.loads(body.decode("utf-8"))
    except json.JSONDecodeError as exc:
        raise HealthError(f"pi.navigate: invalid JSON from {url}: {body[:200]!r}") from exc

    if not payload.get("ok") or "navigation" not in payload:
        raise HealthError(f"pi.navigate: response missing navigation: {payload!r}")
    return {"url": url, "navigation": payload["navigation"]}


def _tail_lines(path: Path, max_bytes: int = 512 * 1024) -> list[str]:
    with path.open("rb") as fh:
        fh.seek(0, os.SEEK_END)
        size = fh.tell()
        fh.seek(max(0, size - max_bytes))
        data = fh.read()
    return data.decode("utf-8", errors="replace").splitlines()


def check_reliability_log(
    path: Path,
    max_age_seconds: float,
    min_recent_rms: float,
    min_recent_noise: float,
    activity_window_seconds: float,
) -> dict:
    if not path.exists():
        raise HealthError(f"reliability_log: missing {path}")
    stat = path.stat()
    if stat.st_size <= 0:
        raise HealthError(f"reliability_log: empty {path}")
    age = time.time() - stat.st_mtime
    if age > max_age_seconds:
        raise HealthError(f"reliability_log: stale {path}, last update {age / 60:.1f} minutes ago")

    now = time.time()
    max_rms = 0.0
    max_noise = 0.0
    recent_events = 0
    for line in _tail_lines(path):
        try:
            event = json.loads(line)
        except json.JSONDecodeError:
            continue
        event_ts = float(event.get("ts") or 0)
        if event_ts < now - activity_window_seconds:
            continue
        recent_events += 1
        max_rms = max(max_rms, float(event.get("rms") or event.get("maxRms") or 0))
        max_noise = max(max_noise, float(event.get("noise") or 0))

    if recent_events == 0:
        raise HealthError(
            f"reliability_log: no recent detector activity in {activity_window_seconds / 60:.0f} minutes"
        )
    if max_rms < min_recent_rms and max_noise < min_recent_noise:
        raise HealthError(
            "reliability_log: recent mic activity is abnormally quiet "
            f"(maxRms={max_rms:.0f}, maxNoise={max_noise:.0f})"
        )

    return {
        "path": str(path),
        "ageSeconds": round(age, 1),
        "bytes": stat.st_size,
        "recentEvents": recent_events,
        "maxRecentRms": round(max_rms, 1),
        "maxRecentNoise": round(max_noise, 1),
    }


def write_status(path: Path, status: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(status, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    tmp.replace(path)


def previous_status(path: Path) -> dict:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError, OSError):
        return {}


def notify_failure_once(status_path: Path, error: str) -> None:
    if platform.system() != "Darwin":
        return
    if os.environ.get("VOICE_HEALTH_MAC_NOTIFICATION", "1") not in {"1", "true", "yes"}:
        return
    if previous_status(status_path).get("ok") is False:
        return

    message = json.dumps(error[:180])
    title = json.dumps("Home Center voice health failed")
    run_command(
        [
            "osascript",
            "-e",
            f"display notification {message} with title {title}",
        ],
        timeout=2.0,
    )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pi-base", default=os.environ.get("PI_COMMAND_URL", "http://homecenter.local:8765"))
    parser.add_argument("--launchd-label", default=os.environ.get("VOICE_LAUNCHD_LABEL", DEFAULT_VOICE_LABEL))
    parser.add_argument("--timeout", type=float, default=float(os.environ.get("VOICE_HEALTH_TIMEOUT_SECONDS", "4.0")))
    parser.add_argument(
        "--reliability-log",
        type=Path,
        default=Path(os.environ.get("VOICE_RELIABILITY_LOG", REPO_ROOT / "voice-service/logs/voice-reliability.jsonl")),
    )
    parser.add_argument(
        "--max-log-age-seconds",
        type=float,
        default=float(os.environ.get("VOICE_HEALTH_MAX_LOG_AGE_SECONDS", "3600")),
    )
    parser.add_argument(
        "--activity-window-seconds",
        type=float,
        default=float(os.environ.get("VOICE_HEALTH_ACTIVITY_WINDOW_SECONDS", "1800")),
    )
    parser.add_argument(
        "--min-recent-rms",
        type=float,
        default=float(os.environ.get("VOICE_HEALTH_MIN_RECENT_RMS", "50")),
    )
    parser.add_argument(
        "--min-recent-noise",
        type=float,
        default=float(os.environ.get("VOICE_HEALTH_MIN_RECENT_NOISE", "20")),
    )
    parser.add_argument(
        "--status-path",
        type=Path,
        default=Path(os.environ.get("VOICE_HEALTH_STATUS_PATH", DEFAULT_STATUS_PATH)),
    )
    args = parser.parse_args()

    started = time.time()
    status = {
        "ok": False,
        "checkedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(started)),
        "checks": {},
    }

    try:
        status["checks"]["parser"] = {"cases": check_parser_regressions()}
        status["checks"]["launchd"] = check_launchd(args.launchd_label)
        status["checks"]["pi"] = check_pi_endpoint(args.pi_base, args.timeout)
        status["checks"]["reliabilityLog"] = check_reliability_log(
            args.reliability_log,
            args.max_log_age_seconds,
            args.min_recent_rms,
            args.min_recent_noise,
            args.activity_window_seconds,
        )
        status["ok"] = True
        status["durationMs"] = round((time.time() - started) * 1000)
        write_status(args.status_path, status)
        print(json.dumps(status, sort_keys=True))
        return 0
    except Exception as exc:
        status["error"] = str(exc)
        status["durationMs"] = round((time.time() - started) * 1000)
        notify_failure_once(args.status_path, status["error"])
        write_status(args.status_path, status)
        print(json.dumps(status, sort_keys=True), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())

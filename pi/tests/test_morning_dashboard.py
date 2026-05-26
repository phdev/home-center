import os
import stat
import subprocess
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
SCRIPT = REPO_ROOT / "pi" / "morning_dashboard.sh"


def write_executable(path: Path, content: str) -> None:
    path.write_text(content)
    path.chmod(path.stat().st_mode | stat.S_IXUSR)


def fake_tool_env(tmp_path: Path, *, day: str = "1", hour: str = "07", minute: str = "50") -> dict:
    bin_dir = tmp_path / "bin"
    bin_dir.mkdir()
    log_path = tmp_path / "calls.log"

    write_executable(
        bin_dir / "date",
        f"""#!/usr/bin/env bash
case "$1" in
  +%u) echo "{day}" ;;
  +%H) echo "{hour}" ;;
  +%M) echo "{minute}" ;;
  *) exit 2 ;;
esac
""",
    )
    write_executable(
        bin_dir / "curl",
        f"""#!/usr/bin/env bash
printf 'curl %s\\n' "$*" >> "{log_path}"
""",
    )
    write_executable(
        bin_dir / "cec-client",
        f"""#!/usr/bin/env bash
payload="$(cat)"
printf 'cec %s\\n' "$payload" >> "{log_path}"
""",
    )
    write_executable(
        bin_dir / "sleep",
        "#!/usr/bin/env bash\nexit 0\n",
    )

    return {
        **os.environ,
        "PATH": f"{bin_dir}:{os.environ['PATH']}",
        "TZ": "America/Los_Angeles",
    }


def test_morning_dashboard_resets_to_dashboard_before_turning_on_tv(tmp_path):
    result = subprocess.run(
        [str(SCRIPT)],
        cwd=REPO_ROOT,
        env=fake_tool_env(tmp_path),
        text=True,
        capture_output=True,
        check=False,
    )

    assert result.returncode == 0, result.stderr
    calls = (tmp_path / "calls.log").read_text().splitlines()
    assert calls[0].startswith("curl ")
    assert "http://127.0.0.1:8765/api/navigate" in calls[0]
    assert '{"page":"dashboard","view":null}' in calls[0]
    assert calls[1:] == ["cec on 0", "cec as"]


def test_morning_dashboard_skips_reset_outside_weekday_window(tmp_path):
    result = subprocess.run(
        [str(SCRIPT)],
        cwd=REPO_ROOT,
        env=fake_tool_env(tmp_path, hour="08", minute="30"),
        text=True,
        capture_output=True,
        check=False,
    )

    assert result.returncode == 0, result.stderr
    assert "Outside weekday morning dashboard window" in result.stdout
    assert not (tmp_path / "calls.log").exists()

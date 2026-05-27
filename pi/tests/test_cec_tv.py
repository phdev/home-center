import importlib.util
import sys
import threading
import types
from pathlib import Path


def load_wake_word_service():
    sys.modules.setdefault("alsaaudio", types.ModuleType("alsaaudio"))
    sys.modules.setdefault("numpy", types.ModuleType("numpy"))

    openwakeword = sys.modules.setdefault("openwakeword", types.ModuleType("openwakeword"))
    model_module = types.ModuleType("openwakeword.model")
    model_module.Model = object
    openwakeword.model = model_module
    sys.modules["openwakeword.model"] = model_module

    path = Path(__file__).resolve().parents[1] / "wake_word_service.py"
    spec = importlib.util.spec_from_file_location("wake_word_service_under_test", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_turn_on_tv_selects_home_center_hdmi_source(monkeypatch):
    service = load_wake_word_service()
    commands = []

    monkeypatch.setattr(service, "cec_send", lambda command: commands.append(command) or True)
    monkeypatch.setattr(service, "tv_power_status", lambda: "on")
    monkeypatch.setattr(service.time, "sleep", lambda _: None)

    assert service.turn_on_tv()
    assert commands == ["on 0", "as"]


def test_turn_on_tv_still_selects_source_if_power_command_is_not_needed(monkeypatch):
    service = load_wake_word_service()
    commands = []

    def fake_cec_send(command):
        commands.append(command)
        return command == "as"

    monkeypatch.setattr(service, "cec_send", fake_cec_send)
    monkeypatch.setattr(service, "tv_power_status", lambda: "on")
    monkeypatch.setattr(service.time, "sleep", lambda _: None)

    assert service.turn_on_tv()
    assert commands == ["on 0", "as"]


def test_turn_on_dashboard_resets_stale_knowledge_navigation_before_cec(monkeypatch):
    service = load_wake_word_service()
    mgr = service.RecordingManager.__new__(service.RecordingManager)
    mgr._lock = threading.Lock()
    mgr._navigation = {"page": "knowledge", "view": "debug", "timestamp": 1}
    actions = []

    monkeypatch.setattr(service.time, "time", lambda: 1234.5)
    monkeypatch.setattr(mgr, "run_tv_action_async", lambda action: actions.append(action))

    mgr.turn_on_dashboard()

    assert mgr._navigation == {"page": "dashboard", "view": None, "timestamp": 1_234_500}
    assert actions == ["on"]


def test_dashboard_navigation_clears_stale_view(monkeypatch):
    service = load_wake_word_service()
    mgr = service.RecordingManager.__new__(service.RecordingManager)
    mgr._lock = threading.Lock()
    mgr._navigation = {"page": "knowledge", "view": "debug", "timestamp": 1}

    monkeypatch.setattr(service.time, "time", lambda: 5678.9)

    mgr.navigate("dashboard")

    assert mgr._navigation == {"page": "dashboard", "view": None, "timestamp": 5_678_900}


def test_parse_command_matches_negative_knowledge_feedback_phrases():
    service = load_wake_word_service()

    assert service.parse_command("Hey Homer, that was wrong") == {"action": "flag_knowledge_negative"}
    assert service.parse_command("that's wrong") == {"action": "flag_knowledge_negative"}
    assert service.parse_command("wrong answer") == {"action": "flag_knowledge_negative"}
    assert service.parse_command("bad response") == {"action": "flag_knowledge_negative"}
    assert service.parse_command("Hey Homer, bad image") == {"action": "flag_knowledge_image_negative"}
    assert service.parse_command("wrong image") == {"action": "flag_knowledge_image_negative"}
    assert service.parse_command("bad picture") == {"action": "flag_knowledge_image_negative"}
    assert service.parse_command("that image is wrong") == {"action": "flag_knowledge_image_negative"}


def test_parse_command_does_not_loosely_match_other_commands():
    service = load_wake_word_service()

    assert service.parse_command("Hey Homer, what's the weather") != {"action": "flag_knowledge_negative"}
    assert service.parse_command("that was really interesting") != {"action": "flag_knowledge_negative"}
    assert service.parse_command("bad weather") != {"action": "flag_knowledge_negative"}
    assert service.parse_command("answer the question") != {"action": "flag_knowledge_negative"}


def test_parse_command_keeps_answer_and_image_feedback_separate():
    service = load_wake_word_service()

    assert service.parse_command("that was wrong") != {"action": "flag_knowledge_image_negative"}
    assert service.parse_command("bad answer") != {"action": "flag_knowledge_image_negative"}
    assert service.parse_command("bad image") != {"action": "flag_knowledge_negative"}
    assert service.parse_command("wrong picture") != {"action": "flag_knowledge_negative"}

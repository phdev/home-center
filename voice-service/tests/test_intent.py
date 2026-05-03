from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from intent import is_dispatchable_command, parse_command, strip_wake_phrase


def test_empty_wake_phrase_does_not_turn_on_tv():
    assert parse_command("Hey Homer") == {"action": "none"}


def test_explicit_turn_on_required():
    assert parse_command("Hey Homer, turn it on") == {"action": "turn_on"}


def test_turn_off_variants():
    assert parse_command("turn it off") == {"action": "turn_off"}
    assert parse_command("turn it down") == {"action": "turn_off"}


def test_timer_digits_and_words():
    assert parse_command("set a timer for 5 minutes for pasta") == {
        "action": "set_timer",
        "label": "pasta",
        "duration": 300,
    }
    assert parse_command("Hey Homer, set a timer for five minutes") == {
        "action": "set_timer",
        "label": "timer",
        "duration": 300,
    }


def test_navigation_intents():
    assert parse_command("open calendar") == {"action": "navigate", "page": "calendar"}
    assert parse_command("show the weather") == {"action": "navigate", "page": "weather"}
    assert parse_command("go to photos") == {"action": "navigate", "page": "photos"}
    assert parse_command("put on the weather page") == {"action": "navigate", "page": "weather"}
    assert parse_command("photos page") == {"action": "navigate", "page": "photos"}
    assert parse_command("go back") == {"action": "navigate", "page": "dashboard"}
    assert parse_command("dashboard") == {"action": "navigate", "page": "dashboard"}


def test_ask_intent():
    assert parse_command("what is a platypus") == {"action": "ask", "query": "what is a platypus"}
    assert parse_command("what is the weather tomorrow") == {
        "action": "ask",
        "query": "what is the weather tomorrow",
    }
    assert parse_command("do we have school tomorrow") == {
        "action": "ask",
        "query": "do we have school tomorrow",
    }
    assert parse_command("random television conversation keeps going") == {"action": "none"}


def test_dispatchable_command_requires_complete_payload():
    assert not is_dispatchable_command({"action": "none"})
    assert is_dispatchable_command({"action": "stop"})
    assert is_dispatchable_command({"action": "turn_on"})
    assert is_dispatchable_command({"action": "set_timer", "duration": 60})
    assert not is_dispatchable_command({"action": "set_timer", "duration": 0})
    assert is_dispatchable_command({"action": "navigate", "page": "calendar"})
    assert not is_dispatchable_command({"action": "navigate", "page": "settings"})
    assert is_dispatchable_command({"action": "ask", "query": "what time is sunset"})
    assert not is_dispatchable_command({"action": "ask", "query": "ambient speech keeps going"})


def test_strip_wake_phrase_handles_middle_transcripts():
    assert strip_wake_phrase("noise Hey Homer, open calendar") == "open calendar"


def test_strip_wake_phrase_handles_punctuated_okay_homer():
    assert strip_wake_phrase("Okay, Homer, turn on") == "turn on"

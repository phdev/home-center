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


def test_stop_intent_rejects_trailing_hallucinated_words():
    assert parse_command("stop") == {"action": "stop"}
    assert parse_command("dismiss all timers") == {"action": "stop"}
    assert parse_command("cancel the timer") == {"action": "stop"}
    assert parse_command("quiet") == {"action": "stop"}
    assert parse_command("Hey Homer, stop the perfect") == {"action": "none"}
    assert parse_command("Hey Homer, stop the conversation keeps going") == {"action": "none"}


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
    assert parse_command("back") == {"action": "navigate", "page": "dashboard"}
    assert parse_command("back please") == {"action": "navigate", "page": "dashboard"}
    assert parse_command("go home") == {"action": "navigate", "page": "dashboard"}
    assert parse_command("go dashboard") == {"action": "navigate", "page": "dashboard"}
    assert parse_command("go Beck") == {"action": "navigate", "page": "dashboard"}
    assert parse_command("go bag") == {"action": "navigate", "page": "dashboard"}
    assert parse_command("main screen") == {"action": "navigate", "page": "dashboard"}
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


def test_design_feedback_intent():
    assert parse_command("Hey Homer, I like this") == {
        "action": "design_feedback",
        "sentiment": "like",
        "notes": "",
    }
    assert parse_command("Hey Homer, I like this design keep the single hero") == {
        "action": "design_feedback",
        "sentiment": "like",
        "notes": "keep the single hero",
    }
    assert parse_command("Hey Homer, I don't like this design too dense") == {
        "action": "design_feedback",
        "sentiment": "dislike",
        "notes": "too dense",
    }


def test_design_system_version_intent():
    assert parse_command("Hey Homer, show version one") == {
        "action": "design_system",
        "version": "v1",
    }
    assert parse_command("Hey Homer, show version two") == {
        "action": "design_system",
        "version": "v2",
    }
    assert parse_command("switch to v2") == {
        "action": "design_system",
        "version": "v2",
    }


def test_birthday_gift_ordered_intent():
    assert parse_command("Hey Homer, I ordered Kate's gift.") == {
        "action": "birthday_gift_ordered",
        "name": "Kate",
    }
    assert parse_command("Hey Homer, mark Kate's gift as ordered.") == {
        "action": "birthday_gift_ordered",
        "name": "Kate",
    }
    assert parse_command("Hey Homer, mark Kate's birthday as ordered.") == {
        "action": "birthday_gift_ordered",
        "name": "Kate",
    }
    assert is_dispatchable_command({"action": "birthday_gift_ordered", "name": "Kate"})
    assert not is_dispatchable_command({"action": "birthday_gift_ordered", "name": ""})


def test_birthday_gift_ideas_intent():
    assert parse_command("Hey Homer, suggest gift ideas for Kate.") == {
        "action": "birthday_gift_ideas",
        "name": "Kate",
    }
    assert parse_command("Hey Homer, suggest birthday gift ideas for Andrew Howell") == {
        "action": "birthday_gift_ideas",
        "name": "Andrew Howell",
    }
    assert is_dispatchable_command({"action": "birthday_gift_ideas", "name": "Kate"})
    assert not is_dispatchable_command({"action": "birthday_gift_ideas", "name": ""})


def test_needs_action_done_intent():
    assert parse_command("Hey Homer, mark item 1 as done.") == {
        "action": "needs_action_done",
        "index": 1,
    }
    assert parse_command("Hey Homer, mark Needs Action item two as done.") == {
        "action": "needs_action_done",
        "index": 2,
    }
    assert is_dispatchable_command({"action": "needs_action_done", "index": 2})
    assert not is_dispatchable_command({"action": "needs_action_done", "index": 0})


def test_howie_message_intent():
    assert parse_command("Hey Howie, ask Devon if the second Pi is healthy") == {
        "action": "howie_message",
        "message": "ask Devon if the second Pi is healthy",
    }
    assert parse_command("howie send a message to OpenClaw") == {
        "action": "howie_message",
        "message": "send a message to OpenClaw",
    }
    assert parse_command("Hey Howie") == {"action": "none"}


def test_homer_negative_knowledge_feedback_does_not_route_to_howie():
    answer_feedback = parse_command("Hey Homer, bad answer")
    image_feedback = parse_command("Hey Homer, bad image")

    assert answer_feedback == {"action": "knowledge_feedback", "feedback_type": "knowledge"}
    assert image_feedback == {"action": "knowledge_feedback", "feedback_type": "image"}
    assert is_dispatchable_command(answer_feedback)
    assert is_dispatchable_command(image_feedback)


def test_confirmed_mode_ask_intent_requires_explicit_cue():
    assert parse_command("what is a platypus", allow_bare_ask=False) == {"action": "none"}
    assert parse_command("Hey Homer, what's going on? That was very enthusiastic", allow_bare_ask=False) == {
        "action": "none"
    }
    assert parse_command("how big is the sun", allow_bare_ask=False) == {"action": "none"}
    assert parse_command("Hey Homer, how big is the sun", allow_bare_ask=False) == {
        "action": "ask",
        "query": "how big is the sun",
    }
    assert parse_command("Hey Homer, what is the largest planet", allow_bare_ask=False) == {
        "action": "ask",
        "query": "what is the largest planet",
    }
    assert parse_command("ask what is a platypus", allow_bare_ask=False) == {
        "action": "ask",
        "query": "what is a platypus",
    }
    assert parse_command("tell me what is a platypus", allow_bare_ask=False) == {
        "action": "ask",
        "query": "what is a platypus",
    }


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
    assert is_dispatchable_command({"action": "design_feedback", "sentiment": "like"})
    assert is_dispatchable_command({"action": "design_feedback", "sentiment": "dislike"})
    assert is_dispatchable_command({"action": "design_system", "version": "v2"})
    assert not is_dispatchable_command({"action": "design_system", "version": "v3"})
    assert is_dispatchable_command({"action": "howie_message", "message": "hello"})
    assert not is_dispatchable_command({"action": "howie_message", "message": ""})


def test_strip_wake_phrase_handles_middle_transcripts():
    assert strip_wake_phrase("noise Hey Homer, open calendar") == "open calendar"


def test_strip_wake_phrase_handles_punctuated_okay_homer():
    assert strip_wake_phrase("Okay, Homer, turn on") == "turn on"


def test_strip_wake_phrase_handles_observed_vosk_robyn_misrecognition():
    assert parse_command("hey i'm robyn calendar") == {"action": "navigate", "page": "calendar"}
    assert strip_wake_phrase("hey i'm robyn calendar") == "calendar"


def test_observed_vosk_a_homer_calendar_misrecognition_dispatches():
    assert parse_command("a homer of a calendar") == {"action": "navigate", "page": "calendar"}
    assert strip_wake_phrase("a homer of a calendar") == "of a calendar"


def test_observed_vosk_back_command_wake_misrecognitions_dispatch():
    assert parse_command("a hummer go back") == {"action": "navigate", "page": "dashboard"}
    assert parse_command("a number go back") == {"action": "navigate", "page": "dashboard"}
    assert parse_command("hey home or go back") == {"action": "navigate", "page": "dashboard"}
    assert parse_command("he homered go back") == {"action": "navigate", "page": "dashboard"}
    assert strip_wake_phrase("he homered have encountered open calendar") == "have encountered open calendar"


def test_observed_vosk_hey_armor_wake_misrecognition_dispatches():
    assert parse_command("hey armor open family photos") == {"action": "navigate", "page": "photos"}
    assert strip_wake_phrase("hey armor open calendar") == "open calendar"
    assert strip_wake_phrase("a hammer open calendar") == "a hammer open calendar"


def test_observed_vosk_open_photos_misrecognitions_dispatch():
    assert parse_command("hey over open photos") == {"action": "navigate", "page": "photos"}
    assert parse_command("hey i'm are open for us") == {"action": "navigate", "page": "photos"}
    assert strip_wake_phrase("hey over open calendar") == "open calendar"

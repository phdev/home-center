from test_cec_tv import load_wake_word_service


def test_hey_homer_ordered_gift_command_marks_birthday_gift_ordered():
    service = load_wake_word_service()

    assert service.parse_command("Hey Homer, I ordered Kate's gift.") == {
        "action": "birthday_gift_ordered",
        "name": "Kate",
    }


def test_hey_homer_mark_gift_as_ordered_command_marks_birthday_gift_ordered():
    service = load_wake_word_service()

    assert service.parse_command("Hey Homer, mark Andrew's gift as ordered.") == {
        "action": "birthday_gift_ordered",
        "name": "Andrew",
    }


def test_hey_homer_mark_birthday_as_ordered_command_marks_birthday_gift_ordered():
    service = load_wake_word_service()

    assert service.parse_command("Hey Homer, mark Kate's birthday as ordered.") == {
        "action": "birthday_gift_ordered",
        "name": "Kate",
    }


def test_hey_homer_suggest_gift_ideas_command_asks_howie():
    service = load_wake_word_service()

    assert service.parse_command("Hey Homer, suggest gift ideas for Kate.") == {
        "action": "birthday_gift_ideas",
        "name": "Kate",
    }


def test_hey_homer_mark_needs_action_item_done():
    service = load_wake_word_service()

    assert service.parse_command("Hey Homer, mark item 2 as done.") == {
        "action": "needs_action_done",
        "index": 2,
    }
    assert service.parse_command("Hey Homer, mark Needs Action item three as done.") == {
        "action": "needs_action_done",
        "index": 3,
    }

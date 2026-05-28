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

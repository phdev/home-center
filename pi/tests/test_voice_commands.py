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
    assert service.parse_command("Hey Homer, Mark item one is done.") == {
        "action": "needs_action_done",
        "index": 1,
    }
    assert service.parse_command("Hey Homer, Mark item one is complete.") == {
        "action": "needs_action_done",
        "index": 1,
    }
    assert service.parse_command("Hey Homer, remove item 1.") == {
        "action": "needs_action_done",
        "index": 1,
        "operation": "dismiss",
    }
    assert service.parse_command("Hey Homer, dismiss Needs Action item one.") == {
        "action": "needs_action_done",
        "index": 1,
        "operation": "dismiss",
    }
    assert service.parse_command("Hey Homer, delete item one.") == {
        "action": "needs_action_done",
        "index": 1,
        "operation": "dismiss",
    }
    assert service.parse_command("Hey Homer, mark Needs Action item three as done.") == {
        "action": "needs_action_done",
        "index": 3,
    }
    assert service.parse_command("Hey Homer, mark Lock In Dinner as complete.") == {
        "action": "needs_action_done",
        "name": "Lock In Dinner",
    }
    assert service.parse_command("Hey Homer, remove Lock In Dinner.") == {
        "action": "needs_action_done",
        "name": "Lock In Dinner",
        "operation": "dismiss",
    }
    assert service.parse_command("Hey Homer, delete Lock In Dinner.") == {
        "action": "needs_action_done",
        "name": "Lock In Dinner",
        "operation": "dismiss",
    }


def test_hey_homer_wake_log_commands():
    service = load_wake_word_service()

    assert service.parse_command("a Homer Lucy woke up at 6:45") == {
        "action": "wake_log",
        "children": {"lucy": "06:45"},
    }
    assert service.parse_command("Hey Homer, Levy woke up at 7:10") == {
        "action": "wake_log",
        "children": {"livy": "07:10"},
    }
    assert service.parse_command("Hey Homer, both girls woke up at 7:05.") == {
        "action": "wake_log",
        "children": {"lucy": "07:05", "livy": "07:05"},
    }
    assert service.parse_command("Hey Homer, the girls got up at 7") == {
        "action": "wake_log",
        "children": {"lucy": "07:00", "livy": "07:00"},
    }


def test_mark_needs_action_done_forwards_dismiss_operation(monkeypatch):
    service = load_wake_word_service()
    calls = []

    def fake_worker_post(url, token, path, data):
        calls.append({"url": url, "token": token, "path": path, "data": data})
        return {"ok": True}

    monkeypatch.setattr(service, "worker_post", fake_worker_post)

    assert service.mark_needs_action_done(
        "https://worker.example",
        "secret",
        index=1,
        operation="dismiss",
    ) == {"ok": True}
    assert calls == [{
        "url": "https://worker.example",
        "token": "secret",
        "path": "/api/needs-action/done",
        "data": {"index": 1, "operation": "dismiss"},
    }]


def test_log_wake_times_posts_to_worker(monkeypatch):
    service = load_wake_word_service()
    calls = []

    def fake_worker_post(url, token, path, data):
        calls.append({"url": url, "token": token, "path": path, "data": data})
        return {"date": "2026-06-07", "children": data["children"]}

    monkeypatch.setattr(service, "worker_post", fake_worker_post)

    assert service.log_wake_times(
        "https://worker.example",
        "secret",
        {"lucy": "06:45", "livy": "07:10"},
    ) == {"date": "2026-06-07", "children": {"lucy": "06:45", "livy": "07:10"}}
    assert calls == [{
        "url": "https://worker.example",
        "token": "secret",
        "path": "/api/wake-times/today",
        "data": {"children": {"lucy": "06:45", "livy": "07:10"}, "source": "voice"},
    }]

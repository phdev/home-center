import importlib.util
from pathlib import Path


def load_watchdog():
    path = Path(__file__).resolve().parents[1] / "kiosk" / "kiosk-watchdog.py"
    spec = importlib.util.spec_from_file_location("kiosk_watchdog_under_test", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_kiosk_state_checks_renderer_not_just_tab_title(monkeypatch):
    watchdog = load_watchdog()
    monkeypatch.setattr(watchdog, "fetch_json", lambda path: [{
        "title": "Home Center",
        "url": "http://localhost:8080/home-center/",
        "webSocketDebuggerUrl": "ws://127.0.0.1:9222/devtools/page/test",
    }])
    monkeypatch.setattr(watchdog, "evaluate_page_health", lambda page: (False, "home center root is empty"))

    assert watchdog.kiosk_state() == (False, "home center root is empty")


def test_kiosk_state_detects_aw_snap_title_before_renderer_probe(monkeypatch):
    watchdog = load_watchdog()
    monkeypatch.setattr(watchdog, "fetch_json", lambda path: [{
        "title": "Aw, Snap!",
        "url": "http://localhost:8080/home-center/",
        "webSocketDebuggerUrl": "ws://127.0.0.1:9222/devtools/page/test",
    }])

    called = False

    def evaluate_page_health(page):
        nonlocal called
        called = True
        return True, "ok"

    monkeypatch.setattr(watchdog, "evaluate_page_health", evaluate_page_health)

    ok, reason = watchdog.kiosk_state()
    assert not ok
    assert "crashed tab" in reason
    assert not called


def test_evaluate_page_health_rejects_empty_root(monkeypatch):
    watchdog = load_watchdog()
    monkeypatch.setattr(watchdog, "_websocket_request", lambda *args, **kwargs: {
        "id": 1,
        "result": {
            "result": {
                "value": {
                    "title": "Home Center",
                    "readyState": "complete",
                    "rootChildren": 0,
                    "bodyText": "",
                    "hasViteErrorOverlay": False,
                },
            },
        },
    })

    assert watchdog.evaluate_page_health({"webSocketDebuggerUrl": "ws://test"}) == (
        False,
        "home center root is empty",
    )


def test_evaluate_page_health_rejects_windowed_chromium(monkeypatch):
    watchdog = load_watchdog()
    monkeypatch.setattr(watchdog, "_websocket_request", lambda *args, **kwargs: {
        "id": 1,
        "result": {
            "result": {
                "value": {
                    "title": "Home Center",
                    "readyState": "complete",
                    "innerWidth": 500,
                    "innerHeight": 129,
                    "devicePixelRatio": 2,
                    "screenWidth": 3840,
                    "screenHeight": 2160,
                    "rootChildren": 2,
                    "bodyText": "The Howell Hub",
                    "hasViteErrorOverlay": False,
                },
            },
        },
    })

    ok, reason = watchdog.evaluate_page_health({"webSocketDebuggerUrl": "ws://test"})
    assert not ok
    assert reason.startswith("chromium viewport is windowed: 500x129 css")


def test_evaluate_page_health_accepts_rendered_dashboard(monkeypatch):
    watchdog = load_watchdog()
    monkeypatch.setattr(watchdog, "_websocket_request", lambda *args, **kwargs: {
        "id": 1,
        "result": {
            "result": {
                "value": {
                    "title": "Home Center",
                    "readyState": "complete",
                    "innerWidth": 1920,
                    "innerHeight": 1080,
                    "devicePixelRatio": 2,
                    "screenWidth": 3840,
                    "screenHeight": 2160,
                    "rootChildren": 1,
                    "bodyText": "Calendar Weather Photos",
                    "hasViteErrorOverlay": False,
                },
            },
        },
    })

    assert watchdog.evaluate_page_health({"webSocketDebuggerUrl": "ws://test"}) == (True, "ok")

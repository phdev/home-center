from pathlib import Path
import sys

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from voice_service import (
    AudioActivityHeartbeat,
    command_from_transcript,
    CONFIRM_WAKE_PHRASE_RE,
    confirmed_command_from_transcript,
    confirmed_dispatches,
    dispatchable_commands_from_transcript,
    is_max_speech_candidate,
    is_local_stt_engine,
    is_strong_speech_candidate,
    next_speech_empty_backoff_until,
    passes_recent_speech_gate,
    recent_speech_stats,
    should_skip_speech_candidate_confirmation,
    speech_candidate_skip_reason,
    speech_candidate_stats_from_source,
    should_log_openwakeword_audio,
    should_log_openwakeword_score,
    should_emit_verifying_transcription,
    SpeechCandidateDetector,
    SpeechSegmentDebounce,
    update_noise_floor,
    updated_speech_max_empty_backoff_until,
    validate_wake_mode_config,
)


def test_recent_speech_gate_rejects_quiet_dnn_hit():
    stats = recent_speech_stats(
        [28, 34, 42, 38, 31],
        noise_floor=80,
        min_active_rms=180,
        active_rms_multiplier=1.8,
    )

    assert stats == {"gate": 180, "peak": 42, "active_chunks": 0}
    assert not passes_recent_speech_gate(stats, min_peak_rms=450, min_active_chunks=2)


def test_recent_speech_gate_accepts_recent_speech_even_if_trigger_frame_is_quiet():
    stats = recent_speech_stats(
        [62, 91, 760, 1180, 280, 43],
        noise_floor=90,
        min_active_rms=180,
        active_rms_multiplier=1.8,
    )

    assert stats == {"gate": 180, "peak": 1180, "active_chunks": 3}
    assert passes_recent_speech_gate(stats, min_peak_rms=450, min_active_chunks=2)


def test_openwakeword_score_probe_requires_score_speech_and_interval():
    stats = {"gate": 180, "peak": 1180, "active_chunks": 3}

    assert should_log_openwakeword_score(
        score=0.42,
        stats=stats,
        min_score=0.2,
        min_active_chunks=2,
        now=10.0,
        last_logged_at=9.0,
        interval_seconds=0.5,
    )
    assert not should_log_openwakeword_score(
        score=0.1,
        stats=stats,
        min_score=0.2,
        min_active_chunks=2,
        now=10.0,
        last_logged_at=9.0,
        interval_seconds=0.5,
    )
    assert not should_log_openwakeword_score(
        score=0.42,
        stats={"gate": 180, "peak": 220, "active_chunks": 1},
        min_score=0.2,
        min_active_chunks=2,
        now=10.0,
        last_logged_at=9.0,
        interval_seconds=0.5,
    )
    assert not should_log_openwakeword_score(
        score=0.42,
        stats=stats,
        min_score=0.2,
        min_active_chunks=2,
        now=10.0,
        last_logged_at=9.8,
        interval_seconds=0.5,
    )


def test_openwakeword_audio_probe_requires_raw_activity_and_interval():
    assert should_log_openwakeword_audio(
        stats={"gate": 240, "peak": 210, "active_chunks": 0},
        min_recent_peak_rms=180,
        now=10.0,
        last_logged_at=8.9,
        interval_seconds=1.0,
    )
    assert should_log_openwakeword_audio(
        stats={"gate": 240, "peak": 160, "active_chunks": 1},
        min_recent_peak_rms=180,
        now=10.0,
        last_logged_at=8.9,
        interval_seconds=1.0,
    )
    assert not should_log_openwakeword_audio(
        stats={"gate": 240, "peak": 120, "active_chunks": 0},
        min_recent_peak_rms=180,
        now=10.0,
        last_logged_at=8.9,
        interval_seconds=1.0,
    )
    assert not should_log_openwakeword_audio(
        stats={"gate": 240, "peak": 210, "active_chunks": 0},
        min_recent_peak_rms=180,
        now=10.0,
        last_logged_at=9.5,
        interval_seconds=1.0,
    )


def test_audio_activity_heartbeat_summarizes_quiet_windows(monkeypatch):
    monkeypatch.setattr("voice_service.time.time", lambda: 10.0)
    heartbeat = AudioActivityHeartbeat(interval_seconds=2.0)
    heartbeat.record(12)
    heartbeat.record(48)

    assert not heartbeat.should_log(now=11.9)
    assert heartbeat.should_log(now=12.1)
    snapshot = heartbeat.snapshot_and_reset(now=12.1)
    assert 2.0 < snapshot["window"] < 2.2
    assert snapshot["chunks"] == 2
    assert snapshot["max_rms"] == 48
    assert snapshot["avg_rms"] == 30
    assert not heartbeat.should_log(now=14.2)


def test_speech_segment_debounce_allows_one_confirmation_until_silence_or_cooldown():
    debounce = SpeechSegmentDebounce(silence_seconds=0.4)

    debounce.update(chunk_rms=500, speech_gate=180, chunk_seconds=0.08)
    assert debounce.can_confirm(now=1.0)

    debounce.mark_confirmed(now=1.0, empty=True, empty_cooldown_seconds=3.0)
    assert not debounce.can_confirm(now=1.5)

    for _ in range(5):
        debounce.update(chunk_rms=20, speech_gate=180, chunk_seconds=0.08)

    assert not debounce.active
    assert not debounce.confirmed_in_segment
    assert not debounce.can_confirm(now=2.0)
    assert debounce.can_confirm(now=4.1)


def test_speech_segment_debounce_does_not_block_after_capture_ended_in_silence():
    debounce = SpeechSegmentDebounce(silence_seconds=0.16)
    debounce.update(chunk_rms=500, speech_gate=180, chunk_seconds=0.08)
    debounce.update(chunk_rms=20, speech_gate=180, chunk_seconds=0.08)
    debounce.update(chunk_rms=20, speech_gate=180, chunk_seconds=0.08)

    assert not debounce.active
    debounce.mark_confirmed(now=1.0, empty=False, empty_cooldown_seconds=4.0)

    assert not debounce.confirmed_in_segment
    assert debounce.can_confirm(now=1.1)


def test_speech_candidate_detector_triggers_after_active_segment_silence():
    detector = SpeechCandidateDetector(
        cooldown=0.0,
        end_silence_seconds=0.16,
        min_peak_rms=450,
        min_active_chunks=3,
        min_active_rms=180,
        active_rms_multiplier=1.8,
        min_segment_seconds=0.2,
        pre_roll_seconds=0.0,
        max_segment_seconds=0.0,
    )
    active = np.full(1280, 600, dtype=np.int16)
    quiet = np.zeros(1280, dtype=np.int16)

    assert detector.accept(active)[0] is False
    assert detector.accept(active)[0] is False
    assert detector.accept(active)[0] is False
    assert detector.accept(quiet)[0] is False
    hit, text, source = detector.accept(quiet)

    assert hit
    assert text == ""
    assert source.startswith("speech:peak=600:active=3")


def test_speech_candidate_detector_rejects_short_quiet_segments():
    detector = SpeechCandidateDetector(
        cooldown=0.0,
        end_silence_seconds=0.16,
        min_peak_rms=450,
        min_active_chunks=3,
        min_active_rms=180,
        active_rms_multiplier=1.8,
        min_segment_seconds=0.2,
        pre_roll_seconds=0.0,
        max_segment_seconds=0.0,
    )
    active = np.full(1280, 300, dtype=np.int16)
    quiet = np.zeros(1280, dtype=np.int16)

    detector.accept(active)
    detector.accept(quiet)
    hit, _, _ = detector.accept(quiet)

    assert not hit


def test_speech_candidate_detector_exposes_segment_audio_with_preroll():
    detector = SpeechCandidateDetector(
        cooldown=0.0,
        end_silence_seconds=0.16,
        min_peak_rms=450,
        min_active_chunks=3,
        min_active_rms=180,
        active_rms_multiplier=1.8,
        min_segment_seconds=0.2,
        pre_roll_seconds=0.16,
        max_segment_seconds=0.0,
    )
    preroll = np.full(1280, 12, dtype=np.int16)
    active = np.full(1280, 600, dtype=np.int16)
    quiet = np.zeros(1280, dtype=np.int16)

    detector.accept(preroll)
    detector.accept(active)
    detector.accept(active)
    detector.accept(active)
    detector.accept(quiet)
    hit, _, _ = detector.accept(quiet)

    assert hit
    audio = detector.consume_last_segment_audio()
    assert len(audio) == 6 * 1280
    assert np.all(audio[:1280] == 12)
    assert np.all(audio[1280:4 * 1280] == 600)
    assert np.all(audio[4 * 1280:] == 0)
    assert len(detector.consume_last_segment_audio()) == 0


def test_noise_floor_does_not_learn_active_speech():
    assert update_noise_floor(100.0, chunk_rms=800.0, active_gate=180.0) == 100.0
    assert update_noise_floor(100.0, chunk_rms=40.0, active_gate=180.0) < 100.0


def test_speech_candidate_detector_keeps_short_command_after_loud_segment():
    detector = SpeechCandidateDetector(
        cooldown=0.0,
        end_silence_seconds=0.16,
        min_peak_rms=450,
        min_active_chunks=3,
        min_active_rms=180,
        active_rms_multiplier=1.8,
        min_segment_seconds=0.2,
        pre_roll_seconds=0.0,
        max_segment_seconds=0.0,
    )
    loud = np.full(1280, 2500, dtype=np.int16)
    stop_like = np.full(1280, 520, dtype=np.int16)
    quiet = np.zeros(1280, dtype=np.int16)

    for _ in range(140):
        detector.accept(loud)
    detector.accept(quiet)
    hit, _, _ = detector.accept(quiet)
    assert hit

    detector.accept(stop_like)
    detector.accept(stop_like)
    detector.accept(stop_like)
    detector.accept(quiet)
    hit, _, source = detector.accept(quiet)

    assert hit
    assert source.startswith("speech:peak=520:active=3")


def test_speech_candidate_detector_caps_long_active_segments():
    detector = SpeechCandidateDetector(
        cooldown=0.0,
        end_silence_seconds=0.65,
        min_peak_rms=450,
        min_active_chunks=3,
        min_active_rms=180,
        active_rms_multiplier=1.8,
        min_segment_seconds=0.2,
        pre_roll_seconds=0.0,
        max_segment_seconds=0.24,
    )
    active = np.full(1280, 600, dtype=np.int16)

    detector.accept(active)
    detector.accept(active)
    hit, _, source = detector.accept(active)

    assert hit
    assert source.startswith("speech:peak=600:active=3:duration=0.2")
    assert source.endswith(":reason=max")


def test_speech_candidate_max_empty_backoff_only_skips_max_segments():
    assert is_max_speech_candidate("speech:peak=600:active=3:duration=6.0:gate=180:reason=max")
    assert not is_max_speech_candidate("speech:peak=600:active=3:duration=1.0:gate=180:reason=silence")

    until = next_speech_empty_backoff_until(
        "speech",
        "speech:peak=600:active=3:duration=6.0:gate=180:reason=max",
        now=10.0,
        backoff_seconds=12.0,
    )

    assert until == 22.0
    assert should_skip_speech_candidate_confirmation(
        "speech",
        "speech:peak=600:active=3:duration=6.0:gate=180:reason=max",
        now=15.0,
        max_empty_backoff_until=until,
    )
    assert not should_skip_speech_candidate_confirmation(
        "speech",
        "speech:peak=600:active=3:duration=1.0:gate=180:reason=silence",
        now=15.0,
        max_empty_backoff_until=until,
    )
    assert not should_skip_speech_candidate_confirmation(
        "openwakeword",
        "dnn:hey_homer:0.950",
        now=15.0,
        max_empty_backoff_until=until,
    )
    assert not should_skip_speech_candidate_confirmation(
        "always-stt",
        "speech:peak=600:active=3:duration=6.0:gate=180:reason=max",
        now=15.0,
        max_empty_backoff_until=until,
    )
    assert next_speech_empty_backoff_until(
        "always-stt",
        "speech:peak=600:active=3:duration=6.0:gate=180:reason=max",
        now=10.0,
        backoff_seconds=12.0,
    ) == 0.0


def test_speech_candidate_max_empty_backoff_preserves_existing_window_on_non_max_empty():
    current_until = 40.0

    assert updated_speech_max_empty_backoff_until(
        current_until,
        "speech",
        "speech:peak=600:active=3:duration=1.0:gate=180:reason=silence",
        now=15.0,
        backoff_seconds=30.0,
    ) == current_until
    assert updated_speech_max_empty_backoff_until(
        current_until,
        "speech",
        "speech:peak=600:active=3:duration=6.0:gate=180:reason=max",
        now=15.0,
        backoff_seconds=30.0,
    ) == 45.0


def test_speech_candidate_source_stats_and_strong_override():
    source = "speech:peak=3253:active=15:duration=1.9:gate=180:reason=silence"

    assert speech_candidate_stats_from_source(source) == {
        "peak": 3253.0,
        "active": 15,
        "duration": 1.9,
        "gate": 180.0,
        "reason": "silence",
    }
    assert is_strong_speech_candidate(source, min_peak_rms=1800, min_active_chunks=12)
    assert not is_strong_speech_candidate(source, min_peak_rms=4000, min_active_chunks=12)
    assert not is_strong_speech_candidate(source, min_peak_rms=1800, min_active_chunks=20)
    assert not is_strong_speech_candidate("dnn:hey_homer:0.950", min_peak_rms=1800, min_active_chunks=12)


def test_speech_candidate_empty_backoff_skips_weak_segments_but_allows_strong_segments():
    weak_source = "speech:peak=769:active=12:duration=2.2:gate=180:reason=silence"
    strong_source = "speech:peak=3253:active=15:duration=1.9:gate=180:reason=silence"

    assert should_skip_speech_candidate_confirmation(
        "speech",
        weak_source,
        now=15.0,
        max_empty_backoff_until=0.0,
        empty_backoff_until=20.0,
        empty_backoff_strong_min_peak_rms=1800,
        empty_backoff_strong_min_active_chunks=12,
    )
    assert speech_candidate_skip_reason(
        "speech",
        weak_source,
        now=15.0,
        max_empty_backoff_until=0.0,
        empty_backoff_until=20.0,
        empty_backoff_strong_min_peak_rms=1800,
        empty_backoff_strong_min_active_chunks=12,
    ) == "empty_backoff"
    assert not should_skip_speech_candidate_confirmation(
        "speech",
        strong_source,
        now=15.0,
        max_empty_backoff_until=0.0,
        empty_backoff_until=20.0,
        empty_backoff_strong_min_peak_rms=1800,
        empty_backoff_strong_min_active_chunks=12,
    )
    assert not should_skip_speech_candidate_confirmation(
        "always-stt",
        weak_source,
        now=15.0,
        max_empty_backoff_until=0.0,
        empty_backoff_until=20.0,
        empty_backoff_strong_min_peak_rms=1800,
        empty_backoff_strong_min_active_chunks=12,
    )


def test_command_from_transcript_ignores_bare_wake():
    assert command_from_transcript("Hey Homer") == ("", {"action": "none"})


def test_command_from_transcript_confirms_valid_command():
    assert command_from_transcript("Hey Homer, show the weather") == (
        "show the weather",
        {"action": "navigate", "page": "weather"},
    )


def test_command_from_transcript_uses_latest_wake_for_merged_preroll():
    assert command_from_transcript("Hey Homer, open calendar. Hey Homer, show the weather.") == (
        "show the weather",
        {"action": "navigate", "page": "weather"},
    )


def test_dispatchable_commands_from_transcript_reports_merged_wake_commands():
    assert dispatchable_commands_from_transcript(
        "On. Hey Homer, open calendar. Hey Homer, show the weather."
    ) == [
        {"body": "open calendar", "command": {"action": "navigate", "page": "calendar"}},
        {"body": "show the weather", "command": {"action": "navigate", "page": "weather"}},
    ]


def test_dispatchable_commands_from_transcript_splits_punctuated_okay_homer():
    assert dispatchable_commands_from_transcript("Okay, Homer, turn on. Okay, Homer, open calendar.") == [
        {"body": "turn on", "command": {"action": "turn_on"}},
        {"body": "open calendar", "command": {"action": "navigate", "page": "calendar"}},
    ]


def test_dispatchable_commands_from_transcript_keeps_leading_clipped_command():
    assert dispatchable_commands_from_transcript(
        "Homer, open calendar. Hey Homer, show the weather. Hey Homer, set a timer for 10 seconds."
    ) == [
        {"body": "Homer, open calendar", "command": {"action": "navigate", "page": "calendar"}},
        {"body": "show the weather", "command": {"action": "navigate", "page": "weather"}},
        {"body": "set a timer for 10 seconds", "command": {"action": "set_timer", "label": "timer", "duration": 10}},
    ]


def test_confirmed_command_falls_back_to_latest_dispatchable_candidate():
    assert confirmed_command_from_transcript("Hey Homer, turn on. Hey Homer, open.") == (
        "turn on",
        {"action": "turn_on"},
        [{"body": "turn on", "command": {"action": "turn_on"}}],
    )


def test_confirmed_command_prefers_latest_complete_body_when_dispatchable():
    assert confirmed_command_from_transcript(
        "Homer, open calendar. Hey Homer, show the weather. Hey Homer, set a timer for 10 seconds."
    ) == (
        "set a timer for 10 seconds",
        {"action": "set_timer", "label": "timer", "duration": 10},
        [
            {"body": "Homer, open calendar", "command": {"action": "navigate", "page": "calendar"}},
            {"body": "show the weather", "command": {"action": "navigate", "page": "weather"}},
            {"body": "set a timer for 10 seconds", "command": {"action": "set_timer", "label": "timer", "duration": 10}},
        ],
    )


def test_confirmed_dispatches_default_to_latest_command():
    body, command, candidates = confirmed_command_from_transcript(
        "Hey Homer, turn on. Hey Homer, open calendar. Hey Homer, show the weather."
    )

    assert confirmed_dispatches(body, command, candidates) == [
        {"body": "show the weather", "command": {"action": "navigate", "page": "weather"}}
    ]


def test_confirmed_dispatches_can_return_all_wake_qualified_candidates():
    body, command, candidates = confirmed_command_from_transcript(
        "Hey Homer, turn on. Hey Homer, open calendar. Hey Homer, show the weather."
    )

    assert confirmed_dispatches(body, command, candidates, dispatch_all=True) == [
        {"body": "turn on", "command": {"action": "turn_on"}},
        {"body": "open calendar", "command": {"action": "navigate", "page": "calendar"}},
        {"body": "show the weather", "command": {"action": "navigate", "page": "weather"}},
    ]


def test_confirmed_dispatches_do_not_dispatch_empty_candidates():
    assert confirmed_dispatches("", {"action": "none"}, [], dispatch_all=True) == []


def test_speech_candidates_do_not_emit_verifying_caption_by_default():
    assert not should_emit_verifying_transcription("speech")
    assert not should_emit_verifying_transcription("always-stt")
    assert should_emit_verifying_transcription("speech", speech_candidate_emit_verifying=True)
    assert should_emit_verifying_transcription("always-stt", speech_candidate_emit_verifying=True)
    assert should_emit_verifying_transcription("openwakeword")
    assert should_emit_verifying_transcription("vosk")


def test_local_stt_engines_require_wake_confirmation():
    assert is_local_stt_engine("speech")
    assert is_local_stt_engine("always-stt")
    assert not is_local_stt_engine("openwakeword")
    assert not is_local_stt_engine("vosk")


def test_local_stt_engines_require_confirmed_command_mode():
    validate_wake_mode_config("speech", True)
    validate_wake_mode_config("always-stt", True)
    validate_wake_mode_config("openwakeword", False)
    validate_wake_mode_config("vosk", False)

    try:
        validate_wake_mode_config("always-stt", False)
    except SystemExit as exc:
        assert "WAKE_CONFIRM_COMMAND=1" in str(exc)
    else:
        raise AssertionError("always-stt must not run outside confirmed-command mode")


def test_confirmed_command_can_require_wake_phrase_for_speech_candidates():
    assert confirmed_command_from_transcript(
        "set a timer for ten seconds",
        require_wake_phrase=True,
    ) == ("", {"action": "none"}, [])
    assert confirmed_command_from_transcript(
        "Hey Homer, set a timer for ten seconds",
        require_wake_phrase=True,
    ) == (
        "set a timer for ten seconds",
        {"action": "set_timer", "label": "timer", "duration": 10},
        [{"body": "set a timer for ten seconds", "command": {"action": "set_timer", "label": "timer", "duration": 10}}],
    )


def test_confirmed_command_accepts_constrained_stt_wake_variants():
    assert confirmed_command_from_transcript(
        "We're open calendar. Day Homer. Show the weather.",
        require_wake_phrase=True,
        wake_re=CONFIRM_WAKE_PHRASE_RE,
    ) == (
        "Show the weather",
        {"action": "navigate", "page": "weather"},
        [{"body": "Show the weather", "command": {"action": "navigate", "page": "weather"}}],
    )
    assert confirmed_command_from_transcript(
        "Another 8-homer set a timer for 10 seconds.",
        require_wake_phrase=True,
        wake_re=CONFIRM_WAKE_PHRASE_RE,
    ) == (
        "set a timer for 10 seconds",
        {"action": "set_timer", "label": "timer", "duration": 10},
        [{"body": "set a timer for 10 seconds", "command": {"action": "set_timer", "label": "timer", "duration": 10}}],
    )


def test_confirmed_command_wake_required_does_not_dispatch_unrelated_prefix():
    assert confirmed_command_from_transcript(
        "turn on. Hey Homer, open.",
        require_wake_phrase=True,
    ) == ("open", {"action": "none"}, [])


def test_command_from_transcript_allows_command_only_stt_after_candidate_wake():
    assert command_from_transcript("set a timer for ten seconds", fallback_text="Hey Homer") == (
        "set a timer for ten seconds",
        {"action": "set_timer", "label": "timer", "duration": 10},
    )


def test_command_from_transcript_rejects_non_command_speech_shape():
    assert command_from_transcript("random television conversation keeps going") == (
        "random television conversation keeps going",
        {"action": "none"},
    )

from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from validate_voice import summarize_log


def test_summarize_log_counts_voice_validation_metrics():
    text = """
16:40:10 [INFO] Wake hit via Vosk partial: 'hey homer open calendar' rms=111 noise=100
16:40:10 [INFO] Chime request completed in 42ms
16:40:10 [INFO] Fast command from Vosk wake transcript body='open calendar' command={'action': 'navigate', 'page': 'calendar'} total=11ms
16:40:10 [INFO] Dispatching: {'action': 'navigate', 'page': 'calendar'}
16:40:14 [INFO] Wake hit via Vosk partial: 'hey homer' rms=111 noise=100
16:40:15 [INFO] Command transcript='Hey Homer set a timer for ten seconds' body='set a timer for ten seconds' command={'action': 'set_timer', 'label': 'timer', 'duration': 10} capture=2800ms pre=1600ms post=1200ms total=912ms
16:40:15 [INFO] Dispatching: {'action': 'set_timer', 'label': 'timer', 'duration': 10}
16:40:18 [INFO] Wake hit via Vosk partial: 'hey homer' rms=111 noise=100
16:40:19 [INFO] Rejecting incomplete command body='ambient speech keeps going' command={'action': 'ask', 'query': 'ambient speech keeps going'}
16:40:19 [INFO] No valid command after wake; no dispatch.
"""

    summary = summarize_log(text, expected_count=4)

    assert summary["wake_hits"] == 3
    assert summary["dispatches"] == 2
    assert summary["miss_count"] == 2
    assert summary["miss_rate"] == 0.5
    assert summary["candidate_miss_count"] == 4
    assert summary["candidate_miss_rate"] == 1.0
    assert summary["fast_path_commands"] == 1
    assert summary["command_transcripts"] == 1
    assert summary["confirmed_command_transcripts"] == 0
    assert summary["rejected_commands"] == 1
    assert summary["no_command_after_wake"] == 1
    assert summary["ignored_candidate_wakes"] == 0
    assert summary["skipped_candidate_wakes"] == {}
    assert summary["openwakeword_score_probes"]["count"] == 0
    assert summary["openwakeword_audio_probes"]["count"] == 0
    assert summary["openwakeword_audio_heartbeats"]["count"] == 0
    assert summary["heard_command_candidates"] == 0
    assert summary["commands_by_action"] == {
        "navigate:calendar": 1,
        "set_timer": 1,
    }
    assert summary["chime_request_ms"]["median"] == 42
    assert summary["wake_to_action_ms"]["values"] == [11, 912]


def test_summarize_log_counts_confirmed_command_mode():
    text = """
16:50:10 [INFO] Wake hit via openwakeword dnn:hey_homer:0.950: 'Hey Homer' rms=500 noise=100
16:50:12 [INFO] Confirmed-command transcript='Hey Homer show the weather' body='show the weather' command={'action': 'navigate', 'page': 'weather'} capture=7000ms pre=5000ms post=2000ms total=1120ms
16:50:12 [INFO] Chime request completed in 44ms
16:50:12 [INFO] Dispatching: {'action': 'navigate', 'page': 'weather'}
16:50:20 [INFO] Wake hit via openwakeword dnn:hey_homer:0.930: 'Hey Homer' rms=430 noise=100
16:50:20 [INFO] Confirmed-command candidates=[]
16:50:22 [INFO] Confirmed-command transcript='' body='' command={'action': 'none'} capture=7000ms pre=5000ms post=2000ms total=980ms
16:50:22 [INFO] Ignoring candidate wake after confirmation; no valid command.
16:50:23 [INFO] Skipping openWakeWord wake via dnn:hey_homer:0.940: reason=same_segment segmentActive=True quiet=0.0s cooldownRemaining=3.5s rms=600 noise=100 recentPeak=900 activeChunks=4 gate=216
16:50:24 [INFO] Skipping speech candidate via speech:peak=600:active=75:duration=6.0:gate=180:reason=max: reason=max_empty_backoff cooldownRemaining=8.0s rms=300 noise=200
16:50:25 [INFO] Skipping speech candidate via speech:peak=769:active=12:duration=2.2:gate=180:reason=silence: reason=empty_backoff cooldownRemaining=4.0s rms=84 noise=107
16:50:23 [INFO] OpenWakeWord audio probe score=0.010 threshold=0.920 consecutive=0/3 rms=190 noise=120 recentPeak=210 activeChunks=0 gate=216
16:50:23 [INFO] OpenWakeWord audio heartbeat window=2.0s chunks=25 maxRms=190 avgRms=42 noise=120 lastScore=0.010
16:50:24 [INFO] OpenWakeWord score probe score=0.420 threshold=0.920 consecutive=0/3 rms=620 noise=120 recentPeak=900 activeChunks=4 gate=216
16:50:26 [INFO] Confirmed-command candidates=[{'body': 'open calendar', 'command': {'action': 'navigate', 'page': 'calendar'}}, {'body': 'show the weather', 'command': {'action': 'navigate', 'page': 'weather'}}]
"""

    summary = summarize_log(text, expected_count=1)

    assert summary["wake_hits"] == 2
    assert summary["confirmed_command_transcripts"] == 2
    assert summary["dispatches"] == 1
    assert summary["ignored_candidate_wakes"] == 1
    assert summary["skipped_candidate_wakes"] == {"empty_backoff": 1, "max_empty_backoff": 1, "same_segment": 1}
    assert summary["commands_by_action"] == {"navigate:weather": 1}
    assert summary["heard_commands_by_action"] == {
        "navigate:calendar": 1,
        "navigate:weather": 1,
    }
    assert summary["heard_command_candidates"] == 2
    assert summary["candidate_miss_count"] == 0
    assert summary["candidate_miss_rate"] == 0.0
    assert summary["wake_to_action_ms"]["values"] == [1120]
    assert summary["openwakeword_score_probes"]["count"] == 1
    assert summary["openwakeword_score_probes"]["max_score"] == 0.42
    assert summary["openwakeword_score_probes"]["max_recent_peak"] == 900
    assert summary["openwakeword_audio_probes"]["count"] == 1
    assert summary["openwakeword_audio_probes"]["max_score"] == 0.01
    assert summary["openwakeword_audio_probes"]["max_rms"] == 190
    assert summary["openwakeword_audio_probes"]["max_recent_peak"] == 210
    assert summary["openwakeword_audio_heartbeats"]["count"] == 1
    assert summary["openwakeword_audio_heartbeats"]["max_rms"] == 190
    assert summary["openwakeword_audio_heartbeats"]["max_avg_rms"] == 42
    assert summary["openwakeword_audio_heartbeats"]["max_score"] == 0.01

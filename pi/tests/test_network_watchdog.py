import importlib.util
import subprocess
import unittest
from pathlib import Path
from unittest import mock


def load_watchdog():
    path = Path(__file__).resolve().parents[1] / "network-watchdog.py"
    spec = importlib.util.spec_from_file_location("network_watchdog_under_test", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def completed(stdout="", stderr="", returncode=0):
    return subprocess.CompletedProcess([], returncode, stdout, stderr)


class NetworkWatchdogTest(unittest.TestCase):
    def test_network_state_accepts_active_lan_gateway_and_avahi(self):
        watchdog = load_watchdog()

        def fake_run(args, timeout=5):
            if args[:2] == ["systemctl", "is-active"]:
                return completed("active\n")
            if args == ["hostname", "-I"]:
                return completed("192.168.1.206 fd00::1\n")
            if args == ["ip", "route", "show", "default"]:
                return completed("default via 192.168.1.1 dev wlan0 proto dhcp src 192.168.1.206\n")
            if args[:1] == ["ping"]:
                return completed()
            raise AssertionError(args)

        with mock.patch.object(watchdog, "run", fake_run):
            self.assertEqual(watchdog.network_state(), (True, "ok"))

    def test_network_state_rejects_missing_lan_ip(self):
        watchdog = load_watchdog()

        def fake_run(args, timeout=5):
            if args[:2] == ["systemctl", "is-active"]:
                return completed("active\n")
            if args == ["hostname", "-I"]:
                return completed("fd00::1\n")
            raise AssertionError(args)

        with mock.patch.object(watchdog, "run", fake_run):
            self.assertEqual(watchdog.network_state(), (False, "no LAN IPv4 address"))

    def test_network_state_rejects_missing_default_gateway(self):
        watchdog = load_watchdog()

        def fake_run(args, timeout=5):
            if args[:2] == ["systemctl", "is-active"]:
                return completed("active\n")
            if args == ["hostname", "-I"]:
                return completed("192.168.1.206\n")
            if args == ["ip", "route", "show", "default"]:
                return completed("")
            raise AssertionError(args)

        with mock.patch.object(watchdog, "run", fake_run):
            self.assertEqual(watchdog.network_state(), (False, "no default gateway"))

    def test_network_state_rejects_unreachable_gateway(self):
        watchdog = load_watchdog()

        def fake_run(args, timeout=5):
            if args[:2] == ["systemctl", "is-active"]:
                return completed("active\n")
            if args == ["hostname", "-I"]:
                return completed("192.168.1.206\n")
            if args == ["ip", "route", "show", "default"]:
                return completed("default via 192.168.1.1 dev wlan0\n")
            if args[:1] == ["ping"]:
                return completed(returncode=1)
            raise AssertionError(args)

        with mock.patch.object(watchdog, "run", fake_run):
            self.assertEqual(watchdog.network_state(), (False, "default gateway unreachable: 192.168.1.1"))

    def test_recover_network_restarts_network_manager_then_avahi(self):
        watchdog = load_watchdog()
        calls = []

        def fake_run(args, timeout=5):
            calls.append(args)
            return completed()

        with (
            mock.patch.object(watchdog, "run", fake_run),
            mock.patch.object(watchdog.time, "sleep", lambda seconds: calls.append(["sleep", str(seconds)])),
        ):
            watchdog.recover_network("test")

        self.assertEqual(calls, [
            ["systemctl", "restart", "NetworkManager"],
            ["sleep", "5"],
            ["systemctl", "restart", "avahi-daemon"],
        ])


if __name__ == "__main__":
    unittest.main()

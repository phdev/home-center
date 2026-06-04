#!/usr/bin/env python3
"""Recover Home Center Pis when Wi-Fi/mDNS drops but the kiosk is still visible."""

from __future__ import annotations

import re
import subprocess
import time


CHECK_INTERVAL_SECONDS = 30
FAILURES_BEFORE_RECOVERY = 3
RECOVERY_COOLDOWN_SECONDS = 180
NETWORK_MANAGER_SERVICE = "NetworkManager"
AVAHI_SERVICE = "avahi-daemon"


def run(args: list[str], timeout: int = 5) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        args,
        check=False,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        timeout=timeout,
    )


def service_state(service: str) -> str:
    result = run(["systemctl", "is-active", service])
    return result.stdout.strip() or result.stderr.strip() or "unknown"


def hostname_ips() -> list[str]:
    result = run(["hostname", "-I"])
    if result.returncode != 0:
        return []
    return [item for item in result.stdout.split() if item]


def default_gateway() -> str | None:
    result = run(["ip", "route", "show", "default"])
    if result.returncode != 0:
        return None
    match = re.search(r"\bdefault\s+via\s+(\S+)", result.stdout)
    return match.group(1) if match else None


def gateway_reachable(gateway: str) -> bool:
    result = run(["ping", "-c", "1", "-W", "2", gateway], timeout=4)
    return result.returncode == 0


def network_state() -> tuple[bool, str]:
    network_manager = service_state(NETWORK_MANAGER_SERVICE)
    if network_manager != "active":
        return False, f"{NETWORK_MANAGER_SERVICE} is {network_manager}"

    ips = hostname_ips()
    has_lan_ip = any(ip.startswith("192.168.") or ip.startswith("10.") or ip.startswith("172.") for ip in ips)
    if not has_lan_ip:
        return False, "no LAN IPv4 address"

    gateway = default_gateway()
    if not gateway:
        return False, "no default gateway"
    if not gateway_reachable(gateway):
        return False, f"default gateway unreachable: {gateway}"

    avahi = service_state(AVAHI_SERVICE)
    if avahi != "active":
        return False, f"{AVAHI_SERVICE} is {avahi}"

    return True, "ok"


def recover_network(reason: str) -> None:
    print(f"[network-watchdog] recovering network: {reason}", flush=True)
    run(["systemctl", "restart", NETWORK_MANAGER_SERVICE], timeout=20)
    time.sleep(5)
    run(["systemctl", "restart", AVAHI_SERVICE], timeout=20)


def main() -> None:
    failures = 0
    last_recovery = 0.0

    while True:
        ok, reason = network_state()
        if ok:
            if failures:
                print("[network-watchdog] recovered without restart", flush=True)
            failures = 0
        else:
            failures += 1
            print(
                f"[network-watchdog] unhealthy ({failures}/{FAILURES_BEFORE_RECOVERY}): {reason}",
                flush=True,
            )
            now = time.monotonic()
            if (
                failures >= FAILURES_BEFORE_RECOVERY
                and now - last_recovery >= RECOVERY_COOLDOWN_SECONDS
            ):
                recover_network(reason)
                last_recovery = now
                failures = 0

        time.sleep(CHECK_INTERVAL_SECONDS)


if __name__ == "__main__":
    main()

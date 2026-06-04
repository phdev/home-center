# Home Center Two Offline Incident - 2026-06-04

## Summary

Home Center Two was powered and showing the dashboard, but it had fallen off the
network. The screen was rendering cached/local browser state, which made it look
like Home Center was up while live Worker-backed data and Mac voice routing were
unreachable.

## Evidence

- Before reboot, `homecenter2.local` did not resolve from the Mac mini.
- `192.168.1.206` had incomplete ARP from the Mac mini and was not reachable
  from Home Center One.
- The Mac mini voice service for Home Center Two looped on:
  `Mic stream connect failed ([Errno 8] nodename nor servname provided, or not known)`.
- After power cycle, Home Center Two came back as `192.168.1.206` with:
  - SSH on `:22`
  - Pi command API on `:8765`
  - mic stream on `:8766`
  - Avahi advertising `homecenter2.local`
- Previous boot logs show Wi-Fi association failures:
  `supplicant-timeout`, `association took too long`, and `no-secrets`, followed
  by withdrawal of the `192.168.1.206` mDNS address.

## Recovery

- Verified the deployed bundle on both Home Centers:
  `assets/index-BpVR9uJ_.js` and `assets/index-j3nbY4Vh.css`.
- Verified Chromium localStorage on Home Center Two has the Worker URL and a
  Worker token present without exposing the token.
- Restarted `kiosk-watchdog` on Home Center Two.
- Installed and started `network-watchdog` on both Home Centers.
- Reloaded the Home Center Two Chromium kiosk through CDP.
- Restarted the Mac mini Home Center Two voice service.
- Re-ran Home Center Two voice health; it returned `ok: true`.

## Prevention

`npm run monitor:homecenters` now checks both Pis end-to-end:

- DNS/mDNS resolution.
- Pi command API `/api/navigate`.
- SSH hostname and required services:
  `dashboard-local`, `wake-word`, `kiosk-watchdog`, `network-watchdog`, and
  `avahi-daemon`.
- Deployed dashboard bundle in `dashboard-local/home-center`.
- Chromium page health and redacted Worker settings, including whether a Worker
  token is present.

The monitor fails fast on the exact failure modes from this incident: Pi
unreachable, mDNS missing, command API down, watchdog inactive, stale/missing
bundle, Chromium not on Home Center, or missing Worker token that would leave the
dashboard on local fallback data.

`network-watchdog` now runs on each Pi and handles the local recovery path:
after repeated failures for LAN IPv4 address, default route, gateway
reachability, NetworkManager, or Avahi, it restarts NetworkManager and Avahi
with a cooldown. This covers the failure class where the kiosk remains visible
but the Pi has dropped off Wi-Fi/mDNS and cannot be reached from the Mac mini.

The Mac mini also runs `com.homecenter.node-health` every 5 minutes via
launchd. It writes `logs/homecenter-node-health-status.json`, stores the last
full monitor output at `logs/homecenter-node-health-last.json`, and raises a
macOS notification on failure.

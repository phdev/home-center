# Mac Mini deploy templates

Sanitized provisioning templates for the Home Center services that run on a
Mac Mini. These are **reproducible, generic**, and contain no secrets or
machine-specific paths — all real values are supplied at install time via
environment variables or sed substitution.

## What runs here

| Service | Purpose | launchd label |
|---|---|---|
| OpenClaw Telegram bridge | Family-facing chat bot (persona + skill live in `openclaw/prompts/`) | `com.openclaw.bridge` |
| Email triage | Classify Gmail, fan out to worker + Telegram | `com.homecenter.email-triage` |
| School updates | Pull school emails into the worker | `com.homecenter.school-updates` |
| Design Claw | Daily design-exploration digest to Telegram (runs once at 08:15) | `com.homecenter.design-claw` |
| Design Claw listener | Polls Telegram DMs every 5 min; parses replies as design feedback, merges into memory | `com.homecenter.design-claw-listener` |

## What does **not** live here

Personal developer-agent automation (PR review bots, agent spawners,
"Homer CI") is out of scope for this product repo. If you had code here
for that, it has been relocated outside the repo.

## First-time setup

### OpenClaw Telegram bridge

1. Create a bot with [@BotFather](https://t.me/BotFather), copy the token.
2. From the repo root:

   ```bash
   export TELEGRAM_BOT_TOKEN="<token-from-botfather>"
   export WORKER_URL="https://home-center-api.<you>.workers.dev"
   bash deploy/mac-mini/setup-openclaw-bridge.sh
   ```

   The script installs dependencies, substitutes the placeholders in
   `com.openclaw.bridge.plist`, writes a locked-down copy to
   `~/Library/LaunchAgents/`, loads the agent, and hits `/status` to verify.

3. Get your numeric chat ID (message the bot, then):
   ```bash
   curl "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/getUpdates" \
     | python3 -c "import json,sys; print([u['message']['chat']['id'] for u in json.load(sys.stdin)['result']])"
   ```

### Email triage / school updates

Each of these services has its own secrets (Gmail OAuth + worker auth
token) — the plist templates here do **not** include them. Copy
`email-triage/config.example.yaml` → `email-triage/config.yaml`, drop in
your worker `AUTH_TOKEN` and chat ID, then:

```bash
# Substitute __REPO_DIR__ and __WORKER_URL__ and install the plist
sed \
  -e "s|__REPO_DIR__|$PWD|g" \
  -e "s|__WORKER_URL__|$WORKER_URL|g" \
  deploy/mac-mini/com.homecenter.email-triage.plist \
  > ~/Library/LaunchAgents/com.homecenter.email-triage.plist

launchctl load ~/Library/LaunchAgents/com.homecenter.email-triage.plist
```

Same pattern for `com.homecenter.school-updates.plist`.

### Design Claw (daily + listener)

A separate **design-focused** bot (not the OpenClaw family bot) and a
separate OpenAI key. One script installs both launchd jobs (the 08:15
daily and the 5-minute feedback poller). See
[`docs/design_claw.md`](../../docs/design_claw.md) for the workflow.

```bash
export OPENAI_API_KEY="sk-..."
export TELEGRAM_BOT_TOKEN="<design-bot token from @BotFather>"
export TELEGRAM_CHAT_ID="<your DM chat id>"
bash deploy/mac-mini/setup-design-claw.sh
```

The script installs `openai` + `playwright` (with Chromium), renders
both plists into `~/Library/LaunchAgents/` at mode `600`, and loads
both agents. After that, replying to David in Telegram is a valid
feedback channel — the listener picks up the message within 5 minutes,
parses it via the feedback prompt, merges into `design_memory/`, and
acks.

## Troubleshooting

- **Bridge won't start** — check `openclaw/logs/bridge-stderr.log`. Common
  causes: wrong `NODE_PATH` in the plist (Apple Silicon Homebrew puts node
  at `/opt/homebrew/bin/node`), missing `TELEGRAM_BOT_TOKEN`, stale plist
  owned by a previous user.
- **Bridge returns 503 "Telegram not connected"** — token is wrong or the
  bot has been revoked. Check `@BotFather` → `/mybots`.
- **Token rotation** — regenerate in `@BotFather`, re-run
  `setup-openclaw-bridge.sh` with the new token. The script
  unloads/reloads the agent.

## Security notes

- The rendered `~/Library/LaunchAgents/com.openclaw.bridge.plist` contains
  the Telegram bot token in plaintext. `setup-openclaw-bridge.sh` `chmod 600`s
  it so only the current user can read it. Do **not** commit a rendered plist.
- Gmail `credentials.json` and `token.json` files in `email-triage/` and
  `school-updates/` are covered by the root `.gitignore`; confirm with
  `git check-ignore` before assuming.
- The Cloudflare worker URL itself is not secret, but the `AUTH_TOKEN` you
  configure is. Set it with `wrangler secret put AUTH_TOKEN` on the
  worker side, not in source.

# Home Center MCP

Home Center has two API layers:

- Product surfaces (kiosk, voice, Telegram, future plain mobile apps) use the HTTP capability layer.
- Agentic surfaces use this MCP server, which wraps the same HTTP/Pi capabilities as tools.

The MCP server never stores credentials. Set tokens in the host environment.

## Environment

```sh
export HOME_CENTER_API_URL="https://your-worker.example"
export HOME_CENTER_AUTH_TOKEN="..."
export HOME_CENTER_PI_URL="http://homecenter.local:8765"
```

`HOME_CENTER_AUTH_TOKEN` is optional only when the Worker has no `AUTH_TOKEN` configured.

## Tools

- `calendar_read`: read calendar events from the Worker.
- `home_today`: read a compact household state snapshot.
- `set_timer`: create a Home Center timer with `source: "mcp"`.
- `tv_power`: turn the TV `on` or `off`; requires `confirm: true`.
- `knowledge_query`: ask through Home Center's knowledge query endpoint.

`home://today` is also exposed as a read-only MCP resource.

## Claude Desktop

Copy `claude_desktop_config.example.json`, replace `/Users/peter/home-center` if needed, and set environment values locally. Do not paste real tokens into the repo.

What you'll see: Claude can list Home Center tools, read the calendar, set a timer, ask a knowledge question, and control TV power only when the tool call includes explicit confirmation.

## Minimal Custom Agent

Run:

```sh
HOME_CENTER_API_URL="https://your-worker.example" \
HOME_CENTER_AUTH_TOKEN="..." \
HOME_CENTER_PI_URL="http://homecenter.local:8765" \
node docs/integrations/home-center-mcp/custom-agent.mjs
```

The sample checks today's calendar. If there is an early event, it sets a wake reminder and turns the TV on with explicit confirmation.

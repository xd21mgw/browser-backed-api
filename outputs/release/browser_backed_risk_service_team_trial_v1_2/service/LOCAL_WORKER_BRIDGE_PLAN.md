# Local Worker Bridge Plan

This document defines the deployment plan for using the Browser-backed Risk
Platform Access Service when the main Agent is remote/cloud-hosted but the
browser-backed service must run on a teammate's own computer.

## Why This Is Needed

The service listens on `127.0.0.1` by default. In Local Agent Mode, that is the
teammate's own computer, so `http://127.0.0.1:8787` works directly.

In Remote Main Agent + Local Worker Mode, the main Agent runs somewhere else.
For that Agent, `127.0.0.1` means the remote/cloud runtime, not the teammate's
computer. The Agent therefore needs a configured `service_base_url` that points
to a controlled bridge or tunnel reaching the teammate's local worker.

Default local value:

```txt
service_base_url=http://127.0.0.1:8787
```

Remote value:

```txt
service_base_url=<controlled bridge/tunnel URL>
```

The remote value can be provided through `BROWSER_BACKED_SERVICE_BASE_URL` or
the upper-layer Agent's equivalent configuration.

## Modes

### Local Agent Mode

- Agent, local scripts, curl, and browser-backed service run on the same
  computer.
- Use `http://127.0.0.1:8787`.
- No bridge or tunnel is required.
- `npm run open:profile`, `npm run refresh:once`, and `npm run start:live` are
  unchanged.

### Remote Main Agent + Local Worker Mode

- Main Agent runs in a remote/cloud environment.
- Browser-backed service runs on the teammate's computer.
- The teammate's computer acts as the local worker.
- Main Agent calls the configured `service_base_url`, which reaches the local
  worker through a controlled bridge/tunnel.
- Chrome profile and refresh state remain local to the teammate's computer.

### Temporary Profile Bootstrap Mode

This is a same-user temporary profile activation path, not a bridge/tunnel
deployment.

Use it only when the machine that will run `refresh:once`, `start:live`, and
actions has no GUI and cannot run `npm run open:profile` directly.

- A GUI Mac may be used temporarily by the same user for first-time profile
  activation, periodic Archives/account confirmation, SSO, or required human
  verification.
- It is only for profile activation or confirmation.
- It must not be used for long-term action forwarding.
- After activation, action execution still happens on the main Agent's local
  machine only if that same user's usable profile is available there.
- Do not share profiles across users.
- Do not upload cookies, tokens, sessions, request headers, browser storage,
  storageState, or profile contents.
- Do not let the Agent inspect profile files.

Mode positioning:

- Local Agent Mode is the default local mode.
- Remote Main Agent + Local Worker Mode is the formal team remote-Agent shape.
- Temporary Profile Bootstrap Mode is a debugging/transition profile activation
  path only.

## Short-Term Options

1. SSH port forward
   - Useful for a small controlled pilot.
   - Requires explicit user setup and access control.
   - Should forward only the local service port and only for the test window.

2. Internal tunnel
   - Useful when teammates are on an internal network/VPN.
   - Must include access control and auditability.
   - Must not expose arbitrary local ports or URLs.

3. Local worker registration to a central gateway
   - The teammate's local worker initiates an outbound connection to a central
     gateway.
   - Main Agent calls the gateway, which routes to the selected local worker.
   - This avoids exposing the local service directly to the public internet.

## Recommended Long-Term Team Shape

Use a Local Worker + central registry/gateway design:

- Each teammate runs the browser-backed service locally.
- Each local worker registers availability with a central gateway.
- The main Agent resolves a teammate/local-worker target through the registry.
- The main Agent calls a configured `service_base_url` for that local worker.
- The gateway forwards only approved service routes.

## Bridge/Tunnel Route Boundary

A bridge/tunnel may forward only:

- `GET /health`
- `GET /actions`
- `POST /actions/<allowlisted_action>`
- `POST /actions/batch`
- `POST /actions/multi_source_plan`

It must not provide:

- arbitrary URL fetch
- arbitrary local file access
- arbitrary platform path access
- request-header injection
- cookie/token/session/header forwarding
- Chrome profile access
- localStorage, browser storage, or Playwright storageState export

## Access Control Requirements

The bridge/tunnel should have at least one of:

- temporary access token
- internal network ACL
- user confirmation before enabling a session
- short-lived session binding to a specific main Agent
- audit log for action name, timestamp, and transport status

The access control must never require sharing browser profile directories,
cookies, tokens, sessions, request headers, storageState, or `.env` files with
the remote Agent.

## Safety Boundary

- Do not copy or upload Chrome profiles.
- Do not upload refresh state files.
- Do not forward cookies, tokens, sessions, authorization values, passwords, or
  request headers.
- Do not expose the browser-backed service directly to the public internet.
- Do not add arbitrary URL/path/header/cookie/token/session capabilities.
- Do not call DataAgent/Hive through the browser-backed service.
- Do not make the service perform summary, evidence card, source quality, or
  risk judgment work.

This release documents the bridge/tunnel requirement but does not implement a
bridge, tunnel, registry, or gateway.

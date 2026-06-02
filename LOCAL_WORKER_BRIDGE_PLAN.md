# Local Worker Bridge Plan

This document defines the deployment plan for using the Browser-backed Risk
Platform Access Service when the main Agent is remote/cloud-hosted but platform
access must happen through a user's Mac browser session.

## Why This Is Needed

The service listens on `127.0.0.1` by default. In Local Agent Mode, that is the
same computer running the Agent, so `http://127.0.0.1:8787` works directly.

In Remote Main Agent + Mac Local Worker Mode, the main Agent runs somewhere
else. For that Agent, `127.0.0.1` means the remote/cloud/Linux runtime, not the
user's Mac. The Agent therefore needs a configured `service_base_url` that
points to a controlled bridge or tunnel reaching the Mac local worker.

Default local value:

```txt
service_base_url=http://127.0.0.1:8787
```

Remote value:

```txt
service_base_url=<mac_worker_or_bridge_url>
```

The remote value can be provided through `BROWSER_BACKED_SERVICE_BASE_URL` or
the upper-layer Agent's equivalent configuration.

## Supported Modes

### Local Agent Mode

- Agent, local scripts, curl, and browser-backed service run on the same
  computer.
- Use `http://127.0.0.1:8787`.
- No bridge or tunnel is required.
- `npm run open:profile`, `npm run refresh:once`, and `npm run start:live` are
  unchanged.

### Remote Main Agent + Mac Local Worker Mode

This is the recommended path for remote/cloud/Linux main Agents.

- Main Agent runs remotely, in cloud, or on Linux.
- Browser-backed service runs on the user's Mac.
- Chrome profile and refresh state remain on the user's Mac.
- The user completes SSO, two-factor checks, and Archives account confirmation
  in Mac Chrome.
- Main Agent calls a configured `service_base_url` that points to the Mac local
  worker through Mac node, bridge, or tunnel.
- Remote Agent invokes fixed service actions only; it does not receive profile
  files or authentication material.

This matches the successful rc-cli style path: authentication and platform
access remain local to Mac, while the remote Agent invokes bounded worker
capabilities.

## Daily User Experience

First setup may require Mac command authorization, opening Mac Chrome, SSO,
two-factor checks, and Archives account confirmation. After that, the Mac
worker should stay running for the test window.

Daily remote main Agent queries should:

- call `service_base_url/actions/<action_name>`
- reuse the existing Mac profile
- avoid opening Chrome every time
- avoid repeated ad hoc command approvals
- return only passthrough envelope summaries

Recommended fixed Mac worker commands:

- `npm run worker:start`
- `npm run worker:status`
- `npm run worker:stop`
- `npm run worker:doctor`

If readiness expires, the service attempts lightweight landing-flow activation
in refresh/prewarm/ensure-ready. If password, 2FA, QR, or captcha appears, it
returns `manual_login_required`.

## Not Recommended: Profile Copy To Linux Headless

Do not present Mac profile copy/bootstrap to Linux headless as a teammate
workflow.

Joint testing showed that after Mac profile bootstrap to Linux, Track Analysis
may become ready, but RCP, Weapon, Login Logs, and Archives can trigger
`two_factor_required`. This path is a historical experiment only and is not a
stable team deployment option.

Do not ask teammates to copy Mac profiles to Linux, inject cookies, inject
storageState, or run `sso_session.py` as a normal browser-backed service setup.

## Auth State Transfer POC

Auth State Transfer is a candidate POC, not the current recommended deployment.
It should validate whether same-user bounded auth state can be activated on Mac
and loaded on the main Agent machine without copying a full Chrome profile
directory.

Until that POC is proven, use Mac Local Worker for remote main Agents. If the
POC succeeds, it can become a v1.6 focus area or a promoted deployment mode.

## Short-Term Bridge Options

1. SSH port forward
   - Useful for a small controlled pilot.
   - Requires explicit user setup and access control.
   - Should forward only the browser-backed service port and only for the test
     window.

2. Internal tunnel
   - Useful when teammates are on an internal network/VPN.
   - Must include access control and auditability.
   - Must not expose arbitrary local ports or URLs.

3. Mac node worker
   - A small deployment wrapper can start or reach the Mac service and expose a
     controlled worker URL to the remote main Agent.
   - The wrapper should route only approved browser-backed service paths.

4. Local worker registration to a central gateway
   - The Mac local worker initiates an outbound connection to a central gateway.
   - Main Agent calls the gateway, which routes to the selected Mac worker.
   - This avoids exposing the Mac service directly to the public internet.

## Recommended Long-Term Team Shape

Use a Mac Local Worker + central registry/gateway design:

- Each teammate runs the browser-backed service on their own Mac.
- Each Mac worker registers availability with a central gateway.
- The main Agent resolves a teammate/Mac worker target through the registry.
- The main Agent calls a configured `service_base_url` for that Mac worker.
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

- Do not copy profiles to Linux as the standard workflow.
- Do not upload Chrome profiles.
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

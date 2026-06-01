# Mac Local Worker Guide

Use this guide when the main Agent runs remotely or on Linux, but the
browser-backed risk service should access risk platforms through the user's Mac
Chrome profile.

## When To Use

Use Mac Local Worker Mode for remote/cloud/Linux main Agents.

- Main Agent is remote.
- Browser-backed service runs on the user's Mac.
- Chrome profile stays on the user's Mac.
- User completes SSO, two-factor checks, and Archives account confirmation in
  the Mac GUI.
- Main Agent calls the Mac service through Mac node, bridge, or tunnel.

Do not use Mac profile copy to Linux headless as the normal workflow. Joint
testing showed that RCP, Weapon, Login Logs, and Archives can trigger
`two_factor_required` after profile bootstrap to Linux.

## Start The Service On Mac

Unpack the release on the Mac and enter the service directory:

```sh
cd browser_backed_risk_service_team_trial_v1_4/service
```

Install dependencies:

```sh
npm install
```

Open the service profile:

```sh
npm run open:profile
```

In the visible Mac browser, complete SSO, two-factor checks, and any Archives
account confirmation. Then return to the terminal and press Enter.

Refresh once:

```sh
npm run refresh:once
```

Start live service:

```sh
npm run start:live
```

Keep this terminal open while the remote main Agent is using the Mac worker.

## Check On Mac

From another Mac terminal:

```sh
curl http://127.0.0.1:8787/health
curl http://127.0.0.1:8787/actions
```

Expected:

- `/health ok=true`
- `auth_state=ready`, or the needed origin is ready
- `action_count=19`
- no credential material output

## Main Agent Calling Pattern

The remote main Agent should call the configured Mac worker URL:

```txt
{service_base_url}/health
{service_base_url}/actions
{service_base_url}/actions/<action_name>
```

`service_base_url` should point to the Mac node worker, bridge, or tunnel URL.
For example:

```sh
BROWSER_BACKED_SERVICE_BASE_URL=<bridge_or_mac_worker_url>
```

When recording smoke results, capture only envelope fields:

- `http_status`
- `ok`
- `action`
- `response_mode`
- `upstream.status`
- `upstream.content_type`
- `upstream.body_present`
- `upstream.body_omitted`
- `error_type`
- `safety.credential_material_output`

Do not paste full upstream body.

## Bridge/Tunnel Boundary

The bridge/tunnel may forward only:

- `GET /health`
- `GET /actions`
- `POST /actions/<allowlisted_action>`
- `POST /actions/batch`
- `POST /actions/multi_source_plan`

It must not expose:

- arbitrary URL fetch
- arbitrary platform path access
- Chrome profile files
- cookie/token/session/header values
- request headers
- localStorage or browser storage
- Playwright storageState
- `.env` files

The bridge/tunnel should have access control such as internal ACL, temporary
token, user confirmation, or an equivalent deployment guard.

## Stop The Mac Service

Stop the `npm run start:live` terminal with Ctrl+C.

Check whether port 8787 is still listening:

```sh
lsof -ti tcp:8787
```

If a profile lock appears, check for existing service/refresh/open-profile
processes before retrying. Do not delete the profile to fix a lock unless it is
known disposable test data.

## Safety Rules

- Do not copy the Mac profile to Linux as the team workflow.
- Do not upload cookie/token/session/header values.
- Do not read Chrome cookie DB.
- Do not use storageState injection.
- Do not use `sso_session.py`.
- Do not open arbitrary URL fetch.
- Do not expose the Mac service directly to the public internet.
- Do not let the Agent read profile files.

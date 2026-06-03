# Browser-Backed Risk Platform Access Service

Browser-backed Risk Platform Access Service / 风控统一受控透传服务.

This service runs on a teammate's own computer and listens on `127.0.0.1` by
default. It gives Agent, Skill, and local scripts a controlled way to call fixed
risk-platform actions with typed params through the teammate's own Chrome
profile and platform permissions.

Agents should call the service through a configured `service_base_url`.

- Default local value: `http://127.0.0.1:8787`
- Local Agent Mode: Agent, script, or curl runs on the same computer as the
  service, so the default value works.
- Remote Main Agent + Mac Local Worker Mode: the main Agent runs in a
  remote/cloud/Linux environment, while browser-backed service and Chrome
  profile stay on the teammate's Mac. In that mode, set
  `BROWSER_BACKED_SERVICE_BASE_URL` or the Agent's equivalent config to a
  controlled Mac local worker/bridge URL.

The bridge/tunnel is a deployment-layer requirement, not part of this service
release. The verified low-approval Mac proxy forwards only `/health`,
`/actions`, and `/actions/<allowlisted_action>` to the teammate's Mac local
worker; it must not expose arbitrary URL fetch, Chrome profile files, cookies,
tokens, sessions, or request headers.

Remote Mac worker day-to-day usage should be low-friction:

- First setup may require Mac command authorization, opening Mac Chrome, SSO,
  two-factor checks, and Archives account confirmation.
- The user's Mac must be powered on, online, and running the browser-backed
  service.
- MyFlicker / Mac node client, or the approved equivalent Mac worker channel,
  must stay connected for remote main Agent calls.
- Chrome profile must not be locked by another Chrome/Playwright process.
- Daily queries should not open a browser every time.
- Daily queries should not require repeated command approvals.
- Keep the Mac worker running when possible and let the remote main Agent call
  only `service_base_url/actions/<action_name>`.
- If MyFlicker / Mac node is offline, the remote main Agent cannot call the Mac
  worker. Reconnect the Mac client instead of trying profile copy, cookie
  injection, storageState injection, or `sso_session.py`.
- If login/confirmation expires, readiness/prewarm/ensure-ready first attempts
  lightweight landing-flow activation. If password, 2FA, QR, or captcha appears,
  the service returns `manual_login_required`.

MyFlicker / Mac node only provides a controlled way for the remote main Agent to
run status/action calls on the Mac or reach the Mac worker `service_base_url`.
It does not read authentication material and does not replace the
browser-backed service.

The service only does:

- fixed action allowlist
- typed params validation
- fixed origin/path/body construction
- browser session and origin readiness/prewarm
- same-origin fetch through the local browser context
- bounded upstream business body passthrough and response-size guard
- credential-material output protection
- transport status envelope
- controlled parallel batch scheduling

The service does not do business parsing, observations, evidence cards, source
quality scoring, risk judgments, no-data interpretation, next-step
recommendations, DataAgent/Hive calls, permission bypass, or automatic upstream
write/disposal actions.

Current `action_count=37`.

Useful entry points:

- Interface truth: [`ACTION_REGISTRY.md`](./ACTION_REGISTRY.md)
- Capability map: [`CAPABILITY_INDEX.yaml`](./CAPABILITY_INDEX.yaml)
- User playbook: [`ACTION_PLAYBOOK.md`](./ACTION_PLAYBOOK.md)
- Remote success paths:
  [`REMOTE_MAIN_AGENT_SUCCESS_PATHS.md`](./REMOTE_MAIN_AGENT_SUCCESS_PATHS.md)
- Mac worker guide: [`MAC_LOCAL_WORKER_GUIDE.md`](./MAC_LOCAL_WORKER_GUIDE.md)
- Command workflow:
  [`BROWSER_BACKED_SERVICE_COMMANDS.md`](./BROWSER_BACKED_SERVICE_COMMANDS.md)

Remote install/transfer hard rule: follow
[`REMOTE_MAIN_AGENT_SUCCESS_PATHS.md`](./REMOTE_MAIN_AGENT_SUCCESS_PATHS.md).
The main agent must not improvise base64 chunks, per-file writes, KCDN/ad hoc
uploads, SSH/SCP guessing, profile copy, `sso_session.py`, cookie injection,
storageState injection, arbitrary URL fetch, or profile/state/auth-state
transfer. If the verified transfer path or Mac command approval fails, stop and
report the blocking issue.

## Safety Boundary

The service must not read or output:

- Chrome cookie DB contents
- cookies, tokens, sessions, authorization values, passwords
- request headers or response `set-cookie` headers
- Chrome profile files
- localStorage / browser storage dumps
- Playwright storage state
- caller-provided URL/path/header/cookie/token/session/raw body/raw query

The upstream business response body is visible to the caller when it fits within
the configured passthrough cap. Large responses return bounded
`upstream.body_snippet` or `upstream.capped_body` plus truncation metadata. The
service still suppresses request/browser/service credential material and never
returns request headers, `set-cookie`, Chrome profile files, localStorage, or
Playwright storage state.

## Action Layers

All actions are passthrough-only at the service layer. `response_mode` defaults
to `passthrough`; legacy modes are rejected.

### Fixed Actions

| action_name | origin_key |
| --- | --- |
| `track_analysis_summary` | `track_analysis` |
| `login_logs_search` | `login_logs` |
| `weapon_inventory` | `weapon` |
| `rcp_snapshot` | `rcp` |
| `archives_user_profile` | `archives` |
| `archives_user_analysis` | `archives` |
| `archives_photo_search` | `archives` |
| `archives_photo_profile` | `archives` |
| `archives_photo_meta` | `archives` |
| `archives_photo_report_aggregate` | `archives` |
| `archives_photo_user_autonomy` | `archives` |
| `archives_gallery_photo_list` | `archives` |
| `archives_related_users` | `archives` |
| `archives_private_message_search` | `archives` |
| `archives_past_four_items` | `archives` |
| `rcp_event_detail` | `rcp` |
| `rcp_event_feature_list` | `rcp` |
| `rcp_event_tree_or_decision` | `rcp` |
| `rcp_fast_query_hbase` | `rcp` |
| `rcp_feature_info_by_keys` | `rcp` |
| `rcp_policy_basic_info` | `rcp` |
| `rcp_relation_policy_tree` | `rcp` |
| `rcp_policy_binding_info_list` | `rcp` |
| `rcp_policy_search` | `rcp` |
| `rcp_policy_blur_search` | `rcp` |
| `rcp_policy_all_version` | `rcp` |
| `rcp_pipeline_policy_versions_by_code` | `rcp` |
| `rcp_policy_version_lookup` | `rcp` |
| `rcp_policy_detail_lookup` | `rcp` |
| `rcp_policy_release_record_lookup` | `rcp` |
| `rcp_policy_tree_lookup` | `rcp` |
| `rcp_node_policy_attribution` | `rcp` |
| `rcp_node_bind_policy_attribution` | `rcp` |
| `track_analysis_check_data_ready` | `track_analysis` |
| `track_analysis_product_list` | `track_analysis` |
| `track_sequence_dimension_list` | `track_analysis` |
| `track_data_type_list` | `track_analysis` |

Excluded noise remains non-callable: telemetry, radar/misc/log collection,
log-sdk traffic, JS/CSS/static assets, h5-fingerprint, mobile-device-info,
menu/config probes without direct service value, arbitrary URL fetch, and any
cookie/token/session/header capability.

## Single Action Envelope

Example shape:

```json
{
  "ok": true,
  "action": "login_logs_search",
  "action_name": "login_logs_search",
  "request_id": "local_xxx",
  "request_mode": "fixed_action",
  "response_mode": "passthrough",
  "platform": "login_logs",
  "http_status": 200,
  "content_type": "application/json",
  "body_present": true,
  "body_truncated": false,
  "observed_bytes": 1234,
  "elapsed_ms": 42,
  "transport_error": null,
  "platform_error": null,
  "invalid_params": false,
  "timeout": false,
  "auth_redirect_detected": false,
  "raw_body_handling": "visible",
  "upstream": {
    "status": 200,
    "content_type": "application/json",
    "body_present": true,
    "body_omitted": false,
    "body_truncated": false,
    "response_too_large": false,
    "observed_bytes": 1234,
    "returned_bytes": 1234,
    "raw_body_handling": "visible",
    "body": {
      "data": {}
    }
  },
  "meta": {
    "origin": "login_logs",
    "latency_ms": 42,
    "fetched_at": "2026-06-01T00:00:00.000Z"
  },
  "safety": {
    "credential_material_output": false,
    "request_headers_output": false,
    "browser_profile_material_output": false,
    "transport_auth_material_output": false,
    "upstream_business_body_visible": true
  }
}
```

The upstream business response body is visible by default when it fits within
the passthrough size cap. The default body cap is 5MB and can be overridden with
`MAX_LIVE_BODY_BYTES`. Large responses return `upstream.body_snippet` or
`upstream.capped_body` with `raw_body_handling=capped` instead of a full body.
Field projection and user-facing compact tables belong in the calling main
agent or downstream parser, not in this service.
Actions that expect API JSON do not treat front-end HTML as data. For example,
`login_logs_search` returns `unexpected_html_response` /
`api_contract_mismatch` if the fixed API call returns a workbench HTML page
instead of JSON `data.logSearchModels`.
The service still never outputs request headers, response `set-cookie` headers,
browser cookie jars, Chrome profile contents, localStorage/browser storage, or
Playwright storage state.

## Controlled Batch

Batch endpoints:

- `POST /actions/batch`
- `POST /actions/multi_source_plan`

Batch is a scheduler over fixed actions. It is not a generic HTTP client.

Supported execution modes:

- `independent_parallel`
- `dependency_serial`
- `large_response_serial`
- `auth_sensitive_serial`

Batch output contains:

- `source_results`
- `transport_status_matrix`
- `classifications`
- `missing_or_failed_sources`
- execution group metadata
- safety metadata

One source failure does not block unrelated sources. Batch still does not
produce business observations, evidence cards, source quality, or final risk
judgment.

## Skill-Managed Workflow

The Agent Skill should behave like a command-oriented helper, similar to an
rc-cli workflow:

- `/browser-backed-risk-service 安装`
- `/browser-backed-risk-service 启动`
- `/browser-backed-risk-service 状态`
- `/browser-backed-risk-service actions`
- `/browser-backed-risk-service 自测用户 <user_id>`
- `/browser-backed-risk-service 调用 <action> <params>`
- `/browser-backed-risk-service 停止`
- `/browser-backed-risk-service 排障`

The Skill resolves `service_base_url`, checks `/health`, lists `/actions`,
validates allowlisted actions and typed params, and outputs only envelope
summaries. It must not print full upstream body or ask the service to do risk
judgment.

`/browser-backed-risk-service 自测用户 <user_id>` is the recommended one-command
user self-test. It lets a user run one real case, similar to an rc-cli flow,
while keeping the service pure passthrough. The main Agent calls a safe default
group of allowlisted actions:

- `track_analysis_summary` with `sub_interface=profile`
- `login_logs_search`
- `weapon_inventory`
- `archives_user_profile`

Optional smoke:

- `archives_private_message_search` with `direction=sent`, `page=1`,
  `count=20`

`rcp_snapshot` is not included by default because it is not a direct
`user_id` lookup.

Expected self-test output:

- `service_ready`
- `action_count=37`
- per-action envelope summary
- per-action `live_status`
- main-agent observation summary such as `track_profile_observed`,
  `login_records_observed`, `device_graph_observed`, and
  `archives_profile_observed`
- `missing_sources`
- `credential_material_output=false`
- `raw_upstream_body_printed=false`

Any field extraction, table, evidence-package summary, missing-evidence list, or
next-step suggestion belongs to the main Agent. The browser-backed service still
does not produce summaries, evidence cards, source quality, no-data
interpretation, or risk judgment.

Mac worker npm command helpers:

- `npm run worker:start`
- `npm run worker:status`
- `npm run worker:expose`
- `npm run worker:stop`
- `npm run worker:doctor`

These commands reduce repeated remote command approvals by grouping common
start/status/stop/diagnostic operations. They never delete profiles and never
read or output authentication material.

`worker:expose` is the verified low-approval runtime helper for Remote Main
Agent + Mac Local Worker Mode. It starts or reuses a constrained proxy on the
Mac and prints a `service_base_url` such as `http://<mac_ip>:9787`. The proxy
forwards only `/health`, `/actions`, and `/actions/<allowlisted_action>` to the
local service. It does not expose arbitrary URL fetch, Chrome profile files,
cookies, tokens, sessions, authorization values, request headers, localStorage,
or Playwright storageState.

Remote package transfer fallback and low-approval runtime details are recorded
in [`REMOTE_MAIN_AGENT_SUCCESS_PATHS.md`](./REMOTE_MAIN_AGENT_SUCCESS_PATHS.md).

## Capability Playbook

Users and main agents do not need to memorize all 37 action names. Use
[`CAPABILITY_INDEX.yaml`](./CAPABILITY_INDEX.yaml) for capability-to-action
mapping and [`ACTION_PLAYBOOK.md`](./ACTION_PLAYBOOK.md) for user-facing "what
do I want to inspect" guidance.

Supported command intents include:

- `/browser-backed-risk-service 用户画像 <user_id>`
- `/browser-backed-risk-service 登录历史 <user_id>`
- `/browser-backed-risk-service 设备图谱 <user_id>`
- `/browser-backed-risk-service 作品查询 <user_id>`
- `/browser-backed-risk-service 私信样本 <user_id>`
- `/browser-backed-risk-service 资料变更 <user_id>`
- `/browser-backed-risk-service 策略事件 <eventType> <eventId>`
- `/browser-backed-risk-service action <action_name> <json_params>`

These commands still call fixed actions with typed params. Any business parsing
or presentation is done by the calling main agent, not by the browser-backed
service.

## Deployment Modes

### Local Agent Mode

Use this when the Agent, local script, or curl command runs on the same computer
as the browser-backed service.

- `service_base_url=http://127.0.0.1:8787`
- No bridge or tunnel is required.
- The profile and refresh state stay on the teammate's own computer.
- Daily users only need `npm run worker:start`; it refreshes, starts, or opens
  the profile interactively when required.

### Remote Main Agent + Mac Local Worker Mode

Use this when the main Agent runs remotely or in a cloud environment.

- Do not assume the remote Agent can reach the teammate's
  `http://127.0.0.1:8787`; that address refers to the remote Agent's own
  machine.
- Run the browser-backed service on the teammate's Mac as the local worker.
- Keep Chrome profile and refresh state on the teammate's Mac.
- Let the teammate complete SSO, two-factor checks, and Archives account
  confirmation in Mac Chrome.
- Keep the teammate's Mac powered on and online.
- Keep MyFlicker / Mac node client, or the approved equivalent channel, online
  and connected.
- Keep browser-backed service running on the Mac.
- Ensure the Chrome profile is not locked by another Chrome/Playwright process.
- Configure `BROWSER_BACKED_SERVICE_BASE_URL`, or the Agent's equivalent
  setting, to a controlled Mac worker/bridge/tunnel URL.
- Do not expose the service directly to the public internet.
- Do not copy the Mac profile to Linux, inject cookies, inject storageState, or
  use `sso_session.py`.

This is the recommended path for remote main Agents. It matches the successful
rc-cli style flow: authentication and platform access happen on Mac, while the
remote Agent only invokes bounded worker capabilities.

For a lower-friction daily experience, keep the Mac worker running:

```sh
npm run worker:start
```

Use `npm run worker:doctor` for profile lock, port, install, or readiness
diagnostics. Use `npm run worker:stop` to stop the worker without deleting the
profile or refresh state.

If the remote Agent reports `mac_node_disconnected`, open the MyFlicker Mac
client, confirm the node is connected, and retry `/browser-backed-risk-service
状态`. Do not switch to Chrome profile copy, cookie injection, storageState
injection, or `sso_session.py`.

### Not Recommended: Mac Profile Copy To Linux Headless

Joint testing showed that Mac profile bootstrap to Linux headless is not a
stable team path. Track Analysis may become ready, but RCP, Weapon, Login Logs,
and Archives can trigger `two_factor_required`. Do not ask teammates to copy Mac
profiles to Linux as a normal workflow.

See `LOCAL_WORKER_BRIDGE_PLAN.md`, `MAC_LOCAL_WORKER_GUIDE.md`, and
`BROWSER_BACKED_SERVICE_COMMANDS.md`.

### Auth State Transfer POC

Auth State Transfer is a candidate POC, not a recommended mode yet. Its goal is
to validate whether same-user bounded auth state can be activated on Mac and
loaded by the main Agent machine without copying a full Chrome profile
directory. It is not assumed to succeed or fail.

Until that POC is proven, Mac Local Worker remains the stable remote-main-agent
path. See `AUTH_STATE_TRANSFER_POC.md`.

## Local Setup

Install dependencies:

```sh
npm install
```

Daily start:

```sh
npm run worker:start
```

`worker:start` checks whether the service is already running. If it is ready,
it returns a sanitized ready summary. If not, it runs `refresh:once`, starts the
service, and only opens the visible profile flow when SSO, 2FA, QR, captcha, or
manual account confirmation is required.

Existing custom profile:

```sh
BROWSER_BACKED_PROFILE_DIR=/path/to/your/profile npm run worker:start
```

Do not copy someone else's profile. Do not commit profile/state files.

Advanced/manual debugging commands remain available but are not the daily
entrypoint:

```sh
npm run open:profile
npm run refresh:once
npm run start:live
```

Optional refresh loop:

```sh
npm run refresh:daemon
```

`refresh:daemon` refreshes immediately at startup and then every 4 hours by
default. Override with `REFRESH_INTERVAL_MINUTES` or
`BROWSER_BACKED_REFRESH_INTERVAL_MS`. If manual login is required, the daemon
records `pending_manual_login` and asks the user to run `npm run worker:start`;
it does not bypass auth or repeatedly open browsers.

Mac worker helper commands:

```sh
npm run worker:start
npm run worker:status
npm run worker:doctor
npm run worker:stop
```

## Mock Mode

```sh
npm run start:mock
```

Examples:

```sh
SERVICE_BASE_URL="${BROWSER_BACKED_SERVICE_BASE_URL:-http://127.0.0.1:8787}"

curl "$SERVICE_BASE_URL/health"
curl "$SERVICE_BASE_URL/actions"
curl -X POST "$SERVICE_BASE_URL/prewarm"
curl -X POST "$SERVICE_BASE_URL/actions/login_logs_search" \
  -H 'content-type: application/json' \
  -d '{"user_id":"2871834924"}'
```

Skill self-test example:

```txt
/browser-backed-risk-service 自测用户 403082302
```

Replace the sample user with a user you personally have permission to inspect
and that may have platform data. The Skill should output envelope summaries,
main-agent processing summaries, missing sources, and safety fields, not full
upstream body.

## Archives Landing Flow

Archives may require a lightweight account confirmation every few hours.
Readiness/prewarm may click allowlisted confirmation controls only when the
account is already present and there is no password, OTP, QR, captcha, or
permission-blocked signal. The service never enters usernames, passwords, OTP,
or captcha values. If manual factors appear, run `npm run worker:start`; it
will open the profile flow and continue refresh/start after the user completes
the interaction.

## Files

- `src/server.js` - HTTP service and routes.
- `src/service.js` - action execution, origin readiness, and controlled batch.
- `src/actions.js` - fixed action registry, typed params, request builders, and
  safe transport envelope builders.
- `src/browser.js` - Playwright persistent context and same-origin fetch.
- `src/config.js` - environment loading.
- `src/originRegistry.js` - fixed origin registry.
- `src/authState.js` - sanitized profile/state readiness metadata.
- `src/diagnostics.js` - sanitized transport/auth classification helpers.

## Related Docs

- `ACTION_REGISTRY.md`
- `PASSTHROUGH_SERVICE_CONTRACT.md`
- `BROWSER_BACKED_AGENT_SKILL.md`
- `TEAM_LOCAL_SETUP.md`
- `TROUBLESHOOTING.md`
- `LOCAL_WORKER_BRIDGE_PLAN.md`
- `MAC_LOCAL_WORKER_GUIDE.md`
- `BROWSER_BACKED_SERVICE_COMMANDS.md`
- `AUTH_STATE_TRANSFER_POC.md`

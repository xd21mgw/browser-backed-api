# Browser-Backed Agent Skill Draft

## Positioning

This skill uses the **Browser-backed Risk Platform Access Service** as a local
controlled transport service for risk-platform reads.

- Service base URL: `service_base_url`
- Default local value: `http://127.0.0.1:8787`
- Remote/cloud main Agents must not assume `127.0.0.1` is the teammate's
  computer. In Remote Main Agent + Local Worker Mode, resolve
  `service_base_url` from `BROWSER_BACKED_SERVICE_BASE_URL` or the Agent's
  equivalent config.
- Each teammate uses their own Chrome profile and platform permissions.
- Agent calls only allowlisted fixed actions.
- Agent sends only typed params.
- Agent must not read cookies, tokens, sessions, request headers, Chrome cookie
  DBs, browser storage, or profile files.
- Agent must not compose arbitrary platform URLs or call platform endpoints
  directly.
- The service returns a transport envelope only; raw upstream body is
  suppressed.

The service is not a business reasoning engine. Dennis or the upper-layer Agent
owns parsing, observations, evidence cards, output policy, and final reasoning.

## Calling Principles

1. Resolve `service_base_url`.
   - Local Agent Mode default: `http://127.0.0.1:8787`.
   - Remote Main Agent + Local Worker Mode: use
     `BROWSER_BACKED_SERVICE_BASE_URL` or the Agent's configured bridge/tunnel
     URL.
2. Call `{service_base_url}/health` first.
3. Call `{service_base_url}/actions` and confirm `action_count=19`.
4. Choose an allowlisted action from `ACTION_REGISTRY.md`.
5. Send only typed params accepted by that action.
6. Use `response_mode=passthrough` or omit it; passthrough is the default.
7. Never send `url`, `path`, `header`, `headers`, `cookie`, `token`, `session`,
   `authorization`, `raw_body`, `raw_query`, or `secret`.
8. Never ask the service to create business summaries, observations, evidence
   cards, source scoring, no-data interpretation, risk judgment, or next-step
   recommendations.
9. If the service is not running, ask the user to start it with
   `npm run start:live` after completing `TEAM_LOCAL_SETUP.md`.

Agent call format:

```txt
GET  {service_base_url}/health
GET  {service_base_url}/actions
POST {service_base_url}/actions/<action_name>
```

For local use, `{service_base_url}` is normally `http://127.0.0.1:8787`. For a
remote main Agent, it is a controlled local-worker bridge/tunnel URL.

## Deployment Modes

### Local Agent Mode

- Agent and browser-backed service run on the same computer.
- Use the default `service_base_url=http://127.0.0.1:8787`.
- No bridge or tunnel is required.
- Teammate setup remains `npm install`, `npm run open:profile`,
  `npm run refresh:once`, and `npm run start:live`.

### Remote Main Agent + Local Worker Mode

- Main Agent runs remotely or in the cloud.
- Browser-backed service runs on the teammate's computer.
- The teammate's computer is the local worker.
- Main Agent calls the configured `service_base_url`, which points to a
  controlled bridge/tunnel for that local worker.
- The bridge/tunnel is deployment infrastructure; this service release does not
  implement it.
- Profile, refresh state, cookies, tokens, sessions, and browser storage remain
  on the teammate's computer.

Bridge/tunnel safety boundary:

- Forward only `/health`, `/actions`, `/actions/<allowlisted_action>`,
  `/actions/batch`, and `/actions/multi_source_plan`.
- Do not expose arbitrary URL fetch or arbitrary platform paths.
- Do not expose Chrome profile files, cookies, tokens, sessions, authorization
  values, request headers, localStorage, or Playwright storageState.
- Require access control such as a temporary token, internal ACL, user
  confirmation, or equivalent deployment guard.
- Do not expose the local service directly to the public internet.

### Temporary Profile Bootstrap Mode

This is a temporary debugging/transition mode for a same-user environment where
the machine that will run the service has no GUI and cannot complete
`npm run open:profile`.

- A GUI Mac may be used temporarily by the same user to complete first-time
  profile activation, periodic Archives/account confirmation, SSO, or required
  human verification.
- After activation, `refresh:once`, `start:live`, and action calls still run on
  the main Agent's local machine only if that same user's usable profile is
  available there.
- Do not treat the Mac service as a long-term central service.
- Do not share profiles across users.
- Do not upload cookies, tokens, sessions, request headers, browser storage,
  storageState, or profile contents.
- Do not let the Agent inspect profile files.

This is not the default team deployment. Local Agent Mode remains the default
local path. Remote Main Agent + Local Worker Mode is the formal remote-Agent
shape.

## Response Contract

Single action responses include transport fields such as:

- `ok`
- `action`
- `action_name`
- `request_id`
- `request_mode=fixed_action`
- `response_mode=passthrough`
- `platform`
- `http_status`
- `content_type`
- `body_present`
- `body_truncated`
- `observed_bytes`
- `elapsed_ms`
- `transport_error`
- `platform_error`
- `invalid_params`
- `timeout`
- `auth_redirect_detected`
- `raw_body_handling=suppressed`
- `upstream.status`
- `upstream.content_type`
- `upstream.body_present`
- `upstream.body_omitted=true`
- `safety.credential_material_output=false`

Agent must not expect raw upstream body in the browser-backed service response.

## Controlled Multi-Source Calls

For multi-source work, Agent may call `POST /actions/batch` instead of firing
uncoordinated HTTP requests.

Supported group modes:

- `independent_parallel`
- `dependency_serial`
- `large_response_serial`
- `auth_sensitive_serial`

Batch output includes:

- `source_results`
- `transport_status_matrix`
- `classifications`
- `missing_or_failed_sources`
- `execution_groups`
- `safety`

One source failure must not be treated as a whole-batch failure unless all
required sources failed or the caller's own plan decides it cannot proceed.

## Fixed Actions

| action_name | origin_key |
| --- | --- |
| `track_analysis_summary` | `track_analysis` |
| `login_logs_search` | `login_logs` |
| `weapon_inventory` | `weapon` |
| `rcp_snapshot` | `rcp` |
| `archives_user_profile` | `archives` |
| `archives_user_analysis` | `archives` |
| `archives_photo_search` | `archives` |
| `archives_related_users` | `archives` |
| `archives_private_message_search` | `archives` |
| `archives_past_four_items` | `archives` |
| `rcp_event_detail` | `rcp` |
| `rcp_event_feature_list` | `rcp` |
| `rcp_policy_version_lookup` | `rcp` |
| `rcp_policy_detail_lookup` | `rcp` |
| `rcp_policy_release_record_lookup` | `rcp` |
| `rcp_policy_tree_lookup` | `rcp` |
| `rcp_node_policy_attribution` | `rcp` |
| `rcp_node_bind_policy_attribution` | `rcp` |
| `track_analysis_check_data_ready` | `track_analysis` |

## Scenario Mapping

| User question | Agent action plan |
| --- | --- |
| "看这个用户近期登录和设备风险" | Call `login_logs_search`, `weapon_inventory`, and optionally `track_analysis_summary`; parse outside the service. |
| "看这个设备关联" | Call `weapon_inventory` with typed `device_id`. |
| "看策略事件入口" | Call `rcp_snapshot` with typed event/time filters. |
| "看用户活跃画像和设备列表" | Call `track_analysis_summary` with the relevant fixed `sub_interface`. |
| "看私信/档案中心明细" | Use an explicit Archives fixed action with typed params. |
| "看某个 eventId 的详情/特征/策略树/归因" | Use explicit RCP downstream actions only when typed event/policy/tree params are available. |

## Forbidden Actions

Agent must not:

- Automatically dispose, block, freeze, appeal, label, or change upstream state.
- Bypass or escalate platform permissions.
- Read or export cookies, tokens, sessions, request headers, browser storage, or
  Chrome cookie DB data.
- Call arbitrary URLs, platform paths, raw query strings, raw request bodies, or
  caller-provided endpoints.
- Automatically call DataAgent or Hive.
- Ask the service to interpret no-data, produce business observations, create
  evidence cards, score source quality, or provide risk conclusions.
- Call excluded-noise capabilities such as telemetry, static assets,
  fingerprinting, radar/misc/log collection, log-sdk traffic, mobile-device-info
  traffic, or menu/config probes without direct service value.

## Adding A New Callable Action

Before a new service action can become callable, it must have:

- fixed `origin_key`
- fixed method and same-origin relative path
- typed params and validation
- forbidden-input rejection for URL/path/header/cookie/token/session/raw body/raw
  query
- transport-only response envelope
- raw body suppression
- credential-material protection
- mock tests for success, parameter errors, forbidden inputs, upstream errors,
  too-large responses, and credential-material protection
- live smoke evidence showing no authentication material output
- `ACTION_REGISTRY.md` status update

Until then, keep it out of the allowlist.

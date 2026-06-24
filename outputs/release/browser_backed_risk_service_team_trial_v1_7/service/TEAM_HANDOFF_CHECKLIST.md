# Team Handoff Checklist

This checklist is for opening `browser-backed-api-poc` to 1-2 core teammates for
local internal testing.

## Pre-Test Checks

- `git status --short` is clean.
- `npm run check` passes.
- `npm run test:mock` passes.
- `ACTION_REGISTRY.md` shows callable `action_count=74`.
- No `.env`, `node_modules`, Chrome profile directory, refresh state, HAR,
  screenshot, or temporary capture is committed.
- `PASSTHROUGH_SERVICE_CONTRACT.md` is the service-layer contract for
  passthrough behavior.

## First-Time Teammate Steps

1. Download the repo and enter the project directory.
   - Remote transfer must follow `REMOTE_MAIN_AGENT_SUCCESS_PATHS.md`.
   - If Linux HTTP server transfer fails, report `release_transfer_failed` and
     stop.
   - If Mac node command approval times out, report
     `mac_command_approval_required` and stop.
   - Do not use base64 chunks, per-file writes, KCDN/ad hoc uploads, SSH/SCP
     guessing, profile copy, cookie injection, storageState injection, or
     arbitrary URL fetch.
2. Run `npm install`.
3. Run `npm run worker:start`.
   - If manual login or account confirmation is required, the command opens the
     visible profile flow and continues after the user finishes.
4. Check health:

```sh
SERVICE_BASE_URL="${BROWSER_BACKED_SERVICE_BASE_URL:-http://127.0.0.1:8787}"
curl "$SERVICE_BASE_URL/health"
```

5. List actions:

```sh
SERVICE_BASE_URL="${BROWSER_BACKED_SERVICE_BASE_URL:-http://127.0.0.1:8787}"
curl "$SERVICE_BASE_URL/actions"
```

6. For Remote Main Agent + Mac Local Worker Mode, expose a low-approval worker
   URL after the Mac service is ready:

```sh
npm run worker:expose
```

Use the printed `service_base_url` for the remote main Agent. Do not hardcode a
previously observed Mac IP.

7. Call only fixed allowlisted actions:

```sh
SERVICE_BASE_URL="${BROWSER_BACKED_SERVICE_BASE_URL:-http://127.0.0.1:8787}"

curl -X POST "$SERVICE_BASE_URL/actions/track_analysis_summary" \
  -H 'content-type: application/json' \
  -d '{"response_mode":"passthrough","sub_interface":"profile","user_id":"<replace_with_test_user_id>","appName":"KUAISHOU"}'
```

Replace sample entity values with a `user_id`, `device_id`, `eventId`, or
`policyCode` that you personally have permission to view and that is likely to
have data on the platform. If you do not have a suitable sample, the result may
be `no_data`, `auth_blocked`, or `param_needed`; that is not automatically a
service failure.

## Skill-Managed Workflow

The Agent Skill should guide teammates through these command-style intents:

- `/browser-backed-risk-service 安装`
- `/browser-backed-risk-service 启动`
- `/browser-backed-risk-service 状态`
- `/browser-backed-risk-service actions`
- `/browser-backed-risk-service 用户画像 <user_id>`
- `/browser-backed-risk-service 登录历史 <user_id>`
- `/browser-backed-risk-service 设备图谱 <user_id>`
- `/browser-backed-risk-service 作品查询 <user_id>`
- `/browser-backed-risk-service 私信样本 <user_id>`
- `/browser-backed-risk-service 资料变更 <user_id>`
- `/browser-backed-risk-service 策略事件 <eventType> <eventId>`
- `/browser-backed-risk-service 自测用户 <user_id>`
- `/browser-backed-risk-service action <action_name> <json_params>`
- `/browser-backed-risk-service 停止`
- `/browser-backed-risk-service 排障`

The Skill should check status before action calls, validate allowlisted actions
and typed params, and output only envelope summaries.

`/browser-backed-risk-service 自测用户 <user_id>` is the preferred one-command
teammate self-test. It should call the default read-only action group:

- `track_analysis_summary`
- `login_logs_search`
- `weapon_inventory`
- `archives_user_profile`

Optional:

- `archives_private_message_search`

It should output service status, per-action envelope summaries, live status,
main-agent processing summaries, missing/blocked sources, and safety fields.
It must not print full upstream body. It must label any field extraction,
evidence-package summary, or next-step suggestion as main-Agent processing, not
browser-backed service output.

For Mac worker daily use, the Skill should prefer fixed worker commands:

- `npm run worker:start`
- `npm run worker:expose`
- `npm run worker:status`
- `npm run worker:stop`
- `npm run worker:doctor`

This avoids repeated ad hoc command approvals during normal remote Agent use.

## Existing Local Profile

If you already have a dedicated local Chrome/Playwright profile for this
service, run refresh and live mode with that profile path:

```sh
BROWSER_BACKED_PROFILE_DIR=/path/to/your/profile npm run worker:start
```

If `BROWSER_BACKED_PROFILE_DIR` is not set, the default profile is:

```txt
~/.dennis-browser-backed/profile
```

Rules:

- Do not copy another teammate's profile.
- Do not commit a profile directory to git.
- Do not send a profile directory to anyone.
- The same profile can be used by only one Chrome/Playwright process at a time.
- Use the dedicated default profile `~/.dennis-browser-backed/profile`.
- Do not point `BROWSER_BACKED_PROFILE_DIR` at the user's daily Chrome profile.
- Main agents and Skills must not automatically close or kill Chrome. Profile
  locks require `npm run worker:doctor` diagnostics and user confirmation.

## Service Ready Standard

- `/health` returns `ok=true`.
- `service_mode=live`.
- `auth_state=ready`, or the specific origin needed by the action is ready.
- `action_count=74`.
- No credential material is output.
- In Local Agent Mode, the service is listening on `127.0.0.1`.
- In Remote Main Agent + Mac Local Worker Mode, the Agent uses a configured
  `service_base_url` for a controlled bridge/tunnel to the teammate's Mac local
  worker.

## Deployment Mode Check

Local Agent Mode:

- Agent/script/curl and browser-backed service run on the same computer.
- `service_base_url=http://127.0.0.1:8787`.
- No bridge/tunnel is required.

Remote Main Agent + Mac Local Worker Mode:

- Main Agent runs remotely or in the cloud.
- Browser-backed service runs on the teammate's Mac.
- Chrome profile and refresh state stay on the Mac.
- The teammate's Mac is powered on and online.
- MyFlicker / Mac node client, or the approved equivalent channel, is online
  and connected.
- Browser-backed service is running on the Mac.
- Chrome profile is not locked by another Chrome/Playwright process.
- The teammate completes SSO, two-factor checks, and Archives account
  confirmation in Mac Chrome.
- The remote Agent must not assume `127.0.0.1` points to the teammate's
  computer.
- Configure `BROWSER_BACKED_SERVICE_BASE_URL` or equivalent Agent config to a
  controlled Mac worker/bridge/tunnel URL.
- The bridge/tunnel must forward only service routes and must not expose
  arbitrary URL fetch, Chrome profile files, cookies, tokens, sessions, request
  headers, localStorage, or storageState.
- Daily use should not reopen the browser or ask the user to repeatedly approve
  command snippets. Keep the Mac worker running and let the remote main Agent
  call `service_base_url/actions/<action_name>`.
- If the Mac node is disconnected, ask the user to open the MyFlicker Mac
  client, confirm node connected, and retry status. Do not use profile copy,
  cookie injection, storageState injection, or `sso_session.py`.

Not recommended:

- Do not copy a Mac profile to Linux headless as the team workflow.
- Do not use cookie injection, storageState injection, or `sso_session.py`.
- Joint testing showed this path may trigger `two_factor_required` for RCP,
  Weapon, Login Logs, and Archives.

Auth State Transfer POC:

- Candidate only; not recommended yet and not rejected as impossible.
- Same-user bounded auth state transfer may be validated separately.
- Do not commit or print auth-state contents.
- Until proven, Mac Local Worker remains the stable remote-main-agent path.

Deployment priority:

- Local Agent Mode is the default local mode.
- Remote Main Agent + Mac Local Worker Mode is the formal team remote-Agent
  shape.

## Internal Test Scope

All callable actions are passthrough-only at the service layer. Legacy
compat/summary modes are rejected.

Default-open actions:

- `track_analysis_summary`
- `login_logs_search`
- `weapon_inventory`
- `rcp_snapshot`

Explicit actions:

- `archives_user_profile`
- `archives_user_analysis`
- `archives_photo_search`
- `archives_photo_profile`
- `archives_photo_meta`
- `archives_photo_report_aggregate`
- `archives_photo_user_autonomy`
- `archives_gallery_photo_list`
- `archives_related_users`
- `archives_private_message_search`
- `archives_past_four_items`
- `rcp_event_detail`
- `rcp_event_feature_list`
- `rcp_event_tree_or_decision`
- `rcp_fast_query_hbase`
- `rcp_feature_info_by_keys`
- `rcp_policy_basic_info`
- `rcp_relation_policy_tree`
- `rcp_policy_binding_info_list`
- `rcp_policy_search`
- `rcp_policy_blur_search`
- `rcp_policy_all_version`
- `rcp_pipeline_policy_versions_by_code`
- `rcp_policy_version_lookup`
- `rcp_policy_detail_lookup`
- `rcp_policy_release_record_lookup`
- `rcp_policy_tree_lookup`
- `rcp_node_policy_attribution`
- `rcp_node_bind_policy_attribution`
- `track_analysis_check_data_ready`
- `track_analysis_product_list`
- `track_sequence_dimension_list`
- `track_data_type_list`

Excluded-noise categories are never open:

- telemetry
- radar/misc/log collection
- log-sdk traffic
- JS/CSS/static assets
- h5-fingerprint
- mobile-device-info
- menu/config probes without direct evidence value
- arbitrary URL fetch
- cookie/token/session/header capabilities

## Safety Checks

- Do not share Chrome profiles.
- Do not commit refresh state.
- Do not output cookies, tokens, sessions, headers, authorization strings, or
  passwords.
- Do not enable arbitrary URL fetch.
- Do not bypass permissions.
- Do not ask the service to make risk judgments, evidence cards, no-data
  interpretations, or next-step recommendations.
- Treat upstream business fields such as `user_id`, `deviceId`, IP, `eventId`,
  `sourceId`, and policy codes as risk entities, not authentication material.

## Passthrough Smoke Record Format

When recording passthrough smoke results, collect only the envelope summary and
safety fields:

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
- whether cookie/token/session/header/authorization/password appeared: `false`

Do not paste:

- full `upstream.body`
- request headers
- cookie/token/session/header values
- authorization strings or passwords
- Chrome profile contents
- localStorage, browser storage dumps, or Playwright storage state

## Upgrade And Rollback

Upgrade:

```sh
git pull
npm install
npm run worker:start
```

Rollback:

```sh
git checkout <previous-stable-commit-or-tag>
npm install
npm run worker:start
```

## Feedback Template

Collect only sanitized information:

- `action_name`
- request params used
- `http_status`
- `ok`
- `response_mode`
- `upstream.status`
- `upstream.content_type`
- `upstream.body_present`
- `upstream.body_omitted`
- `live_status`
- `error_type`
- whether `safety.credential_material_output=false`
- whether the issue looks like permission, parameter, platform, or service code

Do not collect or paste cookies, tokens, sessions, request headers,
authorization strings, Chrome profile files, localStorage dumps, Playwright
storage state, `.env`, or raw upstream bodies unless a separate controlled
internal review explicitly asks for bounded upstream business response content.

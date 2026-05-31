# Team Handoff Checklist

This checklist is for opening `browser-backed-api-poc` to 1-2 core teammates for
local internal testing.

## Pre-Test Checks

- `git status --short` is clean.
- `npm run check` passes.
- `npm run test:mock` passes.
- `ACTION_REGISTRY.md` shows callable `action_count=19`.
- No `.env`, `node_modules`, Chrome profile directory, refresh state, HAR,
  screenshot, or temporary capture is committed.
- `PASSTHROUGH_SERVICE_CONTRACT.md` is the service-layer contract for
  passthrough behavior.

## First-Time Teammate Steps

1. Download the repo and enter the project directory.
2. Run `npm install`.
3. Run `npm run open:profile`.
4. Finish internal platform login in the visible browser, then press Enter in
   the terminal.
5. Run `npm run refresh:once`.
6. Run `npm run start:live`.
7. Check health:

```sh
curl http://127.0.0.1:8787/health
```

8. List actions:

```sh
curl http://127.0.0.1:8787/actions
```

9. Call only fixed allowlisted actions:

```sh
curl -X POST http://127.0.0.1:8787/actions/track_analysis_summary \
  -H 'content-type: application/json' \
  -d '{"response_mode":"passthrough","sub_interface":"profile","user_id":"123","appName":"KUAISHOU"}'
```

## Service Ready Standard

- `/health` returns `ok=true`.
- `service_mode=live`.
- `auth_state=ready`, or the specific origin needed by the action is ready.
- `action_count=19`.
- No credential material is output.
- The service is listening only on `127.0.0.1`.

## Internal Test Scope

Dual-mode actions:

- `track_analysis_summary`
- `login_logs_search`
- `weapon_inventory`
- `rcp_snapshot`
- `archives_user_profile`
- `archives_user_analysis`
- `archives_photo_search`
- `archives_related_users`
- `rcp_event_detail`
- `rcp_event_feature_list`
- `rcp_policy_tree_lookup`
- `track_analysis_check_data_ready`

Passthrough-only actions:

- `archives_private_message_search`
- `archives_past_four_items`
- `rcp_policy_version_lookup`
- `rcp_policy_detail_lookup`
- `rcp_policy_release_record_lookup`
- `rcp_node_policy_attribution`
- `rcp_node_bind_policy_attribution`

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

## Upgrade And Rollback

Upgrade:

```sh
git pull
npm install
npm run refresh:once
npm run start:live
```

Rollback:

```sh
git checkout <previous-stable-commit-or-tag>
npm install
npm run refresh:once
npm run start:live
```

## Feedback Template

Collect only sanitized information:

- `action_name`
- request params used
- `response_mode`
- `upstream.status`
- `live_status`
- `error_type`
- whether `safety.credential_material_output=false`
- whether the issue looks like permission, parameter, platform, or service code

Do not collect or paste cookies, tokens, sessions, request headers,
authorization strings, Chrome profile files, localStorage dumps, Playwright
storage state, `.env`, or raw upstream bodies unless a separate controlled
internal review explicitly asks for bounded upstream business response content.

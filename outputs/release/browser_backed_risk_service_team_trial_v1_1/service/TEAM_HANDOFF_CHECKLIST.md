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
  -d '{"response_mode":"passthrough","sub_interface":"profile","user_id":"<replace_with_test_user_id>","appName":"KUAISHOU"}'
```

Replace sample entity values with a `user_id`, `device_id`, `eventId`, or
`policyCode` that you personally have permission to view and that is likely to
have data on the platform. If you do not have a suitable sample, the result may
be `no_data`, `auth_blocked`, or `param_needed`; that is not automatically a
service failure.

## Existing Local Profile

If you already have a dedicated local Chrome/Playwright profile for this
service, run refresh and live mode with that profile path:

```sh
BROWSER_BACKED_PROFILE_DIR=/path/to/your/profile npm run refresh:once
BROWSER_BACKED_PROFILE_DIR=/path/to/your/profile npm run start:live
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

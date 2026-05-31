# Live Smoke: Recovered Passthrough Actions

## Scope

This run validates the seven recovered passthrough-only actions through the
local browser-backed service. The service was called only on
`http://127.0.0.1:8787`; no direct platform URL fetch was made by the caller.

The service boundary remains fixed action, typed params, fixed origin/path, and
upstream response passthrough. This run did not create summaries,
`source_card`, `source_quality`, evidence cards, or risk judgments.

## Run Metadata

| field | value |
| --- | --- |
| tested_at_utc | `2026-05-31T00:44:47.389Z` |
| profile_env | `BROWSER_BACKED_PROFILE_DIR=/Users/pengcheng/chrome-agent-auth-profile` |
| service_url | `http://127.0.0.1:8787` |
| service_mode | `live` |
| auth_state | `ready` |
| action_count | `19` |
| prewarm_http_status | `200` |

## Service Health Summary

| origin_key | status | error_type | page_ready | warmed | final_origin |
| --- | --- | --- | --- | --- | --- |
| `archives` | `ready` |  | `true` | `true` | `https://admin.p.adm-corp.kuaishou.com` |
| `rcp` | `ready` |  | `true` | `true` | `https://rcp.corp.kuaishou.com` |

Prewarm confirmed both `archives` and `rcp` as `ready` with `page_ready=true`.

## Parameter Sources

Archives action params came from the user-requested smoke payloads. RCP sample
params were reused from local recovered contract and run-log material; they were
not guessed:

- `eventType=USER_REGISTER_NEW`
- `eventId=5370247893355116990`
- `policyCode=BS_fake_account_register_thirdPlatformAll_bindphone`
- `policyVersion=5`
- `queryTime=1779774526479`
- `policyTreeCode=USER_REGISTER_NEW`
- `policyTreeVersion=887`
- `policyTreeNodeCode=53187346034508`

## Result Summary

| action_name | live_status | http_status | ok | upstream.status | upstream.content_type | body_present | body_omitted | response_too_large | error_type | safety.credential_material_output |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `archives_private_message_search` | `live_pass` | `200` | `true` | `200` | `application/json;charset=utf-8` | `true` | `false` | `false` |  | `false` |
| `archives_past_four_items` | `live_pass` | `200` | `true` | `200` | `application/json;charset=utf-8` | `true` | `false` | `false` |  | `false` |
| `rcp_policy_version_lookup` | `live_pass` | `200` | `true` | `200` | `application/json;charset=UTF-8` | `true` | `false` | `false` |  | `false` |
| `rcp_policy_detail_lookup` | `live_pass` | `200` | `true` | `200` | `application/json;charset=UTF-8` | `true` | `false` | `false` |  | `false` |
| `rcp_policy_release_record_lookup` | `live_no_data` | `200` | `true` | `200` | `text/plain` | `false` | `false` | `false` |  | `false` |
| `rcp_node_policy_attribution` | `live_pass` | `200` | `true` | `200` | `application/json;charset=UTF-8` | `true` | `false` | `false` |  | `false` |
| `rcp_node_bind_policy_attribution` | `live_pass` | `200` | `true` | `200` | `application/json;charset=UTF-8` | `true` | `false` | `false` |  | `false` |

`rcp_node_policy_attribution` returned `page_load_error` on the first attempt
without an upstream response. After an RCP prewarm retry with the same typed
params, it returned `live_pass`.

## Request Params

### `archives_private_message_search`

```json
{
  "response_mode": "passthrough",
  "user_id": "2871834924",
  "direction": "sent",
  "page": 1,
  "count": 20
}
```

### `archives_past_four_items`

```json
{
  "response_mode": "passthrough",
  "user_id": "2871834924",
  "info_type": "all",
  "page": 1,
  "count": 20
}
```

### `rcp_policy_version_lookup`

```json
{
  "response_mode": "passthrough",
  "eventType": "USER_REGISTER_NEW",
  "eventId": "5370247893355116990",
  "policyCode": "BS_fake_account_register_thirdPlatformAll_bindphone",
  "policyVersion": 5,
  "queryTime": 1779774526479
}
```

### `rcp_policy_detail_lookup`

```json
{
  "response_mode": "passthrough",
  "policyCode": "BS_fake_account_register_thirdPlatformAll_bindphone",
  "policyVersion": 5
}
```

### `rcp_policy_release_record_lookup`

```json
{
  "response_mode": "passthrough",
  "policyCode": "BS_fake_account_register_thirdPlatformAll_bindphone",
  "page": 1,
  "size": 20
}
```

### `rcp_node_policy_attribution`

```json
{
  "response_mode": "passthrough",
  "eventType": "USER_REGISTER_NEW",
  "eventId": "5370247893355116990",
  "policyCode": "BS_fake_account_register_thirdPlatformAll_bindphone",
  "policyVersion": 5,
  "queryTime": 1779774526479,
  "region": "china"
}
```

### `rcp_node_bind_policy_attribution`

```json
{
  "response_mode": "passthrough",
  "eventType": "USER_REGISTER_NEW",
  "eventId": "5370247893355116990",
  "queryTime": 1779774526479,
  "policyTreeCode": "USER_REGISTER_NEW",
  "policyTreeVersion": 887,
  "policyTreeNodeCode": "53187346034508"
}
```

## Safety Check

| check | result |
| --- | --- |
| credential material output detected | `false` |
| request headers output detected | `false` |
| cookie/token/session/authorization/password output detected | `false` |
| Chrome profile content output detected | `false` |
| upstream body printed in this run log | `false` |

## Unfinished Or Blocked Items

| action_name | issue |
| --- | --- |
| `rcp_policy_release_record_lookup` | Upstream returned HTTP 200 with no parsed body in this smoke; recorded as `live_no_data`, not a service failure. |

No action remains `live_param_needed`, `live_auth_blocked`,
`live_response_too_large`, or `live_fail` after the retry.

## Next Steps

- Keep all seven actions `open_explicit`; they are not default general-review
  calls.
- Downstream callers should parse `upstream.body` only when present.
- For `rcp_policy_release_record_lookup`, rerun later with another known
  `policyCode` if a non-empty release-record response is required.
- Do not add summary, source-card, source-quality, evidence-card, or risk
  judgment logic to these passthrough-only service actions.

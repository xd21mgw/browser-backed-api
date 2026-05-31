# Contract Recovery Report

This report records local-only contract recovery for blocked passthrough action
candidates. It does not add service actions, change the allowlist, start a live
service, access real platforms, or read browser profile/auth storage.

## Search Scope

Searched locations:

- `/Users/pengcheng/dennis-local/browser-backed-api-poc`
- `/Users/pengcheng/dennis-risk-agent`

Searched local file types and materials:

- Markdown docs: registry, readiness, smoke, inventory, release/run-log notes
- YAML contracts under `computer_use_poc/platform_access`
- Python client/fixture/self-test code under `computer_use_poc`
- JavaScript service source and mock tests in this repo

Primary local source files used:

- `ACTION_REGISTRY.md`
- `BLOCKED_ACTIONS.md`
- `har_platform_interface_inventory_v1.md`
- `browser_backed_live_smoke_readiness_v1.md`
- `src/actions.js`
- `src/originRegistry.js`
- `test/mock.test.js`
- `/Users/pengcheng/dennis-risk-agent/computer_use_poc/archives_center_integration_landscape_v1.md`
- `/Users/pengcheng/dennis-risk-agent/computer_use_poc/archives_center_core_capability_map_v2_6_1.md`
- `/Users/pengcheng/dennis-risk-agent/computer_use_poc/har_platform_interface_inventory_v1.md`
- `/Users/pengcheng/dennis-risk-agent/computer_use_poc/browser_backed_service_client.py`
- `/Users/pengcheng/dennis-risk-agent/computer_use_poc/platform_access/archives_center_contract_v0_1.yaml`
- `/Users/pengcheng/dennis-risk-agent/computer_use_poc/platform_access/tianshi_rcp_api_contract_v0_1.yaml`
- `/Users/pengcheng/dennis-risk-agent/computer_use_poc/strategy_governance/tianshi_policy_attribution_api_read_poc_v1.md`
- `/Users/pengcheng/dennis-risk-agent/computer_use_poc/strategy_governance/tianshi_strategy_governance_readonly_capability_v1.md`

No HAR inventory was rerun. No live smoke was executed in this recovery step.

## Recovery Matrix

| action_name | recovered_status | origin_key | method | fixed_path | required_typed_params | optional_typed_params | request_shape_source_file | response_shape_source_file | confidence | can_implement_passthrough_now | missing_pieces | recommended_next_step |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `archives_private_message_search` | recovered | `archives` | `POST` | `/archives/user/message/search` | `user_id`, `direction` (`sent` or `received`) | `page`, `count`, `status`, `sort`, constant `mode=archives_private_message_summary` | `archives_center_integration_landscape_v1.md`; `browser_backed_service_client.py` | `archives_center_core_capability_map_v2_6_1.md`; `browser_backed_service_client.py` fixtures/self-test | high | yes | Not allowlisted or implemented in this repo yet; needs service action, mock tests, and later controlled live smoke. | Implement fixed Archives passthrough action mapping `sent` to `fromUserId` and `received` to `toUserId`; keep caller URL/path/auth/raw body forbidden. |
| `archives_past_four_items` | recovered | `archives` | `POST` | `/v4/audit/user/fourinfo/log/search` | `user_id` | `info_type` (`all`, `username`, `avatar`, `profile_description`, `background`), `infoType`, `page`, `count`, `markResult`, `punishResult`, constant `mode=archives_four_info_change_log_summary` | `archives_center_integration_landscape_v1.md`; `browser_backed_service_client.py` | `archives_center_core_capability_map_v2_6_1.md`; `browser_backed_service_client.py` fixtures/self-test | high | yes | Not allowlisted or implemented in this repo yet; needs service action, mock tests, and later controlled live smoke. | Implement fixed Archives passthrough action mapping `user_id` to `keyword` and validated `info_type` to `infoType`. |
| `rcp_policy_version_lookup` | recovered | `rcp` | `GET` | `/v2/rest/pc/policy/getPolicyVersionListByEvent` | `eventType`, `eventId`, `policyCode`, `policyVersion`, `queryTime` | constant `mode=rcp_policy_version_lookup_readonly` | `har_platform_interface_inventory_v1.md`; `tianshi_rcp_api_contract_v0_1.yaml`; `browser_backed_service_client.py` | `har_platform_interface_inventory_v1.md`; `tianshi_policy_attribution_api_read_poc_v1.md`; `browser_backed_service_client.py` fixtures/self-test | high | yes | Not allowlisted or implemented in this repo yet; needs service action, mock tests, and later controlled live smoke. | Implement fixed RCP GET passthrough action with exact query fields from typed params. |
| `rcp_policy_detail_lookup` | recovered | `rcp` | `GET` | `/v2/rest/pro/policy/getPolicyDetailByVersion` | `policyCode`, `policyVersion` | constant `mode=rcp_policy_detail_lookup_readonly`; companion readonly paths documented but not required for the primary passthrough action | `har_platform_interface_inventory_v1.md`; `tianshi_strategy_governance_readonly_capability_v1.md`; `browser_backed_service_client.py` | `har_platform_interface_inventory_v1.md`; `tianshi_strategy_governance_readonly_capability_v1.md`; `browser_backed_service_client.py` fixtures/self-test | high | yes | Not allowlisted or implemented in this repo yet; needs service action, mock tests, and later controlled live smoke. | Implement primary fixed RCP GET passthrough action first; treat companion paths as separate service-owned follow-up only if explicitly designed. |
| `rcp_policy_release_record_lookup` | recovered | `rcp` | `POST` | `/v2/rest/common/pipeline/list` | `policyCode` | `statusCode`, `page`, `size`, constant `mode=rcp_policy_release_record_lookup_readonly` | `har_platform_interface_inventory_v1.md`; `tianshi_strategy_governance_readonly_capability_v1.md`; `browser_backed_service_client.py` | `har_platform_interface_inventory_v1.md`; `tianshi_strategy_governance_readonly_capability_v1.md`; `browser_backed_service_client.py` fixtures/self-test | high | yes | Not allowlisted or implemented in this repo yet; needs service action, mock tests, and later controlled live smoke. | Implement fixed RCP POST body builder with `extrbB=policyCode`, bounded pagination, and service-owned workflow fields. |
| `rcp_node_policy_attribution` | recovered | `rcp` | `POST` | `/v2/rest/pc/policy/nodePolicyAttribution` | `eventType`, `eventId`, `policyCode`, `policyVersion`, `queryTime` | `region`, fixed `type=""`, constant `mode=rcp_node_policy_attribution_readonly` | `har_platform_interface_inventory_v1.md`; `tianshi_rcp_api_contract_v0_1.yaml`; `tianshi_policy_attribution_api_read_poc_v1.md`; `browser_backed_service_client.py` | `har_platform_interface_inventory_v1.md`; `tianshi_policy_attribution_api_read_poc_v1.md`; `browser_backed_service_client.py` fixtures/self-test | high | yes | Not allowlisted or implemented in this repo yet; needs service action, mock tests, and later controlled live smoke. | Implement fixed RCP POST passthrough action with typed event/policy identity and fixed `type` field. |
| `rcp_node_bind_policy_attribution` | recovered | `rcp` | `GET` | `/v2/rest/pc/policy/nodeBindPolicyAttribution` | `eventType`, `eventId`, `queryTime`, `policyTreeCode`, `policyTreeVersion`, `policyTreeNodeCode` | constant `mode=rcp_node_bind_policy_attribution_readonly` | `har_platform_interface_inventory_v1.md`; `tianshi_policy_attribution_api_read_poc_v1.md`; `browser_backed_service_client.py` | `har_platform_interface_inventory_v1.md`; `tianshi_policy_attribution_api_read_poc_v1.md`; `browser_backed_service_client.py` fixtures/self-test | high | yes | Not allowlisted or implemented in this repo yet; needs service action, mock tests, and later controlled live smoke. | Implement fixed RCP GET passthrough action; require caller to provide a resolved `policyTreeNodeCode` and do not infer it from names. |

## Recovered Actions

- `archives_private_message_search`
- `archives_past_four_items`
- `rcp_policy_version_lookup`
- `rcp_policy_detail_lookup`
- `rcp_policy_release_record_lookup`
- `rcp_node_policy_attribution`
- `rcp_node_bind_policy_attribution`

## Partial Actions

None in this recovery pass.

## Not Found Actions

None in this recovery pass.

## Implementation Boundary

`can_implement_passthrough_now=yes` means the local documents provide enough
fixed origin/path/method/typed-param material to implement a bounded
passthrough service action without guessing. It does not mean the action is
currently callable. All seven recovered actions remain outside this repo's
service allowlist until a separate implementation change adds:

- fixed action registration
- typed param validation
- fixed same-origin request builder
- passthrough envelope tests
- forbidden input tests
- response size and credential-material safety tests
- later controlled live smoke

The service must continue to reject caller-provided URL/path/header/cookie/token/session/authorization/raw_body/raw_query/secret fields, and must not output browser auth material or browser profile storage.

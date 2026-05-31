# Blocked Actions

This file records non-noise action candidates that are not currently callable in
the browser-backed service allowlist. A blocked action is not callable.

Blocking can mean either the service-layer contract is missing, or the contract
has been recovered but the fixed service action has not yet been implemented.
Required material for promotion:

- fixed `origin_key`
- fixed method and same-origin path
- typed params
- request builder mapping from typed params to the fixed upstream request
- passthrough safety policy and mock coverage
- live smoke plan after implementation

The service must not infer an upstream endpoint from a name alone and must not
expose arbitrary URL/path/raw-query/raw-body access.

## Contract Recovery Update

`CONTRACT_RECOVERY_REPORT.md` recovered local fixed-path, method, origin, and
typed-param contracts for all seven rows below. They are now marked
`ready_for_passthrough_implementation`, but they remain blocked because this
repo has not added the action registrations, request builders, or mock tests.

## Blocked Candidate Matrix

| action_name | blocked_reason | missing_fixed_path | missing_typed_params | missing_origin | missing_contract | recommended_next_step |
| --- | --- | --- | --- | --- | --- | --- |
| `archives_private_message_search` | `ready_for_passthrough_implementation`: fixed Archives private-message contract recovered locally, but action is not implemented or allowlisted in this repo. | no: `/archives/user/message/search` | no: `user_id`, `direction`, optional `page`, `count`, `status`, `sort` | no: `archives` | no: recovered in `CONTRACT_RECOVERY_REPORT.md`; implementation still missing | Implement fixed POST passthrough action, typed validation, forbidden input tests, size/credential safety tests, then controlled live smoke. |
| `archives_past_four_items` | `ready_for_passthrough_implementation`: fixed Archives four-info change-log contract recovered locally, but action is not implemented or allowlisted in this repo. | no: `/v4/audit/user/fourinfo/log/search` | no: `user_id`, optional `info_type`, `infoType`, `page`, `count`, `markResult`, `punishResult` | no: `archives` | no: recovered in `CONTRACT_RECOVERY_REPORT.md`; implementation still missing | Implement fixed POST passthrough action mapping `user_id` to `keyword`, add mock/safety tests, then controlled live smoke. |
| `rcp_policy_version_lookup` | `ready_for_passthrough_implementation`: fixed RCP policy-version contract recovered locally, but action is not implemented or allowlisted in this repo. | no: `/v2/rest/pc/policy/getPolicyVersionListByEvent` | no: `eventType`, `eventId`, `policyCode`, `policyVersion`, `queryTime` | no: `rcp` | no: recovered in `CONTRACT_RECOVERY_REPORT.md`; implementation still missing | Implement fixed GET passthrough action, typed query validation, mock/safety tests, then controlled live smoke. |
| `rcp_policy_detail_lookup` | `ready_for_passthrough_implementation`: fixed RCP policy-detail contract recovered locally, but action is not implemented or allowlisted in this repo. | no: `/v2/rest/pro/policy/getPolicyDetailByVersion` | no: `policyCode`, `policyVersion` | no: `rcp` | no: recovered in `CONTRACT_RECOVERY_REPORT.md`; implementation still missing | Implement the primary fixed GET passthrough action first; keep companion reads service-owned only if separately designed. |
| `rcp_policy_release_record_lookup` | `ready_for_passthrough_implementation`: fixed RCP release-record contract recovered locally, but action is not implemented or allowlisted in this repo. | no: `/v2/rest/common/pipeline/list` | no: `policyCode`, optional `statusCode`, `page`, `size` | no: `rcp` | no: recovered in `CONTRACT_RECOVERY_REPORT.md`; implementation still missing | Implement fixed POST body builder with `extrbB=policyCode`, bounded pagination, service-owned workflow fields, and mock/safety tests. |
| `rcp_node_policy_attribution` | `ready_for_passthrough_implementation`: fixed RCP node-policy attribution contract recovered locally, but action is not implemented or allowlisted in this repo. | no: `/v2/rest/pc/policy/nodePolicyAttribution` | no: `eventType`, `eventId`, `policyCode`, `policyVersion`, `queryTime`, optional `region`, fixed `type` | no: `rcp` | no: recovered in `CONTRACT_RECOVERY_REPORT.md`; implementation still missing | Implement fixed POST passthrough action with typed event/policy identity and fixed `type=""`; add mock/safety tests. |
| `rcp_node_bind_policy_attribution` | `ready_for_passthrough_implementation`: fixed RCP node-binding attribution contract recovered locally, but action is not implemented or allowlisted in this repo. | no: `/v2/rest/pc/policy/nodeBindPolicyAttribution` | no: `eventType`, `eventId`, `queryTime`, `policyTreeCode`, `policyTreeVersion`, `policyTreeNodeCode` | no: `rcp` | no: recovered in `CONTRACT_RECOVERY_REPORT.md`; implementation still missing | Implement fixed GET passthrough action requiring resolved `policyTreeNodeCode`; do not infer node code from labels or policy names. |

## Not An Implementation Backlog

Blocked actions are intentionally not added to `ACTION_ALLOWLIST`. They must
remain uncallable until any missing contract material and all service
implementation pieces exist. Any future promotion must update:

- `src/actions.js`
- `src/originRegistry.js`
- `test/mock.test.js`
- `ACTION_REGISTRY.md`
- this file, removing or updating the blocked row

Promotion must preserve the passthrough service boundary: fixed action,
typed params, fixed origin/path, upstream body passthrough with credential
material protection, and response size guard.

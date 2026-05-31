# Blocked Actions

This file records non-noise action candidates that are not currently safe to add
to the browser-backed service allowlist. A blocked action is not callable.

Blocking means the current repo does not contain enough service-layer contract
material to implement a fixed action without guessing. Required material:

- fixed `origin_key`
- fixed method and same-origin path
- typed params
- request builder mapping from typed params to the fixed upstream request
- passthrough safety policy and mock coverage
- live smoke plan after implementation

The service must not infer an upstream endpoint from a name alone and must not
expose arbitrary URL/path/raw-query/raw-body access.

## Blocked Candidate Matrix

| action_name | blocked_reason | missing_fixed_path | missing_typed_params | missing_origin | missing_contract | recommended_next_step |
| --- | --- | --- | --- | --- | --- | --- |
| `archives_private_message_search` | No fixed Archives private-message method/path or typed request contract exists in the current repo docs/source. | yes | yes | no: `archives` origin exists, but this action is not bound to it | yes | Add a source contract with exact fixed path, method, typed params, redaction/safety policy, mock tests, then run live smoke. |
| `archives_past_four_items` | No fixed Archives past-items method/path or typed request contract exists in the current repo docs/source. | yes | yes | no: `archives` origin exists, but this action is not bound to it | yes | Add a source contract with exact fixed path, method, typed params, mock tests, then run live smoke. |
| `rcp_policy_version_lookup` | Current repo has RCP policy-tree companion path constants, but no action-level contract mapping this candidate to an exact fixed request. | yes | yes | no: `rcp` origin exists, but this action is not bound to it | yes | Document the exact RCP method/path and typed params for version lookup before adding the action. |
| `rcp_policy_detail_lookup` | No action-level fixed RCP policy detail method/path or typed request contract exists in the current repo docs/source. | yes | yes | no: `rcp` origin exists, but this action is not bound to it | yes | Document the exact RCP policy detail endpoint, required typed params, mock tests, then live smoke. |
| `rcp_policy_release_record_lookup` | No action-level fixed RCP release-record method/path or typed request contract exists in the current repo docs/source. | yes | yes | no: `rcp` origin exists, but this action is not bound to it | yes | Document the exact release-record endpoint and typed params before implementation. |
| `rcp_node_policy_attribution` | Existing `rcp_policy_tree_lookup` can return policy tree data, but no separate bounded node-attribution action contract exists. | yes | yes | no: `rcp` origin exists, but this action is not bound to it | yes | Define whether this is a separate upstream fetch or downstream parser responsibility; then add fixed path/params if it is a service action. |
| `rcp_node_bind_policy_attribution` | Current repo has a `queryBindingByNodeCode` companion path constant, but no action-level typed params or request contract for this candidate. | yes | yes | no: `rcp` origin exists, but this action is not bound to it | yes | Add a source contract for exact node binding lookup params and safety limits before allowlist registration. |

## Not An Implementation Backlog

Blocked actions are intentionally not added to `ACTION_ALLOWLIST`. They must
remain uncallable until the missing contract material exists. Any future
promotion must update:

- `src/actions.js`
- `src/originRegistry.js`
- `test/mock.test.js`
- `ACTION_REGISTRY.md`
- this file, removing or updating the blocked row

Promotion must preserve the passthrough service boundary: fixed action,
typed params, fixed origin/path, upstream body passthrough with credential
material protection, and response size guard.

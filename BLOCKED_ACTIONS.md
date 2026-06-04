# Blocked Actions

This file records non-noise action candidates that are not currently callable in
the browser-backed service allowlist. A blocked action is not callable.

As of the recovered passthrough action implementation, the seven previously
blocked high-confidence contracts have been promoted to fixed passthrough-only
service actions. They are no longer listed as blocked.

## Current Blocked Candidate Matrix

The current review promoted all validated read-only business contracts whose
fixed path and typed request shape were recoverable. The remaining candidates
below are intentionally not callable.

| candidate | blocked_reason | missing_fixed_path | missing_typed_params | missing_origin | missing_contract | recommended_next_step |
| --- | --- | --- | --- | --- | --- | --- |
| `archives_user_home_audit_log` | `blocked_by_missing_request_shape` | no | yes | no | yes | Need a valid punish/audit id sample before actionization. |
| `archives_draco_label_log` | `blocked_by_missing_request_shape` | no | yes | no | yes | Need a valid punish id sample before actionization. |
| `archives_report_count_flatted` | `contract_uncertain_need_user_review` | no | yes | no | yes | Existing inventory observed platform error; provide successful request sample. |
| `archives_collect_music_search_option` | `noise_or_config` | no | no | no | no | Option/filter endpoint only; not a business list action. |
| `archives_collect_folder_search_option` | `noise_or_config` | no | no | no | no | Option/filter endpoint only; not a business list action. |
| `archives_message_options` | `noise_or_config` | no | no | no | no | Option metadata only. |
| `archives_message_key_maps` | `noise_or_config` | no | no | no | no | Option/key-map metadata only. |
| `archives_comment_types_status_user_status_query_orders_keymaps` | `noise_or_config` | no | no | no | no | Comment option metadata only; use `archives_comment_search` for business reads. |
| `archives_moment_authority` | `blocked_by_missing_request_shape` | no | yes | no | yes | Needs moment context sample. |
| `grafana_dashboard_datasource_proxy` | `arbitrary_url_or_proxy` | no | yes | no | yes | Only implement later with a strict dashboard/query allowlist. |
| `rcp_policy_pipeline_new_version` | `write_operation` | no | no | no | no | Never expose write/new-version actions. |
| `rcp_test_case_run_or_create` | `write_operation` | no | no | no | no | Test execution/create path is not a read-only evidence action. |
| `rcp_user_cache_insert_or_update` | `write_operation` | no | no | no | no | Cache mutation is not allowed. |

If future candidates are blocked, add rows with:

- `action_name`
- `blocked_reason`
- `missing_fixed_path`
- `missing_typed_params`
- `missing_origin`
- `missing_contract`
- `recommended_next_step`

## Recently Promoted From Blocked

These actions were recovered in `CONTRACT_RECOVERY_REPORT.md` and then
implemented as passthrough-only fixed actions:

| action_name | promoted_status | current_service_status | response_mode_support | live_smoke_status |
| --- | --- | --- | --- | --- |
| `archives_private_message_search` | recovered and implemented | allowlisted / mock_ready | `passthrough` only | not run |
| `archives_past_four_items` | recovered and implemented | allowlisted / mock_ready | `passthrough` only | not run |
| `rcp_policy_version_lookup` | recovered and implemented | allowlisted / mock_ready | `passthrough` only | not run |
| `rcp_policy_detail_lookup` | recovered and implemented | allowlisted / mock_ready | `passthrough` only | not run |
| `rcp_policy_release_record_lookup` | recovered and implemented | allowlisted / mock_ready | `passthrough` only | not run |
| `rcp_node_policy_attribution` | recovered and implemented | allowlisted / mock_ready | `passthrough` only | not run |
| `rcp_node_bind_policy_attribution` | recovered and implemented | allowlisted / mock_ready | `passthrough` only | not run |

Promotion preserved the passthrough service boundary: fixed action, typed
params, fixed origin/path, upstream body passthrough with credential-material
protection, response size guard, and no summary/source-card/source-quality
logic for these passthrough-only actions.

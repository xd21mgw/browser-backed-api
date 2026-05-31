# Blocked Actions

This file records non-noise action candidates that are not currently callable in
the browser-backed service allowlist. A blocked action is not callable.

As of the recovered passthrough action implementation, the seven previously
blocked high-confidence contracts have been promoted to fixed passthrough-only
service actions. They are no longer listed as blocked.

## Current Blocked Candidate Matrix

No blocked non-noise action candidates are currently recorded in this file.

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
